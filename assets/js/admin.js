/* GMW admin.js — ابزارهای گردش‌کار آزمایشی محلی (/admin/#local؛ بدون احراز هویت و بدون اتصال به پایگاه داده). نقش‌ها فقط سطح دسترسی معماری را نشان می‌دهند. */
(function () {
  'use strict';
  var C = window.GMWCore, KEY = 'gmw_demo_state_v1', ROLE_KEY = 'gmw_admin_role';
  function load() { try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.version === C.STATE_VERSION) return s; } catch (e) {} return C.defaultState(); }
  var state = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  var root = document.getElementById('admin-root');
  /* حالت پیش‌فرض: فقط پنل واقعی (Supabase). ابزارهای گردش‌کار آزمایشی قدیمی فقط با /admin/#local در دسترس‌اند و داده‌شان فقط در همین مرورگر است. */
  if (location.hash !== '#local') {
    root.innerHTML = '<div id="live-root"></div><p class="hint local-link"><a href="#local" id="go-local">ابزارهای گردش‌کار آزمایشی (محلی؛ بدون اتصال به پایگاه داده)</a></p>';
    if (window.GMWLive) window.GMWLive.mount(document.getElementById('live-root'));
    document.getElementById('go-local').addEventListener('click', function () { setTimeout(function () { location.reload(); }, 0); });
    return;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fa(n) { return new Intl.NumberFormat('fa-IR').format(n); }
  var T = C.formatToman, D = C.formatDate;

  var ROLES = { owner: 'مدیر ارشد', finance: 'مالی', support: 'پشتیبانی', ops: 'عملیات و خدمات' };
  var TABS = [
    ['live', 'آمار و مشتریان واقعی (Supabase)', ['owner', 'support', 'ops']],
    ['dash', 'گزارش عملکرد', ['owner', 'finance', 'support', 'ops']],
    ['customers', 'مشتریان', ['owner', 'support']],
    ['warranties', 'گارانتی‌ها و کدها', ['owner', 'support']],
    ['coverage', 'درخواست‌های پوشش چهارساله', ['owner', 'ops']],
    ['parts', 'قطعات و قیمت‌گذاری', ['owner', 'finance']],
    ['payments', 'پرداخت‌ها و بازپرداخت‌ها', ['owner', 'finance']],
    ['claims', 'پرونده‌های خسارت', ['owner', 'ops']],
    ['techs', 'کارشناسان و استادکاران', ['owner', 'ops']],
    ['brake', 'خدمات لنت و سهمیه سالانه', ['owner', 'ops']],
    ['brakehist', 'سوابق تعویض لنت', ['owner', 'ops', 'support']],
    ['tires', 'درخواست‌های لاستیک', ['owner', 'support']],
    ['club', 'باشگاه، سبد و بیمه', ['owner', 'support']],
    ['contacts', 'پیام‌های تماس', ['owner', 'support']],
    ['audit', 'تاریخچهٔ تغییرات', ['owner', 'finance']],
    ['data', 'داده و بازنشانی', ['owner']]
  ];
  var role = (function () { try { var r = localStorage.getItem(ROLE_KEY); return ROLES[r] ? r : 'owner'; } catch (e) { return 'owner'; } })(), tab = 'live';
  var actor = function () { return 'admin:' + role; };

  function table(cols, rows, empty) {
    if (!rows.length) return '<p class="muted">' + (empty || 'موردی ثبت نشده.') + '</p>';
    return '<div class="table-wrap"><table class="table"><thead><tr>' + cols.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + cols.map(function (c) { var v = c[1](r); return '<td>' + (v == null ? '' : v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  var cust = function (id) { var c = state.customers.filter(function (x) { return x.id === id; })[0]; return c ? esc(c.name) + ' (' + esc(c.phone) + ')' : ''; };
  var techName = function (id) { var t = state.technicians.filter(function (x) { return x.id === id; })[0]; return t ? esc(t.name) : '—'; };

  /* ---------- نمای هر تب ---------- */
  var views = {
    live: function () { return '<div id="live-root"></div>'; },
    dash: function () {
      var paid = state.payments.filter(function (p) { return p.status === 'received' || p.status === 'refund_pending'; }).reduce(function (s, p) { return s + p.amount; }, 0);
      var pendRef = state.refunds.filter(function (r) { return r.status === 'pending'; }).reduce(function (s, r) { return s + r.amount; }, 0);
      var tiles = [['مشتریان', state.customers.length], ['گارانتی ثبت‌شده', state.warranties.length], ['درخواست چهارساله', state.coverageRequests.length], ['پوشش فعال', state.coverageRequests.filter(function (c) { return c.status === 'active'; }).length],
        ['پرداخت آزمایشی', T(paid)], ['بازپرداخت در انتظار', T(pendRef)], ['درخواست لنت', state.brakeRequests.length], ['تعویض انجام‌شده', state.brakeHistory.length], ['درخواست لاستیک', state.tireRequests.length], ['اعضای باشگاه', state.clubMembers.length], ['پیام‌های تماس', state.contacts.length]];
      var reserve = paid;
      return '<div class="tiles">' + tiles.map(function (t) { return '<div class="tile"><b>' + (typeof t[1] === 'number' ? fa(t[1]) : t[1]) + '</b><span>' + t[0] + '</span></div>'; }).join('') + '</div>' +
        '<div class="notice warn"><b>تفکیک مالی:</b> مبالغ دریافتی طرح چهارساله (' + T(reserve) + ' آزمایشی) باید به‌عنوان تعهد آینده در حساب ذخیره جدا از سود جاری نگه‌داری شود. این پنل فقط جداسازی را نشان می‌دهد؛ حسابداری واقعی در Backend انجام می‌شود.</div>';
    },
    customers: function () { return table([['نام', function (c) { return esc(c.name); }], ['موبایل', function (c) { return esc(c.phone); }], ['شهر', function (c) { return esc(c.city); }], ['ثبت', function (c) { return D(c.createdAt); }]], state.customers); },
    warranties: function () {
      return '<div class="admin-sec"><h2>گارانتی‌ها</h2>' + table([['کد رهگیری', function (w) { return esc(w.trackingCode); }], ['قطعه', function (w) { return esc(w.partName + ' / ' + w.brand); }], ['سریال', function (w) { return esc(w.serial); }], ['خریدار', function (w) { return cust(w.customerId); }], ['فروشنده', function (w) { return esc(w.seller); }], ['فاکتور', function (w) { return esc(w.invoiceFile.name); }], ['وضعیت', function (w) { return esc(C.WARRANTY_STATUS[w.status]); }],
        ['عملیات', function (w) { return w.status === 'pending_review' ? '<button class="btn tiny" data-act="war-ok" data-id="' + w.id + '">تأیید فاکتور</button> <button class="btn tiny ghost" data-act="war-no" data-id="' + w.id + '">رد</button>' : ''; }]], state.warranties) + '</div>' +
        '<div class="admin-sec"><h2>کدهای اسکرچ یک‌بارمصرف</h2><form class="mini" data-form="addcode"><input name="code" placeholder="کد جدید" dir="ltr" required><button class="btn tiny">افزودن</button></form>' +
        table([['کد', function (c) { return esc(c.code) + (c.demo ? ' <span class="badge demo">آزمایشی</span>' : ''); }], ['وضعیت', function (c) { return c.status === 'unused' ? 'استفاده‌نشده' : 'مصرف‌شده'; }], ['مصرف‌کننده', function (c) { return esc(c.usedBy); }]], state.scratchCodes) + '</div>';
    },
    coverage: function () {
      return table([['کد', function (r) { return esc(r.trackingCode); }], ['مالک', function (r) { return esc(r.owner.name) + '<br>' + esc(r.owner.phone) + ' — ' + esc(r.owner.city); }], ['خودرو', function (r) { return esc(r.owner.model) + ' ' + fa(r.owner.year).replace(/٬/g, '') + '<br>' + fa(r.owner.mileage) + ' km — تصادف: ' + esc(r.owner.accident); }],
        ['قطعات انتخابی', function (r) { return r.parts.map(function (p) { return esc(p.name); }).join('، '); }], ['مبلغ', function (r) { return T(r.total); }], ['وضعیت', function (r) { return esc(C.COVERAGE_STATUS[r.status]) + (r.decisionReason ? '<br><small>' + esc(r.decisionReason) + '</small>' : ''); }],
        ['استادکار', function (r) { return techName(r.technicianId); }], ['اقدام', function (r) { return covActions(r); }]], state.coverageRequests.slice().reverse());
    },
    parts: function () {
      var cv = state.settings.coverage;
      return '<div class="admin-sec"><h2>تنظیمات قیمت‌گذاری طرح</h2><form class="mini" data-form="cov-settings">ضریب: <input name="multiplier" value="' + cv.multiplier + '" size="4"> حداقل مبلغ: <input name="minTotal" value="' + cv.minTotal + '"> سقف مبلغ (اختیاری): <input name="cap" value="' + (cv.cap || '') + '"><button class="btn tiny">ذخیره</button></form><p class="hint">عدد ۲٬۳۴۵٬۰۰۰ تومان قیمت قطعی نیست؛ هر سقفی باید پس از بازبینی اینجا وارد شود.</p></div>' +
        '<div class="admin-sec"><h2>قطعات</h2>' + table([['قطعه', function (p) { return esc(p.name) + '<br><small class="muted">' + esc(p.group) + '</small>'; }],
          ['قیمت (تومان)', function (p) { return '<input data-part="' + p.id + '" data-k="price" value="' + p.price + '" size="9">'; }],
          ['سقف تعهد', function (p) { return '<input data-part="' + p.id + '" data-k="limit" value="' + (p.limit == null ? '' : p.limit) + '" size="9" placeholder="تعریف نشده">'; }],
          ['حداکثر دفعات تعویض', function (p) { return '<input data-part="' + p.id + '" data-k="maxReplacements" value="' + (p.maxReplacements == null ? '' : p.maxReplacements) + '" size="4" placeholder="؟">'; }],
          ['فعال', function (p) { return '<input type="checkbox" data-part="' + p.id + '" data-k="active"' + (p.active ? ' checked' : '') + '>'; }]], state.parts) + '</div>';
    },
    payments: function () {
      return '<div class="admin-sec"><h2>پرداخت‌ها (پس از تأیید اصالت، با هماهنگی)</h2>' + table([['کد', function (p) { return esc(p.trackingCode); }], ['مبلغ', function (p) { return T(p.amount); }], ['وضعیت', function (p) { return { pending: 'در انتظار هماهنگی', received: 'دریافت‌شده', refund_pending: 'در انتظار بازپرداخت', refunded: 'بازپرداخت‌شده' }[p.status]; }], ['زمان', function (p) { return D(p.at); }]], state.payments) + '</div>' +
        '<div class="admin-sec"><h2>بازپرداخت‌ها</h2>' + table([['کد', function (r) { return esc(r.trackingCode); }], ['مبلغ (کامل)', function (r) { return T(r.amount); }], ['دلیل رد', function (r) { return esc(r.reason); }], ['وضعیت', function (r) { return r.status === 'refunded' ? 'انجام شد' : 'در انتظار'; }],
          ['اقدام', function (r) { return r.status === 'pending' ? '<button class="btn tiny" data-act="refund" data-id="' + r.id + '">ثبت بازپرداخت</button>' : ''; }]], state.refunds) + '</div>';
    },
    claims: function () { return '<p class="hint">پرونده‌های زیر نمونهٔ نمایشی‌اند.</p>' + table([['پرونده', function (c) { return esc(c.id) + ' <span class="badge demo">نمونه نمایشی</span>'; }], ['خرید', function (c) { return D(c.purchase); }], ['درخواست', function (c) { return D(c.claim); }], ['کارشناسی', function (c) { return esc(c.expertise); }], ['نتیجه', function (c) { return esc(c.result); }], ['مبلغ', function (c) { return c.amount == null ? '—' : T(c.amount); }], ['پرداخت', function (c) { return esc(c.payment); }]], state.claims); },
    techs: function () {
      return '<form class="mini" data-form="addtech"><input name="name" placeholder="نام" required><input name="city" placeholder="شهر" required><input name="phone" placeholder="موبایل" dir="ltr"><button class="btn tiny">افزودن</button></form>' +
        table([['نام', function (t) { return esc(t.name) + (t.demo ? ' <span class="badge demo">نمونه</span>' : ''); }], ['شهر', function (t) { return esc(t.city); }], ['موبایل', function (t) { return esc(t.phone); }]], state.technicians);
    },
    brake: function () {
      var b = state.settings.brake;
      return '<div class="admin-sec"><h2>سهمیهٔ هر سال (جداگانه)</h2><form class="mini" data-form="quota">سال ۱: <input name="q1" value="' + b.quotas[1] + '" size="2"> سال ۲: <input name="q2" value="' + b.quotas[2] + '" size="2"> سال ۳: <input name="q3" value="' + b.quotas[3] + '" size="2"> اجرت عضو: <input name="lm" value="' + b.laborMember + '" size="8"> اجرت عادی (مرجع): <input name="lr" value="' + b.laborRegular + '" size="8"><button class="btn tiny">ذخیره</button></form></div>' +
        '<div class="admin-sec"><h2>قیمت لنت (جدا از اجرت)</h2>' + table([['کلاس', function (c) { return esc(c.label); }], ['قیمت', function (c) { return '<input data-pad="' + c.id + '" value="' + c.padPrice + '" size="9">'; }]], b.classes) + '</div>' +
        '<div class="admin-sec"><h2>عضویت‌ها و استثنای سهمیه</h2>' + table([['موبایل', function (e) { return esc(e.phone); }], ['شروع', function (e) { return D(e.startDate); }], ['منبع', function (e) { return e.source === 'coverage' ? 'طرح چهارساله' : 'باشگاه (آزمایشی)'; }], ['وضعیت سهمیه', function (e) { var st = C.brakeQuotaStatus(state, e.phone); return st.table.map(function (r) { return 'سال ' + fa(r.year) + ': ' + fa(r.used) + '/' + fa(r.quota); }).join(' — '); }],
          ['بازنویسی سهمیهٔ سال جاری', function (e) { var y = C.brakeQuotaStatus(state, e.phone).currentYear; return y ? '<input data-ov="' + e.id + '" data-y="' + y + '" size="2" placeholder="؟"><button class="btn tiny" data-act="ov" data-id="' + e.id + '">ثبت</button>' : '—'; }]], state.brakeEnrollments) + '</div>' +
        '<div class="admin-sec"><h2>درخواست‌های لنت</h2>' + table([['کد', function (r) { return esc(r.trackingCode); }], ['عضو', function (r) { return esc(r.name) + ' — ' + esc(r.phone); }], ['خودرو', function (r) { return esc(r.model) + ' ' + fa(r.year).replace(/٬/g, ''); }], ['لنت / مرکز', function (r) { return esc(r.padLabel) + '<br>' + esc(r.centerName); }], ['سال دوره', function (r) { return fa(r.planYear); }], ['وضعیت', function (r) { return { requested: 'درخواست‌شده', done: 'انجام شد', cancelled: 'لغو' }[r.status] || r.status; }],
          ['اقدام', function (r) { return r.status === 'requested' ? '<button class="btn tiny" data-act="brk-done" data-id="' + r.id + '">ثبت انجام تعویض</button>' : ''; }]], state.brakeRequests) + '</div>';
    },
    brakehist: function () { return table([['تاریخ', function (h) { return D(h.date); }], ['عضو', function (h) { return esc(h.phone); }], ['نوع لنت', function (h) { return esc(h.padLabel); }], ['خودرو', function (h) { return esc(h.vehicle); }], ['مرکز نصب', function (h) { return esc(h.centerName); }], ['نوبت', function (h) { return 'سال ' + fa(h.planYear) + ' — نوبت ' + fa(h.seq); }]], state.brakeHistory); },
    tires: function () { return table([['کد', function (r) { return esc(r.trackingCode); }], ['نام', function (r) { return esc(r.name) + ' — ' + esc(r.phone); }], ['شهر', function (r) { return esc(r.city); }], ['خودرو', function (r) { return esc(r.model) + ' ' + fa(r.year).replace(/٬/g, ''); }], ['سایز / برند', function (r) { return '<span dir="ltr">' + esc(r.size) + '</span> ' + esc(r.brand); }], ['رضایت اطلاع‌رسانی', function (r) { return r.consentNotify ? 'دارد' : 'ندارد'; }]], state.tireRequests); },
    club: function () {
      return '<div class="admin-sec"><h2>اعضا</h2>' + table([['نام', function (m) { return esc(m.name); }], ['موبایل', function (m) { return esc(m.phone); }], ['خودروها', function (m) { return m.vehicles.map(function (v) { return esc(v.model); }).join('، '); }], ['رضایت تبلیغاتی', function (m) { return m.consentMarketing ? 'دارد (' + D(m.consentAt) + ')' : 'ندارد'; }]], state.clubMembers) + '</div>' +
        '<div class="admin-sec"><h2>علاقه‌مندان سبد اقتصادی</h2>' + table([['موبایل', function (r) { return esc(r.phone); }], ['خودرو', function (r) { return esc(r.model); }], ['دسته‌ها', function (r) { return esc(r.categories.join('، ')); }]], state.basketInterests) + '</div>' +
        '<div class="admin-sec"><h2>درخواست‌های تخفیف بیمه</h2>' + table([['نام', function (r) { return esc(r.name) + ' — ' + esc(r.phone); }], ['خودرو', function (r) { return esc(r.model); }], ['بیمه‌گر فعلی', function (r) { return esc(r.insurer); }]], state.insuranceRequests) + '</div>';
    },
    contacts: function () { return table([['کد', function (r) { return esc(r.trackingCode); }], ['نام', function (r) { return esc(r.name) + ' — ' + esc(r.phone); }], ['موضوع', function (r) { return esc(r.subject); }], ['پیام', function (r) { return esc(r.message); }], ['زمان', function (r) { return D(r.createdAt); }]], state.contacts); },
    audit: function () { return table([['زمان', function (a) { return new Date(a.at).toLocaleString('fa-IR'); }], ['کاربر', function (a) { return esc(a.actor); }], ['عملیات', function (a) { return esc(a.action); }], ['موجودیت', function (a) { return esc(a.entity); }], ['جزئیات', function (a) { return esc(a.detail); }]], state.audit, 'تغییری ثبت نشده.'); },
    data: function () { return '<p>داده‌های آزمایشی فقط در این مرورگر هستند.</p><div class="row"><button class="btn" data-act="export">دریافت JSON</button><button class="btn ghost" data-act="reset">بازنشانی به داده‌های اولیه</button></div>'; }
  };

  function covActions(r) {
    var id = r.id, b = '';
    if (r.status === 'registered' || r.status === 'assigned') b += '<div class="mini"><select data-tech="' + id + '"><option value="">استادکار</option>' + state.technicians.map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + ' (' + esc(t.city) + ')</option>'; }).join('') + '</select><button class="btn tiny" data-act="assign" data-id="' + id + '">معرفی</button></div>';
    if (r.status === 'assigned') b += '<div class="mini"><input data-note="' + id + '" placeholder="گزارش معاینه"><button class="btn tiny" data-act="inspect" data-id="' + id + '">ثبت معاینه</button></div>';
    if (r.status === 'inspected') b += '<button class="btn tiny" data-act="approve" data-id="' + id + '">تأیید</button> ';
    if (r.status === 'approved') b += '<div class="mini"><input data-note="' + id + '" placeholder="توضیح پرداخت (اختیاری)"><button class="btn tiny" data-act="payment" data-id="' + id + '">ثبت پرداخت (هماهنگ‌شده)</button></div>';
    if (r.status === 'paid') b += '<button class="btn tiny" data-act="activate" data-id="' + id + '">فعال‌سازی پوشش</button>';
    if (['registered', 'assigned', 'inspected', 'approved', 'paid'].indexOf(r.status) >= 0) b += '<div class="mini"><input data-why="' + id + '" placeholder="دلیل رد (الزامی)"><button class="btn tiny ghost" data-act="reject" data-id="' + id + '">رد درخواست</button></div>';
    return b;
  }

  /* ---------- رندر اصلی ---------- */
  function render() {
    var allowed = TABS.filter(function (t) { return t[2].indexOf(role) >= 0; });
    if (!allowed.some(function (t) { return t[0] === tab; })) tab = allowed[0][0];
    root.innerHTML = '<div class="admin-top"><label for="role">نقش (نمایشی):</label><select id="role" style="width:auto;min-height:40px">' + Object.keys(ROLES).map(function (k) { return '<option value="' + k + '"' + (k === role ? ' selected' : '') + '>' + ROLES[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="tabs" role="tablist">' + allowed.map(function (t) { return '<button role="tab" aria-selected="' + (t[0] === tab) + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div id="admin-msg" role="status" aria-live="polite"></div><div>' + views[tab]() + '</div>' +
      (tab === 'live' ? '' : '<p class="hint">این تب‌ها ابزار گردش‌کار محلی هستند و داده‌شان فقط در همین مرورگر است؛ آمار و مشتریان واقعی در تب «آمار و مشتریان واقعی» است.</p>');
    if (tab === 'live' && window.GMWLive) window.GMWLive.mount(document.getElementById('live-root'));
  }
  function msg(t, bad) { var m = document.getElementById('admin-msg'); if (m) m.innerHTML = '<div class="result ' + (bad ? 'bad' : 'ok') + '">' + esc(t) + '</div>'; }
  function done(res, okText) { if (res && res.ok === false) { render(); msg(res.error || 'انجام نشد', true); return; } save(); render(); msg(okText || 'ذخیره شد'); }
  function num(v) { v = C.normalizeDigits(v).replace(/[,٬\s]/g, ''); return v === '' ? null : Number(v); }

  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab]'); if (t) { tab = t.getAttribute('data-tab'); render(); return; }
    var a = e.target.closest('[data-act]'); if (!a) return;
    var act = a.getAttribute('data-act'), id = a.getAttribute('data-id'), q = function (attr) { return root.querySelector('[' + attr + '="' + id + '"]'); };
    if (act === 'assign') done(C.advanceCoverage(state, id, 'assign', { technicianId: q('data-tech').value }, actor()), 'استادکار معرفی شد');
    else if (act === 'inspect') done(C.advanceCoverage(state, id, 'inspect', { notes: q('data-note').value }, actor()), 'معاینه ثبت شد');
    else if (act === 'approve') done(C.advanceCoverage(state, id, 'approve', {}, actor()), 'تأیید شد');
    else if (act === 'payment') done(C.advanceCoverage(state, id, 'payment', { note: (q('data-note') || {}).value }, actor()), 'پرداخت ثبت شد');
    else if (act === 'activate') done(C.advanceCoverage(state, id, 'activate', {}, actor()), 'پوشش فعال شد و عضویت لنت ایجاد شد');
    else if (act === 'reject') done(C.advanceCoverage(state, id, 'reject', { reason: q('data-why').value }, actor()), 'رد شد؛ در صورت دریافت وجه، بازپرداخت کامل در صف قرار می‌گیرد');
    else if (act === 'refund') done(C.markRefunded(state, id, actor()), 'بازپرداخت ثبت شد');
    else if (act === 'brk-done') done(C.completeBrakeRequest(state, id, actor()), 'تعویض ثبت شد');
    else if (act === 'war-ok' || act === 'war-no') { var w = state.warranties.filter(function (x) { return x.id === id; })[0]; w.status = act === 'war-ok' ? 'active' : 'rejected'; C.audit(state, actor(), act, 'warranty', id, w.trackingCode); done({ ok: true }, 'وضعیت گارانتی تغییر کرد'); }
    else if (act === 'ov') {
      var inp = q('data-ov'), en = state.brakeEnrollments.filter(function (x) { return x.id === id; })[0], y = inp.getAttribute('data-y'), v = num(inp.value);
      if (v == null || v < 0) { msg('عدد معتبر وارد کنید', true); return; }
      en.quotaOverrides[y] = v; C.audit(state, actor(), 'quota-override', 'brakeEnrollment', id, 'سال ' + y + ' = ' + v); done({ ok: true }, 'سهمیه بازنویسی شد');
    }
    else if (act === 'export') { var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = 'gmw-demo-data.json'; l.click(); }
    else if (act === 'reset') { if (confirm('همهٔ داده‌های آزمایشی پاک و داده‌های اولیه بازگردانده شود؟')) { state = C.defaultState(); localStorage.removeItem('gmw_session_phone'); done({ ok: true }, 'بازنشانی شد'); } }
  });
  root.addEventListener('change', function (e) {
    if (e.target.id === 'role') { role = ROLES[e.target.value] ? e.target.value : 'owner'; try { localStorage.setItem(ROLE_KEY, role); } catch (er) {} render(); return; }
    var p = e.target.getAttribute('data-part');
    if (p) {
      var part = state.parts.filter(function (x) { return x.id === p; })[0], k = e.target.getAttribute('data-k'), old = part[k];
      if (k === 'active') part.active = e.target.checked;
      else { var v = num(e.target.value); if (k === 'price' && (v == null || v < 0)) { render(); msg('قیمت معتبر نیست', true); return; } part[k] = v; }
      C.audit(state, actor(), 'edit-part', 'part', p, k + ': ' + old + ' → ' + part[k]); save(); msg('ذخیره شد: ' + part.name); return;
    }
    var pad = e.target.getAttribute('data-pad');
    if (pad) {
      var c = state.settings.brake.classes.filter(function (x) { return x.id === pad; })[0], nv = num(e.target.value);
      if (nv == null || nv < 0) { render(); msg('قیمت معتبر نیست', true); return; }
      C.audit(state, actor(), 'edit-pad-price', 'brakeClass', pad, c.padPrice + ' → ' + nv); c.padPrice = nv; save(); msg('ذخیره شد');
    }
  });
  root.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault();
    var k = f.getAttribute('data-form'), d = {}; Array.prototype.forEach.call(f.elements, function (el) { if (el.name) d[el.name] = el.value; });
    if (k === 'addcode') {
      var code = C.clean(d.code).toUpperCase(); if (!code) return;
      if (state.scratchCodes.some(function (c) { return C.normCode(c.code) === C.normCode(code); })) { msg('این کد قبلاً وجود دارد', true); return; }
      state.scratchCodes.push({ code: code, status: 'unused', usedBy: '' }); C.audit(state, actor(), 'add-code', 'scratchCode', '', code); done({ ok: true }, 'کد افزوده شد');
    } else if (k === 'addtech') {
      state.technicians.push({ id: 't' + Date.now().toString(36), name: C.clean(d.name), city: C.clean(d.city), phone: C.normalizePhone(d.phone) }); C.audit(state, actor(), 'add-tech', 'technician', '', d.name); done({ ok: true }, 'افزوده شد');
    } else if (k === 'cov-settings') {
      var m = num(d.multiplier), mt = num(d.minTotal), cap = num(d.cap);
      if (!m || m <= 0) { msg('ضریب معتبر نیست', true); return; }
      state.settings.coverage.multiplier = m; state.settings.coverage.minTotal = mt || 0; state.settings.coverage.cap = cap || null;
      C.audit(state, actor(), 'edit-settings', 'coverage', '', 'ضریب ' + m + ' / حداقل ' + (mt || 0) + ' / سقف ' + (cap || '—')); done({ ok: true }, 'تنظیمات ذخیره شد');
    } else if (k === 'quota') {
      var q = [num(d.q1), num(d.q2), num(d.q3)], lm = num(d.lm), lr = num(d.lr);
      if (q.some(function (x) { return x == null || x < 0; }) || lm == null || lr == null) { msg('مقادیر معتبر وارد کنید', true); return; }
      state.settings.brake.quotas = { 1: q[0], 2: q[1], 3: q[2] }; state.settings.brake.laborMember = lm; state.settings.brake.laborRegular = lr;
      C.audit(state, actor(), 'edit-quota', 'brake', '', 'سهمیه ' + q.join('/') + ' اجرت عضو ' + lm); done({ ok: true }, 'ذخیره شد');
    }
  });
  render();
})();
