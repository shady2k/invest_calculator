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
 * Calculate Risk/Reward assessment based on ratio
 */
function assessRiskReward(ratio: number | null): RiskRewardAssessment {
  if (ratio === null) return 'neutral';
  if (ratio >= RR_RATIO_EXCELLENT) return 'excellent';
  if (ratio >= RR_RATIO_GOOD) return 'good';
  if (ratio >= RR_RATIO_NEUTRAL) return 'neutral';
  return 'poor';
}

// Minimum difference threshold to avoid noise in calculations
const MIN_DIFFERENCE_THRESHOLD = 0.1; // 0.1 percentage points

/**
 * Calculate Risk/Reward analysis comparing scenario results
 *
 * Formula:
 * - Reward = optimistic return - base return (upside potential)
 * - Risk = base return - conservative return (downside risk)
 * - R/R Ratio = Reward / Risk (only when both are positive and meaningful)
 *
 * Uses the SAME horizon (base scenario's optimal exit) for all scenarios
 * to ensure fair comparison.
 *
 * @param scenarios - Calculation results for base, optimistic, and conservative scenarios
 * @param duration - Macaulay duration in years (from MOEX)
 * @returns RiskRewardAnalysis object
 */
export function calculateRiskReward(
  scenarios: ScenarioResults,
  duration: number | null
): RiskRewardAnalysis {
  // Use base scenario's optimal exit horizon for all calculations
  const targetHorizon = scenarios.base.optimalExit.years;

  // Find returns at the same horizon for all scenarios
  const findReturnAtHorizon = (results: CalculationResults, targetYears: number): number => {
    let closest = results.exitResults[0];
    if (!closest) {
      return results.optimalExit.annualReturn;
    }
    for (const exit of results.exitResults) {
      if (Math.abs(exit.years - targetYears) < Math.abs(closest.years - targetYears)) {
        closest = exit;
      }
    }
    return closest.annualReturn;
  };

  const baseReturn = findReturnAtHorizon(scenarios.base, targetHorizon);
  const optimisticReturn = findReturnAtHorizon(scenarios.optimistic, targetHorizon);
  const conservativeReturn = findReturnAtHorizon(scenarios.conservative, targetHorizon);

  // Calculate reward (upside potential) and risk (downside)
  const reward = optimisticReturn - baseReturn;
  const risk = baseReturn - conservativeReturn;

  // Calculate R/R ratio with proper edge case handling
  let ratio: number | null = null;

  if (Math.abs(risk) >= MIN_DIFFERENCE_THRESHOLD && Math.abs(reward) >= MIN_DIFFERENCE_THRESHOLD) {
    // Both reward and risk are meaningful
    if (risk > 0 && reward > 0) {
      // Normal case: upside potential with downside risk
      ratio = reward / risk;
      // Cap at 10 to avoid extreme values
      if (ratio > 10) ratio = 10;
    } else if (risk > 0 && reward <= 0) {
      // Pessimistic: no upside but has downside - poor
      ratio = reward / risk; // Will be negative or zero
    } else if (risk <= 0 && reward > 0) {
      // Optimistic: upside with no downside (conservative better than base is anomaly)
      ratio = 10; // Excellent - no real downside
    } else {
      // Both negative - scenarios are inverted, treat as neutral
      ratio = null;
    }
  } else if (Math.abs(reward) >= MIN_DIFFERENCE_THRESHOLD && Math.abs(risk) < MIN_DIFFERENCE_THRESHOLD) {
    // Has meaningful reward but minimal risk
    ratio = reward > 0 ? 10 : -10;
  }
  // If both are below threshold, ratio stays null (neutral)

  // Duration sensitivity: approximate price change per 1% rate increase
  const durationSensitivity = duration !== null ? duration : null;

  return {
    ratio,
    reward,
    risk,
    baseReturn,
    optimisticReturn,
    conservativeReturn,
    durationSensitivity,
    duration,
    horizonYears: targetHorizon,
    assessment: assessRiskReward(ratio),
  };
}

/**
 * Calculate R/R for a specific exit horizon (in years)
 *
 * Instead of using optimal exit, finds the exit point closest to
 * the specified horizon and compares across scenarios.
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

  let ratio: number | null = null;
  if (risk > 0.01) {
    ratio = reward / risk;
  } else if (reward > 0) {
    ratio = 10;
  }

  const durationSensitivity = duration !== null ? duration : null;

  return {
    ratio,
    reward,
    risk,
    baseReturn,
    optimisticReturn,
    conservativeReturn,
    durationSensitivity,
    duration,
    horizonYears: baseExit.years,
    assessment: assessRiskReward(ratio),
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
  const riskStr = risk >= 0 ? `-${risk.toFixed(1)}%` : `+${Math.abs(risk).toFixed(1)}%`;

  const assessmentText: Record<RiskRewardAssessment, string> = {
    excellent: 'Отличное соотношение риск/доходность',
    good: 'Хорошее соотношение риск/доходность',
    neutral: 'Нейтральное соотношение риск/доходность',
    poor: 'Слабое соотношение риск/доходность',
  };

  return `R/R: ${ratioStr} (${assessmentText[assessment]}). ` +
    `При благоприятном сценарии: ${rewardStr} к базе. ` +
    `При неблагоприятном: ${riskStr} от базы.`;
}
