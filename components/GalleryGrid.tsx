"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Photo } from "./Photo";
import { Reveal } from "./Reveal";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { SiteImage } from "@/lib/site/schema.ts";

interface Entry {
  id: string;
  image: SiteImage;
  caption: string;
}

/**
 * The photos in an even grid; each opens in a full-screen viewer that steps through them with its arrows, the arrow
 * keys or a swipe, and closes on Esc, the cross or a click outside the photo.
 */
export function GalleryGrid({ entries, labels }: { entries: Entry[]; labels: { close: string; previous: string; next: string } }) {
  const [open, setOpen] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const touchStart = useRef<number | null>(null);

  const step = useCallback((direction: 1 | -1) => {
    setOpen((current) => (current === null ? current : (current + direction + entries.length) % entries.length));
  }, [entries.length]);

  const close = useCallback(() => {
    setOpen(null);
    returnTo.current?.focus();
  }, []);

  useEffect(() => {
    if (open === null) return;
    closeRef.current?.focus();
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollbar}px`;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, step]);

  const current = open === null ? null : entries[open];
  const navClass =
    "absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-on-accent transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:h-14 sm:w-14";

  return (
    <>
      <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
        {entries.map((entry, index) => (
          <Reveal key={entry.id} as="li" delayMs={(index % 3) * 70}>
            <figure>
              <button
                type="button"
                onClick={(event) => {
                  returnTo.current = event.currentTarget;
                  setOpen(index);
                }}
                aria-label={entry.image.alt || entry.caption || `${index + 1}`}
                className="group relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-ink"
              >
                <Photo
                  {...imageProps(entry.image, "(min-width: 1024px) 33vw, 50vw")}
                  alt={entry.image.alt}
                  className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.04]"
                  transition="transform 600ms ease-out"
                  style={focusStyle(entry.image)}
                />
              </button>
              {entry.caption && <figcaption className="mt-2.5 text-[15px] leading-snug text-muted">{entry.caption}</figcaption>}
            </figure>
          </Reveal>
        ))}
      </ul>

      {current && open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={current.image.alt || current.caption}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 p-4 sm:p-10"
          onClick={(event) => event.target === event.currentTarget && close()}
          onTouchStart={(event) => (touchStart.current = event.touches[0].clientX)}
          onTouchEnd={(event) => {
            if (touchStart.current === null) return;
            const distance = event.changedTouches[0].clientX - touchStart.current;
            if (Math.abs(distance) > 50) step(distance < 0 ? 1 : -1);
            touchStart.current = null;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={current.image.src}
            src={imageProps(current.image, "100vw").src}
            srcSet={imageProps(current.image, "100vw").srcSet}
            sizes="100vw"
            alt={current.image.alt}
            className="max-h-full max-w-full animate-fade-up object-contain"
          />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[14px] font-semibold tabular-nums text-white/80">
            {open + 1} / {entries.length}
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label={labels.close}
            className="absolute right-3 top-3 flex h-12 w-12 items-center justify-center text-white hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <Icon name="X" className="h-8 w-8" />
          </button>
          {entries.length > 1 && (
            <>
              <button type="button" onClick={() => step(-1)} aria-label={labels.previous} className={`${navClass} left-3 sm:left-6`}>
                <Icon name="ArrowLeft" strokeWidth={2.25} className="h-6 w-6" />
              </button>
              <button type="button" onClick={() => step(1)} aria-label={labels.next} className={`${navClass} right-3 sm:right-6`}>
                <Icon name="ArrowRight" strokeWidth={2.25} className="h-6 w-6" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
