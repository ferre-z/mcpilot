/**
 * `mcpilot dashboard` — launch the web dashboard.
 *
 * By default we exec `npm run dev` inside `packages/dashboard`. The user
 * can override with `--port` or `--detach`.
 */

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { c } from '../utils/output.js';

export interface DashboardOptions {
  port?: number;
  detach?: boolean;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');
const dashboardDir = resolve(repoRoot, 'packages', 'dashboard');

export async function dashboardCommand(opts: DashboardOptions = {}): Promise<void> {
  const port = opts.port ?? 3000;
  console.log(`${c.cyan('🖥  Launching MCPilot dashboard...')}`);
  console.log(`  Directory: ${dashboardDir}`);
  console.log(`  Port:      ${port}`);
  console.log(`  URL:       ${c.cyan(`http://localhost:${port}`)}`);
  console.log();

  const child = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
    cwd: dashboardDir,
    stdio: 'inherit',
    env: { ...process.env, MCPILOT_PORT: String(port) },
  });

  const exit = new Promise<number>((resolveExit) => {
    child.on('exit', (code) => resolveExit(code ?? 0));
  });

  if (opts.detach) {
    console.log(c.dim(`Detached. Dashboard running with PID ${child.pid}.`));
    return;
  }

  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));

  const code = await exit;
  if (code !== 0) {
    console.error(c.red(`Dashboard exited with code ${code}.`));
    process.exitCode = code;
  }
}
