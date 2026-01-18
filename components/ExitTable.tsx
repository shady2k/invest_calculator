'use client';

import type { ExitResult } from '@/types';
import { PAR_THRESHOLD } from '@/lib/constants';

interface ExitTableProps {
  exits: ExitResult[];
  nominal: number;
  parExitDate?: Date;
}

export function ExitTable({
  exits,
  nominal,
  parExitDate,
}: ExitTableProps): React.ReactElement {
  if (exits.length === 0) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-4">
        Нет данных для отображения
      </div>
    );
  }

  const maxAnnualReturn = Math.max(...exits.map((e) => e.annualReturn));

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ru-RU');
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            <th className="px-3 py-2 text-left font-medium">Дата</th>
            <th className="px-3 py-2 text-right font-medium">Срок, лет</th>
            <th className="px-3 py-2 text-right font-medium">Ключ. ставка</th>
            <th className="px-3 py-2 text-right font-medium">Ставка реинв.</th>
            <th className="px-3 py-2 text-right font-medium">Цена облиг.</th>
            <th className="px-3 py-2 text-right font-medium">Реинв. купонов</th>
            <th className="px-3 py-2 text-right font-medium">Сумма дохода</th>
            <th className="px-3 py-2 text-right font-medium">Дох. к покупке</th>
            <th className="px-3 py-2 text-right font-medium">Годовая дох.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
          {exits.map((exit, index) => {
            const isBest = Math.abs(exit.annualReturn - maxAnnualReturn) < 0.01;
            const isParExit =
              parExitDate && exit.date.getTime() === parExitDate.getTime();

            return (
              <tr
                key={index}
                className={`${isParExit ? 'bg-green-50 dark:bg-green-900/30' : ''} hover:bg-gray-50 dark:hover:bg-gray-800`}
              >
                <td className="px-3 py-2 text-left">{formatDate(exit.date)}</td>
                <td className="px-3 py-2 text-right">{exit.years.toFixed(3)}</td>
                <td className="px-3 py-2 text-right">{exit.keyRate.toFixed(1)}%</td>
                <td className="px-3 py-2 text-right">{exit.reinvestRate.toFixed(2)}%</td>
                <td className="px-3 py-2 text-right">
                  {exit.bondPrice.toFixed(1)} ₽
                  {isParExit && exit.bondPrice >= nominal * PAR_THRESHOLD ? (
                    <span className="ml-1">🎯</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">
                  {exit.reinvestedCoupons.toFixed(1)} ₽
                </td>
                <td className="px-3 py-2 text-right">{exit.exitValue.toFixed(1)} ₽</td>
                <td className="px-3 py-2 text-right">{exit.totalReturn.toFixed(1)}%</td>
                <td
                  className={`px-3 py-2 text-right font-medium ${
                    isBest ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : ''
                  }`}
                >
                  {exit.annualReturn.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
