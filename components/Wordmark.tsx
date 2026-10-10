import { withBasePath } from "@/lib/site/images.ts";
import type { Settings } from "@/lib/site/schema.ts";

/** What the logo spots (header, menu, footer) need to draw the logo. */
export interface LogoContent {
  logo: Settings["logo"];
  /** The company's name for screen readers. */
  name: string;
}

// The client's logo (STEAB, Stenvaller Entreprenad AB), traced from their artwork into a transparent PNG and used as a
// mask, so it is drawn in the current text colour: black on the white header, white on the black footer and menu. An
// uploaded logo replaces it at the same height.
const LOGO_SRC = "/logo-steab.png";
const LOGO_RATIO = 1636 / 784;

export function Wordmark({ content, className = "" }: { content: LogoContent; className?: string }) {
  if (content.logo.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={withBasePath(content.logo.image.src)} alt={content.logo.image.alt || content.name} className={`h-10 w-auto sm:h-12 ${className}`} />
    );
  }

  const mask = `url(${withBasePath(LOGO_SRC)}) center / contain no-repeat`;
  return (
    <span className={`block h-11 bg-current sm:h-14 ${className}`} style={{ aspectRatio: LOGO_RATIO, mask, WebkitMask: mask }}>
      <span className="sr-only">{content.name}</span>
    </span>
  );
}
