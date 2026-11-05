# Validation record

Validated on 5 November 2026 with Zapier Platform CLI/Core 19.3.0.

- `npm test`: 22 tests passed using the official Zapier runtime with all HTTP requests mocked; no live email sends or account mutations.
- `npm run validate`: official local schema validation passed with no structural errors.
- `npm run build`: official CLI built and tested `build/build.zip` and `build/source.zip` locally.
- Remote integration style/publishing checks: pending authenticated platform submission.
- Live SentFromAI API smoke test through the actual `zapier-platform-core` 19.3.0 `createAppTester` runtime: passed on 5 November 2026 using an isolated account and two controlled inboxes. Covered authentication, inbox listing, sending, repeated `client_id` returning the original message without another send, reading, keyword search, an unscheduled draft, inbound reception, trigger editor samples, and one reply with the original thread and expected recipients.
- The smoke test sent one new message and one reply, both between the two isolated inboxes. It did not create external webhook subscriptions or use customer data.
- Hosted Zapier account connection and test Zaps, hosted webhook delivery, public App Directory review and listing: outstanding. Local execution against the live API is not a hosted Zapier integration test. See README publication handoff.

Coverage includes auth and revoked-key errors, HTTP 429 delay handling, suppression failures, inbox ordering, array recipients, send idempotency fields, reply-all false/true, path encoding, unscheduled drafts, search no-match and plan fallback, webhook lifecycle, exact-byte HMAC validation, Zapier-prefixed signature headers, inbox/event filtering, canonical sample/live response consistency, and credentials restricted to the API origin.
