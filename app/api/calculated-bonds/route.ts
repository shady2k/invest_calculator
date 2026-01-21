import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCalculatedBonds, isValidScenarioId, isRecalculationInProgress } from '@/lib/precalculate';
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

    // Only return bonds that have completed all calculations
    const readyBonds = cache.bonds.filter((b) => b.summary.calculationReady);
    const summaries = readyBonds.map((b) => b.summary);

    // Global calculationReady: true when all bonds are ready AND no recalculation in progress
    // Frontend should poll while calculationReady is false
    const allBondsReady = cache.bonds.length > 0 && cache.bonds.every((b) => b.summary.calculationReady);
    const recalculating = isRecalculationInProgress();
    // If we have no bonds and not recalculating, consider it "ready" (empty but done)
    const allReady = recalculating ? false : (allBondsReady || cache.bonds.length === 0);

    return NextResponse.json({
      timestamp: cache.timestamp,
      scenario: cache.scenario,
      currentKeyRate: cache.currentKeyRate,
      bonds: summaries,
      calculationReady: allReady,
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
