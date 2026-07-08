# Selector Components

_Last verified against source: 2026-06-10._

Shared form input components used across AI tool pages. All live directly under `src/components/` (not a `shared/` subfolder). All are `"use client"` and resolve display labels through the global `useLanguage()` / `t()` dictionary (Wave 6 cleanup removed each component's local per-language translation maps in favour of the global dictionary with full 11-language coverage).

---

## LanguageSelector

**File:** `src/components/language-selector.tsx`

**Props:** `{ onValueChange: (value: string) => void, defaultValue?: string, value?: string }`

**Options:** an `"all"` ("All Languages") sentinel plus en, hi, bn, te, mr, ta, gu, pa, ml, or, kn. Each option label shows the native script alongside the English name (e.g. `हिंदी (Hindi)`, `বাংলা (Bengali)`).

**Rendered as:** Shadcn `Select`. Trigger styled `bg-card/50 backdrop-blur-sm`. Placeholder `t("Select a language")`.

**Default handling:** if `defaultValue` is not one of the known option values it falls back to `"all"`.

---

## GradeLevelSelector

**File:** `src/components/grade-level-selector.tsx`

**Props:** `{ onValueChange: (value: string[]) => void, value?: string[], language?: string (legacy, unused), isMulti?: boolean (default true), defaultValue?: string[] }`

**Grades:** `GRADE_KEYS` = "Class 1" … "Class 12" (English keys; labels via `t()`). No Nursery/LKG/UKG.

**Modes:**
- `isMulti === false`: a single Shadcn `Select` (value is `value[0]`).
- `isMulti` (default): a `DropdownMenu` of `DropdownMenuCheckboxItem`s (`onSelect` preventDefault to keep menu open). Trigger shows a count summary, e.g. `3 classes selected` / `1 class selected` / `Select Class(es)`.

Styling uses theme tokens (`bg-card`, `border-border`, `shadow-soft`, `text-primary`), not hardcoded colors.

---

## SubjectSelector

**File:** `src/components/subject-selector.tsx`

**Props:** `{ onValueChange: (value: string) => void, value?: string, language?: string (legacy, unused) }`

**Subjects:** iterates the `SUBJECTS` constant from `@/types` (single source of truth - do not hardcode the list here). Single-select Shadcn `Select`; labels via `t()`.

---

## DifficultySelector

**File:** `src/components/difficulty-selector.tsx`

**Props:** `{ value: DifficultyLevel, onValueChange: (value: DifficultyLevel) => void, className?: string }` where `DifficultyLevel = 'remedial' | 'standard' | 'advanced'`.

**Options (with label key + icon + color):**
- remedial - "Remedial (Support)" - `SignalLow` - `text-green-600`
- standard - "Standard (Class Level)" - `SignalMedium` - `text-blue-600`
- advanced - "Advanced (Extension)" - `SignalHigh` - `text-purple-600`

**Rendered as:** a labelled Shadcn `Select` (header row: `Signal` icon + `t("Difficulty Level")`), NOT a 3-button toggle row. Each item shows its icon + translated label.

---

## NCERTChapterSelector

**File:** `src/components/ncert-chapter-selector.tsx`

**Props:** `{ onChapterSelect: (chapter: NCERTChapter | null) => void, selectedGrade?: number, className?: string }`

**Behavior:**
1. Two-step: subject `Select` then chapter `Select`. Subject options come from a grade-aware local `getSubjectsForGrade(grade)` (e.g. Physics/Chemistry/Biology only at grade ≥ 11; Science at 6–10; EVS at 3–5; Social Studies and Sanskrit at 6–10; IT at 9–10; plus languages at all grades).
2. On subject/grade change it fetches both static (`getChaptersForGrade` from `@/data/ncert`) and server (`getNCERTChapters` server action from `@/app/actions/ncert`, Firestore-backed) chapter lists, and uses whichever has MORE chapters (Firestore may be partially seeded). On error it falls back to static data.
3. Changing `selectedGrade` resets subject/chapter selection.

**Chapter detail panel (after selection):** textbook name + edition badge ("NCF 2023" / "Rationalized"), learning outcomes list, keyword badges, and estimated periods (`Clock`). Labels via `t()`.

---

## Usage Pattern in AI Tool Pages

Selectors are composed near the top of each tool form. Exact prop names differ from the legacy doc - note `onValueChange` (not `onChange`) on the simple selectors and `onChapterSelect` / `selectedGrade` on the NCERT selector.
