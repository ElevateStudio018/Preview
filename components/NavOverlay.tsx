"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BurgerIcon, burgerButtonClasses } from "./BurgerIcon";
import { Icon } from "./Icon";
import { Wordmark } from "./Wordmark";
import { ArrowLabel, buttonClasses } from "./Button";
import type { NavContent } from "./Navbar";
import { toTelHref } from "@/lib/site/format.ts";
import { useQuoteModal } from "@/contexts/QuoteModalContext";
import { usePrefersReducedMotion } from "@/hooks/useInView";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface NavRow {
  number: string;
  label: string;
  href: string;
}

/** Classes and delay that slide one part of the menu up into place as the menu opens. */
interface Entrance {
  className: string;
  style: CSSProperties;
}

function RowLink({ row, onClose, entrance, isCurrent }: { row: NavRow; onClose: () => void; entrance: Entrance; isCurrent: boolean }) {
  return (
    <li className={entrance.className} style={entrance.style}>
      <Link
        href={row.href}
        onClick={onClose}
        aria-current={isCurrent ? "page" : undefined}
        className="group relative flex items-center py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent lg:py-3"
      >
        <span className={`mr-4 w-7 shrink-0 sm:mr-6 font-heading text-sm font-bold tabular-nums ${isCurrent ? "text-accent" : "text-nav-text/40"}`}>{row.number}</span>
        {/* A yellow bar grows in front of the label on hover, and stays on the page you are on. */}
        <span
          aria-hidden="true"
          className={`h-[3px] shrink-0 bg-accent transition-all duration-300 ease-out ${isCurrent ? "mr-4 w-8 sm:w-10" : "mr-0 w-0 group-hover:mr-4 group-hover:w-8 sm:group-hover:w-10"}`}
        />
        <span
          className={`font-heading text-[34px] font-extrabold uppercase leading-[1.05] tracking-[-0.01em] transition-colors duration-200 min-[400px]:text-[40px] sm:text-5xl xl:text-[56px] ${
            isCurrent ? "text-accent" : "text-nav-text group-hover:text-accent"
          }`}
        >
          {row.label}
        </span>
      </Link>
    </li>
  );
}

export function NavOverlay({ content, onClose }: { content: NavContent; onClose: () => void }) {
  const { services, labels } = content;
  const rows = content.menu;
  const pathname = usePathname();
  const current = pathname.replace(/\/$/, "") || "/";
  const { open: openQuoteModal } = useQuoteModal();
  const overlayRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  // Set a moment after opening, so that what changes with it animates: the close button (sitting exactly where the
  // menu button was) turns from the same bars into a cross, and the rows slide up into place one after another.
  const [hasEntered, setHasEntered] = useState(false);
  // On short screens the list runs on below the bottom bar; while it does, its lower edge fades out.
  const [moreBelow, setMoreBelow] = useState(false);

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setHasEntered(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    const focusable = overlay?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusable?.[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !overlay) return;
      const items = overlay.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const list = nav;

    function updateMoreBelow() {
      setMoreBelow(list.scrollTop + list.clientHeight < list.scrollHeight - 4);
    }

    updateMoreBelow();
    list.addEventListener("scroll", updateMoreBelow, { passive: true });
    window.addEventListener("resize", updateMoreBelow);
    return () => {
      list.removeEventListener("scroll", updateMoreBelow);
      window.removeEventListener("resize", updateMoreBelow);
    };
  }, []);

  function entrance(order: number): Entrance {
    return {
      className: `transition duration-300 ease-out ${hasEntered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`,
      style: { transitionDelay: reducedMotion ? "0ms" : `${40 + order * 35}ms` },
    };
  }

  function handleCtaClick() {
    onClose();
    openQuoteModal();
  }

  // The pages are numbered among themselves; the products get a panel of their own.
  const linkRows = rows.filter((row) => row.kind !== "services").map((row, index) => ({ ...row, number: String(index + 1).padStart(2, "0") }));
  const servicesRow = rows.find((row) => row.kind === "services");

  return (
    <div ref={overlayRef} role="dialog" aria-modal="true" aria-label={labels.menu} className="fixed inset-0 z-[60] flex flex-col bg-nav pr-[var(--scrollbar-width,0px)]">
      <div className="mx-auto flex h-16 w-full max-w-content items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
        <Link href="/" onClick={onClose} aria-label={labels.homeLink} className="flex min-h-12 items-center text-nav-text">
          <Wordmark content={content.logo} />
        </Link>
        <button type="button" onClick={onClose} aria-label={labels.closeMenu} className={burgerButtonClasses}>
          <BurgerIcon cross={hasEntered} />
        </button>
      </div>
      {/* A thin yellow line under the bar, drawn out from the left as the menu opens. */}
      <div aria-hidden="true" className={`h-[3px] origin-left bg-accent transition-transform duration-500 ease-out ${hasEntered ? "scale-x-100" : "scale-x-0"}`} />

      <div className="relative min-h-0 flex-1">
        <nav ref={navRef} aria-label={labels.mainMenu} className="h-full overflow-y-auto px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <div className="mx-auto grid max-w-content gap-10 lg:grid-cols-12 lg:gap-12">
            {/* The pages, large. */}
            <ul className="lg:col-span-7">
              {linkRows.map((row, index) => (
                <RowLink key={row.id} row={row} onClose={onClose} entrance={entrance(index)} isCurrent={current === row.href} />
              ))}
            </ul>

            {/* The products with their icons, and how to reach the company. */}
            <div className="space-y-8 lg:col-span-5">
              {servicesRow && (
                <section className={entrance(linkRows.length).className} style={entrance(linkRows.length).style}>
                  <h2 className="text-tag uppercase text-accent">
                    <Link href={servicesRow.href} onClick={onClose} className="hover:underline hover:underline-offset-4">
                      {servicesRow.label}
                    </Link>
                  </h2>
                  <ul className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
                    {services.map((service) => {
                      const isCurrent = current === `/tjanster/${service.slug}`;
                      return (
                        <li key={service.slug}>
                          <Link
                            href={`/tjanster/${service.slug}`}
                            onClick={onClose}
                            aria-current={isCurrent ? "page" : undefined}
                            className={`group flex h-full items-center gap-3 border p-2.5 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:p-3 ${
                              isCurrent ? "border-accent bg-nav-text/10" : "border-nav-text/15 hover:border-accent hover:bg-nav-text/5"
                            }`}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-accent text-on-accent sm:h-10 sm:w-10">
                              <Icon name={service.icon} className="h-5 w-5" strokeWidth={2} />
                            </span>
                            <span className="text-[14px] font-semibold leading-tight text-nav-text sm:text-[15px]">{service.name}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <section className={entrance(linkRows.length + 1).className} style={entrance(linkRows.length + 1).style}>
                <h2 className="text-tag uppercase text-accent">{labels.contact}</h2>
                <ul className="mt-4 space-y-3 text-[16px] text-nav-text/80">
                  {content.phone && (
                    <li>
                      <a href={toTelHref(content.phone)} className="inline-flex items-center gap-3 font-semibold text-nav-text hover:text-accent">
                        <Icon name="Phone" className="h-5 w-5 text-accent" />
                        {content.phone}
                      </a>
                    </li>
                  )}
                  {content.email && (
                    <li>
                      <a href={`mailto:${content.email}`} className="inline-flex items-center gap-3 break-all hover:text-accent">
                        <Icon name="Mail" className="h-5 w-5 shrink-0 text-accent" />
                        {content.email}
                      </a>
                    </li>
                  )}
                  {content.address && (
                    <li className="flex items-center gap-3">
                      <Icon name="MapPin" className="h-5 w-5 shrink-0 text-accent" />
                      {content.address}
                    </li>
                  )}
                </ul>
              </section>
            </div>
          </div>
        </nav>
        {/* The rows fade into the background where the list runs on, rather than being cut off by the bottom bar. */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-nav to-nav/0 transition-opacity duration-300 ${
            moreBelow ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      <div
        className={`border-t border-nav-text/15 px-4 py-4 sm:px-6 sm:py-5 lg:px-8 ${entrance(linkRows.length + 2).className}`}
        style={entrance(linkRows.length + 2).style}
      >
        <div className="mx-auto flex max-w-content items-center gap-3 sm:justify-between">
          <button type="button" onClick={handleCtaClick} className={buttonClasses("solid", "group/arrow flex-1 sm:flex-none focus-visible:outline-nav-text")}>
            <ArrowLabel spaced>{content.menuButton}</ArrowLabel>
          </button>
          {content.phone && (
            <a
              href={toTelHref(content.phone)}
              aria-label={`${labels.callPrefix} ${content.phone}`}
              className={buttonClasses("on-nav", "w-[54px] shrink-0 !px-0 sm:w-auto sm:!px-8")}
            >
              <Icon name="Phone" className="h-5 w-5" />
              <span className="hidden sm:inline">{content.phone}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
