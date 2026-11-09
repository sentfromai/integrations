import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { sentFromAiAuth } from '../auth';
import { sentFromAiRequest } from '../common/client';
import { htmlBody, textBody, writeErrorHandling } from '../common/fields';
import { clientId, messageContent, requiredText } from '../common/validate';

export const replyToEmailAction = createAction({
  name: 'reply_to_email',
  displayName: 'Reply to Email',
  description: 'Sends a reply in the original SentFromAI thread.',
  audience: 'both',
  aiMetadata: {
    description:
      'Reply in the thread of an existing SentFromAI message. Supply a stable Client ID for the exact reply. Retry only with the same key and identical content; changed content or an unresolved send returns a conflict. Automatic retry remains hidden because a reply without a key is not idempotent.',
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
    clientId: Property.ShortText({
      displayName: 'Client ID',
      description: 'Optional retry key, 1–255 UTF-8 bytes. Reuse it only with identical reply content. Do not switch keys after an uncertain send.',
      required: false,
    }),
    replyAll: Property.Checkbox({
      displayName: 'Reply to all',
      description: 'Include the original recipients except the sending inbox.',
      required: true,
      defaultValue: false,
    }),
  },
  async run(context) {
    const values = context.propsValue;
    const idempotencyKey = clientId(values.clientId);
    return sentFromAiRequest({
      token: context.auth.secret_text,
      method: HttpMethod.POST,
      segments: ['messages', requiredText(values.messageId, 'Message ID'), 'reply'],
      body: {
        ...messageContent(values.text, values.html),
        reply_all: values.replyAll === true,
        ...(idempotencyKey ? { client_id: idempotencyKey } : {}),
      },
    });
  },
});
