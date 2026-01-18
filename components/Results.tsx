'use client';

import type { CalculationResults } from '@/types';
import { PAR_THRESHOLD } from '@/lib/constants';

interface ResultsProps {
  results: CalculationResults | null;
}

export function Results({ results }: ResultsProps): React.ReactElement {
  if (!results) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        Выберите облигацию и нажмите «Рассчитать»
      </div>
    );
  }

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ru-RU');
  };

  return (
    <div className="space-y-6">
      {/* Standard YTM metrics */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800 pb-2 mb-4">
          Стандартные показатели (YTM)
        </h3>

        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">YTM (доходность к погашению)</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{results.ytm.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Срок до погашения</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{results.yearsToMaturity.toFixed(2)} лет</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Количество купонов</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{results.couponCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">При реинвест. под YTM</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{results.totalWithYTM.toFixed(2)} ₽</span>
          </div>
        </div>

        <div className="mt-4 p-4 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400">Инвестиция</div>
          <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">
            {results.investment.toFixed(2)} ₽
          </div>
        </div>
      </div>

      {/* Real yield metrics */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800 pb-2 mb-4">
          Реальная доходность
        </h3>

        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Без реинвестирования</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{results.yieldNoReinvest.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Сумма без реинвест.</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{results.totalNoReinvest.toFixed(2)} ₽</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">С изменяющейся ставкой</span>
            <span className="font-semibold text-green-600 dark:text-green-400">{results.realYieldMaturity.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Сумма к погашению</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{results.totalFullModel.toFixed(2)} ₽</span>
          </div>
        </div>

        {/* Optimal exit */}
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400">Макс. годовая доходность</div>
          <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">
            {results.optimalExit.annualReturn.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            При выходе: {formatDate(results.optimalExit.date)} ({results.optimalExit.years.toFixed(1)} лет)
          </div>
        </div>

        {/* Par exit */}
        <div className="mt-3 p-4 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400">Выход при цене ≈ номинала</div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-400">
            {results.parExit.annualReturn.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {results.parExit.bondPrice >= results.nominal * PAR_THRESHOLD
              ? `Цена ${results.parExit.bondPrice.toFixed(0)}₽: `
              : 'Погашение: '}
            {formatDate(results.parExit.date)} ({results.parExit.years.toFixed(1)} лет)
          </div>
        </div>
      </div>
    </div>
  );
}
