# Stenvaller Entreprenad AB – hemsida

En enkel, statisk hemsida för Stenvaller Entreprenad AB (fastighetsskötsel, utemiljö och markservice i Stenungsund med
omnejd): startsida med tjänster, om oss, kontakt och karta, och en sida per tjänst. Ingen databas, ingen adminpanel och
inga löpande kostnader – sidan ligger gratis på GitHub Pages.

- Allt innehåll (texter, tjänster, bilder, färger, typsnitt, företagsuppgifter) ligger i `content/baseline.json`;
  formatet beskrivs i `lib/site/schema.ts`. Varje bygge kontrollerar filen mot schemat.
- Bilderna är stockfoton från Pexels (fria att använda) som länkas direkt, tills Stenvaller har egna foton. Egna foton
  läggs i `public/photos` (kör `npm run photos` för mindre kopior).
- Loggan (STEAB) ligger i `public/logo-steab.png` och ritas i textfärgen via en mask (`components/Wordmark.tsx`).
- Offertformuläret skickar e-post via FormSubmit (gratis). Mottagaren står i `components/QuoteForm.tsx`; under
  förhandsvisningen går förfrågningarna till Elevate Studio.
- Sidan publiceras automatiskt av `.github/workflows/deploy-pages.yml` vid varje push.
