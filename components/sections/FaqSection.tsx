import { Reveal } from "../Reveal";
import { tapTarget } from "../Button";
import { FaqAccordion } from "../FaqAccordion";
import { list } from "@/lib/site/collection.ts";
import { toTelHref } from "@/lib/site/format.ts";
import type { SectionProps } from "./types";

export function FaqSection({ section, ctx }: SectionProps<"faq">) {
  const { phone } = ctx.site.company;
  return (
    <section id={section.anchor || undefined} className="scroll-mt-20">
      <div className="mx-auto grid max-w-content grid-cols-1 gap-10 px-4 pb-16 pt-12 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16 lg:px-8 lg:py-28">
        <Reveal>
          <h2 className="text-h2 text-heading lg:text-h2-lg">{section.heading}</h2>
          {section.phonePrompt && phone && (
            <p className="mt-3 text-copy text-body/75 lg:mt-5 lg:text-lead">
              {section.phonePrompt}{" "}
              <a
                href={toTelHref(phone)}
                className={`${tapTarget} whitespace-nowrap font-semibold text-link transition-colors duration-200 hover:text-accent-ink`}
              >
                {phone}
              </a>
              .
            </p>
          )}
        </Reveal>

        <Reveal delayMs={100} className="border-t border-line/15">
          <FaqAccordion items={list(section.items).map(({ id, question, answer }) => ({ id, question, answer }))} />
        </Reveal>
      </div>
    </section>
  );
}
