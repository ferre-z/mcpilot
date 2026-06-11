/**
 * In-memory unified registry of all MCP servers known to MCPilot.
 *
 * The registry is the single source of truth that the dashboard API
 * routes query. It is rebuilt from the scanner on demand — there is
 * no persistent state. For MVP this is a plain object; later we
 * could add change detection / file watching here.
 */

import { scanAllConfigs, type ScanOptions } from './scanner.js';
import {
  tokenizeServers,
  type TokenizeResult,
  type TokenizeOptions,
} from './tokenizer.js';
import type {
  McpServerConfig,
  McpServerStats,
  ScanResult,
  StatsResult,
} from './types.js';

export interface RegistrySnapshot {
  scan: ScanResult;
  stats: StatsResult;
  builtAt: number;
}

export interface BuildOptions {
  scan?: ScanOptions;
  tokenize?: TokenizeOptions;
}

/**
 * Build a fresh snapshot — scan + tokenize — and return the unified view.
 */
export async function buildSnapshot(opts: BuildOptions = {}): Promise<RegistrySnapshot> {
  const scan = await scanAllConfigs(opts.scan ?? {});
  const results = await tokenizeServers(
    scan.servers,
    opts.tokenize ?? {},
  );

  const stats: McpServerStats[] = results.map((r: TokenizeResult) => ({
    server: r.server,
    tools: r.tools,
    totalTokens: r.totalTokens,
    percentOfContext: r.percentOfContext,
    status: r.status,
    ...(r.error ? { error: r.error } : {}),
  }));

  const contextWindowSize = opts.tokenize?.contextWindow ?? 200_000;
  const totalTokens = stats.reduce((s, x) => s + x.totalTokens, 0);
  const totalTools = stats.reduce((s, x) => s + x.tools.length, 0);

  return {
    scan,
    stats: {
      servers: stats,
      totalTokens,
      totalTools,
      contextWindowSize,
      percentUsed: contextWindowSize > 0 ? (totalTokens / contextWindowSize) * 100 : 0,
    },
    builtAt: Date.now(),
  };
}

/** Lightweight in-process cache for the dashboard — TTL-bounded. */
let cachedSnapshot: { snapshot: RegistrySnapshot; expiresAt: number } | null = null;
const DEFAULT_TTL_MS = 30_000;

export async function getCachedSnapshot(
  ttlMs = DEFAULT_TTL_MS,
  opts: BuildOptions = {},
): Promise<RegistrySnapshot> {
  const now = Date.now();
  if (cachedSnapshot && cachedSnapshot.expiresAt > now) {
    return cachedSnapshot.snapshot;
  }
  const snapshot = await buildSnapshot(opts);
  cachedSnapshot = { snapshot, expiresAt: now + ttlMs };
  return snapshot;
}

/** Invalidate the cache. Useful for the dashboard after a mutation. */
export function invalidate(): void {
  cachedSnapshot = null;
}
