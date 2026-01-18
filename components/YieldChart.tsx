'use client';

import { useMemo } from 'react';
import '@/lib/chart-setup';
import { Line } from 'react-chartjs-2';
import type { ExitResult, ChartType } from '@/types';

interface YieldChartProps {
  exits: ExitResult[];
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
}

const chartConfig: Record<ChartType, { label: string; color: string }> = {
  yield: { label: 'Годовая доходность, %', color: '#2563eb' },
  price: { label: 'Цена облигации, ₽', color: '#16a34a' },
  total: { label: 'Сумма дохода, ₽', color: '#ca8a04' },
};

export function YieldChart({
  exits,
  chartType,
  onChartTypeChange,
}: YieldChartProps): React.ReactElement {
  const chartData = useMemo(() => {
    const labels = exits.map((e) =>
      e.date.toLocaleDateString('ru-RU', { year: '2-digit', month: 'short' })
    );

    let data: number[];
    switch (chartType) {
      case 'yield':
        data = exits.map((e) => e.annualReturn);
        break;
      case 'price':
        data = exits.map((e) => e.bondPrice);
        break;
      case 'total':
        data = exits.map((e) => e.exitValue);
        break;
    }

    const config = chartConfig[chartType];

    return {
      labels,
      datasets: [
        {
          label: config.label,
          data,
          borderColor: config.color,
          backgroundColor: `${config.color}20`,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    };
  }, [exits, chartType]);

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
        },
      },
    }),
    []
  );

  if (exits.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        Нет данных для отображения графика
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chart type tabs */}
      <div className="flex gap-2">
        {(Object.keys(chartConfig) as ChartType[]).map((type) => (
          <button
            key={type}
            onClick={() => onChartTypeChange(type)}
            className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
              chartType === type
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400'
            }`}
          >
            {type === 'yield' && 'Годовая доходность'}
            {type === 'price' && 'Цена облигации'}
            {type === 'total' && 'Сумма дохода'}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-72">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
