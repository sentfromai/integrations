# SentFromAI provider contribution for Nango

Provider configuration, connection instructions, and upstream file overlay. This is an authentication/proxy provider, not a bundle of prebuilt syncs/actions.

## Submission status

[Upstream draft PR #8204](https://github.com/NangoHQ/nango/pull/8204) is open at commit `35ec7c6da873df1ebc5541cfabb767387ea11161`. It is still a draft, GitHub reports it conflicting with `master`, and it is not an approved Nango listing. This repository was not used to comment on, mark ready, or merge that PR.

Checked again on 6 November 2026 in an isolated cloud environment:

- `node validate.cjs` against the provider schema from that PR commit passes.
- `nangohq/nango-server:hosted` (`sha256:284afbd7562e15c995d6bdb03ef0a883da16287589634b34bead0f863dab3c20`, built 6 November 2026) loads the PR `providers.yaml`. `GET /providers.json` returns SentFromAI as `API_KEY`, base URL `https://api.sentfrom.ai`, verification `GET /v1/inboxes`, and `Bearer ${apiKey}`.
- With that real base URL, both the Connect UI route `POST /api-auth/api-key/:providerConfigKey` and `POST /connections` reject a non-secret invalid key with `400 connection_test_failed`. No connection row is stored. During that call the Nango container sends TLS to `api.sentfrom.ai` (`153.52.255.22:443`). A direct request with the same invalid key returns **401**. The Nango error body does not include the upstream status code, so the packet capture and the direct 401 are separate evidence.
- A local mock can complete the success path only when SentFromAI's `base_url` is temporarily pointed at that mock and `NANGO_OUTBOUND_URL_POLICY` allows the private address. That run is not a live SentFromAI test. The dashboard Connect UI then shows success and lists the connection, and Nango's proxy follows the mock host with a single `Bearer` header. The provider file was restored to `https://api.sentfrom.ai` afterward.

An earlier direct `GET /v1/inboxes` **200** with a dedicated test key is recorded in the PR body. This session did not repeat that success, because no SentFromAI API key was supplied and other workspace credentials were not reused.

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

## Remaining before upstream review

The official connection test still needs one dedicated SentFromAI test API key in the local Nango dashboard while `base_url` is `https://api.sentfrom.ai`. Create the integration, choose **Authorize**, enter that key, and confirm the connection appears with no error. Then proxy `GET /v1/inboxes` through that connection and expect **200**. Keep the key out of the PR, logs, and screenshots. A mock server, a direct curl, or an invalid-key rejection does not replace this step.

Before marking PR 8204 ready:

1. Rebase onto current `master`. A local merge of `master` into `35ec7c6` conflicted only in the generated counts in `docs/api-catalog.txt` (1136 vs 1201) and `docs/llms.txt`. `packages/providers/providers.yaml` merged with a single `sentfromai` entry. Regenerate the docs indexes after the rebase and rerun provider validation.
2. Repeat the dashboard connection and proxy check with the dedicated live key.
3. Update the existing draft PR with that evidence. Do not open a duplicate PR.

The supplied configuration deliberately does not enforce a key prefix: active keys created under the older service name remain valid. A successful read-only credential check does not mean the account is permitted to send; account status, claim requirements, plan limits, and suppression rules still apply.

## Provenance

Checked 5 November 2026 against Nango's public provider schema and contribution guide. The inspected upstream tree was `cf8d63d4ac693edded49106f75d206e80e255004`. SentFromAI API behavior was checked against source commit `2a8a39fa210415be345ffc1b9ee08bc6c666dd20`.

The SVG file wraps the existing official SentFromAI MCP PNG without redrawing the brand. It is a raster-backed SVG, so the reviewer may request original vector artwork.

- [Nango contribution instructions](https://nango.dev/docs/integrations/contribute-or-request-api)
- [Nango provider schema](https://github.com/NangoHQ/nango/blob/master/scripts/validation/providers/schema.json)
- [Nango upstream validator](https://github.com/NangoHQ/nango/blob/master/scripts/validation/providers/validate.ts)
- [SentFromAI API specification](https://api.sentfrom.ai/openapi.json)

Contact: Samuel Arregger-Robson, samuel@sentfrom.ai. Support: support@sentfrom.ai.
