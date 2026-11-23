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
10. A vault **must have a guardian** from the moment it is created. Adding a guardian later, to a vault left without one, waits the guardian wait like any other guardian change. (If adding were instant, a thief with the owner's key could add their own wallet as guardian and use Approve now to empty the vault at once.)
11. Guardian changes and removal wait longer than withdrawals (see values below). Shortening the wait time waits the same guardian-change wait, so every less-safe change waits one number of days (3 by default).
12. The guardian can never deposit, request withdrawals, or change settings. They can only stop or approve early.

**Values** (Decision needed: confirm these)

| Setting | Default | Choices shown at setup |
| --- | --- | --- |
| Withdrawal wait | 24 hours | "1 hour: fastest" · "6 hours" · "24 hours: recommended. Your guardian has time to see it, even overnight" · custom up to 7 days |
| Guardian change or removal wait | 3 days | 1 to 14 days |

**Demo mode**

So the whole demo fits in a 3-minute video:

- Exists only in the devnet version. The setting is built so it cannot be turned on in a real (mainnet) launch.
- Withdrawal and guardian-change waits can be set in minutes (1 minute and up).
- A visible "Demo: waits are in minutes" label shows on every screen, so judges know the short wait is deliberate.
- Everything else behaves exactly as in the real version.

**Known limits** (say these plainly in the app and the pitch)

- If **both** the owner's and the guardian's recovery phrases are stolen, the vault can be emptied: the thief requests a withdrawal and approves it now. That takes two people fooled separately, versus one today. Any two-person system, multisig included, has the same limit.
- If nobody stops a theft before the wait ends, the money leaves.
- Money in the owner's normal wallet is not protected. Only the vault is.

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
| FR-3 | An owner can create one vault, choosing the withdrawal wait time and a guardian. A vault can't be created without a guardian. |
| FR-4 | During setup, the owner enters the guardian's first name and wallet address. The name is stored in Supabase only and used in alerts ("Kofi will be told"). Once the vault is created, the owner gets an invite link to send the guardian. |
| FR-5 | Safer setting changes apply instantly; less-safe changes wait and can be cancelled (Core rules 8–9). |

**Money in and out**

| ID | Requirement |
| --- | --- |
| FR-6 | An owner can deposit SOL from their wallet into the vault. Deposits are instant. |
| FR-7 | An owner can request a withdrawal to any address, including their own wallet. Every withdrawal waits. |
| FR-8 | Before confirming, the app shows when the money will arrive ("Arrives today at 6:42 pm") and that the guardian will be told. |
| FR-9 | The owner gets a notification when a withdrawal arrives: an email ("2 SOL arrived in your wallet") and, if the app is open, a toast. Owner emails are optional: the owner adds an email in Settings ("Email me about my vault"); without one they get in-app notices only. |

**Waiting payments**

| ID | Requirement |
| --- | --- |
| FR-10 | Owner and guardian see every waiting withdrawal: amount, recipient, arrival time, time left. Recipients the vault hasn't sent to before are marked "New address". |
| FR-11 | Owner or guardian can stop a waiting withdrawal. |
| FR-11a | The guardian can approve a waiting withdrawal early; it is then sent immediately. Because this can't be undone, the app asks the guardian to confirm first. Stop needs no confirmation: it is safe and urgent. |
| FR-12 | When the wait ends, the withdrawal is released automatically by our backend, and only to its named recipient. The owner can release it manually if the backend is down. |

**Guardian**

| ID | Requirement |
| --- | --- |
| FR-13 | A guardian accepts an invite by connecting their wallet and giving an email for alerts. If the connected wallet isn't the address the owner entered, the invite says so and asks them to check with the owner. Accepting proves the wallet is theirs by signing a message: free, off-chain, moves no money (the guardian is already set on Solana when the vault is created). On accepting, the guardian gets a welcome email so they can check it isn't in spam. Invite links work once and expire after 7 days; the owner can copy a new one from the vault home. |
| FR-14 | A guardian can see the vaults they protect: waiting withdrawals and pending changes, plus the vault's balance, wait time and owner address (public on Solana anyway, and needed to judge "28% of her savings"). They see nothing else of the owner's, such as other wallets or history outside the vault. |
| FR-15 | An owner can change or remove the guardian; the change waits and the current guardian can cancel it. Pending less-safe changes are pinned on the guardian's home with a Stop this change button, because a thief with the owner's key would try exactly this. |

**Alerts and history**

| ID | Requirement |
| --- | --- |
| FR-16 | Every waiting withdrawal and less-safe change shows in the guardian's app. When it looks like theft (see Alert levels), the guardian gets an **urgent** email written as a quick decision, with Approve now and Stop links. Other withdrawals get a **quiet** notice, so the guardian doesn't learn to ignore alerts. |
| FR-17 | The owner gets an alert for every waiting withdrawal, so they notice ones they didn't make. Urgent ones ask "Was this you?" and link to Stop and to the rescue. |
| FR-17a | Every alert email: buttons only open Pause, where the action is confirmed with the wallet (an email can never stop or approve on its own); times are fixed ("leaves Sun at 9:14 pm"), never a countdown that goes stale; and a safety line, because scammers will copy these emails: "Pause will never ask for your recovery phrase. Before you connect your wallet, check the address bar says pause.app." (Replace pause.app with the real domain.) |
| FR-18 | Owner and guardian see a history of deposits, payments, cancellations and setting changes. Each event links to its Solana transaction so anyone can check it. The app can't tell who signed with the owner's key, so wording follows the alert level: routine requests read "You asked…", urgent ones read "Your wallet asked…", because after a theft it may not have been them. |

**Alert levels**

Our Supabase backend decides how loudly to alert. The Solana program does not: it makes every withdrawal wait either way. If the backend gets it wrong or is down, no money moves early; the payment still waits and the guardian can still see and stop it in the app.

| Level | When | Guardian gets |
| --- | --- | --- |
| Urgent | Any of: to an address this vault has never paid · 25% or more of the vault, counting withdrawals already waiting · another withdrawal is already waiting · requested between 11 pm and 6 am in the owner's time zone · every less-safe setting change | Email with Approve now and Stop: "Ama is sending 12 SOL to a new address. Was this her?" |
| Quiet | Everything else | Short email with a View link: "Ama is moving 2 SOL to an address she's used before. Nothing to do unless this looks wrong." |

Sending to the owner's own wallet is **not** a reason to alert quietly: a thief with the recovery phrase controls that wallet too.

How the backend knows:

- **New address.** The Pause program emits an event for every request, stop, approval and release (Anchor events). The backend listens and keeps, per vault, a list of addresses the vault has **paid**: added only when a payment to it is released, never when one is only requested or stopped. An address not on the list is new. This also catches a thief making their address look familiar with a tiny first payment: that payment is to a new address, so it is urgent.
- **Share of the vault.** The backend reads the vault's balance from Solana when the request arrives, and adds every withdrawal already waiting.
- **Another waiting.** The backend already tracks every open request from the events.
- **Time of day.** The owner's browser sends their time zone when they create the vault; it is stored in Supabase only, never on Solana.

The urgent level and the reasons that triggered it are saved with the withdrawal, so the app shows the same "New address" tag, level and reasons ("Why you got an urgent alert") as the email.

**Solana program actions**

| Action | Who can call it |
| --- | --- |
| Create vault (with its guardian) | Owner |
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

- [ ] Wait choices shown: "1 hour: fastest", "6 hours", "24 hours: recommended. Your guardian has time to see it, even overnight", custom (24 hours preselected)
- [ ] The vault exists on devnet after I approve

**US-3 Invite guardian** (FR-4, FR-13) As an owner, I want to add someone I trust as guardian, so they can stop a theft.

- [ ] I enter their wallet address and get a link to send them
- [ ] I enter their first name and wallet address; my own address is refused
- [ ] After the vault is created, I get an invite link to send them
- [ ] The guardian opens the link, connects their wallet, gives their email, and sees "You're now Ama's guardian"
- [ ] If they connect a different wallet from the one I entered, they see "This isn't the wallet Ama added. Ask her to check the address."

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

- [ ] After stopping, it shows "Stopped. Still in your vault." and the balance is unchanged

**US-8a Approve now** (FR-11a) As a guardian, I want to approve a withdrawal early, so Ama can get money fast in an emergency.

- [ ] Approving sends the money immediately and shows "Kofi sent it early"
- [ ] The owner alone cannot skip the wait
- [ ] The approve screen reminds the guardian: "Only approve if Ama told you herself, by call or in person."

**US-8b Rescue my savings** (FR-7, FR-11a) As an owner whose recovery phrase was stolen, I want to move my savings to a new wallet with my guardian's help, so the thief, who keeps my old key forever, can't reach them.

- [ ] I request a withdrawal of everything to my new wallet; my guardian approves it now and it arrives at once, leaving no window for the thief to stop it
- [ ] If the thief stops my request first, nothing moves and I can request again
- [ ] No program change is needed: this is a normal withdrawal plus Approve now

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

**US-12 Guardian alert** (FR-16) As a guardian, I want an urgent alert only when something looks like theft, so I act in time and don't learn to ignore alerts.

- [ ] Urgent email arrives within a minute, written as a quick decision: who, how much, to where, arrival time
- [ ] It has Approve now and Stop buttons
- [ ] Withdrawals to a new address are highlighted: "New address. Was this Ama?"
- [ ] Routine withdrawals send a quiet notice instead, and still show in the guardian's app

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

**US-19 Thief can't add their own guardian instantly**

- [ ] A vault can't be created without a guardian
- [ ] Adding a guardian to a vault without one waits the full guardian wait

## Screens

Every screen needs a phone layout as well as a laptop one. Each also needs its **states**: empty (nothing yet), loading (waiting for Solana), success, and error.

| # | Screen | For | What it shows | Stories |
| --- | --- | --- | --- | --- |
| 1 | Landing page | Visitors | The promise, the four mechanisms (time-locked withdrawals, guardian veto, theft alerts, rescue), Connect wallet button | US-1 |
| 2 | Connect wallet | Everyone | What connecting shares; wallet choices (Phantom, Solflare); what happens if they have none, including on a phone | US-1 |
| 3 | Create vault | New owner | Wait time choices with a plain explanation, Continue | US-2 |
| 4 | Add guardian | Owner | Guardian's name and wallet address, what a guardian can and can't do, Review step, invite link once the vault is created | US-3 |
| 5 | Vault home | Owner | Balance, waiting withdrawals with countdowns and arrival times, guardian status, Deposit and Withdraw buttons; a theft banner when a withdrawal looks like theft | US-4, US-7 |
| 6 | Deposit | Owner | Amount field, wallet balance, confirm | US-4 |
| 7 | Withdraw | Owner | Recipient (own wallet one tap away), amount, arrival time preview, note that the guardian will be told | US-5, US-6 |
| 8 | Waiting payment detail | Owner, guardian | Amount, recipient, arrival time, large countdown, Stop button; the guardian also sees Approve now | US-8, US-9 |
| 9 | Guardian invite | Guardian | Who invited them, what being a guardian means, connect wallet, email field, Accept | US-3 |
| 10 | Guardian home | Guardian | Vaults they protect; anything waiting pinned on top with Approve now and Stop; new addresses highlighted | US-7, US-8 |
| 11 | Settings | Owner | Wait time and guardian; which changes are instant and which wait; pending changes with countdown | US-10, US-11 |
| 12 | History | Owner, guardian | Every event with time, amount and who did it | US-14 |
| 13 | Alert email | Guardian, owner | Urgent version: who, how much, to where, time left, Approve now and Stop buttons. Quiet version: a short notice with a View link | US-12, US-13 |

**Key moment to design best:** screens 8 and 10, the guardian seeing a waiting payment and cancelling it. That is the demo, so it should be the most polished screen in the product.

### Screen design details

Screens 1 to 8 are designed: **Figma is the source for their layout, states and copy**, so their rows here only link to the frames. Rows 9 to 13 are briefs until those screens are designed. Copy in quotes is the real text to use.

| # | Screen | Layout | Key copy |
| --- | --- | --- | --- |
| 1 | Landing | Hero with the guardian's view of a paused payment, the four mechanisms, closing line. Marketing register | [Figma frames](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=10-15) |
| 2 | Connect wallet | What connecting shares, wallet rows, phone path into the wallet app. Modal on laptop, sheet on phone | [Figma frames](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=18-292) |
| 3 | Create vault | Step 1: wait time as choice cards, 24 hours recommended, live arrival example | [Figma frames](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=28-553) |
| 4 | Add guardian | Step 2: name, address, can and can't. Step 3: Review, create, then the invite link | [Figma frames](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=31-859) |
| 5 | Vault home | Balance, waiting list, guardian and wait-time cards, theft banner | [Figma frames](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=34-1349) |
| 6 | Deposit | Amount with Max that keeps fees back, preview, done. Modal on laptop, sheet on phone | [Figma frames](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=38-1526) |
| 7 | Withdraw | Where to, amount, honest preview, sent. Includes the Rescue version (US-8b) | [Figma frames](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=39-1897) |
| 8 | Waiting payment detail | Guardian view (why urgent, Stop, Approve now with confirmation) and owner view (stop, arrived, late release) | [Figma frames](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=42-2301) |
| 9 | Guardian invite | Who invited them, can and can't, connect the wallet Ama added (checked), email, accept by signing a free message; wrong wallet, no wallet on phone, expired link | [Figma frames](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=45-2840) |
| 10 | Guardian home | Anything that needs the guardian is pinned on top in amber (urgent payments with reasons, countdown, Stop and Approve now; less-safe changes with Stop this change). Routine withdrawals stay quiet inside the vault card. Calm, loading and error states | [Figma frames](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=47-3156) |
| 11 | Settings | Pending changes on top with countdown and Cancel. Wait time and guardian sections; editing shows the consequence first (safer: happens now, Save; less safe: waits 3 days, guardian told, Request change) | [Figma frames](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=48-3399) |
| 12 | History | Filter chips, events grouped by day, one full sentence per event naming who did it, amount, time, link to view it on Solana. Owner and guardian versions; empty, loading, error | [Figma frames](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=49-3909) |
| 13 | Alert email | Guardian urgent and quiet, owner urgent and arrived; each with a summary card, buttons that open Pause, a safety line and a footer. Lock-screen notification for the demo | [Figma frames](https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=51-4197) |

**Error copy (screens that send a transaction):** "That didn't go through. Nothing was sent. Try again." Loading: "Confirming on Solana…" Screens that don't send money (such as Connect wallet) say what actually went wrong instead.

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
| Privacy | Guardian names and emails, the owner's email and the owner's time zone are stored only in Supabase, never on Solana. Requests that save them are proven with a free wallet-signed message. |
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

One personality, two registers:

| | Marketing | Product |
| --- | --- | --- |
| Where | Landing page, pitch, submission, demo video | Every in-app screen, alerts, emails, errors |
| Job | Make someone care in five seconds | Help someone act correctly, right now |
| Headlines | About the person's outcome, not the mechanism. Six words or fewer; a two-part fragment is fine: "What you save. Stays yours." | Say what is happening: "Ama is sending 12 SOL to a new address." |
| Body | Two sentences: the problem, then what Pause is and what it guarantees | Full sentences: what happened, then what to do. Amount, person and time first |
| Naming | Mechanisms are named nouns people can point at: Time-locked withdrawals, Guardian veto, Theft alerts, Rescue | Plain words for the same things: "waits", "stop", "approve now" |
| Numbers | Concrete: "1 hour to 7 days" | Exact: "5h 42m left", "arrives 6:42 pm" |

| Instead of | Say |
| --- | --- |
| "Transaction pending in time-lock queue" | "This payment is waiting. 5 hours 42 minutes left." |
| "Unauthorized transfer detected!!" | "Kofi, Ama is sending 12 SOL to a new address. Was this her?" |
| "Revolutionary decentralized security" | "Every withdrawal waits. Someone you trust can stop it." |

**Off-tone: never write these.** They read as machine-written or as hype:

| Pattern | Example to avoid |
| --- | --- |
| Dramatic denial lists | "Nobody can bend them: not a thief, not you, not us." |
| "Not even…" | "Not even we can skip it." |
| "It's not X, it's Y" contrasts | "It's not a wallet. It's a promise." |
| Groups of three for rhythm | "Safe. Simple. Secure." |
| Hype words | revolutionary, seamless, effortless, unlock, empower, next-generation |
| Unexplained crypto jargon | non-custodial, PDA, multisig, permissionless, time-lock queue (explain it in plain words, or leave it out) |
| Alarm | "WARNING", "!!", red for anything but a real error |
| Machine labels as sentences | "WAITING · 5H 42M LEFT", "Stopped · money safe" |
| Promises Pause can't keep | "theft-proof", "100% safe", "get your money back" |
| Selling with fear | "Hackers are coming for your crypto." |

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
| Mono small (addresses, normal case: uppercase would change a Solana address) | 14 / 20 | 14 / 20 |
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
| Status labels | Sentence case in the UI typeface, soft pill, a media-control symbol everyone knows. Waiting: amber, the pause symbol (the logo's two bars), "Paused · arrives 6:42 pm": the money is paused, not gone. Stopped: green, a stop square, "Stopped. Still in your vault." Arrived: neutral, a tick, "Arrived". Approved early: neutral, a tick, "Kofi sent it early". No animation. |
| New address tag | Small amber-outline tag, "New address", on recipients the vault hasn't sent to before (FR-10) |
| Countdown | **The signature element.** An amber bar that drains left to right, the time in mono digits above it, and the same time in words for screen readers. Turns green with "Stopped" when cancelled. |
| Motion | Only for real events, such as the bar turning green the moment a payment is stopped. Nothing pulses or moves for decoration. |
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
| Demo quality | The thief-and-guardian demo, live, in under a minute: the thief (with Ama's stolen recovery phrase) tries to empty the vault, Kofi stops it, then Kofi approves Ama's rescue to a new wallet |
| Deployment | Program live on devnet; website live |
| Repo quality | Clean README, tests for every security rule, before/during note |
| Depth of Solana use | The rules live in our own Solana program, not on a server |
| Founder-market fit (stage 2) | Decision needed: our personal reason for building this |

Judging has two stages: every project is scored and the top 100 go through to a deeper review of code, founder-market fit and a live demo check.

The Solana track is automatic. Partner tracks and prizes are announced before kickoff; opt into any partner track only if Pause actually uses that partner.

## Business model

**Decided: freemium subscription.** The vault and every rule in the Solana program are free for everyone. We charge for the service our Supabase backend runs, never for access to the vault.

| Free | Plus (about $4 a month) |
| --- | --- |
| The vault and every on-chain rule: waits, Stop, Approve now | Everything in Free |
| Email alerts and automatic release for vaults worth up to $1,000 | Alerts and automatic release with no limit |
| The manual Release button always works | Telegram and phone call alerts |

Why this model:

- The program is public, so a limit inside it could be bypassed and would hold people's money hostage. The backend is ours, so its limits can be enforced.
- It charges for protection, not for taking out your own money (a fee per withdrawal would charge people during a rescue).
- Running costs are about $75 a month (Supabase and a private RPC URL); roughly 20 paying users cover them.

Not built for the hackathon: no payments or limits are in the program or backend yet. It is only in the pitch.

## Open decisions

| Decision | Options | Who decides |
| --- | --- | --- |
| Product name | Keep "Pause" or choose another | Team, with designer |
| Default values | Confirm the wait times in Core rules. There is no daily limit (decided: your normal wallet is for everyday money; a limit would let a thief take that amount instantly) | Team |
| Business model | **Decided:** freemium subscription. See [Business model](#business-model) | Team |
| Alert channel | **Decided:** email, sent with Resend (free tier). Telegram only if time allows | Developer, based on time |
| Founder-market fit | Our honest reason for building this, for the pitch and stage-2 judging | Team |
| Partner tracks | Opt into Supabase or ElevenLabs tracks if announced and actually used | Team, after kickoff announcement |
| Brand direction | Decided in Design decisions; the team can still change it | Team |
