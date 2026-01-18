import { describe, it, expect } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import type { KeyRateData } from '@/types';

// Real CBR API response (truncated for test)
const REAL_CBR_RESPONSE = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <KeyRateResponse xmlns="http://web.cbr.ru/">
      <KeyRateResult>
        <xs:schema id="KeyRate" xmlns="" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">
          <xs:element name="KeyRate" msdata:IsDataSet="true" msdata:UseCurrentLocale="true">
            <xs:complexType>
              <xs:choice minOccurs="0" maxOccurs="unbounded">
                <xs:element name="KR">
                  <xs:complexType>
                    <xs:sequence>
                      <xs:element name="DT" type="xs:dateTime" minOccurs="0" />
                      <xs:element name="Rate" type="xs:decimal" minOccurs="0" />
                    </xs:sequence>
                  </xs:complexType>
                </xs:element>
              </xs:choice>
            </xs:complexType>
          </xs:element>
        </xs:schema>
        <diffgr:diffgram xmlns:msdata="urn:schemas-microsoft-com:xml-msdata" xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">
          <KeyRate xmlns="">
            <KR diffgr:id="KR1" msdata:rowOrder="0">
              <DT>2025-01-17T00:00:00+03:00</DT>
              <Rate>21.00</Rate>
            </KR>
            <KR diffgr:id="KR2" msdata:rowOrder="1">
              <DT>2025-01-16T00:00:00+03:00</DT>
              <Rate>21.00</Rate>
            </KR>
            <KR diffgr:id="KR3" msdata:rowOrder="2">
              <DT>2024-10-28T00:00:00+03:00</DT>
              <Rate>21.00</Rate>
            </KR>
            <KR diffgr:id="KR4" msdata:rowOrder="3">
              <DT>2024-10-25T00:00:00+03:00</DT>
              <Rate>19.00</Rate>
            </KR>
            <KR diffgr:id="KR5" msdata:rowOrder="4">
              <DT>2024-09-16T00:00:00+03:00</DT>
              <Rate>19.00</Rate>
            </KR>
            <KR diffgr:id="KR6" msdata:rowOrder="5">
              <DT>2024-09-13T00:00:00+03:00</DT>
              <Rate>18.00</Rate>
            </KR>
            <KR diffgr:id="KR7" msdata:rowOrder="6">
              <DT>2024-07-29T00:00:00+03:00</DT>
              <Rate>18.00</Rate>
            </KR>
            <KR diffgr:id="KR8" msdata:rowOrder="7">
              <DT>2024-07-26T00:00:00+03:00</DT>
              <Rate>16.00</Rate>
            </KR>
          </KeyRate>
        </diffgr:diffgram>
      </KeyRateResult>
    </KeyRateResponse>
  </soap:Body>
</soap:Envelope>`;

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
 * Parse function matching lib/cbr.ts implementation
 */
function parseKeyRateXml(xml: string): KeyRateData[] {
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: true,
  });

  const parsed = parser.parse(xml) as KeyRateXmlResponse;
  const rates: KeyRateData[] = [];

  const diffgram = parsed['soap:Envelope']?.['soap:Body']
    ?.KeyRateResponse?.KeyRateResult?.['diffgr:diffgram'];

  if (!diffgram?.KeyRate?.KR) {
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
    throw new Error('No rates found in CBR response');
  }

  rates.sort((a, b) => b.date.localeCompare(a.date));

  return rates;
}

describe('CBR XML Parser', () => {
  it('should parse real CBR API response correctly', () => {
    const rates = parseKeyRateXml(REAL_CBR_RESPONSE);

    expect(rates.length).toBe(8);
    expect(rates[0]).toEqual({ date: '2025-01-17', rate: 21 });
    expect(rates[1]).toEqual({ date: '2025-01-16', rate: 21 });
  });

  it('should sort rates by date descending', () => {
    const rates = parseKeyRateXml(REAL_CBR_RESPONSE);

    for (let i = 1; i < rates.length; i++) {
      const prev = rates[i - 1];
      const curr = rates[i];
      expect((prev?.date ?? '') >= (curr?.date ?? '')).toBe(true);
    }
  });

  it('should extract correct rate values', () => {
    const rates = parseKeyRateXml(REAL_CBR_RESPONSE);

    const rate21 = rates.find(r => r.date === '2025-01-17');
    const rate19 = rates.find(r => r.date === '2024-10-25');
    const rate18 = rates.find(r => r.date === '2024-09-13');
    const rate16 = rates.find(r => r.date === '2024-07-26');

    expect(rate21?.rate).toBe(21);
    expect(rate19?.rate).toBe(19);
    expect(rate18?.rate).toBe(18);
    expect(rate16?.rate).toBe(16);
  });

  it('should throw on invalid XML structure', () => {
    const invalidXml = `<?xml version="1.0"?>
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <KeyRateResponse xmlns="http://web.cbr.ru/">
            <KeyRateResult>
              <InvalidStructure>test</InvalidStructure>
            </KeyRateResult>
          </KeyRateResponse>
        </soap:Body>
      </soap:Envelope>`;

    expect(() => parseKeyRateXml(invalidXml)).toThrow('Failed to parse CBR response');
  });

  it('should throw on empty rates', () => {
    const emptyRatesXml = `<?xml version="1.0"?>
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <KeyRateResponse xmlns="http://web.cbr.ru/">
            <KeyRateResult>
              <diffgr:diffgram xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">
                <KeyRate xmlns="">
                </KeyRate>
              </diffgr:diffgram>
            </KeyRateResult>
          </KeyRateResponse>
        </soap:Body>
      </soap:Envelope>`;

    expect(() => parseKeyRateXml(emptyRatesXml)).toThrow();
  });

  it('should handle single rate entry', () => {
    const singleRateXml = `<?xml version="1.0"?>
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <KeyRateResponse xmlns="http://web.cbr.ru/">
            <KeyRateResult>
              <diffgr:diffgram xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">
                <KeyRate xmlns="">
                  <KR>
                    <DT>2025-01-17T00:00:00+03:00</DT>
                    <Rate>21.00</Rate>
                  </KR>
                </KeyRate>
              </diffgr:diffgram>
            </KeyRateResult>
          </KeyRateResponse>
        </soap:Body>
      </soap:Envelope>`;

    const rates = parseKeyRateXml(singleRateXml);

    expect(rates.length).toBe(1);
    expect(rates[0]).toEqual({ date: '2025-01-17', rate: 21 });
  });
});
