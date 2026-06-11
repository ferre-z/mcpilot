/**
 * `mcpilot list` — list every discovered server and (if reachable) its tools.
 * Uses the registry snapshot so output stays consistent across commands.
 */

import { buildSnapshot } from '@mcpilot/core';
import { c, fmtTokens, newTable, appLabel } from '../utils/output.js';

export interface ListOptions {
  cwd?: string;
  home?: string;
  /** When true, only show servers (skip tool rows). */
  serversOnly?: boolean;
  json?: boolean;
}

export async function listCommand(opts: ListOptions = {}): Promise<void> {
  const snapshot = await buildSnapshot({
    scan: { cwd: opts.cwd, home: opts.home },
  });

  if (opts.json) {
    console.log(JSON.stringify(snapshot.stats.servers, null, 2));
    return;
  }

  if (snapshot.stats.servers.length === 0) {
    console.log(`${c.yellow('No MCP servers found.')} Run ${c.cyan('mcpilot scan')} to see where we looked.`);
    return;
  }

  const table = newTable(['Server', 'App', 'Status', 'Transport', 'Tools', 'Tokens']);
  for (const s of snapshot.stats.servers) {
    const statusColor =
      s.status === 'connected'
        ? c.green('● connected')
        : s.status === 'error'
          ? c.red(`● error`)
          : s.status === 'disabled'
            ? c.gray('○ disabled')
            : c.yellow('● unknown');
    const tools = s.tools.length > 0 ? String(s.tools.length) : c.dim('—');
    const tokens = s.totalTokens > 0 ? fmtTokens(s.totalTokens) : c.dim('—');
    table.push([
      s.server.name,
      appLabel(s.server.sourceApp),
      statusColor,
      s.server.transport,
      tools,
      tokens,
    ]);
  }
  console.log(table.toString());

  if (!opts.serversOnly) {
    const withTools = snapshot.stats.servers.filter((s) => s.tools.length > 0);
    if (withTools.length > 0) {
      console.log();
      console.log(c.bold('Tools:'));
      for (const s of withTools) {
        console.log(`  ${c.cyan(s.server.name)} ${c.dim(`(${s.tools.length})`)}`);
        for (const t of s.tools) {
          const truncated = t.description.length > 60 ? `${t.description.slice(0, 57)}…` : t.description;
          console.log(`    ${c.dim('•')} ${t.name} ${c.dim(`— ${truncated}`)}`);
        }
      }
    }
  }

  const errored = snapshot.stats.servers.filter((s) => s.status === 'error');
  if (errored.length > 0) {
    console.log();
    console.log(c.yellow(`${errored.length} server(s) could not be reached:`));
    for (const s of errored) {
      console.log(`  ${c.red('✗')} ${s.server.name}: ${c.dim(s.error ?? 'unknown error')}`);
    }
  }
}
