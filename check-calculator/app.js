const MONTHLY_RATE = 0.07;
const els = {
  principal: document.getElementById('principal'),
  count: document.getElementById('count'),
  interval: document.getElementById('interval'),
  calculate: document.getElementById('calculate'),
  payment: document.getElementById('payment'),
  total: document.getElementById('total'),
  profit: document.getElementById('profit'),
  periodRate: document.getElementById('periodRate'),
  schedule: document.getElementById('schedule'),
  copy: document.getElementById('copy'),
  error: document.getElementById('error'),
  resultCard: document.getElementById('resultCard'),
};

const faToEn = (value) => String(value ?? '')
  .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/[٬,\s]/g, '')
  .replace('٫', '.');

const parseNumber = (value) => Number(faToEn(value));

const faNumber = (value, digits = 3) => new Intl.NumberFormat('fa-IR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: digits,
}).format(value);

function calculatePayment(principal, count, intervalMonths) {
  const periodRate = Math.pow(1 + MONTHLY_RATE, intervalMonths) - 1;
  const payment = principal * periodRate / (1 - Math.pow(1 + periodRate, -count));
  return { periodRate, payment };
}

function validate(principal, count, interval) {
  if (!Number.isFinite(principal) || principal <= 0) return 'مانده نقدی معامله را درست وارد کن.';
  if (!Number.isInteger(count) || count < 1 || count > 120) return 'تعداد چک باید بین ۱ تا ۱۲۰ باشد.';
  if (!Number.isInteger(interval) || interval < 1 || interval > 60) return 'فاصله چک باید حداقل ۱ ماه باشد.';
  return '';
}

function render() {
  const principal = parseNumber(els.principal.value);
  const count = parseNumber(els.count.value);
  const interval = parseNumber(els.interval.value);
  const error = validate(principal, count, interval);

  if (error) {
    els.error.textContent = error;
    els.error.hidden = false;
    return;
  }

  els.error.hidden = true;
  const { periodRate, payment } = calculatePayment(principal, count, interval);
  const total = payment * count;
  const profit = total - principal;

  els.payment.textContent = faNumber(payment, 3);
  els.total.textContent = `${faNumber(total, 3)} م`;
  els.profit.textContent = `${faNumber(profit, 3)} م`;
  els.periodRate.textContent = `نرخ هر دوره ${faNumber(periodRate * 100, 2)}٪`;

  els.schedule.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (let i = 1; i <= count; i += 1) {
    const row = document.createElement('div');
    row.className = 'schedule-row';
    row.innerHTML = `
      <span class="num">چک ${faNumber(i, 0)}</span>
      <span class="due">ماه ${faNumber(i * interval, 0)}</span>
      <span class="amount">${faNumber(payment, 3)} م</span>
    `;
    fragment.appendChild(row);
  }
  els.schedule.appendChild(fragment);

  localStorage.setItem('checkCalc:v1', JSON.stringify({ principal, count, interval }));
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem('checkCalc:v1') || 'null');
    if (!saved) return;
    if (saved.principal) els.principal.value = saved.principal;
    if (saved.count) els.count.value = saved.count;
    if (saved.interval) els.interval.value = saved.interval;
  } catch (_) {}
}

els.calculate.addEventListener('click', () => {
  render();
  if (els.error.hidden) els.resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

[els.principal, els.count, els.interval].forEach(input => {
  input.addEventListener('input', render);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') render();
  });
});

els.copy.addEventListener('click', async () => {
  const text = `${els.payment.textContent} میلیون تومان`;
  try {
    await navigator.clipboard.writeText(text);
    const previous = els.copy.textContent;
    els.copy.textContent = 'کپی شد';
    setTimeout(() => { els.copy.textContent = previous; }, 1200);
  } catch (_) {
    els.copy.textContent = text;
  }
});

restore();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
