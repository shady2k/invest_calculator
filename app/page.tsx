'use client';

import { useState, useCallback } from 'react';
import { BondsList, ScenarioSelector, Results, ExitTable, YieldChart } from '@/components';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useCalculatedBonds } from '@/hooks';
import type { ChartType, CalculationResults } from '@/types';

interface BondDetails {
  ticker: string;
  results: CalculationResults;
}

export default function CalculatorPage(): React.ReactElement {
  const [selectedScenario, setSelectedScenario] = useState('base');
  const [selectedBond, setSelectedBond] = useState<BondDetails | null>(null);
  const [chartType, setChartType] = useState<ChartType>('yield');
  const [loadingDetails, setLoadingDetails] = useState(false);

  const { bonds, currentKeyRate, loading, error, refetch } = useCalculatedBonds(selectedScenario);

  const handleScenarioChange = useCallback((scenarioId: string): void => {
    setSelectedScenario(scenarioId);
    setSelectedBond(null);
    refetch(scenarioId);
  }, [refetch]);

  const handleBondSelect = useCallback(async (ticker: string): Promise<void> => {
    setLoadingDetails(true);
    try {
      const response = await fetch(
        `/api/calculated-bonds/${ticker}?scenario=${selectedScenario}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch bond details');
      }
      const data = await response.json();
      setSelectedBond({
        ticker,
        results: {
          ...data.results,
          // Restore Date objects
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
        },
      });
    } catch (err) {
      console.error('Failed to load bond details:', err);
    } finally {
      setLoadingDetails(false);
    }
  }, [selectedScenario]);

  const showResults = selectedBond !== null && selectedBond.results.exitResults.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 transition-colors">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8 relative">
          <div className="absolute right-0 top-0">
            <ThemeToggle />
          </div>
          <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            Калькулятор реальной доходности ОФЗ
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Расчёт доходности с учётом изменения ключевой ставки и реинвестирования купонов
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
        {error && (
          <div className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
            Ошибка: {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - Bonds list */}
          <div className="card">
            <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800 pb-2 mb-4">
              Облигации ОФЗ
            </h2>
            <BondsList
              bonds={bonds}
              loading={loading}
              onSelect={handleBondSelect}
              selectedTicker={selectedBond?.ticker}
            />
          </div>

          {/* Right column - Results */}
          <div className="space-y-6">
            {loadingDetails ? (
              <div className="card">
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              </div>
            ) : (
              <Results results={selectedBond?.results ?? null} />
            )}
          </div>
        </div>

        {/* Full width sections */}
        {showResults && (
          <>
            {/* Chart */}
            <div className="mt-6 card">
              <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800 pb-2 mb-4">
                Доходность при выходе в разные даты
              </h2>
              <YieldChart
                exits={selectedBond.results.exitResults}
                chartType={chartType}
                onChartTypeChange={setChartType}
              />
            </div>

            {/* Exit table */}
            <div className="mt-6 card">
              <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800 pb-2 mb-4">
                Детализация по периодам
              </h2>
              <ExitTable
                exits={selectedBond.results.exitResults}
                nominal={selectedBond.results.nominal}
                parExitDate={selectedBond.results.parExit.date}
              />
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-400">
          Данные с Московской биржи (MOEX) и ЦБ РФ
        </div>
      </div>
    </div>
  );
}
