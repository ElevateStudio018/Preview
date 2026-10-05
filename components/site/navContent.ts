import { list } from "@/lib/site/collection.ts";
import { fullAddress } from "@/lib/site/format.ts";
import type { SiteData } from "@/lib/site/schema.ts";
import type { NavContent } from "../Navbar";

/** Just the parts of the content the header and its menu need, as they are handed to the browser. */
export function navContent(site: SiteData): NavContent {
  const { navigation, ui } = site;
  return {
    barLinks: list(navigation.barLinks),
    menu: list(navigation.menu),
    menuButton: navigation.menuButton,
    services: list(site.services).map(({ slug, name, icon }) => ({ slug, name, icon })),
    phone: site.company.phone,
    email: site.company.email,
    address: fullAddress(site.company),
    logo: { logo: site.settings.logo, name: site.company.shortName },
    labels: {
      callPrefix: ui.callPrefix,
      homeLink: ui.homeLinkLabel,
      openMenu: ui.openMenu,
      closeMenu: ui.closeMenu,
      menu: ui.menuLabel,
      mainMenu: ui.mainMenuLabel,
      quickLinks: ui.quickLinksLabel,
      contact: site.footer.contactHeading,
    },
  };
}
