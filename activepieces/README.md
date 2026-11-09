# SentFromAI for Activepieces

Activepieces community piece for [SentFromAI](https://sentfrom.ai). It gives a flow an email inbox: list and create inboxes, search and read messages, send and reply, and poll for mail that has arrived.

This directory is the isolated piece source. It has not been copied into the Activepieces monorepo, installed on an Activepieces project, or published. Local build, typecheck, and mocked tests exercise the published piece SDK. They do not send live email.

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

The piece does not call drafts, forward, delete, webhooks, labels, lists, domains, attachments upload, agent signup, or claim-link endpoints.

## Install for local development

Node.js 22 or newer is required. No SentFromAI credential is required for the mocked tests.

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
```

`npm test` compiles with TypeScript against `@activepieces/pieces-framework` 0.32.0 and `@activepieces/pieces-common` 0.12.5, then runs the Node test runner. HTTP is mocked with Nock and live network access is disabled.

To try the piece in a self-hosted Activepieces checkout, copy this directory to `packages/pieces/community/sentfromai`, replace the npm dependency versions with that checkout's workspace packages, and register `@activepieces/piece-sentfromai` in the monorepo `tsconfig.base.json`. The [submission checklist](SUBMISSION.md) lists the differences between this published SDK and current Activepieces main. Do not publish this package to npm from this repository.

## Connect

1. Create a SentFromAI API key at [console.sentfrom.ai/keys](https://console.sentfrom.ai/keys).
2. In Activepieces, add the SentFromAI connection and paste the key without a `Bearer` prefix.
3. The connection check calls `GET /v1/account`. It does not send mail.

The key is attached with the SDK bearer authentication helper and is sent only to `https://api.sentfrom.ai`. Requests set `followRedirects: false`. Error text returned to the flow has the key and `Bearer` values removed. The published HTTP client logs failed response bodies; this piece redacts the key in that log line as well.

## Sending, replies, and conflicts

Send and Reply accept the documented `client_id` (1–255 UTF-8 bytes). Reuse the same value and the same content when retrying one email. Use a new value only for a different email. The API reports `client_id_conflict` when the body differs and `send_outcome_pending` when the outcome is unresolved; both errors say not to mint a replacement key.

Reply uses `POST /messages/{id}/reply` and retains threading from the original message. Automatic Activepieces retry is hidden on create, send, and reply because retry keys are optional. After an uncertain result, inspect the thread and preserve the original key rather than generating a replacement.

`409` with `address_taken` means the local part is already in use. `address_reserved` means it cannot be assigned. Choose a different local part. Plan limits such as `inbox_limit_reached` are returned as upgrade guidance rather than retried.

## Received-email polling

Activepieces polling runs on the platform schedule, about every five minutes. On enable, `@activepieces/pieces-common` 0.12.5 stores the current time. Later polls call `GET /messages` once with `limit=100` and the optional inbox ID. The live OpenAPI document (checked 7 November 2026) has `query`, `mode`, `inbox_id`, and `limit` only. This trigger does not send `page`, `cursor`, `offset`, or `since`.

Only `direction: inbound` items are candidates. `received_at`, then `created_at`, becomes the SDK time-based dedupe value. `pollingHelper` emits an item only when that time is strictly newer than the stored cursor, so the same page does not fire again. A list item without either timestamp is read with `GET /messages/{id}`. If that record still has no timestamp, the poll throws and the cursor stays where it was.

The 100-message response includes outbound mail. More than 100 new messages between polls can push an inbound message out of the window; this trigger cannot recover it. It is not a historical backfill. Webhooks are the API's push alternative and are not implemented here. The trigger test sample returns at most five newest inbound messages, which is the SDK test helper's cap.

`pieces-common` 0.12.5 resets the cursor on every enable, including a republish. Current Activepieces main preserves the cursor when the full trigger context is passed and `isRepublish` is set. This source passes that full context, so the newer helper keeps the cursor without a further code change. The published helper used by these tests does not.

## API sources

Checked against the public OpenAPI document at `https://api.sentfrom.ai/openapi.json` and the guides at `https://docs.sentfrom.ai` on 7 November 2026, plus the n8n, Zapier, and Make connectors in this repository. Message list and get responses may include fields beyond the OpenAPI `Message` schema, including `received_at`, `created_at`, `body_html`, attachments, and labels. Those fields are passed through when the API returns them.

SDK references:

- [Activepieces piece overview](https://www.activepieces.com/docs/build-pieces/building-pieces/overview)
- [Piece authentication](https://www.activepieces.com/docs/build-pieces/piece-reference/authentication)
- [Polling trigger](https://www.activepieces.com/docs/build-pieces/piece-reference/triggers/polling-trigger)
- Published packages: `@activepieces/pieces-framework@0.32.0`, `@activepieces/pieces-common@0.12.5`, `@activepieces/shared@0.95.1`

## License

[MIT](../LICENSE). SentFromAI branding remains the property of its owner. Activepieces is a trademark of its owner.

Support: support@sentfrom.ai. Partner contact: Samuel Arregger-Robson, samuel@sentfrom.ai.
