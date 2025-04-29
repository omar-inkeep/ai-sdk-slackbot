import type { AppMentionEvent, GenericMessageEvent } from "@slack/web-api";
import { client } from "./slack-utils";
import type { WebClient } from "@slack/web-api";
import {
	type CustomStringsType,
	DeriveCustomStringMessages,
	TEMPLATE_MESSAGES,
} from "./templateMessages";
import config from "../slackConfig.json";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import type {
	Messages,
	OpenAIContentItem,
} from "@inkeep/inkeep-analytics/dist/commonjs/models/components";
import { handleStream } from "./handleStream";
import { logSlackConversation } from "./logSlackConversation";
import { initiateChat } from "./initiateChat";
import { handleStreamOnFinish } from "./handleStreamOnFinish";
import slackifyMarkdown from "slackify-markdown";

export async function handleAppMention(
	event: GenericMessageEvent | AppMentionEvent,
	botUserId: string,
) {
	const channelId = event.channel;
	const workspaceId = event.team;
	const threadTs = event.thread_ts || event.ts;
	const messageAuthorId = event.user || "";
	const messageTs = event.ts;

	const isDM = (event as GenericMessageEvent).channel_type === "im";

	const userMessage = stripTagsAndTrim(event.text || "");
	const userMessageContentItemArray: OpenAIContentItem[] = [
		{
			type: "text",
			text: userMessage,
		},
	];

	const messagesToLogToAnalytics: Messages[] = [];

	const isThreaded = threadTs !== event.ts;

	let isNewChat = !isThreaded;

	const customStrings = config.customStrings as CustomStringsType;

	try {
		if (isThreaded) {
			const { messageHistoryContext, isBotInThread } =
				await getThreadMessageHistoryContext(client, channelId, threadTs);

			if (messageHistoryContext) {
				userMessageContentItemArray.push({
					type: "text",
					text: messageHistoryContext,
				});
			}

			isNewChat = !isBotInThread;
		}

		messagesToLogToAnalytics.push({
			content: userMessageContentItemArray,
			role: "user",
		});

		if (!userMessage && customStrings.noQuestion !== "") {
			await client.chat.postMessage({
				text: slackifyMarkdown(
					customStrings.noQuestion ?? TEMPLATE_MESSAGES.noQuestion,
				),
				channel: channelId,
				thread_ts: threadTs,
				...(await getBotIdentity({
					botId: botUserId,
				})),
			});
			return;
		}

		const isAllowedForChannel =
			config.integration.enabledForChannels?.includes(channelId) || isDM;

		if (!isAllowedForChannel) {
			await client.chat.postMessage({
				text: TEMPLATE_MESSAGES.botNotEnabledForChannel({
					channelId,
					workspaceId: workspaceId ?? "",
				}),
				channel: channelId,
				thread_ts: threadTs,
				...(await getBotIdentity({
					botId: botUserId,
				})),
			});

			console.error(
				"Slackbot not enabled for channel:",
				channelId,
				"; workspaceId:",
				workspaceId,
			);
			return;
		}

		const immediateReplyText =
			DeriveCustomStringMessages.immediateReply({
				customString: customStrings.immediateReply ?? "",
				userName: `<@${messageAuthorId}>`,
			}) ||
			TEMPLATE_MESSAGES.immediateReply({
				isNewChat,
				userName: `<@${messageAuthorId}>`,
				isDraftModeEnabled: config.integration.isDraftModeEnabled,
				botTag: "me",
				includePleaseTagInkeepInIntro: false,
			});

		let botImmediateReplyContent: OpenAIContentItem | null = null;
		if (customStrings.immediateReply !== "") {
			await client.chat.postMessage({
				text: immediateReplyText,
				thread_ts: threadTs,
				channel: channelId,
				...(await getBotIdentity({
					botId: botUserId,
				})),
			});
			botImmediateReplyContent = {
				type: "text",
				text: immediateReplyText,
			};
		}

		const isAskForHelpButtonEnabled =
			config.integration.negativeFeedbackCallback.botIds.length > 0 ||
			config.integration.negativeFeedbackCallback.groupIds.length > 0 ||
			config.integration.negativeFeedbackCallback.userIds.length > 0;

		const stream = await initiateChat({
			isHumanReviewingConversation:
				config.integration.isHumanReviewingConversation || false,
			isAskForHelpButtonEnabled,
			isDraftModeEnabled: config.integration.isDraftModeEnabled,
			userMessageChatCompletionParts: formatUserMessageItems(
				userMessageContentItemArray,
			),
			isThreaded,
		});

		const { message, sources, botResponseMessageId, links } =
			await handleStream({
				stream,
				channelId,
				threadTs,
				botId: botUserId,
			});

		const content: OpenAIContentItem[] = [
			...(botImmediateReplyContent ? [botImmediateReplyContent] : []),
			{
				type: "text",
				text: message,
			},
			...(sources ? [{ type: "text" as const, text: sources }] : []),
		];

		messagesToLogToAnalytics.push({
			content,
			role: "assistant",
			externalId: botResponseMessageId,
			links,
		});

		await handleStreamOnFinish({
			botResponseMessageId,
			sources,
			channelId,
			threadTs,
			messageAuthorId,
			botId: botUserId,
		});
	} catch (error) {
		console.error("Error in handleUserMention:", error);
		if (customStrings.error !== "") {
			await client.chat.postMessage({
				text: customStrings.error ?? TEMPLATE_MESSAGES.error,
				thread_ts: threadTs,
				channel: channelId,
				...(await getBotIdentity({
					botId: botUserId,
				})),
			});
		}
	}

	console.log(
		"messagesToLogToAnalytics",
		JSON.stringify(messagesToLogToAnalytics, null, 2),
	);

	if (workspaceId && process.env.INKEEP_API_KEY) {
		logSlackConversation({
			apiIntegrationKey: process.env.INKEEP_API_KEY,
			messagesToLogToAnalytics,
			workspaceId,
			channelId,
			botId: botUserId,
			messageTs,
			messageAuthorId,
		});
	}
}

function stripTagsAndTrim(input: string): string {
	const regex = /<@!?(\w+|\d+)>/g;
	const stringWithoutTags = input.replace(regex, "");
	const output = stringWithoutTags.trim();
	return output;
}

export const getBotIdentity = async ({
	botId,
}: {
	botId: string;
}): Promise<{ icon_url?: string; username: string }> => {
	try {
		const bot = await client.users.profile.get({ user: botId });
		const name = bot.profile?.display_name || bot.profile?.real_name;

		const response: { icon_url?: string; username: string } = {
			username: name || config.integration.botName,
		};

		// Only add icon_url if valid image URL exists
		const img = config.integration.botAvatarSrcUrl;
		const isImageValid = /\.(jpg|png)$/.test(img ?? "");
		if (isImageValid && img) {
			response.icon_url = img;
		}

		return response;
	} catch (error) {
		console.error("Error fetching bot identity:", error);
		return { username: config.integration.botName };
	}
};

async function getThreadMessageHistoryContext(
	client: WebClient,
	channelId: string,
	threadTs: string,
): Promise<{
	messageHistoryContext: string | undefined;
	isBotInThread: boolean;
}> {
	let isBotInThread = false;

	try {
		const result = await client.conversations.replies({
			channel: channelId,
			ts: threadTs,
			limit: 100,
		});

		if (!result.messages) {
			return {
				messageHistoryContext: undefined,
				isBotInThread,
			};
		}

		const messages = result.messages.map((msg) => {
			if (
				msg.bot_id &&
				msg.bot_profile?.app_id &&
				process.env.INKEEP_BOT_APP_ID &&
				msg.bot_profile?.app_id === process.env.INKEEP_BOT_APP_ID
			) {
				isBotInThread = true;
			}

			return {
				user: msg.user,
				role: msg.bot_id ? "assistant" : "user",
				message: msg.text,
			};
		});

		return {
			messageHistoryContext: `<THREAD_MESSAGE_HISTORY>
					${JSON.stringify(messages)}
				</THREAD_MESSAGE_HISTORY>
			`,
			isBotInThread,
		};
	} catch (error) {
		console.error("Error fetching thread messages:", error);
		return {
			messageHistoryContext: undefined,
			isBotInThread: false,
		};
	}
}

function formatUserMessageItems(
	userMessageContentItemArray: OpenAIContentItem[],
): ChatCompletionContentPart[] {
	return userMessageContentItemArray
		.map((item) => {
			if (item.text) {
				return {
					type: "text" as const,
					text: item.text,
				} as ChatCompletionContentPart;
			}
			return undefined;
		})
		.filter((item) => item !== undefined) as ChatCompletionContentPart[];
}
