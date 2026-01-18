import type {
  RateScheduleItem,
  ExitResult,
  CalculationResults,
  BondCalculationInput,
  ValidationCheckpoint,
  ValuationAssessment,
  ValuationStatus,
} from '@/types';
import {
  MS_PER_YEAR,
  DAYS_PER_YEAR,
  DEFAULT_SPREAD,
  DEFAULT_KEY_RATE,
  PAR_THRESHOLD,
  XIRR_MAX_ITERATIONS,
  XIRR_TOLERANCE,
  XIRR_MIN_RATE,
  XIRR_MAX_RATE,
  XIRR_DEFAULT_GUESS,
  VALIDATION_TOLERANCE,
  VALUATION_SPREAD_OVERBOUGHT,
  VALUATION_SPREAD_OVERSOLD,
  VALUATION_REAL_YIELD_LOW,
  VALUATION_REAL_YIELD_HIGH,
  VALUATION_ZCYC_OVERBOUGHT,
  VALUATION_ZCYC_OVERSOLD,
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
 * Assess bond valuation relative to key rate and inflation
 * Determines if bond is overbought, fairly priced, or oversold
 *
 * Overbought (expensive): YTM much lower than key rate OR low real yield
 * Oversold (cheap): YTM above key rate OR high real yield
 */
export function assessValuation(
  ytm: number,
  keyRate: number,
  inflation: number,
  theoreticalYield: number
): ValuationAssessment {
  const spread = keyRate - ytm;
  const realYield = ytm - inflation;
  const zcycSpread = ytm - theoreticalYield;

  let status: ValuationStatus;
  let label: string;
  let recommendation: string;
  let riskWarning: string | undefined;

  // Overbought signals (bond is expensive)
  // 1. YTM much below key rate (market priced in rate cuts)
  // 2. Low real yield (poor inflation protection)
  // 3. YTM below yield curve (expensive vs similar maturity bonds)
  const spreadSignal = spread > VALUATION_SPREAD_OVERBOUGHT ? 1 : 0;
  const realYieldSignalLow = realYield < VALUATION_REAL_YIELD_LOW ? 1 : 0;
  const zcycSignalOverbought = zcycSpread < VALUATION_ZCYC_OVERBOUGHT ? 1 : 0;
  const overboughtScore = spreadSignal + realYieldSignalLow + zcycSignalOverbought;

  // Oversold signals (bond is cheap)
  // 1. YTM above key rate (discount to fair value)
  // 2. High real yield (excellent inflation protection)
  // 3. YTM above yield curve (cheap vs similar maturity bonds)
  const oversoldSpreadSignal = spread < VALUATION_SPREAD_OVERSOLD ? 1 : 0;
  const realYieldSignalHigh = realYield > VALUATION_REAL_YIELD_HIGH ? 1 : 0;
  const zcycSignalOversold = zcycSpread > VALUATION_ZCYC_OVERSOLD ? 1 : 0;
  const oversoldScore = oversoldSpreadSignal + realYieldSignalHigh + zcycSignalOversold;

  // Need at least 2 signals for a clear direction
  const isOverbought = overboughtScore >= 2;
  const isOversold = oversoldScore >= 2;

  if (isOverbought && !isOversold) {
    status = 'overbought';
    label = 'Перекуплена';

    const reasons: string[] = [];
    if (spreadSignal) {
      reasons.push(`доходность ниже ключевой ставки на ${spread.toFixed(1)}%`);
    }
    if (realYieldSignalLow) {
      reasons.push(`низкая реальная доходность (${realYield.toFixed(1)}%)`);
    }
    if (zcycSignalOverbought) {
      reasons.push(`доходность ниже кривой КБД на ${Math.abs(zcycSpread).toFixed(2)}%`);
    }

    recommendation =
      `Бумага дорогая: ${reasons.join(', ')}. ` +
      'Потенциал роста цены ограничен.';
    riskWarning =
      'Если ставка не снизится или инфляция вырастет, цена может скорректироваться вниз.';
  } else if (isOversold && !isOverbought) {
    status = 'oversold';
    label = 'Недооценена';

    const reasons: string[] = [];
    if (oversoldSpreadSignal) {
      reasons.push(`доходность выше ключевой ставки на ${Math.abs(spread).toFixed(1)}%`);
    }
    if (realYieldSignalHigh) {
      reasons.push(`высокая реальная доходность (${realYield.toFixed(1)}%)`);
    }
    if (zcycSignalOversold) {
      reasons.push(`доходность выше кривой КБД на ${zcycSpread.toFixed(2)}%`);
    }

    recommendation =
      `Потенциально выгодная покупка: ${reasons.join(', ')}. ` +
      'Бумага торгуется с дисконтом к справедливой цене.';
    riskWarning =
      'Проверьте ликвидность и причины дисконта.';
  } else {
    status = 'fair';
    label = 'Справедливая';
    recommendation =
      `Доходность (${ytm.toFixed(1)}%) соответствует рыночным условиям. ` +
      `Реальная доходность ${realYield.toFixed(1)}%, отклонение от КБД ${zcycSpread > 0 ? '+' : ''}${zcycSpread.toFixed(2)}%. ` +
      'Подходит для долгосрочного инвестирования.';
  }

  return {
    status,
    spread,
    realYield,
    zcycSpread,
    theoreticalYield,
    keyRate,
    inflation,
    label,
    recommendation,
    riskWarning,
  };
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
    currentInflation,
    moexYtm,
    theoreticalYield,
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

  // Assess bond valuation relative to key rate and inflation
  const valuation = assessValuation(ytm, currentKeyRate, currentInflation, theoreticalYield);

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
    valuation,
  };
}
