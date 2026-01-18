'use client';

import { Suspense, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BondsList, ScenarioSelector } from '@/components';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useCalculatedBonds } from '@/hooks';

function HomeContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialScenario = searchParams.get('scenario') ?? 'base';

  const [selectedScenario, setSelectedScenario] = useState(initialScenario);
  const { bonds, currentKeyRate, loading, error, refetch } = useCalculatedBonds(selectedScenario);

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
            Прогноз ключевой ставки
          </h2>
          <ScenarioSelector
            selectedId={selectedScenario}
            onSelect={handleScenarioChange}
            currentKeyRate={currentKeyRate}
          />
        </div>

        {/* Error */}
        {error ? (
          <div className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
            Ошибка: {error}
          </div>
        ) : null}

        {/* Bonds list */}
        <div className="card">
          <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800 pb-2 mb-4">
            Облигации ОФЗ
          </h2>
          <BondsList
            bonds={bonds}
            loading={loading}
            onSelect={handleBondSelect}
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
