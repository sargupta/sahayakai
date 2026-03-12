# SahayakAI Video Storyteller — Content Recommendation Algorithm

**Abhishek Gupta**¹

¹SARGVISION Agentic Intelligence Lab

---

## Abstract

We present the **SahayakAI Video Recommendation Algorithm (SVRA)**, a multi-signal, deterministic content-ranking system designed to surface pedagogically appropriate YouTube content for Indian primary and secondary school teachers. The system operates across five output categories — Pedagogy, Storytelling, Government Updates, Teacher Training Courses, and Top Recommended — using a composite authority-language-context scoring model combined with quota-based distribution. The algorithm is designed to address three failures that arise when applying general-purpose recommendation engines to the Indian school teacher context: (1) conflation of teacher-facing and student-facing content, (2) systematic Hindi-language bias against 10 other Indic instruction languages, and (3) suppression of state-level government education content by centrally-produced material. SVRA runs entirely deterministically at inference time — no second LLM call, no user data required — making it suitable for zero-cost, zero-latency deployment at scale.

---

## 1. Problem Statement & Motivation

### 1.1 Why Not a General-Purpose Recommender?

Most content recommendation systems optimise for *watch time and click-through rate*. Applied to a teacher-facing platform, this produces a systematic failure mode: the highest-CTR, highest-watch-time educational content in India is JEE/NEET coaching material produced for students preparing for entrance examinations. These videos are pedagogically irrelevant and actively counterproductive for a primary school mathematics teacher in rural Karnataka.

SVRA is designed to answer a fundamentally different question:

> *"Of the universe of Indian educational YouTube content, which videos are most appropriate for a PRIMARY or SECONDARY school teacher in this specific state, teaching this subject, in this language, following this curriculum board?"*

To answer that question, three signals are critical that a general recommender ignores entirely:

1. **Channel authority** in the Indian public education hierarchy (NCERT > private EdTech)
2. **Language sovereignty** — a Kannada teacher should see Kannada content, never defaulting to Hindi
3. **State curriculum alignment** — a Maharashtra teacher benefits most from Maharashtra SCERT content, not centrally-produced material

### 1.2 Why a Deterministic Ranker Instead of a Second LLM?

An early architecture used a second LLM call to re-rank candidates. This was abandoned for three reasons:

| Alternative | Problem |
|---|---|
| Second LLM re-ranking | +2–5s latency; non-deterministic outputs; hallucinated scores; no Indian educational authority knowledge |
| YouTube's own recommendations | Optimised for watch time, not teacher CPD; no curriculum-alignment signal |
| Embedding similarity (vector search) | Requires pre-computed embeddings for all candidates; infeasible at 1,875 RSS-fetched candidates per request |
| Pure keyword filtering | Binary (in/out); no graduated relevance; brittle to title phrasing variation |

SVRA uses a *mathematically grounded multi-signal linear model* over per-video features that can be computed in $O(n \cdot k)$ time, where $n$ is the candidate count and $k$ is the number of scoring signals. At 1,875 candidates and 6 signals, this runs in under 5ms.

---

## 2. System Architecture — 5-Tier Retrieval Pipeline

Before ranking, candidates are assembled through a tiered retrieval pipeline:

```
Teacher Request  →  [Tier 1] Firestore Semantic Cache
                           │ MISS
                    [Tier 2] Parallel Retrieval
                    ├── LLM (Gemini): search query generation
                    └── RSS Fetcher: youtube.com/feeds/videos.xml
                           │
                    [Tier 3] YouTube Data API (optional)
                           │
                    [Tier 4] SVRA — Local Deterministic Ranker ◄── this document
                           │
                    [Tier 5] Curated Static Fallback
```

**Tier 1 — Firestore Semantic Cache:** Cache key = SHA256(`subject:grade:language:state:board`). 5-dimensional cache prevents stale results when any teacher profile dimension changes. TTL: 24 hours.

**Tier 2 — Parallel RSS Retrieval:** Zero-cost. Each channel exposes a public RSS feed at `https://www.youtube.com/feeds/videos.xml?channel_id={id}`, returning the 15 most recent uploads. Across all categories, up to ~1,875 candidate videos are retrieved per request. Results are shuffled with a time-seeded function that rotates every 6 hours, ensuring freshness without additional API calls.

**Tier 3 — YouTube Data API:** Uses AI-generated query strings. Optional — degrades gracefully to RSS-only if unavailable. `regionCode=IN`. Emergency path: if a specific topic is requested but no candidates match, a direct topic search populates `topRecommended`.

**Tier 4 — SVRA:** The subject of this document. Runs after all candidates are pooled.

**Tier 5 — Curated Fallback:** A static library of verified video IDs from NCERT, Khan Academy India, Ministry of Education, and Teach For India. Fills any category that receives zero live results after SVRA.

---

## 3. The Core Scoring Equation

Each candidate video $v$ is scored independently against every output category $c$:

$$\boxed{R(v, c) = \max\!\left(0,\; A(v) + L(v) + \Psi(v) + K(v, c) + \Omega(v, c) - P(v)\right)}$$

Where:

| Term | Symbol | Signal Type | Range |
|---|---|---|---|
| Channel Authority | $A(v)$ | Source credibility in Indian education hierarchy | $\{0, 6, 12, 20\}$ |
| Language Match | $L(v)$ | Teacher's instruction language vs. video language | $\{0, 8, 15\}$ |
| Context Affinity | $\Psi(v)$ | State + board + classroom + Indic script + topic | $[0, 46]$ |
| Category Keywords | $K(v, c)$ | Keyword frequency weighted by category specificity | $[0, \infty)$ |
| Category Authority | $\Omega(v, c)$ | Channel-category fit bonus | $\{0, 4, 5, 8\}$ |
| Content Penalty | $P(v)$ | College / exam-coaching / student-event content | $\{0, 15\}$ |

The $\max(0, \cdot)$ floor ensures negative-scoring videos (exam coaching, IIT lectures) receive zero probability mass in all categories. The theoretical maximum raw score is approximately **85 points** for a video that perfectly satisfies all positive signals simultaneously.

### Why a Linear Model?

**Problem with alternatives:**

| Alternative | Problem |
|---|---|
| Multiplicative model ($A \times L \times \Psi$) | A zero on any signal eliminates the video entirely; too brittle |
| Neural ranking (LTR) | Requires labelled training data; no ground-truth labels exist for Indian teacher preferences |
| Sigmoid/softmax normalisation | Appropriate for a single ranked list; we need *independent* per-category scores to support quota distribution |
| BM25 (text retrieval) | Designed for document corpora with IDF statistics; our candidate pool changes per request |

A *linearly additive model* with hard-coded signal weights is transparent, debuggable, fast, and produces independent per-category scores — the right trade-off for a production recommendation system without labelled training data.

---

## 4. Signal 1 — Channel Authority Score A(v)

Authority is assigned based on the publishing channel's tier in the Indian public education hierarchy:

$$A(v) = \begin{cases} 20 & \text{if channel} \in \text{Tier 1 (Central or State Government)} \\ 12 & \text{if channel} \in \text{Tier 2 (NGO / Community Education)} \\ 6 & \text{if channel} \in \text{Tier 3 (Quality-Aligned EdTech)} \\ 0 & \text{if channel} \in \text{Tier 0 (Commercial Coaching)} \end{cases}$$

### Tier Classification

**Tier 1 — Government / Formal Education ($A = 20$)**

*Central:* NCERT, Ministry of Education India, NIOS, Vigyan Prasar, PIB India, DD News, AIICT Education

*State:* All 13 verified SCERT channels — Maharashtra Balbharati (Marathi), Kerala SCERT (Malayalam), Karnataka DSERT/KTBS (Kannada), Tamil Nadu SCERT (Tamil), AP SCERT (Telugu), Telangana SCERT (Telugu), GCERT Gujarat (Gujarati), SCERT Rajasthan (Hindi), SCERT UP (Hindi), WB SCERT (Bengali), Punjab SCERT (Punjabi), Odisha SCERT (Odia), SCERT Assam (Assamese) — plus Doordarshan regional (DD Sahyadri, DD Chandana, DD Podhigai, DD Yadagiri, DD Bangla)

*Rationale:* These channels are the *curriculum authority* for Indian school education. A NISHTHA training video from NCERT is categorically more trustworthy than any private EdTech production, regardless of view count or production quality. State SCERTs are peers to NCERT for their state's teachers — a Karnataka DSERT video on Kannada-medium pedagogy is more curriculum-relevant to a Karnataka teacher than a NCERT video in Hindi.

**Tier 2 — NGO / Community Education ($A = 12$)**

Let's LEARN, Teach For India, Azim Premji Foundation, Room to Read India, iDiscoveri Education, Pratham Education Foundation, Eklavya Foundation, Teacher Solid, CEE India, Quest Alliance, Sankalp India Foundation

*Rationale:* These organisations work directly in Indian classrooms with an equity and access mission. Their content is classroom-grounded and culturally calibrated for semi-urban and rural teachers — the primary SahayakAI user demographic. A Pratham video on TaRL methodology is more appropriate for a rural primary teacher than a polished Vedantu production.

**Tier 3 — Quality-Aligned EdTech ($A = 6$)**

Khan Academy India, Smart Learning for All, Magnet Brains, Iken Edu, Manocha Academy, Tiwari Academy, Dronstudy, Hindi Medium

*Rationale:* NCERT-aligned or vernacular. Moderate trust — content quality is often high but channels are not officially accredited and lack the curriculum-authority standing of Tier 1.

**Tier 0 — Commercial Coaching ($A = 0$)**

Vedantu, BYJU's, Physics Wallah, Unacademy, Study IQ, Aakash Institute

*Rationale:* These platforms produce content for students preparing for JEE, NEET, and board examinations, not for teachers developing classroom pedagogy. High subscriber counts are explicitly irrelevant. Assigning zero authority (rather than a penalty) correctly allows these channels to contribute to `topRecommended` if they happen to have subject-relevant content, while preventing them from outcompeting Tier 1 channels on authority alone.

---

## 5. Signal 2 — Language Match Score L(v)

Language is the most politically and culturally sensitive signal in the Indian education context. SahayakAI operates across 11 Indic instruction languages. The algorithm **never defaults to Hindi** for non-Hindi teachers.

$$L(v) = \begin{cases} 15 & \text{if teacher's language keyword found in title or channel name} \\ 8 & \text{if Indic script for teacher's language detected in title} \\ 0 & \text{if teacher selected English, or no match found} \end{cases}$$

### Two-Pass Language Detection

**Pass 1 — Keyword Match (strong signal, $+15$):**

Explicit language name or native-script self-identifier in the video title or channel name:

```
{ 'Marathi': ['marathi', 'महाराष्ट्र', 'मराठी'],
  'Tamil':   ['tamil', 'தமிழ்'],
  'Telugu':  ['telugu', 'తెలుగు'],
  'Kannada': ['kannada', 'ಕನ್ನಡ'],  ... }
```

**Pass 2 — Unicode Script Range Match (weak signal, $+8$):**

Detected by character range comparison against the Unicode Standard block assignments:

```
Bengali:   U+0980–U+09FF    Gujarati:  U+0A80–U+0AFF
Punjabi:   U+0A00–U+0A7F    Tamil:     U+0B80–U+0BFF
Telugu:    U+0C00–U+0C7F    Kannada:   U+0C80–U+0CFF
Malayalam: U+0D00–U+0D7F    Odia:      U+0B00–U+0B7F
Devanagari:U+0900–U+097F    (Hindi, Marathi, Maithili)
```

### Why Two Passes?

The Devanagari Unicode block is shared by Hindi, Marathi, Maithili, Sanskrit, and Bodo. Script detection alone cannot distinguish a Hindi lesson from a Marathi one — both would trigger $L = 8$ for a Marathi teacher. Keyword disambiguation in Pass 1 provides the unambiguous signal. The two-pass hierarchy means: *keyword match always wins; script is a fallback for videos that genuinely serve a language without explicitly naming it*.

### Why $L = 0$ for English?

English-medium content is already the implicit default in most EdTech platforms. There is no risk of English being suppressed; assigning a boost would instead suppress vernacular content relative to English — the opposite of SahayakAI's intent. English teachers receive full benefit from the authority and keyword signals without a language modifier.

---

## 6. Signal 3 — Context Affinity Ψ(v)

Context affinity is a composite of four sub-signals that capture the teacher's specific classroom context:

$$\Psi(v) = S_{state}(v) + B_{board}(v) + C_{class}(v) + I_{indic}(v) + T_{topic}(v)$$

### 6.1 State SCERT Boost — $S_{state}(v)$

$$S_{state}(v) = \begin{cases} 12 & \text{if channel} \in \text{teacher's state SCERT channel set} \\ 0 & \text{otherwise} \end{cases}$$

Each Indian state maps to a set of SCERT/DD regional channel IDs via `STATE_EDUCATION_CONFIG`. A Karnataka teacher's `stateScertIds` contains Karnataka DSERT and DD Chandana. A UP teacher's set contains UP SCERT. This ensures state-specific curriculum content outranks centrally-produced Hindi-medium material for state board teachers.

*Design note:* State Board teachers can accumulate both $S_{state}$ ($+12$) and $B_{board}$ ($+8$) for their state's SCERT content, totalling $+20$ — equal to Tier 1 government authority. This is correct: for a state board teacher, the state SCERT *is* the definitive curriculum authority.

### 6.2 Curriculum Board Boost — $B_{board}(v)$

$$B_{board}(v) = \begin{cases} 8 & \text{if CBSE teacher and channel} \in \{\text{NCERT, Khan Academy India}\} \\ 8 & \text{if ICSE teacher and channel} \in \{\text{CEC-UGC, Khan Academy India}\} \\ 8 & \text{if State Board teacher and channel} \in \text{state SCERT IDs} \\ 0 & \text{otherwise} \end{cases}$$

*Rationale:* NCERT is the curriculum authority for CBSE. Khan Academy India's mastery-based model is methodologically aligned with both CBSE and ICSE. State SCERT channels are the curriculum authority for their respective state boards.

### 6.3 Classroom Relevance Boost — $C_{class}(v)$

$$C_{class}(v) = \begin{cases} 5 & \text{if title contains any classroom keyword} \\ 0 & \text{otherwise} \end{cases}$$

Classroom keywords encode signals that distinguish *teacher-facing* content from *student-facing* content within the same channel: `classroom, blackboard, nishtha, diksha, nipun, tarl, fln, shikshak, adhyapak, primary teacher, foundational literacy, remedial, government school, joyful learning, lesson plan, learning outcome, inclusive classroom, ...`

### 6.4 Indic Script Fallback — $I_{indic}(v)$

$$I_{indic}(v) = \begin{cases} 3 & \text{if Indic script detected in title AND } L(v) = 0 \\ 0 & \text{otherwise} \end{cases}$$

A weak fallback signal for videos that contain Indic script but whose language was not identified by the two-pass language detector. Only fires when no language boost has already been applied, preventing double-counting.

### 6.5 Topic Match Boost — $T_{topic}(v)$

$$T_{topic}(v) = \begin{cases} 18 & \text{if teacher's search query appears in video title (case-insensitive)} \\ 0 & \text{otherwise} \end{cases}$$

This is the **strongest single signal** in SVRA ($+18$, exceeding even full Tier 1 authority). A teacher explicitly searching for "photosynthesis" has expressed a direct intent signal that overrides most category-level scoring. Implemented as a substring match to handle partial title overlap.

*Why not fuzzy matching?* Substring matching is $O(n)$ per candidate. Fuzzy matching (e.g., Levenshtein distance) would increase per-candidate scoring complexity from $O(1)$ to $O(nm)$ where $m$ is query length — unjustified for a 1–5 word search query where exact substring match has ~85% recall.

---

## 7. Signal 4 — Category Keyword Score K(v, c)

Each output category has a vocabulary bank encoding pedagogically relevant terminology. Every keyword match increments the category score:

$$K(v, c) = \sum_{k \in \text{KW}(c)} \mathbf{1}\!\left[\text{title}(v) \supseteq k\right] \times w_c$$

Where the per-category weight $w_c$ is:

$$w_c = \begin{cases} 5 & c \in \{\text{pedagogy, govtUpdates}\} \\ 2 & c \in \{\text{storytelling, courses, topRecommended}\} \end{cases}$$

### Why Higher Weight for `pedagogy` and `govtUpdates`?

Pedagogical terminology (NISHTHA, NIPUN, NCF, TaRL, Samagra Shiksha) is *domain-specific* — a single match is a strong categorical signal. Storytelling keywords (story, animated, concept) are *generic* — they appear in student content, children's entertainment, and teacher content equally. Applying $w_c = 5$ to high-specificity categories rewards precise vocabulary; $w_c = 2$ for generic categories requires accumulation of multiple weak signals.

### Keyword Banks

| Category | Representative Keywords |
|---|---|
| `pedagogy` | pedagogy, teaching method, classroom management, active learning, NCF, DIKSHA, NISHTHA, NIPUN, FLN, TaRL, child centred, play based, inquiry based, lesson plan, bloom, formative assessment |
| `govtUpdates` | government, ministry, ncert, policy, rte, nep, ncf, announcement, notification, scheme, pm shri, samagra shiksha, budget, nipun bharat, national curriculum, education report |
| `courses` | training, course, workshop, nishtha, diksha, certification, swayam, professional development, teacher education, b.ed, m.ed, webinar, module, upskilling |
| `storytelling` | story, animated, animation, narrative, kahani, katha, explanation, concept, visual, explainer, chapter, lesson, ncert chapter, class activity |
| `topRecommended` | [subject name], [grade level], teacher, classroom, ncert, india, school, educational, primary, shikshak |

---

## 8. Signal 5 — Category Authority Bonus Ω(v, c)

An additional bonus applied when a high-authority channel is structurally well-suited to a specific category:

$$\Omega(v, c) = \begin{cases} 8 & c = \text{govtUpdates} \text{ and } A(v) = 20 \\ 5 & c = \text{pedagogy} \text{ and } A(v) \geq 12 \\ 4 & c = \text{courses} \text{ and } A(v) \geq 12 \\ 0 & \text{otherwise} \end{cases}$$

*Rationale:* Government channels are the structurally definitive source for government education updates — their content should appear in `govtUpdates` even when keyword matching is weak (e.g., a Ministry of Education channel video titled "Shiksha Mantri Addresses Annual Conference" contains no policy keywords but is clearly a government update). The $\Omega$ bonus ensures authority-source alignment even when vocabulary signals are ambiguous.

---

## 9. Signal 6 — Content Penalty P(v)

A flat penalty for content outside the scope of school teacher professional development:

$$P(v) = \begin{cases} 15 & \text{if title}(v) \text{ contains any penalty keyword} \\ 0 & \text{otherwise} \end{cases}$$

### Why a Flat Penalty Instead of Exclusion?

**Problem with hard exclusion:**

| Approach | Problem |
|---|---|
| Hard exclusion (`score = 0 if penalty`) | Brittle; a video titled "NEET Reform — What Primary School Teachers Need to Know" is legitimate `govtUpdates` content but would be incorrectly eliminated |
| Zero floor without penalty | Exam-coaching videos from Tier 1 channels (MoE, NCERT occasionally publish exam-related content) would pass through with high authority scores |
| Separate penalty dimension | Overcomplicates the model for a binary signal |

A flat $-15$ penalty correctly reduces exam-coaching videos below relevant teacher content without eliminating edge cases. Because $R(v, c) = \max(0, \ldots)$, penalised videos still receive a floor of zero — they simply do not occupy quota slots.

### Penalty Keyword Groups

| Group | Keywords | Rationale |
|---|---|---|
| Student exam preparation | `iit jee, neet, jee main, jee advanced, neet ug, cuet, gate exam, rank booster, crash course, entrance exam` | Targets students, not teachers |
| College / university level | `undergraduate, b.tech, ugc net, college lecture, university lecture, degree course, upsc, civil services, ssc cgl` | Targets professors or civil services aspirants |
| NPTEL / IIT lecture series | `nptel, iit madras, iit delhi, iit bombay, iit kharagpur, iit roorkee, iit kanpur, iit lecture` | Engineering college lecture series; not school pedagogy |
| PM student events | `pariksha pe charcha, ppc 20` | PM Modi's annual student exam-stress interaction; not teacher training |

---

## 10. Quota-Based Category Distribution

Raw scores are used to populate five output carousels. SVRA uses a **quota-based distribution algorithm** rather than winner-take-all assignment.

### Why Not Winner-Take-All?

**Problem with alternatives:**

| Approach | Problem |
|---|---|
| Winner-take-all (each video assigned to its highest-scoring category) | High-authority channels dominate 1–2 categories; other carousels receive near-zero content |
| Proportional allocation | A category with low max-scores (govtUpdates) would still receive proportionally fewer videos than topRecommended |
| Independent top-N per category (with duplicates) | Same video appears in multiple carousels — wastes carousel diversity, confusing UX |

Quota-based distribution guarantees *every carousel has substantive content* while preserving a global uniqueness invariant (no video appears in more than one carousel).

### Phase System

$$\text{result}[c] = \text{fillCategory}(c,\; \text{upTo})$$

Applied in three phases:

| Phase | Per-Category Target | Purpose |
|---|---|---|
| Phase 1 | $N_{min} = 12$ | Guarantee no carousel is left empty |
| Phase 2 | $N_{target} = 30$ | Standard scroll-depth for comfortable browsing |
| Phase 3 | $N_{max} = 60$ | Full YouTube-style content density |

`fillCategory(c, upTo)` selects the top-$k$ unassigned candidates ranked by $R(v, c)$, where $k = \text{upTo} - |\text{result}[c]|$.

### Priority Order

All three phases iterate over categories in this fixed order:

$$[\text{govtUpdates},\ \text{topRecommended},\ \text{pedagogy},\ \text{courses},\ \text{storytelling}]$$

**Why `govtUpdates` first?** Government announcement videos originate from Tier 1 central and state channels (MoE, NCERT, PIB). These exact same channels also produce pedagogy and course content. If `topRecommended` or `pedagogy` runs first in Phase 1, they claim all Tier 1 channel videos, leaving `govtUpdates` with zero candidates — producing the single-video symptom. Processing `govtUpdates` first ensures it claims government-announcement videos (high $\Omega_{govtUpdates}$, high $K_{govtUpdates}$) before other categories drain the Tier 1 pool.

### Formal Description of Fill Algorithm

```
assigned  ← ∅

fillCategory(c, upTo):
  needed ← upTo - |result[c]|
  if needed ≤ 0: return
  candidates ← { (v, R(v,c)) | v ∉ assigned ∧ R(v,c) > 0 }
  sorted      ← candidates sorted by R(v,c) DESC
  selected    ← sorted[0 : needed]
  result[c]  ← result[c] ∪ { v | (v,_) ∈ selected }
  assigned   ← assigned ∪ { v | (v,_) ∈ selected }

for c in ALL_CATS: fillCategory(c, N_min)     // Phase 1
for c in ALL_CATS: fillCategory(c, N_target)  // Phase 2
for c in ALL_CATS: fillCategory(c, N_max)     // Phase 3
```

---

## 11. Channel Injection Strategy

Before candidates are fetched, SVRA builds a per-category channel list that injects state-specific and language-specific channels at the front:

$$\text{channels}(c) = [S_{\text{state}}(c) \parallel L_{\text{lang}} \parallel \text{EDU}(c) \parallel \text{SUBJ}(c \in \{\text{story, top}\})]_{\text{deduplicated}}$$

Where:
- $S_{\text{state}}(c)$: teacher's state SCERT channels, prepended to `govtUpdates` and `topRecommended`
- $L_{\text{lang}}$: `LANGUAGE_CHANNEL_MAP[language]` — state SCERT + regional DD per language, prepended to all categories
- $\text{EDU}(c)$: `INDIAN_EDU_CHANNELS[c]` — curated category-level channel list
- $\text{SUBJ}(c)$: `SUBJECT_CHANNEL_MAP[subject]` — subject-specific channels for storytelling and topRecommended

Channel deduplication is applied by ID before RSS fetching to avoid redundant network calls.

*Design rationale:* Prepending (not appending) ensures state and language channels are fetched even if the per-category `EDU(c)` list is long and the RSS fetcher would otherwise throttle low-priority channels.

---

## 12. Worked Scoring Example

**Scenario:** Maharashtra State Board, Class 7 Mathematics teacher, instruction language Marathi

| Video | $A$ | $L$ | $\Psi$ | $K(\text{ped})$ | $\Omega(\text{ped})$ | $P$ | $R(\text{pedagogy})$ |
|---|---|---|---|---|---|---|---|
| *"Maharashtra SCERT NISHTHA Module 3 [मराठी]"* | 20 | 15 | 12+8+5 = 25 | 5×3 = 15 | 5 | 0 | **80** |
| *"NCERT Pedagogy for Class 7 Mathematics"* | 20 | 0 | 0+8+5 = 13 | 5×4 = 20 | 5 | 0 | **58** |
| *"Azim Premji — Active Learning in Primary Classrooms"* | 12 | 0 | 0+0+5 = 5 | 5×5 = 25 | 5 | 0 | **47** |
| *"IIT JEE Maths Crash Course — Rank Booster"* | 0 | 0 | 0 | 0 | 0 | 15 | **0** (clamped) |

The Maharashtra SCERT video correctly wins `pedagogy` by accumulating: Tier 1 government authority ($A=20$) + Marathi keyword match ($L=15$) + state SCERT boost ($+12$) + board alignment boost ($+8$) + classroom keyword ($+5$) + NISHTHA × 3 keyword matches ($+15$) + pedagogy authority bonus ($+5$) = **80**.

---

## 13. Known Limitations & Future Research Directions

### 13.1 Absence of Temporal and Popularity Signals

The current model has no recency or popularity signal. A video published 3 years ago ranks identically to one published yesterday, assuming identical authority and keyword signals. We propose the following extension:

$$R'(v, c) = R(v, c) \times \underbrace{e^{-\frac{\ln 2}{30} \cdot d_v}}_{\text{recency decay}} \times \underbrace{\left(1 + 0.5 \cdot \log_{10}(1 + \text{views}_v)\right)}_{\text{popularity boost}}$$

Where $d_v$ = days since `publishedAt`. This gives a 30-day half-life to recency and a logarithmic (bounded) popularity multiplier — preventing viral outliers from dominating while surfacing genuinely widely-used content.

### 13.2 Flat Keyword Weights (TF-IDF Extension)

The current model uses flat per-category keyword weights ($w_c \in \{2, 5\}$). A more principled approach would apply TF-IDF weighting: rare, highly-specific terms (NISHTHA, NIPUN, NCF, TaRL) should contribute more than common ones (class, school, education). The inverse-document-frequency component can be pre-computed over the curated video corpus and updated periodically:

$$K'(v, c) = \sum_{k \in \text{KW}(c)} \mathbf{1}[\text{title}(v) \supseteq k] \times \text{idf}(k) \times w_c$$

### 13.3 Single-Category Assignment Constraint

The global `assigned` set prevents a video from appearing in more than one carousel. While this maximises carousel diversity, it introduces an ordering dependency — the priority order of `ALL_CATS` determines which category "wins" contested videos. A future relaxation could allow limited cross-carousel duplication for high-scoring videos ($R(v, c) > \theta$ for multiple categories), with UI-level deduplication signalling.

### 13.4 Emergency Fallback Single-Category Distribution

When a specific topic is requested but no candidates match, an emergency YouTube Data API search is triggered and its results are dumped entirely into `topRecommended`. A proportional distribution across all five categories would better serve teachers making specific topic searches.

---

## 14. Hyperparameter Reference

| Parameter | Symbol | Value | Description |
|---|---|---|---|
| Tier 1 authority | — | 20 | Central government + state SCERT channel base score |
| Tier 2 authority | — | 12 | NGO / community education base score |
| Tier 3 authority | — | 6 | Quality-aligned EdTech base score |
| Language keyword boost | — | 15 | Explicit language keyword match in title or channel |
| Language script boost | — | 8 | Indic script detected (ambiguous, no keyword found) |
| State SCERT boost | — | 12 | Video from teacher's state SCERT channel |
| Board alignment boost | — | 8 | Video board-aligned to teacher's curriculum board |
| Classroom keyword boost | — | 5 | Semi-urban classroom vocabulary in title |
| Indic script fallback | — | 3 | Indic script present; no language boost already applied |
| Topic match boost | — | 18 | Teacher's search query found in video title |
| High-specificity keyword weight | $w_c$ | 5 | Per-keyword score for `pedagogy` and `govtUpdates` |
| Generic keyword weight | $w_c$ | 2 | Per-keyword score for `storytelling`, `courses`, `topRecommended` |
| `govtUpdates` authority bonus | $\Omega$ | 8 | Tier 1 channel scored against `govtUpdates` |
| `pedagogy` authority bonus | $\Omega$ | 5 | Tier 1 or 2 channel scored against `pedagogy` |
| `courses` authority bonus | $\Omega$ | 4 | Tier 1 or 2 channel scored against `courses` |
| Content penalty | — | −15 | College / exam-coaching / student-event content |
| Minimum quota | $N_{min}$ | 12 | Guaranteed minimum videos per carousel (Phase 1) |
| Target depth | $N_{target}$ | 30 | Standard carousel depth (Phase 2) |
| Maximum cap | $N_{max}$ | 60 | Hard cap per category (Phase 3) |
| RSS videos per channel | — | 15 | Recent uploads fetched via YouTube RSS feed |
| Daily shuffle period | — | 6 hours | Time-seed rotation period for result freshness |

---

## 15. Audit Log

Design decisions validated and issues resolved:

| Finding | Severity | Root Cause | Resolution |
|---|---|---|---|
| `govtUpdates` receiving ≤1 video | Critical | Phase 1 processed `topRecommended` first; all Tier-1 videos claimed before `govtUpdates` ran | Reordered `ALL_CATS` to process `govtUpdates` first in all three phases |
| "Pariksha Pe Charcha" in Teacher Training Courses | High | MoE/NCERT channels (Tier 1, A=20) publish PM student-interaction videos that accumulated high authority + keyword scores | Added `pariksha pe charcha` to `EXAM_KWS` penalty list |
| NPTEL / IIT lectures in Pedagogy | High | `SWAYAM_NPTEL` channel (Tier 1, A=20) publishes engineering lecture series alongside school-level courses | Added `nptel`, `iit madras`, `iit delhi`, `iit bombay`, `iit kharagpur`, `iit roorkee`, `iit kanpur`, `iit lecture` to `EXAM_KWS` |
| `state` and `educationBoard` not used in ranking | Medium | `rankVideosLocal` was called without state/board params; `fetchRSSVideosForTeacher` had no state parameter | Wired state and educationBoard through the full pipeline from profile enrichment to ranking |
| API 401 blocking unauthenticated teachers | High | `requireAuth()` gate on `/api/ai/video-storyteller`; token guard on page fetch | Made auth optional — RSS content is public; personalisation degrades gracefully without auth |
| 1–2 videos per category | Critical | Curated fallback had only 4–5 videos per category; RSS fetch was quota-capped; winner-take-all assignment | Replaced winner-take-all with three-phase quota distribution; removed RSS per-channel cap |
