'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RateScenario } from '@/types';
import { defaultApiClient, type ApiClient } from '@/lib/api-client';

interface UseScenariosOptions {
  apiClient?: ApiClient;
}

interface UseScenariosResult {
  scenarios: Record<string, RateScenario>;
  defaultScenarioId: string;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useScenarios(options: UseScenariosOptions = {}): UseScenariosResult {
  const { apiClient = defaultApiClient } = options;

  const [scenarios, setScenarios] = useState<Record<string, RateScenario>>({});
  const [defaultScenarioId, setDefaultScenarioId] = useState<string>('base');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.fetchScenarios();
      setScenarios(data.scenarios);
      setDefaultScenarioId(data.default);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    scenarios,
    defaultScenarioId,
    loading,
    error,
    refetch: fetchData,
  };
}
