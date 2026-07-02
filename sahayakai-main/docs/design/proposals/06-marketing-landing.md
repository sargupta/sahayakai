# Proposal 06 — Marketing & Landing

**Lens:** Public marketing site + landing. **Scope:** `src/app/page.tsx`, `src/app/(marketing)/*`, `src/app/pricing/page.tsx`, `src/components/landing/*`.
**Constraints:** Lucide-only icons, saffron-forward, teacher-dignity, no aggressive jargon, 11 Indic languages, marketing composes production landing components.

---

## 1. Current-state assessment

The visual foundation is genuinely good: warm saffron radial stage, ghosted Indic script marks (`script-marks.tsx`), `font-headline`/`font-body` type system, a defined `--saffron-*` HSL scale, and a rotating six-pillar headline. It already reads warmer and more institutional than a generic SaaS template. But it is **thin and under-converting**:

- **Home is one screen deep.** `landing-page.tsx` composes only Hero → 6 pillar cards → one quote → footer. No "how it works," no product screenshot, no proof/logos, no explicit school-vs-teacher fork, no closing CTA band. A decision-maker scrolls once and hits the footer.
- **The rotating headline hides the product.** `landing-pillar-strip.tsx` dims 5 of 6 pillars to `opacity 0.55` and only lifts the active one. The full product surface is never legible at a glance — the exact scan a principal needs.
- **Orphaned assets.** `sample-output-section.tsx` and `demo-interaction.tsx` exist, are polished, and are **not rendered anywhere**. The single strongest trust device — showing real generated output — is built and unused.
- **`for-schools` outclasses `/`.** It has a principal quote, a dashboard-metrics preview, and a concrete "we come to you" demo block. The home page should be at least this strong.
- **Localized pages break the brand.** `bn/kn/ta` SEO pages use an entirely different, un-branded system: gray body text, `text-orange-600`, four-color left borders, no nav/footer, no saffron stage. A Bengali teacher who lands there sees a different, cheaper product than an English visitor.
- **Trust is assertion, not evidence.** Stats (`2+ hrs`, `~200 hrs/year`, "150 Karnataka teachers") are stated as flat text with no source, testimonial density, logo wall, or security/privacy signal.
- **Home lacks page-level metadata/hreflang.** Only the root layout carries OG; `/` has no `alternates.languages`, so the localized variants aren't discoverable as language alternates of the canonical landing.

---

## 2. Reimagined landing narrative & section structure

One page, two audiences (teacher + decision-maker), a single spine. **Hook → Problem → Product → Proof → Pricing → CTA:**

1. **Hook (Hero).** Keep the rotating verb but show **all six pillars statically legible** below it (no dimming). Dual CTA stays: `Start free` (teacher) + `Book a school demo` (admin). Add a quiet third path: `For governments →`.
2. **Problem.** One tight band, borrowed from `about` copy: five periods, 150 pupils, three languages, four boards — and every existing tool built for a teacher who isn't Indian. Names the pain without disrespecting the teacher.
3. **Product — show, don't tell.** Render the orphaned `SampleOutputSection` here: a real lesson plan generated in ~30s, in an Indic language. Follow with the 6-pillar grid as *explanation* (icon + name + one line + a screenshot thumbnail each).
4. **Proof.** Testimonial pair (teacher + principal), the `for-schools` dashboard-metrics card promoted to home, a logo/affiliation strip (pilots, boards, "Made in Bharat"), and a privacy line.
5. **Audience fork.** Two cards: *"I'm a teacher → Start free"* and *"I lead a school → See the dashboard"* deep-linking to `for-schools`.
6. **Pricing teaser → full CTA band.** Three-tier strip ("Less than a textbook") linking to `/pricing`, then a warm closing CTA with founder demo.

`for-schools` becomes the deep decision-maker page (ROI table, rollout, security); the home page previews and routes to it rather than duplicating it.

---

## 3. Visual direction — award-tier but credible

**Warm, institutional, illustration-rich — not startup-generic.**

- **Palette:** saffron primary (60-30-10: warm off-white ground, deep-ink text, saffron as the disciplined 10% accent). Add one cool institutional secondary (deep indigo/teal) for decision-maker surfaces so "school" reads a shade more serious than "teacher."
- **Type:** keep `font-headline`; consider a warm humanist serif for the single hero line only to lift it above SaaS-default (institutional-report register, not editorial flourish). Body stays Inter-family for Indic coverage.
- **Illustration over stock.** Commission a small line-illustration set (Lucide-consistent stroke weight): a teacher at a blackboard, a parent phone call, a staffroom — warm, Indian, specific. This is the single biggest lever away from "generic AI startup."
- **Motion:** the rotating headline stays; everything else calms down. Section reveals on scroll, subtle card lift on hover. No parallax circus.
- **Texture:** keep `ScriptMarks` but make it responsive-safe (currently absolute-positioned px) and let it breathe as ambient warmth, never literal translation.
- **Product shots** framed in a soft device mock on the warm ground — real UI, real Indic text, real generated content.

---

## 4. Localized-landing strategy for Indic languages

The current split (in-app `t()` runtime i18n on `/` vs standalone hardcoded `bn/kn/ta` SEO pages) is the core problem. **Unify:**

- **One landing template, locale-driven.** The `bn/kn/ta` pages must render the *same* branded landing (nav, saffron stage, pillars, footer via the shared `landing/*` components) with locale-resolved copy — not a separate gray document.
- **SEO + brand together.** Keep the JSON-LD, hreflang, and keyword-rich body the SEO pages provide, but inside the branded shell. Add `alternates.languages` to `/` so the canonical landing declares all 11 variants.
- **Native numerals & script QA.** Ensure Indic numerals and line-height are correct per script (Bengali/Tamil ascenders differ); QA every hero in every language ("what breaks in Hindi?" — and in Tamil, which runs longest).
- **Never Hindi-only.** The language switcher must surface all 11; localized hero copy leads, English is the alternate — not the reverse.

---

## 5. Conversion & trust improvements

- **Show generated output above the fold-2** (activate `SampleOutputSection`) — strongest single trust device, already built.
- **Attribute every number.** "6 hrs/week — measured across 150 Karnataka teachers, Q4 2025" beats a bare stat.
- **Testimonial density:** 2–3 real quotes with name, school, photo — teacher *and* principal.
- **Privacy/security line** in the footer and proof band (data-in-India, student-data handling) — decision-makers screen for this.
- **Sticky mobile CTA bar** (`Start free` / `Book demo`) — most Indian teachers arrive on Android.
- **Demo-booking friction:** keep WhatsApp deep-link primary for schools (already in `for-schools`); it converts far better than Calendly for this audience.
- **Single primary CTA per section**; the black `Start free` nav button and saffron hero button currently compete — unify to saffron.

---

## 6. Quick-wins vs big-bets

**Quick-wins (days):**
- Render orphaned `SampleOutputSection` on `/` (product proof, zero new design).
- Stop dimming inactive pillars to 0.55 — keep them legible; rotate only the accent.
- Promote the `for-schools` dashboard-preview + principal quote onto the home page.
- Add closing CTA band + audience-fork cards to `/`.
- Add `alternates.languages` + OG metadata to `/`.
- Add a privacy/security line + attribute the stats to the pilot.
- Sticky mobile CTA bar.

**Big-bets (weeks):**
- **Rebrand `bn/kn/ta` onto the shared landing shell** — biggest credibility fix.
- **Commission the illustration set** — biggest "not-generic" lever.
- **Real product screenshots** in device mocks across the product section.
- Introduce the cool institutional secondary + serif hero line; roll a light design-token pass across all marketing pages.
- Testimonial/logo-wall infrastructure (data-driven, not hardcoded) so proof scales as pilots grow.
