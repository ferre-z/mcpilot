/**
 * `mcpilot` — top-level CLI entry. Uses commander for parsing.
 *
 * Commands: scan, list, stats, proxy, dashboard.
 * Run with: `npx tsx packages/cli/src/index.ts <command>`
 * Or after build: `npx mcpilot <command>`
 */

import { Command } from 'commander';
import { c } from './utils/output.js';
import { scanCommand } from './commands/scan.js';
import { listCommand } from './commands/list.js';
import { statsCommand } from './commands/stats.js';
import { proxyStartCommand } from './commands/proxy.js';
import { dashboardCommand } from './commands/dashboard.js';

const program = new Command();
program
  .name('mcpilot')
  .description('Take control of your MCP stack — manage, monitor, and optimize all your MCP servers from one place')
  .version('0.1.0');

program
  .command('scan')
  .description('Scan for MCP config files and show a summary table')
  .option('--cwd <path>', 'working directory to scan for .mcp.json', process.cwd())
  .option('--home <path>', 'override $HOME for the scanner')
  .option('--json', 'emit machine-readable JSON')
  .action(async (opts: { cwd?: string; home?: string; json?: boolean }) => {
    try {
      await scanCommand({ cwd: opts.cwd, home: opts.home, json: opts.json });
    } catch (err) {
      console.error(c.red(`scan failed: ${(err as Error).message}`));
      process.exitCode = 1;
    }
  });

program
  .command('list')
  .description('List all discovered MCP servers and their tools')
  .option('--cwd <path>', 'working directory to scan for .mcp.json', process.cwd())
  .option('--home <path>', 'override $HOME for the scanner')
  .option('--json', 'emit machine-readable JSON')
  .option('--servers-only', 'skip the per-tool breakdown')
  .action(async (opts) => {
    try {
      await listCommand(opts);
    } catch (err) {
      console.error(c.red(`list failed: ${(err as Error).message}`));
      process.exitCode = 1;
    }
  });

program
  .command('stats')
  .description('Show token cost leaderboard (connects to each MCP server)')
  .option('-c, --context <tokens>', 'model context window in tokens', (v) => parseInt(v, 10))
  .option('--cwd <path>', 'working directory to scan for .mcp.json', process.cwd())
  .option('--home <path>', 'override $HOME for the scanner')
  .option('--json', 'emit machine-readable JSON')
  .option('--top <n>', 'show top N tools in the leaderboard', (v) => parseInt(v, 10))
  .action(async (opts) => {
    try {
      await statsCommand(opts);
    } catch (err) {
      console.error(c.red(`stats failed: ${(err as Error).message}`));
      process.exitCode = 1;
    }
  });

const proxy = program
  .command('proxy')
  .description('Start the optimization proxy');

proxy
  .command('start')
  .description('Start the proxy (in-process cache for MVP)')
  .option('-p, --port <port>', 'port to listen on', (v) => parseInt(v, 10))
  .action(async (opts: { port?: number }) => {
    try {
      await proxyStartCommand(opts);
    } catch (err) {
      console.error(c.red(`proxy failed: ${(err as Error).message}`));
      process.exitCode = 1;
    }
  });

program
  .command('dashboard')
  .alias('ui')
  .description('Launch the web dashboard')
  .option('-p, --port <port>', 'port for the dev server', (v) => parseInt(v, 10))
  .option('-d, --detach', 'return immediately after starting the dev server')
  .action(async (opts) => {
    try {
      await dashboardCommand(opts);
    } catch (err) {
      console.error(c.red(`dashboard failed: ${(err as Error).message}`));
      process.exitCode = 1;
    }
  });

await program.parseAsync(process.argv);
