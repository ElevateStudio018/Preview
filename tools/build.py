#!/usr/bin/env python3
"""Bygger sajtens HTML-sidor från src/pages/*.html.

Första raden i varje källfil är en kommentar med metadata:
    <!-- title: ... | description: ... | nav: tjanster -->
Platshållare i sidorna:
    {{tel}} {{phone}} {{email}} {{street}} {{zip}} {{city}}
    {{icon:arrow}} {{icon:phone}} ...      ikoner
    {{reviews}} {{cta}} {{contact}}        delade sektioner
Kör:  python3 tools/build.py
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
PAGES = ROOT / "src" / "pages"

SITE = {
    "name": "Surte Formverkstad AB",
    "url": "https://www.surteformverkstad.se",
    "phone": "031-98 01 60",
    "tel": "+4631980160",
    "email": "info@surteformverkstad.se",
    "street": "Kvarnvägen 3",
    "zip": "445 57",
    "city": "Surte",
    "fax": "031-98 34 40",
}
GOOGLE_URL = "https://maps.google.com/?cid=3285162890577837130"

ICON = {
    "arrow": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6"/></svg>',
    "phone": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5L16 14l4 1.5V19a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>',
    "mail": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/></svg>',
    "pin": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    "chev": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    "ext": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
}
A = ICON["arrow"]

# Google-omdömen: bara uppgifter som finns i underlaget (inga texter eller betyg).
REVIEWS = [
    ("Peter Hansson", "8 recensioner", "För ett år sedan"),
    ("Björn Lidén", "173 recensioner · 28 foton", "För 6 år sedan"),
    ("Leif Ljung", "44 recensioner · 181 foton", "För 7 år sedan"),
    ("Andreas Uhlmann", "26 recensioner · 13 foton", "För 7 år sedan"),
    ("Filip Grönbäck Orre", "125 recensioner · 208 foton", "För 8 år sedan"),
]


def header(active: str) -> str:
    def on(key):
        return " on" if key == active else ""

    def cur(key):
        return ' class="on" aria-current="page"' if key == active else ""

    return f"""<a class="skip" href="#main">Hoppa till innehållet</a>
<header class="site">
  <div class="util"><div class="c">
    <span class="l">Surte Formverkstad AB · Form- och mekanisk verkstad sedan 1983</span>
    <div class="r">
      <span data-open><i class="dot"></i><span data-open-text>Öppet mån–fre 07–16</span></span>
      <a href="tel:{SITE['tel']}">{ICON['phone']}{SITE['phone']}</a>
      <a class="mail" href="mailto:{SITE['email']}">{ICON['mail']}{SITE['email']}</a>
    </div>
  </div></div>
  <div class="c bar">
    <a class="logo" href="index.html" aria-label="Surte Formverkstad – startsidan"><img src="assets/img/logo-mork.png" alt="Surte Formverkstad" width="254" height="67"></a>
    <nav class="main" id="meny" aria-label="Huvudmeny">
      <div class="dd{on('tjanster')}">
        <button type="button" aria-expanded="false" aria-controls="mega-tjanster">Tjänster {ICON['chev']}</button>
        <div class="mega" id="mega-tjanster"><div class="c">
          <div><h4>Bearbetning</h4><ul><li><a href="tjanster.html#bearbetning">CNC-svarvning</a></li><li><a href="tjanster.html#bearbetning">CNC-fräsning</a></li><li><a href="tjanster.html#bearbetning">Manuell svarvning</a></li><li><a href="tjanster.html#bearbetning">Borrning och kapning</a></li><li><a href="tjanster.html#bearbetning">Kilspår och splints</a></li><li><a href="tjanster.html#bearbetning">Programmering</a></li></ul></div>
          <div><h4>Svets &amp; sprutning</h4><ul><li><a href="tjanster.html#svets">TIG, MIG och MMA</a></li><li><a href="tjanster.html#svets">Svetsning av gjutjärn</a></li><li><a href="tjanster.html#svets">Termisk sprutning</a></li><li><a href="tjanster.html#svets">Värmebehandling</a></li></ul></div>
          <div><h4>Ytbehandling &amp; tvätt</h4><ul><li><a href="tjanster.html#yta">Blästring med glas</a></li><li><a href="tjanster.html#yta">Putsning och polering</a></li><li><a href="tjanster.html#yta">Trumling och pressning</a></li><li><a href="tjanster.html#yta">Detalj- och ultraljudstvätt</a></li><li><a href="tjanster.html#yta">Montering</a></li></ul></div>
          <div><h4>Via partners</h4><ul><li><a href="tjanster.html#partners">Vattenskärning</a></li><li><a href="tjanster.html#partners">5-axlig fräsning</a></li><li><a href="tjanster.html#partners">Bockning</a></li><li><a href="tjanster.html#partners">Gnistning</a></li><li><a href="tjanster.html#partners">Konstruktion</a></li><li><a href="tjanster.html#partners">Maskinflytt</a></li></ul></div>
          <div class="feat"><span class="label">Glasindustrin</span><img src="assets/img/formverktyg-sortiment.webp" alt="" width="442" height="285" loading="lazy"><b>Formar och verktyg för glasbruk</b><p>Kärnverksamheten sedan starten 1983.</p><a class="link" href="tjanster.html#branscher">Läs mer {A}</a></div>
        </div></div>
      </div>
      <div class="dd{on('maskinpark')}">
        <button type="button" aria-expanded="false" aria-controls="mega-maskinpark">Maskinpark {ICON['chev']}</button>
        <div class="mega small" id="mega-maskinpark"><div class="c">
          <div><h4>Bearbetning</h4><ul><li><a href="maskinpark.html#cnc">CNC-bearbetning</a></li><li><a href="maskinpark.html#manuell">Manuell bearbetning</a></li></ul></div>
          <div><h4>Svets &amp; värme</h4><ul><li><a href="maskinpark.html#svets">Svets, sprutning &amp; värme</a></li></ul></div>
          <div><h4>Yta &amp; tvätt</h4><ul><li><a href="maskinpark.html#yta">Polering &amp; ytbehandling</a></li><li><a href="maskinpark.html#tvatt">Tvätt &amp; rengöring</a></li></ul></div>
          <div class="feat"><span class="label">Största svarvdiameter</span><b style="font-size:34px;font-weight:500;margin-top:6px">Ø 550</b><p>Daewoo Puma 350, längd upp till 1050.</p><a class="link" href="maskinpark.html">Hela maskinparken {A}</a></div>
        </div></div>
      </div>
      <a href="tjanster.html#referenser">Referenser</a>
      <a href="om-oss.html"{cur('om-oss')}>Om oss</a>
      <a href="kontakt.html"{cur('kontakt')}>Kontakt</a>
      <a class="btn btn-primary mobile-cta" href="kontakt.html#forfragan">Skicka förfrågan {A}</a>
    </nav>
    <div class="hdr-r">
      <a class="hdr-tel" href="tel:{SITE['tel']}">{SITE['phone']}</a>
      <a class="btn btn-primary" href="kontakt.html#forfragan">Skicka förfrågan</a>
      <button class="burger" type="button" aria-label="Öppna menyn" aria-expanded="false" aria-controls="meny"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>"""


def footer() -> str:
    return f"""<footer class="site"><div class="c">
  <div class="ft">
    <div><img src="assets/img/logo-ljus.png" alt="Surte Formverkstad" width="254" height="67" loading="lazy"><p>Form- och mekanisk verkstad i Surte. Verktyg till glasindustrin och legobearbetning för tillverkande företag i hela Norden – sedan 1983.</p></div>
    <div><h4>Tjänster</h4><ul><li><a href="tjanster.html#bearbetning">CNC-bearbetning</a></li><li><a href="tjanster.html#svets">Svetsning</a></li><li><a href="tjanster.html#svets">Termisk sprutning</a></li><li><a href="tjanster.html#svets">Värmebehandling</a></li><li><a href="tjanster.html#yta">Ytbehandling</a></li></ul></div>
    <div><h4>Företaget</h4><ul><li><a href="om-oss.html">Om oss</a></li><li><a href="maskinpark.html">Maskinpark</a></li><li><a href="tjanster.html#referenser">Referenser</a></li><li><a href="kontakt.html">Kontakt</a></li></ul></div>
    <div><h4>Kontakt</h4><ul><li><a href="tel:{SITE['tel']}">{SITE['phone']}</a></li><li>Fax {SITE['fax']}</li><li><a href="mailto:{SITE['email']}">{SITE['email']}</a></li></ul></div>
    <div><h4>Besök</h4><ul><li>{SITE['street']}</li><li>{SITE['zip']} {SITE['city']}</li><li>Mån–fre 07–16</li><li>Lör–sön stängt</li></ul></div>
  </div>
  <div class="ft-mid"><b>Har du en förfrågan?</b><a class="btn btn-primary" href="kontakt.html#forfragan">Skicka förfrågan {A}</a></div>
  <div class="ft-bot"><span>© <span data-year>2026</span> {SITE['name']}</span><a href="integritetspolicy.html">Integritetspolicy</a></div>
</div></footer>"""


def reviews() -> str:
    rows = "\n".join(
        f'      <a href="{GOOGLE_URL}" target="_blank" rel="noopener"><span><b>{n}</b><span class="lg">Local Guide</span></span><span>{meta}</span><span>{when}</span>{ICON["ext"]}</a>'
        for n, meta, when in REVIEWS
    )
    return f"""<section class="bg-steel pad" id="omdomen"><div class="c rev">
  <div>
    <span class="label">Omdömen</span>
    <h2 class="h2" style="margin-top:12px">Recenserade på Google</h2>
    <p class="muted" style="margin-top:18px">Fem Local Guides har lämnat omdömen om Surte Formverkstad AB på Google Maps.</p>
    <a class="src" href="{GOOGLE_URL}" target="_blank" rel="noopener">{ICON['pin']}<span><b>Surte Formverkstad AB</b><small>Läs omdömena på Google Maps</small></span></a>
  </div>
  <div class="rev-list">
{rows}
  </div>
</div></section>"""


def cta() -> str:
    return f"""<section class="on-dark pad"><div class="c cta">
  <div>
    <h2 class="h1">Har du en ritning eller en detalj som behöver tillverkas?</h2>
    <p>Skicka ritning och beskrivning, så återkommer vi med pris och leveranstid. Eller ring – vi svarar vardagar 07–16.</p>
    <div class="acts"><a class="btn btn-primary" href="kontakt.html#forfragan">Skicka förfrågan {A}</a><a class="btn btn-line" href="maskinpark.html">Se maskinparken</a></div>
  </div>
  <div class="people">
    <a class="person" href="tel:+46706479010"><small>Direktnummer</small><b>Roger Persson</b><span>{ICON['phone']}0706-47 90 10</span></a>
    <a class="person" href="tel:+46706892554"><small>Direktnummer</small><b>Lennart Persson</b><span>{ICON['phone']}0706-89 25 54</span></a>
    <div class="person w"><a href="tel:{SITE['tel']}"><small>Växel · mån–fre 07–16</small><b>{SITE['phone']}</b></a><a href="mailto:{SITE['email']}"><span>{ICON['mail']}{SITE['email']}</span></a></div>
  </div>
</div></section>"""


def contact() -> str:
    return f"""<section class="pad" id="forfragan"><div class="c">
  <span class="label">Kontakt</span>
  <h2 class="h2" style="margin:12px 0 44px">Skicka en förfrågan</h2>
  <div class="contact">
    <form class="form" action="https://formsubmit.co/{SITE['email']}" method="POST" data-ajax="https://formsubmit.co/ajax/{SITE['email']}">
      <input type="hidden" name="_subject" value="Ny förfrågan från surteformverkstad.se">
      <input type="hidden" name="_template" value="table">
      <input type="hidden" name="_captcha" value="false">
      <input type="hidden" name="_next" value="{SITE['url']}/kontakt.html?skickat=1">
      <input class="hp" type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="field"><label for="f-namn">Namn *</label><input id="f-namn" name="Namn" autocomplete="name" placeholder="För- och efternamn" required></div>
      <div class="field"><label for="f-foretag">Företag</label><input id="f-foretag" name="Företag" autocomplete="organization"></div>
      <div class="field"><label for="f-epost">E-post *</label><input id="f-epost" name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="f-tel">Telefon</label><input id="f-tel" name="Telefon" type="tel" autocomplete="tel"></div>
      <div class="field full"><label for="f-msg">Vad behöver du hjälp med? *</label><textarea id="f-msg" name="Meddelande" placeholder="Material, antal och önskad leveranstid – ritningar kan du mejla till {SITE['email']}" required></textarea></div>
      <label class="cons full"><input type="checkbox" required><span>Jag godkänner att Surte Formverkstad sparar mina uppgifter för att besvara förfrågan. Läs mer i vår <a href="integritetspolicy.html">integritetspolicy</a>.</span></label>
      <div class="full"><button class="btn btn-primary" type="submit">Skicka förfrågan {A}</button></div>
      <div class="status full" role="status" aria-live="polite"></div>
    </form>
    <div>
      <div class="side">
        <a href="tel:{SITE['tel']}"><small>Växel</small><b>{SITE['phone']}</b></a>
        <a href="tel:+46706479010"><small>Roger Persson</small><b>0706-47 90 10</b></a>
        <a href="tel:+46706892554"><small>Lennart Persson</small><b>0706-89 25 54</b></a>
        <div><small>Fax</small><b>{SITE['fax']}</b></div>
        <a href="mailto:{SITE['email']}"><small>E-post</small><b>{SITE['email']}</b></a>
        <div><small>Öppettider</small><b>Mån–fre 07–16<br><span style="font-weight:400;color:var(--steel-600)">Lör–sön stängt</span></b></div>
      </div>
      <a class="map" href="{GOOGLE_URL}" target="_blank" rel="noopener" aria-label="Öppna {SITE['street']}, {SITE['city']} i Google Maps"><i></i><span class="pin">{SITE['street']}, {SITE['city']}</span><span class="go">Vägbeskrivning {ICON['ext']}</span><small>© OpenStreetMap-bidragsgivare</small></a>
    </div>
  </div>
</div></section>"""


def schema() -> str:
    return f"""<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"LocalBusiness","name":"{SITE['name']}","url":"{SITE['url']}","telephone":"{SITE['phone']}","faxNumber":"{SITE['fax']}","email":"{SITE['email']}","foundingDate":"1983","image":"{SITE['url']}/assets/img/formverktyg-sortiment.webp","address":{{"@type":"PostalAddress","streetAddress":"{SITE['street']}","postalCode":"{SITE['zip']}","addressLocality":"{SITE['city']}","addressCountry":"SE"}},"geo":{{"@type":"GeoCoordinates","latitude":57.842101,"longitude":12.019558}},"openingHoursSpecification":[{{"@type":"OpeningHoursSpecification","dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday"],"opens":"07:00","closes":"16:00"}}]}}
</script>"""


def page(meta: dict, body: str, slug: str) -> str:
    canonical = SITE["url"] + "/" + ("" if slug == "index" else f"{slug}.html")
    return f"""<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{meta['title']}</title>
<meta name="description" content="{meta['description']}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="{meta['title']}">
<meta property="og:description" content="{meta['description']}">
<meta property="og:image" content="{SITE['url']}/assets/img/formverktyg-sortiment.webp">
<meta property="og:locale" content="sv_SE">
<meta name="theme-color" content="#0A1F38">
<link rel="icon" href="assets/img/favicon.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/style.css">
{schema() if slug == 'index' else ''}
</head>
<body class="p-{slug}">
{header(meta.get('nav', ''))}
<main id="main">
{body.strip()}
</main>
{footer()}
<script src="assets/js/main.js" defer></script>
</body>
</html>
"""


def main():
    blocks = {"{{reviews}}": reviews(), "{{cta}}": cta(), "{{contact}}": contact()}
    for src in sorted(PAGES.glob("*.html")):
        text = src.read_text(encoding="utf-8")
        m = re.match(r"\s*<!--(.*?)-->", text, re.S)
        if not m:
            raise SystemExit(f"{src.name}: saknar metadata-kommentar")
        meta = {}
        for part in m.group(1).split("|"):
            k, _, v = part.partition(":")
            meta[k.strip()] = v.strip()
        body = text[m.end():]
        for k, v in blocks.items():
            body = body.replace(k, v)
        for k, v in ICON.items():
            body = body.replace("{{icon:" + k + "}}", v)
        for k, v in SITE.items():
            body = body.replace("{{" + k + "}}", v)
        left = re.findall(r"\{\{[^}]+\}\}", body)
        if left:
            raise SystemExit(f"{src.name}: okända platshållare {set(left)}")
        (ROOT / src.name).write_text(page(meta, body, src.stem), encoding="utf-8")
        print("byggde", src.name)


if __name__ == "__main__":
    main()
