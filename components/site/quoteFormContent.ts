import { list } from "@/lib/site/collection.ts";
import type { SiteData } from "@/lib/site/schema.ts";
import type { QuoteFormContent } from "../QuoteForm";

/** Just the parts of the content the quote form needs, as it is handed to the browser. */
export function quoteFormContent(site: SiteData): QuoteFormContent {
  return {
    texts: site.form,
    workTypes: list(site.form.workTypes).map(({ id, label }) => ({ id, label })),
    phone: site.company.phone,
    // The products the form can be opened for: each project card that leads to a page of its own ("Förråd 25 · 36 000 kr").
    products: list(site.uppdrag)
      .filter((item) => /^\/[a-z0-9-]+$/.test(item.href))
      .map((item) => ({ slug: item.href.slice(1), name: item.title.split(" · ")[0], tag: item.tag })),
  };
}
