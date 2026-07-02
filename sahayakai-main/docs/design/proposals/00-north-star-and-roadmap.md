# 00 · North Star & Redesign Roadmap

**Owner:** Design-Engineering Lead (Design Director) · **Status:** Framing document · **Audience:** the design review board (13 specialist workstreams) · **Supersedes:** nothing — this is the spine the other proposals hang from.

This document is the unifier. The other twelve proposals (UX journey, design system, motion `03`, taste audit `04`, frontend architecture, marketing, mobile, perceived-performance, brand/illustration, i18n, a11y, content, inventory) each go deep on one lane. This one sets the **north star**, the **method for deciding**, and the **sequence**. When a specialist proposal and this document conflict on *direction*, this document wins; on *craft within a lane*, the specialist wins. (See §5.)

---

## 1. Design philosophy — the north star

> **SahayakAI should feel like a calm, competent colleague who happens to live in your phone — one who speaks your language, respects that you are a professional, and gets out of the way the moment the work is done.** Not a chatbot, not a dashboard, not an "AI product." A teacher opens it between two classes, on a mid-range Android, on patchy network, tired — and within one tap or one spoken sentence, real classroom-ready work exists. Every pixel earns its place by reducing the teacher's cognitive and time load, never by demonstrating our cleverness.

### Guiding principles

1. **First-principles, not feature-parity.** We do not copy Notion/ChatGPT surfaces. We start from the teacher's real constraint — *minutes between classes, no prep time, limited data* — and design backward from that. Every screen answers: "what is the fastest honest path from intent to usable artifact?"
2. **Teacher comfort over interface novelty.** Familiar beats clever. A teacher who has never used software should not have to learn a metaphor. Reuse the same layout skeleton, the same "input → generating → result → refine/save" rhythm everywhere so the *second* tool is free to learn.
3. **Dignity by default.** No condescension, no "look how easy even *you* can do it" tone, no cartoon-poverty imagery. Copy and illustration treat the teacher as the expert they are; the AI is the assistant. This is a product constraint, not a marketing nicety.
4. **Calm confidence.** Saffron-forward, generous whitespace, one clear primary action per view, restrained motion (see `03-motion`). The UI should lower the teacher's heart rate. Loud gradients, competing CTAs, and celebratory confetti are banned; quiet certainty is the aesthetic.
5. **Culturally rooted, never Hindi-only.** Eleven Indic scripts are first-class, not an afterthought toggle. Type, line-height, truncation, and illustration must hold in Kannada, Bengali, Tamil, and Malayalam as well as they do in Latin. "What breaks in Malayalam?" is asked of every component.
6. **Effortless, voice-first.** The microphone is the hero input, text the fallback — because the primary user may type slowly in their own script. The happiest path is: press mic, speak, get artifact. Everything else is progressive disclosure.
7. **Honest about the machine.** We show "generating," we show "Sahayak can make mistakes — please review," we never fake speed we don't have. Trust is the moat; perceived performance (skeletons, streaming, optimism) is how we honor slow reality without lying about it.

---

## 2. Target design personality

**Adjectives:** warm · calm · confident · rooted · uncluttered · trustworthy · quietly premium. *Not:* playful-startup, neon, dense-enterprise, "government-portal."

**Three aesthetic reference directions** (the board should pick one at the Phase 0 gate; the whole system commits to it):

- **A · "Warm Editorial"** — generous type, a real headline face, ivory/paper surfaces, saffron as ink-accent not fill. Reads like a well-made textbook or *The Better India*. Highest dignity, best for teacher trust; risk: can feel slow/serious if under-motioned.
- **B · "Soft Utility"** — Linear/Things-grade restraint, tight neutral grays, saffron reserved strictly for the single primary action, micro-interactions doing the delight. Best perceived-performance and consistency; risk: can read cold / un-Indian if illustration and warmth aren't layered back in.
- **C · "Rooted Craft"** — direction A/B chassis plus a considered Indic-craft layer (block-print motifs, kalamkari line-illustration, regional palette accents) used sparingly as texture. Most differentiated and most "Bharat"; risk: highest execution cost and the easiest to tip into kitsch.

**Recommendation to the board:** target **B as the structural chassis, warmed toward A, with C's illustration language applied as a thin accent layer** — i.e. Soft-Utility bones, Editorial calm, Rooted-Craft skin. This gives us consistency and speed now, dignity and difference over time, without betting the redesign on hand-illustration throughput.

---

## 3. Phased redesign roadmap

The 13 workstreams are **not** sequential silos; three of them — **a11y, i18n, and illustration/brand** — are *woven through every phase* as acceptance criteria, never a "Phase 5 cleanup." The remaining ten sequence as follows:

| Phase | Theme | Lead workstreams | Exit artifact |
|---|---|---|---|
| **0 · Foundations** | Design system + tokens + personality lock | design-system, taste-audit `04`, motion `03`, frontend-arch, inventory | Ratified token set (color/space/type/radius/shadow/motion), the chosen personality direction (§2), and a component inventory with a keep/merge/kill verdict. |
| **1 · Core teacher loop** | Dashboard + the "intent → artifact" spine | UX-journey, perceived-perf, a11y, i18n | Redesigned `dashboard-home` + app shell + the canonical result/loading pattern, on tokens, verified on a mid-range Android. |
| **2 · Generator tools** | ~12 tools onto ONE shared primitive | frontend-arch, content, perceived-perf | A `<GeneratorTool>` primitive (input panel → generating → result → refine/save/export) that every tool composes; per-tool code shrinks. |
| **3 · Community & social** | Feed, library, profiles, messages | UX-journey, content, a11y | Community/library/messages on the same tokens + primitives; social surfaces feel part of the product, not bolted on. |
| **4 · Marketing** | Landing + pricing + outreach surfaces | marketing, brand/illustration | Marketing pages *compose the product's own components and palette* (per existing house rule), so brand and app are one system. |

**Why this order:** tokens first or every later phase re-does color/spacing by hand (the current failure — see §6). The core loop before the tools, because the tools inherit the loop's result/loading pattern. Marketing last because it should reflect a finished product, not promise a redesign that doesn't exist yet.

**Woven-through gates (every phase):** no component ships without (a) an a11y pass — focus, contrast ≥ 4.5:1, 44px targets, keyboard path; (b) an i18n pass — renders in all 11 scripts without clipping; (c) an illustration/empty-state review — no raw empty `<div>`, no stock-AI imagery.

---

## 4. Definition of done — the quality bar

A surface is "done" only when **all** hold:

- **Token-pure.** Zero raw hex, zero magic px, zero one-off `orange-500`. Everything references the ratified scale. (Grep for `#`, `orange-`, `[0-9]px` returns nothing new.)
- **One primary action.** Each view has exactly one visually dominant CTA; secondary actions are visibly subordinate.
- **The three languages test.** Looks correct in English, Hindi, **and** Malayalam (longest/tallest script) with no clipping or broken truncation.
- **The mid-range Android test.** Interactive and legible on a throttled mid-tier device on 3G; first meaningful paint is fast or honestly skeletoned.
- **A11y clean.** Keyboard-navigable, visible focus, contrast passes, images labelled, motion respects `prefers-reduced-motion`.
- **Consistent rhythm.** Uses the shared primitive/skeleton for its category — a teacher who learned one tool recognizes this one instantly.
- **Dignity check.** Copy and imagery would not embarrass us in front of the teacher they depict.
- **Machine-verified.** `tsc --noEmit` + lint + the design-token lint pass in CI. If a machine can check it, a human doesn't argue about it.

---

## 5. Deciding when specialists disagree

The board will conflict — motion wants richer transitions, perceived-perf wants less; brand wants illustration, a11y wants contrast. Resolve in this fixed priority order (higher wins):

1. **Teacher outcome & dignity** — does it get the teacher to a usable artifact faster, with respect? Trumps everything.
2. **Accessibility & i18n floor** — non-negotiable minimums (contrast, targets, all-11-scripts). We do not ship below the floor to win an aesthetic.
3. **Honest performance** — perceived-perf and real cost on a mid-range device. A beautiful thing that lags on the target phone is not beautiful here.
4. **Consistency of system** — the shared token/primitive wins over a locally-optimal bespoke treatment. One good pattern beats twelve clever ones.
5. **Aesthetic refinement / taste** — within the above constraints, the taste-audit and the chosen personality direction arbitrate.

Mechanics: disagreements are decided at the phase gate by the Design Director against this ladder, in ≤1 paragraph of written rationale, logged in the relevant proposal. **Codex/peer disagreement is a signal to slow down, not auto-override** — name the risk, decide, move. Default action under uncertainty: ship the *smaller, more consistent, more accessible* option.

---

## 6. The single highest-leverage first move

**Ratify and enforce the design-token layer (Phase 0), then convert the two hub surfaces — `dashboard-home` and the app shell — onto it as the reference implementation.**

Grounding: the hubs already *reference* good tokens (`rounded-surface-md`, `shadow-soft/elevated`, `saffron-50/700`, `duration-micro/medium`, `ease-out-quart`) **but also still leak raw values** (`bg-orange-500`, `bg-red-500`, hardcoded `text-[10px]`, `h-[18px]`). That is the disease in miniature: a half-adopted system, applied by hand, drifting per file. Every one of the other 12 workstreams is blocked on or degraded by this — you cannot audit taste, tune motion, or guarantee contrast across 11 languages on top of ad-hoc values.

So the first PR is not a redesign of anything visible. It is: **lock the token set + a `design-token` lint rule that fails CI on new raw hex/px/`orange-*`, and migrate the two hubs to prove the system.** That single move unblocks all 13 lanes, makes "done" (§4) machine-checkable, and turns every later phase from "redesign by hand" into "compose from the system." Highest leverage, lowest pixels.
