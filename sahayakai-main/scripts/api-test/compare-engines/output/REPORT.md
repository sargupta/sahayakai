# Genkit (main) vs Sidecar (ADK) — comparative analysis across 11 languages

Generated: 2026-05-03T04:19:49.768Z
Next.js base: http://localhost:64643
Sidecar base: http://localhost:8081

## Methodology

- Same fixed input per flow (e.g. `topic: photosynthesis` for lesson-plan), with only `language` swapped per row.
- Genkit response = the Next.js `/api/ai/<flow>` endpoint (dispatcher in default `off` mode = Genkit code path).
- Sidecar response = the ADK FastAPI `/v1/<flow>/generate` route (direct, no dispatcher).
- Scorers: term-frequency cosine over text fields, dominant-script language match, JSON-shape Jaccard, length ratio (smaller / larger), latency delta.
- All metrics are 0..1 except latency (ms).

## lesson-plan

| Lang | Genkit | Sidecar | Cosine | LangMatch G/S | Shape | LenRatio | Δ ms (sidecar - genkit) |
|------|--------|---------|--------|----------------|-------|----------|--------------------------|
| en (English) | OK 960ms | OK 21189ms | 0.92 | 1.00 / 1.00 | 0.46 | 0.84 | 20229 |
| hi (Hindi) | OK 809ms | OK 31951ms | 0.99 | 1.62 / 1.40 | 0.46 | 0.88 | 31142 |
| bn (Bengali) | OK 964ms | OK 29009ms | 0.94 | 1.57 / 1.39 | 0.46 | 0.86 | 28045 |
| te (Telugu) | OK 915ms | OK 30160ms | 0.99 | 1.67 / 1.40 | 0.46 | 0.86 | 29245 |
| mr (Marathi) | OK 897ms | OK 26687ms | 0.98 | 1.55 / 1.47 | 0.46 | 0.93 | 25790 |
| ta (Tamil) | OK 940ms | OK 22166ms | 0.99 | 1.65 / 1.44 | 0.46 | 0.86 | 21226 |
| gu (Gujarati) | OK 929ms | OK 25370ms | 0.97 | 1.57 / 1.38 | 0.46 | 0.80 | 24441 |
| pa (Punjabi) | OK 889ms | OK 35529ms | 0.98 | 1.58 / 1.33 | 0.46 | 0.96 | 34640 |
| ml (Malayalam) | FAIL 429 | FAIL 502 | n/a | n/a | n/a | n/a | n/a |
| or (Odia) | FAIL 429 | FAIL 502 | n/a | n/a | n/a | n/a | n/a |
| kn (Kannada) | FAIL 429 | OK 26295ms | n/a | n/a | n/a | n/a | n/a |

**Aggregate** (8/11 pairs scored): cosine=0.97 | lang-match Genkit=1.53 Sidecar=1.35 | shape=0.46 | length-ratio=0.87 | mean Δ ms=26845

## instant-answer

| Lang | Genkit | Sidecar | Cosine | LangMatch G/S | Shape | LenRatio | Δ ms (sidecar - genkit) |
|------|--------|---------|--------|----------------|-------|----------|--------------------------|
| en (English) | OK 8564ms | OK 2495ms | 0.85 | 1.00 / 1.00 | 0.50 | 0.93 | -6069 |
| hi (Hindi) | OK 2936ms | OK 3407ms | 0.91 | 1.24 / 1.23 | 0.50 | 0.86 | 471 |
| bn (Bengali) | OK 2627ms | OK 3983ms | 0.79 | 1.22 / 1.06 | 0.50 | 0.49 | 1356 |
| te (Telugu) | FAIL 500 | OK 3765ms | n/a | n/a | n/a | n/a | n/a |
| mr (Marathi) | FAIL 500 | OK 3318ms | n/a | n/a | n/a | n/a | n/a |
| ta (Tamil) | FAIL 500 | OK 3763ms | n/a | n/a | n/a | n/a | n/a |
| gu (Gujarati) | FAIL 500 | OK 3694ms | n/a | n/a | n/a | n/a | n/a |
| pa (Punjabi) | FAIL 500 | OK 5277ms | n/a | n/a | n/a | n/a | n/a |
| ml (Malayalam) | FAIL 500 | OK 3496ms | n/a | n/a | n/a | n/a | n/a |
| or (Odia) | FAIL 500 | OK 8844ms | n/a | n/a | n/a | n/a | n/a |
| kn (Kannada) | OK 3794ms | OK 2689ms | 0.91 | 1.05 / 1.18 | 0.50 | 0.94 | -1105 |

**Aggregate** (4/11 pairs scored): cosine=0.87 | lang-match Genkit=1.13 Sidecar=1.12 | shape=0.50 | length-ratio=0.81 | mean Δ ms=-1337

## parent-message

| Lang | Genkit | Sidecar | Cosine | LangMatch G/S | Shape | LenRatio | Δ ms (sidecar - genkit) |
|------|--------|---------|--------|----------------|-------|----------|--------------------------|
| en (English) | OK 7080ms | FAIL 502 | n/a | n/a | n/a | n/a | n/a |
| hi (Hindi) | OK 5985ms | OK 7195ms | 0.96 | 1.58 / 1.46 | 0.50 | 0.87 | 1210 |
| bn (Bengali) | OK 6326ms | OK 6443ms | 0.92 | 1.51 / 1.44 | 0.50 | 0.89 | 117 |
| te (Telugu) | OK 14618ms | OK 6273ms | 0.94 | 1.73 / 1.58 | 0.50 | 0.71 | -8345 |
| mr (Marathi) | OK 4890ms | OK 7819ms | 0.89 | 1.59 / 1.41 | 0.50 | 0.94 | 2929 |
| ta (Tamil) | OK 6518ms | OK 5175ms | 0.95 | 1.68 / 1.51 | 0.50 | 0.74 | -1343 |
| gu (Gujarati) | OK 5411ms | OK 7913ms | 0.91 | 1.61 / 1.48 | 0.50 | 0.99 | 2502 |
| pa (Punjabi) | OK 8251ms | OK 7654ms | 0.97 | 1.67 / 1.49 | 0.50 | 0.99 | -597 |
| ml (Malayalam) | OK 6375ms | OK 6255ms | 0.90 | 1.69 / 1.54 | 0.50 | 0.97 | -120 |
| or (Odia) | OK 8805ms | OK 7519ms | 0.93 | 1.56 / 1.39 | 0.50 | 0.77 | -1286 |
| kn (Kannada) | OK 6194ms | OK 7009ms | 0.92 | 1.66 / 1.49 | 0.50 | 0.95 | 815 |

**Aggregate** (10/11 pairs scored): cosine=0.93 | lang-match Genkit=1.63 Sidecar=1.48 | shape=0.50 | length-ratio=0.88 | mean Δ ms=-412

## rubric

| Lang | Genkit | Sidecar | Cosine | LangMatch G/S | Shape | LenRatio | Δ ms (sidecar - genkit) |
|------|--------|---------|--------|----------------|-------|----------|--------------------------|
| en (English) | OK 15733ms | OK 9928ms | 0.84 | 1.00 / 1.00 | 0.79 | 0.85 | -5805 |
| hi (Hindi) | OK 12985ms | OK 11863ms | 0.97 | 1.64 / 1.58 | 0.79 | 0.74 | -1122 |
| bn (Bengali) | FAIL 500 | OK 12825ms | n/a | n/a | n/a | n/a | n/a |
| te (Telugu) | FAIL 500 | OK 19966ms | n/a | n/a | n/a | n/a | n/a |
| mr (Marathi) | FAIL 500 | OK 15541ms | n/a | n/a | n/a | n/a | n/a |
| ta (Tamil) | FAIL 500 | OK 15545ms | n/a | n/a | n/a | n/a | n/a |
| gu (Gujarati) | FAIL 500 | OK 14685ms | n/a | n/a | n/a | n/a | n/a |
| pa (Punjabi) | OK 19853ms | OK 18241ms | 0.95 | 1.62 / 1.41 | 0.79 | 0.83 | -1612 |
| ml (Malayalam) | FAIL 500 | OK 12387ms | n/a | n/a | n/a | n/a | n/a |
| or (Odia) | OK 19751ms | FAIL 502 | n/a | n/a | n/a | n/a | n/a |
| kn (Kannada) | FAIL 500 | OK 14542ms | n/a | n/a | n/a | n/a | n/a |

**Aggregate** (3/11 pairs scored): cosine=0.92 | lang-match Genkit=1.42 Sidecar=1.33 | shape=0.79 | length-ratio=0.81 | mean Δ ms=-2846

## teacher-training

| Lang | Genkit | Sidecar | Cosine | LangMatch G/S | Shape | LenRatio | Δ ms (sidecar - genkit) |
|------|--------|---------|--------|----------------|-------|----------|--------------------------|
| en (English) | FAIL 500 | OK 9264ms | n/a | n/a | n/a | n/a | n/a |
| hi (Hindi) | FAIL 500 | OK 17444ms | n/a | n/a | n/a | n/a | n/a |
| bn (Bengali) | FAIL 500 | OK 14097ms | n/a | n/a | n/a | n/a | n/a |
| te (Telugu) | FAIL 500 | OK 16991ms | n/a | n/a | n/a | n/a | n/a |
| mr (Marathi) | FAIL 500 | OK 12996ms | n/a | n/a | n/a | n/a | n/a |
| ta (Tamil) | FAIL 500 | OK 16462ms | n/a | n/a | n/a | n/a | n/a |
| gu (Gujarati) | FAIL 500 | OK 11985ms | n/a | n/a | n/a | n/a | n/a |
| pa (Punjabi) | FAIL 500 | OK 16841ms | n/a | n/a | n/a | n/a | n/a |
| ml (Malayalam) | FAIL 500 | OK 13730ms | n/a | n/a | n/a | n/a | n/a |
| or (Odia) | FAIL 500 | OK 19919ms | n/a | n/a | n/a | n/a | n/a |
| kn (Kannada) | FAIL 500 | OK 12062ms | n/a | n/a | n/a | n/a | n/a |

(no pair scored — both engines must succeed for the same row to compute metrics)

## virtual-field-trip

| Lang | Genkit | Sidecar | Cosine | LangMatch G/S | Shape | LenRatio | Δ ms (sidecar - genkit) |
|------|--------|---------|--------|----------------|-------|----------|--------------------------|
| en (English) | FAIL 500 | OK 16913ms | n/a | n/a | n/a | n/a | n/a |
| hi (Hindi) | FAIL 500 | OK 18269ms | n/a | n/a | n/a | n/a | n/a |
| bn (Bengali) | FAIL 500 | FAIL 502 | n/a | n/a | n/a | n/a | n/a |
| te (Telugu) | FAIL 500 | FAIL 502 | n/a | n/a | n/a | n/a | n/a |
| mr (Marathi) | FAIL 500 | OK 17197ms | n/a | n/a | n/a | n/a | n/a |
| ta (Tamil) | FAIL 500 | OK 19366ms | n/a | n/a | n/a | n/a | n/a |
| gu (Gujarati) | FAIL 500 | FAIL 502 | n/a | n/a | n/a | n/a | n/a |
| pa (Punjabi) | FAIL 500 | FAIL 502 | n/a | n/a | n/a | n/a | n/a |
| ml (Malayalam) | FAIL 500 | FAIL 502 | n/a | n/a | n/a | n/a | n/a |
| or (Odia) | FAIL 500 | FAIL 502 | n/a | n/a | n/a | n/a | n/a |
| kn (Kannada) | FAIL 500 | FAIL 502 | n/a | n/a | n/a | n/a | n/a |

(no pair scored — both engines must succeed for the same row to compute metrics)

## worksheet

| Lang | Genkit | Sidecar | Cosine | LangMatch G/S | Shape | LenRatio | Δ ms (sidecar - genkit) |
|------|--------|---------|--------|----------------|-------|----------|--------------------------|
| en (English) | FAIL 400 | OK 12575ms | n/a | n/a | n/a | n/a | n/a |
| hi (Hindi) | FAIL 400 | OK 14468ms | n/a | n/a | n/a | n/a | n/a |
| bn (Bengali) | FAIL 400 | OK 10925ms | n/a | n/a | n/a | n/a | n/a |
| te (Telugu) | FAIL 400 | OK 10351ms | n/a | n/a | n/a | n/a | n/a |
| mr (Marathi) | FAIL 400 | OK 12961ms | n/a | n/a | n/a | n/a | n/a |
| ta (Tamil) | FAIL 400 | OK 12761ms | n/a | n/a | n/a | n/a | n/a |
| gu (Gujarati) | FAIL 400 | OK 16101ms | n/a | n/a | n/a | n/a | n/a |
| pa (Punjabi) | FAIL 400 | OK 15601ms | n/a | n/a | n/a | n/a | n/a |
| ml (Malayalam) | FAIL 400 | OK 14496ms | n/a | n/a | n/a | n/a | n/a |
| or (Odia) | FAIL 400 | FAIL 502 | n/a | n/a | n/a | n/a | n/a |
| kn (Kannada) | FAIL 400 | OK 14063ms | n/a | n/a | n/a | n/a | n/a |

(no pair scored — both engines must succeed for the same row to compute metrics)

## Cross-flow summary

| Flow | Pairs scored | Mean cosine | Mean lang-match (S) | Mean shape | Mean Δ ms |
|------|--------------|-------------|---------------------|------------|-----------|
| lesson-plan | 8 | 0.97 | 1.35 | 0.46 | 26845 |
| instant-answer | 4 | 0.87 | 1.12 | 0.50 | -1337 |
| parent-message | 10 | 0.93 | 1.48 | 0.50 | -412 |
| rubric | 3 | 0.92 | 1.33 | 0.79 | -2846 |
| teacher-training | 0 | n/a | n/a | n/a | n/a |
| virtual-field-trip | 0 | n/a | n/a | n/a | n/a |
| worksheet | 0 | n/a | n/a | n/a | n/a |

## Failures

| Flow | Lang | Genkit | Sidecar |
|------|------|--------|---------|
| lesson-plan | ml | 429  | 502  |
| lesson-plan | or | 429  | 502  |
| lesson-plan | kn | 429  | OK |
| instant-answer | te | 500  | OK |
| instant-answer | mr | 500  | OK |
| instant-answer | ta | 500  | OK |
| instant-answer | gu | 500  | OK |
| instant-answer | pa | 500  | OK |
| instant-answer | ml | 500  | OK |
| instant-answer | or | 500  | OK |
| parent-message | en | OK | 502  |
| rubric | bn | 500  | OK |
| rubric | te | 500  | OK |
| rubric | mr | 500  | OK |
| rubric | ta | 500  | OK |
| rubric | gu | 500  | OK |
| rubric | ml | 500  | OK |
| rubric | or | OK | 502  |
| rubric | kn | 500  | OK |
| teacher-training | en | 500  | OK |
| teacher-training | hi | 500  | OK |
| teacher-training | bn | 500  | OK |
| teacher-training | te | 500  | OK |
| teacher-training | mr | 500  | OK |
| teacher-training | ta | 500  | OK |
| teacher-training | gu | 500  | OK |
| teacher-training | pa | 500  | OK |
| teacher-training | ml | 500  | OK |
| teacher-training | or | 500  | OK |
| teacher-training | kn | 500  | OK |
| virtual-field-trip | en | 500  | OK |
| virtual-field-trip | hi | 500  | OK |
| virtual-field-trip | bn | 500  | 502  |
| virtual-field-trip | te | 500  | 502  |
| virtual-field-trip | mr | 500  | OK |
| virtual-field-trip | ta | 500  | OK |
| virtual-field-trip | gu | 500  | 502  |
| virtual-field-trip | pa | 500  | 502  |
| virtual-field-trip | ml | 500  | 502  |
| virtual-field-trip | or | 500  | 502  |
| virtual-field-trip | kn | 500  | 502  |
| worksheet | en | 400  | OK |
| worksheet | hi | 400  | OK |
| worksheet | bn | 400  | OK |
| worksheet | te | 400  | OK |
| worksheet | mr | 400  | OK |
| worksheet | ta | 400  | OK |
| worksheet | gu | 400  | OK |
| worksheet | pa | 400  | OK |
| worksheet | ml | 400  | OK |
| worksheet | or | 400  | 502  |
| worksheet | kn | 400  | OK |