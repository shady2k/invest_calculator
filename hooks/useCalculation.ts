'use client';

import { useState, useCallback } from 'react';
import type {
  CalculationResults,
  BondCalculationInput,
  RateScheduleItem,
  RateScenarioItem,
  KeyRateData,
} from '@/types';
import { calculate } from '@/lib/calculations';
import { buildRateSchedule } from '@/lib/rate-schedule';

/**
 * Calculator function type for DI
 */
export type CalculatorFn = (input: BondCalculationInput) => CalculationResults;

/**
 * Rate schedule builder type for DI
 */
export type RateScheduleBuilderFn = (
  historicalRates: KeyRateData[],
  forecastScenario: RateScenarioItem[],
  startDate: Date
) => RateScheduleItem[];

interface UseCalculationOptions {
  calculator?: CalculatorFn;
  scheduleBuilder?: RateScheduleBuilderFn;
}

interface UseCalculationResult {
  results: CalculationResults | null;
  loading: boolean;
  error: string | null;
  calculate: (
    bondName: string,
    nominal: number,
    currentPrice: number,
    coupon: number,
    couponPeriodDays: number,
    purchaseDate: string,
    firstCouponDate: string,
    maturityDate: string,
    forecastScenario: RateScenarioItem[],
    historicalRates: KeyRateData[],
    currentKeyRate: number,
    moexYtm: number | null
  ) => void;
  reset: () => void;
}

export function useCalculation(
  options: UseCalculationOptions = {}
): UseCalculationResult {
  const {
    calculator = calculate,
    scheduleBuilder = buildRateSchedule,
  } = options;

  const [results, setResults] = useState<CalculationResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCalculation = useCallback(
    (
      bondName: string,
      nominal: number,
      currentPrice: number,
      coupon: number,
      couponPeriodDays: number,
      purchaseDate: string,
      firstCouponDate: string,
      maturityDate: string,
      forecastScenario: RateScenarioItem[],
      historicalRates: KeyRateData[],
      currentKeyRate: number,
      moexYtm: number | null
    ): void => {
      setLoading(true);
      setError(null);

      try {
        // Build rate schedule from historical + forecast
        const startDate = new Date(purchaseDate);
        const rateSchedule = scheduleBuilder(
          historicalRates,
          forecastScenario,
          startDate
        );

        const input: BondCalculationInput = {
          bondName,
          nominal,
          currentPrice,
          coupon,
          couponPeriodDays,
          purchaseDate,
          firstCouponDate,
          maturityDate,
          rateSchedule,
          bondId: bondName,
          currentKeyRate,
          moexYtm,
        };

        const calculationResults = calculator(input);
        setResults(calculationResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Calculation error');
      } finally {
        setLoading(false);
      }
    },
    [calculator, scheduleBuilder]
  );

  const reset = useCallback((): void => {
    setResults(null);
    setError(null);
  }, []);

  return {
    results,
    loading,
    error,
    calculate: runCalculation,
    reset,
  };
}
