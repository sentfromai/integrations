# SentFromAI for Zapier

Zapier Platform CLI integration for [SentFromAI](https://sentfrom.ai), email infrastructure for AI agents. Version 1.0.0 uses the production API at `https://api.sentfrom.ai/v1` and Zapier Platform Core/CLI 19.3.0.

## Included operations

| Type | Operation | Behavior |
| --- | --- | --- |
| Instant trigger | New Email Received | Registers a `message.received` webhook, verifies the raw-body HMAC, filters an optional inbox, and fetches the full message. |
| Polling trigger | New Inbox | Returns inboxes in newest-first order with stable IDs. Also powers inbox dropdowns. |
| Action | Send Email | Supports To, Cc, Bcc, text, HTML and a client-supplied unique send ID. |
| Action | Reply to Email | Preserves the existing thread and supports reply-all. |
| Action | Create Inbox | Uses the managed email domain or a verified custom domain ID. |
| Action | Create Draft | Creates an unscheduled draft for review without sending. |
| Action | Get Message | Retrieves full message content, labels and attachment links. |
| Search | Find Message | Returns the best match, with complete message details and the actual search mode used. |

## Connect and use

1. Create a SentFromAI account and an API key on the [API keys page](https://console.sentfrom.ai/keys).
2. Connect SentFromAI in the Zap editor using that key, without a `Bearer` prefix. The connection label is your workspace name.
3. Select an inbox where applicable, then test the step with your own test data.
4. For email processing, use New Email Received → your processing or approval steps → Create Draft or Send Email. For transactional sends, map a unique source-event ID into **Unique Send ID**.

The key is an authentication-only password field. It is sent in the Authorization header only to the fixed SentFromAI API origin. The auth test reads `/account` and exposes only the workspace name. No credentials are included in this package.

## Local development

Node.js 22 or newer is required.

```sh
npm ci --ignore-scripts
npm test
npm run validate
npm run build
```

Tests use the official `createAppTester` and Nock; all external networking is disabled. The local validator runs the official schema checks. The build script reuses installed dependencies and skips remote validation after local validation, producing `build/build.zip` and `build/source.zip`. These archives are local build outputs, not published integrations.

## Delivery and API constraints

- New Email Received uses REST hooks; it does not poll the latest-100 message endpoint for live events. Editor sample loading only checks the most recent 100 messages and hydrates up to three inbound samples. If none appear, receive a fresh test email in the chosen inbox.
- Custom request headers arrive from Zapier as `Http-X-Sentfromai-Signature`. The signature check accepts this documented form and conventional header casing, verifies the exact raw bytes with the subscription secret, and rejects unsigned or tampered events.
- Each enabled Zap gets its own webhook endpoint, which is deleted when that Zap is disabled. The subscription secret is retained only as Zapier subscription metadata and is never returned as trigger output.
- Webhook delivery can be retried. The output preserves the message's stable `id`; downstream workflows should handle repeated deliveries. Instant triggers do not provide the same polling deduplication guarantee.
- Send Email supports SentFromAI's `client_id` idempotency behavior. Reply to Email, Create Inbox and Create Draft do not expose a server-side idempotency key in the current API; inspect ambiguous outcomes before manually replaying these actions.
- Attachment upload is not exposed in version 1.0.0. Get Message returns the API's expiring attachment links; retrieve a new link if needed later.
- Existing plan limits, paused-sending checks, suppression rules and abuse controls continue to apply. API errors are surfaced rather than retried around restrictions. HTTP 429 uses Zapier's native delay handling.

## Publication handoff

This code is built and locally tested. It has not been uploaded to Zapier, tested in live Zaps, or approved for the App Directory.

1. An authorized SentFromAI owner must sign in to a Zapier developer account and register or link this app. Check the account for an existing SentFromAI integration first to avoid duplicate listings.
2. Run the remote platform checks (`npm run validate:remote`) and upload the package through the CLI or developer portal. These actions send integration source/metadata to Zapier. Remote checks were not completed in this task because automatic approval review blocked that transmission; local schema validation and local packaging were completed instead.
3. Add listing details below, a brand-owned logo, support/contact information, and a dedicated review/test account. Do not paste customer API keys into source code, GitHub, or public forms.
4. Create and enable a live test Zap for every trigger, action and search, using an owner-controlled inbox and recipient. Retain successful Zap history for review. Confirm subscription creation/removal, production raw-header normalization, full-body hydration, connection label, and invalid/revoked-key behavior.
5. Submit through the developer platform's publishing process after all requirements pass. Zapier reviews public integrations; a successful build or upload is not a public catalog listing.

Suggested listing:

- Name: **SentFromAI**
- Homepage: **https://sentfrom.ai**
- Description: **SentFromAI gives AI agents and automated workflows email inboxes to send, receive, search and reply to messages.**
- Documentation: **https://docs.sentfrom.ai**
- Support: **support@sentfrom.ai**
- Partner contact: **Samuel Arregger-Robson — samuel@sentfrom.ai**

Suggested Zap templates: create reviewable reply drafts from incoming email; send transactional email after a CRM update; create an inbox when a new agent/workspace is provisioned; route received messages to a support queue.

## Verified references

Implementation was checked against SentFromAI's OpenAPI document and source routes for account, inboxes, messages, drafts, inbound events and webhooks on 5 November 2026.

- [Zapier API key authentication](https://docs.zapier.com/integrations/build/apikeyauth)
- [REST hook lifecycle and editor samples](https://docs.zapier.com/integrations/build/cli-hook-trigger)
- [Core reference: rawRequest and subscribeData](https://docs.zapier.com/integrations/build-cli/core)
- [Connection labels](https://docs.zapier.com/integrations/build/connection-label)
- [Publishing requirements](https://docs.zapier.com/platform/publish/integration-publishing-requirements)
- [CLI reference](https://github.com/zapier/zapier-platform/blob/main/packages/cli/docs/cli.md)
