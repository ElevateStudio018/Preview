// Fetches Cabinord's products from cabinord.se into the repository, for the content to be built from: every product
// in the product categories (name, price, texts, category) with all its photos, the photos of the image galleries,
// and the raw pages for reference. Writes scrape/cabinord.json and scrape/html/*.html, and the photos as WebP (up to
// 2000 px, with smaller copies) in public/photos/cabinord. Run where cabinord.se can be reached (the
// scrape-cabinord workflow). Needs cheerio: npm i --no-save cheerio
import { mkdirSync, writeFileSync } from "node:fs";
import { load } from "cheerio";
import sharp from "sharp";

const ORIGIN = "https://www.cabinord.se";
const START = [`${ORIGIN}/produkt-kategori/produkter/`, `${ORIGIN}/`];
const PHOTO_DIR = "public/photos/cabinord";
const WIDTHS = [480, 800, 1200, 1600, 2000];
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

mkdirSync("scrape/html", { recursive: true });
mkdirSync(PHOTO_DIR, { recursive: true });

const log = [];
const note = (line) => {
  console.log(line);
  log.push(line);
};

async function get(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
}

const pages = new Map();
async function page(url) {
  url = url.split("#")[0];
  if (pages.has(url)) return pages.get(url);
  try {
    const html = await (await get(url)).text();
    const name = new URL(url).pathname.replace(/^\/|\/$/g, "").replace(/[^a-z0-9]+/gi, "_") || "start";
    writeFileSync(`scrape/html/${name}.html`, html);
    const $ = load(html);
    pages.set(url, $);
    return $;
  } catch (error) {
    note(`page failed: ${url} ${error.message}`);
    pages.set(url, null);
    return null;
  }
}

const absolute = (href, base) => {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
};
const isInternal = (url) => url && url.startsWith(ORIGIN);
const isImage = (url) => /\.(jpe?g|png|webp)(\?|$)/i.test(url || "");
// WordPress names its smaller copies "photo-300x200.jpg"; the original has no size suffix.
const original = (url) => url.replace(/-\d{2,5}x\d{2,5}(?=\.(jpe?g|png|webp)$)/i, "").replace(/-scaled(?=\.(jpe?g|png|webp)$)/i, "");
const text = ($, el) => $(el).text().replace(/\s+/g, " ").trim();
const paragraphs = ($, root) =>
  $(root)
    .find("p, li, h2, h3, h4")
    .map((_, el) => text($, el))
    .get()
    .filter(Boolean);

/** Every photo a page shows: gallery links, image sources and srcsets, lazy-load attributes and background images. */
function photosOn($, base, scope = "body") {
  const found = [];
  const add = (src) => {
    const url = absolute(src, base);
    if (url && isImage(url) && /wp-content\/uploads/.test(url)) found.push(original(url));
  };
  $(scope)
    .find("a[href]")
    .each((_, el) => add($(el).attr("href")));
  $(scope)
    .find("img")
    .each((_, el) => {
      for (const attr of ["data-large_image", "data-src", "data-lazy-src", "src"]) {
        const value = $(el).attr(attr);
        if (value && !value.startsWith("data:")) add(value);
      }
      for (const attr of ["srcset", "data-srcset"]) {
        const set = $(el).attr(attr);
        if (set) for (const part of set.split(",")) add(part.trim().split(/\s+/)[0]);
      }
    });
  $(scope)
    .find("[style*='background']")
    .each((_, el) => {
      for (const match of ($(el).attr("style") || "").matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) add(match[1]);
    });
  $(scope)
    .find("[data-src], [data-bg], [data-background]")
    .each((_, el) => {
      for (const attr of ["data-src", "data-bg", "data-background"]) add($(el).attr(attr));
    });
  return [...new Set(found)];
}

// 1. The product links, from the product categories (all pages of each) and the menus.
const categoryUrls = new Set();
const productUrls = new Set();
const galleryUrls = new Set();
const queue = [...START];
const seenListing = new Set();
while (queue.length) {
  const url = queue.shift();
  if (seenListing.has(url)) continue;
  seenListing.add(url);
  const $ = await page(url);
  if (!$) continue;
  $("a[href]").each((_, el) => {
    const href = absolute($(el).attr("href"), url);
    if (!isInternal(href)) return;
    const clean = href.split("#")[0].split("?")[0];
    const label = text($, el).toLowerCase();
    if (/\/produkt-kategori\//.test(clean) && !categoryUrls.has(clean)) {
      categoryUrls.add(clean);
      queue.push(clean);
    } else if (/\/produkter\/[^/]+\/?$/.test(clean)) productUrls.add(clean);
    if (/galleri/.test(label) || /galleri/.test(clean)) galleryUrls.add(clean);
    if (/\/page\/\d+\/?$/.test(clean) && /produkt-kategori/.test(clean)) queue.push(clean);
  });
}
note(`categories: ${categoryUrls.size}, products: ${productUrls.size}, galleries: ${galleryUrls.size}`);

// 2. Each product: its texts, price, categories, photos, and the photos of any gallery it links to.
const products = [];
for (const url of [...productUrls].sort()) {
  const $ = await page(url);
  if (!$) continue;
  const main = $(".product").first().length ? $(".product").first() : $("main, #main, #content, body").first();
  const name = text($, $("h1.product_title, h1.entry-title, h1").first());
  const price = text($, main.find(".summary .price, p.price, .price").first());
  const short = paragraphs($, main.find(".woocommerce-product-details__short-description").first());
  const description = paragraphs($, main.find("#tab-description, .woocommerce-Tabs-panel--description, .entry-content").first());
  const attributes = main
    .find(".woocommerce-product-attributes tr, .shop_attributes tr")
    .map((_, row) => ({ label: text($, $(row).find("th")), value: text($, $(row).find("td")) }))
    .get();
  const categories = main
    .find(".posted_in a, .product_meta a[rel=tag]")
    .map((_, a) => text($, a))
    .get();
  let photos = photosOn($, url, main.length ? main : "body");
  // Links on the product page to a gallery ("Bildgalleri") or other pages of images.
  const galleryLinks = main
    .find("a[href]")
    .filter((_, a) => /galleri|bilder/i.test(text($, a)) || /galleri/i.test($(a).attr("href") || ""))
    .map((_, a) => absolute($(a).attr("href"), url))
    .get()
    .filter((href) => isInternal(href) && !isImage(href));
  for (const link of new Set(galleryLinks)) {
    const $gallery = await page(link);
    if ($gallery) photos = photos.concat(photosOn($gallery, link));
  }
  photos = [...new Set(photos)];
  products.push({ url, name, price, short, description, attributes, categories, photos, galleryLinks: [...new Set(galleryLinks)] });
  note(`${name || url}: ${price || "no price"}, ${photos.length} photos`);
}

// 3. The site's own galleries, and the photos on the start page (its big top photo among them).
const galleries = [];
{
  const $ = await page(`${ORIGIN}/`);
  if ($) galleries.push({ url: `${ORIGIN}/`, title: "Startsidan", photos: photosOn($, `${ORIGIN}/`) });
}
for (const url of galleryUrls) {
  const $ = await page(url);
  if (!$) continue;
  galleries.push({ url, title: text($, $("h1").first()), photos: photosOn($, url) });
}

// 4. Every photo, downloaded once.
const allPhotos = [...new Set([...products.flatMap((p) => p.photos), ...galleries.flatMap((g) => g.photos)])];
const saved = {};
for (const url of allPhotos) {
  const base = new URL(url).pathname.split("/").pop().replace(/\.[a-z]+$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
  try {
    let response;
    try {
      response = await get(url);
    } catch {
      // Some originals are only kept at a size; fall back to the largest copy WordPress usually makes.
      response = await get(url.replace(/(\.(jpe?g|png|webp))$/i, "-1024x768$1"));
    }
    const input = Buffer.from(await response.arrayBuffer());
    const meta = await sharp(input).metadata();
    if (!meta.width || meta.width < 300) {
      note(`photo skipped (small): ${url}`);
      continue;
    }
    const variants = [];
    const top = Math.min(meta.width, 2000);
    for (const w of [...WIDTHS.filter((w) => w < top), top]) {
      if (variants.some((v) => v.width === w)) continue;
      const src = `/photos/cabinord/${base}-${w}.webp`;
      await sharp(input).rotate().resize({ width: w }).webp({ quality: 78 }).toFile(`public${src}`);
      variants.push({ width: w, src });
    }
    saved[url] = { width: meta.width, height: meta.height, variants };
  } catch (error) {
    note(`photo failed: ${url} ${error.message}`);
  }
}
note(`photos saved: ${Object.keys(saved).length} of ${allPhotos.length}`);

writeFileSync(
  "scrape/cabinord.json",
  JSON.stringify({ fetched: new Date().toISOString(), categories: [...categoryUrls], products, galleries, photos: saved, log }, null, 2) + "\n"
);
