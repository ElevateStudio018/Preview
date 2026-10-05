import type { ReactNode } from "react";
import { Navbar } from "../Navbar";
import { Footer } from "../Footer";
import { QuoteModal } from "../QuoteModal";
import { ConfirmationToast } from "../ConfirmationToast";
import { QuoteModalProvider } from "@/contexts/QuoteModalContext";
import { themeCss } from "@/lib/site/theme.ts";
import { fontFaceCss } from "@/lib/site/data.ts";
import type { SiteData } from "@/lib/site/schema.ts";
import { navContent } from "./navContent";
import { quoteFormContent } from "./quoteFormContent";
import { MaintenanceView } from "./MaintenanceView";
import { CookieConsent } from "../CookieConsent";

/** Everything around a public page: the theme, the header and menu, the footer and the quote window. */
export function SiteShell({ site, children }: { site: SiteData; children: ReactNode }) {
  // While the owner has the site in maintenance mode, every address shows the same short notice.
  if (site.settings.maintenance.enabled) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: fontFaceCss() + themeCss(site.theme) }} />
        <MaintenanceView site={site} />
      </>
    );
  }
  return (
    <>
      {/* The theme's colours and fonts, in place before anything is drawn. */}
      <style dangerouslySetInnerHTML={{ __html: fontFaceCss() + themeCss(site.theme) }} />
      {/* For keyboard and screen reader users: straight past the header to the page's own content. */}
      <a
        href="#innehall"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[300] focus:rounded-full focus:bg-field focus:px-6 focus:py-3 focus:text-label focus:uppercase focus:text-primary focus:shadow-lg focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-field"
      >
        {site.ui.skipLink}
      </a>
      <QuoteModalProvider>
        <Navbar content={navContent(site)} />
        <main id="innehall" tabIndex={-1} className="pt-16 outline-none sm:pt-20">
          {children}
        </main>
        <Footer site={site} />
        <QuoteModal content={quoteFormContent(site)} closeLabel={site.ui.closeLabel} />
        <ConfirmationToast message={site.form.confirmation} />
      </QuoteModalProvider>
      {/* Statistics only with the visitor's consent, and only when the owner has connected Google Analytics. */}
      {site.settings.analyticsId && (
        <CookieConsent analyticsId={site.settings.analyticsId} text={site.ui.cookieText} accept={site.ui.cookieAccept} decline={site.ui.cookieDecline} />
      )}
    </>
  );
}
