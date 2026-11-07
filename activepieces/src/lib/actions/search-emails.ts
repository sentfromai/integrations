import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { sentFromAiAuth } from '../auth';
import { sentFromAiRequest, type MessageSummary } from '../common/client';
import { optionalInboxDropdown, searchModeField } from '../common/fields';
import { objectCollection, optionalText, searchLimit, searchMode } from '../common/validate';

export const searchEmailsAction = createAction({
  name: 'search_emails',
  displayName: 'Search Emails',
  description: 'Searches messages, or returns the most recent messages when the query is empty.',
  audience: 'both',
  aiMetadata: {
    description:
      'Search SentFromAI messages, or list the newest messages when the query is empty. Returns at most 100 results because GET /messages has no cursor. Each item includes mode_used when SentFromAI reports it. Safe to retry.',
    idempotent: true,
  },
  auth: sentFromAiAuth,
  props: {
    query: Property.ShortText({
      displayName: 'Query',
      description: 'Words or meaning to find. Leave empty for the most recent messages.',
      required: false,
    }),
    inboxId: optionalInboxDropdown(),
    mode: searchModeField,
    limit: Property.Number({
      displayName: 'Limit',
      description: 'How many messages to return, from 1 to 100. There is no further page to request.',
      required: true,
      defaultValue: 25,
    }),
  },
  async run(context) {
    const query = optionalText(context.propsValue.query);
    const inboxId = optionalText(context.propsValue.inboxId);
    const mode = searchMode(context.propsValue.mode);
    const limit = searchLimit(context.propsValue.limit);
    const body = await sentFromAiRequest<Record<string, unknown>>({
      token: context.auth.secret_text,
      method: HttpMethod.GET,
      segments: ['messages'],
      query: {
        limit: String(limit),
        mode,
        ...(query ? { query } : {}),
        ...(inboxId ? { inbox_id: inboxId } : {}),
      },
    });
    const messages = objectCollection<MessageSummary>(body, 'messages');
    const modeUsed = body['mode_used'];
    const reportedMode = typeof modeUsed === 'string' ? modeUsed : undefined;
    return reportedMode === undefined
      ? messages
      : messages.map((message) => ({ ...message, mode_used: reportedMode }));
  },
});
