/**
 * GET /api/stats — full snapshot: scan + token accounting.
 * Uses the registry's TTL cache (30s) to keep the dashboard snappy on refresh.
 */

import { NextResponse } from 'next/server';
import { getCachedSnapshot } from '@mcpilot/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// MCP SDK connections can take a few seconds — give Next.js room.
export const maxDuration = 60;

export async function GET() {
  const snapshot = await getCachedSnapshot(30_000);
  return NextResponse.json({
    stats: snapshot.stats,
    configFiles: snapshot.scan.configFiles,
    builtAt: snapshot.builtAt,
  });
}
