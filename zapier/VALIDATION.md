# Validation record

Historical checks below were completed on 5–6 November 2026 with Zapier Platform CLI/Core 19.3.0. Hosted release evidence is being reconciled as of 8 November 2026; this document does not infer current registration or upload state from those earlier local checks.

- `npm test`: 22 tests passed using the official Zapier runtime with all HTTP requests mocked; no live email sends or account mutations.
- `npm run validate`: official local schema validation passed with no structural errors.
- `npm run build`: official CLI built and tested `build/build.zip` and `build/source.zip` locally.
- Remote definition checks passed on 6 November through the official CLI's credential-free validation endpoint. The first run found D021 trigger-description wording and D024 recipient-array output fields; both were corrected. The follow-up returned zero errors, zero publishing tasks and 13 non-blocking general warnings: eight D028 input-cleaning recommendations and five D004 dropdown recommendations. No account credentials, customer data or app registration were used.
- Live SentFromAI API smoke test through the actual `zapier-platform-core` 19.3.0 `createAppTester` runtime: passed on 5 November 2026 using an isolated account and two controlled inboxes. Covered authentication, inbox listing, sending, repeated `client_id` returning the original message without another send, reading, keyword search, an unscheduled draft, inbound reception, trigger editor samples, and one reply with the original thread and expected recipients.
- The smoke test sent one new message and one reply, both between the two isolated inboxes. It did not create external webhook subscriptions or use customer data.
- Those recorded runs did not cover hosted Zapier account connection, hosted test Zaps, or hosted webhook delivery. Local execution against the live API is not a hosted Zapier integration test. Newer portal evidence must be recorded separately. App Directory approval has not been established by these records.

Coverage includes auth and revoked-key errors, HTTP 429 delay handling, suppression failures, inbox ordering, array recipients, send idempotency fields, reply-all false/true, path encoding, unscheduled drafts, search no-match and plan fallback, webhook lifecycle, exact-byte HMAC validation, Zapier-prefixed signature headers, inbox/event filtering, canonical sample/live response consistency, and credentials restricted to the API origin.

The remaining D004 suggestions concern `client_id`, message IDs and the optional custom-domain ID. `client_id` is a caller-generated idempotency value, not an existing-record reference. D028 recommends `cleanInputData: false`; changing input-cleaning behavior was deliberately left for a separate compatibility review. These recommendations do not establish hosted Zap readiness or marketplace approval.

## Release evidence to reconcile

- Confirmed in the developer portal on 8 November: app **249349**, hosted version **1.0.0**, status **Private**, two triggers and six actions (including search). This is separate from source candidate 1.0.1.
- Verified invitation and the versions it grants access to.
- A retained successful hosted run for each of the eight operations: New Email Received, New Inbox, Send Email, Reply to Email, Create Inbox, Create Draft, Get Message, and Find Message.
- Hosted webhook subscription, signed delivery, and unsubscribe behavior.
- Classification of the reported `address_taken` test failure from its run inputs and history. Source behavior alone establishes a duplicate-address conflict, not which workflow caused it.
- A fresh-user connection and the user guide's complete approval-to-draft workflow. The written recipe is not a claim that this compound workflow has passed a hosted test.

## Source candidate 1.0.1 — 8 November 2026

The live public OpenAPI document at `https://api.sentfrom.ai/openapi.json`, retrieved on 8 November, includes optional `client_id` on `POST /messages/{id}/reply`. The current API source also passes that key and the original message ID into the sending operation. This candidate exposes it as **Unique Reply ID** without generating or substituting keys.

Two additional mocked tests cover identical-key retry results and both documented HTTP 409 outcomes (`client_id_conflict` and `send_outcome_pending`). The existing reply tests cover requests where the optional key is omitted. These tests establish the connector's request and error handling; they do not establish a live production replay test or hosted deployment of version 1.0.1.

- `npm test`: **24 tests passed**, with external networking disabled.
- `npm run validate`: official local schema validation passed with no structural errors.
- `npm run build`: official CLI built and tested both local archives using installed dependencies. No upload or remote validation was performed for this candidate.
- Documentation: relative links and `git diff --check` pass. The installation link and compound approval workflow remain unverified.

Create Inbox remains unchanged: an existing address produces a conflict instead of silently reusing or overwriting an inbox. The reported failing Zap still needs classification from actual run evidence.

## Hosted 1.0.0 validation observed on 8 November

The existing version's portal validation reports **zero errors, four publishing tasks, and 13 warnings**. The count is not a count of 17 runtime failures. The publishing tasks concern New Email Received's real polling sample/latest-run output comparisons, a matching-domain admin, and three users with live Zaps. The exact sample comparison details still need inspection before a source change is justified.

The warnings are eight D028 input-cleaning recommendations and five D004 dropdown suggestions. `cleanInputData: true` is retained deliberately for compatibility with existing empty/null/list handling. Caller-generated retry keys must remain values supplied for an intended send, not dropdowns of existing records. Other message/domain ID fields can accept mapped upstream values; further dropdown improvements are separate from the blocking publishing tasks. Candidate 1.0.1's additional retry-key field may add another dropdown recommendation when that version is validated.

The [official validation reference](https://docs.zapier.com/integrations/publish/integration-checks-reference) distinguishes Errors and Publishing Tasks from non-blocking Warnings. Run Validation from the hosted Version Overview, then inspect each task by its ID. S001 asks for three users with live successful Zaps; S002 and T001 require enabled-Zap coverage and successful history for each visible operation. Local tests, definition-only validation, and remote CLI invocations are not substitutes for that history.

The prepared hosted smoke script has not been run. Its offline tests verify persistent retry keys, recipient scope, uncertain-outcome stops, and output parsing; they do not establish hosted readiness.


## Hosted candidate update, 9 November

Version 1.0.1 is uploaded to existing app 249349. A remote CLI invocation of New Inbox succeeded. Its existing saved connection belongs to a separate synthetic test workspace, so the new controlled send/reply script has not been run against that connection. The prepared two-inbox fixture remains unchanged.

The reported Create Inbox failure in Zap 386029552, run `01bd4652-736f-ada4-5b1a-7ca6fdf82644`, was inspected in Zap History: `address_taken` for a previously created local part. A later successful run is visible. The failure was not replayed and the connector's conflict behavior was preserved.


A later controlled run used that existing Zapier QA connection, restricted to its two original named test inboxes. Hosted 1.0.1 New Inbox, Send Email, Get Message, Find Message and Reply to Email passed. One email and one reply were delivered between those inboxes with verified bodies/recipients. Same-key send and reply replay calls returned the original IDs with `idempotent: true`. The reply stayed in the original thread. No new connection or production recipient was used.

The public invitation page was opened and accepted in the existing developer account. Independent non-admin onboarding remains part of preview testing. A user-scoped migration job completed, and the existing email-trigger Zap visibly uses 1.0.1 in both steps. These checks do not establish all operation histories, negative webhook tests, three-user adoption or App Directory approval.
