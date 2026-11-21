// "Se hur din hemsida kan se ut": the visitor fills in their company, picks colours, fonts and style, adds a logo and
// photos, chooses which parts the start page has and can even type straight into the page; one of our example sites
// (same origin, in a frame) is rewritten live. Nothing is saved or sent – the settings (not the images or the typed
// text) live in the address, so the design can be shared or sent along with an enquiry.
(function () {
  var form = document.getElementById('dh-form');
  var frame = document.getElementById('dh-frame');
  var screen = document.getElementById('dh-screen');
  if (!form || !frame || !screen) return;
  var base = frame.dataset.base || '';
  var imgs = { logga: '', bild: [] }; // data URLs, only in this tab
  var secState = null; // [{i, on}] for the start page's parts, in the chosen order

  // ---- helpers
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var val = function (n) {
    var el = form.elements[n]; if (!el) return '';
    if (el.length && !el.tagName) { for (var i = 0; i < el.length; i++) if (el[i].checked) return el[i].value; return ''; }
    if (el.type === 'radio' || el.type === 'checkbox') return el.checked ? el.value : '';
    return (el.value || '').trim();
  };
  var rgb = function (hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  var hexOf = function (r, g, b) { return '#' + [r, g, b].map(function (c) { return Math.round(c).toString(16).padStart(2, '0'); }).join(''); };
  var shade = function (hex, f) { // f < 0 darker, f > 0 lighter
    var c = rgb(hex).map(function (v) { return Math.max(0, Math.min(255, f < 0 ? v * (1 + f) : v + (255 - v) * f)); });
    return hexOf(c[0], c[1], c[2]);
  };
  var light = function (hex) { var c = rgb(hex).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2] > .4; };
  var inkOn = function (hex) { return light(hex) ? '#14171b' : '#ffffff'; };
  var isHex = function (v) { return /^#[0-9a-f]{6}$/i.test(v); };
  var colour = function (n) { var v = val(n); return v === 'egen' ? val(n + '-egen') : v; };
  var current = function () { return val('mall') || 'saltvind'; };
  var frameDoc = function () { try { var d = frame.contentDocument; return d && d.body ? d : null; } catch (e) { return null; } };

  var FONTS = {
    modern: ['"Manrope"', '"Inter"', 700, '-0.03em', 'none', .94],
    kraftig: ['"Bebas Neue"', '"Inter"', 400, '0.01em', 'uppercase', .9],
    klassisk: ['"Lora", Georgia, serif', '"Nunito Sans"', 500, '-0.015em', 'none', 1],
    elegant: ['"Instrument Serif", Georgia, serif', '"Inter"', 400, '-0.02em', 'none', 1.06],
    personlig: ['"Bricolage Grotesque"', '"Inter"', 700, '-0.03em', 'none', 1.06],
    rund: ['"Poppins"', '"Poppins"', 600, '-0.02em', 'none', 1.06],
    ren: ['"Urbanist"', '"Urbanist"', 700, '-0.02em', 'none', 1],
    konst: ['"Syne"', '"Inter"', 700, '-0.02em', 'none', .94],
  };
  var CORNERS = { runda: ['999px', '22px', '20px'], mjuka: ['10px', '12px', '10px'], raka: ['0px', '0px', '0px'] };
  var THEMES = {
    varm: '--c-bg:#fbf8f1;--c-yta:#f3eee2;--c-head:#fbf8f1;--c-head-fast:#fbf8f1;--c-line:#e6dfcf',
    kall: '--c-bg:#f7f9fb;--c-yta:#edf1f5;--c-head:#f7f9fb;--c-head-fast:#f7f9fb;--c-line:#dfe5ec',
    mork: '--c-bg:#121513;--c-yta:#1a1e1b;--c-ink:#eceee9;--c-rubrik:#ffffff;--c-mut:#a7aca5;--c-line:#2c312d;--c-head:#121513;--c-head-ink:#ffffff;' +
      '--c-head-fast:#121513;--c-head-fast-ink:#ffffff;--c-topp:#1a1e1b;--c-topp-ink:#eceee9;--c-ton:#1a1e1b;--c-statement:#1a1e1b;--c-ruta-ink:#ffffff',
  };
  var CC = { // "Egna färger på allt": each control and the template colours it sets
    c_bg: ['--c-bg'], c_yta: ['--c-yta', '--c-ton', '--c-statement'], c_ink: ['--c-ink'], c_rubrik: ['--c-rubrik'],
    c_head: ['--c-head', '--c-head-fast', '+--c-head-ink', '+--c-head-fast-ink'], c_topp: ['--c-topp', '+--c-topp-ink'],
    c_ruta: ['--c-ruta', '--c-panel', '--c-split', '--c-meny', '+--c-ruta-ink', '+--c-panel-ink', '+--c-split-ink', '+--c-meny-ink'],
    c_knappf: ['--c-knapp', '-.15--c-knapp2', '+--c-knapp-ink'], c_fot: ['--c-fot', '+--c-fot-ink'], c_etikett: ['--c-etikett', '--c-siffra'],
  };
  var navState = {}; // {index: text} for renamed ('' = hidden) menu links
  var SWITCHES = { knapp: 'knapp', meny: 'header', rubrikstil: 'rubrik', motiv: 'motiv', herotext: 'herotext', kursiv: 'kursiv', kort: 'kort', nyheter: 'nyheter' };

  // ---- what the example page says today, read once per page so any of the templates works
  function originals(doc) {
    if (doc.__dh) return doc.__dh;
    var o = { name: '', short: '', phone: '', email: '', area: '', hours: '' };
    var logo = doc.querySelector('.logga');
    if (logo) { o.name = (logo.getAttribute('aria-label') || '').replace(/, till startsidan$/, ''); var w = logo.querySelector('.ord'); o.short = w ? w.textContent.trim() : ''; }
    var tel = doc.querySelector('.topprad a[href^="tel:"]') || doc.querySelector('a[href^="tel:"]'); if (tel) o.phone = tel.textContent.trim();
    var mail = doc.querySelector('a[href^="mailto:"]'); if (mail) o.email = mail.getAttribute('href').slice(7);
    var area = doc.querySelector('.topprad a span'); if (area) o.area = area.textContent.trim();
    var hours = doc.querySelector('.topprad span.t-dold'); if (hours) o.hours = hours.textContent.trim();
    o.body = {}; Object.keys(SWITCHES).forEach(function (k) { o.body[SWITCHES[k]] = doc.body.getAttribute('data-' + SWITCHES[k]); });
    var cs = doc.defaultView.getComputedStyle(doc.documentElement);
    o.skala = parseFloat(cs.getPropertyValue('--skala-r')) || 1;
    o.text = parseFloat(cs.getPropertyValue('--t-text')) || 17;
    return (doc.__dh = o);
  }
  // set an element's text and remember the original, so clearing the field brings it back; text typed straight into
  // the page wins
  function setText(el, v) {
    if (!el || el.__dhUser) return;
    if (el.__dhOrig === undefined) el.__dhOrig = el.textContent;
    var t = v || el.__dhOrig;
    if (el.textContent !== t) el.textContent = t;
  }

  function apply() {
    var doc = frameDoc(); if (!doc) return;
    var o = originals(doc);
    var name = val('namn'), shortName = name ? name.replace(/\s+(AB|HB|KB|Aktiebolag|Handelsbolag)$/i, '') : '';
    var phone = val('telefon'), email = val('epost'), area = val('ort'), branch = val('bransch');

    // 1. text all over the page: names, phone, e-mail, area, opening hours
    var swaps = [];
    if (name && o.name) swaps.push([o.name, name]);
    if (shortName && o.short && o.short !== o.name) swaps.push([o.short, shortName]);
    if (phone && o.phone) swaps.push([o.phone, phone]);
    if (email && o.email) swaps.push([o.email, email]);
    if (area && o.area) swaps.push([o.area, area]);
    if (val('tider') && o.hours) swaps.push([o.hours, val('tider')]);
    var orig = doc.__dhText || (doc.__dhText = new Map()), last = doc.__dhLast || (doc.__dhLast = new Map());
    var walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT), node;
    while ((node = walk.nextNode())) {
      var par = node.parentNode;
      if (!par || par.closest('.logga .ord') || par.closest('script,style')) continue; // the logo is set below
      if (last.has(node) && last.get(node) !== node.nodeValue) orig.set(node, node.nodeValue); // typed into the page
      if (!orig.has(node)) orig.set(node, node.nodeValue);
      var v = orig.get(node);
      swaps.forEach(function (s) { if (v.indexOf(s[0]) >= 0) v = v.split(s[0]).join(s[1]); });
      if (node.nodeValue !== v) node.nodeValue = v;
      last.set(node, v);
    }
    $$('a[href^="tel:"]', doc).forEach(function (a) { if (!a.__dhHref) a.__dhHref = a.getAttribute('href'); a.setAttribute('href', phone ? 'tel:' + phone.replace(/[^\d+]/g, '') : a.__dhHref); });
    $$('a[href^="mailto:"]', doc).forEach(function (a) { if (!a.__dhHref) a.__dhHref = a.getAttribute('href'); a.setAttribute('href', email ? 'mailto:' + email : a.__dhHref); });
    if (doc.__dhTitle === undefined) doc.__dhTitle = doc.title;
    doc.title = name ? name + (area ? ' – ' + area : '') : doc.__dhTitle;

    // 2. the logo: uploaded image, or the name as text, and the line under it
    $$('.logga', doc).forEach(function (l) {
      var w = l.querySelector('.ord');
      if (w) {
        if (w.__dhOrig === undefined) w.__dhOrig = w.textContent;
        var im = w.querySelector('img');
        if (imgs.logga) {
          var size = { s: 30, m: 44, l: 60 }[val('loggstorlek') || 'm'];
          if (!im) { w.textContent = ''; im = doc.createElement('img'); im.alt = ''; w.appendChild(im); }
          im.src = imgs.logga; im.style.cssText = 'display:block;height:' + size + 'px;width:auto;max-width:280px;object-fit:contain';
        } else {
          var t = val('loggtext') || shortName || w.__dhOrig;
          if (im || w.textContent !== t) w.textContent = t;
        }
      }
      setText(l.querySelector('.tag'), val('slogan') || (area ? 'Hemma i ' + area : ''));
    });

    // 3. the start page: heading, text, label, menu button, three services, photos
    var hero = doc.querySelector('.hero') || doc.querySelector('main');
    if (hero) {
      setText(hero.querySelector('h1'), val('rubrik'));
      setText(hero.querySelector('.ingress'), val('ingress'));
      setText(hero.querySelector('.etikett'), branch ? branch + (area ? ' i ' + area : '') : '');
      var pics = $$('.bild-slide img', hero); if (!pics.length) pics = $$('img', hero).slice(0, 1);
      pics.forEach(function (pic, i) {
        if (pic.__dhSrc === undefined) { pic.__dhSrc = pic.getAttribute('src'); pic.__dhSet = pic.getAttribute('srcset') || ''; }
        var mine = imgs.bild[i];
        if (mine) { if (pic.getAttribute('src') !== mine) { pic.removeAttribute('srcset'); pic.removeAttribute('loading'); pic.src = mine; } }
        else if (!pic.__dhUser && pic.getAttribute('src') !== pic.__dhSrc) { pic.src = pic.__dhSrc; if (pic.__dhSet) pic.setAttribute('srcset', pic.__dhSet); }
      });
    }
    var btn = doc.querySelector('.head-kontakt'); if (btn) setText(btn.querySelector('span') || btn, val('knapptext'));
    var list = $$('main a[href^="verksamhet.html"] h3', doc);
    if (!list.length) { var ul = $$('main section ul', doc).filter(function (u) { return u.querySelector('li h3') && !u.closest('.hero'); })[0]; list = ul ? $$('li h3', ul) : []; }
    ['tjanst1', 'tjanst2', 'tjanst3'].forEach(function (k, i) { setText(list[i], val(k)); });

    // 4. the look: colours, theme, fonts, sizes, corners, and the template's own style switches
    var css = [], p = colour('farg'), a = colour('accent');
    if (isHex(p)) {
      var d1 = shade(p, -.2), d2 = shade(p, -.45), l1 = shade(p, .9), ink = inkOn(p), txt = light(p) ? d2 : p;
      css.push('--c-p:' + p, '--c-p2:' + d1, '--c-p-ink:' + ink, '--c-p-text:' + txt, '--c-etikett:' + txt, '--c-siffra:' + txt,
        '--c-ruta:' + p, '--c-ruta-ink:' + ink, '--c-meny:' + p, '--c-meny-ink:' + ink, '--c-fot:' + d2, '--c-dark:' + d2, '--c-panel:' + d2, '--c-split:' + d2,
        '--c-band:' + shade(p, .35), '--c-ton:' + l1, '--c-topp:' + l1, '--c-statement:' + l1);
      if (!isHex(a)) css.push('--c-knapp:' + p, '--c-knapp2:' + d1, '--c-knapp-ink:' + ink);
    }
    if (isHex(a)) css.push('--c-a:' + a, '--c-a-ink:' + inkOn(a), '--c-knapp:' + a, '--c-knapp2:' + shade(a, -.15), '--c-knapp-ink:' + inkOn(a), '--c-band2:' + a, '--c-ton2:' + shade(a, .82), '--c-ruta-hover:' + shade(a, -.1));
    if (THEMES[val('tema')]) css.push(THEMES[val('tema')]);
    var f = FONTS[val('typsnitt')], skala = (+val('skala') || 100) / 100;
    if (f) css.push('--font-r:' + f[0] + ', system-ui, sans-serif', '--font-logo:' + f[0] + ', system-ui, sans-serif', '--font-t:' + f[1] + ', system-ui, sans-serif',
      '--w-r:' + f[2], '--w-logo:' + Math.max(f[2], 400), '--tr-r:' + f[3], '--tt-r:' + f[4], '--tt-nav:' + (f[4] === 'uppercase' ? 'uppercase' : 'none'),
      '--tt-btn:' + (f[4] === 'uppercase' ? 'uppercase' : 'none'));
    if (f || skala !== 1) css.push('--skala-r:' + ((f ? f[5] : o.skala) * skala).toFixed(3));
    if (+val('text') && +val('text') !== 100) css.push('--t-text:' + (o.text * val('text') / 100).toFixed(1) + 'px');
    if (+val('bredd') && +val('bredd') !== 1360) css.push('--maxw:' + val('bredd') + 'px');
    var c = CORNERS[val('horn')]; if (c) css.push('--r-btn:' + c[0], '--r-card:' + c[1], '--r-img:' + c[2]);
    var lf = FONTS[val('loggfont')]; if (lf) css.push('--font-logo:' + lf[0] + ', system-ui, sans-serif', '--w-logo:' + Math.max(lf[2], 500));
    if (val('loggversal')) css.push('--tt-logo:' + val('loggversal'));
    if (val('vikt')) css.push('--w-r:' + val('vikt'));
    if (val('sparr')) css.push('--tr-r:' + val('sparr'));
    if (val('navversal')) css.push('--tt-nav:' + val('navversal'));
    if (val('btnversal')) css.push('--tt-btn:' + val('btnversal'));
    $$('.dh-cc input[type=color]').forEach(function (inp) {
      if (!inp.dataset.on) return;
      var hex = inp.value;
      CC[inp.name].forEach(function (v) {
        if (v.charAt(0) === '+') css.push(v.slice(1) + ':' + inkOn(hex));
        else if (/^-[.\d]/.test(v)) css.push(v.slice(v.indexOf('--')) + ':' + shade(hex, -parseFloat(v.slice(1, v.indexOf('--')))));
        else css.push(v + ':' + hex);
      });
    });
    var rules = [];
    if (+val('loggskala') && +val('loggskala') !== 100) rules.push('.logga .ord{zoom:' + (val('loggskala') / 100) + '}');
    var lj = val('ljus'); if (lj) rules.push('.hero img{filter:' + (lj === 'bw' ? 'grayscale(1) contrast(1.05)' : 'brightness(' + lj + ')') + '}');
    if (val('topprad')) rules.push('.topprad{display:none!important}');
    if (val('sok')) rules.push('.sok{display:none!important}');
    if (val('rorelse')) rules.push('*,*::before,*::after{animation:none!important;transition:none!important}');
    var st = doc.getElementById('dh-style');
    if (!st) { st = doc.createElement('style'); st.id = 'dh-style'; doc.head.appendChild(st); }
    st.textContent = (css.length ? ':root{' + css.join(';') + '}' : '') + rules.join('') +
      (doc.designMode === 'on' ? '[contenteditable],body *:hover{cursor:text}img:hover{outline:3px dashed ' + (isHex(a) ? a : '#e2632b') + ';outline-offset:-3px;cursor:pointer!important}' : '');
    Object.keys(SWITCHES).forEach(function (k) { var at = SWITCHES[k], v = val(k) || o.body[at]; if (v != null && v !== '') doc.body.setAttribute('data-' + at, v); });
    // the fonts come from our own server (the site's security policy blocks Google's)
    if (!doc.getElementById('dh-fonts')) { var lk = doc.createElement('link'); lk.id = 'dh-fonts'; lk.rel = 'stylesheet'; lk.href = '../typsnitt/typsnitt.css'; doc.head.appendChild(lk); }

    // the colour controls nobody has touched show what the page uses right now
    var cs = doc.defaultView.getComputedStyle(doc.documentElement);
    $$('.dh-cc input[type=color]').forEach(function (inp) {
      if (inp.dataset.on) return;
      var v = cs.getPropertyValue(CC[inp.name][0]).trim();
      if (isHex(v)) inp.value = v.toLowerCase();
      else if (/^#[0-9a-f]{3}$/i.test(v)) inp.value = '#' + v.slice(1).split('').map(function (c) { return c + c; }).join('');
    });
    $$('.dh-cc').forEach(function (d) { d.classList.toggle('is-on', !!d.querySelector('input').dataset.on); });

    // 5. which parts the start page has, in which order, and the menu
    applySections(doc);
    applyNav(doc);

    var dom = email.indexOf('@') > 0 ? email.split('@')[1] : (shortName ? shortName.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '') + '.se' : 'dittforetag.se');
    $('dh-url').textContent = dom;
  }

  // ---- the start page's parts: show/hide and move up/down
  function sections(doc) {
    var main = doc.querySelector('main'); if (!main) return [];
    if (!main.__dhSecs) main.__dhSecs = $$(':scope > section, :scope > div', main).filter(function (s) { return !s.classList.contains('hero') && s.offsetHeight > 40; });
    return main.__dhSecs;
  }
  var label = function (s, i) {
    var h = s.querySelector('h2, h3'), e = s.querySelector('.etikett');
    var t = (h && h.textContent.trim()) || s.getAttribute('aria-label') || (e && e.textContent.trim()) || 'Del ' + (i + 1);
    return t.length > 44 ? t.slice(0, 42) + '…' : t;
  };
  function applySections(doc) {
    var secs = sections(doc); if (!secs.length) return;
    if (!secState || secState.length !== secs.length) secState = secs.map(function (s, i) { return { i: i, on: true }; });
    var main = doc.querySelector('main');
    secState.forEach(function (st) { var s = secs[st.i]; if (!s) return; main.appendChild(s); s.style.display = st.on ? '' : 'none'; });
    renderSections(secs);
  }
  function renderSections(secs) {
    var ol = $('dh-secs'); if (!ol) return;
    var html = secState.map(function (st, pos) {
      var s = secs[st.i]; if (!s) return '';
      return '<li class="dh-sec' + (st.on ? '' : ' is-off') + '"><label><input type="checkbox" data-sec-on="' + pos + '"' + (st.on ? ' checked' : '') + '><span>' + label(s, st.i).replace(/</g, '&lt;') + '</span></label>' +
        '<button type="button" data-sec-up="' + pos + '" aria-label="Flytta upp"' + (pos === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" data-sec-down="' + pos + '" aria-label="Flytta ner"' + (pos === secState.length - 1 ? ' disabled' : '') + '>↓</button></li>';
    }).join('');
    if (ol.__html !== html) { ol.innerHTML = html; ol.__html = html; }
  }
  $('dh-secs').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var up = b.dataset.secUp, down = b.dataset.secDown, i = +(up !== undefined ? up : down), j = up !== undefined ? i - 1 : i + 1;
    if (j < 0 || j >= secState.length) return;
    var t = secState[i]; secState[i] = secState[j]; secState[j] = t;
    var doc = frameDoc(); if (doc) applySections(doc); save();
    var nb = $('dh-secs').querySelector('[data-sec-' + (up !== undefined ? 'up' : 'down') + '="' + j + '"]'); if (nb && !nb.disabled) nb.focus();
    scrollToSection(secState[j].i);
  });
  $('dh-secs').addEventListener('change', function (e) {
    var cb = e.target.closest('[data-sec-on]'); if (!cb) return;
    secState[+cb.dataset.secOn].on = cb.checked;
    var doc = frameDoc(); if (doc) applySections(doc); save();
    if (cb.checked) scrollToSection(secState[+cb.dataset.secOn].i);
  });
  function scrollToSection(i) { var doc = frameDoc(); if (!doc) return; var s = sections(doc)[i]; if (s && s.style.display !== 'none') s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  var secCode = function () { return secState ? secState.map(function (s) { return (s.on ? '' : '~') + s.i; }).join('.') : ''; };
  var secDefault = function () { return !secState || secState.every(function (s, i) { return s.on && s.i === i; }); };

  // ---- the menu: rename links, or empty one to hide it
  function navLinks(doc) { return $$('.head .nav a', doc); }
  function applyNav(doc) {
    var links = navLinks(doc), box = $('dh-navs');
    links.forEach(function (a, i) {
      if (a.__dhOrig === undefined) a.__dhOrig = a.textContent;
      var t = navState[i], href = a.getAttribute('href');
      var twins = [a].concat($$('.meny a', doc).filter(function (m) { return m.getAttribute('href') === href && (m.__dhOrig !== undefined || m.textContent.trim() === a.__dhOrig.trim()); }));
      twins.forEach(function (m) {
        if (m.__dhOrig === undefined) m.__dhOrig = m.textContent;
        var box2 = m.closest('li') || m;
        if (t === undefined) { m.textContent = m.__dhOrig; box2.style.display = ''; }
        else if (t === '') box2.style.display = 'none';
        else { m.textContent = t; box2.style.display = ''; }
      });
    });
    var key = links.map(function (a) { return a.__dhOrig; }).join('|');
    if (box.__key !== key) {
      box.__key = key;
      box.innerHTML = links.map(function (a, i) {
        var v = navState[i] === undefined ? a.__dhOrig : navState[i];
        return '<input data-nav="' + i + '" value="' + v.replace(/"/g, '&quot;') + '" placeholder="Dold – skriv för att visa" aria-label="Menylänk ' + (i + 1) + '">';
      }).join('');
    }
  }
  $('dh-navs').addEventListener('input', function (e) {
    var inp = e.target.closest('[data-nav]'); if (!inp) return;
    var doc = frameDoc(), i = +inp.dataset.nav, a = doc && navLinks(doc)[i];
    if (!a) return;
    if (inp.value === a.__dhOrig) delete navState[i]; else navState[i] = inp.value.trim();
    applyNav(doc); save();
  });
  var navCode = function () { return Object.keys(navState).map(function (i) { return i + '~' + navState[i]; }).join('|'); };
  var pendingNav = '';

  // ---- typing straight into the page, and clicking a picture to change it
  var editBox = $('dh-edit'), picker = document.createElement('input'), pickTarget = null;
  picker.type = 'file'; picker.accept = 'image/png,image/jpeg,image/webp';
  picker.addEventListener('change', function () {
    var t = pickTarget; if (!t || !picker.files[0]) return;
    readImage(picker.files[0], 1600, function (url) { t.removeAttribute('srcset'); t.src = url; t.__dhUser = true; picker.value = ''; });
  });
  function setupEdit(doc) {
    doc.designMode = editBox.checked ? 'on' : 'off';
    if (doc.__dhEdit) return; doc.__dhEdit = true;
    doc.addEventListener('click', function (e) {
      if (doc.designMode !== 'on') return;
      var im = e.target.closest && e.target.closest('img');
      if (im) { e.preventDefault(); pickTarget = im; picker.click(); }
      else if (e.target.closest && e.target.closest('a')) e.preventDefault();
    }, true);
    doc.addEventListener('input', function () { // text typed by the visitor is theirs: the form no longer overwrites it
      var sel = doc.getSelection(), n = sel && sel.anchorNode, el = n && (n.nodeType === 1 ? n : n.parentNode);
      for (; el && el !== doc.body; el = el.parentNode) el.__dhUser = true;
    });
  }
  editBox.addEventListener('change', function () { var doc = frameDoc(); if (doc) { setupEdit(doc); apply(); } screen.classList.toggle('is-edit', editBox.checked); });

  // ---- keep the chosen card / chip / swatch marked, and the sliders' numbers
  function marks() {
    $$('.dh-tpl, .dh-chip, .dh-font, .dh-color').forEach(function (l) { var i = l.querySelector('input[type=radio]'); l.classList.toggle('is-on', !!(i && i.checked)); });
    $$('.dh-color--egen').forEach(function (l) { l.querySelector('i').style.background = l.querySelector('input[type=color]').value; });
    $$('output[data-for]').forEach(function (o) { var v = val(o.dataset.for); o.textContent = v + (o.dataset.for === 'bredd' ? ' px' : ' %'); });
  }
  // a custom colour picker counts as choosing that swatch
  var egenRadio = {};
  $$('.dh-color--egen input[type=color]').forEach(function (inp) {
    var group = inp.name.replace('-egen', '');
    var r = document.createElement('input'); r.type = 'radio'; r.name = group; r.value = 'egen'; r.hidden = true; inp.parentNode.appendChild(r);
    egenRadio[group] = r;
    inp.addEventListener('input', function () { r.checked = true; marks(); });
  });
  function setColour(group, hex) { var inp = form.elements[group + '-egen']; inp.value = hex; egenRadio[group].checked = true; marks(); }

  function load() { secState = null; navState = {}; $('dh-navs').__key = ''; frame.src = base + 'exempel/' + current() + '/index.html'; }
  frame.addEventListener('load', function () {
    var doc = frameDoc(); if (!doc) return;
    if (pendingSec) { // a shared link: the parts' order for this template
      var secs = sections(doc), arr = pendingSec.split('.').map(function (x) { return { i: +x.replace('~', ''), on: x.charAt(0) !== '~' }; });
      if (arr.length === secs.length && arr.every(function (s) { return s.i >= 0 && s.i < secs.length; })) secState = arr;
      pendingSec = '';
    }
    if (pendingNav) { pendingNav.split('|').forEach(function (x) { var k = x.indexOf('~'); if (k > 0) navState[+x.slice(0, k)] = x.slice(k + 1); }); pendingNav = ''; }
    setupEdit(doc); apply();
  });

  // ---- settings in the address (not the images), so a design can be shared or sent with an enquiry
  var KEYS = ['namn', 'bransch', 'ort', 'rubrik', 'ingress', 'slogan', 'telefon', 'epost', 'tider', 'knapptext', 'tjanst1', 'tjanst2', 'tjanst3',
    'mall', 'farg', 'farg-egen', 'accent', 'accent-egen', 'typsnitt', 'tema', 'horn', 'knapp', 'meny', 'rubrikstil', 'motiv',
    'herotext', 'kursiv', 'kort', 'nyheter', 'skala', 'text', 'bredd',
    'loggtext', 'loggfont', 'loggversal', 'loggskala', 'vikt', 'sparr', 'navversal', 'btnversal', 'ljus', 'topprad', 'sok', 'rorelse'];
  var DEFAULTS = { mall: 'saltvind', skala: '100', text: '100', bredd: '1360', loggskala: '100' };
  var pendingSec = '';
  function save() {
    var q = new URLSearchParams();
    KEYS.forEach(function (k) {
      var v = val(k);
      if (!v || DEFAULTS[k] === v) return;
      if (/-egen$/.test(k) && val(k.replace('-egen', '')) !== 'egen') return;
      q.set(k, v);
    });
    if (!secDefault()) q.set('delar', secCode());
    if (navCode()) q.set('nav', navCode());
    $$('.dh-cc input[type=color]').forEach(function (inp) { if (inp.dataset.on) q.set(inp.name, inp.value); });
    try { history.replaceState(null, '', location.pathname + location.search + (q.toString() ? '#' + q.toString() : '')); } catch (e) {}
    var msg = 'Hej! Jag testade "Se hur din hemsida kan se ut" och vill ha en offert på något liknande. Min design: ' + location.href;
    var o = new URLSearchParams({ meddelande: msg });
    if (val('namn')) o.set('foretag', val('namn'));
    if (val('telefon')) o.set('telefon', val('telefon'));
    if (val('epost')) o.set('email', val('epost'));
    $('dh-offert').href = base + 'kontakt.html?' + o.toString() + '#formular';
  }
  function restore() {
    var q = new URLSearchParams(location.hash.slice(1)); if (!q.toString()) return;
    q.forEach(function (v, k) {
      if (k === 'delar') { pendingSec = v; return; }
      if (k === 'nav') { pendingNav = v; return; }
      if (CC[k]) { var ci = form.elements[k]; if (ci && isHex(v)) { ci.value = v; ci.dataset.on = '1'; } return; }
      if (KEYS.indexOf(k) < 0) return;
      var el = form.elements[k]; if (!el) return;
      if (el.length && !el.tagName) { for (var i = 0; i < el.length; i++) el[i].checked = el[i].value === v; }
      else el.value = v;
    });
    marks();
  }

  var timer;
  form.addEventListener('input', function (e) {
    if (e.target.name === 'mall' || e.target.type === 'file' || e.target.closest('#dh-secs') || e.target.closest('#dh-navs') || e.target === editBox) return;
    if (CC[e.target.name]) e.target.dataset.on = '1';
    marks();
    clearTimeout(timer); timer = setTimeout(function () { apply(); save(); }, 100);
  });
  form.addEventListener('change', function (e) {
    if (e.target.closest('#dh-secs') || e.target.closest('#dh-navs') || e.target === editBox) return;
    if (CC[e.target.name]) { e.target.dataset.on = '1'; apply(); save(); return; }
    if (e.target.name === 'mall') { marks(); load(); save(); }
    else if (e.target.tagName === 'SELECT' || e.target.type === 'radio') { marks(); apply(); save(); }
  });

  // ---- images: read in the browser only, scaled down so the page stays quick
  function readImage(file, max, cb) {
    if (!file || !/^image\//.test(file.type)) return;
    var r = new FileReader();
    r.onload = function () {
      if (file.type === 'image/svg+xml') return cb(r.result, null);
      var im = new Image();
      im.onload = function () {
        var s = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement('canvas');
        cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', .86), cv);
      };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  }
  // the strongest colours in the logo (ignoring white, black and grey), most used first
  function logoColours(url) {
    var im = new Image();
    im.onload = function () {
      var cv = document.createElement('canvas'), n = 64; cv.width = n; cv.height = Math.max(1, Math.round(n * im.height / im.width));
      var cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, cv.width, cv.height);
      var d; try { d = cx.getImageData(0, 0, cv.width, cv.height).data; } catch (e) { return; }
      var bins = {};
      for (var i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;
        var r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if (mx - mn < 28 || mx < 30 || mn > 230) continue; // grey, black, white
        var key = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5), bn = bins[key] || (bins[key] = { n: 0, r: 0, g: 0, b: 0 });
        bn.n++; bn.r += r; bn.g += g; bn.b += b;
      }
      var top = Object.keys(bins).map(function (k) { var b = bins[k]; return { n: b.n, hex: hexOf(b.r / b.n, b.g / b.n, b.b / b.n) }; })
        .sort(function (x, y) { return y.n - x.n; }).slice(0, 4).map(function (x) { return x.hex; });
      var box = document.querySelector('[data-dh-logocolors]'); if (!top.length) { box.hidden = true; return; }
      box.querySelector('div').innerHTML = top.map(function (h) { return '<button type="button" data-hex="' + h + '" style="background:' + h + '" title="Använd ' + h + ' som huvudfärg"></button>'; }).join('') +
        '<button type="button" class="dh-logocolors__all" data-auto>Använd loggans färger</button>';
      box.hidden = false;
      box.__top = top;
    };
    im.src = url;
  }
  document.querySelector('[data-dh-logocolors]').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var top = this.__top || [];
    if (b.dataset.auto !== undefined) { setColour('farg', top[0]); if (top[1]) setColour('accent', top[1]); }
    else setColour('farg', b.dataset.hex);
    apply(); save();
  });
  var logoSize = document.querySelector('[data-dh-logo-size]');
  form.elements.logga.addEventListener('change', function () {
    var inp = this;
    readImage(inp.files[0], 600, function (url) {
      imgs.logga = url;
      var pv = inp.parentNode.querySelector('.dh-up__img'); pv.src = url; pv.hidden = false;
      logoSize.hidden = false; logoColours(url); apply();
    });
  });
  form.elements.bild.addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files, 0, 3), thumbs = document.querySelector('[data-dh-thumbs]'), out = [], left = files.length;
    if (!left) return;
    files.forEach(function (fl, i) {
      readImage(fl, 1800, function (url) {
        out[i] = url;
        if (--left === 0) {
          imgs.bild = out.filter(Boolean);
          thumbs.innerHTML = imgs.bild.map(function (u) { return '<img src="' + u + '" alt="">'; }).join('');
          apply();
        }
      });
    });
  });
  $('dh-clear-img').addEventListener('click', function () {
    imgs.logga = ''; imgs.bild = [];
    $$('.dh-up input[type=file]').forEach(function (i) { i.value = ''; });
    $$('.dh-up__img').forEach(function (i) { i.hidden = true; i.removeAttribute('src'); });
    document.querySelector('[data-dh-thumbs]').innerHTML = '';
    document.querySelector('[data-dh-logocolors]').hidden = true;
    logoSize.hidden = true;
    var doc = frameDoc(); if (doc) $$('img', doc).forEach(function (im) { if (im.__dhUser) { im.__dhUser = false; } });
    load();
  });

  // ---- "Mallens" next to each colour control
  form.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cc-reset]'); if (!b) return;
    delete form.elements[b.dataset.ccReset].dataset.on; apply(); save();
  });

  // ---- tabs
  $$('[data-dh-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('[data-dh-tab]').forEach(function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
      $$('[data-dh-panel]').forEach(function (p) { var on = p.dataset.dhPanel === b.dataset.dhTab; p.hidden = !on; p.classList.toggle('is-on', on); });
      if (b.dataset.dhTab === 'utseende' && !$('dh-fonts-page')) { // the "Aa" samples on the font buttons
        var lk = document.createElement('link'); lk.id = 'dh-fonts-page'; lk.rel = 'stylesheet'; lk.href = base + 'exempel/typsnitt/typsnitt.css'; document.head.appendChild(lk);
      }
    });
  });

  // ---- random style, and start over
  var pick = function (name) { var opts = $$('input[name="' + name + '"]').filter(function (i) { return i.value && i.value !== 'egen'; }); if (opts.length) opts[Math.floor(Math.random() * opts.length)].checked = true; };
  var pickSel = function (name) { var s = form.elements[name], o = $$('option', s).filter(function (x) { return x.value; }); s.value = o[Math.floor(Math.random() * o.length)].value; };
  var none = function (name) { var e = form.querySelector('input[name="' + name + '"][value=""]'); if (e) e.checked = true; };
  $('dh-random').addEventListener('click', function () {
    var before = current();
    ['mall', 'farg', 'accent', 'typsnitt', 'horn', 'knapp', 'meny', 'herotext'].forEach(pick);
    [['tema', .3], ['kort', .4], ['kursiv', .4]].forEach(function (x) { if (Math.random() < x[1]) pick(x[0]); else none(x[0]); });
    pickSel('rubrikstil'); pickSel('motiv');
    marks(); save();
    if (current() !== before) load(); else apply();
  });
  $('dh-reset').addEventListener('click', function () {
    var keep = { namn: 1, bransch: 1, ort: 1, rubrik: 1, ingress: 1, slogan: 1, telefon: 1, epost: 1, tider: 1, knapptext: 1, tjanst1: 1, tjanst2: 1, tjanst3: 1 };
    $$('input, select', $$('[data-dh-panel="utseende"]')[0]).forEach(function (el) {
      if (keep[el.name]) return;
      if (el.type === 'radio') el.checked = el.value === '' || (el.name === 'mall' && el.value === 'saltvind');
      else if (el.tagName === 'SELECT') el.value = '';
      else if (el.type === 'range') el.value = DEFAULTS[el.name];
    });
    $$('.dh-cc input[type=color]').forEach(function (i) { delete i.dataset.on; });
    marks(); load(); save();
  });

  // ---- share
  var share = $('dh-share');
  share.addEventListener('click', function () {
    save();
    var done = function () { share.textContent = 'Länken är kopierad'; setTimeout(function () { share.textContent = 'Kopiera länk till designen'; }, 2200); };
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, function () { prompt('Kopiera länken:', location.href); });
    else prompt('Kopiera länken:', location.href);
  });

  form.addEventListener('submit', function (e) { e.preventDefault(); apply(); save(); $('dh-cta').scrollIntoView({ behavior: 'smooth', block: 'center' }); });

  // ---- dator / mobil, and fitting the 1280 px desktop page into the frame
  function fit() {
    var s = screen.clientWidth / 1280;
    screen.style.setProperty('--dh-s', s.toFixed(4));
    frame.style.height = screen.classList.contains('is-phone') ? '' : Math.ceil(screen.clientHeight / s) + 'px';
    screen.style.setProperty('--dh-ps', Math.min(.9, (screen.clientWidth - 40) / 390).toFixed(4));
  }
  $$('[data-dh-view]').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('[data-dh-view]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      screen.classList.toggle('is-phone', b.dataset.dhView === 'mobil');
      fit();
    });
  });
  window.addEventListener('resize', fit);
  if (window.matchMedia('(max-width: 700px)').matches) { var mb = document.querySelector('[data-dh-view="mobil"]'); if (mb) mb.click(); }

  // ---- on phones the preview sits under the form: a button to jump to it while filling in
  var jump = $('dh-jump');
  if (jump && 'IntersectionObserver' in window) {
    var formOn = false, prevOn = false, upd = function () { jump.classList.toggle('is-on', formOn && !prevOn); };
    new IntersectionObserver(function (es) { formOn = es[0].isIntersecting; upd(); }, { threshold: .05 }).observe(form);
    new IntersectionObserver(function (es) { prevOn = es[0].isIntersecting; upd(); }, { threshold: .3 }).observe(screen);
  }

  restore();
  marks();
  fit();
  load();
  save();
})();
