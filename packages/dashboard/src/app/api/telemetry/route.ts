import { NextResponse } from 'next/server';
import { getInvocations } from '@mcpilot/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const invocations = await getInvocations(limit);
    return NextResponse.json(invocations);
  } catch (err) {
    return NextResponse.json(
      { error: 'failed to fetch telemetry', message: (err as Error).message },
      { status: 500 }
    );
  }
}
