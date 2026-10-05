import { Icon } from "../Icon";
import { QuoteTrigger } from "../QuoteTrigger";
import { Reveal } from "../Reveal";
import { SectionIntro } from "./SectionIntro";
import { list } from "@/lib/site/collection.ts";
import type { SectionProps } from "./types";

/** Prices as plain rows split by thin lines, like the questions under Vanliga frågor. */
export function PricelistSection({ section }: SectionProps<"pricelist">) {
  return (
    <section id={section.anchor || undefined} className="scroll-mt-20">
      <div className="mx-auto max-w-content px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <SectionIntro heading={section.heading} text={section.text} />
        <Reveal delayMs={100} className="mt-10 max-w-4xl">
          <dl className="border-t border-line/15">
            {list(section.rows).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-4 sm:gap-6 border-b border-line/15 py-4 lg:py-5">
                <dt>
                  <span className="block text-[18px] font-bold leading-[1.25] text-heading lg:text-[20px]">{row.name}</span>
                  {row.description && <span className="mt-1.5 block text-copy leading-[1.35] text-body">{row.description}</span>}
                </dt>
                <dd className="shrink-0 whitespace-nowrap text-[18px] font-semibold text-heading lg:text-[20px]">
                  {/* A price that is not a sum ("Pris på förfrågan") is a button: it opens the quote form for the row's
                      product, with the product chosen and a ready-made text. */}
                  {/^\d/.test(row.price) ? (
                    row.price
                  ) : (
                    <QuoteTrigger
                      prefill={{ slug: row.id, name: row.name }}
                      className="group inline-flex items-center gap-2 rounded-full bg-button px-4 py-2 text-[15px] font-semibold text-button-text transition-colors duration-200 hover:bg-button-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink lg:text-[16px]"
                    >
                      {row.price}
                      <Icon name="ArrowRight" strokeWidth={2.25} className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </QuoteTrigger>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {section.note && <p className="mt-5 text-[15px] leading-snug text-muted">{section.note}</p>}
        </Reveal>
      </div>
    </section>
  );
}
