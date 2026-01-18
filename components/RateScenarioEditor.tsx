'use client';

import type { RateScenarioItem } from '@/types';
import { useScenarios } from '@/hooks/useScenarios';
import type { ApiClient } from '@/lib/api-client';

interface RateScenarioEditorProps {
  scenario: RateScenarioItem[];
  onChange: (scenario: RateScenarioItem[]) => void;
  currentKeyRate: number | null;
  selectedScenarioId: string;
  onScenarioSelect: (id: string) => void;
  apiClient?: ApiClient;
}

export function RateScenarioEditor({
  scenario,
  onChange,
  currentKeyRate,
  selectedScenarioId,
  onScenarioSelect,
  apiClient,
}: RateScenarioEditorProps): React.ReactElement {
  const { scenarios, loading } = useScenarios({ apiClient });

  const handleScenarioSelect = (id: string): void => {
    onScenarioSelect(id);
    const selected = scenarios[id];
    if (selected) {
      // Update first rate with current CBR rate if available
      const rates = [...selected.rates];
      if (currentKeyRate !== null && rates.length > 0 && rates[0]) {
        rates[0] = { ...rates[0], rate: currentKeyRate };
      }
      onChange(rates);
    }
  };

  const handleRateChange = (
    index: number,
    field: 'date' | 'rate',
    value: string | number
  ): void => {
    const updated = [...scenario];
    const item = updated[index];
    if (item) {
      if (field === 'date') {
        updated[index] = { ...item, date: value as string };
      } else {
        updated[index] = { ...item, rate: value as number };
      }
      onChange(updated);
    }
  };

  const addPeriod = (): void => {
    const lastItem = scenario[scenario.length - 1];
    const lastDate = lastItem ? new Date(lastItem.date) : new Date();
    lastDate.setMonth(lastDate.getMonth() + 6);

    onChange([
      ...scenario,
      {
        date: lastDate.toISOString().split('T')[0] ?? '',
        rate: lastItem?.rate ?? 10,
      },
    ]);
  };

  const removePeriod = (index: number): void => {
    if (scenario.length > 1) {
      onChange(scenario.filter((_, i) => i !== index));
    }
  };

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400">Загрузка сценариев...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Scenario presets */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(scenarios).map(([id, scn]) => (
          <button
            key={id}
            onClick={() => handleScenarioSelect(id)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              selectedScenarioId === id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400'
            }`}
          >
            {scn.name}
          </button>
        ))}
      </div>

      {/* Current key rate info */}
      {currentKeyRate !== null && (
        <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg text-sm">
          <span className="text-green-800 dark:text-green-300">
            Текущая ключевая ставка ЦБ:{' '}
            <span className="font-bold">{currentKeyRate}%</span>
          </span>
        </div>
      )}

      {/* Rate schedule */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {scenario.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="date"
              value={item.date}
              onChange={(e) => handleRateChange(index, 'date', e.target.value)}
              className="input-sm flex-1"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.5"
                value={item.rate}
                onChange={(e) =>
                  handleRateChange(index, 'rate', parseFloat(e.target.value) || 0)
                }
                className="input-sm w-20 text-right"
              />
              <span className="text-gray-500 dark:text-gray-400">%</span>
            </div>
            {scenario.length > 1 && (
              <button
                onClick={() => removePeriod(index)}
                className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                title="Удалить"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addPeriod}
        className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
      >
        + Добавить период
      </button>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Укажите прогноз ключевой ставки. Для прошлых дат используются реальные
        данные ЦБ.
      </p>
    </div>
  );
}
