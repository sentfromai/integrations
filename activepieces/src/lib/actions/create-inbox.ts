import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { sentFromAiAuth } from '../auth';
import { sentFromAiRequest } from '../common/client';
import { writeErrorHandling } from '../common/fields';
import { localPart, optionalText } from '../common/validate';

export const createInboxAction = createAction({
  name: 'create_inbox',
  displayName: 'Create Inbox',
  description: 'Creates an inbox on the managed domain or a verified custom domain.',
  audience: 'both',
  aiMetadata: {
    description:
      'Create one SentFromAI inbox from a local part. Leave Domain ID empty to use mail.sentfrom.ai. This creates a new address and is not idempotent: a taken or reserved name returns address_taken or address_reserved, and automatic retry is hidden.',
    idempotent: false,
  },
  auth: sentFromAiAuth,
  errorHandlingOptions: writeErrorHandling,
  props: {
    localPart: Property.ShortText({
      displayName: 'Local part',
      description:
        'The mailbox name before @. Letters, numbers, dots, underscores, and hyphens are accepted. It is stored in lowercase.',
      required: true,
    }),
    displayName: Property.ShortText({
      displayName: 'Display name',
      description: 'Optional name shown with the address.',
      required: false,
    }),
    domainId: Property.ShortText({
      displayName: 'Domain ID',
      description:
        'Optional ID of a verified custom domain. Leave empty to use the managed mail.sentfrom.ai domain.',
      required: false,
    }),
  },
  async run(context) {
    const displayName = optionalText(context.propsValue.displayName);
    const domainId = optionalText(context.propsValue.domainId);
    return sentFromAiRequest({
      token: context.auth.secret_text,
      method: HttpMethod.POST,
      segments: ['inboxes'],
      body: {
        local_part: localPart(context.propsValue.localPart),
        ...(displayName ? { display_name: displayName } : {}),
        ...(domainId ? { domain_id: domainId } : {}),
      },
    });
  },
});
