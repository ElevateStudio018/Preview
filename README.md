# Surte Formverkstad – ny webbplats

Statisk webbplats för Surte Formverkstad AB (Kvarnvägen 3, Surte). Ren HTML, CSS och lite JavaScript – inga beroenden. Typsnitt: Poppins.

## Sidor

| Sida | Fil |
|---|---|
| Startsida | `index.html` |
| Om oss | `om-oss.html` |
| Tjänster (inkl. referensbilder) | `tjanster.html` |
| Maskinpark | `maskinpark.html` |
| Kontakt (formulär, karta) | `kontakt.html` |
| Integritetspolicy | `integritetspolicy.html` |

## Redigera

HTML-filerna i roten **byggs** – ändra inte i dem direkt.

- Sidornas innehåll: `src/pages/*.html`
- Header, footer, Google-omdömen, karta och kontaktuppgifter: `tools/build.py`
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
