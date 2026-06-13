'use client';

import { useState, useEffect } from 'react';
import type { ProxyInvocation } from '@mcpilot/core';

export function TelemetryFeed() {
  const [invocations, setInvocations] = useState<ProxyInvocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/telemetry?limit=50')
      .then((r) => r.json())
      .then((data) => {
        if (active) {
          setInvocations(data);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  // Compute stats
  const totalCalls = invocations.length;
  const toolCalls = invocations.filter((i) => !i.tool.startsWith('tools/list'));
  const cacheHits = invocations.filter((i) => i.tool.includes('Cache Hit')).length;
  const cacheMisses = invocations.filter((i) => i.tool.includes('Cache Miss')).length;
  const totalListRequests = cacheHits + cacheMisses;
  const cacheHitRate = totalListRequests > 0 ? (cacheHits / totalListRequests) * 100 : 0;

  const successfulCalls = invocations.filter((i) => i.ok).length;
  const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 100;

  const totalDuration = invocations.reduce((sum, item) => sum + item.durationMs, 0);
  const avgLatency = totalCalls > 0 ? totalDuration / totalCalls : 0;

  // Assume average token payload size for tools list is ~2000 tokens saved per hit
  const simulatedTokenSavings = cacheHits * 2200;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Live Proxy Telemetry
        </h2>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:border-accent hover:text-foreground transition-colors"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh Logs'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4 transition-all hover:border-border/80">
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium">Total Proxy Requests</div>
          <div className="mt-1 text-xl font-bold text-foreground tabular-nums">{totalCalls}</div>
          <div className="mt-0.5 text-[11px] text-muted">invocations logged</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 transition-all hover:border-border/80">
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium">Success Rate</div>
          <div className="mt-1 text-xl font-bold text-success tabular-nums">{successRate.toFixed(1)}%</div>
          <div className="mt-0.5 text-[11px] text-muted">status OK</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 transition-all hover:border-border/80">
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium">Tools/List Cache Hits</div>
          <div className="mt-1 text-xl font-bold text-accent tabular-nums">{cacheHits}</div>
          <div className="mt-0.5 text-[11px] text-muted">Hit Rate: {cacheHitRate.toFixed(1)}%</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 transition-all hover:border-border/80">
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium">Est. Token Savings</div>
          <div className="mt-1 text-xl font-bold text-warning tabular-nums">{simulatedTokenSavings.toLocaleString()}</div>
          <div className="mt-0.5 text-[11px] text-muted">saved context tokens</div>
        </div>
      </div>

      {/* Invocations Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-background/50 text-[10px] uppercase tracking-wider text-muted border-b border-border">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Server</th>
                <th className="px-4 py-3">Method/Tool</th>
                <th className="px-4 py-3 text-right">Latency</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-sans">
              {loading && invocations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted text-xs">
                    Loading proxy invocations...
                  </td>
                </tr>
              ) : invocations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted text-xs">
                    No proxy activity logged yet. Point Cursor/Claude Code at the proxy wrapper to see live activity.
                  </td>
                </tr>
              ) : (
                invocations.map((inv, idx) => {
                  const isCacheHit = inv.tool.includes('Cache Hit');
                  const isCacheMiss = inv.tool.includes('Cache Miss');
                  const displayTool = isCacheHit 
                    ? 'tools/list (Cache Hit ⚡)' 
                    : isCacheMiss 
                      ? 'tools/list (Cache Miss ✗)' 
                      : inv.tool;

                  return (
                    <tr key={idx} className="hover:bg-background/30 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-muted tabular-nums">
                        {new Date(inv.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono font-semibold text-foreground">
                        {inv.server}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono">
                        <span className={isCacheHit ? 'text-accent' : isCacheMiss ? 'text-muted' : 'text-foreground'}>
                          {displayTool}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono text-muted tabular-nums">
                        {isCacheHit ? '—' : `${inv.durationMs}ms`}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium leading-4 ${
                            inv.ok
                              ? 'bg-success/10 text-success border border-success/20'
                              : 'bg-danger/10 text-danger border border-danger/20'
                          }`}
                        >
                          {inv.ok ? 'OK' : 'Error'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
