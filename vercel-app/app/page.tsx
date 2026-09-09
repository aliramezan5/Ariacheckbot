'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { calculateDeal, type CalculateResult } from '../lib/finance';

type ServerResult = CalculateResult & {
  server: { platform: string; ms: number; requestId: string; region?: string };
};

type Profile = {
  id: string;
  name: string;
  phone?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

type Deal = {
  id: string;
  profileId?: string;
  customerName?: string;
  title?: string;
  principal: number;
  count: number;
  interval: number;
  monthlyRate: number;
  payment: number;
  total: number;
  profit: number;
  rasMonths: number;
  durationMonths: number;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
};

type CloudState = { version: 1; profiles: Profile[]; deals: Deal[]; updatedAt: string };
type CloudStatus = 'loading' | 'online' | 'syncing' | 'offline' | 'error';
type Tab = 'calc' | 'history' | 'settings';

type Theme = 'dark' | 'light';

const nf = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 3 });
const nf0 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
const nfp = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const fmtDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return '—'; }
};

const LOCAL_DEALS = 'aria-vercel-deals-v2';
const LOCAL_PROFILES = 'aria-vercel-profiles-v1';
const LOCAL_SYNC_KEY = 'aria-vercel-sync-key-v1';

function readJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || '') as T; }
  catch { return fallback; }
}

function createSyncKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function mergeById<T extends { id: string; updatedAt: string }>(local: T[], remote: T[], limit: number) {
  const map = new Map<string, T>();
  for (const item of [...local, ...remote]) {
    const prev = map.get(item.id);
    if (!prev || new Date(item.updatedAt).getTime() >= new Date(prev.updatedAt).getTime()) map.set(item.id, item);
  }
  return [...map.values()]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

function asDeal(result: ServerResult, fields: { title: string; customerName: string; profileId?: string }): Deal {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    profileId: fields.profileId,
    customerName: fields.customerName.trim() || undefined,
    title: fields.title.trim() || undefined,
    principal: result.principal,
    count: result.count,
    interval: result.interval,
    monthlyRate: result.monthlyRate,
    payment: result.payment,
    total: result.total,
    profit: result.profit,
    rasMonths: result.rasMonths,
    durationMonths: result.durationMonths,
    createdAt: now,
    updatedAt: now,
    pinned: false,
  };
}

export default function Home() {
  const [principal, setPrincipal] = useState(1200);
  const [count, setCount] = useState(3);
  const [interval, setInterval] = useState(2);
  const [rate, setRate] = useState(7);
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
  const [theme, setTheme] = useState<Theme>('dark');
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

    const savedTheme = localStorage.getItem('aria-vercel-theme') as Theme | null;
    if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme);
    const fs = Number(localStorage.getItem('aria-vercel-font') || '100');
    if (Number.isFinite(fs)) setFontScale(fs);

    const q = new URLSearchParams(window.location.search);
    if (q.has('p')) setPrincipal(Number(q.get('p')) || 1200);
    if (q.has('n')) setCount(Number(q.get('n')) || 3);
    if (q.has('i')) setInterval(Number(q.get('i')) || 2);
    if (q.has('r')) setRate(Number(q.get('r')) || 7);

    void loadCloud(key, localDeals, localProfiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.fontSize = `${16 * fontScale / 100}px`;
    localStorage.setItem('aria-vercel-theme', theme);
    localStorage.setItem('aria-vercel-font', String(fontScale));
  }, [theme, fontScale]);

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
    const started = performance.now();
    setCloudStatus('loading');
    try {
      const response = await fetch('/api/cloud', { headers: { 'x-sync-key': key }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'خطای خواندن Cloud');
      const remote = data.state as CloudState;
      const mergedDeals = mergeById(localDeals, Array.isArray(remote?.deals) ? remote.deals : [], 100);
      const mergedProfiles = mergeById(localProfiles, Array.isArray(remote?.profiles) ? remote.profiles : [], 50);
      setDeals(mergedDeals);
      setProfiles(mergedProfiles);
      setCloudMs(Math.round(performance.now() - started));
      setCloudStatus('online');
      setCloudReady(true);

      if (mergedDeals.length !== (remote?.deals?.length || 0) || mergedProfiles.length !== (remote?.profiles?.length || 0)) {
        await pushCloud(key, mergedDeals, mergedProfiles);
      }
    } catch {
      setCloudStatus('offline');
      setCloudReady(true);
    }
  }

  async function pushCloud(key = syncKey, nextDeals = deals, nextProfiles = profiles) {
    if (!key) return;
    const started = performance.now();
    setCloudStatus('syncing');
    try {
      const state: CloudState = {
        version: 1,
        deals: nextDeals.slice(0, 100),
        profiles: nextProfiles.slice(0, 50),
        updatedAt: new Date().toISOString(),
      };
      const response = await fetch('/api/cloud', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-sync-key': key },
        body: JSON.stringify({ state }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'خطای ذخیره Cloud');
      setCloudMs(Math.round(performance.now() - started));
      setCloudStatus('online');
    } catch {
      setCloudStatus('error');
    }
  }

  async function calculate(save = true) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principal, count, interval, monthlyRate: rate }),
      });
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
            const profile: Profile = {
              id: crypto.randomUUID(),
              name: customerName.trim(),
              phone: customerPhone.trim() || undefined,
              createdAt: now,
              updatedAt: now,
            };
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
        const fallback: ServerResult = { ...local, server: { platform: 'Offline fallback', ms: 0, requestId: 'local' } };
        setResult(fallback);
        setError(e instanceof Error ? `${e.message} — محاسبه محلی انجام شد` : 'محاسبه محلی انجام شد');
      } catch (localError) {
        setError(localError instanceof Error ? localError.message : 'ورودی نامعتبر است');
      }
    } finally {
      setLoading(false);
    }
  }

  function restore(deal: Deal) {
    setPrincipal(deal.principal);
    setCount(deal.count);
    setInterval(deal.interval);
    setRate(deal.monthlyRate);
    setCustomerName(deal.customerName || profiles.find(p => p.id === deal.profileId)?.name || '');
    setDealTitle(deal.title || '');
    setTab('calc');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => void calculate(false), 50);
  }

  function togglePin(id: string) {
    const now = new Date().toISOString();
    setDeals(prev => prev.map(d => d.id === id ? { ...d, pinned: !d.pinned, updatedAt: now } : d));
  }

  function removeDeal(id: string) {
    setDeals(prev => prev.filter(d => d.id !== id));
  }

  async function shareDeal() {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('p', String(principal));
    url.searchParams.set('n', String(count));
    url.searchParams.set('i', String(interval));
    url.searchParams.set('r', String(rate));
    try {
      if (navigator.share) await navigator.share({ title: 'محاسبه چک', text: 'سناریوی اقساط', url: url.toString() });
      else await navigator.clipboard.writeText(url.toString());
    } catch {}
  }

  async function copySyncKey() {
    try { await navigator.clipboard.writeText(syncKey); } catch {}
  }

  async function applyImportedKey() {
    const key = importKey.trim();
    if (!/^[A-Za-z0-9_-]{24,128}$/.test(key)) {
      setError('کلید همگام‌سازی معتبر نیست.');
      return;
    }
    localStorage.setItem(LOCAL_SYNC_KEY, key);
    setSyncKey(key);
    setCloudReady(false);
    setImportKey('');
    await loadCloud(key, deals, profiles);
  }

  async function clearCloud() {
    if (!confirm('حافظه ابری این کلید پاک شود؟ نسخه محلی فعلاً باقی می‌ماند.')) return;
    try {
      await fetch('/api/cloud', { method: 'DELETE', headers: { 'x-sync-key': syncKey } });
      setCloudStatus('online');
    } catch { setCloudStatus('error'); }
  }

  const cloudLabel = cloudStatus === 'online' ? 'همگام' : cloudStatus === 'syncing' ? 'در حال ذخیره…' : cloudStatus === 'loading' ? 'در حال اتصال…' : 'فقط محلی';

  function HistoryCard({ deal }: { deal: Deal }) {
    const profile = profiles.find(p => p.id === deal.profileId);
    const customer = deal.customerName || profile?.name;
    return (
      <article className={`historyCard ${deal.pinned ? 'pinned' : ''}`}>
        <div className="historyTop">
          <div><b>{deal.title || customer || 'معامله بدون عنوان'}</b><span>{fmtDate(deal.createdAt)}</span></div>
          <div className="historyButtons"><button onClick={() => togglePin(deal.id)}>{deal.pinned ? '★' : '☆'}</button><button className="danger" onClick={() => removeDeal(deal.id)}>×</button></div>
        </div>
        <div className="historyNumbers"><div><span>هر چک</span><strong>{nf.format(deal.payment)} م</strong></div><div><span>مانده</span><b>{nf.format(deal.principal)} م</b></div></div>
        <div className="chips"><span>{nf0.format(deal.count)} فقره</span><span>هر {nf0.format(deal.interval)} ماه</span><span>{nfp.format(deal.monthlyRate)}٪</span>{customer && <span>{customer}</span>}</div>
        <button className="restoreButton" onClick={() => restore(deal)}>بازیابی این معامله</button>
      </article>
    );
  }

  return (
    <main className="shell">
      <div className="orb orb1" /><div className="orb orb2" />
      <header className="topbar">
        <button className="iconButton" onClick={() => setTab('settings')} aria-label="تنظیمات">⚙</button>
        <div className="brand"><div className="brandMark">▥</div><div><h1>محاسبه چک</h1><p>Vercel Cloud</p></div></div>
        <button className="iconButton" onClick={shareDeal} aria-label="اشتراک">↗</button>
      </header>

      {tab === 'calc' && <>
        <section className="hero glass">
          <div className="cloudStrip">
            <span className={`dot ${cloudStatus === 'online' || cloudStatus === 'syncing' ? '' : 'off'}`} />
            <span>Cloud History: <b>{cloudLabel}</b></span>
            {cloudMs !== null && <em>{nf0.format(cloudMs)} ms</em>}
          </div>

          <div className="customerBox">
            <label className="field"><span>مشتری <small>اختیاری</small></span><div className="inputBox"><input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="نام مشتری" /></div></label>
            <label className="field"><span>تلفن <small>اختیاری</small></span><div className="inputBox"><input inputMode="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="شماره تماس" /></div></label>
          </div>
          <label className="field"><span>عنوان معامله <small>اختیاری</small></span><div className="inputBox"><input value={dealTitle} onChange={e => setDealTitle(e.target.value)} placeholder="مثلاً تارا - شهریور" /></div></label>

          <label className="field"><span>مانده نقدی معامله</span><div className="inputBox"><input inputMode="decimal" value={principal} onChange={e => setPrincipal(Number(e.target.value))}/><b>میلیون تومان</b></div></label>
          <div className="grid2">
            <label className="field"><span>تعداد چک‌ها</span><div className="inputBox"><input inputMode="numeric" value={count} onChange={e => setCount(Number(e.target.value))}/><b>فقره</b></div></label>
            <label className="field"><span>فاصله هر چک</span><div className="inputBox"><input inputMode="numeric" value={interval} onChange={e => setInterval(Number(e.target.value))}/><b>ماه</b></div></label>
          </div>
          <label className="field rateField"><span>نرخ ماهانه</span><div className="inputBox"><input inputMode="decimal" value={rate} onChange={e => setRate(Number(e.target.value))}/><b>٪</b></div></label>
          <div className="miniStats"><span>رأس <b>{nf.format(liveRas)} ماه</b></span><span>مدت <b>{nf0.format(count * interval)} ماه</b></span></div>
          <button className="primary" onClick={() => void calculate(true)} disabled={loading}>{loading ? 'در حال محاسبه…' : 'محاسبه و ذخیره در Cloud'}</button>
          {error && <p className="error">{error}</p>}
        </section>

        {result && <>
          <section className="resultCard">
            <div className="resultHead"><span>مبلغ هر چک</span><button onClick={() => navigator.clipboard?.writeText(String(result.payment))}>کپی</button></div>
            <strong>{nf.format(result.payment)}</strong><small>میلیون تومان</small>
            <div className="serverBadge">{result.server.platform} • {nf0.format(result.server.ms)} ms {result.server.region ? `• ${result.server.region}` : ''}</div>
          </section>
          <section className="metrics">
            <div className="metric glass"><span>جمع کل چک‌ها</span><b>{nf.format(result.total)} م</b></div>
            <div className="metric glass"><span>سود کل</span><b>{nf.format(result.profit)} م</b></div>
            <div className="metric glass"><span>نرخ هر دوره</span><b>{nfp.format(result.periodRate * 100)}٪</b></div>
            <div className="metric accent"><span>نرخ ماهانه</span><b>{nfp.format(result.monthlyRate)}٪</b></div>
          </section>
          <section className="schedule glass">
            <div className="sectionTitle"><h2>جدول تفصیلی</h2><span>{nf0.format(result.count)} چک</span></div>
            <div className="tableScroll"><table><thead><tr><th>#</th><th>ماه</th><th>مانده اول</th><th>کارمزد</th><th>سهم اصل</th><th>قسط</th><th>مانده</th></tr></thead><tbody>{result.schedule.map(row => <tr key={row.number}><td>{nf0.format(row.number)}</td><td>{nf0.format(row.month)}</td><td>{nf.format(row.opening)}</td><td>{nf.format(row.interest)}</td><td>{nf.format(row.principalPart)}</td><td className="green">{nf.format(row.payment)}</td><td>{nf.format(row.closing)}</td></tr>)}</tbody></table></div>
          </section>
        </>}
      </>}

      {tab === 'history' && <section className="historyPanel">
        <div className="historyHeader glass"><div><h2>حافظه و تاریخچه</h2><p>{nf0.format(deals.length)} معامله • {nf0.format(profiles.length)} مشتری</p></div><span className={`cloudPill ${cloudStatus}`}>{cloudLabel}</span></div>
        {pinnedDeals.length > 0 && <><h3 className="groupTitle">حافظه مهم</h3><div className="historyList">{pinnedDeals.map(deal => <HistoryCard key={deal.id} deal={deal}/>)}</div></>}
        <h3 className="groupTitle">تاریخچه</h3>
        <div className="historyList">{normalDeals.length ? normalDeals.map(deal => <HistoryCard key={deal.id} deal={deal}/>) : <div className="empty glass">هنوز معامله‌ای ذخیره نشده است.</div>}</div>
      </section>}

      {tab === 'settings' && <section className="settingsPanel glass">
        <div className="sectionTitle"><h2>تنظیمات</h2><span>Vercel Cloud Beta</span></div>
        <div className="setting"><span>تم برنامه</span><div className="seg"><button className={theme==='dark'?'active':''} onClick={() => setTheme('dark')}>شب</button><button className={theme==='light'?'active':''} onClick={() => setTheme('light')}>روز</button></div></div>
        <label className="setting stack"><span>اندازه فونت <b>{nf0.format(fontScale)}٪</b></span><input type="range" min="90" max="120" step="5" value={fontScale} onChange={e => setFontScale(Number(e.target.value))}/></label>
        <div className="cloudSettings">
          <div className="cloudSettingHead"><div><b>Cloud History</b><span>Vercel Runtime Cache</span></div><span className={`cloudPill ${cloudStatus}`}>{cloudLabel}</span></div>
          <p>تاریخچه روی Vercel و روی آیفون هر دو نگه‌داری می‌شود. Sync Key مثل رمز دسترسی به تاریخچه است؛ آن را عمومی نکن.</p>
          <div className="keyRow"><code>••••••••••••{syncKey.slice(-8)}</code><button onClick={copySyncKey}>کپی کلید</button></div>
          <button className="secondary" onClick={() => void pushCloud()}>همگام‌سازی الآن</button>
          <div className="importRow"><input value={importKey} onChange={e => setImportKey(e.target.value)} placeholder="Sync Key دستگاه دیگر"/><button onClick={() => void applyImportedKey()}>اتصال</button></div>
          <button className="dangerButton" onClick={() => void clearCloud()}>پاک کردن نسخه Cloud</button>
          <small>این نسخه برای آزمایش قابلیت Cloud Vercel از Runtime Cache استفاده می‌کند؛ Cache بین Deployها می‌ماند ولی آرشیو دائمی تضمین‌شده نیست. برای آرشیو مالی دائمی، اتصال Supabase/Neon مرحله بعد است.</small>
        </div>
      </section>}

      <nav className="bottomNav">
        <button className={tab==='settings'?'active':''} onClick={() => setTab('settings')}>⚙<span>تنظیمات</span></button>
        <button className={tab==='calc'?'active':''} onClick={() => setTab('calc')}>▥<span>محاسبه</span></button>
        <button className={tab==='history'?'active':''} onClick={() => setTab('history')}>◷<span>تاریخچه</span></button>
      </nav>
    </main>
  );
}
