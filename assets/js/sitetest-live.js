/* Testa din sajt: while the test runs, a browser window replays what our test robot (a real browser at Cloudflare,
   /api/preview) did on the tested site: it opens the start page, reads the big heading, points at the menu, finds the
   phone number, scrolls down past the buttons, clicks through to the contact page the way a customer would, and
   clicks into the form. A yellow frame shows what it looks at, a big caption says it in plain words, and the step
   list ticks off what it found. Everything shown comes from the robot's own visit (labels, texts, load times):
   nothing is invented. When the robot cannot open the site, the site is shown live in a frame if it allows that,
   and the steps say only what is true. */
(function () {
  var box = document.getElementById('stlive');
  if (!box) return;
  var $ = function (s) { return box.querySelector(s); };
  var screen = $('.stlive__screen'), pageEl = $('.stlive__page'), img = pageEl.querySelector('img');
  var cur = $('.stlive__cursor'), ring = $('.stlive__ring'), hl = $('.stlive__hl'), chip = $('.stlive__chip');
  var badge = $('.stlive__badge'), sb = $('.stlive__sb i'), hint = $('.stlive__hint'), load = $('.stlive__load');
  var say = $('.stlive__say'), addr = $('.stlive__addr'), stepsEl = $('.stlive__steps'), backBtn = box.querySelector('.stlive__btns svg');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pending = false, measured = false, started = 0, touring = false, deep = false, run = 0, timers = [], page = null, scale = 1, scrollPx = 0, curX = 0, curY = 0, frame = null, host = '';
  var home = box.parentNode, homeNext = box.nextSibling; // the quick test's progress box; the deep test borrows the window

  /* ---------- small helpers ---------- */
  function sleep(ms, id) { return new Promise(function (ok) { timers.push(setTimeout(function () { ok(id === run); }, reduced ? Math.min(ms, 300) : ms)); }); }
  function clear() { timers.forEach(clearTimeout); timers = []; }
  function q(s) { return '”' + String(s).replace(/\.+$/, '') + '”'; } // a heading's own full stop is left out, so the sentence does not get two
  function sec(ms) { return (Math.max(ms, 100) / 1000).toFixed(1).replace('.', ',') + ' sekunder'; }
  function W() { return screen.clientWidth; }
  function H() { return screen.clientHeight; }
  function talk(t) {
    say.classList.add('is-out');
    timers.push(setTimeout(function () { say.textContent = t; say.classList.remove('is-out'); }, 180));
  }
  function setAddr(url) {
    var u; try { u = new URL(url); } catch (e) { addr.textContent = url; return; }
    var path = (u.pathname + u.search).replace(/\/$/, '');
    addr.innerHTML = ''; var b = document.createElement('b'); b.textContent = u.host.replace(/^www\./, ''); addr.appendChild(b);
    if (path) addr.appendChild(document.createTextNode(path));
  }

  function typeAddr(url) { // the address changes the way it does in a browser after a click
    var u; try { u = new URL(url); } catch (e) { setAddr(url); return; }
    var path = (u.pathname + u.search).replace(/\/$/, ''), n = 0;
    setAddr(u.origin);
    var tick = function () { if (n >= path.length) return; n = Math.min(path.length, n + 2); setAddr(u.origin + path.slice(0, n)); timers.push(setTimeout(tick, 45)); };
    tick();
  }

  /* ---------- the step list ---------- */
  var STEPS = {
    open: 'Öppnar startsidan', cookie: 'Kollar cookie-rutan', h1: 'Läser den stora rubriken', menu: 'Kollar menyn', contact: 'Letar efter telefon och e-post',
    scroll: 'Scrollar igenom sidan', click: 'Klickar runt på sajten, som en kund', form: 'Kollar kontaktformuläret', speed: 'Mäter snabbheten med Googles test'
  };
  function steps(list) {
    stepsEl.innerHTML = '';
    list.forEach(function (item, i) {
      var k = typeof item === 'string' ? item : item[0], title = typeof item === 'string' ? STEPS[item] : item[1];
      var li = document.createElement('li'); li.dataset.k = k;
      li.innerHTML = '<span class="stlive__no">' + (i < 9 ? '0' : '') + (i + 1) + '</span><span><b></b><small></small></span>';
      li.querySelector('b').textContent = k === 'speed' && deep ? 'Djupanalys av hela sajten' : title; stepsEl.appendChild(li);
    });
  }
  function step(k, state, detail) {
    var li = stepsEl.querySelector('[data-k="' + k + '"]'); if (!li) return;
    li.className = 'is-' + state;
    li.querySelector('small').textContent = detail || '';
  }

  /* ---------- the window: cursor, yellow frame, click, scroll, page change ---------- */
  function px(t) { return { x: t.x * scale, y: t.y * scale - scrollPx }; }
  function moveTo(x, y) {
    cur.classList.remove('is-hand');
    curX = Math.max(6, Math.min(W() - 10, x)); curY = Math.max(6, Math.min(H() - 10, y));
    cur.style.transform = 'translate(' + curX + 'px,' + curY + 'px)';
    cur.classList.toggle('is-left', curX > W() - 120);
  }
  function frameOn(t, label) {
    var bw = (t.bw || 140) * scale, bh = (t.bh || 40) * scale, p = px(t), pad = 6;
    var l = Math.max(2, p.x - bw / 2 - pad), tp = Math.max(2, p.y - bh / 2 - pad);
    hl.style.left = l + 'px'; hl.style.top = tp + 'px';
    hl.style.width = Math.max(24, Math.min(W() - l - 2, bw + pad * 2)) + 'px'; hl.style.height = Math.max(20, Math.min(H() - tp - 2, bh + pad * 2)) + 'px';
    hl.classList.toggle('is-top', tp < 34); hl.classList.toggle('is-right', l > W() * 0.62);
    chip.textContent = label; hl.classList.add('is-on');
  }
  function frameOff() { hl.classList.remove('is-on'); }
  function flag(text, warn, t) {
    var p = t ? px(t) : { x: W() / 2, y: H() / 2 }, half = t && t.bh ? t.bh * scale / 2 : 15;
    badge.textContent = text; badge.classList.toggle('is-warn', !!warn);
    // above the element when there is room; otherwise below it, to the left of the robot's name tag
    var bwid = Math.min(W() - 16, text.length * 8.4 + 30), x = p.x - bwid / 2, y = p.y - half - 50;
    if (y < 8) { y = p.y + half + 16; x = p.x - bwid - 18; }
    badge.style.left = Math.max(8, Math.min(W() - bwid - 8, x)) + 'px'; badge.style.top = Math.max(8, Math.min(H() - 40, y)) + 'px';
    badge.classList.add('is-on');
    timers.push(setTimeout(function () { badge.classList.remove('is-on'); }, 2600));
  }
  function press() {
    cur.classList.add('is-down'); timers.push(setTimeout(function () { cur.classList.remove('is-down'); }, 200));
    ring.style.left = curX + 'px'; ring.style.top = curY + 'px'; ring.classList.remove('is-on'); void ring.offsetWidth; ring.classList.add('is-on');
  }
  function maxScroll() { return Math.max(0, pageEl.offsetHeight - H()); }
  function bar() {
    var total = pageEl.offsetHeight || 1, h = Math.max(12, Math.min(100, H() / total * 100));
    sb.style.height = h + '%'; sb.style.top = (maxScroll() ? scrollPx / maxScroll() * (100 - h) : 0) + '%';
  }
  // scroll the page in the window, and say so while it scrolls
  function scrollTo(target, id) {
    var to = Math.max(0, Math.min(maxScroll(), target));
    if (Math.abs(to - scrollPx) < 8) return Promise.resolve(id === run);
    hint.textContent = to > scrollPx ? 'Scrollar ner ↓' : 'Scrollar upp ↑'; hint.classList.add('is-on');
    scrollPx = to; pageEl.style.transform = 'translateY(' + (-scrollPx) + 'px)'; bar();
    return sleep(1400, id).then(function (ok) { hint.classList.remove('is-on'); return ok; });
  }
  function into(t, id) { // make sure a target is on screen before pointing at it
    var y = t.y * scale;
    if (y - scrollPx > H() * 0.8 || y - scrollPx < H() * 0.12) return scrollTo(y - H() * 0.42, id);
    return Promise.resolve(id === run);
  }
  function point(t, id) {
    var p = px(t); moveTo(p.x, p.y);
    var clickable = /^(nav|button|contact|form|link)$/.test(t.kind || 'link');
    timers.push(setTimeout(function () { cur.classList.toggle('is-hand', clickable); }, 700));
    return sleep(950, id);
  }
  function busy(on) { load.classList.remove('is-done'); load.classList.toggle('is-busy', !!on); }
  function done() { load.classList.remove('is-busy'); load.classList.add('is-done'); timers.push(setTimeout(function () { load.classList.remove('is-done'); }, 700)); }
  function show(p, id) { // put a page (the start page or the next one) into the window
    return new Promise(function (ok) {
      page = p; scale = W() / p.w;
      pageEl.classList.add('is-away');
      timers.push(setTimeout(function () {
        img.onload = function () {
          scrollPx = 0; pageEl.style.transition = 'none'; pageEl.style.transform = 'translateY(0)'; void pageEl.offsetWidth; pageEl.style.transition = '';
          box.classList.add('has-shot'); pageEl.classList.remove('is-away'); bar(); if (p.url) setAddr(p.url); done();
          ok(id === run);
        };
        img.src = p.img;
      }, 350));
    });
  }

  /* ---------- the replay of the robot's visit ---------- */
  // a single e-mail field is a newsletter sign-up, not a way to send an enquiry
  function newsletter(ff) { return !!ff && ff.fields <= 2 && /mail|e-post|epost|nyhetsbrev|newsletter|prenumer/i.test(ff.first || ''); }
  function first(list, kind, test) { for (var i = 0; i < list.length; i++) if (list[i].kind === kind && (!test || test(list[i]))) return list[i]; return null; }
  var CHIP = { cookie: 'Cookie-ruta', nav: 'Meny', button: 'Knapp', heading: 'Rubrik', img: 'Bild', form: 'Formulär', contact: 'Kontakt' };

  async function replay(d, id) {
    touring = true;
    try { await replayInner(d, id); } finally { if (id === run) touring = false; }
  }
  async function replayInner(d, id) {
    var f = d.facts || {}, ts = d.targets || [], next = d.pages && d.pages[0];
    var ck = first(ts, 'cookie');
    var pageRows = (d.pages || []).slice(0, 5).map(function (p, i) { return ['p' + (i + 1), 'Sida ' + (i + 2) + ': ' + q((p.via && p.via.label) || p.label || 'nästa sida')]; });
    steps(['open'].concat(ck ? ['cookie'] : [], ['h1', 'menu', 'contact', 'scroll'], pageRows.length ? pageRows : ['click'], ['form', 'speed']));
    if (measured) step('speed', 'ok', 'Klar – resultatet visas efter genomgången'); else step('speed', 'now', deep ? 'Djupanalysen pågår i bakgrunden – tar några minuter' : 'Pågår i bakgrunden – tar oftast 20–40 sekunder');
    step('open', 'now');
    if (!(await show(d, id))) return;
    step('open', 'ok', d.shownMs ? 'Sidan visades efter ' + sec(d.shownMs) + ' i testrobotens webbläsare' : 'Sidan är öppnad');
    moveTo(W() * 0.5, H() * 0.55);
    talk('Startsidan är öppen. Nu går testroboten igenom den precis som en besökare skulle göra.');
    if (!(await sleep(1800, id))) return;

    // 0. a cookie banner on top of the page: can the visitor say no as easily as yes?
    if (ck) {
      step('cookie', 'now');
      if (!(await into(ck, id)) || !(await point(ck, id))) return;
      frameOn(ck, 'Cookie-ruta');
      var canSayNo = f.cookie && f.cookie.reject;
      talk('En cookie-ruta dyker upp. Går det att säga nej lika lätt som ja?');
      if (!(await sleep(2800, id))) return;
      flag(canSayNo ? 'Går att neka' : 'Saknas: knapp för att neka', !canSayNo, ck);
      talk(canSayNo ? 'Bra – det finns en knapp för att neka.' : 'Hittar ingen knapp för att neka – det krävs enligt lagen om kakor.');
      if (!(await sleep(2600, id))) return; frameOff();
      step('cookie', canSayNo ? 'ok' : 'warn', canSayNo ? 'Det går att neka' : 'Ingen tydlig knapp för att neka');
    }

    // 1. the big heading
    step('h1', 'now');
    var h = first(ts, 'heading', function (t) { return f.h1 && t.label && f.h1.indexOf(t.label.slice(0, 20)) === 0; }) || first(ts, 'heading');
    if (h) {
      if (!(await into(h, id)) || !(await point(h, id))) return;
      frameOn(h, 'Rubrik'); talk('Läser den stora rubriken: ' + q(f.h1 || h.label) + '. Förstår man direkt vad ni gör?');
      if (!(await sleep(2600, id))) return;
      frameOff(); step('h1', 'ok', q(f.h1 || h.label));
    } else {
      talk('Letar efter en tydlig rubrik högst upp … hittar ingen.'); step('h1', 'warn', 'Ingen tydlig huvudrubrik på startsidan');
      if (!(await sleep(2200, id))) return;
    }

    // 2. the menu
    step('menu', 'now');
    var navs = ts.filter(function (t) { return t.kind === 'nav' && !/startsidan|^hem$|^home$/i.test(t.label); }).slice(0, 2);
    if (navs.length) {
      if (!(await scrollTo(0, id))) return;
      for (var i = 0; i < navs.length; i++) {
        if (!(await point(navs[i], id))) return;
        frameOn(navs[i], 'Meny'); talk('Pekar på menyvalet ' + q(navs[i].label) + ' – är det lätt att hitta rätt?');
        if (!(await sleep(1500, id))) return;
      }
      frameOff();
    }
    var title = (f.title || '').toLowerCase();
    var menu = (f.menu || []).filter(function (m) { return m.length < 12 || title.indexOf(m.toLowerCase()) < 0; });
    // on a phone the menu usually sits behind a menu button (☰)
    var burger = first(ts, 'button', function (t) { return /meny|menu/i.test(t.label); }) || first(ts, 'nav', function (t) { return /meny|menu/i.test(t.label); });
    if (!navs.length && burger) {
      if (!(await scrollTo(0, id)) || !(await point(burger, id))) return;
      frameOn(burger, 'Menyknapp'); talk('Menyn ligger bakom knappen ' + q(burger.label) + ' högst upp – så brukar det se ut på mobilen.');
      if (!(await sleep(3000, id))) return; frameOff();
    }
    if (menu.length > 1 || (menu.length && navs.length)) step('menu', 'ok', 'Menyn har ' + menu.length + ' val: ' + menu.slice(0, 5).join(', ') + (menu.length > 5 ? ' …' : ''));
    else if (burger) step('menu', 'ok', 'Menyknapp högst upp (' + burger.label + ')');
    else if (navs.length) step('menu', 'ok', 'Menyn syns');
    else { step('menu', 'warn', 'Ingen meny syns'); talk('Letar efter en meny … ingen syns på skärmen.'); if (!(await sleep(2000, id))) return; }

    // 3. phone and e-mail
    step('contact', 'now');
    var c = first(ts, 'contact');
    if (c) {
      if (!(await into(c, id)) || !(await point(c, id))) return;
      var tel = /\d{3}/.test(c.label);
      frameOn(c, tel ? 'Telefon' : 'E-post'); flag((tel ? 'Telefonnummer' : 'E-post') + ' hittat', false, c);
      talk('Hittade ' + (tel ? 'telefonnumret ' : 'e-postadressen ') + q(c.label) + '. Bra – kunden kan nå er direkt.');
      if (!(await sleep(3100, id))) return; frameOff();
    } else if (f.phone || f.email) {
      talk('Telefon eller e-post står i texten på sidan, men inte som en knapp man kan trycka på.');
      if (!(await sleep(2600, id))) return;
    } else {
      talk('Letar efter telefonnummer och e-post … hittar inga på startsidan.'); flag('Saknas: telefonnummer', true, null);
      if (!(await sleep(2800, id))) return;
    }
    step('contact', f.phone || f.email ? 'ok' : 'warn', [f.phone && 'Telefon: ' + f.phone, f.email && 'E-post: ' + f.email].filter(Boolean).join(' · ') || 'Varken telefon eller e-post syns på startsidan');

    // 4. scroll down the page, past the buttons and pictures
    step('scroll', 'now');
    var stops = ts.filter(function (t) { return (t.kind === 'button' || t.kind === 'img' || t.kind === 'heading') && t !== h && t.y * scale > H() * 0.6; }).slice(0, 2);
    for (var s = 0; s < stops.length; s++) {
      var t = stops[s];
      if (!(await into(t, id)) || !(await point(t, id))) return;
      frameOn(t, CHIP[t.kind]);
      talk(t.kind === 'button' ? 'Hittar knappen ' + q(t.label) + ' – syns den tydligt?' : t.kind === 'img' ? 'Tittar på bilden' + (t.label ? ' ' + q(t.label) : '') + ' – laddar den snabbt?' : 'Läser rubriken ' + q(t.label) + '.');
      if (!(await sleep(1900, id))) return;
    }
    frameOff();
    talk('Scrollar ända ner till slutet av sidan …');
    if (!(await scrollTo(maxScroll(), id))) return;
    if (!(await sleep(1000, id))) return;
    step('scroll', 'ok', f.images ? f.images + ' bilder' + (f.imagesNoAlt ? ', varav ' + f.imagesNoAlt + ' utan bildtext för Google' : ', alla med bildtext') : 'Hela sidan genomgången');

    // 5. click around the site, page by page, the way a customer would (up to five more pages, contact last)
    var pages = (d.pages || []).slice(0, 5), visited = [];
    if (pages.length) {
      for (var pi = 0; pi < pages.length; pi++) {
        var pg = pages[pi], v = pg.via, label = (v && v.label) || pg.label || 'nästa sida';
        step('p' + (pi + 1), 'now', 'Klickar sig dit …');
        if (v) {
          talk((pi ? 'Vidare: testroboten letar upp ' : 'Nu letar testroboten upp ') + q(label) + ' för att klicka vidare …');
          if (!(await into(v, id)) || !(await point(v, id))) return;
          frameOn(v, pg.contact ? 'Länk till kontakt' : 'Länk');
          talk('Klickar på ' + q(label) + ' – som en kund som vill ' + (pg.contact ? 'ta kontakt' : 'veta mer') + '.');
          if (!(await sleep(1500, id))) return;
          press(); frameOff();
          if (!(await sleep(400, id))) return;
        } else talk('Går till sidan ' + q(label) + ' …');
        busy(true); typeAddr(pg.url);
        if (!(await sleep(900, id))) return;
        if (!(await show(pg, id))) return;
        var name = pg.facts && pg.facts.h1 ? pg.facts.h1 : label;
        visited.push(label);
        step('p' + (pi + 1), 'ok', 'Öppnades' + (pg.shownMs ? ' på ' + sec(pg.shownMs) : '') + (pg.facts && pg.facts.h1 ? ' · rubrik: ' + q(pg.facts.h1) : ' · ingen huvudrubrik'));
        // a short look at each page: the heading, then a little way down
        var ph = first(pg.targets || [], 'heading');
        if (ph) { if (!(await into(ph, id)) || !(await point(ph, id))) return; frameOn(ph, 'Rubrik'); } else moveTo(W() * 0.5, H() * 0.4);
        talk('Nu är vi på sidan ' + q(name) + (pg.shownMs ? ' – den öppnades på ' + sec(pg.shownMs) : '') + '.');
        if (!(await sleep(1900, id))) return; frameOff();
        if (pi < pages.length - 1 && maxScroll() > H() * 0.3) {
          talk('Scrollar ner och tittar på sidan …');
          if (!(await scrollTo(Math.min(maxScroll(), H() * 0.9), id))) return;
          if (!(await sleep(700, id))) return;
        }
      }
      next = pages[pages.length - 1];
    } else { step('click', 'info', 'Hittade ingen länk att klicka vidare till'); next = null; }

    // 6. the form: click into the first field
    step('form', 'now');
    var where = next || d, fm = first(where.targets || [], 'form'), ff = (where.facts || {}).form;
    if (newsletter(ff)) { fm = null; ff = null; }
    if (!fm && next && first(ts, 'form') && !newsletter(f.form)) { // the form is on the start page: go back there, like a visitor would
      talk('Den här sidan har inget formulär. Testroboten går tillbaka till startsidan, där formuläret finns …');
      if (!(await sleep(2200, id))) return;
      if (backBtn) { var r = backBtn.getBoundingClientRect(), sr = screen.getBoundingClientRect(); moveTo(r.left - sr.left + 12, 4); }
      if (!(await sleep(950, id))) return;
      press(); if (backBtn) { backBtn.classList.add('is-press'); timers.push(setTimeout(function () { backBtn.classList.remove('is-press'); }, 300)); }
      busy(true); talk('Går tillbaka till startsidan …');
      if (!(await sleep(700, id))) return;
      if (!(await show(d, id))) return;
      where = d; fm = first(ts, 'form'); ff = f.form;
    }
    if (fm) {
      talk('Letar efter kontaktformuläret …');
      if (!(await into(fm, id)) || !(await point(fm, id))) return;
      frameOn(fm, 'Formulär'); press();
      talk('Klickar i fältet ' + q(fm.label || 'första fältet') + ' – går det att skriva och skicka en förfrågan?');
      if (!(await sleep(2900, id))) return;
      flag('Formulär med ' + (ff ? ff.fields : 'flera') + ' fält', false, fm);
      if (!(await sleep(1900, id))) return; frameOff();
      step('form', 'ok', 'Formulär med ' + (ff ? ff.fields + ' fält' : 'fält att fylla i'));
    } else if (newsletter(f.form) || newsletter((where.facts || {}).form)) {
      talk('Hittar bara ett fält för att prenumerera på nyhetsbrev – inget formulär där kunden kan skicka en förfrågan.');
      step('form', 'warn', 'Bara anmälan till nyhetsbrev, inget kontaktformulär');
      if (!(await sleep(3000, id))) return;
    } else if (next && ff && ff.fields) { // the page the robot ended on has a form, further down than its picture reaches
      var nm = (next.facts && next.facts.h1) || next.label || 'sista sidan';
      talk('Sidan ' + q(nm) + ' har ett kontaktformulär längre ner, med ' + ff.fields + ' fält' + (ff.first ? ' – det första är ' + q(ff.first) : '') + '.');
      step('form', 'ok', 'Formulär med ' + ff.fields + ' fält på sidan ' + q(nm));
      if (!(await sleep(3000, id))) return;
    } else if (f.form && f.form.fields) { // the start page has a form, further down than the robot's picture reaches
      talk('Startsidan har ett kontaktformulär längre ner, med ' + f.form.fields + ' fält' + (f.form.first ? ' – det första är ' + q(f.form.first) : '') + '.');
      step('form', 'ok', 'Formulär med ' + f.form.fields + ' fält längre ner på startsidan');
      if (!(await sleep(3000, id))) return;
    } else {
      talk('Scrollar ner och letar efter ett formulär …');
      if (!(await scrollTo(maxScroll(), id))) return;
      var where2 = next ? 'sidan ' + q((next.facts && next.facts.h1) || next.label || 'sista sidan') : 'startsidan';
      step('form', 'info', ff ? 'Formuläret ligger längre ner på ' + where2 : 'Inget formulär på ' + where2);
      if (!(await sleep(1600, id))) return;
    }

    // 7. Google's speed test is still running in the background: say so, and wait calmly
    if (!(await scrollTo(0, id))) return;
    moveTo(W() * 0.5, H() * 0.5);
    if (measured) { talk('Genomgången är klar – här kommer resultatet!'); touring = false; return; }
    talk(deep ? 'Genomgången är klar. Djupanalysen går nu igenom resten av sajten i bakgrunden …' : 'Genomgången är klar. Nu väntar vi bara på Googles mätning av hur snabbt sidan laddar …');
    var waits = deep ? ['Djupanalysen läser fler sidor, letar trasiga länkar och kollar säkerheten …', 'Det tar några minuter – resultatet visas här när allt är klart …']
      : ['Google laddar er sida på en mobil för att mäta snabbheten …', 'Nästan klart – resultatet visas strax här nedanför …'];
    touring = false; // the walk-through is done: the results may show now
    for (var w = 0; w < 8; w++) { if (!(await sleep(6500, id))) return; talk(waits[w % waits.length]); }
  }

  /* ---------- before the robot is back, and when it cannot open the site ---------- */
  async function waiting(id) {
    steps(['open', 'speed']);
    step('open', 'now', 'Startar testroboten …'); speedStep();
    busy(true); box.classList.add('no-cursor');
    talk('Testroboten öppnar ' + (box.classList.contains('stlive--phone') ? 'mobilversionen av ' : '') + host + ' … det tar några sekunder.');
    if (!(await sleep(10000, id))) return;
    if (!box.classList.contains('has-shot')) talk('Sidan tar lite tid att öppna. Vi väntar en stund till …');
  }
  function speedStep() {
    if (measured) step('speed', 'ok', 'Klar – resultatet visas efter genomgången');
    else step('speed', 'now', deep ? 'Djupanalysen pågår i bakgrunden – tar några minuter' : 'Pågår i bakgrunden – tar oftast 20–40 sekunder');
  }
  // The reading view: when a site may not be shown in a frame, the window shows what the robot read on the page
  // (its address, heading, menu, phone, pictures, form) instead of an empty placeholder. Only what was read.
  var reader = null;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function showRead(url, f, ms) {
    if (!reader) { reader = el('div', 'stlive__read'); reader.setAttribute('aria-hidden', 'true'); screen.appendChild(reader); }
    f = f || {}; reader.textContent = '';
    reader.appendChild(el('p', 'stlive__read-eye', 'Sidan får inte visas i ramen – så här läser testroboten den'));
    var path = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    reader.appendChild(el('p', 'stlive__read-url', path + (ms ? ' · svarade på ' + sec(ms) : '')));
    if (f.menu && f.menu.length) { var m = el('ul', 'stlive__read-menu'); m.dataset.k = 'menu'; f.menu.slice(0, 6).forEach(function (t) { m.appendChild(el('li', '', t)); }); reader.appendChild(m); }
    var h = el('p', 'stlive__read-h1' + (f.h1 ? '' : ' is-none'), f.h1 || (f.thin ? 'Innehållet visas med JavaScript och kunde inte läsas här' : 'Ingen huvudrubrik (h1) i sidans kod'));
    h.dataset.k = 'h1'; reader.appendChild(h);
    if (f.title && f.title !== f.h1) reader.appendChild(el('p', 'stlive__read-title', 'Sidans titel i Google: ' + f.title));
    var facts = [f.phone && ['phone', 'Telefon: ' + f.phone], f.email && ['email', 'E-post: ' + f.email], f.images && ['img', f.images + ' bilder' + (f.imagesNoAlt ? ', ' + f.imagesNoAlt + ' utan bildtext' : '')],
      f.form && ['form', newsletter(f.form) ? 'Nyhetsbrevsruta' : 'Formulär med ' + f.form.fields + ' fält']].filter(Boolean);
    if (facts.length) { var l = el('ul', 'stlive__read-facts'); facts.forEach(function (t) { var li = el('li', '', t[1]); li.dataset.k = t[0]; l.appendChild(li); }); reader.appendChild(l); }
    // the robot's pointer is back: it points only at what the reading view shows
    box.classList.add('has-read'); box.classList.remove('no-cursor'); reader.classList.remove('is-in', 'is-wait'); void reader.offsetWidth; reader.classList.add('is-in');
  }
  function dropRead() { box.classList.remove('has-read'); box.classList.add('no-cursor'); frameOff(); }
  // pointing in the reading view: the frame, the pointer and the note go to a line that is really there
  function rEl(k) { return reader && box.classList.contains('has-read') ? reader.querySelector('[data-k="' + k + '"]') : null; }
  function menuItem(label) {
    var m = rEl('menu'); if (!m) return null;
    return [].filter.call(m.children, function (li) { return li.textContent.trim().toLowerCase() === String(label).trim().toLowerCase(); })[0] || null;
  }
  function rel(e) { var r = e.getBoundingClientRect(), s = screen.getBoundingClientRect(); return { l: r.left - s.left, t: r.top - s.top, w: r.width, h: r.height }; }
  function noteAt(text, warn, r) {
    badge.textContent = text; badge.classList.toggle('is-warn', !!warn);
    var bwid = Math.min(W() - 16, text.length * 8.4 + 30), x = r.l + Math.min(r.w, 260) / 2 - bwid / 2, y = r.t + r.h + 14;
    if (y > H() - 44) y = r.t - 52;
    badge.style.left = Math.max(8, Math.min(W() - bwid - 8, x)) + 'px'; badge.style.top = Math.max(8, Math.min(H() - 40, y)) + 'px';
    badge.classList.add('is-on');
    timers.push(setTimeout(function () { badge.classList.remove('is-on'); }, 2600));
  }
  async function aim(e, label, note, warn, click, id) {
    if (!e) return id === run;
    var r = rel(e), pad = 6, l = Math.max(2, r.l - pad), tp = Math.max(2, r.t - pad);
    hl.style.left = l + 'px'; hl.style.top = tp + 'px';
    hl.style.width = Math.max(24, Math.min(W() - l - 2, r.w + pad * 2)) + 'px'; hl.style.height = Math.max(20, Math.min(H() - tp - 2, r.h + pad * 2)) + 'px';
    hl.classList.toggle('is-top', tp < 34); hl.classList.toggle('is-right', l > W() * 0.62);
    chip.textContent = label; hl.classList.add('is-on');
    moveTo(r.l + Math.min(r.w * 0.55, r.w - 6), r.t + r.h * 0.62);
    timers.push(setTimeout(function () { cur.classList.toggle('is-hand', !!click); }, 700));
    if (!(await sleep(950, id))) return false;
    if (note) noteAt(note, warn, r);
    if (click) press();
    return true;
  }
  // point at a line (when it is there) and stay on it for the step's time
  async function look(e, label, note, warn, total, id) {
    if (!e) return sleep(total, id);
    if (!(await aim(e, label, note, warn, false, id))) return false;
    return sleep(Math.max(300, total - 950), id);
  }
  function dropFrame() { if (frame) { frame.remove(); frame = null; } pageEl.style.height = ''; box.classList.remove('has-frame'); }
  // a page live in the window: the real page in a frame when the site allows it, otherwise an empty page and a note
  function openPage(url, canFrame, id, phone, read) {
    return new Promise(function (ok) {
      hint.classList.remove('is-on');
      if (!canFrame) {
        dropFrame(); box.classList.remove('has-shot');
        if (reader) reader.classList.add('is-wait'); // the last page fades while the next one is fetched
        frameOff(); badge.classList.remove('is-on');
        timers.push(setTimeout(function () {
          done();
          if (read) showRead(url, read.facts, read.ms);
          else { hint.textContent = 'Sidan kan inte visas här – testroboten läser den i bakgrunden'; hint.classList.add('is-on'); }
          ok(id === run);
        }, 700));
        return;
      }
      dropRead();
      if (frame && frame.dataset.u === url) { box.classList.add('has-shot', 'has-frame'); done(); ok(id === run); return; }
      var w = phone ? 390 : 1280, s = W() / w, FH = Math.round(H() / s), fin = false;
      if (!frame) {
        frame = document.createElement('iframe');
        frame.className = 'stlive__frame'; frame.title = 'Den testade sidan'; frame.tabIndex = -1;
        frame.setAttribute('sandbox', 'allow-scripts'); frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin'); // only our address goes along: some sites refuse their pictures without it
        frame.style.width = w + 'px'; frame.style.height = FH + 'px'; frame.style.transform = 'scale(' + s + ')';
        pageEl.style.height = Math.round(FH * s) + 'px'; pageEl.appendChild(frame);
      }
      var end = function () { if (fin) return; fin = true; box.classList.add('has-shot', 'has-frame'); done(); ok(id === run); };
      frame.onload = end; timers.push(setTimeout(end, 7000));
      frame.dataset.u = url; frame.src = url;
    });
  }

  /* ---------- the visit read straight from the pages (when the real browser is not available) ---------- */
  async function crawl(v, id, phone) {
    touring = true;
    try { await crawlInner(v, id, phone); } finally { if (id === run) touring = false; }
  }
  async function crawlInner(v, id, phone) {
    var f = v.facts || {}, pages = (v.pages || []).slice(0, 5), shownPage = v.frame ? null : v;
    box.classList.add('no-cursor');
    steps(['open', 'h1', 'menu', 'contact'].concat(pages.map(function (p, i) { return ['p' + (i + 1), 'Sida ' + (i + 2) + ': ' + q(p.label)]; }), ['form', 'speed']));
    speedStep(); step('open', 'now');
    setAddr(v.url); busy(true);
    if (!(await openPage(v.url, v.frame, id, phone, v))) return;
    step('open', 'ok', 'Startsidan svarade på ' + sec(v.ms));
    talk(pages.length ? 'Startsidan är öppen. Testroboten går igenom den och resten av sajten, sida för sida.' : 'Startsidan är öppen. Sajten verkar ha en enda sida – testroboten går igenom den.');
    if (!(await sleep(2200, id))) return;

    var thin = !!f.thin, unread = 'Sidan visar sitt innehåll med JavaScript – kunde inte läsas här';
    if (thin) { talk('Startsidan visar sitt innehåll med JavaScript, så testroboten kan inte läsa rubrik och meny här. Google-testet mäter den ändå.'); if (!(await sleep(3200, id))) return; }
    step('h1', 'now');
    if (!thin) talk(f.h1 ? 'Rubriken på startsidan: ' + q(f.h1) + '. Förstår man direkt vad ni gör?' : 'Letar efter startsidans huvudrubrik i sidans kod … hittar ingen.');
    if (!thin && !(await look(rEl('h1'), 'Huvudrubrik', f.h1 ? '' : 'Saknas i sidans kod', !f.h1, 2800, id))) return;
    step('h1', f.h1 ? 'ok' : thin ? 'info' : 'warn', f.h1 ? q(f.h1) : thin ? unread : 'Ingen huvudrubrik (h1) i sidans kod');

    step('menu', 'now');
    var title = (f.title || '').toLowerCase();
    var menu = (f.menu || []).filter(function (m) { return (m.length < 12 || title.indexOf(m.toLowerCase()) < 0) && !/^(hem|home|start)$/i.test(m); });
    if (menu.length || !thin) { talk(menu.length ? 'Menyn har ' + menu.length + ' val: ' + menu.slice(0, 5).join(', ') + (menu.length > 5 ? ' …' : '.') : 'Letar efter en meny i sidans kod … hittar ingen.'); if (!(await look(menu.length ? rEl('menu') : null, 'Menyn', menu.length + ' val', false, 2600, id))) return; }
    step('menu', menu.length ? 'ok' : thin ? 'info' : 'warn', menu.length ? menu.slice(0, 6).join(', ') : thin ? unread : 'Ingen meny i sidans kod');

    step('contact', 'now');
    if (f.phone || f.email || !thin) { talk(f.phone || f.email ? 'Hittade ' + [f.phone && 'telefonnumret ' + f.phone, f.email && 'e-postadressen ' + f.email].filter(Boolean).join(' och ') + ' på startsidan.' : 'Letar efter telefonnummer och e-post på startsidan … hittar inga.'); if (!(await look(rEl('phone') || rEl('email'), f.phone ? 'Telefon' : 'E-post', 'Kunden kan nå er direkt', false, 2800, id))) return; }
    step('contact', f.phone || f.email ? 'ok' : thin ? 'info' : 'warn', [f.phone && 'Telefon: ' + f.phone, f.email && 'E-post: ' + f.email].filter(Boolean).join(' · ') || (thin ? unread : 'Varken telefon eller e-post på startsidan'));

    for (var i = 0; i < pages.length; i++) {
      var p = pages[i], k = 'p' + (i + 1), pf = p.facts || {};
      step(k, 'now', 'Öppnar sidan …');
      talk('Går vidare till ' + q(p.label) + (p.contact ? ' – där kunden tar kontakt.' : ' …'));
      var mi = menuItem(p.label); // the robot clicks the menu choice when the page it reads has it
      if (mi) { if (!(await aim(mi, 'Klickar på ' + q(p.label), '', false, true, id))) return; if (!(await sleep(450, id))) return; }
      busy(true); typeAddr(p.url);
      if (!(await sleep(mi ? 500 : 900, id))) return;
      if (!(await openPage(p.url, p.frame, id, phone, p))) return; shownPage = p.frame ? null : p;
      if (p.frame) { hint.textContent = 'Testroboten läser sidan …'; hint.classList.add('is-on'); timers.push(setTimeout(function () { hint.classList.remove('is-on'); }, 2200)); }
      step(k, 'ok', 'Svarade på ' + sec(p.ms) + (pf.h1 ? ' · rubrik: ' + q(pf.h1) : pf.thin ? '' : ' · ingen huvudrubrik (h1)'));
      talk('Sidan ' + q(pf.h1 || p.label) + ' svarade på ' + sec(p.ms) + '.' + (pf.images ? ' ' + pf.images + ' bilder' + (pf.imagesNoAlt ? ', varav ' + pf.imagesNoAlt + ' utan bildtext.' : ', alla med bildtext.') : ''));
      if (!(await look(rEl('h1'), 'Rubrik', pf.h1 ? 'Svarade på ' + sec(p.ms) : pf.thin ? '' : 'Ingen huvudrubrik (h1)', !pf.h1 && !pf.thin, 1600, id))) return;
      if (!(await look(pf.imagesNoAlt ? rEl('img') : null, 'Bilder', pf.imagesNoAlt + ' utan bildtext', true, 1200, id))) return;
    }

    step('form', 'now');
    var one = !pages.length, seen = one ? 'på sidan' : 'på de besökta sidorna';
    var real = function (x) { return x && x.facts && x.facts.form && !newsletter(x.facts.form) ? x : null; };
    var withForm = real(pages.filter(function (x) { return x.contact; })[0]) || pages.filter(real)[0] || (real(v) ? v : null);
    if (withForm) {
      var ff = withForm.facts.form, where = withForm === v ? 'startsidan' : 'sidan ' + q(withForm.facts.h1 || withForm.label);
      talk('Hittade ett kontaktformulär med ' + ff.fields + ' fält på ' + where + (ff.first ? ' – det första är ' + q(ff.first) : '') + '.');
      step('form', 'ok', 'Formulär med ' + ff.fields + ' fält på ' + where);
    } else if ((f.form && newsletter(f.form)) || pages.some(function (x) { return x.facts && newsletter(x.facts.form); })) {
      talk('Hittar bara ett fält för att prenumerera på nyhetsbrev, inget formulär för förfrågningar i ' + (one ? 'sidans' : 'sidornas') + ' kod.');
      step('form', 'info', 'Hittade bara anmälan till nyhetsbrev ' + seen);
    } else if (thin || pages.some(function (x) { return x.facts && x.facts.thin; })) {
      talk('Hittar inget formulär i ' + (one ? 'sidans' : 'sidornas') + ' kod – det kan visas med JavaScript, så det går inte att säga säkert här.');
      step('form', 'info', 'Kunde inte avgöras – ' + (one ? 'sidan visar' : 'sidorna visar') + ' innehåll med JavaScript');
    } else {
      talk('Letar efter ett kontaktformulär ' + (one ? 'på sidan … hittar inget i sidans kod.' : 'på sidorna … hittar inget i sidornas kod.'));
      step('form', 'info', 'Hittade inget kontaktformulär ' + seen);
    }
    var fl = withForm && withForm === shownPage ? rEl('form') : null;
    if (!(await look(fl, 'Formulär', fl ? withForm.facts.form.fields + ' fält' : '', false, 3000, id))) return;
    frameOff(); touring = false;
    if (measured) { talk('Genomgången är klar – här kommer resultatet!'); return; }
    talk((one ? 'Genomgången av sidan är klar.' : 'Genomgången av ' + (pages.length + 1) + ' sidor är klar.') + ' Nu väntar vi bara på Googles mätning av hur snabbt sidan laddar …');
  }

  // the pages the robot went through, for the report: start page first, as the visit read them
  var tour = null, hold = 0;
  function list(v, key) {
    return [{ label: 'Startsidan', url: v.url, ms: v[key], h1: (v.facts || {}).h1 || '' }].concat((v.pages || []).slice(0, 5).map(function (p) {
      return { label: p.label, url: p.url, ms: p[key], h1: (p.facts || {}).h1 || '' };
    }));
  }
  window.ElevateLive = {
    tour: function () { return tour; },
    // into: another progress panel to show the window in (the deep analysis); default is the quick test's
    start: function (url, into) {
      clear(); run++; var id = run; page = null; tour = null; hold = 0; scrollPx = 0; deep = !!into; started = Date.now(); touring = false; measured = false; pending = true;
      if (into) into.insertBefore(box, into.querySelector('.sitetest__note')); else if (box.parentNode !== home) home.insertBefore(box, homeNext);
      dropFrame(); dropRead(); box.hidden = false; box.classList.remove('has-shot', 'no-cursor'); pageEl.style.transform = ''; pageEl.classList.remove('is-away'); img.removeAttribute('src'); frameOff(); hint.classList.remove('is-on');
      host = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
      setAddr(/^https?:/.test(url) ? url : 'https://' + url);
      // the same device as the test measures: the Mobil/Dator choice in the form (the deep analysis follows the screen)
      var pick = !into && document.querySelector('#sitetest-form input[name="strategy"]:checked');
      var phone = pick ? pick.value === 'mobile' : window.innerWidth < 700;
      box.classList.toggle('stlive--phone', phone); box.classList.toggle('stlive--narrow', phone && window.innerWidth >= 700);
      waiting(id);
      // Two ways to the robot's visit, started together: the real browser (screenshots, clicks on the real buttons)
      // and the pages read straight from the server. The browser's visit is used when it is back within 11 seconds;
      // otherwise the tour goes through the pages that were read, live in the window. Nothing is shown that the
      // visit did not find.
      var shot = null, visit = null, shotFailed = false, visitFailed = false, decided = false;
      var decide = function () {
        if (decided || id !== run) return;
        if (shot) { tour = list(shot, 'shownMs'); decided = true; pending = false; clear(); dropFrame(); dropRead(); box.classList.remove('no-cursor'); run++; replay(shot, run); return; }
        if (visit && (shotFailed || Date.now() - started >= 11000)) { tour = list(visit, 'ms'); decided = true; pending = false; clear(); run++; crawl(visit, run, phone); return; }
        if (shotFailed && visitFailed) {
          decided = true; pending = false; clear(); run++;
          busy(false); step('open', 'info', 'Testroboten släpptes inte in på sidan');
          talk('Sajten släpper inte in vår testrobot, så vi kan inte visa sidorna här. Testet fortsätter i bakgrunden – resultatet kommer strax.');
          hold = Date.now() + 4500; // long enough to read why there is no tour before the results replace the window
        }
      };
      timers.push(setTimeout(decide, 11000));
      fetch('/api/visit?url=' + encodeURIComponent(url)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (v) {
        if (id !== run) return; if (v && v.facts) visit = v; else visitFailed = true;
        if (visit && !decided && visit.frame) {
          openPage(visit.url, true, id, phone).then(function (ok) {
            if (!ok || decided) return;
            step('open', 'ok', 'Startsidan svarade på ' + sec(visit.ms));
            talk('Startsidan är öppen. Testroboten går nu igenom sajten i sin webbläsare – strax visas varje sida den besöker …');
          });
        }
        decide();
      });
      // the real browser; asked once more after a short pause if the first try fails (it can be busy)
      var getShot = function () { return fetch('/api/preview?url=' + encodeURIComponent(url) + (phone ? '&m=1' : '')).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); };
      // (asked again only when there is nothing else to show: with the pages already read, the tour starts at once)
      getShot().then(function (d) { return d || (id === run && !decided && !visit ? new Promise(function (ok) { setTimeout(ok, 3000); }).then(getShot) : null); }).then(function (d) {
        if (id !== run) return; if (d && d.img) shot = d; else shotFailed = true; decide();
      });
    },
    // the test's own results are in: let the robot finish its walk-through first (up to 80 s after the start),
    // so the visitor sees what it did, then show the results
    finish: function (cb) {
      var free = function () { return !touring && !pending && Date.now() >= hold; };
      if (box.hidden || free()) { cb(); return; }
      measured = true; step('speed', 'ok', 'Klar – resultatet visas strax');
      var until = Math.max(started + 80000, Date.now() + 4000), id = run;
      (function wait() {
        if (box.hidden || free() || Date.now() >= until) { cb(); return; }
        setTimeout(wait, 300);
      })();
    },
    stop: function () { clear(); run++; dropFrame(); page = null; box.hidden = true; if (box.parentNode !== home) home.insertBefore(box, homeNext); }
  };
})();
