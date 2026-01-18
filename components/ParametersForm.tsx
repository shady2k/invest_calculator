'use client';

import type { ParsedBond } from '@/types';

export interface BondParameters {
  bondName: string;
  nominal: number;
  currentPrice: number;
  coupon: number;
  couponPeriodDays: number;
  purchaseDate: string;
  firstCouponDate: string;
  maturityDate: string;
}

interface ParametersFormProps {
  parameters: BondParameters;
  onChange: (params: BondParameters) => void;
  selectedBond: ParsedBond | null;
}

export function ParametersForm({
  parameters,
  onChange,
  selectedBond,
}: ParametersFormProps): React.ReactElement {
  const handleChange = (field: keyof BondParameters, value: string | number): void => {
    onChange({
      ...parameters,
      [field]: value,
    });
  };

  // Format today's date for default purchase date
  const today = new Date().toISOString().split('T')[0] ?? '';

  return (
    <div className="space-y-4">
      {selectedBond ? (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <div className="text-sm text-blue-800 dark:text-blue-300">
            Выбрана: <span className="font-medium">{selectedBond.name}</span>
          </div>
          {selectedBond.ytm !== null ? (
            <div className="text-xs text-blue-600 dark:text-blue-400">
              Текущий YTM: {selectedBond.ytm.toFixed(2)}%
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <label className="label-base">
          Название облигации
        </label>
        <input
          type="text"
          value={parameters.bondName}
          onChange={(e) => handleChange('bondName', e.target.value)}
          className="input-base"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label-base">
            Номинал, ₽
          </label>
          <input
            type="number"
            value={parameters.nominal}
            onChange={(e) => handleChange('nominal', parseFloat(e.target.value) || 0)}
            className="input-base"
          />
        </div>
        <div>
          <label className="label-base">
            Цена покупки (с НКД), ₽
          </label>
          <input
            type="number"
            step="0.01"
            value={parameters.currentPrice}
            onChange={(e) => handleChange('currentPrice', parseFloat(e.target.value) || 0)}
            className="input-base"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label-base">
            Купон (за период), ₽
          </label>
          <input
            type="number"
            step="0.01"
            value={parameters.coupon}
            onChange={(e) => handleChange('coupon', parseFloat(e.target.value) || 0)}
            className="input-base"
          />
        </div>
        <div>
          <label className="label-base">
            Период купона, дней
          </label>
          <input
            type="number"
            value={parameters.couponPeriodDays}
            onChange={(e) => handleChange('couponPeriodDays', parseInt(e.target.value) || 0)}
            className="input-base"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label-base">
            Дата покупки
          </label>
          <input
            type="date"
            value={parameters.purchaseDate || today}
            onChange={(e) => handleChange('purchaseDate', e.target.value)}
            className="input-base"
          />
        </div>
        <div>
          <label className="label-base">
            Дата первого купона
          </label>
          <input
            type="date"
            value={parameters.firstCouponDate}
            onChange={(e) => handleChange('firstCouponDate', e.target.value)}
            className="input-base"
          />
        </div>
      </div>

      <div>
        <label className="label-base">
          Дата погашения
        </label>
        <input
          type="date"
          value={parameters.maturityDate}
          onChange={(e) => handleChange('maturityDate', e.target.value)}
          className="input-base"
        />
      </div>
    </div>
  );
}
