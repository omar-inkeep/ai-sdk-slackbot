export type CustomStringsType = {
	immediateReply?: string;
	sourcesLabel?: string;
	continueThread?: string;
	positiveFeedback?: string;
	negativeFeedback?: string;
	markAsResolved?: string;
	negativeFeedbackTagCallback?: string;
	error?: string;
	noQuestion?: string;
};

export const DeriveCustomStringMessages = {
	immediateReply: ({
		customString,
		userName,
	}: { customString: string; userName: string }) => {
		if (!customString) {
			return null;
		}

		const userHandle =
			userName && !userName.includes("undefined") ? userName : "";
		return customString.replace(/<USER_TAG>/g, userHandle);
	},
	negativeFeedbackTagCallback: ({
		customString,
		tags,
	}: { customString: string; tags: string[] }) => {
		if (!customString) {
			return null;
		}

		if (tags.length === 0) {
			return customString;
		}

		return customString.replace(/<USER_TAG>/g, tags.join(", "));
	},
};

export const TEMPLATE_MESSAGES = {
	aiChatResponse: {
		continueThread: ({
			tag,
			includeAppreciateFeedbackLine = false,
		}: { tag: string; includeAppreciateFeedbackLine: boolean }) =>
			`Feel free to tag ${tag} with additional questions. ${includeAppreciateFeedbackLine ? "I also appreciate feedback, it helps me improve." : ""}`,
	},
	positiveFeedback: "Thanks for the feedback, glad I was helpful.",
	negativeFeedback:
		"Appreciate the feedback! Feel free to ask me again with additional guidance or context.",
	error:
		"Hmm.. Seems there was an issue processing this question. Please try again or tag a team member.",
	sourcesLabel: "To learn more, see the sources I considered:",
	immediateReply: ({
		isNewChat,
		userName,
		botTag,
		isDraftModeEnabled = false,
		includePleaseTagInkeepInIntro = false,
	}: {
		isNewChat: boolean;
		userName: string;
		botTag: string;
		isDraftModeEnabled: boolean;
		includePleaseTagInkeepInIntro: boolean;
	}) => {
		const userHandle =
			userName && !userName.includes("undefined") ? userName : "";

		const thanksForTagging =
			isNewChat && userHandle
				? `Thanks for tagging me ${userName}. `
				: "";

		if (!isNewChat) {
			return `Thanks for the follow-up${userName ? `, ${userName}` : ""}. I'll get back to you soon.`;
		}

		if (isDraftModeEnabled) {
			return `[AI Draft mode] ${thanksForTagging}I'm analyzing relevant sources, I'll provide a draft answer (if possible).`;
		}

		const followUpLine = includePleaseTagInkeepInIntro
			? ` Please tag ${botTag} for any follow-up questions.`
			: "";

		return `${thanksForTagging}I'll look through relevant sources and get back to you shortly.${followUpLine}`;
	},
	noQuestion:
		"Hmm.. Seems like I didn't receive a question. Please start a new thread with your question.",
	markAsResolved:
		"Glad I could be helpful. Feel free to create a new thread with any new questions you may have.",
	negativeFeedbackTagCallback: (tags: string[]) =>
		tags.length === 0
			? "Got it. Someone from the team will get back to you soon."
			: `Got it. Tagging ${tags.join(", ")} for additional help.`,
	botNotEnabledForChannel: ({
		channelId,
		workspaceId,
	}: { channelId?: string; workspaceId: string }) =>
		`Hmm.. Seems like I'm not enabled for this channel. Please configure a Slack integration to reply to ${channelId ? channelId : "this channel"} or enable a default Slack bot for workspace ${workspaceId}.`,
};
