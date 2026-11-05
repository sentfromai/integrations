# SentFromAI for Make

Developer source for a Make custom app. This package contains editor component JSON, not a Make-generated import archive. It has not been installed, executed, reviewed, or listed in Make yet.

Included modules:

- Create an Inbox
- List Inboxes
- Send an Email
- Reply to an Email
- Get an Email
- Search Emails
- Watch Received Emails (polling)
- Make an API Call

## Install in the Make developer editor

1. Sign in to Make and open the custom apps developer editor. Create a new private app named `sentfromai`, label **SentFromAI**, API version 1. Use `app-settings.json` for the descriptive fields and `assets/logo.png` for the app icon.
2. Copy `base.json` into **Base**.
3. Create a **Basic** connection named `sentfromai`. Copy `connections/sentfromai/parameters.json` into **Parameters** and `communication.json` into **Communication**.
4. Create each module listed in `modules.json`, selecting the corresponding action, search, polling trigger, or universal type. For each module, copy the matching files into **Communication**, **Static parameters**, **Mappable parameters**, **Interface**, and **Samples**. For the polling trigger, also copy **Epoch**. A trigger has static parameters only; its mappable-parameters file is intentionally empty.
5. Keep the app private while testing. Create a connection with a dedicated SentFromAI test API key. The connection check uses `GET /v1/inboxes`, so it does not send email.
6. Run the controlled-account tests below. Save scenario links and recent successful execution logs for the Make reviewer. Then follow Make's publish and review process.

The connection selector uses `account:sentfromai`. If the Make editor assigns a different internal connection identifier, update this type in each module's static parameters to match before saving.

## Validation

Requires Python 3 and Node.js 20 or newer; no dependencies or credentials are needed for local validation.

```sh
python3 build-source.py
node test-contract.mjs
```

The contract check compares methods, paths, body fields, required fields, recipient arrays, and query parameters to the included public OpenAPI snapshot. It also checks the connection probe, sensitive-header sanitization, path restrictions, reply idempotency limitation, and polling window. It does not emulate Make's IML runtime or establish marketplace approval.

## Controlled-account tests before review

Use only test inboxes and recipients controlled by the account owner. Send and reply modules deliver real email when run.

1. Connect with a valid key and confirm the inbox list; confirm a deliberately invalid key fails.
2. Create a uniquely named test inbox, list it, and send one message to another controlled inbox.
3. Read the message; confirm body, IDs, dates, and signed attachment URLs appear under their documented fields.
4. Reply to the received message and verify its thread remains the same. Do not blindly retry replies after ambiguous timeouts: that endpoint does not accept `client_id`.
5. Search by a distinctive test subject. Verify one output bundle per match and the selected limit.
6. Set Watch Received Emails to **From now on**, send one controlled inbound message, and confirm the next poll emits it once. A subsequent poll must not emit it again. Verify outbound messages do not trigger it.
7. Test the universal module using `GET inboxes`, then confirm an external URL such as `https://example.com` is rejected as a path.
8. Capture a controlled 404 error in a separate scenario. Use no customer data in reviewer logs.

## Trigger and API limits

The polling trigger retrieves the newest **100 total messages** in one inbox, then emits inbound messages. SentFromAI currently has no cursor or `since` parameter for this endpoint. More than 100 new inbound and outbound messages between polls can push unseen messages outside that window. The module is unsuitable for guaranteed high-volume capture or historical backfill; schedule it frequently and use an independently verified webhook receiver when those guarantees are needed.

An instant trigger is not included. SentFromAI signs exact request bytes with HMAC-SHA256. The reviewed Make custom-app webhook documentation did not establish raw-body access for correct verification, so no unverified signature implementation is presented as ready.

New-message sends support the optional `client_id` idempotency key. Each logical email needs its own stable value; never reuse one for different content. Sending remains subject to SentFromAI account, quota, recipient suppression, and abuse-protection rules. Semantic/hybrid search may fall back to keyword.

## Sources

API source checked at commit `2a8a39fa210415be345ffc1b9ee08bc6c666dd20` on 5 November 2026. The app icon is the existing SentFromAI MCP 512px PNG, copied without alteration.

- [SentFromAI API](https://api.sentfrom.ai/openapi.json)
- [Make Base](https://developers.make.com/custom-apps-documentation/app-components/base)
- [Basic connections](https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection)
- [Polling triggers](https://developers.make.com/custom-apps-documentation/app-components/modules/trigger)
- [Universal module](https://developers.make.com/custom-apps-documentation/app-components/modules/universal-module)
- [Review prerequisites](https://developers.make.com/custom-apps-documentation/app-review/prerequisites)
- [Request review](https://developers.make.com/custom-apps-documentation/app-review/request-app-review)

Contact: Samuel Arregger-Robson, samuel@sentfrom.ai. Support: support@sentfrom.ai.
