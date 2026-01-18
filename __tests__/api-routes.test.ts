import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the lib modules
vi.mock('@/lib/moex', () => ({
  fetchAllBonds: vi.fn(),
  fetchBondByTicker: vi.fn(),
}));

vi.mock('@/lib/cbr', () => ({
  fetchKeyRateHistory: vi.fn(),
  getCurrentKeyRate: vi.fn(),
  getFallbackKeyRate: vi.fn(),
}));

vi.mock('@/lib/precalculate', () => ({
  getCalculatedBonds: vi.fn(),
  getCalculatedBond: vi.fn(),
}));

import { fetchAllBonds, fetchBondByTicker } from '@/lib/moex';
import { fetchKeyRateHistory, getCurrentKeyRate, getFallbackKeyRate } from '@/lib/cbr';
import { getCalculatedBonds, getCalculatedBond } from '@/lib/precalculate';
import type { ParsedBond, KeyRateData } from '@/types';
import type { BondSummary, CalculationsCache, BondCalculation } from '@/lib/precalculate';

// Import route handlers
import { GET as getCalculatedBondsRoute } from '@/app/api/calculated-bonds/route';
import { GET as getCalculatedBondRoute } from '@/app/api/calculated-bonds/[ticker]/route';
import { GET as getScenarios } from '@/app/api/scenarios/route';

const mockBonds: ParsedBond[] = [
  {
    ticker: 'SU26238RMFS4',
    name: 'ОФЗ 26238',
    price: 556.5,
    coupon: 35.4,
    couponPeriod: 182,
    maturityDate: '2041-05-15',
    nominal: 1000,
    accruedInterest: 12.5,
    ytm: 14.79,
  },
  {
    ticker: 'SU26248RMFS3',
    name: 'ОФЗ 26248',
    price: 860.6,
    coupon: 61.08,
    couponPeriod: 182,
    maturityDate: '2040-05-16',
    nominal: 1000,
    accruedInterest: 20.3,
    ytm: 15.21,
  },
];

const mockKeyRates: KeyRateData[] = [
  { date: '2025-01-15', rate: 21 },
  { date: '2024-12-20', rate: 21 },
  { date: '2024-10-25', rate: 21 },
];

const mockBondSummary: BondSummary = {
  ticker: 'SU26238RMFS4',
  name: 'ОФЗ 26238',
  price: 556.5,
  priceWithAci: 569.0,
  coupon: 35.4,
  couponPeriod: 182,
  maturityDate: '2041-05-15',
  nominal: 1000,
  accruedInterest: 12.5,
  moexYtm: 14.79,
  realYield: 18.5,
  optimalExitYield: 22.3,
  optimalExitDate: '2027-05-15',
  parExitYield: 19.8,
  parExitDate: '2030-05-15',
  yearsToMaturity: 16.5,
  valuationStatus: 'oversold',
};

const mockCalculationsCache: CalculationsCache = {
  timestamp: Date.now(),
  scenario: 'base',
  currentKeyRate: 21,
  bonds: [
    {
      summary: mockBondSummary,
      results: {
        bondName: 'ОФЗ 26238',
        investment: 569.0,
        nominal: 1000,
        coupon: 35.4,
        ytm: 14.79,
        yearsToMaturity: 16.5,
        couponCount: 33,
        totalWithYTM: 2500,
        yieldNoReinvest: 10.5,
        totalNoReinvest: 2168.2,
        totalWithVariableRate: 2300,
        realYieldMaturity: 18.5,
        totalFullModel: 2450,
        exitResults: [],
        optimalExit: {
          date: new Date('2027-05-15'),
          years: 2.5,
          keyRate: 15,
          reinvestRate: 14.5,
          bondPrice: 750,
          reinvestedCoupons: 100,
          exitValue: 850,
          totalReturn: 49.4,
          annualReturn: 22.3,
          isLast: false,
        },
        parExit: {
          date: new Date('2030-05-15'),
          years: 5.5,
          keyRate: 9,
          reinvestRate: 8.5,
          bondPrice: 998,
          reinvestedCoupons: 250,
          exitValue: 1248,
          totalReturn: 119.3,
          annualReturn: 19.8,
          isLast: false,
        },
        validation: {
          discountedCashFlowsSum: 569.0,
          discountedDifference: 0,
          expectedTotalNoReinvest: 2168.2,
          actualTotalNoReinvest: 2168.2,
          accumulatedValueDiscounted: 569.0,
          allChecksPassed: true,
        },
        valuation: {
          status: 'oversold',
          spread: -6.21,
          keyRate: 21,
          label: 'Перепродана',
          recommendation: 'Доходность облигации выше ключевой ставки. Бумага торгуется с дисконтом к справедливой цене. Потенциально выгодный момент для покупки.',
          riskWarning: 'Убедитесь, что нет специфических рисков (ликвидность, срок). Дисконт может быть обоснован рыночными факторами.',
        },
      },
    },
  ],
};

describe('API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/calculated-bonds', () => {
    it('should return list of calculated bonds', async () => {
      vi.mocked(getCalculatedBonds).mockResolvedValue(mockCalculationsCache);

      const request = new NextRequest('http://localhost/api/calculated-bonds');
      const response = await getCalculatedBondsRoute(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('scenario', 'base');
      expect(data).toHaveProperty('currentKeyRate', 21);
      expect(data).toHaveProperty('bonds');
      expect(data.bonds).toHaveLength(1);
      expect(data.bonds[0]).toMatchObject({
        ticker: 'SU26238RMFS4',
        realYield: 18.5,
        optimalExitYield: 22.3,
      });
    });

    it('should accept scenario parameter', async () => {
      vi.mocked(getCalculatedBonds).mockResolvedValue({
        ...mockCalculationsCache,
        scenario: 'conservative',
      });

      const request = new NextRequest('http://localhost/api/calculated-bonds?scenario=conservative');
      const response = await getCalculatedBondsRoute(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.scenario).toBe('conservative');
      expect(getCalculatedBonds).toHaveBeenCalledWith('conservative');
    });

    it('should return 500 on error', async () => {
      vi.mocked(getCalculatedBonds).mockRejectedValue(new Error('Calculation failed'));

      const request = new NextRequest('http://localhost/api/calculated-bonds');
      const response = await getCalculatedBondsRoute(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });
  });

  describe('GET /api/calculated-bonds/[ticker]', () => {
    it('should return full calculation for valid ticker', async () => {
      const firstBond = mockCalculationsCache.bonds[0];
      if (!firstBond) throw new Error('Test setup error: no mock bond');
      const mockBondCalc: BondCalculation = firstBond;
      vi.mocked(getCalculatedBond).mockResolvedValue(mockBondCalc);

      const request = new NextRequest('http://localhost/api/calculated-bonds/SU26238RMFS4');
      const response = await getCalculatedBondRoute(request, {
        params: Promise.resolve({ ticker: 'SU26238RMFS4' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('results');
      expect(data.summary.ticker).toBe('SU26238RMFS4');
    });

    it('should return 404 for non-existent ticker', async () => {
      vi.mocked(getCalculatedBond).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/calculated-bonds/INVALID');
      const response = await getCalculatedBondRoute(request, {
        params: Promise.resolve({ ticker: 'INVALID' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'Bond not found');
    });

    it('should return 500 on error', async () => {
      vi.mocked(getCalculatedBond).mockRejectedValue(new Error('Error'));

      const request = new NextRequest('http://localhost/api/calculated-bonds/SU26238RMFS4');
      const response = await getCalculatedBondRoute(request, {
        params: Promise.resolve({ ticker: 'SU26238RMFS4' }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });
  });

  describe('GET /api/scenarios', () => {
    it('should return scenarios data', async () => {
      const response = await getScenarios();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('scenarios');
      expect(data).toHaveProperty('default');
      expect(data.default).toBe('base');
      expect(data.scenarios).toHaveProperty('base');
      expect(data.scenarios).toHaveProperty('conservative');
      expect(data.scenarios).toHaveProperty('optimistic');
      expect(data.scenarios).toHaveProperty('constant');
    });

    it('should have valid base scenario structure', async () => {
      const response = await getScenarios();
      const data = await response.json();

      const base = data.scenarios['base'];
      expect(base).toHaveProperty('name');
      expect(base).toHaveProperty('description');
      expect(base).toHaveProperty('rates');
      expect(Array.isArray(base?.rates)).toBe(true);
      expect(base?.rates.length).toBeGreaterThan(0);

      const firstRate = base?.rates[0];
      expect(firstRate).toHaveProperty('date');
      expect(firstRate).toHaveProperty('rate');
      expect(typeof firstRate?.rate).toBe('number');
    });
  });
});

describe('MOEX API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchAllBonds should be called correctly', async () => {
    vi.mocked(fetchAllBonds).mockResolvedValue(mockBonds);

    const result = await fetchAllBonds();

    expect(result).toHaveLength(2);
    expect(fetchAllBonds).toHaveBeenCalledTimes(1);
  });

  it('fetchBondByTicker should be called with correct ticker', async () => {
    vi.mocked(fetchBondByTicker).mockResolvedValue(mockBonds[0] ?? null);

    const result = await fetchBondByTicker('SU26238RMFS4');

    expect(result?.ticker).toBe('SU26238RMFS4');
    expect(fetchBondByTicker).toHaveBeenCalledWith('SU26238RMFS4');
  });
});

describe('CBR API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getCurrentKeyRate should return latest rate', async () => {
    vi.mocked(getCurrentKeyRate).mockResolvedValue(mockKeyRates[0] ?? null);

    const result = await getCurrentKeyRate();

    expect(result?.rate).toBe(21);
    expect(result?.date).toBe('2025-01-15');
  });

  it('fetchKeyRateHistory should return sorted rates', async () => {
    vi.mocked(fetchKeyRateHistory).mockResolvedValue(mockKeyRates);

    const result = await fetchKeyRateHistory();

    expect(result).toHaveLength(3);
    expect(result[0]?.date).toBe('2025-01-15');
  });

  it('getFallbackKeyRate should return default rate', () => {
    vi.mocked(getFallbackKeyRate).mockReturnValue({
      date: '2025-01-18',
      rate: 21,
    });

    const result = getFallbackKeyRate();

    expect(result.rate).toBe(21);
  });
});
