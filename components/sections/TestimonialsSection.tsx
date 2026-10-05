import { Icon } from "../Icon";
import { Photo } from "../Photo";
import { Reveal } from "../Reveal";
import { SectionIntro } from "./SectionIntro";
import { list } from "@/lib/site/collection.ts";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import { fill } from "@/lib/site/format.ts";
import type { SectionProps } from "./types";

/** What customers say: the quote, an optional star rating and who said it. */
export function TestimonialsSection({ section, ctx }: SectionProps<"testimonials">) {
  return (
    <section id={section.anchor || undefined} className="scroll-mt-20 bg-card">
      <div className="mx-auto max-w-content px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <SectionIntro heading={section.heading} text={section.text} />
        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {list(section.items).map((item, index) => (
            <Reveal key={item.id} as="li" delayMs={(index % 3) * 70} className="flex flex-col border-t-[3px] border-accent bg-page p-7 sm:p-8">
              <figure className="flex flex-1 flex-col">
                <Icon name="Quote" aria-hidden="true" className="h-8 w-8 text-accent-ink" />
                {item.rating > 0 && (
                  <p className="mt-4 flex gap-1 text-accent-ink" aria-label={fill(ctx.site.ui.ratingLabel, { n: item.rating })}>
                    {Array.from({ length: 5 }, (_, star) => (
                      <Icon key={star} name="Star" aria-hidden="true" className={`h-5 w-5 ${star < item.rating ? "fill-current" : "opacity-30"}`} />
                    ))}
                  </p>
                )}
                <blockquote className="mt-4 flex-1 text-copy leading-[1.45] text-body lg:text-[18px]">{item.quote}</blockquote>
                <figcaption className="mt-6 flex items-center gap-4">
                  {item.image && (
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden bg-primary/20">
                      <Photo
                        {...imageProps(item.image, "48px")}
                        alt={item.image.alt}
                        className="absolute inset-0 h-full w-full object-cover"
                        style={focusStyle(item.image)}
                      />
                    </span>
                  )}
                  <span>
                    <span className="block text-[17px] font-semibold text-heading">{item.name}</span>
                    {item.detail && <span className="block text-[15px] text-muted">{item.detail}</span>}
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
