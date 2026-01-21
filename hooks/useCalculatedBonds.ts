'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { BondSummary } from '@/lib/precalculate';
import { POLL_INTERVAL_MS, MAX_POLL_DURATION_MS } from '@/lib/constants';

interface CalculatedBondsResponse {
  timestamp: number;
  scenario: string;
  currentKeyRate: number | null;
  bonds: BondSummary[];
  calculationReady: boolean;
}

interface UseCalculatedBondsResult {
  bonds: BondSummary[];
  currentKeyRate: number | null;
  scenario: string;
  loading: boolean;
  /** True when all bonds have finished calculating */
  calculationReady: boolean;
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
  const [calculationReady, setCalculationReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartTimeRef = useRef<number | null>(null);
  const currentScenarioRef = useRef(initialScenario);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchBonds = useCallback(async (scenarioId: string, isPolling = false): Promise<boolean> => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    if (!isPolling) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await fetch(`/api/calculated-bonds?scenario=${scenarioId}`, {
        signal: abortController.signal,
      });

      // Check if this request was aborted
      if (abortController.signal.aborted) {
        return false;
      }

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data: CalculatedBondsResponse = await response.json();

      // Only update state if this is still the current request
      if (!abortController.signal.aborted) {
        setBonds(data.bonds);
        setCurrentKeyRate(data.currentKeyRate);
        setScenario(data.scenario);
        setCalculationReady(data.calculationReady);
      }

      // Return true if we should continue polling (not ready yet)
      return !data.calculationReady;
    } catch (err) {
      // Don't set error state for aborted requests
      if (err instanceof Error && err.name === 'AbortError') {
        return false;
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch bonds');
      return false;
    } finally {
      if (!isPolling && !abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const startPolling = useCallback((scenarioId: string) => {
    // Clear any existing poll
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    // Record when polling started
    pollStartTimeRef.current = Date.now();

    const poll = async (): Promise<void> => {
      // Don't poll if scenario changed
      if (currentScenarioRef.current !== scenarioId) return;

      // Guard against missing start time (should not happen, but defensive)
      if (pollStartTimeRef.current === null) {
        pollStartTimeRef.current = Date.now();
      }

      // Check if we've exceeded max polling duration
      const pollDuration = Date.now() - pollStartTimeRef.current;
      if (pollDuration >= MAX_POLL_DURATION_MS) {
        console.warn('Polling timeout reached, stopping');
        setError('Превышено время ожидания загрузки данных');
        setCalculationReady(true); // Stop showing "loading" state
        return;
      }

      const shouldContinuePolling = await fetchBonds(scenarioId, true);

      if (shouldContinuePolling && currentScenarioRef.current === scenarioId) {
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
      // Cleanup: abort any in-flight request and clear polling
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
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
    calculationReady,
    error,
    refetch,
  };
}
