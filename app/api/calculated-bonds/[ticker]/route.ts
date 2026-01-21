import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCalculatedBond, isValidScenarioId, isRecalculationInProgress } from '@/lib/precalculate';
import logger from '@/lib/logger';
import { VALID_TICKER_PATTERN } from '@/lib/constants';
import { withThrottle, ThrottlePresets } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<Record<string, string>>;
}

async function handler(
  request: NextRequest,
  context?: RouteContext
): Promise<Response> {
  if (!context) {
    return NextResponse.json({ error: 'Missing route params' }, { status: 400 });
  }
  const params = await context.params;
  const ticker = params.ticker;
  if (!ticker) {
    return NextResponse.json({ error: 'Missing ticker param' }, { status: 400 });
  }
  const searchParams = request.nextUrl.searchParams;
  const scenario = searchParams.get('scenario') ?? 'base';

  try {
    // Validate inputs to prevent injection attacks
    if (!VALID_TICKER_PATTERN.test(ticker)) {
      return NextResponse.json({ error: 'Invalid ticker format' }, { status: 400 });
    }
    if (!(await isValidScenarioId(scenario))) {
      return NextResponse.json({ error: 'Invalid scenario' }, { status: 400 });
    }

    const bond = await getCalculatedBond(ticker, scenario);

    if (!bond) {
      // If recalculation is in progress, bond might not be calculated yet
      if (isRecalculationInProgress()) {
        return NextResponse.json(
          { error: 'Bond calculation in progress', calculationReady: false },
          { status: 202 }
        );
      }
      return NextResponse.json(
        { error: 'Bond not found' },
        { status: 404 }
      );
    }

    // Only return bonds that have completed all calculations
    if (!bond.summary.calculationReady) {
      return NextResponse.json(
        { error: 'Bond calculation in progress', calculationReady: false },
        { status: 202 }
      );
    }

    // R/R is pre-calculated and stored in summary
    return NextResponse.json({
      ...bond,
      riskReward: bond.summary.riskReward,
    });
  } catch (error) {
    logger.error({ error, ticker, scenario }, 'Failed to get bond calculation');
    return NextResponse.json(
      { error: 'Failed to get bond calculation' },
      { status: 500 }
    );
  }
}

// Adaptive throttling: limits concurrent requests + abuse protection
export const GET = withThrottle(handler, {
  name: 'bond-detail',
  ...ThrottlePresets.standard,
});
