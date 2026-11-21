// "Se hur din hemsida kan se ut": the visitor fills in a few details and one of our example sites (same origin, in a
// frame) is rewritten live – company name, heading, town, phone and the main colour. Nothing is saved or sent.
(function () {
  var form = document.getElementById('dh-form');
  var frame = document.getElementById('dh-frame');
  if (!form || !frame) return;
  var base = frame.dataset.base || '';
  // what each template is called today, so it can be swapped for the visitor's own details
  var T = {
    saltvind: { name: 'Saltvind Trädvård AB', short: 'Saltvind', phone: '070-174 06 37', tel: '0701740637' },
    'vamo-bygg': { name: 'Vämö Byggnads AB', short: 'Vämö', phone: '070-174 06 42', tel: '0701740642' },
    trimbussen: { name: 'Trimbussen i Norr AB', short: 'Trimbussen', phone: '070-174 06 47', tel: '0701740647' },
  };
  var val = function (n) { var el = form.elements[n]; if (!el) return ''; if (el.length && !el.tagName) { for (var i = 0; i < el.length; i++) if (el[i].checked) return el[i].value; return ''; } return (el.value || '').trim(); };
  var shade = function (hex, f) { // f < 0 darker
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var m = function (c) { return Math.max(0, Math.min(255, Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f))); };
    return '#' + [m(r), m(g), m(b)].map(function (c) { return c.toString(16).padStart(2, '0'); }).join('');
  };
  var current = function () { return val('mall') || 'saltvind'; };

  function apply() {
    var doc; try { doc = frame.contentDocument; } catch (e) { return; }
    if (!doc || !doc.body) return;
    var t = T[current()]; if (!t) return;
    var name = val('namn'), heading = val('rubrik'), town = val('ort'), phone = val('telefon'), color = val('farg');
    var shortName = name ? name.replace(/\s+(AB|HB|KB|Aktiebolag)$/i, '') : '';
    // texts: full name first, then the short one
    var swaps = [];
    if (name) { swaps.push([t.name, name]); swaps.push([t.short, shortName]); }
    if (phone) swaps.push([t.phone, phone]);
    var walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT), node;
    var orig = doc.__dhOrig || (doc.__dhOrig = new Map());
    while ((node = walk.nextNode())) {
      if (!orig.has(node)) orig.set(node, node.nodeValue);
      var v = orig.get(node);
      swaps.forEach(function (s) { if (s[0] && v.indexOf(s[0]) >= 0) v = v.split(s[0]).join(s[1]); });
      if (node.nodeValue !== v) node.nodeValue = v;
    }
    if (phone) doc.querySelectorAll('a[href^="tel:"]').forEach(function (a) { a.href = 'tel:' + phone.replace(/[^\d+]/g, ''); });
    // the big heading on the start page
    var h1 = doc.querySelector('h1');
    if (h1) { if (!h1.dataset.dhOrig) h1.dataset.dhOrig = h1.textContent; h1.textContent = heading || h1.dataset.dhOrig; }
    // the logo word(s) itself
    doc.querySelectorAll('.logga .ord').forEach(function (o) { if (!o.dataset.dhOrig) o.dataset.dhOrig = o.textContent; o.textContent = shortName || o.dataset.dhOrig; });
    // the line under the logo
    doc.querySelectorAll('.logga .tag').forEach(function (tag) { if (!tag.dataset.dhOrig) tag.dataset.dhOrig = tag.textContent; tag.textContent = town ? 'Hemma i ' + town : tag.dataset.dhOrig; });
    if (name) doc.title = name + (town ? ' – ' + town : '');
    // the main colour
    var st = doc.getElementById('dh-style');
    if (!st) { st = doc.createElement('style'); st.id = 'dh-style'; doc.head.appendChild(st); }
    if (/^#[0-9a-f]{6}$/i.test(color)) {
      var d1 = shade(color, -.2), d2 = shade(color, -.45), l1 = shade(color, .9);
      st.textContent = ':root{--c-p:' + color + ';--c-p2:' + d1 + ';--c-p-text:' + color + ';--c-etikett:' + color + ';--c-siffra:' + color +
        ';--c-ruta:' + color + ';--c-meny:' + color + ';--c-fot:' + color + ';--c-knapp:' + color + ';--c-knapp2:' + d1 +
        ';--c-dark:' + d2 + ';--c-panel:' + d2 + ';--c-split:' + d2 + ';--c-ton:' + l1 + ';--c-topp:' + l1 + ';--c-statement:' + l1 + '}';
    } else st.textContent = '';
  }

  function load() {
    frame.src = base + 'exempel/' + current() + '/index.html';
    document.querySelectorAll('.dh-tpl').forEach(function (l) { l.classList.toggle('is-on', l.querySelector('input').checked); });
  }
  frame.addEventListener('load', function () { apply(); try { frame.contentWindow.addEventListener('pagehide', function () {}); } catch (e) {} });
  var timer;
  form.addEventListener('input', function (e) {
    if (e.target.name === 'mall') return;
    if (e.target.name === 'farg') document.querySelectorAll('.dh-color').forEach(function (l) { l.classList.toggle('is-on', l.querySelector('input').checked); });
    clearTimeout(timer); timer = setTimeout(apply, 120);
  });
  form.addEventListener('change', function (e) { if (e.target.name === 'mall') load(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); apply(); document.getElementById('dh-cta').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  // dator / mobil
  document.querySelectorAll('[data-dh-view]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-dh-view]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      document.getElementById('dh-screen').classList.toggle('is-phone', b.dataset.dhView === 'mobil');
    });
  });
  // fit the 1280 px wide desktop page to the frame, whatever its width
  var screen = document.getElementById('dh-screen');
  function fit() {
    var s = screen.clientWidth / 1280;
    screen.style.setProperty('--dh-s', s.toFixed(4));
    frame.style.height = screen.classList.contains('is-phone') ? '' : Math.ceil(screen.clientHeight / s) + 'px';
    screen.style.setProperty('--dh-ps', Math.min(.9, (screen.clientWidth - 40) / 390).toFixed(4));
  }
  window.addEventListener('resize', fit);
  document.querySelectorAll('[data-dh-view]').forEach(function (b) { b.addEventListener('click', fit); });
  // on a phone the desktop page would be tiny – start in the mobile view there
  if (window.matchMedia('(max-width: 700px)').matches) { var mb = document.querySelector('[data-dh-view="mobil"]'); if (mb) mb.click(); }
  fit();
  load();
})();
