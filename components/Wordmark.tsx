import { withBasePath } from "@/lib/site/images.ts";
import type { Settings } from "@/lib/site/schema.ts";

/** What the logo spots (header, menu, footer) need to draw the logo. */
export interface LogoContent {
  logo: Settings["logo"];
  /** The company's name for screen readers. */
  name: string;
}

// Cabinord's wordmark until the client's own logo is uploaded: a gable roof over the name, drawn in the current text
// colour so it is dark on the light header and light on the dark footer and menu. An uploaded logo replaces it at the
// same height.
export function Wordmark({ content, className = "" }: { content: LogoContent; className?: string }) {
  if (content.logo.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={withBasePath(content.logo.image.src)} alt={content.logo.image.alt || content.name} className={`h-10 w-auto sm:h-12 ${className}`} />
    );
  }

  return (
    <span className={`flex h-11 items-center gap-2.5 sm:h-14 ${className}`}>
      <svg viewBox="0 0 40 36" aria-hidden="true" className="h-8 w-auto shrink-0 sm:h-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
        <path d="M3 17 20 3l17 14" strokeLinecap="round" />
        <path d="M8 14v19h24V14" />
        <path d="M17 33v-9h6v9" />
      </svg>
      <span className="font-heading text-[22px] font-semibold leading-none tracking-[0.08em] sm:text-[26px]">
        CABINORD
        <span className="sr-only"> – {content.name}</span>
      </span>
    </span>
  );
}
