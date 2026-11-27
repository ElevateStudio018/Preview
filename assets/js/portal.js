/* Kundportalen (/portal): the customer logs in with a one-time link to their e-mail and sees their subscription,
   what it includes, can cancel or change package, send requests, see domains, mail and invoices and approve drafts.
   Talks to Supabase directly (auth and REST, no library), so no third-party script is loaded. The login is kept in
   localStorage (es.portal.session) until the customer logs out. Row level security in the database decides what
   each customer can see (supabase/sql/2026-11-26_kundportal.sql). In a static preview (githack, localhost or ?demo)
   a clearly marked demo account with made-up data is used. */
(function () {
  var root = document.getElementById('portal'); if (!root) return;
  var DB = root.dataset.db, KEY = root.dataset.key, PLANS = [];
  try { PLANS = JSON.parse(root.dataset.plans || '[]'); } catch (e) { PLANS = []; }
  var DEMO = /[?&]demo\b/.test(location.search) || /githack|localhost/.test(location.hostname);
  var SKEY = 'es.portal.session';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var day = function (d) { if (!d) return '–'; var t = new Date(d); return isNaN(t) ? '–' : t.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' }); };
  var kr = function (n) { return n == null || n === '' ? '–' : Number(n).toLocaleString('sv-SE') + ' kr'; };
  var ICON = {
    home: 'M3 11l9-7 9 7v9h-6v-6H9v6H3z', chat: 'M4 5h16v11H9l-5 4z', globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    doc: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7', check: 'M4 12l5 5L20 6', out: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11', arrow: 'M5 12h14M13 6l6 6-6 6',
    swap: 'M7 7h12l-3-3M17 17H5l3 3', stop: 'M6 6l12 12M18 6L6 18', mail: 'M3 6h18v12H3zM3 6l9 7 9-7', link: 'M10 14l4-4M8 16a3 3 0 01-4-4l3-3M16 8a3 3 0 014 4l-3 3'
  };
  var ico = function (n) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICON[n] + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; };
  var MARK = '<svg viewBox="0 0 1884.3 1353.9" aria-hidden="true"><path d="M0 1353.9 L1218.7 0 L1218.7 329.1 L479.7 1136.4 L786.7 1132.4 L1215.5 687.4 L1884.3 1349.9 L1590.1 1349.9 L1218.6 994.7 L865.4 1349.9Z" fill="currentColor"/></svg>';
  var KIND = { andring: 'Ändring', uppsagning: 'Uppsägning', paketbyte: 'Paketbyte', ovrigt: 'Övrigt' };
  var STATUS = { ny: 'Skickat', pagar: 'Pågår', klar: 'Klart', avbojd: 'Avböjt' };
  var INV = { obetald: 'Obetald', betald: 'Betald', krediterad: 'Krediterad' };
  var SVC = { doman: 'Domän', mejl: 'Mejl', ovrigt: 'Övrigt' };
  var st = { tab: 'oversikt', client: null, requests: [], services: [], invoices: [], drafts: [], email: '' };

  // ---------- login (Supabase auth over plain fetch) ----------
  var saveSession = function (s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) { /* private mode: lasts for this page */ } st.session = s; };
  var readSession = function () { if (st.session) return st.session; try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } };
  var dropSession = function () { st.session = null; try { localStorage.removeItem(SKEY); } catch (e) { /* nothing stored */ } };
  var authFetch = function (path, body, token) {
    return fetch(DB + '/auth/v1/' + path, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || KEY) }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.msg || d.error_description || d.message || 'Något gick fel'); return d; }); });
  };
  var session = function () {
    var s = readSession(); if (!s || !s.access_token) return Promise.reject(new Error('login'));
    if (s.expires_at && s.expires_at * 1000 > Date.now() + 60e3) return Promise.resolve(s);
    return authFetch('token?grant_type=refresh_token', { refresh_token: s.refresh_token }).then(function (d) {
      var n = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600), email: (d.user && d.user.email) || s.email };
      saveSession(n); return n;
    }, function () { dropSession(); throw new Error('login'); });
  };
  // the one-time link comes back with the login in the address (#access_token=…)
  var fromLink = function () {
    if (!/access_token=|error_description=/.test(location.hash)) return null;
    var h = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, '', location.pathname + location.search);
    if (h.get('error_description')) return { error: h.get('error_description') };
    var s = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_at: Number(h.get('expires_at')) || Math.floor(Date.now() / 1000) + Number(h.get('expires_in') || 3600) };
    try { s.email = JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email; } catch (e) { s.email = ''; }
    saveSession(s); return s;
  };
  var api = function (path, opt) {
    opt = opt || {};
    if (DEMO) return demo.api(path, opt);
    return session().then(function (s) {
      var h = { apikey: KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' };
      if (opt.prefer) h.Prefer = opt.prefer;
      return fetch(DB + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined }).then(function (r) {
        if (r.status === 401) { dropSession(); throw new Error('login'); }
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (e) { throw new Error(e.message || 'Något gick fel (' + r.status + ')'); });
        return r.status === 204 ? null : r.json();
      });
    });
  };
  // tells Elevate (and the customer) by mail that a request came in; the server reads it with the customer's own login
  var notify = function (id) {
    if (DEMO) return Promise.resolve();
    return session().then(function (s) { return fetch('/api/portal/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ id: id }) }); }).catch(function () { /* the request is saved anyway */ });
  };

  // ---------- demo account (only in previews) ----------
  var demo = (function () {
    var d = function (n) { return new Date(Date.now() - n * 864e5).toISOString(); }, n = 0;
    var data = {
      client: { id: 'demo', display_name: 'Anna Exempel', company_name: 'Exempel Bygg AB', plan: 'Pro', monthly_fee: 299, started_on: d(140).slice(0, 10), ends_on: null, site_url: 'https://exempelbygg.se', billing_note: 'Månadsavgiften faktureras kvartalsvis i förskott.' },
      requests: [
        { id: 'r2', kind: 'andring', title: 'Byta bild på startsidan', body: 'Vi har nya bilder från sommarens projekt, kan ni byta den stora bilden?', status: 'klar', reply: 'Klart! Den nya bilden ligger uppe nu.', created_at: d(9) },
        { id: 'r1', kind: 'ovrigt', title: 'Vidarebefordra info@ till Anna', body: 'Kan info@exempelbygg.se också gå till anna@exempelbygg.se?', status: 'pagar', reply: null, created_at: d(2) }],
      services: [
        { id: 's1', kind: 'doman', name: 'exempelbygg.se', renews_on: d(-120).slice(0, 10), note: 'Förnyas automatiskt' },
        { id: 's2', kind: 'mejl', name: 'anna@exempelbygg.se', renews_on: null, note: 'Elevate Mejl' },
        { id: 's3', kind: 'mejl', name: 'info@exempelbygg.se', renews_on: null, note: 'Elevate Mejl' }],
      invoices: [
        { id: 'i2', number: '2026-114', amount_sek: 897, issued_on: d(25).slice(0, 10), due_on: d(-5).slice(0, 10), status: 'obetald', url: null, file_path: 'demo/2026-114.pdf' },
        { id: 'i1', number: '2026-071', amount_sek: 6000, issued_on: d(140).slice(0, 10), due_on: d(110).slice(0, 10), status: 'betald', url: null }],
      drafts: [{ id: 'c1', title: 'Ny text: Om oss', body: 'Exempel Bygg är ett familjeföretag som har byggt och renoverat hus sedan 1998.\n\nVi tar hand om hela jobbet – från första skissen till slutbesiktningen.', status: 'pending', client_feedback: null, created_at: d(1) }]
    };
    return {
      api: function (path, opt) {
        var m = opt.method || 'GET';
        return new Promise(function (ok) {
          setTimeout(function () {
            if (/rpc\/portal_link_me/.test(path)) return ok('demo');
            if (/portal_clients/.test(path)) return ok([data.client]);
            if (/portal_requests/.test(path) && m === 'POST') { var r = Object.assign({ id: 'n' + (++n), status: 'ny', reply: null, created_at: new Date().toISOString() }, opt.body); data.requests.unshift(r); return ok([r]); }
            if (/portal_requests/.test(path)) return ok(data.requests.slice());
            if (/portal_services/.test(path)) return ok(data.services.slice());
            if (/portal_invoices/.test(path)) return ok(data.invoices.slice());
            if (/portal_content_items/.test(path) && m === 'PATCH') { var id = (path.match(/id=eq\.([^&]+)/) || [])[1]; data.drafts.forEach(function (x) { if (x.id === id) Object.assign(x, opt.body); }); return ok(null); }
            if (/portal_content_items/.test(path)) return ok(data.drafts.slice());
            ok([]);
          }, 120);
        });
      }
    };
  })();

  // ---------- views ----------
  var shell = function (inner) { root.innerHTML = '<div class="pt">' + (DEMO ? '<p class="pt-demo">Demo – påhittade uppgifter. Inget du gör här sparas.</p>' : '') + inner + '</div>'; };
  function loginView(msg, err) {
    shell('<div class="pt-login"><span class="pt-login__mark">' + MARK + '</span><h1 class="pt-login__title">Kund<em>portal</em></h1>' +
      '<p class="pt-login__lead">Se ert abonnemang, skicka ärenden och se fakturor. Vi skickar en inloggningslänk till er e-post – inget lösenord behövs.</p>' +
      (msg ? '<p class="pt-note' + (err ? ' pt-note--err' : '') + '" role="status">' + esc(msg) + '</p>' : '') +
      '<form class="pt-login__form" id="pt-login"><label class="sr-only" for="pt-email">E-post</label><input id="pt-email" type="email" name="email" autocomplete="email" placeholder="namn@foretag.se" required>' +
      '<button class="btn btn--primary" type="submit"><span>Skicka inloggningslänk</span></button></form>' +
      '<p class="pt-login__small">Har ni inget konto än? Vi lägger upp det när ni blir kund. <a href="kontakt.html">Kontakta oss</a></p></div>');
    root.querySelector('#pt-login').addEventListener('submit', function (e) {
      e.preventDefault();
      var email = this.email.value.trim(), btn = this.querySelector('button'); if (!email) return;
      btn.disabled = true;
      if (DEMO) { st.email = email; return load(); }
      var back = location.origin + location.pathname;
      fetch(DB + '/auth/v1/otp?redirect_to=' + encodeURIComponent(back), { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, create_user: true }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.msg || d.message || 'Det gick inte att skicka länken'); }); })
        .then(function () { loginView('Kolla din inkorg. Vi har skickat en inloggningslänk till ' + email + '. Länken gäller en kort stund.'); },
          function (er) { btn.disabled = false; loginView(/rate|seconds/i.test(er.message) ? 'Vänta en minut innan du ber om en ny länk.' : er.message, true); });
    });
  }
  function noAccount() {
    shell('<div class="pt-login"><span class="pt-login__mark">' + MARK + '</span><h1 class="pt-login__title">Inget <em>kundkonto</em></h1>' +
      '<p class="pt-login__lead">Vi hittar inget kundkonto för ' + esc(st.email || 'den här e-posten') + '. Använd adressen som stod i er inbjudan, eller hör av er så lägger vi upp ett konto.</p>' +
      '<p class="pt-login__actions"><a class="btn btn--primary" href="kontakt.html"><span>Kontakta oss</span></a><button class="pt-link" type="button" id="pt-out">Logga in med en annan e-post</button></p></div>');
    root.querySelector('#pt-out').addEventListener('click', logout);
  }
  function logout() {
    var s = readSession(); dropSession();
    if (s && !DEMO) authFetch('logout', {}, s.access_token).catch(function () { /* logged out here anyway */ });
    loginView('Du är utloggad.');
  }
  var plan = function (name) { for (var i = 0; i < PLANS.length; i++) if (PLANS[i].name === name) return PLANS[i]; return null; };
  var openOf = function (kind) { return st.requests.filter(function (r) { return r.kind === kind && (r.status === 'ny' || r.status === 'pagar'); })[0]; };
  // class names written out in full, so the CSS clean-up keeps them
  var CHIP = { ny: 'pt-chip--ny', pending: 'pt-chip--pending', obetald: 'pt-chip--obetald', pagar: 'pt-chip--pagar', klar: 'pt-chip--klar', approved: 'pt-chip--approved',
    betald: 'pt-chip--betald', avbojd: 'pt-chip--avbojd', changes_requested: 'pt-chip--changes_requested' };
  var chip = function (s, map) { return '<span class="pt-chip ' + (CHIP[s] || '') + '">' + esc(map[s] || s) + '</span>'; };

  function dash() {
    var c = st.client, pending = st.drafts.filter(function (x) { return x.status === 'pending'; }).length;
    var tabs = [['oversikt', 'Översikt', 'home'], ['arenden', 'Ärenden', 'chat'], ['tjanster', 'Domäner och mejl', 'globe'], ['fakturor', 'Fakturor', 'doc'], ['utkast', 'Utkast', 'check']];
    shell('<header class="pt-head"><div><p class="kicker">Kundportal</p><h1 class="pt-head__title">Hej <em>' + esc((c.display_name || '').split(' ')[0] || 'där') + '</em></h1>' +
      '<p class="pt-head__sub">' + esc(c.company_name || '') + (c.site_url ? ' · <a href="' + esc(c.site_url) + '" target="_blank" rel="noopener">' + esc(c.site_url.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</a>' : '') + '</p></div>' +
      '<button class="pt-out" type="button" id="pt-out">' + ico('out') + 'Logga ut</button></header>' +
      '<nav class="pt-tabs" aria-label="Kundportalen">' + tabs.map(function (t) { return '<button type="button" class="pt-tab' + (st.tab === t[0] ? ' is-on' : '') + '" data-tab="' + t[0] + '"' + (st.tab === t[0] ? ' aria-current="page"' : '') + '>' + ico(t[2]) + t[1] + (t[0] === 'utkast' && pending ? '<b class="pt-badge">' + pending + '</b>' : '') + '</button>'; }).join('') + '</nav>' +
      '<div class="pt-body" id="pt-body"></div>');
    root.querySelector('#pt-out').addEventListener('click', logout);
    root.querySelector('.pt-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (!b) return; st.tab = b.dataset.tab; dash(); });
    ({ oversikt: overview, arenden: requests, tjanster: services, fakturor: invoices, utkast: drafts })[st.tab]();
  }
  var body = function (html) { root.querySelector('#pt-body').innerHTML = html; return root.querySelector('#pt-body'); };

  function overview() {
    var c = st.client, p = plan(c.plan), cancel = openOf('uppsagning'), change = openOf('paketbyte');
    var el = body(
      (cancel ? '<p class="pt-banner">' + ico('mail') + '<span>Ni skickade en uppsägning ' + day(cancel.created_at) + '. Vi bekräftar den och när den börjar gälla via mejl.</span></p>' : '') +
      (change ? '<p class="pt-banner">' + ico('swap') + '<span>Ni har bett om att byta till ' + esc(change.wanted_plan || 'ett annat paket') + ' (' + day(change.created_at) + '). Vi återkommer med bekräftelse.</span></p>' : '') +
      '<div class="pt-grid">' +
      '<section class="pt-card pt-plan"><p class="pt-card__kicker">Ert abonnemang</p><h2 class="pt-plan__name">' + esc(c.plan || 'Inget paket angivet') + '</h2>' +
      '<dl class="pt-facts"><div><dt>Månadsavgift</dt><dd>' + (c.monthly_fee != null ? kr(c.monthly_fee) + ' /mån' : '–') + '</dd></div><div><dt>Startade</dt><dd>' + day(c.started_on) + '</dd></div>' +
      (c.ends_on ? '<div><dt>Upphör</dt><dd>' + day(c.ends_on) + '</dd></div>' : '') + '<div><dt>Bindningstid</dt><dd>Ingen</dd></div></dl>' +
      (c.billing_note ? '<p class="pt-small">' + esc(c.billing_note) + '</p>' : '') +
      '<div class="pt-actions"><button class="btn btn--primary" type="button" data-act="change"' + (change || cancel ? ' disabled' : '') + '><span>Byt paket</span></button><button class="pt-link pt-link--danger" type="button" data-act="cancel"' + (cancel || c.ends_on ? ' disabled' : '') + '>Säg upp abonnemanget</button></div></section>' +
      '<section class="pt-card"><p class="pt-card__kicker">Det här ingår</p>' + (p ? '<p class="pt-small">' + esc(p.text) + '</p><ul class="pt-incl">' + p.items.map(function (i) { return '<li>' + ico('check') + esc(i) + '</li>'; }).join('') + '</ul><p class="pt-small"><a href="priser.html">Jämför paketen</a></p>' : '<p class="pt-small">Hör av er så berättar vi vad som ingår i ert avtal.</p>') + '</section>' +
      '<section class="pt-card pt-card--wide"><div class="pt-card__row"><p class="pt-card__kicker">Senaste ärenden</p><button class="pt-link" type="button" data-act="new">Nytt ärende ' + ico('arrow') + '</button></div>' + reqList(st.requests.slice(0, 3)) + '</section>' +
      '</div>');
    el.addEventListener('click', function (e) {
      var a = e.target.closest('[data-act]'); if (!a || a.disabled) return;
      if (a.dataset.act === 'change') changeDialog(); else if (a.dataset.act === 'cancel') cancelDialog(); else { st.tab = 'arenden'; dash(); }
    });
  }
  function reqList(list) {
    if (!list.length) return '<p class="pt-empty">Inga ärenden än.</p>';
    return '<ul class="pt-reqs">' + list.map(function (r) {
      return '<li class="pt-req"><div class="pt-req__top"><b>' + esc(r.title) + '</b>' + chip(r.status, STATUS) + '</div><p class="pt-req__meta">' + esc(KIND[r.kind] || r.kind) + ' · ' + day(r.created_at) + '</p>' +
        (r.body ? '<p class="pt-req__body">' + esc(r.body) + '</p>' : '') + (r.reply ? '<p class="pt-req__reply"><span>Svar från Elevate</span>' + esc(r.reply) + '</p>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function requests() {
    var el = body('<div class="pt-grid"><section class="pt-card"><p class="pt-card__kicker">Nytt ärende</p><h2 class="pt-card__title">Vad behöver ni <em>hjälp med?</em></h2>' +
      '<form class="pt-form" id="pt-req"><label>Typ<select name="kind"><option value="andring">Ändring på hemsidan</option><option value="ovrigt">Mejl, domän eller annat</option></select></label>' +
      '<label>Rubrik<input name="title" maxlength="160" required placeholder="Till exempel: Byt telefonnummer i sidfoten"></label>' +
      '<label>Beskriv<textarea name="body" maxlength="5000" rows="5" placeholder="Vad ska ändras och var? Länka gärna till sidan."></textarea></label>' +
      '<button class="btn btn--primary" type="submit"><span>Skicka ärendet</span></button><p class="pt-form__msg" role="status"></p></form></section>' +
      '<section class="pt-card"><p class="pt-card__kicker">Era ärenden</p>' + reqList(st.requests) + '</section></div>');
    el.querySelector('#pt-req').addEventListener('submit', function (e) {
      e.preventDefault(); var f = this;
      send({ kind: f.kind.value, title: f.title.value.trim(), body: f.body.value.trim() }, f, 'Tack! Vi har fått ärendet och svarar här och via mejl.');
    });
  }
  function send(row, form, done) {
    var btn = form.querySelector('[type=submit]'), msg = form.querySelector('.pt-form__msg');
    btn.disabled = true; if (msg) msg.textContent = 'Skickar …';
    row.portal_client_id = st.client.id;
    return api('/rest/v1/portal_requests', { method: 'POST', body: row, prefer: 'return=representation' }).then(function (r) {
      var saved = r && r[0]; if (saved) { st.requests.unshift(saved); notify(saved.id); }
      closeDialog(); dash(); toast(done);
    }, function (er) { btn.disabled = false; if (msg) msg.textContent = er.message === 'login' ? 'Du har loggats ut. Logga in igen.' : er.message; if (er.message === 'login') loginView('Logga in igen för att fortsätta.'); });
  }
  function services() {
    var list = st.services;
    body('<section class="pt-card"><p class="pt-card__kicker">Domäner och mejl</p>' + (list.length ? '<div class="pt-tbl"><table><thead><tr><th>Typ</th><th>Namn</th><th>Förnyas</th><th>Notering</th></tr></thead><tbody>' +
      list.map(function (s) { return '<tr><td>' + esc(SVC[s.kind] || s.kind) + '</td><td><b>' + esc(s.name) + '</b></td><td>' + day(s.renews_on) + '</td><td>' + esc(s.note || '') + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : '<p class="pt-empty">Inga domäner eller mejlkonton är upplagda här än.</p>') +
      '<p class="pt-small">Behöver ni en ny adress, vidarebefordring eller ett frånvaromeddelande? <button class="pt-link" type="button" id="pt-svc-new">Skicka ett ärende</button></p></section>' +
      list.filter(function (x) { return x.kind === 'doman'; }).map(function (x, i) { return '<section class="pt-card pt-dns" data-dns="' + esc(x.name) + '"><div class="pt-card__row"><p class="pt-card__kicker">DNS-poster · ' + esc(x.name) + '</p>' +
        '<button class="btn btn--sm btn--ghost" type="button" data-dns-new="' + esc(x.name) + '">Begär ny post</button></div><div class="pt-dns__body"><p class="pt-empty">Läser DNS-posterna …</p></div>' +
        '<div class="pt-dns__note"><b>Ändra inte posterna själva.</b> En fel post kan stänga ner hemsidan eller mejlen. Begär ändringen här, så gör vi den och kontrollerar att allt fungerar efteråt. ' +
        'Fel som uppstår när posterna ändras utanför Elevate Studio ingår inte i supporten.</div>' +
        '<p class="pt-small">Domänen är er. Vill ni flytta den till en annan leverantör? <button class="pt-link" type="button" data-dns-move="' + esc(x.name) + '">Begär flyttkod</button></p></section>'; }).join(''));
    root.querySelector('#pt-svc-new').addEventListener('click', function () { st.tab = 'arenden'; dash(); var s = root.querySelector('#pt-req select'); if (s) s.value = 'ovrigt'; });
    root.querySelectorAll('[data-dns]').forEach(dnsLoad);
  }
  // DNS: the records as anyone can look them up (worker/domains.js /api/dns), read-only; every change is an ärende
  var DNSHELP = { A: 'pekar domänen på en server (hemsidan)', AAAA: 'samma som A, för IPv6', CNAME: 'gör namnet till ett alias för ett annat', MX: 'vart mejlen till domänen levereras', TXT: 'verifiering och skydd för mejl (SPF, DKIM, DMARC)', NS: 'vem som styr domänens DNS' };
  function dnsLoad(card) {
    var dom = card.dataset.dns, out = card.querySelector('.pt-dns__body');
    var show = function (recs) {
      var short = function (n) { return n === dom ? '@' : n.slice(0, -(dom.length + 1)); };
      out.innerHTML = recs.length ? '<div class="pt-tbl pt-dns__tbl"><table><thead><tr><th>Typ</th><th>Namn</th><th>Värde</th><th></th></tr></thead><tbody>' + recs.map(function (r, i) {
        return '<tr><td><span class="pt-dns__type" title="' + esc(DNSHELP[r.type] || '') + '">' + esc(r.type) + '</span></td><td class="pt-dns__name">' + esc(short(r.name)) + '</td><td class="pt-dns__val"><code title="' + esc(r.value) + '">' + esc(r.value.length > 64 ? r.value.slice(0, 61) + '…' : r.value) + '</code></td>' +
          '<td><button class="pt-link" type="button" data-dns-edit="' + i + '">Begär ändring</button></td></tr>'; }).join('') + '</tbody></table></div>' +
        '<p class="pt-small pt-dns__legend">' + Object.keys(DNSHELP).filter(function (t) { return recs.some(function (r) { return r.type === t; }); }).map(function (t) { return '<b>' + t + '</b> ' + DNSHELP[t]; }).join(' · ') + '</p>'
        : '<p class="pt-empty">Inga DNS-poster hittades för ' + esc(dom) + '. Är domänen ny kan det ta upp till ett dygn innan de syns.</p>';
      out.querySelectorAll('[data-dns-edit]').forEach(function (b) { b.addEventListener('click', function () { dnsDialog(dom, recs[Number(b.dataset.dnsEdit)]); }); });
    };
    (DEMO ? Promise.resolve({ records: [
      { type: 'NS', name: dom, value: 'ns1.exempel-dns.se' }, { type: 'NS', name: dom, value: 'ns2.exempel-dns.se' },
      { type: 'A', name: dom, value: '203.0.113.10' }, { type: 'CNAME', name: 'www.' + dom, value: dom },
      { type: 'MX', name: dom, value: '10 mx.exempel-mejl.se' }, { type: 'TXT', name: dom, value: 'v=spf1 include:exempel-mejl.se ~all' },
      { type: 'TXT', name: '_dmarc.' + dom, value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@' + dom }] })
      : fetch('/api/dns?domain=' + encodeURIComponent(dom)).then(function (r) { return r.json(); }))
      .then(function (d) { show(d.records || []); }, function () { out.innerHTML = '<p class="pt-empty">Kunde inte läsa DNS-posterna just nu. Försök igen om en stund.</p>'; });
    card.querySelector('[data-dns-new]').addEventListener('click', function () { dnsDialog(dom, null); });
    card.querySelector('[data-dns-move]').addEventListener('click', function () {
      dialog('<h2 class="pt-dlg__title">Flytta <em>' + esc(dom) + '</em></h2><p class="pt-small">Domänen är er. Vi skickar flyttkoden (auth-koden) till er e-post, och ni ger den till den nya leverantören. Tänk på att hemsidan och mejlen behöver kopplas om hos den nya leverantören.</p>' +
        '<label class="pt-form">Till vilken leverantör? (valfritt)<input name="to" maxlength="120"></label>' +
        '<div class="pt-actions"><button class="btn btn--primary" type="submit"><span>Begär flyttkod</span></button><button class="pt-link" type="button" data-close>Avbryt</button></div>', function (f) {
        send({ kind: 'ovrigt', title: 'Flyttkod för ' + dom, body: 'Vi vill flytta ' + dom + ' och behöver flyttkoden.' + (f.to.value.trim() ? '\nNy leverantör: ' + f.to.value.trim() : '') }, f, 'Tack! Vi skickar flyttkoden till er e-post.');
      });
    });
  }
  function dnsDialog(dom, r) {
    var types = ['A', 'AAAA', 'CNAME', 'MX', 'TXT'];
    dialog('<h2 class="pt-dlg__title">' + (r ? 'Ändra <em>DNS-post</em>' : 'Ny <em>DNS-post</em>') + '</h2>' +
      (r ? '<p class="pt-small">Nu: <b>' + esc(r.type) + '</b> ' + esc(r.name) + ' → <code>' + esc(r.value) + '</code></p>' : '<p class="pt-small">Till exempel en post som Google, Microsoft eller ett bokningssystem har bett er lägga till.</p>') +
      '<div class="pt-form"><label>Vad vill ni göra?<select name="what">' + (r ? '<option>Ändra värdet</option><option>Ta bort posten</option>' : '<option>Lägga till posten</option>') + '</select></label>' +
      (r ? '' : '<label>Typ<select name="type">' + types.map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select></label><label>Namn (lämna tomt för ' + esc(dom) + ')<input name="name" maxlength="120" placeholder="till exempel www eller _dmarc"></label>') +
      '<label>Nytt värde<textarea name="value" rows="3" maxlength="2000" placeholder="Klistra in värdet ni har fått"></textarea></label>' +
      '<label>Varför? (valfritt)<input name="why" maxlength="300" placeholder="Till exempel: verifiera domänen hos Google"></label></div>' +
      '<div class="pt-actions"><button class="btn btn--primary" type="submit"><span>Skicka begäran</span></button><button class="pt-link" type="button" data-close>Avbryt</button></div>', function (f) {
      var what = f.what.value, type = r ? r.type : f.type.value, name = r ? r.name : ((f.name.value.trim() ? f.name.value.trim().replace(/\.$/, '') + '.' : '') + dom);
      if (!/Ta bort/.test(what) && !f.value.value.trim()) { f.value.focus(); return; }
      send({ kind: 'ovrigt', title: 'DNS: ' + what.toLowerCase() + ' – ' + type + ' ' + name,
        body: ['Domän: ' + dom, 'Post: ' + type + ' ' + name, r ? 'Nuvarande värde: ' + r.value : '', f.value.value.trim() ? 'Nytt värde: ' + f.value.value.trim() : '', f.why.value.trim() ? 'Varför: ' + f.why.value.trim() : ''].filter(Boolean).join('\n') },
        f, 'Tack! Vi gör ändringen och hör av oss när den är klar.');
    });
  }
  function invoices() {
    var list = st.invoices;
    body('<section class="pt-card"><p class="pt-card__kicker">Fakturor</p>' + (list.length ? '<div class="pt-tbl"><table><thead><tr><th>Nummer</th><th>Datum</th><th>Förfaller</th><th>Belopp</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (i) { return '<tr><td><b>' + esc(i.number) + '</b></td><td>' + day(i.issued_on) + '</td><td>' + day(i.due_on) + '</td><td>' + kr(i.amount_sek) + '</td><td>' + chip(i.status, INV) + '</td><td>' + (i.file_path ? '<button class="pt-link" type="button" data-dl="' + esc(i.file_path) + '">Ladda ner</button>' : i.url ? '<a class="pt-link" href="' + esc(i.url) + '" target="_blank" rel="noopener">Öppna</a>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : '<p class="pt-empty">Inga fakturor här än.</p>') + '<p class="pt-small">Frågor om en faktura? Svara på fakturamejlet eller skicka ett ärende.</p></section>').addEventListener('click', function (e) {
      var b = e.target.closest('[data-dl]'); if (!b) return;
      if (DEMO) return toast('I demon finns inga riktiga fakturafiler.');
      // a short-lived link to the private file, made with the customer's own login
      var w = window.open('', '_blank');
      session().then(function (s) {
        return fetch(DB + '/storage/v1/object/sign/portal-invoices/' + b.dataset.dl.split('/').map(encodeURIComponent).join('/'), { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 300 }) });
      }).then(function (r) { return r.json().then(function (d) { if (!r.ok || !(d.signedURL || d.signedUrl)) throw new Error(d.message || 'Filen gick inte att öppna'); return DB + '/storage/v1' + (d.signedURL || d.signedUrl); }); })
        .then(function (url) { if (w) w.location = url; else location.href = url; }, function (er) { if (w) w.close(); toast(er.message === 'login' ? 'Logga in igen.' : er.message); });
    });
  }
  function drafts() {
    var list = st.drafts;
    var el = body(list.length ? '<div class="pt-drafts">' + list.map(function (x) {
      return '<section class="pt-card pt-draft" data-id="' + esc(x.id) + '"><div class="pt-card__row"><p class="pt-card__kicker">Utkast · ' + day(x.created_at) + '</p>' + chip(x.status, { pending: 'Väntar på er', approved: 'Godkänt', changes_requested: 'Ändringar önskade' }) + '</div>' +
        '<h2 class="pt-card__title">' + esc(x.title) + '</h2><div class="pt-draft__body">' + esc(x.body) + '</div>' +
        (x.status === 'pending' ? '<label class="pt-form pt-draft__fb">Kommentar (valfritt)<textarea rows="3" maxlength="3000" placeholder="Vad vill ni ändra?"></textarea></label><div class="pt-actions"><button class="btn btn--primary" type="button" data-s="approved"><span>Godkänn</span></button><button class="pt-link" type="button" data-s="changes_requested">Önska ändringar</button></div>'
          : (x.client_feedback ? '<p class="pt-req__reply"><span>Er kommentar</span>' + esc(x.client_feedback) + '</p>' : '')) + '</section>';
    }).join('') + '</div>' : '<section class="pt-card"><p class="pt-card__kicker">Utkast</p><p class="pt-empty">Inga utkast väntar på er just nu. När vi har något att visa – en ny text, en ny sida eller en korrekturrunda – dyker det upp här.</p></section>');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-s]'); if (!b) return;
      var card = b.closest('.pt-draft'), fb = card.querySelector('textarea').value.trim();
      if (b.dataset.s === 'changes_requested' && !fb) { card.querySelector('textarea').focus(); return toast('Skriv vad ni vill ändra.'); }
      b.disabled = true;
      api('/rest/v1/portal_content_items?id=eq.' + encodeURIComponent(card.dataset.id), { method: 'PATCH', body: { status: b.dataset.s, client_feedback: fb || null } }).then(function () {
        st.drafts.forEach(function (x) { if (x.id === card.dataset.id) { x.status = b.dataset.s; x.client_feedback = fb || null; } });
        dash(); toast(b.dataset.s === 'approved' ? 'Tack! Utkastet är godkänt.' : 'Tack! Vi tittar på era ändringar.');
      }, function (er) { b.disabled = false; toast(er.message); });
    });
  }

  // ---------- dialogs: change package, cancel ----------
  var dlg;
  function dialog(html, onSubmit) {
    closeDialog();
    dlg = document.createElement('div'); dlg.className = 'pt-dlg';
    dlg.innerHTML = '<form class="pt-dlg__box" role="dialog" aria-modal="true">' + html + '<p class="pt-form__msg" role="status"></p></form>';
    document.body.appendChild(dlg); document.documentElement.style.overflow = 'hidden';
    var f = dlg.querySelector('form'); var first = f.querySelector('input, textarea, button'); if (first) first.focus();
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-close]')) closeDialog(); });
    dlg.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDialog(); });
    f.addEventListener('submit', function (e) { e.preventDefault(); onSubmit(f); });
  }
  function closeDialog() { if (dlg) { dlg.remove(); dlg = null; document.documentElement.style.overflow = ''; } }
  function changeDialog() {
    var cur = st.client.plan;
    dialog('<h2 class="pt-dlg__title">Byt <em>paket</em></h2><p class="pt-small">Välj det paket ni vill byta till. Vi bekräftar bytet, priset och från när det gäller via mejl innan något ändras.</p>' +
      '<div class="pt-plans">' + PLANS.map(function (p) { return '<label class="pt-opt' + (p.name === cur ? ' is-cur' : '') + '"><input type="radio" name="plan" value="' + esc(p.name) + '"' + (p.name === cur ? ' disabled' : '') + ' required><span><b>' + esc(p.name) + (p.name === cur ? ' <small>(ert nuvarande)</small>' : '') + '</b><small>' + esc(p.unit) + '</small></span></label>'; }).join('') + '</div>' +
      '<label class="pt-form">Meddelande (valfritt)<textarea name="msg" rows="3" maxlength="2000"></textarea></label>' +
      '<div class="pt-actions"><button class="btn btn--primary" type="submit"><span>Skicka önskemål</span></button><button class="pt-link" type="button" data-close>Avbryt</button></div>', function (f) {
      var to = (f.querySelector('input[name=plan]:checked') || {}).value; if (!to) return;
      send({ kind: 'paketbyte', title: 'Byta paket till ' + to, wanted_plan: to, body: f.msg.value.trim() }, f, 'Tack! Vi har fått ert önskemål om att byta paket och bekräftar via mejl.');
    });
  }
  function cancelDialog() {
    dialog('<h2 class="pt-dlg__title">Säg upp <em>abonnemanget</em></h2><p class="pt-small">Det finns ingen bindningstid. När ni skickar uppsägningen får ni en bekräftelse via mejl, och vi hör av oss om när den börjar gälla och vad som händer med hemsidan, domänen och mejlen.</p>' +
      '<label class="pt-form">Berätta gärna varför (valfritt)<textarea name="msg" rows="3" maxlength="2000"></textarea></label>' +
      '<label class="pt-check"><input type="checkbox" name="ok" required><span>Ja, jag vill säga upp abonnemanget för ' + esc(st.client.company_name || 'vårt företag') + '.</span></label>' +
      '<div class="pt-actions"><button class="btn pt-btn--danger" type="submit"><span>Skicka uppsägning</span></button><button class="pt-link" type="button" data-close>Avbryt</button></div>', function (f) {
      if (!f.ok.checked) return;
      send({ kind: 'uppsagning', title: 'Uppsägning av abonnemanget', body: f.msg.value.trim() }, f, 'Uppsägningen är skickad. Ni får en bekräftelse via mejl.');
    });
  }
  var toastEl;
  function toast(t) {
    if (!toastEl) { toastEl = document.createElement('p'); toastEl.className = 'pt-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = t; toastEl.classList.add('is-on'); clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove('is-on'); }, 4200);
  }

  // ---------- start ----------
  function load() {
    shell('<p class="pt-loading">Laddar …</p>');
    api('/rest/v1/rpc/portal_link_me', { method: 'POST', body: {} }).then(function (id) {
      if (!id) return noAccount();
      var q = function (t, extra) { return api('/rest/v1/' + t + '?portal_client_id=eq.' + encodeURIComponent(id) + (extra || '')); };
      return Promise.all([api('/rest/v1/portal_clients?id=eq.' + encodeURIComponent(id) + '&select=*'), q('portal_requests', '&order=created_at.desc'), q('portal_services', '&order=kind,name'),
        q('portal_invoices', '&order=issued_on.desc.nullslast'), q('portal_content_items', '&order=created_at.desc')]).then(function (r) {
        st.client = r[0][0]; if (!st.client) return noAccount();
        st.requests = r[1] || []; st.services = r[2] || []; st.invoices = r[3] || []; st.drafts = r[4] || [];
        dash();
      });
    }).catch(function (er) { if (er.message === 'login') loginView(); else shell('<p class="pt-note pt-note--err">Det gick inte att ladda portalen: ' + esc(er.message) + '</p>'); });
  }
  var link = fromLink();
  if (link && link.error) loginView('Länken fungerade inte (' + link.error + '). Be om en ny.', true);
  else if (DEMO) { if (/[?&]login\b/.test(location.search)) loginView(); else load(); }
  else if (readSession()) { st.email = readSession().email || ''; load(); }
  else loginView();
})();
