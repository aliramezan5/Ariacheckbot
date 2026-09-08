const DEFAULTS = {
  theme: 'light',
  fontScale: 100,
  uiScale: 100,
  rateMode: 'auto',
  source: 'personal',
  manualRate: 7,
  personalBaseRate: 7,
  investorBaseRate: 5,
  rasRules: [],
  amountRules: [],
};

const els = Object.fromEntries([
  'principal','count','interval','calculate','payment','total','profit','periodRate','schedule','copy','error','resultCard',
  'effectiveRate','rateReason','durationMetric','rasMetric','autoRatePanel','manualRatePanel','manualRate','settingsOpen','settingsClose',
  'settingsOverlay','settingsSheet','fontScale','uiScale','fontScaleLabel','uiScaleLabel','personalBaseRate','investorBaseRate','rasRules',
  'amountRules','addRasRule','addAmountRule','resetSettings','scheduleToggle','rasRuleTemplate','amountRuleTemplate'
].map(id => [id, document.getElementById(id)]));

const faToEn = value => String(value ?? '')
  .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/[٬,\s]/g, '')
  .replace('٫', '.');
const parseNumber = value => Number(faToEn(value));
const faNumber = (value, digits = 3) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: digits }).format(value);
const clamp = (v,min,max) => Math.min(max,Math.max(min,v));

let settings = loadSettings();

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem('checkCalc:settings:v2') || 'null');
    return { ...DEFAULTS, ...(raw || {}), rasRules: raw?.rasRules || [], amountRules: raw?.amountRules || [] };
  } catch (_) { return { ...DEFAULTS }; }
}
function saveSettings() {
  localStorage.setItem('checkCalc:settings:v2', JSON.stringify(settings));
}

function setTheme(theme) {
  settings.theme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = settings.theme;
  document.querySelector('meta[name="theme-color"]').setAttribute('content', settings.theme === 'dark' ? '#0d1624' : '#ffffff');
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').setAttribute('content', settings.theme === 'dark' ? 'black-translucent' : 'default');
  document.querySelectorAll('[data-theme]').forEach(b => b.classList.toggle('active', b.dataset.theme === settings.theme));
}
function applyScale() {
  const fontRatio = settings.fontScale / 100;
  const uiRatio = settings.uiScale / 100;
  const root = document.documentElement;
  root.style.setProperty('--font-base', `${16 * fontRatio}px`);
  root.style.setProperty('--app-max', `${460 * uiRatio}px`);
  root.style.setProperty('--app-top', `${22 * uiRatio}px`);
  root.style.setProperty('--app-x', `${16 * uiRatio}px`);
  root.style.setProperty('--app-bottom', `${28 * uiRatio}px`);
  root.style.setProperty('--header-gap', `${20 * uiRatio}px`);
  root.style.setProperty('--form-gap', `${13 * uiRatio}px`);
  root.style.setProperty('--input-h', `${58 * uiRatio}px`);
  root.style.setProperty('--button-h', `${56 * uiRatio}px`);
  root.style.setProperty('--result-gap', `${17 * uiRatio}px`);
  els.fontScale.value = settings.fontScale;
  els.uiScale.value = settings.uiScale;
  els.fontScaleLabel.textContent = `${faNumber(settings.fontScale,0)}٪`;
  els.uiScaleLabel.textContent = `${faNumber(settings.uiScale,0)}٪`;
}
function syncSettingsControls() {
  setTheme(settings.theme);
  applyScale();
  els.personalBaseRate.value = settings.personalBaseRate;
  els.investorBaseRate.value = settings.investorBaseRate;
  els.manualRate.value = settings.manualRate;
  document.querySelectorAll('[data-rate-mode]').forEach(b => b.classList.toggle('active', b.dataset.rateMode === settings.rateMode));
  document.querySelectorAll('[data-settings-rate-mode]').forEach(b => b.classList.toggle('active', b.dataset.settingsRateMode === settings.rateMode));
  document.querySelectorAll('[data-source]').forEach(b => b.classList.toggle('active', b.dataset.source === settings.source));
  els.autoRatePanel.hidden = settings.rateMode !== 'auto';
  els.manualRatePanel.hidden = settings.rateMode !== 'manual';
  renderRules();
}

function getDealMetrics(count, interval) {
  const duration = count * interval;
  const ras = interval * (count + 1) / 2;
  return { duration, ras };
}

function getAutoRate(principal, ras) {
  const base = settings.source === 'investor' ? Number(settings.investorBaseRate) : Number(settings.personalBaseRate);
  let rate = base;
  let reason = settings.source === 'investor' ? 'سرمایه‌گذار' : 'سرمایه شخصی';

  const rasRules = [...settings.rasRules]
    .filter(r => Number.isFinite(Number(r.maxRas)))
    .sort((a,b) => Number(a.maxRas) - Number(b.maxRas));
  const rasRule = rasRules.find(r => ras <= Number(r.maxRas));
  if (rasRule) {
    const candidate = settings.source === 'investor' ? Number(rasRule.investorRate) : Number(rasRule.personalRate);
    if (Number.isFinite(candidate) && candidate > 0) {
      rate = candidate;
      reason += ` • قاعده رأس تا ${faNumber(Number(rasRule.maxRas),1)} ماه`;
    }
  }

  const amountRules = [...settings.amountRules]
    .filter(r => Number.isFinite(Number(r.minAmount)) && Number.isFinite(Number(r.adjustment)))
    .sort((a,b) => Number(a.minAmount) - Number(b.minAmount));
  const matchedAmount = amountRules.filter(r => principal >= Number(r.minAmount)).at(-1);
  if (matchedAmount) {
    rate += Number(matchedAmount.adjustment);
    const sign = Number(matchedAmount.adjustment) >= 0 ? '+' : '';
    reason += ` • مبلغ ${sign}${faNumber(Number(matchedAmount.adjustment),2)}٪`;
  }
  return { rate: Math.max(0.01, rate), reason };
}

function calculatePayment(principal, count, intervalMonths, monthlyRatePercent) {
  const monthlyRate = monthlyRatePercent / 100;
  const periodRate = Math.pow(1 + monthlyRate, intervalMonths) - 1;
  const payment = principal * periodRate / (1 - Math.pow(1 + periodRate, -count));
  return { periodRate, payment };
}

function validate(principal, count, interval, rate) {
  if (!Number.isFinite(principal) || principal <= 0) return 'مانده نقدی معامله را درست وارد کن.';
  if (!Number.isInteger(count) || count < 1 || count > 120) return 'تعداد چک باید بین ۱ تا ۱۲۰ باشد.';
  if (!Number.isInteger(interval) || interval < 1 || interval > 60) return 'فاصله چک باید حداقل ۱ ماه باشد.';
  if (!Number.isFinite(rate) || rate <= 0 || rate > 50) return 'نرخ کارمزد معتبر نیست.';
  return '';
}

function render() {
  const principal = parseNumber(els.principal.value);
  const count = parseNumber(els.count.value);
  const interval = parseNumber(els.interval.value);
  const { duration, ras } = getDealMetrics(Number.isFinite(count) ? count : 0, Number.isFinite(interval) ? interval : 0);
  const auto = getAutoRate(principal, ras);
  const rate = settings.rateMode === 'auto' ? auto.rate : parseNumber(els.manualRate.value);
  const error = validate(principal, count, interval, rate);

  els.durationMetric.textContent = `${faNumber(duration,1)} ماه`;
  els.rasMetric.textContent = `${faNumber(ras,1)} ماه`;
  els.effectiveRate.textContent = `${faNumber(auto.rate,2)}٪`;
  els.rateReason.textContent = auto.reason;

  if (error) {
    els.error.textContent = error;
    els.error.hidden = false;
    return;
  }
  els.error.hidden = true;

  const { periodRate, payment } = calculatePayment(principal, count, interval, rate);
  const total = payment * count;
  const profit = total - principal;

  els.payment.textContent = faNumber(payment, 3);
  els.total.textContent = `${faNumber(total,3)} م`;
  els.profit.textContent = `${faNumber(profit,3)} م`;
  els.periodRate.textContent = `نرخ هر دوره ${faNumber(periodRate * 100,2)}٪`;

  els.schedule.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (let i = 1; i <= count; i += 1) {
    const row = document.createElement('div');
    row.className = 'schedule-row';
    row.innerHTML = `<span class="num">چک ${faNumber(i,0)}</span><span class="due">ماه ${faNumber(i * interval,0)}</span><span class="amount">${faNumber(payment,3)} م</span>`;
    fragment.appendChild(row);
  }
  els.schedule.appendChild(fragment);
  localStorage.setItem('checkCalc:v1', JSON.stringify({ principal, count, interval }));
}

function restoreDeal() {
  try {
    const saved = JSON.parse(localStorage.getItem('checkCalc:v1') || 'null');
    if (!saved) return;
    if (saved.principal) els.principal.value = saved.principal;
    if (saved.count) els.count.value = saved.count;
    if (saved.interval) els.interval.value = saved.interval;
  } catch (_) {}
}

function setRateMode(mode) {
  settings.rateMode = mode === 'manual' ? 'manual' : 'auto';
  saveSettings(); syncSettingsControls(); render();
}
function openSettings() {
  els.settingsOverlay.hidden = false;
  els.settingsSheet.classList.add('open');
  els.settingsSheet.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
}
function closeSettings() {
  els.settingsSheet.classList.remove('open');
  els.settingsSheet.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
  setTimeout(() => { els.settingsOverlay.hidden = true; }, 220);
}

function renderRules() {
  els.rasRules.replaceChildren();
  settings.rasRules.forEach((rule,index) => {
    const node = els.rasRuleTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('[data-rule="maxRas"]').value = rule.maxRas ?? '';
    node.querySelector('[data-rule="personalRate"]').value = rule.personalRate ?? '';
    node.querySelector('[data-rule="investorRate"]').value = rule.investorRate ?? '';
    bindRuleRow(node, 'rasRules', index);
    els.rasRules.appendChild(node);
  });
  els.amountRules.replaceChildren();
  settings.amountRules.forEach((rule,index) => {
    const node = els.amountRuleTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('[data-rule="minAmount"]').value = rule.minAmount ?? '';
    node.querySelector('[data-rule="adjustment"]').value = rule.adjustment ?? '';
    bindRuleRow(node, 'amountRules', index);
    els.amountRules.appendChild(node);
  });
}
function bindRuleRow(node, key, index) {
  node.querySelectorAll('input[data-rule]').forEach(input => {
    input.addEventListener('input', () => {
      settings[key][index][input.dataset.rule] = faToEn(input.value);
      saveSettings(); render();
    });
  });
  node.querySelector('.remove-rule').addEventListener('click', () => {
    settings[key].splice(index,1); saveSettings(); renderRules(); render();
  });
}

els.calculate.addEventListener('click', () => { render(); if (els.error.hidden) els.resultCard.scrollIntoView({ behavior:'smooth', block:'center' }); });
[els.principal,els.count,els.interval].forEach(input => {
  input.addEventListener('input', render);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') render(); });
});
els.manualRate.addEventListener('input', () => { settings.manualRate = parseNumber(els.manualRate.value); saveSettings(); render(); });
document.querySelectorAll('[data-rate-mode]').forEach(b => b.addEventListener('click', () => setRateMode(b.dataset.rateMode)));
document.querySelectorAll('[data-settings-rate-mode]').forEach(b => b.addEventListener('click', () => setRateMode(b.dataset.settingsRateMode)));
document.querySelectorAll('[data-source]').forEach(b => b.addEventListener('click', () => {
  settings.source = b.dataset.source; saveSettings(); syncSettingsControls(); render();
}));
document.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', () => { setTheme(b.dataset.theme); saveSettings(); }));
els.fontScale.addEventListener('input', () => { settings.fontScale = clamp(Number(els.fontScale.value),90,120); applyScale(); saveSettings(); });
els.uiScale.addEventListener('input', () => { settings.uiScale = clamp(Number(els.uiScale.value),90,110); applyScale(); saveSettings(); });
els.personalBaseRate.addEventListener('input', () => { const v=parseNumber(els.personalBaseRate.value); if(Number.isFinite(v)&&v>0){ settings.personalBaseRate=v; saveSettings(); render(); }});
els.investorBaseRate.addEventListener('input', () => { const v=parseNumber(els.investorBaseRate.value); if(Number.isFinite(v)&&v>0){ settings.investorBaseRate=v; saveSettings(); render(); }});
els.addRasRule.addEventListener('click', () => { settings.rasRules.push({maxRas:'',personalRate:'',investorRate:''}); saveSettings(); renderRules(); });
els.addAmountRule.addEventListener('click', () => { settings.amountRules.push({minAmount:'',adjustment:''}); saveSettings(); renderRules(); });
els.resetSettings.addEventListener('click', () => {
  settings = { ...DEFAULTS, rasRules:[], amountRules:[] }; saveSettings(); syncSettingsControls(); render();
});
els.settingsOpen.addEventListener('click', openSettings);
els.settingsClose.addEventListener('click', closeSettings);
els.settingsOverlay.addEventListener('click', closeSettings);
els.scheduleToggle.addEventListener('click', () => {
  const next = !els.schedule.hidden; els.schedule.hidden = next; els.scheduleToggle.setAttribute('aria-expanded', String(!next));
});
els.copy.addEventListener('click', async () => {
  const text = `${els.payment.textContent} میلیون تومان`;
  try { await navigator.clipboard.writeText(text); const prev=els.copy.textContent; els.copy.textContent='کپی شد'; setTimeout(()=>els.copy.textContent=prev,1000); }
  catch (_) { els.copy.textContent=text; }
});

restoreDeal();
syncSettingsControls();
render();

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
