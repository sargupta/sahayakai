# Lib: Indian Context

**File:** `src/lib/indian-context.ts`

---

## Purpose

Provides culturally-relevant examples, analogies, and replacements that are injected into AI prompts to ensure generated content resonates with Indian teachers and students — particularly those in rural areas.

---

## Key Exports

### IndianContext Object

A categorized database of Indian-specific examples:

```
food:        paratha, dal, roti, sambar, idli, khichdi
agriculture: wheat harvest at ₹25/kg, paddy cultivation, Kharif/Rabi seasons
weather:     monsoon (June-September), summer 40°C, winter fog in North India
geography:   Ganga-Yamuna plains, Western Ghats, Deccan plateau, Thar Desert
festivals:   Diwali, Eid, Christmas, Pongal, Onam, Bihu, Navratri
animals:     cow, buffalo, sparrow, crow, peacock (national bird), tiger
currency:    rupee (₹), paisa, lakh, crore
measurements: bigha (land), maund (weight), hand-span
daily life:  auto-rickshaw, cycle, village panchayat, anganwadi
transport:   state bus, cycle, bullock cart, train
heroes:      Dr. Ambedkar, Aryabhata, APJ Abdul Kalam, Savitribai Phule
school:      blackboard, chalk, slate, government textbook
```

### getContextExamples(subject, topic)

Returns subject-specific example sentences:
```
Mathematics + fractions → "If a farmer has 3/4 bigha of land..."
Science + motion → "A bullock cart moves at 4 km/h..."
Social Science + trade → "In a weekly haat (market)..."
```

### exampleReplacements

Western → Indian substitution map:
```
pizza → paratha
snow → monsoon rain
dollar → rupee
celsius [negative] → "40 degree summer heat"
football → cricket
apple pie → mithai
```

### getIndianContextPrompt(isRural?: boolean)

Returns a prompt addition string:
```
"Use Indian examples and context. Use Indian names (Priya, Raju, Geeta).
Reference Indian geography, festivals, and daily life.
[if isRural]: Use examples relevant to rural India — farming, village life, local markets."
```

---

## Usage in AI Flows

```ts
// In every AI flow prompt:
const contextPrompt = getIndianContextPrompt();
const systemPrompt = `You are an AI assistant for Indian teachers. ${contextPrompt}
Generate a lesson plan for...`;
```

This ensures generated content never contains:
- Western sports (football, baseball) as primary examples
- Western food (pizza, burgers)
- Western currency
- Non-Indian geography as default reference

---

## Language Coverage

Context database is language-neutral (examples are concepts, not translated text). The AI model is responsible for rendering these concepts in the requested output language.
