# SentFromAI provider contribution for Nango

Prepared provider configuration, connection instructions, and upstream file overlay. This is an authentication/proxy provider, not a bundle of prebuilt syncs/actions. No upstream PR or API listing has been created by these files alone.

## Contents

- `provider.json`: canonical configuration, using API-key/Bearer authentication and a read-only `GET /inboxes` credential check.
- `providers.fragment.yaml`: generated entry for `packages/providers/providers.yaml`.
- `overlay/`: provider documentation, connection guide, and logo in upstream paths.
- `apply-to-checkout.py`: applies the entry and documentation navigation to an explicitly supplied disposable Nango checkout. It refuses existing SentFromAI assets.
- `validate.cjs`: validates against Nango's own provider JSON schema and checks the contribution assets. Requires `ajv`, which is already an upstream dependency.

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

The official contribution process calls for a real connection test. Start Nango locally using its documented Docker setup, add the SentFromAI provider, create a connection with a dedicated test-account API key, and confirm `GET /inboxes` succeeds. Verify that an invalid key is rejected and that proxy calls go only to the configured SentFromAI API host. Do not expose a key in a PR, issue, log, screenshot, or docs.

The supplied configuration deliberately does not enforce a key prefix: active keys created under the older service name remain valid. A successful read-only credential check does not mean the account is permitted to send; account status, claim requirements, plan limits, and suppression rules still apply.

Once live validation passes, open an upstream pull request, describing the actual tests performed. Suggested title: `feat(integrations): add SentFromAI API-key provider`. Do not claim end-to-end validation before running it.

## Provenance

Checked 5 November 2026 against Nango's public provider schema and contribution guide. The inspected upstream tree was `cf8d63d4ac693edded49106f75d206e80e255004`. SentFromAI API behavior was checked against source commit `2a8a39fa210415be345ffc1b9ee08bc6c666dd20`.

The SVG file wraps the existing official SentFromAI MCP PNG without redrawing the brand. It is a raster-backed SVG, so the reviewer may request original vector artwork.

- [Nango contribution instructions](https://nango.dev/docs/integrations/contribute-or-request-api)
- [Nango provider schema](https://github.com/NangoHQ/nango/blob/master/scripts/validation/providers/schema.json)
- [Nango upstream validator](https://github.com/NangoHQ/nango/blob/master/scripts/validation/providers/validate.ts)
- [SentFromAI API specification](https://api.sentfrom.ai/openapi.json)

Contact: Samuel Arregger-Robson, samuel@sentfrom.ai. Support: support@sentfrom.ai.
