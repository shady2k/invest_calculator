'use client';

import { Suspense, useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BondsList,
  ScenarioSelector,
  BondRecommendations,
  BondFilters,
  filterBonds,
} from '@/components';
import type { DurationFilter, ValuationFilter } from '@/components';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useCalculatedBonds } from '@/hooks';
import type { InflationScenario, RateScenarioId } from '@/types';

function HomeContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialScenario = searchParams.get('scenario') ?? 'base';

  const [selectedScenario, setSelectedScenario] = useState(initialScenario);
  const [inflationScenarios, setInflationScenarios] = useState<Record<RateScenarioId, InflationScenario> | null>(null);
  const { bonds, currentKeyRate, loading, isCalculating, error, refetch } = useCalculatedBonds(selectedScenario);

  // Filter state
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all');
  const [valuationFilter, setValuationFilter] = useState<ValuationFilter>('all');
  const [minYield, setMinYield] = useState(0);

  // Filtered bonds
  const filteredBonds = useMemo(
    () => filterBonds(bonds, durationFilter, valuationFilter, minYield),
    [bonds, durationFilter, valuationFilter, minYield]
  );

  // Fetch inflation scenarios
  useEffect(() => {
    async function fetchInflation(): Promise<void> {
      try {
        const response = await fetch('/api/inflation');
        if (response.ok) {
          const data = await response.json();
          setInflationScenarios(data.scenarios);
        }
      } catch {
        // Ignore inflation fetch errors - it's not critical
      }
    }
    fetchInflation();
  }, []);

  const handleScenarioChange = useCallback((scenarioId: string): void => {
    setSelectedScenario(scenarioId);
    refetch(scenarioId);
    // Update URL without navigation
    window.history.replaceState(null, '', `/?scenario=${scenarioId}`);
  }, [refetch]);

  const handleBondSelect = useCallback((ticker: string): void => {
    router.push(`/bond/${ticker}?scenario=${selectedScenario}`);
  }, [router, selectedScenario]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 transition-colors">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8 relative">
          <div className="absolute right-0 top-0">
            <ThemeToggle />
          </div>
          <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            Калькулятор доходности ОФЗ
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Расчёт реальной доходности с учётом изменения ключевой ставки
          </p>
        </div>

        {/* Scenario selector */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800 pb-2 mb-4">
            Сценарий прогноза
          </h2>
          <ScenarioSelector
            selectedId={selectedScenario}
            onSelect={handleScenarioChange}
            currentKeyRate={currentKeyRate}
            inflationScenarios={inflationScenarios}
          />
        </div>

        {/* Error */}
        {error ? (
          <div className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
            Ошибка: {error}
          </div>
        ) : null}

        {/* Recommendations */}
        {bonds.length > 0 ? (
          <div className="card mb-6">
            <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800 pb-2 mb-4">
              Лучшие по категориям
            </h2>
            <BondRecommendations bonds={bonds} onSelect={handleBondSelect} />
          </div>
        ) : null}

        {/* Bonds list */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-blue-200 dark:border-blue-800 pb-2 mb-4">
            <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-400">
              Облигации ОФЗ
            </h2>
            {isCalculating ? (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-600 dark:border-amber-400 border-t-transparent" />
                <span>Загрузка данных...</span>
              </div>
            ) : null}
          </div>

          {/* Filters and statistics */}
          {bonds.length > 0 ? (
            <div className="mb-4">
              <BondFilters
                bonds={bonds}
                filteredCount={filteredBonds.length}
                durationFilter={durationFilter}
                valuationFilter={valuationFilter}
                minYield={minYield}
                onDurationChange={setDurationFilter}
                onValuationChange={setValuationFilter}
                onMinYieldChange={setMinYield}
              />
            </div>
          ) : null}

          <BondsList
            bonds={filteredBonds}
            loading={loading}
            onSelect={handleBondSelect}
          />
        </div>

        {/* Footer with disclaimer */}
        <div className="mt-8 space-y-3 text-center text-sm text-gray-400">
          <p>Данные с Московской биржи (MOEX) и ЦБ РФ</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 max-w-2xl mx-auto">
            Информация на данном сайте носит исключительно информационный характер,
            не является индивидуальной инвестиционной рекомендацией (ИИР) и не
            является офертой. Автор не несёт ответственности за инвестиционные
            решения, принятые на основе данной информации.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function HomePage(): React.ReactElement {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Загрузка...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
