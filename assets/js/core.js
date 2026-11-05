/* GMW core — منطق دامنه (بدون وابستگی به DOM). در مرورگر و Node قابل استفاده است.
   توجه: این نسخه آزمایشی است؛ در Backend واقعی همین قوانین باید روی سرور و داخل تراکنش پایگاه داده اجرا شوند. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GMWCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STATE_VERSION = 1;
  var FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';

  /* ---------- ابزارهای عمومی ---------- */
  function normalizeDigits(s) {
    return String(s == null ? '' : s)
      .replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); });
  }
  function normalizePhone(s) {
    s = normalizeDigits(s).replace(/[\s\-()]/g, '');
    if (s.indexOf('+98') === 0) s = '0' + s.slice(3);
    else if (s.indexOf('0098') === 0) s = '0' + s.slice(4);
    else if (/^98\d{10}$/.test(s)) s = '0' + s.slice(2);
    else if (/^9\d{9}$/.test(s)) s = '0' + s;
    return s;
  }
  function isValidMobile(s) { return /^09\d{9}$/.test(normalizePhone(s)); }
  function normCode(s) { return normalizeDigits(s).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function formatToman(n) {
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('fa-IR').format(Math.round(n)) + ' تومان';
  }
  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeZone: 'Asia/Tehran' }).format(d); }
    catch (e) { return d.toISOString().slice(0, 10); }
  }
  function faDigits(n) { return String(n).replace(/\d/g, function (d) { return FA.charAt(+d); }); }
  function toInt(v) { var t = normalizeDigits(v).replace(/[,٬،\s.]/g, ''); return /^\d+$/.test(t) ? parseInt(t, 10) : NaN; }
  function isoDay(d) { return new Date(d).toISOString().slice(0, 10); }
  function addYears(iso, n) { var d = new Date(iso); d.setUTCFullYear(d.getUTCFullYear() + n); return d.toISOString(); }
  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  var ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var counter = 0;
  function uid(prefix) { counter += 1; return prefix + '-' + Date.now().toString(36) + counter.toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  function allTracking(state) {
    var set = {};
    ['warranties', 'coverageRequests', 'brakeRequests', 'tireRequests', 'basketInterests', 'insuranceRequests', 'contacts'].forEach(function (k) {
      (state[k] || []).forEach(function (r) { if (r.trackingCode) set[r.trackingCode] = 1; });
    });
    return set;
  }
  function trackingCode(state, letter, rng) {
    rng = rng || Math.random;
    var used = allTracking(state), code, i;
    do {
      var s = '';
      for (i = 0; i < 6; i++) s += ALPHA.charAt(Math.floor(rng() * ALPHA.length));
      code = 'GMW-' + letter + '-' + s;
    } while (used[code]);
    return code;
  }

  function audit(state, actor, action, entity, id, detail) {
    state.audit.unshift({ at: new Date().toISOString(), actor: actor || 'system', action: action, entity: entity, id: id || '', detail: detail || '' });
    if (state.audit.length > 500) state.audit.length = 500;
  }

  /* ---------- داده‌های پیش‌فرض (همگی آزمایشی) ---------- */
  var PART_DEFS = [
    ['p01', 'کمک‌فنر جلو', 'کمک‌فنر و فنر', 600000],
    ['p02', 'کمک‌فنر عقب', 'کمک‌فنر و فنر', 500000],
    ['p03', 'فنر جلو', 'کمک‌فنر و فنر', 350000],
    ['p04', 'فنر عقب', 'کمک‌فنر و فنر', 300000],
    ['p05', 'طبق جلو', 'طبق و بازو', 450000],
    ['p06', 'مجموعه بازو و اتصالات عقب', 'طبق و بازو', 550000],
    ['p07', 'سیبک فرمان', 'سیستم فرمان', 120000],
    ['p08', 'قرقری فرمان', 'سیستم فرمان', 90000],
    ['p09', 'سرمیل فرمان', 'سیستم فرمان', 110000],
    ['p10', 'جعبه فرمان', 'سیستم فرمان', 900000],
    ['p11', 'میل موج‌گیر جلو و اتصالات', 'موج‌گیر و بوش', 180000],
    ['p12', 'میل موج‌گیر عقب و اتصالات', 'موج‌گیر و بوش', 170000],
    ['p13', 'بوش‌های موج‌گیر جلو', 'موج‌گیر و بوش', 80000],
    ['p14', 'بوش‌های موج‌گیر عقب', 'موج‌گیر و بوش', 75000],
    ['p15', 'بوش‌های طبق جلو', 'موج‌گیر و بوش', 130000],
    ['p16', 'بوش‌های مجموعه عقب', 'موج‌گیر و بوش', 120000],
    ['p17', 'توپی سرکمک جلو', 'بلبرینگ و توپی', 140000],
    ['p18', 'بلبرینگ چرخ جلو', 'بلبرینگ و توپی', 200000],
    ['p19', 'بلبرینگ چرخ عقب', 'بلبرینگ و توپی', 180000]
  ];

  var SAMPLE_CLAIMS = [
    { id: 'نمونه-۱', purchase: '2026-01-12', claim: '2026-03-02', expertise: 'کارشناسی انجام شد', result: 'تأیید', amount: 1850000, payment: 'پرداخت‌شده', days: 6 },
    { id: 'نمونه-۲', purchase: '2026-02-20', claim: '2026-04-11', expertise: 'کارشناسی انجام شد', result: 'رد (دستکاری قطعه)', amount: 0, payment: 'بدون پرداخت', days: 4 },
    { id: 'نمونه-۳', purchase: '2026-03-05', claim: '2026-05-18', expertise: 'در انتظار کارشناسی', result: 'در حال بررسی', amount: null, payment: 'در انتظار', days: null },
    { id: 'نمونه-۴', purchase: '2025-11-30', claim: '2026-06-09', expertise: 'کارشناسی انجام شد', result: 'تأیید', amount: 960000, payment: 'پرداخت‌شده', days: 9 },
    { id: 'نمونه-۵', purchase: '2026-04-14', claim: '2026-07-22', expertise: 'کارشناسی انجام شد', result: 'تأیید', amount: 2400000, payment: 'در صف پرداخت', days: 12 },
    { id: 'نمونه-۶', purchase: '2026-05-02', claim: '2026-09-03', expertise: 'در انتظار کارشناسی', result: 'در حال بررسی', amount: null, payment: 'در انتظار', days: null }
  ];

  function defaultState() {
    var codes = [];
    for (var i = 1; i <= 10; i++) codes.push({ code: 'GMW-DEMO-' + (1000 + i), status: 'unused', usedBy: '', demo: true });
    return {
      version: STATE_VERSION,
      settings: {
        coverage: { title: 'طرح پوشش سه‌ساله خدمات جلوبندی و عقب‌بندی GMW', years: 3, multiplier: 1, minTotal: 0, cap: null,
          note: 'قیمت‌ها آزمایشی‌اند و پیش از فروش واقعی باید بازبینی شوند. عدد ۲٬۳۴۵٬۰۰۰ تومان قیمت قطعی این طرح نیست.' },
        brake: {
          years: 3,
          quotas: { 1: 3, 2: 3, 3: 3 },
          laborRegular: 350000,
          laborMember: 0,
          classes: [
            { id: 'c1', label: 'سواری اقتصادی', padPrice: 280000 },
            { id: 'c2', label: 'سواری میان‌رده', padPrice: 420000 },
            { id: 'c3', label: 'سواری بالارده / SUV', padPrice: 650000 }
          ]
        }
      },
      parts: PART_DEFS.map(function (p) { return { id: p[0], name: p[1], group: p[2], price: p[3], limit: null, maxReplacements: null, active: true }; }),
      centers: [
        { id: 'k1', name: 'مرکز خدمات نمونه ۱', city: 'تهران', address: 'آدرس نمونه', demo: true },
        { id: 'k2', name: 'مرکز خدمات نمونه ۲', city: 'تهران', address: 'آدرس نمونه', demo: true },
        { id: 'k3', name: 'مرکز خدمات نمونه ۳', city: 'مشهد', address: 'آدرس نمونه', demo: true },
        { id: 'k4', name: 'مرکز خدمات نمونه ۴', city: 'اصفهان', address: 'آدرس نمونه', demo: true },
        { id: 'k5', name: 'مرکز خدمات نمونه ۵', city: 'شیراز', address: 'آدرس نمونه', demo: true },
        { id: 'k6', name: 'مرکز خدمات نمونه ۶', city: 'تبریز', address: 'آدرس نمونه', demo: true },
        { id: 'k7', name: 'مرکز خدمات نمونه ۷', city: 'کرج', address: 'آدرس نمونه', demo: true }
      ],
      technicians: [
        { id: 't1', name: 'کارشناس نمونه ۱', city: 'تهران', phone: '', demo: true },
        { id: 't2', name: 'استادکار نمونه ۲', city: 'مشهد', phone: '', demo: true },
        { id: 't3', name: 'استادکار نمونه ۳', city: 'اصفهان', phone: '', demo: true }
      ],
      scratchCodes: codes,
      customers: [], warranties: [], coverageRequests: [], payments: [], refunds: [],
      claims: SAMPLE_CLAIMS.map(function (c) { var o = {}; for (var k in c) o[k] = c[k]; o.demo = true; return o; }),
      brakeEnrollments: [], brakeRequests: [], brakeHistory: [],
      tireRequests: [], clubMembers: [], basketInterests: [], insuranceRequests: [], contacts: [],
      audit: []
    };
  }

  /* ---------- مشتری ---------- */
  function upsertCustomer(state, c) {
    var phone = normalizePhone(c.phone);
    var found = state.customers.filter(function (x) { return x.phone === phone; })[0];
    if (found) {
      if (c.name) found.name = clean(c.name);
      if (c.city) found.city = clean(c.city);
      return found;
    }
    found = { id: uid('cus'), name: clean(c.name), phone: phone, city: clean(c.city || ''), createdAt: new Date().toISOString() };
    state.customers.push(found);
    return found;
  }

  function req(e, key, val, msg) { if (!clean(val)) e[key] = msg; }
  function hasErr(e) { return Object.keys(e).length > 0; }
  function checkVehicleYear(e, key, v) {
    var y = parseInt(normalizeDigits(v), 10);
    if (!y || y < 1350 || y > 1420) e[key] = 'سال ساخت را به شمسی انتخاب کنید';
  }

  /* ---------- فعال‌سازی گارانتی و اصالت‌سنجی ---------- */
  var WARRANTY_STATUS = { pending_review: 'ثبت شد — در انتظار بررسی', active: 'فعال', rejected: 'رد شد' };

  function registerWarranty(state, input, now) {
    now = now || new Date();
    var e = {};
    var scratch = normCode(input.scratchCode);
    req(e, 'scratchCode', scratch, 'کد اسکرچ را وارد کنید');
    req(e, 'partName', input.partName, 'نام قطعه را وارد کنید');
    req(e, 'brand', input.brand, 'برند را وارد کنید');
    req(e, 'buyerName', input.buyerName, 'نام و نام خانوادگی را وارد کنید');
    if (!isValidMobile(input.buyerPhone)) e.buyerPhone = 'شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)';
    if (hasErr(e)) return { ok: false, errors: e };

    var code = state.scratchCodes.filter(function (c) { return normCode(c.code) === scratch; })[0];
    if (!code && state.settings.codeRegistry === false) { code = { code: scratch, status: 'unused' }; state.scratchCodes.push(code); }   // بدون پایگاه کد: اصالت کد را کارشناس بررسی می‌کند
    if (!code) return { ok: false, errors: { scratchCode: 'این کد در سامانه یافت نشد. کد را دوباره بررسی کنید.' } };
    if (code.status !== 'unused') return { ok: false, errors: { scratchCode: 'این کد قبلاً استفاده شده و دوباره قابل ثبت نیست.' } };
    var cust = upsertCustomer(state, { name: input.buyerName, phone: input.buyerPhone });
    var rec = {
      id: uid('war'), trackingCode: trackingCode(state, 'W'),
      scratchCode: code.code,
      partName: clean(input.partName), brand: clean(input.brand),
      buyerName: clean(input.buyerName), buyerPhone: normalizePhone(input.buyerPhone),
      status: 'pending_review', customerId: cust.id, createdAt: now.toISOString()
    };
    code.status = 'used'; code.usedBy = rec.trackingCode;
    state.warranties.push(rec);
    audit(state, 'customer', 'create', 'warranty', rec.id, rec.trackingCode);
    return { ok: true, record: rec, statusLabel: WARRANTY_STATUS[rec.status] };
  }

  function lookupWarranty(state, q) {
    var k = normCode(q);
    if (!k) return null;
    var w = state.warranties.filter(function (x) { return normCode(x.trackingCode) === k || normCode(x.scratchCode) === k || x.serialKey === k; })[0];
    if (!w) return null;
    return { trackingCode: w.trackingCode, partName: w.partName, brand: w.brand, purchaseDate: w.purchaseDate, createdAt: w.createdAt, status: w.status, statusLabel: WARRANTY_STATUS[w.status] };
  }

  /* ---------- طرح پوشش سه‌ساله ---------- */
  var COVERAGE_STATUS = {
    registered: 'درخواست ثبت شد — در انتظار بررسی اصالت خودرو',
    assigned: 'استادکار/کارشناس معرفی شد',
    inspected: 'معاینه خودرو انجام شد',
    approved: 'اصالت خودرو تأیید شد — پرداخت با هماهنگی کارشناس',
    paid: 'پرداخت انجام شد — در انتظار فعال‌سازی',
    active: 'پوشش فعال است',
    rejected: 'درخواست تأیید نشد'
  };
  var COVERAGE_STEPS = ['registered', 'assigned', 'inspected', 'approved', 'paid', 'active'];

  function calcCoveragePrice(state, ids) {
    var cfg = state.settings.coverage, items = [], subtotal = 0;
    (ids || []).forEach(function (id) {
      var p = state.parts.filter(function (x) { return x.id === id && x.active; })[0];
      if (p) { items.push({ id: p.id, name: p.name, price: p.price }); subtotal += p.price; }
    });
    var total = Math.round(subtotal * (cfg.multiplier || 1));
    var capApplied = false;
    if (items.length && cfg.minTotal && total < cfg.minTotal) total = cfg.minTotal;
    if (cfg.cap && total > cfg.cap) { total = cfg.cap; capApplied = true; }
    return { items: items, subtotal: subtotal, total: total, capApplied: capApplied };
  }

  function createCoverageRequest(state, input, now) {
    now = now || new Date();
    var e = {}, o = input.owner || {};
    var price = calcCoveragePrice(state, input.parts);
    if (!price.items.length) e.parts = 'حداقل یک قطعه انتخاب کنید';
    req(e, 'name', o.name, 'نام را وارد کنید');
    if (!isValidMobile(o.phone)) e.phone = 'شماره موبایل معتبر نیست';
    req(e, 'city', o.city, 'شهر را وارد کنید');
    req(e, 'address', o.address, 'آدرس را وارد کنید');
    req(e, 'model', o.model, 'مدل خودرو را وارد کنید');
    checkVehicleYear(e, 'year', o.year);
    var km = toInt(o.mileage);
    if (isNaN(km) || km < 0 || km > 2000000) e.mileage = 'کارکرد (کیلومتر) را درست وارد کنید';
    req(e, 'accident', o.accident, 'سابقه تصادف را مشخص کنید');
    if (!input.acceptTerms) e.acceptTerms = 'پذیرش شرایط و استثناها الزامی است';
    if (hasErr(e)) return { ok: false, errors: e };

    var cust = upsertCustomer(state, { name: o.name, phone: o.phone, city: o.city });
    var id = uid('cov');
    var rec = {
      id: id, trackingCode: trackingCode(state, 'C'), customerId: cust.id,
      parts: price.items, subtotal: price.subtotal, total: price.total,
      owner: { name: clean(o.name), phone: normalizePhone(o.phone), city: clean(o.city), address: clean(o.address), model: clean(o.model),
        year: parseInt(normalizeDigits(o.year), 10), mileage: km, accident: clean(o.accident), repairs: clean(o.repairs), notes: clean(o.notes) },
      status: 'registered', technicianId: '', inspectionNotes: '', decisionReason: '', startDate: '', endDate: '',
      history: [{ at: now.toISOString(), status: 'registered', by: 'customer', note: '' }],
      createdAt: now.toISOString()
    };
    var pay = { id: uid('pay'), requestId: id, trackingCode: rec.trackingCode, amount: rec.total, kind: 'coordinated', status: 'pending', at: now.toISOString() };  // پرداخت پس از تأیید اصالت خودرو و با هماهنگی؛ هنگام ثبت چیزی دریافت نمی‌شود
    state.coverageRequests.push(rec);
    state.payments.push(pay);
    audit(state, 'customer', 'create', 'coverageRequest', id, rec.trackingCode + ' / ' + rec.total);
    return { ok: true, record: rec, payment: pay };
  }

  function enrollBrake(state, phone, startISO, source) {
    phone = normalizePhone(phone);
    var en = state.brakeEnrollments.filter(function (x) { return x.phone === phone; })[0];
    if (en) return en;
    en = { id: uid('enr'), phone: phone, startDate: startISO || new Date().toISOString(), source: source || 'club-demo', quotaOverrides: {} };
    state.brakeEnrollments.push(en);
    return en;
  }

  function advanceCoverage(state, id, action, payload, actor, now) {
    now = now || new Date();
    payload = payload || {};
    var r = state.coverageRequests.filter(function (x) { return x.id === id; })[0];
    if (!r) return { ok: false, error: 'درخواست یافت نشد' };
    var from = r.status, pay = state.payments.filter(function (p) { return p.requestId === id; })[0];
    function step(to, note) { r.status = to; r.history.push({ at: now.toISOString(), status: to, by: actor || 'admin', note: note || '' }); }
    if (action === 'assign') {
      if (from !== 'registered' && from !== 'assigned') return { ok: false, error: 'در این وضعیت امکان معرفی استادکار نیست' };
      if (!payload.technicianId || !state.technicians.some(function (t) { return t.id === payload.technicianId; })) return { ok: false, error: 'استادکار را انتخاب کنید' };
      r.technicianId = payload.technicianId; step('assigned', payload.technicianId);
    } else if (action === 'inspect') {
      if (from !== 'assigned') return { ok: false, error: 'ابتدا استادکار معرفی شود' };
      r.inspectionNotes = clean(payload.notes); step('inspected', r.inspectionNotes);
    } else if (action === 'approve') {
      if (from !== 'inspected') return { ok: false, error: 'ابتدا معاینه ثبت شود' };
      step('approved', clean(payload.reason));
    } else if (action === 'reject') {
      if (['registered', 'assigned', 'inspected', 'approved', 'paid'].indexOf(from) < 0) return { ok: false, error: 'در این وضعیت امکان رد نیست' };
      var reason = clean(payload.reason);
      if (!reason) return { ok: false, error: 'ذکر دلیل رد الزامی است' };
      r.decisionReason = reason; step('rejected', reason);
      if (pay && pay.status === 'received') {   // فقط اگر وجهی دریافت شده باشد بازپرداخت کامل لازم است
        pay.status = 'refund_pending';
        state.refunds.push({ id: uid('ref'), requestId: id, paymentId: pay.id, trackingCode: r.trackingCode, amount: pay.amount, reason: reason, status: 'pending', at: now.toISOString() });
      }
    } else if (action === 'payment') {
      if (from !== 'approved') return { ok: false, error: 'پرداخت فقط پس از تأیید اصالت خودرو ثبت می‌شود' };
      if (pay) { pay.status = 'received'; pay.receivedAt = now.toISOString(); pay.note = clean(payload.note); }
      step('paid', clean(payload.note));
    } else if (action === 'activate') {
      if (from !== 'paid') return { ok: false, error: 'ابتدا پرداخت (با هماهنگی) ثبت شود' };
      r.startDate = now.toISOString(); r.endDate = addYears(r.startDate, state.settings.coverage.years || 3);
      step('active', ''); enrollBrake(state, r.owner.phone, r.startDate, 'coverage');
    } else return { ok: false, error: 'عملیات نامعتبر' };
    audit(state, actor || 'admin', action, 'coverageRequest', id, r.trackingCode);
    return { ok: true, record: r };
  }

  function markRefunded(state, refundId, actor, now) {
    var rf = state.refunds.filter(function (x) { return x.id === refundId; })[0];
    if (!rf || rf.status === 'refunded') return { ok: false, error: 'بازپرداخت یافت نشد یا قبلاً انجام شده' };
    rf.status = 'refunded'; rf.refundedAt = (now || new Date()).toISOString();
    var p = state.payments.filter(function (x) { return x.id === rf.paymentId; })[0];
    if (p) p.status = 'refunded';
    audit(state, actor || 'admin', 'refund', 'refund', refundId, rf.trackingCode);
    return { ok: true, record: rf };
  }

  /* نمای عمومی پیگیری: بدون نام، موبایل و آدرس (در Backend همین الگو: پیگیری با کد، فقط وضعیت) */
  function coverageStatusView(state, q) {
    var r = lookupCoverage(state, q);
    if (!r) return null;
    var t = state.technicians.filter(function (x) { return x.id === r.technicianId; })[0];
    return { trackingCode: r.trackingCode, status: r.status, statusLabel: COVERAGE_STATUS[r.status], decisionReason: r.decisionReason,
      technicianName: t ? t.name : '', startDate: r.startDate, endDate: r.endDate, refundStatus: (state.refunds.filter(function (x) { return x.requestId === r.id; })[0] || {}).status || '' };
  }

  function lookupCoverage(state, q) {
    var k = normCode(q);
    var r = state.coverageRequests.filter(function (x) { return normCode(x.trackingCode) === k; })[0];
    return r || null;
  }

  /* ---------- خدمت لنت و سهمیه سالانه ---------- */
  function planYear(startISO, now, years) {
    now = now || new Date(); years = years || 3;
    var s = new Date(startISO), n = 0;
    if (isNaN(s)) return 0;
    while (n < years + 1) {
      var next = new Date(s); next.setUTCFullYear(s.getUTCFullYear() + n + 1);
      if (now < next) break; n++;
    }
    return n + 1 > years ? 0 : Math.max(1, n + 1);
  }

  var ACTIVE_BRAKE = ['requested', 'confirmed', 'done'];

  function brakeQuotaStatus(state, phone, now) {
    now = now || new Date(); phone = normalizePhone(phone);
    var en = state.brakeEnrollments.filter(function (x) { return x.phone === phone; })[0];
    if (!en) return { enrolled: false };
    var cfg = state.settings.brake, years = cfg.years || 3, table = [], y;
    for (y = 1; y <= years; y++) {
      var q = (en.quotaOverrides && en.quotaOverrides[y] != null) ? en.quotaOverrides[y] : (cfg.quotas[y] != null ? cfg.quotas[y] : 3);
      var used = state.brakeRequests.filter(function (r) { return r.phone === phone && r.planYear === y && ACTIVE_BRAKE.indexOf(r.status) >= 0; }).length;
      table.push({ year: y, quota: q, used: used, remaining: Math.max(0, q - used) });
    }
    var cur = planYear(en.startDate, now, years);
    return { enrolled: true, enrollment: en, currentYear: cur, table: table, current: cur ? table[cur - 1] : null, endDate: addYears(en.startDate, years) };
  }

  function createBrakeRequest(state, input, now) {
    now = now || new Date();
    var e = {};
    req(e, 'name', input.name, 'نام را وارد کنید');
    if (!isValidMobile(input.phone)) e.phone = 'شماره موبایل معتبر نیست';
    req(e, 'city', input.city, 'شهر را انتخاب کنید');
    req(e, 'model', input.model, 'مدل خودرو را وارد کنید');
    checkVehicleYear(e, 'year', input.year);
    var cls = state.settings.brake.classes.filter(function (c) { return c.id === input.padClass; })[0];
    if (!cls) e.padClass = 'نوع لنت را انتخاب کنید';
    var center = state.centers.filter(function (c) { return c.id === input.centerId; })[0];
    if (!center) e.centerId = 'مرکز خدماتی را انتخاب کنید';
    if (hasErr(e)) return { ok: false, errors: e };

    var st = brakeQuotaStatus(state, input.phone, now);
    if (!st.enrolled) return { ok: false, code: 'NOT_ENROLLED', error: 'برای این شماره هنوز عضویت واجد شرایط ثبت نشده است. ابتدا عضو باشگاه شوید.' };
    if (!st.currentYear) return { ok: false, code: 'EXPIRED', error: 'دوره سه‌ساله این عضویت به پایان رسیده است.' };
    if (st.current.remaining <= 0) return { ok: false, code: 'QUOTA_EXHAUSTED', error: 'سهمیهٔ سال ' + faDigits(st.currentYear) + ' (' + faDigits(st.current.quota) + ' نوبت) تکمیل شده است.' };

    var rec = {
      id: uid('brk'), trackingCode: trackingCode(state, 'B'), phone: normalizePhone(input.phone), name: clean(input.name), city: clean(input.city),
      model: clean(input.model), year: parseInt(normalizeDigits(input.year), 10),
      padClass: cls.id, padLabel: cls.label, padPrice: cls.padPrice, laborFee: state.settings.brake.laborMember,
      centerId: center.id, centerName: center.name, notes: clean(input.notes),
      planYear: st.currentYear, status: 'requested', createdAt: now.toISOString()
    };
    state.brakeRequests.push(rec);
    upsertCustomer(state, { name: input.name, phone: input.phone, city: input.city });
    audit(state, 'customer', 'create', 'brakeRequest', rec.id, rec.trackingCode + ' سال ' + rec.planYear);
    return { ok: true, record: rec, remainingAfter: st.current.remaining - 1 };
  }

  function completeBrakeRequest(state, id, actor, now) {
    now = now || new Date();
    var r = state.brakeRequests.filter(function (x) { return x.id === id; })[0];
    if (!r || r.status === 'done' || r.status === 'cancelled') return { ok: false, error: 'درخواست قابل تکمیل نیست' };
    r.status = 'done';
    var seq = state.brakeHistory.filter(function (h) { return h.phone === r.phone && h.planYear === r.planYear; }).length + 1;
    var h = { id: uid('bh'), requestId: r.id, phone: r.phone, date: now.toISOString(), padLabel: r.padLabel, vehicle: r.model + ' ' + r.year, centerName: r.centerName, planYear: r.planYear, seq: seq };
    state.brakeHistory.push(h);
    audit(state, actor || 'admin', 'complete', 'brakeRequest', id, 'نوبت ' + seq + ' سال ' + r.planYear);
    return { ok: true, history: h };
  }

  /* ---------- باشگاه و فرم‌های ساده ---------- */
  function joinClub(state, input, now) {
    now = now || new Date();
    var e = {};
    req(e, 'name', input.name, 'نام را وارد کنید');
    if (!isValidMobile(input.phone)) e.phone = 'شماره موبایل معتبر نیست';
    if (hasErr(e)) return { ok: false, errors: e };
    var phone = normalizePhone(input.phone);
    var m = state.clubMembers.filter(function (x) { return x.phone === phone; })[0];
    var created = false;
    if (!m) {
      m = { id: uid('mem'), name: clean(input.name), phone: phone, vehicles: [], linkedCodes: [], consentMarketing: !!input.consentMarketing, consentAt: input.consentMarketing ? now.toISOString() : '', createdAt: now.toISOString() };
      state.clubMembers.push(m); created = true;
    } else if (input.consentMarketing !== undefined) {
      m.consentMarketing = !!input.consentMarketing; m.consentAt = m.consentMarketing ? now.toISOString() : '';
    }
    if (input.vehicleModel && clean(input.vehicleModel)) {
      var vy = parseInt(normalizeDigits(input.vehicleYear), 10) || null, vm = clean(input.vehicleModel);
      if (!m.vehicles.some(function (v) { return v.model === vm && v.year === vy; })) m.vehicles.push({ model: vm, year: vy });
    }
    upsertCustomer(state, { name: m.name, phone: phone });
    enrollBrake(state, phone, now.toISOString(), 'club-demo');
    audit(state, 'customer', created ? 'create' : 'update', 'clubMember', m.id, phone);
    return { ok: true, member: m, created: created };
  }

  function linkWarrantyToMember(state, phone, code) {
    phone = normalizePhone(phone);
    var m = state.clubMembers.filter(function (x) { return x.phone === phone; })[0];
    if (!m) return { ok: false, error: 'ابتدا وارد باشگاه شوید' };
    var k = normCode(code);
    var w = state.warranties.filter(function (x) { return normCode(x.trackingCode) === k || normCode(x.scratchCode) === k || x.serialKey === k; })[0];
    if (!w) return { ok: false, error: 'گارانتی با این کد رهگیری/کد اسکرچ یافت نشد' };
    if (w.buyerPhone !== phone) return { ok: false, error: 'این گارانتی با شماره موبایل دیگری ثبت شده و به این حساب متصل نمی‌شود' };
    if (m.linkedCodes.indexOf(w.trackingCode) >= 0) return { ok: false, error: 'این کد قبلاً متصل شده است' };
    m.linkedCodes.push(w.trackingCode);
    audit(state, 'customer', 'link', 'clubMember', m.id, w.trackingCode);
    return { ok: true, warranty: w };
  }

  function memberHistory(state, phone) {
    phone = normalizePhone(phone);
    return {
      warranties: state.warranties.filter(function (w) { return w.buyerPhone === phone; }),
      coverage: state.coverageRequests.filter(function (c) { return c.owner.phone === phone; }),
      brake: state.brakeHistory.filter(function (h) { return h.phone === phone; })
    };
  }

  function addSimple(state, kind, input, now) {
    now = now || new Date();
    var e = {}, rec, list, letter;
    if (kind === 'tire') {
      list = 'tireRequests'; letter = 'T';
      req(e, 'name', input.name, 'نام را وارد کنید');
      if (!isValidMobile(input.phone)) e.phone = 'شماره موبایل معتبر نیست';
      req(e, 'city', input.city, 'شهر را وارد کنید');
      req(e, 'model', input.model, 'مدل خودرو را وارد کنید');
      checkVehicleYear(e, 'year', input.year);
      if (!/^\d{3}\/\d{2}R\d{2}$/i.test(normalizeDigits(clean(input.size)).replace(/\s/g, ''))) e.size = 'سایز را مثل 205/60R15 وارد کنید';
      if (!input.consentNotify) e.consentNotify = 'برای اطلاع‌رسانی، رضایت لازم است';
      if (hasErr(e)) return { ok: false, errors: e };
      rec = { name: clean(input.name), phone: normalizePhone(input.phone), city: clean(input.city), model: clean(input.model), year: parseInt(normalizeDigits(input.year), 10),
        size: normalizeDigits(clean(input.size)).replace(/\s/g, '').toUpperCase(), brand: clean(input.brand), status: 'registered_interest', consentNotify: true };
    } else if (kind === 'basket') {
      list = 'basketInterests'; letter = 'S';
      if (!isValidMobile(input.phone)) e.phone = 'شماره موبایل معتبر نیست';
      req(e, 'model', input.model, 'مدل خودرو را وارد کنید');
      var cats = [].concat(input.categories || []);
      if (!cats.length) e.categories = 'حداقل یک دسته را انتخاب کنید';
      if (!input.consentNotify) e.consentNotify = 'برای اطلاع‌رسانی، رضایت لازم است';
      if (hasErr(e)) return { ok: false, errors: e };
      rec = { phone: normalizePhone(input.phone), model: clean(input.model), year: parseInt(normalizeDigits(input.year), 10) || null, categories: cats, status: 'registered_interest', consentNotify: true };
    } else if (kind === 'insurance') {
      list = 'insuranceRequests'; letter = 'I';
      req(e, 'name', input.name, 'نام را وارد کنید');
      if (!isValidMobile(input.phone)) e.phone = 'شماره موبایل معتبر نیست';
      req(e, 'model', input.model, 'مدل خودرو را وارد کنید');
      req(e, 'insurer', input.insurer, 'بیمه‌گر فعلی یا «ندارم» را بنویسید');
      if (!input.consentNotify) e.consentNotify = 'برای اطلاع‌رسانی، رضایت لازم است';
      if (hasErr(e)) return { ok: false, errors: e };
      rec = { name: clean(input.name), phone: normalizePhone(input.phone), model: clean(input.model), insurer: clean(input.insurer), expiry: clean(input.expiry), status: 'registered_interest', consentNotify: true };
    } else if (kind === 'contact') {
      list = 'contacts'; letter = 'M';
      req(e, 'name', input.name, 'نام را وارد کنید');
      if (!isValidMobile(input.phone)) e.phone = 'شماره موبایل معتبر نیست';
      req(e, 'subject', input.subject, 'موضوع را انتخاب کنید');
      if (clean(input.message).length < 10) e.message = 'متن پیام حداقل ۱۰ نویسه باشد';
      if (hasErr(e)) return { ok: false, errors: e };
      rec = { name: clean(input.name), phone: normalizePhone(input.phone), subject: clean(input.subject), message: String(input.message).trim(), status: 'new' };
    } else return { ok: false, error: 'نوع نامعتبر' };
    rec.id = uid(kind); rec.trackingCode = trackingCode(state, letter); rec.createdAt = now.toISOString();
    state[list].push(rec);
    if (rec.name) upsertCustomer(state, { name: rec.name, phone: rec.phone, city: rec.city });
    audit(state, 'customer', 'create', kind, rec.id, rec.trackingCode);
    return { ok: true, record: rec };
  }

  return {
    STATE_VERSION: STATE_VERSION, WARRANTY_STATUS: WARRANTY_STATUS, COVERAGE_STATUS: COVERAGE_STATUS, COVERAGE_STEPS: COVERAGE_STEPS,
    normalizeDigits: normalizeDigits, normalizePhone: normalizePhone, isValidMobile: isValidMobile, normCode: normCode,
    formatToman: formatToman, formatDate: formatDate, faDigits: faDigits, isoDay: isoDay, clean: clean,
    trackingCode: trackingCode, audit: audit, defaultState: defaultState, upsertCustomer: upsertCustomer,
    registerWarranty: registerWarranty, lookupWarranty: lookupWarranty,
    calcCoveragePrice: calcCoveragePrice, createCoverageRequest: createCoverageRequest, advanceCoverage: advanceCoverage,
    markRefunded: markRefunded, lookupCoverage: lookupCoverage, coverageStatusView: coverageStatusView, toInt: toInt,
    planYear: planYear, brakeQuotaStatus: brakeQuotaStatus, createBrakeRequest: createBrakeRequest, completeBrakeRequest: completeBrakeRequest,
    enrollBrake: enrollBrake, joinClub: joinClub, linkWarrantyToMember: linkWarrantyToMember, memberHistory: memberHistory, addSimple: addSimple
  };
});
