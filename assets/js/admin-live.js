/* GMW admin-live.js — داشبورد داده واقعی (Supabase). هیچ داده آزمایشی در این بخش نمایش داده نمی‌شود.
   ورود فقط با حساب Supabase Auth که در جدول admin_users ثبت شده باشد؛ دسترسی را RLS در پایگاه داده اعمال می‌کند. */
(function () {
  'use strict';
  var S = window.GMWSupa, fa = function (n) { return new Intl.NumberFormat('fa-IR').format(n || 0); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var KIND = { warranty: 'گارانتی', coverage: 'پوشش سه‌ساله', brake: 'لنت', club: 'عضویت باشگاه', tire: 'لاستیک', basket: 'سبد اقتصادی', insurance: 'بیمه', contact: 'پیام تماس' };
  var STATUS = { 'new': 'جدید', in_review: 'در حال بررسی', approved: 'تأیید شده', rejected: 'رد شده', done: 'انجام شد' };
  var st = { stats: null, leads: [], q: '', kind: '', status: '', err: '', busy: false }, box;

  function dtf(d) { try { return new Date(d).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return d; } }
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
  function filtered() {
    var q = st.q.trim().toLowerCase();
    return st.leads.filter(function (l) {
      return (!st.kind || l.kind === st.kind) && (!st.status || l.status === st.status) &&
        (!q || [l.name, l.phone, l.tracking_code, l.city].join(' ').toLowerCase().indexOf(q) >= 0);
    });
  }
  function view() {
    if (!S || !S.configured) return '<div class="notice warn"><b>Supabase هنوز متصل نیست.</b> آدرس پروژه و کلید anon در تنظیمات ساخت (SUPABASE_URL و SUPABASE_ANON_KEY) وارد نشده است؛ بنابراین هیچ آمار واقعی‌ای نمایش داده نمی‌شود. راهنما: docs/SUPABASE_SETUP.md</div>';
    if (!S.session()) return '<form class="mini" data-live="login" style="max-width:420px"><h2>ورود مدیر</h2><input name="email" type="email" placeholder="ایمیل مدیر" dir="ltr" autocomplete="username" required><input name="password" type="password" placeholder="رمز عبور" dir="ltr" autocomplete="current-password" required><button class="btn">ورود</button><div id="live-msg" role="status">' + (st.err ? '<div class="result bad">' + esc(st.err) + '</div>' : '') + '</div></form>';
    var s = st.stats; if (!s) return '<p class="hint">در حال دریافت آمار…</p>' + (st.err ? '<div class="result bad">' + esc(st.err) + '</div>' : '');
    var k = s.by_kind || {}, bs = s.by_status || {}, mo = (s.monthly || []).slice(-1)[0] || { views: 0, visitors: 0 };
    var tiles = [['بازدیدکنندهٔ امروز', s.today.visitors], ['بازدید امروز', s.today.views], ['بازدیدکنندهٔ ماه جاری', mo.visitors], ['بازدید ماه جاری', mo.views],
      ['گارانتی ثبت‌شده', k.warranty || 0], ['درخواست عضویت', s.members_requested], ['عضو تأییدشده', s.members_approved],
      ['درخواست خدمات (لنت و پوشش)', (k.brake || 0) + (k.coverage || 0)], ['درخواست لاستیک', k.tire || 0], ['در انتظار بررسی', Object.keys(bs).reduce(function (a, x) { return a + (/\/new$/.test(x) ? bs[x] : 0); }, 0)]];
    var list = filtered();
    return '<div class="row" style="justify-content:space-between"><span class="muted">وارد شده: ' + esc((S.session() || {}).email) + '</span><span><button class="btn tiny ghost" data-live="refresh">بروزرسانی</button> <button class="btn tiny ghost" data-live="logout">خروج</button></span></div>' +
      '<div id="live-msg" role="status">' + (st.err ? '<div class="result bad">' + esc(st.err) + '</div>' : '') + '</div>' +
      '<div class="tiles">' + tiles.map(function (t) { return '<div class="tile"><b>' + fa(t[1]) + '</b><span>' + t[0] + '</span></div>'; }).join('') + '</div>' +
      '<div class="admin-sec"><h2>عملکرد روزانه (۳۰ روز اخیر)</h2><p class="hint"><i class="sw s1"></i> بازدید <i class="sw s2"></i> بازدیدکنندهٔ متمایز — بر پایهٔ شناسهٔ ناشناس مرورگر؛ جدا از اطلاعات مشتریان</p>' + bars(s.daily || [], 'views', function (r) { return r.day.slice(5); }, 'visitors') + '</div>' +
      '<div class="admin-sec"><h2>عملکرد ماهانه (۱۲ ماه)</h2>' + bars(s.monthly || [], 'views', function (r) { return r.month; }, 'visitors') + '</div>' +
      '<div class="admin-sec"><h2>مشتریان و درخواست‌ها (' + fa(list.length) + ' از ' + fa(st.leads.length) + ')</h2>' +
      '<div class="mini"><input data-live="q" placeholder="جست‌وجو: نام، موبایل، کد رهگیری، شهر" value="' + esc(st.q) + '">' +
      '<select data-live="kind"><option value="">همهٔ انواع</option>' + Object.keys(KIND).map(function (x) { return '<option value="' + x + '"' + (st.kind === x ? ' selected' : '') + '>' + KIND[x] + '</option>'; }).join('') + '</select>' +
      '<select data-live="status"><option value="">همهٔ وضعیت‌ها</option>' + Object.keys(STATUS).map(function (x) { return '<option value="' + x + '"' + (st.status === x ? ' selected' : '') + '>' + STATUS[x] + '</option>'; }).join('') + '</select>' +
      '<button class="btn tiny" data-live="csv">خروجی CSV (باز شدن در Excel)</button></div>' +
      (list.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>زمان</th><th>نوع</th><th>کد</th><th>نام</th><th>موبایل</th><th>شهر</th><th>وضعیت</th><th>اقدام</th></tr></thead><tbody>' + list.slice(0, 300).map(row).join('') + '</tbody></table></div>' + (list.length > 300 ? '<p class="hint">۳۰۰ ردیف اول نمایش داده شد؛ فیلتر کنید یا CSV بگیرید.</p>' : '') : '<p class="muted">موردی یافت نشد.</p>') + '</div>';
  }
  function row(l) {
    var act = (l.status === 'new' || l.status === 'in_review') ? '<div class="mini"><button class="btn tiny" data-live="ok" data-id="' + l.id + '">تأیید</button><input data-why="' + l.id + '" placeholder="دلیل رد"><button class="btn tiny ghost" data-live="no" data-id="' + l.id + '">رد</button></div>' : (l.status === 'rejected' && l.decision_reason ? '<small>' + esc(l.decision_reason) + '</small>' : '');
    return '<tr><td>' + dtf(l.created_at) + '</td><td>' + (KIND[l.kind] || esc(l.kind)) + '</td><td><span class="code">' + esc(l.tracking_code) + '</span></td><td>' + esc(l.name) + '</td><td dir="ltr">' + esc(l.phone) + '</td><td>' + esc(l.city) + '</td><td>' + (STATUS[l.status] || esc(l.status)) + '</td><td>' + act + '</td></tr>';
  }
  function csvCell(v) { v = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }
  function csv() {
    var rows = [['زمان', 'نوع', 'کد رهگیری', 'نام', 'موبایل', 'شهر', 'وضعیت', 'دلیل رد', 'رضایت', 'جزئیات']].concat(filtered().map(function (l) { return [l.created_at, KIND[l.kind] || l.kind, l.tracking_code, l.name, l.phone, l.city, STATUS[l.status] || l.status, l.decision_reason, l.consent_marketing ? 'بله' : 'خیر', JSON.stringify(l.payload || {})]; }));
    var blob = new Blob(['\ufeff' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'gmw-leads-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function paint() { if (box) { var f = document.activeElement, kid = f && f.getAttribute && f.getAttribute('data-live'), pos = f && f.selectionStart; box.innerHTML = view(); if (kid === 'q') { var n = box.querySelector('[data-live="q"]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } } } }
  function load() {
    if (!S || !S.configured || !S.session()) { paint(); return; }
    st.err = ''; Promise.all([S.rpc('admin_stats', { p_days: 30 }), S.select('leads', 'select=id,created_at,kind,tracking_code,status,name,phone,city,payload,consent_marketing,decision_reason&order=created_at.desc&limit=5000')])
      .then(function (r) { st.stats = r[0]; st.leads = r[1] || []; paint(); }, function (e) { st.err = /forbidden|42501|permission/i.test(e.message) ? 'این حساب مدیر نیست (در admin_users ثبت نشده).' : e.message; if (/نشست/.test(e.message)) st.stats = null; paint(); });
  }
  function decide(id, status, reason) {
    S.rpc('decide_lead', { p_id: id, p_status: status, p_reason: reason || null }).then(load, function (e) { st.err = e.message === 'reason required' ? 'دلیل رد الزامی است.' : e.message; paint(); });
  }
  window.GMWLive = { mount: function (el) {
    box = el; paint(); if (S && S.session() && !st.stats) load();
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-live]'); if (!b) return; var a = b.getAttribute('data-live'), id = b.getAttribute('data-id');
      if (a === 'refresh') load(); else if (a === 'logout') { S.signOut(); st.stats = null; st.leads = []; paint(); } else if (a === 'csv') csv();
      else if (a === 'ok') decide(id, 'approved'); else if (a === 'no') { var i = el.querySelector('[data-why="' + id + '"]'); decide(id, 'rejected', i && i.value); }
    });
    el.addEventListener('input', function (e) { var t = e.target.getAttribute('data-live'); if (t === 'q') { st.q = e.target.value; paint(); } });
    el.addEventListener('change', function (e) { var t = e.target.getAttribute('data-live'); if (t === 'kind' || t === 'status') { st[t] = e.target.value; paint(); } });
    el.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-live="login"]'); if (!f) return; e.preventDefault(); st.err = '';
      S.signIn(f.elements.email.value.trim(), f.elements.password.value).then(function () { f.elements.password.value = ''; load(); }, function () { st.err = 'ورود انجام نشد؛ ایمیل یا رمز را بررسی کنید.'; paint(); });
    });
  } };
})();
