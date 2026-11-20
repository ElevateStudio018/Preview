/* Testa din sajt: while the test runs, a browser window shows the tested site and a cursor that
   scrolls, points at the real menu, buttons and images, clicks and says what it checks.
   The screenshot and the positions come from /api/preview (a real browser at Cloudflare). While that is not
   available (or the daily browser quota is used up), the site itself is shown live in a frame, when it allows it,
   and the cursor visits the places where menus, headings and buttons usually are. */
(function () {
  var box = document.getElementById('stlive');
  if (!box) return;
  var screen = box.querySelector('.stlive__screen'), pageEl = box.querySelector('.stlive__page'), img = pageEl.querySelector('img');
  var cur = box.querySelector('.stlive__cursor'), ring = box.querySelector('.stlive__ring'), say = box.querySelector('.stlive__say'), urlEl = box.querySelector('.stlive__url');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var run = 0, timers = [], data = null, scale = 1, scrollY = 0;
  var home = box.parentNode, homeNext = box.nextSibling; // the quick test's progress box; the deep test borrows the window

  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function clear() { timers.forEach(clearTimeout); timers = []; }
  function talk(t) { say.classList.remove('is-on'); later(function () { say.textContent = t; say.classList.add('is-on'); }, 120); }
  function moveTo(x, y) { cur.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }
  function click(x, y) {
    cur.classList.add('is-down'); later(function () { cur.classList.remove('is-down'); }, 180);
    ring.style.left = x + 'px'; ring.style.top = y + 'px'; ring.classList.remove('is-on'); void ring.offsetWidth; ring.classList.add('is-on');
  }
  function scrollTo(y) {
    var max = Math.max(0, pageEl.offsetHeight - screen.clientHeight);
    scrollY = Math.max(0, Math.min(max, y)); pageEl.style.transform = 'translateY(' + (-scrollY) + 'px)';
  }
  function q(s) { return '”' + s + '”'; }
  var SAY = {
    nav: function (t) { return t.label ? 'Kollar menyn: ' + q(t.label) + ' – hittar man rätt?' : 'Kollar menyn – hittar man rätt?'; },
    button: function (t) { return t.label ? 'Klickar på knappen ' + q(t.label) + ' – fungerar den?' : 'Letar efter knappen till kontakt – syns den direkt?'; },
    heading: function (t) { return 'Läser rubriken – förstår man vad ni gör?'; },
    img: function () { return 'Mäter hur snabbt bilden laddas …'; },
    form: function () { return 'Kollar formuläret – går det att fylla i på mobilen?'; },
    contact: function (t) { return 'Testar ' + q(t.label) + ' – kan kunden nå er direkt?'; },
    text: function () { return 'Läser texterna – är det lätt att förstå?'; }
  };
  // Where menus, headings and buttons usually sit in the first screen, for the live frame (page pixels).
  // A frame from another site cannot be scrolled from outside, so the frame is exactly one screen.
  var GUESS = {
    d: [{ x: 880, y: 50, kind: 'nav' }, { x: 1060, y: 50, kind: 'nav' }, { x: 420, y: 330, kind: 'heading' }, { x: 640, y: 470, kind: 'text' }, { x: 380, y: 610, kind: 'button' }, { x: 1000, y: 520, kind: 'img' }],
    m: [{ x: 350, y: 40, kind: 'nav' }, { x: 195, y: 250, kind: 'heading' }, { x: 195, y: 360, kind: 'text' }, { x: 195, y: 460, kind: 'button' }]
  };
  var frame = null;
  function dropFrame() { if (frame) { frame.remove(); frame = null; } pageEl.style.height = ''; box.classList.remove('has-frame'); }
  function showFrame(id, url, phone) {
    var w = phone ? 390 : 1280, s = screen.clientWidth / w, FRAME_H = Math.round(screen.clientHeight / s);
    frame = document.createElement('iframe');
    frame.className = 'stlive__frame'; frame.title = 'Den testade sidan'; frame.tabIndex = -1;
    frame.setAttribute('sandbox', 'allow-scripts'); // no storage or cookies for the tested site in the visitor's browser frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.style.width = w + 'px'; frame.style.height = FRAME_H + 'px'; frame.style.transform = 'scale(' + s + ')';
    frame.onload = function () {
      if (id !== run || data) return;
      data = { w: w, h: FRAME_H, targets: GUESS[phone ? 'm' : 'd'], frame: true }; scale = s;
      box.classList.add('has-shot', 'has-frame'); clear(); scrollTo(0); talk('Sidan är öppnad. Nu tittar vi runt …'); later(function () { tour(id); }, 1200);
    };
    pageEl.style.height = Math.round(FRAME_H * s) + 'px';
    pageEl.appendChild(frame); frame.src = url;
  }

  // The tour: scroll to each real target, point, click (buttons and links), explain. Loops until stopped.
  function tour(id) {
    if (id !== run) return;
    var ts = (data && data.targets && data.targets.length) ? data.targets : null, i = 0;
    var W = screen.clientWidth, H = screen.clientHeight;
    if (!ts) { // no screenshot (yet): a gentle wander over the placeholder page
      var spots = [[.2, .12, 'Öppnar sidan …'], [.7, .3, 'Tittar på sidhuvudet och menyn …'], [.35, .6, 'Läser texterna …'], [.6, .8, 'Letar efter knappar att klicka på …']];
      (function wander() {
        if (id !== run || (data && data.targets)) return;
        var s = spots[i++ % spots.length]; moveTo(s[0] * W, s[1] * H); talk(s[2]); later(wander, 2600);
      })();
      return;
    }
    (function next() {
      if (id !== run) return;
      if (i === ts.length) { i = 0; talk('Scrollar till toppen och kör ett varv till …'); scrollTo(0); moveTo(W * .5, H * .2); later(next, 2000); return; }
      var t = ts[i++], ty = t.y * scale, tx = t.x * scale;
      if (ty - scrollY > H * .78 || ty - scrollY < H * .12) { talk('Scrollar ner …'); scrollTo(ty - H * .4); }
      later(function () {
        if (id !== run) return;
        var y = ty - scrollY; moveTo(tx, y);
        talk((SAY[t.kind] || SAY.heading)(t));
        if (t.kind === 'button' || t.kind === 'nav' || t.kind === 'contact') later(function () { if (id === run) click(tx, y); }, 900);
        later(next, 2600);
      }, 700);
    })();
  }

  window.ElevateLive = {
    // into: another progress panel to show the window in (the deep analysis); default is the quick test's
    start: function (url, into) {
      clear(); run++; var id = run; data = null; scrollY = 0;
      if (into) into.insertBefore(box, into.querySelector('.sitetest__note')); else if (box.parentNode !== home) home.insertBefore(box, homeNext);
      dropFrame(); box.hidden = false; box.classList.remove('has-shot'); pageEl.style.transform = ''; img.removeAttribute('src');
      urlEl.textContent = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      moveTo(screen.clientWidth * .5, screen.clientHeight * .5); talk('Öppnar ' + urlEl.textContent + ' i en riktig webbläsare …');
      if (reduced) return;
      later(function () { tour(id); }, 900);
      var phone = window.innerWidth < 700; box.classList.toggle('stlive--phone', phone);
      // the live frame first (fast, when the site allows it); a real screenshot with the exact buttons replaces it if it comes
      fetch('/api/frameable?url=' + encodeURIComponent(url)).then(function (r) { return r.ok ? r.json() : null; }).then(function (f) {
        if (id === run && f && f.ok && !data) showFrame(id, f.url || url, phone);
      }).catch(function () {});
      fetch('/api/preview?url=' + encodeURIComponent(url) + (phone ? '&m=1' : '')).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (id !== run || !d || !d.img) return;
        img.onload = function () {
          if (id !== run) return;
          dropFrame(); data = d; scale = screen.clientWidth / d.w; box.classList.add('has-shot');
          clear(); scrollTo(0); talk('Sidan är laddad. Nu tittar vi runt …'); later(function () { tour(id); }, 1200);
        };
        img.src = d.img;
      }).catch(function () {});
    },
    stop: function () { clear(); run++; dropFrame(); box.hidden = true; if (box.parentNode !== home) home.insertBefore(box, homeNext); }
  };
})();
