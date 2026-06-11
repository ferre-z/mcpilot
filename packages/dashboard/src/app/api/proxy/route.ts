/**
 * GET /api/proxy — return the current in-process proxy cache state.
 * Used by the dashboard to show cache hit rate.
 *
 * For the MVP, the proxy is an in-process cache. A full HTTP proxy server
 * is left for a follow-up release.
 */

import { NextResponse } from 'next/server';
import { sharedCache } from '@mcpilot/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    mode: 'in-process-cache',
    cacheSize: sharedCache.size(),
    cacheTtlMs: 5 * 60 * 1000,
    description: 'MVP proxy — caches tool-list responses for 5 minutes. Full HTTP transport coming in v0.2.',
  });
}
