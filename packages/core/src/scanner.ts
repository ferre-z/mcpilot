/**
 * Defensive scanner for MCP config files across Claude Code, Cursor, VS Code,
 * and project-level `.mcp.json` files.
 *
 * Every read is wrapped in try/catch — a missing or malformed file is a no-op,
 * not a crash. The scanner ALWAYS returns a `ScanResult` with the files it
 * successfully parsed.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type {
  ConfigFileSummary,
  McpServerConfig,
  ScanResult,
  SourceApp,
  Transport,
} from './types.js';

/** Path expansion — supports `~` and `$HOME` and `~/<rest>`. */
export function expandHome(p: string): string {
  if (p.startsWith('~')) return join(homedir(), p.slice(1));
  if (p.startsWith('$HOME')) return join(homedir(), p.slice('$HOME'.length));
  return p;
}

/** A loose stdio config schema — different apps use slightly different keys. */
const StdioConfigSchema = z
  .object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
  })
  .passthrough();

/** A remote transport config schema. */
const RemoteConfigSchema = z
  .object({
    url: z.string().optional(),
    type: z.string().optional(),
    transport: z.string().optional(),
  })
  .passthrough();

/** A single server entry as it appears in a config file. */
const ServerEntrySchema = z
  .object({
    type: z.string().optional(),
    transport: z.string().optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    url: z.string().optional(),
    env: z.record(z.string()).optional(),
    enabled: z.boolean().optional(),
    disabled: z.boolean().optional(),
  })
  .passthrough();

/** Detects transport from a server entry, defaulting to stdio for command-shaped configs. */
function detectTransport(entry: z.infer<typeof ServerEntrySchema>): Transport {
  const raw = (entry.transport ?? entry.type ?? '').toLowerCase();
  if (raw.includes('streamable')) return 'streamable-http';
  if (raw === 'sse' || raw.includes('sse')) return 'sse';
  if (raw === 'http' || raw.includes('http')) return 'streamable-http';
  if (entry.url) return 'streamable-http';
  return 'stdio';
}

/**
 * Map a raw JSON server entry into a normalized `McpServerConfig`.
 * All string fields are trimmed; missing fields are left undefined.
 */
function normalizeServer(
  name: string,
  raw: unknown,
  sourcePath: string,
  app: SourceApp,
): McpServerConfig | null {
  const parsed = ServerEntrySchema.safeParse(raw);
  if (!parsed.success) return null;
  const entry = parsed.data;

  const transport = detectTransport(entry);
  const stdioCheck = StdioConfigSchema.safeParse(entry);
  const remoteCheck = RemoteConfigSchema.safeParse(entry);

  const env: Record<string, string> = {};
  if (entry.env) {
    for (const [k, v] of Object.entries(entry.env)) env[k] = '<redacted>';
  }
  // Also pick up env references baked into the command line, e.g. `${GITHUB_TOKEN}`.
  const combined = `${entry.command ?? ''} ${(entry.args ?? []).join(' ')}`;
  const envRefs = combined.matchAll(/\$\{?([A-Z_][A-Z0-9_]*)\}?/g);
  for (const m of envRefs) {
    if (!env[m[1]!]) env[m[1]!] = '<redacted>';
  }

  // disabled: true in Cursor maps to enabled: false.
  const enabled = !(entry.disabled === true) && (entry.enabled ?? true);

  const config: McpServerConfig = {
    name: name.trim(),
    source: sourcePath,
    sourceApp: app,
    transport,
    enabled,
  };

  if (stdioCheck.success && entry.command) {
    config.command = entry.command;
    if (entry.args) config.args = entry.args;
  }
  if (remoteCheck.success && entry.url) {
    config.url = entry.url;
  }
  if (Object.keys(env).length > 0) config.env = env;

  return config;
}

/**
 * Best-effort read of a JSON config file. Returns `null` if the file is
 * missing, unreadable, or not valid JSON.
 */
async function readJsonSafe(path: string): Promise<unknown | null> {
  try {
    if (!existsSync(path)) return null;
    const text = await readFile(path, 'utf8');
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Extract a `{ name: entry }` map from a parsed config blob for a given key. */
function extractServersMap(
  blob: unknown,
  key: string,
): Record<string, unknown> | null {
  if (!blob || typeof blob !== 'object') return null;
  const obj = blob as Record<string, unknown>;
  const candidate = obj[key];
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    return candidate as Record<string, unknown>;
  }
  return null;
}

/**
 * Scan a single config file and return the servers found there.
 * Always returns an array; never throws.
 */
async function scanConfigFile(
  path: string,
  app: SourceApp,
  keysToTry: string[],
): Promise<McpServerConfig[]> {
  const blob = await readJsonSafe(path);
  if (!blob) return [];

  // Try each candidate key in order (some apps store the map under multiple aliases).
  let raw: Record<string, unknown> | null = null;
  for (const k of keysToTry) {
    raw = extractServersMap(blob, k);
    if (raw) break;
  }
  if (!raw) return [];

  const out: McpServerConfig[] = [];
  for (const [name, entry] of Object.entries(raw)) {
    const norm = normalizeServer(name, entry, path, app);
    if (norm) out.push(norm);
  }
  return out;
}

/** Default config file layout. Override via the `cwd` and `home` options. */
export interface ScanOptions {
  cwd?: string;
  home?: string;
  /** Extra config file paths to scan in addition to the well-known locations. */
  extraPaths?: string[];
}

const DEFAULT_HOME = () => homedir();
const DEFAULT_CWD = () => process.cwd();

/** Resolve the canonical list of config file locations to scan. */
export function resolveConfigPaths(opts: ScanOptions = {}): Array<{
  path: string;
  app: SourceApp;
  keys: string[];
}> {
  const home = opts.home ?? DEFAULT_HOME();
  const cwd = opts.cwd ?? DEFAULT_CWD();

  return [
    {
      path: join(home, '.claude', 'settings.json'),
      app: 'claude',
      keys: ['mcpServers'],
    },
    {
      path: join(home, '.claude', 'mcp_servers.json'),
      app: 'claude',
      keys: ['mcpServers', 'servers'],
    },
    {
      path: join(home, '.cursor', 'mcp.json'),
      app: 'cursor',
      keys: ['mcpServers'],
    },
    {
      path: join(home, '.vscode', 'settings.json'),
      app: 'vscode',
      keys: ['mcp.servers'],
    },
    {
      path: join(cwd, '.mcp.json'),
      app: 'project',
      keys: ['mcpServers', 'servers'],
    },
  ];
}

/**
 * Scan all well-known MCP config locations and return a unified result.
 * The scan never throws — missing or invalid files are silently skipped.
 */
export async function scanAllConfigs(opts: ScanOptions = {}): Promise<ScanResult> {
  const locations = resolveConfigPaths(opts);
  const configFiles: ConfigFileSummary[] = [];
  const servers: McpServerConfig[] = [];

  for (const loc of locations) {
    const found = await scanConfigFile(loc.path, loc.app, loc.keys);
    if (found.length > 0) {
      configFiles.push({ path: loc.path, app: loc.app, serverCount: found.length });
      servers.push(...found);
    }
  }

  // User-supplied extras (e.g. a path to a Codex or Windsurf config).
  for (const extra of opts.extraPaths ?? []) {
    const found = await scanConfigFile(expandHome(extra), 'unknown', [
      'mcpServers',
      'servers',
      'mcp.servers',
    ]);
    if (found.length > 0) {
      configFiles.push({
        path: expandHome(extra),
        app: 'unknown',
        serverCount: found.length,
      });
      servers.push(...found);
    }
  }

  return { configFiles, servers };
}
