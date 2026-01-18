/**
 * Pure math functions for yield curve calculations
 * No fs/cache dependencies - can be used in client-side code
 */

/** Yield curve point */
export interface YieldCurvePoint {
  /** Period in years */
  period: number;
  /** Yield in percent */
  yield: number;
}

/**
 * Interpolate yield for a given maturity using linear interpolation
 */
export function interpolateYield(
  curve: YieldCurvePoint[],
  yearsToMaturity: number
): number {
  if (curve.length === 0) {
    throw new Error('Empty yield curve');
  }

  // If before first point, use first
  const first = curve[0];
  if (!first || yearsToMaturity <= first.period) {
    return first?.yield ?? 0;
  }

  // If after last point, use last
  const last = curve[curve.length - 1];
  if (!last || yearsToMaturity >= last.period) {
    return last?.yield ?? 0;
  }

  // Find surrounding points and interpolate
  for (let i = 0; i < curve.length - 1; i++) {
    const p1 = curve[i];
    const p2 = curve[i + 1];

    if (!p1 || !p2) continue;

    if (yearsToMaturity >= p1.period && yearsToMaturity <= p2.period) {
      // Guard against division by zero when periods are equal
      if (p2.period === p1.period) {
        return p1.yield;
      }
      // Linear interpolation
      const t = (yearsToMaturity - p1.period) / (p2.period - p1.period);
      return p1.yield + t * (p2.yield - p1.yield);
    }
  }

  // Fallback to last point
  return last?.yield ?? 0;
}

/**
 * Analyze yield curve shape
 * Returns info about curve inversion
 */
export function analyzeYieldCurve(curve: YieldCurvePoint[]): {
  /** Is curve inverted (short > long) */
  isInverted: boolean;
  /** Is long end inverted (5y > 15y) */
  isLongEndInverted: boolean;
  /** Short-term yield (1y) */
  shortYield: number;
  /** Medium-term yield (5y) */
  mediumYield: number;
  /** Long-term yield (15y) */
  longYield: number;
  /** Spread between short and long */
  spreadShortLong: number;
} {
  const shortYield = interpolateYield(curve, 1);
  const mediumYield = interpolateYield(curve, 5);
  const longYield = interpolateYield(curve, 15);

  const spreadShortLong = longYield - shortYield;
  const isInverted = spreadShortLong < 0;
  const isLongEndInverted = longYield < mediumYield;

  return {
    isInverted,
    isLongEndInverted,
    shortYield,
    mediumYield,
    longYield,
    spreadShortLong,
  };
}
