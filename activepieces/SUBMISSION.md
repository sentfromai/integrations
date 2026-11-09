# Activepieces submission checklist

The connector source is merged in this repository. No upstream Activepieces pull request has been opened.

## Current distribution route

On 9 November 2026, [Activepieces contribution policy](https://github.com/activepieces/activepieces/blob/main/CONTRIBUTING.md) says unsolicited external pull requests are temporarily paused and automatically closed. An invited contribution is an exception; do not open an unsolicited PR as the publication step.

The supported alternative is a [custom piece built as a packed archive](https://www.activepieces.com/docs/build-pieces/misc/build-piece), then [uploaded to an authorized Activepieces platform](https://www.activepieces.com/docs/build-pieces/misc/publish-piece) using its admin API key. This installs the connector in that platform; it does not list it in the public catalog. Platform access and hosted QA are still required. The checkout integration checklist below applies to preparing that CLI build as well as a future invited upstream contribution.

Checked on 7 November 2026:

- npm `@activepieces/pieces-framework@0.32.0` requires `minimumSupportedRelease` of at least `0.82.0` for the current secret-text connection shape (`context.auth.secret_text`). This piece sets `0.82.0`.
- npm `@activepieces/pieces-common@0.12.5` supplies the HTTP method types and `pollingHelper` with `DedupeStrategy.TIMEBASED`.
- GitHub `main` piece-builder skill is ahead of those npm releases. `@activepieces/core-piece-types` and `@activepieces/core-utils` are not published. `PieceCategory` in the published SDK is imported from `@activepieces/shared`.

## Already done in this directory

- [x] Community piece shape: `src/index.ts`, `src/lib/auth.ts`, one action file per operation, one polling trigger.
- [x] `package.json` name `@activepieces/piece-sentfromai`, version `0.0.1`.
- [x] Secret-text API key, bearer requests, read-only `GET /account` validation.
- [x] Actions for list inbox, create inbox, search emails, get email, send email, and reply.
- [x] `audience` and `aiMetadata` on every action. Trigger `aiMetadata` describes one inbound message.
- [x] Send and Reply accept the documented optional `client_id` (API schema refreshed 8 November 2026).
- [x] `address_taken`, `address_reserved`, `client_id_conflict`, `send_outcome_pending`, plan-limit, auth, and rate-limit errors name a next step.
- [x] Authorization header is not copied into thrown errors. Redirects are not followed.
- [x] Poll requests the single documented 100-message page and dedupes with `pollingHelper`.
- [x] `logo.png` is the existing SentFromAI mark, copied from the Make package's icon file.
- [x] Authors lists the GitHub login `samuelar2` from this repository's commit history.
- [x] Local `npm run typecheck` and `npm test` pass against the published SDK with mocked HTTP.

## Integrate with the target Activepieces checkout

- [ ] Copy `activepieces/` to `packages/pieces/community/sentfromai`.
- [ ] Point dependencies at the checkout's `workspace:*` packages instead of the pinned npm versions.
- [ ] Register `"@activepieces/piece-sentfromai": ["packages/pieces/community/sentfromai/src/index.ts"]` alphabetically in the root `tsconfig.base.json`.
- [ ] If that checkout's `createAction` / `createTrigger` types include `classification`, set it from the operation: list and search `SEARCH`, get `READ`, create, send, and reply `WRITE`, trigger `READ`. The published 0.32.0 types reject `classification` as an excess property, so it is not in this source.
- [ ] Run that checkout's piece build and lint (`npx turbo run build --filter=@activepieces/piece-sentfromai` and the matching lint task, or the current equivalent). The monorepo ESLint config is not vendored here.
- [ ] Keep passing the whole trigger context into `pollingHelper`. On current main, `onEnable` preserves `lastPoll` when `context.isRepublish` is set. Do not replace that call with a hand-built `{ store, auth, propsValue }` object.

## Intentionally omitted

- [ ] `createCustomApiCallAction` is not included. The piece-builder skill adds it by default, and its factory would expose every path under `/v1`, including delete, agent signup, and claim-link. Those are outside this piece. Add a custom call only with an allowlist of the same inbox and message routes.
- [ ] No webhook trigger. SentFromAI signs the raw body with `x-sentfromai-signature`. Polling is the trigger this piece implements. A webhook needs a separate raw-body verification review.
- [ ] No attachment upload, forward, drafts, labels, or domain management.

## Hosted review still outstanding

These steps need a person with Activepieces maintainer or project access. They have not been done.

- [ ] Obtain an authorized target platform for custom-piece installation, or an invitation from maintainers before an upstream PR.
- [ ] Ask Activepieces to publish the logo to `https://cdn.activepieces.com/pieces/sentfromai.png`, or accept the review process they use for `logo.png`. The URL in `createPiece` will 404 until then.
- [ ] After uploading the custom piece, confirm its version appears in an Activepieces cloud or self-hosted project. Installing and syncing pieces was not run here.
- [ ] Connect a dedicated SentFromAI test key in that project. Confirm a wrong key fails and a valid key passes `GET /account`.
- [ ] Run List Inboxes, Create Inbox with a unique local part, and confirm `address_taken` on a second create of the same name.
- [ ] Send one message to an address the account owner controls, with a stable Client ID. Run the step again with the same input and confirm `idempotent: true` and no second delivery. Then change the body, keep the Client ID, and confirm the conflict error.
- [ ] Reply to a received test message with a stable Client ID, then repeat identical input and confirm the same message is returned. If a run times out, inspect the thread and preserve the key.
- [ ] Turn on Email Received, send one inbound message to the selected inbox, and confirm the next poll emits it once. Confirm the following poll does not emit it, and that an outbound message does not emit.
- [ ] Remove `private: true` only if Activepieces' publish pipeline requires it. Do not publish this package under the platform-owned `@activepieces` npm namespace. Use the documented custom-piece upload route for your own platform.
- [ ] Record the authorized platform installation and hosted test notes, and any future invited upstream PR, after they exist.

## Known SDK behavior to mention in review

The SDK HTTP client changes `NODE_TLS_REJECT_UNAUTHORIZED` while requests are in flight. SentFromAI therefore uses native Node HTTPS with explicit certificate verification and an isolated agent, retaining the SDK's action and polling abstractions. It does not change global TLS settings or console logging, and does not follow redirects.

On 9 November 2026, all 20 tests passed: 16 mocked operation tests and four tests against a real localhost TLS server. The latter reject untrusted certificates even when another piece disables global TLS checks, reject hostname mismatch, verify concurrent valid requests leave globals untouched, and reject redirects without forwarding credentials. Build and typecheck passed. These tests do not establish hosted Activepieces installation or real mail delivery.
