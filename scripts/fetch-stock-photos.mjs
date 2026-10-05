// Downloads the stock photos the content links to on Pexels into public/photos, so the site serves its own copies, and
// points the content (content/baseline.json) at them. Each photo is saved as WebP at up to 2000 px wide with smaller
// copies for the srcset. A photo that cannot be downloaded keeps its Pexels address and is listed in
// public/photos/REPORT.txt. Run where Pexels can be reached (the fetch-photos workflow), then node scripts/sync-shared.mjs.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const CONTENT = "content/baseline.json";
const DIR = "public/photos";
const WIDTHS = [480, 800, 1200, 1600, 2000];
const pexelsId = (src) => src.match(/^https:\/\/images\.pexels\.com\/photos\/(\d+)\//)?.[1];

const doc = JSON.parse(readFileSync(CONTENT, "utf8"));
const images = [];
const collect = (node) => {
  if (!node || typeof node !== "object") return;
  if (typeof node.src === "string" && Array.isArray(node.variants) && pexelsId(node.src)) images.push(node);
  for (const value of Object.values(node)) collect(value);
};
collect(doc);

mkdirSync(DIR, { recursive: true });
const saved = new Map();
const failed = [];
for (const id of new Set(images.map((image) => pexelsId(image.src)))) {
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=2000`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const input = Buffer.from(await response.arrayBuffer());
    const { width } = await sharp(input).metadata();
    const variants = [];
    for (const w of WIDTHS.filter((w) => w < width).concat(Math.min(width, 2000))) {
      if (variants.some((v) => v.width === w)) continue;
      const src = `/photos/pexels-${id}-${w}.webp`;
      await sharp(input).resize({ width: w }).webp({ quality: 78 }).toFile(`public${src}`);
      variants.push({ width: w, src });
    }
    saved.set(id, variants);
    console.log(`${id}: ${variants.map((v) => v.width).join(", ")}`);
  } catch (error) {
    failed.push(`${id}  ${url}  ${error.message}`);
    console.error(`${id}: ${error.message}`);
  }
}

for (const image of images) {
  const variants = saved.get(pexelsId(image.src));
  if (!variants) continue;
  image.src = variants[variants.length - 1].src;
  image.variants = variants;
}
writeFileSync(CONTENT, JSON.stringify(doc, null, 2) + "\n");
writeFileSync(
  `${DIR}/REPORT.txt`,
  `Downloaded: ${saved.size}\nFailed: ${failed.length}\n${failed.join("\n")}\n`
);
console.log(`Downloaded ${saved.size}, failed ${failed.length}`);
