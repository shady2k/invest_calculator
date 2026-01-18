import type { ParsedBond, KeyRateData, ScenariosResponse } from '@/types';

/**
 * API client interface for dependency injection
 */
export interface ApiClient {
  fetchBonds: () => Promise<ParsedBond[]>;
  fetchBond: (ticker: string) => Promise<ParsedBond | null>;
  fetchKeyRate: () => Promise<KeyRateData | null>;
  fetchKeyRateHistory: () => Promise<KeyRateData[]>;
  fetchScenarios: () => Promise<ScenariosResponse>;
}

/**
 * Default API client implementation using fetch
 */
export function createApiClient(baseUrl: string = ''): ApiClient {
  return {
    async fetchBonds(): Promise<ParsedBond[]> {
      const response = await fetch(`${baseUrl}/api/bonds`);
      if (!response.ok) {
        throw new Error(`Failed to fetch bonds: ${response.status}`);
      }
      return response.json();
    },

    async fetchBond(ticker: string): Promise<ParsedBond | null> {
      const response = await fetch(`${baseUrl}/api/bonds/${ticker}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch bond: ${response.status}`);
      }
      return response.json();
    },

    async fetchKeyRate(): Promise<KeyRateData | null> {
      const response = await fetch(`${baseUrl}/api/key-rate`);
      if (!response.ok) {
        throw new Error(`Failed to fetch key rate: ${response.status}`);
      }
      return response.json();
    },

    async fetchKeyRateHistory(): Promise<KeyRateData[]> {
      const response = await fetch(`${baseUrl}/api/key-rate?history=true`);
      if (!response.ok) {
        throw new Error(`Failed to fetch key rate history: ${response.status}`);
      }
      return response.json();
    },

    async fetchScenarios(): Promise<ScenariosResponse> {
      const response = await fetch(`${baseUrl}/api/scenarios`);
      if (!response.ok) {
        throw new Error(`Failed to fetch scenarios: ${response.status}`);
      }
      return response.json();
    },
  };
}

/**
 * Default singleton client for browser usage
 */
export const defaultApiClient = createApiClient();
