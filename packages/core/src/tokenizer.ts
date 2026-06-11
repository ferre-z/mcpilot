/**
 * Token accounting for MCP tool definitions.
 *
 * Uses `js-tiktoken` with the `cl100k_base` encoding (the same encoding used
 * by Claude / GPT-4 family tokenizers for approximation purposes — exact
 * counts vary by model but the relative magnitudes are correct).
 *
 * For each tool we count: name + description + serialized input schema.
 * That matches what an LLM actually sees in its system prompt.
 */

import { getEncoding, type Tiktoken } from 'js-tiktoken';
import type { McpServerConfig, McpTool } from './types.js';

let cachedEncoder: Tiktoken | null = null;
function encoder(): Tiktoken {
  if (!cachedEncoder) cachedEncoder = getEncoding('cl100k_base');
  return cachedEncoder;
}

/** Count tokens for an arbitrary string. */
export function countTokens(text: string): number {
  if (!text) return 0;
  try {
    return encoder().encode(text).length;
  } catch {
    // Fallback: rough heuristic if tiktoken blows up.
    return Math.ceil(text.length / 4);
  }
}

/** Count tokens for a tool's full description (name + description + input schema). */
export function countToolTokens(tool: {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}): number {
  // We mimic the way tool definitions are typically serialized into a model prompt.
  const serialized = JSON.stringify({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  });
  return countTokens(serialized);
}

/**
 * Per-server tool discovery + token accounting.
 *
 * Connects to each server via the MCP SDK, lists its tools, and computes
 * token counts. Failures are captured in `status: 'error'` rather than
 * thrown — the dashboard and CLI should still render partial results.
 */
export interface TokenizeOptions {
  /** Model context window size in tokens. Defaults to 200_000 (Claude). */
  contextWindow?: number;
  /** Per-server connection timeout in ms. Defaults to 5_000. */
  timeoutMs?: number;
}

export interface TokenizeResult {
  server: McpServerConfig;
  tools: McpTool[];
  totalTokens: number;
  percentOfContext: number;
  status: 'connected' | 'error' | 'unknown' | 'disabled';
  error?: string;
}

/**
 * Build a tool list with token counts but WITHOUT connecting to a live server.
 * Useful for the scanner/CLI when we only have config and want a fast estimate
 * (token count = 0 because we have no tool metadata yet — call `attachToolTokens`
 * to enrich with live data).
 */
export function emptyStats(server: McpServerConfig, contextWindow = 200_000): TokenizeResult {
  return {
    server,
    tools: [],
    totalTokens: 0,
    percentOfContext: 0,
    status: 'unknown',
  };
}

/**
 * Connect to a single MCP server, list its tools, and compute token stats.
 * Returns an `error` status on failure — never throws.
 */
export async function tokenizeServer(
  server: McpServerConfig,
  opts: TokenizeOptions = {},
): Promise<TokenizeResult> {
  if (!server.enabled) {
    return { ...emptyStats(server, opts.contextWindow), status: 'disabled' };
  }
  if (server.transport === 'stdio' && !server.command) {
    return {
      ...emptyStats(server, opts.contextWindow),
      status: 'error',
      error: 'stdio server missing command',
    };
  }
  if ((server.transport === 'sse' || server.transport === 'streamable-http') && !server.url) {
    return {
      ...emptyStats(server, opts.contextWindow),
      status: 'error',
      error: `${server.transport} server missing url`,
    };
  }

  const contextWindow = opts.contextWindow ?? 200_000;
  const timeoutMs = opts.timeoutMs ?? 5_000;

  // We import the SDK lazily so a CLI invocation that doesn't need live
  // connection (e.g. `mcpilot scan`) doesn't pay the cost.
  let Client: unknown;
  let StdioClientTransport: unknown;
  let SSEClientTransport: unknown;
  let StreamableHTTPClientTransport: unknown;
  try {
    const sdk = await import('@modelcontextprotocol/sdk/client/index.js');
    Client = sdk.Client;
    const stdio = await import('@modelcontextprotocol/sdk/client/stdio.js');
    StdioClientTransport = stdio.StdioClientTransport;
    try {
      const sse = await import('@modelcontextprotocol/sdk/client/sse.js');
      SSEClientTransport = sse.SSEClientTransport;
    } catch {
      // Optional transport — older SDK versions may not export it.
    }
    try {
      const http = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
      StreamableHTTPClientTransport = http.StreamableHTTPClientTransport;
    } catch {
      // Optional transport.
    }
  } catch (err) {
    return {
      ...emptyStats(server, contextWindow),
      status: 'error',
      error: `MCP SDK not available: ${(err as Error).message}`,
    };
  }

  type AnyTransport = { close: () => Promise<void> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let transport: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = Client as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client = new Ctor({ name: 'mcpilot', version: '0.1.0' }, { capabilities: {} });

    if (server.transport === 'stdio' && StdioClientTransport) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const T = StdioClientTransport as any;
      transport = new T({
        command: server.command!,
        args: server.args ?? [],
        env: server.env && Object.keys(server.env).length > 0
          ? Object.fromEntries(
              Object.keys(server.env).map((k) => [k, process.env[k] ?? '']),
            )
          : undefined,
      });
    } else if (server.transport === 'sse' && SSEClientTransport) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const T = SSEClientTransport as any;
      transport = new T(new URL(server.url!));
    } else if (server.transport === 'streamable-http' && StreamableHTTPClientTransport) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const T = StreamableHTTPClientTransport as any;
      transport = new T(new URL(server.url!));
    } else {
      return {
        ...emptyStats(server, contextWindow),
        status: 'error',
        error: `transport "${server.transport}" not supported by installed MCP SDK`,
      };
    }

    await Promise.race([
      client.connect(transport as unknown as Parameters<typeof client.connect>[0]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('connect timeout')), timeoutMs),
      ),
    ]);

    const listed = await Promise.race([
      client.listTools(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('listTools timeout')), timeoutMs),
      ),
    ]);

    const tools: McpTool[] = (listed.tools ?? []).map((t: { name: string; description?: string; inputSchema?: Record<string, unknown> }) => {
      const description = t.description ?? '';
      const inputSchema = (t.inputSchema ?? {}) as Record<string, unknown>;
      return {
        serverName: server.name,
        name: t.name,
        description,
        inputSchema,
        tokenCount: countToolTokens({ name: t.name, description, inputSchema }),
      };
    });

    const total = tools.reduce((s, t) => s + t.tokenCount, 0);
    return {
      server,
      tools,
      totalTokens: total,
      percentOfContext: contextWindow > 0 ? (total / contextWindow) * 100 : 0,
      status: 'connected',
    };
  } catch (err) {
    return {
      ...emptyStats(server, contextWindow),
      status: 'error',
      error: (err as Error).message,
    };
  } finally {
    try {
      await client?.close();
    } catch {
      // ignore
    }
    try {
      await transport?.close();
    } catch {
      // ignore
    }
  }
}

/**
 * Tokenize an array of servers in parallel, with bounded concurrency.
 * Returns a `TokenizeResult` for every input server (errors included).
 */
export async function tokenizeServers(
  servers: McpServerConfig[],
  opts: TokenizeOptions = {},
  concurrency = 4,
): Promise<TokenizeResult[]> {
  const out: TokenizeResult[] = new Array(servers.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, servers.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= servers.length) return;
      out[idx] = await tokenizeServer(servers[idx]!, opts);
    }
  });
  await Promise.all(workers);
  return out;
}
