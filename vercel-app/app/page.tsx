'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { calculateDeal, type CalculateResult } from '../lib/finance';

type ServerResult = CalculateResult & { server: { platform: string; ms: number; requestId: string; region?: string } };
type Profile = { id: string; name: string; phone?: string; note?: string; createdAt: string; updatedAt: string };
type Deal = { id: string; profileId?: string; customerName?: string; title?: string; principal: number; count: number; interval: number; monthlyRate: number; payment: number; total: number; profit: number; rasMonths: number; durationMonths: number; createdAt: string; updatedAt: string; pinned?: boolean };
type CloudState = { version: 1; profiles: Profile[]; deals: Deal[]; updatedAt: string };
type CloudStatus = 'loading' | 'online' | 'syncing' | 'offline' | 'error';
type Tab = 'calc' | 'history' | 'saved' | 'customers' | 'settings';

type IconName = 'calc' | 'clock' | 'bookmark' | 'help' | 'settings' | 'car' | 'wallet' | 'file' | 'percent' | 'calendar' | 'sum' | 'share' | 'copy' | 'download' | 'users' | 'cloud' | 'trash' | 'restore' | 'more';

const nf = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
const nfp = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const fmtDate = (iso: string) => { try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch { return '—'; } };
const LOCAL_DEALS = 'aria-vercel-deals-v2';
const LOCAL_PROFILES = 'aria-vercel-profiles-v1';
const LOCAL_SYNC_KEY = 'aria-vercel-sync-key-v1';

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (name) {
    case 'calc': return <svg {...common}><rect x="4" y="2.5" width="16" height="19" rx="3"/><path d="M7.5 6.5h9M8 11h1M12 11h1M16 11h1M8 15h1M12 15h1M16 15h1M8 19h5M16 19h1"/></svg>;
    case 'clock': return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>;
    case 'bookmark': return <svg {...common}><path d="M6.5 3.5h11v17l-5.5-3.4-5.5 3.4z"/></svg>;
    case 'help': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.7 1.8c-.9.6-1.5 1-1.5 2.2M12 17h.01"/></svg>;
    case 'settings': return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.8-1.9.9-1.9-2.1-2.1-1.9.9-1.9-.8-.7-2h-3l-.7 2-1.9.8-1.9-.9L.9 6l.9 1.9L1 9.8v3l2 .7.8 1.9-.9 1.9L5 19.4l1.9-.9 1.9.8.7 2h3l.7-2 1.9-.8 1.9.9 2.1-2.1-.9-1.9z" transform="translate(2) scale(.83)"/></svg>;
    case 'car': return <svg {...common}><path d="M4 14l1.5-5h13L20 14M3 14h18v5H3zM6 19v2M18 19v2M7 15.5h.01M17 15.5h.01"/></svg>;
    case 'wallet': return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 9h18M15 13h4v3h-4z"/></svg>;
    case 'file': return <svg {...common}><path d="M6 3h8l4 4v14H6zM14 3v5h5M9 12h6M9 16h6"/></svg>;
    case 'percent': return <svg {...common}><path d="M7 17L17 7M8 8h.01M16 16h.01"/><circle cx="8" cy="8" r="2"/><circle cx="16" cy="16" r="2"/></svg>;
    case 'calendar': return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/></svg>;
    case 'sum': return <svg {...common}><path d="M18 5H7l5 7-5 7h11"/></svg>;
    case 'share': return <svg {...common}><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.5M8.2 13.2l7.6 4.5"/></svg>;
    case 'copy': return <svg {...common}><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>;
    case 'download': return <svg {...common}><path d="M12 3v11M8 10l4 4 4-4M5 20h14"/></svg>;
    case 'users': return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M16 5.5a3 3 0 0 1 0 5.7M17 14c2.3.7 3.6 2.4 4 5"/></svg>;
    case 'cloud': return <svg {...common}><path d="M7 18h10a4 4 0 0 0 .6-7.9A6 6 0 0 0 6.2 9.5 4.2 4.2 0 0 0 7 18z"/></svg>;
    case 'trash': return <svg {...common}><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></svg>;
    case 'restore': return <svg {...common}><path d="M4 11a8 8 0 1 1 2 6M4 5v6h6"/></svg>;
    case 'more': return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></svg>;
  }
}

function readJson<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; } }
function createSyncKey() { const bytes = new Uint8Array(24); crypto.getRandomValues(bytes); return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }
function mergeById<T extends { id: string; updatedAt: string }>(local: T[], remote: T[], limit: number) {
  const map = new Map<string, T>();
  for (const item of [...local, ...remote]) { const prev = map.get(item.id); if (!prev || new Date(item.updatedAt).getTime() >= new Date(prev.updatedAt).getTime()) map.set(item.id, item); }
  return [...map.values()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, limit);
}
function asDeal(result: ServerResult, fields: { title: string; customerName: string; profileId?: string }): Deal {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), profileId: fields.profileId, customerName: fields.customerName.trim() || undefined, title: fields.title.trim() || undefined, principal: result.principal, count: result.count, interval: result.interval, monthlyRate: result.monthlyRate, payment: result.payment, total: result.total, profit: result.profit, rasMonths: result.rasMonths, durationMonths: result.durationMonths, createdAt: now, updatedAt: now, pinned: false };
}
function faMoney(n: number) { return `${nf.format(n)} م`; }

export default function Home() {
  const [principal, setPrincipal] = useState(2000);
  const [count, setCount] = useState(10);
  const [interval, setInterval] = useState(1);
  const [rate, setRate] = useState(6.5);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [dealTitle, setDealTitle] = useState('');
  const [result, setResult] = useState<ServerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('calc');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('loading');
  const [cloudMs, setCloudMs] = useState<number | null>(null);
  const [syncKey, setSyncKey] = useState('');
  const [importKey, setImportKey] = useState('');
  const [fontScale, setFontScale] = useState(100);
  const [cloudReady, setCloudReady] = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRas = useMemo(() => interval * (count + 1) / 2, [count, interval]);
  const pinnedDeals = useMemo(() => deals.filter(d => d.pinned), [deals]);
  const normalDeals = useMemo(() => deals.filter(d => !d.pinned), [deals]);

  useEffect(() => {
    const localDeals = readJson<Deal[]>(LOCAL_DEALS, []);
    const localProfiles = readJson<Profile[]>(LOCAL_PROFILES, []);
    const key = localStorage.getItem(LOCAL_SYNC_KEY) || createSyncKey();
    localStorage.setItem(LOCAL_SYNC_KEY, key);
    setSyncKey(key);
    setDeals(Array.isArray(localDeals) ? localDeals : []);
    setProfiles(Array.isArray(localProfiles) ? localProfiles : []);
    const fs = Number(localStorage.getItem('aria-vercel-font') || '100'); if (Number.isFinite(fs)) setFontScale(fs);
    const q = new URLSearchParams(window.location.search);
    if (q.has('p')) setPrincipal(Number(q.get('p')) || 2000);
    if (q.has('n')) setCount(Number(q.get('n')) || 10);
    if (q.has('i')) setInterval(Number(q.get('i')) || 1);
    if (q.has('r')) setRate(Number(q.get('r')) || 6.5);
    void loadCloud(key, localDeals, localProfiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * fontScale / 100}px`;
    localStorage.setItem('aria-vercel-font', String(fontScale));
  }, [fontScale]);

  useEffect(() => {
    localStorage.setItem(LOCAL_DEALS, JSON.stringify(deals.slice(0, 100)));
    localStorage.setItem(LOCAL_PROFILES, JSON.stringify(profiles.slice(0, 50)));
    if (!cloudReady || !syncKey) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => void pushCloud(syncKey, deals, profiles), 650);
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, profiles, cloudReady, syncKey]);

  async function loadCloud(key: string, localDeals: Deal[] = deals, localProfiles: Profile[] = profiles) {
    const started = performance.now(); setCloudStatus('loading');
    try {
      const response = await fetch('/api/cloud', { headers: { 'x-sync-key': key }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'خطای خواندن Cloud');
      const remote = data.state as CloudState;
      const mergedDeals = mergeById(localDeals, Array.isArray(remote?.deals) ? remote.deals : [], 100);
      const mergedProfiles = mergeById(localProfiles, Array.isArray(remote?.profiles) ? remote.profiles : [], 50);
      setDeals(mergedDeals); setProfiles(mergedProfiles); setCloudMs(Math.round(performance.now() - started)); setCloudStatus('online'); setCloudReady(true);
      if (mergedDeals.length !== (remote?.deals?.length || 0) || mergedProfiles.length !== (remote?.profiles?.length || 0)) await pushCloud(key, mergedDeals, mergedProfiles);
    } catch { setCloudStatus('offline'); setCloudReady(true); }
  }

  async function pushCloud(key = syncKey, nextDeals = deals, nextProfiles = profiles) {
    if (!key) return;
    const started = performance.now(); setCloudStatus('syncing');
    try {
      const state: CloudState = { version: 1, deals: nextDeals.slice(0, 100), profiles: nextProfiles.slice(0, 50), updatedAt: new Date().toISOString() };
      const response = await fetch('/api/cloud', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-sync-key': key }, body: JSON.stringify({ state }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'خطای ذخیره Cloud');
      setCloudMs(Math.round(performance.now() - started)); setCloudStatus('online');
    } catch { setCloudStatus('error'); }
  }

  async function calculate(save = true) {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ principal, count, interval, monthlyRate: rate }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'خطا در محاسبه');
      const serverResult = data as ServerResult;
      setResult(serverResult);
      if (save) {
        let profileId: string | undefined;
        if (customerName.trim()) {
          const normalized = customerName.trim().toLocaleLowerCase('fa');
          const found = profiles.find(p => p.name.trim().toLocaleLowerCase('fa') === normalized);
          if (found) {
            profileId = found.id;
            if (customerPhone.trim() && found.phone !== customerPhone.trim()) {
              const now = new Date().toISOString();
              setProfiles(prev => prev.map(p => p.id === found.id ? { ...p, phone: customerPhone.trim(), updatedAt: now } : p));
            }
          } else {
            const now = new Date().toISOString();
            const profile: Profile = { id: crypto.randomUUID(), name: customerName.trim(), phone: customerPhone.trim() || undefined, createdAt: now, updatedAt: now };
            profileId = profile.id;
            setProfiles(prev => [profile, ...prev].slice(0, 50));
          }
        }
        const deal = asDeal(serverResult, { title: dealTitle, customerName, profileId });
        setDeals(prev => [deal, ...prev].slice(0, 100));
      }
    } catch (e) {
      try {
        const local = calculateDeal({ principal, count, interval, monthlyRate: rate });
        setResult({ ...local, server: { platform: 'Offline fallback', ms: 0, requestId: 'local' } });
        setError(e instanceof Error ? `${e.message} — محاسبه محلی انجام شد` : 'محاسبه محلی انجام شد');
      } catch (localError) { setError(localError instanceof Error ? localError.message : 'ورودی نامعتبر است'); }
    } finally { setLoading(false); }
  }

  function restore(deal: Deal) {
    setPrincipal(deal.principal); setCount(deal.count); setInterval(deal.interval); setRate(deal.monthlyRate);
    setCustomerName(deal.customerName || profiles.find(p => p.id === deal.profileId)?.name || '');
    setDealTitle(deal.title || '');
    const local = calculateDeal({ principal: deal.principal, count: deal.count, interval: deal.interval, monthlyRate: deal.monthlyRate });
    setResult({ ...local, server: { platform: 'History restore', ms: 0, requestId: deal.id } });
    setTab('calc'); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function togglePin(id: string) { const now = new Date().toISOString(); setDeals(prev => prev.map(d => d.id === id ? { ...d, pinned: !d.pinned, updatedAt: now } : d)); }
  function removeDeal(id: string) { setDeals(prev => prev.filter(d => d.id !== id)); }
  async function shareDeal() {
    const url = new URL(window.location.href); url.search = '';
    url.searchParams.set('p', String(principal)); url.searchParams.set('n', String(count)); url.searchParams.set('i', String(interval)); url.searchParams.set('r', String(rate));
    try { if (navigator.share) await navigator.share({ title: 'محاسبه اقساط', text: result ? `هر چک: ${nf.format(result.payment)} میلیون تومان` : 'سناریوی اقساط', url: url.toString() }); else await navigator.clipboard.writeText(url.toString()); } catch {}
  }
  async function copyTable() {
    if (!result) return;
    const lines = ['ردیف\tماه\tمانده اول\tکارمزد\tسهم اصل\tمبلغ چک\tمانده', ...result.schedule.map(r => `${r.number}\t${r.month}\t${r.opening.toFixed(2)}\t${r.interest.toFixed(2)}\t${r.principalPart.toFixed(2)}\t${r.payment.toFixed(2)}\t${r.closing.toFixed(2)}`)];
    try { await navigator.clipboard.writeText(lines.join('\n')); } catch {}
  }
  function exportCsv() {
    if (!result) return;
    const rows = [['ردیف','ماه','مانده اول','کارمزد','سهم اصل','مبلغ چک','مانده'], ...result.schedule.map(r => [r.number,r.month,r.opening.toFixed(2),r.interest.toFixed(2),r.principalPart.toFixed(2),r.payment.toFixed(2),r.closing.toFixed(2)])];
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = href; a.download = 'aria-check-schedule.csv'; a.click(); URL.revokeObjectURL(href);
  }
  async function copySyncKey() { try { await navigator.clipboard.writeText(syncKey); } catch {} }
  async function applyImportedKey() {
    const key = importKey.trim();
    if (!/^[A-Za-z0-9_-]{24,128}$/.test(key)) { setError('کلید همگام‌سازی معتبر نیست.'); return; }
    localStorage.setItem(LOCAL_SYNC_KEY, key); setSyncKey(key); setCloudReady(false); setImportKey(''); await loadCloud(key, deals, profiles);
  }
  async function clearCloud() {
    if (!confirm('حافظه ابری این کلید پاک شود؟ نسخه محلی فعلاً باقی می‌ماند.')) return;
    try { await fetch('/api/cloud', { method: 'DELETE', headers: { 'x-sync-key': syncKey } }); setCloudStatus('online'); } catch { setCloudStatus('error'); }
  }

  const cloudLabel = cloudStatus === 'online' ? 'همگام' : cloudStatus === 'syncing' ? 'در حال ذخیره…' : cloudStatus === 'loading' ? 'در حال اتصال…' : 'فقط محلی';

  function HistoryCard({ deal }: { deal: Deal }) {
    const profile = profiles.find(p => p.id === deal.profileId); const customer = deal.customerName || profile?.name;
    return <article className={`historyCard ${deal.pinned ? 'pinned' : ''}`}>
      <div className="historyTop"><div><b>{deal.title || customer || 'معامله بدون عنوان'}</b><span>{fmtDate(deal.createdAt)}</span></div><div className="historyButtons"><button onClick={() => togglePin(deal.id)} aria-label="ذخیره">{deal.pinned ? '★' : '☆'}</button><button className="danger" onClick={() => removeDeal(deal.id)} aria-label="حذف"><Icon name="trash" size={18}/></button></div></div>
      <div className="historyNumbers"><div><span>هر چک</span><strong>{faMoney(deal.payment)}</strong></div><div><span>مانده معامله</span><b>{faMoney(deal.principal)}</b></div></div>
      <div className="chips"><span>{nf0.format(deal.count)} فقره</span><span>هر {nf0.format(deal.interval)} ماه</span><span>{nfp.format(deal.monthlyRate)}٪ ماهانه</span>{customer && <span>{customer}</span>}</div>
      <button className="restoreButton" onClick={() => restore(deal)}><Icon name="restore" size={18}/> بازیابی معامله</button>
    </article>;
  }

  return <main className="appShell">
    <header className="appHeader">
      <div className="brandBlock"><div className="logoBox"><Icon name="car" size={28}/></div><div><h1>Ariacheckbot</h1><p>ماشین‌حساب معامله خودرو</p></div></div>
      <div className="headerActions"><button onClick={() => setTab('settings')} aria-label="تنظیمات"><Icon name="settings"/></button><button aria-label="بیشتر"><Icon name="more"/></button></div>
    </header>

    <div className="topTabs" role="tablist">
      <button className={tab==='calc'?'active':''} onClick={() => setTab('calc')}><Icon name="calc" size={18}/>محاسبه</button>
      <button className={tab==='history'?'active':''} onClick={() => setTab('history')}><Icon name="clock" size={18}/>تاریخچه</button>
      <button className={tab==='saved'?'active':''} onClick={() => setTab('saved')}><Icon name="bookmark" size={18}/>ذخیره‌ها</button>
      <button onClick={() => setTab('settings')}><Icon name="help" size={18}/>راهنما</button>
    </div>

    {tab === 'calc' && <div className="pageStack">
      <section className="calcCard">
        <div className="statusLine"><span className={`statusDot ${cloudStatus}`}/><span>Cloud History: <b>{cloudLabel}</b></span>{cloudMs !== null && <em>{nf0.format(cloudMs)} ms</em>}</div>
        <div className="inputGrid">
          <label className="inputCard wide"><span className="inputIcon"><Icon name="wallet"/></span><span className="inputContent"><small>مبلغ پرداختی / مانده معامله</small><span className="inputLine"><input inputMode="decimal" value={principal} onChange={e => setPrincipal(Number(e.target.value))}/><b>میلیون تومان</b></span></span></label>
          <div className="inputCard"><span className="inputIcon"><Icon name="file"/></span><span className="inputContent"><small>تعداد چک‌ها</small><span className="stepper"><button onClick={() => setCount(v => Math.max(1,v-1))}>−</button><strong>{nf0.format(count)}</strong><button onClick={() => setCount(v => Math.min(120,v+1))}>+</button></span></span></div>
          <label className="inputCard"><span className="inputIcon"><Icon name="calendar"/></span><span className="inputContent"><small>فاصله چک‌ها</small><span className="inputLine"><input inputMode="numeric" value={interval} onChange={e => setInterval(Number(e.target.value))}/><b>ماه</b></span></span></label>
          <label className="inputCard"><span className="inputIcon"><Icon name="percent"/></span><span className="inputContent"><small>نرخ کارمزد ماهانه</small><span className="inputLine"><input inputMode="decimal" value={rate} onChange={e => setRate(Number(e.target.value))}/><b>٪</b></span></span></label>
          <div className="inputCard"><span className="inputIcon"><Icon name="sum"/></span><span className="inputContent"><small>رأس وزنی</small><strong className="staticValue">{nf.format(liveRas)} ماه</strong></span></div>
          <div className="inputCard"><span className="inputIcon"><Icon name="clock"/></span><span className="inputContent"><small>مدت کل</small><strong className="staticValue">{nf0.format(count * interval)} ماه</strong></span></div>
        </div>
        <details className="optionalFields"><summary>اطلاعات معامله <span>اختیاری</span></summary><div className="optionalGrid"><input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="نام مشتری"/><input inputMode="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="شماره تماس"/><input className="full" value={dealTitle} onChange={e => setDealTitle(e.target.value)} placeholder="عنوان معامله؛ مثال: تارا شهریور"/></div></details>
        <button className="calculateButton" onClick={() => void calculate(true)} disabled={loading}><Icon name="calc"/>{loading ? 'در حال محاسبه…' : 'محاسبه کن'}</button>
        {error && <p className="errorBox">{error}</p>}
      </section>

      {result && <>
        <section className="summaryGrid">
          <div className="summaryCard green"><span className="summaryIcon"><Icon name="wallet"/></span><small>مبلغ هر چک</small><strong>{nf.format(result.payment)}</strong><em>میلیون تومان</em></div>
          <div className="summaryCard blue"><span className="summaryIcon"><Icon name="calc"/></span><small>جمع کل پرداختی</small><strong>{nf.format(result.total)}</strong><em>میلیون تومان</em></div>
          <div className="summaryCard amber"><span className="summaryIcon"><Icon name="percent"/></span><small>مجموع کارمزد</small><strong>{nf.format(result.profit)}</strong><em>میلیون تومان</em></div>
          <div className="summaryCard violet"><span className="summaryIcon"><Icon name="sum"/></span><small>رأس وزنی</small><strong>{nf.format(result.rasMonths)}</strong><em>ماه</em></div>
        </section>

        <section className="scheduleCard">
          <div className="sectionHeader"><div><h2>جدول اقساط</h2><p>{nf0.format(result.count)} فقره چک • هر {nf0.format(result.interval)} ماه</p></div><span className="serverTag">{result.server.platform === 'Vercel Function' ? 'Vercel' : 'Local'}</span></div>
          <div className="tableWrap"><table><thead><tr><th>#</th><th>ماه</th><th>مبلغ چک</th><th>مانده قبل</th><th>کارمزد دوره</th><th>سهم اصل</th><th>مانده</th></tr></thead><tbody>{result.schedule.map(row => <tr key={row.number}><td>{nf0.format(row.number)}</td><td>{nf0.format(row.month)}</td><td className="paymentCell">{nf.format(row.payment)}</td><td>{nf.format(row.opening)}</td><td>{nf.format(row.interest)}</td><td>{nf.format(row.principalPart)}</td><td>{nf.format(row.closing)}</td></tr>)}</tbody></table></div>
          <div className="tableActions"><button onClick={shareDeal}><Icon name="share" size={19}/>اشتراک‌گذاری</button><button onClick={copyTable}><Icon name="copy" size={19}/>کپی جدول</button><button onClick={exportCsv}><Icon name="download" size={19}/>خروجی Excel</button></div>
        </section>
      </>}
    </div>}

    {tab === 'history' && <section className="contentPage"><div className="contentHeader"><div><h2>تاریخچه معاملات</h2><p>{nf0.format(deals.length)} معامله ذخیره‌شده</p></div><span className={`cloudBadge ${cloudStatus}`}><Icon name="cloud" size={17}/>{cloudLabel}</span></div><div className="historyList">{normalDeals.length ? normalDeals.map(d => <HistoryCard key={d.id} deal={d}/>) : <div className="emptyState">هنوز معامله‌ای ثبت نشده است.</div>}</div></section>}

    {tab === 'saved' && <section className="contentPage"><div className="contentHeader"><div><h2>ذخیره‌ها</h2><p>معاملات مهم و سناریوهای منتخب</p></div><Icon name="bookmark"/></div><div className="historyList">{pinnedDeals.length ? pinnedDeals.map(d => <HistoryCard key={d.id} deal={d}/>) : <div className="emptyState">از تاریخچه روی ☆ بزن تا معامله اینجا ذخیره شود.</div>}</div></section>}

    {tab === 'customers' && <section className="contentPage"><div className="contentHeader"><div><h2>مشتریان</h2><p>{nf0.format(profiles.length)} پروفایل</p></div><Icon name="users"/></div><div className="customerList">{profiles.length ? profiles.map(p => <article key={p.id} className="customerRow"><span className="avatar">{p.name.trim().slice(0,1) || 'م'}</span><div><b>{p.name}</b><span>{p.phone || 'بدون شماره تماس'}</span></div><em>{fmtDate(p.updatedAt)}</em></article>) : <div className="emptyState">با ثبت نام مشتری در یک معامله، پروفایل اینجا ساخته می‌شود.</div>}</div></section>}

    {tab === 'settings' && <section className="contentPage settingsPage"><div className="contentHeader"><div><h2>تنظیمات</h2><p>نمایش و همگام‌سازی</p></div><Icon name="settings"/></div>
      <div className="settingRow"><div><b>اندازه نوشته</b><span>{nf0.format(fontScale)}٪</span></div><input type="range" min="90" max="120" step="5" value={fontScale} onChange={e => setFontScale(Number(e.target.value))}/></div>
      <div className="cloudPanel"><div className="cloudPanelTitle"><span className="inputIcon"><Icon name="cloud"/></span><div><b>Cloud History</b><small>Vercel Runtime Cache</small></div><span className={`cloudBadge ${cloudStatus}`}>{cloudLabel}</span></div><p>تاریخچه هم روی آیفون و هم روی Vercel نگه‌داری می‌شود. Sync Key مانند رمز دسترسی است؛ آن را عمومی نکن.</p><div className="keyBox"><code>••••••••••••{syncKey.slice(-8)}</code><button onClick={copySyncKey}>کپی کلید</button></div><button className="secondaryButton" onClick={() => void pushCloud()}>همگام‌سازی الآن</button><div className="importBox"><input value={importKey} onChange={e => setImportKey(e.target.value)} placeholder="Sync Key دستگاه دیگر"/><button onClick={() => void applyImportedKey()}>اتصال</button></div><button className="dangerButton" onClick={() => void clearCloud()}><Icon name="trash" size={18}/>پاک کردن نسخه Cloud</button><small className="notice">Runtime Cache آرشیو مالی دائمی تضمین‌شده نیست. برای نگهداری دائمی، دیتابیس مستقل لازم است.</small></div>
      <div className="helpPanel"><h3>روش محاسبه</h3><p>این نسخه کارمزد را روی مانده و با نرخ مؤثر هر دوره محاسبه می‌کند. مبلغ هر چک طوری محاسبه می‌شود که مانده در آخرین قسط صفر شود.</p></div>
    </section>}

    <nav className="bottomNav">
      <button className={tab==='settings'?'active':''} onClick={() => setTab('settings')}><Icon name="settings"/><span>تنظیمات</span></button>
      <button className={tab==='saved'?'active':''} onClick={() => setTab('saved')}><Icon name="bookmark"/><span>ذخیره‌ها</span></button>
      <button className={tab==='calc'?'active primaryNav':''} onClick={() => setTab('calc')}><Icon name="calc"/><span>محاسبه</span></button>
      <button className={tab==='customers'?'active':''} onClick={() => setTab('customers')}><Icon name="users"/><span>مشتریان</span></button>
      <button className={tab==='history'?'active':''} onClick={() => setTab('history')}><Icon name="clock"/><span>تاریخچه</span></button>
    </nav>
  </main>;
}
