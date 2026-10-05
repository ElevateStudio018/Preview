"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Reveal } from "./Reveal";
import { Icon } from "./Icon";
import { Photo } from "./Photo";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { Service } from "@/lib/site/schema.ts";

/**
 * The product categories as a catalogue: the heading on the left with, on wide screens, a large photo of the category
 * the pointer (or keyboard focus) is on; the categories down the right as numbered rows with a small photo, the name,
 * a line about it and an arrow.
 */
export function ProductCatalog({ services, heading, linkPrefix }: { services: (Service & { id: string })[]; heading: ReactNode; linkPrefix: string }) {
  const [active, setActive] = useState(0);

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-5">
        <div className="lg:sticky lg:top-28">
          {heading}
          {/* The photos lie on top of each other and cross-fade, so changing row never shows an empty frame. */}
          <div aria-hidden="true" className="relative mt-8 hidden aspect-[4/5] overflow-hidden bg-primary/10 lg:block">
            {services.map((service, index) => (
              // The fade between photos is on a wrapper: the photo itself sets its own opacity as it loads.
              <div
                key={service.id}
                className={`absolute inset-0 transition-opacity duration-500 ease-out ${index === active ? "opacity-100" : "opacity-0"}`}
              >
                <Photo
                  {...imageProps(service.image, "(min-width: 1024px) 40vw, 1px")}
                  alt=""
                  className="h-full w-full object-cover"
                  style={focusStyle(service.image)}
                />
              </div>
            ))}
            <span className="absolute bottom-0 left-0 bg-accent px-4 py-2.5 text-tag uppercase text-on-accent">
              {services[active]?.name}
            </span>
          </div>
        </div>
      </div>

      <ol className="border-t border-line/15 lg:col-span-7">
        {services.map((service, index) => (
          <Reveal as="li" key={service.id} delayMs={Math.min(index, 6) * 50} className="border-b border-line/15">
            <Link
              href={`/tjanster/${service.slug}`}
              aria-label={linkPrefix ? `${linkPrefix} ${service.name}` : service.name}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-4 transition-colors duration-200 hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink sm:gap-6 sm:px-3 sm:py-5"
            >
              <span className="relative block h-16 w-20 overflow-hidden bg-primary/10 sm:h-20 sm:w-28">
                <Photo
                  {...imageProps(service.image, "112px")}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover group-hover:scale-110"
                  transition="transform 500ms ease-out"
                  style={focusStyle(service.image)}
                />
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-3">
                  <span className={`text-[13px] font-semibold tabular-nums ${index === active ? "text-heading" : "text-muted"}`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-heading text-[19px] font-bold leading-tight text-heading sm:text-[24px]">{service.name}</span>
                </span>
                <span className="mt-1 hidden overflow-hidden text-[15px] leading-snug text-muted [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:[display:-webkit-box]">
                  {service.shortDescription}
                </span>
              </span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line/20 text-heading transition-colors duration-200 group-hover:border-accent group-hover:bg-accent group-hover:text-on-accent sm:h-12 sm:w-12">
                <Icon name="ArrowRight" strokeWidth={2} className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </Link>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}
