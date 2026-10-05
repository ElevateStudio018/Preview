"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { UppdragCard } from "./UppdragCard";
import { useInView, usePrefersReducedMotion } from "@/hooks/useInView";
import { fill } from "@/lib/site/format.ts";
import type { Uppdrag } from "@/lib/site/schema.ts";

const GAP_PX = 16;

export interface CarouselLabels {
  previous: string;
  next: string;
  /** {n} and {total} are filled in. */
  goTo: string;
}

export function UppdragCarousel({ items, labels }: { items: (Uppdrag & { id: string })[]; labels: CarouselLabels }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const { ref: entranceRef, isInView } = useInView<HTMLDivElement>(0.15);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  // One dot per scroll position: every slide on mobile, fewer when 2–3 slides fit side by side.
  const [pageCount, setPageCount] = useState(items.length);
  const [activePage, setActivePage] = useState(0);

  const stepWidth = useCallback(() => {
    const slide = trackRef.current?.querySelector<HTMLElement>("[data-slide]");
    return slide ? slide.offsetWidth + GAP_PX : 1;
  }, []);

  const updateNavigation = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft < maxScroll - 4);
    const pages = Math.round(maxScroll / stepWidth()) + 1;
    setPageCount(pages);
    setActivePage(Math.min(pages - 1, Math.round(track.scrollLeft / stepWidth())));
  }, [stepWidth]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateNavigation();
    track.addEventListener("scroll", updateNavigation, { passive: true });
    window.addEventListener("resize", updateNavigation);
    return () => {
      track.removeEventListener("scroll", updateNavigation);
      window.removeEventListener("resize", updateNavigation);
    };
  }, [updateNavigation]);

  function step(direction: 1 | -1) {
    trackRef.current?.scrollBy({ left: direction * stepWidth(), behavior: reducedMotion ? "auto" : "smooth" });
  }

  function goTo(page: number) {
    trackRef.current?.scrollTo({ left: page * stepWidth(), behavior: reducedMotion ? "auto" : "smooth" });
  }

  // Round yellow arrows that sit half over the edge of the cards (inside them on phones), with a ring of the page colour around them so they
  // stand free of the photos. On hover they turn black and the arrow nudges the way it points; at either end they
  // fade out instead of disappearing.
  const arrowClass =
    "group/nav absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg ring-4 ring-page transition duration-200 hover:bg-secondary hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-ink disabled:pointer-events-none disabled:opacity-0 sm:h-14 sm:w-14";

  return (
    <div>
      <div ref={entranceRef} className="relative">
        {/* Phones: the current card sits in the middle with its neighbours peeking in on both sides. The spacers
            before the first and after the last card let those two centre as well. From sm up the cards line up
            from the left edge instead. */}
        <div
          ref={trackRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto before:w-[calc(8%-16px)] before:shrink-0 after:w-[calc(8%-16px)] after:shrink-0 sm:before:hidden sm:after:hidden"
        >
          {items.map((item, index) => (
            // Phones: the cards either side of the current one sit a little smaller and dimmer, shrinking away from
            // it, and grow to full size as they slide into the middle.
            <div
              key={item.id}
              data-slide
              className={`w-[84%] shrink-0 snap-center transition duration-300 ease-out sm:w-[calc((100%-16px)/2)] sm:snap-start lg:w-[calc((100%-32px)/3)] ${
                index === activePage
                  ? ""
                  : `max-sm:scale-[0.94] max-sm:opacity-60 ${index < activePage ? "max-sm:origin-right" : "max-sm:origin-left"}`
              }`}
            >
              {/* As the carousel comes into view the cards slide in from the right, one after another. */}
              <div
                className={`transition duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${isInView ? "" : "translate-x-12 opacity-0"}`}
                style={{ transitionDelay: isInView ? `${Math.min(index, 4) * 90}ms` : "0ms" }}
              >
                <UppdragCard item={item} />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!canPrev}
          aria-hidden={!canPrev}
          aria-label={labels.previous}
          className={`${arrowClass} left-3 sm:left-0 sm:-translate-x-1/2`}
        >
          <Icon name="ArrowLeft" strokeWidth={2.25} className="h-5 w-5 transition-transform duration-200 group-hover/nav:-translate-x-1 sm:h-6 sm:w-6" />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={!canNext}
          aria-hidden={!canNext}
          aria-label={labels.next}
          className={`${arrowClass} right-3 sm:right-0 sm:translate-x-1/2`}
        >
          <Icon name="ArrowRight" strokeWidth={2.25} className="h-5 w-5 transition-transform duration-200 group-hover/nav:translate-x-1 sm:h-6 sm:w-6" />
        </button>
      </div>

      {/* Many positions (more than fit as dots on a phone): a thin progress line with the position as numbers. */}
      {pageCount > 8 && (
        <div className="mx-auto mt-6 flex max-w-xs items-center gap-4 px-4" aria-live="polite">
          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-subtle">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${((activePage + 1) / pageCount) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-[14px] font-semibold tabular-nums text-heading">
            {activePage + 1} / {pageCount}
          </span>
        </div>
      )}

      {pageCount > 1 && pageCount <= 8 && (
        <div className="mt-[15px] flex justify-center">
          {Array.from({ length: pageCount }, (_, page) => (
            <button
              key={page}
              type="button"
              onClick={() => goTo(page)}
              aria-label={fill(labels.goTo, { n: page + 1, total: pageCount })}
              aria-current={page === activePage ? "true" : undefined}
              className="group/dot px-[12.5px] py-[16.5px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              {/* The current position stretches from a dot into a short bar. */}
              <span
                className={`block h-[11px] rounded-full transition-all duration-300 ease-out ${
                  page === activePage ? "w-7 bg-accent" : "w-[11px] bg-subtle group-hover/dot:bg-muted"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
