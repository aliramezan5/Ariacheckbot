(() => {
  const KEY = 'checkCalc:history:v1';
  const LIMIT = 100;

  const faNumber = (value, digits = 3) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: digits }).format(Number(value) || 0);
  const formatDate = iso => {
    try {
      const d = new Date(iso);
      return {
        date: new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year:'numeric', month:'2-digit', day:'2-digit' }).format(d),
        time: new Intl.DateTimeFormat('fa-IR', { hour:'2-digit', minute:'2-digit' }).format(d),
      };
    } catch (_) { return { date:'—', time:'—' }; }
  };

  const load = () => {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (_) { return []; }
  };
  const save = items => localStorage.setItem(KEY, JSON.stringify(items.slice(0, LIMIT)));
  const signature = x => [x.principal,x.count,x.interval,x.rate,x.rateMode,x.source].join('|');
  const id = () => (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="./history.css?v=2">');
  document.body.insertAdjacentHTML('beforeend', `
    <div id="historyOverlay" class="history-overlay" hidden></div>
    <aside id="historySheet" class="history-sheet" aria-hidden="true" aria-label="حافظه و تاریخچه">
      <div class="sheet-handle"></div>
      <div class="history-head">
        <button id="historyClose" class="history-close" type="button">بستن</button>
        <h2>حافظه و تاریخچه</h2>
        <button id="historyClear" class="history-clear" type="button">پاک کردن</button>
      </div>
      <div class="history-scroll">
        <div class="memory-summary">
          <div><span>کل محاسبات</span><b id="historyCount">۰</b></div>
          <div><span>حافظه مهم</span><b id="memoryCount">۰</b></div>
        </div>
        <section id="memorySection" class="history-section" hidden>
          <div class="history-section-title"><h3>حافظه</h3><span>معامله‌های پین‌شده</span></div>
          <div id="memoryList" class="history-list"></div>
        </section>
        <section class="history-section">
          <div class="history-section-title"><h3>تاریخچه</h3><span>آخرین ۱۰۰ محاسبه</span></div>
          <div id="historyList" class="history-list"></div>
        </section>
        <p class="history-memory-note">اطلاعات فقط روی همین دستگاه ذخیره می‌شود و با بستن اپ باقی می‌ماند.</p>
      </div>
    </aside>
    <div id="historyToast" class="history-toast">ذخیره شد</div>
  `);

  const el = Object.fromEntries(['historyOverlay','historySheet','historyClose','historyClear','historyCount','memoryCount','memorySection','memoryList','historyList','historyToast'].map(k => [k, document.getElementById(k)]));
  const bottom = document.getElementById('bottomSchedule');
  if (bottom) {
    bottom.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 7v5l3 2"/></svg><span>تاریخچه</span>`;
  }

  const toast = text => {
    el.historyToast.textContent = text;
    el.historyToast.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.historyToast.classList.remove('show'), 1200);
  };

  const open = () => {
    render();
    el.historyOverlay.hidden = false;
    el.historySheet.classList.add('open');
    el.historySheet.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    el.historySheet.classList.remove('open');
    el.historySheet.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    setTimeout(() => { el.historyOverlay.hidden = true; }, 240);
  };

  const card = item => {
    const { date, time } = formatDate(item.createdAt);
    const source = item.source === 'investor' ? 'سرمایه‌گذار' : 'شخصی';
    const pinnedClass = item.pinned ? ' pinned' : '';
    return `
      <article class="history-card${pinnedClass}" data-id="${item.id}">
        <div class="history-card-top">
          <div class="history-date"><b>${date}</b><span>${time}</span></div>
          <div class="history-actions">
            <button class="history-icon-btn pin ${item.pinned ? 'active' : ''}" type="button" data-action="pin" aria-label="پین کردن">
              <svg viewBox="0 0 24 24"><path d="m12 3 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.2l5-.7L12 3Z"/></svg>
            </button>
            <button class="history-icon-btn delete" type="button" data-action="delete" aria-label="حذف">
              <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>
            </button>
          </div>
        </div>
        <div class="history-card-body">
          <div class="history-primary">
            <div><span>مانده معامله</span><b>${faNumber(item.principal,3)} م</b></div>
            <div class="history-payment"><span>هر چک</span><b>${faNumber(item.payment,3)} م</b></div>
          </div>
          <div class="history-meta">
            <span class="history-chip"><strong>${faNumber(item.count,0)}</strong> فقره</span>
            <span class="history-chip">هر <strong>${faNumber(item.interval,0)}</strong> ماه</span>
            <span class="history-chip">نرخ <strong>${faNumber(item.rate,2)}٪</strong></span>
            <span class="history-chip">${source}</span>
            <span class="history-chip">سود <strong>${faNumber(item.profit,3)} م</strong></span>
          </div>
          <button class="history-restore" type="button" data-action="restore">استفاده مجدد با همین نرخ</button>
        </div>
      </article>`;
  };

  const bindList = root => {
    root.querySelectorAll('.history-card').forEach(node => {
      node.addEventListener('click', e => {
        const button = e.target.closest('[data-action]');
        if (!button) return;
        const items = load();
        const index = items.findIndex(x => x.id === node.dataset.id);
        if (index < 0) return;
        const action = button.dataset.action;
        if (action === 'pin') {
          items[index].pinned = !items[index].pinned;
          save(items); render();
          toast(items[index].pinned ? 'در حافظه پین شد' : 'از حافظه خارج شد');
        } else if (action === 'delete') {
          items.splice(index,1); save(items); render(); toast('حذف شد');
        } else if (action === 'restore') {
          const item = items[index];
          if (window.CheckCalc?.restoreFromHistory) {
            window.CheckCalc.restoreFromHistory(item);
            close();
            toast('معامله بازیابی شد');
          }
        }
      });
    });
  };

  const render = () => {
    const items = load();
    const pinned = items.filter(x => x.pinned);
    const regular = items.filter(x => !x.pinned);
    el.historyCount.textContent = faNumber(items.length,0);
    el.memoryCount.textContent = faNumber(pinned.length,0);
    el.historyClear.disabled = items.length === 0;
    el.memorySection.hidden = pinned.length === 0;
    el.memoryList.innerHTML = pinned.map(card).join('');
    el.historyList.innerHTML = regular.length ? regular.map(card).join('') : `
      <div class="history-empty">
        <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 7v5l3 2"/></svg>
        <b>هنوز محاسبه‌ای ثبت نشده</b>
        <span>بعد از زدن دکمه «محاسبه»، معامله به‌صورت خودکار اینجا ذخیره می‌شود.</span>
      </div>`;
    bindList(el.memoryList); bindList(el.historyList);
  };

  window.addEventListener('checkcalc:calculated', event => {
    const s = event.detail;
    if (!s || !Number.isFinite(Number(s.payment))) return;
    const items = load();
    const record = { ...s, id:id(), createdAt:new Date().toISOString(), pinned:false };
    if (items[0] && signature(items[0]) === signature(record)) {
      record.id = items[0].id;
      record.pinned = Boolean(items[0].pinned);
      items[0] = record;
    } else {
      items.unshift(record);
    }
    save(items);
    render();
    toast('در تاریخچه ذخیره شد');
  });

  el.historyClose.addEventListener('click', close);
  el.historyOverlay.addEventListener('click', close);
  el.historyClear.addEventListener('click', () => {
    if (!load().length) return;
    if (confirm('کل تاریخچه و حافظه پاک شود؟')) {
      localStorage.removeItem(KEY); render(); toast('تاریخچه پاک شد');
    }
  });
  if (bottom) bottom.addEventListener('click', open);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.historySheet.classList.contains('open')) close(); });

  function ensureRateMonitor() {
    const anchor = document.querySelector('#autoRatePanel .auto-rate-result');
    if (!anchor || document.getElementById('rateLiveMonitor')) return;
    anchor.insertAdjacentHTML('afterend', `
      <div id="rateLiveMonitor" class="rate-live-monitor">
        <div class="rate-live-top">
          <span>مانیتور نرخ اتومات</span>
          <b id="rateEngineStatus">در حال بررسی…</b>
        </div>
        <div class="rate-live-grid">
          <div><span>نرخ نهایی</span><strong id="rateMonitorFinal">—</strong></div>
          <div><span>رأس فعلی</span><strong id="rateMonitorRas">—</strong></div>
        </div>
        <p id="rateMonitorReason">—</p>
        <small id="rateMonitorNext">—</small>
      </div>`);
  }

  let lastRate = null;
  function updateRateMonitor() {
    ensureRateMonitor();
    const box = document.getElementById('rateLiveMonitor');
    const s = window.CheckCalc?.getCurrentSnapshot?.();
    if (!box || !s) return;
    box.hidden = s.rateMode !== 'auto';
    if (box.hidden) return;

    const modernEngine = /رأس/.test(String(s.reason || ''));
    const status = document.getElementById('rateEngineStatus');
    status.textContent = modernEngine ? 'موتور جدید فعال' : 'نسخه قدیمی فعال';
    status.classList.toggle('warn', !modernEngine);

    document.getElementById('rateMonitorFinal').textContent = `${faNumber(s.rate,2)}٪`;
    document.getElementById('rateMonitorRas').textContent = `${faNumber(s.ras,1)} ماه`;
    document.getElementById('rateMonitorReason').textContent = s.reason || '—';

    let next = 'بالاترین بازه نرخ';
    if (s.ras <= 3) next = 'مرز بعدی: رأس بیش از ۳ ماه';
    else if (s.ras <= 6) next = 'مرز بعدی: رأس بیش از ۶ ماه';
    else if (s.ras <= 9) next = 'مرز بعدی: رأس بیش از ۹ ماه';
    else if (s.ras <= 12) next = 'مرز بعدی: رأس بیش از ۱۲ ماه';
    document.getElementById('rateMonitorNext').textContent = next;

    if (lastRate !== null && Number(lastRate) !== Number(s.rate)) {
      box.classList.remove('rate-changed');
      void box.offsetWidth;
      box.classList.add('rate-changed');
      setTimeout(() => box.classList.remove('rate-changed'), 700);
    }
    lastRate = s.rate;
  }

  ['input','change','click'].forEach(type => {
    document.addEventListener(type, e => {
      if (e.target.closest('#autoRatePanel, #principal, #count, #interval, [data-source], [data-rate-mode], [data-settings-rate-mode]')) {
        requestAnimationFrame(updateRateMonitor);
      }
    }, true);
  });
  window.addEventListener('checkcalc:calculated', updateRateMonitor);
  setTimeout(updateRateMonitor, 50);
  setTimeout(updateRateMonitor, 500);

  window.CheckCalcHistory = { open, render, load };
  render();
})();