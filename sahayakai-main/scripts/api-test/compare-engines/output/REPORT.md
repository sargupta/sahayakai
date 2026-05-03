# Genkit (main) vs Sidecar (ADK) — comparative analysis across 11 languages

Generated: 2026-05-03T03:44:39.810Z
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
| en (English) | OK 2356ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| hi (Hindi) | OK 1203ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| bn (Bengali) | OK 15946ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| te (Telugu) | OK 19894ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| mr (Marathi) | OK 15945ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| ta (Tamil) | OK 17315ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| gu (Gujarati) | OK 22805ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| pa (Punjabi) | OK 17399ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| ml (Malayalam) | OK 16488ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| or (Odia) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| kn (Kannada) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |

(no pair scored — both engines must succeed for the same row to compute metrics)

## instant-answer

| Lang | Genkit | Sidecar | Cosine | LangMatch G/S | Shape | LenRatio | Δ ms (sidecar - genkit) |
|------|--------|---------|--------|----------------|-------|----------|--------------------------|
| en (English) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| hi (Hindi) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| bn (Bengali) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| te (Telugu) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| mr (Marathi) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| ta (Tamil) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| gu (Gujarati) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| pa (Punjabi) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| ml (Malayalam) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| or (Odia) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| kn (Kannada) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |

(no pair scored — both engines must succeed for the same row to compute metrics)

## parent-message

| Lang | Genkit | Sidecar | Cosine | LangMatch G/S | Shape | LenRatio | Δ ms (sidecar - genkit) |
|------|--------|---------|--------|----------------|-------|----------|--------------------------|
| en (English) | OK 5138ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| hi (Hindi) | OK 7326ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| bn (Bengali) | OK 6984ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| te (Telugu) | OK 7851ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| mr (Marathi) | OK 7082ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| ta (Tamil) | OK 7381ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| gu (Gujarati) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| pa (Punjabi) | OK 7865ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| ml (Malayalam) | OK 7758ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| or (Odia) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| kn (Kannada) | OK 3461ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |

(no pair scored — both engines must succeed for the same row to compute metrics)

## rubric

| Lang | Genkit | Sidecar | Cosine | LangMatch G/S | Shape | LenRatio | Δ ms (sidecar - genkit) |
|------|--------|---------|--------|----------------|-------|----------|--------------------------|
| en (English) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| hi (Hindi) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| bn (Bengali) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| te (Telugu) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| mr (Marathi) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| ta (Tamil) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| gu (Gujarati) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| pa (Punjabi) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| ml (Malayalam) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| or (Odia) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| kn (Kannada) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |

(no pair scored — both engines must succeed for the same row to compute metrics)

## teacher-training

| Lang | Genkit | Sidecar | Cosine | LangMatch G/S | Shape | LenRatio | Δ ms (sidecar - genkit) |
|------|--------|---------|--------|----------------|-------|----------|--------------------------|
| en (English) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| hi (Hindi) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| bn (Bengali) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| te (Telugu) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| mr (Marathi) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| ta (Tamil) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| gu (Gujarati) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| pa (Punjabi) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| ml (Malayalam) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| or (Odia) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| kn (Kannada) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |

(no pair scored — both engines must succeed for the same row to compute metrics)

## virtual-field-trip

| Lang | Genkit | Sidecar | Cosine | LangMatch G/S | Shape | LenRatio | Δ ms (sidecar - genkit) |
|------|--------|---------|--------|----------------|-------|----------|--------------------------|
| en (English) | OK 14312ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| hi (Hindi) | OK 13224ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| bn (Bengali) | OK 11492ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| te (Telugu) | OK 11502ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| mr (Marathi) | OK 13299ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| ta (Tamil) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| gu (Gujarati) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| pa (Punjabi) | OK 14276ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| ml (Malayalam) | OK 13255ms | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| or (Odia) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| kn (Kannada) | FAIL 500 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |

(no pair scored — both engines must succeed for the same row to compute metrics)

## worksheet

| Lang | Genkit | Sidecar | Cosine | LangMatch G/S | Shape | LenRatio | Δ ms (sidecar - genkit) |
|------|--------|---------|--------|----------------|-------|----------|--------------------------|
| en (English) | FAIL 400 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| hi (Hindi) | FAIL 400 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| bn (Bengali) | FAIL 400 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| te (Telugu) | FAIL 400 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| mr (Marathi) | FAIL 400 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| ta (Tamil) | FAIL 400 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| gu (Gujarati) | FAIL 400 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| pa (Punjabi) | FAIL 400 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| ml (Malayalam) | FAIL 400 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| or (Odia) | FAIL 400 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |
| kn (Kannada) | FAIL 400 | FAIL 422 | n/a | n/a | n/a | n/a | n/a |

(no pair scored — both engines must succeed for the same row to compute metrics)

## Cross-flow summary

| Flow | Pairs scored | Mean cosine | Mean lang-match (S) | Mean shape | Mean Δ ms |
|------|--------------|-------------|---------------------|------------|-----------|
| lesson-plan | 0 | n/a | n/a | n/a | n/a |
| instant-answer | 0 | n/a | n/a | n/a | n/a |
| parent-message | 0 | n/a | n/a | n/a | n/a |
| rubric | 0 | n/a | n/a | n/a | n/a |
| teacher-training | 0 | n/a | n/a | n/a | n/a |
| virtual-field-trip | 0 | n/a | n/a | n/a | n/a |
| worksheet | 0 | n/a | n/a | n/a | n/a |

## Failures

| Flow | Lang | Genkit | Sidecar |
|------|------|--------|---------|
| lesson-plan | en | OK | 422  |
| lesson-plan | hi | OK | 422  |
| lesson-plan | bn | OK | 422  |
| lesson-plan | te | OK | 422  |
| lesson-plan | mr | OK | 422  |
| lesson-plan | ta | OK | 422  |
| lesson-plan | gu | OK | 422  |
| lesson-plan | pa | OK | 422  |
| lesson-plan | ml | OK | 422  |
| lesson-plan | or | 500  | 422  |
| lesson-plan | kn | 500  | 422  |
| instant-answer | en | 500  | 422  |
| instant-answer | hi | 500  | 422  |
| instant-answer | bn | 500  | 422  |
| instant-answer | te | 500  | 422  |
| instant-answer | mr | 500  | 422  |
| instant-answer | ta | 500  | 422  |
| instant-answer | gu | 500  | 422  |
| instant-answer | pa | 500  | 422  |
| instant-answer | ml | 500  | 422  |
| instant-answer | or | 500  | 422  |
| instant-answer | kn | 500  | 422  |
| parent-message | en | OK | 422  |
| parent-message | hi | OK | 422  |
| parent-message | bn | OK | 422  |
| parent-message | te | OK | 422  |
| parent-message | mr | OK | 422  |
| parent-message | ta | OK | 422  |
| parent-message | gu | 500  | 422  |
| parent-message | pa | OK | 422  |
| parent-message | ml | OK | 422  |
| parent-message | or | 500  | 422  |
| parent-message | kn | OK | 422  |
| rubric | en | 500  | 422  |
| rubric | hi | 500  | 422  |
| rubric | bn | 500  | 422  |
| rubric | te | 500  | 422  |
| rubric | mr | 500  | 422  |
| rubric | ta | 500  | 422  |
| rubric | gu | 500  | 422  |
| rubric | pa | 500  | 422  |
| rubric | ml | 500  | 422  |
| rubric | or | 500  | 422  |
| rubric | kn | 500  | 422  |
| teacher-training | en | 500  | 422  |
| teacher-training | hi | 500  | 422  |
| teacher-training | bn | 500  | 422  |
| teacher-training | te | 500  | 422  |
| teacher-training | mr | 500  | 422  |
| teacher-training | ta | 500  | 422  |
| teacher-training | gu | 500  | 422  |
| teacher-training | pa | 500  | 422  |
| teacher-training | ml | 500  | 422  |
| teacher-training | or | 500  | 422  |
| teacher-training | kn | 500  | 422  |
| virtual-field-trip | en | OK | 422  |
| virtual-field-trip | hi | OK | 422  |
| virtual-field-trip | bn | OK | 422  |
| virtual-field-trip | te | OK | 422  |
| virtual-field-trip | mr | OK | 422  |
| virtual-field-trip | ta | 500  | 422  |
| virtual-field-trip | gu | 500  | 422  |
| virtual-field-trip | pa | OK | 422  |
| virtual-field-trip | ml | OK | 422  |
| virtual-field-trip | or | 500  | 422  |
| virtual-field-trip | kn | 500  | 422  |
| worksheet | en | 400  | 422  |
| worksheet | hi | 400  | 422  |
| worksheet | bn | 400  | 422  |
| worksheet | te | 400  | 422  |
| worksheet | mr | 400  | 422  |
| worksheet | ta | 400  | 422  |
| worksheet | gu | 400  | 422  |
| worksheet | pa | 400  | 422  |
| worksheet | ml | 400  | 422  |
| worksheet | or | 400  | 422  |
| worksheet | kn | 400  | 422  |