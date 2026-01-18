'use client';

import { useState } from 'react';
import type { ParsedBond } from '@/types';
import { useBonds } from '@/hooks/useBonds';
import type { ApiClient } from '@/lib/api-client';

interface BondSelectorProps {
  onSelect: (bond: ParsedBond) => void;
  selectedTicker?: string;
  apiClient?: ApiClient;
}

export function BondSelector({
  onSelect,
  selectedTicker,
  apiClient,
}: BondSelectorProps): React.ReactElement {
  const { bonds, loading, error } = useBonds({ apiClient });
  const [filter, setFilter] = useState('');

  const filteredBonds = bonds.filter(
    (bond) =>
      bond.name.toLowerCase().includes(filter.toLowerCase()) ||
      bond.ticker.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        Загрузка списка облигаций...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500 dark:text-red-400">
        Ошибка: {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Поиск облигации..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="input-base"
      />

      <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        {filteredBonds.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            Облигации не найдены
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredBonds.map((bond) => (
              <button
                key={bond.ticker}
                onClick={() => onSelect(bond)}
                className={`w-full px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors ${
                  selectedTicker === bond.ticker ? 'bg-blue-100 dark:bg-blue-900/50' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{bond.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{bond.ticker}</div>
                  </div>
                  <div className="text-right">
                    {bond.price !== null && (
                      <div className="font-medium text-gray-900 dark:text-gray-100">{bond.price.toFixed(2)} ₽</div>
                    )}
                    {bond.ytm !== null && (
                      <div className="text-sm text-green-600 dark:text-green-400">YTM: {bond.ytm.toFixed(2)}%</div>
                    )}
                  </div>
                </div>
                {bond.maturityDate ? (
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Погашение: {new Date(bond.maturityDate).toLocaleDateString('ru-RU')}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 dark:text-gray-500">
        Данные с Московской биржи (MOEX)
      </div>
    </div>
  );
}
