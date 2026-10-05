"use client";

import type { ReactNode } from "react";
import { useQuoteModal, type QuotePrefill } from "@/contexts/QuoteModalContext";

/** Any element that opens the quote modal, for a product when one is given; callers decide how it looks. */
export function QuoteTrigger({ className, children, prefill }: { className: string; children: ReactNode; prefill?: QuotePrefill }) {
  const { open } = useQuoteModal();
  return (
    <button type="button" onClick={() => open(prefill)} className={className}>
      {children}
    </button>
  );
}
