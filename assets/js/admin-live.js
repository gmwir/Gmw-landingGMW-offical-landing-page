/* GMW admin-live.js — پنل مدیریت واقعی (Supabase). هیچ داده آزمایشی در این بخش نمایش داده نمی‌شود.
   ورود فقط با حساب Supabase Auth که در جدول admin_users ثبت شده باشد؛ دسترسی را RLS و توابع پایگاه داده اعمال می‌کنند
   (بدون ورود، هیچ داده‌ای خوانده یا تغییر داده نمی‌شود). */
(function () {
  'use strict';
  var S = window.GMWSupa, fa = function (n) { return new Intl.NumberFormat('fa-IR').format(n || 0); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var KIND = { warranty: 'گارانتی', coverage: 'پوشش سه‌ساله', brake: 'لنت', club: 'عضویت باشگاه', tire: 'لاستیک', basket: 'سبد اقتصادی', insurance: 'بیمه', contact: 'پیام تماس' };
  var STATUS = { 'new': 'جدید', in_review: 'در حال بررسی', approved: 'تأیید شده', rejected: 'رد شده', done: 'انجام شد' };
  var SETTABLE = ['in_review', 'approved', 'rejected', 'done'];   // وضعیت‌هایی که تابع decide_lead می‌پذیرد
  var LABEL = { scratchCode: 'کد اسکرچ', serial: 'سریال قطعه', partName: 'نام قطعه', brand: 'برند', specs: 'مشخصات قطعه', vehicleModel: 'مدل خودرو', vehicleYear: 'سال ساخت', year: 'سال ساخت',
    purchaseDate: 'تاریخ خرید', buyerName: 'نام خریدار', buyerPhone: 'موبایل خریدار', seller: 'فروشنده', invoice: 'فاکتور', message: 'متن پیام', subject: 'موضوع', model: 'مدل خودرو',
    mileage: 'کارکرد', accident: 'سابقهٔ تصادف', address: 'نشانی', parts: 'قطعات', owner: 'مالک', padClass: 'کلاس لنت', centerId: 'مرکز', size: 'سایز', type: 'نوع', notes: 'توضیحات',
    symptoms: 'علائم', insurer: 'شرکت بیمه', expiry: 'پایان بیمه', categories: 'دسته‌ها', repairs: 'تعمیرات', code: 'کد' };
  var st = { stats: null, leads: [], q: '', kind: '', status: '', sel: null, err: '', flash: '', busy: false, loaded: false, draft: null }, box;

  function dtf(d) { try { return new Date(d).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return d; } }
  function digits(s) { return String(s == null ? '' : s).replace(/[۰-۹]/g, function (c) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(c); }).replace(/[٠-٩]/g, function (c) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(c); }); }

  /* ---------- نمودار میله‌ای ساده (SVG) ---------- */
  function bars(rows, key, labelFn, key2) {
    var W = 640, H = 170, pad = 24, max = Math.max.apply(null, rows.map(function (r) { return Math.max(r[key], key2 ? r[key2] : 0); }).concat([1]));
    var bw = (W - pad * 2) / Math.max(rows.length, 1), out = '<svg viewBox="0 0 ' + W + ' ' + (H + 22) + '" class="chart" role="img" aria-label="نمودار">';
    [0.5, 1].forEach(function (f) { var y = H - f * (H - 10); out += '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + y + '" y2="' + y + '" class="grid"/><text x="' + (W - pad + 2) + '" y="' + (y + 4) + '" class="tick" direction="ltr">' + fa(Math.round(max * f)) + '</text>'; });
    rows.forEach(function (r, i) {
      var x = pad + i * bw, h = (r[key] / max) * (H - 10);
      out += '<rect x="' + (x + bw * 0.12) + '" y="' + (H - h) + '" width="' + (bw * 0.76) + '" height="' + h + '" rx="2" class="bar"><title>' + esc(labelFn(r)) + ': ' + fa(r[key]) + '</title></rect>';
      if (key2) { var h2 = (r[key2] / max) * (H - 10); out += '<rect x="' + (x + bw * 0.3) + '" y="' + (H - h2) + '" width="' + (bw * 0.4) + '" height="' + h2 + '" rx="2" class="bar2"/>'; }
      if (rows.length <= 12 || i % 5 === 0) out += '<text x="' + (x + bw / 2) + '" y="' + (H + 16) + '" text-anchor="middle" class="tick">' + esc(labelFn(r)) + '</text>';
    });
    return out + '</svg>';
  }

  /* ---------- جست‌وجو و فیلتر ---------- */
  function filtered() {
    var q = digits(st.q).trim().toLowerCase(), qd = q.replace(/\D/g, '');
    return st.leads.filter(function (l) {
      if (st.kind && l.kind !== st.kind) return false; if (st.status && l.status !== st.status) return false; if (!q) return true;
      return String(l.name || '').toLowerCase().indexOf(q) >= 0 || String(l.tracking_code || '').toLowerCase().indexOf(q) >= 0 || String(l.city || '').toLowerCase().indexOf(q) >= 0 ||
        (qd.length >= 3 && String(l.phone || '').indexOf(qd.replace(/^0/, '')) >= 0);
    });
  }
  function byId(id) { for (var i = 0; i < st.leads.length; i++) if (st.leads[i].id === id) return st.leads[i]; return null; }
  var badge = function (s) { return '<span class="st st-' + esc(s) + '">' + (STATUS[s] || esc(s)) + '</span>'; };

  /* ---------- نمایش جزئیات درخواست ---------- */
  function flat(v) {
    if (v == null || v === '') return '—'; if (v === true) return 'بله'; if (v === false) return 'خیر';
    if (Array.isArray(v)) return v.map(flat).join('، ');
    if (typeof v === 'object') return Object.keys(v).map(function (k) { return (LABEL[k] || k) + ': ' + flat(v[k]); }).join(' — ');
    return String(v);
  }
  function detail(l) {
    var p = l.payload || {}, keys = Object.keys(p), dr = (st.draft && st.draft.id === l.id) ? st.draft : null, curStatus = dr ? dr.status : l.status, curReason = dr ? dr.reason : (l.status === 'rejected' ? l.decision_reason : '');
    var rows = [['نوع درخواست', esc(KIND[l.kind] || l.kind)], ['کد رهگیری', '<span class="code">' + esc(l.tracking_code) + '</span>'], ['وضعیت', badge(l.status)], ['تاریخ ثبت', dtf(l.created_at)],
      ['نام', esc(l.name || '—')], ['شمارهٔ تماس', l.phone ? '<a href="tel:' + esc(l.phone) + '" dir="ltr">' + esc(l.phone) + '</a>' : '—'], ['شهر', esc(l.city || '—')],
      ['رضایت اطلاع‌رسانی', l.consent_marketing ? 'بله' : 'خیر'], ['صفحهٔ ثبت', '<span dir="ltr">' + esc(l.source_page || '—') + '</span>']];
    if (l.decided_at) rows.push(['آخرین تصمیم', dtf(l.decided_at)]); if (l.decision_reason) rows.push(['دلیل رد', esc(l.decision_reason)]);
    return '<div class="adm-detail"><button class="btn tiny ghost" data-live="back">← بازگشت به فهرست</button><h2>درخواست ' + esc(KIND[l.kind] || l.kind) + ' — ' + esc(l.name || 'بدون نام') + '</h2>' +
      (st.flash ? '<div class="result ok" role="status">' + esc(st.flash) + '</div>' : '') + (st.err ? '<div class="result bad" role="alert">' + esc(st.err) + '</div>' : '') +
      '<div class="grid2"><div class="panel"><h3>مشخصات درخواست</h3><dl class="kv">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl></div>' +
      '<div class="panel"><h3>تغییر وضعیت</h3><form class="adm-status" data-live="status-form" data-id="' + esc(l.id) + '"><label>وضعیت جدید<select name="status" required>' +
      (curStatus === 'new' || !curStatus ? '<option value="" selected disabled>انتخاب کنید…</option>' : '') + SETTABLE.map(function (x) { return '<option value="' + x + '"' + (curStatus === x ? ' selected' : '') + '>' + STATUS[x] + '</option>'; }).join('') + '</select></label>' +
      '<label>دلیل (برای «رد شده» الزامی است)<textarea name="reason" rows="3" maxlength="500" placeholder="دلیل مکتوب برای مشتری/پرونده">' + esc(curReason) + '</textarea></label>' +
      '<button class="btn" type="submit"' + (st.busy ? ' disabled' : '') + '>ثبت وضعیت</button><p class="hint">هر تغییر با زمان و حساب مدیر در پایگاه داده ثبت می‌شود.</p></form></div></div>' +
      '<div class="panel"><h3>اطلاعات ثبت‌شده در فرم</h3>' + (keys.length ? '<dl class="kv">' + keys.map(function (k) { return '<div><dt>' + esc(LABEL[k] || k) + '</dt><dd>' + esc(flat(p[k])) + '</dd></div>'; }).join('') + '</dl>' : '<p class="muted">اطلاعات تکمیلی ثبت نشده است.</p>') + '</div></div>';
  }

  /* ---------- آمار درخواست‌ها ---------- */
  function requestStats(s) {
    var bs = s.by_status || {}, byKind = {}, tot = {}, all = 0;
    Object.keys(bs).forEach(function (key) { var p = key.split('/'), k = p[0], t = p[1]; byKind[k] = byKind[k] || {}; byKind[k][t] = bs[key]; tot[t] = (tot[t] || 0) + bs[key]; all += bs[key]; });
    var order = ['new', 'in_review', 'approved', 'rejected', 'done'];
    var tiles = '<button class="tile tile-btn" data-live="fs" data-v=""><b>' + fa(all) + '</b><span>کل درخواست‌ها</span></button>' + order.map(function (t) { return '<button class="tile tile-btn st-tile st-' + t + '" data-live="fs" data-v="' + t + '"' + (st.status === t ? ' aria-pressed="true"' : '') + '><b>' + fa(tot[t] || 0) + '</b><span>' + STATUS[t] + '</span></button>'; }).join('');
    var kinds = Object.keys(KIND).filter(function (k) { return byKind[k]; });
    var matrix = kinds.length ? '<div class="table-wrap"><table class="table matrix"><thead><tr><th>نوع</th>' + order.map(function (t) { return '<th>' + STATUS[t] + '</th>'; }).join('') + '<th>جمع</th></tr></thead><tbody>' +
      kinds.map(function (k) { var sum = 0; return '<tr><th scope="row"><button class="linkish" data-live="fk" data-v="' + k + '">' + KIND[k] + '</button></th>' + order.map(function (t) { var n = byKind[k][t] || 0; sum += n; return '<td>' + (n ? fa(n) : '·') + '</td>'; }).join('') + '<td><b>' + fa(sum) + '</b></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted">هنوز درخواستی ثبت نشده است.</p>';
    return '<div class="admin-sec"><h2>آمار درخواست‌ها</h2><div class="tiles tiles-5">' + tiles + '</div>' + matrix + '</div>';
  }

  /* ---------- فهرست ---------- */
  function row(l) {
    return '<tr class="lead-row" data-live="open" data-id="' + esc(l.id) + '"><td data-l="زمان">' + dtf(l.created_at) + '</td><td data-l="نوع">' + esc(KIND[l.kind] || l.kind) + '</td><td data-l="کد"><span class="code">' + esc(l.tracking_code) + '</span></td>' +
      '<td data-l="نام">' + esc(l.name || '—') + '</td><td data-l="موبایل" dir="ltr">' + esc(l.phone || '—') + '</td><td data-l="شهر">' + esc(l.city || '—') + '</td><td data-l="وضعیت">' + badge(l.status) + '</td>' +
      '<td data-l=""><button class="btn tiny" data-live="open" data-id="' + esc(l.id) + '">جزئیات</button></td></tr>';
  }
  function listView() {
    var list = filtered();
    return '<div class="admin-sec"><h2>درخواست‌های مشتریان (' + fa(list.length) + ' از ' + fa(st.leads.length) + ')</h2>' +
      '<div class="mini adm-filters"><input data-live="q" type="search" placeholder="جست‌وجو: نام، موبایل، کد رهگیری، شهر" value="' + esc(st.q) + '" aria-label="جست‌وجو">' +
      '<select data-live="kind" aria-label="نوع"><option value="">همهٔ انواع</option>' + Object.keys(KIND).map(function (x) { return '<option value="' + x + '"' + (st.kind === x ? ' selected' : '') + '>' + KIND[x] + '</option>'; }).join('') + '</select>' +
      '<select data-live="status" aria-label="وضعیت"><option value="">همهٔ وضعیت‌ها</option>' + Object.keys(STATUS).map(function (x) { return '<option value="' + x + '"' + (st.status === x ? ' selected' : '') + '>' + STATUS[x] + '</option>'; }).join('') + '</select>' +
      ((st.q || st.kind || st.status) ? '<button class="btn tiny ghost" data-live="clear">پاک‌کردن فیلتر</button>' : '') + '<button class="btn tiny" data-live="csv">خروجی CSV (Excel)</button></div>' +
      (list.length ? '<div class="table-wrap"><table class="table leads"><thead><tr><th>زمان ثبت</th><th>نوع</th><th>کد رهگیری</th><th>نام</th><th>موبایل</th><th>شهر</th><th>وضعیت</th><th></th></tr></thead><tbody>' + list.slice(0, 300).map(row).join('') + '</tbody></table></div>' +
        (list.length > 300 ? '<p class="hint">۳۰۰ مورد اول نمایش داده شد؛ فیلتر کنید یا CSV بگیرید.</p>' : '') : '<p class="muted">' + (st.leads.length ? 'موردی با این فیلتر یافت نشد.' : 'هنوز درخواستی ثبت نشده است.') + '</p>') + '</div>';
  }

  function view() {
    if (!S || !S.configured) return '<div class="notice warn"><b>Supabase هنوز متصل نیست.</b> آدرس پروژه و کلید عمومی در تنظیمات ساخت (SUPABASE_URL و SUPABASE_ANON_KEY) وارد نشده است؛ بنابراین هیچ داده واقعی‌ای نمایش داده نمی‌شود. راهنما: docs/SUPABASE_SETUP.md</div>';
    if (!S.session()) return '<form class="panel adm-login" data-live="login"><h2>ورود مدیر</h2><p class="hint">فقط حساب‌های مدیر ثبت‌شده در سامانه می‌توانند وارد شوند.</p>' +
      '<label>ایمیل<input name="email" type="email" dir="ltr" autocomplete="username" required></label><label>رمز عبور<input name="password" type="password" dir="ltr" autocomplete="current-password" required></label>' +
      '<button class="btn block" type="submit">ورود</button><div id="live-msg" role="status">' + (st.err ? '<div class="result bad">' + esc(st.err) + '</div>' : '') + '</div></form>';
    var s = st.stats; if (!s) return '<p class="hint">در حال دریافت اطلاعات…</p>' + (st.err ? '<div class="result bad" role="alert">' + esc(st.err) + '</div><button class="btn tiny ghost" data-live="logout">خروج</button>' : '');
    var head = '<div class="adm-bar"><span class="muted">وارد شده: <b dir="ltr">' + esc((S.session() || {}).email) + '</b></span><span><button class="btn tiny ghost" data-live="refresh">بروزرسانی</button> <button class="btn tiny ghost" data-live="logout">خروج</button></span></div>';
    var sel = st.sel && byId(st.sel); if (sel) return head + detail(sel);
    var mo = (s.monthly || []).slice(-1)[0] || { views: 0, visitors: 0 };
    var tiles = [['بازدیدکنندهٔ امروز', s.today.visitors], ['بازدید امروز', s.today.views], ['بازدیدکنندهٔ ماه جاری', mo.visitors], ['بازدید ماه جاری', mo.views], ['عضو تأییدشدهٔ باشگاه', s.members_approved]];
    return head + '<div id="live-msg" role="status">' + (st.err ? '<div class="result bad" role="alert">' + esc(st.err) + '</div>' : (st.flash ? '<div class="result ok">' + esc(st.flash) + '</div>' : '')) + '</div>' +
      requestStats(s) + listView() +
      '<div class="admin-sec"><h2>بازدید سایت</h2><div class="tiles">' + tiles.map(function (t) { return '<div class="tile"><b>' + fa(t[1]) + '</b><span>' + t[0] + '</span></div>'; }).join('') + '</div>' +
      '<h3>۳۰ روز اخیر</h3><p class="hint"><i class="sw s1"></i> بازدید <i class="sw s2"></i> بازدیدکنندهٔ متمایز — بر پایهٔ شناسهٔ ناشناس مرورگر؛ جدا از اطلاعات مشتریان</p>' + bars(s.daily || [], 'views', function (r) { return r.day.slice(5); }, 'visitors') +
      '<h3>۱۲ ماه اخیر</h3>' + bars(s.monthly || [], 'views', function (r) { return r.month; }, 'visitors') + '</div>';
  }

  function csvCell(v) { v = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }
  function csv() {
    var rows = [['زمان', 'نوع', 'کد رهگیری', 'نام', 'موبایل', 'شهر', 'وضعیت', 'دلیل رد', 'رضایت', 'جزئیات']].concat(filtered().map(function (l) { return [l.created_at, KIND[l.kind] || l.kind, l.tracking_code, l.name, l.phone, l.city, STATUS[l.status] || l.status, l.decision_reason, l.consent_marketing ? 'بله' : 'خیر', JSON.stringify(l.payload || {})]; }));
    var blob = new Blob(['\ufeff' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'gmw-leads-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function paint() {
    if (!box) return; var f = document.activeElement, kid = f && f.getAttribute && f.getAttribute('data-live'), pos = f && f.selectionStart;
    box.innerHTML = view();
    if (kid === 'q') { var n = box.querySelector('[data-live="q"]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }
  }
  function load() {
    if (!S || !S.configured || !S.session()) { paint(); return; }
    st.err = '';
    Promise.all([S.rpc('admin_stats', { p_days: 30 }), S.select('leads', 'select=id,created_at,kind,tracking_code,status,name,phone,city,payload,consent_marketing,decision_reason,decided_at,source_page&order=created_at.desc&limit=5000')])
      .then(function (r) { st.stats = r[0]; st.leads = r[1] || []; st.loaded = true; paint(); },
        function (e) { st.err = /forbidden|42501|permission|403/i.test(e.message) ? 'این حساب مدیر نیست (در فهرست مدیران ثبت نشده است).' : e.message; if (/نشست/.test(e.message)) { st.stats = null; } paint(); });
  }
  function decide(id, status, reason) {
    st.draft = { id: id, status: status, reason: reason };
    if (SETTABLE.indexOf(status) < 0) { st.err = 'وضعیت را انتخاب کنید.'; paint(); return; }
    if (status === 'rejected' && !String(reason || '').trim()) { st.err = 'برای «رد شده» نوشتن دلیل الزامی است.'; paint(); return; }
    st.busy = true; st.err = ''; st.flash = ''; paint();
    S.rpc('decide_lead', { p_id: id, p_status: status, p_reason: reason || null }).then(function () { st.busy = false; st.draft = null; st.flash = 'وضعیت به «' + STATUS[status] + '» تغییر کرد.'; load(); },
      function (e) { st.busy = false; st.err = /reason required/.test(e.message) ? 'دلیل رد الزامی است.' : /forbidden|42501/.test(e.message) ? 'دسترسی مجاز نیست.' : e.message; paint(); });
  }

  window.GMWLive = { mount: function (el) {
    box = el; paint(); if (S && S.session() && !st.loaded) load();
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-live]'); if (!b) return; var a = b.getAttribute('data-live'), id = b.getAttribute('data-id'), v = b.getAttribute('data-v');
      if (a === 'refresh') { st.flash = ''; load(); } else if (a === 'logout') { S.signOut(); st.stats = null; st.leads = []; st.loaded = false; st.sel = null; paint(); } else if (a === 'csv') csv();
      else if (a === 'open') { st.draft = null; st.sel = id; st.flash = ''; st.err = ''; paint(); try { window.scrollTo(0, 0); } catch (x) {} }
      else if (a === 'back') { st.draft = null; st.sel = null; st.flash = ''; st.err = ''; paint(); }
      else if (a === 'fs') { st.status = v || ''; st.kind = v ? st.kind : ''; if (!v) { st.q = ''; } paint(); var t = box.querySelector('.leads'); if (t && t.scrollIntoView) t.scrollIntoView({ block: 'start' }); }
      else if (a === 'fk') { st.kind = v; paint(); var t2 = box.querySelector('.leads'); if (t2 && t2.scrollIntoView) t2.scrollIntoView({ block: 'start' }); }
      else if (a === 'clear') { st.q = ''; st.kind = ''; st.status = ''; paint(); }
    });
    el.addEventListener('input', function (e) { if (e.target.getAttribute('data-live') === 'q') { st.q = e.target.value; paint(); } });
    el.addEventListener('change', function (e) { var t = e.target.getAttribute('data-live'); if (t === 'kind' || t === 'status') { st[t] = e.target.value; paint(); } });
    el.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-live]'); if (!f) return; var a = f.getAttribute('data-live'); e.preventDefault();
      if (a === 'login') { st.err = ''; S.signIn(f.elements.email.value.trim(), f.elements.password.value).then(function () { f.elements.password.value = ''; st.loaded = false; load(); }, function () { st.err = 'ورود انجام نشد؛ ایمیل یا رمز را بررسی کنید.'; paint(); }); }
      else if (a === 'status-form') decide(f.getAttribute('data-id'), f.elements.status.value, f.elements.reason.value);
    });
  } };
})();
