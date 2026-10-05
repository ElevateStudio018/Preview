import { SiteLink } from "@/components/SiteLink";
import { buttonClasses } from "@/components/Button";
import type { SiteData } from "@/lib/site/schema.ts";

/** The page shown for an address that does not exist. Also used by the admin preview. */
export function NotFoundView({ site }: { site: SiteData }) {
  const texts = site.notFound;
  return (
    <div className="mx-auto max-w-content px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      {texts.eyebrow && <p className="text-tag uppercase text-muted">{texts.eyebrow}</p>}
      <h1 className="mt-4 text-display text-heading lg:text-[56px] lg:leading-[1.08]">{texts.heading}</h1>
      {texts.text && <p className="mt-4 max-w-prose text-copy text-body lg:text-lead">{texts.text}</p>}
      {texts.button.label && (
        <SiteLink href={texts.button.href} className={buttonClasses("solid", "mt-8")}>
          {texts.button.label}
        </SiteLink>
      )}
    </div>
  );
}
