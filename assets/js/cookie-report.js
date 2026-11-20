/* The cookie and GDPR verdict shown in Testa din sajt and on Testa dina kakor. */
window.ElevateCookieReport = function (c, esc, note) {
    if (!c || !c.checked) return note('Startsidan kunde inte läsas, så cookiekontrollen kunde inte göras.');
    var li = function (cls, text) { return '<li class="' + cls + '">' + text + '</li>'; }, items = [];
    if (!c.trackers.length) items.push(li('good', '<b>Inga kända spårare</b> hittades på startsidan (till exempel Google Analytics eller Meta-pixel).'));
    c.trackers.forEach(function (t) {
      items.push(li(t.blocked ? 'good' : 'bad', '<b>' + esc(t.name) + '</b> ' + (t.blocked ? 'laddas först efter samtycke.' : 'laddas direkt när sidan öppnas, innan besökaren har svarat.')));
    });
    items.push(li(c.cmp ? 'good' : (c.trackers.length ? 'bad' : ''), c.cmp ? '<b>Cookie-banner hittad</b> (' + esc(c.cmp) + ').' : (c.trackers.length ? '<b>Ingen cookie-banner</b> hittades, trots att sajten använder spårare.' : '<b>Ingen cookie-banner</b> – behövs inte så länge sajten inte använder spårare.')));
    if (c.trackers.some(function (t) { return /Google/.test(t.name); })) items.push(li(c.consentMode ? 'good' : 'bad', c.consentMode ? '<b>Google Consent Mode</b> är inställt.' : '<b>Google Consent Mode</b> saknas. Google kräver det för annonser och statistik i EU.'));
    items.push(li(c.policy ? 'good' : 'bad', c.policy ? '<b>Länk till cookie- eller integritetspolicy</b> finns.' : '<b>Ingen länk</b> till cookie- eller integritetspolicy hittades på startsidan.'));
    if (c.serverCookies && c.serverCookies.length) items.push(li('', 'Servern sätter ' + c.serverCookies.length + ' cookie' + (c.serverCookies.length > 1 ? 's' : '') + ' direkt (' + esc(c.serverCookies.slice(0, 5).join(', ')) + '). Det är okej om de är nödvändiga, till exempel för inloggning eller säkerhet.'));
    var verdict = c.before.length
      ? '<p class="sitetest__verdict" style="display:block;background:#fbe9e6"><b>Troligen inte enligt reglerna.</b> ' + esc(c.before.join(', ')) + ' laddas innan besökaren har godkänt. Enligt lagen om elektronisk kommunikation och GDPR krävs aktivt samtycke först.</p>'
      : '<p class="sitetest__verdict" style="display:block;background:#e6f4ec"><b>Ser bra ut.</b> Vi hittade inga spårare som laddas innan besökaren har godkänt.</p>';
    var tr = c.trackers.length, blk = c.trackers.filter(function (t) { return t.blocked; }).length, goog = c.trackers.some(function (t) { return /Google/.test(t.name); });
    var bars = [['', tr ? Math.round(100 * blk / tr) : 100, 'Spårare'],
      ['', c.cmp || !tr ? 100 : 0, 'Cookie-banner'],
      ['', !goog || c.consentMode ? 100 : 0, 'Consent Mode'],
      ['', c.policy ? 100 : 0, 'Policy']];
    var total = Math.round(bars.reduce(function (a, b) { return a + b[1]; }, 0) / bars.length);
    var C = 2 * Math.PI * 52, g = function (v) { return v >= 90 ? 'good' : v >= 50 ? 'ok' : 'bad'; };
    var ring = function (l, v) { return '<div class="score score--' + g(v) + '"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="score__bg"/><circle cx="60" cy="60" r="52" class="score__fg" style="transition:stroke-dasharray 1.2s cubic-bezier(.22,1,.36,1)" stroke-dasharray="0 ' + C.toFixed(1) + '" data-fill="' + v + '" data-c="' + C.toFixed(1) + '"/></svg><span class="score__value" data-count="' + v + '">0</span><span class="score__label">' + l + '</span></div>'; };
    var barsHtml = '<div class="scores ckrings">' + ring('Totalt', total) + bars.map(function (b) { return ring(b[2], b[1]); }).join('') + '</div>';
    return verdict + barsHtml + '<ul class="sitetest__mail">' + items.join('') + '</ul>' +
      (c.before.length || (c.trackers.length && !c.cmp) ? '<div class="sitetest__actions"><a class="btn btn--primary" href="kontakt.html?fran=cookie#formular"><span>Låt oss fixa det</span></a></div>' : '') +
      note('Kontrollen läser startsidans kod och svar från servern. Spårare som läggs in senare av andra skript kan inte alltid upptäckas. Det här är en vägledning, inte juridisk rådgivning.');
  };

/* Testa dina kakor: the same structure as the result in Testa din sajt (summary with rings, issue cards, green call to action). */
window.ElevateCookiePage = function (c, url, esc) {
  var tr = c.trackers.length, blk = c.trackers.filter(function (t) { return t.blocked; }).length, goog = c.trackers.some(function (t) { return /Google/.test(t.name); });
  var bad = (c.cookies || []).filter(function (k) { return k.cat === 'statistik' || k.cat === 'marknadsforing'; });
  var parts = [['Spårare', c.browser ? (c.before.length ? 0 : 100) : (tr ? Math.round(100 * blk / tr) : 100)], ['Cookie-banner', c.cmp || !tr ? 100 : 0], ['Consent Mode', !goog || c.consentMode ? 100 : 0], ['Policy', c.policy ? 100 : 0]];
  var avg = Math.round(parts.reduce(function (a, b) { return a + b[1]; }, 0) / parts.length);
  var g = function (v) { return v >= 90 ? 'good' : v >= 50 ? 'ok' : 'bad'; }, C = 2 * Math.PI * 52;
  var ring = function (l, v) { return '<div class="score score--' + g(v) + '"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="score__bg"/><circle cx="60" cy="60" r="52" class="score__fg" style="transition:stroke-dasharray 1.2s cubic-bezier(.22,1,.36,1)" stroke-dasharray="0 ' + C.toFixed(1) + '" data-fill="' + v + '" data-c="' + C.toFixed(1) + '"/></svg><span class="score__value" data-count="' + v + '">0</span><span class="score__label">' + l + '</span></div>'; };
  var text = c.before.length ? 'Troligen inte enligt reglerna.' : avg >= 90 ? 'Ser bra ut. Inga spårare före samtycke.' : 'Bra grund, några saker att fixa.';
  var issues = [];
  var byWho = {}; bad.forEach(function (k) { (byWho[k.who] = byWho[k.who] || []).push(k.name); });
  Object.keys(byWho).forEach(function (w) { issues.push(['bad', 'Kakor', w + ' sätter kakor innan samtycke', 'Kakorna ' + byWho[w].map(esc).join(', ') + ' sparades i webbläsaren innan besökaren hade svarat på cookie-frågan. Det kräver aktivt samtycke först.', 'Vi kopplar ' + esc(w) + ' till cookie-rutan så att inga kakor sätts förrän besökaren har sagt ja.']); });
  if (!c.browser) c.trackers.forEach(function (t) { if (!t.blocked) issues.push(['bad', 'Spårare', t.name + ' laddas innan samtycke', 'Skriptet körs direkt när sidan öppnas, innan besökaren har svarat. Enligt lagen om elektronisk kommunikation och GDPR krävs aktivt samtycke först.', 'Vi kopplar skriptet till cookie-rutan så att det bara laddas efter ett ja.']); });
  if (c.browser) c.trackers.forEach(function (t) { if (c.before.indexOf(t.name) > -1 && !Object.keys(byWho).some(function (w) { return w.split(' ')[0] === t.name.split(' ')[0].replace('-pixel', ''); })) issues.push(['bad', 'Spårare', t.name + ' anropas innan samtycke', 'Webbläsaren skickade data till ' + esc(t.name) + ' direkt när sidan öppnades, innan besökaren hade svarat.', 'Vi kopplar skriptet till cookie-rutan så att det bara laddas efter ett ja.']); });
  if (tr && !c.cmp) issues.push(['bad', 'Cookie-banner', 'Ingen cookie-ruta hittades', 'Sajten använder spårare men frågar inte besökaren om lov.', 'Vi lägger in en cookie-ruta i er design med Neka, Godkänn och egna val.']);
  if (goog && !c.consentMode) issues.push(['bad', 'Consent Mode', 'Google Consent Mode saknas', 'Google kräver Consent Mode för annonser och statistik i EU.', 'Vi ställer in Consent Mode v2 så att Google får rätt signal från cookie-rutan.']);
  if (!c.policy) issues.push(['ok', 'Policy', 'Ingen länk till cookie- eller integritetspolicy', 'Besökaren ska enkelt kunna läsa vilka cookies som används och varför.', 'Vi skriver en tydlig policy och länkar den från sidfoten och cookie-rutan.']);
  var issueHtml = issues.length ? issues.map(function (i) {
    return '<li class="issue issue--' + i[0] + '"><div class="issue__head"><span class="issue__cat">' + i[1] + '</span></div><h3>' + esc(i[2]) + '</h3><p class="issue__what">' + i[3] + '</p><p class="issue__fix"><b>Så fixar vi det:</b> ' + i[4] + '</p><a class="issue__go" href="laglig-hemsida.html">Vi fixar det →</a></li>';
  }).join('') : '<li class="issue issue--good"><h3>Inga problem hittades</h3><p>Vi hittade inga spårare som laddas innan besökaren har godkänt.</p></li>';
  return '<div class="sitetest__summary sitetest__summary--noshot"><div><p class="sitetest__tested">Testad sida</p><p class="sitetest__url">' + esc(url) + '</p>' +
    '<div class="sitetest__verdict"><b class="sitetest__avg sitetest__avg--' + g(avg) + '" data-count="' + avg + '">0</b><div><strong>' + text + '</strong><span>Snittbetyg av ' + parts.length + ' kontroller</span></div></div>' +
    '<div class="scores">' + parts.map(function (p) { return ring(p[0], p[1]); }).join('') + '</div></div></div>' +
    (c.browser ? '<h2 class="sitetest__h2">Kakor som sattes innan besökaren svarat <span>(' + (c.cookies || []).length + ')</span></h2>' + ((c.cookies || []).length ? '<div class="sitetest__tbl"><table><thead><tr><th>Kaka</th><th>Från</th><th>Typ</th><th>Kräver samtycke</th></tr></thead><tbody>' + c.cookies.map(function (k) { var need = k.cat === 'statistik' || k.cat === 'marknadsforing'; return '<tr><td><code>' + esc(k.name) + '</code></td><td>' + esc(k.who || k.domain) + (k.party === 'third' ? ' <small>(tredjepart)</small>' : '') + '</td><td>' + ({ statistik: 'Statistik', marknadsforing: 'Marknadsföring', nodvandig: 'Nödvändig', okand: 'Okänd' })[k.cat] + '</td><td>' + (need ? '<b style="color:#b2412c">Ja</b>' : k.cat === 'okand' ? 'Kontrollera' : 'Nej') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="sitetest__note">Inga kakor alls sattes när sidan öppnades. Bra!</p>') : '') +
    '<h2 class="sitetest__h2">Det här kan förbättras <span>(' + issues.length + ')</span></h2><ol class="issues">' + issueHtml + '</ol>' +
    '<div class="sitetest__cta"><div><h2>Vill du att vi fixar det här?</h2><p>Vi lägger in en cookie-ruta i er design och ser till att spårare bara körs efter samtycke.</p></div>' +
    '<div class="sitetest__actions"><a class="btn btn--light" href="kontakt.html?fran=cookie#formular"><span>Låt oss ta hand om det</span></a></div></div>' +
    '<p class="sitetest__source">' + (c.browser ? 'Vi öppnade startsidan i en riktig webbläsare som en ny besökare, utan att svara på någon cookie-fråga, och listade kakorna och anropen som gjordes.' : 'Kontrollen läser startsidans kod och svar från servern. Spårare som läggs in senare av andra skript kan inte alltid upptäckas.') + ' Det här är en vägledning, inte juridisk rådgivning.</p>';
};
