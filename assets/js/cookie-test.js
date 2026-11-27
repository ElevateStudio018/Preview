/* Testa dina kakor: checks one address for trackers that load before consent, a cookie banner,
   Google Consent Mode and a policy link. Uses the same verdict as Testa din sajt. */
(function () {
  var form = document.getElementById('kaka-form'), out = document.getElementById('kaka-out');
  if (!form) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var note = function (t) { return '<p class="sitetest__note">' + t + '</p>'; };
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = form.url.value.trim(); if (!raw) { form.url.focus(); return; }
    var url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    var btn = form.querySelector('button'); btn.disabled = true;
    var prog = document.getElementById('kaka-progress'), bar = prog.querySelector('.sitetest__bar i'), step = prog.querySelector('.sitetest__step'), time = prog.querySelector('.sitetest__time');
    var host = esc(url.replace(/^https?:\/\//, '').replace(/\/$/, ''));
    var STEPS = ['Hämtar startsidan på ' + host + ' …', 'Läser sidans kod och skript …', 'Letar efter spårare (Google, Meta, LinkedIn, TikTok …) …', 'Kollar om spårarna väntar på samtycke …', 'Letar efter cookie-ruta …', 'Kollar Google Consent Mode …', 'Letar efter cookie- och integritetspolicy …', 'Läser cookies som servern sätter …', 'Sammanställer resultatet …'];
    var MIN = 6000, STEP = 1700, t0 = Date.now(), done = false;
    out.hidden = true; prog.hidden = false; bar.style.width = '0%';
    var tick = setInterval(function () {
      var ms = Date.now() - t0;
      // eases towards 95 % (about two thirds after 8 s); only the real result fills the rest
      bar.style.width = (done ? 100 : 95 * (1 - Math.exp(-ms / 8000))).toFixed(1) + '%';
      step.textContent = STEPS[Math.min(STEPS.length - 1, Math.floor(ms / STEP))];
      time.textContent = Math.floor(ms / 1000) + ' s';
    }, 120);
    var show = function (html) {
      var wait = Math.max(0, MIN - (Date.now() - t0));
      setTimeout(function () { done = true; bar.style.width = '100%'; setTimeout(function () { clearInterval(tick); prog.hidden = true; out.innerHTML = html; out.hidden = false; btn.disabled = false; out.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 350); }, wait);
    };
    fetch('/api/cookiecheck?url=' + encodeURIComponent(url)).then(function (r) { return r.json(); }).then(function (d) {
      if (d.error) throw new Error('Adressen gick inte att läsa.');
      show(d.cookies && d.cookies.checked ? window.ElevateCookiePage(d.cookies, d.site || url, esc) : window.ElevateCookieReport(d.cookies, esc, note));
    }).catch(function (err) { show(note(esc(err.message || 'Något gick fel. Försök igen.'))); });
  });
})();
