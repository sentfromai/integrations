import { Property } from '@activepieces/pieces-framework';
import { sentFromAiAuth } from '../auth';
import { listInboxes } from './client';
import { publicError } from './errors';

const manualRetryOnly = {
  retryOnFailure: { defaultValue: false, hide: true },
  continueOnFailure: { defaultValue: false },
};

export const writeErrorHandling = manualRetryOnly;

async function inboxOptions(auth: { secret_text?: string } | undefined) {
  if (!auth?.secret_text) {
    return {
      disabled: true,
      options: [],
      placeholder: 'Connect your SentFromAI account first',
    };
  }
  try {
    const inboxes = await listInboxes(auth.secret_text);
    if (!inboxes.length) {
      return {
        disabled: true,
        options: [],
        placeholder: 'This workspace has no inboxes yet',
      };
    }
    return {
      disabled: false,
      options: inboxes.map((inbox) => ({
        label: inbox.address || inbox.local_part || inbox.id,
        value: inbox.id,
      })),
    };
  } catch (error) {
    return {
      disabled: true,
      options: [],
      placeholder: publicError(error, auth.secret_text).message,
    };
  }
}

export function inboxDropdown(required: true) {
  return Property.Dropdown({
    displayName: 'Inbox',
    description: 'Choose the SentFromAI inbox. The connector sends its inbox ID.',
    required,
    auth: sentFromAiAuth,
    refreshers: [],
    options: async ({ auth }) => inboxOptions(auth),
  });
}

export function optionalInboxDropdown() {
  return Property.Dropdown({
    displayName: 'Inbox',
    description:
      'Limit this step to one inbox, or leave it empty to include every inbox in the workspace.',
    required: false,
    auth: sentFromAiAuth,
    refreshers: [],
    options: async ({ auth }) => inboxOptions(auth),
  });
}

export function addressList(displayName: string, description: string, required: boolean) {
  return Property.Array({
    displayName,
    description,
    required,
    properties: {
      address: Property.ShortText({
        displayName: 'Email address',
        description: 'One bare email address. Display names are not supported.',
        required: true,
      }),
    },
  });
}

export const textBody = Property.LongText({
  displayName: 'Text body',
  description: 'Plain-text body. Provide this, an HTML body, or both.',
  required: false,
});

export const htmlBody = Property.LongText({
  displayName: 'HTML body',
  description: 'HTML body. Provide this, a plain-text body, or both.',
  required: false,
});

export const searchModeField = Property.StaticDropdown({
  displayName: 'Search mode',
  description:
    'Semantic and hybrid search depend on the plan. SentFromAI may fall back to keyword; the result includes mode_used.',
  required: true,
  defaultValue: 'keyword',
  options: {
    options: [
      { label: 'Keyword', value: 'keyword' },
      { label: 'Semantic', value: 'semantic' },
      { label: 'Hybrid', value: 'hybrid' },
    ],
  },
});
