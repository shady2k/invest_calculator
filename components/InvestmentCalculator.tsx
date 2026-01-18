'use client';

import { useState, useMemo } from 'react';
import type { CalculationResults, InflationScenario, RateScenarioId } from '@/types';
import {
  calculateInvestmentWithInflation,
  getAverageInflation,
  type InvestmentResult,
} from '@/lib/inflation';

interface InvestmentCalculatorProps {
  results: CalculationResults;
  inflationScenarios: Record<RateScenarioId, InflationScenario>;
  selectedScenario: RateScenarioId;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function ResultCard({
  title,
  result,
  isOptimal,
}: {
  title: string;
  result: InvestmentResult;
  isOptimal?: boolean;
}): React.ReactElement {
  const profitColor = result.realProfit >= 0
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div
      className={`p-4 rounded-lg border ${
        isOptimal
          ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
      }`}
    >
      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
        {title}
        {isOptimal ? (
          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded">
            Рекомендуется
          </span>
        ) : null}
      </h4>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Срок</span>
          <span className="font-medium">{result.years.toFixed(1)} лет</span>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-600 my-2" />

        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Номин. доходность</span>
          <span className="font-medium">{result.nominalYield.toFixed(1)}% годовых</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Реальн. доходность</span>
          <span className={`font-medium ${profitColor}`}>
            {result.realYield.toFixed(1)}% годовых
          </span>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-600 my-2" />

        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Получите (номин.)</span>
          <span className="font-medium">{formatMoney(result.nominalValue)} ₽</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">В ценах сегодня</span>
          <span className={`font-semibold ${profitColor}`}>
            {formatMoney(result.realValue)} ₽
          </span>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-600 my-2" />

        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Прибыль (номин.)</span>
          <span className="font-medium">
            +{formatMoney(result.nominalProfit)} ₽
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Прибыль (реальн.)</span>
          <span className={`font-semibold ${profitColor}`}>
            {result.realProfit >= 0 ? '+' : ''}{formatMoney(result.realProfit)} ₽
          </span>
        </div>

        <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Инфляция за период: {result.totalInflation.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

function formatInputMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function parseInputMoney(value: string): number {
  // Remove spaces and other formatting
  const cleaned = value.replace(/\s/g, '').replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

export function InvestmentCalculator({
  results,
  inflationScenarios,
  selectedScenario,
}: InvestmentCalculatorProps): React.ReactElement {
  const [investmentAmount, setInvestmentAmount] = useState(100000);
  const [inputValue, setInputValue] = useState(formatInputMoney(100000));

  const inflationScenario = inflationScenarios[selectedScenario];

  // Calculate number of bonds that can be purchased
  const bondsCount = useMemo(() => {
    return Math.floor(investmentAmount / results.investment);
  }, [investmentAmount, results.investment]);

  // Actual investment (adjusted to whole bonds)
  const actualInvestment = bondsCount * results.investment;

  // Get average inflation for each period
  const today = new Date();

  const maturityDate = new Date(
    today.getTime() + results.yearsToMaturity * 365 * 24 * 60 * 60 * 1000
  );
  const optimalExitDate = results.optimalExit.date;

  const avgInflationToMaturity = getAverageInflation(
    today,
    maturityDate,
    inflationScenario?.rates ?? []
  );

  const avgInflationToOptimal = getAverageInflation(
    today,
    optimalExitDate,
    inflationScenario?.rates ?? []
  );

  // Calculate results for both scenarios
  const maturityResult = useMemo((): InvestmentResult => {
    // Scale the nominal yield by the number of bonds
    const totalNominalReturn = results.realYieldMaturity;
    return calculateInvestmentWithInflation(
      actualInvestment,
      totalNominalReturn,
      results.yearsToMaturity,
      avgInflationToMaturity
    );
  }, [actualInvestment, results.realYieldMaturity, results.yearsToMaturity, avgInflationToMaturity]);

  const optimalResult = useMemo((): InvestmentResult => {
    return calculateInvestmentWithInflation(
      actualInvestment,
      results.optimalExit.annualReturn,
      results.optimalExit.years,
      avgInflationToOptimal
    );
  }, [actualInvestment, results.optimalExit, avgInflationToOptimal]);

  // Determine which option is better
  const isMaturyBetter = maturityResult.realYield > optimalResult.realYield;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800 pb-2 mb-4">
        Калькулятор доходности
      </h3>

      {/* Investment input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Сумма инвестиций
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="10000"
            max="1000000"
            step="10000"
            value={investmentAmount}
            onChange={(e) => {
              const value = Number(e.target.value);
              setInvestmentAmount(value);
              setInputValue(formatInputMoney(value));
            }}
            className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="w-36">
            <input
              type="text"
              inputMode="numeric"
              value={inputValue}
              onChange={(e) => {
                const raw = e.target.value;
                setInputValue(raw);
                const parsed = parseInputMoney(raw);
                if (parsed >= 10000) {
                  setInvestmentAmount(parsed);
                }
              }}
              onBlur={() => {
                // Format on blur
                const clamped = Math.max(10000, investmentAmount);
                setInvestmentAmount(clamped);
                setInputValue(formatInputMoney(clamped));
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-right"
            />
          </div>
          <span className="text-gray-500 dark:text-gray-400">₽</span>
        </div>

        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {bondsCount > 0 ? (
            <>
              Можно купить <span className="font-medium">{bondsCount}</span> облигаций
              за <span className="font-medium">{formatMoney(actualInvestment)} ₽</span>
            </>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">
              Минимальная сумма для покупки: {formatMoney(results.investment)} ₽
            </span>
          )}
        </div>
      </div>

      {/* Inflation info */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">
            Прогноз инфляции ({inflationScenario?.name ?? 'Базовый'})
          </span>
          <span className="font-medium text-gray-800 dark:text-gray-200">
            ~{avgInflationToMaturity.toFixed(1)}% в год
          </span>
        </div>
      </div>

      {/* Results comparison */}
      {bondsCount > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ResultCard
            title="До погашения"
            result={maturityResult}
            isOptimal={isMaturyBetter}
          />
          <ResultCard
            title="Оптимальный выход"
            result={optimalResult}
            isOptimal={!isMaturyBetter}
          />
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Увеличьте сумму инвестиций для расчёта
        </div>
      )}

      {/* Disclaimer */}
      <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
        * Расчёт носит информационный характер. Реальная доходность зависит от фактической инфляции
        и изменения ключевой ставки.
      </p>
    </div>
  );
}
