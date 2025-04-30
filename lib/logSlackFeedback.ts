import { InkeepAnalytics } from '@inkeep/inkeep-analytics';

export async function logSlackFeedback({
  apiIntegrationKey,
  messageAuthorId,
  inkeepMessageId,
  feedbackType,
}: {
  apiIntegrationKey: string;
  messageAuthorId: string;
  inkeepMessageId: string;
  feedbackType: 'positive' | 'negative';
}) {
  const inkeepAnalytics = new InkeepAnalytics({ apiIntegrationKey });

  try {
    await inkeepAnalytics.feedback.submit({
      type: feedbackType,
      messageId: inkeepMessageId,
      userProperties: {
        id: messageAuthorId,
        additionalProperties: {},
      },
		});
	} catch (error) {
		console.error("Error in logSlackFeedback:", error);
	}
}
