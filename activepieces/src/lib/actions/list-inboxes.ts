import { createAction } from '@activepieces/pieces-framework';
import { sentFromAiAuth } from '../auth';
import { listInboxes } from '../common/client';

export const listInboxesAction = createAction({
  name: 'list_inboxes',
  displayName: 'List Inboxes',
  description: 'Lists the email inboxes in the connected SentFromAI workspace.',
  audience: 'both',
  aiMetadata: {
    description:
      'List every SentFromAI inbox in the workspace. Use when you need inbox IDs or addresses. This is a read and is safe to retry. The inbox endpoint is not paginated.',
    idempotent: true,
  },
  auth: sentFromAiAuth,
  props: {},
  async run(context) {
    return listInboxes(context.auth.secret_text);
  },
});
