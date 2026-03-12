# Selector Components

Shared form input components used across all AI tool pages.

---

## LanguageSelector

**File:** `src/components/language-selector.tsx`

**Props:** `{ value: Language, onChange: (lang: Language) => void, disabled?: boolean }`

**Languages:** English, Hindi, Kannada, Tamil, Telugu, Marathi, Bengali, Gujarati, Punjabi, Malayalam, Odia

**Rendered as:** Shadcn `Select` dropdown. Shows language name in its own script (e.g., "हिन्दी", "বাংলা") alongside English name.

**Default:** Reads from `useLanguage()` context if no value prop — initializes to user's preferred language.

---

## GradeLevelSelector

**File:** `src/components/grade-level-selector.tsx`

**Props:** `{ value: GradeLevel | GradeLevel[], onChange, multiple?: boolean, disabled?: boolean }`

**Grades:** Nursery, LKG, UKG, Class 1–12

**Modes:**
- Single select (default): standard `Select` dropdown
- Multi-select: checkbox popover showing all grades

**Translations:** Grade labels translated for each of the 11 supported languages. E.g., "Class 5" → "कक्षा 5" (Hindi) → "ক্লাস 5" (Bengali).

---

## SubjectSelector

**File:** `src/components/subject-selector.tsx`

**Props:** `{ value: Subject | Subject[], onChange, multiple?: boolean, disabled?: boolean }`

**Subjects:** Mathematics, Science, Social Science, History, Geography, Civics, English, Hindi, Sanskrit, Kannada, Computer Science, EVS

**Modes:**
- Single select: `Select` dropdown
- Multi-select: checkbox popover

**Translations:** Subject names translated for all 11 languages.

---

## DifficultySelector

**File:** `src/components/difficulty-selector.tsx`

**Props:** `{ value: 'remedial' | 'standard' | 'advanced', onChange, disabled?: boolean }`

**Options:** Remedial (SignalLow icon), Standard (Signal icon), Advanced (SignalHigh icon)

**Rendered as:** 3-button toggle row. Active button: orange-500. Inactive: outline.

---

## NCERTChapterSelector

**File:** `src/components/ncert-chapter-selector.tsx`

**Props:** `{ gradeLevel: GradeLevel, subject: Subject, value: NCERTChapter | null, onChange }`

**Behavior:**
1. On grade/subject change: calls server action to fetch NCERT chapters
2. Falls back to bundled local data if server action fails
3. Shows chapter title, learning outcomes, keywords

**Data:** Chapters stored as JSON in project (not fetched from external API). Server action may add extra metadata.

**UI:** Two-step picker:
1. Chapter list dropdown
2. After selection: shows learning outcomes + keywords as info chips

---

## Usage Pattern in AI Tool Pages

All AI tool pages use the same selector composition:

```tsx
<LanguageSelector value={language} onChange={setLanguage} />
<GradeLevelSelector value={gradeLevel} onChange={setGradeLevel} />
<SubjectSelector value={subject} onChange={setSubject} />
```

These are always in this order, always at the top of the form.
