/* GMW supa.js — کلاینت بسیار سبک Supabase (بدون کتابخانه؛ فقط fetch).
   عمومی: rpc با کلید anon (فقط submit_lead و track_visit مجازند). مدیر: ورود با ایمیل/رمز Supabase Auth؛ نشست فقط در sessionStorage. */
(function () {
  'use strict';
  var CFG = (window.GMW_CONFIG || {}).supabase || {}, URL = (CFG.url || '').replace(/\/+$/, ''), KEY = CFG.anonKey || '', SK = 'gmw_sb_session';
  var S = { configured: !!(URL && KEY) };
  function ss() { try { return JSON.parse(sessionStorage.getItem(SK)); } catch (e) { return null; } }
  function setSs(v) { try { if (v) sessionStorage.setItem(SK, JSON.stringify(v)); else sessionStorage.removeItem(SK); } catch (e) {} }
  /* کلید جدید (sb_publishable_…) JWT نیست و فقط در هدر apikey فرستاده می‌شود؛ کلید قدیمی anon (JWT) در هر دو هدر. */
  function hdr(token, extra) { var h = { apikey: KEY, 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token; else if (KEY.indexOf('sb_') !== 0) h.Authorization = 'Bearer ' + KEY; for (var k in extra) h[k] = extra[k]; return h; }
  function j(r) { return r.text().then(function (t) { var d; try { d = t ? JSON.parse(t) : null; } catch (e) { d = { message: t }; } if (!r.ok) { var m = (d && (d.message || d.msg || d.error_description || d.error)) || ('HTTP ' + r.status); var er = new Error(m); er.status = r.status; throw er; } return d; }); }
  S.session = function () { var s = ss(); return s && s.exp > Date.now() / 1000 ? s : null; };
  S.signIn = function (email, password) {
    return fetch(URL + '/auth/v1/token?grant_type=password', { method: 'POST', headers: hdr(), body: JSON.stringify({ email: email, password: password }) }).then(j).then(function (d) {
      var s = { token: d.access_token, refresh: d.refresh_token, exp: Math.floor(Date.now() / 1000) + (d.expires_in || 3600) - 30, email: d.user && d.user.email }; setSs(s); return s;
    });
  };
  S.signOut = function () { setSs(null); };
  function authed() {
    var s = ss(); if (!s) return Promise.reject(new Error('نشست پایان یافته؛ دوباره وارد شوید.'));
    if (s.exp > Date.now() / 1000) return Promise.resolve(s.token);
    return fetch(URL + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: hdr(), body: JSON.stringify({ refresh_token: s.refresh }) }).then(j).then(function (d) {
      var n = { token: d.access_token, refresh: d.refresh_token, exp: Math.floor(Date.now() / 1000) + (d.expires_in || 3600) - 30, email: s.email }; setSs(n); return n.token;
    }, function () { setSs(null); throw new Error('نشست پایان یافته؛ دوباره وارد شوید.'); });
  }
  /* عمومی (anon) */
  S.rpcAnon = function (name, args) { return fetch(URL + '/rest/v1/rpc/' + name, { method: 'POST', headers: hdr(), body: JSON.stringify(args || {}), keepalive: true }).then(j); };
  /* مدیر (authenticated) */
  S.rpc = function (name, args) { return authed().then(function (t) { return fetch(URL + '/rest/v1/rpc/' + name, { method: 'POST', headers: hdr(t), body: JSON.stringify(args || {}) }).then(j); }); };
  S.select = function (table, query) { return authed().then(function (t) { return fetch(URL + '/rest/v1/' + table + '?' + (query || ''), { headers: hdr(t) }).then(j); }); };
  window.GMWSupa = S;
})();
