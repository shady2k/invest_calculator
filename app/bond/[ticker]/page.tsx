'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Results, ExitTable, YieldChart } from '@/components';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ScenarioSelector } from '@/components/ScenarioSelector';
import { InvestmentCalculator } from '@/components/InvestmentCalculator';
import type { ChartType, CalculationResults, InflationScenario, RateScenarioId } from '@/types';
import type { BondSummary } from '@/lib/precalculate';

interface BondData {
  summary: BondSummary;
  results: CalculationResults;
}

export default function BondDetailPage(): React.ReactElement {
  const params = useParams();
  const searchParams = useSearchParams();
  const ticker = params.ticker as string;
  const initialScenario = searchParams.get('scenario') ?? 'base';

  const [scenario, setScenario] = useState(initialScenario);
  const [bondData, setBondData] = useState<BondData | null>(null);
  const [currentKeyRate, setCurrentKeyRate] = useState<number | null>(null);
  const [inflationScenarios, setInflationScenarios] = useState<Record<RateScenarioId, InflationScenario> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>('yield');

  useEffect(() => {
    async function fetchBond(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/calculated-bonds/${ticker}?scenario=${scenario}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Облигация не найдена');
          }
          throw new Error('Ошибка загрузки данных');
        }

        const data = await response.json();

        // Restore Date objects
        const results: CalculationResults = {
          ...data.results,
          exitResults: data.results.exitResults.map((exit: { date: string }) => ({
            ...exit,
            date: new Date(exit.date),
          })),
          optimalExit: {
            ...data.results.optimalExit,
            date: new Date(data.results.optimalExit.date),
          },
          parExit: {
            ...data.results.parExit,
            date: new Date(data.results.parExit.date),
          },
        };

        setBondData({ summary: data.summary, results });

        // Get current key rate and inflation scenarios
        const [listResponse, inflationResponse] = await Promise.all([
          fetch(`/api/calculated-bonds?scenario=${scenario}`),
          fetch('/api/inflation'),
        ]);

        if (listResponse.ok) {
          const listData = await listResponse.json();
          setCurrentKeyRate(listData.currentKeyRate);
        }

        if (inflationResponse.ok) {
          const inflationData = await inflationResponse.json();
          setInflationScenarios(inflationData.scenarios);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      } finally {
        setLoading(false);
      }
    }

    fetchBond();
  }, [ticker, scenario]);

  const handleScenarioChange = (newScenario: string): void => {
    setScenario(newScenario);
    // Update URL without navigation
    window.history.replaceState(null, '', `/bond/${ticker}?scenario=${newScenario}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 transition-colors">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Загрузка...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !bondData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 transition-colors">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center py-24">
            <p className="text-red-500 dark:text-red-400 mb-4">
              {error ?? 'Данные не найдены'}
            </p>
            <Link
              href="/"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Вернуться к списку
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { summary, results } = bondData;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 transition-colors">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8 relative">
          <div className="absolute right-0 top-0">
            <ThemeToggle />
          </div>

          <Link
            href={`/?scenario=${scenario}`}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm mb-2 inline-block"
          >
            ← К списку облигаций
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {summary.name}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {summary.ticker} • Погашение:{' '}
            {summary.maturityDate
              ? new Date(summary.maturityDate).toLocaleDateString('ru-RU')
              : '—'}
          </p>
        </div>

        {/* Scenario selector */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800 pb-2 mb-4">
            Сценарий прогноза
          </h2>
          <ScenarioSelector
            selectedId={scenario}
            onSelect={handleScenarioChange}
            currentKeyRate={currentKeyRate}
            inflationScenarios={inflationScenarios}
          />
        </div>

        {/* Bond info summary */}
        <div className="card mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Цена</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {summary.price?.toFixed(2) ?? '—'} ₽
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">НКД</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {summary.accruedInterest?.toFixed(2) ?? '—'} ₽
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Цена + НКД</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {summary.priceWithAci?.toFixed(2) ?? '—'} ₽
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">YTM MOEX</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {summary.moexYtm?.toFixed(2) ?? '—'}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Реальная дох.</div>
              <div className="text-xl font-semibold text-green-600 dark:text-green-400">
                {summary.realYield.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Оптим. выход</div>
              <div className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                {summary.optimalExitYield.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mb-6">
          <Results results={results} />
        </div>

        {/* Investment Calculator */}
        {inflationScenarios ? (
          <div className="mb-6">
            <InvestmentCalculator
              results={results}
              inflationScenarios={inflationScenarios}
              selectedScenario={scenario as RateScenarioId}
            />
          </div>
        ) : null}

        {/* Chart */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800 pb-2 mb-4">
            Доходность при выходе в разные даты
          </h2>
          <YieldChart
            exits={results.exitResults}
            chartType={chartType}
            onChartTypeChange={setChartType}
          />
        </div>

        {/* Exit table */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800 pb-2 mb-4">
            Детализация по периодам
          </h2>
          <ExitTable
            exits={results.exitResults}
            nominal={results.nominal}
            parExitDate={results.parExit.date}
          />
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-400">
          Данные с Московской биржи (MOEX) и ЦБ РФ
        </div>
      </div>
    </div>
  );
}
