'use client';

import { useMemo } from 'react';
import type { BondSummary } from '@/lib/precalculate';

interface BondRecommendationsProps {
  bonds: BondSummary[];
  onSelect: (ticker: string) => void;
}

interface Recommendation {
  category: string;
  description: string;
  bond: BondSummary | null;
  highlight: string;
}

const DURATION_SHORT = 3;
const DURATION_MEDIUM_MAX = 7;

export function BondRecommendations({
  bonds,
  onSelect,
}: BondRecommendationsProps): React.ReactElement | null {
  const recommendations = useMemo((): Recommendation[] => {
    if (bonds.length === 0) return [];

    // Categorize bonds by duration
    const shortTerm = bonds.filter((b) => b.yearsToMaturity < DURATION_SHORT);
    const mediumTerm = bonds.filter(
      (b) => b.yearsToMaturity >= DURATION_SHORT && b.yearsToMaturity <= DURATION_MEDIUM_MAX
    );
    const longTerm = bonds.filter((b) => b.yearsToMaturity > DURATION_MEDIUM_MAX);

    // Find best in each category (by optimal exit yield)
    const bestShort = shortTerm.length > 0
      ? shortTerm.reduce((best, b) => (b.optimalExitYield > best.optimalExitYield ? b : best))
      : null;

    const bestMedium = mediumTerm.length > 0
      ? mediumTerm.reduce((best, b) => (b.optimalExitYield > best.optimalExitYield ? b : best))
      : null;

    const bestLong = longTerm.length > 0
      ? longTerm.reduce((best, b) => (b.optimalExitYield > best.optimalExitYield ? b : best))
      : null;

    // Find most undervalued (oversold status)
    const undervalued = bonds.filter((b) => b.valuationStatus === 'oversold');
    const mostUndervalued = undervalued.length > 0
      ? undervalued.reduce((best, b) => (b.optimalExitYield > best.optimalExitYield ? b : best))
      : null;

    return [
      {
        category: 'Короткая',
        description: `до ${DURATION_SHORT} лет`,
        bond: bestShort,
        highlight: bestShort ? `${bestShort.optimalExitYield.toFixed(1)}%` : '—',
      },
      {
        category: 'Средняя',
        description: `${DURATION_SHORT}–${DURATION_MEDIUM_MAX} лет`,
        bond: bestMedium,
        highlight: bestMedium ? `${bestMedium.optimalExitYield.toFixed(1)}%` : '—',
      },
      {
        category: 'Длинная',
        description: `от ${DURATION_MEDIUM_MAX} лет`,
        bond: bestLong,
        highlight: bestLong ? `${bestLong.optimalExitYield.toFixed(1)}%` : '—',
      },
      {
        category: 'Недооценённая',
        description: 'YTM выше КС',
        bond: mostUndervalued,
        highlight: mostUndervalued ? `${mostUndervalued.optimalExitYield.toFixed(1)}%` : '—',
      },
    ];
  }, [bonds]);

  if (bonds.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {recommendations.map((rec) => (
        <button
          key={rec.category}
          onClick={() => rec.bond && onSelect(rec.bond.ticker)}
          disabled={!rec.bond}
          className={`p-3 rounded-lg border text-left transition-all ${
            rec.bond
              ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-400 dark:hover:border-blue-600 cursor-pointer'
              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed opacity-50'
          }`}
        >
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Лучшая {rec.category.toLowerCase()}
          </div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {rec.bond?.name ?? 'Нет данных'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {rec.description}
          </div>
          <div className="mt-2 text-lg font-bold text-green-600 dark:text-green-400">
            {rec.highlight}
          </div>
        </button>
      ))}
    </div>
  );
}
