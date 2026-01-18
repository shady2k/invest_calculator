'use client';

import { useMemo } from 'react';
import type { BondSummary } from '@/lib/precalculate';
import { DURATION_SHORT_MAX, DURATION_MEDIUM_MAX } from '@/lib/constants';

export type DurationFilter = 'all' | 'short' | 'medium' | 'long';
export type ValuationFilter = 'all' | 'oversold' | 'fair' | 'overbought';

interface BondFiltersProps {
  bonds: BondSummary[];
  filteredCount: number;
  durationFilter: DurationFilter;
  valuationFilter: ValuationFilter;
  minYield: number;
  onDurationChange: (value: DurationFilter) => void;
  onValuationChange: (value: ValuationFilter) => void;
  onMinYieldChange: (value: number) => void;
}

export function BondFilters({
  bonds,
  filteredCount,
  durationFilter,
  valuationFilter,
  minYield,
  onDurationChange,
  onValuationChange,
  onMinYieldChange,
}: BondFiltersProps): React.ReactElement {
  // Calculate statistics
  const stats = useMemo(() => {
    if (bonds.length === 0) {
      return { avgYield: 0, maxYield: 0, oversoldCount: 0 };
    }

    const yields = bonds.map((b) => b.realYield);
    const avgYield = yields.reduce((sum, y) => sum + y, 0) / yields.length;
    const maxYield = Math.max(...yields);
    const oversoldCount = bonds.filter((b) => b.valuationStatus === 'oversold').length;

    return { avgYield, maxYield, oversoldCount };
  }, [bonds]);

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <span className="text-gray-500 dark:text-gray-400">Средняя доходность:</span>{' '}
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {stats.avgYield.toFixed(1)}%
          </span>
        </div>
        <div className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <span className="text-green-700 dark:text-green-400">Лучшая:</span>{' '}
          <span className="font-medium text-green-700 dark:text-green-400">
            {stats.maxYield.toFixed(1)}%
          </span>
        </div>
        {stats.oversoldCount > 0 ? (
          <div className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <span className="text-amber-700 dark:text-amber-400">Недооценённых:</span>{' '}
            <span className="font-medium text-amber-700 dark:text-amber-400">
              {stats.oversoldCount}
            </span>
          </div>
        ) : null}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Duration filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Срок:</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
            {[
              { value: 'all', label: 'Все' },
              { value: 'short', label: `<${DURATION_SHORT_MAX}л` },
              { value: 'medium', label: `${DURATION_SHORT_MAX}-${DURATION_MEDIUM_MAX}л` },
              { value: 'long', label: `>${DURATION_MEDIUM_MAX}л` },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => onDurationChange(opt.value as DurationFilter)}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  durationFilter === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Valuation filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Оценка:</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
            {[
              { value: 'all', label: 'Все' },
              { value: 'oversold', label: 'Недооц.' },
              { value: 'fair', label: 'Норма' },
              { value: 'overbought', label: 'Переоц.' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => onValuationChange(opt.value as ValuationFilter)}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  valuationFilter === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Min yield filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Мин. дох.:</span>
          <input
            type="number"
            value={minYield || ''}
            onChange={(e) => onMinYieldChange(Number(e.target.value) || 0)}
            placeholder="0"
            className="w-16 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
        </div>

        {/* Results count */}
        <div className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
          Найдено: {filteredCount} из {bonds.length}
        </div>
      </div>
    </div>
  );
}

// Helper function to filter bonds
export function filterBonds(
  bonds: BondSummary[],
  durationFilter: DurationFilter,
  valuationFilter: ValuationFilter,
  minYield: number
): BondSummary[] {
  return bonds.filter((bond) => {
    // Duration filter
    if (durationFilter === 'short' && bond.yearsToMaturity >= DURATION_SHORT_MAX) return false;
    if (durationFilter === 'medium' && (bond.yearsToMaturity < DURATION_SHORT_MAX || bond.yearsToMaturity > DURATION_MEDIUM_MAX)) return false;
    if (durationFilter === 'long' && bond.yearsToMaturity <= DURATION_MEDIUM_MAX) return false;

    // Valuation filter
    if (valuationFilter !== 'all' && bond.valuationStatus !== valuationFilter) return false;

    // Min yield filter
    if (minYield > 0 && bond.realYield < minYield) return false;

    return true;
  });
}
