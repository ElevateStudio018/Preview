/* Anonymous visitor statistics for the admin: which pages are read, for how long, where visitors come
   from and what they do (form, booking, chat). After a yes to Statistik a random visit id is
   kept in the tab until it closes (sessionStorage), so one visit is one visit; no screen size or time zone is sent. The server stores country and city from the request, never the IP address. */
/* Only counted when the visitor has said yes to "Statistik" in the cookie box. Before an answer, or after a no,
   nothing is sent; a yes given on this page sends the page view then. */
(function () {
  if (/bot|crawl|spider|headless|lighthouse|slurp|preview/i.test(navigator.userAgent) || location.pathname.indexOf('/admin') === 0) return;
  // devices where someone from the team has logged in to the admin are not counted (set by assets/js/admin.js)
  try { if (localStorage.getItem('es.team')) return; } catch (e) { /* storage blocked: counted as a visitor */ }
  // One visit = the pages read in this tab until it is closed. Only after a yes to Statistik is a random visit id kept
  // in the tab (sessionStorage, gone when the tab closes); without it every page would count as its own visit.
  var okNow = function () { try { var c = JSON.parse(localStorage.getItem('elevate.consent.v1') || 'null'); return !!(c && c.statistik); } catch (e) { return false; } };
  var sid = null;
  try { if (okNow()) sid = sessionStorage.getItem('es.sid'); else sessionStorage.removeItem('es.sid'); } catch (e) { /* storage blocked */ }
  if (!sid) sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  var keep = function () { try { if (okNow()) sessionStorage.setItem('es.sid', sid); } catch (e) { /* storage blocked */ } };
  var started = Date.now(), maxScroll = 0, sent = false;
  // Time on the page = active time: the tab is shown and someone has scrolled, clicked, typed or moved within the last
  // two minutes. A tab left open overnight therefore does not count as a visit of many hours (at most 30 minutes).
  var active = 0, lastTick = Date.now(), lastAct = Date.now();
  var tick = function () { var now = Date.now(); if (document.visibilityState === 'visible' && now - lastAct < 120000) active += Math.min(now - lastTick, 5000); lastTick = now; };
  setInterval(tick, 5000);
  ['scroll', 'pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'].forEach(function (n) { addEventListener(n, function () { lastAct = Date.now(); }, { passive: true, capture: true }); });
  document.addEventListener('visibilitychange', function () { tick(); lastAct = Date.now(); });
  var page = location.pathname + (location.search && /utm_|lang=/.test(location.search) ? '' : '');
  var q = new URLSearchParams(location.search);
  var base = { sid: sid, path: location.pathname, title: document.title, ref: document.referrer || '', utm_source: q.get('utm_source') || '', utm_medium: q.get('utm_medium') || '', utm_campaign: q.get('utm_campaign') || '',
    sw: 0, sh: 0, vw: 0, vh: 0, lang: '', tz: '' };
  var ok = function () { try { var c = JSON.parse(localStorage.getItem('elevate.consent.v1') || 'null'); return !!(c && c.statistik); } catch (e) { return false; } };
  var firstSent = false;
  function send(extra) {
    if (!ok()) return;
    keep();
    if (!extra) firstSent = true;
    var body = JSON.stringify(Object.assign({}, base, extra || {}));
    try { if (navigator.sendBeacon) { navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' })); return; } } catch (e) { /* fall through */ }
    try { fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }); } catch (e) { /* nothing to do */ }
  }
  // The first beacon waits for the page to finish loading; the window size is read only when leaving
  var firstTried = false;
  var first = function () { firstTried = true; send(); };
  var later = function () { (window.requestIdleCallback || setTimeout)(first, { timeout: 3000 }); };
  if (document.readyState === 'complete') later(); else addEventListener('load', later);
  // a yes given after the first beacon was held back sends the page view then (the box also fires this on every load)
  document.addEventListener('elevate:consent', function (e) { if (e.detail && e.detail.statistik && firstTried && !firstSent) send(); });
  var ticking = false;
  addEventListener('scroll', function () { if (ticking) return; ticking = true; requestAnimationFrame(function () { ticking = false; var h = document.documentElement.scrollHeight - innerHeight; if (h > 0) maxScroll = Math.max(maxScroll, Math.min(100, Math.round((scrollY / h) * 100))); }); }, { passive: true });
  function leave() { if (sent) return; sent = true; tick(); send({ ev: 'leave', secs: Math.min(1800, Math.round(active / 1000)), scroll: maxScroll }); }
  addEventListener('pagehide', leave);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') leave(); });
  // What visitors do: forms sent, a time booked, the chat opened, a call or mail link tapped
  document.addEventListener('elevate:event', function (e) { var d = e.detail || {}, x = { ev: d.name || 'event', label: d.label || '' }; if (d.title) x.title = d.title; send(x); });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="mailto:"], a[href$="/boka"], a[href="boka"], a[href$="/kontakt"], a[href="kontakt"]');
    if (!a) return;
    var h = a.getAttribute('href');
    send({ ev: /^tel:/.test(h) ? 'call' : /^mailto:/.test(h) ? 'mail' : /boka/.test(h) ? 'cta_boka' : 'cta_kontakt', label: (a.textContent || '').trim().slice(0, 60) });
  }, true);
  // The answer itself is counted once, when it is given, with nothing else: no page, no device, no place.
  // (The box fires elevate:consent on every load too; a fresh answer has a time stamp from the last seconds.)
  document.addEventListener('elevate:consent', function (e) {
    var c = e.detail || {}; if (!c.t || Date.now() - c.t > 3000) return;
    var body = JSON.stringify({ sid: Math.random().toString(36).slice(2, 12), path: '/samtycke', ev: 'consent', label: c.statistik ? 'ja' : 'nej' });
    try { if (navigator.sendBeacon) { navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' })); return; } } catch (x) { /* fall through */ }
    try { fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }); } catch (x) { /* nothing to do */ }
  });
  var ev = function (name, label, title) { document.dispatchEvent(new CustomEvent('elevate:event', { detail: { name: name, label: label || '', title: title || '' } })); };
  window.elevateTrack = ev;
})();
