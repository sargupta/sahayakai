# AI Flows: Remaining

---

## Rubric Generator

**File:** `src/ai/flows/rubric-generator.ts`
**Route:** `POST /api/ai/rubric`

**Input:** `{ task, gradeLevel, subject, language, criteriaCount: 3|4|5|6 }`

**Output:**
```ts
{
  title: string;
  criteria: {
    name: string;
    levels: {
      exemplary: string;
      proficient: string;
      developing: string;
      beginning: string;
    }
  }[]
}
```

**Key:** Prompt strictly enforces 4-level structure. Level names are translated to output language. Criteria names are subject-appropriate (e.g., for Math: "Accuracy", "Problem Setup", "Working Shown", "Interpretation").

---

## Teacher Training

**File:** `src/ai/flows/teacher-training.ts`
**Route:** `POST /api/ai/teacher-training`

**Input:** `{ challenge, gradeLevel, subject, language }`

**Output:**
```ts
{
  strategies: { title: string, description: string, steps: string[] }[];
  pedagogyNote: string;        // references a pedagogy framework
  resourceLinks?: string[];    // optional further reading
}
```

**Key:** Prompt grounds responses in:
- Bloom's Taxonomy
- Vygotsky's Zone of Proximal Development
- Differentiated instruction principles
- Indian classroom realities (large classes, resource constraints)

---

## Video Storyteller

**File:** `src/ai/flows/video-storyteller.ts`
**Route:** `POST /api/ai/video-storyteller`

**Input:** `{ language, category }`

**Architecture (no LLM for main curation):**
1. Local scoring: pre-curated YouTube channels ranked by pedagogical value + topic relevance
2. RSS parsing: fetch recent uploads from top-ranked channels
3. YouTube API fallback: if RSS fails
4. In-memory cache: prevent repeated fetches within session

**Output:** `{ videos: { title, channelName, videoId, thumbnailUrl, duration, category }[] }`

**Key cost decision:** No Gemini call for video selection — local ranking algorithm eliminates AI cost for this feature entirely.

---

## Virtual Field Trip

**File:** `src/ai/flows/virtual-field-trip.ts`
**Validation:** `src/ai/flows/virtual-field-trip-validation.ts`
**Route:** `POST /api/ai/virtual-field-trip`

**Input:** `{ destination, gradeLevel, subject, language, stopCount: 3|4|5 }`

**Output:**
```ts
{
  destination: string;
  stops: {
    name: string;
    googleEarthUrl: string;    // real earth.google.com URL
    description: string;
    culturalAnalogy: string;   // Indian-context comparison
    educationalFacts: string[];
    reflectionPrompt: string;
  }[];
  overallTheme: string;
}
```

**Validation layer:** Checks that Google Earth URLs are valid format. Falls back to generic earth.google.com if AI generates invalid URLs.

**Bharat-first:** Prompt explicitly instructs: "When possible, draw analogies to Indian geography, history, culture. E.g., Amazon = like Western Ghats + Brahmaputra but much larger."

---

## Visual Aid Designer

**File:** `src/ai/flows/visual-aid-designer.ts`
**Route:** `POST /api/ai/visual-aid`

**Input:** `{ topic, gradeLevel, subject, language }`

**Processing:**
1. Build image generation prompt with pedagogical context
2. Call Gemini 3 Pro Image Preview (image generation model)
3. Save generated image to Firebase Storage
4. Generate pedagogical context + discussion spark (separate text generation call)

**Output:**
```ts
{
  imageUrl: string;            // Firebase Storage URL
  pedagogicalContext: string;
  discussionSpark: string;
  altText: string;
}
```

**Cost:** $0.04 per image — most expensive feature.

---

## Voice to Text

**File:** `src/ai/flows/voice-to-text.ts`
**Route:** `POST /api/ai/voice-to-text`

**Input:** FormData with `audio` file (webm or mp4)

**Processing:**
1. Receive audio blob
2. Send to Gemini multimodal API as audio input
3. Prompt: "Transcribe this audio. The speaker may use Hindi, English, or any Indian language. Return only the transcript."

**Output:** `{ transcript: string }`

**Used by:** MicrophoneInput (fallback path), OmniOrb voice recording

---

## Worksheet Wizard

**File:** `src/ai/flows/worksheet-wizard.ts`
**Validation:** `src/ai/flows/worksheet-validation.ts`
**Route:** `POST /api/ai/worksheet`

**Input:** `{ topic, gradeLevel, subject, language, imageUrl?: string }`

**Processing:**
1. If imageUrl: multimodal Gemini call (image + text prompt)
2. If no image: text-only Gemini call
3. Generate worksheet in Markdown with optional LaTeX math

**Output:**
```ts
{
  title: string;
  instructions?: string;
  content: string;             // Markdown, may contain $LaTeX$ expressions
}
```

**Validation:** Checks that LaTeX syntax is valid before returning. Falls back to plain text math if validation fails.
