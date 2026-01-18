import { NextResponse } from 'next/server';
import scenariosData from '@/data/rate-scenarios.json';

interface ScenarioData {
  name: string;
  description: string;
  rates: Array<{ date: string; rate: number }>;
}

interface ScenariosFile {
  scenarios: Record<string, ScenarioData>;
  default: string;
}

export function GET(): NextResponse {
  const data = scenariosData as ScenariosFile;

  return NextResponse.json({
    scenarios: data.scenarios,
    default: data.default,
  });
}
