/**
 * GET /api/servers — list all discovered MCP servers (config-only, no live connection).
 * Fast path: no MCP SDK connection, just file scanning.
 */

import { NextResponse } from 'next/server';
import { scanAllConfigs } from '@mcpilot/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const scan = await scanAllConfigs({});
    return NextResponse.json(scan);
  } catch (err) {
    return NextResponse.json(
      { error: 'scan failed', message: (err as Error).message, stack: (err as Error).stack },
      { status: 500 },
    );
  }
}
