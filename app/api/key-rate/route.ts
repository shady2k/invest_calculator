import { NextResponse } from 'next/server';
import { getCurrentKeyRate } from '@/lib/cbr';
import { withThrottle, ThrottlePresets } from '@/lib/rate-limit';
import logger from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function handler(): Promise<Response> {
  try {
    const keyRateData = await getCurrentKeyRate();

    if (!keyRateData) {
      return NextResponse.json(
        { error: 'Key rate not available' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      rate: keyRateData.rate,
      date: keyRateData.date,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get key rate');
    return NextResponse.json(
      { error: 'Failed to get key rate' },
      { status: 500 }
    );
  }
}

// Adaptive throttling: light endpoint (cached data)
export const GET = withThrottle(handler, {
  name: 'key-rate',
  ...ThrottlePresets.light,
});
