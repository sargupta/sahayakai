# Virtual Field Trip — /virtual-field-trip

**File:** `src/app/virtual-field-trip/page.tsx`
**Auth:** Required

---

## Purpose

Plan virtual field trips using Google Earth. AI generates an itinerary of stops with Google Earth URLs, cultural analogies (Bharat-first perspective), educational facts, and reflection prompts for each stop.

---

## Component Tree

```
VirtualFieldTripPage
├── Header (title + description)
├── Form
│   ├── LanguageSelector
│   ├── GradeLevelSelector
│   ├── SubjectSelector
│   ├── Destination/topic input + MicrophoneInput (voice input supported)
│   ├── Number of stops selector (3, 4, 5)
│   └── Generate Trip button
└── VirtualFieldTripDisplay (when result available)
    ├── Trip overview header
    ├── Stop cards (numbered)
    │   ├── Stop name
    │   ├── Google Earth button (opens earth.google.com URL)
    │   ├── Description
    │   ├── Cultural analogy (Indian context)
    │   ├── Educational facts list
    │   └── Reflection prompt
    ├── Overall theme section
    ├── Save / PDF buttons
    └── FeedbackDialog
```

---

## State

| State | Type | Purpose |
|---|---|---|
| `destination` | `string` | Trip topic/place |
| `gradeLevel` | `GradeLevel` | Target grade |
| `subject` | `Subject` | Subject context |
| `language` | `Language` | Output language |
| `stopCount` | `number` | Number of stops (3–5) |
| `result` | `VFTSchema \| null` | Generated itinerary |
| `loading` | `boolean` | In flight |

---

## AI Integration

- **Flow:** `src/ai/flows/virtual-field-trip.ts`
- **Model:** Gemini via Genkit
- **Validation:** `src/ai/flows/virtual-field-trip-validation.ts` (schema validation layer)
- **Google Earth URLs:** AI generates real Google Earth 3D viewer URLs for each stop
- **Cultural grounding:** Bharat-first analogies (e.g., Amazon rainforest → like Western Ghats but larger)
- **Output:** `{ destination, stops: [{ name, googleEarthUrl, description, culturalAnalogy, educationalFacts, reflectionPrompt }], overallTheme }`

---

## Voice Input

- `MicrophoneInput` on destination field — teachers can speak the destination name

---

## VirtualFieldTripDisplay

- Numbered stop cards with left-side step indicator
- Google Earth button: opens `earth.google.com/web/@lat,lng,alt` — no embedding (CSP blocks iframes from Google Earth)
- Cultural analogy: italicized, orange accent
- Facts: bulleted list
- Reflection prompt: highlighted callout box

---

## Design

- Stop cards: white, rounded-2xl, shadow-sm, numbered badge (orange circle)
- Google Earth button: globe icon (`Globe2`) + "Open in Google Earth" text
- Print layout: all stops visible, Google Earth URLs shown as clickable links
