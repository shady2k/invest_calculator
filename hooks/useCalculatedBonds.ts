'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BondSummary } from '@/lib/precalculate';

interface CalculatedBondsResponse {
  timestamp: number;
  scenario: string;
  currentKeyRate: number;
  bonds: BondSummary[];
}

interface UseCalculatedBondsResult {
  bonds: BondSummary[];
  currentKeyRate: number | null;
  scenario: string;
  loading: boolean;
  error: string | null;
  refetch: (scenarioId?: string) => Promise<void>;
}

export function useCalculatedBonds(
  initialScenario: string = 'base'
): UseCalculatedBondsResult {
  const [bonds, setBonds] = useState<BondSummary[]>([]);
  const [currentKeyRate, setCurrentKeyRate] = useState<number | null>(null);
  const [scenario, setScenario] = useState(initialScenario);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBonds = useCallback(async (scenarioId: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/calculated-bonds?scenario=${scenarioId}`);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data: CalculatedBondsResponse = await response.json();

      setBonds(data.bonds);
      setCurrentKeyRate(data.currentKeyRate);
      setScenario(data.scenario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bonds');
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async (scenarioId?: string): Promise<void> => {
    await fetchBonds(scenarioId ?? scenario);
  }, [fetchBonds, scenario]);

  useEffect(() => {
    fetchBonds(initialScenario);
  }, [fetchBonds, initialScenario]);

  return {
    bonds,
    currentKeyRate,
    scenario,
    loading,
    error,
    refetch,
  };
}
