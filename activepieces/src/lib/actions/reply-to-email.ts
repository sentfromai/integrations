import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { sentFromAiAuth } from '../auth';
import { sentFromAiRequest } from '../common/client';
import { htmlBody, textBody, writeErrorHandling } from '../common/fields';
import { messageContent, requiredText } from '../common/validate';

export const replyToEmailAction = createAction({
  name: 'reply_to_email',
  displayName: 'Reply to Email',
  description: 'Sends a reply in the original SentFromAI thread.',
  audience: 'both',
  aiMetadata: {
    description:
      'Reply in the thread of an existing SentFromAI message. The reply endpoint accepts text, html, and reply_all only; it has no client_id field, so this action does not send one and automatic retry is hidden. After an uncertain failure, read the thread before replying again.',
    idempotent: false,
  },
  auth: sentFromAiAuth,
  errorHandlingOptions: writeErrorHandling,
  props: {
    messageId: Property.ShortText({
      displayName: 'Message ID',
      description: 'SentFromAI message ID to answer. Threading is taken from that message.',
      required: true,
    }),
    text: textBody,
    html: htmlBody,
    replyAll: Property.Checkbox({
      displayName: 'Reply to all',
      description: 'Include the original recipients except the sending inbox.',
      required: true,
      defaultValue: false,
    }),
  },
  async run(context) {
    const values = context.propsValue;
    return sentFromAiRequest({
      token: context.auth.secret_text,
      method: HttpMethod.POST,
      segments: ['messages', requiredText(values.messageId, 'Message ID'), 'reply'],
      body: {
        ...messageContent(values.text, values.html),
        reply_all: values.replyAll === true,
      },
    });
  },
});
