/** Bond preset configuration */
export interface BondPreset {
  name: string;
  nominal: number;
  price: number;
  coupon: number;
  periodDays: number;
  maturity: string;
  purchase: string;
  firstCoupon: string;
  priceTable: Record<number, number>;
  ytmTable: Record<number, number>;
}

/** Rate schedule item */
export interface RateScheduleItem {
  date: Date;
  rate: number;
}

/** Rate scenario preset */
export interface RateScenarioItem {
  date: string;
  rate: number;
}

export type RateScenarioId = 'base' | 'conservative' | 'optimistic' | 'constant';

/** Exit calculation result */
export interface ExitResult {
  date: Date;
  years: number;
  keyRate: number;
  reinvestRate: number;
  bondPrice: number;
  reinvestedCoupons: number;
  exitValue: number;
  totalReturn: number;
  annualReturn: number;
  isLast: boolean;
}

/** Full calculation results */
export interface CalculationResults {
  bondName: string;
  investment: number;
  nominal: number;
  coupon: number;
  ytm: number;
  yearsToMaturity: number;
  couponCount: number;
  totalWithYTM: number;
  yieldNoReinvest: number;
  totalNoReinvest: number;
  totalWithVariableRate: number;
  realYieldMaturity: number;
  totalFullModel: number;
  exitResults: ExitResult[];
  optimalExit: ExitResult;
  parExit: ExitResult;
  /** Validation checkpoints for verifying calculation correctness */
  validation: ValidationCheckpoint;
  /** Bond valuation assessment (overbought/fair/oversold) */
  valuation: ValuationAssessment;
}

/** Input parameters for bond calculation */
export interface BondCalculationInput {
  bondName: string;
  nominal: number;
  currentPrice: number;
  coupon: number;
  couponPeriodDays: number;
  purchaseDate: string;
  firstCouponDate: string;
  maturityDate: string;
  rateSchedule: RateScheduleItem[];
  bondId: string;
  /** Current key rate from CBR (for spread calculation) */
  currentKeyRate: number;
  /** Current inflation rate (for real yield calculation) */
  currentInflation: number;
  /** Current YTM from MOEX (for spread calculation) */
  moexYtm: number | null;
  /** Theoretical yield from zero-coupon yield curve for this maturity */
  theoreticalYield: number;
}

/** Validation checkpoint - internal consistency checks for calculations */
export interface ValidationCheckpoint {
  /** Check 1: NPV of cash flows at YTM rate (should equal investment) */
  discountedCashFlowsSum: number;
  /** Difference between NPV and investment (should be ~0) */
  discountedDifference: number;
  /** Check 2: Expected total without reinvestment = coupons * count + nominal */
  expectedTotalNoReinvest: number;
  /** Actual calculated total without reinvestment */
  actualTotalNoReinvest: number;
  /** Check 3: FV discounted back to purchase date (should equal investment) */
  accumulatedValueDiscounted: number;
  /** Whether all checks passed within tolerance */
  allChecksPassed: boolean;
}

/** Comparison data for bonds */
export interface ComparisonData extends CalculationResults {
  id: string;
}

/** MOEX bond data from API */
export interface MoexBond {
  secid: string;
  shortname: string;
  prevprice: number | null;
  couponvalue: number | null;
  nextcoupon: string | null;
  couponperiod: number | null;
  matdate: string | null;
  facevalue: number;
  accruedint: number | null;
  yieldtoprevyield: number | null;
  lotsize: number;
  faceunit: string;
}

/** Parsed bond from MOEX */
export interface ParsedBond {
  ticker: string;
  name: string;
  price: number | null;
  coupon: number | null;
  couponPeriod: number | null;
  maturityDate: string | null;
  nominal: number;
  accruedInterest: number | null;
  ytm: number | null;
  /** Daily trading volume in rubles */
  volume: number | null;
  /** Macaulay duration in years (from MOEX, converted from days) */
  duration: number | null;
}

/** CBR Key Rate */
export interface KeyRateData {
  date: string;
  rate: number;
}

/** Chart type options */
export type ChartType = 'yield' | 'price' | 'total';

/** Rate scenario with metadata */
export interface RateScenario {
  name: string;
  description: string;
  /** Merged rates: history + forecast */
  rates: RateScenarioItem[];
  /** Original forecast rates from scenario file */
  forecastRates?: RateScenarioItem[];
  /** Historical rates from CBR */
  historyRates?: RateScenarioItem[];
}

/** Scenarios API response */
export interface ScenariosResponse {
  scenarios: Record<string, RateScenario>;
  default: string;
  currentKeyRate?: number;
}

/** Bond valuation status */
export type ValuationStatus = 'overbought' | 'fair' | 'oversold';

/** Inflation rate item */
export interface InflationRateItem {
  date: string;
  rate: number;
}

/** Inflation scenario */
export interface InflationScenario {
  name: string;
  description: string;
  rates: InflationRateItem[];
}

/** Inflation scenarios response (uses same scenario IDs as rate scenarios) */
export interface InflationScenariosResponse {
  scenarios: Record<RateScenarioId, InflationScenario>;
  default: RateScenarioId;
  sources: string[];
  lastUpdated: string;
}

/** Risk/Reward analysis comparing scenarios */
export interface RiskRewardAnalysis {
  /** Scenario-based R/R ratio (reward/risk). Higher is better. */
  ratio: number | null;
  /** Potential upside: optimistic return - base return (percentage points) */
  reward: number;
  /** Potential downside: base return - conservative return (percentage points) */
  risk: number;
  /** Base scenario annual return % */
  baseReturn: number;
  /** Optimistic scenario annual return % */
  optimisticReturn: number;
  /** Conservative scenario annual return % */
  conservativeReturn: number;
  /** Duration sensitivity: price change per 1% rate increase */
  durationSensitivity: number | null;
  /** Macaulay duration in years */
  duration: number | null;
  /** Base scenario optimal exit horizon (years) */
  baseHorizonYears: number;
  /** Optimistic scenario optimal exit horizon (years) */
  optimisticHorizonYears: number;
  /** Conservative scenario optimal exit horizon (years) */
  conservativeHorizonYears: number;
  /** Human-readable assessment */
  assessment: RiskRewardAssessment;
}

/** Risk/Reward assessment levels */
export type RiskRewardAssessment = 'excellent' | 'good' | 'neutral' | 'poor';

/** Bond valuation assessment with recommendation */
export interface ValuationAssessment {
  /** Current status: overbought, fair, or oversold */
  status: ValuationStatus;
  /** Spread between key rate and YTM (keyRate - ytm) */
  spread: number;
  /** Real yield (YTM - inflation) */
  realYield: number;
  /** Spread vs yield curve (YTM - theoreticalYield). Positive = cheap, Negative = expensive */
  zcycSpread: number;
  /** Theoretical yield from zero-coupon yield curve */
  theoreticalYield: number;
  /** Current CBR key rate */
  keyRate: number;
  /** Current inflation rate */
  inflation: number;
  /** Short label for badge display */
  label: string;
  /** Detailed recommendation for investor */
  recommendation: string;
  /** Risk warning if applicable */
  riskWarning?: string;
}
