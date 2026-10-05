import Link from "next/link";
import { Icon } from "./Icon";
import { Photo } from "./Photo";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { Service } from "@/lib/site/schema.ts";

// A product category as a photo card: the photo fills the card under a dark gradient, with the category's icon in a
// yellow square at the top and its name, a line about it and a "read more" link at the foot.
export function ServiceCard({ service, linkPrefix, wide = false }: { service: Service; linkPrefix: string; wide?: boolean }) {
  return (
    <Link
      href={`/tjanster/${service.slug}`}
      // The wide card has a row of its own below xl, so it keeps its own shape there; from xl it shares the last row
      // and takes that row's height, rather than an aspect ratio that would make it wider than its two columns.
      className={`group relative isolate flex w-full flex-col justify-between overflow-hidden bg-secondary p-4 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-ink sm:p-6 ${
        wide ? "aspect-[4/3] sm:aspect-[2/1] xl:aspect-auto xl:h-full" : "aspect-[3/4] sm:aspect-[4/5]"
      }`}
    >
      <Photo
        {...imageProps(service.image, wide ? "(min-width: 1280px) 50vw, 100vw" : "(min-width: 1280px) 25vw, 50vw")}
        alt={service.image.alt}
        className="absolute inset-0 -z-10 h-full w-full object-cover group-hover:scale-[1.06]"
        transition="transform 700ms ease-out"
        style={focusStyle(service.image)}
      />
      {/* Darkest at the foot, where the text is; it deepens a little on hover. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/35 to-black/0 transition-opacity duration-300 group-hover:opacity-95"
      />

      <span className="flex h-10 w-10 items-center justify-center bg-accent text-on-accent transition-transform duration-300 group-hover:-translate-y-0.5 sm:h-12 sm:w-12">
        <Icon name={service.icon} className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} />
      </span>

      <div>
        <h3 className="font-heading text-[15px] font-extrabold uppercase leading-tight tracking-[0.01em] max-sm:hyphens-auto max-sm:[overflow-wrap:anywhere] sm:text-[22px]">
          {service.name}
        </h3>
        <p className="mt-2 hidden text-[15px] leading-snug text-white/80 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:block">
          {service.shortDescription}
        </p>
        {linkPrefix && (
          <span className="mt-4 hidden items-center gap-2 text-label uppercase text-accent sm:flex">
            {linkPrefix}
            <Icon name="ArrowRight" className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1.5" strokeWidth={2} />
          </span>
        )}
      </div>
      {/* A yellow line runs along the foot of the card on hover. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-accent transition-transform duration-300 ease-out group-hover:scale-x-100"
      />
    </Link>
  );
}
