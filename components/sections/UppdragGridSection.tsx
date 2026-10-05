import { Breadcrumbs } from "../Breadcrumbs";
import { UppdragGrid } from "../UppdragGrid";
import { list } from "@/lib/site/collection.ts";
import type { SectionProps } from "./types";

export function UppdragGridSection({ section, ctx }: SectionProps<"uppdragGrid">) {
  const { breadcrumbs } = ctx;
  const Heading = breadcrumbs ? "h1" : "h2";
  return (
    <div id={section.anchor || undefined} className="mx-auto max-w-content px-4 pt-10 sm:px-6 lg:px-8 lg:pt-14">
      {breadcrumbs && (
        // The text rises into place one part after another as the page loads, as on the homepage.
        <div className="animate-rise [animation-delay:150ms]">
          <Breadcrumbs items={breadcrumbs} label={ctx.site.ui.breadcrumbsLabel} />
        </div>
      )}

      <Heading className="mt-8 animate-rise [animation-delay:250ms] text-[38px] font-semibold leading-[1.1] tracking-[-0.01em] text-heading lg:text-[56px]">
        {section.heading}
      </Heading>
      {section.text && (
        <p className="mt-5 max-w-3xl animate-rise text-copy text-body [animation-delay:350ms] lg:text-[21px]">{section.text}</p>
      )}

      <div className="mt-10 animate-rise [animation-delay:450ms]">
        <UppdragGrid items={list(ctx.site.uppdrag)} allLabel={section.filterAllLabel} filterLabel={ctx.site.ui.uppdragFilterLabel} />
      </div>
    </div>
  );
}
