import { Icon, type IconKey } from "../Icon";
import { QuoteForm } from "../QuoteForm";
import { tapTarget } from "../Button";
import { quoteFormContent } from "../site/quoteFormContent";
import { fullAddress, toTelHref } from "@/lib/site/format.ts";
import type { SectionProps } from "./types";

interface ContactRow {
  icon: IconKey;
  label: string;
  value: string;
  href?: string;
}

export function ContactSection({ section, ctx }: SectionProps<"contact">) {
  const { company } = ctx.site;
  const rows: ContactRow[] = [
    ...(company.phone ? [{ icon: "Phone" as const, label: section.phoneLabel, value: company.phone, href: toTelHref(company.phone) }] : []),
    ...(company.email ? [{ icon: "Mail" as const, label: section.emailLabel, value: company.email, href: `mailto:${company.email}` }] : []),
    { icon: "MapPin", label: section.addressLabel, value: fullAddress(company) },
    ...(company.openingHours ? [{ icon: "Clock" as const, label: section.openingHoursLabel, value: company.openingHours }] : []),
  ];

  return (
    <section id={section.anchor || undefined} className="scroll-mt-20">
      <div className="mx-auto grid max-w-content grid-cols-1 gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:px-8 lg:py-28">
        <div>
          <h2 className="text-h2 text-heading lg:text-h2-lg">{section.heading}</h2>
          {section.text && <p className="mt-5 text-copy text-body lg:text-lead">{section.text}</p>}

          <ul className="mt-9 space-y-6">
            {rows.map((row) => (
              <li key={row.icon} className="flex items-start gap-5">
                <Icon name={row.icon} strokeWidth={2.25} className="mt-1 h-7 w-7 shrink-0 text-accent-ink" />
                <div>
                  <p className="text-[15px] font-semibold text-muted">{row.label}</p>
                  {row.href ? (
                    <a href={row.href} className={`${tapTarget} text-[20px] font-semibold text-heading transition-colors hover:text-accent-ink`}>
                      {row.value}
                    </a>
                  ) : (
                    <p className="text-[20px] font-semibold text-heading">{row.value}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {section.orgLabel && company.orgNumber && (
            <p className="mt-9 text-[15px] text-muted">
              {`${section.orgLabel} `}
              {company.orgNumber}
            </p>
          )}
        </div>

        <div>
          <div className="bg-card p-6 sm:p-8 lg:p-10">
            <h3 className="text-[24px] font-semibold leading-tight text-heading">{section.formHeading}</h3>
            <div className="mt-6">
              <QuoteForm variant="inline" content={quoteFormContent(ctx.site)} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
