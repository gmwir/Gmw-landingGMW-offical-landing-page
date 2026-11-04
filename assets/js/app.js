/* GMW app.js — رفتار صفحات عمومی. وضعیت درخواست‌ها روی همین دستگاه (localStorage) نگهداری می‌شود. */
(function () {
  'use strict';
  var C = window.GMWCore, KEY = 'gmw_demo_state_v1', SESSION = 'gmw_session_phone';
  var ROOT = document.body.getAttribute('data-root') || '/';
  var PAGE = document.body.getAttribute('data-page');

  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.version === C.STATE_VERSION) return s; } catch (e) {}
    return C.defaultState();
  }
  var CFG0 = window.GMW_CONFIG || {};
  // حالت عمومی: بدون پایگاه کد/مرکز ساختگی. مراکز = دفترهای واقعی GMW، و سایر شهرها با هماهنگی کارشناس.
  function prod(s) {
    s.settings.codeRegistry = false;
    var offices = (CFG0.phones || []).map(function (p, i) { return { id: 'office' + (i + 1), name: p.label + ' GMW', city: p.label.replace('دفتر ', ''), address: 'با هماهنگی کارشناس' }; });
    offices.push({ id: 'other', name: 'سایر شهرها (هماهنگی با کارشناس)', city: 'سایر', address: 'مرکز نصب پس از هماهنگی تعیین می‌شود' });
    s.centers = offices; return s;
  }
  var state = prod(load());
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  window.GMW = { state: function () { return state; }, save: save, reload: function () { state = prod(load()); return state; }, KEY: KEY, SESSION: SESSION, root: ROOT };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fa(n) { return new Intl.NumberFormat('fa-IR').format(n); }
  function link(p) { return ROOT === '/' ? p : ROOT + (p === '/' ? 'index.html' : p.slice(1) + 'index.html'); }
  function session() { try { return localStorage.getItem(SESSION) || ''; } catch (e) { return ''; } }
  function setSession(p) { try { if (p) localStorage.setItem(SESSION, p); else localStorage.removeItem(SESSION); } catch (e) {} }

  /* ---------- منو و دکمهٔ ورود ---------- */
  var mb = $('#menu-btn'), nav = $('#nav');
  if (mb) mb.addEventListener('click', function () { var o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o ? 'true' : 'false'); });
  var lb = $('#login-btn');
  if (lb && session()) { var m = state.clubMembers.filter(function (x) { return x.phone === session(); })[0]; if (m) lb.querySelector('span').textContent = m.name; }

  /* ---------- فرم‌ها ---------- */
  function values(f) {
    var o = {};
    $$('input,select,textarea', f).forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        if (el.name === 'categories' || el.name === 'parts') { (o[el.name] = o[el.name] || []); if (el.checked) o[el.name].push(el.value); }
        else o[el.name] = el.checked;
      } else if (el.type === 'file') { o[el.name] = el.files && el.files[0] ? { name: el.files[0].name, size: el.files[0].size, type: el.files[0].type } : null; }
      else o[el.name] = el.value;
    });
    return o;
  }
  function clearErr(f) {
    $$('[data-err]', f).forEach(function (e) { e.textContent = ''; var p = e.closest('.field'); if (p) p.classList.remove('invalid'); });
    var r = $('.result', f); if (r) r.hidden = true;
  }
  function showErr(f, errs) {
    var first = null;
    Object.keys(errs || {}).forEach(function (k) {
      var e = $('[data-err="' + k + '"]', f); if (!e) return;
      e.textContent = errs[k]; var p = e.closest('.field'); if (p) p.classList.add('invalid');
      if (!first) first = e;
    });
    if (first) { var inp = first.closest('.field, fieldset, .panel'); if (inp && inp.scrollIntoView) inp.scrollIntoView({ block: 'center' }); }
  }
  function say(f, ok, html) { var r = $('.result', f); if (!r) return; r.className = 'result ' + (ok ? 'ok' : 'bad'); r.innerHTML = html; r.hidden = false; }
  function bind(id, fn) {
    var f = document.getElementById(id); if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault(); clearErr(f); var v = values(f), r = fn(v, f);
      if (r && r.errors) showErr(f, r.errors);
      else if (r && r.ok && r.record && DELIVER[id]) handoff(f, id, v, r.record.trackingCode);
    });
  }

  /* ---------- تحویل درخواست به تیم GMW ----------
     سایت سرور ندارد؛ پس: (۱) اگر آدرس دریافت (endpoint) در تنظیمات باشد درخواست همان‌جا ارسال می‌شود؛
     (۲) در غیر این صورت کاربر راهنمایی می‌شود کد رهگیری و متن درخواست را با تلفن پشتیبانی اعلام کند. */
  var CFG = window.GMW_CONFIG || {}, DELIVER = { 'warranty-form': 'فعال‌سازی گارانتی', 'coverage-form': 'طرح پوشش سه‌ساله', 'brake-form': 'تعویض لنت', 'club-join': 'عضویت باشگاه',
    'tire-form': 'ثبت‌نام لاستیک', 'basket-form': 'سبد اقتصادی', 'insurance-form': 'تخفیف بیمه', 'contact-form': 'پیام تماس' };
  var SKIP = { acceptTerms: 1, consentNotify: 1, consentMarketing: 1, consent: 1 };
  function summary(f, id, v, tracking) {
    var lines = ['درخواست: ' + DELIVER[id], 'کد رهگیری: ' + tracking];
    Object.keys(v).forEach(function (k) {
      var val = v[k]; if (SKIP[k] || val == null || val === '' || val === false) return;
      var el = f.querySelector('[name="' + k + '"]'), fld = el && el.closest('.field'), lab = fld && fld.querySelector('label');
      var label = lab ? lab.textContent.replace(/\(اختیاری\)/, '').replace(/[*:]/g, '').trim() : k;
      if (Array.isArray(val)) val = val.join('، '); else if (typeof val === 'object') val = val.name || '';
      if (val === true) val = 'بله'; if (val) lines.push(label + ': ' + val);
    });
    return lines.join('\n');
  }
  function handoff(f, id, v, tracking) {
    var r = $('.result', f); if (!r) return; var text = summary(f, id, v, tracking), box = document.createElement('div'); box.className = 'handoff'; r.appendChild(box);
    var phones = (CFG.phones || []).map(function (p) { return '<a class="btn tiny ghost" href="tel:' + esc(p.tel) + '">' + esc(p.label) + ' ' + esc(p.display) + '</a>'; }).join(' ');
    function manual() {
      box.innerHTML = '<p><b>برای ثبت نهایی و هماهنگی،</b> کد رهگیری بالا را به پشتیبانی GMW اعلام کنید:</p><div class="row">' + phones + ' <button type="button" class="btn tiny" data-copy>کپی متن درخواست</button></div>';
      var b = box.querySelector('[data-copy]'); if (b) b.addEventListener('click', function () { try { navigator.clipboard.writeText(text).then(function () { b.textContent = 'کپی شد'; }); } catch (e) { b.textContent = 'کپی ممکن نشد'; } });
    }
    /* نسخهٔ پشتیبان در Google Sheet (اختیاری): فقط اگر endpoint تنظیم شده باشد؛ شکست آن مشتری را متأثر نمی‌کند. */
    function post() { return fetch(CFG.endpoint, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ kind: id, tracking: tracking, text: text, data: v, at: new Date().toISOString(), page: location.pathname }) }); }
    function mirror() { if (CFG.endpoint) { try { post().catch(function () {}); } catch (e) {} } }
    var SB = window.GMWSupa;
    if (SB && SB.configured) {   // Supabase: فقط از تابع submit_lead؛ جدول‌ها برای عموم بسته‌اند
      var KIND = { 'warranty-form': 'warranty', 'coverage-form': 'coverage', 'brake-form': 'brake', 'club-join': 'club', 'tire-form': 'tire', 'basket-form': 'basket', 'insurance-form': 'insurance', 'contact-form': 'contact' };
      var pl = {}; Object.keys(v).forEach(function (k) { var x = v[k]; if (k === 'acceptTerms' || k === 'name' || k === 'phone' || k === 'city' || x == null || x === '' || x === false) return; pl[k] = (x && typeof x === 'object' && !Array.isArray(x)) ? (x.name || '') : x; });
      box.innerHTML = '<p class="hint">در حال ثبت درخواست…</p>';
      SB.rpcAnon('submit_lead', { p_kind: KIND[id], p_tracking: tracking, p_name: v.name || '', p_phone: C.normalizePhone(v.phone || ''), p_city: v.city || '', p_payload: pl, p_consent: !!(v.consentMarketing || v.consentNotify || v.consent), p_page: location.pathname })
        .then(function () { mirror(); box.innerHTML = '<p><b>درخواست شما ثبت شد.</b> کارشناسان با شمارهٔ ثبت‌شده تماس می‌گیرند. در صورت نیاز: ' + phones + '</p>'; }, manual);
      return;
    }
    if (!CFG.endpoint) { manual(); return; }
    box.innerHTML = '<p class="hint">در حال ارسال درخواست برای تیم GMW…</p>';
    try {
      post()
        .then(function () { box.innerHTML = '<p><b>درخواست برای تیم GMW ارسال شد.</b> کارشناسان با شمارهٔ ثبت‌شده تماس می‌گیرند. در صورت نیاز: ' + phones + '</p>'; }, manual);
    } catch (e) { manual(); }
  }
  function trk(code) { return '<span class="code">' + esc(code) + '</span>'; }
  function fixErrors(f, res, fallback) { if (res.errors) showErr(f, res.errors); say(f, false, esc(res.error || fallback || 'لطفاً خطاهای فرم را اصلاح کنید.')); }

  /* ---------- گارانتی ---------- */
  bind('warranty-form', function (v, f) {
    var res = C.registerWarranty(state, v);
    if (!res.ok) { fixErrors(f, res); return res; }
    save(); f.reset();
    say(f, true, 'ثبت شد. کد رهگیری شما: ' + trk(res.record.trackingCode) + '<br>وضعیت: <b>' + esc(res.statusLabel) + '</b><br><small>کد را نگه دارید؛ برای استعلام و اتصال به باشگاه لازم است.</small>');
    return res;
  });
  bind('warranty-lookup', function (v, f) {
    var r = C.lookupWarranty(state, v.q);
    if (!r) { say(f, false, 'موردی با این کد یا سریال پیدا نشد.'); return; }
    say(f, true, 'قطعه: <b>' + esc(r.partName) + '</b> (' + esc(r.brand) + ')<br>تاریخ خرید: ' + C.formatDate(r.purchaseDate) + '<br>وضعیت: <b>' + esc(r.statusLabel) + '</b>');
  });

  /* ---------- طرح سه‌ساله ---------- */
  function timeline(r) {
    
    var steps = C.COVERAGE_STEPS, idx = steps.indexOf(r.status), items = '';
    if (r.status === 'rejected') {
      var rf = refundState(r);
      return '<ul class="timeline"><li class="done">درخواست ثبت شد</li><li class="bad now">تأیید نشد — ' + esc(r.decisionReason) + '</li>' + (rf ? '<li>بازپرداخت کامل وجه ' + (rf === 'refunded' ? '(انجام شد)' : '(در صف پردازش)') + '</li>' : '') + '</ul>';
    }
    steps.forEach(function (s, i) { items += '<li class="' + (i < idx ? 'done' : i === idx ? 'done now' : '') + '">' + esc(C.COVERAGE_STATUS[s]) + '</li>'; });
    return '<ul class="timeline">' + items + '</ul>';
  }
  function refundState(r) { if (r.refundStatus !== undefined) return r.refundStatus; var rf = state.refunds.filter(function (x) { return x.requestId === r.id; })[0]; return rf ? rf.status : ''; }

  function initCoverage() {
    var box = $('#parts'); if (!box) return;
    var groups = {};
    state.parts.filter(function (p) { return p.active; }).forEach(function (p) { (groups[p.group] = groups[p.group] || []).push(p); });
    box.innerHTML = Object.keys(groups).map(function (g) {
      return '<div class="parts-group"><h3>' + esc(g) + '</h3>' + groups[g].map(function (p) {
        return '<label class="part"><input type="checkbox" name="parts" value="' + p.id + '"><span>' + esc(p.name) + '</span><b>' + C.formatToman(p.price) + '</b></label>';
      }).join('') + '</div>';
    }).join('');
    var form = $('#coverage-form');
    function recalc() {
      var ids = $$('input[name=parts]:checked', form).map(function (i) { return i.value; });
      var p = C.calcCoveragePrice(state, ids);
      $('#total-amount').textContent = ids.length ? C.formatToman(p.total) : '—';
      $('#total-bar-amount').textContent = ids.length ? C.formatToman(p.total) : '—';
      $('#sel-count').textContent = fa(p.items.length);
      $('#total-bar').hidden = !ids.length;
      var n = []; if (state.settings.coverage.multiplier !== 1) n.push('ضریب مدیریتی: ' + state.settings.coverage.multiplier);
      if (p.capApplied) n.push('سقف مبلغ اعمال شد'); $('#total-note').textContent = n.join(' — ') || 'مبالغ برآورد اولیه‌اند و مبلغ نهایی پس از تأیید اصالت خودرو اعلام می‌شود.';
    }
    form.addEventListener('change', recalc); recalc();
    bind('coverage-form', function (v, f) {
      var res = C.createCoverageRequest(state, { parts: v.parts, acceptTerms: v.acceptTerms,
        owner: { name: v.name, phone: v.phone, city: v.city, address: v.address, model: v.model, year: v.year, mileage: v.mileage, accident: v.accident, repairs: v.repairs, notes: v.notes } });
      if (!res.ok) { fixErrors(f, res); return res; }
      save();
      say(f, true, 'درخواست شما ثبت شد؛ هیچ مبلغی دریافت نشد.<br>کد رهگیری: ' + trk(res.record.trackingCode));
      $('#coverage-result').innerHTML = '<div class="panel"><h2>وضعیت درخواست</h2>' + timeline(res.record) + '<p class="hint">مرحلهٔ بعد: معرفی استادکار یا کارشناس در شهر ' + esc(res.record.owner.city) + ' و معاینهٔ خودرو. پرداخت پس از تأیید اصالت خودرو و با هماهنگی کارشناس انجام می‌شود.</p></div>';
      f.reset(); recalc(); return res;
    });
    bind('coverage-track', function (v, f) {
      var r = C.coverageStatusView(state, v.q);
      if (!r) { say(f, false, 'درخواستی با این کد پیدا نشد.'); return; }
      say(f, true, 'وضعیت: <b>' + esc(r.statusLabel) + '</b>' + (r.technicianName ? '<br>استادکار/کارشناس: ' + esc(r.technicianName) : '') + timeline(r) +
        (r.status === 'active' ? '<small>دورهٔ پوشش: ' + C.formatDate(r.startDate) + ' تا ' + C.formatDate(r.endDate) + '</small>' : ''));
    });
  }

  /* ---------- لنت ---------- */
  function initBrake() {
    var cfg = state.settings.brake;
    var pr = $('#brake-prices'); if (!pr) return;
    pr.innerHTML = cfg.classes.map(function (c) { return '<div class="price-row"><span>' + esc(c.label) + '</span><b>' + C.formatToman(c.padPrice) + '</b></div>'; }).join('') + '<p class="hint">قیمت لنت براساس نرخ عمده است و هنگام هماهنگی نصب نهایی می‌شود.</p>';
    $('#brake-labor').innerHTML = '<div class="price-row"><span>اجرت در نوبت‌های مجاز عضو</span><b class="free">' + (cfg.laborMember === 0 ? 'رایگان' : C.formatToman(cfg.laborMember)) + '</b></div>' +
      '<div class="price-row"><span>اجرت عادی (مرجع)</span><s>' + C.formatToman(cfg.laborRegular) + '</s></div><p class="hint">اجرت و قیمت لنت در فاکتور جداگانه درج می‌شوند.</p>';
    var padSel = $('#brake-form [name=padClass]'), cSel = $('#brake-form [name=centerId]'), cityIn = $('#brake-form [name=city]');
    padSel.innerHTML = '<option value="">انتخاب کنید</option>' + cfg.classes.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + ' — ' + C.formatToman(c.padPrice) + '</option>'; }).join('');
    function centers() {
      var city = C.clean(cityIn.value), list = state.centers;
      var near = city ? list.filter(function (c) { return c.city === city; }) : [];
      $('#centers').innerHTML = (near.length ? near : list).map(function (c) { return '<div class="center ' + (near.length ? 'near' : '') + '"><b>' + esc(c.name) + '</b><br>' + esc(c.city) + ' — ' + esc(c.address) + '</div>'; }).join('');
      var keep = cSel.value;
      cSel.innerHTML = '<option value="">انتخاب کنید</option>' + (near.length ? near : list).map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + ' (' + esc(c.city) + ')</option>'; }).join('');
      if (keep && cSel.querySelector('option[value="' + keep + '"]')) cSel.value = keep;
    }
    cityIn.addEventListener('change', centers); cityIn.addEventListener('input', centers); centers();

    function quotaHtml(st) {
      if (!st.enrolled) return 'برای این شماره عضویتی ثبت نشده است. <a href="' + link('/club/') + '">عضویت در باشگاه</a>';
      var h = '<b>سال فعلی دوره: ' + (st.currentYear ? fa(st.currentYear) + ' از ۳' : 'پایان‌یافته') + '</b><table class="qtable"><tr><th>سال</th><th>سهمیه</th><th>استفاده‌شده</th><th>باقی‌مانده</th></tr>' +
        st.table.map(function (r) { return '<tr' + (r.year === st.currentYear ? ' style="font-weight:700"' : '') + '><td>' + fa(r.year) + '</td><td>' + fa(r.quota) + '</td><td>' + fa(r.used) + '</td><td>' + fa(r.remaining) + '</td></tr>'; }).join('') + '</table>';
      var hist = state.brakeHistory.filter(function (x) { return x.phone === st.enrollment.phone; });
      if (hist.length) h += '<p><b>سوابق تعویض:</b></p><ul class="plain">' + hist.map(function (x) { return '<li>' + C.formatDate(x.date) + ' — ' + esc(x.padLabel) + ' — ' + esc(x.vehicle) + ' — ' + esc(x.centerName) + ' (نوبت ' + fa(x.seq) + ' سال ' + fa(x.planYear) + ')</li>'; }).join('') + '</ul>';
      return h;
    }
    bind('brake-quota', function (v, f) {
      if (!C.isValidMobile(v.phone)) { showErr(f, { phone: 'شماره موبایل معتبر نیست' }); return; }
      say(f, true, quotaHtml(C.brakeQuotaStatus(state, v.phone)));
    });
    bind('brake-form', function (v, f) {
      var res = C.createBrakeRequest(state, v);
      if (!res.ok) { fixErrors(f, res); return res; }
      save(); var r = res.record;
      say(f, true, 'درخواست ثبت شد. کد رهگیری: ' + trk(r.trackingCode) + '<br>' + esc(r.padLabel) + ' — قیمت لنت: ' + C.formatToman(r.padPrice) + '<br>اجرت نصب: <b>' + (r.laborFee === 0 ? 'رایگان' : C.formatToman(r.laborFee)) + '</b><br>مرکز: ' + esc(r.centerName) + '<br>نوبت‌های باقی‌مانده سال ' + fa(r.planYear) + ': ' + fa(res.remainingAfter));
      return res;
    });
  }

  /* ---------- صندوق شفاف ---------- */

  /* ---------- باشگاه ---------- */
  function initClub() {
    var guest = $('#club-guest'); if (!guest) return;
    function me() { var p = session(); return state.clubMembers.filter(function (x) { return x.phone === p; })[0]; }
    function render() {
      var m = me(); guest.hidden = !!m; $('#club-member').hidden = !m; if (!m) return;
      $('#m-name').textContent = 'سلام ' + m.name;
      $('#m-vehicles').innerHTML = m.vehicles.length ? m.vehicles.map(function (v) { return '<li>' + esc(v.model) + (v.year ? ' — ' + fa(v.year) : '') + '</li>'; }).join('') : '<li class="muted">هنوز خودرویی ثبت نشده</li>';
      $('#m-linked').innerHTML = m.linkedCodes.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');
      var h = C.memberHistory(state, m.phone), out = '';
      h.warranties.forEach(function (w) { out += '<li>گارانتی ' + esc(w.partName) + ' — ' + esc(C.WARRANTY_STATUS[w.status]) + ' (' + esc(w.trackingCode) + ')</li>'; });
      h.coverage.forEach(function (c) { out += '<li>طرح سه‌ساله — ' + esc(C.COVERAGE_STATUS[c.status]) + ' (' + esc(c.trackingCode) + ')</li>'; });
      h.brake.forEach(function (b) { out += '<li>تعویض لنت — ' + C.formatDate(b.date) + ' — ' + esc(b.centerName) + '</li>'; });
      $('#m-history').innerHTML = out ? '<ul class="plain">' + out + '</ul>' : '<p class="muted">هنوز سابقه‌ای ثبت نشده.</p>';
      var q = C.brakeQuotaStatus(state, m.phone);
      $('#m-quota').innerHTML = q.enrolled && q.current ? 'سال ' + fa(q.currentYear) + ': ' + fa(q.current.remaining) + ' نوبت از ' + fa(q.current.quota) + ' باقی است. <a href="' + link('/brake-service/') + '">درخواست تعویض لنت</a>' : '<span class="muted">سهمیهٔ فعالی وجود ندارد.</span>';
    }
    bind('club-join', function (v, f) {
      var res = C.joinClub(state, v); if (!res.ok) { fixErrors(f, res); return res; }
      save(); setSession(res.member.phone); render(); return res;
    });
    bind('club-login', function (v, f) {
      var p = C.normalizePhone(v.phone), m = state.clubMembers.filter(function (x) { return x.phone === p; })[0];
      if (!C.isValidMobile(p)) { showErr(f, { phone: 'شماره موبایل معتبر نیست' }); return; }
      if (!m) { say(f, false, 'با این شماره عضویتی پیدا نشد. ابتدا عضو شوید.'); return; }
      setSession(p); render();
    });
    bind('club-vehicle', function (v, f) {
      if (!C.clean(v.vehicleModel)) { showErr(f, { vehicleModel: 'مدل خودرو را وارد کنید' }); return; }
      var m = me(); m.vehicles.push({ model: C.clean(v.vehicleModel), year: parseInt(C.normalizeDigits(v.vehicleYear), 10) || null }); save(); f.reset(); render();
    });
    bind('club-link', function (v, f) {
      var res = C.linkWarrantyToMember(state, session(), v.code);
      if (!res.ok) { say(f, false, esc(res.error)); return; }
      save(); say(f, true, 'گارانتی ' + esc(res.warranty.partName) + ' به حساب شما متصل شد.'); render();
    });
    bind('club-service', function (v, f) {
      var m = me(), res = C.addSimple(state, 'contact', { name: m.name, phone: m.phone, subject: 'درخواست خدمت: ' + v.type, message: v.message || '' });
      if (!res.ok) { fixErrors(f, res); return res; }
      save(); say(f, true, 'درخواست ثبت شد. کد رهگیری: ' + trk(res.record.trackingCode)); f.reset();
    });
    $('#m-logout').addEventListener('click', function () { setSession(''); render(); });
    render();
  }

  /* ---------- فرم‌های ساده ---------- */
  function simple(id, kind, okText, pre) {
    bind(id, function (v, f) {
      if (pre) v = pre(v);
      var res = C.addSimple(state, kind, v);
      if (!res.ok) { fixErrors(f, res); return res; }
      save(); f.reset(); say(f, true, okText + '<br>کد رهگیری: ' + trk(res.record.trackingCode)); return res;
    });
  }
  simple('tire-form', 'tire', 'درخواست شما ثبت شد. این ثبت‌نام وعدهٔ فروش یا تحویل نیست؛ در صورت فراهم‌شدن امکان اطلاع می‌دهیم.');
  simple('basket-form', 'basket', 'علاقه‌مندی شما ثبت شد؛ پس از آماده‌شدن سبد مناسب اطلاع می‌دهیم.');
  simple('insurance-form', 'insurance', 'درخواست ثبت شد. تا زمان برقراری همکاری رسمی، تخفیفی تضمین نمی‌شود.');
  simple('contact-form', 'contact', 'پیام شما ثبت شد.');

  /* ---------- مهندس خودرو ---------- */
  bind('ai-form', function (v, f) {
    if (C.clean(v.symptoms).length < 8) { showErr(f, { symptoms: 'علائم را کمی کامل‌تر بنویسید' }); return; }
    window.GMWAI.diagnose(v.symptoms, { model: v.model }).then(function (r) {
      var li = function (a) { return a.length ? '<ul>' + a.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="muted">—</p>'; };
      $('#ai-result').innerHTML = '<div class="panel"><div class="notice ' + (r.urgency === 'critical' || r.urgency === 'high' ? 'warn' : 'info') + '"><b>میزان فوریت:</b> ' + esc(r.urgencyLabel) + '</div>' +
        (r.matched ? '<h3>موضوع‌های نزدیک</h3>' + li(r.topics) + '<h3>علت‌های احتمالی</h3>' + li(r.causes) + '<h3>قطعات نیازمند بررسی</h3>' + li(r.parts) : '') +
        '<h3>سؤالات تکمیلی</h3>' + li(r.questions) + '<h3>پیشنهاد</h3><p>' + esc(r.visitAdvice) + '</p><p class="hint">' + esc(r.disclaimer) + '</p></div>';
      $('#ai-result').scrollIntoView({ block: 'start' });
    });
  });

  initCoverage(); initBrake(); initClub();
  save();
})();
