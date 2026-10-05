import { Icon } from "@/components/Icon";
import { Reveal } from "@/components/Reveal";
import { AccentBlock } from "@/components/AccentBlock";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FaktaBox } from "@/components/FaktaBox";
import { ServiceCard } from "@/components/ServiceCard";
import { UppdragCard } from "@/components/UppdragCard";
import { SiteLink } from "@/components/SiteLink";
import { JsonLd } from "./JsonLd";
import { buttonClasses, tapTarget } from "@/components/Button";
import { ZoomImage } from "@/components/ZoomImage";
import { list } from "@/lib/site/collection.ts";
import { fullAddress, seat, toE164, toTelHref } from "@/lib/site/format.ts";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { Service, SiteData } from "@/lib/site/schema.ts";

/** A service's page, built from the service and the texts all service pages share. Also used by the admin preview. */
export function ServicePageView({ site, service }: { site: SiteData; service: Service }) {
  const { company, servicePage: texts, ui } = site;
  const otherServices = list(site.services).filter((item) => item.slug !== service.slug);
  const address = fullAddress(company);
  const linkPrefix = cardLinkPrefix(site);
  // The models in this category: the projects tagged with the start of its name ("Bastu" for "Bastur").
  const models = texts.modelsHeading
    ? list(site.uppdrag).filter((item) => item.tag && service.name.toLowerCase().startsWith(item.tag.toLowerCase()))
    : [];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: service.name,
          name: `${service.name} – ${company.legalName}`,
          description: service.shortDescription,
          areaServed: company.serviceArea,
          provider: {
            "@type": "HomeAndConstructionBusiness",
            name: company.legalName,
            ...(company.phone ? { telephone: toE164(company.phone) } : {}),
            ...(company.email ? { email: company.email } : {}),
          },
        }}
      />

      <div className="relative aspect-[16/9] w-full overflow-hidden bg-primary/20 lg:aspect-auto lg:h-[min(56vh,600px)]">
        <ZoomImage
          {...imageProps(service.image, "100vw")}
          alt={service.image.alt}
          priority
          parallax="top"
          style={focusStyle(service.image)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <div className="mx-auto max-w-content px-4 pb-16 pt-8 sm:px-6 sm:pb-20 lg:px-8 lg:pb-28 lg:pt-10">
        {/* The text rises into place one part after another as the page loads, as on the homepage. */}
        <div className="animate-rise [animation-delay:150ms]">
          <Breadcrumbs
            label={ui.breadcrumbsLabel}
            items={[
              { label: ui.breadcrumbHome, href: "/" },
              { label: texts.breadcrumbLabel, href: texts.breadcrumbHref },
              { label: service.name },
            ]}
          />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <article>
            {texts.badge && (
              <span className="inline-block animate-rise bg-accent px-4 py-[11px] text-tag uppercase text-on-accent [animation-delay:250ms]">
                {texts.badge}
              </span>
            )}
            <h1 className="mt-4 animate-rise text-[38px] font-semibold leading-[1.1] tracking-[-0.01em] text-heading [animation-delay:330ms] lg:text-[56px]">
              {service.name}
            </h1>
            <p className="mt-6 animate-rise text-copy text-body [animation-delay:410ms] lg:text-[21px]">{service.shortDescription}</p>
            <div className="mt-6 animate-rise space-y-5 [animation-delay:490ms]">
              {service.description.map((paragraph, index) => (
                <p key={index} className="text-copy text-body lg:text-[18px]">
                  {paragraph}
                </p>
              ))}
            </div>

            <AccentBlock className="mt-12">
              <h2 className="text-h2 text-heading lg:text-[38px]">{texts.cta.heading}</h2>
              {texts.cta.text && <p className="mt-4 text-copy text-body">{texts.cta.text}</p>}
              {texts.cta.button.label && (
                <SiteLink href={texts.cta.button.href} className={buttonClasses("solid", "mt-7")}>
                  {texts.cta.button.label}
                </SiteLink>
              )}
            </AccentBlock>
          </article>

          <aside className="animate-rise space-y-6 [animation-delay:550ms] lg:pt-14">
            <FaktaBox
              title={texts.factsTitle}
              rows={[
                { label: texts.factLabels.service, value: service.name },
                { label: texts.factLabels.performedBy, value: company.legalName },
                { label: texts.factLabels.seat, value: seat(company) },
                { label: texts.factLabels.area, value: company.serviceArea },
                { label: texts.factLabels.org, value: company.orgNumber },
              ]}
            />

            <div className="bg-card px-6 py-7 sm:px-8 sm:py-8">
              <p className="text-[22px] font-semibold leading-tight text-heading">{company.legalName}</p>
              {texts.contactTagline && <p className="mt-1 text-[17px] text-body">{texts.contactTagline}</p>}
              <ul className="mt-6 space-y-6 text-[18px] text-heading">
                {company.phone && (
                  <li>
                    <a href={toTelHref(company.phone)} className={`${tapTarget} flex items-center gap-4 transition-colors hover:text-accent-ink`}>
                      <Icon name="Phone" strokeWidth={2.25} className="h-6 w-6 shrink-0 text-accent-ink" />
                      {company.phone}
                    </a>
                  </li>
                )}
                {company.email && (
                  <li>
                    <a href={`mailto:${company.email}`} className={`${tapTarget} flex items-center gap-4 transition-colors hover:text-accent-ink`}>
                      <Icon name="Mail" strokeWidth={2.25} className="h-6 w-6 shrink-0 text-accent-ink" />
                      <span className="break-all">{company.email}</span>
                    </a>
                  </li>
                )}
                <li className="flex items-start gap-4">
                  <Icon name="MapPin" strokeWidth={2.25} className="mt-0.5 h-6 w-6 shrink-0 text-accent-ink" />
                  {address}
                </li>
              </ul>
              {texts.contactButton.label && (
                <SiteLink href={texts.contactButton.href} className={buttonClasses("solid", "mt-8 w-full")}>
                  {texts.contactButton.label}
                </SiteLink>
              )}
            </div>

            {texts.backLink.label && (
              <SiteLink href={texts.backLink.href} className={buttonClasses("outline", "w-full")}>
                {texts.backLink.label}
              </SiteLink>
            )}
          </aside>
        </div>
      </div>

      {models.length > 0 && (
        <section className="border-t border-line/10">
          <div className="mx-auto max-w-content px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
            <Reveal>
              <h2 className="text-h2 text-heading lg:text-h2-lg">{texts.modelsHeading}</h2>
            </Reveal>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
              {models.map((item, index) => (
                <Reveal key={item.id} delayMs={(index % 3) * 70}>
                  <UppdragCard item={item} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {otherServices.length > 0 && (
        <section className="border-t border-line/10">
          <div className="mx-auto max-w-content px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
            <Reveal>
              <h2 className="text-h2 text-heading lg:text-h2-lg">{texts.moreHeading}</h2>
            </Reveal>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3">
              {otherServices.map((item, index) => (
                <Reveal key={item.id} delayMs={(index % 3) * 70}>
                  <ServiceCard service={item} linkPrefix={linkPrefix} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/** The "Läs mer om …" prefix from the start page's services section, so the cards read the same everywhere. */
function cardLinkPrefix(site: SiteData): string {
  for (const page of list(site.pages)) {
    for (const section of list(page.sections)) {
      if (section.type === "services") return section.cardLinkPrefix;
    }
  }
  return "";
}
