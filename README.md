# Cabinord AB – hemsida och adminpanel (förhandsvisning)

Hemsidan för Cabinord AB (trähus, förråd, friggebodar, bastur, attefallshus, garage och stugor direkt från fabriken på
Haraholmen i Piteå) med adminpanel. Byggd på samma grund som Stenvaller-hemsidan.

- Innehållet (texter, produkter, priser, sidor, bilder, färger, typsnitt, företagsuppgifter) ligger i
  `content/baseline.json`; formatet beskrivs i `lib/site/schema.ts`. Kör `node scripts/sync-shared.mjs` efter ändringar
  i den eller i `lib/site`.
- Produkterna, texterna och bilderna är hämtade från cabinord.se med `scripts/scrape-cabinord.mjs` (arbetsflödet
  "Fetch Cabinord products"). Rådata ligger i `scrape/`, bilderna i `public/photos/cabinord`. Priserna finns inte
  längre på cabinord.se; de som står på sidan kommer från en äldre version av den.
- Loggan är tills vidare ett ritat ordmärke (`components/Wordmark.tsx`); en riktig logga laddas upp i adminpanelen.
- `SETUP.md` beskriver hur adminpanelen kopplas till Supabase.
