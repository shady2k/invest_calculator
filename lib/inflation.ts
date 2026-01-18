import type { InflationRateItem } from '@/types';

/**
 * Get inflation rate at a specific date from schedule
 */
export function getInflationAtDate(
  date: Date,
  schedule: InflationRateItem[]
): number {
  if (schedule.length === 0) return 5; // Default fallback

  // Sort by date ascending
  const sorted = [...schedule].sort((a, b) => a.date.localeCompare(b.date));

  let rate = sorted[0]?.rate ?? 5;

  for (const item of sorted) {
    const itemDate = new Date(item.date);
    if (date >= itemDate) {
      rate = item.rate;
    } else {
      break;
    }
  }

  return rate;
}

/**
 * Calculate average inflation rate over a period
 */
export function getAverageInflation(
  startDate: Date,
  endDate: Date,
  schedule: InflationRateItem[]
): number {
  if (schedule.length === 0) return 5;

  // Sample monthly
  const samples: number[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    samples.push(getInflationAtDate(currentDate, schedule));
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  if (samples.length === 0) {
    return getInflationAtDate(startDate, schedule);
  }

  return samples.reduce((sum, rate) => sum + rate, 0) / samples.length;
}

/**
 * Calculate real yield using Fisher formula
 * Real rate ≈ (1 + nominal) / (1 + inflation) - 1
 */
export function calculateRealYield(
  nominalYield: number,
  inflationRate: number
): number {
  const nominal = nominalYield / 100;
  const inflation = inflationRate / 100;

  const realRate = (1 + nominal) / (1 + inflation) - 1;
  return realRate * 100;
}

/**
 * Calculate purchasing power of final amount
 * Adjusts nominal value for cumulative inflation
 */
export function calculateRealValue(
  nominalValue: number,
  years: number,
  annualInflation: number
): number {
  const inflation = annualInflation / 100;
  const cumulativeInflation = Math.pow(1 + inflation, years);
  return nominalValue / cumulativeInflation;
}

/**
 * Investment calculation result with inflation adjustment
 */
export interface InvestmentResult {
  /** Initial investment amount */
  investment: number;
  /** Final nominal value (in future rubles) */
  nominalValue: number;
  /** Final real value (in today's purchasing power) */
  realValue: number;
  /** Nominal profit in rubles */
  nominalProfit: number;
  /** Real profit (adjusted for inflation) */
  realProfit: number;
  /** Nominal annual yield % */
  nominalYield: number;
  /** Real annual yield % (after inflation) */
  realYield: number;
  /** Total inflation over the period */
  totalInflation: number;
  /** Investment period in years */
  years: number;
}

/**
 * Calculate investment results with inflation adjustment
 */
export function calculateInvestmentWithInflation(
  investment: number,
  nominalYield: number,
  years: number,
  annualInflation: number
): InvestmentResult {
  // Calculate nominal final value
  const nominalValue = investment * Math.pow(1 + nominalYield / 100, years);
  const nominalProfit = nominalValue - investment;

  // Calculate real values
  const realYield = calculateRealYield(nominalYield, annualInflation);
  const realValue = calculateRealValue(nominalValue, years, annualInflation);
  const realProfit = realValue - investment;

  // Total cumulative inflation
  const totalInflation = (Math.pow(1 + annualInflation / 100, years) - 1) * 100;

  return {
    investment,
    nominalValue,
    realValue,
    nominalProfit,
    realProfit,
    nominalYield,
    realYield,
    totalInflation,
    years,
  };
}
