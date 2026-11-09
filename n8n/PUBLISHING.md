# Publication and n8n verification

Status: source, lockfile, compiled package, tests and workflow template prepared. This file is not evidence of npm publication, an n8n listing or n8n approval.

## Repository

The package metadata targets public repository `https://github.com/sentfromai/integrations`, directory `n8n`. Keep this consistent with the actual published source. Publish the MIT license, README, node/credential source, examples, tests and package-lock.json. Do not publish node_modules or the build-tool cache.

The release workflow already exists at the repository root, `.github/workflows/n8n-publish.yml`. Its reference copy is `n8n/release/n8n-publish.yml`; do not create a second workflow. The root workflow uses `n8n` as its working directory and requires a tag matching `n8n-v<package version>`, including when started manually. It runs on a GitHub-hosted runner with Node 24, `id-token: write`, build/lint/tests, and `npm publish --provenance`.

## npm requirements

1. Confirm the intended npm user/organization can publish `n8n-nodes-sentfromai` and that its maintainer identity is consistent with the GitHub source. Package-name availability must be checked immediately before first publication.
2. Authenticate with npm. The package must already exist before an npm trusted publisher can be configured. First publication therefore needs a reviewed CI authentication path, such as a fresh short-lived granular token with the minimum required publish authority supplied as the repository Actions secret `NPM_TOKEN`; never commit or silently transfer an existing broad token. Do not use a local first publish if it would lose provenance.
3. After the package exists, configure npm **Trusted publishing** for GitHub owner `sentfromai`, repository `integrations`, workflow `n8n-publish.yml`. npm 11.5.1 or later in the workflow can use OIDC; remove the token secret when it is no longer needed. Keep `id-token: write` and `--provenance`.
4. Create/push the intended release tag after reviewing the source and CI result. The workflow checks that tag and package version agree, then builds, lints, tests and publishes from a GitHub-hosted runner with provenance.
5. Check the npm package's public source/provenance links and installed node contents.

The token and OIDC options are alternatives for authentication, not proof they are already configured. See [npm provenance](https://docs.npmjs.com/generating-provenance-statements) and [trusted publishing](https://docs.npmjs.com/trusted-publishers).

## n8n verification

Current [n8n verification guidelines](https://docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/) require GitHub Actions publication with provenance (from May 1, 2026), a public source repository, matching maintainer/repository metadata, MIT licensing, documentation, n8n-node checks and no third-party runtime dependencies. This package integrates only SentFromAI. The native crypto module verifies webhooks; it is not an npm dependency. Node code does not read files or environment variables.

After publication:

```sh
npx @n8n/scan-community-package n8n-nodes-sentfromai
```

Fix any issues raised by the current published-package scanner. Then submit the npm package and repository in the [n8n Creator Portal](https://creators.n8n.io/), following the current [community-node submission guide](https://docs.n8n.io/integrations/community-nodes/build-community-nodes/). n8n review and acceptance are independent of npm publication.

## Validation record

- On 8 November 2026, refreshed reply retry-key support against the live public OpenAPI document. Build, strict lint, typecheck and all 27 unit tests pass. The added reply test checks caller-key mapping and returned deduplication evidence; it is not a live server send.
- Verified endpoint/body/query schemas against SentFromAI's local `openapi.json` and message, inbox and webhook routes on 5 November 2026.
- Built with the official `n8n-node` tool (pinned 0.16.0) and TypeScript 5.9.2 against real n8n-workflow 1.82.0 types.
- Official cloud-compatibility lint passes with strict mode enabled and no rule suppressions.
- 27 tests execute the compiled nodes with actual n8n error classes and mocked HTTP helpers. Tests cover request mapping, batching, validation, search fallbacks, failure handling, webhook lifecycle, and raw-body HMAC rejection/acceptance.
- The 27 unit tests use mocked HTTP and perform no live mutations.
- A separate live smoke test on 5 November 2026 passed through the actual `n8n-core` 1.83.0 `WorkflowExecute` engine, with the compiled node, n8n expression evaluation, and n8n authenticated HTTP helpers. An in-memory credential-store adapter supplied only the isolated test account key.
- Live checks passed: two-inbox listing; send and expression-linked read; retrying the same Client ID returned the same message ID with `idempotent: true`; keyword search and read of the delivered inbound message; a reply in the original thread; and confirmed delivery of that reply back to the originating inbox.
- The live test sent one new message and one reply exclusively between the two user-authorized test inboxes. It created no inboxes or webhooks and used no customer data. The separate replay did not send another email.

The pinned lean CLI was used because available local disk space prevented installation of the latest CLI's much larger dependency tree. Before review, run the current published-package scanner and check the UI in a supported n8n instance. The live engine test is distinct from a full n8n server/UI test: it does not verify editor rendering, persisted credential setup, public webhook reception, activation, or deactivation.

## Remaining server/UI and trigger smoke test before review

Use an isolated test SentFromAI workspace and a supported n8n instance. Test the read-only credential connection and list-inboxes example in the editor. Confirm inbox dropdowns and all operation fields appear correctly. The action-node send/read/search/reply and deduplication behavior has already passed the live engine test above; repeat live sends only if server/UI differences or later changes require them. Activate the incoming-email workflow with public HTTPS, send a controlled inbound message, verify one workflow event and readable message, reject a tampered signature, then deactivate and confirm the registered endpoint is removed. Confirm failed authentication and API limits display actionable errors. Use the portal's current requirements for any additional reviewer credentials or demo materials.

## Real server HTTP QA

The dedicated `.github/workflows/n8n-server-qa.yml` job installs **n8n 2.46.6 on Node 24** in ephemeral GitHub-hosted runner storage. It runs `tests/server/run.cjs` against an isolated local PostgreSQL 17 database and the packed connector artifact. [CI run 42537499837](https://github.com/sentfromai/integrations/actions/runs/42537499837) passed on 8 November 2026 against source `57a31d59cd11eb9c74c89c8dd02429d3e7277d5f`. It verified credential success/failure, all six operations, send/reply deduplication, endpoint activation, invalid-signature rejection without workflow execution, valid signed delivery, and endpoint deactivation.

The test creates synthetic owner/credential records, checks server-loaded node and credential metadata, executes all six operations through n8n's HTTP workflow endpoints, verifies send/reply retry-key mapping, activates the trigger, rejects invalid raw-body signatures, verifies a valid workflow event, and deactivates the endpoint. The API fixture uses TLS with an explicit test CA. A test-only transport redirects the connector's fixed SentFromAI origin to that local fixture and rejects external network destinations. No production secrets, real mail, public listener or tunnel are used. The separate transport test checks this boundary before installing the large server runtime.

The packed artifact is loaded through n8n's supported custom-extension mechanism. This does not validate npm-directory installation or visual editor rendering. The upstream API is synthetic, so public HTTPS delivery from SentFromAI remains a separate controlled test. The job uploads sanitized result/log files only; temporary credentials, workflow state and test certificates are excluded.

The local full-server installation was stopped at the workspace's disk safety limit, and its cache/partial runtime were removed. Build, lint, typecheck, 27 unit tests and the transport isolation test passed locally. The full-server evidence above comes from the dedicated CI job, not that incomplete local installation.
