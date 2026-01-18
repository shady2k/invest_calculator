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
import type { RateScenarioItem, InflationRateItem } from '@/types';

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
  inflationRates?: InflationRateItem[];
}

export function RateScenarioPreview({
  rates,
  scenarioName,
  currentKeyRate,
  inflationRates,
}: RateScenarioPreviewProps): React.ReactElement {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Key rate chart data
  const rateChartData = useMemo(() => {
    const labels = rates.map((r) => {
      const date = new Date(r.date);
      return date.toLocaleDateString('ru-RU', {
        year: '2-digit',
        month: 'short',
      });
    });

    const historyData: (number | null)[] = [];
    const forecastData: (number | null)[] = [];

    for (const r of rates) {
      const date = new Date(r.date);
      if (date <= today) {
        historyData.push(r.rate);
        forecastData.push(null);
      } else {
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

  // Inflation chart data
  const inflationChartData = useMemo(() => {
    if (!inflationRates || inflationRates.length === 0) return null;

    const labels = inflationRates.map((r) => {
      const date = new Date(r.date);
      return date.toLocaleDateString('ru-RU', {
        year: '2-digit',
        month: 'short',
      });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Прогноз инфляции',
          data: inflationRates.map((r) => r.rate),
          borderColor: '#16a34a',
          backgroundColor: '#16a34a',
          fill: false,
          tension: 0,
          pointRadius: 4,
          stepped: 'before' as const,
        },
      ],
    };
  }, [inflationRates]);

  // Options for key rate chart
  const rateOptions = useMemo(
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

  // Options for inflation chart
  const inflationOptions = useMemo(() => {
    if (!inflationRates || inflationRates.length === 0) return null;

    return {
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
          min: Math.max(0, Math.min(...inflationRates.map((r) => r.rate)) - 1),
          max: Math.max(...inflationRates.map((r) => r.rate)) + 1,
          title: {
            display: true,
            text: 'Инфляция, %',
          },
        },
        x: {
          title: {
            display: false,
          },
        },
      },
    };
  }, [inflationRates]);

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
    <div className="space-y-6">
      {/* Key Rate Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Ключевая ставка • {scenarioName}
          </h3>
          {currentKeyRate !== undefined ? (
            <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              Текущая: {currentKeyRate}%
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Rate Chart */}
          <div className="h-48 bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <Line data={rateChartData} options={rateOptions} />
          </div>

          {/* Rate Table */}
          <div className="overflow-auto max-h-48 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
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
                {historyRates.map((item, index) => {
                  const date = new Date(item.date);
                  const isLast = index === historyRates.length - 1;
                  return (
                    <tr
                      key={`h-${item.date}`}
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
                {forecastRates.map((item) => {
                  const date = new Date(item.date);
                  return (
                    <tr
                      key={`f-${item.date}`}
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

      {/* Inflation Section */}
      {inflationChartData && inflationOptions ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Прогноз инфляции
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Inflation Chart */}
            <div className="h-48 bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <Line data={inflationChartData} options={inflationOptions} />
            </div>

            {/* Inflation Table */}
            <div className="overflow-auto max-h-48 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400 font-medium">
                      Дата
                    </th>
                    <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 font-medium">
                      Инфляция
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {inflationRates?.map((item) => {
                    const date = new Date(item.date);
                    return (
                      <tr
                        key={item.date}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">
                          {date.toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium text-green-600 dark:text-green-400">
                          {item.rate}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
