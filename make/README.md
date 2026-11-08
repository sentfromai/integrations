# SentFromAI for Make

Developer source for a Make custom app. This package contains editor component JSON, not a Make-generated import archive.

The existing development app is `sentfromai-zguaud` version 1 in Make EU1. Each module is linked to the `sentfromai` connection; Make inserts its connection selector automatically. A 7 November 2026 handover reports eight successful hosted module runs, with the app still private and unapproved. Those execution logs, send/reply delivery and polling deduplication have not yet been independently rechecked. A customer invite URL and marketplace listing are not available in this source package yet.

Included modules:

- Create an Inbox
- List Inboxes
- Send an Email
- Reply to an Email
- Get an Email
- Search Emails
- Watch Received Emails (polling)
- Make an API Call

## Customer setup

After the published app invitation or verified listing is available:

1. Open the SentFromAI app invitation in Make and install it in your chosen organization, or select SentFromAI from the verified app directory once approved.
2. Add a SentFromAI module to a scenario and select **Add a connection**. Use an API key for a claimed SentFromAI workspace you control. The connection check lists inboxes and sends no email.
3. Use **List Inboxes** to find your inbox ID, then configure the desired module. **Send an Email** requires an inbox ID, recipient list, subject and a plain-text body (with optional HTML); give each logical message a unique stable Client ID if retry protection is needed.
4. For **Watch Received Emails**, choose the inbox, set the starting point to **From now on**, and schedule polling frequently enough for your volume. Its newest-100-message window and retry limits are explained below.
5. Run the scenario with your own test data before turning on its schedule. Never share API keys in scenario notes or screenshots.

## Maintain the existing app in the Make developer editor

1. Sign in to Make EU1 and open the existing custom app **SentFromAI** (`sentfromai-zguaud`, version 1). Do not create another app. Use `app-settings.json` for descriptive fields and `assets/logo.png` for its icon; the deployed internal app name remains `sentfromai-zguaud`.
2. Copy `base.json` into **Base**.
3. Create a **Basic** connection named `sentfromai`. Copy `connections/sentfromai/parameters.json` into **Parameters** and `communication.json` into **Communication**.
4. Create each module listed in `modules.json`, selecting the corresponding action, search, polling trigger, or universal type. Set each module's connection to the `sentfromai` connection from step 3. Copy **Communication**, **Mappable parameters**, **Interface**, and **Samples**. Leave **Static parameters** empty when `static-parameters.json` is `[]`. For Watch Received Emails, copy only its two static parameters, Inbox ID and Limit, and also copy **Epoch**. Its mappable-parameters file is intentionally empty.
5. Do not add a Connection static parameter. The Apps API rejects the name `__IMTCONN__` (`Static parameter name __IMTCONN__ is not valid name`). Make inserts the connection field after the module is associated with `sentfromai`. There is no `account:sentfromai` value to copy into static parameters.
6. Keep the app private while testing. Create a connection with a dedicated SentFromAI test API key. The connection check uses `GET /v1/inboxes`, so it does not send email.
7. Recheck the controlled-account tests below against the existing scenarios and save their URLs and recent execution IDs. A successful Send or Reply API response alone does not establish inbox delivery. Refresh the reviewer evidence before following Make's publish and review process.

## Validation

Requires Python 3 and Node.js 20 or newer; no dependencies or credentials are needed for local validation.

```sh
python3 build-source.py
node test-contract.mjs
```

The contract check compares methods, paths, body fields, required fields, recipient arrays, and query parameters to the included public OpenAPI snapshot. It also checks the connection probe, sensitive-header sanitization, path restrictions, send/reply idempotency fields, and polling window. It does not emulate Make's IML runtime or establish marketplace approval.

## Controlled-account tests before review

Use only test inboxes and recipients controlled by the account owner. Send and reply modules deliver real email when run.

1. Connect with a valid key and confirm the inbox list; confirm a deliberately invalid key fails.
2. Create a uniquely named test inbox, list it, and send one message to another controlled inbox.
3. Read the message; confirm body, IDs, dates, and signed attachment URLs appear under their documented fields.
4. Reply to the received message and verify its thread remains the same. Set a stable `client_id` for the logical reply. Reusing it with identical content must not create a second send. If the result is uncertain or the API returns 409, investigate instead of trying a new key.
5. Search by a distinctive test subject. Verify one output bundle per match and the selected limit.
6. Set Watch Received Emails to **From now on**, send one controlled inbound message, and confirm the next poll emits it once. A subsequent poll must not emit it again. Verify outbound messages do not trigger it.
7. Test the universal module using `GET inboxes`, then confirm an external URL such as `https://example.com` is rejected as a path.
8. Capture a controlled 404 error in a separate scenario. Use no customer data in reviewer logs.

## Publication and review

Use the existing app and remove only disposable test components before publication. Make publication generates a customer invite link; it does not establish verified-directory approval. Make says publication cannot be undone through the normal UI, and published components cannot be deleted.

Make's review prerequisites require recent successful scenario logs covering every module and a separate deliberate error scenario. After testing, publish the app, make the intended modules visible, and complete its Review form with the API documentation and scenario URLs. Use Samuel Arregger-Robson / samuel@sentfrom.ai for partnership contact and support@sentfrom.ai for app support. Verify that the portal shows the requested-review state before describing review as submitted.

## Trigger and API limits

The polling trigger retrieves the newest **100 total messages** in one inbox, then emits inbound messages. SentFromAI currently has no cursor or `since` parameter for this endpoint. More than 100 new inbound and outbound messages between polls can push unseen messages outside that window. The module is unsuitable for guaranteed high-volume capture or historical backfill; schedule it frequently and use an independently verified webhook receiver when those guarantees are needed.

An instant trigger is not included. SentFromAI signs exact request bytes with HMAC-SHA256. The reviewed Make custom-app webhook documentation did not establish raw-body access for correct verification, so no unverified signature implementation is presented as ready.

New-message sends and replies support the optional `client_id` idempotency key (1–255 UTF-8 bytes). Each logical email needs its own stable value; retry only with that key and identical content. Different content or an unresolved send returns 409; investigate an uncertain result instead of switching to a new key. Sending remains subject to SentFromAI account, quota, recipient suppression, and abuse-protection rules. Semantic/hybrid search may fall back to keyword.

## Sources

API contract refreshed from the public OpenAPI document on 8 November 2026, including reply idempotency. The app icon is the existing SentFromAI MCP 512px PNG, copied without alteration.

- [SentFromAI API](https://api.sentfrom.ai/openapi.json)
- [Make Base](https://developers.make.com/custom-apps-documentation/app-components/base)
- [Basic connections](https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection)
- [Polling triggers](https://developers.make.com/custom-apps-documentation/app-components/modules/trigger)
- [Universal module](https://developers.make.com/custom-apps-documentation/app-components/modules/universal-module)
- [Review prerequisites](https://developers.make.com/custom-apps-documentation/app-review/prerequisites)
- [Request review](https://developers.make.com/custom-apps-documentation/app-review/request-app-review)

Contact: Samuel Arregger-Robson, samuel@sentfrom.ai. Support: support@sentfrom.ai.
