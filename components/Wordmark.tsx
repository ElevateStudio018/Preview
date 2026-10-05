import { withBasePath } from "@/lib/site/images.ts";
import type { Settings } from "@/lib/site/schema.ts";

/** What the logo spots (header, menu, footer) need to draw the logo. */
export interface LogoContent {
  logo: Settings["logo"];
  /** The company's name for screen readers. */
  name: string;
}

// Cabinord's logo redrawn from their artwork: the CN mark in a yellow square and the letter-spaced name in yellow, on
// the logo's own black plate, so it looks the same on every background. An uploaded logo replaces it at the same height.
export function Wordmark({ content, className = "" }: { content: LogoContent; className?: string }) {
  if (content.logo.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={withBasePath(content.logo.image.src)} alt={content.logo.image.alt || content.name} className={`h-10 w-auto sm:h-12 ${className}`} />
    );
  }

  return (
    <span className={`flex h-11 items-center gap-3 bg-black px-1.5 sm:h-12 sm:gap-4 ${className}`}>
      <svg viewBox="-8 -7 116 116" aria-hidden="true" className="h-8 w-8 shrink-0 sm:h-9 sm:w-9">
        <rect x="-8" y="-7" width="116" height="116" fill="#FFEE00" />
        <path d="M47 85A33 33 0 1 1 40 19L78 86V11" fill="none" stroke="#000" strokeWidth="8" strokeMiterlimit="10" />
      </svg>
      <span className="pr-2 font-heading text-[19px] font-semibold uppercase leading-none tracking-[0.32em] text-[#FFEE00] sm:text-[22px]">
        Cabinord
        <span className="sr-only"> – {content.name}</span>
      </span>
    </span>
  );
}
