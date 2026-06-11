/**
 * `mcpilot stats` — token-cost leaderboard.
 *
 * Connects to every server via the MCP SDK, lists its tools, counts tokens
 * per tool using `cl100k_base`, and prints a ranked table.
 */

import { buildSnapshot } from '@mcpilot/core';
import { c, fmtPct, fmtTokens, newTable } from '../utils/output.js';

export interface StatsOptions {
  context?: number;
  cwd?: string;
  home?: string;
  json?: boolean;
  top?: number;
}

export async function statsCommand(opts: StatsOptions = {}): Promise<void> {
  const contextWindow = opts.context ?? 200_000;
  console.log(`${c.cyan('📊 Measuring token costs...')}\n`);

  const snapshot = await buildSnapshot({
    scan: { cwd: opts.cwd, home: opts.home },
    tokenize: { contextWindow, timeoutMs: 5_000 },
  });
  const { stats } = snapshot;

  if (opts.json) {
    console.log(JSON.stringify(snapshot.stats, null, 2));
    return;
  }

  if (stats.servers.length === 0) {
    console.log(c.yellow('No MCP servers found.'));
    return;
  }

  // Flatten to per-tool rows for the leaderboard.
  type Row = { server: string; tool: string; tokens: number; pct: number };
  const rows: Row[] = [];
  for (const s of stats.servers) {
    for (const t of s.tools) {
      const pct = contextWindow > 0 ? (t.tokenCount / contextWindow) * 100 : 0;
      rows.push({ server: s.server.name, tool: t.name, tokens: t.tokenCount, pct });
    }
  }
  rows.sort((a, b) => b.tokens - a.tokens);

  const table = newTable(['#', 'Server', 'Tool', 'Tokens', '% ctx', 'Bar']);
  const top = opts.top ?? 20;
  rows.slice(0, top).forEach((r, i) => {
    table.push([
      String(i + 1),
      r.server,
      r.tool,
      fmtTokens(r.tokens),
      fmtPct(r.pct),
      c.dim('█'.repeat(Math.min(20, Math.max(1, Math.round(r.pct * 4))))),
    ]);
  });
  console.log(table.toString());

  console.log();
  console.log(
    `${c.bold('Totals:')} ${fmtTokens(stats.totalTokens)} tokens across ${stats.totalTools} tools ` +
      `${c.dim(`(${fmtPct(stats.percentUsed)} of ${fmtTokens(contextWindow)} context)`)}`,
  );

  // Per-server summary
  console.log();
  const serverTable = newTable(['Server', 'Status', 'Tools', 'Tokens', '% ctx']);
  const sortedServers = [...stats.servers].sort((a, b) => b.totalTokens - a.totalTokens);
  for (const s of sortedServers) {
    const statusColor =
      s.status === 'connected'
        ? c.green('connected')
        : s.status === 'error'
          ? c.red('error')
          : s.status === 'disabled'
            ? c.gray('disabled')
            : c.yellow('unknown');
    serverTable.push([
      s.server.name,
      statusColor,
      String(s.tools.length || '—'),
      fmtTokens(s.totalTokens),
      fmtPct(s.percentOfContext),
    ]);
  }
  console.log(serverTable.toString());

  const errored = stats.servers.filter((s) => s.status === 'error');
  if (errored.length > 0) {
    console.log();
    console.log(c.yellow(`${errored.length} server(s) failed to connect:`));
    for (const s of errored) {
      console.log(`  ${c.red('✗')} ${s.server.name}: ${c.dim(s.error ?? 'unknown')}`);
    }
  }
}
