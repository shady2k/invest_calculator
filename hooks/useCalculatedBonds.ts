'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { BondSummary } from '@/lib/precalculate';

const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds while calculating

interface CalculatedBondsResponse {
  timestamp: number;
  scenario: string;
  currentKeyRate: number;
  bonds: BondSummary[];
  isCalculating: boolean;
}

interface UseCalculatedBondsResult {
  bonds: BondSummary[];
  currentKeyRate: number | null;
  scenario: string;
  loading: boolean;
  isCalculating: boolean;
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
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentScenarioRef = useRef(initialScenario);

  const fetchBonds = useCallback(async (scenarioId: string, isPolling = false): Promise<boolean> => {
    if (!isPolling) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await fetch(`/api/calculated-bonds?scenario=${scenarioId}`);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data: CalculatedBondsResponse = await response.json();

      setBonds(data.bonds);
      setCurrentKeyRate(data.currentKeyRate);
      setScenario(data.scenario);
      setIsCalculating(data.isCalculating);

      return data.isCalculating;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bonds');
      return false;
    } finally {
      if (!isPolling) {
        setLoading(false);
      }
    }
  }, []);

  const startPolling = useCallback((scenarioId: string) => {
    // Clear any existing poll
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    const poll = async (): Promise<void> => {
      // Don't poll if scenario changed
      if (currentScenarioRef.current !== scenarioId) return;

      const stillCalculating = await fetchBonds(scenarioId, true);

      if (stillCalculating && currentScenarioRef.current === scenarioId) {
        pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
  }, [fetchBonds]);

  const refetch = useCallback(async (scenarioId?: string): Promise<void> => {
    const targetScenario = scenarioId ?? scenario;
    currentScenarioRef.current = targetScenario;

    // Clear existing poll
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    const stillCalculating = await fetchBonds(targetScenario);

    if (stillCalculating) {
      startPolling(targetScenario);
    }
  }, [fetchBonds, scenario, startPolling]);

  useEffect(() => {
    currentScenarioRef.current = initialScenario;

    const init = async (): Promise<void> => {
      const stillCalculating = await fetchBonds(initialScenario);

      if (stillCalculating) {
        startPolling(initialScenario);
      }
    };

    init();

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [fetchBonds, initialScenario, startPolling]);

  return {
    bonds,
    currentKeyRate,
    scenario,
    loading,
    isCalculating,
    error,
    refetch,
  };
}
