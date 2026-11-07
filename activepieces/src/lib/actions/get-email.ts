import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { sentFromAiAuth } from '../auth';
import { sentFromAiRequest } from '../common/client';
import { requiredText } from '../common/validate';

export const getEmailAction = createAction({
  name: 'get_email',
  displayName: 'Get Email',
  description: 'Reads one message, including the fields SentFromAI returns for that ID.',
  audience: 'both',
  aiMetadata: {
    description:
      'Read one SentFromAI message by its message ID, not the RFC Message-ID header. Use after search or the received-email trigger when you need the full record. Safe to retry.',
    idempotent: true,
  },
  auth: sentFromAiAuth,
  props: {
    messageId: Property.ShortText({
      displayName: 'Message ID',
      description: 'SentFromAI message ID from a search result or the received-email trigger.',
      required: true,
    }),
  },
  async run(context) {
    return sentFromAiRequest({
      token: context.auth.secret_text,
      method: HttpMethod.GET,
      segments: ['messages', requiredText(context.propsValue.messageId, 'Message ID')],
    });
  },
});
