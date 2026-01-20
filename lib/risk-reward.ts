/**
 * Risk/Reward analysis for OFZ bonds
 *
 * Compares potential returns across different rate scenarios to calculate
 * the risk/reward ratio for investment decisions.
 */

import type { RiskRewardAnalysis, RiskRewardAssessment, CalculationResults } from '@/types';
import {
  RR_RATIO_EXCELLENT,
  RR_RATIO_GOOD,
  RR_RATIO_NEUTRAL,
} from './constants';

/**
 * Scenario results needed for R/R calculation
 */
export interface ScenarioResults {
  base: CalculationResults;
  optimistic: CalculationResults;
  conservative: CalculationResults;
}

/**
 * Calculate Risk/Reward assessment based on ratio and context
 */
function assessRiskReward(ratio: number | null, reward: number, risk: number): RiskRewardAssessment {
  if (ratio === null) return 'neutral';

  // Special case: R/R = 0 with minimal risk means neutral (short bond), not poor
  if (ratio === 0 && Math.abs(risk) < MIN_DIFFERENCE_THRESHOLD) {
    return 'neutral';
  }

  if (ratio >= RR_RATIO_EXCELLENT) return 'excellent';
  if (ratio >= RR_RATIO_GOOD) return 'good';
  if (ratio >= RR_RATIO_NEUTRAL) return 'neutral';
  return 'poor';
}

// Minimum difference threshold to avoid noise in calculations
const MIN_DIFFERENCE_THRESHOLD = 0.1; // 0.1 percentage points
// Cap for extreme R/R values
const MAX_RATIO = 10;

/**
 * Calculate R/R ratio with consistent edge case handling
 */
function calculateRatio(reward: number, risk: number): number | null {
  const absReward = Math.abs(reward);
  const absRisk = Math.abs(risk);

  // Both below threshold - no meaningful risk or reward (e.g. short bonds)
  if (absReward < MIN_DIFFERENCE_THRESHOLD && absRisk < MIN_DIFFERENCE_THRESHOLD) {
    return 0;
  }

  // Meaningful risk
  if (absRisk >= MIN_DIFFERENCE_THRESHOLD) {
    if (risk > 0 && reward > 0) {
      // Normal case: upside potential with downside risk
      return Math.min(reward / risk, MAX_RATIO);
    } else if (risk > 0 && reward <= 0) {
      // No upside but has downside - poor (includes reward = 0 case)
      return absReward >= MIN_DIFFERENCE_THRESHOLD ? reward / risk : 0;
    } else if (risk <= 0 && reward > 0) {
      // Upside with no downside (conservative better than base)
      return MAX_RATIO;
    } else {
      // Both negative - scenarios are inverted
      return null;
    }
  }

  // Minimal risk but meaningful reward
  if (absReward >= MIN_DIFFERENCE_THRESHOLD) {
    return reward > 0 ? MAX_RATIO : -MAX_RATIO;
  }

  return null;
}

/**
 * Calculate Risk/Reward analysis comparing scenario results
 *
 * Formula:
 * - Reward = optimistic optimal return - base optimal return (upside potential)
 * - Risk = base optimal return - conservative optimal return (downside risk)
 * - R/R Ratio = Reward / Risk (only when both are positive and meaningful)
 *
 * Each scenario uses its OWN optimal exit point, reflecting realistic investor
 * behavior where strategy adapts to the realized scenario.
 *
 * @param scenarios - Calculation results for base, optimistic, and conservative scenarios
 * @param duration - Macaulay duration in years (from MOEX)
 * @returns RiskRewardAnalysis object
 */
export function calculateRiskReward(
  scenarios: ScenarioResults,
  duration: number | null
): RiskRewardAnalysis {
  // Each scenario uses its own optimal exit - realistic investor behavior
  const baseReturn = scenarios.base.optimalExit.annualReturn;
  const optimisticReturn = scenarios.optimistic.optimalExit.annualReturn;
  const conservativeReturn = scenarios.conservative.optimalExit.annualReturn;

  // Per-scenario optimal exit horizons
  const baseHorizonYears = scenarios.base.optimalExit.years;
  const optimisticHorizonYears = scenarios.optimistic.optimalExit.years;
  const conservativeHorizonYears = scenarios.conservative.optimalExit.years;

  // Calculate reward (upside potential) and risk (downside)
  const reward = optimisticReturn - baseReturn;
  const risk = baseReturn - conservativeReturn;

  // Calculate R/R ratio with consistent logic
  const ratio = calculateRatio(reward, risk);

  return {
    ratio,
    reward,
    risk,
    baseReturn,
    optimisticReturn,
    conservativeReturn,
    durationSensitivity: duration,
    duration,
    baseHorizonYears,
    optimisticHorizonYears,
    conservativeHorizonYears,
    assessment: assessRiskReward(ratio, reward, risk),
  };
}

/**
 * Calculate R/R for a specific exit horizon (in years)
 *
 * Instead of using optimal exit, finds the exit point closest to
 * the specified horizon and compares across scenarios.
 * Uses the same edge-case logic as calculateRiskReward for consistency.
 */
export function calculateRiskRewardAtHorizon(
  scenarios: ScenarioResults,
  duration: number | null,
  targetYears: number
): RiskRewardAnalysis {
  // Find exit results closest to target horizon
  const findExitAtHorizon = (results: CalculationResults): { annualReturn: number; years: number } => {
    let closest = results.exitResults[0];
    if (!closest) {
      return { annualReturn: results.optimalExit.annualReturn, years: results.optimalExit.years };
    }

    for (const exit of results.exitResults) {
      if (Math.abs(exit.years - targetYears) < Math.abs(closest.years - targetYears)) {
        closest = exit;
      }
    }
    return { annualReturn: closest.annualReturn, years: closest.years };
  };

  const baseExit = findExitAtHorizon(scenarios.base);
  const optimisticExit = findExitAtHorizon(scenarios.optimistic);
  const conservativeExit = findExitAtHorizon(scenarios.conservative);

  const baseReturn = baseExit.annualReturn;
  const optimisticReturn = optimisticExit.annualReturn;
  const conservativeReturn = conservativeExit.annualReturn;

  const reward = optimisticReturn - baseReturn;
  const risk = baseReturn - conservativeReturn;

  // Use consistent ratio calculation logic
  const ratio = calculateRatio(reward, risk);

  return {
    ratio,
    reward,
    risk,
    baseReturn,
    optimisticReturn,
    conservativeReturn,
    durationSensitivity: duration,
    duration,
    baseHorizonYears: baseExit.years,
    optimisticHorizonYears: optimisticExit.years,
    conservativeHorizonYears: conservativeExit.years,
    assessment: assessRiskReward(ratio, reward, risk),
  };
}

/**
 * Get human-readable description of R/R ratio
 */
export function getRiskRewardDescription(analysis: RiskRewardAnalysis): string {
  const { ratio, reward, risk, assessment } = analysis;

  if (ratio === null) {
    return 'Недостаточно данных для расчёта R/R';
  }

  const ratioStr = ratio.toFixed(2);
  const rewardStr = reward >= 0 ? `+${reward.toFixed(1)}%` : `${reward.toFixed(1)}%`;

  // Handle negative risk case (conservative scenario better than base)
  let riskDescription: string;
  if (risk < 0) {
    riskDescription = `При консервативном сценарии: +${Math.abs(risk).toFixed(1)}% к базе`;
  } else {
    riskDescription = `При консервативном сценарии: -${risk.toFixed(1)}% от базы`;
  }

  const assessmentText: Record<RiskRewardAssessment, string> = {
    excellent: 'Отличное соотношение риск/доходность',
    good: 'Хорошее соотношение риск/доходность',
    neutral: 'Нейтральное соотношение риск/доходность',
    poor: 'Слабое соотношение риск/доходность',
  };

  return `R/R: ${ratioStr} (${assessmentText[assessment]}). ` +
    `При оптимистичном сценарии: ${rewardStr} к базе. ` +
    riskDescription + '.';
}
