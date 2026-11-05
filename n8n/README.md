# n8n-nodes-sentfromai

Give your n8n workflows and AI agents an email inbox with [SentFromAI](https://sentfrom.ai).
Create inboxes, send and reply to messages, search email, and start workflows when email arrives or delivery status changes.

This community package integrates the [SentFromAI API](https://sentfrom.ai/docs). [n8n](https://n8n.io) is a workflow automation platform.

## Installation

Once this package is published to npm, self-hosted n8n administrators can install `n8n-nodes-sentfromai` from **Settings → Community Nodes → Install**, following the [n8n installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

n8n Cloud installation requires separate verification by n8n. Publishing the npm package does not mean that n8n has verified or listed it.

For local development, use Node.js 22.22 or later:

```sh
npm ci
npm run build
npm run lint
npm test
npm run dev
```

## Credentials

1. Create a SentFromAI account at [sentfrom.ai](https://sentfrom.ai) and create an API key in your dashboard.
2. In n8n, add a **SentFromAI API** credential and paste the key into **API Key**.
3. Test the connection. This performs a read-only inbox-list request; it does not send email.
4. Choose the credential in each SentFromAI node.

The credential is stored by n8n and sent as a bearer token only to `https://api.sentfrom.ai`. Redirect following is disabled. No environment variables or local files are read by the connector.

## Operations

| Resource | Operation | Result                                                                   |
| -------- | --------- | ------------------------------------------------------------------------ |
| Inbox    | Create    | A new inbox on the managed domain, or a specified verified custom domain |
| Inbox    | Get Many  | One n8n item per available inbox                                         |
| Message  | Get       | Full message, labels and signed attachment download URLs                 |
| Message  | Search    | Up to 100 matching messages, or recent messages when the query is empty  |
| Message  | Send      | Sends an email from an existing inbox                                    |
| Message  | Reply     | Replies in the original thread, optionally to all original recipients    |

The main node can also be connected as a tool to an n8n AI Agent. Configure the selected operation and credentials, and decide which input fields the model may supply. Add human approval in workflows where a person should review outgoing email.

### Sending and retries

Supply **Text**, **HTML**, or both. Enter bare addresses separated by commas in **To**, **CC**, and **BCC**. The sending identity is the selected inbox; the connector does not accept an arbitrary From address.

For **Send**, set **Additional Fields → Client ID** to a stable unique value from your business event, such as an order notification ID. Reuse the same value when retrying the same logical send. Generate a different value for each different message. The API uses `client_id` for deduplication.

**Reply currently has no API idempotency key.** The connector does not automatically retry requests. Before rerunning a failed reply after a timeout, check the thread to see whether the first attempt succeeded. Enabling n8n's **Retry On Fail** for reply operations can cause duplicate emails.

Account claim requirements, sending pauses, recipient suppression, plan limits and abuse protections remain enforced by the SentFromAI API. The node surfaces API errors instead of trying to bypass them.

### Search

Search supports keyword, semantic and hybrid modes. Semantic and hybrid availability depends on the account and API configuration. Each returned message includes `mode_used`, so a workflow can detect a server fallback to keyword search. Search results are summaries; use **Get** with the returned `id` to retrieve message content.

The API exposes a maximum of 100 search/recent results and no cursor or offset. This package therefore does not offer an unsupported “return all messages” option. Inbox listing returns all inboxes because that endpoint is unpaginated.

## Trigger

**SentFromAI Trigger** supports:

- Message Received
- Message Delivered
- Message Bounced
- Message Complained
- Message Rejected

Choose events and activate the workflow. n8n must expose a publicly reachable **HTTPS** webhook URL. The node registers the endpoint automatically, verifies HMAC-SHA256 against the exact raw request bytes, and removes the endpoint when the workflow is deactivated. No signing secret is emitted in workflow output. The API returns the secret only during registration; the node retains it in n8n workflow static data, so protect workflow exports and database access.

Events are workspace-wide. Incoming message events include `inbox_id`, `thread_id`, and a nested `message` object; use a Filter node on `inbox_id` when a workflow should handle only one inbox. Delivery-status events instead identify the message with top-level `message_id`.

Webhook delivery may be retried, so make downstream effects idempotent. Deduplicate by event and message ID (and recipient when your application needs recipient-level behavior). The source signature has no timestamp: verification authenticates the body but does not by itself prevent replay. Disable and reactivate a workflow to rotate its webhook registration if a signing secret is exposed.

## Example workflows

- [List inboxes](examples/list-inboxes.json): safe starter with Manual Trigger → Inbox Get Many. Import, select your credential, and execute.
- [Read incoming email](examples/read-incoming-email.json): SentFromAI Trigger → Message Get. Select credentials and activate only after setting the intended event selection.
- Support assistant: Message Received → Filter by inbox → retrieve customer context → draft a response → human approval → Reply.
- Transactional notice: business event → Send with a stable Client ID from the source event.

Examples contain no credentials and the supplied workflow files do not send email.

## Compatibility and limits

The package compiles against n8n-workflow 1.82.0 and uses n8n's standard credential and authenticated HTTP helpers. The main node is usable as an AI tool. The trigger is a workflow entry point, not an AI tool. Actual n8n UI and account smoke testing is still required before a public verification application; the automated suite uses mocked HTTP and does not send live email.

This initial version does not upload attachments, forward messages, delete inboxes, or expose draft management. Reading a message returns its attachment download links. Webhooks are the supported route for reacting to every new message; search is not an unlimited polling feed.

The nodes have no third-party runtime dependencies. Development tools and the n8n host peer dependency are listed separately.

## Development and support

The programmatic implementation validates address input, keeps item links when expanding collections, normalizes API fields, and handles errors per item. The trigger additionally manages a registration lifecycle and verifies raw-body signatures. Requests use n8n's HTTP helper rather than an SDK.

Report issues at [sentfromai/integrations](https://github.com/sentfromai/integrations/issues). Include the node operation, n8n version and sanitized error; do not include API keys, webhook secrets or private email bodies.

## License

[MIT](LICENSE).
