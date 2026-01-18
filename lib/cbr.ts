import { XMLParser } from 'fast-xml-parser';
import type { KeyRateData } from '@/types';
import { CACHE_KEY_RATE } from './constants';
import { getWithCache } from './file-cache';
import { externalApiSemaphore } from './semaphore';
import { cbrFetch } from './resilience';
import logger from './logger';

const CBR_URL = 'https://www.cbr.ru/DailyInfoWebServ/DailyInfo.asmx';
const HISTORY_YEARS = 2;

// File cache settings
const KEY_RATE_CACHE_FILE = 'key-rate-cache.json';
const KEY_RATE_CACHE_MAX_AGE = CACHE_KEY_RATE * 1000; // Convert seconds to ms

interface KeyRateXmlItem {
  DT: string;
  Rate: number;
}

interface DiffgramKeyRate {
  KeyRate: {
    KR: KeyRateXmlItem | KeyRateXmlItem[];
  };
}

interface KeyRateXmlResponse {
  'soap:Envelope': {
    'soap:Body': {
      KeyRateResponse: {
        KeyRateResult: {
          'diffgr:diffgram': DiffgramKeyRate;
        };
      };
    };
  };
}

/**
 * Parse XML response from CBR SOAP API using fast-xml-parser
 */
function parseKeyRateXml(xml: string): KeyRateData[] {
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: true,
  });

  const parsed = parser.parse(xml) as KeyRateXmlResponse;
  const rates: KeyRateData[] = [];

  // Navigate through the diffgr:diffgram structure
  const diffgram = parsed['soap:Envelope']?.['soap:Body']
    ?.KeyRateResponse?.KeyRateResult?.['diffgr:diffgram'];

  if (!diffgram?.KeyRate?.KR) {
    logger.error('Failed to parse CBR response: unexpected structure');
    throw new Error('Failed to parse CBR response');
  }

  const krData = diffgram.KeyRate.KR;
  const items = Array.isArray(krData) ? krData : [krData];

  for (const item of items) {
    if (item.DT && item.Rate !== undefined) {
      const dateStr = item.DT.split('T')[0];
      if (dateStr) {
        rates.push({
          date: dateStr,
          rate: item.Rate,
        });
      }
    }
  }

  if (rates.length === 0) {
    logger.error('Failed to parse CBR response: no rates found');
    throw new Error('No rates found in CBR response');
  }

  // Sort by date descending (newest first)
  rates.sort((a, b) => b.date.localeCompare(a.date));

  return rates;
}

/**
 * Fetch key rate history directly from CBR API (no file cache)
 */
async function fetchKeyRateHistoryFromApi(): Promise<KeyRateData[]> {
  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - HISTORY_YEARS);
  const toDate = new Date();

  const formatDate = (d: Date): string => {
    return d.toISOString().split('T')[0] ?? '';
  };

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <KeyRate xmlns="http://web.cbr.ru/">
      <fromDate>${formatDate(fromDate)}</fromDate>
      <ToDate>${formatDate(toDate)}</ToDate>
    </KeyRate>
  </soap:Body>
</soap:Envelope>`;

  // Semaphore limits concurrency, cbrFetch adds timeout + retry + circuit breaker
  const response = await externalApiSemaphore.run(() =>
    cbrFetch(CBR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'http://web.cbr.ru/KeyRate',
      },
      body: soapEnvelope,
      cache: 'no-store',
    })
  );

  if (!response.ok) {
    throw new Error(`CBR API error: ${response.status}`);
  }

  const xml = await response.text();
  return parseKeyRateXml(xml);
}

/**
 * Fetch key rate history with file cache fallback
 * - Uses cached data if fresh
 * - Fetches new data if stale, keeps old cache on error
 */
export async function fetchKeyRateHistory(): Promise<KeyRateData[]> {
  return getWithCache<KeyRateData[]>(
    KEY_RATE_CACHE_FILE,
    fetchKeyRateHistoryFromApi,
    KEY_RATE_CACHE_MAX_AGE
  );
}

/**
 * Get current (latest) key rate
 */
export async function getCurrentKeyRate(): Promise<KeyRateData | null> {
  const history = await fetchKeyRateHistory();
  return history[0] ?? null;
}

