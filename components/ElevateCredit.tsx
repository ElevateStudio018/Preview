// The web agency's credit under the footer: its mark (a slope running up to a peak, with a smaller peak beside it)
// and its name, small and quiet.
export function ElevateCredit() {
  return (
    <p className="mt-6 flex items-center justify-center gap-2 text-[13px] text-footer-text/55 lg:text-[14px]">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="miter">
        <path d="M2 22 16 6.5" />
        <path d="M7.5 20.2h4.2l4-4.7 5.3 6" />
      </svg>
      Byggd av Elevate Studio
    </p>
  );
}
