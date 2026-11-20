/* Bars, rings and numbers that fill up when they come into view (Testa din sajt, Testa dina kakor).
   Markup: data-fill="72" on a bar (width), on an SVG circle with data-c="<circumference>" (stroke), or data-count="72" on a number. */
(function () {
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function run(el) {
    if (el.dataset.done) return; el.dataset.done = '1';
    var to = +el.dataset.fill || +el.dataset.count || 0;
    if (el.dataset.count != null) {
      if (reduced) { el.textContent = to; return; }
      var t0 = performance.now(), dur = 1100;
      (function step(t) { var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(step); })(t0);
      return;
    }
    if (el.dataset.c) { var c = +el.dataset.c; el.style.strokeDasharray = (c * to / 100).toFixed(1) + ' ' + c.toFixed(1); }
    else el.style.width = to + '%';
  }
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); setTimeout(function () { run(e.target); }, 120); } }); }, { threshold: .2 }) : null;
  function scan(root) { (root.querySelectorAll ? root : document).querySelectorAll('[data-fill],[data-count]').forEach(function (el) { if (el.dataset.seen) return; el.dataset.seen = '1'; if (reduced) run(el); else setTimeout(function () { requestAnimationFrame(function () { run(el); }); }, 150); }); }
  new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); }); }); }).observe(document.body, { childList: true, subtree: true });
  scan(document);
})();
