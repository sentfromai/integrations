# SentFromAI provider contribution for Nango

Provider configuration, connection instructions, and upstream file overlay. This is an authentication/proxy provider, not a bundle of prebuilt syncs/actions.

## Submission status

[Upstream draft PR #8204](https://github.com/NangoHQ/nango/pull/8204) is open. The provider is awaiting upstream review and is not yet an approved Nango listing.

Validated on 6 November 2026:

- Nango's authoritative provider validator passes.
- Generated documentation indexes are updated; the complete Mintlify scan reports `success no broken links found`.
- The provider configuration's live `GET /v1/inboxes` check returns **200** with an active, isolated test-account key. A deliberately invalid key returns **401**. No email sends were used for these checks.
- Provider YAML passes the repository's Prettier configuration, and the contribution passes `git diff --check`.

The full Nango server/dashboard connection flow remains untested, so the PR remains a draft. The live check verifies the configured base URL, Bearer header, and verification endpoint directly.

## Contents

- `provider.json`: canonical configuration, using API-key/Bearer authentication and a read-only `GET /v1/inboxes` credential check.
- `providers.fragment.yaml`: generated entry for `packages/providers/providers.yaml`.
- `overlay/`: provider documentation, connection guide, and logo in upstream paths.
- `apply-to-checkout.py`: applies the entry and documentation navigation to an explicitly supplied disposable Nango checkout. It refuses existing SentFromAI assets.
- `validate.cjs`: validates against Nango's own provider JSON schema and checks the contribution assets. Requires `ajv`, which is already an upstream dependency.

The proxy base URL is the unversioned host `https://api.sentfrom.ai`. Include `/v1` in each API path, including the credential-verification endpoint.

## Prepare the upstream change

Use a clean checkout or branch of [NangoHQ/nango](https://github.com/NangoHQ/nango). These commands do not publish anything:

```sh
python3 build-source.py
python3 apply-to-checkout.py /path/to/disposable/nango-checkout
```

Then, in the Nango checkout, install its documented development dependencies and run its actual validator:

```sh
npx tsx scripts/validation/providers/validate.ts
```

For the smaller local provider check, with Nango's `ajv` available:

```sh
NODE_PATH=/path/to/nango-checkout/node_modules node validate.cjs /path/to/nango-checkout/scripts/validation/providers/schema.json
```

Review the resulting diff. The navigation insertion locates Nango's `APIs & Integrations` group and inserts the SentFromAI page alphabetically by provider slug. It stops if that layout has changed.

## Remaining live validation

The official contribution process calls for a real connection test. Start Nango locally using its documented Docker setup, add the SentFromAI provider, create a connection with a dedicated test-account API key, and confirm `GET /v1/inboxes` succeeds. Verify that an invalid key is rejected and that proxy calls go only to the configured SentFromAI API host. Do not expose a key in a PR, issue, log, screenshot, or docs.

The supplied configuration deliberately does not enforce a key prefix: active keys created under the older service name remain valid. A successful read-only credential check does not mean the account is permitted to send; account status, claim requirements, plan limits, and suppression rules still apply.

After the full connection flow passes, update the existing draft PR with the actual validation evidence and make it ready for review. Do not open a duplicate PR or claim end-to-end validation before running it.

## Provenance

Checked 5 November 2026 against Nango's public provider schema and contribution guide. The inspected upstream tree was `cf8d63d4ac693edded49106f75d206e80e255004`. SentFromAI API behavior was checked against source commit `2a8a39fa210415be345ffc1b9ee08bc6c666dd20`.

The SVG file wraps the existing official SentFromAI MCP PNG without redrawing the brand. It is a raster-backed SVG, so the reviewer may request original vector artwork.

- [Nango contribution instructions](https://nango.dev/docs/integrations/contribute-or-request-api)
- [Nango provider schema](https://github.com/NangoHQ/nango/blob/master/scripts/validation/providers/schema.json)
- [Nango upstream validator](https://github.com/NangoHQ/nango/blob/master/scripts/validation/providers/validate.ts)
- [SentFromAI API specification](https://api.sentfrom.ai/openapi.json)

Contact: Samuel Arregger-Robson, samuel@sentfrom.ai. Support: support@sentfrom.ai.
