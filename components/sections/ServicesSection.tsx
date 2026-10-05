import { Reveal } from "../Reveal";
import { SiteLink } from "../SiteLink";
import { ProductCatalog } from "../ProductCatalog";
import { ArrowLabel, arrowLinkClasses } from "../Button";
import { list } from "@/lib/site/collection.ts";
import type { SectionProps } from "./types";

export function ServicesSection({ section, ctx }: SectionProps<"services">) {
  return (
    <section id={section.anchor || undefined} className="scroll-mt-20">
      <div className="mx-auto max-w-content px-4 pb-16 pt-10 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <ProductCatalog
          services={list(ctx.site.services)}
          linkPrefix={section.cardLinkPrefix}
          heading={
            <Reveal>
              <h2 className="text-h2 text-heading lg:text-h2-lg">{section.heading}</h2>
              {section.link.label && (
                <SiteLink href={section.link.href} className={arrowLinkClasses("mt-2 lg:mt-4")}>
                  <ArrowLabel>{section.link.label}</ArrowLabel>
                </SiteLink>
              )}
            </Reveal>
          }
        />
      </div>
    </section>
  );
}
