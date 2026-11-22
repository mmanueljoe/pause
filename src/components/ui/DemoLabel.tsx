import { Info } from "lucide-react";

import { DEMO_MODE } from "../../lib/pause/constants";

/** "Demo: waits are in minutes". Shown on every screen of the devnet build. */
export function DemoLabel() {
  if (!DEMO_MODE) return null;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1 text-small whitespace-nowrap text-text-2">
      <Info size={20} strokeWidth={1.5} aria-hidden />
      Demo: waits are in minutes
    </span>
  );
}
