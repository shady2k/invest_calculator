'use client';

import type { ValuationAssessment } from '@/types';
import { ValuationBadge } from './ValuationBadge';

interface ValuationCardProps {
  valuation: ValuationAssessment;
  ytm: number;
}

export function ValuationCard({
  valuation,
  ytm,
}: ValuationCardProps): React.ReactElement {
  const { status, spread, keyRate, recommendation, riskWarning } = valuation;

  const borderColorClasses = {
    overbought: 'border-red-300 dark:border-red-700',
    fair: 'border-green-300 dark:border-green-700',
    oversold: 'border-blue-300 dark:border-blue-700',
  };

  const headerBgClasses = {
    overbought:
      'bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/40 dark:to-orange-900/40',
    fair:
      'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40',
    oversold:
      'bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40',
  };

  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-xl border-2 ${borderColorClasses[status]} overflow-hidden`}
    >
      <div className={`px-5 py-4 ${headerBgClasses[status]}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Оценка стоимости
          </h3>
          <ValuationBadge valuation={valuation} />
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              YTM облигации
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {ytm.toFixed(2)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Ключевая ставка
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {keyRate.toFixed(1)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Спред
            </div>
            <div
              className={`text-xl font-bold ${
                spread > 0
                  ? 'text-red-600 dark:text-red-400'
                  : spread < -1
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-green-600 dark:text-green-400'
              }`}
            >
              {spread > 0 ? '+' : ''}
              {spread.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Recommendation */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Вывод для инвестора
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {recommendation}
          </p>
        </div>

        {/* Risk warning if applicable */}
        {riskWarning ? (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {riskWarning}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
