'use client';

import { useState, useEffect, useCallback } from 'react';
import type { KeyRateData } from '@/types';
import { defaultApiClient, type ApiClient } from '@/lib/api-client';

interface UseKeyRateOptions {
  apiClient?: ApiClient;
  fetchHistory?: boolean;
}

interface UseKeyRateResult {
  currentRate: KeyRateData | null;
  history: KeyRateData[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useKeyRate(options: UseKeyRateOptions = {}): UseKeyRateResult {
  const { apiClient = defaultApiClient, fetchHistory = false } = options;

  const [currentRate, setCurrentRate] = useState<KeyRateData | null>(null);
  const [history, setHistory] = useState<KeyRateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      if (fetchHistory) {
        const historyData = await apiClient.fetchKeyRateHistory();
        setHistory(historyData);
        setCurrentRate(historyData[0] ?? null);
      } else {
        const rateData = await apiClient.fetchKeyRate();
        setCurrentRate(rateData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiClient, fetchHistory]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    currentRate,
    history,
    loading,
    error,
    refetch: fetchData,
  };
}
