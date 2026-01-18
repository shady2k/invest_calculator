'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ParsedBond } from '@/types';
import { defaultApiClient, type ApiClient } from '@/lib/api-client';

interface UseBondsOptions {
  apiClient?: ApiClient;
}

interface UseBondsResult {
  bonds: ParsedBond[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useBonds(options: UseBondsOptions = {}): UseBondsResult {
  const { apiClient = defaultApiClient } = options;

  const [bonds, setBonds] = useState<ParsedBond[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBonds = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.fetchBonds();
      setBonds(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    void fetchBonds();
  }, [fetchBonds]);

  return {
    bonds,
    loading,
    error,
    refetch: fetchBonds,
  };
}
