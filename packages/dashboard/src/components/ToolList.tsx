'use client';

import { useState } from 'react';
import type { McpTool, StatsResult } from '@mcpilot/core';

type Row = McpTool & { serverLabel: string };

export function ToolList({ stats }: { stats: StatsResult }) {
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const serverNames = Array.from(new Set(stats.servers.map((s) => s.server.name)));
  const rows: Row[] = [];
  for (const s of stats.servers) {
    for (const t of s.tools) {
      rows.push({ ...t, serverLabel: s.server.name });
    }
  }
  rows.sort((a, b) => b.tokenCount - a.tokenCount);

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.serverLabel === filter);
  const shown = showAll ? filtered : filtered.slice(0, 20);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted">
        No tools discovered. Connect to a running MCP server to see its tools here.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Filter:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="all">All servers ({rows.length})</option>
            {serverNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="text-xs text-muted">
          showing {shown.length} of {filtered.length}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
            <tr className="border-b border-border">
              <th className="px-4 py-2">Tool</th>
              <th className="px-4 py-2">Server</th>
              <th className="px-4 py-2 text-right">Tokens</th>
              <th className="px-4 py-2 text-right">% ctx</th>
              <th className="px-4 py-2">Bar</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t, i) => {
              const pct = (t.tokenCount / stats.contextWindowSize) * 100;
              return (
                <tr key={`${t.serverLabel}::${t.name}::${i}`} className="border-b border-border/40 hover:bg-background/40">
                  <td className="px-4 py-2 font-mono text-xs">
                    {t.name}
                    {t.description && (
                      <div className="mt-0.5 max-w-md truncate text-[10px] font-sans text-muted" title={t.description}>
                        {t.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted">{t.serverLabel}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">
                    {t.tokenCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-muted">
                    {pct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-2">
                    <div style={{ width: 96, height: 6, background: '#0a0a0b', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(2, pct * 50))}%`,
                          height: '100%',
                          background: '#7c3aed',
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > 20 && (
        <div className="border-t border-border p-3 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-accent"
          >
            {showAll ? 'Show less' : `Show all ${filtered.length}`}
          </button>
        </div>
      )}
    </div>
  );
}
