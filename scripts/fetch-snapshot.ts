// Runs before every build and dev start (npm prebuild/predev): checks content/baseline.json against the schema, writes
// it to content/snapshot.json for the site to be built from, and downloads the theme's fonts (scripts/fonts.ts).
import { readFileSync, writeFileSync } from "node:fs";
import { siteDataSchema } from "../lib/site/schema.ts";
import { downloadFonts } from "./fonts.ts";

async function main() {
  const site = siteDataSchema.parse(JSON.parse(readFileSync("content/baseline.json", "utf8")));
  writeFileSync("content/snapshot.json", JSON.stringify(site));
  writeFileSync("content/fonts.json", JSON.stringify(await downloadFonts(site)));
  console.log("snapshot: content/baseline.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
