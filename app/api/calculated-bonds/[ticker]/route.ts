import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCalculatedBond } from '@/lib/precalculate';
import logger from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ ticker: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { ticker } = await params;
  const searchParams = request.nextUrl.searchParams;
  const scenario = searchParams.get('scenario') ?? 'base';

  try {
    const bond = await getCalculatedBond(ticker, scenario);

    if (!bond) {
      return NextResponse.json(
        { error: 'Bond not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(bond);
  } catch (error) {
    logger.error({ error, ticker, scenario }, 'Failed to get bond calculation');
    return NextResponse.json(
      { error: 'Failed to get bond calculation' },
      { status: 500 }
    );
  }
}
