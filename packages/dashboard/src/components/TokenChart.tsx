'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import type { StatsResult } from '@mcpilot/core';

const COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#d8b4fe', '#ede9fe', '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#eab308'];

export function TokenChart({ stats }: { stats: StatsResult }) {
  const data = [...stats.servers]
    .filter((s) => s.totalTokens > 0)
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 12)
    .map((s) => ({
      name: s.server.name,
      tokens: s.totalTokens,
      tools: s.tools.length,
    }));

  if (data.length === 0) {
    return null;
  }

  return (
    <section className="mb-8 rounded-lg border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
        Token cost per server
      </h2>
      <div style={{ width: '100%', height: 280, minHeight: 280 }}>
        <ResponsiveContainer width="100%" height={280} debounce={50}>
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <XAxis
              dataKey="name"
              stroke="#8b8b95"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              stroke="#8b8b95"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v.toLocaleString()}
              width={60}
            />
            <Tooltip
              contentStyle={{
                background: '#111114',
                border: '1px solid #1f1f23',
                borderRadius: 6,
                fontSize: 12,
              }}
              labelStyle={{ color: '#ededee' }}
              itemStyle={{ color: '#a78bfa' }}
              formatter={(value: number) => [`${value.toLocaleString()} tokens`, 'Cost']}
            />
            <Bar dataKey="tokens" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
