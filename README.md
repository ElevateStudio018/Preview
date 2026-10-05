# Cabinord AB – hemsida och adminpanel (förhandsvisning)

Hemsidan för Cabinord AB (trähus, förråd, friggebodar, bastur, attefallshus, garage och stugor direkt från fabriken på
Haraholmen i Piteå) med adminpanel. Byggd på samma grund som Stenvaller-hemsidan.

- Innehållet (texter, produkter, priser, sidor, bilder, färger, typsnitt, företagsuppgifter) ligger i
  `content/baseline.json`; formatet beskrivs i `lib/site/schema.ts`. Kör `node scripts/sync-shared.mjs` efter ändringar
  i den eller i `lib/site`.
- Uppgifterna är hämtade från cabinord.se. Bilderna är stockfoton från Pexels (fria att använda) som länkas direkt,
  tills Cabinord har egna foton. Egna foton läggs i `public/photos` (kör `npm run photos`) eller laddas upp i adminpanelen.
- Loggan är tills vidare ett ritat ordmärke (`components/Wordmark.tsx`); en riktig logga laddas upp i adminpanelen.
- `SETUP.md` beskriver hur adminpanelen kopplas till Supabase.
