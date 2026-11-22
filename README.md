# Pause

Pause is a vault on Solana where every withdrawal waits, so the owner or a trusted guardian can stop it.

You keep everyday money in your normal wallet and move savings into the vault. Every withdrawal from the vault waits for a set time. During the wait, you or your guardian can stop it. In an emergency, the guardian can approve it early. When the wait ends, the money goes to the recipient it named, and only to them. The guardian can stop or approve; they can never spend.

> **Unaudited prototype.** Pause runs on Solana's test network (devnet) only. Do not use real money.

- Requirements (source of truth): [`docs/requirements.md`](docs/requirements.md)
- Program address (devnet): `BUFdujWydbi7UA13x1EnBavq7iwNjaxip5Csuv9fjEDz` (not deployed yet)
- Live website: _not deployed yet_

## Status

The repo is set up and the tooling works. The Solana program's actions are being added one user story at a time. Done so far: create vault, deposit. See [Built before vs. during the hackathon](#built-before-vs-during-the-hackathon).

## Stack

| Part             | Technology                                                          |
| ---------------- | ------------------------------------------------------------------- |
| Solana program   | Rust, Anchor 1.1.2, tested with LiteSVM                             |
| Program client   | TypeScript, generated from the program by Codama (`@solana/kit`)    |
| Website          | React 19, Vite, TypeScript, Tailwind CSS v4, `@solana/react-hooks`  |
| Wallets          | Any Wallet Standard wallet, such as Phantom or Solflare             |
| Backend (coming) | Supabase: guardian emails, alerts, automatic release after the wait |

## Project layout

```
├── anchor/                     Solana program workspace (Anchor)
│   ├── Anchor.toml             Program address and cluster (devnet)
│   └── programs/pause/src/
│       ├── lib.rs              The program: all vault rules live here
│       ├── instructions/       One file per action
│       ├── state/              Account structs (Vault)
│       └── tests/              LiteSVM tests: who is refused, and when
├── src/
│   ├── App.tsx                 Website
│   ├── providers.tsx           Solana connection and wallets
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

The program address comes from a keypair file, `anchor/target/deploy/pause-keypair.json`. Whoever holds that file controls upgrades to the program at that address. It is **not** in git.

- **Deployer only:** keep that file and a backup of it somewhere safe (a password manager, not the repo).
- **Everyone else:** you don't need it. Builds use `--ignore-keys`, so they keep the address in `declare_id!` and don't create a new one.

```bash
npm run program:test         # everything passes first
cd anchor && anchor deploy   # needs ~2 devnet SOL in your CLI wallet
cd .. && npm run codegen     # keep the client in sync, then commit
```

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
- _Each feature is added here as it lands._

## License

_Not chosen yet._
