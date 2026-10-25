# Shipmail for Node.js

The official TypeScript SDK and CLI for the [Shipmail](https://shipmail.to) API.

| Package | npm | Docs |
| --- | --- | --- |
| [`shipmail`](packages/shipmail) | [![npm](https://img.shields.io/npm/v/shipmail.svg)](https://www.npmjs.com/package/shipmail) | [TypeScript SDK](https://shipmail.to/docs/sdks/typescript) |
| [`shipmail-cli`](packages/shipmail-cli) | [![npm](https://img.shields.io/npm/v/shipmail-cli.svg)](https://www.npmjs.com/package/shipmail-cli) | [CLI](https://shipmail.to/docs/cli) |

```sh
npm install shipmail
```

```ts
import { ShipmailClient } from "shipmail";

const shipmail = new ShipmailClient("sm_live_...");
```

See the [SDK README](packages/shipmail/README.md) for every resource and option.

Also available: [Python SDK](https://github.com/shipmail-to/shipmail-python) and
[MCP server](https://github.com/shipmail-to/shipmail-mcp).

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
