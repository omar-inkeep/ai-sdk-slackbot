import slackifyMarkdown from "slackify-markdown";
import { type CustomStringsType, TEMPLATE_MESSAGES } from "./templateMessages";
import type { ProvideLinksToolResult, QALinks } from "./schemas";
import { botMessageToMarkdown } from "./slackTextFormatters";
import type { Stream } from "openai/streaming";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import slackConfig from "../slackConfig.json";
import { getBotIdentity } from "./handleAppMention";
import { client } from "./slack-utils";

async function updateSlackMessage({
	channelId,
	threadTs,
	botId,
	messageText,
	firstMessageTs,
}: {
	channelId: string;
	threadTs: string;
	botId: string;
	messageText: string;
	firstMessageTs?: string;
}) {
	const commonParams = {
		channel: channelId,
		unfurl_links: false,
		unfurl_media: false,
		text: messageText,
	};

	if (firstMessageTs) {
		await client.chat.update({
			...commonParams,
			ts: firstMessageTs,
		});
		return firstMessageTs;
	}

	const firstResponse = await client.chat.postMessage({
		...commonParams,
		thread_ts: threadTs,
		...(await getBotIdentity({
			botId,
		})),
	});

	return firstResponse.ts;
}

export async function handleStream({
	stream,
	channelId,
	threadTs,
	botId,
}: {
	stream: Stream<ChatCompletionChunk>;
	channelId: string;
	threadTs: string;
	botId: string;
}): Promise<{
	message: string;
	sources: string | null;
	botResponseMessageId?: string;
	links: QALinks;
}> {
	const areInlineCitationsEnabled =
		slackConfig.integration.areInlineCitationsEnabled;

	const customStrings = slackConfig.customStrings as CustomStringsType;

	let accumulatedText = "";
	let firstMessageTs: string | undefined;
	const finalToolCalls: Record<
		number,
		NonNullable<ChatCompletionChunk["choices"][0]["delta"]["tool_calls"]>[0]
	> = {};

	const CHUNK_SIZE = 100;
	let lastUpdateLength = 0;

	for await (const chunk of stream) {
		const textPart = chunk.choices[0].delta.content;
		if (textPart) {
			accumulatedText += textPart;
		}

		// Check if we've accumulated enough new characters since last update
		if (accumulatedText.length >= lastUpdateLength + CHUNK_SIZE) {
			lastUpdateLength = accumulatedText.length;

			try {
				const { body } = botMessageToMarkdown({
					message: accumulatedText,
					links: [],
					areInlineCitationsEnabled,
				});
				const wholeBody = slackifyMarkdown(body);

				if (wholeBody) {
					firstMessageTs = await updateSlackMessage({
						channelId,
						threadTs,
						botId,
						messageText: wholeBody,
						firstMessageTs,
					});
				}
			} catch (error) {
				console.error("Error converting bot message to markdown", error);
			}
		}

		handleToolCalls(chunk, finalToolCalls);
	}

	let links: QALinks;
	if (finalToolCalls[0]?.function?.name === "provideLinks") {
		try {
			const toolResult = JSON.parse(
				finalToolCalls[0]?.function?.arguments || "{}",
			) as ProvideLinksToolResult;
			links = toolResult.links;
		} catch (error) {
			console.error("Error parsing tool result", error);
		}
	}

	try {
		let sources: string | null = null;
		const { body, sources: sourcesResult } = botMessageToMarkdown({
			message: accumulatedText,
			links,
			sourcesLabel: `${customStrings.sourcesLabel ?? TEMPLATE_MESSAGES.sourcesLabel}\n`,
			areInlineCitationsEnabled,
		});
		const wholeBody = slackifyMarkdown(body);
		sources = sourcesResult;

		if (wholeBody) {
			firstMessageTs = await updateSlackMessage({
				channelId,
				threadTs,
				botId,
				messageText: wholeBody,
				firstMessageTs,
			});
		}

		return {
			message: accumulatedText,
			botResponseMessageId: firstMessageTs,
			sources,
			links,
		};
	} catch (error) {
		console.error("Error in final message processing", error, accumulatedText);
		return {
			message: accumulatedText,
			botResponseMessageId: firstMessageTs,
			sources: null,
			links,
		};
	}
}

function handleToolCalls(
	chunk: ChatCompletionChunk,
	finalToolCalls: Record<
		number,
		NonNullable<ChatCompletionChunk["choices"][0]["delta"]["tool_calls"]>[0]
	>,
) {
	const toolCalls = chunk.choices[0].delta.tool_calls || [];
	for (const toolCall of toolCalls) {
		const { index } = toolCall;

		if (!finalToolCalls[index]) {
			finalToolCalls[index] = {
				index,
				function: {
					name: "",
					arguments: "",
				},
			};
		}

		const targetFunction = finalToolCalls[index]?.function;
		if (targetFunction && toolCall.function?.name) {
			targetFunction.name = toolCall.function.name;
		}
		if (targetFunction && toolCall.function?.arguments) {
			targetFunction.arguments =
				(targetFunction.arguments || "") + toolCall.function.arguments;
		}
	}
}
