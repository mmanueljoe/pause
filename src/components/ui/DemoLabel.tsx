import { Info } from "lucide-react";

import { DEMO_MODE } from "../../lib/pause/constants";

/** "Demo: waits are in minutes". Shown on every screen of the devnet build. */
export function DemoLabel() {
  if (!DEMO_MODE) return null;
  return (
    <span className="inline-flex h-7 items-center gap-2 rounded-full border border-line px-3 text-small text-text-2">
      <Info size={16} strokeWidth={1.5} aria-hidden />
      Demo: waits are in minutes
    </span>
  );
}
