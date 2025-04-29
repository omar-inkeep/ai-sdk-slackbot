import { logSlackFeedback } from "./logSlackFeedback";
import {
	type CustomStringsType,
	DeriveCustomStringMessages,
	TEMPLATE_MESSAGES,
} from "./templateMessages";
import slackConfig from "../slackConfig.json";
import { client } from "./slack-utils";
import type { BlockAction, ButtonAction } from "@slack/bolt";
import type { FollowUpResponseMetadata } from "./handleStreamOnFinish";
import { getBotIdentity } from "./handleAppMention";

export async function handleThumbsUpAndDown(
	payload: BlockAction,
	botUserId: string,
) {
	const actionValue = (payload.actions[0] as ButtonAction).value;
	const actionId = (payload.actions[0] as ButtonAction).action_id as
		| "thumbs_up_button"
		| "thumbs_down_button"
		| "mark_as_resolved";
	const payloadMessage = payload.message;
	const customStrings = slackConfig.customStrings as CustomStringsType;

	if (!actionValue) {
		return;
	}

	const parsedValue = JSON.parse(actionValue) as FollowUpResponseMetadata;

	const thread_ts = payloadMessage?.thread_ts;

	const slackEvent = parsedValue.properties.slack_message_event;
	const { slack_question_author_id } = slackEvent;

	if (
		thread_ts &&
		typeof thread_ts === "string" &&
		parsedValue.properties.botResponseMessageId &&
		process.env.INKEEP_API_KEY
	) {
		logSlackFeedback({
			apiIntegrationKey: process.env.INKEEP_API_KEY,
			conversationExternalId: thread_ts,
			messageId: parsedValue.properties.botResponseMessageId,
			messageAuthorId: slack_question_author_id,
			type: actionId === "thumbs_down_button" ? "negative" : "positive",
		});
	}

	if (
		thread_ts &&
		actionId === "thumbs_up_button" &&
		customStrings.positiveFeedback === ""
	) {
		return;
	}

	if (
		thread_ts &&
		actionId === "thumbs_down_button" &&
		customStrings.negativeFeedback === ""
	) {
		return;
	}

	if (
		thread_ts &&
		actionId === "mark_as_resolved" &&
		customStrings.markAsResolved === ""
	  ) {
		return;
	  }

	const actionIdToText = {
		thumbs_up_button: customStrings.positiveFeedback ?? TEMPLATE_MESSAGES.positiveFeedback,
		thumbs_down_button: customStrings.negativeFeedback ?? TEMPLATE_MESSAGES.negativeFeedback,
		mark_as_resolved: customStrings.markAsResolved ?? TEMPLATE_MESSAGES.markAsResolved,
	}

	await client.chat.postMessage({
		text: actionIdToText[actionId],
		thread_ts,
		channel: slackEvent.slack_channel,
		...(slackConfig &&
			(await getBotIdentity({
				botId: botUserId,
			}))),
	});
}

export async function handleAskForHelp(
	payload: BlockAction,
	botUserId: string,
) {
	const actionValue = (payload.actions[0] as ButtonAction).value;
	const payloadMessage = payload.message;
	const customStrings = slackConfig.customStrings as CustomStringsType;

	if (!actionValue) {
		return;
	}

	const parsedValue = JSON.parse(actionValue) as FollowUpResponseMetadata;

	const thread_ts = payloadMessage?.thread_ts;

	const slackEvent = parsedValue.properties.slack_message_event;
	const { slack_question_author_id } = slackEvent;

	const helpTags = generateSlackTags(parsedValue.tags);

	if (
		thread_ts &&
		typeof thread_ts === "string" &&
		parsedValue.properties.botResponseMessageId &&
		process.env.INKEEP_API_KEY
	) {
		logSlackFeedback({
			apiIntegrationKey: process.env.INKEEP_API_KEY,
			conversationExternalId: thread_ts,
			messageId: parsedValue.properties.botResponseMessageId,
			messageAuthorId: slack_question_author_id,
			type: "negative",
		});
	}

	if (thread_ts && customStrings.negativeFeedbackTagCallback !== "") {
		const text =
			DeriveCustomStringMessages.negativeFeedbackTagCallback({
				customString: customStrings.negativeFeedbackTagCallback ?? "",
				tags: helpTags,
			}) || TEMPLATE_MESSAGES.negativeFeedbackTagCallback(helpTags);

		await client.chat.postMessage({
			text,
			thread_ts,
			channel: slackEvent.slack_channel,
			...(slackConfig &&
				(await getBotIdentity({
					botId: botUserId,
				}))),
		});
	}
}

const generateSlackTags = (
	tags:
		| {
				botIds?: string[] | null | undefined;
				groupIds?: string[] | null | undefined;
				userIds?: string[] | null | undefined;
		  }
		| null
		| undefined,
): string[] => {
	if (!tags) return []; // Return an empty array if tags is null or undefined

	const formattedTags: string[] = [];

	// Tag roles
	if (tags.groupIds) {
		for (const groupId of tags.groupIds) {
			formattedTags.push(`<!subteam^${groupId}>`);
		}
	}

	// Tag users and bots (same format)
	const userAndBotIds = [...(tags.userIds ?? []), ...(tags.botIds ?? [])];
	for (const id of userAndBotIds) {
		formattedTags.push(`<@${id}>`);
	}

	return formattedTags;
};
