import Link from "next/link";
import { Icon, type IconKey } from "./Icon";
import { Wordmark } from "./Wordmark";
import { SiteLink } from "./SiteLink";
import { Reveal } from "./Reveal";
import { buttonClasses, tapTarget } from "./Button";
import { CookieSettingsButton } from "./CookieSettingsButton";
import { list } from "@/lib/site/collection.ts";
import { toTelHref } from "@/lib/site/format.ts";
import type { SiteData } from "@/lib/site/schema.ts";
import { ElevateCredit } from "./ElevateCredit";

const headingClass = "text-[19px] font-semibold leading-tight lg:text-[22px]";
// A thin line slides in from the left under a link on hover, like the links in the top bar. On phones the padding makes
// each link a full-size tap target.
const linkClass =
  "relative inline-block py-3 text-[15px] leading-snug text-footer-text transition-colors after:absolute after:inset-x-0 after:bottom-2.5 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 after:ease-out hover:text-footer-text/70 hover:after:scale-x-100 lg:py-1 lg:text-[16px] lg:after:bottom-0.5";

const socialIcons: { key: keyof SiteData["company"]["social"]; icon: IconKey; label: string }[] = [
  { key: "facebook", icon: "Facebook", label: "Facebook" },
  { key: "instagram", icon: "Instagram", label: "Instagram" },
  { key: "linkedin", icon: "Linkedin", label: "LinkedIn" },
];

export function Footer({ site }: { site: SiteData }) {
  const { company, footer } = site;
  const social = socialIcons.filter(({ key }) => company.social[key]);

  return (
    <footer className="relative overflow-hidden bg-footer text-footer-text">

      <div className="relative mx-auto max-w-content px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <Reveal className="mb-8 border-b border-footer-text/15 pb-7 lg:mb-10 lg:pb-8">
          <Link
            href="/"
            aria-label={site.ui.homeLinkLabel}
            className={`${tapTarget} inline-block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-footer-text`}
          >
            <Wordmark content={{ logo: site.settings.logo, name: company.shortName }} />
          </Link>
        </Reveal>

        {/* Phones: contact on top, then the two link lists side by side, to keep the footer short. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-9 lg:grid-cols-[1.3fr_1fr_1fr] lg:gap-10">
          <Reveal delayMs={80} className="col-span-2 lg:col-span-1">
            <h2 className={headingClass}>{footer.contactHeading}</h2>
            <ul className="mt-1.5 text-[17px] leading-snug lg:mt-2.5 lg:text-[18px]">
              {company.phone && (
                <li>
                  <a href={toTelHref(company.phone)} className="flex min-h-11 items-center gap-3 transition-colors hover:text-footer-text/70">
                    <Icon name="Phone" strokeWidth={2.25} className="h-5 w-5 shrink-0 text-footer-text/60" />
                    {company.phone}
                  </a>
                </li>
              )}
              {company.email && (
                <li>
                  <a href={`mailto:${company.email}`} className="flex min-h-11 items-center gap-3 transition-colors hover:text-footer-text/70">
                    <Icon name="Mail" strokeWidth={2.25} className="h-5 w-5 shrink-0 text-footer-text/60" />
                    <span className="break-all">{company.email}</span>
                  </a>
                </li>
              )}
              <li className="flex items-start gap-3 py-2.5">
                <Icon name="MapPin" strokeWidth={2.25} className="mt-0.5 h-5 w-5 shrink-0 text-footer-text/60" />
                <span>
                  {company.address.street && (
                    <>
                      {company.address.street}
                      <br />
                    </>
                  )}
                  {[company.address.postalCode, company.address.city].filter(Boolean).join(" ")}
                </span>
              </li>
              {company.openingHours && (
                <li className="flex items-start gap-3 py-2.5">
                  <Icon name="Clock" strokeWidth={2.25} className="mt-0.5 h-5 w-5 shrink-0 text-footer-text/60" />
                  <span>{company.openingHours}</span>
                </li>
              )}
            </ul>
            {footer.button.label && (
              <SiteLink href={footer.button.href} className={buttonClasses("on-footer", "mt-6 lg:mt-7")}>
                {footer.button.label}
              </SiteLink>
            )}
            {social.length > 0 && (
              <ul className="mt-6 flex gap-2">
                {social.map(({ key, icon, label }) => (
                  <li key={key}>
                    <a
                      href={company.social[key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-footer-text/30 transition-colors hover:border-footer-text hover:bg-footer-text hover:text-footer"
                    >
                      <Icon name={icon} strokeWidth={2} className="h-5 w-5" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>

          <Reveal delayMs={160}>
            <h2 className={headingClass}>{footer.servicesHeading}</h2>
            <ul className="mt-1 lg:mt-4 lg:space-y-0.5">
              {list(site.services).map((service) => (
                <li key={service.id}>
                  <Link href={`/tjanster/${service.slug}`} className={linkClass}>
                    {service.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delayMs={240}>
            <h2 className={headingClass}>{footer.companyHeading}</h2>
            <ul className="mt-1 lg:mt-4 lg:space-y-0.5">
              {list(footer.companyLinks).map((link) => (
                <li key={link.id}>
                  <SiteLink href={link.href} className={linkClass}>
                    {link.label}
                  </SiteLink>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal
          delayMs={300}
          className="mt-9 flex flex-col gap-1 border-t border-footer-text/15 pt-5 text-[13px] text-footer-text/70 sm:flex-row sm:justify-between lg:mt-12 lg:text-[14px]"
        >
          {/* Joined into the same pieces of text as ever, so the line sets exactly as before. */}
          <p>{`© ${new Date().getFullYear()} ${footer.copyrightName}`}</p>
          <p>
            {`${footer.orgLabel} `}
            {company.orgNumber}
            {` · ${footer.vatLabel} `}
            {company.vatNumber}
            {site.settings.analyticsId && site.ui.cookieSettings && (
              <>
                {" · "}
                <CookieSettingsButton label={site.ui.cookieSettings} />
              </>
            )}
          </p>
        </Reveal>
        <ElevateCredit />
      </div>
    </footer>
  );
}
