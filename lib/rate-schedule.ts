import type { RateScheduleItem, KeyRateData, RateScenarioItem } from '@/types';

/**
 * Merge historical CBR rates with future forecast scenario
 * Past dates use actual CBR data, future dates use scenario forecast
 */
export function buildRateSchedule(
  historicalRates: KeyRateData[],
  forecastScenario: RateScenarioItem[],
  startDate: Date
): RateScheduleItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const schedule: RateScheduleItem[] = [];
  const addedDates = new Set<string>();

  // Sort historical rates by date ascending
  const sortedHistory = [...historicalRates].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Add historical rates (for dates before today)
  for (const item of sortedHistory) {
    const itemDate = new Date(item.date);
    if (itemDate >= startDate && itemDate <= today) {
      const dateKey = item.date;
      if (!addedDates.has(dateKey)) {
        schedule.push({
          date: itemDate,
          rate: item.rate,
        });
        addedDates.add(dateKey);
      }
    }
  }

  // Add forecast rates (for dates after today)
  for (const item of forecastScenario) {
    const itemDate = new Date(item.date);
    if (itemDate > today) {
      const dateKey = item.date;
      if (!addedDates.has(dateKey)) {
        schedule.push({
          date: itemDate,
          rate: item.rate,
        });
        addedDates.add(dateKey);
      }
    }
  }

  // Sort by date ascending
  schedule.sort((a, b) => a.date.getTime() - b.date.getTime());

  // If no historical data, use first forecast item for today
  if (schedule.length === 0 && forecastScenario.length > 0) {
    const firstForecast = forecastScenario[0];
    if (firstForecast) {
      schedule.push({
        date: today,
        rate: firstForecast.rate,
      });
    }
  }

  return schedule;
}

/**
 * Get current key rate from historical data or fallback
 */
export function getCurrentRate(historicalRates: KeyRateData[]): number {
  if (historicalRates.length === 0) {
    return 21; // Fallback
  }

  // Historical rates should be sorted descending (newest first)
  const latest = historicalRates[0];
  return latest?.rate ?? 21;
}

/**
 * Update scenario with current actual rate
 */
export function updateScenarioWithCurrentRate(
  scenario: RateScenarioItem[],
  currentRate: number
): RateScenarioItem[] {
  const today = new Date().toISOString().split('T')[0] ?? '';

  // Find if there's already a rate for today or update the first entry
  const updated = [...scenario];

  if (updated.length > 0 && updated[0]) {
    const firstDate = new Date(updated[0].date);
    const todayDate = new Date(today);

    if (firstDate <= todayDate) {
      // Update first entry with current rate
      updated[0] = { ...updated[0], rate: currentRate };
    } else {
      // Add today's rate at the beginning
      updated.unshift({ date: today, rate: currentRate });
    }
  }

  return updated;
}
