import { Reveal } from "../Reveal";
import { SiteLink } from "../SiteLink";
import { ArrowLabel, arrowLinkClasses } from "../Button";
import { ZoomImage } from "../ZoomImage";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { SectionProps } from "./types";

export function AboutSection({ section }: SectionProps<"about">) {
  return (
    <section id={section.anchor || undefined} className="scroll-mt-20 bg-card">
      <div className="mx-auto grid max-w-content grid-cols-1 gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 lg:px-8 lg:py-28">
        <Reveal>
          <h2 className="text-h2 text-heading lg:text-h2-lg">{section.heading}</h2>
          {section.link.label && (
            <SiteLink href={section.link.href} className={arrowLinkClasses("mt-0.5 lg:mt-2")}>
              <ArrowLabel>{section.link.label}</ArrowLabel>
            </SiteLink>
          )}
          {section.subheading && <p className="mt-6 text-copy font-semibold text-heading lg:text-[22px]">{section.subheading}</p>}
          {section.text && <p className="mt-4 text-copy text-body">{section.text}</p>}
        </Reveal>

        <Reveal delayMs={120} className="lg:pt-2">
          <div className="relative aspect-[4/3] overflow-hidden bg-primary/20 lg:aspect-[4/5]">
            <ZoomImage
              {...imageProps(section.image, "(min-width: 1280px) 480px, (min-width: 1024px) 40vw, 100vw")}
              alt={section.image.alt}
              loading="lazy"
              style={focusStyle(section.image)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
