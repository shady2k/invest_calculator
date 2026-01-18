'use client';

import { useState } from 'react';
import { useScenarios } from '@/hooks/useScenarios';
import { RateScenarioPreview } from './RateScenarioPreview';
import type { InflationScenario, RateScenarioId } from '@/types';

interface ScenarioSelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
  currentKeyRate: number | null;
  inflationScenarios?: Record<RateScenarioId, InflationScenario> | null;
}

export function ScenarioSelector({
  selectedId,
  onSelect,
  currentKeyRate,
  inflationScenarios,
}: ScenarioSelectorProps): React.ReactElement {
  const { scenarios, loading } = useScenarios();
  const [showDetails, setShowDetails] = useState(false);

  // Get current inflation from selected scenario
  const currentInflation = inflationScenarios?.[selectedId as RateScenarioId];
  const inflationRate = currentInflation?.rates?.find((r) => {
    const rateDate = new Date(r.date);
    const now = new Date();
    return rateDate <= now;
  })?.rate ?? currentInflation?.rates?.[0]?.rate;

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400">Загрузка...</div>;
  }

  const selectedScenario = scenarios[selectedId];

  return (
    <div className="space-y-3">
      {/* Current rates */}
      {(currentKeyRate !== null || inflationRate !== undefined) ? (
        <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-green-800 dark:text-green-300">
            {currentKeyRate !== null ? (
              <span>
                Ключевая ставка ЦБ:{' '}
                <span className="font-bold">{currentKeyRate}%</span>
              </span>
            ) : null}
            {inflationRate !== undefined ? (
              <span>
                Прогноз инфляции:{' '}
                <span className="font-bold">{inflationRate}%</span>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Scenario buttons */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(scenarios).map(([id, scn]) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
              selectedId === id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400'
            }`}
            title={scn.description}
          >
            {scn.name}
          </button>
        ))}
      </div>

      {/* Scenario description with toggle */}
      {selectedScenario ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selectedScenario.description}
          </p>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline ml-4 whitespace-nowrap"
          >
            {showDetails ? 'Скрыть детали' : 'Показать детали'}
          </button>
        </div>
      ) : null}

      {/* Scenario details (table + chart) */}
      {showDetails && selectedScenario ? (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <RateScenarioPreview
            rates={selectedScenario.rates}
            scenarioName={selectedScenario.name}
            currentKeyRate={currentKeyRate ?? undefined}
            inflationRates={currentInflation?.rates}
          />
        </div>
      ) : null}
    </div>
  );
}
