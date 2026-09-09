import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCache } from '@vercel/functions';

export const runtime = 'nodejs';
export const preferredRegion = 'fra1';

const TTL_SECONDS = 60 * 60 * 24 * 30;
const cache = getCache({ namespace: 'aria-check-cloud-v1' });

type Profile = { id: string; name: string; phone?: string; note?: string; createdAt: string; updatedAt: string };
type Deal = { id: string; profileId?: string; customerName?: string; title?: string; principal: number; count: number; interval: number; monthlyRate: number; payment: number; total: number; profit: number; rasMonths: number; durationMonths: number; createdAt: string; updatedAt: string; pinned?: boolean };
type CloudState = { version: 1; profiles: Profile[]; deals: Deal[]; updatedAt: string };

const emptyState = (): CloudState => ({ version: 1, profiles: [], deals: [], updatedAt: new Date().toISOString() });

function syncKey(request: Request) {
  const raw = request.headers.get('x-sync-key') || '';
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(raw)) throw new Error('کلید همگام‌سازی معتبر نیست');
  return createHash('sha256').update(raw).digest('hex');
}
function text(value: unknown, max: number) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function finite(value: unknown, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function sanitizeProfile(value: unknown): Profile | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const id = text(v.id, 100); const name = text(v.name, 120); if (!id || !name) return null;
  const now = new Date().toISOString();
  return { id, name, phone: text(v.phone, 40) || undefined, note: text(v.note, 500) || undefined, createdAt: text(v.createdAt, 40) || now, updatedAt: text(v.updatedAt, 40) || now };
}
function sanitizeDeal(value: unknown): Deal | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const id = text(v.id, 100); const principal = finite(v.principal, NaN); const count = finite(v.count, NaN); const interval = finite(v.interval, NaN); const monthlyRate = finite(v.monthlyRate, NaN); const payment = finite(v.payment, NaN);
  if (!id || ![principal, count, interval, monthlyRate, payment].every(Number.isFinite)) return null;
  const now = new Date().toISOString();
  return { id, profileId: text(v.profileId, 100) || undefined, customerName: text(v.customerName, 120) || undefined, title: text(v.title, 160) || undefined, principal, count, interval, monthlyRate, payment, total: finite(v.total), profit: finite(v.profit), rasMonths: finite(v.rasMonths), durationMonths: finite(v.durationMonths), createdAt: text(v.createdAt, 40) || now, updatedAt: text(v.updatedAt, 40) || now, pinned: Boolean(v.pinned) };
}
function sanitizeState(value: unknown): CloudState {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const profiles = Array.isArray(raw.profiles) ? raw.profiles.map(sanitizeProfile).filter((x): x is Profile => Boolean(x)).slice(0, 50) : [];
  const deals = Array.isArray(raw.deals) ? raw.deals.map(sanitizeDeal).filter((x): x is Deal => Boolean(x)).slice(0, 100) : [];
  return { version: 1, profiles, deals, updatedAt: new Date().toISOString() };
}

export async function GET(request: Request) {
  const started = Date.now();
  try {
    const key = syncKey(request);
    const data = await cache.get(`state:${key}`) as CloudState | undefined;
    const state = data ? sanitizeState(data) : emptyState();
    console.log(JSON.stringify({ level: 'info', msg: 'cloud_read', route: '/api/cloud', ms: Date.now() - started, deals: state.deals.length, profiles: state.profiles.length }));
    return NextResponse.json({ state, storage: 'Vercel Runtime Cache', durable: false }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطای خواندن حافظه ابری';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
export async function PUT(request: Request) {
  const started = Date.now();
  try {
    const key = syncKey(request);
    const body = await request.json();
    const state = sanitizeState(body?.state);
    await cache.set(`state:${key}`, state, { ttl: TTL_SECONDS, tags: [`aria-check-user:${key.slice(0, 16)}`], name: 'aria-check-cloud-state' });
    console.log(JSON.stringify({ level: 'info', msg: 'cloud_write', route: '/api/cloud', ms: Date.now() - started, deals: state.deals.length, profiles: state.profiles.length }));
    return NextResponse.json({ ok: true, state, storage: 'Vercel Runtime Cache', durable: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطای ذخیره حافظه ابری';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
export async function DELETE(request: Request) {
  try { const key = syncKey(request); await cache.delete(`state:${key}`); return NextResponse.json({ ok: true }); }
  catch (error) { const message = error instanceof Error ? error.message : 'خطای پاک کردن حافظه ابری'; return NextResponse.json({ error: message }, { status: 400 }); }
}
