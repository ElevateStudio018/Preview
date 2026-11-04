#!/usr/bin/env python3
"""Bygger sajtens HTML-sidor.

Varje sida ligger i src/pages/<namn>.html. Första raden i filen är ett
HTML-kommentarblock med metadata:

    <!-- title: ... | description: ... | nav: start -->

Resten av filen är sidans innehåll (mellan header och footer).
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
}

NAV = [
    ("start", "index.html", "Start"),
    ("om-oss", "om-oss.html", "Om oss"),
    ("tjanster", "tjanster.html", "Tjänster"),
    ("maskinpark", "maskinpark.html", "Maskinpark"),
    ("kontakt", "kontakt.html", "Kontakt"),
]

ICON = {
    "phone": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5L16 14l4 1.5V19a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>',
    "mail": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/></svg>',
    "pin": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    "clock": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    "check": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>',
    "arrow": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
}


# Google-omdömen. Bara namn och uppgifter som finns i underlaget – inga
# recensionstexter eller betyg, eftersom de saknades.
REVIEWS = [
    ("Peter Hansson", "8 recensioner", "för ett år sedan"),
    ("Björn Lidén", "173 recensioner · 28 foton", "för 6 år sedan"),
    ("Leif Ljung", "44 recensioner · 181 foton", "redigerat för 7 år sedan"),
    ("Andreas Uhlmann", "26 recensioner · 13 foton", "redigerat för 7 år sedan"),
    ("Filip Grönbäck Orre", "125 recensioner · 208 foton", "för 8 år sedan"),
]
GOOGLE_URL = "https://maps.google.com/?cid=3285162890577837130"
MAP_EMBED = "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d33977.57041965471!2d12.019558!3d57.842101!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x46455fbf514b1b1b%3A0x2d973e3e522ffc4a!2sSurte%20Formverkstad%20AB!5e0!3m2!1ssv!2sse!4v1777888308597!5m2!1ssv!2sse"

STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3 6.6 7 .8-5.2 4.9 1.4 7-6.2-3.6L5.8 21.3l1.4-7L2 9.4l7-.8z"/></svg>'
EXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>'


def initials(name: str) -> str:
    parts = name.split()
    return (parts[0][0] + parts[-1][0]).upper()


def reviews() -> str:
    cards = "\n".join(
        f"""      <article class="review reveal d{i % 5}">
        <div class="avatar" aria-hidden="true">{initials(n)}</div>
        <div>
          <cite>{n}</cite>
          <span class="guide">{STAR}Local Guide</span>
        </div>
        <p class="meta">{meta}</p>
        <div class="when"><span>Omdöme på Google, {when}</span></div>
      </article>"""
        for i, (n, meta, when) in enumerate(REVIEWS)
    )
    return f"""<section class="bg-2" id="omdomen">
  <div class="wrap">
    <div class="reviews-head">
      <div class="reveal">
        <span class="eyebrow">Omdömen</span>
        <h2 class="h2">Kunder och besökare som har <em class="hl">recenserat oss på Google</em>.</h2>
      </div>
      <a class="g-card reveal d1" href="{GOOGLE_URL}" target="_blank" rel="noopener">
        <span class="g">{ICON['pin']}</span>
        <span><b>Surte Formverkstad AB på Google</b><span>Läs omdömena i sin helhet på Google Maps</span></span>
      </a>
    </div>
    <div class="review-grid">
{cards}
    </div>
    <div class="reviews-foot reveal">
      <a class="arrow-link" href="{GOOGLE_URL}" target="_blank" rel="noopener">Se alla omdömen på Google {ICON['arrow']}</a>
    </div>
  </div>
</section>"""


def mapband() -> str:
    return f"""<section class="mapband" aria-label="Karta till verkstaden">
  <iframe src="{MAP_EMBED}" title="Karta: {SITE['street']}, {SITE['zip']} {SITE['city']}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
  <div class="mapcard">
    <h3>Hitta till oss</h3>
    <ul>
      <li>{ICON['pin']}<span>{SITE['street']}<br>{SITE['zip']} {SITE['city']}</span></li>
      <li>{ICON['clock']}<span>Mån–fre 07–16<br>Lör–sön stängt</span></li>
      <li>{ICON['phone']}<a href="tel:{SITE['tel']}">{SITE['phone']}</a></li>
    </ul>
    <a class="btn btn-primary" href="{GOOGLE_URL}" target="_blank" rel="noopener">Vägbeskrivning {ICON['arrow']}</a>
  </div>
</section>"""


def header(active: str) -> str:
    cur = ' class="active" aria-current="page"'
    links = "\n".join(
        f'        <a href="{href}"{cur if key == active else ""}>{label}</a>'
        for key, href, label in NAV
    )
    return f"""<a class="skip" href="#main">Hoppa till innehållet</a>
<div class="topbar">
  <div class="wrap">
    <div class="tb-l">
      <span>{ICON['clock']}Mån–fre 07–16</span>
      <span class="hide-sm">{ICON['pin']}{SITE['street']}, {SITE['zip']} {SITE['city']}</span>
    </div>
    <div class="tb-r">
      <a href="tel:{SITE['tel']}">{ICON['phone']}{SITE['phone']}</a>
      <a class="hide-sm" href="mailto:{SITE['email']}">{ICON['mail']}{SITE['email']}</a>
    </div>
  </div>
</div>
<header class="site">
  <div class="wrap">
    <a class="logo" href="index.html" aria-label="Surte Formverkstad, till startsidan"><img src="assets/img/logo-mork.png" alt="Surte Formverkstad" width="254" height="67"></a>
    <nav class="main" id="meny" aria-label="Huvudmeny">
{links}
        <a class="nav-cta" href="kontakt.html#forfragan">Skicka förfrågan</a>
    </nav>
    <div class="hdr-cta">
      <a class="hdr-phone" href="tel:{SITE['tel']}"><small>Ring verkstaden</small><b>{SITE['phone']}</b></a>
      <a class="btn btn-primary" href="kontakt.html#forfragan">Begär offert {ICON['arrow']}</a>
    </div>
    <button class="burger" aria-label="Öppna menyn" aria-expanded="false" aria-controls="meny"><span></span><span></span><span></span></button>
  </div>
</header>"""


def footer() -> str:
    links = "\n".join(f'          <li><a href="{href}">{label}</a></li>' for _, href, label in NAV)
    return f"""<footer class="site">
  <div class="wrap">
    <div class="ft-grid">
      <div class="ft-brand">
        <img src="assets/img/logo-ljus.png" alt="Surte Formverkstad" width="254" height="67" loading="lazy">
        <p>Form- och mekanisk verkstad i Surte. Verktyg till glasindustrin och legobearbetning för tillverkande företag i hela Norden – sedan 1983.</p>
      </div>
      <div>
        <h4>Sidor</h4>
        <ul>
{links}
        </ul>
      </div>
      <div>
        <h4>Kontakt</h4>
        <ul>
          <li><a href="tel:{SITE['tel']}">{SITE['phone']}</a></li>
          <li><a href="mailto:{SITE['email']}">{SITE['email']}</a></li>
          <li>Fax 031-98 34 40</li>
        </ul>
      </div>
      <div>
        <h4>Besök oss</h4>
        <ul>
          <li>{SITE['street']}</li>
          <li>{SITE['zip']} {SITE['city']}</li>
          <li>Mån–fre 07–16</li>
          <li>Lör–sön stängt</li>
        </ul>
      </div>
    </div>
    <div class="ft-bottom">
      <span>© <span data-year>2026</span> {SITE['name']}</span>
      <a href="integritetspolicy.html">Integritetspolicy</a>
    </div>
  </div>
</footer>"""


def schema() -> str:
    return f"""<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"LocalBusiness","name":"{SITE['name']}","url":"{SITE['url']}","telephone":"{SITE['phone']}","email":"{SITE['email']}","faxNumber":"031-98 34 40","image":"{SITE['url']}/assets/img/formverktyg-sortiment.jpg","address":{{"@type":"PostalAddress","streetAddress":"{SITE['street']}","postalCode":"{SITE['zip']}","addressLocality":"{SITE['city']}","addressCountry":"SE"}},"geo":{{"@type":"GeoCoordinates","latitude":57.842101,"longitude":12.019558}},"openingHoursSpecification":[{{"@type":"OpeningHoursSpecification","dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday"],"opens":"07:00","closes":"16:00"}}],"foundingDate":"1983"}}
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
<meta property="og:image" content="{SITE['url']}/assets/img/formverktyg-sortiment.jpg">
<meta property="og:locale" content="sv_SE">
<meta name="theme-color" content="#0c1824">
<link rel="icon" href="assets/img/favicon.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/style.css">
{schema() if slug == 'index' else ''}
</head>
<body class="page-{slug}">
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
        for k, v in SITE.items():
            body = body.replace("{{" + k + "}}", v)
        body = body.replace("{{reviews}}", reviews()).replace("{{map}}", mapband())
        body = body.replace("{{check}}", ICON["check"])
        for k, v in ICON.items():
            body = body.replace("{{icon:" + k + "}}", v)
        out = ROOT / src.name
        out.write_text(page(meta, body, src.stem), encoding="utf-8")
        print("byggde", out.name)


if __name__ == "__main__":
    main()
