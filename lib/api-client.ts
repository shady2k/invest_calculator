import type { ScenariosResponse } from '@/types';

/**
 * API client interface for dependency injection
 */
export interface ApiClient {
  fetchScenarios: () => Promise<ScenariosResponse>;
}

/**
 * Default API client implementation using fetch
 */
export function createApiClient(baseUrl: string = ''): ApiClient {
  return {
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
