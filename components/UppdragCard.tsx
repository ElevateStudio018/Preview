import { Photo } from "./Photo";
import { SiteLink } from "./SiteLink";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { Uppdrag } from "@/lib/site/schema.ts";

export function UppdragCard({ item }: { item: Uppdrag }) {
  // A title written "Name · 36 000 kr" shows the name and, under it, the price on its own line.
  const [name, price] = item.title.split(" · ");

  return (
    <SiteLink
      href={item.href}
      className="group relative block aspect-[3/4] overflow-hidden bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-ink sm:aspect-[4/5]"
    >
      <Photo
        {...imageProps(item.image, "(min-width: 1024px) 33vw, 50vw")}
        alt={item.image.alt}
        className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.04]"
        transition="transform 700ms ease-out"
        style={focusStyle(item.image)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/20" aria-hidden="true" />
      <span className="absolute left-0 top-0 bg-accent px-2.5 py-2 text-[11px] font-bold uppercase leading-none tracking-[0.15em] text-on-accent sm:px-4 sm:py-[11px] sm:text-tag">
        {item.tag}
      </span>
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-6">
        <h3 className="text-[16px] font-semibold leading-tight text-white sm:text-[24px]">{name}</h3>
        {price && <p className="mt-1 text-[14px] font-semibold text-accent sm:mt-1.5 sm:text-[17px]">{price}</p>}
      </div>
    </SiteLink>
  );
}
