import { InkeepAnalytics } from "@inkeep/inkeep-analytics";
import type { CreateOpenAIConversation, Messages } from "@inkeep/inkeep-analytics/dist/commonjs/models/components";

export async function logSlackConversation({
	apiIntegrationKey,
	messagesToLogToAnalytics,
	workspaceId,
	channelId,
	botId,
	messageTs,
	messageAuthorId,
}: {
	apiIntegrationKey: string;
	messagesToLogToAnalytics: Messages[];
	workspaceId: string;
	channelId: string;
	botId: string;
	messageTs: string;
	messageAuthorId: string;
}): Promise<string | undefined> {
	const inkeepAnalytics = new InkeepAnalytics({ apiIntegrationKey });

	const logConversationPayload: CreateOpenAIConversation = {
		externalId: messageTs,
		type: "openai",
		messages: messagesToLogToAnalytics,
		userProperties: {
			userId: messageAuthorId,
			additionalProperties: {},
		},
		properties: {
			workspaceId,
			channelId,
			botId,
		},
	};

	try {
		const conversation = await inkeepAnalytics.conversations.log(
			{
				apiIntegrationKey,
			},
			logConversationPayload,
		);

		return conversation.id;
	} catch (err) {
		console.error("Error logging Slack conversation", err);
		return undefined;
	}
}
