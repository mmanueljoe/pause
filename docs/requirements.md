# Pause — Product Requirements

## How to use this doc

This is the single source of truth for what Pause does. If something here disagrees with a design or the code, fix this doc first, then the design and code.

| Who | Uses it for |
| --- | --- |
| Designer | The screens list, screen design details and design decisions, to design every screen in Figma |
| Developer | The core rules and functional requirements, to build the Solana program and website |
| Everyone | The user stories: copy each one into Jira (or any board) as a ticket, with its acceptance criteria |

The *why* behind Pause (the problem, real incidents, competitors) lives in the [Project Brief](https://claude.ai/artifact/CPzcH6rCsBcsASijHyoxSy). This doc covers the *what*.

Anything marked **Decision needed** is not settled yet. See the last section.

## Product summary

Pause is a vault on Solana where every withdrawal waits before it leaves, so the owner or a trusted guardian can stop it.

The owner keeps everyday money in their normal wallet and moves savings into the vault. Every withdrawal from the vault waits for a set time. During the wait, the owner or guardian can stop it. In an emergency, the guardian can approve it early so it leaves at once. When the wait ends, the money is sent automatically. The guardian can stop or approve; they can never spend.

**Goal for the hackathon:** a working web app on Solana's test network (devnet) that shows a theft being stopped by a guardian, live, in under 3 minutes.

## Users and roles

| Role | Who they are | What they can do |
| --- | --- | --- |
| Owner | The person whose savings are in the vault | Create the vault, deposit, request withdrawals, stop them, change settings, change or remove the guardian |
| Guardian | A trusted person the owner picks, such as a sibling or friend. Needs their own Solana wallet. | Receive alerts, see waiting payments, stop a waiting payment, approve one early. Nothing else. |
| Thief (attacker) | Someone who has tricked the owner or stolen their recovery phrase | Should be blocked from: taking any money without a wait, skipping the wait, quickly swapping the guardian, shortening the wait |

The thief is not a real user, but we design and test against them as if they were.

## Scope

**In scope (hackathon version)**

- One vault per owner, one guardian per vault
- One currency: SOL on devnet
- Payment wait, stop, approve now, automatic release
- Guardian invite, change and removal, each with a wait
- Alerts to the guardian by email (Telegram if time allows)
- Activity history for the owner and guardian
- Web app that works on laptop and phone screens

**Stretch (only if everything above is done)**

- USDC as a second currency
- ElevenLabs phone call alert to the guardian

**Out of scope**

- A full wallet app (we connect to existing wallets like Phantom)
- More than one guardian
- A daily limit that lets small amounts leave without waiting (dropped: it let a thief take that amount instantly)
- Native Android or iPhone app
- Recovering money already stolen
- Mainnet launch

## Core rules

These rules are enforced by the Solana program itself, so nobody, including us, can break them.

**Withdrawals**

1. **Every** withdrawal from the vault waits, whatever the amount and whoever receives it. There is no amount that leaves instantly.
2. The owner sets the **wait time** when creating the vault.
3. During the wait, the owner or the guardian can **stop** it. A stopped withdrawal's money stays in the vault.
4. **Approve now:** during the wait, the guardian can approve the withdrawal, and it is sent immediately. Skipping the wait always needs the guardian; the owner alone can't.
5. When the wait ends with nobody stopping it, the withdrawal is **released** to the recipient it named, and only to them.
6. Release happens **automatically**: our Supabase backend sends the release step when the timer ends. If the backend is down, the owner can press Release. Anyone may send the release step, because the money can only ever go to the named recipient.
7. Several withdrawals can wait at once, each with its own timer.

&#91;embedded content: payment lifecycle · 1 decision, 2 endings\]

**Settings and guardian**

8. Changes that make the vault **less safe** wait, and the guardian can stop them: shortening the wait time, changing the guardian, removing the guardian.
9. Changes that make the vault **safer** happen instantly: lengthening the wait time.
10. Adding the **first** guardian to a vault with none is instant.
11. Guardian changes and removal wait longer than withdrawals (see values below).
12. The guardian can never deposit, request withdrawals, or change settings. They can only stop or approve early.

**Values** (Decision needed: confirm these)

| Setting | Default | Choices shown at setup |
| --- | --- | --- |
| Withdrawal wait | 6 hours | "1 hour: fastest" · "6 hours: recommended" · "24 hours: gives your guardian the most time to check" · custom up to 7 days |
| Guardian change or removal wait | 3 days | 1 to 14 days |

**Demo mode**

So the whole demo fits in a 3-minute video:

- Exists only in the devnet version. The setting is built so it cannot be turned on in a real (mainnet) launch.
- Withdrawal and guardian-change waits can be set in minutes (1 minute and up).
- A visible "Demo mode · short timers" label shows on every screen, so judges know the short wait is deliberate.
- Everything else behaves exactly as in the real version.

## Functional requirements

Each requirement has an ID so stories and tickets can point to it.

**Wallet connection**

| ID | Requirement |
| --- | --- |
| FR-1 | Users connect an existing Solana wallet (such as Phantom or Solflare). No sign-up with password. |
| FR-2 | The app recognises whether the connected wallet is an owner, a guardian, both, or neither, and shows the right home screen. |

**Vault setup and settings**

| ID | Requirement |
| --- | --- |
| FR-3 | An owner can create one vault, choosing the withdrawal wait time. |
| FR-4 | An owner can add a guardian by entering the guardian's wallet address, and send them an invite link. |
| FR-5 | Safer setting changes apply instantly; less-safe changes wait and can be cancelled (Core rules 8–9). |

**Money in and out**

| ID | Requirement |
| --- | --- |
| FR-6 | An owner can deposit SOL from their wallet into the vault. Deposits are instant. |
| FR-7 | An owner can request a withdrawal to any address, including their own wallet. Every withdrawal waits. |
| FR-8 | Before confirming, the app shows when the money will arrive ("Arrives today at 6:42 pm") and that the guardian will be told. |
| FR-9 | The owner gets a notification when a withdrawal arrives. |

**Waiting payments**

| ID | Requirement |
| --- | --- |
| FR-10 | Owner and guardian see every waiting withdrawal: amount, recipient, arrival time, time left. Recipients the vault hasn't sent to before are marked "New address". |
| FR-11 | Owner or guardian can stop a waiting withdrawal. |
| FR-11a | The guardian can approve a waiting withdrawal early; it is then sent immediately. |
| FR-12 | When the wait ends, the withdrawal is released automatically by our backend, and only to its named recipient. The owner can release it manually if the backend is down. |

**Guardian**

| ID | Requirement |
| --- | --- |
| FR-13 | A guardian accepts an invite by connecting their wallet and giving an email for alerts. |
| FR-14 | A guardian can see the vaults they protect, and nothing they can't act on. |
| FR-15 | An owner can change or remove the guardian; the change waits and the current guardian can cancel it. |

**Alerts and history**

| ID | Requirement |
| --- | --- |
| FR-16 | When a withdrawal or less-safe change starts waiting, the guardian gets an email written as a quick decision, with Approve now and Stop links. Withdrawals to a new address are highlighted. |
| FR-17 | The owner also gets an alert, so they notice withdrawals they didn't make. |
| FR-18 | Owner and guardian see a history of deposits, payments, cancellations and setting changes. |

**Solana program actions**

| Action | Who can call it |
| --- | --- |
| Create vault | Owner |
| Deposit | Owner |
| Request withdrawal (always waits) | Owner |
| Stop withdrawal | Owner or guardian |
| Approve now (skip the wait) | Guardian only |
| Release withdrawal | Anyone, after the wait; money only goes to the named recipient |
| Change wait time (instant if longer, waits if shorter) | Owner |
| Propose guardian change or removal | Owner |
| Apply guardian change | Anyone, after the wait |
| Cancel pending change | Owner or guardian |

## User stories

Each story is one Jira ticket. Copy the title, the story sentence and the acceptance criteria. Each epic becomes a Jira epic.

### Epic 1: Connect and set up

**US-1 Connect wallet** (FR-1, FR-2) As a visitor, I want to connect my wallet, so I can use Pause without making an account.

- [ ] Connecting with Phantom or Solflare works
- [ ] A new user lands on "Create your vault"; an owner lands on their vault; a guardian lands on vaults they protect

**US-2 Create vault** (FR-3) As an owner, I want to create a vault and choose how long withdrawals wait, so my savings can't leave in seconds.

- [ ] Wait choices shown: "1 hour: fastest", "6 hours: recommended", "24 hours: gives your guardian the most time to check", custom
- [ ] The vault exists on devnet after I approve

**US-3 Invite guardian** (FR-4, FR-13) As an owner, I want to add someone I trust as guardian, so they can stop a theft.

- [ ] I enter their wallet address and get a link to send them
- [ ] The guardian opens the link, connects their wallet, gives their email, and sees "You're now Ama's guardian"

### Epic 2: Money in and out

**US-4 Deposit** (FR-6) As an owner, I want to move SOL into my vault, so it's protected.

- [ ] The vault balance updates after I approve

**US-5 Withdrawal waits** (FR-7, FR-8) As an owner, I want every withdrawal to wait, so nobody can empty my vault in seconds.

- [ ] Before confirming, I see "Arrives today at 6:42 pm" and "Kofi will be told"
- [ ] The withdrawal appears as waiting, with a countdown

**US-6 Arrival notification** (FR-9) As an owner, I want to be told when my money arrives, so I don't have to keep checking.

- [ ] A notification appears and the history shows "Arrived"

### Epic 3: Waiting payments

**US-7 See waiting payments** (FR-10) As an owner or guardian, I want to see all waiting payments, so I know what's about to leave.

- [ ] Each shows amount, recipient address, time left

**US-8 Stop a withdrawal** (FR-11) As an owner or guardian, I want to stop a waiting withdrawal, so stolen money never leaves.

- [ ] After stopping, it shows "Stopped. Money safe in the vault." and the balance is unchanged

**US-8a Approve now** (FR-11a) As a guardian, I want to approve a withdrawal early, so Ama can get money fast in an emergency.

- [ ] Approving sends the money immediately and shows "Approved by Kofi"
- [ ] The owner alone cannot skip the wait

**US-9 Automatic release** (FR-12) As an owner, I want my withdrawal to arrive on its own when the wait ends, so I don't have to come back.

- [ ] When the countdown ends, the money arrives without anyone pressing anything
- [ ] If it hasn't arrived a few minutes after the wait, a Release button appears as backup

### Epic 4: Guardian and settings

**US-10 Change or remove guardian** (FR-15) As an owner, I want to change or remove my guardian, so I'm never stuck with the wrong person.

- [ ] The change shows as waiting with a countdown; the current guardian is alerted and can cancel it

**US-11 Change wait time** (FR-5) As an owner, I want to adjust how long withdrawals wait, so the vault fits my habits.

- [ ] Making the wait longer applies instantly
- [ ] Making it shorter waits, and the guardian can stop the change

### Epic 5: Alerts and history

**US-12 Guardian alert** (FR-16) As a guardian, I want an email when something starts waiting, so I can act in time.

- [ ] Email arrives within a minute, written as a quick decision: who, how much, to where, arrival time
- [ ] It has Approve now and Stop buttons
- [ ] Withdrawals to a new address are highlighted: "New address. Was this Ama?"

**US-13 Owner alert** (FR-17) As an owner, I want an alert for every waiting payment, so I notice ones I didn't make.

**US-14 History** (FR-18) As an owner or guardian, I want to see what happened in the vault, so I can check nothing is wrong.

- [ ] Deposits, payments, cancellations and setting changes are listed with time and who did it

### Epic 6: Security (these become tests)

**US-15 Thief can't skip the wait**

- [ ] Every withdrawal waits, whatever the amount
- [ ] Only the guardian can approve early; the owner's key alone can't

**US-16 Thief can't swap the guardian quickly**

- [ ] A guardian change or removal waits the full guardian wait, and the current guardian can cancel it

**US-17 Thief can't shorten the wait instantly**

- [ ] Shortening the wait time waits, and the guardian can stop it

**US-18 Wrong person or wrong time is refused**

- [ ] A stranger can't cancel, release early, send payments, or change settings
- [ ] The guardian can't send payments or change settings
- [ ] A release before the wait ends is refused

## Screens

Every screen needs a phone layout as well as a laptop one. Each also needs its **states**: empty (nothing yet), loading (waiting for Solana), success, and error.

| # | Screen | For | What it shows | Stories |
| --- | --- | --- | --- | --- |
| 1 | Landing page | Visitors | The one-sentence promise, how it works in three steps, Connect wallet button | US-1 |
| 2 | Connect wallet | Everyone | Wallet choices (Phantom, Solflare); what happens if they have none | US-1 |
| 3 | Create vault | New owner | Wait time choices with a plain explanation, Create button | US-2 |
| 4 | Add guardian | Owner | Wallet address field, what a guardian can and can't do, copyable invite link | US-3 |
| 5 | Vault home | Owner | Balance, waiting withdrawals with countdowns and arrival times, guardian status, Deposit and Send buttons | US-4, US-7 |
| 6 | Deposit | Owner | Amount field, wallet balance, confirm | US-4 |
| 7 | Send payment | Owner | Recipient (own wallet one tap away), amount, arrival time preview, note that the guardian will be told | US-5, US-6 |
| 8 | Waiting payment detail | Owner, guardian | Amount, recipient, arrival time, large countdown, Stop button; the guardian also sees Approve now | US-8, US-9 |
| 9 | Guardian invite | Guardian | Who invited them, what being a guardian means, connect wallet, email field, Accept | US-3 |
| 10 | Guardian home | Guardian | Vaults they protect; anything waiting pinned on top with Approve now and Stop; new addresses highlighted | US-7, US-8 |
| 11 | Settings | Owner | Wait time and guardian; which changes are instant and which wait; pending changes with countdown | US-10, US-11 |
| 12 | History | Owner, guardian | Every event with time, amount and who did it | US-14 |
| 13 | Alert email | Guardian, owner | Who, how much, to where, time left, one Cancel button | US-12, US-13 |

**Key moment to design best:** screens 8 and 10, the guardian seeing a waiting payment and cancelling it. That is the demo, so it should be the most polished screen in the product.

### Screen design details

Layout reads top to bottom. Copy in quotes is the real text to use.

| # | Screen | Layout | Key copy |
| --- | --- | --- | --- |
| 1 | Landing | Top bar: logo left, Connect wallet pill right. Hero: headline left, animated waiting-payment card right (stacked on phone). "How it works" in 3 numbered cards. Closing line + Connect button. Footer labels in mono: SOLANA DEVNET · OPEN SOURCE | "Your savings can't disappear in seconds." / Sub: "Pause is a vault on Solana. Every withdrawal waits, so you or someone you trust can stop a theft." / Steps: "Put savings in your vault" · "Choose a guardian" · "Every withdrawal waits for a check" |
| 2 | Connect wallet | Centred modal on dimmed background: title, wallet list rows (icon, name, "Detected" tag), help link for no wallet | "Connect your Solana wallet" / "Don't have one? Get Phantom" |
| 3 | Create vault | Stepper (1 Limits · 2 Guardian · 3 Review). Step 1: wait time choices (1h, 6h, 24h, custom) as large selectable cards, plain explanation under them | "How long should withdrawals wait?" / choices as in Core rules / help: "Every withdrawal waits this long. You or your guardian can stop it, and your guardian can approve it early." |
| 4 | Add guardian | Stepper step 2: wallet address input, card listing "Can" and "Can't", invite link with copy button. Step 3 Review: summary card, Create vault button | "Who should be able to stop a payment?" / Can: "Get alerts · Stop a withdrawal · Approve one early" / Can't: "Spend or move your money" |
| 5 | Vault home | Top bar with address chip. Balance card (large mono number). Waiting withdrawals list (status label, countdown, arrival time), or empty state. Guardian card. Deposit and Send buttons | Waiting row: "2 SOL to your wallet · arrives 6:42 pm" / Empty: "Nothing waiting. Withdrawals appear here while they wait." |
| 6 | Deposit | Sheet or modal: amount input, wallet balance under it, Max link, Deposit button | "Move SOL into your vault" |
| 7 | Send payment | Recipient address input, amount input, "Send to my wallet" shortcut, preview card with arrival time, Confirm button | "Arrives today at 6:42 pm. Kofi will be told and can approve it sooner." |
| 8 | Waiting payment detail | Status label. Amount (large mono) and recipient address. Countdown bar (signature element). Stop button (amber, full width on phone). Secondary note. Guardian view adds an Approve now button. A backup Release button appears only if the automatic release is late | "Waiting · 5h 42m left" / Stop: "Stop this payment" / Stopped: "Stopped. Money safe in the vault." / Released: "Sent to 7xKp…a91Q" |
| 9 | Guardian invite | Centred card: who invited them, Can/Can't list, Connect wallet, email input, Accept | "Ama asked you to be her guardian" / "You'll get an alert if a big payment leaves her vault. You can stop it. You can never spend her money." |
| 10 | Guardian home | List of vaults they protect. Anything waiting is pinned on top with countdown, Approve now and Stop buttons; new addresses highlighted | "You're protecting 1 vault" / Alert card: "Ama is sending 12 SOL to a new address. Was this her?" |
| 11 | Settings | Sections: Daily limit, Wait time, Guardian. Each shows whether a change is instant or waits. Pending changes with countdown and Cancel | "Making the wait longer happens now. Making it shorter waits, and Kofi can stop it." |
| 12 | History | Filter chips (All, Payments, Stopped, Settings). List rows: icon, description, amount, time, who | "Kofi stopped a payment of 12 SOL" |
| 13 | Alert email | Logo, one sentence, amount and recipient card, time left, Approve now and amber Stop buttons, small footer | Subject: "Ama's vault: 12 SOL is waiting" / Body: "Ama is sending 12 SOL to a new address. It leaves in 5h 42m unless someone stops it." |

**Error copy (all screens):** "That didn't go through. Nothing was sent. Try again." Loading: "Confirming on Solana…"

## Non-functional requirements

| Area | Requirement |
| --- | --- |
| Network | Runs on Solana devnet. The program is deployed and its address goes in the submission. |
| Open source | Public code repository; the README says what was built before and during the hackathon. |
| Security | Every "should be refused" case in Epic 6 has an automated test that passes. The app says clearly it's an unaudited prototype. |
| Speed | Screens update within a few seconds of a Solana action; alerts arrive within a minute. |
| Devices | Works on recent Chrome, Safari and Firefox, on laptop and phone screen sizes. |
| Accessibility | Readable text contrast, keyboard use, countdowns that also show as text, not only as a ring. |
| Plain language | No crypto jargon on screen without a short explanation. Amounts show in SOL with an approximate dollar value where possible. |
| Privacy | Guardian emails are stored only in Supabase, never on Solana. |
| Honesty in copy | Never promise money can be recovered or that Pause makes theft impossible. |

## Design decisions

These are final unless the team changes them. Every Figma screen follows this section.

### Reference: what we take from Afterlife

| Borrow | Change |
| --- | --- |
| Dark, restrained, mostly colourless | Warm charcoal instead of cold black, so we don't look like a copy |
| Big, tight, confident headlines | Different typefaces (below) |
| One white pill button as the main action per screen | Add one brand colour, used for meaning, not decoration |
| Small monospace labels for on-chain details | Keep, but readable: no grey text below 4.5:1 contrast |
| Numbered stepper for setup | Keep for vault setup (3 steps) |
| Quiet rounded cards | Keep, smaller radius |
| Cinematic photo hero | Replace with the live product: an animated waiting-payment card |
| Emoji and shield icons | Drop; use one simple line icon set |

### Personality and voice

Calm, protective, human, like a careful older sibling. Short, plain sentences, never alarmist.

| Instead of | Say |
| --- | --- |
| "Transaction pending in time-lock queue" | "This payment is waiting. 5 hours 42 minutes left." |
| "Unauthorized transfer detected!!" | "Kofi, Ama is sending 12 SOL to a new address. Was this her?" |
| "Revolutionary decentralized security" | "Every withdrawal waits. Someone you trust can stop it." |

### Logo

The pause symbol: two vertical bars. The two bars also stand for two people, the owner and the guardian. Wordmark "Pause" in the heading typeface, the bars to its left.

### Colour, and why

| Role | Hex | Why this colour |
| --- | --- | --- |
| Background (warm charcoal) | #121110 | Dark feels secure and premium; warm feels human, not cold |
| Surface 1 (cards) | #1B1A18 | Quiet separation |
| Surface 2 (inputs, raised) | #24221F |  |
| Border | #34312C |  |
| Text primary (warm off-white) | #F4F1EA | Softer than pure white on dark |
| Text secondary | #B3ADA2 | Readable; passes contrast |
| Text tertiary | #8A8479 | Smallest allowed grey; passes 4.5:1 |
| **Brand and Waiting (amber)** | #F2A93B | Amber is the traffic-light colour for "slow down": attention without panic. It is the brand colour and the colour of every waiting payment. |
| Waiting soft background | #3A2A12 |  |
| **Stopped, money safe (sage green)** | #6BCB8B | Green means safe and relief. A stopped payment is the good outcome, so it is green, never red. |
| Stopped soft background | #16301F |  |
| Released (neutral) | #D9D4CA | Finished, nothing to worry about |
| Error (muted red) | #E5654F | Only for real errors such as a failed transaction, never for the Stop action |
| Primary button | #F4F1EA fill, #121110 text | Borrowed white pill |
| Stop button | #F2A93B fill, #121110 text | The one action that saves money gets the brand colour |

Rules: amber appears only where something is waiting, or on the Stop button. No gradients, no glows, no glass effects.

### Typography

| Use | Typeface | Notes |
| --- | --- | --- |
| Headings and UI | Instrument Sans (Google Fonts) | Tight letter spacing on large headings |
| Numbers, countdowns, addresses, labels | IBM Plex Mono (Google Fonts) | Tabular figures so countdowns don't jitter |

| Style | Laptop | Phone |
| --- | --- | --- |
| Display (landing headline) | 64 / 68, semibold | 40 / 44 |
| H1 | 40 / 48 | 30 / 36 |
| H2 | 28 / 36 | 24 / 32 |
| H3 | 20 / 28 | 18 / 26 |
| Body | 16 / 24 | 16 / 24 |
| Small | 14 / 20 | 14 / 20 |
| Label (mono, uppercase, +8% spacing) | 12 / 16 | 12 / 16 |
| Countdown (mono) | 48 / 56 | 40 / 48 |

### Layout

- Frames: laptop 1440 wide, phone 390 wide
- 8-point spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96
- Content width: 1120 max on laptop; 20 side margins on phone
- Corner radius: cards 16, inputs 12, buttons fully round (pill)

### Components

| Component | Decision |
| --- | --- |
| Buttons | Primary (off-white pill), Stop (amber pill), Approve now (outline pill), Secondary (outline), Text link. Height 48; 56 for the main action on phone |
| Inputs | Surface 2 fill, 1px border, 12 radius, 48 high, label above, help or error text below |
| Cards | Surface 1, 1px border, 16 radius, 24 padding |
| Status labels | Approved early (neutral, "Approved by Kofi"), Waiting (amber, with a slow pulsing dot), Stopped (green, with "money safe"), Released (neutral, with a tick) |
| Countdown | **The signature element.** An amber bar that drains left to right, the time in mono digits above it, and the same time in words for screen readers. Turns green with "Stopped" when cancelled. |
| Stepper | Three numbered steps for vault setup |
| Address | Mono, shortened (2r1M…yNVy), copy button beside it |
| Icons | One line icon set (Lucide), 20px, 1.5 stroke; no emoji |
| Notifications | Small toast at the bottom for success and errors |

### Imagery

No stock photos and no AI-generated people. The landing page hero shows the product itself: a waiting-payment card with the countdown draining and a Stop button, animated.

## Hackathon submission and judging

From the official FAQ. Deadline: Sunday 29 November 2026; the exact time is in the dashboard. Submissions lock after it.

**The submission form (5 steps)**

- [ ] Project details: name, one-liner, category, contract address (our devnet program), hub, description
- [ ] Images
- [ ] Links and video: demo video, code repository, live website
- [ ] Team members
- [ ] Review and submit

**Demo video rules:** under 3 minutes, strictly; longer is disqualified from prizes. It must show the real working product, not slides. Host on YouTube, Loom or any public link.

**How judges score, and how we answer each**

| Judges look at | How Pause answers it |
| --- | --- |
| Clarity | One sentence: every withdrawal waits, and someone you trust can stop it |
| Real-world impact | Real theft incidents and losses in the brief |
| Demo quality | The thief-and-guardian demo, live, in under a minute |
| Deployment | Program live on devnet; website live |
| Repo quality | Clean README, tests for every security rule, before/during note |
| Depth of Solana use | The rules live in our own Solana program, not on a server |
| Founder-market fit (stage 2) | Decision needed: our personal reason for building this |

Judging has two stages: every project is scored and the top 100 go through to a deeper review of code, founder-market fit and a live demo check.

The Solana track is automatic. Partner tracks and prizes are announced before kickoff; opt into any partner track only if Pause actually uses that partner.

## Open decisions

| Decision | Options | Who decides |
| --- | --- | --- |
| Product name | Keep "Pause" or choose another | Team, with designer |
| Default values | Confirm the daily limit and wait times in Core rules | Team |
| Business model | Monthly fee for larger vaults, or a fee per released payment (see brief) | Team |
| Alert channel | Email only, or email plus Telegram | Developer, based on time |
| Founder-market fit | Our honest reason for building this, for the pitch and stage-2 judging | Team |
| Partner tracks | Opt into Supabase or ElevenLabs tracks if announced and actually used | Team, after kickoff announcement |
| Brand direction | Decided in Design decisions; the team can still change it | Team |
