import { Reveal } from "../Reveal";
import { ServiceCard } from "../ServiceCard";
import { SiteLink } from "../SiteLink";
import { ArrowLabel, arrowLinkClasses } from "../Button";
import { list } from "@/lib/site/collection.ts";
import type { SectionProps } from "./types";

export function ServicesSection({ section, ctx }: SectionProps<"services">) {
  const services = list(ctx.site.services);
  const lastIndex = services.length - 1;
  // An odd number of cards: the last one spans two columns, so the 2- and 4-column grids fill without a gap.
  const widenLast = services.length % 2 === 1;

  return (
    <section id={section.anchor || undefined} className="scroll-mt-20">
      <div className="mx-auto max-w-content px-4 pb-16 pt-10 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        {/* The heading on the left and its link on the right, on one line from sm up. */}
        <Reveal className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <h2 className="text-h2 text-heading lg:text-h2-lg">{section.heading}</h2>
          {section.link.label && (
            <SiteLink href={section.link.href} className={arrowLinkClasses("sm:mb-3 sm:shrink-0")}>
              <ArrowLabel>{section.link.label}</ArrowLabel>
            </SiteLink>
          )}
        </Reveal>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-10 xl:grid-cols-4">
          {services.map((service, index) => {
            const wide = widenLast && index === lastIndex;
            return (
              <Reveal key={service.id} delayMs={(index % 4) * 70} className={wide ? "col-span-2" : ""}>
                <ServiceCard service={service} linkPrefix={section.cardLinkPrefix} wide={wide} />
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
