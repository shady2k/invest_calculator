'use client';

import { useState, useMemo } from 'react';
import type { BondSummary } from '@/lib/precalculate';

type SortField = 'name' | 'price' | 'moexYtm' | 'realYield' | 'optimalExitYield' | 'yearsToMaturity';
type SortDirection = 'asc' | 'desc';

interface BondsListProps {
  bonds: BondSummary[];
  loading: boolean;
  onSelect: (ticker: string) => void;
}

export function BondsList({
  bonds,
  loading,
  onSelect,
}: BondsListProps): React.ReactElement {
  const [sortField, setSortField] = useState<SortField>('optimalExitYield');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filter, setFilter] = useState('');

  const handleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedBonds = useMemo(() => {
    const filtered = bonds.filter(
      (bond) =>
        bond.name.toLowerCase().includes(filter.toLowerCase()) ||
        bond.ticker.toLowerCase().includes(filter.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'price':
          aVal = a.priceWithAci ?? 0;
          bVal = b.priceWithAci ?? 0;
          break;
        case 'moexYtm':
          aVal = a.moexYtm ?? 0;
          bVal = b.moexYtm ?? 0;
          break;
        case 'realYield':
          aVal = a.realYield;
          bVal = b.realYield;
          break;
        case 'optimalExitYield':
          aVal = a.optimalExitYield;
          bVal = b.optimalExitYield;
          break;
        case 'yearsToMaturity':
          aVal = a.yearsToMaturity;
          bVal = b.yearsToMaturity;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [bonds, filter, sortField, sortDirection]);

  const SortHeader = ({
    field,
    label,
    className = '',
  }: {
    field: SortField;
    label: string;
    className?: string;
  }): React.ReactElement => (
    <th
      className={`px-3 py-2 font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1 justify-end">
        <span>{label}</span>
        {sortField === field && (
          <span className="text-blue-600 dark:text-blue-400">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            Загрузка и расчёт облигаций...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Поиск по названию или тикеру..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="input-base"
      />

      {/* Stats */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Найдено: {sortedBonds.length} из {bonds.length} облигаций
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <th
                className="px-3 py-2 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  <span>Облигация</span>
                  {sortField === 'name' && (
                    <span className="text-blue-600 dark:text-blue-400">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <SortHeader field="price" label="Цена" />
              <SortHeader field="moexYtm" label="YTM MOEX" />
              <SortHeader field="realYield" label="Реальн. дох." />
              <SortHeader field="optimalExitYield" label="Оптим. выход" />
              <SortHeader field="yearsToMaturity" label="Лет до погаш." />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {sortedBonds.map((bond) => (
              <tr
                key={bond.ticker}
                onClick={() => onSelect(bond.ticker)}
                className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <td className="px-3 py-3">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {bond.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {bond.ticker}
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="text-gray-900 dark:text-gray-100">
                    {bond.price?.toFixed(1) ?? '—'} ₽
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    +{bond.accruedInterest?.toFixed(2) ?? '0'} = {bond.priceWithAci?.toFixed(1) ?? '—'} ₽
                  </div>
                </td>
                <td className="px-3 py-3 text-right text-gray-500 dark:text-gray-400">
                  {bond.moexYtm?.toFixed(1) ?? '—'}%
                </td>
                <td className="px-3 py-3 text-right font-medium text-green-600 dark:text-green-400">
                  {bond.realYield.toFixed(1)}%
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="font-semibold text-blue-600 dark:text-blue-400">
                    {bond.optimalExitYield.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(bond.optimalExitDate).toLocaleDateString('ru-RU', {
                      year: '2-digit',
                      month: 'short',
                    })}
                  </div>
                </td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">
                  {bond.yearsToMaturity.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedBonds.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Облигации не найдены
        </div>
      )}
    </div>
  );
}
