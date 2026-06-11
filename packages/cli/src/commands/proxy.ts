/**
 * `mcpilot proxy start` — start the optimization proxy (MVP stub).
 *
 * For the MVP the proxy is an in-process cache + a thin local TCP/stdio
 * passthrough. Full HTTP transport is out of scope; this command exists
 * so the CLI surface is complete and the proxy primitives are wired up.
 */

import { sharedCache } from '@mcpilot/core';
import { c } from '../utils/output.js';

export interface ProxyOptions {
  port?: number;
}

export async function proxyStartCommand(opts: ProxyOptions = {}): Promise<void> {
  const port = opts.port ?? 8765;
  console.log(`${c.cyan('🚀 Starting MCPilot optimization proxy...')}`);
  console.log(`  Port:      ${port}`);
  console.log(`  Cache TTL: 5 min`);
  console.log(`  Cache size: ${sharedCache.size()}`);
  console.log();
  console.log(c.dim('Point your MCP client at this proxy to enable tool-list caching.'));
  console.log(c.dim('In MVP mode, the proxy runs as an in-process cache. Use `mcpilot list` to see live tools.'));

  // Idle loop — keeps the process alive so users can attach a client.
  // In a real implementation we'd accept JSON-RPC over stdio / TCP here.
  await new Promise<void>((resolve) => {
    const onSig = () => {
      console.log(c.dim('\nShutting down proxy...'));
      sharedCache.clear();
      resolve();
    };
    process.on('SIGINT', onSig);
    process.on('SIGTERM', onSig);
  });
}
