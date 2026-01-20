import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCalculatedBond, isValidScenarioId } from '@/lib/precalculate';
import { calculateRiskReward, type ScenarioResults } from '@/lib/risk-reward';
import { fetchBondByTicker } from '@/lib/moex';
import logger from '@/lib/logger';
import { VALID_TICKER_PATTERN } from '@/lib/constants';
import { withThrottle, ThrottlePresets } from '@/lib/rate-limit';
import type { RiskRewardAnalysis } from '@/types';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<Record<string, string>>;
}

/**
 * Calculate Risk/Reward by loading data from all 3 scenarios
 */
async function calculateBondRiskReward(
  ticker: string
): Promise<RiskRewardAnalysis | null> {
  // Load bond data from all 3 scenarios in parallel
  const [baseBond, optimisticBond, conservativeBond, moexBond] = await Promise.all([
    getCalculatedBond(ticker, 'base'),
    getCalculatedBond(ticker, 'optimistic'),
    getCalculatedBond(ticker, 'conservative'),
    fetchBondByTicker(ticker),
  ]);

  // Need all 3 scenarios for R/R calculation
  if (!baseBond || !optimisticBond || !conservativeBond) {
    return null;
  }

  const scenarios: ScenarioResults = {
    base: baseBond.results,
    optimistic: optimisticBond.results,
    conservative: conservativeBond.results,
  };

  // Get duration from MOEX data
  const duration = moexBond?.duration ?? null;

  return calculateRiskReward(scenarios, duration);
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

    // Load bond data and R/R analysis in parallel
    const [bond, riskReward] = await Promise.all([
      getCalculatedBond(ticker, scenario),
      calculateBondRiskReward(ticker),
    ]);

    if (!bond) {
      return NextResponse.json(
        { error: 'Bond not found' },
        { status: 404 }
      );
    }

    // Return bond data with R/R analysis
    return NextResponse.json({
      ...bond,
      riskReward,
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
