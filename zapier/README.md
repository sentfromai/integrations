# SentFromAI for Zapier

Zapier Platform CLI integration for [SentFromAI](https://sentfrom.ai), email infrastructure for AI agents. Source version 1.0.1 uses the production API at `https://api.sentfrom.ai/v1` and Zapier Platform Core/CLI 19.3.0. This release candidate adds the optional **Unique Reply ID** field supported by the current API; hosted deployment of this source has not yet been verified.

## Included operations

| Type | Operation | Behavior |
| --- | --- | --- |
| Instant trigger | New Email Received | Registers a `message.received` webhook, verifies the raw-body HMAC, filters an optional inbox, and fetches the full message. |
| Polling trigger | New Inbox | Returns inboxes in newest-first order with stable IDs. Also powers inbox dropdowns. |
| Action | Send Email | Supports To, Cc, Bcc, text, HTML and a client-supplied unique send ID. |
| Action | Reply to Email | Preserves the existing thread and supports reply-all and a caller-supplied retry key. |
| Action | Create Inbox | Uses the managed email domain or a verified custom domain ID. |
| Action | Create Draft | Creates an unscheduled draft for review without sending. |
| Action | Get Message | Retrieves full message content, labels and attachment links. |
| Search | Find Message | Returns the best match, with complete message details and the actual search mode used. |

## Connect and use

See the [user guide](USER_GUIDE.md) for connection steps, an approval-to-draft recipe, and troubleshooting. The developer portal was verified on 8 November: existing app **249349**, hosted version **1.0.0**, status **Private**, with two triggers and six actions (including search). Source candidate **1.0.1** has not been uploaded. The invitation preview is being verified; no App Directory listing is claimed.

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
- Send Email and Reply to Email support SentFromAI's `client_id` idempotency behavior. Keys are scoped to the workspace, so use a distinct key for each intended send or reply, including across workflow steps. Retry with the same key and identical content. A conflict or unresolved outcome returns HTTP 409; do not bypass it by changing the key. Create Inbox and Create Draft do not expose an idempotency key; inspect ambiguous outcomes before replaying them.
- Attachment upload is not exposed by this integration. Get Message returns the API's expiring attachment links; retrieve a new link if needed later.
- Existing plan limits, paused-sending checks, suppression rules and abuse controls continue to apply. API errors are surfaced rather than retried around restrictions. HTTP 429 uses Zapier's native delay handling.

## Publication handoff

Recorded checks from 5–6 November 2026 cover the local build, mocked tests, live-API smoke tests with an isolated account, and credential-free remote definition validation. The last definition check had zero errors, zero publishing tasks, and 13 non-blocking recommendations. These records do not establish the current hosted release or App Directory status. Existing app/version details, its invitation, and hosted run evidence are being reconciled in [VALIDATION.md](VALIDATION.md).

1. Confirm the existing SentFromAI app and version in the developer portal before changing registration or upload state. Do not create a duplicate integration based on an older handoff document.
2. Record the current hosted version and verified invitation in the user guide. Compare the deployed source with this repository before uploading changes. Definition validation is separate from registration, upload, hosted testing and publishing.
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

Suggested workflows: create reviewable reply drafts from incoming email; send transactional email after a CRM update; create an inbox when a new agent/workspace is provisioned; route received messages to a support queue. Share written recipes while the integration is private. Zap templates become available after public review approval; private invitations do not create an App Directory listing or Zapier MCP availability.

## Verified references

Implementation was checked against SentFromAI's OpenAPI document and source routes for account, inboxes, messages, drafts, inbound events and webhooks on 5 November 2026.

- [Zapier API key authentication](https://docs.zapier.com/integrations/build/apikeyauth)
- [REST hook lifecycle and editor samples](https://docs.zapier.com/integrations/build/cli-hook-trigger)
- [Core reference: rawRequest and subscribeData](https://docs.zapier.com/integrations/build-cli/core)
- [Connection labels](https://docs.zapier.com/integrations/build/connection-label)
- [Publishing requirements](https://docs.zapier.com/platform/publish/integration-publishing-requirements)
- [CLI reference](https://github.com/zapier/zapier-platform/blob/main/packages/cli/docs/cli.md)
