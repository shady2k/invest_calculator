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

export type RateScenarioId = 'base' | 'conservative' | 'moderate' | 'constant';

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
  /** Current YTM from MOEX (for spread calculation) */
  moexYtm: number | null;
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
  rates: RateScenarioItem[];
}

/** Scenarios API response */
export interface ScenariosResponse {
  scenarios: Record<string, RateScenario>;
  default: string;
}
