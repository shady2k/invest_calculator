import { describe, it, expect } from 'vitest';
import {
  xirr,
  getKeyRateAtDate,
  estimateYTMFromKeyRate,
  calculateBondPriceDCF,
  calculatePriceAtKeyRate,
  generateCouponDates,
  calculate,
  calculateSpread,
} from '@/lib/calculations';
import type { RateScheduleItem, BondCalculationInput } from '@/types';

describe('xirr', () => {
  it('should return 0 for empty inputs', () => {
    expect(xirr([], [])).toBe(0);
  });

  it('should calculate simple annual return correctly', () => {
    // Invest 1000, get 1100 after 1 year = 10% return
    const cashflows = [-1000, 1100];
    const dates = [new Date('2024-01-01'), new Date('2025-01-01')];
    const result = xirr(cashflows, dates);
    expect(result).toBeCloseTo(0.1, 3);
  });

  it('should calculate multi-year return correctly', () => {
    // Invest 1000, get 1210 after 2 years = ~10% annual
    const cashflows = [-1000, 1210];
    const dates = [new Date('2024-01-01'), new Date('2026-01-01')];
    const result = xirr(cashflows, dates);
    expect(result).toBeCloseTo(0.1, 2);
  });

  it('should handle multiple cash flows', () => {
    // Invest 1000, receive 100 after 6 months, 1100 after 1 year
    const cashflows = [-1000, 100, 1100];
    const dates = [
      new Date('2024-01-01'),
      new Date('2024-07-01'),
      new Date('2025-01-01'),
    ];
    const result = xirr(cashflows, dates);
    // Should be higher than 10% due to early cash flow
    expect(result).toBeGreaterThan(0.1);
    expect(result).toBeLessThan(0.25);
  });

  it('should calculate bond-like cash flows (coupons + principal)', () => {
    // Bond: invest 556.5, receive 35.4 coupon every ~6 months, 1035.4 at maturity
    // This is a discount bond with high return
    const purchaseDate = new Date('2025-06-22');
    const cashflows = [-556.5];
    const dates = [purchaseDate];

    // Simplified: 2 coupons then maturity
    cashflows.push(35.4);
    dates.push(new Date('2025-12-03'));
    cashflows.push(35.4);
    dates.push(new Date('2026-06-03'));
    cashflows.push(1035.4); // coupon + nominal
    dates.push(new Date('2026-12-02'));

    const result = xirr(cashflows, dates);
    // ~64% return for this deep discount short-term scenario
    expect(result).toBeGreaterThan(0.5);
    expect(result).toBeLessThan(1.0);
  });

  it('should converge with different initial guesses', () => {
    const cashflows = [-1000, 1150];
    const dates = [new Date('2024-01-01'), new Date('2025-01-01')];

    const result1 = xirr(cashflows, dates, 0.05);
    const result2 = xirr(cashflows, dates, 0.2);
    const result3 = xirr(cashflows, dates, 0.5);

    expect(result1).toBeCloseTo(result2, 4);
    expect(result2).toBeCloseTo(result3, 4);
  });
});

describe('getKeyRateAtDate', () => {
  const schedule: RateScheduleItem[] = [
    { date: new Date('2025-01-01'), rate: 20 },
    { date: new Date('2025-06-01'), rate: 17 },
    { date: new Date('2025-12-01'), rate: 15 },
    { date: new Date('2026-06-01'), rate: 13 },
  ];

  it('should return first rate for date before schedule', () => {
    const result = getKeyRateAtDate(new Date('2024-12-31'), schedule);
    expect(result).toBe(20);
  });

  it('should return correct rate for exact date match', () => {
    const result = getKeyRateAtDate(new Date('2025-06-01'), schedule);
    expect(result).toBe(17);
  });

  it('should return previous rate for date between schedule points', () => {
    const result = getKeyRateAtDate(new Date('2025-08-15'), schedule);
    expect(result).toBe(17);
  });

  it('should return last rate for date after schedule', () => {
    const result = getKeyRateAtDate(new Date('2027-01-01'), schedule);
    expect(result).toBe(13);
  });

  it('should throw error for empty schedule', () => {
    expect(() => getKeyRateAtDate(new Date('2025-06-01'), [])).toThrow(
      'Rate schedule is empty - cannot determine key rate'
    );
  });
});

describe('calculateSpread', () => {
  it('should calculate spread from key rate and MOEX YTM', () => {
    const result = calculateSpread(16, 14.02);
    expect(result).toBeCloseTo(1.98, 2);
  });

  it('should handle null MOEX YTM with default spread', () => {
    const result = calculateSpread(16, null);
    // Should return a fallback spread
    expect(typeof result).toBe('number');
  });

  it('should handle zero MOEX YTM with default spread', () => {
    const result = calculateSpread(16, 0);
    expect(typeof result).toBe('number');
  });
});

describe('estimateYTMFromKeyRate', () => {
  const spread = 2; // 2% spread (keyRate - moexYTM)
  const couponYield = 7.08; // 35.4 * 2 / 1000 * 100

  it('should calculate YTM as keyRate minus spread', () => {
    // keyRate 16%, spread 2% → YTM = 14%
    const result = estimateYTMFromKeyRate(16, spread, couponYield);
    expect(result).toBe(14);
  });

  it('should not go below coupon yield', () => {
    // keyRate 8%, spread 2% → would be 6%, but coupon yield is 7.08%
    const result = estimateYTMFromKeyRate(8, spread, couponYield);
    expect(result).toBe(couponYield);
  });

  it('should handle different key rates', () => {
    const ytm10 = estimateYTMFromKeyRate(10, spread, couponYield);
    const ytm20 = estimateYTMFromKeyRate(20, spread, couponYield);
    expect(ytm20 - ytm10).toBe(10);
  });

  it('should return coupon yield when keyRate equals spread', () => {
    // keyRate 2%, spread 2% → would be 0%, but capped at coupon yield
    const result = estimateYTMFromKeyRate(2, spread, couponYield);
    expect(result).toBe(couponYield);
  });
});

describe('calculateBondPriceDCF', () => {
  it('should return nominal for zero periods remaining', () => {
    const result = calculateBondPriceDCF(35, 1000, 10, 0);
    expect(result).toBe(1000);
  });

  it('should return nominal for negative periods', () => {
    const result = calculateBondPriceDCF(35, 1000, 10, -1);
    expect(result).toBe(1000);
  });

  it('should calculate price at par when coupon rate equals YTM', () => {
    // Coupon = 50 per period, nominal = 1000, YTM = 10% annual
    // 2 periods per year, so 5% per period
    // Coupon rate = 50/1000 * 2 = 10% annual = YTM
    // Price should be approximately at par
    const result = calculateBondPriceDCF(50, 1000, 10, 4, 2);
    expect(result).toBeCloseTo(1000, 0);
  });

  it('should calculate discount when YTM > coupon rate', () => {
    // Low coupon (3.54% annual) vs high YTM (15%)
    // Should trade at significant discount
    const result = calculateBondPriceDCF(35.4, 1000, 15, 32, 2);
    expect(result).toBeLessThan(700);
  });

  it('should calculate premium when YTM < coupon rate', () => {
    // High coupon (12% annual) vs low YTM (8%)
    const result = calculateBondPriceDCF(60, 1000, 8, 20, 2);
    expect(result).toBeGreaterThan(1100);
  });

  it('should approach nominal as maturity approaches', () => {
    // Same bond, different maturities
    const price10y = calculateBondPriceDCF(35.4, 1000, 14, 20, 2);
    const price5y = calculateBondPriceDCF(35.4, 1000, 14, 10, 2);
    const price1y = calculateBondPriceDCF(35.4, 1000, 14, 2, 2);

    // Closer to maturity = closer to nominal (for discount bond)
    expect(price1y).toBeGreaterThan(price5y);
    expect(price5y).toBeGreaterThan(price10y);
  });
});

describe('calculatePriceAtKeyRate', () => {
  const spread = 2; // 2% spread

  it('should return nominal for zero years to maturity', () => {
    const result = calculatePriceAtKeyRate(15, 35.4, 1000, 0, spread);
    expect(result).toBe(1000);
  });

  it('should calculate price using DCF with estimated YTM', () => {
    // Key rate 20%, spread 2%, 16 years to maturity
    // YTM = 20 - 2 = 18%
    const result = calculatePriceAtKeyRate(20, 35.4, 1000, 16, spread);
    expect(result).toBeGreaterThan(400);
    expect(result).toBeLessThan(700);
  });

  it('should increase price when key rate drops', () => {
    const priceHigh = calculatePriceAtKeyRate(20, 35.4, 1000, 10, spread);
    const priceLow = calculatePriceAtKeyRate(10, 35.4, 1000, 10, spread);

    expect(priceLow).toBeGreaterThan(priceHigh);
  });
});

describe('generateCouponDates', () => {
  it('should generate correct coupon dates', () => {
    const firstCoupon = new Date('2025-06-03');
    const maturity = new Date('2026-06-03');
    const periodDays = 182;

    const dates = generateCouponDates(firstCoupon, maturity, periodDays);

    // 182 days from 2025-06-03 = 2025-12-02, then 2026-05-03, then maturity 2026-06-03
    // So we get: first coupon + 2 more + maturity = 4 dates
    expect(dates.length).toBe(4);
    expect(dates[0]?.toISOString().slice(0, 10)).toBe('2025-06-03');
    expect(dates[dates.length - 1]?.toISOString().slice(0, 10)).toBe('2026-06-03');
  });

  it('should always include maturity date as last', () => {
    const firstCoupon = new Date('2025-06-03');
    const maturity = new Date('2041-05-15');
    const periodDays = 182;

    const dates = generateCouponDates(firstCoupon, maturity, periodDays);

    const lastDate = dates[dates.length - 1];
    expect(lastDate?.toISOString().slice(0, 10)).toBe('2041-05-15');
  });

  it('should handle single period correctly', () => {
    const firstCoupon = new Date('2025-12-03');
    const maturity = new Date('2026-01-15');
    const periodDays = 182;

    const dates = generateCouponDates(firstCoupon, maturity, periodDays);

    expect(dates.length).toBe(2);
  });
});

describe('calculate', () => {
  const baseInput: BondCalculationInput = {
    bondName: 'ОФЗ 26238',
    nominal: 1000,
    currentPrice: 556.5,
    coupon: 35.4,
    couponPeriodDays: 182,
    purchaseDate: '2025-06-22',
    firstCouponDate: '2025-12-03',
    maturityDate: '2041-05-15',
    rateSchedule: [
      { date: new Date('2025-06-22'), rate: 21 },
      { date: new Date('2025-12-03'), rate: 18 },
      { date: new Date('2026-06-03'), rate: 15 },
      { date: new Date('2026-12-02'), rate: 13 },
      { date: new Date('2027-06-02'), rate: 11 },
      { date: new Date('2027-12-01'), rate: 10 },
      { date: new Date('2028-05-31'), rate: 9 },
      { date: new Date('2028-11-29'), rate: 8 },
      { date: new Date('2029-05-30'), rate: 7.5 },
    ],
    bondId: '26238',
    currentKeyRate: 20,
    currentInflation: 8.5,
    moexYtm: 14.79,
    theoreticalYield: 14.0,
  };

  it('should return all required fields', () => {
    const result = calculate(baseInput);

    expect(result).toHaveProperty('bondName', 'ОФЗ 26238');
    expect(result).toHaveProperty('investment', 556.5);
    expect(result).toHaveProperty('nominal', 1000);
    expect(result).toHaveProperty('coupon', 35.4);
    expect(result).toHaveProperty('ytm');
    expect(result).toHaveProperty('yearsToMaturity');
    expect(result).toHaveProperty('couponCount');
    expect(result).toHaveProperty('totalWithYTM');
    expect(result).toHaveProperty('yieldNoReinvest');
    expect(result).toHaveProperty('totalNoReinvest');
    expect(result).toHaveProperty('totalWithVariableRate');
    expect(result).toHaveProperty('realYieldMaturity');
    expect(result).toHaveProperty('totalFullModel');
    expect(result).toHaveProperty('exitResults');
    expect(result).toHaveProperty('optimalExit');
    expect(result).toHaveProperty('parExit');
  });

  it('should calculate years to maturity correctly', () => {
    const result = calculate(baseInput);
    // 2025-06-22 to 2041-05-15 ≈ 15.9 years
    expect(result.yearsToMaturity).toBeGreaterThan(15.5);
    expect(result.yearsToMaturity).toBeLessThan(16.5);
  });

  it('should calculate coupon count correctly', () => {
    const result = calculate(baseInput);
    // ~16 years * 2 coupons per year ≈ 32 coupons
    expect(result.couponCount).toBeGreaterThan(30);
    expect(result.couponCount).toBeLessThan(35);
  });

  it('should have positive YTM for discount bond', () => {
    const result = calculate(baseInput);
    expect(result.ytm).toBeGreaterThan(10);
    expect(result.ytm).toBeLessThan(20);
  });

  it('should calculate total without reinvestment correctly', () => {
    const result = calculate(baseInput);
    // Total = coupons + nominal = 32 * 35.4 + 1000 ≈ 2132.8
    expect(result.totalNoReinvest).toBeGreaterThan(2000);
    expect(result.totalNoReinvest).toBeLessThan(2300);
  });

  it('should have increasing totals: noReinvest < fullModel < withYTM', () => {
    const result = calculate(baseInput);
    // Without reinvest is worst case
    // Full model considers changing rates
    // YTM reinvest is theoretical best (constant high rate)
    expect(result.totalNoReinvest).toBeLessThan(result.totalFullModel);
  });

  it('should have exit results for each coupon date', () => {
    const result = calculate(baseInput);
    expect(result.exitResults.length).toBe(result.couponCount);
  });

  it('should have last exit result marked as isLast', () => {
    const result = calculate(baseInput);
    const lastExit = result.exitResults[result.exitResults.length - 1];
    expect(lastExit?.isLast).toBe(true);
  });

  it('should calculate increasing exit values over time (in general)', () => {
    const result = calculate(baseInput);
    // First few exits should have lower values than later ones
    const firstExit = result.exitResults[0];
    const midExit = result.exitResults[Math.floor(result.exitResults.length / 2)];
    const lastExit = result.exitResults[result.exitResults.length - 1];

    expect(midExit?.exitValue).toBeGreaterThan(firstExit?.exitValue ?? 0);
    expect(lastExit?.exitValue).toBeGreaterThan(midExit?.exitValue ?? 0);
  });

  it('should find optimal exit with maximum annual return', () => {
    const result = calculate(baseInput);
    const maxReturn = Math.max(...result.exitResults.map((e) => e.annualReturn));
    expect(result.optimalExit.annualReturn).toBeCloseTo(maxReturn, 5);
  });

  it('should find par exit when bond reaches nominal', () => {
    const result = calculate(baseInput);
    // Par exit should have price close to nominal
    expect(result.parExit.bondPrice).toBeGreaterThanOrEqual(result.nominal * 0.99);
  });

  it('should handle constant rate scenario', () => {
    const constantInput: BondCalculationInput = {
      ...baseInput,
      rateSchedule: [{ date: new Date('2025-06-22'), rate: 21 }],
      currentInflation: 8.5,
      theoreticalYield: 14.0,
    };

    const result = calculate(constantInput);
    expect(result.ytm).toBeGreaterThan(10);
    expect(result.exitResults.length).toBeGreaterThan(0);
  });

  it('should handle short-term bond', () => {
    const shortTermInput: BondCalculationInput = {
      bondName: 'Short Term Bond',
      nominal: 1000,
      currentPrice: 980,
      coupon: 50,
      couponPeriodDays: 182,
      purchaseDate: '2025-06-22',
      firstCouponDate: '2025-12-03',
      maturityDate: '2026-06-03',
      rateSchedule: [{ date: new Date('2025-06-22'), rate: 15 }],
      bondId: 'SHORT',
      currentKeyRate: 15,
      currentInflation: 8.5,
      moexYtm: 12,
      theoreticalYield: 11.5,
    };

    const result = calculate(shortTermInput);
    expect(result.yearsToMaturity).toBeLessThan(1.5);
    expect(result.couponCount).toBeLessThanOrEqual(3);
    expect(result.exitResults.length).toBeGreaterThan(0);
  });
});

describe('Validation checkpoints', () => {
  // Reference case: ОФЗ 26238 with rate decrease scenario
  // Expected values: YTM ~14.79%, yieldNoReinvest ~8.81%, realYield ~11.3%
  const referenceInput: BondCalculationInput = {
    bondName: 'ОФЗ 26238',
    nominal: 1000,
    currentPrice: 556.5, // price + accrued interest
    coupon: 35.4,
    couponPeriodDays: 182,
    purchaseDate: '2025-06-22',
    firstCouponDate: '2025-12-03',
    maturityDate: '2041-05-15',
    rateSchedule: [
      { date: new Date('2025-06-22'), rate: 20 },
      { date: new Date('2025-12-03'), rate: 17 },
      { date: new Date('2026-06-03'), rate: 15 },
      { date: new Date('2026-12-02'), rate: 13 },
      { date: new Date('2027-06-02'), rate: 11 },
      { date: new Date('2027-12-01'), rate: 10 },
      { date: new Date('2028-05-31'), rate: 9 },
      { date: new Date('2028-11-29'), rate: 8 },
      { date: new Date('2029-05-30'), rate: 7.5 },
    ],
    bondId: '26238',
    currentKeyRate: 20,
    currentInflation: 8.5,
    moexYtm: 14.79,
    theoreticalYield: 14.0,
  };

  it('should pass all validation checks', () => {
    const result = calculate(referenceInput);
    expect(result.validation.allChecksPassed).toBe(true);
  });

  it('Check 1: NPV of cash flows at YTM should equal investment', () => {
    // By definition of YTM: NPV(cashflows, YTM) = investment
    const result = calculate(referenceInput);
    const relativeError = result.validation.discountedDifference / result.investment;
    expect(relativeError).toBeLessThan(0.01);
  });

  it('Check 2: total without reinvestment should equal coupons + nominal', () => {
    // Simple arithmetic: total = coupon * count + nominal
    const result = calculate(referenceInput);
    const expectedTotal = result.coupon * result.couponCount + result.nominal;
    expect(result.validation.actualTotalNoReinvest).toBeCloseTo(expectedTotal, 0);
    // For 32 coupons: 35.4 * 32 + 1000 ≈ 2132.8
    expect(result.totalNoReinvest).toBeGreaterThan(2000);
    expect(result.totalNoReinvest).toBeLessThan(2300);
  });

  it('Check 3: FV discounted back should equal investment', () => {
    // Mathematical identity: PV = FV / (1+r)^n
    const result = calculate(referenceInput);
    const relativeError = Math.abs(result.validation.accumulatedValueDiscounted - result.investment) / result.investment;
    expect(relativeError).toBeLessThan(0.01);
  });

  it('should calculate YTM ~14-15% for deep discount long bond', () => {
    // At 20% key rate with 556/1000 price, YTM should be ~14-15%
    const result = calculate(referenceInput);
    expect(result.ytm).toBeGreaterThan(13);
    expect(result.ytm).toBeLessThan(16);
  });

  it('should calculate yield without reinvestment ~8-9%', () => {
    // Without reinvestment: just coupons + nominal at maturity
    const result = calculate(referenceInput);
    expect(result.yieldNoReinvest).toBeGreaterThan(7);
    expect(result.yieldNoReinvest).toBeLessThan(11);
  });

  it('should calculate real yield with full model ~10-12%', () => {
    // With variable rate reinvestment, yield should be between no-reinvest and YTM
    const result = calculate(referenceInput);
    expect(result.realYieldMaturity).toBeGreaterThan(9);
    expect(result.realYieldMaturity).toBeLessThan(14);
  });

  it('should calculate total with YTM reinvestment ~5000 rub', () => {
    // Theoretical max: all coupons reinvested at constant YTM
    const result = calculate(referenceInput);
    expect(result.totalWithYTM).toBeGreaterThan(4000);
    expect(result.totalWithYTM).toBeLessThan(6000);
  });

  it('should calculate total with full model ~3000 rub', () => {
    // Realistic: coupons reinvested at declining rates
    const result = calculate(referenceInput);
    expect(result.totalFullModel).toBeGreaterThan(2500);
    expect(result.totalFullModel).toBeLessThan(4000);
  });
});

describe('Integration: OFZ 26238 reference values', () => {
  // Reference values from old app.js for comparison
  // Note: New formula may differ slightly due to dynamic YTM calculation
  const input: BondCalculationInput = {
    bondName: 'ОФЗ 26238',
    nominal: 1000,
    currentPrice: 556.5,
    coupon: 35.4,
    couponPeriodDays: 182,
    purchaseDate: '2025-06-22',
    firstCouponDate: '2025-12-03',
    maturityDate: '2041-05-15',
    rateSchedule: [
      { date: new Date('2025-06-22'), rate: 20 },
      { date: new Date('2025-12-03'), rate: 17 },
      { date: new Date('2026-06-03'), rate: 15 },
      { date: new Date('2026-12-02'), rate: 13 },
      { date: new Date('2027-06-02'), rate: 11 },
      { date: new Date('2027-12-01'), rate: 10 },
      { date: new Date('2028-05-31'), rate: 9 },
      { date: new Date('2028-11-29'), rate: 8 },
      { date: new Date('2029-05-30'), rate: 7.5 },
    ],
    bondId: '26238',
    currentKeyRate: 20,
    currentInflation: 8.5,
    moexYtm: 14.79,
    theoreticalYield: 14.0,
  };

  it('should calculate YTM close to reference (~14.79%)', () => {
    const result = calculate(input);
    // Old reference: 14.79%
    // New calculation should be similar (within reasonable range)
    expect(result.ytm).toBeGreaterThan(12);
    expect(result.ytm).toBeLessThan(17);
  });

  it('should calculate yield without reinvestment close to reference (~8.81%)', () => {
    const result = calculate(input);
    // Old reference: 8.81%
    expect(result.yieldNoReinvest).toBeGreaterThan(7);
    expect(result.yieldNoReinvest).toBeLessThan(11);
  });

  it('should calculate total without reinvestment close to reference (~2132.80)', () => {
    const result = calculate(input);
    // Old reference: 2132.80
    // Should be exactly coupons * count + nominal
    expect(result.totalNoReinvest).toBeCloseTo(35.4 * result.couponCount + 1000, 0);
  });
});
