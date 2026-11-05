# Validation record

Validated on 5 November 2026 with Zapier Platform CLI/Core 19.3.0.

- `npm test`: 22 tests passed using the official Zapier runtime with all HTTP requests mocked; no live email sends or account mutations.
- `npm run validate`: official local schema validation passed with no structural errors.
- `npm run build`: official CLI built and tested `build/build.zip` and `build/source.zip` locally.
- Remote integration style/publishing checks: pending authenticated platform submission.
- Real account connection, live test Zaps, public App Directory review and listing: outstanding. See README publication handoff.

Coverage includes auth and revoked-key errors, HTTP 429 delay handling, suppression failures, inbox ordering, array recipients, send idempotency fields, reply-all false/true, path encoding, unscheduled drafts, search no-match and plan fallback, webhook lifecycle, exact-byte HMAC validation, Zapier-prefixed signature headers, inbox/event filtering, canonical sample/live response consistency, and credentials restricted to the API origin.
