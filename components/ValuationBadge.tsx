'use client';

import type { ValuationAssessment } from '@/types';

interface ValuationBadgeProps {
  valuation: ValuationAssessment;
  showSpread?: boolean;
}

export function ValuationBadge({
  valuation,
  showSpread = false,
}: ValuationBadgeProps): React.ReactElement {
  const { status, label, spread } = valuation;

  const colorClasses = {
    overbought: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    fair: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    oversold: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  };

  const iconMap = {
    overbought: (
      <svg
        className="w-4 h-4 mr-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
        />
      </svg>
    ),
    fair: (
      <svg
        className="w-4 h-4 mr-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
    ),
    oversold: (
      <svg
        className="w-4 h-4 mr-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        />
      </svg>
    ),
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colorClasses[status]}`}
    >
      {iconMap[status]}
      {label}
      {showSpread ? (
        <span className="ml-1.5 opacity-75">
          ({spread > 0 ? '+' : ''}{spread.toFixed(1)}%)
        </span>
      ) : null}
    </span>
  );
}
