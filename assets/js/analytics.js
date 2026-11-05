/* GMW analytics.js — شمارش بازدید ناشناس (Supabase) + GA4 و Microsoft Clarity با رضایت کاربر.
   جداسازی: هیچ نام/تلفن/ایمیل به سامانه‌های آماری ارسال نمی‌شود؛ فرم‌ها برای Clarity ماسک می‌شوند.
   بدون شناسهٔ GA4/Clarity/Supabase در تنظیمات، این فایل هیچ کاری نمی‌کند. */
(function () {
  'use strict';
  var CFG = window.GMW_CONFIG || {}, AN = CFG.analytics || {}, S = window.GMWSupa;
  var CK = 'gmw_consent', VK = 'gmw_vid';
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  function uuid() { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); var a = new Uint8Array(16); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; }); a[6] = (a[6] & 15) | 64; a[8] = (a[8] & 63) | 128; var h = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); return h.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5'); }

  /* ۱) بازدید ناشناس اول‌شخص (فقط شناسهٔ تصادفی مرورگر، بدون IP/نام/تلفن) */
  /* دقت آمار: ربات‌ها و دستگاه‌های مدیر شمرده نمی‌شوند. با باز کردن «?gmw-ignore=1» یک بار، این دستگاه برای همیشه از آمار کنار می‌رود («?gmw-ignore=0» برای برگشت). */
  try { var q = new URLSearchParams(location.search).get('gmw-ignore'); if (q === '1') set('gmw_ignore', '1'); else if (q === '0') { localStorage.removeItem('gmw_ignore'); } } catch (e) {}
  var ignore = get('gmw_ignore') === '1';
  var bot = navigator.webdriver === true || /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|python|curl|wget/i.test(navigator.userAgent || '');
  var counted = !dnt && !ignore && !bot && location.pathname.indexOf('/admin') !== 0;
  /* آمار بدون کوکی Vercel (بازدیدکنندهٔ متمایز، منبع ورود، کشور، دستگاه) — پس از فعال‌سازی در داشبورد Vercel */
  if (counted) { window.va = window.va || function () { (window.va.q = window.va.q || []).push(arguments); }; var vs = document.createElement('script'); vs.defer = true; vs.src = '/_vercel/insights/script.js'; document.head.appendChild(vs); }
  if (S && S.configured && counted) {
    var vid = get(VK); if (!vid) { vid = uuid(); set(VK, vid); }
    var ref = ''; try { if (document.referrer) { var h = new URL(document.referrer).hostname; if (h !== location.hostname) ref = h; } } catch (e) {}
    var w = window.innerWidth, dev = w < 700 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop';
    S.rpcAnon('track_visit', { p_visitor: vid, p_page: location.pathname.slice(0, 200), p_referrer: ref, p_device: dev }).catch(function () {});
  }

  /* ۲) GA4 و Clarity — فقط با رضایت */
  if (!(AN.ga4 || AN.clarity) || dnt) return;
  function load() {
    document.querySelectorAll('form').forEach(function (f) { f.setAttribute('data-clarity-mask', 'True'); });
    if (AN.ga4 && /^G-[A-Z0-9]+$/.test(AN.ga4)) {
      window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
      gtag('js', new Date()); gtag('config', AN.ga4, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
      var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + AN.ga4; document.head.appendChild(s);
    }
    if (AN.clarity && /^[a-z0-9]+$/i.test(AN.clarity)) {
      (function (c, l, a, r, i, t, y) { c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); }; t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i; y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y); })(window, document, 'clarity', 'script', AN.clarity);
    }
  }
  var c = get(CK);
  if (c === 'all') { load(); return; }
  if (c === 'essential') return;
  var b = document.createElement('div'); b.className = 'consent'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'حریم خصوصی');
  b.innerHTML = '<p>برای بهبود سایت از آمار بازدید ناشناس استفاده می‌کنیم. اطلاعات فرم‌ها هرگز به ابزار آماری نمی‌رود. <a href="/privacy/">جزئیات</a></p><div class="row"><button type="button" class="btn tiny" data-c="all">می‌پذیرم</button><button type="button" class="btn tiny ghost" data-c="essential">فقط موارد ضروری</button></div>';
  b.addEventListener('click', function (e) { var t = e.target.closest('[data-c]'); if (!t) return; set(CK, t.getAttribute('data-c')); b.remove(); if (t.getAttribute('data-c') === 'all') load(); });
  document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(b); });
  if (document.readyState !== 'loading') document.body.appendChild(b);
})();
