import type { McpServerStats } from '@mcpilot/core';

function statusColor(s: McpServerStats['status']) {
  switch (s) {
    case 'connected': return 'bg-success/15 text-success';
    case 'error':     return 'bg-danger/15 text-danger';
    case 'disabled':  return 'bg-muted/15 text-muted';
    default:          return 'bg-warning/15 text-warning';
  }
}

function sourceAppBadge(app: string) {
  const map: Record<string, string> = {
    claude: 'claude',
    cursor: 'cursor',
    vscode: 'vscode',
    project: 'project',
    unknown: 'unknown',
  };
  return map[app] ?? 'unknown';
}

export function ServerCard({ stat }: { stat: McpServerStats }) {
  const { server, tools, totalTokens, percentOfContext, status, error } = stat;
  const widthPct = Math.min(100, Math.max(0, percentOfContext * 5)); // 20% ctx = full bar

  return (
    <div className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-accent/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-mono text-sm font-semibold">{server.name}</h3>
            <span className="rounded bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted">
              {sourceAppBadge(server.sourceApp)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted">{server.transport}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(status)}`}>
          {status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-muted">Tools</div>
          <div className="text-lg font-semibold">{tools.length || '—'}</div>
        </div>
        <div>
          <div className="text-muted">Token cost</div>
          <div className="text-lg font-semibold">
            {totalTokens > 0 ? totalTokens.toLocaleString() : '—'}
            <span className="ml-1 text-[10px] text-muted">({percentOfContext.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-background">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${widthPct}%` }}
        />
      </div>

      {error && (
        <p className="mt-3 truncate text-[11px] text-danger" title={error}>
          {error}
        </p>
      )}

      {server.env && Object.keys(server.env).length > 0 && (
        <p className="mt-2 text-[11px] text-muted">
          env: {Object.keys(server.env).join(', ')}
        </p>
      )}
    </div>
  );
}
