# Pause

Pause is a vault on Solana where every withdrawal waits, so the owner or a trusted guardian can stop it.

You keep everyday money in your normal wallet and move savings into the vault. Every withdrawal from the vault waits for a set time. During the wait, you or your guardian can stop it. In an emergency, the guardian can approve it early. When the wait ends, the money goes to the recipient it named, and only to them. The guardian can stop or approve; they can never spend.

> **Unaudited prototype.** Pause runs on Solana's test network (devnet) only. Do not use real money.

- Requirements (source of truth): [`docs/requirements.md`](docs/requirements.md)
- Program address (devnet): [`BUFdujWydbi7UA13x1EnBavq7iwNjaxip5Csuv9fjEDz`](https://explorer.solana.com/address/BUFdujWydbi7UA13x1EnBavq7iwNjaxip5Csuv9fjEDz?cluster=devnet) (demo build)
- Live website: _not deployed yet_

## Status

The repo is set up and the tooling works. All program actions in the requirements are built and deployed to devnet; next: the website and backend. See [Built before vs. during the hackathon](#built-before-vs-during-the-hackathon).

## Stack

| Part             | Technology                                                          |
| ---------------- | ------------------------------------------------------------------- |
| Solana program   | Rust, Anchor 1.1.2, tested with LiteSVM                             |
| Program client   | TypeScript, generated from the program by Codama (`@solana/kit`)    |
| Website          | React 19, Vite, TypeScript, Tailwind CSS v4, React Router           |
| Solana in the UI | `@solana/kit` 8, `@solana/kit-plugin-wallet`, `@solana/react` + SWR |
| Wallets          | Any Wallet Standard wallet, such as Phantom or Solflare             |
| Backend (coming) | Supabase: guardian emails, alerts, automatic release after the wait |

## Project layout

```
├── anchor/                     Solana program workspace (Anchor)
│   ├── Anchor.toml             Program address and cluster (devnet)
│   └── programs/pause/src/
│       ├── lib.rs              The program: all vault rules live here
│       ├── instructions/       One file per action
│       ├── state/              Account structs (Vault, Withdrawal)
│       └── tests/              LiteSVM tests: who is refused, and when
├── src/
│   ├── App.tsx                 Pages and URLs
│   ├── components/ui/          Shared components (from Figma)
│   ├── lib/pause/              Reading and sending to the Pause program
│   ├── lib/solana/client.ts    Solana connection and wallets
│   └── generated/pause/        Client generated from the program (do not edit by hand)
├── docs/requirements.md        Product requirements (source of truth)
├── design/                     Design workspace notes (Figma)
├── .github/                    CI workflow and pull request template
└── codama.json                 Client generation config
```

## Prerequisites

| Tool       | Version | Install                                                                                                                              |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js    | 24      | [nodejs.org](https://nodejs.org) or `nvm use` (reads `.nvmrc`)                                                                       |
| Rust       | 1.96    | [rustup.rs](https://rustup.rs); the version in `anchor/rust-toolchain.toml` installs automatically                                   |
| Solana CLI | 3.1.10  | [Solana install guide](https://solana.com/docs/intro/installation)                                                                   |
| Anchor CLI | 1.1.2   | [Anchor install guide](https://www.anchor-lang.com/docs/installation): `avm install 1.1.2 && avm use 1.1.2`                          |
| Wallet     | -       | [Phantom](https://phantom.com) or [Solflare](https://solflare.com) browser extension, switched to devnet (needed to use the website) |

Website-only work needs just Node.js: the generated client is committed, so you don't need Rust to run the site.

## Setup

```bash
git clone <repo-url> pause && cd pause
npm install            # also installs the pre-commit hook
cp .env.example .env.local   # optional: set a private RPC URL
npm run dev            # http://localhost:5173
```

### Solana CLI (for program work)

Point the CLI at devnet, never mainnet, and create a wallet that pays for deploys:

```bash
solana config set --url devnet
solana-keygen new          # creates ~/.config/solana/id.json; keep the seed phrase safe
solana airdrop 2           # free devnet SOL; if rate-limited, use https://faucet.solana.com
```

### RPC URL

The website talks to Solana through an RPC URL. With `VITE_SOLANA_RPC_URL` empty it uses the free public devnet URL, `https://api.devnet.solana.com`. That URL is rate-limited, so for the live demo create a free devnet URL at Helius, QuickNode or Alchemy and put it in `.env.local`.

## Commands

| Command                  | What it does                                                       |
| ------------------------ | ------------------------------------------------------------------ |
| `npm run dev`            | Run the website locally                                            |
| `npm run check`          | Website: type check, lint, format check, production build          |
| `npm run format`         | Format website code with Prettier                                  |
| `npm run program:build`  | Build the Solana program (`anchor/target/deploy/pause.so` and IDL) |
| `npm run program:test`   | Build the program, then run its LiteSVM tests                      |
| `npm run program:lint`   | Rust format check (rustfmt) and lint (Clippy, warnings fail)       |
| `npm run program:format` | Format Rust code                                                   |
| `npm run codegen`        | Regenerate `src/generated/pause` from the program's IDL            |
| `npm run setup`          | `program:build` then `codegen`: run after every program change     |

## Deploying the program to devnet

The program is deployed and **upgradeable**: new versions go to the same address.

- **Upgrade authority:** the deployer's CLI wallet (`~/.config/solana/id.json`). Only that wallet can upgrade the program. Keep its recovery phrase backed up; it is **not** in git.
- **`anchor/target/deploy/pause-keypair.json`** only fixed the address at the first deploy. It isn't needed for upgrades, and it is not in git.
- **Everyone else:** you don't need either. Builds use `--ignore-keys`, so they keep the address in `declare_id!`.

To ship a new version (deployer only):

```bash
npm run program:test   # builds the demo version and runs every test
solana program deploy anchor/target/deploy/pause.so \
  --program-id anchor/target/deploy/pause-keypair.json --url devnet
npm run codegen        # keep the client in sync, then commit
```

The first deploy reserved 600,000 bytes (`--max-len`), about twice the program's size, so upgrades fit without extra steps. Changing an account's fields means vaults created before the change can't be read; on devnet, create new test vaults.

## Code quality and CI

- **Pre-commit hook** (Husky + lint-staged): formats and lints only the files you changed.
- **CI** (`.github/workflows/ci.yml`) runs on every push to `main` and every pull request:
  - Website: type check, ESLint, Prettier, build
  - Program: rustfmt, Clippy, build, LiteSVM tests, and a check that `src/generated` matches the program
  - Secret scan with gitleaks
- **Pull requests** use a template that asks which user story the change covers and whether tests cover who is refused.

## Rules for contributors

- The vault rules live in the Solana program, never only in the website.
- Every withdrawal waits. There is no daily limit or instant withdrawal.
- Only the guardian can approve early. Release goes only to the named recipient.
- Every program action has tests for who is refused and when.
- Demo mode works on devnet only.
- Never commit secrets, keypairs or `.env` files.
- Build only what's in [`docs/requirements.md`](docs/requirements.md); ask before adding anything else.

## Built before vs. during the hackathon

**Before the hackathon**

- The product requirements (`docs/requirements.md`) and design direction.
- The starting scaffold: the `create-solana-dapp` Vite + Anchor template (commit `8551932`). Its example SOL vault program, UI and branding have since been removed.

**During the hackathon**

- Repo set up for Pause: program stub with its own devnet address, website shell, tooling (ESLint, Prettier, rustfmt, Clippy, pre-commit hook), CI and this README.
- Program: `create_vault` (US-2, US-3, US-19), with a `demo` build feature that allows 1-minute waits on devnet only.
- Program: `deposit` (US-4).
- Program: `request_withdrawal` and the `Withdrawal` account (US-5, US-15).
- Program: `stop_withdrawal`, `approve_withdrawal`, `release_withdrawal` (US-8, US-8a, US-8b, US-9, US-18).
- Program: `change_withdrawal_wait`, `propose_guardian_change`, `apply_change`, `cancel_change` (US-10, US-11, US-16, US-17, US-19).
- Program deployed to devnet (demo build).
- Website foundation: design tokens, shared components, one page per screen, live vault data, role detection (FR-2). Moved from `@solana/react-hooks` to the maintained Kit 8 wallet stack.
- Website: Landing page and Connect wallet dialog (screens 1 and 2, US-1).
- _Each feature is added here as it lands._

## License

_Not chosen yet._
