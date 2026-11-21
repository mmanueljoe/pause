# Pause: design handover

Everything a developer needs to build the website from the Figma file. Product rules live in [`docs/requirements.md`](../docs/requirements.md); this file covers how the design maps to code, and points to the rules that changed during design.

## 1. Where things are

**Figma file:** [Pause-UI](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI)

| Page | What it holds |
| --- | --- |
| Foundations | Colour and text styles, spacing and radius variables, logo, voice guide |
| Components | Every component, with all variants and states |
| Screens | All 13 screens, laptop (1440) and phone (390), every state, plus the prototype |
| Archive | Empty, for old versions |

**Frame names:** `NN Screen / Laptop|Phone / State`, for example `08 Waiting payment / Guardian / Phone / Stopped`. Each screen is one row on the Screens page: laptop frames first, then phone.

**Figma is the source for layout, states and copy.** Use the exact text in the frames.

| # | Screen | Frames |
| --- | --- | --- |
| 1 | Landing | [open](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=10-15) |
| 2 | Connect wallet | [open](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=18-292) |
| 3 | Create vault: wait time | [open](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=28-553) |
| 4 | Add guardian, Review, Created | [guardian](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=31-859) · [review](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=32-1079) |
| 5 | Vault home | [open](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=34-1349) |
| 6 | Deposit | [open](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=38-1526) |
| 7 | Withdraw (and Rescue) | [open](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=39-1897) |
| 8 | Waiting payment detail | [guardian](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=42-2301) · [owner](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=43-2648) |
| 9 | Guardian invite | [open](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=45-2840) |
| 10 | Guardian home | [open](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=47-3156) |
| 11 | Settings | [open](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=48-3399) |
| 12 | History | [open](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=49-3909) |
| 13 | Alert emails and lock-screen notification | [open](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=51-4197) |

**Prototype:** on the Screens page, press Present and pick a flow:

1. Kofi stops a theft (phone, the demo)
2. Ama sets up her vault (laptop)
3. Ama rescues her savings (phone)

## 2. Design tokens for Tailwind v4

Pause is **dark only**. Replace the template's light and dark tokens in `src/index.css` with these. Names match the Figma styles.

```css
@import "tailwindcss";

@theme {
  /* Colour: Figma colour styles */
  --color-bg: #121110;            /* Background/Base */
  --color-surface-1: #1b1a18;     /* Surface/1 Cards */
  --color-surface-2: #24221f;     /* Surface/2 Raised */
  --color-line: #34312c;          /* Border/Default */
  --color-text: #f4f1ea;          /* Text/Primary, Button/Primary fill */
  --color-text-2: #b3ada2;        /* Text/Secondary */
  --color-text-3: #8a8479;        /* Text/Tertiary: smallest allowed grey */
  --color-waiting: #f2a93b;       /* Status/Waiting, Button/Stop fill */
  --color-waiting-soft: #3a2a12;
  --color-stopped: #6bcb8b;       /* Stopped = good outcome, never red */
  --color-stopped-soft: #16301f;
  --color-released: #d9d4ca;      /* Arrived, approved early */
  --color-error: #e5654f;         /* Real errors only, never for Stop */

  /* Type: Instrument Sans + IBM Plex Mono (Google Fonts) */
  --font-sans: "Instrument Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;

  /* Phone sizes are the defaults; use the -lg sizes from md: up */
  --text-display: 2.5rem;    --text-display--line-height: 2.75rem; --text-display--letter-spacing: -0.02em;
  --text-display-lg: 4rem;   --text-display-lg--line-height: 4.25rem; --text-display-lg--letter-spacing: -0.02em;
  --text-h1: 1.875rem;       --text-h1--line-height: 2.25rem; --text-h1--letter-spacing: -0.015em;
  --text-h1-lg: 2.5rem;      --text-h1-lg--line-height: 3rem; --text-h1-lg--letter-spacing: -0.015em;
  --text-h2: 1.5rem;         --text-h2--line-height: 2rem; --text-h2--letter-spacing: -0.01em;
  --text-h2-lg: 1.75rem;     --text-h2-lg--line-height: 2.25rem; --text-h2-lg--letter-spacing: -0.01em;
  --text-h3: 1.125rem;       --text-h3--line-height: 1.625rem; --text-h3--letter-spacing: -0.005em;
  --text-h3-lg: 1.25rem;     --text-h3-lg--line-height: 1.75rem; --text-h3-lg--letter-spacing: -0.005em;
  --text-body: 1rem;         --text-body--line-height: 1.5rem;
  --text-small: 0.875rem;    --text-small--line-height: 1.25rem;
  --text-label: 0.75rem;     --text-label--line-height: 1rem; --text-label--letter-spacing: 0.08em;
  --text-countdown: 2.5rem;  --text-countdown--line-height: 3rem;
  --text-countdown-lg: 3rem; --text-countdown-lg--line-height: 3.5rem;

  /* Radius: Figma radius variables */
  --radius-input: 12px;
  --radius-card: 16px;
}

@layer base {
  html { color-scheme: dark; }
  body { @apply bg-bg text-text font-sans antialiased; }
  .font-mono { font-variant-numeric: tabular-nums; }
}
```

| Figma text style | Tailwind | Weight and notes |
| --- | --- | --- |
| Display | `text-display md:text-display-lg` | Sans SemiBold |
| H1, H2, H3 | `text-h1 md:text-h1-lg`, and so on | Sans SemiBold |
| Body, Small | `text-body`, `text-small` | Sans Regular |
| Label | `text-label font-mono font-medium uppercase` | Only for footer metadata and section markers. Never for sentences or status. |
| Mono/Small | `text-small font-mono` | Addresses and amounts. Normal case: uppercase would change a Solana address. |
| Countdown | `text-countdown md:text-countdown-lg font-mono font-medium` | Tabular figures so digits don't jitter |

**Fonts:** load Instrument Sans (400, 600) and IBM Plex Mono (400, 500) from Google Fonts.

**Spacing:** use only 4, 8, 12, 16, 24, 32, 48, 64 and 96 px. In Tailwind's default scale that's `1, 2, 3, 4, 6, 8, 12, 16, 24`.

**Layout:**
- Content is at most 1120 px wide on laptop, with 20 px side margins on phone.
- Forms and detail pages use a 640 to 720 px column.
- Laptop frames are 1440 wide. Phone frames are 390 wide. Switch layouts at `md`.

**Focus ring:** a 2 px charcoal gap, then a 2 px off-white ring, with no blur. For example: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg`.

## 3. Components

All on the Figma Components page. Build them once and use them everywhere.

| Component | Variants and states | Notes for code |
| --- | --- | --- |
| Button | Primary (off-white pill), Stop (amber pill), Approve now (outline pill), Secondary (outline), Text link · sizes 48 and 56 (main action on phone) · Default, Hover, Pressed, Focus, Disabled, Loading | Loading label: "Confirming on Solana…". Labels name the action ("Withdraw 10 SOL", not "Confirm"). |
| Input | Default, Focus, Filled, Error, Disabled | Label above, help or error below. Addresses use the mono font. |
| Card | One | Surface 1, 1 px line, 16 radius, 24 padding |
| Choice card | Default, Selected, Focus · optional tag | Wait-time choices on Create vault and Settings. Use radio semantics. |
| Status label | Waiting (pause symbol), Stopped (stop square), Arrived (tick), Approved early (tick) | Sentence case. **No animation.** The symbols are drawn, not icons. |
| New address tag | One | Amber outline; only on waiting payments |
| Countdown | Waiting, Stopped · laptop, phone | The bar **drains left to right** (the amber part shrinks toward the right). The time in words sits under it as real text, with `aria-live="polite"` updated at most once a minute. Turns green on Stop. |
| Stepper | Current step 1, 2, 3 | On phone, show "Step 1 of 3: Wait time" instead |
| Address | Default, Hover, Focus, Copied | First 4 … last 4 in mono, plus a copy button. Make the button's tap area at least 44 px. |
| Toast | Success, Stopped, Error | Bottom of the screen |
| Demo label | One | "Demo: waits are in minutes". Devnet builds only. |
| Logo | Full, Symbol | Two bars (the owner and the guardian). Symbol SVG: `<svg viewBox="0 0 17 24"><rect width="6" height="24" rx="2"/><rect x="11" width="6" height="24" rx="2"/></svg>`, with the wordmark in Instrument Sans SemiBold beside it. |

**Icons:** use `lucide-react`, size 20, `strokeWidth={1.5}`. The icons used are Check, X, Copy, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft, Plus, Clock, Wallet, User, Settings, History, Mail, Bell, Link, ExternalLink, Info, CircleCheck, CircleAlert and LoaderCircle. Don't use shield or padlock icons, or emoji.

**Wallet logos:** show the icon each wallet provides through Wallet Standard (`wallet.icon`). The copies in `design/assets/wallets/` are for the design only.

**Motion:** only for real events. The countdown bar drains, and the bar turns green when a payment is stopped. Nothing pulses. Respect `prefers-reduced-motion`.

## 4. Rules that changed during design

These are already in `docs/requirements.md`. They're listed here because they affect the program and the backend, not just the screens.

**Solana program**

- **Core rule 10:** a vault **must have a guardian** when it is created, and adding a guardian later always waits. If adding were instant, a thief with the owner's key could add themselves and use Approve now to empty the vault. This is tested by **US-19**.
- **Core rule 11:** shortening the wait time waits the same guardian-change wait (3 days by default), like every other change that makes the vault less safe.
- **There's no daily limit.** Every withdrawal waits.
- **Rescue (US-8b)** needs no new action: it's a normal withdrawal plus Approve now.
- **Emit an Anchor event** for every request, stop, approval, release, proposed change, cancelled change and applied change. The backend uses these events to decide alert levels.

**Supabase backend**

- **Alert levels** (see the Alert levels section of the requirements). A withdrawal is urgent if any of these is true; otherwise it gets a quiet notice:
  - it goes to an address the vault has never **paid**
  - it is 25% or more of the vault, counting other waiting withdrawals
  - another withdrawal is already waiting
  - it was requested between 11 pm and 6 am in the owner's time zone
  - it is a less-safe setting change
- **Save the urgent reasons** with each withdrawal. The app shows them to the guardian ("Why you got an urgent alert").
- **What's stored only in Supabase, never on Solana:** the guardian's name and email, and the owner's time zone.
- **Invites:**
  - Accepting means signing a free message, because the guardian is already set on-chain when the vault is created.
  - If the wallet that connects doesn't match the address the owner entered, the invite says so.
  - Links work once and expire after 7 days.
  - Send a welcome email when the guardian accepts.
- **Alert emails (FR-17a):**
  - Buttons only open Pause, where the action is confirmed with the wallet.
  - Use fixed times, not countdowns.
  - Include the safety line about the recovery phrase and the address bar.
- **Dollar values:** fetch the SOL price from a public source. Hide the dollar line if no price is available. Label it "at today's SOL price".

**App behaviour**

- **Approve now** asks for confirmation. **Stop** never does.
- **History wording follows the alert level:** routine requests read "You asked…", urgent ones read "Your wallet asked…".
- **Max on Deposit** keeps 0.01 SOL in the wallet for fees.

## 5. Open items

1. **The real domain.** The emails say `pause.app` as a placeholder, and the safety line tells people to check it, so it must be right.
2. **The vault creation fee.** Confirm the real cost; the Review screen says "less than 0.01 SOL".
3. **Dark emails.** Test the urgent email in Gmail and Apple Mail with dark mode on and off.
4. **Defaults to confirm with the team:** invite links expire after 7 days, and less-safe changes wait 3 days.
