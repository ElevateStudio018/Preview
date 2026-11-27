/* Admin for elevatestudio.nu/admin: runs in the browser and talks straight to the database (Supabase).
 * Access is enforced by the database itself – only accounts with the admin role can read or change leads. */
(function () {
  var root = document.getElementById('admin');
  var sb = window.supabase.createClient(root.dataset.url, root.dataset.key);
  var REVIEW_URL = root.dataset.review;
  var MARK = '<svg viewBox="0 0 1884.3 1353.9" aria-hidden="true"><path d="M0.0 1353.9 L1218.7 0.0 L1218.7 329.1 L479.7 1136.4 L786.7 1132.4 L1215.5 687.4 L1884.3 1349.9 L1590.1 1349.9 L1218.6 994.7 L865.4 1349.9Z" fill="currentColor"/></svg>';
  var STATUS = [
    ['new', 'Ny', '#3b82f6'], ['contacted', 'Kontaktad', '#06b6d4'], ['meeting_to_book', 'Möte ska bokas in', '#d946ef'],
    ['meeting_booked', 'Möte inbokat', '#14b8a6'], ['meeting_rebook', 'Boka om möte', '#f97316'], ['meeting_held', 'Möte hållet', '#84cc16'],
    ['quote_sent', 'Offert skickad', '#6366f1'], ['waiting', 'Väntar svar', '#f59e0b'], ['negotiation', 'Förhandling', '#8b5cf6'],
    ['done', 'Klar', '#10b981'], ['sold', 'Såld', '#d4a017'], ['lost', 'Förlorad', '#f43f5e'], ['archived', 'Arkiverad', '#94a3b8']
  ];
  var MEETING = { manual: 'Manuellt tillagd', quote: 'Offertförfrågan', teams: 'Microsoft Teams', google_meet: 'Google Meet', phone: 'Telefonmöte' };
  var TEAM = [['Carl', 'Carl From'], ['Isak', 'Isak Mattsson'], ['Oscar', 'Oscar Svanerud']];
  var CLOSED = ['sold', 'lost', 'archived', 'done'];
  var GMAIL = 'elevate.studio018@gmail.com'; // all mail from the admin is sent from here (worker/invite.js)
  // Sends through the site's server (Gmail) – never opens a mail program. Resolves to 'sent' or an error text.
  function sendMail(body) {
    return sb.auth.getSession().then(function (r) {
      var token = r.data && r.data.session && r.data.session.access_token;
      return fetch('/api/mail', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (b) {
        if (res.ok) return b;
        if (b.error === 'not_configured') throw new Error('Gmail är inte kopplat än (se Integrationer).');
        if (b.error === 'auth') throw new Error('Du behöver logga in igen.');
        throw new Error(b.error || 'Fel ' + res.status);
      });
    }, function () { throw new Error('Servern svarade inte.'); });
  }
  // The four admin profiles; who is signed in decides the name in the menu and the default sender
  var PROFILES = [['carl', 'Carl From', 'carl@elevatestudio.nu'], ['isak', 'Isak Mattsson', 'isak@elevatestudio.nu'],
    // Oscar uses his Gmail until oskar@elevatestudio.nu is opened; both addresses (and oscar@) count as him
    ['oscar', 'Oscar Svanerud', 'svanerudo@gmail.com', ['todo', 'hemsidan', 'leads', 'vunna', 'arkiv', 'kalender', 'fakturor', 'statistik', 'besokare', 'konto'], ['oskar@elevatestudio.nu', 'oscar@elevatestudio.nu']],
    ['', 'Elevate Studio', 'info@elevatestudio.nu']];
  var profile = function (email) { email = String(email || '').toLowerCase(); return PROFILES.find(function (p) { return p[2] === email || (p[4] || []).indexOf(email) >= 0; }) || PROFILES[3]; };
  // A profile with a list sees only those pages (and no mail campaigns); the others see everything
  var allowed = function (view) { var only = profile(st.user && st.user.email)[3]; return !only || only.indexOf(view) >= 0; };
  // Whose lead it is: the leads table has no owner column, so the owner is a tag on the first line of
  // the comment ("[Oscar]"). It is hidden in the comment fields and shown as a badge instead.
  var OWNER_RE = /^\[(Carl|Isak|Oscar)\]\n?/, META_RE = /^(web|github|källa|mejl): ?(.*)$/;
  var ownerOf = function (l) { var m = OWNER_RE.exec((l && l.admin_notes) || ''); return m ? m[1] : ''; };
  // The old website and the new one on GitHub are lines like "web: https://…" at the top of the comment
  var metaOf = function (l) { var m = {}; ((l && l.admin_notes) || '').replace(OWNER_RE, '').split('\n').forEach(function (line) { var x = META_RE.exec(line.trim()); if (x) m[x[1]] = x[2].trim(); }); return m; };
  var noteOf = function (l) { return ((l && l.admin_notes) || '').replace(OWNER_RE, '').split('\n').filter(function (line) { return !META_RE.test(line.trim()); }).join('\n').trim(); };
  var withOwner = function (owner, note, meta) {
    meta = meta || {}; var lines = [];
    if (owner) lines.push('[' + owner + ']');
    if (meta.web) lines.push('web: ' + meta.web.trim());
    if (meta.github) lines.push('github: ' + meta.github.trim());
    if (meta['källa']) lines.push('källa: ' + meta['källa'].trim());
    if (meta.mejl) lines.push('mejl: ' + meta.mejl.trim());
    note = (note || '').trim(); if (note) lines.push(note);
    return lines.length ? lines.join('\n') : null;
  };
  // Carl, Isak and Oscar see their own leads and the ones nobody has taken yet; the Elevate account sees everyone's
  var myTag = function () { var p = profile(st.user && st.user.email); return p[0] ? p[1].split(' ')[0] : ''; };
  var canSee = function (l) { var m = myTag(); return !m || !ownerOf(l) || ownerOf(l) === m; };
  var me = function () { return profile(st.user && st.user.email)[1]; };
  var senderKey = function (who) { return (TEAM.find(function (t) { return t[1] === who || t[0] === who; }) || [''])[0].toLowerCase(); };
  var st = { user: null, leads: [], view: (location.hash.slice(1).match(/^[a-z]+$/) || ['todo'])[0], stage: 'all', q: '', sort: 'next', shown: 40, period: 90, arch: 'archived', webSrc: 'all' };

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sInfo = function (k) { return STATUS.find(function (s) { return s[0] === k; }) || STATUS[0]; };
  var kr = function (n) { return new Intl.NumberFormat('sv-SE').format(Math.round(n || 0)) + ' kr'; };
  var dt = function (iso, opts) { return iso ? new Date(iso).toLocaleString('sv-SE', opts || { dateStyle: 'medium', timeStyle: 'short' }) : '–'; };
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  function toast(text) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = text; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }
  var ICON = {
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
    msg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    menu: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.5 6.6-.8z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    door: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18M7 15l4-4 3 3 6-6"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M16 15h2M6 6V4h12v2"/></svg>',
    brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-2zM15 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/></svg>',
    plug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
    site: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>'
  };

  /* ---------- Login ---------- */
  // Passwords: at least 12 characters with both letters and digits (the same rule everywhere a password is chosen)
  var PW_RULE = 'minst 12 tecken, både bokstäver och siffror';
  function weakPw(pw, email) {
    pw = String(pw || '');
    if (pw.length < 12) return 'Lösenordet måste ha minst 12 tecken.';
    if (!/\p{L}/u.test(pw) || !/\d/.test(pw)) return 'Lösenordet måste innehålla både bokstäver och siffror.';
    if (email && pw.toLowerCase().indexOf(String(email).split('@')[0].toLowerCase()) >= 0) return 'Lösenordet får inte innehålla e-postadressen.';
    return '';
  }
  // Repeated wrong passwords: this browser waits longer and longer (1 min after 5 tries, then doubling, at most 15 min).
  // The database's own login limit applies on top of this, on the server.
  var LOCK = 'elevate-admin-login';
  function lockInfo() { try { return JSON.parse(localStorage.getItem(LOCK) || '{}'); } catch (e) { return {}; } }
  function lockSave(x) { try { localStorage.setItem(LOCK, JSON.stringify(x)); } catch (e) { /* private mode */ } }
  function lockedFor() { var x = lockInfo(); return Math.max(0, Math.ceil(((x.until || 0) - Date.now()) / 1000)); }
  function failed() {
    var x = lockInfo(); x.n = (x.n || 0) + 1;
    if (x.n >= 5) x.until = Date.now() + Math.min(15 * 60, 60 * Math.pow(2, x.n - 5)) * 1000;
    lockSave(x);
  }
  function lockText(sec) { return 'För många misslyckade försök. Vänta ' + (sec >= 60 ? Math.ceil(sec / 60) + ' min' : sec + ' sekunder') + ' och försök igen.'; }
  // After the password: a second step when the account has two-step verification turned on
  function gate(user) {
    if (!sb.auth.mfa) return start(user);
    return sb.auth.mfa.getAuthenticatorAssuranceLevel().then(function (r) {
      var a = (r && r.data) || {};
      if (a.nextLevel === 'aal2' && a.currentLevel !== 'aal2') return renderMfa(user);
      return start(user);
    }, function () { return start(user); });
  }
  function renderMfa(user, message) {
    root.innerHTML = '<div class="login"><aside class="login__side"><span class="brand">' + MARK + 'Elevate Studio</span>' +
      '<div><h1>Ett steg <span class="serif">till.</span></h1><p>Kontot har tvåstegsverifiering.</p></div><p>elevatestudio.nu</p><span class="login__big">' + MARK + '</span></aside>' +
      '<div class="login__form"><form class="login__card" id="mfa"><h2>Kod från appen</h2><p style="color:var(--muted);margin:0 0 22px">Öppna autentiseringsappen och skriv koden för Elevate Studio.</p>' +
      '<label class="field">Kod (6 siffror)<input class="input" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>' +
      '<button class="btn btn--block" type="submit">Logga in</button><p class="msg" id="mfa-msg">' + esc(message || '') + '</p>' +
      '<button type="button" class="link" id="mfa-out">Logga ut</button></form></div></div>';
    $('#mfa-out').addEventListener('click', function () { sb.auth.signOut().then(function () { renderLogin(); }); });
    $('#mfa').code.focus();
    $('#mfa').addEventListener('submit', function (e) {
      e.preventDefault();
      var wait = lockedFor(); if (wait) { $('#mfa-msg').textContent = lockText(wait); return; }
      var code = e.target.code.value.trim(), btn = $('button[type=submit]', e.target);
      btn.disabled = true;
      sb.auth.mfa.listFactors().then(function (f) {
        var t = ((f.data && f.data.totp) || []).filter(function (x) { return x.status === 'verified'; })[0];
        if (!t) throw new Error('none');
        return sb.auth.mfa.challengeAndVerify({ factorId: t.id, code: code });
      }).then(function (r) {
        if (r.error) throw r.error;
        lockSave({});
        return sb.auth.getUser().then(function (u) { return start((u.data && u.data.user) || user); });
      }).catch(function () { failed(); var w = lockedFor(); renderMfa(user, w ? lockText(w) : 'Koden stämmer inte. Försök igen med koden som visas nu.'); });
    });
  }
  function renderLogin(message) {
    root.innerHTML = '<div class="login"><aside class="login__side"><a class="brand" href="../index.html">' + MARK + 'Elevate Studio</a>' +
      '<div><h1>Välkommen <span class="serif">tillbaka.</span></h1><p>Leads, möten och offerter – samlat på ett ställe.</p></div><p>elevatestudio.nu</p>' +
      '<span class="login__big">' + MARK + '</span></aside>' +
      '<div class="login__form"><form class="login__card" id="login"><h2>Logga in</h2><p style="color:var(--muted);margin:0 0 22px">För Elevate-teamet.</p>' +
      '<label class="field">E-post<input class="input" type="email" name="email" autocomplete="email" required></label>' +
      '<label class="field">Lösenord<input class="input" type="password" name="password" autocomplete="current-password" required></label>' +
      '<button class="btn btn--block" type="submit">Logga in</button><p class="msg" id="login-msg">' + esc(message || '') + '</p>' +
      '<button type="button" class="link" id="forgot">Glömt lösenord?</button></form></div></div>';
    $('#forgot').addEventListener('click', function () {
      var email = $('#login').email.value.trim();
      if (!email) { $('#login-msg').textContent = 'Fyll i din e-post först, tryck sedan på Glömt lösenord.'; return; }
      // the same answer whether the address has a login or not (and whatever the server says), so nobody can test addresses
      var same = function () { $('#login-msg').textContent = 'Om adressen har en inloggning skickas en länk dit inom några minuter. Klicka på den för att välja ett nytt lösenord.'; };
      sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] }).then(same, same);
    });
    $('#login').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, btn = $('button', f);
      var wait = lockedFor(); if (wait) { $('#login-msg').textContent = lockText(wait); return; }
      btn.disabled = true; btn.textContent = 'Loggar in …';
      sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value }).then(function (r) {
        if (r.error) throw r.error;
        lockSave({});
        return gate(r.data.user);
      }).catch(function (err) {
        var m = err.message || '';
        if (err.status === 429 || /rate limit|too many/i.test(m)) return renderLogin('För många försök just nu. Vänta en stund och försök igen.');
        if (/invalid/i.test(m)) { failed(); var w = lockedFor(); if (w) return renderLogin(lockText(w)); }
        renderLogin(/not confirmed/i.test(m) ? 'E-posten är inte bekräftad än. Klicka först på länken i bekräftelsemejlet som skickades när inloggningen skapades.'
          : /invalid/i.test(m) ? 'Fel e-post eller lösenord – eller så finns ingen inloggning för den adressen än (den skapas under Konto → Profiler).' : m);
      });
    });
  }

  function start(user) {
    return sb.rpc('has_role', { _user_id: user.id, _role: 'admin' }).then(function (r) {
      if (r.error || !r.data) { sb.auth.signOut(); renderLogin('Kontot saknar admin-behörighet.'); return; }
      st.user = user;
      // a device where someone from the team logs in is not counted in the visitor statistics (assets/js/track.js)
      try { localStorage.setItem('es.team', '1'); } catch (e) { /* private mode */ }
      // and its profile is stored once a month, so older visits from this device can be hidden in Besökare (worker/track.js)
      try {
        if (Date.now() - Number(localStorage.getItem('es.team.reg') || 0) > 30 * 864e5) sb.auth.getSession().then(function (r) {
          return fetch('/api/team/device', { method: 'POST', headers: { Authorization: 'Bearer ' + (r.data.session ? r.data.session.access_token : '') } });
        }).then(function (r) { if (r.ok) localStorage.setItem('es.team.reg', String(Date.now())); }).catch(function () { /* tried again next login */ });
      } catch (e) { /* private mode */ }
      if (!VIEWS[st.view] || !allowed(st.view)) st.view = 'todo';
      renderShell();
      return loadLeads();
    });
  }

  /* ---------- Tooltip for bars: a slightly tilted speech bubble beside the bar ---------- */
  (function () {
    var tip = document.createElement('div'); tip.className = 'bubble'; tip.hidden = true; document.body.appendChild(tip);
    var cur = null;
    var hide = function () { if (cur) { cur.setAttribute('title', cur.dataset.tip); cur = null; } tip.hidden = true; };
    document.addEventListener('mouseover', function (e) {
      var el = e.target.closest && e.target.closest('.cols > div[title], .cols > div[data-tip], .barrow[title], .barrow[data-tip]');
      if (el === cur) return;
      hide(); if (!el) return;
      cur = el; el.dataset.tip = el.getAttribute('title') || el.dataset.tip; el.removeAttribute('title');
      tip.textContent = el.dataset.tip; tip.hidden = false;
      var r = el.getBoundingClientRect(), bar = el.querySelector('i') || el, br = bar.getBoundingClientRect();
      var right = r.right + tip.offsetWidth + 24 < innerWidth;
      tip.classList.toggle('bubble--left', !right);
      tip.style.left = (right ? br.right + 18 : br.left - tip.offsetWidth - 18) + scrollX + 'px';
      tip.style.top = (br.top + Math.min(br.height, 40) / 2 - tip.offsetHeight / 2 + scrollY) + 'px';
    });
    document.addEventListener('scroll', hide, true);
  })();

  /* ---------- Shell ---------- */
  var NAV = [
    ['Försäljning', [['todo', 'Att göra', 'inbox'], ['lage', 'Läget', 'plug'], ['hemsidan', 'Från hemsidan', 'site'], ['leads', 'Alla leads', 'layers'], ['vunna', 'Vunna', 'star'], ['kalender', 'Kalender', 'cal'], ['kontakter', 'Kontakter', 'users'], ['fakturor', 'Fakturor', 'file']]],
    ['Marknadsföring', [['utskick', 'Utskick', 'send'], ['segment', 'Segment', 'layers'], ['besokare', 'Besökare', 'eye'], ['sokord', 'Sökord på Google', 'chart'], ['recensioner', 'Recensioner', 'star'], ['chatten', 'Chatten', 'msg'], ['sajttester', 'Sajttester', 'chart'], ['nyhetsbrev', 'Nyhetsbrev', 'send']]],
    ['Mer', [['statistik', 'Statistik', 'chart'], ['arkiv', 'Arkiv', 'door'], ['konton', 'Konton', 'users'], ['import', 'Importera leads', 'inbox'], ['kundportal', 'Kundportal', 'door'], ['ai', 'AI-assistent', 'spark'], ['insikter', 'Insikter', 'chart'],
      ['bestallningar', 'Beställningar', 'file'], ['ekonomi', 'Ekonomi', 'wallet'], ['minne', 'AI-minne', 'brain'], ['integrationer', 'Integrationer', 'plug'], ['konto', 'Mitt konto', 'user']], true]
  ];
  var BADGE = { todo: 1, hemsidan: 1, leads: 1, vunna: 1, arkiv: 1 };
  var VIEWS = {};
  NAV.forEach(function (g) { g[1].forEach(function (v) { VIEWS[v[0]] = v[1]; }); });

  function renderShell() {
    root.innerHTML = '<div class="shell" id="shell"><aside class="side"><a class="brand" href="../index.html">' + MARK + 'Elevate Studio</a><nav class="side__nav">' +
      NAV.map(function (g) {
        var items = g[1].filter(function (v) { return allowed(v[0]); });
        if (!items.length) return '';
        var list = items.map(function (v) { return '<button class="nav" data-view="' + v[0] + '">' + ICON[v[2]] + v[1] + (BADGE[v[0]] ? '<em class="nav__n" data-n="' + v[0] + '" hidden></em>' : '') + '</button>'; }).join('');
        var inside = items.some(function (v) { return v[0] === st.view; });
        return g[2] ? '<details class="side__more"' + (inside ? ' open' : '') + '><summary>' + g[0] + '</summary>' + list + '</details>' : '<small>' + g[0] + '</small>' + list;
      }).join('') + '</nav>' +
      '<div class="side__foot"><div class="side__me"><b>' + esc(me()) + '</b><br>' + esc(st.user.email) + '</div><a class="nav" href="../index.html">' + ICON.site + 'Till hemsidan</a><button class="nav" id="logout">' + ICON.out + 'Logga ut</button></div></aside>' +
      '<div><div class="top"><button id="menu" aria-label="Meny">' + ICON.menu + '</button><span class="brand">' + MARK + 'Admin</span></div><main id="main"></main></div></div>';
    root.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () { go(b.dataset.view); });
    });
    $('#logout').addEventListener('click', function () { sb.auth.signOut().then(function () { st.user = null; history.replaceState(null, '', location.pathname); renderLogin(); }); });
    $('#menu').addEventListener('click', function () { $('#shell').classList.toggle('is-menu'); });
  }
  function go(view) {
    st.view = view; $('#shell').classList.remove('is-menu');
    history.replaceState(null, '', '#' + view); window.scrollTo(0, 0); render();
  }

  function loadLeads() {
    $('#main').innerHTML = '<p class="empty">Hämtar leads …</p>';
    return sb.from('quote_requests').select('*').order('created_at', { ascending: false }).limit(2000).then(function (r) {
      if (r.error) { $('#main').innerHTML = '<p class="empty">Kunde inte hämta leads: ' + esc(r.error.message) + '</p>'; return; }
      st.leads = (r.data || []).filter(canSee);
      render();
      syncBookings();
      mergeChatLeads();
    });
  }
  // A visitor who gives an e-mail address and later a phone number in the same chat conversation can make two leads
  // (when the server has no key to update the first). They share "chatt: <id>" in the notes: the oldest keeps the
  // details of the others, which are then removed.
  function mergeChatLeads() {
    var groups = {};
    st.leads.forEach(function (l) { var m = /chatt: ([a-z0-9]{6,40})/.exec(l.admin_notes || ''); if (m) (groups[m[1]] = groups[m[1]] || []).push(l); });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k]; if (g.length < 2) return;
      g.sort(function (a, b) { return Date.parse(a.created_at) - Date.parse(b.created_at); });
      var keep = g[0], rest = g.slice(1), patch = {}, notes = [];
      rest.forEach(function (x) {
        if (x.email && !keep.email && !patch.email) patch.email = x.email; else if (x.email && x.email !== (patch.email || keep.email)) notes.push('E-post: ' + x.email);
        if (x.phone && !keep.phone && !patch.phone) patch.phone = x.phone; else if (x.phone && x.phone !== (patch.phone || keep.phone)) notes.push('Telefon: ' + x.phone);
      });
      notes.push('Kompletterat i samma chatt ' + rest.map(function (x) { return dt(x.created_at); }).join(', ') + '.');
      patch.message = ((keep.message || '') + '\n\n' + notes.join('\n')).slice(0, 2000);
      update(keep.id, patch).then(function () {
        return Promise.all(rest.map(function (x) { return sb.from('quote_requests').delete().eq('id', x.id); }));
      }).then(function () {
        var gone = rest.map(function (x) { return x.id; });
        st.leads = st.leads.filter(function (x) { return gone.indexOf(x.id) < 0; });
        render();
      }).catch(function () { /* left as two leads; nothing is lost */ });
    });
  }

  function render() {
    root.querySelectorAll('.nav[data-view]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.view === st.view); });
    if (!allowed(st.view)) st.view = 'todo';
    syncBadges();
    var fn = PAGES[st.view];
    if (fn) return fn();
    renderTodo();
  }

  /* ---------- Leads: one next step per lead ---------- */
  var OWNER_COLOR = { Carl: '#1d3b2a', Isak: '#2a7f78', Oscar: '#8a6a1f' };
  var STAGE = { new: 'Ny', contacted: 'Kontakt', meeting_to_book: 'Möte', meeting_booked: 'Möte', meeting_rebook: 'Möte', meeting_held: 'Offert', quote_sent: 'Offert', waiting: 'Offert', negotiation: 'Offert', sold: 'Vunnen', done: 'Vunnen', lost: 'Förlorad', archived: 'Arkiverad' };
  var STAGES = [['all', 'Alla'], ['Ny', 'Ny'], ['Kontakt', 'Kontakt'], ['Möte', 'Möte'], ['Offert', 'Offert']];
  var WON = ['sold', 'done'], GONE = ['lost', 'archived'];
  var isOpen = function (l) { return CLOSED.indexOf(l.status || 'new') < 0; };
  var openLeads = function () { return st.leads.filter(isOpen); };
  function lead(id) { return st.leads.find(function (l) { return l.id === id; }); }
  function update(id, patch) {
    return sb.from('quote_requests').update(patch).eq('id', id).select().then(function (r) {
      if (r.error) throw r.error;
      if (!r.data || !r.data.length) throw new Error('Ändringen sparades inte – saknar kontot admin-behörighet?');
      Object.assign(lead(id), r.data[0]);
    });
  }
  var BTN = { call: 'Ring', propose: 'Låt kunden välja tid', offer: 'Skapa offert', mail: 'Mejla', remind: 'Påminn', open: 'Öppna', meet: 'Öppna mötet' };
  // The five steps of a lead's journey; a tap on a step moves the lead there
  var STEPS = ['Ny', 'Kontakt', 'Möte', 'Offert', 'Vunnen'], STEP_STATUS = ['new', 'contacted', 'meeting_to_book', 'quote_sent', 'sold'];
  function steps(l) {
    var cur = STEPS.indexOf(STAGE[l.status || 'new']); if (cur < 0) return '';
    return '<div class="steps">' + STEPS.map(function (s, i) {
      return (i ? '<i' + (i <= cur ? ' class="on"' : '') + '></i>' : '') + '<button type="button" class="step' + (i < cur ? ' done' : i === cur ? ' cur' : '') + '" data-step="' + i + '" title="' + (i === cur ? 'Här är leaden nu' : 'Flytta till ' + s) + '"><span>' + (i < cur ? '&#10003;' : i + 1) + '</span><small>' + s + '</small></button>';
    }).join('') + '</div>';
  }
  // The first thing Carl, Isak or Oscar does with an unassigned lead makes it theirs
  function claim(l) {
    var m = myTag(); if (!m || ownerOf(l)) return Promise.resolve(l);
    return update(l.id, { admin_notes: withOwner(m, noteOf(l), metaOf(l)) }).then(function (x) { toast('Leaden är nu din'); return x || l; });
  }
  function moveTo(l, i) {
    if (i === 4) return openSold(l);
    var status = i === 2 && l.booking_at && Date.parse(l.booking_at) > Date.now() ? 'meeting_booked' : STEP_STATUS[i];
    if (status === (l.status || 'new')) return openLead(l);
    claim(l).then(function () { return update(l.id, { status: status }); }).then(function () { render(); toast('Flyttad till ' + STEPS[i]); }).catch(function (err) { toast(err.message); });
  }
  // What comes next in each status, what the button does, and how many days it may wait
  var NEXT = { new: ['Ring upp', 'call', 1], contacted: ['Boka ett möte', 'propose', 2], meeting_to_book: ['Väntar på att kunden väljer tid', 'remind', 3], meeting_rebook: ['Boka om mötet', 'propose', 0],
    meeting_held: ['Skicka offert', 'offer', 1], quote_sent: ['Följ upp offerten', 'mail', 3], waiting: ['Påminn om offerten', 'mail', 5], negotiation: ['Avsluta affären', 'open', 2] };
  function nextStep(l) {
    var s = l.status || 'new', now = Date.now();
    var bk = l.booking_at ? Date.parse(l.booking_at) : 0, fu = l.followup_at ? Date.parse(l.followup_at) : 0;
    if (s === 'meeting_booked' && bk) {
      return bk > now - 36e5 ? { label: 'Möte ' + dt(l.booking_at, { weekday: 'short', hour: '2-digit', minute: '2-digit' }), due: bk, act: 'meet' } : { label: 'Mötet är över – hur gick det?', due: now, act: 'open' };
    }
    var n = NEXT[s]; if (!n) return null;
    var base = Date.parse(l.updated_at || l.created_at) || now;
    return { label: n[0], due: fu || base + n[2] * 864e5, act: n[1] };
  }
  var endOfDay = function (ms) { var d = new Date(ms); d.setHours(23, 59, 59, 999); return d.getTime(); };
  function bucketOf(due) {
    var today = endOfDay(Date.now());
    return due <= today ? 'today' : due <= today + 864e5 ? 'tomorrow' : due <= today + 6 * 864e5 ? 'week' : 'later';
  }
  function dueText(due) {
    var today = endOfDay(Date.now());
    if (due < today - 864e5) return 'försenat · ' + day(new Date(due).toISOString());
    if (due <= today) return 'idag';
    if (due <= today + 864e5) return 'imorgon';
    return new Date(due).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' });
  }

  function row(l, opts) {
    opts = opts || {};
    var s = sInfo(l.status || 'new'), n = isOpen(l) ? nextStep(l) : null, o = ownerOf(l);
    var right = n ? '<b>' + esc(n.label) + '</b><small>' + esc(dueText(n.due)) + '</small>'
      : WON.indexOf(s[0]) >= 0 ? '<b>' + (l.sold_amount != null ? kr(l.sold_amount) : 'Såld') + '</b><small>' + day(l.sold_at || l.created_at) + '</small>'
      : '<b>' + esc(s[1]) + '</b><small>' + day(l.created_at) + '</small>';
    var acts = opts.actions != null ? opts.actions : (n ? primary(l, n) : '');
    return '<article class="row" data-id="' + l.id + '" style="--c:' + s[2] + '">' +
      '<span class="av"' + (o ? ' style="--c:' + OWNER_COLOR[o] + '"' : ' data-none') + ' title="' + esc(o || 'Ingen ansvarig') + '">' + (o ? o.charAt(0) : '?') + '</span>' +
      '<div class="row__who"><b>' + esc(l.name) + (o && o === myTag() ? ' <em class="mine">Min</em>' : o ? ' <em class="whose" style="--c:' + OWNER_COLOR[o] + '">' + esc(o) + 's</em>' : ' <em class="free">Ej tilldelad</em>') + '</b><span>' + esc(l.company || l.service_type || MEETING[l.meeting_type] || 'Förfrågan') + '</span>' + (opts.tag || '') + '</div>' +
      (isOpen(l) ? steps(l) : '<span class="stg"><i></i>' + esc(STAGE[s[0]] || s[1]) + '</span>') +
      '<div class="row__next">' + right + '</div>' +
      '<div class="row__acts">' + acts + '<button class="iconbtn iconbtn--sm" data-act="open" aria-label="Öppna">&#8250;</button></div></article>';
  }
  function primary(l, n) {
    if (n.act === 'call') return l.phone ? '<a class="btn btn--sm" href="tel:' + esc(l.phone) + '" data-act="called">' + ICON.phone + 'Ring</a>' : '<button class="btn btn--sm" data-act="open">Öppna</button>';
    return '<button class="btn btn--sm' + (n.act === 'open' || n.act === 'meet' ? ' btn--ghost' : '') + '" data-act="' + n.act + '">' + esc(BTN[n.act]) + '</button>';
  }
  function bindRows() {
    root.querySelectorAll('.row').forEach(function (el) {
      el.addEventListener('click', function (e) {
        var l = lead(el.dataset.id); if (!l) return;
        var a = e.target.closest('[data-act]');
        if (!a && !e.target.closest('[data-step]')) { if (!e.target.closest('a, button')) openLead(l); return; }
        var step = e.target.closest('[data-step]');
        if (step) { e.preventDefault(); return moveTo(l, Number(step.dataset.step)); }
        var act = a.dataset.act;
        if (act === 'called') { markContacted(l); return; }
        e.preventDefault();
        if (act === 'open' || act === 'meet') openLead(l);
        if (act === 'propose') proposeTimes(l);
        if (act === 'offer') openOffer(l);
        if (act === 'mail' || act === 'remind') composeMail(l);
        if (act === 'review') openReview(l);
        if (act === 'delete') removeLead(l);
        if (act === 'reopen') update(l.id, { status: 'contacted' }).then(function () { render(); toast('Leaden är öppen igen och ligger under Alla leads'); }).catch(function (err) { toast(err.message); });
      });
    });
  }
  // Ring from the list: a new lead becomes "kontaktad", with a reminder to call again in two days
  function markContacted(l) {
    claim(l);
    if ((l.status || 'new') !== 'new') return;
    var fu = new Date(Date.now() + 2 * 864e5); fu.setHours(9, 0, 0, 0);
    update(l.id, { status: 'contacted', followup_at: fu.toISOString() }).then(function () { render(); toast('Markerad som kontaktad. Dyker upp igen ' + fu.toLocaleDateString('sv-SE', { weekday: 'long' }) + '.'); }).catch(function () {});
  }
  function removeLead(l, after) {
    if (!confirm('Ta bort ' + l.name + ' för gott? Det går inte att ångra.')) return;
    sb.from('quote_requests').delete().eq('id', l.id).select().then(function (r) {
      if (r.error || !r.data || !r.data.length) return toast(r.error ? r.error.message : 'Kunde inte ta bort.');
      st.leads = st.leads.filter(function (x) { return x.id !== l.id; }); if (after) after(); render(); toast('Leaden är borttagen');
    });
  }
  function section(title, rows, empty) {
    if (!rows.length && !empty) return '';
    return '<h2 class="sec">' + title + (rows.length ? ' <em>' + rows.length + '</em>' : '') + '</h2>' + (rows.length ? rows.map(function (l) { return row(l); }).join('') : '<p class="empty empty--sm">' + empty + '</p>');
  }
  function syncBadges() {
    var n = { todo: 0, hemsidan: webLeads().filter(function (l) { return (l.status || 'new') === 'new' || mailFailed(l); }).length, leads: openLeads().length, vunna: 0, arkiv: 0 };
    openLeads().forEach(function (l) { var x = nextStep(l); if (x && bucketOf(x.due) === 'today') n.todo++; });
    st.leads.forEach(function (l) { if (WON.indexOf(l.status) >= 0) n.vunna++; if (GONE.indexOf(l.status) >= 0) n.arkiv++; });
    root.querySelectorAll('[data-n]').forEach(function (e) { e.textContent = n[e.dataset.n] || ''; e.hidden = !n[e.dataset.n]; });
  }

  /* Att göra: today's list, then tomorrow and the rest of the week */
  function renderTodo() {
    var h = new Date().getHours(), greet = h < 10 ? 'God morgon' : h < 17 ? 'Hej' : 'God kväll', first = me().split(' ')[0];
    var items = openLeads().map(function (l) { return { l: l, n: nextStep(l) }; }).filter(function (x) { return x.n; }).sort(function (a, b) { return a.n.due - b.n.due; });
    var b = { today: [], tomorrow: [], week: [], later: [] };
    items.forEach(function (x) { b[bucketOf(x.n.due)].push(x.l); });
    var eod = endOfDay(Date.now()), sod = eod - 864e5 + 1;
    var meetings = st.leads.filter(function (l) { var x = l.booking_at && Date.parse(l.booking_at); return x && x >= sod && x <= eod; }).length;
    var waiting = st.leads.filter(function (l) { return ['quote_sent', 'waiting', 'negotiation'].indexOf(l.status) >= 0; }).length;
    main().innerHTML = head(greet + ', ' + esc(first), b.today.length ? b.today.length + (b.today.length === 1 ? ' sak' : ' saker') + ' idag. Sen är du klar.' : 'Inget som brådskar idag.', '<button class="btn" id="newlead">+ Ny lead</button>') +
      '<div class="focus"><div class="f is-hot"><b>' + b.today.length + '</b><span>att göra idag</span></div><button class="f" id="f-cal"><b>' + meetings + '</b><span>möten idag</span></button><button class="f" id="f-off"><b>' + waiting + '</b><span>offerter som väntar svar</span></button></div>' +
      teamStrip() +
      section('Idag', b.today, 'Inget idag – bra jobbat.') + section('Imorgon', b.tomorrow, '') + section('Senare i veckan', b.week, '') +
      (b.later.length ? section('Längre fram', b.later.slice(0, 8)) + (b.later.length > 8 ? '<p class="muted small">… och ' + (b.later.length - 8) + ' till under Alla leads.</p>' : '') : '') +
      (!items.length ? '<p class="empty">Inga öppna leads. Lägg in en med knappen uppe till höger.</p>' : '');
    $('#newlead').addEventListener('click', newLead);
    $('#f-cal').addEventListener('click', function () { go('kalender'); });
    $('#f-off').addEventListener('click', function () { st.stage = 'Offert'; go('leads'); });
    if ($('#team')) $('#team').addEventListener('click', function () { go('statistik'); });
    bindRows();
  }

  // The team's closing rate the last 90 days, one chip per person; opens the statistics
  function teamStrip() {
    var rows = personRows(90).filter(function (r) { return r.who && (r.won || r.lost || r.open); });
    if (!rows.length) return '';
    return '<button class="team" id="team" title="Öppna statistiken">' + rows.map(function (r) {
      return '<span class="team__p"><span class="av" style="--c:' + OWNER_COLOR[r.who] + '">' + r.who.charAt(0) + '</span>' + esc(r.who) + ' <b>' + (r.rate == null ? '–' : r.rate + ' %') + '</b>' + (r.amount ? ' · ' + kr(r.amount) : '') + '</span>';
    }).join('') + '<span class="team__lbl">closing rate · 90 dagar</span></button>';
  }

  /* Alla leads: the open ones, with search and a stage filter */
  function filtered() {
    var q = st.q.toLowerCase();
    var rows = openLeads().filter(function (l) {
      if (st.stage !== 'all' && STAGE[l.status || 'new'] !== st.stage) return false;
      if (!q) return true;
      return [l.name, l.company, l.email, l.phone, l.service_type, l.admin_notes].some(function (v) { return v && String(v).toLowerCase().indexOf(q) > -1; });
    });
    if (st.sort === 'next') return rows.map(function (l) { return [l, (nextStep(l) || { due: Infinity }).due]; }).sort(function (a, b) { return a[1] - b[1]; }).map(function (x) { return x[0]; });
    var key = st.sort.indexOf('booking') === 0 ? 'booking_at' : 'created_at', asc = /asc$/.test(st.sort);
    return rows.sort(function (a, b) {
      var x = a[key] ? Date.parse(a[key]) : (asc ? Infinity : -Infinity), y = b[key] ? Date.parse(b[key]) : (asc ? Infinity : -Infinity);
      return asc ? x - y : y - x;
    });
  }
  function renderLeads() {
    var rows = filtered(), counts = {}, all = openLeads();
    all.forEach(function (l) { var k = STAGE[l.status || 'new']; counts[k] = (counts[k] || 0) + 1; });
    main().innerHTML = head('Alla leads', 'Alla öppna leads. Klicka på en rad för allt om kunden.',
      '<button class="btn btn--ghost" id="csv">' + ICON.chart + 'Exportera</button><button class="btn btn--ghost" id="meeting">' + ICON.cal + 'Boka möte</button><button class="btn" id="newlead">+ Ny lead</button>') +
      '<div class="bar"><input class="input" id="q" placeholder="Sök namn, företag, mejl, kommentar …" value="' + esc(st.q) + '">' +
      '<select class="input" id="sort"><option value="next">Nästa steg först</option><option value="created_desc">Nyast först</option><option value="created_asc">Äldst först</option><option value="booking_asc">Möte: närmast</option></select></div>' +
      '<div class="seg">' + STAGES.map(function (s) { var n = s[0] === 'all' ? all.length : counts[s[0]]; return '<button class="seg__b' + (st.stage === s[0] ? ' is-on' : '') + '" data-stage="' + s[0] + '">' + s[1] + (n ? ' <em>' + n + '</em>' : '') + '</button>'; }).join('') + '</div>' +
      '<div class="list">' + (rows.slice(0, st.shown).map(function (l) { return row(l); }).join('') || '<p class="empty">Inga leads här.</p>') + '</div>' +
      (rows.length > st.shown ? '<button class="btn btn--ghost more" id="more">Visa fler (' + (rows.length - st.shown) + ' kvar)</button>' : '');
    $('#sort').value = st.sort;
    $('#q').addEventListener('input', function (e) { st.q = e.target.value; st.shown = 40; var pos = e.target.selectionStart; renderLeads(); var n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); });
    $('#sort').addEventListener('change', function (e) { st.sort = e.target.value; renderLeads(); });
    root.querySelectorAll('[data-stage]').forEach(function (b) { b.addEventListener('click', function () { st.stage = b.dataset.stage; st.shown = 40; renderLeads(); }); });
    if ($('#more')) $('#more').addEventListener('click', function () { st.shown += 40; renderLeads(); });
    $('#newlead').addEventListener('click', newLead);
    $('#meeting').addEventListener('click', function () { bookMeeting(); });
    $('#csv').addEventListener('click', exportCsv);
    bindRows();
  }

  /* Från hemsidan: everything that came in through the site – the forms, the order page, the chat, the site test,
     the shop and bookings. The server saves each one here first and notes whether the mail reached the inbox, so
     nothing is missed even if the mail fails. */
  var sourceOf = function (l) { return metaOf(l)['källa'] || (l.meeting_type === 'quote' ? 'Hemsidan' : ''); };
  var mailOf = function (l) { return metaOf(l).mejl || ''; };
  var mailFailed = function (l) { return /kom inte fram/i.test(mailOf(l)); };
  function webLeads() { return st.leads.filter(function (l) { return sourceOf(l) && GONE.indexOf(l.status) < 0; }).sort(function (a, b) { return Date.parse(b.created_at) - Date.parse(a.created_at); }); }
  function renderWeb() {
    var all = webLeads(), srcs = {};
    all.forEach(function (l) { var k = sourceOf(l); srcs[k] = (srcs[k] || 0) + 1; });
    var rows = all.filter(function (l) { return st.webSrc === 'all' || (st.webSrc === 'new' ? (l.status || 'new') === 'new' : st.webSrc === 'fail' ? mailFailed(l) : sourceOf(l) === st.webSrc); });
    var failed = all.filter(mailFailed), fresh = all.filter(function (l) { return (l.status || 'new') === 'new'; });
    var tag = function (l) {
      var m = mailOf(l), cls = !m ? '' : /inkorgen|bekräftelse skickad/i.test(m) ? 'ok' : mailFailed(l) ? 'bad' : 'warn';
      return '<span class="webtags"><em class="webtag">' + esc(sourceOf(l)) + '</em>' + (m ? '<em class="webtag webtag--' + cls + '" title="' + esc(m) + '">' + (cls === 'ok' ? (/bekräftelse/i.test(m) ? 'Bekräftelse skickad' : 'Mejl i inkorgen') : cls === 'bad' ? 'Mejlet kom inte fram' : 'Mejl: ' + esc(m.split(' (')[0])) + '</em>' : '') + '<small>' + dt(l.created_at) + '</small></span>';
    };
    var segs = [['all', 'Alla', all.length], ['new', 'Nya', fresh.length]].concat(failed.length ? [['fail', 'Mejlet kom inte fram', failed.length]] : [])
      .concat(Object.keys(srcs).sort().map(function (k) { return [k, k, srcs[k]]; }));
    main().innerHTML = head('Från hemsidan', 'Allt som kommit in via hemsidan: formulären, beställningssidan, chatten, sajttestet, webbshoppen och bokningar. Varje förfrågan sparas här först – även om mejlet skulle strula.') +
      '<p class="webcheck" id="webcheck">Kontrollerar mejlkopplingen till Gmail …</p>' +
      (failed.length ? '<div class="webalert"><b>' + failed.length + (failed.length === 1 ? ' förfrågan' : ' förfrågningar') + ' kom inte fram som mejl.</b> De finns i listan nedan, så inget är förlorat – svara kunden härifrån.</div>' : '') +
      '<div class="seg">' + segs.map(function (x) { return '<button class="seg__b' + (st.webSrc === x[0] ? ' is-on' : '') + '" data-src="' + esc(x[0]) + '">' + esc(x[1]) + (x[2] ? ' <em>' + x[2] + '</em>' : '') + '</button>'; }).join('') + '</div>' +
      '<div class="list">' + (rows.map(function (l) { return row(l, { tag: tag(l) }); }).join('') || '<p class="empty">Inga förfrågningar från hemsidan här än.</p>') + '</div>';
    root.querySelectorAll('[data-src]').forEach(function (b) { b.addEventListener('click', function () { st.webSrc = b.dataset.src; renderWeb(); }); });
    bindRows();
    // Live check: can the server still log in to Gmail and put mail in the inbox?
    var box = $('#webcheck'), show = function (ok, text) { if (!box) return; box.className = 'webcheck webcheck--' + (ok ? 'ok' : 'bad'); box.textContent = text; };
    if (st.mailCheck && Date.now() - st.mailCheck.at < 5 * 6e4) return show(st.mailCheck.ok, st.mailCheck.text);
    sb.auth.getSession().then(function (r) {
      var token = r.data && r.data.session && r.data.session.access_token;
      return fetch('/api/enquiry/check', { headers: { Authorization: 'Bearer ' + token } }).then(function (res) { return res.json(); });
    }).then(function (b) {
      var text = b.ok ? 'Mejlkopplingen fungerar – nya förfrågningar hamnar i inkorgen i ' + (b.to || 'Gmail') + '. Kontrollerad ' + new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) + '.'
        : 'Mejlkopplingen fungerar inte just nu (' + (b.detail || b.error || 'okänt fel') + '). Förfrågningarna sparas ändå här – håll koll på listan tills det är löst.';
      st.mailCheck = { at: Date.now(), ok: !!b.ok, text: text }; show(b.ok, text);
    }).catch(function () { show(false, 'Kunde inte kontrollera mejlkopplingen. Förfrågningarna sparas ändå här.'); });
  }

  /* Vunna: the sold ones, with the amounts */
  function renderWon() {
    var rows = st.leads.filter(function (l) { return WON.indexOf(l.status) >= 0; }).sort(function (a, b) { return Date.parse(b.sold_at || b.created_at) - Date.parse(a.sold_at || a.created_at); });
    var sum = function (L) { return L.reduce(function (s, l) { return s + Number(l.sold_amount || 0); }, 0); };
    var year = rows.filter(function (l) { return l.sold_at && Date.now() - Date.parse(l.sold_at) < 365 * 864e5; });
    main().innerHTML = head('Vunna affärer', rows.length + (rows.length === 1 ? ' affär' : ' affärer') + ' · ' + kr(sum(rows)) + ' totalt' + (year.length ? ' · ' + kr(sum(year)) + ' senaste året' : '')) +
      '<div class="list">' + (rows.map(function (l) { return row(l, { actions: l.email ? '<button class="btn btn--sm btn--ghost" data-act="review">' + ICON.star + 'Be om recension</button>' : '' }); }).join('') || '<p class="empty">Inga vunna affärer än.</p>') + '</div>';
    bindRows();
  }

  /* Arkiv: archived and lost leads, out of the way but never gone */
  function renderArchive() {
    var count = function (s) { return st.leads.filter(function (l) { return l.status === s; }).length; };
    var rows = st.leads.filter(function (l) { return l.status === st.arch; }).sort(function (a, b) { return Date.parse(b.created_at) - Date.parse(a.created_at); });
    main().innerHTML = head('Arkiv', 'Arkiverade och förlorade leads ligger här, utanför listorna. De kan öppnas igen när som helst.') +
      '<div class="seg"><button class="seg__b' + (st.arch === 'archived' ? ' is-on' : '') + '" data-arch="archived">Arkiverade <em>' + count('archived') + '</em></button><button class="seg__b' + (st.arch === 'lost' ? ' is-on' : '') + '" data-arch="lost">Förlorade <em>' + count('lost') + '</em></button></div>' +
      '<div class="list">' + (rows.map(function (l) { return row(l, { actions: '<button class="btn btn--sm btn--ghost" data-act="reopen">Öppna igen</button><button class="btn btn--sm btn--ghost" data-act="delete">Ta bort</button>' }); }).join('') || '<p class="empty">Tomt här.</p>') + '</div>';
    root.querySelectorAll('[data-arch]').forEach(function (b) { b.addEventListener('click', function () { st.arch = b.dataset.arch; renderArchive(); }); });
    bindRows();
  }

  /* Statistik: who closes most, and the funnel */
  function personRows(days) {
    var from = days ? Date.now() - days * 864e5 : 0, inP = function (iso) { return !!iso && Date.parse(iso) >= from; };
    return [['Carl', 'Carl From'], ['Isak', 'Isak Mattsson'], ['Oscar', 'Oscar Svanerud'], ['', 'Ingen ansvarig']].map(function (p) {
      var L = st.leads.filter(function (l) { return ownerOf(l) === p[0]; });
      var won = L.filter(function (l) { return WON.indexOf(l.status) >= 0 && inP(l.sold_at || l.created_at); });
      var lost = L.filter(function (l) { return l.status === 'lost' && inP(l.created_at); }).length;
      var amount = won.reduce(function (s, l) { return s + Number(l.sold_amount || 0); }, 0);
      return { who: p[0], name: p[1], leads: L.filter(function (l) { return inP(l.created_at); }).length, meetings: L.filter(function (l) { return inP(l.booking_at); }).length,
        open: L.filter(isOpen).length, won: won.length, lost: lost, amount: amount, rate: won.length + lost ? Math.round(won.length / (won.length + lost) * 100) : null };
    }).filter(function (r) { return r.leads || r.won || r.lost || r.open; });
  }
  function renderStats() {
    var rows = personRows(st.period), from = st.period ? Date.now() - st.period * 864e5 : 0, inP = function (iso) { return !!iso && Date.parse(iso) >= from; };
    var L = st.leads.filter(function (l) { return inP(l.created_at); });
    var f = [L.length, L.filter(function (l) { return (l.status || 'new') !== 'new'; }).length, L.filter(function (l) { return !!l.booking_at; }).length,
      L.filter(function (l) { return ['quote_sent', 'waiting', 'negotiation', 'sold', 'done'].indexOf(l.status) >= 0; }).length, L.filter(function (l) { return WON.indexOf(l.status) >= 0; }).length];
    var won = rows.reduce(function (s, r) { return s + r.won; }, 0), lost = rows.reduce(function (s, r) { return s + r.lost; }, 0), amount = rows.reduce(function (s, r) { return s + r.amount; }, 0);
    var cell = function (v) { return '<td>' + v + '</td>'; };
    main().innerHTML = head('Statistik', 'Vem closar mest, och hur tratten ser ut.') +
      '<div class="seg">' + [[30, '30 dagar'], [90, '90 dagar'], [365, 'Ett år'], [0, 'Allt']].map(function (p) { return '<button class="seg__b' + (st.period === p[0] ? ' is-on' : '') + '" data-period="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
      '<div class="stats"><section class="st"><h3>Closing rate</h3>' + (rows.length ? rows.map(function (r) {
        return '<div class="pr"><span class="av"' + (r.who ? ' style="--c:' + OWNER_COLOR[r.who] + '"' : ' data-none') + '>' + (r.who ? r.who.charAt(0) : 'E') + '</span><span>' + esc(r.who || 'Ingen') + '</span><i style="--w:' + (r.rate || 0) + '%"></i><b>' + (r.rate == null ? '–' : r.rate + ' %') + '</b></div>';
      }).join('') : '<p class="muted">Inga leads i perioden.</p>') + '<p class="muted small" style="margin:10px 0 0">Vunna delat med vunna + förlorade.</p></section>' +
      '<section class="st"><h3>Tratten</h3><div class="fun">' + f.map(function (n, i) { return '<div style="--o:' + (0.35 + i * 0.16) + ';height:' + (f[0] ? Math.max(20, Math.round(n / f[0] * 100)) : 20) + '%">' + n + '</div>'; }).join('') + '</div><div class="lbls"><span>Leads</span><span>Kontakt</span><span>Möte</span><span>Offert</span><span>Vunna</span></div></section>' +
      '<section class="st"><h3>Sålt</h3><div class="big">' + kr(amount) + '<small>' + won + (won === 1 ? ' affär' : ' affärer') + (won ? ' · snitt ' + kr(amount / won) : '') + (won + lost ? ' · closing rate ' + Math.round(won / (won + lost) * 100) + ' %' : '') + '</small></div></section></div>' +
      '<div class="tbl"><table><thead><tr><th>Person</th><th>Leads</th><th>Möten</th><th>Öppna nu</th><th>Vunna</th><th>Förlorade</th><th>Closing rate</th><th>Sålt</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td><b>' + esc(r.name) + '</b></td>' + cell(r.leads) + cell(r.meetings) + cell(r.open) + cell(r.won) + cell(r.lost) + cell(r.rate == null ? '–' : r.rate + ' %') + cell(kr(r.amount)) + '</tr>'; }).join('') +
      '<tr class="tot"><td>Alla</td>' + cell(f[0]) + cell(rows.reduce(function (s, r) { return s + r.meetings; }, 0)) + cell(openLeads().length) + cell(won) + cell(lost) + cell(won + lost ? Math.round(won / (won + lost) * 100) + ' %' : '–') + cell(kr(amount)) + '</tr></tbody></table></div>' +
      '<p class="muted small" style="margin-top:10px">Ansvarig sätts i leadens fönster. Leads, möten och förlorade räknas på när leaden kom in; vunna på när affären stängdes.</p>';
    root.querySelectorAll('[data-period]').forEach(function (b) { b.addEventListener('click', function () { st.period = Number(b.dataset.period); renderStats(); }); });
  }

  /* Konton: the team's logins, opened from here */
  /* Importera leads: the three Google Sheets tabs, turned into admin/import.json by the build. Only the
     Elevate account imports, because it is the one that sees everyone's leads and can tell what is already in. */
  function renderImport() {
    // Works from every team account: the duplicate check reads all leads itself, not just the ones this account shows
    main().innerHTML = head('Importera leads', 'Isaks, Carls och Oscars listor från Google Sheets. Det som redan finns i admin hoppas över.') + '<p class="empty">Hämtar listan …</p>';
    var all = [];
    var digits = function (s) { return String(s || '').replace(/\D/g, '').replace(/^46/, '0'); };
    var key = function (s) { return String(s || '').toLowerCase().replace(/\b(ab|i|&|och)\b/g, ' ').replace(/[^a-z0-9åäö]+/g, ' ').trim(); };
    var existing = function (x) {
      return all.find(function (l) {
        return (x.email && l.email && l.email.toLowerCase() === x.email.toLowerCase()) || (x.phone && l.phone && digits(l.phone) === digits(x.phone)) ||
          (key(x.company) && (key(l.company) === key(x.company) || key(l.name) === key(x.company)));
      });
    };
    var why = { 401: 'Servern kände inte igen din inloggning som admin. Logga ut och in igen.', 404: 'Sidan med listorna finns inte på servern än – den kommer med nästa push.' };
    sb.from('quote_requests').select('id,name,company,email,phone').limit(5000).then(function (r) {
      if (r.error) throw new Error('Kunde inte läsa befintliga leads: ' + r.error.message);
      all = r.data || [];
      return sb.auth.getSession();
    }).then(function (s) { return fetch('/api/leads/import', { headers: { Authorization: 'Bearer ' + (s.data.session ? s.data.session.access_token : '') } }); }).then(function (r) {
      if (r.ok) return r.json();
      return r.json().catch(function () { return {}; }).then(function (d) { throw new Error((why[r.status] || 'Servern svarade med fel ' + r.status + '.') + (d.message ? ' (' + d.message + ')' : '')); });
    }).then(function (d) {
      var list = Array.isArray(d) ? d : d && d.rows;
      if (!Array.isArray(list)) throw new Error('Servern skickade inte en lista.');
      var src = d && d.source, note = src === 'link' ? info('Listorna lästes via kalkylarkets delningslänk', 'Google-kopplingen kunde inte läsa dem (' + esc(d.reason || 'okänt fel') + '), så de hämtades via länken i stället. Allt är med. Koppla Google igen under Integrationer om du vill att kopplingen ska fungera direkt.')
        : src === 'copy' ? info('Det här är en sparad kopia av listorna', 'Kalkylarket gick inte att läsa just nu (' + esc(d.reason || 'okänt fel') + '). Kontrollera att det fortfarande är delat med alla som har länken.') : '';
      var rows = list.map(function (x) { return { x: x, dup: existing(x) }; });
      var fresh = rows.filter(function (r) { return !r.dup; });
      main().innerHTML = head('Importera leads', 'Isaks, Carls och Oscars listor från Google Sheets. Det som redan finns i admin hoppas över.',
        fresh.length ? '<button class="btn" id="imp-go">Lägg in ' + fresh.length + ' nya leads</button>' : '') +
        note + kpis([['I listorna', list.length], ['Nya', fresh.length], ['Finns redan', rows.length - fresh.length]]) +
        (!fresh.length && list.length ? info('Allt är redan inlagt', 'Alla ' + list.length + ' företag i listorna finns redan i admin, så det finns inget nytt att lägga in. Nya rader i kalkylarket dyker upp här nästa gång du öppnar sidan.') : '') +
        '<div class="tablewrap"><table class="tbl"><thead><tr><th></th><th>Företag</th><th>Ansvarig</th><th>Status</th><th>Kontakt</th><th>Ny sajt</th><th>Kommentar</th></tr></thead><tbody>' +
        rows.map(function (r, i) {
          var x = r.x;
          return '<tr class="' + (r.dup ? 'is-dim' : '') + '"><td>' + (r.dup ? '<span class="tag">Finns: ' + esc(r.dup.company || r.dup.name) + '</span>' : '<input type="checkbox" class="imp" data-i="' + i + '" checked>') + '</td>' +
            '<td><b>' + esc(x.company) + '</b>' + (x.service_type ? '<br><span class="muted">' + esc(x.service_type) + '</span>' : '') + '</td>' +
            '<td><span class="av" style="--c:' + OWNER_COLOR[x.owner] + '">' + x.owner.charAt(0) + '</span> ' + esc(x.owner) + '</td><td>' + esc(STAGE[x.status] || x.status) + '</td>' +
            '<td>' + esc([x.email, x.phone, x.web].filter(Boolean).join(' · ')) + '</td><td>' + (x.github ? '<a href="' + esc(x.github) + '" target="_blank" rel="noopener">' + esc(x.github.split('/').pop()) + '</a>' : '') + '</td>' +
            '<td class="muted" style="max-width:360px;white-space:normal">' + esc(x.note) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      var go = $('#imp-go'); if (!go) return;
      go.addEventListener('click', function () {
        var picks = Array.prototype.map.call(document.querySelectorAll('.imp:checked'), function (c) { return rows[Number(c.dataset.i)].x; });
        if (!picks.length) return toast('Inget markerat');
        go.disabled = true; go.textContent = 'Lägger in …';
        var done = 0, failed = 0, errors = [];
        var next = function (i) {
          if (i >= picks.length) {
            toast(done + ' leads inlagda' + (failed ? ', ' + failed + ' misslyckades' : ''));
            loadLeads().then(function () { renderImport(); if (errors.length) main().insertAdjacentHTML('afterbegin', info('Det här gick inte att lägga in', errors.map(function (e) { return '<b>' + esc(e[0]) + '</b>: ' + esc(e[1]); }).join('<br>'))); });
            return;
          }
          var x = picks[i];
          var note = [x.note, x.first_contact ? 'Första kontakt: ' + x.first_contact : '', x.maps ? 'Google Maps: ' + x.maps : ''].filter(Boolean).join('\n');
          var row = { name: x.company, company: x.company, email: x.email || '', phone: x.phone || null, service_type: x.service_type || null, status: x.status || 'contacted',
            meeting_type: 'manual', message: 'Importerad från ' + x.owner + 's lista', admin_notes: withOwner(x.owner, note, { web: x.web, github: x.github }) };
          var add = function (r0) { return sb.from('quote_requests').insert(r0).select(); };
          add(row).then(function (r) {
            // a status the database does not know yet: put the lead in as contacted instead of losing it
            if (r.error && /status/i.test(r.error.message) && row.status !== 'contacted') return add(Object.assign({}, row, { status: 'contacted' }));
            return r;
          }).then(function (r) { if (r.error) { failed++; errors.push([x.company, r.error.message]); } else done++; next(i + 1); })
            .catch(function (e) { failed++; errors.push([x.company, String(e && e.message || e)]); next(i + 1); });
        };
        next(0);
      });
    }).catch(function (e) { main().innerHTML = head('Importera leads') + info('Kunde inte hämta listan', esc(e && e.message ? e.message : 'Servern svarade inte.')); });
  }

  function renderAccounts() {
    var rows = PROFILES.slice(0, 3), stats = personRows(0);
    main().innerHTML = head('Konton', 'Var och en loggar in med sin egen e-post och sitt eget lösenord. Öppna ett konto här så kan personen logga in direkt.') +
      '<div id="acc-note"></div><div class="cards">' + rows.map(function (p) {
        var mine = profile(st.user.email) === p, s = stats.find(function (r) { return r.who === p[1].split(' ')[0]; }) || { open: 0, won: 0, rate: null };
        return '<article class="cardx"><h3>' + esc(p[1]) + '</h3><p>' + esc(p[2]) + '</p><div class="mini"><span><b>' + s.open + '</b> öppna</span><span><b>' + s.won + '</b> vunna</span><span><b>' + (s.rate == null ? '–' : s.rate + ' %') + '</b> closing rate</span></div>' +
          '<footer>' + (mine ? '<span class="pill pill--on">Du</span>' : '<span></span>') + '<button class="btn btn--sm' + (mine ? ' btn--ghost' : '') + '" data-profile="' + esc(p[2]) + '">' + (mine ? 'Byt lösenord' : 'Öppna konto') + '</button></footer></article>';
      }).join('') + '</div>';
    root.querySelectorAll('[data-profile]').forEach(function (b) {
      b.addEventListener('click', function () { var p = profile(b.dataset.profile); if (p === profile(st.user.email)) go('konto'); else createLogin(p); });
    });
    fetch('/api/status').then(function (r) { return r.json(); }).then(function (s) {
      if (!s.accounts && $('#acc-note')) $('#acc-note').innerHTML = info('Kontona öppnas med ett bekräftelsemejl', 'Databasen ligger i Lovable Cloud, som inte lämnar ut den nyckel som krävs för att öppna konton direkt. Den nya personen får därför ett mejl och bekräftar själv.');
    }).catch(function () {});
  }

  /* Let the customer pick the time: a mail with free times from the Google calendar, booked on /boka/… */
  function proposeTimes(l) {
    if (!l.email) return toast('E-postadress saknas på leaden.');
    var hosts = {}; TEAM.forEach(function (m) { hosts[m[0].toLowerCase()] = m[1]; }); hosts[''] = 'Elevate Studio';
    dialog('<form id="pt"><h2>Låt kunden välja tid</h2><p>' + esc(l.name) + ' får ett mejl med lediga tider från Google-kalendern och bokar själv. Upptagna tider syns inte som lediga. Mötet hamnar i kalendern, på leaden och i din inkorg.</p>' +
      '<div class="grid3">' + form([{ name: 'host', label: 'Värd', options: hosts, value: senderKey(me()) }, { name: 'minutes', label: 'Längd', options: { 15: '15 min', 30: '30 min', 45: '45 min', 60: '60 min' }, value: '30' },
        { name: 'type', label: 'Typ', options: { google_meet: 'Google Meet', phone: 'Telefonmöte', teams: 'Microsoft Teams' }, value: 'google_meet' }]) + '</div>' +
      form([{ name: 'message', label: 'Meddelande i mejlet (valfritt)', type: 'textarea', rows: 5 }]) +
      '<div class="dlg__row"><button type="button" class="btn btn--ghost" data-close>Avbryt</button><button type="button" class="btn btn--ghost" id="pt-link">Bara skapa länk</button><button class="btn" type="submit">' + ICON.send + 'Skicka mejlet</button></div><p class="msg ok" id="pt-msg"></p></form>', function (d) {
      var f = $('#pt', d);
      tabFill(f.elements.message, function () { var we = f.elements.host.value ? 'jag' : 'vi'; return 'Tack för att du hörde av dig! På mötet går ' + we + ' igenom ert företag, vad hemsidan ska ge er och hur ett upplägg kan se ut. Det kostar ingenting. Välj den tid som passar dig bäst.'; });
      var send = function (mail) {
        var v = function (n) { return f.elements[n].value.trim(); }, btns = d.querySelectorAll('button'), m = $('#pt-msg', d);
        btns.forEach(function (b) { b.disabled = true; });
        sb.auth.getSession().then(function (r) {
          var token = r.data && r.data.session && r.data.session.access_token;
          return fetch('/api/booking/link', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ lead_id: l.id, sender: v('host'), minutes: Number(v('minutes')), type: v('type'), message: v('message'), send: mail }) });
        }).then(function (res) { return res.json().catch(function () { return {}; }).then(function (b) { return { ok: res.ok, b: b }; }); }, function () { return { ok: false, b: { error: 'Servern svarade inte.' } }; })
          .then(function (x) {
            if (!x.ok) {
              btns.forEach(function (b) { b.disabled = false; }); m.className = 'msg';
              m.textContent = x.b.error === 'not_configured' ? 'Gmail är inte kopplat än (se Integrationer).' : x.b.error === 'auth' ? 'Du behöver logga in igen.' : 'Det gick inte: ' + (x.b.error || 'fel');
              return;
            }
            var s = l.status || 'new', bump = s === 'new' || s === 'contacted' || s === 'meeting_rebook' ? update(l.id, { status: 'meeting_to_book' }).catch(function () {}) : Promise.resolve();
            bump.then(function () {
              if (mail) { d.remove(); render(); toast('Mejlet med lediga tider är skickat till ' + l.email); return; }
              m.className = 'msg ok'; m.innerHTML = 'Länken är skapad – skicka den i ett sms eller en chatt:<br><input class="input" readonly value="' + esc(x.b.url) + '" data-select style="margin-top:8px">';
              btns.forEach(function (b) { b.disabled = false; }); render();
            });
          });
      };
      f.addEventListener('submit', function (e) { e.preventDefault(); send(true); });
      $('#pt-link', d).addEventListener('click', function () { send(false); });
    });
  }

  /* Meetings the customers booked themselves land on the leads (the calendar event carries the lead's id) */
  function syncBookings() {
    return sb.auth.getSession().then(function (r) {
      var token = r.data && r.data.session && r.data.session.access_token; if (!token) return null;
      return fetch('/api/booking/sync', { headers: { Authorization: 'Bearer ' + token } }).then(function (res) { return res.ok ? res.json() : null; });
    }).then(function (b) {
      if (!b || !b.rows || !b.rows.length) return;
      var jobs = [];
      b.rows.forEach(function (x) {
        var l = lead(x.lead_id); if (!l) return;
        if (l.booking_at && Math.abs(Date.parse(l.booking_at) - Date.parse(x.at)) < 6e4) return;
        var type = x.type === 'phone' ? 'phone' : x.type === 'teams' ? 'teams' : 'google_meet';
        var host = TEAM.find(function (m) { return m[0].toLowerCase() === x.host; });
        jobs.push(update(l.id, { booking_at: x.at, status: 'meeting_booked', meeting_type: type }).then(function () {
          return Promise.all([
            sb.from('calendar_activities').insert({ title: 'Möte: ' + (l.company || l.name), category: 'meeting', starts_at: x.at, ends_at: new Date(Date.parse(x.at) + x.minutes * 6e4).toISOString(), location: x.link,
              description: ['Kunden valde tiden själv', host ? 'Värd: ' + host[1] : '', l.email, l.phone].filter(Boolean).join('\n'), link: '/admin', created_by: st.user.id }),
            sb.from('meeting_invites').insert({ quote_request_id: l.id, booking_at: x.at, duration_min: x.minutes, meet_link: x.link, recipients: [l.email], recipient_name: l.name, subject: 'Möte med Elevate Studio – kunden valde tiden', created_by: st.user.id })
          ]);
        }).catch(function () {}));
      });
      if (jobs.length) return Promise.all(jobs).then(function () { render(); toast(jobs.length === 1 ? 'En kund har bokat en tid – leaden är uppdaterad.' : jobs.length + ' kunder har bokat tider – leadsen är uppdaterade.'); });
    }).catch(function () {});
  }

  /* ---------- Dialogs ---------- */
  function dialog(html, onMount) {
    var d = document.createElement('div'); d.className = 'dlg';
    d.innerHTML = '<div class="dlg__box' + (dialog.wide ? ' dlg__box--wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    dialog.wide = false;
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-close]')) d.remove(); });
    document.body.appendChild(d);
    if (onMount) onMount(d);
    return d;
  }

  function openSold(l) {
    dialog('<h2>Markera som såld</h2><p>' + esc(l.name) + (l.company ? ' · ' + esc(l.company) : '') + '</p>' +
      '<label class="field">Belopp (kr)<input class="input" type="number" min="0" step="1" id="amount" placeholder="t.ex. 6000"></label>' +
      '<div class="dlg__row"><button class="btn btn--ghost" data-close>Avbryt</button><button class="btn" id="save-sold">Spara som såld</button></div>',
      function (d) {
        d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-close]')) render(); });
        $('#amount', d).focus();
        $('#save-sold', d).addEventListener('click', function () {
          var amount = Number($('#amount', d).value) || null;
          update(l.id, { status: 'sold', sold_amount: amount, sold_at: new Date().toISOString() })
            .then(function () { d.remove(); render(); openReview(l); })
            .catch(function (err) { toast(err.message); });
        });
      });
  }

  function openReview(l) {
    var who = me();
    dialog('<div class="star">' + ICON.star + '</div><h2>Grattis till affären!</h2><p>Be ' + esc(l.company || l.name) + ' om en recension på Google – nu direkt eller om en vecka.</p>' +
      '<div class="field">Mejlet skickas från<div class="who">' + TEAM.map(function (t) { return '<button class="chip' + (t[1] === who ? ' is-on' : '') + '" data-who="' + t[1] + '">' + t[0] + '</button>'; }).join('') +
      '<button class="chip' + (who === 'Elevate Studio' ? ' is-on' : '') + '" data-who="Elevate Studio">Elevate Studio</button></div></div>' +
      '<div class="stack"><button class="btn" id="mail"' + (l.email ? '' : ' disabled') + '>' + ICON.mail + 'Skicka mejl för att recensera' + (l.email ? '' : ' (e-post saknas)') + '</button>' +
      '<button class="btn btn--ghost" id="remind">' + ICON.bell + 'Påminn mig om en vecka</button><button class="btn btn--ghost" data-close style="justify-content:center">Inte nu</button></div>',
      function (d) {
        d.querySelectorAll('[data-who]').forEach(function (b) {
          b.addEventListener('click', function () { who = b.dataset.who; d.querySelectorAll('[data-who]').forEach(function (x) { x.classList.toggle('is-on', x === b); }); });
        });
        $('#mail', d).addEventListener('click', function (e) {
          var btn = e.currentTarget; btn.disabled = true;
          sendMail({ action: 'review', lead_id: l.id, sender: senderKey(who) }).then(function () {
            d.remove(); toast('Recensionsmejlet är skickat från ' + GMAIL);
          }, function (err) { btn.disabled = false; toast('Kunde inte skicka: ' + err.message); });
        });
        $('#remind', d).addEventListener('click', function () {
          var s = new Date(); s.setDate(s.getDate() + 7); s.setHours(9, 0, 0, 0);
          sb.from('calendar_activities').insert({
            title: 'Be ' + (l.company || l.name) + ' om en recension', category: 'reminder',
            description: ['Kontakt: ' + l.name, l.email ? 'E-post: ' + l.email : '', l.phone ? 'Telefon: ' + l.phone : ''].filter(Boolean).join('\n'),
            starts_at: s.toISOString(), ends_at: new Date(s.getTime() + 15 * 6e4).toISOString(), link: '/admin', created_by: st.user.id
          }).then(function (r) {
            if (r.error) return toast(r.error.message);
            d.remove(); toast('Påminnelse inlagd ' + s.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }) + ' kl. 09:00');
          });
        });
      });
  }

  // the lead's new site: the GitHub repository becomes its GitHub Pages address; otherwise the old site
  function siteOf(l) {
    var m = metaOf(l) || {};
    if (m.github) { var g = String(m.github).match(/github\.com\/([^/]+)\/([^/?#]+)/i); return g ? 'https://' + g[1].toLowerCase() + '.github.io/' + g[2] + '/' : m.github; }
    return m.web || '';
  }
  // open a finished PDF in a new tab to look at it before it is downloaded or sent
  function showPdf(promise) {
    var w = window.open('', '_blank');
    promise.then(function (doc) { var u = doc.output('bloburl'); if (w) w.location = u; else window.open(u, '_blank'); })
      .catch(function (err) { if (w) w.close(); toast(err.message); });
  }
  function openOffer(l) {
    var O = window.ElevateOffer, today = new Date(), iso = function (x) { return x.toISOString().slice(0, 10); };
    var fees = O.PACKAGE_FEES[l.selected_package] || O.PACKAGE_FEES.starter;
    var start = l.selected_package === 'elite' && l.estimated_start_cost ? l.estimated_start_cost : fees.start;
    var no = iso(today).slice(2).replace(/-/g, '') + '-' + l.id.slice(0, 4).toUpperCase();
    var f = function (id, label, val, type) { return '<label class="field">' + label + '<input class="input" id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val) + '"></label>'; };
    dialog('<h2>Skapa offert</h2><p>Samma offert som på hemsidan, ifylld för ' + esc(l.company || l.name) + '.</p>' +
      '<div class="grid3">' + f('o-no', 'Offert nr', no) + f('o-date', 'Datum', iso(today), 'date') + f('o-valid', 'Giltig till', iso(new Date(today.getTime() + 30 * 864e5)), 'date') + '</div>' +
      '<div class="grid3">' + f('o-rep', 'Vår företrädare', '') + f('o-cust', 'Beställare', l.company || l.name) + f('o-crep', 'Beställarens företrädare', l.name) + '</div>' +
      '<div class="grid2">' + f('o-start', 'Startavgift (kr, exkl. moms)', start, 'number') + f('o-year', 'Årsavgift (kr/år)', fees.yearly, 'number') + '</div>' +
      '<label class="field">I uppdraget ingår (en rad per punkt)<textarea class="input" id="o-scope" rows="6">' + esc(O.DEFAULT_SCOPE.join('\n')) + '</textarea></label>' +
      '<div class="dlg__row"><button class="btn btn--ghost" data-close>Avbryt</button>' + (siteOf(l) ? '<a class="btn btn--ghost" href="' + esc(siteOf(l)) + '" target="_blank" rel="noopener">Visa hemsida</a>' : '') +
      '<button class="btn btn--ghost" id="o-view">Visa offert</button><button class="btn" id="o-go">Ladda ner offert</button></div>',
      function (d) {
        var v = function (id) { return $('#' + id, d).value; };
        var make = function () {
          return O.buildQuotePdf({
            offerNo: v('o-no'), date: v('o-date'), validUntil: v('o-valid'), producerRep: v('o-rep'), customer: v('o-cust'), customerRep: v('o-crep'),
            startFee: Number(v('o-start')) || 0, yearlyFee: Number(v('o-year')) || 0,
            scope: v('o-scope').split('\n').map(function (s) { return s.trim(); }).filter(Boolean)
          });
        };
        $('#o-view', d).addEventListener('click', function () { showPdf(make()); });
        $('#o-go', d).addEventListener('click', function (e) {
          var b = e.target; b.disabled = true; b.textContent = 'Skapar …';
          make().then(function (doc) { doc.save(O.quotePdfFilename(v('o-cust'))); d.remove(); })
            .catch(function (err) { toast(err.message); b.disabled = false; b.textContent = 'Ladda ner offert'; });
        });
      });
  }

  // Invoice in the same look as the offer. Our own details (org.nr, bankgiro, swish) are remembered in the browser.
  function openInvoice(l) {
    var O = window.ElevateOffer, today = new Date(), iso = function (x) { return x.toISOString().slice(0, 10); };
    var mem = {}; try { mem = JSON.parse(localStorage.getItem('elevate.invoice') || '{}'); } catch (e) { mem = {}; }
    var fees = O.PACKAGE_FEES[l.selected_package] || O.PACKAGE_FEES.starter;
    var start = l.sold_amount != null && Number(l.sold_amount) ? Number(l.sold_amount) : (l.selected_package === 'elite' && l.estimated_start_cost ? l.estimated_start_cost : fees.start);
    var no = iso(today).slice(2, 4) + String(Date.now()).slice(-5);
    var f = function (id, label, val, type) { return '<label class="field">' + label + '<input class="input" id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val == null ? '' : val) + '"></label>'; };
    var m = metaOf(l), offerNo = (m && m.offer) || '';
    dialog('<h2>Skapa faktura</h2><p>Samma stil som webbavtalet, ifylld för ' + esc(l.company || l.name) + '. Uppgifterna om oss sparas i din webbläsare.</p>' +
      '<div class="grid3">' + f('i-no', 'Fakturanr', no) + f('i-date', 'Fakturadatum', iso(today), 'date') + f('i-due', 'Förfallodatum', iso(new Date(today.getTime() + 30 * 864e5)), 'date') + '</div>' +
      '<div class="grid3">' + f('i-cust', 'Kund', l.company || l.name) + f('i-crep', 'Referens hos kunden', l.name) + f('i-corg', 'Kundens org.nr', l.org_number || '') + '</div>' +
      '<div class="grid2">' + f('i-caddr', 'Kundens adress', l.address || '') + f('i-offer', 'Offert nr (om det finns)', offerNo) + '</div>' +
      '<label class="field">Rader, en per rad: text; belopp exkl. moms<textarea class="input" id="i-rows" rows="4">Webbutveckling – fast startavgift; ' + start + '\nÅrsavgift, första året; ' + fees.yearly + '</textarea></label>' +
      '<label class="check"><input type="checkbox" id="i-vat"' + (mem.vat === false ? '' : ' checked') + '> Lägg på moms 25 %</label>' +
      '<div class="grid3">' + f('i-sorg', 'Vårt org.nr', mem.sellerOrg) + f('i-acct', 'Bankkonto (clearing + kontonummer)', mem.account) + f('i-bg', 'Bankgiro (om ni har)', mem.bankgiro) + '</div>' +
      f('i-saddr', 'Vår adress', mem.sellerAddress) +
      '<label class="field">Meddelande på fakturan (valfritt)<textarea class="input" id="i-note" rows="2"></textarea></label>' +
      '<div class="dlg__row"><button class="btn btn--ghost" data-close>Avbryt</button><button class="btn btn--ghost" id="i-view">Visa faktura</button><button class="btn" id="i-go">Ladda ner faktura</button></div>',
      function (d) {
        var buildInv = function () {
          var v = function (id) { return $('#' + id, d).value.trim(); };
          var items = v('i-rows').split('\n').map(function (s) { var p = s.split(';'); return { label: (p[0] || '').trim(), amount: Number(String(p[1] || '').replace(/[^\d.,-]/g, '').replace(',', '.')) || 0 }; }).filter(function (x) { return x.label; });
          var own = { sellerOrg: v('i-sorg'), bankgiro: v('i-bg'), account: v('i-acct'), sellerAddress: v('i-saddr'), vat: $('#i-vat', d).checked };
          try { localStorage.setItem('elevate.invoice', JSON.stringify(own)); } catch (err) { /* fine */ }
          return O.buildInvoicePdf({ invoiceNo: v('i-no'), date: v('i-date'), dueDate: v('i-due'), offerNo: v('i-offer'), customer: v('i-cust'), customerRep: v('i-crep'), customerOrg: v('i-corg'), customerAddress: v('i-caddr'),
            items: items, vat: own.vat, sellerOrg: own.sellerOrg, bankgiro: own.bankgiro, account: own.account, sellerAddress: own.sellerAddress, note: v('i-note') })
;
        };
        $('#i-view', d).addEventListener('click', function () { showPdf(buildInv()); });
        $('#i-go', d).addEventListener('click', function (e) {
          var b = e.target; b.disabled = true; b.textContent = 'Skapar …';
          var v = function (id) { return $('#' + id, d).value.trim(); };
          buildInv()
            .then(function (doc) { doc.save(O.invoicePdfFilename(v('i-cust'), v('i-no'))); d.remove(); toast('Fakturan är nedladdad'); })
            .catch(function (err) { toast(err.message); b.disabled = false; b.textContent = 'Ladda ner faktura'; });
        });
      });
  }

  /* ---------- Shared helpers for the pages ---------- */
  var CUSTOMER = { lead: 'Lead', prospect: 'Blivande kund', active: 'Aktiv kund', paused: 'Pausad', former: 'Tidigare kund', internal: 'Intern' };
  var CATEGORY = { meeting: 'Möte', call: 'Samtal', task: 'Uppgift', deadline: 'Deadline', reminder: 'Påminnelse', personal: 'Personligt', other: 'Övrigt' };
  var SCOPE = { foretag: 'Företaget', operativt: 'Hur vi jobbar', profil: 'Personligt' };
  var main = function () { return $('#main'); };
  document.addEventListener('focusin', function (e) { if (e.target.matches && e.target.matches('input[data-select]')) e.target.select(); });
  function head(title, sub, actions) {
    return '<div class="page-h"><div><h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="page-h__acts">' + actions + '</div>' : '') + '</div>';
  }
  function kpis(list) { return '<div class="kpis">' + list.map(function (k) { return '<div class="kpi"><small>' + k[0] + '</small><b>' + k[1] + '</b></div>'; }).join('') + '</div>'; }
  function info(title, text) { return '<div class="info"><b>' + title + '</b><p>' + text + '</p></div>'; }
  function table(cols, rows, rowAttr) {
    if (!rows.length) return '<p class="empty">Inget här än.</p>';
    return '<div class="tbl"><table><thead><tr>' + cols.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr' + (rowAttr ? ' ' + rowAttr(r) : '') + '>' + cols.map(function (c) { return '<td>' + c[1](r) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function bars(title, pairs, total) {
    var max = Math.max.apply(null, pairs.map(function (p) { return p[1]; }).concat([1]));
    return '<section class="panel"><h3>' + title + '</h3>' + (pairs.length ? pairs.map(function (p) {
      return '<div class="barrow"><span title="' + esc(p[0]) + '">' + esc(p[0]) + '</span><i style="--w:' + Math.round(p[1] / max * 100) + '%"></i><b>' + p[1] + (total ? ' <em>' + Math.round(p[1] / total * 100) + ' %</em>' : '') + '</b></div>';
    }).join('') : '<p class="empty">Ingen data.</p>') + '</section>';
  }
  function countBy(rows, fn, limit) {
    var c = {}; rows.forEach(function (r) { var k = fn(r); if (k) c[k] = (c[k] || 0) + 1; });
    return Object.keys(c).map(function (k) { return [k, c[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, limit || 8);
  }
  function fetchRows(query, render) {
    main().insertAdjacentHTML('beforeend', '<p class="empty" id="loading">Hämtar …</p>');
    var view = st.view;
    return query.then(function (r) {
      if (st.view !== view) return;
      var l = $('#loading'); if (l) l.remove();
      if (r.error) { main().insertAdjacentHTML('beforeend', '<p class="empty">Kunde inte hämta: ' + esc(r.error.message) + '</p>'); return; }
      render(r.data || []);
    });
  }
  function form(fields) {
    return fields.map(function (f) {
      var v = f.value == null ? '' : f.value;
      if (f.type === 'textarea') return '<label class="field">' + f.label + '<textarea class="input" rows="' + (f.rows || 3) + '" name="' + f.name + '">' + esc(v) + '</textarea></label>';
      if (f.options) return '<label class="field">' + f.label + '<select class="input" name="' + f.name + '">' + Object.keys(f.options).map(function (k) { return '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + f.options[k] + '</option>'; }).join('') + '</select></label>';
      return '<label class="field">' + f.label + '<input class="input" name="' + f.name + '" type="' + (f.type || 'text') + '" value="' + esc(v) + '"' + (f.required ? ' required' : '') + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '></label>';
    }).join('');
  }
  /* A suggested text shown in grey in an empty field; Tab puts it in, ready to edit */
  function tabFill(el, suggest) {
    var hint = document.createElement('span'); hint.className = 'tabhint'; hint.innerHTML = '<kbd>Tab</kbd> använd förslaget';
    el.parentNode.insertBefore(hint, el);
    var refresh = function () { el.placeholder = suggest(); hint.hidden = !!el.value.trim(); };
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || e.shiftKey || el.value.trim()) return;
      e.preventDefault(); el.value = suggest(); el.setSelectionRange(el.value.length, el.value.length); refresh();
    });
    el.addEventListener('input', refresh); refresh();
    return refresh;
  }
  function formDialog(title, sub, fields, save, extra) {
    dialog('<form id="fd"><h2>' + title + '</h2>' + (sub ? '<p>' + sub + '</p>' : '') + form(fields) +
      '<div class="dlg__row">' + (extra || '') + '<button type="button" class="btn btn--ghost" data-close>Avbryt</button><button class="btn" type="submit">Spara</button></div></form>', function (d) {
      $('#fd', d).addEventListener('submit', function (e) {
        e.preventDefault();
        var data = {}; fields.forEach(function (f) { var v = e.target.elements[f.name].value.trim(); data[f.name] = v === '' ? null : v; });
        var btn = $('button[type=submit]', d); btn.disabled = true;
        Promise.resolve(save(data, d)).then(function (r) {
          if (r && r.error) throw r.error;
          d.remove(); render();
        }).catch(function (err) { btn.disabled = false; toast(err.message); });
      });
    });
  }
  var localInput = function (iso) { if (!iso) return ''; var d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
  var fromLocal = function (v) { return v ? new Date(v).toISOString() : null; };
  var day = function (iso) { return iso ? new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'; };
  var since = function (days) { return new Date(Date.now() - days * 864e5).toISOString(); };

  /* ---------- Quick actions above the leads (like the old admin) ---------- */
  var QUICK = [['newlead', 'Ny lead', 'inbox', true], ['campaign', 'Nytt mejlutskick', 'send'], ['meeting', 'Boka möte', 'cal'], ['offer', 'Ny offert', 'file'],
    ['contact', 'Ny kontakt', 'users'], ['activity', 'Ny aktivitet', 'bell'], ['csv', 'Exportera CSV', 'chart']];
  function quickBar() {
    var limited = !allowed('utskick');
    return '<div class="quick">' + QUICK.filter(function (q) { return !limited || ['newlead', 'meeting', 'offer', 'activity'].indexOf(q[0]) >= 0; }).map(function (q) { return '<button class="btn btn--sm' + (q[3] ? '' : ' btn--ghost') + '" data-q="' + q[0] + '">' + ICON[q[2]] + q[1] + '</button>'; }).join('') + '</div>';
  }
  function bindQuick() {
    root.querySelectorAll('[data-q]').forEach(function (b) {
      b.addEventListener('click', function () {
        var q = b.dataset.q;
        if (q === 'newlead') newLead();
        if (q === 'campaign') newCampaign();
        if (q === 'meeting') bookMeeting();
        if (q === 'offer') openOffer({ id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), name: '', company: '' });
        if (q === 'contact') contactDialog();
        if (q === 'activity') newActivity();
        if (q === 'csv') exportCsv();
      });
    });
  }

  function newLead() {
    formDialog('Ny lead', 'Lägg in en kund som hört av sig på telefon, mejl eller i person.', [
      { name: 'name', label: 'Namn', required: true }, { name: 'company', label: 'Företag' },
      { name: 'email', label: 'E-post', type: 'email', required: true }, { name: 'phone', label: 'Telefon' },
      { name: 'service_type', label: 'Bransch' }, { name: 'status', label: 'Status', options: STATUS.reduce(function (o, s) { o[s[0]] = s[1]; return o; }, {}), value: 'new' },
      { name: 'web', label: 'Gamla hemsidan (valfritt)', type: 'url', placeholder: 'https://' }, { name: 'github', label: 'Nya hemsidan på GitHub (valfritt)', type: 'url', placeholder: 'https://github.com/ElevateStudio018/…' },
      { name: 'message', label: 'Vad vill de ha?', type: 'textarea' }
    ], function (v) {
      var meta = { web: v.web, github: v.github }, who = me().split(' ')[0]; delete v.web; delete v.github;
      // The one who adds the lead is its owner (Elevate Studio's own login sets none)
      return sb.from('quote_requests').insert(Object.assign(v, { meeting_type: 'manual', admin_notes: withOwner(/^(Carl|Isak|Oscar)$/.test(who) ? who : myTag(), '', meta) })).select().then(function (r) {
        if (r.error) throw r.error;
        if (r.data && r.data[0]) st.leads.unshift(r.data[0]);
        toast('Leaden är tillagd');
      });
    });
  }

  function exportCsv() {
    var cols = [['Namn', 'name'], ['Företag', 'company'], ['E-post', 'email'], ['Telefon', 'phone'], ['Bransch', 'service_type'], ['Status', 'status'], ['Inkom', 'created_at'], ['Bokat möte', 'booking_at'], ['Såld för', 'sold_amount'], ['Kommentar', 'admin_notes']];
    var cell = function (v) { v = v == null ? '' : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var csv = '﻿' + cols.map(function (c) { return c[0]; }).join(';') + '\n' + filtered().map(function (l) {
      return cols.map(function (c) { return cell(c[1] === 'status' ? sInfo(l.status || 'new')[1] : l[c[1]]); }).join(';');
    }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'leads-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
    toast('Exporterade ' + filtered().length + ' leads');
  }

  /* Mail campaign: pick a group, write the mail. Sent from info@ when the mail function is live. */
  function newCampaign() {
    var groups = { marketing: 'Kontakter som sagt ja till utskick', customers: 'Aktiva kunder', contacts: 'Alla kontakter', leads: 'Alla leads' };
    STATUS.forEach(function (s) { groups['status:' + s[0]] = 'Leads med status: ' + s[1]; });
    var contacts = null, list = [];
    dialog('<form id="cp"><h2>Nytt mejlutskick</h2><p>' + 'Skickas från ' + GMAIL + ' i den gröna designen, ett mejl per mottagare (högst 200 åt gången).' + '</p>' +
      form([{ name: 'group', label: 'Till', options: groups, value: 'marketing' }]) + '<p class="small muted" id="cp-count" style="margin:-6px 0 14px">Räknar …</p>' +
      form([{ name: 'subject', label: 'Ämne', required: true }, { name: 'headline', label: 'Rubrik i mejlet' }, { name: 'body', label: 'Text', type: 'textarea', rows: 7, required: true },
        { name: 'button_label', label: 'Knapptext (valfri)', placeholder: 'Läs mer' }, { name: 'button_url', label: 'Knapplänk (valfri)', type: 'url', placeholder: 'https://elevatestudio.nu/' }]) +
      '<div class="dlg__row"><button type="button" class="btn btn--ghost" data-close>Avbryt</button><button class="btn" type="submit">' + ICON.send + 'Skicka</button></div></form>', function (d) {
      var f = $('#cp', d);
      var count = function () {
        var g = f.elements.group.value, seen = {};
        var add = function (email, name) { email = (email || '').trim().toLowerCase(); if (email && !seen[email]) { seen[email] = 1; list.push({ email: email, name: name || '' }); } };
        list = [];
        if (g === 'leads' || g.indexOf('status:') === 0) {
          st.leads.forEach(function (l) { if (g === 'leads' || (l.status || 'new') === g.slice(7)) add(l.email, l.name); });
        } else {
          (contacts || []).forEach(function (c) {
            if (c.unsubscribed_at) return;
            if (g === 'marketing' && !c.allow_marketing_email) return;
            if (g === 'customers' && c.customer_status !== 'active') return;
            add(c.email, c.full_name);
          });
        }
        $('#cp-count', d).textContent = contacts === null && g.indexOf('status:') && g !== 'leads' ? 'Räknar …' : list.length + ' mottagare';
      };
      sb.from('contacts').select('email,full_name,customer_status,allow_marketing_email,unsubscribed_at').is('archived_at', null).not('email', 'is', null).limit(5000)
        .then(function (r) { contacts = r.data || []; count(); });
      f.elements.group.addEventListener('change', count); count();
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!list.length) return toast('Inga mottagare i den gruppen.');
        var v = function (n) { return f.elements[n].value.trim(); };
        var c = { subject: v('subject'), headline: v('headline') || v('subject'), body: v('body'), button_label: v('button_label') || null, button_url: v('button_url') || null };
        var log = function (sent) {
          return sb.from('email_campaigns').insert({ internal_name: c.subject, subject: c.subject, headline: c.headline, body: c.body, button_label: c.button_label, button_url: c.button_url,
            status: 'sent', recipient_count: list.length, sent_count: sent, sent_at: new Date().toISOString(), sent_by: st.user.id, created_by: st.user.id,
            from_email: GMAIL, from_name: 'Elevate Studio', audience: { group: f.elements.group.value } }).then(function () {});
        };
        if (!confirm('Skicka utskicket till ' + list.length + ' mottagare från ' + GMAIL + '?')) return;
        var btn = $('button[type=submit]', d); btn.disabled = true; btn.textContent = 'Skickar …';
        sendMail(Object.assign({ action: 'campaign', recipients: list.slice(0, 200) }, c)).then(function (r) {
          log(r.sent || 0); d.remove(); toast('Utskicket är skickat till ' + (r.sent || 0) + ' av ' + list.length + ' mottagare från ' + GMAIL);
        }, function (err) { btn.disabled = false; btn.textContent = 'Skicka'; toast('Kunde inte skicka: ' + err.message); });
      });
    });
  }

  /* Book a meeting with a lead: sets the time on the lead, puts it in the calendar and (when live) mails the invite from info@. */
  function bookMeeting(l) {
    var open = st.leads.filter(function (x) { return CLOSED.indexOf(x.status || 'new') < 0 || (l && x.id === l.id); });
    var leads = {}; open.forEach(function (x) { leads[x.id] = (x.company ? x.company + ' – ' : '') + x.name; });
    var t = new Date(Date.now() + 864e5); t.setHours(10, 0, 0, 0);
    var hosts = { '': 'Elevate Studio' }; TEAM.forEach(function (m) { hosts[m[0].toLowerCase()] = m[1]; });
    var types = { google_meet: 'Google Meet', teams: 'Microsoft Teams', phone: 'Telefonmöte', visit: 'Fysiskt möte' };
    dialog('<form id="bm"><h2>Boka möte</h2><p>Mötet hamnar på leaden och i kalendern.</p>' +
      form([{ name: 'lead', label: 'Kund', options: leads, value: l ? l.id : '' }]) + '<div class="grid2">' +
      form([{ name: 'at', label: 'Tid', type: 'datetime-local', value: localInput(t.toISOString()), required: true }, { name: 'minutes', label: 'Längd (minuter)', type: 'number', value: 30 },
        { name: 'type', label: 'Typ', options: types, value: 'google_meet' }, { name: 'host', label: 'Värd', options: hosts, value: senderKey(me()) }]) + '</div>' +
      form([{ name: 'link', label: 'Möteslänk eller adress', placeholder: 'Tomt vid Google Meet – länken skapas automatiskt' }, { name: 'message', label: 'Meddelande till kunden', type: 'textarea', rows: 6 }]) +
      '<label class="check"><input type="checkbox" name="send" checked> Skicka inbjudan till kunden från ' + GMAIL + '</label>' +
      '<div class="dlg__row"><button type="button" class="btn btn--ghost" data-close>Avbryt</button><button class="btn" type="submit">Boka</button></div></form>', function (d) {
      // The link field follows the meeting type: hidden for Google Meet (the link is made when booking)
      var bm = $('#bm', d), linkField = bm.elements.link.closest('.field');
      var auto = document.createElement('p'); auto.className = 'small muted'; auto.style.margin = '-4px 0 14px';
      auto.textContent = 'Google Meet-länken skapas automatiskt när du bokar och kommer med i inbjudan.';
      linkField.parentNode.insertBefore(auto, linkField);
      var LINK = { teams: ['Teams-länk', 'https://teams.microsoft.com/…'], phone: ['Telefonnummer (valfritt)', 'Vi ringer upp på …'], visit: ['Adress', 'Gatuadress, ort'] };
      var syncLink = function () {
        var t = bm.elements.type.value, meet = t === 'google_meet';
        linkField.hidden = meet; auto.hidden = !meet;
        if (meet) { bm.elements.link.value = ''; return; }
        linkField.firstChild.nodeValue = LINK[t][0]; bm.elements.link.placeholder = LINK[t][1];
      };
      bm.elements.type.addEventListener('change', syncLink); syncLink();
      var JOIN = { google_meet: 'Du ansluter med knappen i mejlet. Det fungerar direkt i webbläsaren, du behöver inte installera något.',
        teams: 'Du ansluter med Teams-länken i mejlet. Det går bra direkt i webbläsaren.', phone: 'Vi ringer upp dig på utsatt tid.', visit: 'Vi ses på adressen ovan.' };
      var fillMsg = tabFill(bm.elements.message, function () {
        var we = bm.elements.host.value ? ['jag', 'mig'] : ['vi', 'oss'];
        return ['Tack för att du hörde av dig! På mötet går ' + we[0] + ' igenom ert företag, vad hemsidan ska ge er och hur ett upplägg kan se ut. Mötet kostar ingenting.',
          JOIN[bm.elements.type.value], 'Fundera gärna på två–tre hemsidor ni gillar inför mötet, så träffar ' + we[0] + ' rätt direkt. Passar inte tiden? Svara på det här mejlet så hittar vi en ny.'].join('\n\n');
      });
      bm.elements.type.addEventListener('change', fillMsg); bm.elements.host.addEventListener('change', fillMsg);
      $('#bm', d).addEventListener('submit', function (e) {
        e.preventDefault(); var f = e.target, v = function (n) { return f.elements[n].value.trim(); };
        var x = lead(v('lead')); if (!x) return toast('Välj en kund.');
        var at = new Date(v('at')), mins = Number(v('minutes')) || 30, host = v('host'), type = v('type');
        var hostName = hosts[host], when = at.toLocaleString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
        var btn = $('button[type=submit]', d); btn.disabled = true; btn.textContent = 'Bokar …';
        var send = f.elements.send.checked, auto = type === 'google_meet' && !v('link');
        // The server makes the Google Meet link (when none is given) and mails the invite from Gmail – no mail program opens
        var server = !send && !auto ? Promise.resolve({ how: 'booked' }) : sb.auth.getSession().then(function (r) {
          var token = r.data && r.data.session && r.data.session.access_token;
          return fetch('/api/invite', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ lead_id: x.id, at: at.toISOString(), minutes: mins, type: types[type], link: v('link'), message: v('message'), sender: host, send: send, auto_meet: auto }) });
        }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (b) {
            if (res.ok) return { how: b.sent === false ? 'booked' : 'sent', link: b.link, provider: b.provider };
            if (b.error === 'not_configured') return { how: 'not_configured' };
            if (b.error === 'google_not_configured') return { how: 'no_google' };
            return { how: 'failed', why: b.error === 'auth' ? 'Du behöver logga in igen.' : b.error || res.status };
          });
        }).catch(function () { return { how: 'failed', why: 'Servern svarade inte.' }; });
        server.then(function (out) {
          var link = v('link') || out.link || null;
          return update(x.id, { booking_at: at.toISOString(), status: 'meeting_booked', meeting_type: type === 'visit' ? 'quote' : type }).then(function () {
            return Promise.all([
              sb.from('calendar_activities').insert({ title: 'Möte: ' + (x.company || x.name), category: 'meeting', starts_at: at.toISOString(), ends_at: new Date(at.getTime() + mins * 6e4).toISOString(),
                location: link, description: [types[type], 'Värd: ' + hostName, x.email, x.phone].filter(Boolean).join('\n'), link: '/admin', created_by: st.user.id }),
              sb.from('meeting_invites').insert({ quote_request_id: x.id, booking_at: at.toISOString(), duration_min: mins, meet_link: link, recipients: [x.email], recipient_name: x.name,
                subject: 'Möte med Elevate Studio', message: v('message') || null, created_by: st.user.id })
            ]);
          }).then(function () { return out; });
        }).then(function (out) {
          d.remove(); render();
          var meet = !out.link ? '' : out.provider === 'jitsi' ? ' Videolänken skapades automatiskt (Jitsi). Koppla Google under Integrationer för Google Meet-länkar.'
            : ' Meet-länken är skapad och mötet ligger i Elevates Google Kalender.';
          if (out.how === 'sent') return toast('Mötet är bokat och inbjudan skickad från ' + GMAIL + '.' + meet);
          if (out.how === 'not_configured') return toast('Mötet är bokat. Inbjudan skickades inte – Gmail är inte kopplat än (se Integrationer).');
          if (out.how === 'no_google') return toast('Mötet är bokat, men inget skickades: Google Kalender är inte kopplat än, så Meet-länken kunde inte skapas (se Integrationer).');
          if (out.how === 'failed') return toast('Mötet är bokat, men inbjudan kunde inte skickas: ' + out.why);
          toast('Mötet är bokat.' + meet);
        }).catch(function (err) { btn.disabled = false; btn.textContent = 'Boka'; toast(err.message); });
      });
    });
  }

  /* Write a mail in the admin; it goes out from the Elevate Gmail in the green design with the sender's card */
  function composeMail(to) {
    if (!to || !to.email) return toast('E-postadress saknas.');
    var who = me();
    dialog('<form id="cm"><h2>Nytt mejl</h2><p>Till ' + esc(to.name || '') + ' &lt;' + esc(to.email) + '&gt; · skickas från ' + GMAIL + '</p>' +
      '<div class="field">Från<div class="who">' + TEAM.map(function (t) { return '<button type="button" class="chip' + (t[1] === who ? ' is-on' : '') + '" data-who="' + t[1] + '">' + t[0] + '</button>'; }).join('') +
      '<button type="button" class="chip' + (who === 'Elevate Studio' ? ' is-on' : '') + '" data-who="Elevate Studio">Elevate Studio</button></div></div>' +
      form([{ name: 'subject', label: 'Ämne', required: true }, { name: 'body', label: 'Meddelande', type: 'textarea', rows: 8 },
        { name: 'button_label', label: 'Knapptext (valfri)', placeholder: 'Se offerten' }, { name: 'button_url', label: 'Knapplänk (valfri)', type: 'url', placeholder: 'https://' }]) +
      '<p class="small muted" style="margin:-4px 0 0">Mejlet får den gröna designen med avsändarens kontaktkort. Svar kommer till ' + GMAIL + '.</p>' +
      '<div class="dlg__row"><button type="button" class="btn btn--ghost" data-close>Avbryt</button><button class="btn" type="submit">' + ICON.send + 'Skicka</button></div></form>', function (d) {
      d.querySelectorAll('[data-who]').forEach(function (b) {
        b.addEventListener('click', function () { who = b.dataset.who; d.querySelectorAll('[data-who]').forEach(function (x) { x.classList.toggle('is-on', x === b); }); });
      });
      var f = $('#cm', d);
      f.elements.body.required = true;
      var offer = ['quote_sent', 'waiting', 'negotiation'].indexOf(to.status) >= 0;
      var fillSubject = tabFill(f.elements.subject, function () { return offer ? 'Har du hunnit titta på offerten?' : 'Angående er nya hemsida'; });
      var fillBody = tabFill(f.elements.body, function () {
        var me1 = who !== 'Elevate Studio', we = me1 ? 'jag' : 'vi', us = me1 ? 'mig' : 'oss';
        return offer
          ? (me1 ? 'Jag' : 'Vi') + ' hör av ' + us + ' om offerten ' + we + ' skickade. Har du hunnit titta på den? Har du frågor eller vill ändra något går det bra att svara på det här mejlet eller ringa ' + us + '.\n\nNär du godkänner offerten sätter ' + we + ' igång direkt, och du får ett första utkast på ungefär en dag.'
          : 'Tack för att du hörde av dig till Elevate Studio. ' + (me1 ? 'Jag' : 'Vi') + ' har tittat på din förfrågan och berättar gärna hur ' + we + ' kan hjälpa er.\n\nHar du tid för ett kort samtal eller möte de närmaste dagarna? Svara gärna med en tid som passar, så hör ' + we + ' av ' + us + '.';
      });
      d.querySelectorAll('[data-who]').forEach(function (b) { b.addEventListener('click', function () { fillBody(); }); });
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = function (n) { return f.elements[n].value.trim(); }, btn = $('button[type=submit]', d);
        btn.disabled = true; btn.textContent = 'Skickar …';
        sendMail({ action: 'message', lead_id: to.id || undefined, email: to.id ? undefined : to.email, name: to.name, sender: senderKey(who),
          subject: v('subject'), body: v('body'), button_label: v('button_label') || undefined, button_url: v('button_url') || undefined })
          .then(function () { d.remove(); toast('Mejlet är skickat från ' + GMAIL); },
            function (err) { btn.disabled = false; btn.textContent = 'Skicka'; toast('Kunde inte skicka: ' + err.message); });
      });
      f.elements.subject.focus();
    });
  }

  /* ---------- Big lead window (like the old admin) ---------- */
  function openLead(l) {
    var s = sInfo(l.status || 'new');
    var addons = Array.isArray(l.selected_addons) ? l.selected_addons : (l.selected_addons && typeof l.selected_addons === 'object' ? Object.keys(l.selected_addons).filter(function (k) { return l.selected_addons[k]; }) : []);
    var addonName = function (x) { return typeof x === 'string' ? x : (x && (x.name || x.label || x.title)) || JSON.stringify(x); };
    var row = function (k, v) { return v ? '<dt>' + k + '</dt><dd>' + v + '</dd>' : ''; };
    dialog.wide = true;
    dialog('<div class="ld"><header class="ld__head" style="--c:' + s[2] + '"><div><p class="ld__kicker">' + esc(MEETING[l.meeting_type] || 'Förfrågan') + ' · inkom ' + dt(l.created_at) + '</p>' +
      '<h2>' + esc(l.name) + (l.company ? ' <span>· ' + esc(l.company) + '</span>' : '') + '</h2></div>' +
      '<div class="ld__headacts"><select class="status" id="ld-status" style="color:' + s[2] + '">' + STATUS.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === s[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<button class="iconbtn" data-close aria-label="Stäng">' + ICON.x + '</button></div></header>' +
      '<div class="ld__quick">' + (l.phone ? '<a class="btn btn--ghost btn--sm" href="tel:' + esc(l.phone) + '">' + ICON.phone + 'Ring</a>' : '') +
      (l.email ? '<button class="btn btn--ghost btn--sm" id="ld-mail">' + ICON.mail + 'Mejla</button>' : '') +
      '<button class="btn btn--ghost btn--sm" id="ld-propose">' + ICON.cal + 'Låt kunden välja tid</button><button class="btn btn--ghost btn--sm" id="ld-meet">' + ICON.cal + 'Boka möte</button><button class="btn btn--ghost btn--sm" id="ld-offer">' + ICON.file + 'Skapa offert</button><button class="btn btn--ghost btn--sm" id="ld-invoice">' + ICON.file + 'Skapa faktura</button><button class="btn btn--ghost btn--sm" id="ld-portal">' + ICON.file + 'Kundportal och fakturor</button>' +
      (l.status === 'sold' ? '<button class="btn btn--sm" id="ld-review">' + ICON.star + 'Be om recension</button>' : '<button class="btn btn--sm" id="ld-sold">' + ICON.star + 'Markera som såld</button>') + '</div>' +
      ((metaOf(l).web || metaOf(l).github) ? '<p class="ld__links">' + (metaOf(l).web ? '<a href="' + esc(metaOf(l).web) + '" target="_blank" rel="noopener">' + ICON.site + 'Gamla hemsidan</a>' : '') + (metaOf(l).github ? '<a href="' + esc(metaOf(l).github) + '" target="_blank" rel="noopener">' + ICON.site + 'Nya hemsidan på GitHub</a>' : '') + '</p>' : '') +
      '<div class="ld__cols"><div>' +
      '<section class="panel"><h3>Kontaktuppgifter</h3><form id="ld-form"><div class="grid2">' +
      form([{ name: 'name', label: 'Namn', value: l.name, required: true }, { name: 'company', label: 'Företag', value: l.company },
        { name: 'email', label: 'E-post', value: l.email, type: 'email', required: true }, { name: 'phone', label: 'Telefon', value: l.phone },
        { name: 'service_type', label: 'Bransch', value: l.service_type }, { name: 'company_type', label: 'Företagsform', value: l.company_type },
        { name: 'booking_at', label: 'Bokat möte', value: localInput(l.booking_at), type: 'datetime-local' }, { name: 'followup_at', label: 'Nästa steg senast', value: localInput(l.followup_at), type: 'datetime-local' },
        { name: 'web', label: 'Gamla hemsidan (valfritt)', value: metaOf(l).web, type: 'url', placeholder: 'https://' }, { name: 'github', label: 'Nya hemsidan på GitHub (valfritt)', value: metaOf(l).github, type: 'url', placeholder: 'https://github.com/ElevateStudio018/…' }]) +
      '</div><div class="ld__save"><button class="btn btn--sm" type="submit">Spara ändringar</button></div></form></section>' +
      ((l.message || l.project_description) ? '<section class="panel"><h3>Meddelande</h3>' + (l.message ? '<div class="box">' + esc(l.message) + '</div>' : '') +
        (l.project_description ? '<p class="panel__sub">Projektbeskrivning</p><div class="box">' + esc(l.project_description) + '</div>' : '') + '</section>' : '') +
      '<section class="panel"><h3>Valda tjänster</h3><dl class="dl">' +
      row('Paket', l.selected_package && esc(l.selected_package)) + row('Tillägg', addons.length && addons.map(function (x) { return '<span class="tag">' + esc(addonName(x)) + '</span>'; }).join(' ')) +
      row('Startkostnad', l.estimated_start_cost != null && kr(l.estimated_start_cost)) + row('Månadskostnad', l.estimated_monthly_cost != null && kr(l.estimated_monthly_cost) + '/mån') +
      row('Önskad tid', l.preferred_time && esc(l.preferred_time)) + row('Mötesutfall', l.meeting_outcome && esc(l.meeting_outcome)) +
      row('Såld för', l.sold_amount != null && '<b>' + kr(l.sold_amount) + '</b>' + (l.sold_at ? ' · ' + day(l.sold_at) : '')) +
      row('Faktura', l.stripe_invoice_status && (esc(l.stripe_invoice_status) + (l.stripe_invoice_url ? ' · <a href="' + esc(l.stripe_invoice_url) + '" target="_blank" rel="noopener">Öppna</a>' : ''))) +
      '</dl>' + (!l.selected_package && !addons.length && l.estimated_start_cost == null ? '<p class="muted">Inga tjänster valda i formuläret.</p>' : '') + '</section>' +
      '</div><div>' +
      '<section class="panel"><h3>Kommentar</h3><textarea class="input" id="ld-note" rows="3" placeholder="Snabb kommentar som syns i listan …">' + esc(noteOf(l)) + '</textarea><div class="ld__save"><button class="btn btn--ghost btn--sm" id="ld-note-save">Spara kommentar</button></div></section>' +
      (myTag() ? '' : '<section class="panel"><h3>Ansvarig</h3><p class="panel__sub">Markerar vems lead det är. Oscar ser bara sina egna.</p><select class="input" id="ld-owner">' +
        [['', 'Elevate Studio'], ['Carl', 'Carl'], ['Isak', 'Isak'], ['Oscar', 'Oscar']].map(function (o) { return '<option value="' + o[0] + '"' + (ownerOf(l) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></section>') +
      '<section class="panel"><h3>Fakturor</h3><div id="ld-inv" class="feed"><p class="muted">Hämtar …</p></div><div class="ld__add"><button class="btn btn--sm" id="ld-invup">Ladda upp faktura</button></div></section>' +
      '<section class="panel"><h3>Anteckningar</h3><div id="ld-notes" class="feed"><p class="muted">Hämtar …</p></div>' +
      '<div class="ld__add"><input class="input" id="ld-newnote" placeholder="Skriv en anteckning …"><button class="btn btn--sm" id="ld-addnote">Lägg till</button></div></section>' +
      '<section class="panel"><h3>Mötesinbjudningar</h3><div id="ld-meet" class="feed"><p class="muted">Hämtar …</p></div></section>' +
      '<section class="panel"><h3>Utskick</h3><div id="ld-out" class="feed"><p class="muted">Hämtar …</p></div></section>' +
      '<section class="panel"><h3>Historik</h3><div id="ld-hist" class="feed"><p class="muted">Hämtar …</p></div></section>' +
      '</div></div><footer class="ld__foot"><button class="link link--danger" id="ld-del">Ta bort lead</button><button class="btn" data-close>Stäng</button></footer></div>',
    function (d) {
      var close = function () { d.remove(); render(); };
      d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-close]')) render(); });
      $('#ld-status', d).addEventListener('change', function (e) {
        var v = e.target.value;
        if (v === 'sold') { d.remove(); return openSold(l); }
        update(l.id, { status: v }).then(function () {
          d.remove(); render();
          if (v === 'archived' || v === 'lost') return toast(v === 'archived' ? 'Flyttad till Arkiv' : 'Markerad som förlorad – ligger under Arkiv');
          toast('Status: ' + sInfo(v)[1]); openLead(l);
        }).catch(function (err) { toast(err.message); });
      });
      $('#ld-form', d).addEventListener('submit', function (e) {
        e.preventDefault(); var g = function (n) { return e.target.elements[n].value.trim(); };
        var cur = lead(l.id) || l;
        var patch = { name: g('name'), company: g('company') || null, email: g('email'), phone: g('phone') || null,
          service_type: g('service_type') || null, company_type: g('company_type') || null, booking_at: fromLocal(g('booking_at')), followup_at: fromLocal(g('followup_at')),
          admin_notes: withOwner(ownerOf(cur), noteOf(cur), { web: g('web'), github: g('github') }) };
        update(l.id, patch).then(function () { toast('Ändringarna är sparade'); }).catch(function (err) { toast(err.message); });
      });
      var ownerSel = $('#ld-owner', d);
      if (ownerSel) ownerSel.addEventListener('change', function () {
        var cur = lead(l.id) || l;
        update(l.id, { admin_notes: withOwner(ownerSel.value, noteOf(cur), metaOf(cur)) }).then(function () { render(); toast(ownerSel.value ? 'Leaden är markerad som ' + ownerSel.value + 's' : 'Leaden är Elevate Studios'); })
          .catch(function (err) { toast(err.message); });
      });
      $('#ld-note-save', d).addEventListener('click', function () {
        var cur = lead(l.id) || l;
        update(l.id, { admin_notes: withOwner(ownerOf(cur), $('#ld-note', d).value, metaOf(cur)) }).then(function () { toast('Kommentaren är sparad'); }).catch(function (err) { toast(err.message); });
      });
      $('#ld-offer', d).addEventListener('click', function () { d.remove(); openOffer(l); });
      $('#ld-invoice', d).addEventListener('click', function () { d.remove(); openInvoice(l); });
      // the customer's portal page (to upload invoices made in another program), or open an account for the lead
      $('#ld-portal', d).addEventListener('click', function () {
        d.remove();
        var q = sb.from('portal_clients').select('id').eq('quote_request_id', l.id);
        q.then(function (r) {
          var hit = !r.error && r.data && r.data[0];
          if (hit || !l.email) return { data: hit ? [hit] : [] };
          return sb.from('portal_clients').select('id').ilike('invite_email', l.email);
        }).then(function (r) {
          var c = r && r.data && r.data[0];
          go('kundportal');
          if (c) ptOpen(c.id);
          else ptEdit({ quote_request_id: l.id, display_name: l.name && l.name !== l.company ? l.name : (l.company || l.name), company_name: l.company, invite_email: l.email });
        });
      });
      var lm = $('#ld-mail', d); if (lm) lm.addEventListener('click', function () { d.remove(); composeMail(l); });
      $('#ld-meet', d).addEventListener('click', function () { d.remove(); bookMeeting(l); });
      $('#ld-propose', d).addEventListener('click', function () { d.remove(); proposeTimes(l); });
      var rv = $('#ld-review', d); if (rv) rv.addEventListener('click', function () { d.remove(); openReview(l); });
      var sd = $('#ld-sold', d); if (sd) sd.addEventListener('click', function () { d.remove(); openSold(l); });
      $('#ld-del', d).addEventListener('click', function () { removeLead(l, function () { d.remove(); }); });
      var feed = function (sel, rows, fn) { $(sel, d).innerHTML = rows.length ? rows.map(fn).join('') : '<p class="muted">Inget än.</p>'; };
      // the invoices uploaded for this lead, with the file one click away
      sb.from('portal_clients').select('id,display_name,company_name,invite_email,quote_request_id').then(function (r) {
        var c = matchAccount(l, r.data || []);
        if (!c) return feed('#ld-inv', [], null);
        return sb.from('portal_invoices').select('*').eq('portal_client_id', c.id).order('created_at', { ascending: false }).then(function (x) {
          var today = new Date().toISOString().slice(0, 10);
          feed('#ld-inv', x.data || [], function (v) {
            var late = v.status === 'obetald' && v.due_on && v.due_on < today;
            return '<div class="feed__it"><p><b>' + esc(v.number) + '</b> · ' + (v.amount_sek != null ? kr(v.amount_sek) : 'belopp saknas') + ' · <span class="tag"' + (late ? ' style="background:#f6e0db;color:#b2412c"' : '') + '>' + (late ? 'Förfallen' : esc(PT_INV[v.status] || v.status)) + '</span>' +
              (v.file_path ? ' <button class="btn btn--sm btn--ghost" data-invfile="' + esc(v.file_path) + '">Öppna</button>' : '') + '</p><time>' + (v.issued_on ? 'Daterad ' + day(v.issued_on) : '') + (v.due_on ? ' · förfaller ' + day(v.due_on) : '') + '</time></div>';
          });
        });
      });
      $('#ld-inv', d).addEventListener('click', function (e) {
        var b = e.target.closest('[data-invfile]'); if (!b) return;
        var w = window.open('', '_blank');
        sb.storage.from('portal-invoices').createSignedUrl(b.dataset.invfile, 300).then(function (r) { if (r.error) { if (w) w.close(); return toast(r.error.message); } if (w) w.location = r.data.signedUrl; else location.href = r.data.signedUrl; });
      });
      $('#ld-invup', d).addEventListener('click', function () { d.remove(); ptUploadDialog({ lead: l }); });
      var loadNotes = function () {
        sb.from('quote_notes').select('*').eq('quote_request_id', l.id).order('created_at', { ascending: false }).then(function (r) {
          feed('#ld-notes', r.data || [], function (n) { return '<div class="feed__it"><p>' + esc(n.body) + '</p><time>' + dt(n.created_at) + (n.created_by === st.user.id ? ' · du' : '') + '</time></div>'; });
        });
      };
      loadNotes();
      var add = function () {
        var t = $('#ld-newnote', d), body = t.value.trim(); if (!body) return;
        sb.from('quote_notes').insert({ quote_request_id: l.id, body: body, created_by: st.user.id }).then(function (r) {
          if (r.error) return toast(r.error.message);
          t.value = ''; loadNotes();
        });
      };
      $('#ld-addnote', d).addEventListener('click', add);
      $('#ld-newnote', d).addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      sb.from('meeting_invites').select('booking_at,meet_link,recipients,outcome,subject,created_at').eq('quote_request_id', l.id).order('booking_at', { ascending: false }).then(function (r) {
        feed('#ld-meet', r.data || [], function (m) {
          return '<div class="feed__it"><p><b>' + dt(m.booking_at) + '</b>' + (m.subject ? ' · ' + esc(m.subject) : '') + '</p><time>' +
            (Array.isArray(m.recipients) ? esc(m.recipients.join(', ')) : '') + (m.outcome ? ' · ' + esc(m.outcome) : '') + (m.meet_link ? ' · <a href="' + esc(m.meet_link) + '" target="_blank" rel="noopener">Meet-länk</a>' : '') + '</time></div>';
        });
      });
      sb.from('outbound_messages').select('channel,recipient,subject,status,created_at').eq('quote_request_id', l.id).order('created_at', { ascending: false }).then(function (r) {
        feed('#ld-out', r.data || [], function (m) {
          return '<div class="feed__it"><p><b>' + esc(m.channel === 'sms' ? 'SMS' : 'Mejl') + '</b> till ' + esc(m.recipient) + (m.subject ? ' · ' + esc(m.subject) : '') + '</p><time>' + dt(m.created_at) + ' · ' + esc(m.status || '') + '</time></div>';
        });
      });
      sb.from('quote_status_history').select('from_status,to_status,note,created_at').eq('quote_request_id', l.id).order('created_at', { ascending: false }).then(function (r) {
        var rows = (r.data || []).concat([{ to_status: 'new', created_at: l.created_at, note: 'Förfrågan kom in' }]);
        feed('#ld-hist', rows, function (h) {
          var t = sInfo(h.to_status);
          return '<div class="feed__it"><p><i class="dot" style="background:' + t[2] + '"></i> ' + (h.from_status ? esc(sInfo(h.from_status)[1]) + ' → ' : '') + '<b>' + t[1] + '</b>' + (h.note ? ' · ' + esc(h.note) : '') + '</p><time>' + dt(h.created_at) + '</time></div>';
        });
      });
    });
  }

  /* ---------- Kalender: month grid like the old admin, plus a list of what is coming up ---------- */
  var CAT_COLOR = { meeting: '#14b8a6', call: '#3b82f6', task: '#10b981', deadline: '#f43f5e', reminder: '#f59e0b', personal: '#8b5cf6', other: '#94a3b8', lead: '#1d3b2a', followup: '#06b6d4' };
  function newActivity(at) {
    var t = at ? new Date(at) : new Date(Date.now() + 864e5); if (!at) t.setHours(9, 0, 0, 0);
    formDialog('Ny aktivitet', 'Syns i kalendern här i admin.', [
      { name: 'title', label: 'Titel', required: true }, { name: 'category', label: 'Typ', options: CATEGORY, value: 'meeting' },
      { name: 'starts_at', label: 'Start', type: 'datetime-local', value: localInput(t.toISOString()), required: true },
      { name: 'minutes', label: 'Längd (minuter)', type: 'number', value: 30 }, { name: 'location', label: 'Plats' }, { name: 'description', label: 'Beskrivning', type: 'textarea' }
    ], function (v) {
      var s = new Date(v.starts_at);
      return sb.from('calendar_activities').insert({ title: v.title, category: v.category, location: v.location, description: v.description, starts_at: s.toISOString(),
        ends_at: new Date(s.getTime() + (Number(v.minutes) || 30) * 6e4).toISOString(), created_by: st.user.id });
    });
  }
  function openActivity(a) {
    dialog('<h2>' + esc(a.title) + '</h2><p>' + esc(CATEGORY[a.category] || 'Aktivitet') + ' · ' + dt(a.starts_at) + (a.location ? ' · ' + esc(a.location) : '') + '</p>' +
      (a.description ? '<div class="box">' + esc(a.description) + '</div>' : '') +
      '<div class="dlg__row"><button class="link link--danger" id="del" style="margin:0 auto 0 0">Ta bort</button><button class="btn" data-close>Stäng</button></div>', function (d) {
      $('#del', d).addEventListener('click', function () {
        if (!confirm('Ta bort aktiviteten?')) return;
        sb.from('calendar_activities').delete().eq('id', a.id).then(function (r) { if (r.error) return toast(r.error.message); d.remove(); render(); });
      });
    });
  }
  function renderCalendar() {
    var m = st.month || (st.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    var first = new Date(m), gridStart = new Date(first); gridStart.setDate(1 - ((first.getDay() + 6) % 7));
    var gridEnd = new Date(gridStart.getTime() + 42 * 864e5);
    var title = m.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
    main().innerHTML = head('Kalender', 'Kundmöten, uppringningar och det du lägger in själv. Klicka på en dag för att lägga till något.', '<button class="btn" id="add">+ Ny aktivitet</button>') +
      '<div class="calw"><div class="calm"><div class="calm__bar"><h2>' + title.charAt(0).toUpperCase() + title.slice(1) + '</h2>' +
      '<button class="btn btn--ghost btn--sm" id="today">Idag</button><button class="iconbtn" id="prev" aria-label="Föregående månad">&#8249;</button><button class="iconbtn" id="next" aria-label="Nästa månad">&#8250;</button></div>' +
      '<div class="calm__grid" id="grid"><p class="empty" style="grid-column:1/-1">Hämtar …</p></div></div><section class="panel calw__side"><h3>Kommande två veckor</h3><div class="cal" id="cal"></div></section></div>';
    $('#add').addEventListener('click', function () { newActivity(); });
    $('#prev').addEventListener('click', function () { st.month = new Date(m.getFullYear(), m.getMonth() - 1, 1); render(); });
    $('#next').addEventListener('click', function () { st.month = new Date(m.getFullYear(), m.getMonth() + 1, 1); render(); });
    $('#today').addEventListener('click', function () { st.month = null; render(); });
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var from = new Date(Math.min(gridStart.getTime(), now.getTime())), to = new Date(Math.max(gridEnd.getTime(), now.getTime() + 14 * 864e5));
    var own = myTag() ? function (q) { return q.eq('created_by', st.user.id); } : function (q) { return q; };
    own(sb.from('calendar_activities').select('id,title,starts_at,category,location,description')).gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString()).order('starts_at').then(function (r) {
      if (st.view !== 'kalender') return;
      if (r.error) toast('Kunde inte hämta aktiviteter: ' + r.error.message);
      var items = (r.data || []).map(function (a) { return { at: a.starts_at, title: a.title, color: CAT_COLOR[a.category] || CAT_COLOR.other, tag: CATEGORY[a.category] || 'Aktivitet', act: a }; });
      st.leads.forEach(function (l) {
        if (l.booking_at) items.push({ at: l.booking_at, title: (l.company || l.name), color: CAT_COLOR.lead, tag: 'Kundmöte' + (MEETING[l.meeting_type] && l.meeting_type !== 'quote' ? ' · ' + MEETING[l.meeting_type] : ''), lead: l.id });
        if (l.followup_at) items.push({ at: l.followup_at, title: 'Ring ' + (l.company || l.name), color: CAT_COLOR.followup, tag: 'Ring upp', lead: l.id });
      });
      items.sort(function (a, b) { return Date.parse(a.at) - Date.parse(b.at); });
      var byDay = {}; items.forEach(function (i, n) { i.n = n; var k = new Date(i.at).toDateString(); (byDay[k] = byDay[k] || []).push(i); });
      var hm = function (i) { return new Date(i.at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }); };
      var cells = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(function (d) { return '<div class="calm__dow">' + d + '</div>'; }).join('');
      for (var i = 0; i < 42; i++) {
        var d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i), ev = byDay[d.toDateString()] || [];
        cells += '<div class="calm__day' + (d.getMonth() !== m.getMonth() ? ' is-out' : '') + (d.getTime() === now.getTime() ? ' is-today' : '') + '" data-day="' + d.toISOString() + '"><b>' + d.getDate() + '</b>' +
          ev.slice(0, 2).map(function (e) { return '<button class="calm__ev" data-n="' + e.n + '" style="--c:' + e.color + '" title="' + esc(e.tag) + '"><time>' + hm(e) + '</time> ' + esc(e.title) + '</button>'; }).join('') +
          (ev.length > 2 ? '<span class="calm__more">+' + (ev.length - 2) + ' till</span>' : '') + '</div>';
      }
      $('#grid').innerHTML = cells;
      var soon = items.filter(function (x) { var t = Date.parse(x.at); return t >= now.getTime() && t < now.getTime() + 14 * 864e5; });
      var days = {}; soon.forEach(function (x) { var k = new Date(x.at).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }); (days[k] = days[k] || []).push(x); });
      $('#cal').innerHTML = Object.keys(days).map(function (k) {
        return '<section class="cal__day"><h3>' + k + '</h3>' + days[k].map(function (x) {
          return '<div class="cal__ev"><time>' + hm(x) + '</time><span><button class="link" data-n="' + x.n + '">' + esc(x.title) + '</button></span><span class="tag" style="color:' + x.color + '">' + esc(x.tag) + '</span></div>';
        }).join('') + '</section>';
      }).join('') || '<p class="muted">Inget inbokat de kommande 14 dagarna.</p>';
      var open = function (e) {
        var b = e.target.closest('[data-n]');
        if (b) { var it = items[b.dataset.n]; return it.lead ? openLead(lead(it.lead)) : openActivity(it.act); }
        var day = e.target.closest('[data-day]'); if (day) { var t = new Date(day.dataset.day); t.setHours(9, 0, 0, 0); newActivity(t); }
      };
      $('#grid').addEventListener('click', open); $('#cal').addEventListener('click', open);
    });
  }

  /* ---------- Kontakter ---------- */
  function contactDialog(c) {
    c = c || {};
    formDialog(c.id ? 'Redigera kontakt' : 'Ny kontakt', null, [
      { name: 'full_name', label: 'Namn', value: c.full_name, required: true }, { name: 'company_name', label: 'Företag', value: c.company_name },
      { name: 'email', label: 'E-post', type: 'email', value: c.email }, { name: 'phone', label: 'Telefon', value: c.phone },
      { name: 'customer_status', label: 'Kundstatus', options: CUSTOMER, value: c.customer_status || 'lead' }, { name: 'notes', label: 'Anteckningar', type: 'textarea', value: c.notes }
    ], function (v) {
      return c.id ? sb.from('contacts').update(v).eq('id', c.id) : sb.from('contacts').insert(Object.assign(v, { contact_source: 'manual' }));
    }, c.id ? '<button type="button" class="link link--danger" id="arch" style="margin:0 auto 0 0">Arkivera</button>' : '');
    var a = $('#arch'); if (a) a.addEventListener('click', function () {
      sb.from('contacts').update({ archived_at: new Date().toISOString() }).eq('id', c.id).then(function (r) { if (r.error) return toast(r.error.message); $('.dlg').remove(); render(); toast('Kontakten är arkiverad'); });
    });
  }
  function renderContacts() {
    main().innerHTML = head('Kontakter', 'Kunder och kontakter, sparade i databasen.', '<button class="btn" id="add">+ Ny kontakt</button>');
    $('#add').addEventListener('click', function () { contactDialog(); });
    fetchRows(sb.from('contacts').select('id,full_name,email,phone,company_name,customer_status,notes,created_at').is('archived_at', null).order('created_at', { ascending: false }).limit(3000), function (rows) {
      var by = function (k) { return rows.filter(function (c) { return c.customer_status === k; }).length; };
      main().insertAdjacentHTML('beforeend', kpis([['Kontakter', rows.length], ['Aktiva kunder', by('active')], ['Blivande kunder', by('prospect')], ['Leads', by('lead')]]) +
        '<div class="bar"><input class="input" id="cq" placeholder="Sök namn, företag, mejl …"></div><div id="ct"></div>');
      var draw = function () {
        var q = $('#cq').value.toLowerCase();
        var list = rows.filter(function (c) { return !q || [c.full_name, c.company_name, c.email, c.phone].some(function (v) { return v && v.toLowerCase().indexOf(q) > -1; }); });
        $('#ct').innerHTML = table([['Namn', function (c) { return '<b>' + esc(c.full_name) + '</b>'; }], ['Företag', function (c) { return esc(c.company_name || '–'); }],
          ['E-post', function (c) { return c.email ? '<button type="button" class="link link--inline" data-mail="' + esc(c.id) + '">' + esc(c.email) + '</button>' : '–'; }], ['Telefon', function (c) { return esc(c.phone || '–'); }],
          ['Status', function (c) { return '<span class="tag">' + esc(CUSTOMER[c.customer_status] || c.customer_status || '–') + '</span>'; }], ['Tillagd', function (c) { return day(c.created_at); }]],
          list.slice(0, 300), function (c) { return 'data-id="' + c.id + '" class="click"'; });
      };
      draw();
      $('#cq').addEventListener('input', draw);
      $('#ct').addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        var m = e.target.closest('[data-mail]');
        if (m) { var c = rows.find(function (x) { return x.id === m.dataset.mail; }); return composeMail({ email: c.email, name: c.full_name }); }
        var tr = e.target.closest('tr[data-id]'); if (tr) contactDialog(rows.find(function (c) { return c.id === tr.dataset.id; }));
      });
    });
  }

  /* ---------- Fakturor ---------- */
  function renderInvoices() {
    var sold = st.leads.filter(function (l) { return l.status === 'sold' || l.stripe_invoice_id; }).sort(function (a, b) { return Date.parse(b.sold_at || b.created_at) - Date.parse(a.sold_at || a.created_at); });
    var sum = function (f) { return sold.filter(f).reduce(function (s, l) { return s + Number(l.sold_amount || 0); }, 0); };
    var soldSum = sum;
    main().innerHTML = head('Fakturor', 'Sålda affärer och deras fakturor.', '<button class="btn" id="inv-upload">Ladda upp fakturor</button>') +
      kpis([['Sålt totalt', kr(sum(function () { return true; }))], ['Affärer', sold.length], ['Fakturerat', kr(sum(function (l) { return l.stripe_invoice_id; }))], ['Betalt', kr(sum(function (l) { return l.stripe_invoice_status === 'paid'; }))]]) +
      info('Fakturera', 'Öppna affären och tryck på Skapa faktura, så får du en PDF i samma stil som webbavtalet. Mejla den till kunden och markera som betald när pengarna kommit.') +
      '<div id="it">' + table([['Kund', function (l) { return '<b>' + esc(l.company || l.name) + '</b>'; }], ['Såld', function (l) { return day(l.sold_at); }],
        ['Belopp', function (l) { return l.sold_amount != null ? kr(l.sold_amount) : '–'; }],
        ['Faktura', function (l) { return '<span data-invcell="' + l.id + '">' + (l.stripe_invoice_status ? '<span class="tag">' + esc(l.stripe_invoice_status) + '</span>' : '<span class="muted">Ingen</span>') + '</span>'; }],
        ['', function (l) { return l.stripe_invoice_url ? '<a href="' + esc(l.stripe_invoice_url) + '" target="_blank" rel="noopener">Öppna</a>' : ''; }]], sold,
        function (l) { return 'data-lead="' + l.id + '" class="click"'; }) + '</div>';
    // the customer's invoice page (customer portal) rather than the lead, when the customer has an account
    var accounts = [];
    var accountOf = function (l) { return matchAccount(l, accounts); };
    var openAccount = function (id) { go('kundportal'); setTimeout(function () { ptOpen(id); }, 400); };
    $('#it').addEventListener('click', function (e) {
      var tr = e.target.closest('[data-lead]'); if (!tr || e.target.closest('a')) return;
      var l = lead(tr.dataset.lead), c = l && accountOf(l);
      if (c) openAccount(c.id); else openLead(l);
    });
    // invoices made in another program go to the customer's page in the customer portal
    $('#inv-upload').addEventListener('click', function () { ptUploadDialog(); });
    // every uploaded invoice, newest first, with amount and dates; a click opens the customer's invoice page
    Promise.all([
      sb.from('portal_clients').select('id,display_name,company_name,invite_email,quote_request_id'),
      sb.from('portal_invoices').select('id,portal_client_id,number,amount_sek,issued_on,due_on,status,file_path,created_at').order('created_at', { ascending: false }).limit(500)
    ]).then(function (r) {
      if (st.view !== 'fakturor') return;
      accounts = r[0].data || [];
      if (r[1].error) return;
      var inv = r[1].data || [], name = function (id) { var c = accounts.filter(function (x) { return x.id === id; })[0]; return c ? (c.company_name || c.display_name || c.invite_email) : '–'; };
      var today = new Date().toISOString().slice(0, 10);
      var late = function (x) { return x.status === 'obetald' && x.due_on && x.due_on < today; };
      var sum = function (f) { return inv.filter(f).reduce(function (a, x) { return a + (x.amount_sek || 0); }, 0); };
      var html = '<section class="panel" id="inv-up"><h3>Uppladdade fakturor</h3><p class="muted" style="margin:-4px 0 12px">' + inv.length + ' fakturor · ' + kr(sum(function (x) { return x.status === 'obetald'; })) + ' obetalt' + (inv.some(late) ? ' · <b style="color:#b2412c">' + inv.filter(late).length + ' förfallna</b>' : '') + '. Klicka för kundens fakturor.</p>' +
        (inv.length ? table([['Kund', function (x) { return '<b>' + esc(name(x.portal_client_id)) + '</b>'; }], ['Nummer', function (x) { return esc(x.number); }],
          ['Belopp', function (x) { return x.amount_sek != null ? kr(x.amount_sek) : '<span class="muted">Fyll i</span>'; }], ['Fakturadatum', function (x) { return x.issued_on || '–'; }],
          ['Förfaller', function (x) { return x.due_on ? (late(x) ? '<b style="color:#b2412c">' + x.due_on + '</b>' : x.due_on) : '–'; }],
          ['Status', function (x) { return '<span class="tag">' + esc(PT_INV[x.status] || x.status) + '</span>'; }]], inv, function (x) { return 'data-acc="' + x.portal_client_id + '" class="click"'; })
          : '<p class="empty">Inga uppladdade fakturor än. Tryck på Ladda upp fakturor.</p>') + '</section>';
      var anchor = main().querySelector('.info');
      if (anchor) anchor.insertAdjacentHTML('afterend', html); else main().insertAdjacentHTML('beforeend', html);
      // the numbers on top include the uploaded invoices too
      var k = main().querySelectorAll('.kpis .kpi b');
      if (k.length >= 4) {
        k[2].textContent = kr(soldSum(function (l) { return l.stripe_invoice_id; }) + inv.reduce(function (a, x) { return a + (x.status !== 'krediterad' ? (x.amount_sek || 0) : 0); }, 0));
        k[3].textContent = kr(soldSum(function (l) { return l.stripe_invoice_status === 'paid'; }) + inv.reduce(function (a, x) { return a + (x.status === 'betald' ? (x.amount_sek || 0) : 0); }, 0));
      }
      // the sold deals below: show the invoices uploaded to the customer's account instead of "Ingen"
      main().querySelectorAll('[data-invcell]').forEach(function (cell) {
        var l = lead(cell.dataset.invcell), c = l && accountOf(l); if (!c) return;
        var mine = inv.filter(function (x) { return x.portal_client_id === c.id; }); if (!mine.length) return;
        var open = mine.filter(function (x) { return x.status === 'obetald'; }), anyLate = open.some(late);
        cell.innerHTML = '<span class="tag"' + (anyLate ? ' style="background:#f6e0db;color:#b2412c"' : '') + '>' + (open.length ? (anyLate ? 'Förfallen' : 'Obetald') : 'Betald') + '</span> <small class="muted">' + mine.length + (mine.length === 1 ? ' faktura' : ' fakturor') + '</small>';
      });
      $('#inv-up').addEventListener('click', function (e) { var tr = e.target.closest('[data-acc]'); if (tr) openAccount(tr.dataset.acc); });
    });
  }

  /* ---------- Utskick ---------- */
  var CAMPAIGN = { draft: 'Utkast', scheduled: 'Schemalagt', sending: 'Skickas', sent: 'Skickat', failed: 'Misslyckades', cancelled: 'Avbrutet' };
  function renderCampaigns() {
    main().innerHTML = head('Utskick', 'Mejlutskick och nyhetsbrev till kontakter och leads.', '<button class="btn" data-q="campaign">' + ICON.send + 'Nytt mejlutskick</button>') +
      info('Skicka utskick', 'Snabba utskick gör ni med knappen ovan. Större nyhetsbrev skrivs och skickas i Brevo, från info@elevatestudio.nu. Den som anmäler sig i sidfoten på hemsidan hamnar direkt på listan där, och Brevo sköter avregistrering. Nedan ser ni alla utskick.');
    bindQuick();
    fetchRows(sb.from('email_campaigns').select('internal_name,subject,status,recipient_count,sent_count,sent_at,scheduled_at,created_at').order('created_at', { ascending: false }), function (rows) {
      main().insertAdjacentHTML('beforeend', kpis([['Utskick', rows.length], ['Skickade', rows.filter(function (c) { return c.status === 'sent'; }).length],
        ['Mejl skickade', rows.reduce(function (s, c) { return s + (c.sent_count || 0); }, 0)], ['Utkast', rows.filter(function (c) { return c.status === 'draft'; }).length]]) +
        table([['Namn', function (c) { return '<b>' + esc(c.internal_name || '–') + '</b>'; }], ['Ämne', function (c) { return esc(c.subject || '–'); }],
          ['Status', function (c) { return '<span class="tag">' + esc(CAMPAIGN[c.status] || c.status) + '</span>'; }], ['Mottagare', function (c) { return c.recipient_count || 0; }],
          ['Skickade', function (c) { return c.sent_count || 0; }], ['Datum', function (c) { return day(c.sent_at || c.scheduled_at || c.created_at); }]], rows));
    });
  }

  /* ---------- Segment ---------- */
  function renderSegments() {
    main().innerHTML = head('Segment', 'Grupper av kontakter för utskick.', '<button class="btn" id="add">+ Nytt segment</button>');
    $('#add').addEventListener('click', function () {
      formDialog('Nytt segment', null, [{ name: 'name', label: 'Namn', required: true }, { name: 'description', label: 'Beskrivning', type: 'textarea' }],
        function (v) { return sb.from('contact_segments').insert(Object.assign(v, { created_by: st.user.id })); });
    });
    fetchRows(sb.from('contact_segments').select('id,name,description,created_at').is('archived_at', null).order('created_at', { ascending: false }), function (rows) {
      main().insertAdjacentHTML('beforeend', '<div class="cards" id="sg">' + (rows.map(function (g) {
        return '<article class="cardx"><h3>' + esc(g.name) + '</h3><p>' + esc(g.description || 'Ingen beskrivning.') + '</p><footer><time>' + day(g.created_at) + '</time><button class="link link--danger" data-arch="' + g.id + '">Arkivera</button></footer></article>';
      }).join('') || '<p class="empty">Inga segment än.</p>') + '</div>');
      $('#sg').addEventListener('click', function (e) {
        var b = e.target.closest('[data-arch]'); if (!b) return;
        sb.from('contact_segments').update({ archived_at: new Date().toISOString() }).eq('id', b.dataset.arch).then(function (r) { if (r.error) return toast(r.error.message); render(); });
      });
    });
  }

  /* ---------- Besökare ---------- */
  /* ---------- Besökare: everything the beacon collects, as a dashboard and as a list of every visit ---------- */
  function renderVisitors() {
    var days = st.visitDays || 30;
    main().innerHTML = head('Besökare', 'Vilka som kommer in, varifrån, vad de läser, hur länge och vad de gör.',
      '<span class="seg" id="vdays">' + [7, 30, 90].map(function (d) { return '<button class="seg__b' + (d === days ? ' is-on' : '') + '" data-d="' + d + '">' + d + ' dagar</button>'; }).join('') + '</span><button class="btn btn--ghost btn--sm" id="vreport">Mejla veckorapporten nu</button>');
    $('#vdays').addEventListener('click', function (e) { var b = e.target.closest('[data-d]'); if (b) { st.visitDays = Number(b.dataset.d); renderVisitors(); } });
    // the weekly report goes out every Sunday evening by itself (worker/report.js); this sends it at once
    $('#vreport').addEventListener('click', function () {
      var b = this; b.disabled = true; b.textContent = 'Skickar …';
      sb.auth.getSession().then(function (r) { return fetch('/api/report/send', { method: 'POST', headers: { Authorization: 'Bearer ' + (r.data.session ? r.data.session.access_token : '') } }); })
        .then(function (r) { return r.json().catch(function () { return {}; }); }).then(function (d) {
          b.disabled = false; b.textContent = 'Mejla veckorapporten nu';
          toast(d.ok ? 'Veckorapporten är skickad till Elevates Gmail' : d.error === 'not_configured' ? 'Lägg först in REPORT_KEY i Cloudflare och kör veckorapportens SQL' : 'Det gick inte: ' + (d.error || 'okänt fel'));
        }, function () { b.disabled = false; b.textContent = 'Mejla veckorapporten nu'; toast('Servern svarade inte'); });
    });
    Promise.resolve(sb.from('site_visits').select('source,device_type,os,browser,city,country,created_at').eq('source', 'team:device').limit(500)).then(function (t) { return (t && t.data) || []; }, function () { return []; }).then(function (team) {
    // the team's devices: a visit before a device was registered, with exactly the same device, system, browser, city and
    // country, is counted as the team's own and hidden (devices are marked since 27 Nov; this covers the time before)
    var print = function (x) { return [x.device_type, x.os, x.browser, x.city, x.country].join('|'); }, teamAt = {};
    team.forEach(function (x) { if (x.source !== 'team:device' || !x.city) return; var k = print(x), t = Date.parse(x.created_at); if (!teamAt[k] || t > teamAt[k]) teamAt[k] = t; });
    var isTeam = function (x) { var t = teamAt[print(x)]; return !!t && Date.parse(x.created_at) < t; };
    fetchRows(sb.from('site_visits').select('*').gte('created_at', since(days)).order('created_at', { ascending: false }).limit(20000), function (all) {
      // answers in the cookie box are kept apart: they are not visits
      var consents = all.filter(function (x) { return !x.is_bot && x.source === 'event:consent'; });
      var yes = consents.filter(function (x) { return x.utm_medium === 'ja'; }).length;
      var real = all.filter(function (x) { return !x.is_bot && x.source !== 'event:consent'; });
      var hiddenTeam = st.showTeam ? [] : real.filter(isTeam);
      var rows = st.showTeam ? real : real.filter(function (x) { return !isTeam(x); });
      var views = rows.filter(function (x) { return !/^event:/.test(x.source || ''); });
      var events = rows.filter(function (x) { return /^event:/.test(x.source || ''); });
      var leaves = events.filter(function (x) { return x.source === 'event:leave'; });
      // A conversion is a real lead: a form (not the newsletter), a booked meeting, an order or contact details left in the chat.
      // Opening or asking the chat is not one. Before 26 Nov every chat question counted, and a form counted twice
      // (on "Skickar …" and when sent), so each visit counts once however many of these it has.
      var isConv = function (x) { var s = x.source || '', l = x.utm_medium || '';
        return /^event:(booking|booking_link|order|chat_lead)$/.test(s) || (s === 'event:form' && !/nyhetsbrev/i.test(l)) || (s === 'event:chat' && /kontaktuppgift/.test(l)); };
      // sessions: the views and events with the same id, in time order
      // One visit = one person's pages in a row. Newer page views share a visit id (track.js); older ones each had their own,
      // so page views from the same kind of device in the same place within 30 minutes are counted as one visit.
      var S = {}, bySid = {}, byPrint = {}, n = 0;
      rows.slice().reverse().forEach(function (x) {
        var t = Date.parse(x.created_at), print = [x.device_type, x.os, x.browser, x.city, x.country].join('|'), v = bySid[x.session_id];
        if (!v) {
          var last = byPrint[print];
          v = last && t - last.t < 30 * 6e4 && !(x.referrer_host && !/^event:/.test(x.source || '')) ? last.v : 'v' + (++n);
          bySid[x.session_id] = v;
        }
        byPrint[print] = { v: v, t: t };
        (S[v] = S[v] || []).push(x);
      });
      var sessions = Object.keys(S).map(function (k) {
        var list = S[k].slice().sort(function (a, b) { return Date.parse(a.created_at) - Date.parse(b.created_at); }), v = list.filter(function (x) { return !/^event:/.test(x.source || ''); }), first = v[0] || list[0];
        // seconds per page from the leave beacons; older beacons counted a tab left open (up to 24 h), so each page is capped
        // at 30 minutes. No leave beacon at all (the browser closed before it was sent) = unknown time, not 0 seconds.
        var lv = list.filter(function (x) { return x.source === 'event:leave'; });
        var secs = lv.length ? lv.reduce(function (s, x) { return s + Math.min(1800, Number(x.utm_medium) || 0); }, 0) : null;
        return { id: k, first: first, views: v, secs: secs, events: list.filter(function (x) { return /^event:/.test(x.source || '') && x.source !== 'event:leave'; }),
          start: first.created_at, converted: list.some(isConv) };
      }).sort(function (a, b) { return Date.parse(b.start) - Date.parse(a.start); });
      var conv = sessions.filter(function (s) { return s.converted; });
      var bounce = sessions.filter(function (s) { return s.views.length <= 1; }).length;
      var timed = sessions.filter(function (s) { return s.secs != null; });
      var avgSecs = timed.length ? Math.round(timed.reduce(function (a, s) { return a + s.secs; }, 0) / timed.length) : 0;
      var fmtSecs = function (s) { if (s == null) return 'okänd tid'; return s >= 60 ? Math.floor(s / 60) + ' min ' + (s % 60) + ' s' : s + ' s'; };
      var SRC = { direct: 'Direkt', google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo', social: 'Sociala medier', ai: 'AI-assistenter', referral: 'Andra sajter' };
      var DEV = { mobile: 'Mobil', desktop: 'Dator', tablet: 'Surfplatta', unknown: 'Okänt' };
      var EV = { form: 'Formulär skickat', booking: 'Möte bokat', booking_link: 'Bokat via länk', chat: 'Frågade chatten', chat_lead: 'Lämnade kontaktuppgift i chatten', newsletter: 'Gick med i nyhetsbrevet', order: 'Beställde', quote_step: 'Började på snabbofferten', quote_bar: 'Tryckte på offertknappen (mobil)', cta_offert: 'Klick: Få en offert', seotest: 'Körde SEO-djuptestet', seo_unlock: 'Låste upp SEO-rapporten', checkout: 'Klick: möte i kassan', designa: 'Designa-verktyget', call: 'Ringde', mail: 'Mejlade', cta_boka: 'Klick: Boka möte', cta_kontakt: 'Klick: Kontakt', sitetest: 'Testade en sajt', sitetest_pdf: 'Laddade ner testet (PDF)', sitetest_send: 'Skickade testet till oss' };
      // per day, and per hour of day
      var perDay = []; for (var i = Math.min(days, 30) - 1; i >= 0; i--) { var d = new Date(Date.now() - i * 864e5); var key = d.toDateString(); perDay.push([d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }), sessions.filter(function (s) { return new Date(s.start).toDateString() === key; }).length]); }
      var maxDay = Math.max.apply(null, perDay.map(function (p) { return p[1]; }).concat([1]));
      // per hour: today only by default (what most expect from a clock), or every day in the period added together
      var hourAll = st.hourScope === 'all', todayKey = new Date().toDateString();
      var hourRows = hourAll ? views : views.filter(function (x) { return new Date(x.created_at).toDateString() === todayKey; });
      var perHour = []; for (var h = 0; h < 24; h++) perHour.push([h + ':00', hourRows.filter(function (x) { return new Date(x.created_at).getHours() === h; }).length]);
      var hourTitle = (hourAll ? 'Sidvisningar per klockslag – alla ' + days + ' dagar ihop' : 'Sidvisningar per klockslag – i dag (' + hourRows.length + ' st)') +
        ' <span class="seg seg--inline" id="vhour"><button class="seg__b' + (hourAll ? '' : ' is-on') + '" data-h="today">I dag</button><button class="seg__b' + (hourAll ? ' is-on' : '') + '" data-h="all">Hela perioden</button></span>';
      var maxHour = Math.max.apply(null, perHour.map(function (p) { return p[1]; }).concat([1]));
      // time per page: the leave events carry seconds, keyed by path
      var timeOn = {}; leaves.forEach(function (x) { (timeOn[x.path] = timeOn[x.path] || []).push(Math.min(1800, Number(x.utm_medium) || 0)); });
      var pages = countBy(views, function (x) { return x.path; }, 15).map(function (p) { var ts = timeOn[p[0]] || []; return [p[0], p[1], ts.length ? Math.round(ts.reduce(function (a, b) { return a + b; }, 0) / ts.length) : null]; });
      var entries = countBy(sessions, function (s) { return s.views[0] ? s.views[0].path : ''; }, 10);
      var exits = countBy(sessions, function (s) { return s.views.length ? s.views[s.views.length - 1].path : ''; }, 10);
      var chart = function (title, pairs, max, cls) { return '<section class="panel"><h3>' + title + '</h3><div class="cols ' + (cls || '') + '">' + pairs.map(function (p) { return '<div tabindex="0"><i data-tip="' + p[0] + ': ' + p[1] + ' st" style="--h:' + Math.round(p[1] / max * 100) + '%"></i><span>' + p[0] + '</span></div>'; }).join('') + '</div></section>'; };
      main().insertAdjacentHTML('beforeend',
        kpis([['Besök', sessions.length], ['Sidvisningar', views.length], ['Snitt tid per besök', fmtSecs(avgSecs)], ['Sidor per besök', sessions.length ? (views.length / sessions.length).toFixed(1) : '–'],
          ['Avvisningar', sessions.length ? Math.round(bounce / sessions.length * 100) + ' %' : '–'], ['Konverteringar', conv.length], ['Konverteringsgrad', sessions.length ? (conv.length / sessions.length * 100).toFixed(1) + ' %' : '–'],
          ['Godkänner statistik', consents.length ? Math.round(yes / consents.length * 100) + ' %' : '–'], ['Svar i cookierutan', consents.length]]) +
        '<section class="panel live" id="live"><h3>Just nu <small id="livecount"></small></h3><p class="panel__sub">Besökare som har gjort något på sajten de senaste 5 minuterna. Uppdateras var 20:e sekund. Era egna inloggade enheter syns inte.</p><div id="livelist"><p class="empty">Hämtar …</p></div></section>' +
        info('Era egna besök räknas inte', 'En enhet där någon i teamet har loggat in här i admin räknas inte i statistiken – den här enheten räknas alltså inte. Logga in i admin en gång på varje dator och telefon ni använder, så syns bara riktiga besökare här. ' +
          'Äldre besök från samma enheter döljs också: ett besök från innan enheten loggade in, med exakt samma typ av enhet, system, webbläsare, stad och land, räknas som ert eget. ' +
          (Object.keys(teamAt).length ? (st.showTeam ? 'Just nu visas de ändå. <button class="linkbtn" id="vteam">Dölj teamets besök</button>' : '<b>' + hiddenTeam.length + '</b> rader är dolda på det sättet (från ' + Object.keys(teamAt).length + (Object.keys(teamAt).length === 1 ? ' registrerad enhet).' : ' registrerade enheter).') + ' En riktig besökare med exakt samma enhet i samma stad kan ha följt med. <button class="linkbtn" id="vteam">Visa dem ändå</button>') : 'Inga enheter är registrerade än – det sker nästa gång ni loggar in här på varje enhet.')) +
        info('Så räknas tiden', 'Sedan 26 november räknas bara aktiv tid: fliken syns och någon har scrollat, klickat eller skrivit de senaste två minuterna, högst 30 minuter per sida. Äldre besök kunde räkna en flik som stått öppen i ett dygn (1 440 minuter) – de kapas nu vid 30 minuter. ' +
          '<b>Okänd tid</b> betyder att webbläsaren stängdes innan den hann skicka tiden, vilket är vanligt i mobilen. Det är inte botar: kända botar filtreras bort, och en bot måste dessutom säga ja i cookierutan för att räknas.') +
        info('Bara de som säger ja räknas', 'Sedan 26 november räknas ett besök bara om besökaren har godkänt Statistik i cookierutan. Siffrorna ovan gäller alltså de som sagt ja. <b>Godkänner statistik</b> visar hur stor andel av alla som har svarat i rutan som sa ja; svaren sparas utan sida, enhet och plats.') +
        (rows.length ? '' : info('Inga besök sparade än', 'Därför står allt på 0. Databasen ligger i Lovable Cloud, och den behöver ett tillstånd för att hemsidan ska få spara besök. Öppna projektet i Lovable → More → Database → Manage → SQL editor, klistra in filen <b>supabase/sql/2026-11-22_lovable-cloud.sql</b> och tryck Run. Efter det fylls statistiken på av sig själv.')) +
        chart('Besök per dag', perDay, maxDay) + chart(hourTitle, perHour, maxHour, 'cols--24') +
        '<div class="split">' +
        '<section class="panel"><h3>Mest lästa sidor</h3>' + (pages.length ? '<div class="tbl"><table><thead><tr><th>Sida</th><th>Visningar</th><th>Snitt tid</th></tr></thead><tbody>' + pages.map(function (p) { return '<tr><td>' + esc(p[0]) + '</td><td>' + p[1] + '</td><td>' + (p[2] == null ? '–' : fmtSecs(p[2])) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="empty">Ingen data.</p>') + '</section>' +
        bars('Varifrån besöken kommer', countBy(sessions, function (s) { return SRC[s.first.source] || s.first.source; }), sessions.length) +
        bars('Hänvisande sajter', countBy(views, function (x) { return x.referrer_host; }, 12), null) +
        bars('Kampanjer (utm)', countBy(views, function (x) { return x.utm_source ? x.utm_source + (x.utm_campaign ? ' · ' + x.utm_campaign : '') : ''; }, 12), null) +
        bars('Vad besökarna gör', countBy(events.filter(function (x) { return x.source !== 'event:leave'; }), function (x) { return EV[x.source.slice(6)] || x.source.slice(6); }), null) +
        bars('Konverteringar per källa', countBy(sessions.filter(function (s) { return s.converted; }), function (s) { return SRC[s.first.source] || s.first.source; }), conv.length) +
        bars('Ingångssidor', entries, sessions.length) + bars('Sista sidan i besöket', exits, sessions.length) +
        bars('Länder', countBy(sessions, function (s) { return s.first.country; }), sessions.length) + bars('Städer', countBy(sessions, function (s) { return s.first.city; }, 12), sessions.length) +
        bars('Enheter', countBy(sessions, function (s) { return DEV[s.first.device_type] || s.first.device_type; }), sessions.length) + bars('Webbläsare', countBy(sessions, function (s) { return s.first.browser; }), sessions.length) +
        bars('Operativsystem', countBy(sessions, function (s) { return s.first.os; }), sessions.length) + bars('Språk', countBy(sessions, function (s) { return s.first.language; }), sessions.length) +
        bars('Skärmstorlek', countBy(sessions, function (s) { return s.first.screen_w ? s.first.screen_w + '×' + s.first.screen_h : ''; }, 10), sessions.length) +
        '</div>' +
        (function () {
          var tests = events.filter(function (x) { return x.source === 'event:sitetest'; });
          return '<section class="panel" id="sitetests"><h3>Testade hemsidor <small>(' + tests.length + ')</small></h3><p class="panel__sub">Varje sajt som någon har testat i Testa din sajt, med resultatet de fick.</p>' +
            (tests.length ? '<div class="tbl"><table><thead><tr><th>När</th><th>Sajt</th><th>Resultat</th><th>Var</th></tr></thead><tbody>' + tests.map(function (t) {
              var u = t.utm_medium || '', href = /^https?:\/\//.test(u) ? u : 'https://' + u;
              return '<tr><td>' + dt(t.created_at) + '</td><td><a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</a></td><td>' + esc(t.utm_campaign || '–') + '</td><td>' + esc([t.city, t.country].filter(Boolean).join(', ') || '–') + '</td></tr>';
            }).join('') + '</tbody></table></div>' : '<p class="empty">Ingen har testat någon sajt under perioden.</p>') + '</section>';
        })() +
        '<section class="panel"><h3>Alla besök</h3><p class="panel__sub">Varje rad är ett besök. Klicka för att se vilka sidor som lästes, hur länge, och vad som hände.</p><div class="visits" id="visits">' +
        sessions.slice(0, 300).map(function (s, idx) {
          var f = s.first;
          return '<details class="visit' + (s.converted ? ' is-conv' : '') + '"><summary><span class="visit__when">' + dt(s.start) + '</span><span class="visit__where">' + esc([f.city, f.country].filter(Boolean).join(', ') || 'Okänd plats') + '</span>' +
            '<span class="visit__how">' + esc((DEV[f.device_type] || f.device_type) + ' · ' + (f.browser || '') + ' · ' + (f.os || '')) + '</span><span class="visit__src">' + esc(SRC[f.source] || f.source || '') + (f.referrer_host ? ' · ' + esc(f.referrer_host) : '') + '</span>' +
            '<span class="visit__n">' + s.views.length + ' sidor · ' + fmtSecs(s.secs) + (s.events.length ? ' · <b>' + s.events.map(function (e) { return EV[e.source.slice(6)] || e.source.slice(6); }).join(', ') + '</b>' : '') + '</span></summary>' +
            '<ol class="visit__pages">' + s.views.map(function (v) { var lv = leaves.find(function (l) { return l.session_id === s.id && l.path === v.path && Date.parse(l.created_at) >= Date.parse(v.created_at); }); return '<li><time>' + new Date(v.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '</time><a href="' + esc(v.path) + '" target="_blank" rel="noopener">' + esc(v.path) + '</a>' + (lv ? '<small>' + fmtSecs(Math.min(1800, Number(lv.utm_medium) || 0)) + ' · läste ' + (Number(lv.utm_campaign) || 0) + ' %</small>' : '') + '</li>'; }).join('') +
            s.events.map(function (e) { return '<li class="visit__ev"><time>' + new Date(e.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '</time><b>' + esc(EV[e.source.slice(6)] || e.source.slice(6)) + '</b>' + (e.utm_medium ? '<small>' + esc(e.utm_medium) + '</small>' : '') + '</li>'; }).join('') + '</ol>' +
            '<p class="visit__meta">' + esc([f.language, f.timezone, f.screen_w ? 'skärm ' + f.screen_w + '×' + f.screen_h : '', (function () { var w = f.viewport_w ? f : leaves.find(function (l) { return l.session_id === s.id && l.viewport_w; }); return w ? 'fönster ' + w.viewport_w + '×' + w.viewport_h : ''; })(), f.utm_source ? 'utm: ' + [f.utm_source, f.utm_medium, f.utm_campaign].filter(Boolean).join(' / ') : ''].filter(Boolean).join(' · ')) + '</p></details>';
        }).join('') + (sessions.length > 300 ? '<p class="muted">Visar de 300 senaste besöken.</p>' : '') + '</div></section>');
      liveVisitors(DEV);
      var tb = $('#vteam'); if (tb) tb.addEventListener('click', function () { st.showTeam = !st.showTeam; renderVisitors(); });
      var hb = $('#vhour'); if (hb) hb.addEventListener('click', function (e) { var b = e.target.closest('[data-h]'); if (b) { st.hourScope = b.dataset.h; renderVisitors(); } });
    });
    });
  }
  // Just nu: the visits with something from the last 5 minutes, refreshed while the Besökare page is open
  function liveVisitors(DEV) {
    clearInterval(st.liveTimer);
    var draw = function () {
      var box = $('#livelist'); if (!box) { clearInterval(st.liveTimer); return; }
      sb.from('site_visits').select('session_id,created_at,path,source,city,country,device_type,browser,is_bot').gte('created_at', new Date(Date.now() - 5 * 6e4).toISOString()).order('created_at', { ascending: true }).limit(1000).then(function (r) {
        if (!$('#livelist')) return;
        var V = {};
        (r.data || []).filter(function (x) { return !x.is_bot && x.source !== 'event:consent'; }).forEach(function (x) {
          var v = V[x.session_id] = V[x.session_id] || { first: x, pages: 0, path: '', last: x.created_at, left: false };
          if (!/^event:/.test(x.source || '')) { v.pages++; v.path = x.path; v.left = false; }
          else if (x.source === 'event:leave') v.left = true;
          v.last = x.created_at;
        });
        var list = Object.keys(V).map(function (k) { return V[k]; }).filter(function (v) { return v.pages; }).sort(function (a, b) { return Date.parse(b.last) - Date.parse(a.last); });
        var here = list.filter(function (v) { return !v.left; }).length;
        $('#livecount').textContent = '(' + here + ' inne nu' + (list.length > here ? ', ' + (list.length - here) + ' nyss' : '') + ')';
        var ago = function (t) { var s = Math.max(0, Math.round((Date.now() - Date.parse(t)) / 1000)); return s < 60 ? s + ' s sedan' : Math.floor(s / 60) + ' min sedan'; };
        $('#livelist').innerHTML = list.length ? '<div class="tbl"><table><thead><tr><th></th><th>Sida</th><th>Var</th><th>Enhet</th><th>Sidor</th><th>Senast</th></tr></thead><tbody>' + list.map(function (v) {
          var f = v.first;
          return '<tr><td><span class="live__dot' + (v.left ? ' is-off' : '') + '" title="' + (v.left ? 'Har lämnat eller bytt flik' : 'Inne nu') + '"></span></td><td>' + esc(v.path) + '</td><td>' + esc([f.city, f.country].filter(Boolean).join(', ') || 'Okänd plats') + '</td><td>' + esc((DEV[f.device_type] || f.device_type || '') + (f.browser ? ' · ' + f.browser : '')) + '</td><td>' + v.pages + '</td><td>' + ago(v.last) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="empty">Ingen är inne på sajten just nu.</p>';
      });
    };
    draw(); st.liveTimer = setInterval(draw, 20000);
  }

  /* ---------- Google: Search Console and the Business Profile reviews (worker/gapi.js) ---------- */
  function gapi(path, opts) {
    return sb.auth.getSession().then(function (s) {
      opts = opts || {}; opts.headers = Object.assign({ Authorization: 'Bearer ' + (s.data.session ? s.data.session.access_token : ''), 'Content-Type': 'application/json' }, opts.headers || {});
      return fetch(path, opts);
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); });
  }
  function googleHelp(r, what) {
    var e = r.d || {};
    // Google's Business Profile API starts with a quota of 0 until Google has approved the project: not a key problem
    if (/quota exceeded|quota metric|rate.?limit/i.test(e.message || '') && /mybusiness/i.test(e.message || '')) return info('Google har inte öppnat företagsprofilen för sajten än',
      'Nyckeln fungerar, men Googles API för företagsprofiler (recensioner) börjar med en kvot på 0 tills Google har godkänt projektet. Det är gratis men måste sökas: ' +
      '<a href="https://support.google.com/business/contact/api_default" target="_blank" rel="noopener">fyll i Googles formulär för API-åtkomst</a> med elevate.studio018@gmail.com och projektnumret ' + esc(((e.message || '').match(/project_number:(\d+)/) || [])[1] || '') + '. ' +
      'Välj Application for Basic API Access och beskriv att ni vill läsa och svara på era egna recensioner. Svaret brukar komma inom några dagar; sedan fungerar recensionerna här utan att ni gör något mer.');
    if (e.error === 'scope' || e.error === 'google') return info('Koppla Google igen', 'Google-kopplingen saknar behörighet för ' + what + '. Öppna <a href="/api/google/connect" target="_blank" rel="noopener">elevatestudio.nu/api/google/connect</a>, logga in som elevate.studio018@gmail.com, godkänn och lägg in den nya nyckeln som GOOGLE_REFRESH_TOKEN i Cloudflare.' + (e.message ? '<br><small>' + esc(e.message) + '</small>' : ''));
    if (e.error === 'nosite') return info('Sajten finns inte i Search Console', 'Lägg till elevatestudio.nu i Google Search Console med samma Google-konto som är kopplat.');
    if (e.error === 'nolocation') return info('Ingen företagsprofil hittades', 'Google-kontot som är kopplat måste vara ägare eller förvaltare av Elevate Studios företagsprofil.');
    return info('Kunde inte hämta', esc(e.message || ('Fel ' + r.status)));
  }

  /* Placering på Google: the search terms the team follows, with position over time (Search Console, worker/gapi.js gscRank).
     The list is kept on this device; with nothing saved, "webbyrå uppsala" and the most shown search terms are followed. */
  function rankTerms(queries) {
    var saved = null; try { saved = JSON.parse(localStorage.getItem('es.gsc.track') || 'null'); } catch (e) { /* storage blocked */ }
    if (Array.isArray(saved) && saved.length) return saved;
    var list = ['webbyrå uppsala'];
    queries.slice().sort(function (a, b) { return b.impressions - a.impressions; }).forEach(function (q) { if (list.length < 5 && list.indexOf(q.keys[0]) < 0) list.push(q.keys[0]); });
    return list;
  }
  function rankSave(list) { try { localStorage.setItem('es.gsc.track', JSON.stringify(list)); } catch (e) { /* storage blocked */ } }
  function rankChart(rows, start, end) {
    // one point per day the site was shown; lower is better, so position 1 is at the top. A gap of more than a week breaks the line.
    var W = 640, H = 150, P = { l: 34, r: 10, t: 10, b: 22 }, t0 = Date.parse(start), t1 = Date.parse(end), span = Math.max(1, t1 - t0);
    var worst = Math.max(10, Math.ceil(Math.max.apply(null, rows.map(function (r) { return r.position; }).concat([1])) / 10) * 10);
    var x = function (d) { return P.l + (Date.parse(d) - t0) / span * (W - P.l - P.r); }, y = function (p) { return P.t + (p - 1) / (worst - 1) * (H - P.t - P.b); };
    var path = '', prev = null;
    rows.forEach(function (r) { var t = Date.parse(r.date); path += (prev != null && t - prev <= 864e5 * 7 ? 'L' : 'M') + x(r.date).toFixed(1) + ' ' + y(r.position).toFixed(1); prev = t; });
    var ticks = [1, Math.round(worst / 2), worst];
    return '<svg class="rank__svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Placering per dag">' +
      '<rect x="' + P.l + '" y="' + y(1) + '" width="' + (W - P.l - P.r) + '" height="' + (y(Math.min(3, worst)) - y(1)) + '" class="rank__top3"/>' +
      ticks.map(function (k) { return '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(k) + '" y2="' + y(k) + '" class="rank__grid"/><text x="' + (P.l - 6) + '" y="' + (y(k) + 4) + '" class="rank__lbl" text-anchor="end">' + k + '</text>'; }).join('') +
      '<text x="' + P.l + '" y="' + (H - 4) + '" class="rank__lbl">' + start.slice(5) + '</text><text x="' + (W - P.r) + '" y="' + (H - 4) + '" class="rank__lbl" text-anchor="end">' + end.slice(5) + '</text>' +
      (path ? '<path d="' + path + '" class="rank__line"/>' : '') +
      rows.map(function (r) { return '<circle cx="' + x(r.date).toFixed(1) + '" cy="' + y(r.position).toFixed(1) + '" r="2.6" class="rank__dot"><title>' + r.date + ': placering ' + r.position.toFixed(1).replace('.', ',') + ', ' + r.impressions + ' visningar, ' + r.clicks + ' klick</title></circle>'; }).join('') + '</svg>';
  }
  function renderRank(queries) {
    var box = $('#rank'); if (!box) return;
    var days = st.rankDays || 90, list = rankTerms(queries);
    var pos = function (p) { return p == null ? '–' : p.toFixed(1).replace('.', ','); };
    var level = function (p) { return p == null ? '' : p <= 3 ? 'rank__pos--good' : p <= 10 ? 'rank__pos--ok' : 'rank__pos--bad'; };
    box.innerHTML = '<div class="rank__head"><div><h3>Placering på Google</h3><p class="panel__sub">Var ni hamnar när någon söker på orden ni följer – Googles egen siffra, dag för dag. Plats 1 är högst upp; 1–10 är första sidan.</p></div>' +
      '<span class="seg" id="rdays">' + [28, 90, 180, 365].map(function (d) { return '<button class="seg__b' + (d === days ? ' is-on' : '') + '" data-d="' + d + '">' + (d === 365 ? '1 år' : d + ' dagar') + '</button>'; }).join('') + '</span></div>' +
      '<form class="rank__add" id="radd"><input name="q" maxlength="80" placeholder="Följ ett sökord, till exempel hemsida hantverkare uppsala" aria-label="Sökord att följa"><button class="btn btn--sm">Följ</button></form>' +
      '<div class="rank__list" id="rlist"><p class="empty">Hämtar placeringar …</p></div>';
    $('#rdays').addEventListener('click', function (e) { var b = e.target.closest('[data-d]'); if (b) { st.rankDays = Number(b.dataset.d); renderRank(queries); } });
    $('#radd').addEventListener('submit', function (e) {
      e.preventDefault(); var q = this.q.value.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!q) return; if (list.indexOf(q) < 0) { if (list.length >= 10) { toast('Ni kan följa högst 10 sökord. Ta bort ett först.'); return; } list.push(q); rankSave(list); } renderRank(queries);
    });
    gapi('/api/gsc/rank?days=' + days + '&q=' + encodeURIComponent(list.join('|'))).then(function (r) {
      var el = $('#rlist'); if (!el) return;
      if (!r.ok) { el.innerHTML = googleHelp(r, 'Search Console'); return; }
      el.innerHTML = r.d.terms.map(function (t) {
        var w = t.week.position, b = t.prev.position, move = w == null || b == null ? '' : Math.abs(w - b) < 0.5 ? '<span class="rank__move">oförändrad</span>' :
          '<span class="rank__move ' + (w < b ? 'is-up' : 'is-down') + '">' + (w < b ? '▲ upp ' : '▼ ner ') + pos(Math.abs(b - w)) + '</span>';
        var top = t.pages[0];
        return '<article class="rank__card"><header><b>' + esc(t.q) + '</b><button class="rank__x" data-rm="' + esc(t.q) + '" aria-label="Sluta följa ' + esc(t.q) + '">×</button></header>' +
          (t.days.length ? '<div class="rank__nums"><div><span class="rank__pos ' + level(w != null ? w : t.position) + '">' + pos(w != null ? w : t.position) + '</span><small>' + (w != null ? 'placering senaste veckan' : 'snittplacering för perioden') + '</small>' + move + '</div>' +
            '<div><span class="rank__n">' + t.clicks + '</span><small>klick</small></div><div><span class="rank__n">' + t.impressions + '</span><small>visningar</small></div></div>' +
            rankChart(t.days, r.d.start, r.d.end) +
            (top ? '<p class="rank__page">Sidan Google visar: <a href="' + esc(top.page) + '" target="_blank" rel="noopener">' + esc(top.page.replace(/^https:\/\/elevatestudio\.nu/, '') || '/') + '</a>' + (t.pages.length > 1 ? ' <small>(och ' + (t.pages.length - 1) + ' till – flera av era sidor visas på samma sökord, så Google vacklar om vilken som ska ranka)</small>' : '') + '</p>' : '')
            : '<p class="empty">Ni har inte visats i Google på det här sökordet under perioden – antingen hamnar ni längre ner än någon tittar, eller så söker ingen på exakt de orden. Google räknar bara exakta sökord.</p>') + '</article>';
      }).join('');
      el.querySelectorAll('[data-rm]').forEach(function (x) { x.addEventListener('click', function () { var i = list.indexOf(x.dataset.rm); if (i >= 0) { list.splice(i, 1); rankSave(list.length ? list : []); if (!list.length) try { localStorage.removeItem('es.gsc.track'); } catch (e) { /* storage blocked */ } renderRank(queries); } }); });
    });
  }

  /* Alla sökord: every search term Google showed the site for (up to 250), with position and the change since the
     period before; sortable, searchable, and any term can be followed in Placering på Google */
  function renderAllQueries(days, queries) {
    var box = $('#allq'); if (!box) return;
    box.innerHTML = '<h3>Alla sökord <small id="aqn"></small></h3><p class="panel__sub">Allt folk har sökt på när ni visades i Google de senaste ' + days + ' dagarna, jämfört med ' + days + ' dagar innan. Placering är Googles snitt – plats 1 är högst upp.</p>' +
      '<div class="allq__bar"><input id="aqs" type="search" placeholder="Sök bland sökorden, till exempel uppsala" aria-label="Sök bland sökorden"></div><div id="aqt"><p class="empty">Hämtar sökord …</p></div>';
    gapi('/api/gsc/all?days=' + days).then(function (r) {
      var out = $('#aqt'); if (!out) return;
      if (!r.ok) { out.innerHTML = googleHelp(r, 'Search Console'); return; }
      var rows = r.d.rows, sort = st.aqSort || 'impressions', dir = st.aqDir || -1, filter = '', limit = 50;
      var pos = function (p) { return p == null ? '–' : p.toFixed(1).replace('.', ','); };
      var lvl = function (p) { return p <= 3 ? 'rank__pos--good' : p <= 10 ? 'rank__pos--ok' : 'rank__pos--bad'; };
      var change = function (x) { return x.before ? x.before.position - x.position : null; }; // positive = climbed
      var key = { q: function (x) { return x.q; }, clicks: function (x) { return x.clicks; }, impressions: function (x) { return x.impressions; }, ctr: function (x) { return x.ctr; }, position: function (x) { return x.position; }, change: function (x) { var c = change(x); return c == null ? -1e9 : c; } };
      var draw = function () {
        var list = rows.filter(function (x) { return !filter || x.q.indexOf(filter) >= 0; }).sort(function (a, b) { var A = key[sort](a), B = key[sort](b); return (A > B ? 1 : A < B ? -1 : 0) * dir; });
        var tracked = rankTerms(queries);
        $('#aqn').textContent = '(' + (filter ? list.length + ' av ' : '') + rows.length + ')';
        var th = function (k, label) { return '<th><button class="allq__sort' + (sort === k ? ' is-on' : '') + '" data-s="' + k + '">' + label + (sort === k ? (dir < 0 ? ' ↓' : ' ↑') : '') + '</button></th>'; };
        out.innerHTML = list.length ? '<div class="tbl"><table class="allq__tbl"><thead><tr>' + th('q', 'Sökord') + th('impressions', 'Visningar') + th('clicks', 'Klick') + th('ctr', 'Klickfrekvens') + th('position', 'Placering') + th('change', 'Förändring') + '<th></th></tr></thead><tbody>' +
          list.slice(0, limit).map(function (x) {
            var c = change(x), ch = c == null ? '<span class="allq__new">ny</span>' : Math.abs(c) < 0.5 ? '<span class="rank__move">±0</span>' : '<span class="rank__move ' + (c > 0 ? 'is-up' : 'is-down') + '">' + (c > 0 ? '▲ ' : '▼ ') + pos(Math.abs(c)) + '</span>';
            var on = tracked.indexOf(x.q) >= 0;
            return '<tr><td>' + esc(x.q) + '</td><td>' + x.impressions + '</td><td>' + x.clicks + '</td><td>' + (x.ctr * 100).toFixed(1).replace('.', ',') + ' %</td><td><b class="allq__pos ' + lvl(x.position) + '">' + pos(x.position) + '</b></td><td>' + ch + (x.before ? '<small> från ' + pos(x.before.position) + '</small>' : '') + '</td>' +
              '<td>' + (on ? '<span class="muted">Följs</span>' : '<button class="linkbtn" data-follow="' + esc(x.q) + '">Följ</button>') + '</td></tr>';
          }).join('') + '</tbody></table></div>' + (list.length > limit ? '<p><button class="btn btn--ghost btn--sm" id="aqmore">Visa alla ' + list.length + '</button></p>' : '')
          : '<p class="empty">' + (rows.length ? 'Inga sökord matchar.' : 'Google har inte visat sajten på några sökord under perioden än.') + '</p>';
      };
      draw();
      out.addEventListener('click', function (e) {
        var s2 = e.target.closest('[data-s]'), f = e.target.closest('[data-follow]'), m = e.target.closest('#aqmore');
        if (s2) { var k = s2.dataset.s; if (sort === k) dir = -dir; else { sort = k; dir = k === 'position' || k === 'q' ? 1 : -1; } st.aqSort = sort; st.aqDir = dir; draw(); }
        if (m) { limit = 1e9; draw(); }
        if (f) { var list = rankTerms(queries); if (list.length >= 10) { toast('Ni kan följa högst 10 sökord. Ta bort ett i Placering på Google först.'); return; } list.push(f.dataset.follow); rankSave(list); renderRank(queries); draw(); toast('Följer nu ”' + f.dataset.follow + '”'); }
      });
      $('#aqs').addEventListener('input', function () { filter = this.value.trim().toLowerCase(); draw(); });
    });
  }

  /* Bing: clicks, impressions and search terms from Bing Webmaster Tools (worker/bing.js, needs BING_API_KEY) */
  function renderBing(days) {
    var box = $('#bing'); if (!box) return;
    box.innerHTML = '<h3>Bing</h3><p class="panel__sub">Samma sak från Bing, som också ChatGPT-sök och Copilot bygger på. Siffrorna släpar ungefär ett dygn.</p><div id="bingb"><p class="empty">Hämtar från Bing …</p></div>';
    gapi('/api/bing?days=' + days).then(function (r) {
      var out = $('#bingb'); if (!out) return;
      if (!r.ok) {
        var e = r.d || {};
        out.innerHTML = e.error === 'nokey' ? info('Lägg in Bing-nyckeln i Cloudflare', 'Sajten är verifierad i Bing Webmaster Tools. För att siffrorna ska synas här: öppna <b>bing.com/webmasters</b> → <b>Settings</b> (kugghjulet uppe till höger) → <b>API Access</b> → <b>API Key</b> och kopiera nyckeln. Lägg in den i Cloudflare (Workers → elevate-studio-pre → Settings → Variables and Secrets) som hemligheten <b>BING_API_KEY</b>.')
          : e.error === 'badkey' ? info('Bing godtog inte nyckeln', 'Kontrollera att BING_API_KEY i Cloudflare är samma nyckel som under Settings → API Access i Bing Webmaster Tools.')
          : info('Kunde inte hämta från Bing', esc(e.message || ('Fel ' + r.status)));
        return;
      }
      var d = r.d, pos = function (p) { return p == null ? '–' : p.toFixed(1).replace('.', ','); };
      if (!d.daily.length && !d.rows.length) { out.innerHTML = '<p class="empty">Bing har inga siffror för perioden än. Sajten lades in i Bing den 27 november, och det tar upp till två dygn innan de första siffrorna syns.</p>'; return; }
      var max = Math.max.apply(null, d.daily.map(function (x) { return x.impressions; }).concat([1]));
      out.innerHTML = kpis([['Klick från Bing', d.total.clicks], ['Visningar i Bing', d.total.impressions]]) +
        (d.daily.length ? '<div class="cols">' + d.daily.map(function (x) { return '<div tabindex="0"><i data-tip="' + x.date + ': ' + x.impressions + ' visningar, ' + x.clicks + ' klick" style="--h:' + Math.round(x.impressions / max * 100) + '%"></i><span>' + x.date.slice(5) + '</span></div>'; }).join('') + '</div>' : '') +
        (d.rows.length ? '<div class="tbl"><table><thead><tr><th>Sökord i Bing</th><th>Visningar</th><th>Klick</th><th>Placering</th></tr></thead><tbody>' + d.rows.slice(0, 100).map(function (x) {
          return '<tr><td>' + esc(x.q) + '</td><td>' + x.impressions + '</td><td>' + x.clicks + '</td><td><b class="allq__pos ' + (x.position == null ? '' : x.position <= 3 ? 'rank__pos--good' : x.position <= 10 ? 'rank__pos--ok' : 'rank__pos--bad') + '">' + pos(x.position) + '</b></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="empty">Inga sökord från Bing under perioden än.</p>');
    });
  }

  /* ---------- Läget: what is set up and what is missing, checked live by the server (worker/health.js) ---------- */
  function renderHealth() {
    main().innerHTML = head('Läget', 'Det som är klart och det som saknas – kontrolleras live varje gång sidan öppnas.', '<button class="btn btn--ghost btn--sm" id="hrefresh">Kontrollera igen</button>') + '<p class="empty">Kontrollerar …</p>';
    $('#hrefresh').addEventListener('click', renderHealth);
    gapi('/api/health').then(function (r) {
      var box = main(); var e = box.querySelector('.empty'); if (e) e.remove();
      if (!r.ok) { box.insertAdjacentHTML('beforeend', info('Kunde inte kontrollera', esc((r.d && (r.d.message || r.d.error)) || ('Fel ' + r.status)))); return; }
      var list = r.d.checks, ORDER = { missing: 0, warn: 1, info: 2, ok: 3 };
      var todo = list.filter(function (c) { return c.status === 'missing'; }).length, wait = list.filter(function (c) { return c.status === 'warn'; }).length;
      var LABEL = { ok: 'Klart', warn: 'Behöver kollas', missing: 'Saknas', info: 'Valfritt' };
      var groups = []; list.forEach(function (c) { if (groups.indexOf(c.group) < 0) groups.push(c.group); });
      box.insertAdjacentHTML('beforeend',
        '<div class="hl-sum ' + (todo ? 'is-bad' : wait ? 'is-warn' : 'is-good') + '"><b>' + (todo ? todo + ' sak' + (todo === 1 ? '' : 'er') + ' saknas' : wait ? 'Nästan klart' : 'Allt är klart') + '</b>' +
          '<span>' + list.filter(function (c) { return c.status === 'ok'; }).length + ' klara · ' + wait + ' att kolla · ' + todo + ' saknas</span></div>' +
        groups.map(function (g) {
          return '<section class="panel"><h3>' + esc(g) + '</h3><ul class="hl">' + list.filter(function (c) { return c.group === g; }).sort(function (a, b) { return ORDER[a.status] - ORDER[b.status]; }).map(function (c) {
            return '<li class="hl__row hl--' + c.status + '"><span class="hl__dot" aria-hidden="true"></span><div><p class="hl__t"><b>' + esc(c.title) + '</b><span class="hl__chip">' + LABEL[c.status] + '</span></p><p class="hl__x">' + esc(c.text) + '</p>' +
              (c.fix ? '<p class="hl__fix"><b>Gör så här:</b> ' + esc(c.fix) + '</p>' : '') + '</div></li>';
          }).join('') + '</ul></section>';
        }).join('') + '<p class="muted">Kontrollerat ' + dt(r.d.checked) + '. Hemligheter visas aldrig här – sidan ser bara om de finns och fungerar.</p>');
    });
  }

  function renderSearch() {
    var days = st.gscDays || 28;
    main().innerHTML = head('Sökord på Google', 'Vad folk söker på när elevatestudio.nu visas i Google, och hur ofta de klickar.',
      '<span class="seg" id="gdays">' + [7, 28, 90].map(function (d) { return '<button class="seg__b' + (d === days ? ' is-on' : '') + '" data-d="' + d + '">' + d + ' dagar</button>'; }).join('') + '</span>' +
      '<button class="btn btn--ghost btn--sm" id="gindex" title="Säger till Bing (och därmed ChatGPT-sök och Copilot) att läsa alla sidor nu. Ändrade sidor skickas också av sig själv varje morgon.">Skicka alla sidor till Bing</button>') + '<p class="empty">Hämtar från Search Console …</p>';
    $('#gindex').addEventListener('click', function () {
      var b = this; b.disabled = true; b.textContent = 'Skickar …';
      sb.auth.getSession().then(function (r) { return fetch('/api/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (r.data.session ? r.data.session.access_token : '') }, body: '{}' }); })
        .then(function (r) { return r.json().catch(function () { return {}; }); }).then(function (d) {
          b.disabled = false; b.textContent = 'Skicka alla sidor till Bing';
          toast(d.ok ? d.count + ' sidor är skickade till Bing via IndexNow' + (d.status === 202 ? ' – Bing kontrollerar nyckeln första gången' : '') : 'Det gick inte: ' + (d.message || d.error || ('svar ' + d.status)));
        }, function () { b.disabled = false; b.textContent = 'Skicka alla sidor till Bing'; toast('Servern svarade inte'); });
    });
    $('#gdays').addEventListener('click', function (e) { var b = e.target.closest('[data-d]'); if (b) { st.gscDays = Number(b.dataset.d); renderSearch(); } });
    gapi('/api/gsc?days=' + days).then(function (r) {
      var box = main(); box.querySelector('.empty') && box.querySelector('.empty').remove();
      if (!r.ok) { box.insertAdjacentHTML('beforeend', googleHelp(r, 'Search Console')); return; }
      var d = r.d, t = d.total || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
      var pct = function (x) { return (x * 100).toFixed(1).replace('.', ',') + ' %'; }, pos = function (x) { return x ? x.toFixed(1).replace('.', ',') : '–'; };
      var max = Math.max.apply(null, d.days.map(function (x) { return x.impressions; }).concat([1]));
      var table = function (title, rows, label) {
        return '<section class="panel"><h3>' + title + '</h3>' + (rows.length ? '<div class="tbl"><table><thead><tr><th>' + label + '</th><th>Klick</th><th>Visningar</th><th>CTR</th><th>Position</th></tr></thead><tbody>' +
          rows.map(function (x) { var k = x.keys[0]; return '<tr><td>' + (label === 'Sida' ? '<a href="' + esc(k) + '" target="_blank" rel="noopener">' + esc(k.replace(/^https:\/\/elevatestudio\.nu/, '') || '/') + '</a>' : esc(k)) + '</td><td>' + x.clicks + '</td><td>' + x.impressions + '</td><td>' + pct(x.ctr) + '</td><td>' + pos(x.position) + '</td></tr>'; }).join('') +
          '</tbody></table></div>' : '<p class="empty">Ingen data än. Google behöver några dagar efter att sajten lagts till.</p>') + '</section>';
      };
      box.insertAdjacentHTML('beforeend', kpis([['Klick', t.clicks], ['Visningar', t.impressions], ['Klickfrekvens', pct(t.ctr || 0)], ['Snittposition', pos(t.position)]]) +
        '<section class="panel rank" id="rank"></section>' +
        '<section class="panel"><h3>Visningar per dag <small>' + d.start + ' – ' + d.end + '</small></h3><div class="cols">' + d.days.map(function (x) { return '<div tabindex="0"><i data-tip="' + x.keys[0] + ': ' + x.impressions + ' visningar, ' + x.clicks + ' klick" style="--h:' + Math.round(x.impressions / max * 100) + '%"></i><span>' + x.keys[0].slice(5) + '</span></div>'; }).join('') + '</div></section>' +
        '<section class="panel allq" id="allq"></section>' +
        '<section class="panel" id="bing"></section>' +
        (function () {
          // which search led to which page: Google gives this per search term, never per person
          var rows = (d.pairs || []).filter(function (x) { return x.clicks > 0; }).sort(function (a, b) { return b.clicks - a.clicks; }).slice(0, 40);
          return '<section class="panel"><h3>Sökord som gav besök – och sidan de kom till</h3><p class="panel__sub">Vad folk sökte på i Google när de klickade sig in, och vilken sida de landade på. Google visar det per sökord, inte per person.</p>' +
            (rows.length ? '<div class="tbl"><table><thead><tr><th>Sökord</th><th>Sida</th><th>Klick</th><th>Visningar</th><th>Position</th></tr></thead><tbody>' + rows.map(function (x) {
              return '<tr><td>' + esc(x.keys[0]) + '</td><td><a href="' + esc(x.keys[1]) + '" target="_blank" rel="noopener">' + esc(x.keys[1].replace(/^https:\/\/elevatestudio\.nu/, '') || '/') + '</a></td><td>' + x.clicks + '</td><td>' + x.impressions + '</td><td>' + pos(x.position) + '</td></tr>'; }).join('') + '</tbody></table></div>'
              : '<p class="empty">Inga klick från Google med sökord under perioden. Google döljer också sällsynta sökord för att skydda den som sökte.</p>') + '</section>';
        })() +
        table('Sidor', d.pages, 'Sida') + '<p class="muted">Källa: Google Search Console (' + esc(d.site) + '). Siffrorna släpar två dagar.</p>');
      renderRank(d.queries || []);
      renderAllQueries(days, d.queries || []);
      renderBing(days);
    });
  }

  function renderReviews() {
    main().innerHTML = head('Recensioner', 'Recensionerna på Elevate Studios Google-profil. Svara direkt härifrån.') + '<p class="empty">Hämtar recensioner …</p>';
    gapi('/api/reviews').then(function (r) {
      var box = main(); box.querySelector('.empty') && box.querySelector('.empty').remove();
      if (!r.ok) { box.insertAdjacentHTML('beforeend', googleHelp(r, 'företagsprofilen')); return; }
      var d = r.d, stars = function (n) { return '★★★★★'.slice(0, n || 0) + '<span style="opacity:.25">' + '★★★★★'.slice(n || 0) + '</span>'; };
      box.insertAdjacentHTML('beforeend', kpis([['Snittbetyg', d.average ? String(d.average).replace('.', ',') : '–'], ['Antal recensioner', d.count], ['Utan svar', d.reviews.filter(function (x) { return !x.reply; }).length]]) +
        '<div class="cards" id="rv">' + (d.reviews.map(function (x) {
          return '<article class="cardx"><h3>' + esc(x.name || 'Anonym') + ' <span style="color:#c99a1a">' + stars(x.stars) + '</span></h3><p>' + esc(x.text || '(Bara betyg, ingen text)') + '</p>' +
            '<p class="muted">' + day(x.at) + '</p>' +
            '<label class="fld"><span>' + (x.reply ? 'Ert svar' : 'Svara') + '</span><textarea rows="3" data-reply="' + esc(x.id) + '" placeholder="Tack för fina ord …">' + esc(x.reply || '') + '</textarea></label>' +
            '<footer><button class="btn btn--sm" data-send="' + esc(x.id) + '">' + (x.reply ? 'Uppdatera svaret' : 'Publicera svaret') + '</button></footer></article>';
        }).join('') || '<p class="empty">Inga recensioner än.</p>') + '</div>');
      $('#rv') && $('#rv').addEventListener('click', function (e) {
        var b = e.target.closest('[data-send]'); if (!b) return;
        var text = box.querySelector('[data-reply="' + b.dataset.send + '"]').value;
        b.disabled = true;
        gapi('/api/reviews', { method: 'POST', body: JSON.stringify({ id: b.dataset.send, reply: text }) }).then(function (res) {
          b.disabled = false; toast(res.ok ? (text.trim() ? 'Svaret är publicerat på Google' : 'Svaret är borttaget') : 'Kunde inte spara: ' + ((res.d && res.d.message) || res.status));
        });
      });
    });
  }

  /* ---------- Chatten: every question and answer, grouped into conversations, with device and where visitors came from ---------- */
  var CHAT_SRC = { ai: 'AI-svar', faq: 'Färdigt svar', knapp: 'Snabbknapp', obesvarad: 'Kunde inte svara', kontakt: 'Kontakt' };
  var DEV = { desktop: 'Dator', mobile: 'Mobil', tablet: 'Surfplatta', unknown: 'Okänd' };
  var VSRC = { google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo', social: 'Sociala medier', ai: 'AI-tjänster (ChatGPT m.fl.)', referral: 'Länk från annan sajt', direct: 'Direkt / okänt' };
  function renderChat() {
    main().innerHTML = head('Chatten', 'Allt besökarna har frågat chatten och vad den svarade – senaste 90 dagarna.', '<button class="btn btn--ghost btn--sm" id="chatwipe">Töm chatthistoriken</button>');
    $('#chatwipe').addEventListener('click', function () {
      if (!window.confirm('Ta bort ALLA sparade chattfrågor och svar? Det går inte att ångra.')) return;
      var b = this; b.disabled = true;
      // every row: a filter that matches all of them (the database refuses a delete without one)
      sb.from('chatbot_queries').delete().gte('created_at', '1900-01-01').then(function (r) {
        b.disabled = false;
        if (r.error) { toast('Kunde inte tömma: ' + r.error.message); return; }
        toast('Chatthistoriken är tömd'); renderChat();
      });
    });
    fetchRows(sb.from('chatbot_queries').select('*').gte('created_at', since(90)).order('created_at', { ascending: false }).limit(5000), function (all) {
      var q = all.filter(function (x) { return !x.is_bot; }).sort(function (a, b) { return Date.parse(b.created_at) - Date.parse(a.created_at); });
      var rich = q.some(function (x) { return x.session_id; });
      // conversations: rows with the same id; older rows (before the id existed) count as one question each
      var conv = {}, order = [];
      q.slice().reverse().forEach(function (x, i) {
        var k = x.session_id || ('rad' + i);
        if (!conv[k]) { conv[k] = { id: k, rows: [] }; order.push(k); }
        conv[k].rows.push(x);
      });
      var C = order.map(function (k) { var c = conv[k], r = c.rows, f = r[0], l = r[r.length - 1];
        c.first = f.created_at; c.last = l.created_at; c.secs = Math.max(0, Math.round((Date.parse(l.created_at) - Date.parse(f.created_at)) / 1000));
        c.lead = r.some(function (x) { return x.lead; }); c.dev = f.device_type; c.os = f.os; c.browser = f.browser; c.city = f.city; c.country = f.country;
        c.src = f.visit_source; c.ref = f.referrer_host; c.pages = r.map(function (x) { return x.page_path; }).filter(function (p, i, a) { return p && a.indexOf(p) === i; });
        return c; }).reverse();
      var miss = q.filter(function (x) { return !x.matched; });
      var leads = C.filter(function (c) { return c.lead; }).length;
      var avg = C.length ? (q.length / C.length).toFixed(1).replace('.', ',') : '–';
      var dur = function (s) { return s < 60 ? s + ' s' : Math.round(s / 60) + ' min'; };
      var len = function (c) { var n = c.rows.length; return n === 1 ? '1 fråga' : n <= 3 ? '2–3 frågor' : n <= 6 ? '4–6 frågor' : '7+ frågor'; };
      var ms = q.filter(function (x) { return x.source === 'ai' && x.answer_ms; }).map(function (x) { return x.answer_ms; }).sort(function (a, b) { return a - b; });
      var place = function (c) { return [c.city, c.country].filter(Boolean).join(', '); };
      var html = kpis([['Frågor', q.length], ['Samtal', C.length], ['Frågor per samtal', avg], ['Lämnade kontaktuppgift', leads],
        ['Besvarade', q.length ? Math.round((q.length - miss.length) / q.length * 100) + ' %' : '–'], ['Svarstid AI (median)', ms.length ? (ms[Math.floor(ms.length / 2)] / 1000).toFixed(1).replace('.', ',') + ' s' : '–'],
        ['Senaste 7 dagar', q.filter(function (x) { return Date.parse(x.created_at) > Date.now() - 7 * 864e5; }).length]]);
      if (!rich) html += info('Mer statistik', 'Enhet, varifrån besökaren kom, svaren och hela samtal sparas när du har kört <b>supabase/sql/2026-11-21_chat_details.sql</b> i Supabase (SQL Editor). Frågorna nedan sparas redan.');
      html += '<div class="split">' + bars('Enhet', countBy(C, function (c) { return c.dev ? DEV[c.dev] || c.dev : null; }), C.length) + bars('Varifrån besökarna kom', countBy(C, function (c) { return c.src ? VSRC[c.src] || c.src : null; }), C.length) + '</div>' +
        '<div class="split">' + bars('Sajter de kom från', countBy(C, function (c) { return c.ref; })) + bars('Ort', countBy(C, place)) + '</div>' +
        '<div class="split">' + bars('Webbläsare', countBy(C, function (c) { return c.browser; }), C.length) + bars('Operativsystem', countBy(C, function (c) { return c.os; }), C.length) + '</div>' +
        '<div class="split">' + bars('Samtalens längd', countBy(C, len), C.length) + bars('Hur chatten svarade', countBy(q, function (x) { return x.source ? CHAT_SRC[x.source] || x.source : (x.matched ? 'Besvarad' : 'Kunde inte svara'); }), q.length) + '</div>' +
        '<div class="split">' + bars('Sidor där chatten används', countBy(q, function (x) { return x.page_path; })) + bars('Ämnen', countBy(q, function (x) { return x.topic || 'Övrigt'; }), q.length) + '</div>';
      // every conversation, newest first, with the exact words
      html += '<section class="panel"><h3>Alla samtal</h3><p class="panel__sub">Klicka på ett samtal för att se exakt vad besökaren skrev och vad chatten svarade.</p>' +
        '<label class="fld" style="max-width:360px"><span>Sök i samtalen</span><input class="input" id="chat-find" type="search" placeholder="Ord, sida eller ort …"></label><div class="chatlog" id="chat-list">' +
        (C.length ? C.map(function (c) {
          var meta = [dt(c.first), DEV[c.dev] || '', [c.os, c.browser].filter(Boolean).join(' · '), place(c), c.src ? (VSRC[c.src] || c.src) + (c.ref ? ' (' + c.ref + ')' : '') : '', c.rows.length + (c.rows.length === 1 ? ' fråga' : ' frågor'), c.rows.length > 1 ? dur(c.secs) : ''].filter(Boolean);
          var words = c.rows.map(function (x) { return x.question + ' ' + (x.answer || ''); }).join(' ') + ' ' + c.pages.join(' ') + ' ' + place(c);
          return '<details class="chatconv" data-find="' + esc(words.toLowerCase()) + '"><summary><b>' + esc(c.rows[0].question.slice(0, 90)) + '</b>' + (c.lead ? ' <span class="pill pill--on">Lämnade kontaktuppgift</span>' : '') +
            '<span class="muted">' + meta.map(esc).join(' · ') + '</span></summary><div class="chatconv__body">' +
            c.rows.map(function (x) {
              return '<p class="chatconv__q"><small>' + dt(x.created_at, { timeStyle: 'short' }) + (x.page_path ? ' · ' + esc(x.page_path) : '') + '</small>' + esc(x.question) + '</p>' +
                (x.answer ? '<p class="chatconv__a"><small>' + esc(CHAT_SRC[x.source] || 'Svar') + (x.answer_ms ? ' · ' + (x.answer_ms / 1000).toFixed(1).replace('.', ',') + ' s' : '') + '</small>' + esc(x.answer) + '</p>'
                  : '<p class="chatconv__a chatconv__a--none">' + (x.matched ? 'Besvarad (svaret sparades inte då)' : 'Kunde inte svara') + '</p>');
            }).join('') + '</div></details>';
        }).join('') : '<p class="empty">Inga samtal än.</p>') + '</div></section>';
      html += '<section class="panel"><h3>Frågor chatten inte kunde svara på</h3><p class="panel__sub">Lägg till svaren i chattens FAQ så blir den bättre.</p>' +
        table([['Fråga', function (x) { return esc(x.question); }], ['Sida', function (x) { return esc(x.page_path || '–'); }], ['När', function (x) { return dt(x.created_at); }]], miss.slice(0, 50)) + '</section>';
      main().insertAdjacentHTML('beforeend', html);
      var find = $('#chat-find');
      if (find) find.addEventListener('input', function () {
        var t = find.value.trim().toLowerCase();
        main().querySelectorAll('.chatconv').forEach(function (d) { d.hidden = !!t && d.dataset.find.indexOf(t) < 0; });
      });
    });
  }

  /* ---------- Sajttester: everyone who used Testa din sajt ---------- */
  var MISSING = '<p class="empty">Tabellen finns inte än. Öppna projektet i Lovable → More → Database → Manage → SQL editor, klistra in supabase/sql/2026-11-22_lovable-cloud.sql och tryck Run.</p>';
  function scoreCell(v) { return v == null ? '–' : '<b style="color:' + (v >= 90 ? '#2f7d4f' : v >= 50 ? '#a26c07' : '#b42318') + '">' + v + '</b>'; }
  function renderSiteTests() {
    main().innerHTML = head('Sajttester', 'Alla som har testat sin sajt på Testa din sajt och SEO-djuptestet – senaste 90 dagarna.') + info('SEO-djuptestet', 'Rapporten låses upp med e-post. För att spara adresserna och begränsa till 3 rapporter per adress och månad: kör supabase/sql/2026-11-28_seo_rapporter.sql i Lovable. Tills dess öppnas rapporten ändå, men inget sparas.');
    var q = sb.from('site_tests').select('*').gte('created_at', since(90)).order('created_at', { ascending: false }).limit(2000);
    q.then(function (r) { if (r.error && /site_tests/.test(r.error.message || '')) { var l = $('#loading'); if (l) l.remove(); main().insertAdjacentHTML('beforeend', MISSING); } });
    fetchRows(q, function (t) {
      var host = function (u) { return String(u || '').replace(/^https?:\/\//, '').replace(/\/.*$/, ''); };
      var deep = t.filter(function (x) { return x.test_type === 'deep'; }).length;
      main().insertAdjacentHTML('beforeend', kpis([['Tester', t.length], ['Snabbtest', t.filter(function (x) { return x.test_type !== 'deep' && x.test_type !== 'seo'; }).length], ['Djupanalys', deep], ['SEO-djuptest', t.filter(function (x) { return x.test_type === 'seo'; }).length], ['Olika sajter', countBy(t, function (x) { return host(x.url); }, 100000).length]]) +
        '<div class="split">' + bars('Mest testade sajter', countBy(t, function (x) { return host(x.url); })) + bars('Typ av test', countBy(t, function (x) { return x.test_type === 'seo' ? 'SEO-djuptest' : x.test_type === 'deep' ? 'Djupanalys' : 'Snabbtest'; }), t.length) + '</div>' +
        '<section class="panel" id="st-all"><h3>Alla tester</h3>' + table([
          ['Sajt', function (x) { return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(host(x.url)) + '</a>'; }],
          ['Test', function (x) { return x.test_type === 'seo' ? 'SEO-djuptest' + (x.pages ? ' (' + x.pages + ' sidor)' : '') : x.test_type === 'deep' ? 'Djupanalys' + (x.pages ? ' (' + x.pages + ' sidor)' : '') : 'Snabbtest' + (x.strategy ? ' (' + (x.strategy === 'mobile' ? 'mobil' : 'dator') + ')' : ''); }],
          ['Prestanda', function (x) { return scoreCell(x.performance); }], ['Tillgänglighet', function (x) { return scoreCell(x.accessibility); }],
          ['Bästa praxis', function (x) { return scoreCell(x.best_practices); }], ['SEO', function (x) { return scoreCell(x.seo); }],
          ['Fel', function (x) { return x.issues == null ? '–' : x.issues; }], ['Land', function (x) { return esc(x.country || '–'); }], ['När', function (x) { return dt(x.created_at); }],
          ['', function (x) { return '<button class="btn btn--ghost btn--sm" type="button" data-who="' + esc(x.id) + '">Vem testade?</button>'; }]
        ], t) + '</section>');
      // who unlocked the full SEO report (supabase/sql/2026-11-28_seo_rapporter.sql); they gave their address themselves
      sb.from('seo_reports').select('email,url,newsletter,created_at').order('created_at', { ascending: false }).limit(500).then(function (r) {
        if (r.error || st.view !== 'sajttester') return;
        var box = $('#st-all'); if (!box) return;
        box.insertAdjacentHTML('beforebegin', '<section class="panel"><h3>Upplåsta SEO-rapporter</h3><p class="muted" style="margin:-4px 0 12px">Lämnade sin e-post för att låsa upp hela rapporten. Nyhetsbrev bara om de själva kryssade i det.</p>' + (r.data && r.data.length ? table([
          ['E-post', function (x) { return '<a href="mailto:' + esc(x.email) + '">' + esc(x.email) + '</a>'; }],
          ['Sajt', function (x) { return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(String(x.url).replace(/^https?:\/\//, '')) + '</a>'; }],
          ['Samma domän', function (x) { var d = String(x.email).split('@')[1] || '', h = String(x.url).replace(/^https?:\/\/(www\.)?/, ''); return d && h.indexOf(d) === 0 ? '<span class="tag">Troligen ägaren</span>' : '–'; }],
          ['Nyhetsbrev', function (x) { return x.newsletter ? 'Ja' : 'Nej'; }], ['När', function (x) { return dt(x.created_at); }]
        ], r.data) : '<p class="empty">Ingen har låst upp en rapport än.</p>') + '</section>');
      });
      $('#st-all').addEventListener('click', function (e) { var b = e.target.closest('[data-who]'); if (b) whoTested(t.filter(function (x) { return String(x.id) === b.dataset.who; })[0]); });
    });
  }

  // Everything we know about the person behind one test: the visit (only if they said yes to statistics in the cookie
  // box – then device, place and where they came from were saved) and any enquiry that mentions the site afterwards.
  function whoTested(x) {
    if (!x) return;
    var host = String(x.url || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
    var at = Date.parse(x.created_at), iso = function (ms) { return new Date(ms).toISOString(); };
    dialog('<h2>Vem testade ' + esc(host) + '?</h2><p class="muted">' + esc(dt(x.created_at)) + (x.country ? ' · från ' + esc(x.country) : '') + '</p><div id="who-out"><p class="muted">Letar …</p></div><div class="dlg__row"><button class="btn btn--ghost" type="button" data-close>Stäng</button></div>', function (d) {
      var out = d.querySelector('#who-out');
      Promise.all([
        sb.from('site_visits').select('*').like('source', 'event:sitetest%').gte('created_at', iso(at - 20 * 6e4)).lte('created_at', iso(at + 20 * 6e4)).limit(200),
        sb.from('quote_requests').select('id,name,company,email,phone,message,created_at').gte('created_at', iso(at - 6e4)).lte('created_at', iso(at + 7 * 864e5)).ilike('message', '%' + host + '%').limit(20)
      ]).then(function (res) {
        var ev = (res[0].data || []).filter(function (v) { return String(v.utm_medium || '').toLowerCase().indexOf(host) >= 0; });
        var sids = {}; ev.forEach(function (v) { sids[v.session_id] = 1; });
        var leads = (res[1].data || []).filter(function (l) { var t0 = Date.parse(l.created_at); return t0 >= at - 6e4 && t0 <= at + 7 * 864e5 && String(l.message || '').toLowerCase().indexOf(host) >= 0; });
        var more = Object.keys(sids).length ? sb.from('site_visits').select('*').in('session_id', Object.keys(sids)).order('created_at').limit(500) : Promise.resolve({ data: [] });
        return more.then(function (r2) { return { ev: ev, rows: r2.data || [], leads: leads, err: res[0].error || res[1].error }; });
      }).then(function (o) {
        var html = '';
        if (o.leads.length) html += info('Hörde av sig efteråt', o.leads.map(function (l) { return '<b>' + esc(l.company || l.name) + '</b> – ' + esc([l.name !== l.company ? l.name : '', l.email, l.phone].filter(Boolean).join(' · ')) + ' <small>(' + esc(dt(l.created_at)) + ')</small> <button class="btn btn--sm" type="button" data-openlead="' + l.id + '">Öppna</button>'; }).join('<br>'));
        var seen = {};
        o.rows.concat(o.ev).forEach(function (v) {
          if (seen[v.session_id]) return; seen[v.session_id] = 1;
          var all = o.rows.filter(function (r) { return r.session_id === v.session_id; }); if (!all.length) all = [v];
          var f = all[0], acts = all.map(function (r) { return ({ 'event:sitetest': 'Körde testet', 'event:sitetest_send': 'Tryckte på Skicka till oss', 'event:sitetest_pdf': 'Laddade ner rapporten som pdf' })[r.source] || (/^event:/.test(r.source) ? r.source.slice(6) : 'Besökte ' + r.path); });
          html += '<section class="panel"><h3>Besöket</h3><p>' + esc([f.device_type === 'mobile' ? 'Mobil' : f.device_type === 'tablet' ? 'Surfplatta' : f.device_type === 'desktop' ? 'Dator' : '', f.os, f.browser].filter(Boolean).join(' · ')) +
            '<br>' + esc([f.city, f.country].filter(Boolean).join(', ') || 'Okänd plats') + (f.language ? ' · språk ' + esc(f.language) : '') + (f.screen_w ? ' · skärm ' + f.screen_w + '×' + f.screen_h : '') +
            '<br>Kom från: ' + esc(f.referrer_host || (f.source && !/^event:/.test(f.source) ? f.source : 'direkt eller okänt')) + '</p><p class="muted">' + acts.map(esc).join(' → ') + '</p></section>';
        });
        if (!html) html = info('Mer än land och tid går inte att se', 'Den som testade sa inte ja till statistik i kakrutan, och ingen förfrågan nämner ' + esc(host) + ' efteråt. Då sparas inget om personen – det är så GDPR kräver.');
        if (o.err) html += '<p class="muted">Delvis: ' + esc(o.err.message) + '</p>';
        html += '<p class="muted" style="margin-top:10px">Vi sparar aldrig ip-adress eller namn för sajttester. Platsen kommer från Cloudflare och är ungefärlig.</p>';
        out.innerHTML = html;
      });
      d.addEventListener('click', function (e) { var b = e.target.closest('[data-openlead]'); if (b) { var l = lead(b.dataset.openlead); d.remove(); if (l) openLead(l); else toast('Leaden finns inte i din lista'); } });
    });
  }

  /* ---------- Beställningar: orders from /kassa (domains and mail). Payment and delivery are shown apart. ---------- */
  var OST = { awaiting_quote: 'Väntar på offert', confirmed: 'Bekräftad', done: 'Klar', cancelled: 'Avbruten' };
  var PST = { not_required_yet: 'Ingen betalning än', pending: 'Väntar', paid: 'Betald', failed: 'Misslyckad', refunded: 'Återbetald' };
  var DST = { manual: 'Manuell', queued: 'I kö', registered: 'Registrerad', failed: 'Misslyckad' };
  function renderOrders() {
    main().innerHTML = head('Beställningar', 'Domäner och företagsmejl från kassan. Inget registreras eller debiteras automatiskt.');
    var q = sb.from('orders').select('*').order('created_at', { ascending: false }).limit(1000);
    fetchRows(q, function (o) {
      var sum = function (x) { return (x.totals && (x.totals.once || 0)) || 0; };
      main().insertAdjacentHTML('beforeend', kpis([['Beställningar', o.length], ['Väntar på offert', o.filter(function (x) { return x.status === 'awaiting_quote'; }).length],
        ['Återkommande/mån', o.filter(function (x) { return x.status !== 'cancelled'; }).reduce(function (s, x) { return s + ((x.totals && x.totals.month) || 0); }, 0) + ' kr']]) +
        '<section class="panel">' + table([
          ['Order', function (x) { return '<b>' + esc(x.ref) + '</b><br><small>' + dt(x.created_at) + '</small>'; }],
          ['Kund', function (x) { return esc(x.name) + (x.company ? '<br><small>' + esc(x.company) + '</small>' : '') + '<br><a href="mailto:' + esc(x.email) + '">' + esc(x.email) + '</a>'; }],
          ['Produkter', function (x) { return (x.lines || []).map(function (l) { return esc(l.type === 'domain' ? l.name + ' (' + l.years + ' år)' : l.name + ' – ' + l.domain); }).join('<br>'); }],
          ['Nu', function (x) { return sum(x) + ' kr'; }],
          ['Status', function (x) { return '<select data-o="' + x.id + '" data-f="status">' + Object.keys(OST).map(function (k) { return '<option value="' + k + '"' + (x.status === k ? ' selected' : '') + '>' + OST[k] + '</option>'; }).join('') + '</select>'; }],
          ['Betalning', function (x) { return '<select data-o="' + x.id + '" data-f="payment_status">' + Object.keys(PST).map(function (k) { return '<option value="' + k + '"' + (x.payment_status === k ? ' selected' : '') + '>' + PST[k] + '</option>'; }).join('') + '</select>'; }],
          ['Leverans', function (x) { return '<select data-o="' + x.id + '" data-f="delivery_status">' + Object.keys(DST).map(function (k) { return '<option value="' + k + '"' + (x.delivery_status === k ? ' selected' : '') + '>' + DST[k] + '</option>'; }).join('') + '</select>'; }],
          ['Mejla kunden', function (x) { return '<div class="ordmail"><button class="btn btn--sm' + (x.status === 'awaiting_quote' ? '' : ' btn--ghost') + '" data-om="confirmed" data-id="' + x.id + '">1. Bekräftelse med pris</button>' +
            '<button class="btn btn--sm' + (x.status === 'confirmed' ? '' : ' btn--ghost') + '" data-om="registered" data-id="' + x.id + '">2. Domänen är registrerad</button>' + (x.notes ? '<small>' + esc(x.notes).replace(/\n/g, '<br>') + '</small>' : '') + '</div>'; }]
        ], o) + '</section>' +
        info('Så hanterar ni en beställning', '<b>1.</b> Kontrollera att domänen är ledig. Tryck <b>Bekräftelse med pris</b> – kunden får beställningen med priserna från prislistan och ombeds svara "Jag godkänner". Ska priset vara ett annat skriver ni det i raden ni får fylla i. ' +
          '<b>2.</b> När kunden har godkänt registrerar ni domänen hos er domänleverantör i kundens namn. <b>3.</b> Tryck <b>Domänen är registrerad</b> – kunden får besked och ordern blir Klar. Skicka fakturan som vanligt. ' +
          'Kunden fick redan ett kvitto när beställningen kom in, och ni fick den i Gmail.'));
      if (!main().dataset.om) main().dataset.om = '1', main().addEventListener('click', function (e) {
        var b = e.target.closest('[data-om]'); if (!b) return;
        var what = b.dataset.om === 'confirmed' ? 'bekräftelsen med pris' : 'beskedet att domänen är registrerad';
        var note = window.prompt('Skicka ' + what + ' till kunden. Vill du lägga till en rad i mejlet? (lämna tomt annars)', '');
        if (note === null) return;
        b.disabled = true;
        sb.auth.getSession().then(function (r) { return fetch('/api/order/mail', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (r.data.session ? r.data.session.access_token : '') }, body: JSON.stringify({ id: Number(b.dataset.id), kind: b.dataset.om, note: note }) }); })
          .then(function (r) { return r.json().catch(function () { return {}; }); })
          .then(function (d) { b.disabled = false; if (d.ok) { toast('Mejlet är skickat till kunden'); renderOrders(); } else toast(d.error === 'mail' ? 'Gmail är inte inställt i Cloudflare' : 'Det gick inte: ' + (d.message || d.error || 'okänt fel')); },
            function () { b.disabled = false; toast('Servern svarade inte'); });
      });
      main().addEventListener('change', function (e) {
        var s = e.target.closest('select[data-o]'); if (!s) return;
        var up = {}; up[s.dataset.f] = s.value;
        sb.from('orders').update(up).eq('id', s.dataset.o).then(function (r) { if (r.error) alert('Kunde inte spara: ' + r.error.message); });
      });
    });
  }

  /* ---------- Nyhetsbrev: sign-ups from the footer form ---------- */
  function renderNewsletter() {
    main().innerHTML = head('Nyhetsbrev', 'Alla som har gått med i mejllistan i sidfoten.');
    var q = sb.from('newsletter_signups').select('*').order('created_at', { ascending: false }).limit(5000);
    q.then(function (r) { if (r.error && /newsletter/.test(r.error.message || '')) { var l = $('#loading'); if (l) l.remove(); main().insertAdjacentHTML('beforeend', MISSING); } });
    fetchRows(q, function (n) {
      var month = n.filter(function (x) { return x.created_at >= since(30); }).length;
      main().insertAdjacentHTML('beforeend', kpis([['Prenumeranter', n.length], ['Nya senaste 30 dagarna', month]]) +
        '<section class="panel"><h3>Alla prenumeranter</h3><p class="panel__sub"><button type="button" class="btn btn--sm" id="nl-copy">Kopiera alla adresser</button></p>' +
        table([['E-post', function (x) { return '<a href="mailto:' + esc(x.email) + '">' + esc(x.email) + '</a>'; }], ['Sida', function (x) { return esc(x.page || '–'); }], ['När', function (x) { return dt(x.created_at); }]], n) + '</section>');
      var b = $('#nl-copy'); if (b) b.addEventListener('click', function () { navigator.clipboard.writeText(n.map(function (x) { return x.email; }).join(', ')).then(function () { b.textContent = 'Kopierat'; }); });
    });
  }

  /* ---------- Kundportal: customers, their subscription, requests, domains and mail, invoices and drafts ---------- */
  var PT_PLANS = ['Starter', 'Pro', 'Business', 'Premium'];
  var PT_STATUS = { ny: 'Ny', pagar: 'Pågår', klar: 'Klar', avbojd: 'Avböjd' };
  var PT_KIND = { andring: 'Ändring', uppsagning: 'Uppsägning', paketbyte: 'Paketbyte', ovrigt: 'Övrigt' };
  var PT_SVC = { doman: 'Domän', mejl: 'Mejl', ovrigt: 'Övrigt' };
  var PT_INV = { obetald: 'Obetald', betald: 'Betald', krediterad: 'Krediterad' };
  var PT_DRAFT = { pending: 'Väntar på kunden', approved: 'Godkänt', changes_requested: 'Ändringar önskade' };
  var ptSel = function (name, map, cur) { return '<select class="input" name="' + name + '">' + Object.keys(map).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + map[k] + '</option>'; }).join('') + '</select>'; };
  var ptIn = function (name, label, val, type, extra) { return '<label class="field">' + label + '<input class="input" name="' + name + '" type="' + (type || 'text') + '" value="' + esc(val == null ? '' : val) + '"' + (extra || '') + '></label>'; };
  var ptVal = function (f, n) { var v = f.querySelector('[name="' + n + '"]'); v = v ? v.value.trim() : ''; return v === '' ? null : v; };
  function renderPortal() {
    main().innerHTML = head('Kundportal', 'Kunderna loggar in på elevatestudio.nu/portal med en engångslänk till sin e-post. Där ser de abonnemanget, kan säga upp eller byta paket, skicka ärenden och se domäner, fakturor och utkast.', '<button class="btn" id="pt-new">+ Bjud in kund</button>') +
      info('Så fungerar inbjudan', 'Lägg upp kunden med den e-post de ska logga in med och skicka dem länken elevatestudio.nu/portal. När de loggar in första gången kopplas kontot automatiskt. Kräver att <b>supabase/sql/2026-11-26_kundportal.sql</b> är körd i Lovable och att portal.html finns bland tillåtna adresser för inloggning.');
    $('#pt-new').addEventListener('click', function () { ptEdit(null); });
    fetchRows(sb.from('portal_clients').select('*').order('created_at', { ascending: false }), function (rows) {

      sb.from('portal_requests').select('portal_client_id,kind,status').in('status', ['ny', 'pagar']).then(function (r) {
        var open = {}, stop = {}; (r.data || []).forEach(function (x) { open[x.portal_client_id] = (open[x.portal_client_id] || 0) + 1; if (x.kind === 'uppsagning') stop[x.portal_client_id] = 1; });
        main().insertAdjacentHTML('beforeend', '<div id="pt">' + table([
          ['Kund', function (c) { return '<b>' + esc(c.display_name || '–') + '</b><br><small>' + esc(c.company_name || '') + '</small>'; }],
          ['E-post', function (c) { return esc(c.invite_email || '–'); }],
          ['Paket', function (c) { return esc(c.plan || '–') + (c.monthly_fee != null ? '<br><small>' + c.monthly_fee + ' kr/mån</small>' : ''); }],
          ['Inloggning', function (c) { return c.user_id ? 'Inloggad' : 'Inbjuden'; }],
          ['Öppna ärenden', function (c) { return (open[c.id] || 0) + (stop[c.id] ? ' <b style="color:#a8321e">· uppsägning</b>' : ''); }],
          ['Aktiv', function (c) { return '<label class="switch"><input type="checkbox" data-id="' + c.id + '"' + (c.is_active ? ' checked' : '') + '><i></i></label>'; }],
          ['', function (c) { return '<button class="btn btn--sm" data-open="' + c.id + '">Öppna</button>'; }]], rows) + '</div>');
        $('#pt').addEventListener('change', function (e) {
          var id = e.target.dataset.id; if (!id) return;
          sb.from('portal_clients').update({ is_active: e.target.checked }).eq('id', id).then(function (x) { toast(x.error ? x.error.message : (e.target.checked ? 'Kontot är aktiverat' : 'Kontot är avstängt')); });
        });
        $('#pt').addEventListener('click', function (e) { var b = e.target.closest('[data-open]'); if (b) ptOpen(b.dataset.open); });
        ptLeadList(rows);
      });
    });
  }
  // all leads, newest first, with a button to open a customer account; the ones that already have one are marked
  function ptLeadList(clients) {
    var anchor = main().querySelector('.info');
    (anchor || main()).insertAdjacentHTML(anchor ? 'afterend' : 'beforeend', '<section class="panel" id="pt-leadbox"><h3>Leads – öppna kundkonto</h3><p class="panel__sub">Välj en lead så fylls namn, företag och e-post i. Vunna leads står först.</p>' +
      '<input class="input" id="pt-lq" placeholder="Sök på företag, namn eller e-post …" style="max-width:420px;margin-bottom:12px"><div id="pt-ll"><p class="empty">Hämtar leads …</p></div></section>');
    sb.from('quote_requests').select('id,name,company,email,phone,status,created_at').order('created_at', { ascending: false }).limit(3000).then(function (r) {
      var box = $('#pt-ll'); if (!box) return;
      if (r.error) { box.innerHTML = '<p class="empty">Kunde inte hämta leads: ' + esc(r.error.message) + '</p>'; return; }
      var has = function (l) { return clients.filter(function (c) { return c.quote_request_id === l.id || (l.email && c.invite_email && c.invite_email.toLowerCase() === l.email.toLowerCase()); })[0]; };
      var won = function (l) { return l.status === 'sold' || l.status === 'done'; };
      var leads = (r.data || []).filter(function (l) { return l.status !== 'archived'; }).sort(function (a, b) { return (won(b) ? 1 : 0) - (won(a) ? 1 : 0); });
      var draw = function () {
        var q = ($('#pt-lq').value || '').toLowerCase().trim();
        var list = leads.filter(function (l) { return !q || [l.company, l.name, l.email].join(' ').toLowerCase().indexOf(q) >= 0; }).slice(0, 60);
        box.innerHTML = table([
          ['Företag', function (l) { return '<b>' + esc(l.company || l.name || '–') + '</b>' + (l.company && l.name && l.name !== l.company ? '<br><small>' + esc(l.name) + '</small>' : ''); }],
          ['E-post', function (l) { return esc(l.email || '–'); }],
          ['Status', function (l) { return esc(STAGE[l.status] || l.status || ''); }],
          ['', function (l) { var c = has(l); return c ? '<button class="btn btn--sm btn--ghost" data-open="' + c.id + '">Har konto – öppna</button>' : '<button class="btn btn--sm" data-lead="' + l.id + '">Öppna kundkonto</button>'; }]], list) +
          (leads.length > 60 && !q ? '<p class="muted">Visar de 60 första. Sök för att hitta fler.</p>' : '');
      };
      draw();
      $('#pt-lq').addEventListener('input', draw);
      box.addEventListener('click', function (e) {
        var o = e.target.closest('[data-open]'); if (o) return ptOpen(o.dataset.open);
        var b = e.target.closest('[data-lead]'); if (!b) return;
        var l = leads.filter(function (x) { return x.id === b.dataset.lead; })[0];
        ptEdit({ quote_request_id: l.id, display_name: l.name && l.name !== l.company ? l.name : (l.company || l.name), company_name: l.company, invite_email: l.email });
      });
    });
  }
  function ptEdit(c, after) {
    c = c || {};
    dialog('<h2>' + (c.id ? 'Ändra kund' : 'Bjud in kund') + '</h2><p>Kunden loggar in med e-posten nedan. Paket, avgift och datum syns för kunden i portalen.</p>' +
      (c.id || c.quote_request_id ? '' : '<label class="field">Välj en av våra leads – uppgifterna fylls i<input class="input" id="pt-lead" placeholder="Sök på företag, namn eller e-post …" autocomplete="off"></label><div class="pt-pick" id="pt-pick"><p class="muted">Hämtar leads …</p></div><p class="muted" id="pt-lead-note" style="margin:6px 0 12px"></p>') +
      '<form id="pt-f">' +
      '<div class="grid2">' + ptIn('display_name', 'Namn', c.display_name, 'text', ' required') + ptIn('company_name', 'Företag', c.company_name) + '</div>' +
      '<div class="grid2">' + ptIn('invite_email', 'E-post för inloggning', c.invite_email, 'email', ' required') + ptIn('site_url', 'Hemsidans adress', c.site_url, 'url', ' placeholder="https://"') + '</div>' +
      '<div class="grid2"><label class="field">Paket<select class="input" name="plan"><option value="">Inget angivet</option>' + PT_PLANS.map(function (p) { return '<option' + (p === c.plan ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select></label>' + ptIn('monthly_fee', 'Månadsavgift (kr, exkl. moms)', c.monthly_fee, 'number', ' min="0"') + '</div>' +
      '<div class="grid2">' + ptIn('started_on', 'Startade', c.started_on, 'date') + ptIn('ends_on', 'Upphör (vid uppsägning)', c.ends_on, 'date') + '</div>' +
      '<label class="field">Om faktureringen (syns för kunden)<textarea class="input" name="billing_note" rows="2">' + esc(c.billing_note || '') + '</textarea></label>' +
      '<div class="dlg__row"><button class="btn btn--ghost" type="button" data-close>Avbryt</button><button class="btn" type="submit">' + (c.id ? 'Spara' : 'Lägg upp kunden') + '</button></div></form>', function (d) {
      // pick a lead: name, company, e-mail and phone come from the lead, and the account is linked to it
      var leadId = c.quote_request_id || null, pick = d.querySelector('#pt-lead');
      if (pick) {
        var all = [], box = d.querySelector('#pt-pick');
        var draw = function () {
          var q = pick.value.toLowerCase().trim();
          var list = all.filter(function (l) { return !q || [l.company, l.name, l.email].join(' ').toLowerCase().indexOf(q) >= 0; }).slice(0, 40);
          box.innerHTML = list.length ? list.map(function (l) {
            return '<button type="button" class="pt-pick__row' + (l.id === leadId ? ' is-on' : '') + '" data-lid="' + l.id + '"><b>' + esc(l.company || l.name || '–') + '</b><span>' + esc([l.company && l.name && l.name !== l.company ? l.name : '', l.email].filter(Boolean).join(' · ')) + '</span></button>';
          }).join('') : '<p class="muted">Ingen lead matchar.</p>';
        };
        sb.from('quote_requests').select('id,name,company,email,status').order('created_at', { ascending: false }).limit(3000).then(function (r) {
          if (r.error) { box.innerHTML = '<p class="muted">Kunde inte hämta leads: ' + esc(r.error.message) + '</p>'; return; }
          var won = function (l) { return l.status === 'sold' || l.status === 'done'; };
          all = (r.data || []).filter(function (l) { return l.status !== 'archived'; }).sort(function (a, b) { return (won(b) ? 1 : 0) - (won(a) ? 1 : 0); });
          draw();
        });
        pick.addEventListener('input', draw);
        box.addEventListener('click', function (e) {
          var row = e.target.closest('[data-lid]'); if (!row) return;
          var l = all.filter(function (x) { return x.id === row.dataset.lid; })[0];
          var f = d.querySelector('#pt-f'), set = function (n, v) { var el = f.querySelector('[name="' + n + '"]'); if (el) el.value = v || ''; };
          set('display_name', l.name && l.name !== l.company ? l.name : (l.company || l.name)); set('company_name', l.company); set('invite_email', l.email);
          leadId = l.id; draw();
          d.querySelector('#pt-lead-note').textContent = l.email ? 'Uppgifterna är ifyllda från leaden. Fyll i paket och avgift och tryck Lägg upp kunden.' : 'Leaden saknar e-post – fyll i den e-post kunden ska logga in med.';
        });
      }
      d.querySelector('#pt-f').addEventListener('submit', function (e) {
        e.preventDefault(); var f = this;
        var row = { quote_request_id: leadId, display_name: ptVal(f, 'display_name'), company_name: ptVal(f, 'company_name'), invite_email: (ptVal(f, 'invite_email') || '').toLowerCase(), site_url: ptVal(f, 'site_url'),
          plan: ptVal(f, 'plan'), monthly_fee: ptVal(f, 'monthly_fee') == null ? null : Number(ptVal(f, 'monthly_fee')), started_on: ptVal(f, 'started_on'), ends_on: ptVal(f, 'ends_on'), billing_note: ptVal(f, 'billing_note') };
        var save = function (r0) { return c.id ? sb.from('portal_clients').update(r0).eq('id', c.id) : sb.from('portal_clients').insert(Object.assign({ is_active: true }, r0)); };
        save(row).then(function (r) {
          // an older database without the link to the lead: save the rest
          if (r.error && /quote_request_id/.test(r.error.message)) { delete row.quote_request_id; return save(row); }
          return r;
        }).then(function (r) {
          if (r.error) return toast(/duplicate|unique/i.test(r.error.message) ? 'Det finns redan en kund med den e-posten' : r.error.message);
          d.remove(); toast(c.id ? 'Sparat' : 'Kunden är upplagd. Skicka länken elevatestudio.nu/portal'); (after || renderPortal)();
        });
      });
    });
  }
  // Reads the invoice number, the amount to pay and the dates from an invoice's text
  function parseInvoice(text) {
    var t = String(text || '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ');
    var M = { januari: 1, februari: 2, mars: 3, april: 4, maj: 5, juni: 6, juli: 7, augusti: 8, september: 9, oktober: 10, november: 11, december: 12,
      jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, okt: 10, nov: 11, dec: 12 };
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var DATE = /(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|okt|nov|dec)\.?\s+(\d{4})|(\d{1,2})[./](\d{1,2})[./](\d{4})/gi;
    var toIso = function (m) {
      if (m[1]) return m[1] + '-' + m[2] + '-' + m[3];
      if (m[4]) return m[6] + '-' + pad(M[m[5].toLowerCase()]) + '-' + pad(+m[4]);
      return m[9] + '-' + pad(+m[8]) + '-' + pad(+m[7]);
    };
    var dates = []; var m; DATE.lastIndex = 0;
    while ((m = DATE.exec(t))) dates.push({ at: m.index, iso: toIso(m) });
    var after = function (re) { var x = re.exec(t); if (!x) return null; var d = dates.filter(function (d) { return d.at > x.index && d.at - x.index < 200; })[0]; return d ? d.iso : null; };
    var issued = after(/fakturadatum|datum för faktura|invoice date/i), due = after(/förfallodatum|förfallodag|betalas senast|sista betalningsdag|due date/i);
    var sorted = dates.map(function (d) { return d.iso; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
    if (!issued && sorted.length) issued = sorted[0];
    if ((!due || due === issued) && sorted.length > 1) due = sorted.filter(function (d) { return d > (issued || ''); }).pop() || due;
    // the amount to pay: the first of these labels that is followed by an amount
    var amount = null;
    [/att betala/i, /summa att betala/i, /totalt att betala/i, /belopp att betala/i, /totalbelopp/i, /totalt/i, /summa/i, /total/i].some(function (re) {
      var x = re.exec(t); if (!x) return false;
      var rest = t.slice(x.index + x[0].length, x.index + x[0].length + 80);
      var a = /(\d{1,3}(?:[ .]\d{3})+|\d+)(?:,(\d{2}))?\s*(kr|sek|:-)/i.exec(rest);
      if (!a) return false;
      amount = Math.round(Number(a[1].replace(/[ .]/g, '')) + (a[2] ? Number(a[2]) / 100 : 0));
      return true;
    });
    var num = /(fakturanummer|fakturanr|faktura nr|fakturanr\.|invoice (?:no|number))\s*[:.#]?\s*\n?\s*([A-Za-z0-9][\w\-\/]{1,30})/i.exec(t);
    return { number: num ? num[2] : null, amount: amount, issued: issued, due: due };
  }
  // PDF.js (assets/vendor/pdfjs, Apache 2.0) is loaded the first time a pdf is uploaded; it reads the text in the browser
  var pdfLib = null;
  function loadPdf() {
    if (pdfLib) return pdfLib;
    pdfLib = new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = '../assets/vendor/pdfjs/pdf.min.js';
      s.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../assets/vendor/pdfjs/pdf.worker.min.js'; ok(window.pdfjsLib); };
      s.onerror = function () { pdfLib = null; no(new Error('pdf-läsaren kunde inte laddas')); };
      document.head.appendChild(s);
    });
    return pdfLib;
  }
  function readInvoice(file, type) {
    if ((type || file.type) !== 'application/pdf') return Promise.resolve({});
    return loadPdf().then(function (lib) { return file.arrayBuffer().then(function (buf) { return lib.getDocument({ data: new Uint8Array(buf) }).promise; }); })
      .then(function (doc) {
        var pages = []; for (var i = 1; i <= Math.min(2, doc.numPages); i++) pages.push(i);
        return Promise.all(pages.map(function (n) { return doc.getPage(n).then(function (pg) { return pg.getTextContent(); }); }));
      })
      .then(function (cs) { return parseInvoice(cs.map(function (c) { return c.items.map(function (it) { return it.str + (it.hasEOL ? '\n' : ' '); }).join(''); }).join('\n')); })
      .catch(function () { return {}; });
  }
  var fileType = function (file) {
    if (/^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.type)) return file.type;
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    return { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }[ext] || null;
  };
  // the database's answer in plain Swedish, with what to do about it
  var explain = function (msg, what) {
    msg = String(msg || '');
    if (/bucket/i.test(msg)) return 'lagringsplatsen saknas – kör supabase/sql/2026-11-27_fakturor.sql i Lovable';
    if (/row-level security|violates|permission|not authorized|unauthorized/i.test(msg)) return 'databasen godkände inte ' + what + ' från ditt konto (' + msg + '). Kör supabase/sql/2026-11-26_kundportal.sql och sedan 2026-11-27_fakturor.sql igen i Lovable, logga ut och in och försök igen.';
    if (/duplicate|already exists/i.test(msg)) return 'det finns redan en fil med samma namn – byt namn på filen och försök igen';
    if (/jwt|expired|token/i.test(msg)) return 'inloggningen har gått ut – logga ut och in igen (' + msg + ')';
    return msg;
  };
  // upload invoice files (pdf or image, made in any program) for one customer; each file becomes an invoice row
  function ptUploadFiles(id, files, status, progress) {
    var list = Array.prototype.slice.call(files || []), ok = 0, bad = [], read = [], i = 0;
    return new Promise(function (resolve) {
      var one = function () {
        if (i >= list.length) return resolve({ ok: ok, bad: bad, read: read });
        var file = list[i++];
        if (progress) progress('Laddar upp ' + i + ' av ' + list.length + ' …');
        if (file.size > 15 * 1024 * 1024) { bad.push([file.name, 'större än 15 MB']); return one(); }
        var type = fileType(file);
        if (!type) { bad.push([file.name, 'bara pdf, png, jpg eller webp (filen var ' + (file.type || 'utan filtyp') + ')']); return one(); }
        var safe = file.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '-').slice(-120);
        var path = id + '/' + Date.now() + '-' + safe;
        sb.storage.from('portal-invoices').upload(path, file, { contentType: type, upsert: false }).then(function (r) {
          if (r.error) { bad.push([file.name, explain(r.error.message, 'filen')]); return one(); }
          // the number, the amount and the dates are read from the pdf itself; what cannot be read is left for you to fill in
          return readInvoice(file, type).then(function (inv) {
            var row = { portal_client_id: id, number: (inv.number || file.name.replace(/\.[^.]+$/, '')).slice(0, 60) || 'Faktura', file_path: path, file_name: file.name.slice(0, 200), status: status || 'obetald' };
            if (inv.amount != null) row.amount_sek = inv.amount;
            if (inv.issued) row.issued_on = inv.issued;
            if (inv.due) row.due_on = inv.due;
            return sb.from('portal_invoices').insert(row).then(function (x) {
              if (x.error) { bad.push([file.name, explain(x.error.message, 'fakturaraden')]); sb.storage.from('portal-invoices').remove([path]); }
              else { ok++; read.push([file.name, inv]); }
              one();
            });
          });
        }, function (er) { bad.push([file.name, String(er && er.message || er)]); one(); });
      };
      one();
    });
  }
  function ptRead(read) {
    if (!read || !read.length) return '';
    return info('Det här lästes av från fakturorna', read.map(function (r) { var v = r[1] || {};
      return '<b>' + esc(r[0]) + '</b>: ' + (v.number || v.amount != null || v.due ? [v.number ? 'nr ' + esc(v.number) : '', v.amount != null ? v.amount.toLocaleString('sv-SE') + ' kr' : '', v.issued ? 'daterad ' + v.issued : '', v.due ? 'förfaller ' + v.due : ''].filter(Boolean).join(' · ') : 'inget kunde läsas – fyll i belopp och datum själv'); }).join('<br>') + '<br><small>Kontrollera gärna och ändra under kunden om något blev fel.</small>');
  }
  function ptBad(bad) { return info('Det här gick inte att ladda upp', bad.map(function (b2) { return '<b>' + esc(b2[0]) + '</b>: ' + esc(b2[1]); }).join('<br>')); }
  // straight from the Kundportal page: pick the customer, then drop the files
  // straight from Fakturor: pick any lead or customer, then drop the files. A lead without a customer account gets one
  // (with the lead's e-mail as login), so the customer can download the invoice in the portal.
  var normName = function (v) { return String(v || '').toLowerCase().replace(/\b(ab|hb|kb|aktiebolag)\b/g, '').replace(/[^a-z0-9åäö]+/g, ''); };
  function matchAccount(l, clients) {
    if (!l) return null;
    return clients.filter(function (c) {
      return c.quote_request_id === l.id || (l.email && c.invite_email && c.invite_email.toLowerCase() === l.email.toLowerCase()) ||
        (normName(l.company) && (normName(c.company_name) === normName(l.company) || normName(c.display_name) === normName(l.company)));
    })[0] || null;
  }
  function ptUploadDialog(preset) {
    dialog('<h2>Ladda upp fakturor</h2><p>Fakturor du har gjort i ett annat program – pdf eller bild, högst 15 MB per fil. Välj vilken lead eller kund som helst. Nummer, belopp och datum läses av från pdf:en.</p>' +
      '<label class="field">Kund eller lead<input class="input" id="pt-us" placeholder="Sök på företag, namn eller e-post …" autocomplete="off"></label><div class="pt-pick" id="pt-upick"><p class="muted">Hämtar …</p></div>' +
      '<p class="muted" id="pt-uchosen" style="margin:8px 0 12px">Ingen vald än.</p>' +
      '<label class="field">Status för fakturorna' + ptSel('upstatus', PT_INV, 'obetald') + '</label>' +
      '<div class="pt-drop" id="pt-udrop"><input id="pt-ufiles" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" hidden><label class="btn" for="pt-ufiles">Välj filer</label><span>eller dra hit dem</span><b class="muted" id="pt-uprog"></b></div>' +
      '<div id="pt-ures"></div><div class="dlg__row"><button class="btn btn--ghost" type="button" data-close>Stäng</button></div>', function (d) {
      var box = d.querySelector('#pt-upick'), search = d.querySelector('#pt-us'), prog = d.querySelector('#pt-uprog'), drop = d.querySelector('#pt-udrop');
      var items = [], chosen = null;
      Promise.all([
        sb.from('portal_clients').select('id,display_name,company_name,invite_email,quote_request_id').order('company_name'),
        sb.from('quote_requests').select('id,name,company,email,status').order('created_at', { ascending: false }).limit(3000)
      ]).then(function (r) {
        var clients = r[0].data || [], leads = r[1].data || [];
        if (r[0].error) d.querySelector('#pt-ures').innerHTML = info('Kundkontona gick inte att hämta', esc(explain(r[0].error.message, 'kundkontona')));
        var has = function (l) { return matchAccount(l, clients); };
        items = clients.map(function (c) { return { kind: 'client', id: c.id, title: c.company_name || c.display_name || c.invite_email, sub: [c.company_name && c.display_name !== c.company_name ? c.display_name : '', c.invite_email].filter(Boolean).join(' · '), tag: 'Kund' }; })
          .concat(leads.filter(function (l) { return !has(l); }).map(function (l) { return { kind: 'lead', lead: l, title: l.company || l.name || l.email || '–', sub: [l.company && l.name !== l.company ? l.name : '', l.email].filter(Boolean).join(' · '), tag: l.status === 'archived' ? 'Arkiverad lead' : 'Lead' }; }));
        if (r[0].error && r[1].error) { box.innerHTML = '<p class="muted">Kunde inte hämta: ' + esc(r[1].error.message) + '</p>'; return; }
        // opened from a lead: that lead (or its customer) is already chosen
        if (preset && preset.lead) {
          var acc = matchAccount(preset.lead, clients);
          chosen = items.filter(function (x) { return acc ? x.kind === 'client' && x.id === acc.id : x.kind === 'lead' && x.lead.id === preset.lead.id; })[0] || null;
          if (chosen) { search.value = chosen.title; d.querySelector('#pt-uchosen').textContent = 'Vald: ' + chosen.title; }
        }
        draw();
      });
      var draw = function () {
        var q = search.value.toLowerCase().trim();
        var list = items.filter(function (x) { return !q || (x.title + ' ' + x.sub).toLowerCase().indexOf(q) >= 0; }).slice(0, 50);
        box.innerHTML = (list.length ? list.map(function (x, i) { return '<button type="button" class="pt-pick__row' + (chosen === x ? ' is-on' : '') + '" data-i="' + items.indexOf(x) + '"><b>' + esc(x.title) + ' <small class="muted">' + x.tag + '</small></b><span>' + esc(x.sub) + '</span></button>'; }).join('') : '<p class="muted">Ingen matchar.</p>') +
          (q ? '<button type="button" class="pt-pick__row" data-new="1"><b>+ Lägg upp »' + esc(search.value.trim()) + '« som ny kund</b><span>Om kunden inte finns i listan</span></button>' : '');
      };
      search.addEventListener('input', draw);
      box.addEventListener('click', function (e) {
        if (e.target.closest('[data-new]')) {
          var nm = search.value.trim();
          chosen = { kind: 'lead', lead: { id: null, name: nm, company: nm, email: '' }, title: nm, sub: 'Ny kund', tag: 'Ny' };
          d.querySelector('#pt-uchosen').textContent = 'Vald: ' + nm + ' (ny kund)';
          return;
        }
        var row = e.target.closest('[data-i]'); if (!row) return;
        chosen = items[Number(row.dataset.i)]; draw();
        d.querySelector('#pt-uchosen').textContent = 'Vald: ' + chosen.title;
      });
      // the customer account to put the invoices on: the chosen one, or a new one made from the lead
      var target = function () {
        if (chosen.kind === 'client') return Promise.resolve(chosen.id);
        var l = chosen.lead, email = (l.email || '').trim().toLowerCase() || null;
        var row = { is_active: true, quote_request_id: l.id || null, display_name: l.name && l.name !== l.company ? l.name : (l.company || l.name || email), company_name: l.company || null, invite_email: email };
        var add = function (r0) { return sb.from('portal_clients').insert(r0).select('id').single(); };
        return add(row).then(function (r) {
          if (r.error && /quote_request_id/.test(r.error.message)) { delete row.quote_request_id; return add(row); }
          return r;
        }).then(function (r) {
          if (!r.error) return r.data.id;
          if (/duplicate|unique/i.test(r.error.message) && email) return sb.from('portal_clients').select('id').eq('invite_email', email).single().then(function (x) { if (x.error) throw x.error; return x.data.id; });
          throw new Error(explain(r.error.message, 'kundkontot'));
        }).then(function (id) { chosen = { kind: 'client', id: id, title: chosen.title, sub: chosen.sub, tag: 'Kund' }; return id; });
      };
      var go = function (files) {
        if (!chosen) { prog.textContent = ''; d.querySelector('#pt-uchosen').textContent = 'Välj först en lead eller kund i listan ovan.'; return; }
        if (!files || !files.length) return;
        files = Array.prototype.slice.call(files); // the file picker is emptied right after, before the account is ready
        prog.textContent = 'Förbereder …';
        target().then(function (id) {
          return ptUploadFiles(id, files, d.querySelector('[name="upstatus"]').value, function (t) { prog.textContent = t; }).then(function (res) {
            prog.textContent = res.ok + (res.ok === 1 ? ' faktura uppladdad' : ' fakturor uppladdade');
            d.querySelector('#pt-ures').innerHTML = (res.bad.length ? ptBad(res.bad) : '') + ptRead(res.read) + (res.ok ? '<p><button class="btn btn--sm" type="button" data-goto="' + id + '">Öppna kundens fakturor</button></p>' : '');
          });
        }).catch(function (er) { prog.textContent = ''; d.querySelector('#pt-ures').innerHTML = info('Det gick inte', esc(er && er.message || String(er)) + (/portal_clients/.test(er && er.message || '') ? '<br>Kör supabase/sql/2026-11-26_kundportal.sql och 2026-11-27_fakturor.sql i Lovable.' : '')); });
      };
      d.querySelector('#pt-ufiles').addEventListener('change', function () { go(this.files); this.value = ''; });
      ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('is-over'); }); });
      ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('is-over'); }); });
      drop.addEventListener('drop', function (e) { go(e.dataTransfer && e.dataTransfer.files); });
      d.addEventListener('click', function (e) { var g = e.target.closest('[data-goto]'); if (g) { d.remove(); go2(g.dataset.goto); } });
      var go2 = function (id) { go('kundportal'); setTimeout(function () { ptOpen(id); }, 400); };
    });
  }
  function ptInvEdit(x, after) {
    if (!x) return;
    dialog('<h2>Ändra faktura</h2><p>Det här ser kunden i portalen.' + (x.file_name ? ' Fil: ' + esc(x.file_name) + '.' : '') + '</p><form id="pt-ie">' +
      '<div class="grid2">' + ptIn('number', 'Fakturanummer', x.number, 'text', ' required') + ptIn('amount_sek', 'Belopp (kr)', x.amount_sek, 'number', ' min="0"') + '</div>' +
      '<div class="grid2">' + ptIn('issued_on', 'Fakturadatum', x.issued_on, 'date') + ptIn('due_on', 'Förfallodatum', x.due_on, 'date') + '</div>' +
      '<label class="field">Status' + ptSel('status', PT_INV, x.status) + '</label>' +
      '<div class="dlg__row"><button class="btn btn--ghost" type="button" data-close>Avbryt</button><button class="btn" type="submit">Spara</button></div></form>', function (d) {
      d.querySelector('#pt-ie').addEventListener('submit', function (e) {
        e.preventDefault(); var f = this;
        sb.from('portal_invoices').update({ number: ptVal(f, 'number'), amount_sek: ptVal(f, 'amount_sek') == null ? null : Number(ptVal(f, 'amount_sek')), issued_on: ptVal(f, 'issued_on'), due_on: ptVal(f, 'due_on'), status: ptVal(f, 'status') }).eq('id', x.id)
          .then(function (r) { if (r.error) return toast(r.error.message); d.remove(); toast('Sparat'); after(); });
      });
    });
  }
  function ptOpen(id) {
    main().innerHTML = '<p class="empty">Hämtar …</p>';
    var by = function (t, order) { return sb.from(t).select('*').eq('portal_client_id', id).order(order || 'created_at', { ascending: false }); };
    Promise.all([sb.from('portal_clients').select('*').eq('id', id).single(), by('portal_requests'), by('portal_services', 'name'), by('portal_invoices'), by('portal_content_items')]).then(function (r) {
      var err = r.filter(function (x) { return x.error; })[0]; if (err) { main().innerHTML = head('Kundportal', '') + '<p class="empty">Kunde inte hämta: ' + esc(err.error.message) + '</p>'; return; }
      var c = r[0].data, reqs = r[1].data || [], svcs = r[2].data || [], invs = r[3].data || [], drafts = r[4].data || [];
      var again = function () { ptOpen(id); };
      main().innerHTML = '<div id="pt-detail">' + head(esc(c.display_name || 'Kund'), esc([c.company_name, c.invite_email, c.user_id ? 'inloggad' : 'inbjuden, har inte loggat in än'].filter(Boolean).join(' · ')),
        '<button class="btn btn--ghost" id="pt-back">← Alla kunder</button><button class="btn" id="pt-edit">Ändra kund</button>') +
        // invoices first: what is unpaid, when the next one is due, what has been paid, and the plan
        (function () {
          var today = new Date().toISOString().slice(0, 10), open = invs.filter(function (x) { return x.status === 'obetald'; });
          var next = open.map(function (x) { return x.due_on; }).filter(Boolean).sort()[0];
          var sum = function (list) { return list.reduce(function (a, x) { return a + (x.amount_sek || 0); }, 0); };
          return kpis([['Obetalt', kr(sum(open)) + (open.length ? ' <small class="muted">(' + open.length + ')</small>' : '')],
            ['Nästa förfallodag', next ? (next < today ? '<span style="color:#b2412c">' + day(next) + '</span> <small style="color:#b2412c">förfallen</small>' : day(next)) : '–'],
            ['Betalt totalt', kr(sum(invs.filter(function (x) { return x.status === 'betald'; })))],
            ['Paket', esc(c.plan || '–') + (c.monthly_fee != null ? ' <small class="muted">' + c.monthly_fee + ' kr/mån</small>' : '')]]);
        })() +
        '<section class="panel" id="pt-invbox"><h3>Fakturor</h3><p class="panel__sub">Ladda upp alla fakturor för kunden på en gång – pdf eller bild, högst 15 MB per fil. Varje fil blir en faktura som kunden kan ladda ner i portalen. Nummer, belopp och datum läses av från pdf:en – kontrollera och ändra med Ändra om något blev fel.</p>' +
          '<div class="pt-drop" id="pt-drop"><input id="pt-files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" hidden>' +
          '<label class="btn" for="pt-files">Ladda upp fakturor</label><span>eller dra hit filerna</span>' +
          '<label class="pt-drop__st">Status för de nya ' + ptSel('upstatus', PT_INV, 'obetald') + '</label><b id="pt-prog" class="muted"></b></div>' +
          table([['Nummer', function (x) { return '<b>' + esc(x.number) + '</b>'; }],
            ['Fil', function (x) { return x.file_path ? '<button class="btn btn--sm btn--ghost" data-file="' + esc(x.file_path) + '">Öppna ' + esc((x.file_name || '').split('.').pop().toUpperCase() || 'fil') + '</button>' : (x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">Länk</a>' : '–'); }],
            ['Belopp', function (x) { return x.amount_sek != null ? kr(x.amount_sek) : '<span class="muted">Fyll i</span>'; }], ['Fakturadatum', function (x) { return day(x.issued_on); }], ['Förfaller', function (x) { return x.due_on && x.status === 'obetald' && x.due_on < new Date().toISOString().slice(0, 10) ? '<b style="color:#b2412c">' + day(x.due_on) + '</b>' : day(x.due_on); }],
            ['Status', function (x) { return '<select class="input" data-inv="' + x.id + '">' + Object.keys(PT_INV).map(function (k) { return '<option value="' + k + '"' + (k === x.status ? ' selected' : '') + '>' + PT_INV[k] + '</option>'; }).join('') + '</select>'; }],
            ['', function (x) { return '<button class="btn btn--sm btn--ghost" data-invedit="' + x.id + '">Ändra</button> <button class="btn btn--sm btn--ghost" data-del="portal_invoices" data-id="' + x.id + '"' + (x.file_path ? ' data-path="' + esc(x.file_path) + '"' : '') + '>Ta bort</button>'; }]], invs) +
          '<details style="margin-top:12px"><summary class="muted">Lägg till en faktura utan fil (bara en länk)</summary><form id="pt-inv" class="grid2" style="margin-top:12px">' + ptIn('number', 'Fakturanummer', '', 'text', ' required') + ptIn('amount_sek', 'Belopp (kr)', '', 'number', ' min="0"') + ptIn('issued_on', 'Fakturadatum', '', 'date') + ptIn('due_on', 'Förfallodatum', '', 'date') +
          '<label class="field">Status' + ptSel('status', PT_INV, 'obetald') + '</label>' + ptIn('url', 'Länk (https://)', '', 'url') + '<button class="btn btn--sm" type="submit">Lägg till</button></form></details></section>' +
        '<section class="panel"><h3>Ärenden, uppsägningar och paketbyten</h3><p class="panel__sub">Svaret och statusen syns för kunden i portalen. Vid uppsägning: bekräfta, och fyll i Upphör under Ändra kund.</p>' +
        (reqs.length ? reqs.map(function (q) {
          return '<form class="pt-adm-req" data-id="' + q.id + '"><div><b>' + esc(PT_KIND[q.kind] || q.kind) + ': ' + esc(q.title) + '</b> <small>' + dt(q.created_at) + '</small>' + (q.wanted_plan ? '<br><small>Vill byta till ' + esc(q.wanted_plan) + '</small>' : '') +
            (q.body ? '<p style="white-space:pre-line;margin:6px 0">' + esc(q.body) + '</p>' : '') + '</div><div class="grid2"><label class="field">Status' + ptSel('status', PT_STATUS, q.status) + '</label><span></span></div>' +
            '<label class="field">Svar till kunden<textarea class="input" name="reply" rows="2">' + esc(q.reply || '') + '</textarea></label><button class="btn btn--sm" type="submit">Spara</button></form>';
        }).join('<hr>') : '<p class="empty">Inga ärenden.</p>') + '</section>' +
        '<section class="panel"><h3>Domäner och mejl</h3>' + table([['Typ', function (x) { return esc(PT_SVC[x.kind] || x.kind); }], ['Namn', function (x) { return '<b>' + esc(x.name) + '</b>'; }], ['Förnyas', function (x) { return day(x.renews_on); }], ['Notering', function (x) { return esc(x.note || ''); }],
          ['', function (x) { return '<button class="btn btn--sm btn--ghost" data-del="portal_services" data-id="' + x.id + '">Ta bort</button>'; }]], svcs) +
        '<form id="pt-svc" class="grid2" style="margin-top:12px"><label class="field">Typ' + ptSel('kind', PT_SVC, 'doman') + '</label>' + ptIn('name', 'Namn (domän eller adress)', '', 'text', ' required') + ptIn('renews_on', 'Förnyas', '', 'date') + ptIn('note', 'Notering', '') + '<button class="btn btn--sm" type="submit">Lägg till</button></form></section>' +
        '<section class="panel"><h3>Utkast att godkänna</h3><p class="panel__sub">En ny text, en sida eller en korrekturrunda. Kunden godkänner eller skriver vad som ska ändras.</p>' +
        (drafts.length ? drafts.map(function (x) { return '<div style="margin-bottom:12px"><b>' + esc(x.title) + '</b> <small>' + dt(x.created_at) + ' · ' + esc(PT_DRAFT[x.status] || x.status) + '</small>' + (x.client_feedback ? '<p style="white-space:pre-line;margin:6px 0"><i>Kunden:</i> ' + esc(x.client_feedback) + '</p>' : '') + '</div>'; }).join('') : '<p class="empty">Inga utkast.</p>') +
        '<form id="pt-draft" style="margin-top:12px">' + ptIn('title', 'Rubrik', '', 'text', ' required') + '<label class="field">Text<textarea class="input" name="body" rows="5" required></textarea></label><button class="btn btn--sm" type="submit">Skicka till kunden</button></form></section></div>';
      var box = $('#pt-detail');
      $('#pt-back').addEventListener('click', renderPortal);
      $('#pt-edit').addEventListener('click', function () { ptEdit(c, again); });
      var done = function (x, msg) { if (x.error) return toast(x.error.message); toast(msg); again(); };
      box.addEventListener('submit', function (e) {
        var f = e.target; e.preventDefault();
        if (f.classList.contains('pt-adm-req')) sb.from('portal_requests').update({ status: ptVal(f, 'status'), reply: ptVal(f, 'reply') }).eq('id', f.dataset.id).then(function (x) { done(x, 'Sparat – kunden ser svaret i portalen'); });
        else if (f.id === 'pt-svc') sb.from('portal_services').insert({ portal_client_id: id, kind: ptVal(f, 'kind'), name: ptVal(f, 'name'), renews_on: ptVal(f, 'renews_on'), note: ptVal(f, 'note') }).then(function (x) { done(x, 'Tillagd'); });
        else if (f.id === 'pt-inv') sb.from('portal_invoices').insert({ portal_client_id: id, number: ptVal(f, 'number'), amount_sek: ptVal(f, 'amount_sek') == null ? null : Number(ptVal(f, 'amount_sek')), issued_on: ptVal(f, 'issued_on'), due_on: ptVal(f, 'due_on'), status: ptVal(f, 'status'), url: ptVal(f, 'url') }).then(function (x) { done(x, 'Fakturan är tillagd'); });
        else if (f.id === 'pt-draft') sb.from('portal_content_items').insert({ portal_client_id: id, title: ptVal(f, 'title'), body: ptVal(f, 'body') }).then(function (x) { done(x, 'Utkastet syns nu för kunden'); });
      });
      box.addEventListener('change', function (e) { var i = e.target.dataset.inv; if (i) sb.from('portal_invoices').update({ status: e.target.value }).eq('id', i).then(function (x) { toast(x.error ? x.error.message : 'Status ändrad'); }); });
      box.addEventListener('click', function (e) {
        var f = e.target.closest('[data-file]');
        if (f) { var w = window.open('', '_blank'); sb.storage.from('portal-invoices').createSignedUrl(f.dataset.file, 300).then(function (r) { if (r.error) { if (w) w.close(); return toast(r.error.message); } if (w) w.location = r.data.signedUrl; else location.href = r.data.signedUrl; }); return; }
        var ed = e.target.closest('[data-invedit]');
        if (ed) { ptInvEdit(invs.filter(function (x) { return x.id === ed.dataset.invedit; })[0], again); return; }
        var b = e.target.closest('[data-del]'); if (!b || !confirm('Ta bort?')) return;
        sb.from(b.dataset.del).delete().eq('id', b.dataset.id).then(function (x) {
          if (!x.error && b.dataset.path) sb.storage.from('portal-invoices').remove([b.dataset.path]);
          done(x, 'Borttagen');
        });
      });
      // upload: pick files or drop them on the box; each file becomes an invoice the customer can download
      var drop = $('#pt-drop'), prog = $('#pt-prog');
      var upload = function (files) {
        ptUploadFiles(id, files, drop.querySelector('[name="upstatus"]').value, function (t) { prog.textContent = t; }).then(function (res) {
          prog.textContent = '';
          toast(res.ok + (res.ok === 1 ? ' faktura uppladdad' : ' fakturor uppladdade') + (res.bad.length ? ', ' + res.bad.length + ' misslyckades' : ''));
          ptOpen(id);
          if (res.bad.length) setTimeout(function () { var t = $('#pt-invbox'); if (t) t.insertAdjacentHTML('afterbegin', ptBad(res.bad)); }, 600);
        });
      };
      $('#pt-files').addEventListener('change', function () { upload(this.files); this.value = ''; });
      ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('is-over'); }); });
      ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('is-over'); }); });
      drop.addEventListener('drop', function (e) { upload(e.dataTransfer && e.dataTransfer.files); });
    });
  }

  /* ---------- AI-assistent ---------- */
  function renderAI() {
    main().innerHTML = head('AI-assistent', 'Fråga om leads, skriv mejl och få förslag.') +
      '<section class="panel hero-note"><div class="star">' + ICON.spark + '</div><h3>Behöver en server för att svara</h3>' +
      '<p>AI-assistenten anropar en AI-modell med en hemlig nyckel. En sådan nyckel får aldrig ligga på en hemsida, där kan vem som helst läsa den. I den gamla admin låg nyckeln hos Lovable.</p>' +
      '<p>När ni har en egen server (t.ex. en Supabase Edge Function) kopplar vi in den här. Allt annat i admin fungerar redan utan.</p>' +
      '<p class="muted">Under tiden: AI-minnet nedan går att fylla på, så är det redo.</p><button class="btn btn--ghost" id="tomem">' + ICON.brain + 'Gå till AI-minne</button></section>';
    $('#tomem').addEventListener('click', function () { go('minne'); });
  }

  /* ---------- Insikter ---------- */
  function renderInsights() {
    var L = st.leads, sold = L.filter(function (l) { return l.status === 'sold'; });
    var total = sold.reduce(function (s, l) { return s + Number(l.sold_amount || 0); }, 0);
    var months = []; for (var i = 5; i >= 0; i--) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(d); }
    var perMonth = months.map(function (m) {
      var n = L.filter(function (l) { var c = new Date(l.created_at); return c.getFullYear() === m.getFullYear() && c.getMonth() === m.getMonth(); }).length;
      return [m.toLocaleDateString('sv-SE', { month: 'short', year: '2-digit' }), n];
    });
    var max = Math.max.apply(null, perMonth.map(function (p) { return p[1]; }).concat([1]));
    var funnel = STATUS.map(function (s) { return [s[1], L.filter(function (l) { return (l.status || 'new') === s[0]; }).length]; }).filter(function (p) { return p[1]; });
    main().innerHTML = head('Insikter', 'Räknat direkt från era leads.') +
      kpis([['Leads totalt', L.length], ['Sålda', sold.length], ['Konvertering', L.length ? (sold.length / L.length * 100).toFixed(1).replace('.', ',') + ' %' : '–'], ['Snittaffär', sold.length ? kr(total / sold.length) : '–']]) +
      '<section class="panel"><h3>Nya leads per månad</h3><div class="cols">' + perMonth.map(function (p) { return '<div tabindex="0"><i data-tip="' + p[0] + ': ' + p[1] + '" style="--h:' + Math.round(p[1] / max * 100) + '%"></i><b>' + p[1] + '</b><span>' + p[0] + '</span></div>'; }).join('') + '</div></section>' +
      '<div class="split">' + bars('Status just nu', funnel, L.length) + bars('Branscher', countBy(L, function (l) { return l.service_type; }), L.length) +
      bars('Typ av förfrågan', countBy(L, function (l) { return MEETING[l.meeting_type] || l.meeting_type; }), L.length) + bars('Paket', countBy(L, function (l) { return l.selected_package; }), L.length) + '</div>';
  }

  /* ---------- Ekonomi ---------- */
  function renderEconomy() {
    var y = new Date().getFullYear(), start = new Date(y, 0, 1).toISOString();
    var income = st.leads.filter(function (l) { return l.status === 'sold' && l.sold_at && l.sold_at >= start; }).reduce(function (s, l) { return s + Number(l.sold_amount || 0); }, 0);
    main().innerHTML = head('Ekonomi', 'Intäkter från sålda affärer och era kostnader ' + y + '.', '<button class="btn" id="add">+ Ny kostnad</button>');
    $('#add').addEventListener('click', function () {
      formDialog('Ny kostnad', 'Belopp exklusive moms.', [
        { name: 'vendor', label: 'Leverantör', required: true }, { name: 'category', label: 'Kategori', value: 'Programvara', required: true },
        { name: 'amount_sek', label: 'Belopp (kr)', type: 'number', required: true }, { name: 'vat_sek', label: 'Moms (kr)', type: 'number' },
        { name: 'spent_at', label: 'Datum', type: 'date', value: new Date().toISOString().slice(0, 10), required: true }, { name: 'description', label: 'Beskrivning' }
      ], function (v) {
        v.amount_sek = Number(v.amount_sek); v.vat_sek = v.vat_sek == null ? null : Number(v.vat_sek);
        return sb.from('cfo_expenses').insert(Object.assign(v, { user_id: st.user.id }));
      });
    });
    fetchRows(sb.from('cfo_expenses').select('id,amount_sek,category,spent_at,vendor,description,vat_sek').gte('spent_at', start.slice(0, 10)).order('spent_at', { ascending: false }), function (rows) {
      var cost = rows.reduce(function (s, e) { return s + Number(e.amount_sek || 0); }, 0), vat = rows.reduce(function (s, e) { return s + Number(e.vat_sek || 0); }, 0);
      var cat = {}; rows.forEach(function (e) { cat[e.category] = (cat[e.category] || 0) + Number(e.amount_sek || 0); });
      main().insertAdjacentHTML('beforeend', kpis([['Intäkter i år', kr(income)], ['Kostnader i år', kr(cost)], ['Resultat', kr(income - cost)], ['Ingående moms', kr(vat)]]) +
        '<p class="muted small">Intäkterna räknas från sålda leads (beloppet ni skrev in). Exakta siffror finns i bokföringen.</p>' +
        '<div id="ex">' + table([['Datum', function (e) { return esc(e.spent_at); }], ['Leverantör', function (e) { return '<b>' + esc(e.vendor || '–') + '</b>' + (e.description ? '<br><span class="muted">' + esc(e.description) + '</span>' : ''); }],
          ['Kategori', function (e) { return '<span class="tag">' + esc(e.category) + '</span>'; }], ['Belopp', function (e) { return kr(e.amount_sek); }],
          ['', function (e) { return '<button class="iconbtn iconbtn--sm" data-del="' + e.id + '" aria-label="Ta bort">' + ICON.x + '</button>'; }]], rows) + '</div>');
      $('#ex').addEventListener('click', function (e) {
        var b = e.target.closest('[data-del]'); if (!b || !confirm('Ta bort kostnaden?')) return;
        sb.from('cfo_expenses').delete().eq('id', b.dataset.del).then(function (r) { if (r.error) return toast(r.error.message); render(); });
      });
    });
  }

  /* ---------- AI-minne ---------- */
  function renderMemory() {
    main().innerHTML = head('AI-minne', 'Fakta som AI:n ska komma ihåg om Elevate och hur ni jobbar.', '<button class="btn" id="add">+ Lägg till</button>');
    $('#add').addEventListener('click', function () {
      formDialog('Nytt minne', 'Skriv en sak per minne, t.ex. "Vi svarar alltid inom en arbetsdag."', [
        { name: 'content', label: 'Innehåll', type: 'textarea', required: true }, { name: 'scope', label: 'Gäller', options: SCOPE, value: 'foretag' }
      ], function (v) { return sb.from('ai_memory').insert(Object.assign(v, { approved: true, created_by: st.user.id })); });
    });
    fetchRows(sb.from('ai_memory').select('id,content,scope,source,approved,created_at').order('created_at', { ascending: false }), function (rows) {
      main().insertAdjacentHTML('beforeend', '<div id="mm">' + Object.keys(SCOPE).map(function (k) {
        var list = rows.filter(function (m) { return m.scope === k; });
        return '<section class="panel"><h3>' + SCOPE[k] + ' <em class="muted">' + list.length + '</em></h3>' + (list.map(function (m) {
          return '<div class="mem' + (m.approved ? '' : ' is-off') + '"><p>' + esc(m.content) + '</p><div><span class="muted small">' + (m.source === 'ai_proposed' ? 'Föreslaget av AI' : 'Manuellt') + ' · ' + day(m.created_at) + '</span>' +
            '<label class="switch" title="Godkänd"><input type="checkbox" data-ok="' + m.id + '"' + (m.approved ? ' checked' : '') + '><i></i></label>' +
            '<button class="iconbtn iconbtn--sm" data-del="' + m.id + '" aria-label="Ta bort">' + ICON.x + '</button></div></div>';
        }).join('') || '<p class="muted">Inget här än.</p>') + '</section>';
      }).join('') + '</div>');
      var mm = $('#mm');
      mm.addEventListener('change', function (e) {
        var id = e.target.dataset.ok; if (!id) return;
        sb.from('ai_memory').update({ approved: e.target.checked }).eq('id', id).then(function (r) { if (r.error) return toast(r.error.message); e.target.closest('.mem').classList.toggle('is-off', !e.target.checked); });
      });
      mm.addEventListener('click', function (e) {
        var b = e.target.closest('[data-del]'); if (!b || !confirm('Ta bort minnet?')) return;
        sb.from('ai_memory').delete().eq('id', b.dataset.del).then(function (r) { if (r.error) return toast(r.error.message); render(); });
      });
    });
  }

  /* ---------- Integrationer ---------- */
  function renderIntegrations() {
    var items = [
      ['Databas (Supabase)', 'Leads, kontakter, kalender, ekonomi och AI-minne.', 'on', 'Ansluten'],
      ['Kontaktformulär', 'Förfrågningar från hemsidan hamnar som leads här.', 'on', 'Ansluten'],
      ['Offert-PDF', 'Skapas direkt i webbläsaren, samma som på hemsidan.', 'on', 'Fungerar'],
      ['Mejl från info@ (Brevo)', 'Bekräftelse till kunden, avisering till info@ och recensionsmejl, i den gröna designen.', root.dataset.mail ? 'on' : 'off', root.dataset.mail ? 'Ansluten' : 'Väntar på Brevo'],
      ['Nyhetsbrev (Brevo)', 'Anmälningar från hemsidan läggs i listan. Utskick görs i Brevo från info@.', root.dataset.mail ? 'on' : 'off', root.dataset.mail ? 'Ansluten' : 'Väntar på Brevo'],
      ['Gmail (' + GMAIL + ')', 'Mötesinbjudningar skickas härifrån, med kalenderfil.', 'gmail', 'Kollar …'],
      ['Google Kalender & Meet', 'Bokade Google Meet-möten hamnar i Elevates Google Kalender och får en Meet-länk automatiskt.', 'google', 'Kollar …'],
      ['SMS (GatewayAPI)', 'SMS-påminnelser till kund och team.', 'off', 'Kräver server'],
      ['Stripe', 'Skapa och skicka fakturor.', 'off', 'Kräver server'],
      ['AI-modell', 'AI-assistent och AI-förslag.', 'off', 'Kräver server']
    ];
    main().innerHTML = head('Integrationer', 'Vad admin är kopplad till.') +
      info('Varför vissa kräver server', 'Kopplingarna till SMS, Stripe och AI behöver hemliga nycklar. De kan inte ligga på en vanlig hemsida. I den gamla admin låg de hos Lovable. Vill ni ha tillbaka dem byggs en liten server (t.ex. Supabase Edge Functions) som admin anropar.') +
      '<div class="cards">' + items.map(function (i) {
        return '<article class="cardx"><h3>' + i[0] + '</h3><p>' + i[1] + '</p><footer><span class="pill pill--' + i[2] + '"' + (i[2] === 'gmail' || i[2] === 'google' ? ' id="' + i[2] + '-pill"' : '') + '>' + i[3] + '</span>' +
          (i[2] === 'google' ? ' <a class="btn btn--ghost btn--sm" id="google-connect" href="/api/google/connect" hidden>Koppla Google</a>' : '') + '</footer></article>';
      }).join('') + '</div>';
    fetch('/api/status').then(function (r) { return r.json(); }).then(function (st) {
      var pill = $('#gmail-pill'); if (!pill) return;
      pill.className = 'pill pill--' + (st.gmail ? 'on' : 'off');
      pill.textContent = st.gmail ? 'Ansluten' : 'Lösenord saknas i Cloudflare';
      var g = $('#google-pill'); if (!g) return;
      g.className = 'pill pill--' + (st.google ? 'on' : 'off'); g.textContent = st.google ? 'Ansluten' : 'Inte kopplat – videolänkar via Jitsi tills vidare';
      $('#google-connect').hidden = !!st.google;
    }).catch(function () { var pill = $('#gmail-pill'); if (pill) { pill.className = 'pill pill--off'; pill.textContent = 'Kan inte nås här'; } });
  }

  /* ---------- Konto ---------- */
  function renderAccount() {
    main().innerHTML = head('Mitt konto', 'Byt e-post och lösenord för din inloggning. Teamets konton finns under Konton.') +
      '<div class="split split--2"><section class="panel"><h3>E-post</h3><p class="panel__sub">Nu: <b>' + esc(st.user.email) + '</b></p><form id="em">' +
      '<label class="field">Ny e-post<input class="input" type="email" name="email" placeholder="info@elevatestudio.nu" required></label>' +
      '<button class="btn" type="submit">Byt e-post</button><p class="msg ok" id="em-msg"></p></form>' +
      '<p class="muted small">En bekräftelselänk skickas till den nya adressen. Bytet gäller först när ni klickat på den.</p></section>' +
      '<section class="panel"><h3>Lösenord</h3><form id="pw">' +
      '<label class="field">Nytt lösenord (' + PW_RULE + ')<input class="input" type="password" name="pw" minlength="12" autocomplete="new-password" required></label>' +
      '<label class="field">Upprepa lösenordet<input class="input" type="password" name="pw2" minlength="12" autocomplete="new-password" required></label>' +
      '<button class="btn" type="submit">Byt lösenord</button><p class="msg ok" id="pw-msg"></p></form>' +
      '<p class="muted small">Tips: tre vanliga ord ihop med en siffra är lätt att komma ihåg och svårt att gissa.</p></section>' +
      '<section class="panel"><h3>Tvåstegsverifiering</h3><div id="mfa-box"><p class="panel__sub">Kollar …</p></div></section></div>';
    renderTwoStep();
    $('#em').addEventListener('submit', function (e) {
      e.preventDefault(); var m = $('#em-msg');
      sb.auth.updateUser({ email: e.target.email.value.trim() }, { emailRedirectTo: location.href.split('#')[0] }).then(function (r) {
        m.textContent = r.error ? r.error.message : 'Klart. Öppna mejlet som skickats till den nya adressen och klicka på länken för att bekräfta.';
      });
    });
    $('#pw').addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target, m = $('#pw-msg');
      if (f.pw.value !== f.pw2.value) { m.textContent = 'Lösenorden är inte likadana.'; return; }
      var bad = weakPw(f.pw.value, st.user.email); if (bad) { m.textContent = bad; return; }
      sb.auth.updateUser({ password: f.pw.value }).then(function (r) {
        if (r.error) { m.textContent = r.error.message; return; }
        f.reset(); m.textContent = 'Lösenordet är bytt. Använd det nya nästa gång du loggar in.';
      });
    });
  }

  // Two-step verification with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password …).
  // Once it is on, the database lets this account read nothing until the code has been given (supabase/sql/2026-11-23_sakerhet.sql).
  function renderTwoStep(message) {
    var box = $('#mfa-box'); if (!box) return;
    if (!sb.auth.mfa) { box.innerHTML = '<p class="panel__sub">Finns inte i den här versionen.</p>'; return; }
    sb.auth.mfa.listFactors().then(function (r) {
      var all = (r.data && r.data.all) || [], on = all.filter(function (x) { return x.factor_type === 'totp' && x.status === 'verified'; })[0];
      if (on) {
        box.innerHTML = '<p class="panel__sub"><span class="pill pill--on">På</span> Inloggningen kräver en kod från appen.</p>' +
          '<button class="btn btn--ghost" type="button" id="mfa-off">Stäng av</button><p class="msg ok" id="mfa-msg">' + esc(message || '') + '</p>';
        $('#mfa-off').addEventListener('click', function () {
          if (!confirm('Stänga av tvåstegsverifieringen? Då räcker lösenordet för att logga in.')) return;
          sb.auth.mfa.unenroll({ factorId: on.id }).then(function (x) { if (x.error) { $('#mfa-msg').textContent = x.error.message; return; } return sb.auth.refreshSession().then(function () { renderTwoStep('Avstängd.'); }); });
        });
        return;
      }
      box.innerHTML = '<p class="panel__sub">Av. Slå på så krävs en kod från en autentiseringsapp i mobilen varje gång du loggar in, även om någon får tag i lösenordet.</p>' +
        '<button class="btn" type="button" id="mfa-on">Slå på</button><p class="msg ok" id="mfa-msg">' + esc(message || '') + '</p>';
      $('#mfa-on').addEventListener('click', function () {
        // half-finished set-ups are removed first, so a new QR code can be made
        var old = all.filter(function (x) { return x.status !== 'verified'; });
        Promise.all(old.map(function (x) { return sb.auth.mfa.unenroll({ factorId: x.id }); })).then(function () {
          return sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Elevate admin ' + new Date().toISOString().slice(0, 16) });
        }).then(function (x) {
          if (x.error) { $('#mfa-msg').textContent = 'Det gick inte att slå på: ' + x.error.message; return; }
          var d = x.data;
          box.innerHTML = '<p class="panel__sub">1. Skanna koden med autentiseringsappen.</p><img src="' + esc(d.totp.qr_code) + '" alt="QR-kod för autentiseringsappen" width="180" height="180" style="background:#fff;border-radius:12px;padding:8px">' +
            '<p class="muted small">Går det inte att skanna: skriv in nyckeln <code>' + esc(d.totp.secret) + '</code> i appen.</p>' +
            '<form id="mfa-verify"><label class="field">2. Skriv koden som visas i appen<input class="input" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>' +
            '<button class="btn" type="submit">Bekräfta och slå på</button><p class="msg" id="mfa-msg"></p></form>';
          $('#mfa-verify').addEventListener('submit', function (e) {
            e.preventDefault();
            sb.auth.mfa.challengeAndVerify({ factorId: d.id, code: e.target.code.value.trim() }).then(function (v) {
              if (v.error) { $('#mfa-msg').textContent = 'Koden stämmer inte. Försök igen med koden som visas nu.'; return; }
              renderTwoStep('Klart. Nästa gång du loggar in frågar sidan efter en kod från appen.');
            });
          });
        });
      });
    }, function () { box.innerHTML = '<p class="panel__sub">Kunde inte läsas just nu.</p>'; });
  }

  /* A login for a team member: the server opens it right away when the Supabase key is in Cloudflare,
     otherwise the ordinary sign-up with a confirmation mail */
  function createLogin(p) {
    var first = p[1].split(' ')[0];
    dialog('<form id="cl"><h2>Öppna konto för ' + esc(first) + '</h2><p>Skriv lösenordet ' + esc(first) + ' ska logga in med. Det går att byta sedan under Mitt konto.</p>' +
      form([{ name: 'email', label: 'E-post', type: 'email', value: p[2], required: true }]) +
      '<label class="field">Lösenord (' + PW_RULE + ')<input class="input" type="password" name="pw" minlength="12" autocomplete="new-password" required></label>' +
      '<label class="field">Upprepa lösenordet<input class="input" type="password" name="pw2" minlength="12" autocomplete="new-password" required></label>' +
      '<p class="msg" id="cl-msg"></p><div class="dlg__row"><button type="button" class="btn btn--ghost" data-close>Avbryt</button><button class="btn" type="submit">Öppna kontot</button></div></form>', function (d) {
      $('#cl', d).addEventListener('submit', function (e) {
        e.preventDefault(); var f = e.target, m = $('#cl-msg', d), btn = $('button[type=submit]', d);
        if (f.pw.value !== f.pw2.value) { m.textContent = 'Lösenorden är inte likadana.'; return; }
        var bad = weakPw(f.pw.value, f.email.value); if (bad) { m.textContent = bad; return; }
        btn.disabled = true; btn.textContent = 'Öppnar …';
        var email = f.email.value.trim(), pw = f.pw.value;
        var fallback = function () {
          // A separate client, so the signed-in session in this window stays as it is
          var other = window.supabase.createClient(root.dataset.url, root.dataset.key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'elevate-new-login' } });
          other.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: location.origin + '/admin/', data: { full_name: p[1] } } }).then(function (r) {
            if (r.error) throw r.error;
            var u = r.data && r.data.user;
            if (!u || !u.identities || !u.identities.length) return 'exists';
            return sb.from('user_roles').insert({ user_id: u.id, role: 'admin' }).then(function (x) { return x.error ? 'norole' : 'ok'; });
          }).then(function (how) {
            f.pw.value = f.pw2.value = '';
            if (how === 'exists') { btn.disabled = false; btn.textContent = 'Öppna kontot'; m.textContent = 'Den e-posten har redan en inloggning. Personen kan sätta ett nytt lösenord med Glömt lösenord på inloggningssidan.'; return; }
            d.remove();
            toast(how === 'ok' ? 'Inloggningen är skapad. ' + first + ' får ett mejl att bekräfta, sedan går det att logga in.' : 'Kontot är skapat, men behörigheten kunde inte läggas in. Säg till, så läggs den in.');
          }).catch(function (err) { btn.disabled = false; btn.textContent = 'Öppna kontot'; m.textContent = err.message; });
        };
        sb.auth.getSession().then(function (r) {
          var token = r.data && r.data.session && r.data.session.access_token;
          return fetch('/api/accounts/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ email: email, password: pw, name: p[1] }) });
        }).then(function (res) { return res.json().catch(function () { return {}; }).then(function (b) { return { ok: res.ok, b: b }; }); }, function () { return { ok: false, b: { error: 'net' } }; })
          .then(function (x) {
            if (x.ok) { f.pw.value = f.pw2.value = ''; d.remove(); return toast((x.b.how === 'updated' ? 'Kontot är öppnat med det nya lösenordet. ' : 'Kontot är öppnat. ') + first + ' kan logga in direkt.' + (x.b.role ? '' : ' Behörigheten kunde inte läggas in – säg till.')); }
            if (x.b.error === 'no_service_key' || x.b.error === 'net') return fallback();
            btn.disabled = false; btn.textContent = 'Öppna kontot'; m.textContent = x.b.error === 'exists' ? 'Kontot finns redan men kunde inte uppdateras.' : 'Det gick inte: ' + x.b.error;
          });
      });
    });
  }

  var PAGES = {
    todo: renderTodo, hemsidan: renderWeb, leads: renderLeads, vunna: renderWon, arkiv: renderArchive, statistik: renderStats, konton: renderAccounts, import: renderImport,
    kalender: renderCalendar, kontakter: renderContacts, fakturor: renderInvoices, utskick: renderCampaigns, segment: renderSegments,
    lage: renderHealth, besokare: renderVisitors, sokord: renderSearch, recensioner: renderReviews, chatten: renderChat, sajttester: renderSiteTests, bestallningar: renderOrders, nyhetsbrev: renderNewsletter, kundportal: renderPortal, ai: renderAI, insikter: renderInsights, ekonomi: renderEconomy,
    minne: renderMemory, integrationer: renderIntegrations, konto: renderAccount
  };

  // After clicking the reset link in the e-mail: choose a new password
  function renderNewPassword() {
    root.innerHTML = '<div class="login"><aside class="login__side"><span class="brand">' + MARK + 'Elevate Studio</span><div><h1>Nytt <span class="serif">lösenord.</span></h1></div><p>elevatestudio.nu</p><span class="login__big">' + MARK + '</span></aside>' +
      '<div class="login__form"><form class="login__card" id="newpw"><h2>Välj nytt lösenord</h2><label class="field">Nytt lösenord (' + PW_RULE + ')<input class="input" type="password" name="pw" minlength="12" autocomplete="new-password" required></label>' +
      '<button class="btn btn--block" type="submit">Spara lösenord</button><p class="msg" id="pw-msg"></p></form></div></div>';
    $('#newpw').addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = weakPw(e.target.pw.value); if (bad) { $('#pw-msg').textContent = bad; return; }
      sb.auth.updateUser({ password: e.target.pw.value }).then(function (r) {
        if (r.error) { $('#pw-msg').textContent = r.error.message; return; }
        history.replaceState(null, '', location.pathname);
        gate(r.data.user);
      });
    });
  }
  var recovering = /type=recovery/.test(location.hash);
  sb.auth.onAuthStateChange(function (event) { if (event === 'PASSWORD_RECOVERY') { recovering = true; renderNewPassword(); } });

  /* ---------- Start ---------- */
  sb.auth.getSession().then(function (r) {
    var u = r.data && r.data.session && r.data.session.user;
    if (recovering) return renderNewPassword();
    if (u) gate(u); else renderLogin();
  });
})();
