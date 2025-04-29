import emojiRegex from "emoji-regex";
import type { QALinks } from "./schemas";

export function botMessageToMarkdown({
	message,
	links,
	sourcesLabel = "**Sources**",
	areInlineCitationsEnabled = true,
}: {
	message: string;
	links: QALinks;
	sourcesLabel?: string;
	areInlineCitationsEnabled?: boolean;
}): { body: string; sources: string | null } {
	// Process any URLs in the message content first
	const processedContent = message
		// First, process all URLs within parentheses
		.replace(
			/\((https?:\/\/.*?)\)/g,
			(match, url) => `(${processUrl(url.trim())})`,
		)
		// Then ensure there's a space before all citations
		.replace(/(?<!\s)\[\((\d+)\)\]\([^)]+\)/g, " $&")
		// Then ensure there's a space after all closing parentheses
		.replace(/\)(?!\s)/g, ") ");

	// Deduplicate citations to reduce the output appearance
	let dedupedMessage = streamTextDeduplicateCitations(processedContent);

	// Strip inline citations for customers in the allow list
	if (!areInlineCitationsEnabled) {
		dedupedMessage = streamTextStripInlineCitations(dedupedMessage);
	}

	if (!links?.length) {
		return { body: dedupedMessage, sources: null };
	}

	let markdownSources = `\n${sourcesLabel}\n`;

	for (const link of links) {
		markdownSources += `[[${link.label}] ${link.title}](${link.url})\n`;
	}

	return { body: dedupedMessage, sources: markdownSources.trim() };
}

function streamTextDeduplicateCitations(inputString: string): string {
	const citationRegex = /(\[\(\d+\)[ ]*\][ ]*\([^)]+\)[^\S\r\n]*)+/g;
	let matches: RegExpExecArray | null;
	let previousCitationGroup = "";
	let result = inputString;

	matches = citationRegex.exec(result);
	while (matches !== null) {
		const currentCitationGroup = matches[0].replace(/[^\S\r\n]+/g, "");

		if (currentCitationGroup === previousCitationGroup) {
			result =
				result.slice(0, matches.index) + result.slice(citationRegex.lastIndex);
			citationRegex.lastIndex = matches.index;
		} else {
			previousCitationGroup = currentCitationGroup;
		}
		matches = citationRegex.exec(result);
	}
	return result;
}

function streamTextStripInlineCitations(content: string): string {
	return content.replace(/\[\((\d+)\)(\s*)\]\([^)]+\)/g, "");
}

export function processTitle(title: string): string {
	return stripEmojis(title).trim();
}

function processUrl(url: string): string {
	return encodeURL(stripEmojis(url)).trim();
}

function stripEmojis(text: string): string {
	const regex = emojiRegex();
	return text.replace(regex, "");
}

function encodeURL(url: string): string {
	// First, try to decode to prevent double encoding.
	let decodedUrl = url;
	try {
		decodedUrl = decodeURI(url);
	} catch (e) {
		// If it throws an error, it means the URL wasn't encoded, so we can just proceed.
	}

	return encodeURI(decodedUrl);
}
