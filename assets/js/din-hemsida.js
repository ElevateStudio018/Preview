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

  function apply(lookOnly) {
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
    if (lookOnly && doc.__dhWalked) walk = { nextNode: function () { return null; } }; // colours, sizes, switches: the text is unchanged
    doc.__dhWalked = true;
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
      $$('.etikett', hero).forEach(function (et) { setText(et, branch ? branch + (area ? ' i ' + area : '') : ''); }); // every slide of the slideshow
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
    var sheet = (css.length ? ':root{' + css.join(';') + '}' : '') + rules.join('') +
      '.dh-hid{display:none!important}' +
      (doc.designMode === 'on' ? 'body *:hover{outline:2px dashed rgba(226,99,43,.55);outline-offset:-2px;cursor:pointer}.dh-sel,.dh-sel:hover{outline:3px solid #e2632b!important;outline-offset:-3px}' : '');
    if (st.textContent !== sheet) st.textContent = sheet; // an unchanged sheet would still make the page recalculate
    Object.keys(SWITCHES).forEach(function (k) { var at = SWITCHES[k], v = val(k) || o.body[at]; if (v != null && v !== '' && doc.body.getAttribute('data-' + at) !== v) doc.body.setAttribute('data-' + at, v); });
    // the fonts come from our own server (the site's security policy blocks Google's)
    if (!doc.getElementById('dh-fonts')) { var lk = doc.createElement('link'); lk.id = 'dh-fonts'; lk.rel = 'stylesheet'; lk.href = '../typsnitt/typsnitt.css'; doc.head.appendChild(lk); }

    // the colour controls nobody has touched show what the page uses right now (read a moment later, so it
    // never holds up the preview)
    clearTimeout(doc.__dhCcT);
    doc.__dhCcT = setTimeout(function () {
      var cs = doc.defaultView && doc.defaultView.getComputedStyle(doc.documentElement); if (!cs) return;
      $$('.dh-cc input[type=color]').forEach(function (inp) {
        if (inp.dataset.on) return;
        var v = cs.getPropertyValue(CC[inp.name][0]).trim();
        if (isHex(v)) inp.value = v.toLowerCase();
        else if (/^#[0-9a-f]{3}$/i.test(v)) inp.value = '#' + v.slice(1).split('').map(function (c) { return c + c; }).join('');
      });
    }, 400);
    $$('.dh-cc').forEach(function (d) { d.classList.toggle('is-on', !!d.querySelector('input').dataset.on); });

    // 5. which parts the start page has, in which order, and the menu
    applySections(doc);
    applyNav(doc);
    applyExtras(doc);

    var dom = email.indexOf('@') > 0 ? email.split('@')[1] : (shortName ? shortName.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '') + '.se' : 'dittforetag.se');
    $('dh-url').textContent = dom;
  }

  // ---- the start page's parts: show/hide, move, background and spacing per part, and new parts to add
  var BG = [['', 'Mallens'], ['v', 'Vit'], ['t', 'Tonad'], ['f', 'Färg'], ['m', 'Mörk']];
  var PAD = [['', 'Mallens'], ['k', 'Kompakt'], ['l', 'Luftig']];
  var BLOCKS = {
    cta: 'Kontaktband', siffror: 'Siffror', omdomen: 'Kundomdömen', faq: 'Vanliga frågor', bildtext: 'Bild och text', oppet: 'Hitta hit och öppettider', erbjudande: 'Erbjudande',
  };
  var esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
  function isStart(doc) { var path = doc.location.pathname; return /\/(index\.html)?$/.test(path); }
  function sections(doc) {
    var main = doc.querySelector('main'); if (!main) return [];
    if (!main.__dhSecs) main.__dhSecs = $$(':scope > section, :scope > div', main).filter(function (x) { return !x.classList.contains('hero') && !x.classList.contains('dhb') && x.offsetHeight > 40; });
    return main.__dhSecs;
  }
  function blockHtml(doc, type) {
    var o = originals(doc), phone = val('telefon') || o.phone, email = val('epost') || o.email, area = val('ort') || o.area;
    var pic = doc.querySelector('main section:not(.hero) img'), src = pic ? (pic.currentSrc || pic.src) : '';
    switch (type) {
      case 'cta': return '<div class="wrap"><div><h2>Behöver ni hjälp? Hör av er i dag</h2><p>Berätta vad ni behöver hjälp med, så återkommer vi med ett förslag.</p></div><div class="dhb-btns"><a class="knapp knapp-primar" href="om-oss.html#kontakt">Begär offert</a><a class="knapp dhb-ghost" data-dhb-tel href="tel:">Ring <span data-dhb-phone></span></a></div></div>';
      case 'siffror': return '<div class="wrap"><h2>Det här är vi</h2><p>Klicka på siffrorna och skriv era egna (slå på Skriv direkt i sidan).</p><div class="dhb-grid"><div class="dhb-card dhb-num"><b>XX</b><span>år i branschen</span></div><div class="dhb-card dhb-num"><b>XXX</b><span>uppdrag om året</span></div><div class="dhb-card dhb-num"><b>XX h</b><span>till första svar</span></div></div></div>';
      case 'omdomen': return '<div class="wrap"><h2>Vad kunderna säger</h2><div class="dhb-grid">' + [1, 2, 3].map(function () { return '<figure class="dhb-card dhb-quote"><blockquote>”Här visas ett omdöme från en av era kunder. Klicka och skriv det riktiga.”</blockquote><figcaption>Kundens namn, ort</figcaption></figure>'; }).join('') + '</div></div>';
      case 'faq': return '<div class="wrap dhb-narrow"><h2>Vanliga frågor</h2>' + ['Vad kostar det?', 'Hur snabbt kan ni börja?', 'Vilka områden arbetar ni i?', 'Hur går det till?'].map(function (q) { return '<details><summary>' + q + '</summary><p>Skriv ert svar här – slå på Skriv direkt i sidan och klicka på texten.</p></details>'; }).join('') + '</div>';
      case 'bildtext': return '<div class="wrap dhb-split">' + (src ? '<img src="' + esc(src) + '" alt="">' : '<div class="dhb-ph"></div>') + '<div><h2>Om oss</h2><p>Berätta kort om företaget, hur ni arbetar och vad kunderna kan räkna med. Den här texten och bilden byter ni genom att klicka på dem.</p><p><a class="knapp knapp-primar" href="om-oss.html">Läs mer om oss</a></p></div></div>';
      case 'oppet': return '<div class="wrap"><h2>Hitta hit</h2><div class="dhb-grid"><div class="dhb-card"><h3>Adress</h3><p>Gatan 1<br><span data-dhb-area>' + esc(area) + '</span></p></div><div class="dhb-card"><h3>Öppettider</h3><p data-dhb-hours>' + esc(val('tider') || o.hours || 'Mån–fre 7–16') + '</p></div><div class="dhb-card"><h3>Kontakt</h3><p><span data-dhb-phone></span><br><span data-dhb-mail>' + esc(email) + '</span></p></div></div></div>';
      case 'erbjudande': return '<div class="wrap"><h2>Erbjudande – skriv ert erbjudande här</h2><a class="knapp knapp-primar" href="om-oss.html#kontakt">Passa på</a></div>';
    }
    return '';
  }
  function block(doc, type) {
    var m = doc.__dhBlocks || (doc.__dhBlocks = {});
    if (!m[type]) { var el = doc.createElement('section'); el.className = 'dhb dhb-' + type; el.innerHTML = blockHtml(doc, type); m[type] = el; }
    return m[type];
  }
  function elOf(doc, st) { return typeof st.k === 'number' ? sections(doc)[st.k] : block(doc, st.k); }
  function label(doc, st) {
    if (typeof st.k !== 'number') return BLOCKS[st.k] + ' (ny)';
    var x = sections(doc)[st.k]; if (!x) return '';
    var h = x.querySelector('h2, h3'), e = x.querySelector('.etikett');
    var t = (h && h.textContent.trim()) || x.getAttribute('aria-label') || (e && e.textContent.trim()) || 'Del ' + (st.k + 1);
    return t.length > 40 ? t.slice(0, 38) + '…' : t;
  }
  function applySections(doc) {
    var note = $('dh-secs-note');
    if (!isStart(doc)) { note.hidden = false; $('dh-secs').hidden = true; return; }
    note.hidden = true; $('dh-secs').hidden = false;
    var secs = sections(doc); if (!secs.length) return;
    var base = secState ? secState.filter(function (x) { return typeof x.k === 'number'; }).length : -1;
    if (!secState || base !== secs.length) secState = secs.map(function (x, i) { return { k: i, on: true, bg: '', pad: '' }; });
    var main = doc.querySelector('main');
    $$('.dhb', main).forEach(function (x) { if (!secState.some(function (st) { return st.k === x.className.replace(/.*dhb-(\w+).*/, '$1'); })) x.remove(); });
    var want = secState.map(function (st) { return elOf(doc, st); }).filter(Boolean);
    var have = Array.prototype.filter.call(main.children, function (c) { return want.indexOf(c) >= 0; });
    var tail = main.lastElementChild, same = have.length === want.length && want.every(function (x, i) { return have[i] === x; }) && (!want.length || tail === want[want.length - 1]);
    secState.forEach(function (st) {
      var x = elOf(doc, st); if (!x) return;
      if (!same) main.appendChild(x);
      x.style.display = st.on ? '' : 'none';
      BG.forEach(function (o) { if (o[0]) x.classList.toggle('dh-bg-' + o[0], st.bg === o[0]); });
      PAD.forEach(function (o) { if (o[0]) x.classList.toggle('dh-pad-' + o[0], st.pad === o[0]); });
    });
    // live details in the new parts
    var o = originals(doc), phone = val('telefon') || o.phone;
    $$('[data-dhb-phone]', main).forEach(function (x) { x.textContent = phone; });
    $$('[data-dhb-tel]', main).forEach(function (x) { x.setAttribute('href', 'tel:' + phone.replace(/[^\d+]/g, '')); });
    $$('[data-dhb-area]', main).forEach(function (x) { x.textContent = val('ort') || o.area; });
    $$('[data-dhb-hours]', main).forEach(function (x) { if (val('tider')) x.textContent = val('tider'); });
    $$('[data-dhb-mail]', main).forEach(function (x) { x.textContent = val('epost') || o.email; });
    if (!doc.getElementById('dh-blocks')) { var bs = doc.createElement('style'); bs.id = 'dh-blocks'; bs.textContent = BLOCK_CSS; doc.head.appendChild(bs); }
    renderSections(doc);
  }
  var openRow = -1;
  function renderSections(doc) {
    var ol = $('dh-secs'); if (!ol) return;
    var html = secState.map(function (st, pos) {
      var opts = '<div class="dh-sec__opts"><span>Bakgrund</span>' + BG.map(function (o) { return '<button type="button" data-sec-bg="' + pos + ':' + o[0] + '"' + (st.bg === o[0] ? ' class="is-on"' : '') + '>' + o[1] + '</button>'; }).join('') +
        '<span>Luft</span>' + PAD.map(function (o) { return '<button type="button" data-sec-pad="' + pos + ':' + o[0] + '"' + (st.pad === o[0] ? ' class="is-on"' : '') + '>' + o[1] + '</button>'; }).join('') +
        (typeof st.k !== 'number' ? '<button type="button" class="dh-sec__del" data-sec-del="' + pos + '">Ta bort delen</button>' : '') + '</div>';
      return '<li class="dh-sec' + (st.on ? '' : ' is-off') + (openRow === pos ? ' is-open' : '') + (typeof st.k !== 'number' ? ' is-new' : '') + '"><div class="dh-sec__row"><label><input type="checkbox" data-sec-on="' + pos + '"' + (st.on ? ' checked' : '') + '><span>' + esc(label(doc, st)) + '</span></label>' +
        '<button type="button" data-sec-more="' + pos + '" aria-label="Inställningar för delen" aria-expanded="' + (openRow === pos) + '">⋯</button>' +
        '<button type="button" data-sec-up="' + pos + '" aria-label="Flytta upp"' + (pos === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" data-sec-down="' + pos + '" aria-label="Flytta ner"' + (pos === secState.length - 1 ? ' disabled' : '') + '>↓</button></div>' + opts + '</li>';
    }).join('');
    if (ol.__html !== html) { ol.innerHTML = html; ol.__html = html; }
    var used = secState.map(function (x) { return x.k; });
    $$('#dh-addblock option').forEach(function (op) { op.disabled = used.indexOf(op.value) >= 0; });
  }
  function secChanged(pos) { var doc = frameDoc(); if (doc) applySections(doc); save(); if (pos != null) scrollToSection(pos); }
  $('dh-secs').addEventListener('click', function (e) {
    var bt = e.target.closest('button'); if (!bt) return;
    var d = bt.dataset;
    if (d.secMore !== undefined) { openRow = openRow === +d.secMore ? -1 : +d.secMore; secChanged(); return; }
    if (d.secBg !== undefined || d.secPad !== undefined) {
      var parts = (d.secBg !== undefined ? d.secBg : d.secPad).split(':'), st = secState[+parts[0]];
      st[d.secBg !== undefined ? 'bg' : 'pad'] = parts[1]; secChanged(+parts[0]); return;
    }
    if (d.secDel !== undefined) { secState.splice(+d.secDel, 1); openRow = -1; secChanged(); return; }
    var up = d.secUp, i = +(up !== undefined ? up : d.secDown), j = up !== undefined ? i - 1 : i + 1;
    if (isNaN(i) || j < 0 || j >= secState.length) return;
    var t = secState[i]; secState[i] = secState[j]; secState[j] = t;
    if (openRow === i) openRow = j; else if (openRow === j) openRow = i;
    secChanged(j);
    var nb = $('dh-secs').querySelector('[data-sec-' + (up !== undefined ? 'up' : 'down') + '="' + j + '"]'); if (nb && !nb.disabled) nb.focus();
  });
  $('dh-secs').addEventListener('change', function (e) {
    var cb = e.target.closest('[data-sec-on]'); if (!cb) return;
    secState[+cb.dataset.secOn].on = cb.checked;
    secChanged(cb.checked ? +cb.dataset.secOn : null);
  });
  $('dh-addbtn').addEventListener('click', function () {
    var type = $('dh-addblock').value, doc = frameDoc();
    if (!type || !BLOCKS[type] || !doc || !secState) return;
    if (secState.some(function (x) { return x.k === type; })) return;
    secState.splice(Math.min(2, secState.length), 0, { k: type, on: true, bg: '', pad: '' });
    $('dh-addblock').value = '';
    secChanged(Math.min(2, secState.length - 1));
  });
  function scrollToSection(pos) { var doc = frameDoc(); if (!doc || !secState[pos]) return; var x = elOf(doc, secState[pos]); if (x && x.style.display !== 'none') x.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  var secCode = function () {
    return secState ? secState.map(function (x) { var c = (x.on ? '' : '~') + (typeof x.k === 'number' ? x.k : '+' + x.k); if (x.bg || x.pad) c += ':' + x.bg; if (x.pad) c += ':' + x.pad; return c; }).join('.') : '';
  };
  var secDefault = function () { return !secState || secState.every(function (x, i) { return x.on && x.k === i && !x.bg && !x.pad; }); };
  function parseSec(code, n) {
    var arr = code.split('.').map(function (x) {
      var on = x.charAt(0) !== '~', parts = x.replace('~', '').split(':'), k = parts[0].charAt(0) === '+' ? parts[0].slice(1) : +parts[0];
      return { k: k, on: on, bg: parts[1] || '', pad: parts[2] || '' };
    });
    var nums = arr.filter(function (x) { return typeof x.k === 'number'; });
    var ok = nums.length === n && nums.every(function (x) { return x.k >= 0 && x.k < n; }) && arr.every(function (x) { return typeof x.k === 'number' || BLOCKS[x.k]; });
    return ok ? arr : null;
  }
  var BLOCK_CSS = '.dhb{padding-block:clamp(56px,7vw,104px);background:var(--c-bg);color:var(--c-ink)}' +
    '.dhb h2{margin:0 0 14px;font-family:var(--font-r);font-weight:var(--w-r);letter-spacing:var(--tr-r);text-transform:var(--tt-r);color:var(--c-rubrik);font-size:calc(clamp(28px,3.4vw,46px)*var(--skala-r,1));line-height:1.08}' +
    '.dhb h3{margin:0 0 8px;font-family:var(--font-r);font-size:20px;color:var(--c-rubrik)}' +
    '.dhb p{margin:0 0 12px;color:var(--c-mut);font-size:var(--t-text,17px);line-height:1.6}' +
    '.dhb-cta{background:var(--c-p)}.dhb-cta h2,.dhb-cta p{color:var(--c-p-ink)}' +
    '.dhb-cta .wrap,.dhb-erbjudande .wrap{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:24px}' +
    '.dhb-btns{display:flex;flex-wrap:wrap;gap:10px}.dhb-ghost{background:transparent!important;border:1.5px solid currentColor!important;color:var(--c-p-ink)!important}' +
    '.dhb-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin-top:28px}' +
    '.dhb-card{margin:0;padding:28px;border-radius:var(--r-card,16px);background:var(--c-yta)}' +
    '.dhb-num b{display:block;margin-bottom:6px;font-family:var(--font-r);font-weight:var(--w-r);font-size:calc(56px*var(--skala-r,1));line-height:1;color:var(--c-siffra,var(--c-p))}.dhb-num span{color:var(--c-mut)}' +
    '.dhb-quote blockquote{margin:0 0 16px;font-size:18px;line-height:1.5;color:var(--c-ink)}.dhb-quote figcaption{font-weight:600;color:var(--c-mut)}' +
    '.dhb-narrow{max-width:860px}.dhb-faq details{padding:18px 0;border-top:1px solid var(--c-line)}.dhb-faq summary{cursor:pointer;font-weight:600;font-size:19px;color:var(--c-rubrik)}.dhb-faq details p{margin-top:10px}' +
    '.dhb-split{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}.dhb-split img,.dhb-ph{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--r-img,16px);background:var(--c-yta)}' +
    '.dhb-erbjudande{padding-block:30px;background:var(--c-a)}.dhb-erbjudande h2{margin:0;font-size:calc(26px*var(--skala-r,1));color:var(--c-a-ink)}' +
    '@media(max-width:800px){.dhb-grid,.dhb-split{grid-template-columns:1fr}}' +
    '.dh-bg-v{--c-yta:var(--c-ton);background:var(--c-bg)!important}' +
    '.dh-bg-t{--c-bg:var(--c-yta);background:var(--c-yta)!important}' +
    '.dh-bg-f{--c-bg:var(--c-p);--c-yta:rgba(255,255,255,.1);--c-ton:rgba(255,255,255,.1);--c-ink:var(--c-p-ink);--c-rubrik:var(--c-p-ink);--c-mut:var(--c-p-ink);--c-line:rgba(255,255,255,.22);--c-etikett:var(--c-p-ink);--c-siffra:var(--c-p-ink);--c-knapp:var(--c-p-ink);--c-knapp2:var(--c-p-ink);--c-knapp-ink:var(--c-p);background:var(--c-p)!important;color:var(--c-p-ink)}' +
    '.dh-bg-m{--c-bg:var(--c-dark);--c-yta:rgba(255,255,255,.07);--c-ton:rgba(255,255,255,.07);--c-ink:#eef0ec;--c-rubrik:#fff;--c-mut:rgba(255,255,255,.74);--c-line:rgba(255,255,255,.16);--c-etikett:#fff;--c-siffra:#fff;background:var(--c-dark)!important;color:#eef0ec}' +
    '.dh-bg-f :is(h2,h3,p,.etikett),.dh-bg-m :is(h2,h3,.etikett){color:inherit}' +
    '.dhb-cta .knapp-primar,.dh-bg-f .knapp-primar{background:var(--c-p-ink)!important;color:var(--c-p)!important;border-color:var(--c-p-ink)!important}' +
    '.dh-pad-k{padding-block:36px!important}.dh-pad-l{padding-block:150px!important}' +
    '.dhx-banner{position:relative;z-index:60;padding:10px 20px;background:var(--c-a);color:var(--c-a-ink);font:600 14px/1.4 var(--font-t);text-align:center}' +
    '.dhx-ring{position:fixed;right:20px;bottom:20px;z-index:90;display:flex;align-items:center;gap:8px;padding:14px 20px;border-radius:999px;background:var(--c-knapp,var(--c-p));color:var(--c-knapp-ink,#fff);font:700 15px var(--font-t);text-decoration:none;box-shadow:0 12px 30px -10px rgba(0,0,0,.45)}' +
    '.dhx-chat{position:fixed;right:20px;bottom:20px;z-index:91;width:60px;height:60px;border:0;border-radius:50%;background:var(--c-p);color:var(--c-p-ink);cursor:pointer;box-shadow:0 12px 30px -10px rgba(0,0,0,.45);display:grid;place-items:center}' +
    '.dhx-ring~.dhx-chat{bottom:86px}' +
    '.dhx-chatbox{position:fixed;right:20px;bottom:96px;z-index:92;width:320px;max-width:calc(100vw - 40px);border-radius:18px;background:#fff;color:#14171b;box-shadow:0 24px 60px -20px rgba(0,0,0,.5);font:15px/1.45 var(--font-t);overflow:hidden}' +
    '.dhx-ring~.dhx-chatbox{bottom:162px}.dhx-chatbox[hidden]{display:none}' +
    '.dhx-chatbox header{padding:14px 16px;background:var(--c-p);color:var(--c-p-ink);font-weight:700}.dhx-chatbox p{margin:14px 16px;padding:10px 12px;border-radius:12px 12px 12px 4px;background:#f1f2ef}' +
    '.dhx-chatbox input{display:block;width:calc(100% - 32px);margin:0 16px 10px;padding:10px 12px;border:1px solid #ddd;border-radius:10px;font:inherit}.dhx-chatbox small{display:block;margin:0 16px 14px;color:#777;font-size:12px}';

  // ---- extras on the page: offer bar at the top, call button, chat bubble
  function applyExtras(doc) {
    var o = originals(doc), phone = val('telefon') || o.phone, body = doc.body;
    var ban = doc.querySelector('.dhx-banner'), btxt = val('banner');
    if (btxt) { if (!ban) { ban = doc.createElement('div'); ban.className = 'dhx-banner'; body.insertBefore(ban, body.firstChild); } ban.textContent = btxt; }
    else if (ban) ban.remove();
    var ring = doc.querySelector('.dhx-ring');
    if (val('ring')) {
      if (!ring) { ring = doc.createElement('a'); ring.className = 'dhx-ring'; body.appendChild(ring); }
      ring.href = 'tel:' + phone.replace(/[^\d+]/g, '');
      if (ring.__dhPhone !== phone) ring.__dhPhone = phone, ring.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>Ring ' + esc(phone);
    } else if (ring) ring.remove();
    var chat = doc.querySelector('.dhx-chat'), box = doc.querySelector('.dhx-chatbox');
    if (val('chatt')) {
      if (!chat) {
        chat = doc.createElement('button'); chat.type = 'button'; chat.className = 'dhx-chat'; chat.setAttribute('aria-label', 'Chatta med oss');
        chat.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>';
        box = doc.createElement('div'); box.className = 'dhx-chatbox'; box.hidden = true;
        chat.addEventListener('click', function () { box.hidden = !box.hidden; });
        body.appendChild(chat); body.appendChild(box);
      }
      var nm = val('namn') || o.name;
      if (box.__dhName !== nm) box.__dhName = nm, box.innerHTML = '<header>' + esc(nm) + '</header><p>Hej! Vad kan vi hjälpa till med? Fråga om priser, tider eller vad som helst.</p><input placeholder="Skriv en fråga …" aria-label="Fråga"><small>Så här kan er AI-chatt se ut – den ingår i paketet Pro.</small>';
    } else { if (chat) chat.remove(); if (box) box.remove(); }
    // keep the call button before the chat in the page, so the chat sits above it
    if (ring && chat && ring.compareDocumentPosition(chat) & 2) body.insertBefore(ring, chat);
    if (!doc.getElementById('dh-blocks')) { var bs = doc.createElement('style'); bs.id = 'dh-blocks'; bs.textContent = BLOCK_CSS; doc.head.appendChild(bs); }
  }

  // ---- which page of the example site the preview shows
  var pageSel = $('dh-page'), pendingPage = '';
  function pageOf(doc) { var f = doc.location.pathname.split('/').pop(); return f || 'index.html'; }
  function syncPages(doc) {
    var cur = pageOf(doc);
    if (cur === 'index.html' || !pageSel.__mall || pageSel.__mall !== current()) {
      if (cur === 'index.html') {
        var seen = { 'index.html': 1 }, opts = [['index.html', 'Startsidan']];
        $$('.head .nav a, .meny-huvud a', doc).forEach(function (a) { var h = (a.getAttribute('href') || '').split('#')[0]; if (h && /\.html$/.test(h) && !seen[h]) { seen[h] = 1; opts.push([h, (a.__dhOrig || a.textContent).trim()]); } });
        pageSel.innerHTML = opts.map(function (x) { return '<option value="' + esc(x[0]) + '">' + esc(x[1]) + '</option>'; }).join('');
        pageSel.__mall = current();
      }
    }
    if (!$$('option', pageSel).some(function (op) { return op.value === cur; })) { var op = document.createElement('option'); op.value = cur; op.textContent = cur.replace('.html', ''); pageSel.appendChild(op); }
    pageSel.value = cur;
  }
  pageSel.addEventListener('change', function () { frame.src = base + 'exempel/' + current() + '/' + pageSel.value; watch(); save(); });

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

  // ---- edit anything in the page: type straight into it, or click an element and change its size, weight, alignment,
  // colours or picture, or hide it. Kept per template and page in `edits` – in the link (not the pictures) and in this browser
  var editBox = $('dh-edit'), editBtn = $('dh-editbtn'), tool = $('dh-tool'), edits = {}, undoStack = [], sel = null;
  var picker = document.createElement('input'); picker.type = 'file'; picker.accept = 'image/png,image/jpeg,image/webp';
  var NAMES = { H1: 'Stor rubrik', H2: 'Rubrik', H3: 'Underrubrik', H4: 'Underrubrik', P: 'Text', A: 'Länk eller knapp', IMG: 'Bild', LI: 'Punkt i lista',
    SPAN: 'Text', SECTION: 'Del av sidan', HEADER: 'Menyraden', FOOTER: 'Sidfoten', BUTTON: 'Knapp', BLOCKQUOTE: 'Citat', FIGURE: 'Kort', FIGCAPTION: 'Bildtext',
    UL: 'Lista', OL: 'Lista', NAV: 'Meny', DIV: 'Ruta', B: 'Fet text', STRONG: 'Fet text', SUMMARY: 'Fråga', DETAILS: 'Fråga och svar', LABEL: 'Text' };
  var TEXTY = /^(H[1-6]|P|A|LI|SPAN|B|STRONG|EM|I|BLOCKQUOTE|FIGCAPTION|SUMMARY|BUTTON|LABEL|TD|TH|DT|DD|SMALL)$/;
  var ANCH = { R: '.hero', H: '.head', T: '.topprad', M: '.meny', F: 'footer' };
  function anchorOf(doc, el) {
    var secs = sections(doc);
    for (var x = el; x && x !== doc.body && x !== doc.documentElement; x = x.parentElement) {
      var i = secs.indexOf(x); if (i >= 0) return ['s' + i, x];
      if (x.classList.contains('dhx-banner') || x.classList.contains('dhx-ring') || x.classList.contains('dhx-chat') || x.classList.contains('dhx-chatbox') || x.classList.contains('demo-rad')) return null;
      if (x.classList.contains('dhb')) return ['b' + x.className.replace(/.*\bdhb-([a-z]+).*/, '$1'), x];
      for (var k in ANCH) if (x.matches(ANCH[k])) return [k, x];
    }
    return null;
  }
  function keyOf(doc, el) {
    var an = anchorOf(doc, el); if (!an) return '';
    var path = [];
    for (var x = el; x !== an[1]; x = x.parentElement) path.unshift(Array.prototype.indexOf.call(x.parentElement.children, x));
    return current() + '/' + pageOf(doc) + '|' + an[0] + (path.length ? '/' + path.join('.') : '');
  }
  var KEY_RE = /^([a-z-]+)\/([a-z0-9-]+\.html)\|(s\d{1,2}|b[a-z]{2,12}|[RHTMF])(?:\/([\d.]{1,80}))?$/;
  function findKey(doc, key) {
    var m = KEY_RE.exec(key);
    if (!m || m[1] !== current() || m[2] !== pageOf(doc)) return null;
    var an = m[3], el = an.charAt(0) === 's' ? sections(doc)[+an.slice(1)] : an.charAt(0) === 'b' && an.length > 1 ? doc.querySelector('.dhb-' + an.slice(1)) : doc.querySelector(ANCH[an]);
    (m[4] ? m[4].split('.') : []).forEach(function (i) { el = el && el.children[+i]; });
    return el || null;
  }
  // only safe values are kept, whether they come from the page or from a shared link
  function cleanRec(r, withSrc) {
    var o = {};
    if (!r || typeof r !== 'object') return o;
    if (typeof r.t === 'string') o.t = r.t.slice(0, 600);
    if (isHex(r.c)) o.c = r.c; if (isHex(r.b)) o.b = r.b;
    if (/^\d{1,3}px$/.test(r.fs)) o.fs = r.fs;
    if (r.fw === '400' || r.fw === '700') o.fw = r.fw;
    if (r.fi === 'normal' || r.fi === 'italic') o.fi = r.fi;
    if (/^(left|center|right)$/.test(r.ta)) o.ta = r.ta;
    if (r.h === 1) o.h = 1;
    if (withSrc && typeof r.src === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(r.src)) o.src = r.src;
    return o;
  }
  function cleanEdits(e, withSrc) {
    var out = {};
    if (!e || typeof e !== 'object') return out;
    Object.keys(e).slice(0, 300).forEach(function (k) { if (KEY_RE.test(k)) { var r = cleanRec(e[k], withSrc); if (Object.keys(r).length) out[k] = r; } });
    return out;
  }
  function setTextKeep(el, t) { // replace an element's words but keep icons and other child elements
    var tn = $$('*', el).length ? Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 3 && n.nodeValue.trim(); }) : null;
    if (!tn) { if (el.textContent !== t) el.textContent = t; return; }
    if (tn.length) { tn[0].nodeValue = t; tn.slice(1).forEach(function (n) { n.nodeValue = ''; }); }
  }
  function styleEl(el, r, withText) {
    el.style.color = r.c || ''; el.style.backgroundColor = r.b || ''; el.style.fontSize = r.fs || '';
    el.style.fontWeight = r.fw || ''; el.style.fontStyle = r.fi || ''; el.style.textAlign = r.ta || '';
    el.classList.toggle('dh-hid', !!r.h);
    if (r.src && el.tagName === 'IMG') { el.removeAttribute('srcset'); if (el.getAttribute('src') !== r.src) el.src = r.src; el.__dhUser = true; }
    if (withText && r.t != null) { setTextKeep(el, r.t); for (var x = el; x && x.nodeType === 1; x = x.parentNode) x.__dhUser = true; }
  }
  function applyEdits(doc, withText) {
    Object.keys(edits).forEach(function (k) { var el = findKey(doc, k); if (el) styleEl(el, edits[k], withText); });
  }
  function pushUndo() { undoStack.push(JSON.stringify(edits)); if (undoStack.length > 60) undoStack.shift(); $('dh-undo').disabled = false; }
  function reloadFrame() { var doc = frameDoc(); sel = null; if (doc) { frame.src = doc.location.href.split('#')[0]; watch(); } }

  function setupEdit(doc) {
    doc.designMode = editBox.checked ? 'on' : 'off';
    if (doc.__dhEdit) return; doc.__dhEdit = true;
    doc.addEventListener('click', function (e) {
      if (doc.designMode !== 'on') return;
      var t = e.target; if (!t || t.nodeType !== 1) return;
      if (t.closest('a, button')) e.preventDefault();
      if (t.closest('.dhx-chat, .dhx-ring, .dhx-banner, .dhx-chatbox, .demo-rad')) return;
      select(doc, t);
    }, true);
    var typing = 0;
    doc.addEventListener('input', function () {
      var s2 = doc.getSelection(), n = s2 && s2.anchorNode, el = n && (n.nodeType === 1 ? n : n.parentNode);
      for (var x = el; x && x !== doc.body; x = x.parentNode) x.__dhUser = true; // text typed by the visitor is theirs: the form no longer overwrites it
      while (el && el !== doc.body && !TEXTY.test(el.tagName)) el = el.parentNode;
      if (!el || el === doc.body) return;
      var key = keyOf(doc, el); if (!key) return;
      if (Date.now() - typing > 1500) pushUndo(); typing = Date.now();
      (edits[key] || (edits[key] = {})).t = el.textContent.slice(0, 600);
      clearTimeout(timer); timer = setTimeout(save, 400);
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') select(doc, null); });
  }
  function rgbHex(c) { var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c || ''); if (!m || m[4] === '0') return ''; return hexOf(+m[1], +m[2], +m[3]); }
  function select(doc, el) {
    if (sel && sel.ownerDocument === doc) sel.classList.remove('dh-sel');
    sel = el && el !== doc.body && el !== doc.documentElement && keyOf(doc, el) ? el : null;
    var on = !!sel;
    $$('[data-t]', tool).forEach(function (b) { if (!/^(undo)$/.test(b.dataset.t)) b.disabled = !on; });
    if (!on) { $('dh-tool-name').textContent = 'Klicka på något i sidan för att ändra det'; return; }
    sel.classList.add('dh-sel');
    var cs = doc.defaultView.getComputedStyle(sel), r = edits[keyOf(doc, sel)] || {};
    $('dh-tool-name').textContent = (NAMES[sel.tagName] || 'Del') + (sel.tagName === 'IMG' ? '' : sel.textContent.trim() ? ': ”' + sel.textContent.trim().slice(0, 26) + (sel.textContent.trim().length > 26 ? '…' : '') + '”' : '');
    tool.querySelector('[data-t="c"]').value = r.c || rgbHex(cs.color) || '#111111';
    tool.querySelector('[data-t="b"]').value = r.b || rgbHex(cs.backgroundColor) || '#ffffff';
    tool.querySelector('[data-t="img"]').hidden = sel.tagName !== 'IMG';
    tool.querySelector('[data-t="bold"]').classList.toggle('is-on', +cs.fontWeight >= 600);
    tool.querySelector('[data-t="italic"]').classList.toggle('is-on', cs.fontStyle === 'italic');
    ['left', 'center', 'right'].forEach(function (a) { tool.querySelector('[data-t="' + a + '"]').classList.toggle('is-on', cs.textAlign === a || (a === 'left' && cs.textAlign === 'start')); });
  }
  function change(fn) {
    var doc = frameDoc(); if (!doc || !sel) return;
    var key = keyOf(doc, sel); if (!key) return;
    pushUndo();
    var r = edits[key] || (edits[key] = {});
    fn(r, doc.defaultView.getComputedStyle(sel));
    Object.keys(r).forEach(function (k) { if (r[k] === '' || r[k] == null) delete r[k]; });
    if (!Object.keys(r).length) delete edits[key];
    styleEl(sel, r, false);
    select(doc, sel);
    save();
  }
  tool.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-t]'); if (!b || b.disabled) return;
    var t = b.dataset.t, doc = frameDoc();
    if (t === 'undo') { if (undoStack.length) { edits = cleanEdits(JSON.parse(undoStack.pop()), true); $('dh-undo').disabled = !undoStack.length; save(); reloadFrame(); } return; }
    if (t === 'up') { if (sel && sel.parentElement && doc && keyOf(doc, sel.parentElement)) select(doc, sel.parentElement); return; }
    if (t === 'img') { picker.click(); return; }
    change(function (r, cs) {
      var fs = parseFloat(cs.fontSize) || 16;
      if (t === 'bigger') r.fs = Math.min(200, Math.round(fs * 1.12)) + 'px';
      if (t === 'smaller') r.fs = Math.max(9, Math.round(fs / 1.12)) + 'px';
      if (t === 'bold') r.fw = +cs.fontWeight >= 600 ? '400' : '700';
      if (t === 'italic') r.fi = cs.fontStyle === 'italic' ? 'normal' : 'italic';
      if (t === 'left' || t === 'center' || t === 'right') r.ta = t;
      if (t === 'hide') { r.h = 1; }
      if (t === 'reset') { Object.keys(r).forEach(function (k) { if (k !== 't') delete r[k]; }); }
    });
    if (t === 'hide' && doc) select(doc, null);
  });
  tool.addEventListener('input', function (e) {
    var inp = e.target.closest('input[type=color][data-t]'); if (!inp || !sel) return;
    change(function (r) { r[inp.dataset.t] = inp.value; });
  });
  picker.addEventListener('change', function () {
    if (!sel || sel.tagName !== 'IMG' || !picker.files[0]) return;
    var target = sel;
    readImage(picker.files[0], 1600, function (url) {
      if (sel !== target) return;
      change(function (r) { r.src = url; });
      picker.value = '';
    });
  });
  function setEditMode(on) {
    editBox.checked = on;
    editBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); editBtn.classList.toggle('is-on', on);
    tool.hidden = !on;
    screen.classList.toggle('is-edit', on);
    var doc = frameDoc(); if (doc) { if (!on) select(doc, null); setupEdit(doc); apply(); if (on) select(doc, null); }
    fit();
  }
  editBox.addEventListener('change', function () { setEditMode(editBox.checked); });
  editBtn.addEventListener('click', function () { setEditMode(!editBox.checked); });
  $('dh-showhidden').addEventListener('click', function () {
    pushUndo(); Object.keys(edits).forEach(function (k) { delete edits[k].h; if (!Object.keys(edits[k]).length) delete edits[k]; });
    var doc = frameDoc(); if (doc) $$('.dh-hid', doc).forEach(function (x) { x.classList.remove('dh-hid'); }); save();
  });
  $('dh-resetedits').addEventListener('click', function () { pushUndo(); edits = {}; save(); reloadFrame(); });

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

  // the example sites fade parts in as they scroll into view and load far-down pictures late; in the preview
  // that looks like loading, so everything is shown straight away and every picture is fetched at once
  var PREP_CSS = '.reveal,.reveal *{transition:none!important}';
  function prep(doc) {
    if (doc.__dhPrep) return; doc.__dhPrep = true;
    var st = doc.createElement('style'); st.textContent = PREP_CSS; (doc.head || doc.documentElement).appendChild(st);
    $$('.reveal', doc).forEach(function (el) { el.classList.add('syns'); });
    $$('img[loading]', doc).forEach(function (im) { im.loading = 'eager'; });
  }
  function init(doc) {
    if (doc.__dhInit) return; doc.__dhInit = doc.__dhSeen = true;
    prep(doc);
    if (pendingSec) { // a shared link: the parts' order for this template
      if (isStart(doc)) { var arr = parseSec(pendingSec, sections(doc).length); if (arr) secState = arr; pendingSec = ''; }
    }
    if (pendingNav) { pendingNav.split('|').forEach(function (x) { var k = x.indexOf('~'); if (k > 0) navState[+x.slice(0, k)] = x.slice(k + 1); }); pendingNav = ''; }
    setupEdit(doc); syncPages(doc); apply(); applyEdits(doc, true); save();
    warm();
  }
  // catch the new page while it is still being parsed and take it over at DOMContentLoaded (the stylesheets
  // have loaded by then), instead of waiting for every picture
  function watch() {
    var n = 0;
    (function tick() {
      var d; try { d = frame.contentDocument; } catch (e) { return; }
      if (d && !d.__dhSeen && d.URL !== 'about:blank' && /\/exempel\//.test(d.URL)) {
        d.__dhSeen = true; // a page already past parsing (the old one, or a very quick load) is left to the load event
        if (d.readyState === 'loading') { d.addEventListener('DOMContentLoaded', function () { if (d.body) init(d); }); return; }
      }
      if (++n < 900) requestAnimationFrame(tick);
    })();
  }
  // the other templates, fetched quietly once the first one shows, so switching is instant
  var warmed = false;
  function warm() {
    if (warmed) return; warmed = true;
    var later = window.requestIdleCallback || function (cb) { return setTimeout(cb, 1200); };
    later(function () {
      $$('input[name=mall]', form).forEach(function (r, i) {
        var dir = base + 'exempel/' + r.value + '/';
        setTimeout(function () {
          fetch(dir + 'index.html', { priority: 'low' }).then(function (res) { return res.ok ? res.text() : ''; }).then(function (html) {
            var m = html.match(/<img[^>]*fetchpriority[^>]*>/), src = m && m[0].match(/\ssrc="([^"]+)"/);
            var tok = html.match(/href="(assets\/tokens\.css[^"]*)"/);
            if (src) fetch(dir + src[1], { priority: 'low' }).catch(function () {});
            if (tok) fetch(dir + tok[1], { priority: 'low' }).catch(function () {});
          }).catch(function () {});
        }, i * 250);
      });
    });
  }
  function load() { secState = null; navState = {}; openRow = -1; $('dh-navs').__key = ''; frame.src = base + 'exempel/' + current() + '/' + (pendingPage && /^[a-z0-9-]+\.html$/.test(pendingPage) ? pendingPage : 'index.html'); pendingPage = ''; watch(); }
  frame.addEventListener('load', function () {
    var doc = frameDoc(); if (!doc) return;
    init(doc); // if it was not caught earlier
  });

  // ---- settings in the address (not the images), so a design can be shared or sent with an enquiry
  var KEYS = ['namn', 'bransch', 'ort', 'rubrik', 'ingress', 'slogan', 'telefon', 'epost', 'tider', 'knapptext', 'tjanst1', 'tjanst2', 'tjanst3',
    'mall', 'farg', 'farg-egen', 'accent', 'accent-egen', 'typsnitt', 'tema', 'horn', 'knapp', 'meny', 'rubrikstil', 'motiv',
    'herotext', 'kursiv', 'kort', 'nyheter', 'skala', 'text', 'bredd',
    'loggtext', 'loggfont', 'loggversal', 'loggskala', 'vikt', 'sparr', 'navversal', 'btnversal', 'ljus', 'topprad', 'sok', 'rorelse', 'banner', 'ring', 'chatt'];
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
    if (pageSel.value && pageSel.value !== 'index.html') q.set('sida', pageSel.value);
    $$('.dh-cc input[type=color]').forEach(function (inp) { if (inp.dataset.on) q.set(inp.name, inp.value); });
    var plain = q.toString(), linkEd = cleanEdits(edits, false);
    if (Object.keys(linkEd).length) q.set('ed', JSON.stringify(linkEd));
    try { history.replaceState(null, '', location.pathname + location.search + (q.toString() ? '#' + q.toString() : '')); } catch (e) {}
    lastPlain = plain; store(plain);
    var link = location.href.length > 1500 ? location.origin + location.pathname + (plain ? '#' + plain : '') + ' (texterna jag skrev direkt i sidan fick inte plats i länken)' : location.href;
    var msg = 'Hej! Jag testade "Se hur din hemsida kan se ut" och vill ha en offert på något liknande. Min design: ' + link;
    var o = new URLSearchParams({ meddelande: msg });
    if (val('namn')) o.set('foretag', val('namn'));
    if (val('telefon')) o.set('telefon', val('telefon'));
    if (val('epost')) o.set('email', val('epost'));
    $('dh-offert').href = base + 'kontakt.html?' + o.toString() + '#formular';
  }
  // the whole design, pictures too, is kept in this browser so it is still there next time
  var STORE = 'dh-design-v1';
  var storeTimer;
  function store(plain) { clearTimeout(storeTimer); storeTimer = setTimeout(function () { storeNow(plain); }, 600); }
  addEventListener('pagehide', function () { if (storeTimer) { clearTimeout(storeTimer); storeNow(lastPlain); } });
  var lastPlain = '';
  function storeNow(plain) {
    storeTimer = null; lastPlain = plain;
    var data = { h: plain, e: cleanEdits(edits, true), i: imgs };
    try { localStorage.setItem(STORE, JSON.stringify(data)); }
    catch (e) { try { data.e = cleanEdits(edits, false); data.i = { logga: '', bild: [] }; localStorage.setItem(STORE, JSON.stringify(data)); } catch (e2) {} }
  }
  function fromStore() {
    if (location.hash.length > 1) return;
    var d; try { d = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return; }
    if (!d || typeof d.h !== 'string') return;
    try { history.replaceState(null, '', location.pathname + location.search + (d.h ? '#' + d.h : '')); } catch (e) {}
    edits = cleanEdits(d.e, true);
    var ok = function (u) { return typeof u === 'string' && /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(u) ? u : ''; };
    if (d.i) {
      imgs.logga = ok(d.i.logga);
      imgs.bild = Array.isArray(d.i.bild) ? d.i.bild.map(ok).filter(Boolean).slice(0, 3) : [];
      if (imgs.logga) { var pv = form.elements.logga.parentNode.querySelector('.dh-up__img'); pv.src = imgs.logga; pv.hidden = false; logoSize.hidden = false; logoColours(imgs.logga); }
      if (imgs.bild.length) document.querySelector('[data-dh-thumbs]').innerHTML = imgs.bild.map(function (u) { return '<img src="' + u + '" alt="">'; }).join('');
    }
    $('dh-saved').hidden = !(d.h || Object.keys(edits).length || imgs.logga || imgs.bild.length);
  }
  function restore() {
    var q = new URLSearchParams(location.hash.slice(1)); if (!q.toString()) return;
    q.forEach(function (v, k) {
      if (k === 'delar') { pendingSec = v; return; }
      if (k === 'nav') { pendingNav = v; return; }
      if (k === 'sida') { pendingPage = v; return; }
      if (k === 'ed') { try { edits = cleanEdits(JSON.parse(v), false); } catch (e) {} return; }
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
    if (e.target.name === 'mall' || e.target.type === 'file' || e.target.closest('#dh-secs') || e.target.closest('#dh-navs') || e.target === editBox || e.target === pageSel || e.target.id === 'dh-addblock') return;
    if (CC[e.target.name]) e.target.dataset.on = '1';
    marks();
    var lookOnly = !/^(text|tel|email|search)$/.test(e.target.type || '') && e.target.tagName !== 'TEXTAREA';
    clearTimeout(timer); timer = setTimeout(function () { requestAnimationFrame(function () { apply(lookOnly); save(); }); }, lookOnly ? 40 : 100);
  });
  form.addEventListener('change', function (e) {
    if (e.target.closest('#dh-secs') || e.target.closest('#dh-navs') || e.target === editBox || e.target === pageSel || e.target.id === 'dh-addblock') return;
    if (CC[e.target.name]) { e.target.dataset.on = '1'; apply(true); save(); return; }
    if (e.target.name === 'mall') { marks(); load(); save(); }
    else if (e.target.tagName === 'SELECT' || e.target.type === 'radio') { marks(); apply(true); save(); }
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

  $('dh-wipe').addEventListener('click', function () {
    try { localStorage.removeItem(STORE); } catch (e) {}
    location.href = location.pathname;
  });

  // ---- share
  var share = $('dh-share');
  share.addEventListener('click', function () {
    save();
    var done = function () { share.textContent = 'Länken är kopierad'; setTimeout(function () { share.textContent = 'Kopiera länk till designen'; }, 2200); };
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, function () { prompt('Kopiera länken:', location.href); });
    else prompt('Kopiera länken:', location.href);
  });

  // "Få en offert för den här sidan": straight to the contact form, with the design link in the message
  form.addEventListener('submit', function (e) { e.preventDefault(); apply(); save(); storeNow(lastPlain); location.href = $('dh-offert').href; });

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

  // ---- guided start (from the start page): five quick questions, a short "building" animation, then the preview
  var guide = $('dh-guide'), guideWanted = /(^|[#&])guide=1(&|$)/.test(location.hash);
  function openGuide() {
    if (!guide) return;
    var step = 1, N = 5, ans = {};
    var steps = $$('[data-g-step]', guide), dots = $$('.dhg__dots i', guide), next = guide.querySelector('[data-g-next]'), back = guide.querySelector('[data-g-back]');
    var name = val('namn');
    if (name) guide.querySelector('[data-g-hello]').textContent = 'Hej ' + name + '! Svara så bygger vi ihop ett första förslag. Ni kan ändra allt efteråt.';
    $$('[data-g-input]', guide).forEach(function (inp) { var v = val(inp.dataset.gInput); if (v) inp.value = v; });
    function show() {
      steps.forEach(function (s) { s.hidden = +s.dataset.gStep !== step; });
      dots.forEach(function (d, i) { d.classList.toggle('is-on', i < step); });
      back.hidden = step === 1;
      next.querySelector('span').textContent = step === N ? 'Bygg min hemsida' : 'Nästa';
      var f = guide.querySelector('[data-g-step="' + step + '"] input'); if (f && matchMedia('(min-width: 700px)').matches) setTimeout(function () { f.focus(); }, 50);
    }
    guide.addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]');
      if (b && b.closest('[data-g-pick]')) {
        var key = b.closest('[data-g-pick]').dataset.gPick;
        $$('[data-v]', b.closest('[data-g-pick]')).forEach(function (x) { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', x === b); });
        ans[key] = b.dataset.v;
        if (key === 'bransch') { var t = guide.querySelector('[data-g-input="bransch"]'); if (t) t.value = ''; }
        if (key !== 'bransch' && step < N) setTimeout(function () { step++; show(); }, 220);
      }
    });
    guide.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); next.click(); } });
    back.addEventListener('click', function () { if (step > 1) { step--; show(); } });
    next.addEventListener('click', function () { if (step < N) { step++; show(); } else build(); });
    guide.querySelector('[data-g-skip]').addEventListener('click', function () { build(true); });
    function set(k, v) { var el = form.elements[k]; if (!el) return; if (el.length && !el.tagName) { for (var i = 0; i < el.length; i++) el[i].checked = el[i].value === v; } else el.value = v; }
    function build(skipped) {
      $$('[data-g-input]', guide).forEach(function (inp) { if (inp.value.trim()) ans[inp.dataset.gInput] = inp.value.trim(); });
      ['bransch', 'ort', 'telefon'].forEach(function (k) { if (ans[k]) set(k, ans[k]); });
      if (ans.farg !== undefined) set('farg', ans.farg);
      var newMall = ans.mall && ans.mall !== current();
      if (ans.mall) set('mall', ans.mall);
      marks();
      if (newMall) load(); else apply();
      save();
      // the building animation (shorter for people who have asked for less motion)
      var card = guide.querySelector('.dhg__card'), anim = guide.querySelector('[data-g-build]'), status = guide.querySelector('[data-g-status]'), bar = guide.querySelector('[data-g-bar]'), list = guide.querySelector('[data-g-list]');
      card.hidden = true; anim.hidden = false;
      var who = val('namn') || 'ert företag';
      var lines = ['Väljer layout och bilder', 'Lägger in ' + who, 'Sätter färger och typsnitt', 'Skriver in era uppgifter', 'Anpassar för mobilen'];
      var total = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1500 : 5000, t0 = Date.now(), shown = 0;
      list.innerHTML = '';
      (function tick() {
        var p = Math.min(1, (Date.now() - t0) / total);
        bar.style.width = Math.round(p * 100) + '%';
        var due = Math.min(lines.length, Math.floor(p * (lines.length + 1)));
        while (shown < due) { var li = document.createElement('li'); li.textContent = lines[shown]; list.appendChild(li); shown++; status.textContent = lines[Math.min(shown, lines.length - 1)] + ' …'; }
        if (p < 1) return requestAnimationFrame(tick);
        status.textContent = 'Klart! Här är ert förslag.';
        setTimeout(function () {
          guide.classList.add('is-leaving');
          setTimeout(function () { guide.hidden = true; document.documentElement.classList.remove('dhg-open'); fit(); var s = $('dh-screen'); if (s && s.scrollIntoView && matchMedia('(max-width: 1100px)').matches) s.scrollIntoView({ block: 'start' }); }, 450);
        }, 700);
      })();
    }
    guide.hidden = false; document.documentElement.classList.add('dhg-open');
    show();
  }

  fromStore();
  restore();
  marks();
  fit();
  load();
  save();
  if (guideWanted) openGuide();
})();
