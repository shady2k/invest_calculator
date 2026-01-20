import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCalculatedBonds, isValidScenarioId } from '@/lib/precalculate';
import type { BondSummary } from '@/lib/precalculate';
import { calculateRiskReward, type ScenarioResults } from '@/lib/risk-reward';
import { fetchAllBonds } from '@/lib/moex';
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

    // Load all scenarios in parallel for R/R calculation
    const [cache, baseCache, optimisticCache, conservativeCache, moexBonds] = await Promise.all([
      getCalculatedBonds(scenario),
      getCalculatedBonds('base'),
      getCalculatedBonds('optimistic'),
      getCalculatedBonds('conservative'),
      fetchAllBonds(),
    ]);

    // Create lookup maps for quick access
    const baseMap = new Map(baseCache.bonds.map((b) => [b.summary.ticker, b]));
    const optimisticMap = new Map(optimisticCache.bonds.map((b) => [b.summary.ticker, b]));
    const conservativeMap = new Map(conservativeCache.bonds.map((b) => [b.summary.ticker, b]));
    const durationMap = new Map(moexBonds.map((b) => [b.ticker, b.duration]));

    // Add R/R to each bond summary
    const summaries: BondSummary[] = cache.bonds.map((b) => {
      const baseBond = baseMap.get(b.summary.ticker);
      const optimisticBond = optimisticMap.get(b.summary.ticker);
      const conservativeBond = conservativeMap.get(b.summary.ticker);

      let riskReward = null;
      if (baseBond && optimisticBond && conservativeBond) {
        const scenarios: ScenarioResults = {
          base: baseBond.results,
          optimistic: optimisticBond.results,
          conservative: conservativeBond.results,
        };
        const duration = durationMap.get(b.summary.ticker) ?? null;
        riskReward = calculateRiskReward(scenarios, duration);
      }

      return {
        ...b.summary,
        riskReward,
      };
    });

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
