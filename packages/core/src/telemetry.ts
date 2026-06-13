import { appendFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { ProxyInvocation } from './types.js';

const TELEMETRY_DIR = join(homedir(), '.mcpilot');
const LOG_PATH = join(TELEMETRY_DIR, 'telemetry.jsonl');

/** Ensure that the ~/.mcpilot directory exists. */
async function ensureDir(): Promise<void> {
  if (!existsSync(TELEMETRY_DIR)) {
    await mkdir(TELEMETRY_DIR, { recursive: true });
  }
}

/** Append a single proxy invocation record to the telemetry file. */
export async function logInvocation(invocation: ProxyInvocation): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(invocation) + '\n';
    await appendFile(LOG_PATH, line, 'utf8');
  } catch (err) {
    console.error(`[mcpilot] failed to write telemetry log: ${(err as Error).message}`);
  }
}

/** Retrieve the most recent tool call invocation records. */
export async function getInvocations(limit = 100): Promise<ProxyInvocation[]> {
  try {
    if (!existsSync(LOG_PATH)) {
      return [];
    }
    const content = await readFile(LOG_PATH, 'utf8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    const invocations: ProxyInvocation[] = [];
    
    // Parse lines in reverse order to get the most recent ones first
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(lines[i]!) as ProxyInvocation;
        invocations.push(parsed);
        if (invocations.length >= limit) {
          break;
        }
      } catch {
        // Skip malformed lines
      }
    }
    return invocations;
  } catch (err) {
    console.error(`[mcpilot] failed to read telemetry log: ${(err as Error).message}`);
    return [];
  }
}
