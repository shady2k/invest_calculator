import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCalculatedBonds, isValidScenarioId } from '@/lib/precalculate';
import logger from '@/lib/logger';
import { withThrottle, ThrottlePresets } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

async function handler(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams;
  const scenario = searchParams.get('scenario') ?? 'base';

  try {
    // Validate scenario exists in JSON (prevents path traversal and invalid scenarios)
    if (!(await isValidScenarioId(scenario))) {
      return NextResponse.json({ error: 'Invalid scenario' }, { status: 400 });
    }
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

// Adaptive throttling: limits concurrent requests + abuse protection
export const GET = withThrottle(handler, {
  name: 'calculated-bonds',
  ...ThrottlePresets.standard,
});
