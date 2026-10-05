// Kept free of the schema (and so of zod), as the browser needs these.

/** The href that opens the quote form instead of going anywhere. */
export const QUOTE_HREF = "#offert";

/** Links that open the quote form rather than going anywhere; "#offert-forrad-25" opens it filled in for that product. */
export function isQuoteHref(href: string): boolean {
  return href === QUOTE_HREF || href.startsWith(`${QUOTE_HREF}-`);
}

/** The product a quote link is for ("forrad-25" in "#offert-forrad-25"), if any. */
export function quoteProduct(href: string): string | undefined {
  return href.startsWith(`${QUOTE_HREF}-`) ? href.slice(QUOTE_HREF.length + 1) : undefined;
}

/** Addresses outside the site, which open in a new tab. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//.test(href);
}

/** Addresses that leave the browser for another app (mail, phone). */
export function isAppHref(href: string): boolean {
  return /^(mailto|tel):/.test(href);
}
