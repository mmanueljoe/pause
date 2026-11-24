import { useState } from "react";
import { Navigate } from "react-router";
import type { Address } from "@solana/kit";
import {
  ArrowDownLeft,
  Bell,
  Check,
  Clock,
  ExternalLink,
  Settings as SettingsIcon,
} from "lucide-react";

import { Button } from "../../components/ui";
import { cx } from "../../components/ui/cx";
import { useVaultProfiles } from "../../lib/backend";
import type { VaultState } from "../../lib/pause/accounts";
import { explorerUrl } from "../../lib/pause/addresses";
import { formatTime, shortAddress } from "../../lib/pause/format";
import {
  useGuardedVaults,
  usePauseProgramChanges,
  useVault,
  useVaultAddress,
  useVaultHistory,
  useWalletAddress,
} from "../../lib/pause/hooks";
import {
  type Category,
  type HistoryLine,
  type Icon,
  toHistoryLines,
} from "../../lib/pause/historyText";

type Source = { vault: VaultState; viewer: "owner" | "guardian" };

/** Screen 12: History (US-14), read from the vault's Solana transactions. */
export function History() {
  const wallet = useWalletAddress();
  const { vault: own, isLoading: ownLoading } = useVault(
    useVaultAddress(wallet)
  );
  const { vaults: guarded, isLoading: guardedLoading } =
    useGuardedVaults(wallet);
  const [picked, setPicked] = useState<string | null>(null);

  if (!wallet) return <Navigate to="/" replace />;
  if (ownLoading || guardedLoading) {
    return (
      <p className="py-24 text-center text-text-2" role="status">
        Loading…
      </p>
    );
  }
  const sources: Source[] = [
    ...(own ? [{ vault: own, viewer: "owner" as const }] : []),
    ...guarded.map((vault) => ({ vault, viewer: "guardian" as const })),
  ];
  if (sources.length === 0) return <Navigate to="/setup" replace />;
  const source = sources.find((s) => s.vault.address === picked) ?? sources[0];

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 font-semibold md:text-h1-lg">History</h1>
        <p className="text-small text-text-2">
          Everything here happened on Solana. Tap the arrow on any line to check
          it yourself.
        </p>
      </div>
      {sources.length > 1 && (
        <Chips
          label="Vault"
          options={sources.map((s) => ({
            value: s.vault.address,
            label:
              s.viewer === "owner"
                ? "Your vault"
                : `Vault of ${shortAddress(s.vault.data.owner)}`,
          }))}
          value={source.vault.address}
          onChange={setPicked}
        />
      )}
      <VaultHistory key={source.vault.address} source={source} me={wallet} />
    </div>
  );
}

function VaultHistory({ source, me }: { source: Source; me: Address }) {
  const [limit, setLimit] = useState(50);
  const [filter, setFilter] = useState<"all" | Category>("all");
  const { items, hasMore, isLoading, error, refresh } = useVaultHistory(
    source.vault.address,
    limit
  );
  usePauseProgramChanges(() => void refresh());
  const { profiles } = useVaultProfiles([source.vault.address]);
  const profile = profiles[source.vault.address];
  const guardian = source.vault.data.guardian;

  if (error && items.length === 0) {
    return (
      <p className="text-text-2" role="alert">
        Couldn't load the history from Solana. Check your connection and reload.
      </p>
    );
  }
  if (isLoading && items.length === 0) {
    return (
      <p className="text-text-2" role="status">
        Reading the history from Solana…
      </p>
    );
  }
  const lines = toHistoryLines(
    items,
    source.viewer,
    me,
    source.vault.data.owner,
    {
      owner: profile?.ownerName,
      guardian: profile?.guardianName,
      currentGuardian: guardian.__option === "Some" ? guardian.value : null,
    }
  );
  return (
    <HistoryView
      lines={lines}
      filter={filter}
      onFilter={setFilter}
      hasMore={hasMore}
      loadingMore={isLoading}
      onMore={() => setLimit((l) => l + 50)}
    />
  );
}

/** The list, given sentences. Split out so it can be previewed. */
export function HistoryView({
  lines,
  filter,
  onFilter,
  hasMore,
  loadingMore,
  onMore,
}: {
  lines: HistoryLine[];
  filter: "all" | Category;
  onFilter: (f: "all" | Category) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
}) {
  const shown = lines.filter((l) => filter === "all" || l.category === filter);
  const days = groupByDay(shown);

  return (
    <>
      <Chips
        label="Show"
        options={[
          { value: "all", label: "All" },
          { value: "payments", label: "Payments" },
          { value: "stopped", label: "Stopped" },
          { value: "settings", label: "Settings" },
        ]}
        value={filter}
        onChange={(v) => onFilter(v as "all" | Category)}
      />
      {shown.length === 0 ? (
        <p className="text-text-2">
          {lines.length === 0
            ? "Nothing has happened in this vault yet."
            : "Nothing of this kind yet."}
        </p>
      ) : (
        days.map(([day, dayLines]) => (
          <section key={day} className="flex flex-col gap-2">
            <h2 className="text-small text-text-2">{day}</h2>
            <ol className="flex flex-col rounded-card border border-line bg-surface-1">
              {dayLines.map((line) => (
                <Line key={line.key} line={line} />
              ))}
            </ol>
          </section>
        ))
      )}
      {hasMore && (
        <Button
          variant="secondary"
          onClick={onMore}
          loading={loadingMore}
          className="self-center"
        >
          Show older
        </Button>
      )}
    </>
  );
}

function Line({ line }: { line: HistoryLine }) {
  const time = line.item.time ? formatTime(line.item.time) : "Time unknown";
  return (
    <li className="flex items-start gap-3 border-b border-line p-4 last:border-b-0">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2">
        <LineIcon icon={line.icon} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span>{line.title}</span>
        <span className="text-small text-text-2">
          {time}
          {line.detail ? ` · ${line.detail}` : ""}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {line.amount && (
          <span className="font-mono text-small">{line.amount}</span>
        )}
        <a
          href={explorerUrl("tx", line.item.signature)}
          target="_blank"
          rel="noreferrer"
          className="focus-ring -m-3 inline-flex size-11 items-center justify-center rounded-full text-text-2 hover:text-text"
          aria-label="View on Solana"
        >
          <ExternalLink size={16} strokeWidth={1.5} aria-hidden />
        </a>
      </span>
    </li>
  );
}

function LineIcon({ icon }: { icon: Icon }) {
  const props = { size: 16, strokeWidth: 1.5, "aria-hidden": true } as const;
  switch (icon) {
    case "deposit":
      return <ArrowDownLeft {...props} />;
    case "request":
      return <Clock {...props} />;
    case "alert":
      return <Bell {...props} />;
    case "sent":
      return <Check {...props} />;
    case "settings":
      return <SettingsIcon {...props} />;
    case "stop":
      // The stop square, green: a stopped payment is the good outcome.
      return <span aria-hidden className="size-2.5 rounded-[2px] bg-stopped" />;
  }
}

function Chips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "focus-ring min-h-9 rounded-full border px-3 text-small",
            o.value === value
              ? "border-text bg-text text-bg"
              : "border-line text-text-2 hover:border-text-3 hover:text-text"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** "Today, Mon 23 Nov", "Yesterday, Sun 22 Nov", "Fri 20 Nov". */
function groupByDay(lines: HistoryLine[]): [string, HistoryLine[]][] {
  const groups = new Map<string, HistoryLine[]>();
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  for (const line of lines) {
    const t = line.item.time;
    const label = !t
      ? "Earlier"
      : `${t.toDateString() === today.toDateString() ? "Today, " : t.toDateString() === yesterday.toDateString() ? "Yesterday, " : ""}${t.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`;
    groups.set(label, [...(groups.get(label) ?? []), line]);
  }
  return [...groups];
}
