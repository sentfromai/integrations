import { createPiece } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { sentFromAiAuth } from './lib/auth';
import { createInboxAction } from './lib/actions/create-inbox';
import { getEmailAction } from './lib/actions/get-email';
import { listInboxesAction } from './lib/actions/list-inboxes';
import { replyToEmailAction } from './lib/actions/reply-to-email';
import { searchEmailsAction } from './lib/actions/search-emails';
import { sendEmailAction } from './lib/actions/send-email';
import { emailReceivedTrigger } from './lib/triggers/email-received';

export const sentfromai = createPiece({
  displayName: 'SentFromAI',
  description: 'Create inboxes and send, receive, search, and reply to email for AI agents.',
  minimumSupportedRelease: '0.82.0',
  logoUrl: 'https://cdn.activepieces.com/pieces/sentfromai.png',
  categories: [PieceCategory.COMMUNICATION, PieceCategory.ARTIFICIAL_INTELLIGENCE],
  auth: sentFromAiAuth,
  authors: ['samuelar2'],
  actions: [
    listInboxesAction,
    createInboxAction,
    searchEmailsAction,
    getEmailAction,
    sendEmailAction,
    replyToEmailAction,
  ],
  triggers: [emailReceivedTrigger],
});
