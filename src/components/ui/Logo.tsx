/** Two bars (the owner and the guardian) and the wordmark. Never amber. */
export function Logo({ showWordmark = true }: { showWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-text">
      <span aria-hidden className="flex gap-[5px]">
        <span className="h-6 w-1.5 rounded-[2px] bg-current" />
        <span className="h-6 w-1.5 rounded-[2px] bg-current" />
      </span>
      {showWordmark ? (
        <span className="text-[1.75rem] leading-8 font-semibold tracking-[-0.02em]">
          Pause
        </span>
      ) : (
        <span className="sr-only">Pause</span>
      )}
    </span>
  );
}
