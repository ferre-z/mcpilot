/**
 * `mcpilot scan` — discover all MCP config files on the system and print
 * a summary table. Fast path: no live MCP connection. Uses the token
 * estimates from the tokenizer only when the user asks for `stats`.
 */

import { buildSnapshot } from '@mcpilot/core';
import { c, fmtPct, fmtTokens, newTable, appLabel } from '../utils/output.js';

export interface ScanOptions {
  cwd?: string;
  home?: string;
  json?: boolean;
}

export async function scanCommand(opts: ScanOptions = {}): Promise<void> {
  console.log(`${c.cyan('🔍 Scanning MCP configurations...')}\n`);

  const snapshot = await buildSnapshot({
    scan: { cwd: opts.cwd, home: opts.home },
    tokenize: { skipConnect: true },
  });
  const { scan, stats } = snapshot;

  if (opts.json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  if (scan.configFiles.length === 0) {
    console.log(`${c.yellow('No MCP config files found.')}`);
    console.log(c.dim('Looked in:'));
    console.log(c.dim('  ~/.claude/settings.json'));
    console.log(c.dim('  ~/.claude/mcp_servers.json'));
    console.log(c.dim('  ~/.cursor/mcp.json'));
    console.log(c.dim('  ~/.vscode/settings.json'));
    console.log(c.dim('  ./.mcp.json (cwd)'));
    process.exitCode = 0;
    return;
  }

  console.log(`${c.bold('Found')} ${scan.configFiles.length} ${c.bold('config file(s):')}`);
  for (const f of scan.configFiles) {
    console.log(`  ${c.ok} ${f.path}  ${c.dim(`(${appLabel(f.app)} · ${f.serverCount} server${f.serverCount === 1 ? '' : 's'})`)}`);
  }
  console.log();

  // Per-server table with token cost (taken from the registry snapshot).
  const table = newTable(['Server', 'App', 'Transport', 'Tools', 'Token Cost', 'Bar']);
  const contextWindow = stats.contextWindowSize;

  // Sort by token cost desc; fall back to name if no stats.
  const ordered = [...stats.servers].sort((a, b) => b.totalTokens - a.totalTokens);
  let totalTokens = 0;
  let totalTools = 0;

  for (const s of ordered) {
    totalTokens += s.totalTokens;
    totalTools += s.tools.length;
    const pct = contextWindow > 0 ? (s.totalTokens / contextWindow) * 100 : 0;
    const bar = s.status === 'connected'
      ? c.dim('█'.repeat(Math.min(20, Math.max(0, Math.round(pct * 4)))) + '░'.repeat(Math.max(0, 20 - Math.round(pct * 4))))
      : c.dim('─'.repeat(20));
    table.push([
      s.server.name,
      appLabel(s.server.sourceApp),
      s.server.transport,
      String(s.tools.length || '—'),
      `${fmtTokens(s.totalTokens)} ${c.dim(`(${fmtPct(pct)})`)}`,
      bar,
    ]);
  }
  // Bottom row: total
  const pct = contextWindow > 0 ? (totalTokens / contextWindow) * 100 : 0;
  table.push([
    c.bold('TOTAL'),
    '',
    '',
    c.bold(String(totalTools || scan.servers.length)),
    c.bold(`${fmtTokens(totalTokens)} (${fmtPct(pct)})`),
    '',
  ]);

  console.log(table.toString());
  console.log();

  if (stats.servers.length > 0) {
    const top = [...stats.servers]
      .filter((s) => s.totalTokens > 0)
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, 3);
    if (top.length > 0) {
      const list = top
        .map((s) => `${s.server.name} ${c.dim(`(${fmtPct(s.percentOfContext)})`)}`)
        .join(', ');
      console.log(`${c.yellow('💡')} ${c.bold('Top context hogs:')} ${list}`);
    } else {
      console.log(c.dim('Run `mcpilot stats` to connect to servers and measure token costs.'));
    }
  }
}
