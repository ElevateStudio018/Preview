import { Breadcrumbs } from "../Breadcrumbs";
import { Icon } from "../Icon";
import { Photo } from "../Photo";
import { tapTarget } from "../Button";
import { list } from "@/lib/site/collection.ts";
import { toTelHref } from "@/lib/site/format.ts";
import { imageProps } from "@/lib/site/images.ts";
import type { SectionProps } from "./types";

export function CertificatesSection({ section, ctx }: SectionProps<"certificates">) {
  const { breadcrumbs } = ctx;
  const { company } = ctx.site;
  const certificates = list(ctx.site.certificates);
  const Heading = breadcrumbs ? "h1" : "h2";

  return (
    <div id={section.anchor || undefined} className="mx-auto max-w-content px-4 pt-8 sm:px-6 lg:px-8 lg:pt-10">
      {breadcrumbs && (
        // The text rises into place one part after another as the page loads, as on the homepage.
        <div className="animate-rise [animation-delay:150ms]">
          <Breadcrumbs items={breadcrumbs} label={ctx.site.ui.breadcrumbsLabel} />
        </div>
      )}

      <Heading className="mt-4 animate-rise text-display text-heading [animation-delay:250ms] lg:mt-8 lg:text-[56px] lg:leading-[1.08]">
        {section.heading}
      </Heading>
      {section.text && (
        <p className="mt-3 max-w-3xl animate-rise text-copy text-body [animation-delay:350ms] lg:mt-6 lg:text-[21px] lg:leading-[1.3]">
          {section.text}
        </p>
      )}

      {certificates.length > 0 ? (
        <ul className="mt-10 grid animate-rise gap-4 [animation-delay:450ms] sm:grid-cols-2 lg:mt-14">
          {certificates.map((certificate) => (
            <li key={certificate.id} className="flex flex-col bg-card p-6 lg:p-8">
              {certificate.image ? (
                // The badge whole, at the same height for every certificate.
                <Photo
                  {...imageProps(certificate.image, "200px")}
                  alt={certificate.image.alt}
                  className="h-24 w-auto max-w-full self-start object-contain lg:h-32"
                />
              ) : (
                <Icon name="BadgeCheck" className="h-9 w-9 text-accent" />
              )}
              <h2 className="mt-5 text-h3 text-heading">{certificate.name}</h2>
              {certificate.issuer && (
                <p className="mt-2 text-[15px] text-muted">
                  {section.issuerPrefix} {certificate.issuer}
                </p>
              )}
              {certificate.description && <p className="mt-3 text-copy leading-[1.35] text-body">{certificate.description}</p>}
              {certificate.validUntil && (
                <p className="mt-auto pt-6 text-[15px] text-muted">
                  {section.validUntilPrefix} {certificate.validUntil}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-10 max-w-3xl animate-rise bg-card p-6 [animation-delay:450ms] lg:mt-14 lg:p-8">
          <h2 className="text-h3 text-heading">{section.emptyHeading}</h2>
          {section.emptyText && (
            <p className="mt-3 text-copy leading-[1.35] text-body">
              {section.emptyText}
              {company.phone && (
                <>
                  {" "}
                  <a
                    href={toTelHref(company.phone)}
                    className={`${tapTarget} font-semibold text-link underline underline-offset-4 hover:text-accent`}
                  >
                    {company.phone}
                  </a>
                </>
              )}
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}
