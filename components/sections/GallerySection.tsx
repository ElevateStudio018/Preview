import { GalleryGrid } from "../GalleryGrid";
import { SectionIntro } from "./SectionIntro";
import { list } from "@/lib/site/collection.ts";
import type { SectionProps } from "./types";

/** Photos in an even grid, each with an optional caption under it, opening in a full-screen viewer. Straight after a
 * section that opens the page (a product's text and facts) it carries on with less space above. */
export function GallerySection({ section, ctx }: SectionProps<"gallery">) {
  return (
    <section id={section.anchor || undefined} className="scroll-mt-20">
      <div className={`mx-auto max-w-content px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8 lg:pb-28 ${ctx.attached ? "pt-12 lg:pt-16" : "pt-16 sm:pt-20 lg:pt-28"}`}>
        <SectionIntro heading={section.heading} text={section.text} />
        <GalleryGrid
          entries={list(section.images)}
          labels={{ close: ctx.site.ui.closeLabel, previous: ctx.site.ui.carouselPrevious, next: ctx.site.ui.carouselNext }}
        />
      </div>
    </section>
  );
}
