'use client';

import type { StatsResult } from '@mcpilot/core';

/**
 * Counter shown at the top of the dashboard — total tools, total tokens,
 * percentage of the model context window consumed, and number of servers.
 */
export function SavingsCounter({ stats }: { stats: StatsResult }) {
  const pctUsed = stats.percentUsed.toFixed(1);
  const ctx = stats.contextWindowSize.toLocaleString();
  const erroredCount = stats.servers.filter((s) => s.status === 'error').length;

  return (
    <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Tile
        label="Servers"
        value={stats.servers.length.toString()}
        sub={erroredCount > 0 ? `${erroredCount} failed` : 'all online'}
        tone={erroredCount > 0 ? 'warn' : 'default'}
      />
      <Tile
        label="Tools"
        value={stats.totalTools.toString()}
        sub="discovered"
      />
      <Tile
        label="Tokens used"
        value={stats.totalTokens.toLocaleString()}
        sub={`of ${ctx} context`}
        tone={stats.percentUsed > 25 ? 'danger' : stats.percentUsed > 10 ? 'warn' : 'default'}
      />
      <Tile
        label="Context used"
        value={`${pctUsed}%`}
        sub="of window"
        tone={stats.percentUsed > 25 ? 'danger' : stats.percentUsed > 10 ? 'warn' : 'success'}
      />
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'default' | 'success' | 'warn' | 'danger';
}) {
  const toneClass = {
    default: 'text-foreground',
    success: 'text-success',
    warn: 'text-warning',
    danger: 'text-danger',
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      <div className="mt-0.5 text-xs text-muted">{sub}</div>
    </div>
  );
}
