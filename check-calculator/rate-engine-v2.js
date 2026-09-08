(() => {
  'use strict';

  const VERSION = 'verified-v1';
  const SETTINGS_KEY = 'checkCalc:verifiedRateEngine:v1';
  const SOURCE_FACTORS = {
    personal: { label: 'سرمایه شخصی', factor: 1.00 },
    investor: { label: 'سرمایه‌گذار عادی', factor: 1.10 },
    longTermInvestor: { label: 'سرمایه‌گذار بلندمدت', factor: 1.15 },
    trusted: { label: 'سرمایه فامیلی/معتمد', factor: 0.90 },
  };

  const DEFAULTS = {
    baseRate: 7,
    source: 'personal',
    // These four magnitudes are intentionally neutral until the user defines them.
    // Their verified direction is: more/longer => lower rate.
    rasDiscountPerMonthPct: 0,
    amountDiscountPerBillionPct: 0,
    checkDiscountPerItemPct: 0,
    intervalDiscountPerMonthPct: 0,
  };

  const faToEn = value => String(value ?? '')
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.');
  const num = value => Number(faToEn(value));
  const fa = (value, digits = 2) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: digits }).format(Number(value) || 0);

  function load() {
    try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') || {}) }; }
    catch (_) { return { ...DEFAULTS }; }
  }
  function save(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }
  let cfg = load();

  function metrics() {
    const principal = num(document.getElementById('principal')?.value);
    const count = num(document.getElementById('count')?.value);
    const interval = num(document.getElementById('interval')?.value);
    const ras = interval * (count + 1) / 2;
    return { principal, count, interval, ras, duration: count * interval };
  }

  function discountFactor(value, percentPerUnit) {
    const p = Math.max(0, Number(percentPerUnit) || 0) / 100;
    return Math.max(0.01, 1 - (Math.max(0, Number(value) || 0) * p));
  }

  function compute() {
    const m = metrics();
    const source = SOURCE_FACTORS[cfg.source] || SOURCE_FACTORS.personal;
    const sourceFactor = source.factor;
    const rasFactor = discountFactor(m.ras, cfg.rasDiscountPerMonthPct);
    const amountBillions = m.principal / 1000; // inputs are in million toman
    const amountFactor = discountFactor(amountBillions, cfg.amountDiscountPerBillionPct);
    const countFactor = discountFactor(m.count, cfg.checkDiscountPerItemPct);
    const intervalFactor = discountFactor(m.interval, cfg.intervalDiscountPerMonthPct);
    const totalFactor = sourceFactor * rasFactor * amountFactor * countFactor * intervalFactor;
    const rate = Math.max(0.01, Number(cfg.baseRate || 7) * totalFactor);
    return { ...m, rate, source, sourceFactor, rasFactor, amountFactor, countFactor, intervalFactor, totalFactor };
  }

  function annuity(principal, count, interval, monthlyRatePct) {
    const r = monthlyRatePct / 100;
    const i = Math.pow(1 + r, interval) - 1;
    const payment = principal * i / (1 - Math.pow(1 + i, -count));
    return { i, payment, total: payment * count, profit: payment * count - principal };
  }

  function allFourConfigured() {
    return [cfg.rasDiscountPerMonthPct, cfg.amountDiscountPerBillionPct, cfg.checkDiscountPerItemPct, cfg.intervalDiscountPerMonthPct]
      .every(v => Number(v) > 0);
  }

  function injectSourceButtons() {
    const container = document.querySelector('#autoRatePanel .source-row .segmented');
    if (!container || container.dataset.verifiedSource === '1') return;
    container.dataset.verifiedSource = '1';
    container.style.gridAutoFlow = 'row';
    container.style.gridTemplateColumns = '1fr 1fr';
    container.innerHTML = Object.entries(SOURCE_FACTORS).map(([key, item]) =>
      `<button type="button" data-vsource="${key}">${item.label}</button>`
    ).join('');
    container.querySelectorAll('[data-vsource]').forEach(btn => btn.addEventListener('click', () => {
      cfg.source = btn.dataset.vsource;
      save(cfg);
      update();
    }));
  }

  function injectCard() {
    const anchor = document.querySelector('#autoRatePanel .auto-rate-result');
    if (!anchor || document.getElementById('verifiedRateCard')) return;
    anchor.insertAdjacentHTML('afterend', `
      <div id="verifiedRateCard" style="margin-top:9px;padding:11px;border:1px solid rgba(76,166,255,.22);border-radius:14px;background:linear-gradient(135deg,rgba(32,99,183,.12),rgba(103,80,210,.10));display:grid;gap:8px">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <span style="font-size:.68rem;color:var(--muted);font-weight:750">موتور نرخ واقعی</span>
          <b id="verifiedEngineStatus" style="font-size:.62rem;color:#6fd79d">${VERSION}</b>
        </div>
        <div id="verifiedBreakdown" style="font-size:.66rem;line-height:1.8;color:var(--text)"></div>
        <button id="verifiedConfigure" type="button" style="min-height:38px;border:1px solid rgba(80,157,255,.24);border-radius:11px;background:rgba(47,140,255,.12);color:#73b4ff;font-weight:800;font-size:.72rem">تنظیم ضرایب رأس، مبلغ، تعداد و فاصله</button>
      </div>`);
    document.getElementById('verifiedConfigure').addEventListener('click', openConfig);
  }

  function injectSheet() {
    if (document.getElementById('verifiedRateSheet')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="verifiedRateOverlay" hidden style="position:fixed;inset:0;z-index:60;background:rgba(0,6,16,.62);backdrop-filter:blur(6px)"></div>
      <aside id="verifiedRateSheet" aria-hidden="true" style="position:fixed;z-index:61;left:50%;bottom:0;width:min(100%,480px);max-height:88vh;transform:translate(-50%,105%);transition:transform .28s cubic-bezier(.2,.8,.2,1);border-radius:26px 26px 0 0;background:linear-gradient(180deg,var(--bg2),var(--bg));border:1px solid var(--border);box-shadow:0 -24px 60px rgba(0,0,0,.4);overflow:auto;padding:12px 14px max(22px,env(safe-area-inset-bottom))">
        <div style="width:42px;height:5px;border-radius:99px;background:var(--border);margin:0 auto 10px"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><button id="verifiedRateClose" type="button" style="border:0;background:transparent;color:#54a7ff;font-weight:800">بستن</button><strong>ضرایب نرخ اتومات</strong><span style="width:44px"></span></div>
        <p style="font-size:.7rem;line-height:1.8;color:var(--muted);margin:0 0 12px">جهت اثر ثبت‌شده این است: هرچه رأس، مبلغ، تعداد چک یا فاصله بیشتر باشد، نرخ کمتر می‌شود. چون مقدار عددی دقیق این چهار ضریب در سوابق پیدا نشد، بدون تأیید شما صفر نگه داشته شده‌اند.</p>
        <label class="verified-field">نرخ پایه (%)<input id="vBase" inputmode="decimal"></label>
        <label class="verified-field">کاهش ضریب به ازای هر ماه رأس (%)<input id="vRas" inputmode="decimal"></label>
        <label class="verified-field">کاهش ضریب به ازای هر ۱ میلیارد تومان (%)<input id="vAmount" inputmode="decimal"></label>
        <label class="verified-field">کاهش ضریب به ازای هر فقره چک (%)<input id="vCount" inputmode="decimal"></label>
        <label class="verified-field">کاهش ضریب به ازای هر ماه فاصله (%)<input id="vInterval" inputmode="decimal"></label>
        <button id="verifiedRateSave" type="button" style="width:100%;min-height:48px;border:0;border-radius:14px;color:#fff;background:linear-gradient(105deg,#1fc6e8,#2488ff 43%,#8256ff);font-weight:850">ذخیره ضرایب</button>
        <style>.verified-field{display:grid;grid-template-columns:1fr 110px;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line);font-size:.75rem}.verified-field input{width:100%;min-height:40px;border:1px solid var(--border);border-radius:10px;background:var(--soft);color:var(--text);text-align:center;direction:ltr}</style>
      </aside>`);
    const sheet = document.getElementById('verifiedRateSheet');
    const overlay = document.getElementById('verifiedRateOverlay');
    const close = () => { sheet.style.transform = 'translate(-50%,105%)'; sheet.setAttribute('aria-hidden','true'); document.body.style.overflow=''; setTimeout(()=>overlay.hidden=true,240); };
    document.getElementById('verifiedRateClose').addEventListener('click', close);
    overlay.addEventListener('click', close);
    document.getElementById('verifiedRateSave').addEventListener('click', () => {
      cfg.baseRate = Math.max(.01, num(document.getElementById('vBase').value) || 7);
      cfg.rasDiscountPerMonthPct = Math.max(0, num(document.getElementById('vRas').value) || 0);
      cfg.amountDiscountPerBillionPct = Math.max(0, num(document.getElementById('vAmount').value) || 0);
      cfg.checkDiscountPerItemPct = Math.max(0, num(document.getElementById('vCount').value) || 0);
      cfg.intervalDiscountPerMonthPct = Math.max(0, num(document.getElementById('vInterval').value) || 0);
      save(cfg); close(); update();
    });
    window.__closeVerifiedRateSheet = close;
  }

  function openConfig() {
    injectSheet();
    document.getElementById('vBase').value = cfg.baseRate;
    document.getElementById('vRas').value = cfg.rasDiscountPerMonthPct || '';
    document.getElementById('vAmount').value = cfg.amountDiscountPerBillionPct || '';
    document.getElementById('vCount').value = cfg.checkDiscountPerItemPct || '';
    document.getElementById('vInterval').value = cfg.intervalDiscountPerMonthPct || '';
    const overlay = document.getElementById('verifiedRateOverlay');
    const sheet = document.getElementById('verifiedRateSheet');
    overlay.hidden = false;
    requestAnimationFrame(() => { sheet.style.transform='translate(-50%,0)'; sheet.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; });
  }

  function update() {
    injectSourceButtons(); injectCard();
    const autoBtn = document.querySelector('[data-rate-mode="auto"]');
    const isAuto = autoBtn?.classList.contains('active');
    if (!isAuto) return;

    const c = compute();
    const calc = annuity(c.principal, c.count, c.interval, c.rate);
    if (![c.principal,c.count,c.interval,c.rate,calc.payment].every(Number.isFinite) || c.principal <= 0 || c.count < 1 || c.interval < 1) return;

    document.querySelectorAll('[data-vsource]').forEach(btn => btn.classList.toggle('active', btn.dataset.vsource === cfg.source));
    const effective = document.getElementById('effectiveRate');
    const reason = document.getElementById('rateReason');
    const monthly = document.getElementById('monthlyRateMetric');
    if (effective) effective.textContent = `${fa(c.rate,3)}٪`;
    if (monthly) monthly.textContent = `${fa(c.rate,3)}٪`;
    if (reason) reason.textContent = `${c.source.label} × ضریب کل ${fa(c.totalFactor,4)}`;

    const payment = document.getElementById('payment');
    const total = document.getElementById('total');
    const profit = document.getElementById('profit');
    const period = document.getElementById('periodRate');
    const periodMetric = document.getElementById('periodRateMetric');
    if (payment) payment.textContent = fa(calc.payment,3);
    if (total) total.textContent = `${fa(calc.total,3)} م`;
    if (profit) profit.textContent = `${fa(calc.profit,3)} م`;
    if (period) period.textContent = `نرخ هر دوره ${fa(calc.i*100,3)}٪`;
    if (periodMetric) periodMetric.textContent = `${fa(calc.i*100,3)}٪`;

    const schedule = document.getElementById('schedule');
    if (schedule) {
      schedule.innerHTML = '';
      for (let i=1;i<=c.count;i++) {
        const row = document.createElement('div');
        row.className='schedule-row';
        row.innerHTML=`<span class="num">چک ${fa(i,0)}</span><span class="due">ماه ${fa(i*c.interval,0)}</span><span class="amount">${fa(calc.payment,3)} م</span>`;
        schedule.appendChild(row);
      }
    }

    const breakdown = document.getElementById('verifiedBreakdown');
    if (breakdown) {
      const pending = allFourConfigured() ? '' : '<div style="color:#ffb36b">ضرایب عددی چهار عامل هنوز کامل تعریف نشده‌اند؛ هیچ عدد فرضی اعمال نشده.</div>';
      breakdown.innerHTML = `
        <div>نرخ پایه: <b>${fa(cfg.baseRate,3)}٪</b></div>
        <div>نوع سرمایه: <b>${c.source.label} × ${c.sourceFactor.toFixed(2)}</b></div>
        <div>ضریب رأس: <b>${c.rasFactor.toFixed(4)}</b> | مبلغ: <b>${c.amountFactor.toFixed(4)}</b></div>
        <div>تعداد چک: <b>${c.countFactor.toFixed(4)}</b> | فاصله: <b>${c.intervalFactor.toFixed(4)}</b></div>
        <div>ضریب کل: <b>${c.totalFactor.toFixed(4)}</b> → نرخ نهایی: <b style="color:var(--green)">${fa(c.rate,3)}٪</b></div>${pending}`;
    }

    // Mutate history snapshot before the history module receives it.
    window.__verifiedRateSnapshot = { ...c, ...calc, reason: `${c.source.label} × ${c.totalFactor.toFixed(4)}` };
  }

  window.addEventListener('checkcalc:calculated', e => {
    update();
    const v = window.__verifiedRateSnapshot;
    if (!v || !e.detail) return;
    Object.assign(e.detail, {
      rate: v.rate,
      source: cfg.source,
      payment: v.payment,
      total: v.total,
      profit: v.profit,
      periodRate: v.i,
      ras: v.ras,
      duration: v.duration,
      reason: v.reason,
    });
  }, true);

  ['input','change','click'].forEach(type => document.addEventListener(type, e => {
    if (e.target.closest('#principal,#count,#interval,[data-rate-mode],[data-vsource],#autoRatePanel')) setTimeout(update,0);
  }, true));

  function init() {
    injectSourceButtons(); injectCard(); injectSheet(); update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
  setTimeout(update,250);
  setTimeout(update,900);

  window.VerifiedRateEngine = { version:VERSION, compute, update, openConfig, getConfig:()=>({...cfg}) };
})();