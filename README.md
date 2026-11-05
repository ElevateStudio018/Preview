# Surte Formverkstad – ny webbplats

Statisk webbplats för Surte Formverkstad AB (Kvarnvägen 3, Surte). Ren HTML, CSS och lite JavaScript – inga beroenden.

**Design:** stram industriell stil med frilagda produkter på stålgrå scen. Typsnitt Outfit (rubriker) och DM Sans (brödtext, knappar). Färgpaket i CSS-variablerna överst i `assets/css/style.css`:

| Token | Färg | Används till |
|---|---|---|
| `--navy-900` | #0A1F38 | rubriker, header, footer, mörka sektioner |
| `--blue-600` | #1F6FB5 | knappar, länkar, aktivt läge |
| `--steel-50` … `--steel-900` | #F5F6F8 … #141A21 | ytor, linjer, text |
| `--brass-500` | #B4873A | signaturdetalj (linjer, siffror på mörkt) |

**Bilder:** produktbilderna är frilagda med BiRefNet och sparade som transparent WebP i `assets/img/`. Kartan på kontaktsidan är en statisk bild från OpenStreetMap (© OpenStreetMap-bidragsgivare) som länkar till Google Maps.

## Sidor

| Sida | Fil |
|---|---|
| Startsida | `index.html` |
| Om oss | `om-oss.html` |
| Tjänster (tjänsteområden, branscher, partners, referensbilder) | `tjanster.html` |
| Maskinpark (nyckelkapacitet + filtrerbar maskinlista) | `maskinpark.html` |
| Kontakt (formulär, karta) | `kontakt.html` |
| Integritetspolicy | `integritetspolicy.html` |

## Redigera

HTML-filerna i roten **byggs** – ändra inte i dem direkt.

- Sidornas innehåll: `src/pages/*.html`
- Header med meganavigering, footer, Google-omdömen, CTA, kontaktformulär och kontaktuppgifter: `tools/build.py`
- Stil: `assets/css/style.css` (färger som CSS-variabler överst)

Bygg efter ändringar:

```bash
python3 tools/build.py
```

## Innehåll

All information (texter, tjänster, maskinlista, kontaktuppgifter, bilder och logotyp) kommer från företagets tidigare webbplats surteformverkstad.se. Texterna är omskrivna från grunden; fakta är oförändrade. Maskinlistan var på gamla sajten märkt "Senast uppdaterad 2012-08-10" – stäm av den med företaget.

Google-omdömena visar bara namn och Local Guide-uppgifter, eftersom recensionstexter och betyg inte fanns i underlaget. Lägg till dem i `REVIEWS` i `tools/build.py` om de ska visas.

## Formulär

Kontaktformuläret skickas till info@surteformverkstad.se via FormSubmit. **Första gången** någon skickar formuläret från den publicerade sajten mejlar FormSubmit en aktiveringslänk till den adressen – klicka på den en gång, sedan levereras alla meddelanden.
