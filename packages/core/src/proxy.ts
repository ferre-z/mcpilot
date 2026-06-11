/**
 * MCP proxy with `tools/list` response caching.
 *
 * Stretch goal for the MVP — exposes a simple `ProxyCache` that the CLI
 * `proxy start` command can use, and a function for in-process tool-list
 * truncation. A full stdio/SSE proxy server is intentionally out of scope
 * for the MVP; the cache + truncate primitives are reusable building blocks.
 */

import type { McpTool } from './types.js';

interface CacheEntry {
  tools: McpTool[];
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1_000; // 5 min per spec.

export class ProxyCache {
  private store = new Map<string, CacheEntry>();

  constructor(private ttlMs: number = DEFAULT_TTL_MS) {}

  key(serverName: string, hash: string): string {
    return `${serverName}::${hash}`;
  }

  get(k: string): McpTool[] | null {
    const entry = this.store.get(k);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(k);
      return null;
    }
    return entry.tools;
  }

  set(k: string, tools: McpTool[]): void {
    this.store.set(k, { tools, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

/** Default shared cache instance for in-process use. */
export const sharedCache = new ProxyCache();

/**
 * Truncate long tool descriptions to fit a target token budget.
 * Keeps the tool name and the head of the description; cuts with an
 * ellipsis marker so callers know it was shortened.
 */
export function truncateTools(
  tools: McpTool[],
  options: { maxDescriptionTokens?: number; maxTotalTokens?: number } = {},
): McpTool[] {
  const maxDesc = options.maxDescriptionTokens ?? 120;
  const maxTotal = options.maxTotalTokens ?? Number.POSITIVE_INFINITY;

  let running = 0;
  const out: McpTool[] = [];
  for (const t of tools) {
    if (running >= maxTotal) break;
    const approxDescTokens = Math.ceil((t.description?.length ?? 0) / 4);
    const truncated = approxDescTokens > maxDesc;
    const desc = truncated
      ? `${t.description.slice(0, maxDesc * 4).trimEnd()}… [truncated]`
      : t.description;
    const newCount = Math.min(t.tokenCount, maxDesc * 4 / 4 + (t.name.length / 4));
    running += newCount;
    out.push({ ...t, description: desc, tokenCount: newCount });
  }
  return out;
}
