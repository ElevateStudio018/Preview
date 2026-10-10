// The content the site is built from: content/snapshot.json, which scripts/fetch-snapshot.ts writes from
// content/baseline.json before every build.
import snapshot from "@/content/snapshot.json";
import fonts from "@/content/fonts.json";
import { siteDataSchema, type SiteData } from "./schema.ts";
import { withBasePath } from "./images.ts";

let site: SiteData | undefined;

export function getSite(): SiteData {
  site ??= siteDataSchema.parse(snapshot);
  return site;
}

/** @font-face rules for the fonts the build downloaded (scripts/fonts.ts); empty while the site uses only Figtree. */
export function fontFaceCss(): string {
  return (fonts as { family: string; style: string; weight: string; src: string; unicodeRange: string }[])
    .map(
      (face) =>
        `@font-face{font-family:"${face.family}";font-style:${face.style};font-weight:${face.weight};font-display:swap;src:url("${withBasePath(face.src)}") format("woff2");${
          face.unicodeRange ? `unicode-range:${face.unicodeRange};` : ""
        }}`
    )
    .join("");
}
