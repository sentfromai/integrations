# SentFromAI integrations

Connect [SentFromAI](https://sentfrom.ai) email inboxes to automation platforms and AI-agent workflows.

| Platform | Source | Included capabilities | Release status |
| --- | --- | --- | --- |
| n8n | [n8n/](n8n/) | Inbox operations, send/reply/read/search, signed email-event webhook trigger | Real n8n 2.46.6 server QA passes; npm publication, visual editor checks and community-node verification pending |
| Zapier | [zapier/](zapier/) | Instant inbound-email trigger, inbox trigger, email actions and search | [Invite-only preview](zapier/USER_GUIDE.md); hosted send/read/search/reply and same-key retries pass on 1.0.1; directory review pending |
| Make | [make/](make/) | Custom-app connection and eight modules for inboxes and email | Updated source and contract checks pass; hosted update, scenario verification and publication pending |
| Nango | [nango/](nango/) | API-key provider configuration and connection documentation | Provider schema and live API-key checks pass; [upstream PR](https://github.com/NangoHQ/nango/pull/8204) awaits maintainer review |
| Activepieces | [activepieces/](activepieces/) | API-key connection, inbox and email actions, received-email polling trigger | [Custom-piece preview](https://github.com/sentfromai/integrations/releases/tag/activepieces-v0.0.2) with [installation guide](activepieces/INSTALL.md); 21 checks pass, including extracted-archive regression tests; hosted installation pending |

These packages are under development. A successful local build is not marketplace verification. Each platform directory documents its installation steps, remaining live tests and limitations.

## Documentation and support

- [SentFromAI website](https://sentfrom.ai)
- [API reference](https://docs.sentfrom.ai/api-reference/introduction)
- [Account console and API keys](https://console.sentfrom.ai/keys)
- [Official MCP integration](https://github.com/sentfromai/sentfromai-mcp) — hosted endpoint verified with 21 tools
- [Docker MCP registry contribution](https://github.com/docker/mcp-registry/pull/6814) — draft upstream submission, not a catalog listing
- Product support: [support@sentfrom.ai](mailto:support@sentfrom.ai)

Use dedicated test accounts for connector validation. Sending and replying deliver real email; credentials belong in each platform's protected connection settings. Send and reply support a stable `client_id` for identical retries. Preserve the original key after an uncertain result; a new key can send another email.

## Development

The n8n, Zapier, and Activepieces packages use independent npm lockfiles and mocked HTTP tests. Make provides a dependency-free API-contract check. Nango's provider contribution is validated against its upstream schema. See each directory for exact commands.

Copyright 2026 Brightboard AI Ltd. Connector source is MIT licensed; SentFromAI branding remains the property of its owner. Platform names are trademarks of their respective owners.
