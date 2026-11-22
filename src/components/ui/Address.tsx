import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { shortAddress } from "../../lib/pause/format";

/** Short mono address (2r1M…yNVy) with a copy button (44px tap area). */
export function Address({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the full address is still in the title.
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-small" title={value}>
        {shortAddress(value)}
      </span>
      <button
        type="button"
        onClick={copy}
        className="focus-ring -my-2 inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full text-text-2 hover:text-text"
        aria-label={copied ? "Address copied" : `Copy address ${value}`}
      >
        {copied ? (
          <>
            <Check size={16} strokeWidth={1.5} aria-hidden />
            <span className="text-small">Copied</span>
          </>
        ) : (
          <Copy size={16} strokeWidth={1.5} aria-hidden />
        )}
      </button>
    </span>
  );
}
