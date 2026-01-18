import { NextResponse } from 'next/server';
import inflationData from '@/data/inflation-scenarios.json';
import type { InflationScenariosResponse, RateScenarioId } from '@/types';

interface InflationFile {
  scenarios: Record<string, {
    name: string;
    description: string;
    rates: Array<{ date: string; rate: number }>;
  }>;
  default: string;
  sources: string[];
  lastUpdated: string;
}

export function GET(): NextResponse<InflationScenariosResponse> {
  const data = inflationData as InflationFile;

  return NextResponse.json({
    scenarios: data.scenarios as InflationScenariosResponse['scenarios'],
    default: data.default as RateScenarioId,
    sources: data.sources,
    lastUpdated: data.lastUpdated,
  });
}
