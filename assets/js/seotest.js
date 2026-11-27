/* SEO-djuptest: reads up to 100 pages of a site through /api/crawl, checks links and pictures, robots.txt, the
   sitemap and the server's headers, and asks Google PageSpeed about the start page. Every finding comes from what
   the pages and the server actually answer. The top of the report is open; the rest opens when the visitor gives
   an e-mail address (worker/seo.js). */
(function () {
  var form = document.getElementById('seo-form');
  if (!form) return;
  var out = document.getElementById('seo-out'), prog = document.getElementById('seo-progress');
  var MAX_PAGES = 100, MAX_LINKS = 200, MAX_IMAGES = 120;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var nf = function (n) { return Number(n).toLocaleString('sv-SE'); };
  var dec = function (n, d) { return Number(n).toFixed(d || 1).replace('.', ','); };
  var path = function (u, origin) { var p = String(u).replace(origin, '') || '/'; return p.length > 70 ? p.slice(0, 67) + '…' : p; };

  var normal = function (v) {
    v = String(v || '').trim(); if (!v) return null;
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    try { var u = new URL(v); if (!/\./.test(u.hostname)) return null; return u.origin; } catch (e) { return null; }
  };
  var api = function (op, url, body) {
    var q = '/api/crawl?op=' + op + '&url=' + encodeURIComponent(url);
    return fetch(q, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  };
  var started = 0, clock = null;
  var step = function (text, pct) {
    if (prog.hidden) { prog.hidden = false; started = Date.now(); clearInterval(clock); clock = setInterval(function () { prog.querySelector('.sitetest__time').textContent = Math.round((Date.now() - started) / 1000) + ' s'; }, 1000); }
    prog.querySelector('.sitetest__step').textContent = text;
    prog.querySelector('.sitetest__bar i').style.width = Math.max(4, Math.min(100, pct)) + '%';
  };
  var stop = function () { prog.hidden = true; clearInterval(clock); };
  var chunks = function (list, n) { var o = []; for (var i = 0; i < list.length; i += n) o.push(list.slice(i, i + n)); return o; };
  var series = function (items, fn) { return items.reduce(function (p, x, i) { return p.then(function (acc) { return fn(x, i).then(function (r) { acc.push(r); return acc; }); }); }, Promise.resolve([])); };
  var isPage = function (u) { return !/\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|pptx?|mp4|mp3|avif|ico|xml|txt|css|js)(\?|$)/i.test(u); };
  var clean = function (u) { try { var x = new URL(u); x.hash = ''; return x.href; } catch (e) { return null; } };

  /* ---------- 1. Collect ---------- */
  function run(origin) {
    var R = { origin: origin, host: new URL(origin).hostname.replace(/^www\./, ''), pages: [], links: {}, images: {}, at: new Date() };
    var key = form.dataset.apiKey;
    var psi = fetch('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=' + encodeURIComponent(origin + '/') + '&strategy=mobile&category=performance' + (key ? '&key=' + encodeURIComponent(key) : ''))
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    step('Läser sitemap och robots.txt …', 4);
    return Promise.all([api('list', origin), api('robots', origin), api('headers', origin)]).then(function (a) {
      if (!a[0]) throw new Error('Vi kom inte åt sajten. Kontrollera adressen och försök igen.');
      R.sitemap = !!a[0].sitemap; R.robots = a[1] || {}; R.headers = a[2] || {};
      var queue = (a[0].urls || []).map(clean).filter(Boolean).filter(isPage), seen = {};
      if (queue.indexOf(origin + '/') < 0) queue.unshift(origin + '/');
      R.inSitemap = {}; (a[0].urls || []).forEach(function (u) { var c = clean(u); if (c) R.inSitemap[c] = 1; });
      queue.forEach(function (u) { seen[u] = 1; });
      // pages in batches of 12; links found on them join the queue (needed when there is no sitemap)
      var loop = function () {
        var batch = queue.splice(0, Math.max(0, Math.min(12, MAX_PAGES - R.pages.length)));
        if (!batch.length || R.pages.length >= MAX_PAGES) return Promise.resolve();
        step('Läser sidor … ' + R.pages.length + ' klara', 8 + 52 * R.pages.length / Math.min(MAX_PAGES, R.pages.length + queue.length + batch.length));
        return api('pages', origin, { urls: batch }).then(function (d) {
          (d && d.pages || batch.map(function (u) { return { url: u, ok: false, status: 0 }; })).forEach(function (p) {
            R.pages.push(p);
            if (p.links) p.links.internal.map(clean).filter(Boolean).forEach(function (u) { if (!seen[u] && isPage(u)) { seen[u] = 1; queue.push(u); } });
          });
          return loop();
        });
      };
      return loop();
    }).then(function () {
      // links that are not among the pages we read, and pictures
      var crawled = {}; R.pages.forEach(function (p) { crawled[p.url] = p; });
      var internal = {}, external = {}, images = {};
      R.pages.forEach(function (p) {
        if (!p.links) return;
        p.links.internal.forEach(function (u) { u = clean(u); if (u && !crawled[u]) (internal[u] = internal[u] || []).push(p.url); });
        p.links.external.forEach(function (u) { (external[u] = external[u] || []).push(p.url); });
        p.links.images.forEach(function (u) { (images[u] = images[u] || []).push(p.url); });
      });
      R.linkFrom = {}; Object.keys(internal).forEach(function (u) { R.linkFrom[u] = internal[u]; }); Object.keys(external).forEach(function (u) { R.linkFrom[u] = external[u]; });
      R.imgFrom = images;
      var links = Object.keys(internal).concat(Object.keys(external)).slice(0, MAX_LINKS), imgs = Object.keys(images).slice(0, MAX_IMAGES);
      R.linksChecked = links.length; R.imagesChecked = imgs.length;
      var total = chunks(links, 40).length + chunks(imgs, 40).length || 1, done = 0;
      return series(chunks(links, 40), function (c) {
        step('Kontrollerar länkar …', 62 + 26 * (++done) / total);
        return api('links', R.origin, { urls: c }).then(function (d) { (d && d.links || []).forEach(function (l) { R.links[l.url] = l; }); });
      }).then(function () {
        return series(chunks(imgs, 40), function (c) {
          step('Kontrollerar bilder …', 62 + 26 * (++done) / total);
          return api('images', R.origin, { urls: c }).then(function (d) { (d && d.images || []).forEach(function (l) { R.images[l.url] = l; }); });
        });
      });
    }).then(function () {
      step('Väntar på Google PageSpeed …', 92);
      return Promise.race([psi, new Promise(function (ok) { setTimeout(function () { ok(null); }, 45000); })]);
    }).then(function (p) {
      R.psi = p && p.lighthouseResult ? p.lighthouseResult : null;
      return R;
    });
  }

  /* ---------- 2. Check ---------- */
  var THEMES = [['crawl', 'Genomsökning'], ['meta', 'Titlar & beskrivningar'], ['content', 'Rubriker & innehåll'], ['links', 'Länkar'], ['images', 'Bilder'],
    ['tech', 'Teknik & mobil'], ['schema', 'Strukturerad data'], ['speed', 'Laddtid'], ['sec', 'HTTPS & säkerhet']];
  var W = { e: 3, w: 2, n: 1 };
  // what fixing costs: the starting price is always 1 000 kr
  var PRICE = { base: 1000, error: 200, warning: 100, max: 5000 };

  function analyse(R) {
    var ok = R.pages.filter(function (p) { return p.ok; }), N = ok.length || 1, o = R.origin;
    var by = function (f) { return ok.filter(f).map(function (p) { return p.url; }); };
    var dup = function (field) {
      var m = {}; ok.forEach(function (p) { var v = (p.a && p.a[field] || '').trim().toLowerCase(); if (v) (m[v] = m[v] || []).push(p.url); });
      return Object.keys(m).filter(function (k) { return m[k].length > 1; }).reduce(function (a, k) { return a.concat(m[k]); }, []);
    };
    // click depth from the start page over internal links among the pages we read
    var depth = {}, inl = {}, start = o + '/';
    ok.forEach(function (p) { (p.links ? p.links.internal : []).forEach(function (u) { u = clean(u); if (u && u !== p.url) (inl[u] = inl[u] || {})[p.url] = 1; }); });
    var q = [start]; depth[start] = 0;
    var map = {}; ok.forEach(function (p) { map[p.url] = p; });
    while (q.length) { var cur = q.shift(), pg = map[cur]; if (!pg || !pg.links) continue; pg.links.internal.forEach(function (u) { u = clean(u); if (u && depth[u] == null && map[u]) { depth[u] = depth[cur] + 1; q.push(u); } }); }
    R.depth = depth;
    var links = Object.keys(R.links).map(function (k) { return R.links[k]; });
    var isInt = function (l) { return l.url.indexOf(o) === 0; };
    var bad = function (l) { return !l.status || l.status >= 400; };
    var imgs = Object.keys(R.images).map(function (k) { return R.images[k]; });
    var H = R.headers.home || {}, lh = R.psi, au = lh ? lh.audits : {};
    var num = function (id) { return au && au[id] && typeof au[id].numericValue === 'number' ? au[id].numericValue : null; };
    var perf = lh && lh.categories && lh.categories.performance ? Math.round(lh.categories.performance.score * 100) : null;
    var lcp = num('largest-contentful-paint'), cls = num('cumulative-layout-shift'), tbt = num('total-blocking-time');
    R.cwv = { perf: perf, lcp: lcp, cls: cls, tbt: tbt };
    var site = function (cond) { return cond ? ['Hela sajten'] : []; };
    var ld = ok.filter(function (p) { return p.d && p.d.ldTypes && p.d.ldTypes.length; });
    var types = {}; ld.forEach(function (p) { p.d.ldTypes.forEach(function (t) { types[t] = 1; }); });
    var business = Object.keys(types).some(function (t) { return /LocalBusiness|Organization|Corporation|Store|Restaurant|Contractor|Plumber|Electrician|HomeAndConstructionBusiness|ProfessionalService|AutoRepair|BeautySalon|HairSalon|Dentist|LegalService|AccountingService|RealEstateAgent|MovingCompany|RoofingContractor|HVACBusiness|Locksmith|GeneralContractor/.test(t); });

    var C = [
      // Genomsökning
      ['status4xx', 'crawl', 'e', R.pages.filter(function (p) { return !p.ok || p.status >= 400; }).map(function (p) { return p.url + (p.status ? ' (' + p.status + ')' : ' (svarar inte)'); }), N,
        'sidor svarar med fel', 'Google kan inte visa sidor som svarar med fel, och besökare som kommer dit lämnar direkt.', 'Gör om sidan eller led adressen vidare med en 301-omdirigering till den sida som ersätter den. Ta bort länkar som pekar dit.'],
      ['robotsBlock', 'crawl', 'e', site(R.robots.blockAll), 1, 'robots.txt stänger ute alla sökmotorer', 'Raden "Disallow: /" under "User-agent: *" ber Google att inte läsa någon sida alls.', 'Ta bort raden "Disallow: /" i robots.txt, eller begränsa den till de mappar som verkligen ska vara dolda.'],
      ['sitemapMissing', 'crawl', 'w', site(!R.sitemap), 1, 'sitemap.xml saknas', 'En sitemap är en lista över alla sidor. Utan den hittar Google nya och djupa sidor långsammare.', 'Skapa /sitemap.xml med alla sidor som ska synas och skicka in den i Google Search Console.'],
      ['robotsMissing', 'crawl', 'n', site(!R.robots.robots), 1, 'robots.txt saknas', 'Filen talar om för sökmotorer vad de får läsa och var sitemapen finns.', 'Lägg en enkel /robots.txt med "User-agent: *", "Allow: /" och en rad "Sitemap:" med adressen till sitemapen.'],
      ['sitemapNoRef', 'crawl', 'n', site(R.robots.robots && R.sitemap && !R.robots.sitemapRef), 1, 'robots.txt pekar inte ut sitemapen', 'Sökmotorer letar efter sitemapen i robots.txt.', 'Lägg till raden "Sitemap: ' + o + '/sitemap.xml" i robots.txt.'],
      ['noindex', 'crawl', 'w', by(function (p) { return p.a.noindex && R.inSitemap[p.url]; }), N, 'sidor i sitemapen får inte visas i Google', 'Sidorna står i sitemapen men har "noindex", så Google får motstridiga besked.', 'Ta bort noindex om sidan ska synas, annars ta bort den ur sitemapen.'],
      ['deep', 'crawl', 'w', ok.filter(function (p) { return depth[p.url] >= 4; }).map(function (p) { return p.url + ' (' + depth[p.url] + ' klick)'; }), N, 'sidor ligger fyra klick eller längre från startsidan', 'Ju fler klick från startsidan, desto mindre viktig tror Google att sidan är – och desto mer sällan läses den.', 'Länka till de viktiga sidorna från menyn, startsidan eller tjänstesidorna så att de nås på högst tre klick.'],
      ['orphan', 'crawl', 'w', ok.filter(function (p) { return p.url !== start && !inl[p.url]; }).map(function (p) { return p.url; }), N, 'sidor som ingen annan sida länkar till', 'Sidor utan interna länkar är svåra för både Google och besökare att hitta.', 'Länka till sidan från minst en relevant sida, till exempel en tjänstesida eller menyn.'],
      ['httpNoRedirect', 'crawl', 'e', site(R.robots.httpsRedirect === false), 1, 'http:// leder inte vidare till https://', 'Samma sajt finns på två adresser, och besökare kan hamna på den osäkra versionen.', 'Led all trafik från http:// till https:// med en 301-omdirigering på servern.'],
      // Titlar & beskrivningar
      ['titleMissing', 'meta', 'e', by(function (p) { return !p.a.title; }), N, 'sidor saknar titel', 'Titeln är den blå rubriken i Googles sökresultat. Utan den hittar Google på en egen.', 'Ge varje sida en unik titel på 30–60 tecken med vad sidan handlar om och gärna orten.'],
      ['titleDup', 'meta', 'e', dup('title'), N, 'sidor har samma titel som en annan sida', 'När flera sidor har samma titel vet Google inte vilken som passar sökningen, och ingen av dem rankar bra.', 'Skriv en egen titel för varje sida, till exempel "Badrumsrenovering i Uppsala – Företaget".'],
      ['titleLong', 'meta', 'w', by(function (p) { return p.a.titleLen > 60; }), N, 'titlar är längre än 60 tecken', 'Google kapar långa titlar med "…", så det viktigaste kan försvinna.', 'Korta titeln till högst 60 tecken och lägg det viktigaste först.'],
      ['titleShort', 'meta', 'n', by(function (p) { return p.a.title && p.a.titleLen < 30; }), N, 'titlar är kortare än 30 tecken', 'En kort titel missar chansen att visa vad ni gör och var.', 'Bygg ut titeln med tjänst och ort, till exempel "Elektriker i Västerås – Företaget".'],
      ['descMissing', 'meta', 'w', by(function (p) { return !p.a.desc; }), N, 'sidor saknar meta-beskrivning', 'Beskrivningen är texten under titeln i sökresultatet. Utan den plockar Google en slumpvis bit av sidan.', 'Skriv en beskrivning på 70–160 tecken som säljer in sidan och slutar med en uppmaning.'],
      ['descDup', 'meta', 'w', dup('desc'), N, 'sidor har samma beskrivning som en annan sida', 'Likadana beskrivningar gör det svårt för både Google och besökare att skilja sidorna åt.', 'Skriv en egen beskrivning för varje sida.'],
      ['descLong', 'meta', 'n', by(function (p) { return p.a.descLen > 160; }), N, 'beskrivningar är längre än 160 tecken', 'Google kapar långa beskrivningar.', 'Korta beskrivningen till högst 160 tecken.'],
      ['descShort', 'meta', 'n', by(function (p) { return p.a.desc && p.a.descLen < 70; }), N, 'beskrivningar är kortare än 70 tecken', 'En kort beskrivning tar liten plats i sökresultatet och lockar färre klick.', 'Bygg ut beskrivningen till 70–160 tecken.'],
      // Rubriker & innehåll
      ['h1Missing', 'content', 'e', by(function (p) { return !p.a.h1; }), N, 'sidor saknar huvudrubrik (H1)', 'H1 talar om för Google vad sidan handlar om.', 'Ge varje sida en H1 som beskriver sidans ämne, gärna med sökordet.'],
      ['h1Many', 'content', 'w', by(function (p) { return p.a.h1 > 1; }), N, 'sidor har flera huvudrubriker', 'Flera H1 gör det otydligt vad sidan främst handlar om.', 'Behåll en H1 och gör de andra till H2.'],
      ['headingEmpty', 'content', 'w', by(function (p) { return p.d && p.d.emptyHeadings; }), N, 'sidor har tomma rubriker', 'Tomma rubriker förvirrar sökmotorer och skärmläsare.', 'Ta bort de tomma rubrikerna eller fyll dem med text.'],
      ['headingSkips', 'content', 'n', by(function (p) { return p.d && p.d.headingSkips; }), N, 'sidor hoppar över rubriknivåer', 'Rubrikerna ska gå i ordning (H1, H2, H3) så att strukturen blir tydlig.', 'Byt rubriknivå så att ingen nivå hoppas över.'],
      ['thin', 'content', 'w', by(function (p) { return p.d && p.d.words < 250; }), N, 'sidor har mindre än 250 ord', 'Sidor med lite text har svårt att ranka, eftersom Google inte vet vad de ska visas för.', 'Bygg ut sidan med det kunderna undrar: vad ingår, pris, område, vanliga frågor och omdömen.'],
      ['dupContent', 'content', 'e', (function () { var m = {}; ok.forEach(function (p) { if (p.d && p.d.words > 30) (m[p.d.textHash] = m[p.d.textHash] || []).push(p.url); }); return Object.keys(m).filter(function (k) { return m[k].length > 1; }).reduce(function (a, k) { return a.concat(m[k]); }, []); })(), N,
        'sidor har exakt samma innehåll som en annan sida', 'Google visar bara en av dubbletterna och kan välja fel.', 'Slå ihop sidorna, skriv om den ena eller peka canonical till originalet.'],
      ['genericLinks', 'content', 'n', by(function (p) { return p.d && p.d.genericLinks; }), N, 'sidor har länktexter som "läs mer" eller "klicka här"', 'Länktexten talar om för Google vad sidan man länkar till handlar om.', 'Skriv vad länken leder till, till exempel "Se våra badrumsrenoveringar".'],
      // Länkar
      ['brokenInternal', 'links', 'e', links.filter(function (l) { return isInt(l) && bad(l); }).map(function (l) { return l.url + ' (' + (l.status || 'svarar inte') + ')'; }), Math.max(1, links.filter(isInt).length), 'interna länkar är trasiga', 'Trasiga länkar ger besökare en felsida och slösar Googles tid på sajten.', 'Ändra länken till rätt sida eller led den gamla adressen vidare med en 301-omdirigering.'],
      ['brokenExternal', 'links', 'w', links.filter(function (l) { return !isInt(l) && bad(l) && l.status !== 403 && l.status !== 429; }).map(function (l) { return l.url + ' (' + (l.status || 'svarar inte') + ')'; }), Math.max(1, links.filter(function (l) { return !isInt(l); }).length), 'externa länkar är trasiga', 'Länkar till sidor som inte finns ser slarvigt ut för både besökare och Google.', 'Uppdatera länken till en sida som finns, eller ta bort den.'],
      ['redirectLinks', 'links', 'n', links.filter(function (l) { return isInt(l) && l.redirected && !bad(l); }).map(function (l) { return l.url; }), Math.max(1, links.filter(isInt).length), 'interna länkar går via en omdirigering', 'Varje omdirigering gör sidan lite långsammare och tappar lite av länkens värde.', 'Länka direkt till den slutliga adressen.'],
      ['emptyLinks', 'links', 'w', by(function (p) { return p.d && p.d.emptyLinks; }), N, 'sidor har länkar utan text', 'Länkar utan text (till exempel en ikon) säger ingenting till Google eller skärmläsare.', 'Ge länken en text eller ett aria-label som beskriver vart den leder.'],
      // Bilder
      ['altMissing', 'images', 'w', by(function (p) { return p.a.noAlt > 0; }).map(function (u) { var p = map[u]; return u + ' (' + p.a.noAlt + ' bilder)'; }), N, 'sidor har bilder utan alt-text', 'Alt-texten är hur Google förstår bilden. Utan den syns bilderna inte i Google Bilder.', 'Beskriv varje bild kort, till exempel "Nyrenoverat badrum med grå klinker".'],
      ['imgBroken', 'images', 'e', imgs.filter(function (i) { return !i.status || i.status >= 400; }).map(function (i) { return i.url; }), Math.max(1, imgs.length), 'bilder går inte att ladda', 'Trasiga bilder syns som tomma rutor.', 'Ladda upp bilden igen eller ta bort den från sidan.'],
      ['imgHeavy', 'images', 'w', imgs.filter(function (i) { return i.bytes > 300000; }).map(function (i) { return i.url + ' (' + dec(i.bytes / 1e6) + ' MB)'; }), Math.max(1, imgs.length), 'bilder är större än 300 kB', 'Tunga bilder gör sidan långsam i mobilen, och långsamma sidor rankar sämre.', 'Spara bilderna som WebP i rätt storlek. De flesta bilder klarar sig på under 200 kB.'],
      ['imgNoSize', 'images', 'n', by(function (p) { return p.d && p.d.imgNoSize; }), N, 'sidor har bilder utan bredd och höjd', 'Utan mått hoppar sidan när bilderna laddas.', 'Ange width och height på bilderna.'],
      ['imgNoLazy', 'images', 'n', by(function (p) { return p.d && p.d.imgNoLazy > 3; }), N, 'sidor laddar alla bilder direkt', 'Bilder längre ner kan vänta tills besökaren scrollar dit.', 'Lägg till loading="lazy" på bilder som inte syns direkt.'],
      // Teknik & mobil
      ['viewport', 'tech', 'e', by(function (p) { return !p.a.viewport; }), N, 'sidor är inte anpassade för mobilen', 'Google tittar först på mobilversionen. Utan viewport visas sidan som en förminskad datorsida.', 'Lägg till <meta name="viewport" content="width=device-width, initial-scale=1"> i head.'],
      ['mixed', 'tech', 'e', by(function (p) { return o.indexOf('https') === 0 && p.a.mixed; }), N, 'sidor laddar osäkra http-resurser', 'Webbläsaren kan blockera filerna eller varna för att sidan inte är säker.', 'Byt alla http:// till https:// i bilder, skript och länkar.'],
      ['lang', 'tech', 'w', by(function (p) { return !p.a.lang; }), N, 'sidor saknar språk', 'Språket hjälper Google att visa sidan för rätt publik.', 'Lägg till lang="sv" på html-taggen.'],
      ['canonicalMissing', 'tech', 'n', by(function (p) { return !p.a.canonical; }), N, 'sidor saknar canonical', 'Canonical talar om vilken adress som är originalet när samma sida kan nås på flera sätt.', 'Lägg till <link rel="canonical" href="…"> med sidans egen adress.'],
      ['canonicalOther', 'tech', 'n', by(function (p) { try { return p.a.canonical && clean(new URL(p.a.canonical, p.url).href) !== p.url; } catch (e) { return false; } }), N, 'sidor pekar canonical till en annan adress', 'Då ber sidan Google att visa en annan sida i stället. Det är rätt för dubbletter men fel för egna sidor.', 'Kontrollera att canonical pekar på sidans egen adress.'],
      ['metaRefresh', 'tech', 'w', by(function (p) { return p.d && p.d.metaRefresh; }), N, 'sidor laddar om sig själva', 'Meta refresh är en gammal sorts omdirigering som Google inte gillar.', 'Använd en 301-omdirigering på servern i stället.'],
      ['doctype', 'tech', 'w', by(function (p) { return p.d && (!p.d.doctype || !p.d.charset); }), N, 'sidor saknar doctype eller teckenkodning', 'Utan dem kan å, ä och ö visas fel och sidan tolkas på äldre sätt.', 'Börja sidan med <!doctype html> och <meta charset="utf-8">.'],
      ['blockingScripts', 'tech', 'n', by(function (p) { return p.d && p.d.blockingScripts; }), N, 'sidor har skript som blockerar visningen', 'Skript i head utan defer måste laddas innan något visas.', 'Lägg till defer på skripten eller flytta dem längst ner.'],
      ['bigHtml', 'tech', 'n', by(function (p) { return p.d && p.d.bytes > 250000; }), N, 'sidor är större än 250 kB HTML', 'Mycket stor HTML tar tid att ladda och läsa.', 'Flytta ut inbäddad kod till egna filer och ta bort det som inte används.'],
      ['favicon', 'tech', 'n', site(ok[0] && ok[0].d && !ok[0].d.favicon), 1, 'ikon (favicon) saknas', 'Ikonen visas i fliken och i Googles mobila sökresultat.', 'Lägg till en favicon och en apple-touch-icon.'],
      // Strukturerad data
      ['ldNone', 'schema', 'e', site(!ld.length), 1, 'ingen strukturerad data', 'Strukturerad data (schema.org) låter Google visa adress, öppettider och omdömen direkt i sökresultatet.', 'Lägg till JSON-LD med LocalBusiness: namn, adress, telefon, öppettider och område.'],
      ['ldBusiness', 'schema', 'w', site(ld.length && !business), 1, 'företaget är inte beskrivet som företag', 'Det finns strukturerad data, men ingen som talar om att det är ett företag med adress och kontaktuppgifter.', 'Lägg till LocalBusiness eller Organization med namn, adress och telefon.'],
      ['ldBad', 'schema', 'e', by(function (p) { return p.a.ldBad; }), N, 'sidor har trasig strukturerad data', 'Google ignorerar strukturerad data som inte går att läsa.', 'Rätta koden. Testa den i Googles test för utökade sökresultat.'],
      ['ogIncomplete', 'schema', 'n', by(function (p) { return p.d && !p.d.ogComplete; }), N, 'sidor saknar delningsinformation', 'När sidan delas på Facebook eller LinkedIn blir förhandsvisningen fattig.', 'Lägg till og:title, og:description och og:url.'],
      ['ogImage', 'schema', 'n', by(function (p) { return !p.a.ogImage; }), N, 'sidor saknar delningsbild', 'Utan og:image visas ingen bild när sidan delas.', 'Lägg till og:image med en bild på 1200 × 630 pixlar.'],
      // Laddtid
      ['psiPerf', 'speed', perf != null && perf < 50 ? 'e' : 'w', site(perf != null && perf < 90), 1, 'prestanda i mobilen: ' + (perf == null ? '–' : perf + ' av 100'), 'Google mäter hur snabb startsidan är i en mobil. Långsamma sidor tappar både besökare och placeringar.', 'Börja med tunga bilder och skript. Målet är 90 eller mer.'],
      ['lcp', 'speed', 'w', site(lcp != null && lcp > 2500), 1, 'huvudinnehållet visas efter ' + (lcp == null ? '–' : dec(lcp / 1000) + ' s'), 'LCP är hur lång tid det tar innan det största på skärmen syns. Google vill se under 2,5 sekunder.', 'Gör den största bilden mindre, ladda den först (fetchpriority="high") och skjut upp skript.'],
      ['cls', 'speed', 'w', site(cls != null && cls > 0.1), 1, 'sidan hoppar när den laddar (CLS ' + (cls == null ? '–' : dec(cls, 2)) + ')', 'När saker flyttar sig medan sidan laddar klickar besökare fel. Google vill se under 0,1.', 'Ange mått på bilder och reservera plats för det som laddas sent.'],
      ['tbt', 'speed', 'w', site(tbt != null && tbt > 200), 1, 'sidan är upptagen i ' + (tbt == null ? '–' : nf(Math.round(tbt)) + ' ms'), 'Under tiden svarar sidan inte på klick. Google vill se under 200 ms.', 'Ta bort skript som inte behövs och ladda resten med defer.'],
      ['compression', 'speed', 'w', site(R.headers.status && !H['content-encoding']), 1, 'sidorna skickas utan komprimering', 'Utan gzip eller brotli blir varje sida flera gånger större än nödvändigt.', 'Slå på gzip eller brotli på servern.'],
      // Säkerhet
      ['https', 'sec', 'e', site(!R.robots.https), 1, 'sajten använder inte https', 'Google rankar osäkra sajter lägre och webbläsaren varnar besökarna.', 'Skaffa ett SSL-certifikat (oftast gratis) och led all trafik till https.'],
      ['hsts', 'sec', 'n', site(R.robots.https && R.headers.status && !H['strict-transport-security']), 1, 'HSTS saknas', 'HSTS tvingar webbläsaren att alltid använda https.', 'Lägg till rubriken Strict-Transport-Security på servern.'],
      ['nosniff', 'sec', 'n', site(R.headers.status && !H['x-content-type-options']), 1, 'skydd mot filtyps-fusk saknas', 'Rubriken X-Content-Type-Options stoppar en vanlig sorts attack.', 'Lägg till X-Content-Type-Options: nosniff.'],
      ['frame', 'sec', 'n', site(R.headers.status && !H['x-frame-options'] && !/frame-ancestors/.test(H['content-security-policy'] || '')), 1, 'skydd mot inbäddning saknas', 'Utan skyddet kan andra sajter bädda in er sida och lura besökare att klicka.', 'Lägg till X-Frame-Options: SAMEORIGIN eller frame-ancestors i CSP.'],
      ['referrer', 'sec', 'n', site(R.headers.status && !H['referrer-policy']), 1, 'referrer-policy saknas', 'Bestämmer hur mycket av adressen som skickas vidare när någon klickar på en länk.', 'Lägg till Referrer-Policy: strict-origin-when-cross-origin.']
    ];
    var checks = C.map(function (c) { return { id: c[0], theme: c[1], sev: c[2], items: c[3], denom: c[4], title: c[5], why: c[6], fix: c[7] }; });
    checks.forEach(function (c) { c.n = c.items.length; c.f = Math.min(1, c.n / (c.denom || 1)); });
    // scores per area: each check weighs 3 (error), 2 (warning) or 1 (notice); a check that hits half of the pages counts half
    var scoreOf = function (skip) {
      var th = THEMES.map(function (t) {
        if (t[0] === 'speed' && !R.psi) return null;
        var cs = checks.filter(function (c) { return c.theme === t[0]; });
        var tot = cs.reduce(function (s, c) { return s + W[c.sev]; }, 0), lost = cs.reduce(function (s, c) { return s + (skip[c.id] ? 0 : W[c.sev] * c.f); }, 0);
        return tot ? Math.round(100 * (1 - lost / tot)) : 100;
      }).filter(function (v) { return v != null; });
      var sc = Math.round(th.reduce(function (a, v) { return a + v; }, 0) / th.length);
      var left = checks.filter(function (c) { return c.n && !skip[c.id]; });
      if (left.some(function (c) { return c.sev === 'e'; })) sc = Math.min(sc, 94); else if (left.length) sc = Math.min(sc, 99);
      return sc;
    };
    var themes = THEMES.map(function (t) {
      var cs = checks.filter(function (c) { return c.theme === t[0]; });
      var tot = cs.reduce(function (s, c) { return s + W[c.sev]; }, 0), lost = cs.reduce(function (s, c) { return s + W[c.sev] * c.f; }, 0);
      // without Google's measurement the loading time cannot be judged: shown as – and left out of the score
      if (t[0] === 'speed' && !R.psi) return { id: t[0], name: t[1], score: null };
      return { id: t[0], name: t[1], score: tot ? Math.round(100 * (1 - lost / tot)) : 100 };
    });
    var rated = themes.filter(function (t) { return t.score != null; });
    var score = Math.round(rated.reduce(function (s, t) { return s + t.score; }, 0) / rated.length);
    // a site with errors never gets top marks, and full marks only when nothing at all was found
    if (checks.some(function (c) { return c.n && c.sev === 'e'; })) score = Math.min(score, 94);
    else if (checks.some(function (c) { return c.n; })) score = Math.min(score, 99);
    var failing = checks.filter(function (c) { return c.n; }).sort(function (a, b) { return (W[b.sev] * 10 + b.f * 9) - (W[a.sev] * 10 + a.f * 9); });
    var count = function (s) { return failing.filter(function (c) { return c.sev === s; }).reduce(function (a, c) { return a + c.n; }, 0); };
    // page health: broken (error or not answering), with problems (warning), healthy
    var health = { ok: 0, warn: 0, bad: 0 };
    R.pages.forEach(function (p) {
      var hit = function (s) { return failing.some(function (c) { return c.sev === s && c.denom === N && c.items.some(function (i) { return i === p.url || i.indexOf(p.url + ' (') === 0; }); }); };
      if (!p.ok || p.status >= 400 || hit('e')) health.bad++; else if (hit('w')) health.warn++; else health.ok++;
    });
    var top = {}; failing.slice(0, 5).forEach(function (c) { top[c.id] = 1; });
    var after = Math.max(score, scoreOf(top));
    // the price to fix it all: always 1 000 kr to start, then per kind of error and warning (notices are free)
    var eTypes = failing.filter(function (c) { return c.sev === 'e'; }).length, wTypes = failing.filter(function (c) { return c.sev === 'w'; }).length;
    var price = Math.min(PRICE.max, PRICE.base + PRICE.error * eTypes + PRICE.warning * wTypes);
    return { after: after, price: price, eTypes: eTypes, wTypes: wTypes, checks: checks, failing: failing, themes: themes, score: score, e: count('e'), w: count('w'), n: count('n'), health: health, N: ok.length, total: R.pages.length };
  }

  /* ---------- 3. Show ---------- */
  // the name of each problem (the same names as in the summary mail, worker/seo.js) and what is counted
  var LABEL = {
  status4xx: 'Sidor som svarar med fel', robotsBlock: 'robots.txt stänger ute Google', robotsMissing: 'robots.txt saknas',
  sitemapMissing: 'Sitemap saknas', sitemapNoRef: 'robots.txt pekar inte ut sitemapen', noindex: 'Sidor som inte får visas i Google',
  deep: 'Sidor fyra klick eller längre från startsidan', orphan: 'Sidor som inga andra sidor länkar till', httpNoRedirect: 'http leder inte vidare till https',
  titleMissing: 'Sidor utan titel', titleDup: 'Sidor med samma titel', titleLong: 'För långa titlar', titleShort: 'För korta titlar',
  descMissing: 'Sidor utan beskrivning', descDup: 'Sidor med samma beskrivning', descLong: 'För långa beskrivningar', descShort: 'För korta beskrivningar',
  h1Missing: 'Sidor utan huvudrubrik (H1)', h1Many: 'Sidor med flera huvudrubriker', headingSkips: 'Rubriknivåer som hoppar över steg',
  headingEmpty: 'Tomma rubriker', thin: 'Sidor med lite text', dupContent: 'Sidor med samma innehåll', genericLinks: 'Länktexter som "läs mer"',
  brokenInternal: 'Trasiga interna länkar', brokenExternal: 'Trasiga externa länkar', redirectLinks: 'Länkar som går via omdirigering', emptyLinks: 'Länkar utan text',
  altMissing: 'Bilder utan alt-text', imgBroken: 'Trasiga bilder', imgHeavy: 'Tunga bilder', imgNoSize: 'Bilder utan bredd och höjd', imgNoLazy: 'Bilder som laddas direkt',
  viewport: 'Sidor som inte är anpassade för mobil', lang: 'Sidor utan språk', canonicalMissing: 'Sidor utan canonical', canonicalOther: 'Canonical pekar på annan sida',
  mixed: 'Osäkra http-resurser', metaRefresh: 'Sidor som laddar om sig själva', blockingScripts: 'Skript som blockerar visningen', bigHtml: 'Mycket stora sidor',
  doctype: 'Sidor utan doctype eller teckenkodning', favicon: 'Ikon (favicon) saknas',
  ldNone: 'Ingen strukturerad data', ldBad: 'Trasig strukturerad data', ldBusiness: 'Företaget är inte beskrivet för Google', ogIncomplete: 'Delningsinfo saknas', ogImage: 'Delningsbild saknas',
  psiPerf: 'Låg prestanda i mobilen', lcp: 'Huvudinnehållet visas sent', cls: 'Sidan hoppar när den laddar', tbt: 'Sidan svarar sent på klick',
  compression: 'Komprimering saknas', cacheCss: 'Filer sparas inte i webbläsaren',
  https: 'Sajten använder inte https', hsts: 'HSTS saknas', nosniff: 'Skydd mot filtyps-fusk saknas', frame: 'Skydd mot inbäddning saknas', referrer: 'Referrer-policy saknas',
};
  var UNIT = { brokenInternal: ['länk', 'länkar'], brokenExternal: ['länk', 'länkar'], redirectLinks: ['länk', 'länkar'], imgBroken: ['bild', 'bilder'], imgHeavy: ['bild', 'bilder'] };
  var DYN = { psiPerf: 1, lcp: 1, cls: 1, tbt: 1 };
  var name = function (c) { return DYN[c.id] ? c.title.charAt(0).toUpperCase() + c.title.slice(1) : LABEL[c.id] || c.title; };
  var many = function (c) { if (c.denom === 1) return ''; var u = UNIT[c.id] || ['sida', 'sidor']; return nf(c.n) + ' ' + (c.n === 1 ? u[0] : u[1]); };
  // the same parts as the result in Testa din sajt (assets/js/sitetest.js): verdict box, rings, metric boxes, issue list
  // class names written out in full, so that the CSS clean-up in the build keeps them
  var LEVEL = { e: ['issue issue--bad', 'Fel'], w: ['issue issue--ok', 'Varning'], n: ['issue issue--good', 'Notis'] };
  var RING = { good: 'score score--good', ok: 'score score--ok', bad: 'score score--bad' };
  var AVG = { good: 'sitetest__avg sitetest__avg--good', ok: 'sitetest__avg sitetest__avg--ok', bad: 'sitetest__avg sitetest__avg--bad' };
  var grade = function (v) { return v >= 90 ? 'good' : v >= 50 ? 'ok' : 'bad'; };
  var verdict = function (s) { return s >= 90 ? 'Riktigt bra. Bara finputs kvar.' : s >= 75 ? 'Bra grund, några saker att fixa.' : s >= 50 ? 'Det finns tydliga vinster att hämta.' : 'Google har svårt med sajten. Här finns mycket att vinna.'; };
  var ring = function (v, label, unit) {
    if (v == null) return '<div class="score score--na"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="score__bg"/></svg><span class="score__value">–</span><span class="score__label">' + esc(label) + '</span></div>';
    var c = 2 * Math.PI * 52;
    return '<div class="' + RING[grade(v)] + '"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="score__bg"/><circle cx="60" cy="60" r="52" class="score__fg" style="transition:stroke-dasharray 1.2s cubic-bezier(.22,1,.36,1)" stroke-dasharray="0 ' + c.toFixed(1) + '" data-fill="' + v + '" data-c="' + c.toFixed(1) + '"/></svg>' +
      '<span class="score__value"><span data-count="' + v + '">0</span>' + (unit ? '<small>' + unit + '</small>' : '') + '</span><span class="score__label">' + esc(label) + '</span></div>';
  };
  var BIG = { good: 'seo-big__n seo-big__n--good', ok: 'seo-big__n seo-big__n--ok', bad: 'seo-big__n seo-big__n--bad' };
  var GAIN = { good: 'seo-gain__fill seo-gain__fill--good', ok: 'seo-gain__fill seo-gain__fill--ok', bad: 'seo-gain__fill seo-gain__fill--bad' };
  // Google's result for the start page, as the visitor sees it; cut-off text is marked
  var serp = function (R) {
    var home = R.pages.filter(function (p) { return p.ok && p.url === R.origin + '/'; })[0] || R.pages.filter(function (p) { return p.ok; })[0];
    if (!home || !home.a) return '';
    var t = home.a.title || '', d = home.a.desc || '', cutT = t.length > 60, cutD = d.length > 158;
    var notes = [!t ? 'Sidan saknar titel – Google hittar på en egen.' : cutT ? 'Titeln är ' + t.length + ' tecken – Google kapar den efter cirka 60.' : 'Titeln har en bra längd.',
      !d ? 'Beskrivning saknas – Google plockar en slumpvis bit av sidan.' : cutD ? 'Beskrivningen är ' + d.length + ' tecken – Google kapar den efter cirka 158.' : 'Beskrivningen har en bra längd.'];
    var good = function (n) { return /bra längd/.test(n); };
    return '<h2 class="sitetest__h2">Så syns startsidan på Google</h2><div class="seo-serp"><div class="seo-serp__card">' +
      '<div class="seo-serp__site"><span class="seo-serp__fav">' + esc(R.host.charAt(0).toUpperCase()) + '</span><span><b>' + esc(R.host) + '</b><small>' + esc(R.origin) + '</small></span></div>' +
      '<p class="seo-serp__title">' + (t ? esc(cutT ? t.slice(0, 58) + ' …' : t) : '<i>' + esc(R.host) + '</i>') + '</p>' +
      '<p class="seo-serp__desc">' + (d ? esc(cutD ? d.slice(0, 155) + ' …' : d) : '<i>Ingen beskrivning – Google väljer text från sidan.</i>') + '</p></div>' +
      '<ul class="seo-serp__notes">' + notes.map(function (n) { return '<li class="' + (good(n) ? 'seo-serp__ok' : 'seo-serp__warn') + '">' + esc(n) + '</li>'; }).join('') + '</ul></div>';
  };
  // C: lying bars (label, bar, value); E: standing bars
  var HB = { good: 'seo-hbar seo-hbar--good', ok: 'seo-hbar seo-hbar--ok', bad: 'seo-hbar seo-hbar--bad' };
  var hbar = function (label, value, pct, level) { return '<div class="' + HB[level] + '"><span>' + esc(label) + '</span><i><i style="width:' + Math.max(2, Math.min(100, pct)) + '%"></i></i><b>' + value + '</b></div>'; };
  var VB = { good: 'seo-vbar seo-vbar--good', ok: 'seo-vbar seo-vbar--ok', bad: 'seo-vbar seo-vbar--bad' };
  var vbars = function (rows) {
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([1]));
    return '<div class="seo-vbars">' + rows.map(function (r) { return '<div class="' + VB[r[2]] + '"><b>' + nf(r[1]) + '</b><i style="height:' + Math.max(3, Math.round(100 * r[1] / max)) + '%"></i><span>' + esc(r[0]) + '</span></div>'; }).join('') + '</div>';
  };
  var share = function (n, of) { return of ? Math.round(100 * n / of) : 0; };
  var issue = function (c, origin) {
    var list = c.items.slice(0, 40).map(function (i) { return '<li>' + esc(i.indexOf('http') === 0 ? path(i, origin) : i) + '</li>'; }).join('') + (c.n > 40 ? '<li>+ ' + nf(c.n - 40) + ' till</li>' : '');
    return '<li class="' + LEVEL[c.sev][0] + '"><div class="issue__head"><span class="issue__cat">' + LEVEL[c.sev][1] + '</span>' + (many(c) ? '<span class="issue__value">' + many(c) + '</span>' : '') + '</div>' +
      '<h3>' + esc(name(c)) + '</h3><p class="issue__what">' + esc(c.why) + '</p><p class="issue__fix"><b>Så fixar du det:</b> ' + esc(c.fix) + '</p>' +
      (c.denom > 1 || c.items[0] !== 'Hela sajten' ? '<details class="seo-where"><summary>Visa var (' + nf(c.n) + ')</summary><ul>' + list + '</ul></details>' : '') +
      '<a class="issue__go" href="tjanster/seo-och-ai-optimering.html">Vi fixar det →</a></li>';
  };

  function render(R, A) {
    var o = R.origin, open = A.failing.slice(0, 3), rest = A.failing.slice(3);
    var ok = R.pages.filter(function (p) { return p.ok; }), cw = R.cwv, h = A.health;
    var shot = R.psi && R.psi.audits && R.psi.audits['final-screenshot'] && R.psi.audits['final-screenshot'].details && R.psi.audits['final-screenshot'].details.data;
    var depth = function (d) { return Object.keys(R.depth).filter(function (u) { return d === 4 ? R.depth[u] >= 4 : R.depth[u] === d; }).length; };
    var codes = { ok: 0, red: 0, bad: 0 };
    R.pages.forEach(function (p) { if (!p.ok || p.status >= 400) codes.bad++; else codes.ok++; });
    Object.keys(R.links).forEach(function (k) { var l = R.links[k]; if (l.url.indexOf(o) !== 0) return; if (!l.status || l.status >= 400) codes.bad++; else if (l.redirected) codes.red++; else codes.ok++; });
    var titles = function (f) { return ok.filter(function (p) { return f(p.a.titleLen); }).length; };
    var wordsUnder = ok.filter(function (p) { return p.d && p.d.words < 250; }).length;

    out.innerHTML =
      // 1. your own site in a phone, the score counting up, and what fixing the top five would give
      '<div class="seo-hero2">' +
        '<div class="seo-hero2__txt"><p class="sitetest__tested">SEO-djuptest</p><p class="sitetest__url">' + esc(R.host) + '</p>' +
          '<div class="seo-big"><b class="' + BIG[grade(A.score)] + '" data-count="' + A.score + '">0</b><div><strong>' + verdict(A.score) + '</strong><span>' +
            nf(A.total) + ' sidor genomsökta · ' + nf(A.checks.length) + ' kontroller · ' + nf(A.e) + ' fel, ' + nf(A.w) + ' varningar och ' + nf(A.n) + ' notiser</span></div></div>' +
          (A.failing.length ? '<div class="seo-gain"><p class="seo-gain__k">Fixar ni de ' + Math.min(5, A.failing.length) + ' viktigaste</p>' +
            '<div class="seo-gain__row"><span>Nu</span><i><i class="' + GAIN[grade(A.score)] + '" data-fill="' + A.score + '"></i></i><b>' + A.score + '</b></div>' +
            '<div class="seo-gain__row"><span>Efter</span><i><i class="seo-gain__fill seo-gain__fill--good" data-fill="' + A.after + '"></i></i><b>' + A.after + '</b></div>' +
            '<p class="seo-gain__note">+' + (A.after - A.score) + ' poäng – räknat på de kontroller som blir godkända.</p></div>' : '') +
        '</div>' +
        (shot ? '<div class="seo-phone" aria-hidden="true"><div class="seo-phone__screen"><img src="' + shot + '" alt=""></div></div>' : '') +
      '</div>' +
      '<div class="scores">' + A.themes.map(function (t) { return ring(t.score, t.name); }).join('') + '</div>' +
      // 2. how the start page looks in Google's results
      serp(R) +
      '<h2 class="sitetest__h2">Sajten i siffror</h2><div class="scores seo-rings">' + (function () {
        var linksIn = Object.keys(R.links).filter(function (k) { return k.indexOf(o) === 0; }).length + R.pages.length;
        var good = titles(function (l) { return l >= 30 && l <= 60; }), near = depth(1) + depth(2) + depth(3);
        return ring(share(h.ok, A.total), 'Friska sidor', '%') + ring(share(near, near + depth(4)), 'Nås inom 3 klick', '%') + ring(share(linksIn - codes.bad, linksIn), 'Länkar som fungerar', '%') +
          ring(share(good, ok.length), 'Titlar med rätt längd', '%') + ring(share(ok.length - wordsUnder, ok.length), 'Sidor med nog text', '%');
      })() + '</div>' +
      '<div class="seo-two">' +
        '<div><h2 class="sitetest__h2">Så snabbt laddar startsidan <span>(mobil)</span></h2>' + (R.psi ? '<div class="seo-hbars">' +
          hbar('Prestanda', cw.perf == null ? '–' : cw.perf + ' av 100', cw.perf || 0, cw.perf == null ? 'ok' : grade(cw.perf)) +
          hbar('Största innehållet (LCP)', cw.lcp == null ? '–' : dec(cw.lcp / 1000) + ' s', cw.lcp == null ? 0 : 100 * Math.min(1, 2500 / cw.lcp), cw.lcp == null ? 'ok' : cw.lcp <= 2500 ? 'good' : cw.lcp <= 4000 ? 'ok' : 'bad') +
          hbar('Layoutskift (CLS)', cw.cls == null ? '–' : dec(cw.cls, 2), cw.cls == null ? 0 : 100 * Math.min(1, 0.1 / Math.max(cw.cls, 0.001)), cw.cls == null ? 'ok' : cw.cls <= 0.1 ? 'good' : cw.cls <= 0.25 ? 'ok' : 'bad') +
          hbar('Blockeringstid (TBT)', cw.tbt == null ? '–' : nf(Math.round(cw.tbt)) + ' ms', cw.tbt == null ? 0 : 100 * Math.min(1, 200 / Math.max(cw.tbt, 1)), cw.tbt == null ? 'ok' : cw.tbt <= 200 ? 'good' : cw.tbt <= 600 ? 'ok' : 'bad') +
          '</div><p class="sitetest__source">Ju längre stapel, desto närmare Googles gräns för bra.</p>'
          : '<p class="sitetest__source">Googles mätning av laddtiden svarade inte den här gången, så laddtid räknas inte in i betyget.</p>') + '</div>' +
        '<div><h2 class="sitetest__h2">Klick från startsidan</h2>' + vbars([['1 klick', depth(1), 'good'], ['2 klick', depth(2), 'good'], ['3 klick', depth(3), 'good'], ['4 eller fler', depth(4), depth(4) ? 'bad' : 'good']]) + '</div>' +
      '</div>' +
      // 2. the start of the full report, open
      '<div class="seo-report__head"><h2 class="sitetest__h2">Det här kan förbättras <span>(' + nf(A.failing.length) + ')</span></h2></div>' +
      '<ol class="issues">' + (open.length ? open.map(function (c) { return issue(c, o); }).join('') : '<li class="issue issue--good"><h3>Inga problem hittades</h3><p>Sajten klarar alla kontroller. Snyggt jobbat.</p></li>') + '</ol>' +
      // 3. the rest under the lock
      (rest.length || ok.length ? '<div class="seo-locked is-locked" id="seo-locked"><div class="seo-locked__content" aria-hidden="true">' +
        '<ol class="issues">' + rest.map(function (c) { return issue(c, o); }).join('') + '</ol>' +
        '<h2 class="sitetest__h2">Alla sidor <span>(' + nf(R.pages.length) + ')</span></h2><div class="seo-table"><table><thead><tr><th>Sida</th><th>Titel</th><th>Ord</th><th>Klick</th><th>Status</th></tr></thead><tbody>' +
          R.pages.map(function (p) { return '<tr><td>' + esc(path(p.url, o)) + '</td><td>' + esc(p.a ? (p.a.title || '–').slice(0, 70) : '–') + '</td><td>' + (p.d ? nf(p.d.words) : '–') + '</td><td>' + (R.depth[p.url] == null ? '–' : R.depth[p.url]) + '</td><td>' + (p.status || '–') + '</td></tr>'; }).join('') +
        '</tbody></table></div>' +
      '</div>' +
      '<form class="seo-lock" id="seo-lock" novalidate>' +
        '<h3>Lås upp hela <em>rapporten</em></h3><p>Alla ' + nf(A.failing.length) + ' förbättringar, var på sajten de finns och alla ' + nf(R.pages.length) + ' sidor. Gratis – vi mejlar en sammanfattning så att du har den kvar.</p>' +
        '<label class="sr-only" for="seo-email">E-post</label><div class="seo-lock__field"><input id="seo-email" type="email" name="email" autocomplete="email" placeholder="Din e-postadress" required><button class="btn btn--primary" type="submit"><span>Lås upp</span></button></div>' +
        '<input type="text" name="_honey" tabindex="-1" autocomplete="off" class="sr-only" aria-hidden="true">' +
        '<label class="seo-chk"><input type="checkbox" name="terms" required> <span>Jag godkänner <a href="#seo-villkor">villkoren</a> och <a href="integritet.html" target="_blank" rel="noopener">integritetspolicyn</a></span></label>' +
        '<label class="seo-chk"><input type="checkbox" name="newsletter"> <span>Skicka mig nyhetsbrevet med SEO-tips (valfritt)</span></label>' +
        '<p class="seo-lock__msg" role="status"></p><p class="seo-lock__fine">Högst 3 rapporter per e-postadress och månad.</p>' +
      '</form></div>' : '') +
      (A.failing.length ? '<div class="seo-price"><div><p class="seo-price__k">SEO-fix för ' + esc(R.host) + '</p><p class="seo-price__n">' + nf(A.price) + ' kr</p>' +
          '<p class="seo-price__how">' + nf(PRICE.base) + ' kr i grundpris' + (A.eTypes ? ' + ' + A.eTypes + ' fel × ' + PRICE.error + ' kr' : '') + (A.wTypes ? ' + ' + A.wTypes + ' varningar × ' + PRICE.warning + ' kr' : '') + (A.price === PRICE.max ? ' (högst ' + nf(PRICE.max) + ' kr)' : '') + '. Notiserna ingår.</p></div>' +
          '<ul class="seo-price__list"><li>Vi åtgärdar felen och varningarna i rapporten</li><li>Ni kör testet igen och ser skillnaden</li><li>Väljer ni en ny hemsida hos oss dras beloppet av</li></ul>' +
          '<a class="btn btn--primary" href="kontakt.html?fran=seo-fix&amp;pris=' + A.price + '#formular"><span>Fixa det för ' + nf(A.price) + ' kr</span></a></div>' : '') +
      '<div class="sitetest__cta"><div><h2>Vill ni att vi fixar det här?</h2><p>Vi går igenom rapporten med er och ger ett förslag med fast pris.</p></div>' +
        '<div class="sitetest__actions"><a class="btn btn--light" href="kontakt.html?fran=seo-djuptest#formular"><span>Låt oss ta hand om det</span></a></div></div>' +
      '<p class="sitetest__source">Genomsökningen läser sidorna som de svarar för alla besökare' + (R.psi ? ', och laddtiden mäts med Google PageSpeed Insights' : '') + '. Resultatet kan variera något mellan körningar.</p>';
    out.hidden = false;
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    bindLock(R, A);
  }

  function unlock() {
    var box = document.getElementById('seo-locked'); if (!box) return;
    box.classList.remove('is-locked'); box.querySelector('.seo-locked__content').removeAttribute('aria-hidden');
    var f = document.getElementById('seo-lock'); if (f) f.remove();
  }
  function bindLock(R, A) {
    var f = document.getElementById('seo-lock'); if (!f) return;
    var msg = f.querySelector('.seo-lock__msg'), btn = f.querySelector('button');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = f.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = 'Skriv en giltig e-postadress.'; f.email.focus(); return; }
      if (!f.terms.checked) { msg.textContent = 'Du behöver godkänna villkoren för att låsa upp rapporten.'; return; }
      btn.disabled = true; msg.textContent = 'Låser upp …';
      fetch('/api/seo/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        email: email, terms: true, newsletter: f.newsletter.checked, url: R.origin, _honey: f._honey.value,
        summary: { score: A.score, e: A.e, w: A.w, n: A.n, pages: A.total, top: A.failing.slice(0, 5).map(function (c) { return { id: c.id, n: c.denom === 1 ? 0 : c.n }; }) } }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); }, function () { return { ok: false, d: { error: 'net' } }; })
        .then(function (x) {
          if (x.ok) {
            unlock();
            var note = document.createElement('p'); note.className = 'seo-unlocked';
            note.textContent = (x.d.mailed ? 'Klart! Sammanfattningen är skickad till ' + email + '.' : 'Klart! Hela rapporten är upplåst.') + (x.d.left != null ? ' Du har ' + x.d.left + ' rapport' + (x.d.left === 1 ? '' : 'er') + ' kvar den här månaden.' : '');
            var head = out.querySelector('.seo-report__head'); if (head) head.appendChild(note);
            try { window.elevateTrack && window.elevateTrack('seo_unlock', R.origin); } catch (er) { /* statistics are optional */ }
            return;
          }
          btn.disabled = false;
          msg.textContent = x.d.error === 'limit' ? 'Du har redan använt dina 3 rapporter den här månaden. Kontakta oss så hjälper vi dig.' : x.d.error === 'many' ? 'För många försök just nu. Vänta en stund och försök igen.' : 'Det gick inte att låsa upp just nu. Försök igen om en stund.';
        });
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var origin = normal(form.url.value), err = document.getElementById('seo-error');
    err.hidden = true;
    if (!origin) { err.textContent = 'Skriv en webbadress, till exempel dittforetag.se.'; err.hidden = false; return; }
    var btn = form.querySelector('button'); btn.disabled = true; out.hidden = true;
    var t0 = Date.now();
    run(origin).then(function (R) {
      var A = analyse(R);
      stop(); btn.disabled = false;
      render(R, A);
      try {
        (function () { try { return !localStorage.getItem('es.team'); } catch (e) { return true; } })() && fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify({ kind: 'sitetest', test_type: 'seo', url: origin, pages: A.total, issues: A.e + A.w + A.n, summary: 'SEO-betyg ' + A.score + ' %', scores: { seo: A.score } }) });
        window.elevateTrack && window.elevateTrack('seotest', origin, 'SEO-betyg ' + A.score + ' % · ' + Math.round((Date.now() - t0) / 1000) + ' s');
      } catch (er) { /* statistics are optional */ }
    }).catch(function (er) {
      stop(); btn.disabled = false;
      err.textContent = er && er.message ? er.message : 'Något gick fel. Försök igen.'; err.hidden = false;
    });
  });
  var pre = new URLSearchParams(location.search).get('url');
  if (pre) { form.url.value = pre; }
})();
