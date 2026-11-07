# Activepieces submission checklist

This file is the handoff for a future pull request to [activepieces/activepieces](https://github.com/activepieces/activepieces). No upstream pull request has been opened. This repository's review PR only adds the isolated piece.

Checked on 7 November 2026:

- npm `@activepieces/pieces-framework@0.32.0` requires `minimumSupportedRelease` of at least `0.82.0` for the current secret-text connection shape (`context.auth.secret_text`). This piece sets `0.82.0`.
- npm `@activepieces/pieces-common@0.12.5` supplies `httpClient`, `AuthenticationType.BEARER_TOKEN`, and `pollingHelper` with `DedupeStrategy.TIMEBASED`.
- GitHub `main` piece-builder skill is ahead of those npm releases. `@activepieces/core-piece-types` and `@activepieces/core-utils` are not published. `PieceCategory` in the published SDK is imported from `@activepieces/shared`.

## Already done in this directory

- [x] Community piece shape: `src/index.ts`, `src/lib/auth.ts`, one action file per operation, one polling trigger.
- [x] `package.json` name `@activepieces/piece-sentfromai`, version `0.0.1`.
- [x] Secret-text API key, bearer requests, read-only `GET /account` validation.
- [x] Actions for list inbox, create inbox, search emails, get email, send email, and reply.
- [x] `audience` and `aiMetadata` on every action. Trigger `aiMetadata` describes one inbound message.
- [x] Send uses documented `client_id`. Reply does not invent one.
- [x] `address_taken`, `address_reserved`, `client_id_conflict`, `send_outcome_pending`, plan-limit, auth, and rate-limit errors name a next step.
- [x] Authorization header is not copied into thrown errors. Redirects are not followed.
- [x] Poll requests the single documented 100-message page and dedupes with `pollingHelper`.
- [x] `logo.png` is the existing SentFromAI mark, copied from the Make package's icon file.
- [x] Authors lists the GitHub login `samuelar2` from this repository's commit history.
- [x] Local `npm run typecheck` and `npm test` pass against the published SDK with mocked HTTP.

## Do this in the Activepieces monorepo before opening the upstream PR

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

- [ ] Open the upstream pull request from a fork. This integrations repository PR is not that submission.
- [ ] Ask Activepieces to publish the logo to `https://cdn.activepieces.com/pieces/sentfromai.png`, or accept the review process they use for `logo.png`. The URL in `createPiece` will 404 until then.
- [ ] After merge, confirm the piece version appears in an Activepieces cloud or self-hosted project. Installing and syncing pieces was not run here.
- [ ] Connect a dedicated SentFromAI test key in that project. Confirm a wrong key fails and a valid key passes `GET /account`.
- [ ] Run List Inboxes, Create Inbox with a unique local part, and confirm `address_taken` on a second create of the same name.
- [ ] Send one message to an address the account owner controls, with a stable Client ID. Run the step again with the same input and confirm `idempotent: true` and no second delivery. Then change the body, keep the Client ID, and confirm the conflict error.
- [ ] Reply once to a received test message. Do not use platform retry. If the run times out, read the thread before replying again.
- [ ] Turn on Email Received, send one inbound message to the selected inbox, and confirm the next poll emits it once. Confirm the following poll does not emit it, and that an outbound message does not emit.
- [ ] Remove `private: true` only if Activepieces' publish pipeline requires it. Do not `npm publish` this directory yourself; official pieces are published from the Activepieces repository.
- [ ] Record the upstream PR URL and the hosted test notes back in this file after they exist.

## Known SDK behavior to mention in review

`AxiosHttpClient` in pieces-common 0.12.5 sets `NODE_TLS_REJECT_UNAUTHORIZED=0` while a request is in flight. This piece restores the previous value afterward and does not follow redirects. TLS verification during the call is still the SDK client's behavior.
