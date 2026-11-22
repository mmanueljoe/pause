/** Two bars (the owner and the guardian) and the wordmark. */
export function Logo({ showWordmark = true }: { showWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-text">
      <svg
        viewBox="0 0 17 24"
        className="h-6 w-auto"
        fill="currentColor"
        aria-hidden
      >
        <rect width="6" height="24" rx="2" />
        <rect x="11" width="6" height="24" rx="2" />
      </svg>
      {showWordmark ? (
        <span className="text-h3 font-semibold tracking-tight">Pause</span>
      ) : (
        <span className="sr-only">Pause</span>
      )}
    </span>
  );
}
