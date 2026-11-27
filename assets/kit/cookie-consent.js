/* Elevate cookie consent. Step 1: a short question (Neka alla / Godkänn alla / Anpassa). Step 2: categories that fold
   out with more information. One file, no dependencies.
   Use on a site:
     <script src="cookie-consent.js" data-company="Företaget AB" data-policy="/cookies" data-privacy="/integritet" data-logo="/logga.svg" defer></script>
   Optional: data-intro="…" replaces the first paragraph; data-hide="marknadsforing" leaves a category out. Optional per category: data-statistik="Google Analytics, sparas i upp till 13 månader" (also data-installningar, data-marknadsforing).
   Scripts that need consent are written as
     <script type="text/plain" data-cookie="statistik" src="..."></script>   (statistik | installningar | marknadsforing)
   and only run once the visitor has said yes. A link with data-cookie-settings reopens the dialog.
   Also updates Google Consent Mode v2 if gtag is on the page. */
(function () {
  var me = document.currentScript || {}, d = me.dataset || {};
  // data-hide="marknadsforing" leaves out categories the site has no use for
  var hide = (d.hide || '').split(',').map(function (x) { return x.trim(); });
  var KEY = 'elevate.consent.v1', CATS = ['statistik', 'installningar', 'marknadsforing'].filter(function (k) { return hide.indexOf(k) < 0; });
  var company = d.company || 'Företaget', policy = d.policy || '#', privacy = d.privacy || '#', logo = d.logo || '';
  var esc = function (s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var MARK = '<svg viewBox="0 0 1884.3 1353.9" aria-hidden="true"><path d="M0 1353.9 L1218.7 0 L1218.7 329.1 L479.7 1136.4 L786.7 1132.4 L1215.5 687.4 L1884.3 1349.9 L1590.1 1349.9 L1218.6 994.7 L865.4 1349.9Z" fill="currentColor"/></svg>';
  var logoHtml = function (light) { return logo === 'elevate' ? MARK : logo ? '<img src="' + esc(logo) + '" alt="">' : ''; };
  var rows = [
    ['nodvandiga', 'Nödvändiga', 'Krävs för att sidan ska fungera. Kan inte stängas av.', 'Till exempel formulär, säkerhet och att ditt cookieval sparas. Dessa sätts alltid.'],
    ['statistik', 'Statistik', 'Anonym statistik som gör sidan bättre.', d.statistik || 'Visar vilka sidor som besöks och hur länge. Uppgifterna används bara för att förbättra sidan.'],
    ['installningar', 'Inställningar', 'Kommer ihåg dina val, till exempel språk.', d.installningar || 'Sparar sådant du själv har valt, så att du slipper göra om det nästa gång.'],
    ['marknadsforing', 'Marknadsföring', 'Mäter annonser och visar relevanta erbjudanden.', d.marknadsforing || 'Används av annonstjänster för att mäta annonser och visa erbjudanden, även på andra webbplatser.']];
  var css = '.ecc-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(18,39,27,.45);display:grid;place-items:center;padding:16px;font-family:"Hanken Grotesk",system-ui,sans-serif;color:#12261a;-webkit-font-smoothing:antialiased}' +
    '.ecc{width:min(640px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;border-radius:30px;box-shadow:0 40px 90px -30px rgba(0,0,0,.5)}.ecc *{box-sizing:border-box}' +
    '.ecc em{font-family:Fraunces,Georgia,serif;font-style:italic;font-weight:400}.ecc a{color:#1d3b2a;font-weight:600}' +
    '.ecc-s1{padding:26px 32px 24px}.ecc-brand{display:flex;align-items:center;gap:12px;color:#1d3b2a;font-weight:800;font-size:16px;margin-bottom:20px}.ecc-brand svg,.ecc-brand img{width:auto;height:26px}' +
    '.ecc-s1 h2{margin:0 0 12px;font-size:32px;line-height:1.08;letter-spacing:-.03em;font-weight:700}' +
    '.ecc-in{margin:0;font-size:16px;line-height:1.65;color:#3c4740}' +
    '.ecc-b{display:flex;align-items:center;justify-content:center;height:52px;padding:0 18px;border-radius:99px;font-family:inherit;font-weight:700;font-size:16px;border:1.5px solid #1d3b2a;color:#1d3b2a;background:transparent;cursor:pointer;flex:1}.ecc-b.p{background:#1d3b2a;color:#fff}' +
    '.ecc-b:hover{filter:brightness(1.08)}.ecc-b:focus{outline:none}.ecc-b.p:focus{box-shadow:0 0 0 3px #fff,0 0 0 5px #1d3b2a}.ecc-b:focus-visible,.ecc-link:focus-visible,.ecc-acc button:focus-visible{outline:2px solid #1d3b2a;outline-offset:3px}' +
    '.ecc-bs{display:flex;gap:12px;margin-top:24px}.ecc-link{display:block;margin:16px auto 0;background:none;border:0;font:inherit;font-weight:700;font-size:15px;color:#1d3b2a;text-decoration:underline;cursor:pointer}' +
    '.ecc-ft{margin:16px 0 0;font-size:13px;color:#5d6a62;text-align:center}' +
    '.ecc-top{background:#1d3b2a;color:#fff;padding:26px 32px;display:flex;align-items:center;gap:14px}.ecc-top svg,.ecc-top img{height:30px;width:auto;flex:none}.ecc-top h2{margin:0;font-size:26px;font-weight:700;letter-spacing:-.02em}' +
    '.ecc-back{margin-left:auto;background:none;border:1.5px solid rgba(255,255,255,.45);color:#fff;border-radius:99px;padding:8px 14px;font:inherit;font-weight:700;font-size:13px;cursor:pointer}' +
    '.ecc-s2 .ecc-bd{padding:24px 32px 26px}.ecc-acc{border:1px solid #e6e9e3;border-radius:18px;margin-top:10px;overflow:hidden}.ecc-acc.open{background:#f6f1e4;border-color:#f6f1e4}' +
    '.ecc-ah{display:flex;align-items:center;gap:14px;padding:14px 18px}.ecc-ah button{flex:1;display:flex;justify-content:space-between;align-items:center;gap:12px;background:none;border:0;padding:0;text-align:left;font:inherit;color:inherit;cursor:pointer}' +
    '.ecc-ah b{display:block;font-size:16px}.ecc-ah small{display:block;color:#5d6a62;font-size:14px;margin-top:3px;font-weight:400}.ecc-chev{flex:none;transition:transform .2s;font-size:14px;color:#5d6a62}.ecc-acc.open .ecc-chev{transform:rotate(180deg)}' +
    '.ecc-more{display:none;padding:0 18px 16px;font-size:14px;line-height:1.6;color:#3c4740}.ecc-acc.open .ecc-more{display:block}' +
    '.ecc-sw{position:relative;flex:none;width:48px;height:28px}.ecc-sw input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer;z-index:1}.ecc-sw i{position:absolute;inset:0;border-radius:99px;background:#d6dad3;transition:background .2s}.ecc-sw i:after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left .2s}' +
    '.ecc-sw input:checked+i{background:#1d3b2a}.ecc-sw input:checked+i:after{left:23px}.ecc-sw input:disabled+i{background:#9fb2a5}.ecc-sw input:focus-visible+i{outline:2px solid #1d3b2a;outline-offset:3px}' +
    '@media (max-width:540px){.ecc-s1{padding:20px 22px 20px}.ecc-top{padding:20px 22px}.ecc-s2 .ecc-bd{padding:18px 20px 20px}.ecc-bs{flex-direction:column}.ecc-s2 .ecc-bs{position:sticky;bottom:-20px;background:#fff;margin:14px -20px -20px;padding:14px 20px 18px;box-shadow:0 -10px 20px -14px rgba(0,0,0,.25)}.ecc-b{flex:none}}';
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function apply(c) {
    if (window.gtag) gtag('consent', 'update', { analytics_storage: c.statistik ? 'granted' : 'denied', ad_storage: c.marknadsforing ? 'granted' : 'denied',
      ad_user_data: c.marknadsforing ? 'granted' : 'denied', ad_personalization: c.marknadsforing ? 'granted' : 'denied', functionality_storage: c.installningar ? 'granted' : 'denied' });
    document.querySelectorAll('script[type="text/plain"][data-cookie]').forEach(function (s) {
      if (!c[s.dataset.cookie] || s.dataset.done) return;
      var n = document.createElement('script'); for (var i = 0; i < s.attributes.length; i++) { var a = s.attributes[i]; if (a.name !== 'type') n.setAttribute(a.name, a.value); }
      n.text = s.text; s.dataset.done = '1'; s.parentNode.insertBefore(n, s.nextSibling);
    });
    document.dispatchEvent(new CustomEvent('elevate:consent', { detail: c }));
  }
  var bg;
  function close() { if (bg) { bg.remove(); bg = null; document.documentElement.style.overflow = ''; } }
  function save(c) { c.t = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} apply(c); close(); }
  var all = function (v) { var c = {}; CATS.forEach(function (k) { c[k] = v; }); return c; };
  var footer = '<p class="ecc-ft">Personuppgiftsansvarig: ' + esc(company) + ' · <a href="' + esc(privacy) + '">Integritetspolicy</a></p>';
  var introText = d.intro || 'Vi använder cookies för att sidan ska fungera, för att förstå hur den används och för att visa relevanta erbjudanden. Du väljer själv och kan ändra dig när som helst.';
  var intro = '<p class="ecc-in">' + esc(introText) + ' <a href="' + esc(policy) + '">Läs vår cookiepolicy</a></p>';
  function step1() {
    return '<div class="ecc" role="dialog" aria-modal="true" aria-labelledby="ecc-h"><div class="ecc-top">' + logoHtml() + '<h2 id="ecc-h">Får vi använda <em>cookies?</em></h2></div><div class="ecc-s1">' + intro +
      '<div class="ecc-bs"><button type="button" class="ecc-b" data-a="none">Neka alla</button><button type="button" class="ecc-b p" data-a="all">Godkänn alla</button></div>' +
      '<button type="button" class="ecc-link" data-a="more">Anpassa mina val</button>' + footer + '</div></div>';
  }
  function step2(cur) {
    return '<div class="ecc ecc-s2" role="dialog" aria-modal="true" aria-labelledby="ecc-h2"><div class="ecc-top">' + logoHtml() + '<h2 id="ecc-h2">Dina val om <em>cookies</em></h2><button type="button" class="ecc-back" data-a="back">Tillbaka</button></div><div class="ecc-bd">' + intro +
      rows.filter(function (r) { return hide.indexOf(r[0]) < 0; }).map(function (r, i) { var must = r[0] === 'nodvandiga';
        return '<div class="ecc-acc"><div class="ecc-ah"><button type="button" aria-expanded="false" aria-controls="ecc-m' + i + '" data-t="' + i + '"><span><b>' + r[1] + '</b><small>' + r[2] + '</small></span><span class="ecc-chev" aria-hidden="true">▾</span></button>' +
          '<span class="ecc-sw"><input type="checkbox" data-c="' + r[0] + '"' + (must || cur[r[0]] ? ' checked' : '') + (must ? ' disabled' : '') + ' aria-label="' + r[1] + '"><i></i></span></div>' +
          '<div class="ecc-more" id="ecc-m' + i + '">' + esc(r[3]) + '</div></div>'; }).join('') +
      '<div class="ecc-bs"><button type="button" class="ecc-b" data-a="none">Neka alla</button><button type="button" class="ecc-b" data-a="save">Spara val</button><button type="button" class="ecc-b p" data-a="all">Godkänn alla</button></div>' + footer + '</div></div>';
  }
  function open(detailed) {
    var cur = read() || all(false);
    if (!document.getElementById('ecc-css')) { var st = document.createElement('style'); st.id = 'ecc-css'; st.textContent = css; document.head.appendChild(st); }
    if (!bg) {
      bg = document.createElement('div'); bg.className = 'ecc-bg'; document.body.appendChild(bg); document.documentElement.style.overflow = 'hidden';
      bg.addEventListener('click', function (e) {
        var t = e.target.closest && e.target.closest('[data-t]');
        if (t) { var acc = t.closest('.ecc-acc'), on = !acc.classList.contains('open'); acc.classList.toggle('open', on); t.setAttribute('aria-expanded', String(on)); return; }
        var a = e.target.closest && e.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'more') return show(true);
        if (a.dataset.a === 'back') return show(false);
        if (a.dataset.a === 'all') return save(all(true));
        if (a.dataset.a === 'none') return save(all(false));
        var c = {}; CATS.forEach(function (k) { c[k] = bg.querySelector('[data-c="' + k + '"]').checked; }); save(c);
      });
      bg.addEventListener('keydown', function (e) { if (e.key === 'Escape' && read()) close(); });
    }
    show(detailed);
    function show(two) { bg.innerHTML = two ? step2(read() || cur) : step1(); var f = bg.querySelector('[data-a="all"]'); if (f) f.focus({ preventScroll: true }); }
  }
  window.ElevateConsent = { open: function () { open(true); }, get: read };
  document.addEventListener('click', function (e) { var l = e.target.closest && e.target.closest('[data-cookie-settings]'); if (l) { e.preventDefault(); open(true); } });
  var go = function () { var c = read(); if (c) apply(c); else open(false); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
