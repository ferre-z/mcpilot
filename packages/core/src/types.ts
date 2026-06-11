/**
 * Shared TypeScript types for MCPilot.
 *
 * These represent the unified data model that flows between the scanner,
 * the registry, the tokenizer, the CLI, and the web dashboard.
 */

export type SourceApp = 'claude' | 'cursor' | 'vscode' | 'project' | 'unknown';

export type Transport = 'stdio' | 'sse' | 'streamable-http';

export type ServerStatus = 'connected' | 'error' | 'unknown' | 'disabled';

/**
 * A unified representation of a single MCP server entry discovered in
 * one of the host application config files.
 */
export interface McpServerConfig {
  name: string;
  source: string;
  sourceApp: SourceApp;
  transport: Transport;
  command?: string;
  args?: string[];
  url?: string;
  /** Env var names referenced (values are NOT stored; only the keys for redaction awareness). */
  env?: Record<string, string>;
  enabled: boolean;
}

/**
 * A tool exposed by an MCP server, with token accounting attached.
 */
export interface McpTool {
  serverName: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Tokens consumed by this tool's name + description + input schema JSON. */
  tokenCount: number;
}

/**
 * Per-server statistics — the tool list, the aggregate token cost, and the
 * connection status after attempting to talk to the server.
 */
export interface McpServerStats {
  server: McpServerConfig;
  tools: McpTool[];
  totalTokens: number;
  /** Percentage of the configured context window consumed by this server's tools. */
  percentOfContext: number;
  status: ServerStatus;
  error?: string;
}

export interface ConfigFileSummary {
  path: string;
  app: SourceApp;
  serverCount: number;
}

export interface ScanResult {
  configFiles: ConfigFileSummary[];
  servers: McpServerConfig[];
}

export interface StatsResult {
  servers: McpServerStats[];
  totalTokens: number;
  totalTools: number;
  contextWindowSize: number;
  percentUsed: number;
}

export interface ProxyInvocation {
  server: string;
  tool: string;
  timestamp: number;
  durationMs: number;
  ok: boolean;
  error?: string;
}
