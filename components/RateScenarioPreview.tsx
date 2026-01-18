'use client';

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { RateScenarioItem } from '@/types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface RateScenarioPreviewProps {
  rates: RateScenarioItem[];
  scenarioName: string;
  currentKeyRate?: number;
}

export function RateScenarioPreview({
  rates,
  scenarioName,
  currentKeyRate,
}: RateScenarioPreviewProps): React.ReactElement {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const chartData = useMemo(() => {
    const labels = rates.map((r) => {
      const date = new Date(r.date);
      return date.toLocaleDateString('ru-RU', {
        year: '2-digit',
        month: 'short',
      });
    });

    // Split into history and forecast
    const historyData: (number | null)[] = [];
    const forecastData: (number | null)[] = [];

    for (const r of rates) {
      const date = new Date(r.date);
      if (date <= today) {
        historyData.push(r.rate);
        forecastData.push(null);
      } else {
        // Connect forecast to last history point
        if (historyData.length > 0 && forecastData.length === 0) {
          forecastData.push(historyData[historyData.length - 1] ?? null);
          historyData.push(null);
        } else {
          historyData.push(null);
        }
        forecastData.push(r.rate);
      }
    }

    return {
      labels,
      datasets: [
        {
          label: 'История (ЦБ)',
          data: historyData,
          borderColor: '#2563eb',
          backgroundColor: '#2563eb',
          fill: false,
          tension: 0,
          pointRadius: 4,
          stepped: 'before' as const,
          spanGaps: false,
        },
        {
          label: 'Прогноз',
          data: forecastData,
          borderColor: '#dc2626',
          backgroundColor: '#dc2626',
          borderDash: [5, 5],
          fill: false,
          tension: 0,
          pointRadius: 4,
          stepped: 'before' as const,
          spanGaps: true,
        },
      ],
    };
  }, [rates, today]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          min: Math.max(0, Math.min(...rates.map((r) => r.rate)) - 2),
          max: Math.max(...rates.map((r) => r.rate)) + 2,
          title: {
            display: true,
            text: 'Ставка, %',
          },
        },
        x: {
          title: {
            display: false,
          },
        },
      },
    }),
    [rates]
  );

  // Split rates into history and forecast for table
  const historyRates = rates.filter((r) => new Date(r.date) <= today);
  const forecastRates = rates.filter((r) => new Date(r.date) > today);

  if (rates.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        Нет данных о ставках
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Сценарий: {scenarioName}
        </h3>
        {currentKeyRate !== undefined && (
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
            Текущая ставка: {currentKeyRate}%
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart */}
        <div className="h-56 bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <Line data={chartData} options={options} />
        </div>

        {/* Table */}
        <div className="overflow-auto max-h-56 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400 font-medium">
                  Дата
                </th>
                <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 font-medium">
                  Ставка
                </th>
                <th className="px-3 py-2 text-center text-gray-600 dark:text-gray-400 font-medium w-20">
                  Тип
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {/* History */}
              {historyRates.map((item, index) => {
                const date = new Date(item.date);
                const isLast = index === historyRates.length - 1;
                return (
                  <tr
                    key={`h-${index}`}
                    className={
                      isLast
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }
                  >
                    <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">
                      {date.toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">
                      {item.rate}%
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                        ЦБ
                      </span>
                    </td>
                  </tr>
                );
              })}
              {/* Forecast */}
              {forecastRates.map((item, index) => {
                const date = new Date(item.date);
                return (
                  <tr
                    key={`f-${index}`}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">
                      {date.toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">
                      {item.rate}%
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
                        Прогноз
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
