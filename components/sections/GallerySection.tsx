import { Photo } from "../Photo";
import { Reveal } from "../Reveal";
import { SectionIntro } from "./SectionIntro";
import { list } from "@/lib/site/collection.ts";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { SectionProps } from "./types";

/** Photos in an even grid, each with an optional caption under it. */
export function GallerySection({ section }: SectionProps<"gallery">) {
  return (
    <section id={section.anchor || undefined} className="scroll-mt-20">
      <div className="mx-auto max-w-content px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <SectionIntro heading={section.heading} text={section.text} />
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
          {list(section.images).map((entry, index) => (
            <Reveal key={entry.id} as="li" delayMs={(index % 3) * 70}>
              <figure>
                <div className="relative aspect-[4/3] overflow-hidden bg-primary/20">
                  <Photo
                    {...imageProps(entry.image, "(min-width: 1024px) 33vw, 50vw")}
                    alt={entry.image.alt}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={focusStyle(entry.image)}
                  />
                </div>
                {entry.caption && <figcaption className="mt-2.5 text-[15px] leading-snug text-muted">{entry.caption}</figcaption>}
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
