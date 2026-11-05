# Publication and n8n verification

Status: source, lockfile, compiled package, tests and workflow template prepared. This file is not evidence of npm publication, an n8n listing or n8n approval.

## Repository

The package metadata targets public repository `https://github.com/sentfromai/integrations`, directory `n8n`. Keep this consistent with the actual published source. Publish the MIT license, README, node/credential source, examples, tests and package-lock.json. Do not publish node_modules or the build-tool cache.

Copy `release/n8n-publish.yml` into the repository root at `.github/workflows/n8n-publish.yml` (the workflow cannot run while nested inside n8n/release). The workflow uses `n8n` as its working directory and expects a tag matching `n8n-v<package version>`.

## npm requirements

1. Confirm the intended npm user/organization can publish `n8n-nodes-sentfromai` and that its maintainer identity is consistent with the GitHub source. Package-name availability must be checked immediately before first publication.
2. Authenticate with npm. First publication may need an npm granular token supplied as the repository Actions secret `NPM_TOKEN`; never commit the token. Do not use a local first publish if it would lose provenance.
3. After the package exists, configure npm **Trusted publishing** for GitHub owner `sentfromai`, repository `integrations`, workflow `n8n-publish.yml`. An up-to-date npm in the workflow can use OIDC; remove the token secret when it is no longer needed. Keep `id-token: write` and `--provenance`.
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

- Verified endpoint/body/query schemas against SentFromAI's local `openapi.json` and message, inbox and webhook routes on 5 November 2026.
- Built with the official `n8n-node` tool (pinned 0.16.0) and TypeScript 5.9.2 against real n8n-workflow 1.82.0 types.
- Official cloud-compatibility lint passes with strict mode enabled and no rule suppressions.
- 26 tests execute the compiled nodes with actual n8n error classes and mocked HTTP helpers. Tests cover request mapping, batching, validation, search fallbacks, failure handling, webhook lifecycle, and raw-body HMAC rejection/acceptance.
- The 26 unit tests use mocked HTTP and perform no live mutations.
- A separate live smoke test on 5 November 2026 passed through the actual `n8n-core` 1.83.0 `WorkflowExecute` engine, with the compiled node, n8n expression evaluation, and n8n authenticated HTTP helpers. An in-memory credential-store adapter supplied only the isolated test account key.
- Live checks passed: two-inbox listing; send and expression-linked read; retrying the same Client ID returned the same message ID with `idempotent: true`; keyword search and read of the delivered inbound message; a reply in the original thread; and confirmed delivery of that reply back to the originating inbox.
- The live test sent one new message and one reply exclusively between the two user-authorized test inboxes. It created no inboxes or webhooks and used no customer data. The separate replay did not send another email.

The pinned lean CLI was used because available local disk space prevented installation of the latest CLI's much larger dependency tree. Before review, run the current published-package scanner and check the UI in a supported n8n instance. The live engine test is distinct from a full n8n server/UI test: it does not verify editor rendering, persisted credential setup, public webhook reception, activation, or deactivation.

## Remaining server/UI and trigger smoke test before review

Use an isolated test SentFromAI workspace and a supported n8n instance. Test the read-only credential connection and list-inboxes example in the editor. Confirm inbox dropdowns and all operation fields appear correctly. The action-node send/read/search/reply and deduplication behavior has already passed the live engine test above; repeat live sends only if server/UI differences or later changes require them. Activate the incoming-email workflow with public HTTPS, send a controlled inbound message, verify one workflow event and readable message, reject a tampered signature, then deactivate and confirm the registered endpoint is removed. Confirm failed authentication and API limits display actionable errors. Use the portal's current requirements for any additional reviewer credentials or demo materials.
