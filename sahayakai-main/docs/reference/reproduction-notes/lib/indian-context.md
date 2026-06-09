# Lib: Indian Context

**File:** `src/lib/indian-context.ts`
**Verified:** 2026-06-10

---

## Purpose

Provides culturally-relevant examples, analogies, and Western to Indian substitutions injected into AI prompts so generated content resonates with Indian teachers and students.

---

## Key Exports

### `IndianContext` (const, also default export)

A nested database of Indian-specific examples grouped by domain, each with sub-arrays. Domains include:

```
food:        { common, snacks, sweets }
agriculture: { crops, seasons, tools, activities }   // kharif/rabi/zaid, plough, sickle, bullock cart...
weather:     { seasons, phenomena, temperatures }    // monsoon rains, heat wave, '45°C in summer'...
geography:   { rivers, mountains, states, cities }   // Ganga/Yamuna, Himalayas/Western Ghats...
festivals:   { major, harvest, ... }                 // Diwali, Holi, Eid, Pongal, Onam...
```

(See the file for the full set of domains and members. Values are concept strings in English, not translated text.)

### `getContextExamples(subject: string, topic: string): string[]`

Returns subject-specific example sentences keyed off an internal map.

### `exampleReplacements: Record<string, string>`

Western to Indian substitution map. Actual entries include:

```
pizza → paratha,  burger → vada pav,  sandwich → samosa,  cake → ladoo,  ice cream → kulfi
snow → monsoon rain,  winter → winter fog,  autumn → post-monsoon season
New York → Delhi,  London → Mumbai,  Paris → Jaipur,  mountain → Himalayas,  river → Ganga
dollar → rupee,  $ → ₹,  cent → paisa
football → cricket,  baseball → kabaddi
reindeer → camel,  polar bear → elephant
```

### `getIndianContextPrompt(isRural: boolean = true): string`

Returns a prompt-addition string instructing the model to use Indian names, geography, festivals, and daily life. **Default is `isRural = true`.** When rural, it emphasizes farming / village life / local market examples.

---

## Usage in AI Flows

```ts
const contextPrompt = getIndianContextPrompt();
const systemPrompt = `You are an AI assistant for Indian teachers. ${contextPrompt} ...`;
```

This steers content away from Western sports, food, currency, and geography as default references.

---

## Language Coverage

The context database is language-neutral (concepts, not translated text). The model renders these concepts in the requested output language. Related helpers: `src/lib/regional-examples.ts`, `src/lib/i18n-proper-nouns.ts`.
