import { InkeepAnalytics } from '@inkeep/inkeep-analytics';
import type { OpenAIConversation } from '@inkeep/inkeep-analytics/dist/commonjs/models/components';

export async function logSlackFeedback({
  apiIntegrationKey,
  messageId,
  messageAuthorId,
  conversationExternalId,
  type,
}: {
  apiIntegrationKey: string;
  messageId: string;
  messageAuthorId: string;
  conversationExternalId: string;
  type: 'positive' | 'negative';
}) {
  const inkeepAnalytics = new InkeepAnalytics({ apiIntegrationKey });

  let existingConversation: OpenAIConversation | undefined;

  try {
    existingConversation =
      (await inkeepAnalytics.conversation.getConversationByExternalId({
        externalId: conversationExternalId,
      })) as OpenAIConversation;
  } catch (err) {
    console.error('Error getting existing conversation', err);
  }

  if (!existingConversation) {
    return;
  }

  const inkeepMessageId = existingConversation.messages.find(
    (message) => message.externalId === messageId,
  )?.id;

  if (!inkeepMessageId) {
    console.error('Error in logSlackFeedback', {
      existingConversationId: existingConversation.id,
      messageId,
    });
    return;
  }

  try {
    await inkeepAnalytics.feedback.submit({
      type,
      messageId: inkeepMessageId,
      userProperties: {
        id: messageAuthorId,
        additionalProperties: {},
      },
    });
  } catch (error) {
    console.error('Error in logSlackFeedback:', error);
  }
}
