# API reference

## CLI

All commands accept global flags:

| Flag | Description |
|---|---|
| `--cwd <path>` | Working directory for `.mcp.json` lookup. Defaults to `process.cwd()`. |
| `--home <path>` | Override `$HOME` for the scanner. Defaults to the user's actual home. |
| `--json` | Emit machine-readable JSON instead of a pretty table. |

### `mcpilot scan`

Discover all MCP config files and show a summary table.

```bash
mcpilot scan [--json]
```

Output: `ScanResult` JSON (see below).

### `mcpilot list`

List every discovered server and (if reachable) its tools.

```bash
mcpilot list [--servers-only] [--json]
```

Output: `McpServerStats[]` JSON.

### `mcpilot stats`

Show a per-tool token-cost leaderboard. Connects to every server.

```bash
mcpilot stats [--context <n>] [--top <n>] [--json]
```

- `--context <n>` — model context window size in tokens. Default `200000`.
- `--top <n>` — show only the top N tools. Default `20`.

Output: `StatsResult` JSON.

### `mcpilot proxy start`

Start the in-process proxy cache (MVP). For v0.2 this becomes a full JSON-RPC proxy.

```bash
mcpilot proxy start [--port <n>]
```

### `mcpilot dashboard`

Launch the Next.js dev server.

```bash
mcpilot dashboard [--port <n>] [--detach]
```

## HTTP API (dashboard)

The dashboard exposes the following routes. All return JSON.

### `GET /api/servers`

Fast scan — no live MCP connection. Returns the list of discovered servers.

**Response:** [`ScanResult`](#scanresult)

### `GET /api/stats`

Full snapshot — scan + token accounting. Cached for 30s.

**Response:** [`StatsSnapshot`](#statssnapshot)

### `GET /api/proxy`

Return the in-process proxy cache state.

**Response:**

```ts
{
  mode: 'in-process-cache',
  cacheSize: number,
  cacheTtlMs: number,
  description: string,
}
```

## Types

### `ScanResult`

```ts
interface ScanResult {
  configFiles: Array<{ path: string; app: SourceApp; serverCount: number }>;
  servers: McpServerConfig[];
}
```

### `StatsSnapshot`

```ts
interface StatsSnapshot {
  stats: StatsResult;
  configFiles: Array<{ path: string; app: SourceApp; serverCount: number }>;
  builtAt: number; // epoch ms
}
```

### `McpServerConfig`

```ts
interface McpServerConfig {
  name: string;
  source: string;
  sourceApp: 'claude' | 'cursor' | 'vscode' | 'project' | 'unknown';
  transport: 'stdio' | 'sse' | 'streamable-http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;  // values are redacted to '<redacted>'
  enabled: boolean;
}
```

### `McpTool`

```ts
interface McpTool {
  serverName: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  tokenCount: number;
}
```

### `StatsResult`

```ts
interface StatsResult {
  servers: McpServerStats[];
  totalTokens: number;
  totalTools: number;
  contextWindowSize: number;
  percentUsed: number;
}
```
