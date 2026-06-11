/**
 * Shared terminal formatting helpers for the CLI.
 *
 * Centralizes chalk / cli-table3 setup so each command stays terse.
 */

import chalk from 'chalk';
import Table from 'cli-table3';

const chalkAny = chalk as unknown as { supportsColor?: boolean };

if (chalkAny.supportsColor === false) {
  // Force colors when output is piped (used in CI / scripts).
  // chalk v5 detects TTY by default; this is the documented escape hatch.
  Object.assign(chalk, new chalk.constructor({ level: 1 }));
}

export const c = {
  ok: chalk.green('✓'),
  warn: chalk.yellow('!'),
  err: chalk.red('✗'),
  dim: chalk.dim,
  bold: chalk.bold,
  cyan: chalk.cyan,
  yellow: chalk.yellow,
  red: chalk.red,
  green: chalk.green,
  gray: chalk.gray,
  magenta: chalk.magenta,
  blue: chalk.blue,
};

/** Format a token count with thousands separator. */
export function fmtTokens(n: number): string {
  return n.toLocaleString('en-US');
}

/** Format a percentage to one decimal place. */
export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

/** Build a small horizontal bar for token usage. */
export function tokenBar(pct: number, width = 20): string {
  const filled = Math.min(width, Math.max(0, Math.round((pct / 100) * width)));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export function newTable(headers: string[]): Table.Table {
  return new Table({
    head: headers.map((h) => c.bold(h)),
    style: { head: [], border: [] },
  });
}

export function appLabel(app: string): string {
  switch (app) {
    case 'claude':
      return c.cyan('claude');
    case 'cursor':
      return c.magenta('cursor');
    case 'vscode':
      return c.blue('vscode');
    case 'project':
      return c.green('project');
    default:
      return c.gray('unknown');
  }
}
