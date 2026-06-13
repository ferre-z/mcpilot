/**
 * `mcpilot proxy` — proxy command implementation.
 * Includes `proxy start` (dashboard/caching) and `proxy run` (stdio wrapper).
 */

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { scanAllConfigs, logInvocation } from '@mcpilot/core';
import { c } from '../utils/output.js';

const CACHE_FILE = join(homedir(), '.mcpilot', 'cache.json');
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedEntry {
  tools: any[];
  expiresAt: number;
}

function getCachedTools(serverName: string): any[] | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const content = readFileSync(CACHE_FILE, 'utf8');
    const cache = JSON.parse(content) as Record<string, CachedEntry>;
    const entry = cache[serverName];
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      return null; // Expired
    }
    return entry.tools;
  } catch {
    return null;
  }
}

function setCachedTools(serverName: string, tools: any[]): void {
  try {
    const dir = join(homedir(), '.mcpilot');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    let cache: Record<string, CachedEntry> = {};
    if (existsSync(CACHE_FILE)) {
      const content = readFileSync(CACHE_FILE, 'utf8');
      try {
        cache = JSON.parse(content);
      } catch {
        // ignore
      }
    }
    cache[serverName] = {
      tools,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.error(`[mcpilot] failed to save tools cache: ${(err as Error).message}`);
  }
}

export interface ProxyOptions {
  port?: number;
}

export async function proxyStartCommand(opts: ProxyOptions = {}): Promise<void> {
  const port = opts.port ?? 8765;
  console.log(`${c.cyan('🚀 Starting MCPilot optimization proxy...')}`);
  console.log(`  Port:      ${port}`);
  console.log(`  Cache TTL: 5 min`);
  console.log();
  console.log(c.dim('Point your MCP client at this proxy to enable tool-list caching.'));

  await new Promise<void>((resolve) => {
    const onSig = () => {
      console.log(c.dim('\nShutting down proxy...'));
      resolve();
    };
    process.on('SIGINT', onSig);
    process.on('SIGTERM', onSig);
  });
}

export interface ProxyRunOptions {
  server: string;
  cwd?: string;
  home?: string;
}

export async function proxyRunCommand(opts: ProxyRunOptions): Promise<void> {
  const serverName = opts.server;
  const scan = await scanAllConfigs({ cwd: opts.cwd, home: opts.home });
  const server = scan.servers.find((s) => s.name === serverName);

  if (!server) {
    throw new Error(`Server "${serverName}" not found in scanned configurations.`);
  }

  if (server.transport !== 'stdio' || !server.command) {
    throw new Error(`Server "${serverName}" does not support stdio transport or has no command configured.`);
  }

  // Spawn the child MCP server process
  const child = spawn(server.command, server.args ?? [], {
    env: process.env,
    shell: true,
  });

  const pendingRequests = new Map<any, { method: string; toolName: string; start: number }>();

  // Set up process.stdin -> child.stdin readline interface
  const inputRl = createInterface({
    input: process.stdin,
    terminal: false,
  });

  // Set up child.stdout -> process.stdout readline interface
  const outputRl = createInterface({
    input: child.stdout,
    terminal: false,
  });

  // Handle errors / exit
  child.on('error', (err) => {
    process.stderr.write(`[mcpilot] child server process error: ${err.message}\n`);
  });

  child.on('close', (code) => {
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));

  // Forward child stderr to process stderr for visibility
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  // Handle client requests (process.stdin -> child.stdin)
  inputRl.on('line', (line) => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line);
      if (msg.method === 'tools/list') {
        const cached = getCachedTools(serverName);
        if (cached) {
          // Serve tools/list directly from cache
          const response = {
            jsonrpc: '2.0',
            id: msg.id,
            result: { tools: cached },
          };
          process.stdout.write(JSON.stringify(response) + '\n');
          logInvocation({
            server: serverName,
            tool: 'tools/list (Cache Hit)',
            timestamp: Date.now(),
            durationMs: 0,
            ok: true,
          }).catch(() => {});
          return; // Skip forwarding to child
        } else {
          pendingRequests.set(msg.id, { method: 'tools/list', toolName: '', start: Date.now() });
        }
      } else if (msg.method === 'tools/call') {
        pendingRequests.set(msg.id, {
          method: 'tools/call',
          toolName: msg.params?.name ?? 'unknown',
          start: Date.now(),
        });
      }
    } catch {
      // Pass-through raw line if not valid JSON
    }
    child.stdin.write(line + '\n');
  });

  // Handle server responses (child.stdout -> process.stdout)
  outputRl.on('line', async (line) => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pendingRequests.has(msg.id)) {
        const req = pendingRequests.get(msg.id)!;
        pendingRequests.delete(msg.id);

        if (req.method === 'tools/list' && msg.result?.tools) {
          // Cache the tools list
          setCachedTools(serverName, msg.result.tools);
          // Log Cache Miss
          await logInvocation({
            server: serverName,
            tool: 'tools/list (Cache Miss)',
            timestamp: Date.now(),
            durationMs: Date.now() - req.start,
            ok: true,
          });
        } else if (req.method === 'tools/call') {
          const durationMs = Date.now() - req.start;
          const ok = msg.result !== undefined && msg.error === undefined;
          const errorMsg = msg.error
            ? typeof msg.error === 'object'
              ? JSON.stringify(msg.error)
              : String(msg.error)
            : undefined;

          // Log tool call metrics to telemetry file
          await logInvocation({
            server: serverName,
            tool: req.toolName,
            timestamp: Date.now(),
            durationMs,
            ok,
            error: errorMsg,
          });
        }
      }
    } catch {
      // Pass-through raw line if not valid JSON
    }
    process.stdout.write(line + '\n');
  });
}
