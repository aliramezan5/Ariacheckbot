import { NextResponse } from 'next/server';
import { calculateDeal } from '../../../lib/finance';

export const runtime = 'nodejs';
export const preferredRegion = 'fra1';

export async function POST(request: Request) {
  const started = Date.now();
  const requestId = request.headers.get('x-vercel-id') || crypto.randomUUID();

  try {
    const body = await request.json();
    const result = calculateDeal({
      principal: Number(body.principal),
      count: Number(body.count),
      interval: Number(body.interval),
      monthlyRate: Number(body.monthlyRate),
    });

    const ms = Date.now() - started;
    console.log(JSON.stringify({
      level: 'info',
      msg: 'calculate',
      route: '/api/calculate',
      requestId,
      ms,
      count: result.count,
      interval: result.interval,
      monthlyRate: result.monthlyRate,
    }));

    return NextResponse.json({
      ...result,
      server: {
        platform: 'Vercel Function',
        ms,
        requestId,
        region: process.env.VERCEL_REGION || 'fra1',
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطای محاسبه';
    console.error(JSON.stringify({
      level: 'error',
      msg: 'calculate_failed',
      route: '/api/calculate',
      requestId,
      ms: Date.now() - started,
      error: message,
    }));
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
