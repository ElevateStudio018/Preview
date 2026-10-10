// Phone numbers and other values derived from the company details, used across the site.
import type { Company } from "./schema.ts";

/** "031-385 41 41" → "tel:+46313854141". */
export function toTelHref(displayNumber: string): string {
  const national = displayNumber.replace(/[^\d]/g, "").replace(/^0/, "");
  return `tel:+46${national}`;
}

/** "031-385 41 41" → "+46313854141", as search engines want it. */
export function toE164(displayNumber: string): string {
  return toTelHref(displayNumber).replace("tel:", "");
}

/** "Lybeck 140, 442 91 Romelanda", or as much of it as is set ("Stora Höga"). */
export function fullAddress(company: Company): string {
  const { street, postalCode, city } = company.address;
  return [street, [postalCode, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

/** "Romelanda, Kungälv": the postal town and the municipality. */
export function seat(company: Company): string {
  return `${company.address.city}, ${company.city}`;
}

/** Replaces {name} placeholders in an interface text. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
