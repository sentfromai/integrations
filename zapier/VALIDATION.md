# Validation record

Validated on 5–6 November 2026 with Zapier Platform CLI/Core 19.3.0.

- `npm test`: 22 tests passed using the official Zapier runtime with all HTTP requests mocked; no live email sends or account mutations.
- `npm run validate`: official local schema validation passed with no structural errors.
- `npm run build`: official CLI built and tested `build/build.zip` and `build/source.zip` locally.
- Remote definition checks passed on 6 November through the official CLI's credential-free validation endpoint. The first run found D021 trigger-description wording and D024 recipient-array output fields; both were corrected. The follow-up returned zero errors, zero publishing tasks and 13 non-blocking general warnings: eight D028 input-cleaning recommendations and five D004 dropdown recommendations. No account credentials, customer data or app registration were used.
- Live SentFromAI API smoke test through the actual `zapier-platform-core` 19.3.0 `createAppTester` runtime: passed on 5 November 2026 using an isolated account and two controlled inboxes. Covered authentication, inbox listing, sending, repeated `client_id` returning the original message without another send, reading, keyword search, an unscheduled draft, inbound reception, trigger editor samples, and one reply with the original thread and expected recipients.
- The smoke test sent one new message and one reply, both between the two isolated inboxes. It did not create external webhook subscriptions or use customer data.
- Hosted Zapier account connection and test Zaps, hosted webhook delivery, public App Directory review and listing: outstanding. Local execution against the live API is not a hosted Zapier integration test. See README publication handoff.

Coverage includes auth and revoked-key errors, HTTP 429 delay handling, suppression failures, inbox ordering, array recipients, send idempotency fields, reply-all false/true, path encoding, unscheduled drafts, search no-match and plan fallback, webhook lifecycle, exact-byte HMAC validation, Zapier-prefixed signature headers, inbox/event filtering, canonical sample/live response consistency, and credentials restricted to the API origin.

The remaining D004 suggestions concern `client_id`, message IDs and the optional custom-domain ID. `client_id` is a caller-generated idempotency value, not an existing-record reference. D028 recommends `cleanInputData: false`; changing input-cleaning behavior was deliberately left for a separate compatibility review. These recommendations do not establish hosted Zap readiness or marketplace approval.
