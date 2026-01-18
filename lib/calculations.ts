import type {
  RateScheduleItem,
  ExitResult,
  CalculationResults,
  BondCalculationInput,
  ValidationCheckpoint,
} from '@/types';
import {
  MS_PER_YEAR,
  DAYS_PER_YEAR,
  DEFAULT_SPREAD,
  MAX_MATURITY_SPREAD,
  MATURITY_SPREAD_FACTOR,
  DEFAULT_KEY_RATE,
  PAR_THRESHOLD,
  XIRR_MAX_ITERATIONS,
  XIRR_TOLERANCE,
  XIRR_MIN_RATE,
  XIRR_MAX_RATE,
  XIRR_DEFAULT_GUESS,
  VALIDATION_TOLERANCE,
} from './constants';

/**
 * XIRR calculation - Internal Rate of Return for irregular cash flows
 */
export function xirr(
  cashflows: number[],
  dates: Date[],
  guess: number = XIRR_DEFAULT_GUESS
): number {
  let rate = guess;
  const firstDate = dates[0];

  if (!firstDate) {
    return 0;
  }

  for (let i = 0; i < XIRR_MAX_ITERATIONS; i++) {
    let npv = 0;
    let dnpv = 0;

    for (let j = 0; j < cashflows.length; j++) {
      const cf = cashflows[j];
      const d = dates[j];
      if (cf === undefined || !d) continue;

      const years = (d.getTime() - firstDate.getTime()) / MS_PER_YEAR;
      const factor = Math.pow(1 + rate, years);
      npv += cf / factor;
      dnpv -= (years * cf) / (factor * (1 + rate));
    }

    if (Math.abs(npv) < XIRR_TOLERANCE) {
      return rate;
    }

    if (Math.abs(dnpv) < XIRR_TOLERANCE) {
      break;
    }

    const newRate = rate - npv / dnpv;

    if (Math.abs(newRate - rate) < XIRR_TOLERANCE) {
      return newRate;
    }

    rate = newRate;

    if (rate < XIRR_MIN_RATE) rate = XIRR_MIN_RATE / 2;
    if (rate > XIRR_MAX_RATE) rate = 1;
  }

  return rate;
}

/**
 * Get key rate at a specific date from schedule
 */
export function getKeyRateAtDate(
  date: Date,
  schedule: RateScheduleItem[]
): number {
  let rate = schedule[0]?.rate ?? DEFAULT_KEY_RATE;

  for (const item of schedule) {
    if (date >= item.date) {
      rate = item.rate;
    } else {
      break;
    }
  }

  return rate;
}

/**
 * Calculate the spread between key rate and bond YTM
 * Spread = currentKeyRate - moexYTM
 */
export function calculateSpread(
  currentKeyRate: number,
  moexYtm: number | null
): number {
  if (moexYtm === null || moexYtm <= 0) {
    // Fallback to default spread if no MOEX YTM available
    return currentKeyRate - (currentKeyRate + DEFAULT_SPREAD);
  }
  return currentKeyRate - moexYtm;
}

/**
 * Estimate YTM from key rate using dynamic spread
 * YTM = keyRate - spread, but not below coupon yield
 */
export function estimateYTMFromKeyRate(
  keyRate: number,
  spread: number,
  couponYieldAnnual: number
): number {
  const estimatedYtm = keyRate - spread;
  // YTM cannot go below coupon yield (when bond is at par)
  return Math.max(estimatedYtm, couponYieldAnnual);
}

/**
 * Calculate bond price using discounted cash flows (DCF)
 * This is the core pricing formula for bonds
 */
export function calculateBondPriceDCF(
  coupon: number,
  nominal: number,
  ytmAnnual: number,
  periodsRemaining: number,
  periodsPerYear: number = 2
): number {
  if (periodsRemaining <= 0) return nominal;

  const ytmPerPeriod = ytmAnnual / 100 / periodsPerYear;
  let price = 0;

  // Discount each coupon payment
  for (let t = 1; t <= periodsRemaining; t++) {
    price += coupon / Math.pow(1 + ytmPerPeriod, t);
  }

  // Discount the nominal at maturity
  price += nominal / Math.pow(1 + ytmPerPeriod, periodsRemaining);

  return price;
}

/**
 * Calculate bond price at a given key rate
 */
export function calculatePriceAtKeyRate(
  keyRate: number,
  coupon: number,
  nominal: number,
  yearsToMaturity: number,
  spread: number,
  periodsPerYear: number = 2
): number {
  if (yearsToMaturity <= 0) return nominal;

  // Annual coupon yield (coupon is per period, so multiply by periods per year)
  const couponYieldAnnual = (coupon * periodsPerYear / nominal) * 100;
  const ytm = estimateYTMFromKeyRate(keyRate, spread, couponYieldAnnual);
  const periodsRemaining = Math.round(yearsToMaturity * periodsPerYear);

  return calculateBondPriceDCF(coupon, nominal, ytm, periodsRemaining, periodsPerYear);
}

/**
 * Generate coupon dates from first coupon to maturity
 */
export function generateCouponDates(
  firstCouponDate: Date,
  maturityDate: Date,
  periodDays: number
): Date[] {
  const couponDates: Date[] = [];
  const currentDate = new Date(firstCouponDate);

  while (currentDate < maturityDate) {
    couponDates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + periodDays);
  }

  couponDates.push(new Date(maturityDate));

  return couponDates;
}

/**
 * Main calculation function
 */
export function calculate(input: BondCalculationInput): CalculationResults {
  const {
    bondName,
    nominal,
    currentPrice: investment,
    coupon,
    couponPeriodDays: periodDays,
    purchaseDate: purchaseDateStr,
    firstCouponDate: firstCouponDateStr,
    maturityDate: maturityDateStr,
    rateSchedule,
    currentKeyRate,
    moexYtm,
  } = input;

  const purchaseDate = new Date(purchaseDateStr);
  const firstCouponDate = new Date(firstCouponDateStr);
  const maturityDate = new Date(maturityDateStr);

  const yearsToMaturity =
    (maturityDate.getTime() - purchaseDate.getTime()) / MS_PER_YEAR;

  const periodsPerYear = Math.round(DAYS_PER_YEAR / periodDays);

  // Calculate spread from current market data
  const spread = calculateSpread(currentKeyRate, moexYtm);

  // Annual coupon yield (minimum YTM when bond is at par)
  const couponYieldAnnual = (coupon * periodsPerYear / nominal) * 100;

  // Generate coupon dates
  const couponDates = generateCouponDates(firstCouponDate, maturityDate, periodDays);
  const couponCount = couponDates.length;

  // 1. Calculate YTM via XIRR (hold to maturity)
  const cashflowsYTM: number[] = [-investment];
  const datesYTM: Date[] = [purchaseDate];

  for (let i = 0; i < couponDates.length; i++) {
    const isLast = i === couponDates.length - 1;
    const couponDate = couponDates[i];
    if (!couponDate) continue;
    cashflowsYTM.push(isLast ? coupon + nominal : coupon);
    datesYTM.push(couponDate);
  }

  const ytm = xirr(cashflowsYTM, datesYTM) * 100;

  // 2. Total with YTM reinvestment (theoretical max)
  let totalWithYTM = 0;
  for (let i = 0; i < couponDates.length; i++) {
    const couponDate = couponDates[i];
    if (!couponDate) continue;
    const yearsRemaining =
      (maturityDate.getTime() - couponDate.getTime()) / MS_PER_YEAR;
    const isLast = i === couponDates.length - 1;
    const cf = isLast ? coupon + nominal : coupon;
    totalWithYTM += cf * Math.pow(1 + ytm / 100, yearsRemaining);
  }

  // 3. Without reinvestment
  const totalNoReinvest = coupon * couponCount + nominal;
  const yieldNoReinvest =
    xirr([-investment, totalNoReinvest], [purchaseDate, maturityDate]) * 100;

  // 4. With variable rate reinvestment (simple model)
  let totalWithVariableRate = 0;
  for (let i = 0; i < couponDates.length; i++) {
    const couponDate = couponDates[i];
    if (!couponDate) continue;
    const yearsRemaining =
      (maturityDate.getTime() - couponDate.getTime()) / MS_PER_YEAR;
    const keyRate = getKeyRateAtDate(couponDate, rateSchedule);
    const reinvestRate = estimateYTMFromKeyRate(keyRate, spread, couponYieldAnnual) / 100;

    const isLast = i === couponDates.length - 1;
    const cf = isLast ? coupon + nominal : coupon;

    totalWithVariableRate += cf * Math.pow(1 + reinvestRate, yearsRemaining);
  }

  // 5. Full model with per-period reinvestment
  let totalFullModel = 0;

  for (let i = 0; i < couponDates.length; i++) {
    const isLast = i === couponDates.length - 1;
    let couponValue = isLast ? coupon + nominal : coupon;

    for (let j = i; j < couponDates.length - 1; j++) {
      const periodStart = couponDates[j];
      const periodEnd = couponDates[j + 1];
      if (!periodStart || !periodEnd) continue;

      const periodLength =
        (periodEnd.getTime() - periodStart.getTime()) / MS_PER_YEAR;

      const keyRate = getKeyRateAtDate(periodStart, rateSchedule);
      const reinvestRate = estimateYTMFromKeyRate(keyRate, spread, couponYieldAnnual) / 100;

      couponValue *= Math.pow(1 + reinvestRate, periodLength);
    }

    totalFullModel += couponValue;
  }

  const realYieldMaturity =
    xirr([-investment, totalFullModel], [purchaseDate, maturityDate]) * 100;

  // 6. Calculate exit results for each coupon date
  const exitResults: ExitResult[] = [];

  for (let i = 0; i < couponDates.length; i++) {
    const exitDate = couponDates[i];
    if (!exitDate) continue;

    const years =
      (exitDate.getTime() - purchaseDate.getTime()) / MS_PER_YEAR;
    const keyRate = getKeyRateAtDate(exitDate, rateSchedule);
    const isLast = i === couponDates.length - 1;

    const yearsRemaining =
      (maturityDate.getTime() - exitDate.getTime()) / MS_PER_YEAR;

    // Calculate bond price at exit
    const bondPrice = isLast
      ? nominal
      : calculatePriceAtKeyRate(keyRate, coupon, nominal, yearsRemaining, spread, periodsPerYear);

    const reinvestRate = estimateYTMFromKeyRate(keyRate, spread, couponYieldAnnual);

    // Calculate reinvested coupons up to this point
    let reinvestedCoupons = 0;
    for (let j = 0; j < i; j++) {
      let cv = coupon;
      for (let k = j; k < i; k++) {
        const periodStart = couponDates[k];
        const periodEnd = couponDates[k + 1];
        if (!periodStart || !periodEnd) continue;

        const periodLength =
          (periodEnd.getTime() - periodStart.getTime()) / MS_PER_YEAR;
        const kr = getKeyRateAtDate(periodStart, rateSchedule);
        const rr = estimateYTMFromKeyRate(kr, spread, couponYieldAnnual) / 100;
        cv *= Math.pow(1 + rr, periodLength);
      }
      reinvestedCoupons += cv;
    }

    // Add current coupon
    reinvestedCoupons += coupon;

    const exitValue = isLast
      ? reinvestedCoupons + nominal
      : bondPrice + reinvestedCoupons;

    const totalReturn = ((exitValue - investment) / investment) * 100;
    const annualReturn =
      years > 0 ? (Math.pow(exitValue / investment, 1 / years) - 1) * 100 : 0;

    exitResults.push({
      date: exitDate,
      years,
      keyRate,
      reinvestRate,
      bondPrice,
      reinvestedCoupons,
      exitValue,
      totalReturn,
      annualReturn,
      isLast,
    });
  }

  // Find optimal exit (max annual return)
  let optimalExit = exitResults[0];
  if (!optimalExit) {
    throw new Error('No exit results calculated');
  }

  for (const exit of exitResults) {
    if (exit.annualReturn > optimalExit.annualReturn) {
      optimalExit = exit;
    }
  }

  // Find par exit (when price reaches ~nominal)
  let parExit: ExitResult | null = null;
  for (const exit of exitResults) {
    if (exit.bondPrice >= nominal * PAR_THRESHOLD) {
      parExit = exit;
      break;
    }
  }
  if (!parExit) {
    parExit = exitResults[exitResults.length - 1] ?? optimalExit;
  }

  // === VALIDATION CHECKPOINTS ===
  // Internal consistency checks to verify calculation correctness

  // Check 1: NPV of cash flows at YTM rate should equal investment (definition of YTM)
  let discountedCashFlowsSum = 0;
  const ytmDecimal = ytm / 100;
  for (let i = 0; i < couponDates.length; i++) {
    const couponDate = couponDates[i];
    if (!couponDate) continue;
    const yearsFromPurchase = (couponDate.getTime() - purchaseDate.getTime()) / MS_PER_YEAR;
    const isLast = i === couponDates.length - 1;
    const cf = isLast ? coupon + nominal : coupon;
    discountedCashFlowsSum += cf / Math.pow(1 + ytmDecimal, yearsFromPurchase);
  }
  const discountedDifference = Math.abs(discountedCashFlowsSum - investment);

  // Check 2: Total without reinvestment = coupons * count + nominal (simple arithmetic)
  const expectedTotalNoReinvest = coupon * couponCount + nominal;
  const actualTotalNoReinvest = totalNoReinvest;

  // Check 3: FV discounted back to PV should equal investment (mathematical identity)
  const accumulatedValueDiscounted = totalWithYTM / Math.pow(1 + ytmDecimal, yearsToMaturity);

  // Validate all checks
  const check1Passed = discountedDifference / investment < VALIDATION_TOLERANCE;
  const check2Passed = Math.abs(expectedTotalNoReinvest - actualTotalNoReinvest) / expectedTotalNoReinvest < VALIDATION_TOLERANCE;
  const check3Passed = Math.abs(accumulatedValueDiscounted - investment) / investment < VALIDATION_TOLERANCE;

  const validation: ValidationCheckpoint = {
    discountedCashFlowsSum,
    discountedDifference,
    expectedTotalNoReinvest,
    actualTotalNoReinvest,
    accumulatedValueDiscounted,
    allChecksPassed: check1Passed && check2Passed && check3Passed,
  };

  return {
    bondName,
    investment,
    nominal,
    coupon,
    ytm,
    yearsToMaturity,
    couponCount,
    totalWithYTM,
    yieldNoReinvest,
    totalNoReinvest,
    totalWithVariableRate,
    realYieldMaturity,
    totalFullModel,
    exitResults,
    optimalExit,
    parExit,
    validation,
  };
}
