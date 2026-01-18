'use client';

import { useScenarios } from '@/hooks/useScenarios';

interface ScenarioSelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
  currentKeyRate: number | null;
}

export function ScenarioSelector({
  selectedId,
  onSelect,
  currentKeyRate,
}: ScenarioSelectorProps): React.ReactElement {
  const { scenarios, loading } = useScenarios();

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400">Загрузка...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Current key rate */}
      {currentKeyRate !== null && (
        <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
          <div className="text-sm text-green-800 dark:text-green-300">
            Текущая ключевая ставка ЦБ:{' '}
            <span className="font-bold">{currentKeyRate}%</span>
          </div>
        </div>
      )}

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

      {/* Scenario description */}
      {scenarios[selectedId] && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {scenarios[selectedId]?.description}
        </p>
      )}
    </div>
  );
}
