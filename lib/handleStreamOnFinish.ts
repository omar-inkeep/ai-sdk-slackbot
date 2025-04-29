import type { ActionsBlock, Button, SectionBlock } from "@slack/web-api";
import type { KnownBlock } from "@slack/web-api";
import slackifyMarkdown from "slackify-markdown";
import slackConfig from "../slackConfig.json";
import { client } from "./slack-utils";
import { type CustomStringsType, TEMPLATE_MESSAGES } from "./templateMessages";
import { getBotIdentity } from "./handleAppMention";

export async function handleStreamOnFinish({
	sources,
	botResponseMessageId,
	channelId,
	threadTs,
	messageAuthorId,
	botId,
}: {
	sources: string | null;
	botResponseMessageId?: string;
	channelId: string;
	threadTs: string;
	messageAuthorId: string;
	botId: string;
}): Promise<void> {
	const responseMetadata: FollowUpResponseMetadata = {
		properties: {
			slack_message_event: {
				slack_channel: channelId,
				slack_question_author_id: messageAuthorId,
			},
			botResponseMessageId,
		},
		tags: {
			userIds: slackConfig.integration.negativeFeedbackCallback.userIds,
			groupIds: slackConfig.integration.negativeFeedbackCallback.groupIds,
			botIds: slackConfig.integration.negativeFeedbackCallback.botIds,
		},
	};

	await client.chat.postMessage({
		blocks: await getFinalResponseBlocks({
			responseSources: sources,
			responseMetadata,
		}),
		channel: channelId,
		unfurl_links: false,
		unfurl_media: false,
		thread_ts: threadTs,
		text: sources ?? "",
		...(await getBotIdentity({
			botId,
		})),
	});
}

type WrapUpResponseBlocksInput = {
	responseSources?: string | null;
	responseMetadata: FollowUpResponseMetadata;
};

export type FollowUpResponseMetadata = {
	properties: {
		slack_message_event: {
			slack_channel: string;
			slack_question_author_id: string;
		};
		botResponseMessageId?: string;
	};
	tags: {
		userIds: string[];
		groupIds: string[];
		botIds: string[];
	};
};

async function getFinalResponseBlocks({
	responseSources,
	responseMetadata,
}: WrapUpResponseBlocksInput): Promise<KnownBlock[]> {
	const blocks: KnownBlock[] = [];

	const responseSourcesBlock: SectionBlock | undefined = responseSources
		? {
				type: "section",
				text: {
					type: "mrkdwn",
					text: slackifyMarkdown(responseSources),
				},
			}
		: undefined;

	const footerBlocks = getFinalResponseFooterBlock({
		metadata: responseMetadata,
	});

	blocks.push(
		...(responseSourcesBlock ? [responseSourcesBlock] : []),
		...footerBlocks,
	);

	return blocks;
}

type FinalResponseFooterBlockArgs = {
	metadata: FollowUpResponseMetadata;
};

function getFinalResponseFooterBlock({
	metadata,
}: FinalResponseFooterBlockArgs): KnownBlock[] {
	const customStrings = slackConfig.customStrings as CustomStringsType;

	const actions: ActionsBlock = {
		type: "actions",
		elements: [...getFollowUpActions(metadata)],
	};

	const footerLabel: SectionBlock | null =
		customStrings.continueThread === ""
			? null
			: {
					type: "section",
					text: {
						type: "mrkdwn",
						text:
							customStrings.continueThread ??
							TEMPLATE_MESSAGES.aiChatResponse.continueThread({
								tag: "me",
								includeAppreciateFeedbackLine: true,
							}),
					},
				};

	const footerBlock = [...(footerLabel ? [footerLabel] : []), actions];

	return footerBlock;
}

export function getFollowUpActions(
	responseMetadata: FollowUpResponseMetadata,
): Button[] {
	const serializedMetadata = JSON.stringify(responseMetadata);

	const isDM =
		responseMetadata.properties.slack_message_event.slack_channel.startsWith(
			"D",
		);

	const isAskForHelpButtonEnabled =
		slackConfig.integration.negativeFeedbackCallback.botIds.length > 0 ||
		slackConfig.integration.negativeFeedbackCallback.groupIds.length > 0 ||
		slackConfig.integration.negativeFeedbackCallback.userIds.length > 0;

	if (isAskForHelpButtonEnabled && !isDM) {
		return [
			{
				type: "button",
				text: {
					type: "plain_text",
					text: "Mark as resolved ✅",
					emoji: false,
				},
				value: serializedMetadata,
				action_id: "mark_as_resolved",
			},
			{
				type: "button",
				text: {
					type: "plain_text",
					text: "Ask for help 👋",
					emoji: false,
				},
				value: serializedMetadata,
				action_id: "ask_for_help",
			},
		];
	}
	return [
		{
			type: "button",
			text: {
				type: "plain_text",
				text: "👍",
				emoji: false,
			},
			value: serializedMetadata,
			action_id: "thumbs_up_button",
		},
		{
			type: "button",
			text: {
				type: "plain_text",
				text: "👎",
				emoji: false,
			},
			value: serializedMetadata,
			action_id: "thumbs_down_button",
		},
	];
}
