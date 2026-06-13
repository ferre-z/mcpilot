'use client';

import { useEffect, useState } from 'react';
import { ServerCard } from '@/components/ServerCard';
import { SavingsCounter } from '@/components/SavingsCounter';
import { TokenChart } from '@/components/TokenChart';
import { ToolList } from '@/components/ToolList';
import { TelemetryFeed } from '@/components/TelemetryFeed';
import type { StatsResult } from '@mcpilot/core';

interface ApiResponse {
  stats: StatsResult;
  builtAt: number;
}

export default function HomePage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/stats')
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) {
          setData(j);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MCPilot</h1>
          <p className="text-sm text-muted">
            Take control of your MCP stack — manage, monitor, and optimize all your MCP servers from one place.
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-accent hover:text-foreground"
          disabled={loading}
        >
          {loading ? 'Scanning…' : 'Refresh'}
        </button>
      </header>

      {error && (
        <div className="mb-6 rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {data && (
        <>
          <SavingsCounter stats={data.stats} />

          {data.stats.servers.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-muted">
              No MCP servers found. Run <code className="rounded bg-background px-1.5 py-0.5">mcpilot scan</code> from the CLI to discover configs.
            </div>
          ) : (
            <>
              <TokenChart stats={data.stats} />

              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Servers</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.stats.servers.map((s) => (
                    <ServerCard key={`${s.server.source}::${s.server.name}`} stat={s} />
                  ))}
                </div>
              </section>

              <section className="mt-10">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Top tools by token cost</h2>
                <ToolList stats={data.stats} />
              </section>

              <section className="mt-10">
                <TelemetryFeed />
              </section>

              <footer className="mt-12 border-t border-border pt-6 text-xs text-muted">
                Built at {new Date(data.builtAt).toLocaleString()} · MCPilot v0.1.0
              </footer>
            </>
          )}
        </>
      )}

      {loading && !data && (
        <div className="flex h-64 items-center justify-center text-muted">Scanning MCP servers…</div>
      )}
    </main>
  );
}
