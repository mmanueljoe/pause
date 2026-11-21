# Pause: design workspace

Pause is a vault on Solana where every withdrawal waits,
so the owner or a trusted guardian can stop it.

## Source of truth
- docs/requirements.md
  - "Design decisions": colours, type, layout, components, voice
  - "Screens" and "Screen design details": what to design
- If the doc and a request disagree, ask before designing.

## Figma
- File: https://www.figma.com/design/OGUzgNvZ3q3ZLaIOTfYzav/Pause-UI?node-id=0-1&t=Fv0oLBQK9cZ7iTsb-1
- Pages: Foundations, Components, Screens, Archive
- Frame names: "NN Screen / Laptop|Phone / State" (screen 8 adds the role: "08 Waiting payment / Guardian / Phone / Stopped")
- All 13 screens are designed. Figma is the source for their layout, states and copy; the doc keeps rules and behaviour only.
- Developer handover: design/handover.md

## Rules
- Use only the styles on Foundations and components on Components.
- Every screen: laptop (1440) and phone (390) frames.
- Every screen: empty, loading, success and error states where relevant.
- Use the real copy from the doc, never placeholder text.
- Amber only for waiting things and the Stop button.
- No gradients, glows, glass effects, emoji, or shield/padlock icons.

## How to work
- One step at a time: Foundations, then Components, then screens.
- After each step, stop and list what you made.
- Never invent a feature that isn't in the requirements doc