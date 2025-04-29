import zodToJsonSchema from "zod-to-json-schema";
import { getContext, getGuidance } from "./prompts";
import { ProvideLinksToolSchema } from "./schemas";
import OpenAI from "openai";
import type { Stream } from "openai/streaming";
import type {
	ChatCompletionChunk,
	ChatCompletionMessageParam,
	ChatCompletionSystemMessageParam,
	ChatCompletionUserMessageParam,
} from "openai/resources/chat";

interface InitiateChatRequestArgs {
	isHumanReviewingConversation: boolean;
	isAskForHelpButtonEnabled: boolean;
	isDraftModeEnabled: boolean;
	userMessageChatCompletionParts: ChatCompletionUserMessageParam["content"];
	isThreaded: boolean;
}

const inkeepModel = "inkeep-qa-expert";

export async function initiateChat(
	args: InitiateChatRequestArgs,
): Promise<Stream<ChatCompletionChunk>> {
	const {
		isAskForHelpButtonEnabled,
		isHumanReviewingConversation,
		isDraftModeEnabled,
		userMessageChatCompletionParts,
		isThreaded,
	} = args;

	const context = getContext({
		isHumanReviewingConversation,
		isDraftModeEnabled,
		isThreaded,
	});

	const guidance = getGuidance({
		isHumanReviewingConversation,
		isDraftModeEnabled,
		isAskForHelpButtonEnabled,
	});

	const formattedMessages: ChatCompletionMessageParam[] = [
		...(context
			? ([
					{ role: "system", content: context },
				] as ChatCompletionSystemMessageParam[])
			: []),
		...(guidance
			? ([
					{ role: "system", content: guidance },
				] as ChatCompletionSystemMessageParam[])
			: []),
		{ role: "user", content: userMessageChatCompletionParts },
	];

	const openAiClient = new OpenAI({
		apiKey: process.env.INKEEP_API_KEY,
		baseURL: "https://api.inkeep.com/v1",
	});

	return await openAiClient.chat.completions.create({
		model: inkeepModel,
		messages: formattedMessages,
		tools: [
			{
				type: "function",
				function: {
					name: "provideLinks",
					description: "Provide links to the user",
					parameters: zodToJsonSchema(ProvideLinksToolSchema),
					strict: true,
				},
			},
		],
		stream: true,
	});
}
