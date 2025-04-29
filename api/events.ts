import type { AppMentionEvent, SlackEvent } from "@slack/web-api";
import { waitUntil } from "@vercel/functions";
import { handleAppMention } from "../lib/handleAppMention";
import { verifyRequest, getBotId } from "../lib/slack-utils";
import { handleAskForHelp, handleThumbsUpAndDown } from "../lib/handleActions";
import type { BlockAction } from "@slack/bolt";

export async function POST(request: Request) {
	const rawBody = await request.text();

	let payload: Record<string, any>;
	if (rawBody.startsWith("payload=")) {
		const decodedBody = decodeURIComponent(rawBody.slice("payload=".length));
		payload = JSON.parse(decodedBody);
	} else {
		payload = JSON.parse(rawBody);
	}

	const requestType = payload.type as
		| "url_verification"
		| "event_callback"
		| "block_actions";

	// See https://api.slack.com/events/url_verification
	if (requestType === "url_verification") {
		return new Response(payload.challenge, { status: 200 });
	}

	await verifyRequest({ requestType, request, rawBody });

	try {
		const botUserId = await getBotId();

		if (requestType === "block_actions") {
			const actions = payload as BlockAction;
			const actionId = actions.actions[0].action_id;
			if (
				actionId === "thumbs_up_button" ||
				actionId === "thumbs_down_button" ||
				actionId === "mark_as_resolved"
			) {
				handleThumbsUpAndDown(actions, botUserId);
			} else if (actionId === "ask_for_help") {
				handleAskForHelp(actions, botUserId);
			}

			return new Response("Success!", { status: 200 });
		}

		const event = payload.event as SlackEvent;

		if (event.type === "app_mention") {
			waitUntil(handleAppMention(event as AppMentionEvent, botUserId));
		}

		if (
			event.type === "message" &&
			!event.subtype &&
			event.channel_type === "im" &&
			!event.bot_id &&
			!event.bot_profile &&
			event.bot_id !== botUserId
		) {
			// is DM
			waitUntil(handleAppMention(event, botUserId));
		}

		return new Response("Success!", { status: 200 });
	} catch (error) {
		console.error("Error generating response", error);
		return new Response("Error generating response", { status: 500 });
	}
}
