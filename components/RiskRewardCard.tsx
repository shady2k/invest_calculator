'use client';

import { useState } from 'react';
import type { RiskRewardAnalysis, RiskRewardAssessment } from '@/types';

interface RiskRewardCardProps {
  riskReward: RiskRewardAnalysis;
}

const assessmentConfig: Record<
  RiskRewardAssessment,
  { label: string; color: string; border: string; bg: string }
> = {
  excellent: {
    label: 'Отличный',
    color: 'text-green-600 dark:text-green-400',
    border: 'border-green-300 dark:border-green-700',
    bg: 'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40',
  },
  good: {
    label: 'Хороший',
    color: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-700',
    bg: 'bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40',
  },
  neutral: {
    label: 'Нейтральный',
    color: 'text-gray-600 dark:text-gray-400',
    border: 'border-gray-300 dark:border-gray-600',
    bg: 'bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-800/40 dark:to-slate-800/40',
  },
  poor: {
    label: 'Слабый',
    color: 'text-red-600 dark:text-red-400',
    border: 'border-red-300 dark:border-red-700',
    bg: 'bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/40 dark:to-orange-900/40',
  },
};

function InfoTooltip(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Информация о расчёте Risk/Reward"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {isOpen ? (
        <div className="absolute z-50 w-80 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 -left-32 top-8">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Как рассчитывается R/R?
          </h4>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p>
              <strong>Risk/Reward Ratio</strong> показывает соотношение потенциальной
              доходности к риску на основе сценарного анализа.
            </p>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2 font-mono text-xs">
              <div>Reward = Доход(оптимист.) - Доход(база)</div>
              <div>Risk = Доход(база) - Доход(консерв.)</div>
              <div>R/R = Reward / Risk</div>
            </div>
            <p className="text-xs">
              Каждый сценарий использует свой оптимальный горизонт выхода,
              отражая адаптивную стратегию инвестора.
            </p>
            <p>
              <strong>Интерпретация:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li><span className="text-green-600">&gt; 2.0</span> — Отличный (upside значительно превышает downside)</li>
              <li><span className="text-blue-600">1.5 - 2.0</span> — Хороший (благоприятный профиль)</li>
              <li><span className="text-gray-600">1.0 - 1.5</span> — Нейтральный (сбалансированный)</li>
              <li><span className="text-red-600">&lt; 1.0</span> — Слабый (риск превышает потенциал)</li>
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Дюрация показывает чувствительность цены к изменению ставки на 1%.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RiskRewardCard({
  riskReward,
}: RiskRewardCardProps): React.ReactElement {
  const {
    ratio,
    reward,
    risk,
    baseReturn,
    optimisticReturn,
    conservativeReturn,
    duration,
    durationSensitivity,
    baseHorizonYears,
    optimisticHorizonYears,
    conservativeHorizonYears,
    assessment,
  } = riskReward;

  const config = assessmentConfig[assessment];

  const formatReturn = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const formatRatio = (value: number | null): string => {
    if (value === null) return '—';
    if (value >= 10) return '>10';
    return value.toFixed(2);
  };

  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-xl border-2 ${config.border} overflow-hidden`}
    >
      <div className={`px-5 py-4 ${config.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Risk/Reward
            </h3>
            <InfoTooltip />
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${config.color} bg-white/60 dark:bg-gray-800/60`}
          >
            {config.label}
          </span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* R/R Ratio - главная метрика */}
        <div className="text-center py-2">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Коэффициент R/R
          </div>
          <div className={`text-4xl font-bold ${config.color}`}>
            {formatRatio(ratio)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            оптимальный выход каждого сценария
          </div>
        </div>

        {/* Сценарии */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Консерв.
            </div>
            <div className="text-lg font-semibold text-red-600 dark:text-red-400">
              {formatReturn(conservativeReturn)}
            </div>
            <div className="text-xs text-gray-400">
              {conservativeHorizonYears.toFixed(1)} лет
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Базовый
            </div>
            <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              {formatReturn(baseReturn)}
            </div>
            <div className="text-xs text-gray-400">
              {baseHorizonYears.toFixed(1)} лет
            </div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Оптимист.
            </div>
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              {formatReturn(optimisticReturn)}
            </div>
            <div className="text-xs text-gray-400">
              {optimisticHorizonYears.toFixed(1)} лет
            </div>
          </div>
        </div>

        {/* Reward / Risk */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Потенциал (Reward)
            </div>
            <div className={`text-xl font-bold ${reward >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {reward >= 0 ? '+' : ''}{reward.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400">
              оптимист. - база
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Риск (Risk)
            </div>
            <div className={`text-xl font-bold ${risk > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {risk > 0 ? '-' : '+'}{Math.abs(risk).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400">
              база - консерв.
            </div>
          </div>
        </div>

        {/* Duration sensitivity */}
        {duration !== null && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Дюрация (чувствительность)
              </span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {duration.toFixed(1)} лет
                {durationSensitivity !== null && (
                  <span className="text-gray-400 ml-1">
                    ({durationSensitivity >= 0 ? '-' : '+'}{Math.abs(durationSensitivity).toFixed(1)}% на 1% ставки)
                  </span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
