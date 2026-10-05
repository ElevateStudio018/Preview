# Stenvaller Entreprenad AB – hemsida och adminpanel

Hemsidan för Stenvaller Entreprenad AB (fastighetsskötsel, utemiljö och markservice i Stenungsund med omnejd) med
adminpanel. Byggd på samma grund som Markmontage-hemsidan.

- Innehållet (texter, tjänster, sidor, bilder, färger, typsnitt, företagsuppgifter) ligger i `content/baseline.json`;
  formatet beskrivs i `lib/site/schema.ts`. Kör `node scripts/sync-shared.mjs` efter ändringar i den eller i `lib/site`.
- Bilderna är stockfoton från Pexels (fria att använda) som länkas direkt, tills Stenvaller har egna foton. Egna foton
  läggs i `public/photos` (kör `npm run photos`) eller laddas upp i adminpanelen.
- Loggan (STEAB) ligger i `public/logo-steab.png` och ritas i textfärgen via en mask (`components/Wordmark.tsx`).
- `SETUP.md` beskriver hur adminpanelen kopplas till Supabase.
