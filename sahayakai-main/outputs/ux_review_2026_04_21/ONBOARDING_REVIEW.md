# SahayakAI — Onboarding UX Review (Hindi teacher persona)
**Date**: 2026-04-21 · **Viewport**: 375×812 · **Method**: Temporary dev-bypass on `src/app/onboarding/page.tsx` line 152 to render the flow against `dev-user-123`. Edit reverted after review.

This is the most important screen in the product. A teacher who doesn't complete onboarding never becomes a user. Here's what a Hindi-speaking teacher in a Govt school in Karnataka would experience today.

---

## Step 0 — Choose your language
**URL**: `/onboarding?step=0` (initial)

**What shows**
- Graduation-cap icon (orange)
- Heading: **"Choose your language"**
- Subheading: "SahayakAI works in your language"
- 2-column grid of 11 language tiles: English (pre-selected, orange border), हिंदी / Hindi, ಕನ್ನಡ / Kannada, தமிழ் / Tamil, తెలుగు / Telugu, मराठी / Marathi, বাংলা / Bengali, ગુજરાતી / Gujarati, ਪੰਜਾਬੀ / Punjabi, മലയാളം / Malayalam, ଓଡ଼ିଆ / Odia
- Each tile: native-script name large, English romanization below
- Per code: `onAuthStateChanged` detects browser language via `navigator.language` and pre-selects it (line 141–147). Falls back to English.

**Verdict: 8/10 — best onboarding screen in the app**

### What works
- ✅ Native script FIRST, English romanization second — correct prioritization for non-English speakers
- ✅ All 11 languages fit on one viewport with no scroll
- ✅ Large 160×80 tap targets — comfortable for low-literacy thumb-tapping
- ✅ Browser-language auto-detect is a thoughtful touch; a teacher whose phone is in Hindi lands pre-selected on Hindi
- ✅ Auto-advance 400 ms after tap (no "Continue" button needed) — reduces decision fatigue
- ✅ Heading is plain-English — even though user hasn't picked a language yet, "Choose your language" is recognizable internationally

### What's broken
- ⚠️ Odia (ଓଡ଼ିଆ) is the 11th tile — odd number breaks the 2-col grid, leaving an empty slot. Aesthetic nit.
- ⚠️ Header still shows `Toggle Sidebar` + `SahayakAI` logo + `Google Sign-in` button — why does an onboarding flow have the app chrome? Users can accidentally tap Sign-in (mid-session if they logged out) or open the sidebar before onboarding is done. **Hide header during onboarding.**
- ⚠️ No preview of what the app looks like in each language (font style, sample text). A teacher choosing Tamil doesn't know if Tamil typography is legible in-app.

---

## Step 1 — Tell us about your teaching (Hindi UI after language pick)
**URL**: `/onboarding?step=1`

### Heading area (Hindi)
- Graduation-cap icon
- Heading: **"अपने पढ़ाने के बारे में बताएँ"** (Tell us about your teaching) — well-translated
- Subheading: **"(हिंदी) Help us personalize your experience"** — 🔴 **BUG**: the Hindi label "(हिंदी)" is glued to an untranslated English sentence. Either translate the sentence or remove the language tag.

### Accordion Section 1 — "विद्यालय / संस्था का नाम & राज्य" (School/institution name & state)
- **Input**: label "विद्यालय / संस्था का नाम*" (Hindi), placeholder `e.g. Kendriya Vidyalaya, Delhi` 🔴 **BUG**: placeholder is English
- **Dropdown**: label "राज्य*" (Hindi), placeholder `Select your state` 🔴 **BUG**: placeholder is English
- State dropdown items: Andhra Pradesh, Arunachal Pradesh, Assam, Bihar, Chhattisgarh, Goa, Gujarat, Haryana, Himachal Pradesh, Karnataka... — 🔴 **BUG**: all 28+ state names are in English. A Hindi teacher expects "बिहार", "कर्नाटक", "दिल्ली".
- Auto-advance: after both filled, section collapses with summary badge `Govt High, Karnataka ✓` — nice pattern, but the summary truncates the full school name (input was `Govt High School Sarjapur`, summary says `Govt High, Karnataka`). Loses useful identifier.

### Accordion Section 2 — "शिक्षा बोर्ड" (Education Board)
- 3 buttons horizontally: `CBSE`, `ICSE / ISC`, `State Board`
- ⚠️ "State Board" is English; could be "राज्य बोर्ड"
- CBSE/ICSE are acronyms — leaving them English is correct (these are the universal names in India regardless of language)
- Auto-advance to Section 3 after tap

### Accordion Section 3 — "विषय" (Subjects) — multi-select
All subject tiles in English: Mathematics, Science, Social Science, History, Geography, Civics, English, Hindi, Sanskrit, Kannada, Computer Science, Environmental Studies (EVS), General

- 🔴 **BUG**: Every subject label English. "Mathematics" should be "गणित", "Science" = "विज्ञान", "Social Science" = "सामाजिक विज्ञान".
- ⚠️ **UI pattern bug**: renders circular radio-button affordance even though the field is MULTI-select (per `handleSubjectChange` at line 159–166). Should be checkboxes with square outline. Teacher seeing circles thinks "pick one" — may miss that they can pick multiple.
- ✅ Subject list is comprehensive for Indian context: includes Sanskrit, Kannada (regional), EVS (NCERT primary-school staple), General
- ✅ Selected tiles get orange fill + check icon — selection state IS clearly visible *after* the tap, just not before

### Accordion Section 4 — "कक्षाएँ" (Classes) — multi-select
4-column grid: Class 1, Class 2, ... Class 12. Plus a **collapsed** "Early Childhood (Nursery, LKG, UKG)" progressive-disclosure row.

- ✅ Keeping "Class 1" etc. in English here is actually correct — that's how Indian teachers talk ("Class 7 Maths" not "कक्षा 7 गणित") even in Hindi-medium schools
- ✅ Early Childhood gated behind an expand-chevron — clean default state for primary/secondary teachers who don't teach pre-school
- Same radio-looking-but-multi-select UI bug as Subjects
- ✅ Grid layout accommodates all 12 in 3 rows

### Footer buttons
- **Back**: "वापस" (dim when at step start)
- **Primary CTA**: "दिखाएँ SahayakAI क्या कर सकता है" (Show what SahayakAI can do) — orange, translates naturally. Activates when all required fields filled.

### Layout finding
- **Step 1 overflow: 432 px on 375 px viewport = +57 px** (worse than rest of app which is +19 px). Header buttons + accordion chevrons + the long Hindi labels compound the overflow. Visible clipping on "Google Sign-in" in the header.

### Verdict: 5/10
The **architecture is excellent** — accordion + auto-advance + summary badges is a strong pattern. The **execution is broken in Hindi** because only about 40 % of strings are translated. A real Hindi teacher would hit friction in 3+ places per section.

---

## Step 2 — Aha moment
**URL**: `/onboarding?step=2`

### What shows (after tapping "Show what SahayakAI can do")
- Sparkles icon
- Heading: **"ये रहा SahayakAI का बनाया सैम्पल"** (Here is a sample made by SahayakAI) — "सैम्पल" is Hinglish but fine in contemporary Hindi
- **Pre-rendered sample lesson plan title**: "पौधे भोजन कैसे बनाते हैं: प्रकाश संश्लेषण" (How plants make food: Photosynthesis)
- `LEARNING OBJECTIVES` (untranslated heading)
  - प्रकाश संश्लेषण की प्रक्रिया को सरल शब्दों में समझाना (Explain photosynthesis in simple words)
  - प्रकाश संश्लेषण के कच्चे माल और उत्पादों की पहचान करना (Identify raw materials and products)
  - एक सरल पत्ती प्रयोग करना (Do a simple leaf experiment)
- 🕐 `40 मिनट` duration
- `ACTIVITIES` (untranslated heading)
  - **Engage**: "पत्तियाँ हरी क्यों?" (Why are leaves green?) — ask kids to look at leaves in school garden, discuss — 5 मिनट
  - **Explore**: "पत्ती का प्रयोग" — cover part of a leaf with black paper for 2 days, test starch with iodine — 10 मिनट
  - **Explain**: "भोजन की फ़ैक्ट्री" (Food factory) — board equation: sunlight + water + CO₂ = glucose + O₂ — 10 मिनट
- Link: `Show all 5 activities` (untranslated)
- CTA section: "अब अपने विषय पर एक बनाएँ" (Now create one for your own topic) — input placeholder `Rational Numbers` (untranslated), `बनाएँ` (Create) button
- Footer: `वापस` (Back) / `मैं खुद देखूँगा` (I'll figure it out myself — skip) / `शुरू करें` (Get Started)

### Verdict: 9/10 — this page is genuinely excellent

### What works
- 🌟 **Pre-rendered sample is real, authentic Hindi content.** The objectives, activity titles, and descriptions all read like a Hindi-medium teacher's lesson plan — not machine-translated word salad. Someone spent time writing this.
- 🌟 **Photosynthesis + leaf experiment** is a perfect proof-of-concept topic: universal across boards, visually teachable, has a hands-on component a village school can afford (leaf + black paper + iodine).
- 🌟 **5E pedagogy structure** (Engage / Explore / Explain — only 3 shown, 2 more behind "Show all") matches what teachers learned in their D.El.Ed / B.Ed programs. Immediate trust signal.
- 🌟 **Time breakdowns** per activity (5 मिनट / 10 मिनट) model good lesson pacing.
- ✅ **Skip button** ("मैं खुद देखूँगा") — lets teachers who don't want to try a generation bail to home without feeling pushed
- ✅ Three clear footer actions let user choose: Back / Skip / Get Started

### What's broken
- 🔴 **Section headings untranslated**: `LEARNING OBJECTIVES`, `ACTIVITIES`, `Engage`, `Explore`, `Explain`, `Show all 5 activities` — all still English. Should be `सीखने के उद्देश्य`, `गतिविधियाँ`, `संलग्न`, `अन्वेषण`, `व्याख्या` — or keep 5E terms but at least localize the section headings.
- 🔴 **Input placeholder "Rational Numbers"** is English (should be "परिमेय संख्याएँ" or similar). Tiny thing, huge tell that i18n is incomplete.
- 🔴 **The "Create one on your topic" path would fail right now** due to the Gemini P0 documented elsewhere. A teacher who types a topic and taps "बनाएँ" would wait 73 seconds and see "AI generation failed. Please try again." in their first five minutes with the product. **This is the single worst funnel moment in the product today.**

---

## End-to-end onboarding verdict

**Architecture**: 8/10. Accordion + auto-advance + summary badges + skip option = modern best-practice.

**Execution in English**: 8/10. Would land well with an English-comfortable urban teacher.

**Execution in Hindi**: 5/10. Mixed-language UI erodes trust. A rural Hindi-medium govt-school teacher — the exact target audience — experiences friction on every screen. If you claim to support 11 Indic languages, either ship the actual translations or soften the marketing claim.

**Execution today (any language)**: 3/10. The aha-moment "Create one on your topic" button connects to a dead Gemini backend. The biggest wow-moment in the onboarding = the biggest disappointment.

### Top 5 fixes (in order)
1. **Restore Gemini.** Otherwise the aha-moment is a trap. (Covered in the main report P0-1.)
2. **Translate every string** that appears in the Hindi flow. Priority: state dropdown (28 values), subject names (12 values), section headings ("LEARNING OBJECTIVES" / "ACTIVITIES"), input placeholders, "(हिंदी) Help us..." subheading. Apply same to Tamil, Kannada, and the other 8 languages.
3. **Hide the app header during onboarding.** No sidebar toggle, no Sign-in button — nothing that lets the user exit the flow by accident.
4. **Fix the +57 px horizontal overflow on Step 1.** Hindi labels are longer than English — audit all break-points with long-string languages.
5. **Switch radios to checkboxes on Subjects and Classes.** Both are multi-select. Current UI implies single-choice.

### Keep doing
- The pre-rendered sample lesson plan. Don't ever let a new user wait for Gemini on their first interaction. Pre-rendered examples for top 10 topics × 11 languages × 4 boards = ~440 static LPs. Ship these as fixture JSON so the aha-moment never depends on API uptime.
- Browser-language auto-detect.
- Skip option ("I'll figure it out myself") — respects the teacher's time.
