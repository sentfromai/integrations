# SentFromAI integrations

Connect [SentFromAI](https://sentfrom.ai) email inboxes to automation platforms and AI-agent workflows.

| Platform | Source | Included capabilities | Release status |
| --- | --- | --- | --- |
| n8n | [n8n/](n8n/) | Inbox operations, send/reply/read/search, signed email-event webhook trigger | Package built and locally tested; npm publication, live workflow testing and community-node verification pending |
| Zapier | [zapier/](zapier/) | Instant inbound-email trigger, inbox trigger, email actions and search | Local tests/schema checks and build pass; authenticated upload, live test Zaps and directory review pending |
| Make | [make/](make/) | Custom-app connection and eight modules for inboxes and email | Source and API-contract checks complete; installation, Make runtime tests and review pending |
| Nango | [nango/](nango/) | API-key provider configuration and connection documentation | Provider schema checks complete; live Nango connection test and upstream review pending |

These packages are under development. A successful local build is not marketplace verification. Each platform directory documents its installation steps, remaining live tests and limitations.

## Documentation and support

- [SentFromAI website](https://sentfrom.ai)
- [API reference](https://docs.sentfrom.ai/api-reference/introduction)
- [Account console and API keys](https://console.sentfrom.ai/keys)
- [Official MCP integration](https://github.com/sentfromai/sentfromai-mcp)
- Product support: [support@sentfrom.ai](mailto:support@sentfrom.ai)

Use dedicated test accounts for connector validation. Sending and replying deliver real email; credentials belong in each platform's protected connection settings. The send endpoint supports a stable `client_id` for retries, while replies must not be blindly retried after uncertain delivery.

## Development

The n8n and Zapier packages use independent npm lockfiles and mocked HTTP tests. Make provides a dependency-free API-contract check. Nango's provider contribution is validated against its upstream schema. See each directory for exact commands.

Copyright 2026 Brightboard AI Ltd. Connector source is MIT licensed; SentFromAI branding remains the property of its owner. Platform names are trademarks of their respective owners.
