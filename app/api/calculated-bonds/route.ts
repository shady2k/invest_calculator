import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCalculatedBonds } from '@/lib/precalculate';
import logger from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const scenario = searchParams.get('scenario') ?? 'base';

  try {
    const cache = await getCalculatedBonds(scenario);

    // Return only summaries for list view (lighter payload)
    const summaries = cache.bonds.map((b) => b.summary);

    return NextResponse.json({
      timestamp: cache.timestamp,
      scenario: cache.scenario,
      currentKeyRate: cache.currentKeyRate,
      bonds: summaries,
      isCalculating: cache.isCalculating ?? false,
    });
  } catch (error) {
    logger.error({ error, scenario }, 'Failed to get calculated bonds');
    return NextResponse.json(
      { error: 'Failed to get calculated bonds' },
      { status: 500 }
    );
  }
}
