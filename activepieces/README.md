# SentFromAI for Activepieces

Activepieces community piece for [SentFromAI](https://sentfrom.ai). It gives a flow an email inbox: list and create inboxes, search and read messages, send and reply, and poll for mail that has arrived.

Version 0.0.2 is a preview custom piece. The [release archive](https://github.com/sentfromai/integrations/releases/tag/activepieces-v0.0.2) bundles its runtime dependencies and can be uploaded by an authorized Activepieces platform administrator. Follow the [installation guide](https://github.com/sentfromai/integrations/blob/main/activepieces/INSTALL.md). It is not listed in the public Activepieces catalog, and hosted installation and live flow verification are still pending.

## Operations

| Kind | Name | API | Behavior |
| --- | --- | --- | --- |
| Auth | API key | `GET /account` | Bearer secret text. The check is read-only. |
| Action | List Inboxes | `GET /inboxes` | Returns every inbox. This endpoint has no page parameters. |
| Action | Create Inbox | `POST /inboxes` | `local_part`, optional `display_name` and `domain_id`. |
| Action | Search Emails | `GET /messages` | `query`, `mode`, `inbox_id`, and `limit` of 1–100. |
| Action | Get Email | `GET /messages/{id}` | Returns the message record from the API. |
| Action | Send Email | `POST /messages` | Recipients, subject, text and/or HTML, optional `client_id`. |
| Action | Reply to Email | `POST /messages/{id}/reply` | `text` and/or `html`, `reply_all`, and optional `client_id`. |
| Polling trigger | Email Received | `GET /messages?limit=100` | Inbound messages only, deduped by the SDK polling cursor. |

All API paths above are relative to `https://api.sentfrom.ai/v1`. The piece does not call drafts, forward, delete, webhooks, labels, lists, domains, attachments upload, agent signup, or claim-link endpoints.

## Install for local development

Node.js 22 or newer is required; validation uses Node.js 22. No SentFromAI credential is required for the tests.

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build:archive
```

`npm test` compiles against `@activepieces/pieces-framework` 0.32.0 and `@activepieces/pieces-common` 0.12.5. It runs 16 mocked operation tests, four tests against a real local HTTPS server, and an archive test. The archive test extracts the package, checks loading without external runtime packages, and repeats all 20 operation/TLS tests against the bundled code. Tests do not contact SentFromAI or send live email.

The archive, checksum and source manifest are written to `build/archive/`. For a release, run `SENTFROMAI_RELEASE=1 npm run build:archive` from a clean committed checkout. The build preserves third-party license notices, allows only Node built-ins as external dependencies, and enforces the upstream 5 MiB bundle limit. The [submission checklist](https://github.com/sentfromai/integrations/blob/main/activepieces/SUBMISSION.md) covers hosted QA and a future invited upstream contribution. Do not publish under the platform-owned `@activepieces` npm namespace.

## Connect

1. Create a SentFromAI API key at [console.sentfrom.ai/keys](https://console.sentfrom.ai/keys).
2. In Activepieces, add the SentFromAI connection and paste the key without a `Bearer` prefix.
3. The connection check calls `GET /v1/account`. It does not send mail.

The key is sent as a Bearer token only to `https://api.sentfrom.ai`. Native Node HTTPS requests explicitly verify certificates and hostnames, use an isolated agent, and do not follow redirects. Error text returned to the flow has the key and `Bearer` values removed. The piece does not modify global TLS settings or console logging.

## Sending, replies, and conflicts

Send and Reply accept the documented `client_id` (1–255 UTF-8 bytes). Reuse the same value and the same content when retrying one email. Use a new value only for a different email. The API reports `client_id_conflict` when the body differs and `send_outcome_pending` when the outcome is unresolved; both errors say not to mint a replacement key.

Reply uses `POST /messages/{id}/reply` and retains threading from the original message. Automatic Activepieces retry is hidden on create, send, and reply because retry keys are optional. After an uncertain result, inspect the thread and preserve the original key rather than generating a replacement.

`409` with `address_taken` means the local part is already in use. `address_reserved` means it cannot be assigned. Choose a different local part. Plan limits such as `inbox_limit_reached` are returned as upgrade guidance rather than retried.

## Received-email polling

Polling runs on your Activepieces platform's schedule. On enable, bundled `@activepieces/pieces-common` 0.12.5 stores the current time. Later polls call `GET /messages` once with `limit=100` and the optional inbox ID. The live OpenAPI document (checked 7 November 2026) has `query`, `mode`, `inbox_id`, and `limit` only. This trigger does not send `page`, `cursor`, `offset`, or `since`.

Only `direction: inbound` items are candidates. `received_at`, then `created_at`, becomes the SDK time-based dedupe value. `pollingHelper` emits an item only when that time is strictly newer than the stored cursor, so the same page does not fire again. A list item without either timestamp is read with `GET /messages/{id}`. If that record still has no timestamp, the poll throws and the cursor stays where it was.

The 100-message response includes outbound mail. More than 100 new messages between polls can push an inbound message out of the window; this trigger cannot recover it. It is not a historical backfill. Webhooks are the API's push alternative and are not implemented here. The trigger test sample returns at most five newest inbound messages, which is the SDK test helper's cap.

The bundled `pieces-common` 0.12.5 resets the cursor on every enable, including a republish; messages arriving during a disabled interval can be skipped. Upgrading the host platform does not replace the helper embedded in this archive. A future piece release needs a newer helper and regression testing to change that behavior.

## API sources

Checked against the public OpenAPI document at `https://api.sentfrom.ai/openapi.json` and the guides at `https://docs.sentfrom.ai` on 7 November 2026, plus the n8n, Zapier, and Make connectors in this repository. Message list and get responses may include fields beyond the OpenAPI `Message` schema, including `received_at`, `created_at`, `body_html`, attachments, and labels. Those fields are passed through when the API returns them.

SDK references:

- [Activepieces piece overview](https://www.activepieces.com/docs/build-pieces/building-pieces/overview)
- [Piece authentication](https://www.activepieces.com/docs/build-pieces/piece-reference/authentication)
- [Polling trigger](https://www.activepieces.com/docs/build-pieces/piece-reference/triggers/polling-trigger)
- Published packages: `@activepieces/pieces-framework@0.32.0`, `@activepieces/pieces-common@0.12.5`, `@activepieces/shared@0.95.1`

## License

[MIT](https://github.com/sentfromai/integrations/blob/main/LICENSE). The archive includes `LICENSE` and `THIRD_PARTY_NOTICES.txt`. SentFromAI branding remains the property of its owner. Activepieces is a trademark of its owner.

Support: support@sentfrom.ai. Partner contact: Samuel Arregger-Robson, samuel@sentfrom.ai.
