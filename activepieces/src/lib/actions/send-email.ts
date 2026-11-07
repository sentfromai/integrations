import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { sentFromAiAuth } from '../auth';
import { sentFromAiRequest } from '../common/client';
import { addressList, htmlBody, inboxDropdown, textBody, writeErrorHandling } from '../common/fields';
import { clientId, messageContent, recipients, requiredText } from '../common/validate';

export const sendEmailAction = createAction({
  name: 'send_email',
  displayName: 'Send Email',
  description: 'Sends an email from a SentFromAI inbox.',
  audience: 'both',
  aiMetadata: {
    description:
      'Send one email from a SentFromAI inbox. Set Client ID to a stable value for that exact email so a retry returns the original send instead of delivering a duplicate. A different body with the same client ID returns client_id_conflict; an unresolved send returns send_outcome_pending. Do not mint a new client ID to retry either case. Automatic platform retry is hidden because a send without a client ID is not idempotent.',
    idempotent: false,
  },
  auth: sentFromAiAuth,
  errorHandlingOptions: writeErrorHandling,
  props: {
    inboxId: inboxDropdown(true),
    to: addressList('To', 'Recipients. Enter one bare email address per row.', true),
    cc: addressList('Cc', 'Optional Cc addresses.', false),
    bcc: addressList('Bcc', 'Optional Bcc addresses.', false),
    subject: Property.ShortText({
      displayName: 'Subject',
      required: true,
    }),
    text: textBody,
    html: htmlBody,
    clientId: Property.ShortText({
      displayName: 'Client ID',
      description:
        'Optional idempotency key, 1–255 UTF-8 bytes. Reuse it with the same content to retry this email. Use a different key for a different email. Leave empty only when duplicate suppression is unnecessary.',
      required: false,
    }),
  },
  async run(context) {
    const values = context.propsValue;
    const content = messageContent(values.text, values.html);
    const cc = recipients(values.cc, 'Cc', false);
    const bcc = recipients(values.bcc, 'Bcc', false);
    const idempotencyKey = clientId(values.clientId);
    return sentFromAiRequest({
      token: context.auth.secret_text,
      method: HttpMethod.POST,
      segments: ['messages'],
      body: {
        inbox_id: requiredText(values.inboxId, 'Inbox'),
        to: recipients(values.to, 'To', true),
        subject: requiredText(values.subject, 'Subject'),
        ...content,
        ...(cc ? { cc } : {}),
        ...(bcc ? { bcc } : {}),
        ...(idempotencyKey ? { client_id: idempotencyKey } : {}),
      },
    });
  },
});
