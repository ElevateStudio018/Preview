// "Se hur din hemsida kan se ut": the visitor fills in their company, picks colours, fonts and style and can add a logo
// and a photo; one of our example sites (same origin, in a frame) is rewritten live. Nothing is saved or sent – the
// settings (not the images) live in the address, so the design can be shared or sent along with an enquiry.
(function () {
  var form = document.getElementById('dh-form');
  var frame = document.getElementById('dh-frame');
  var screen = document.getElementById('dh-screen');
  if (!form || !frame || !screen) return;
  var base = frame.dataset.base || '';
  var imgs = { logga: '', bild: '' }; // data URLs, only in this tab

  // ---- helpers
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var val = function (n) {
    var el = form.elements[n]; if (!el) return '';
    if (el.length && !el.tagName) { for (var i = 0; i < el.length; i++) if (el[i].checked) return el[i].value; return ''; }
    if (el.type === 'radio') return el.checked ? el.value : '';
    return (el.value || '').trim();
  };
  var rgb = function (hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  var shade = function (hex, f) { // f < 0 darker, f > 0 lighter
    return '#' + rgb(hex).map(function (c) { return Math.max(0, Math.min(255, Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f))).toString(16).padStart(2, '0'); }).join('');
  };
  var light = function (hex) { var c = rgb(hex).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2] > .4; };
  var inkOn = function (hex) { return light(hex) ? '#14171b' : '#ffffff'; };
  var isHex = function (v) { return /^#[0-9a-f]{6}$/i.test(v); };
  var colour = function (n) { var v = val(n); return v === 'egen' ? val(n + '-egen') : v; };
  var current = function () { return val('mall') || 'saltvind'; };

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
    o.body = {}; ['knapp', 'header', 'rubrik', 'motiv'].forEach(function (k) { o.body[k] = doc.body.getAttribute('data-' + k); });
    return (doc.__dh = o);
  }
  // set an element's text and remember the original, so clearing the field brings it back
  function setText(el, v) {
    if (!el) return;
    if (el.__dhOrig === undefined) el.__dhOrig = el.textContent;
    var t = v || el.__dhOrig;
    if (el.textContent !== t) el.textContent = t;
  }

  function apply() {
    var doc; try { doc = frame.contentDocument; } catch (e) { return; }
    if (!doc || !doc.body) return;
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
    var walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT), node, orig = doc.__dhText || (doc.__dhText = new Map());
    while ((node = walk.nextNode())) {
      if (node.parentNode && node.parentNode.closest && node.parentNode.closest('.logga .ord')) continue; // the logo is set below
      if (!orig.has(node)) orig.set(node, node.nodeValue);
      var v = orig.get(node);
      swaps.forEach(function (s) { if (v.indexOf(s[0]) >= 0) v = v.split(s[0]).join(s[1]); });
      if (node.nodeValue !== v) node.nodeValue = v;
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
          var t = shortName || w.__dhOrig;
          if (im || w.textContent !== t) w.textContent = t;
        }
      }
      setText(l.querySelector('.tag'), val('slogan') || (area ? 'Hemma i ' + area : ''));
    });

    // 3. the start page: heading, text, label, menu button, three services, photo
    var hero = doc.querySelector('.hero') || doc.querySelector('main');
    if (hero) {
      setText(hero.querySelector('h1'), val('rubrik'));
      setText(hero.querySelector('.ingress'), val('ingress'));
      setText(hero.querySelector('.etikett'), branch ? branch + (area ? ' i ' + area : '') : '');
      var pic = hero.querySelector('img');
      if (pic) {
        if (pic.__dhSrc === undefined) { pic.__dhSrc = pic.getAttribute('src'); pic.__dhSet = pic.getAttribute('srcset') || ''; }
        if (imgs.bild) { pic.removeAttribute('srcset'); pic.src = imgs.bild; }
        else if (pic.getAttribute('src') !== pic.__dhSrc) { pic.src = pic.__dhSrc; if (pic.__dhSet) pic.setAttribute('srcset', pic.__dhSet); }
      }
    }
    var btn = doc.querySelector('.head-kontakt'); if (btn) setText(btn.querySelector('span') || btn, val('knapptext'));
    var list = $$('main a[href^="verksamhet.html"] h3', doc);
    if (!list.length) { var ul = $$('main section ul', doc).filter(function (u) { return u.querySelector('li h3') && !u.closest('.hero'); })[0]; list = ul ? $$('li h3', ul) : []; }
    ['tjanst1', 'tjanst2', 'tjanst3'].forEach(function (k, i) { setText(list[i], val(k)); });

    // 4. the look: colours, theme, fonts, corners, and the template's own style switches
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
    var f = FONTS[val('typsnitt')];
    if (f) css.push('--font-r:' + f[0] + ', system-ui, sans-serif', '--font-logo:' + f[0] + ', system-ui, sans-serif', '--font-t:' + f[1] + ', system-ui, sans-serif',
      '--w-r:' + f[2], '--w-logo:' + Math.max(f[2], 400), '--tr-r:' + f[3], '--tt-r:' + f[4], '--tt-nav:' + (f[4] === 'uppercase' ? 'uppercase' : 'none'),
      '--tt-btn:' + (f[4] === 'uppercase' ? 'uppercase' : 'none'), '--skala-r:' + f[5]);
    var c = CORNERS[val('horn')]; if (c) css.push('--r-btn:' + c[0], '--r-card:' + c[1], '--r-img:' + c[2]);
    var st = doc.getElementById('dh-style');
    if (!st) { st = doc.createElement('style'); st.id = 'dh-style'; doc.head.appendChild(st); }
    st.textContent = css.length ? ':root{' + css.join(';') + '}' : '';
    var sw = { knapp: val('knapp'), header: val('meny'), rubrik: val('rubrikstil'), motiv: val('motiv') };
    Object.keys(sw).forEach(function (k) { var v = sw[k] || o.body[k]; if (v) doc.body.setAttribute('data-' + k, v); });
    // the fonts come from our own server (the site's security policy blocks Google's)
    if (!doc.getElementById('dh-fonts')) { var lk = doc.createElement('link'); lk.id = 'dh-fonts'; lk.rel = 'stylesheet'; lk.href = '../typsnitt/typsnitt.css'; doc.head.appendChild(lk); }

    var dom = email.indexOf('@') > 0 ? email.split('@')[1] : (shortName ? shortName.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '') + '.se' : 'dittforetag.se');
    document.getElementById('dh-url').textContent = dom;
  }

  // ---- keep the chosen card / chip / swatch marked
  function marks() {
    $$('.dh-tpl, .dh-chip, .dh-font, .dh-color').forEach(function (l) { var i = l.querySelector('input[type=radio]'); l.classList.toggle('is-on', !!(i && i.checked)); });
    $$('.dh-color--egen').forEach(function (l) { l.querySelector('i').style.background = l.querySelector('input[type=color]').value; });
  }
  // a custom colour picker counts as choosing that swatch
  $$('.dh-color--egen input[type=color]').forEach(function (inp) {
    var group = inp.name.replace('-egen', '');
    var r = document.createElement('input'); r.type = 'radio'; r.name = group; r.value = 'egen'; r.hidden = true; inp.parentNode.appendChild(r);
    inp.addEventListener('input', function () { r.checked = true; marks(); });
  });

  function load() { frame.src = base + 'exempel/' + current() + '/index.html'; }
  frame.addEventListener('load', apply);

  // ---- settings in the address (not the images), so a design can be shared or sent with an enquiry
  var KEYS = ['namn', 'bransch', 'ort', 'rubrik', 'ingress', 'slogan', 'telefon', 'epost', 'tider', 'knapptext', 'tjanst1', 'tjanst2', 'tjanst3',
    'mall', 'farg', 'farg-egen', 'accent', 'accent-egen', 'typsnitt', 'tema', 'horn', 'knapp', 'meny', 'rubrikstil', 'motiv'];
  function save() {
    var q = new URLSearchParams();
    KEYS.forEach(function (k) {
      var v = val(k);
      if (!v || (k === 'mall' && v === 'saltvind')) return;
      if (/-egen$/.test(k) && val(k.replace('-egen', '')) !== 'egen') return;
      q.set(k, v);
    });
    try { history.replaceState(null, '', location.pathname + location.search + (q.toString() ? '#' + q.toString() : '')); } catch (e) {}
    var msg = 'Hej! Jag testade "Se hur din hemsida kan se ut" och vill ha en offert på något liknande. Min design: ' + location.href;
    var o = new URLSearchParams({ meddelande: msg });
    if (val('namn')) o.set('foretag', val('namn'));
    if (val('telefon')) o.set('telefon', val('telefon'));
    if (val('epost')) o.set('email', val('epost'));
    document.getElementById('dh-offert').href = base + 'kontakt.html?' + o.toString() + '#formular';
  }
  function restore() {
    var q = new URLSearchParams(location.hash.slice(1)); if (!q.toString()) return;
    q.forEach(function (v, k) {
      if (KEYS.indexOf(k) < 0) return;
      var el = form.elements[k]; if (!el) return;
      if (el.length && !el.tagName) { for (var i = 0; i < el.length; i++) el[i].checked = el[i].value === v; }
      else el.value = v;
    });
    marks();
  }

  var timer;
  form.addEventListener('input', function (e) {
    if (e.target.name === 'mall' || e.target.type === 'file') return;
    marks();
    clearTimeout(timer); timer = setTimeout(function () { apply(); save(); }, 120);
  });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'mall') { marks(); load(); save(); }
    else if (e.target.tagName === 'SELECT' || e.target.type === 'radio') { marks(); apply(); save(); }
  });

  // ---- images: read in the browser only, scaled down so the page stays quick
  function readImage(file, max, cb) {
    if (!file || !/^image\//.test(file.type)) return;
    var r = new FileReader();
    r.onload = function () {
      if (file.type === 'image/svg+xml') return cb(r.result);
      var im = new Image();
      im.onload = function () {
        var s = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement('canvas');
        cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', .86));
      };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  }
  var logoSize = document.querySelector('[data-dh-logo-size]');
  $$('.dh-up input[type=file]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      readImage(inp.files[0], inp.name === 'logga' ? 600 : 1800, function (url) {
        imgs[inp.name] = url;
        var pv = inp.parentNode.querySelector('.dh-up__img'); pv.src = url; pv.hidden = false;
        if (inp.name === 'logga') logoSize.hidden = false;
        apply();
      });
    });
  });
  document.getElementById('dh-clear-img').addEventListener('click', function () {
    imgs.logga = imgs.bild = '';
    $$('.dh-up input[type=file]').forEach(function (i) { i.value = ''; });
    $$('.dh-up__img').forEach(function (i) { i.hidden = true; i.removeAttribute('src'); });
    logoSize.hidden = true;
    apply();
  });

  // ---- tabs
  $$('[data-dh-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('[data-dh-tab]').forEach(function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
      $$('[data-dh-panel]').forEach(function (p) { var on = p.dataset.dhPanel === b.dataset.dhTab; p.hidden = !on; p.classList.toggle('is-on', on); });
      if (b.dataset.dhTab === 'utseende' && !document.getElementById('dh-fonts-page')) { // the "Aa" samples on the font buttons
        var lk = document.createElement('link'); lk.id = 'dh-fonts-page'; lk.rel = 'stylesheet'; lk.href = base + 'exempel/typsnitt/typsnitt.css'; document.head.appendChild(lk);
      }
    });
  });

  // ---- random style
  var pick = function (name) { var opts = $$('input[name="' + name + '"]').filter(function (i) { return i.value && i.value !== 'egen'; }); if (opts.length) opts[Math.floor(Math.random() * opts.length)].checked = true; };
  var pickSel = function (name) { var s = form.elements[name], o = $$('option', s).filter(function (x) { return x.value; }); s.value = o[Math.floor(Math.random() * o.length)].value; };
  document.getElementById('dh-random').addEventListener('click', function () {
    var before = current();
    ['mall', 'farg', 'accent', 'typsnitt', 'horn', 'knapp', 'meny'].forEach(pick);
    if (Math.random() < .3) pick('tema'); else form.querySelector('input[name="tema"][value=""]').checked = true;
    pickSel('rubrikstil'); pickSel('motiv');
    marks(); save();
    if (current() !== before) load(); else apply();
  });

  // ---- share
  var share = document.getElementById('dh-share');
  share.addEventListener('click', function () {
    save();
    var done = function () { share.textContent = 'Länken är kopierad'; setTimeout(function () { share.textContent = 'Kopiera länk till designen'; }, 2200); };
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, function () { prompt('Kopiera länken:', location.href); });
    else prompt('Kopiera länken:', location.href);
  });

  form.addEventListener('submit', function (e) { e.preventDefault(); apply(); save(); document.getElementById('dh-cta').scrollIntoView({ behavior: 'smooth', block: 'center' }); });

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
  var jump = document.getElementById('dh-jump');
  if (jump && 'IntersectionObserver' in window) {
    var formOn = false, prevOn = false, upd = function () { jump.classList.toggle('is-on', formOn && !prevOn); };
    new IntersectionObserver(function (es) { formOn = es[0].isIntersecting; upd(); }, { threshold: .05 }).observe(form);
    new IntersectionObserver(function (es) { prevOn = es[0].isIntersecting; upd(); }, { threshold: .3 }).observe(screen);
  }

  restore();
  fit();
  load();
  save();
})();
