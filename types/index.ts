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
}

/** Validation checkpoint */
export interface ValidationCheckpoint {
  ytm?: number;
  yieldNoReinvest?: number;
  totalNoReinvest?: number;
  totalWithYTM?: number;
  realYield?: number;
  totalReal?: number;
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
