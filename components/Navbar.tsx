"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BurgerIcon, burgerButtonClasses } from "./BurgerIcon";
import { Icon } from "./Icon";
import { NavOverlay } from "./NavOverlay";
import { Wordmark, type LogoContent } from "./Wordmark";
import { toTelHref } from "@/lib/site/format.ts";
import type { ContentIcon } from "@/lib/site/schema.ts";

/** What the header and its menu need from the content, as it is handed to the browser. */
export interface NavContent {
  /** Shown in the bar on wide screens; the menu keeps the full list, including every service. */
  barLinks: { id: string; label: string; href: string }[];
  menu: { id: string; label: string; href: string; kind: "link" | "services" }[];
  menuButton: string;
  services: { slug: string; name: string; icon: ContentIcon }[];
  phone: string;
  email: string;
  /** The company's full address, shown with the contact details in the menu. */
  address: string;
  logo: LogoContent;
  labels: {
    callPrefix: string;
    homeLink: string;
    openMenu: string;
    closeMenu: string;
    menu: string;
    mainMenu: string;
    quickLinks: string;
    /** Heading over the contact details in the menu. */
    contact: string;
  };
}

export function Navbar({ content }: { content: NavContent }) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMenuOpen) return;

    // Hiding the overflow takes away a space-taking scrollbar (as on Windows). The menu pads its right side by that
    // width, so its close button lands exactly on the menu button instead of jumping sideways.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty("--scrollbar-width", `${scrollbarWidth}px`);
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMenuOpen(false);
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.removeProperty("--scrollbar-width");
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  return (
    <>
      <header className="header-shadow fixed inset-x-0 top-0 z-40 bg-nav">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
          <Link href="/" aria-label={content.labels.homeLink} className="flex min-h-12 items-center text-nav-text">
            <Wordmark content={content.logo} />
          </Link>

          <div className="flex items-center gap-8">
            <nav aria-label={content.labels.quickLinks} className="hidden lg:block">
              <ul className="flex items-center gap-8">
                {content.barLinks.map((link) => {
                  const isActive = !link.href.includes("#") && pathname.startsWith(link.href);
                  return (
                    <li key={link.id}>
                      <Link
                        href={link.href}
                        aria-current={isActive ? "page" : undefined}
                        className={`relative py-2 text-[16px] font-semibold transition-colors duration-200 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:bg-nav-text after:transition-transform after:duration-200 hover:text-nav-text hover:after:scale-x-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nav-text ${
                          isActive ? "text-nav-text after:scale-x-100" : "text-nav-text/75 after:scale-x-0"
                        }`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="flex items-center gap-1 sm:gap-3">
              {/* Calling is always one tap away. */}
              {content.phone && (
                <a
                  href={toTelHref(content.phone)}
                  aria-label={`${content.labels.callPrefix} ${content.phone}`}
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-nav-text transition-colors hover:text-nav-text/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nav-text"
                >
                  <Icon name="Phone" className="h-6 w-6" />
                </a>
              )}

              <button
                type="button"
                onClick={() => setIsMenuOpen(true)}
                aria-expanded={isMenuOpen}
                aria-label={content.labels.openMenu}
                className={burgerButtonClasses}
              >
                {/* A cross while the menu is open, so once the menu closes it turns back into bars in view. */}
                <BurgerIcon cross={isMenuOpen} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {isMenuOpen && <NavOverlay content={content} onClose={() => setIsMenuOpen(false)} />}
    </>
  );
}
