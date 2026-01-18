import { NextResponse } from 'next/server';
import scenariosData from '@/data/rate-scenarios.json';
import { fetchKeyRateHistory } from '@/lib/cbr';
import type { RateScenarioItem } from '@/types';
import { withThrottle, ThrottlePresets } from '@/lib/rate-limit';

interface ScenarioData {
  name: string;
  description: string;
  rates: Array<{ date: string; rate: number }>;
}

interface ScenariosFile {
  scenarios: Record<string, ScenarioData>;
  default: string;
}

interface MergedScenario {
  name: string;
  description: string;
  rates: RateScenarioItem[];
  /** Original scenario rates (forecast only) */
  forecastRates: RateScenarioItem[];
  /** Historical rates from CBR */
  historyRates: RateScenarioItem[];
}

// Show 1 year of history
const HISTORY_MONTHS = 12;

/**
 * Filter to only keep rate changes (not daily duplicates)
 */
function filterRateChanges(rates: RateScenarioItem[]): RateScenarioItem[] {
  if (rates.length === 0) return [];

  // Sort by date ascending
  const sorted = [...rates].sort((a, b) => a.date.localeCompare(b.date));

  const result: RateScenarioItem[] = [];
  let lastRate: number | null = null;

  for (const item of sorted) {
    if (lastRate === null || item.rate !== lastRate) {
      result.push(item);
      lastRate = item.rate;
    }
  }

  return result;
}

/**
 * Merge CBR history with scenario forecast
 */
function mergeRates(
  historyRates: RateScenarioItem[],
  forecastRates: RateScenarioItem[],
  _currentKeyRate: number
): RateScenarioItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const historyStart = new Date(today);
  historyStart.setMonth(historyStart.getMonth() - HISTORY_MONTHS);

  // Filter history to only rate changes
  const filteredHistory = filterRateChanges(historyRates);

  const merged: RateScenarioItem[] = [];

  // Add historical rates (last year only)
  for (const item of filteredHistory) {
    const date = new Date(item.date);
    if (date >= historyStart && date <= today) {
      merged.push(item);
    }
  }

  // Add forecast rates (future dates only)
  for (const item of forecastRates) {
    const date = new Date(item.date);
    if (date > today) {
      merged.push({
        date: item.date,
        rate: item.rate,
      });
    }
  }

  // Sort by date
  merged.sort((a, b) => a.date.localeCompare(b.date));

  return merged;
}

async function handler(): Promise<Response> {
  const data = scenariosData as ScenariosFile;

  // Fetch CBR data (single fetch, derive current from history[0])
  const history = await fetchKeyRateHistory();

  if (history.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch key rate data from CBR' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const historyRates: RateScenarioItem[] = history.map((h) => ({ date: h.date, rate: h.rate }));
  const firstRate = history[0];
  if (!firstRate) {
    return new Response(
      JSON.stringify({ error: 'Key rate history is empty' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const currentKeyRate = firstRate.rate;

  // Merge each scenario with CBR history
  const mergedScenarios: Record<string, MergedScenario> = {};

  for (const [id, scenario] of Object.entries(data.scenarios)) {
    const forecastRates = scenario.rates;
    const merged = mergeRates(historyRates, forecastRates, currentKeyRate);

    mergedScenarios[id] = {
      name: scenario.name,
      description: scenario.description,
      rates: merged,
      forecastRates,
      historyRates,
    };
  }

  return NextResponse.json({
    scenarios: mergedScenarios,
    default: data.default,
    currentKeyRate,
  });
}

// Adaptive throttling: light endpoint (cached CBR data)
export const GET = withThrottle(handler, {
  name: 'scenarios',
  ...ThrottlePresets.light,
});
