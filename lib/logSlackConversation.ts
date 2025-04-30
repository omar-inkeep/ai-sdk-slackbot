import { InkeepAnalytics } from "@inkeep/inkeep-analytics";
import type {
	CreateOpenAIConversation,
	Messages,
	OpenAIConversation,
} from "@inkeep/inkeep-analytics/dist/commonjs/models/components";

type OpenAIConversationType = OpenAIConversation & { type: "openai" };

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
}): Promise<OpenAIConversationType | undefined> {
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

		return conversation as OpenAIConversationType;
	} catch (err) {
		console.error("Error logging Slack conversation", err);
		return undefined;
	}
}
