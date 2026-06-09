# SahayakAI Impact Score Dashboard — Technical Reference

**Author:** Abhishek Gupta, SARGVISION AI · SahayakAI Analytics Team

## 1. Overview & Philosophy

The **Impact Score Dashboard** is SahayakAI's analytical engine for measuring how deeply a teacher is integrating AI into their classroom practice. It is not a simple activity counter — it is a **multi-dimensional, probabilistic behavioral model** inspired by methodology from recommender systems, survival analysis, and information theory.

### Why not a simple score?

Most EdTech platforms measure engagement as raw session counts or content volume. These signals are easy to game, saturate quickly, and fail to distinguish a teacher who improves over time from one who signs in once and leaves.

The SahayakAI Impact Score is designed to answer a fundamentally harder question:

> *"Is this teacher becoming a more effective, more independent practitioner of AI-augmented pedagogy — and is SahayakAI genuinely part of their classroom ecosystem?"*

To answer this, the model draws on five *orthogonal competency dimensions*, each grounded in a distinct behavioral science or mathematical principle.

---

## 2. The Core Equation

To accurately measure a teacher's progress, the framework moves beyond simple activity counting, which is easily gamified and quickly caps out. Instead, we calculate the Impact Score ($H(t)$) as a composite metric. It combines five distinct behavioral *dimensions* and normalizes them using a *sigmoid* (S-curve) function. This mathematical approach naturally enforces the law of diminishing returns, ensuring that the score reflects genuine, long-term habit formation rather than just temporary spikes in usage.

$$\boxed{H(t) = 100 \times \sigma\bigl(w_A \cdot A(t) + w_E \cdot E(t) + w_S \cdot S(t) + w_G \cdot G(t) + w_C \cdot C(t) - \beta\bigr)}$$

Where:
- $\sigma(x) = \frac{1}{1 + e^{-x}}$ — the *sigmoid (logistic) activation function*
- $A, E, S, G, C \in [0, 1]$ — five normalized competency dimensions
- $w_A, w_E, w_S, w_G, w_C$ — learnable dimension weights
- $\beta$ — a bias offset to center the sigmoid

### Why a sigmoid?

**Problem with alternatives:**

| Approach | Problem |
|--|--|
| `score = A + E + S + G` | Unbounded; saturates at 100 easily; no smooth penalisation |
| `score = min(100, ...)` | Hard cap creates a "cliff" — a teacher near 100 gets 0 feedback signal |
| Raw weighted average | Linear; doesn't reflect that marginal gains are harder to achieve at extremes |

A sigmoid gives us:
1. **Bounded output** — always in (0, 100)
2. **Smooth gradient** — a teacher at 50 can clearly see improvement paths; a teacher at 95 needs to work much harder
3. **Non-linearity** — models the realistic diminishing returns of behavior change

### Current Weight Configuration

| Dimension | Weight | Rationale |
|--|--|--|
| $w_G$ (Growth) | **1.4** | Highest: a teacher improving week-on-week is the primary success signal |
| $w_A$ (Activity) | **1.2** | High: presence and recent usage is a prerequisite for all other signals |
| $w_C$ (Community) | **1.1** | Significant: ecosystem contribution multiplies impact beyond one classroom |
| $w_E$ (Engagement) | **0.9** | Moderate: platform breadth matters but shouldn't penalise specialists |
| $w_S$ (Success) | **0.8** | Lowest: generation quality is important but prior knowledge compensates |

**Bias offset:** $\beta = 1.6$ — tuned so that a teacher with median performance across all dimensions scores approximately 60/100.

---

## 3. Dimension — A(t): Kinematic Activity with Temporal Decay

### Equation

$$A(t) = \text{clip}_{[0,1]}\left(\left(\sum_{i} n_i \cdot e^{-\lambda(t - \tau_i)} + 2 \cdot e^{-\lambda \cdot d_{last}}\right) \times 10\right)$$

Where:
- $n_{recent} = $ sessions in last 7 days, centred at $\tau = 3.5$ days
- $n_{older} = $ sessions in days 8–14, centred at $\tau = 11$ days
- $\lambda = \frac{\ln 2}{3}$ — *3-day half-life* (activity value halves every 3 days)
- $d_{last}$ — days since last login (recency boost)

### Rationale

A session from 14 days ago should contribute far less to the current health score than one from yesterday. This is the *kinematic model* from physics: objects in motion carry momentum, and that momentum decays over time.

**Why a 3-day half-life?** For rural Indian teachers with sporadic internet access, 3 days is a realistic "cycle" — a teacher may access SahayakAI once or twice per week to prepare the week's lessons. A half-life shorter than 3 days would unfairly penalise weekly planners.

**The recency boost** $2 \cdot e^{-\lambda \cdot d_{last}}$ rewards teachers who logged in very recently, even if their overall session count is moderate — reflecting the idea that *consistency of habit is as important as volume*.

---

## 4. Dimension — E(t): Volume-Weighted Shannon Entropy of Feature Engagement

### Equation

$$E(t) = \alpha \cdot H_{\text{norm}}(F) + (1-\alpha) \cdot \min\!\left(1,\,\frac{C_{tot}}{50}\right)$$

Where:

$$H_{\text{norm}}(F) = -\sum_{i=1}^{k} p_i \cdot \log_k(p_i)$$

- $F$ = set of features used in the last 30 days
- $k = 13$ — total platform features (8 content types + 5 platform features)
- $p_i = 1/|F|$ — uniform distribution assumption over observed features
- $\alpha = 0.7$ — blend weight (70% diversity, 30% volume)
- $C_{tot}$ — total content created (volume baseline)

### Platform Feature Set (k=13)

**Content Creation (8):** Lesson Plan, Quiz, Worksheet, Rubric, Virtual Field Trip, Visual Aid, Instant Answer, Micro-Lesson

**Platform Features (5):** Teacher Training, AI Intent/Assistant, Community Library, My Library, Video Storyteller

### Rationale

**Why Shannon Entropy?** Information theory's Shannon Entropy measures "surprise" or "diversity" in a probability distribution. Applied to feature usage, it answers: *"How unpredictably varied is this teacher's platform usage?"*

- A teacher using **only** quizzes: $H = 0$ (perfectly predictable, no diversity)
- A teacher using **all 13 features equally**: $H = 1$ (maximum diversity)

**Why blend with volume?** Pure entropy penalised single-feature power users — a teacher who generates 50 quizzes has deep expertise but scores $E=0$. The *forensic audit* identified this as an "Entropy Trap." The volume baseline ($\min(1, C_{tot}/50)$) ensures meaningful depth in any domain earns partial credit.

**Why normalize by $\log_k$?** This ensures $H \in [0, 1]$ regardless of $k$. Without this, adding new features to the platform would change the maximum achievable score, breaking the model's calibration.

**Why k=13 (not 6)?** The original implementation hardcoded $k=6$ without verification. The forensic audit traced this to the actual `analytics-events.ts` source file, which defines 7 `content_type` enum values plus 6 platform-level features — confirmed at 13 total.

---

## 5. Dimension — S(t): Bayesian Success Competency

### Equation

$$S(t) = \underbrace{\frac{\alpha_0 + n_{success}}{\alpha_0 + \beta_0 + n_{total}}}_{\text{posterior mean}} \times \underbrace{e^{-\delta \cdot \max(0,\, \bar{r} - 1)}}_{\text{regen dampening}}$$

Where:
- $(\alpha_0, \beta_0) = (8, 2)$ — *Beta prior* representing platform baseline of $\sim$80% success
- $n_{success}$ — teacher's successful AI generations
- $n_{total}$ — total generation attempts
- $\delta = 0.4$ — regeneration penalty intensity
- $\bar{r}$ — average number of regenerations per content piece

### Rationale

**Why Bayesian updating instead of a simple ratio?** A simple success rate $\frac{n_s}{n_t}$ is catastrophically noisy for new users. A teacher who successfully generates 1 lesson plan in 1 attempt naively scores 100% — but we have no statistical confidence in that estimate.

The **Beta-Binomial model** combines:
- A *prior* belief (the platform average) that acts as a regularizer
- *Evidence* from the teacher's own history that progressively shrinks the prior's influence

As evidence accumulates ($n_{total} \to \infty$), the posterior converges on the teacher's true competency rate. For new users (few attempts), it is "smoothed" toward the platform average.

*Why the regeneration penalty?* Teachers who generate content and immediately discard it (high $\bar{r}$) are demonstrating that they haven't yet absorbed how to prompt effectively. This is a "*prompt thrashing*" signal — valuable feedback that the teacher needs training, not just more usage.

**Why $\delta = 0.4$?** At $\bar{r} = 3$ (three regenerations per content), the penalty = $e^{-0.4 \times 2} \approx 0.45$ — a 55% penalty. This aggressively penalises heavy thrashing while being lenient about a single regeneration ($\bar{r}=2$: penalty $\approx 0.67$).

---

## 6. Dimension — G(t): EMA Growth Momentum (MACD-style)

### Equation

$$G(t) = \text{clip}_{[0,1]}\!\left(50 + 50 \cdot \tanh\!\left(\kappa \cdot \Delta c\right) + \text{streak\_bonus}\right)$$

$$\Delta c = c_{7\text{day}} - c_{8\text{-}14\text{day}}$$

$$\text{streak\_bonus} = \min(20,\; 2 \times d_{streak})$$

Where:
- $\Delta c$ — velocity: change in content creation rate between this week and last
- $\kappa = 0.2$ — sensitivity (scaling factor)
- $d_{streak}$ — consecutive days with at least one session

### Rationale

**Why MACD-style EMA divergence?** Traditional growth metrics compare this week to last week via subtraction ($\Delta c$), which is unbounded and can be dominated by outliers. In finance, the *MACD (Moving Average Convergence/Divergence)* indicator captures acceleration and trend reversals — exactly what we want for behavioral momentum.

The $\tanh$ activation function:
- Maps $\Delta c \to (-1, 1)$ — *bounded*, preventing outlier weeks from dominating
- Is *smooth*: small changes map to small score changes (no discontinuities)
- At $\Delta c = 0$: $\tanh(0) = 0 \Rightarrow G = 50$ (neutral momentum — the baseline)
- Growing teacher ($\Delta c = +5$): $G \approx 80$ (above baseline, positive trend)
- Declining teacher ($\Delta c = -5$): $G \approx 20$ (below baseline, at risk)

**Why a streak bonus?** Consecutive usage habits are more predictive of long-term retention than volume. A streak of 7 consecutive days earns +14 points — the reward for *habit formation*, not just productivity.

---

## 7. Dimension — C(t): Community Impact Score

### Equation

$$C(t) = \gamma_1 \cdot \underbrace{\frac{\log_{10}(1 + S_{shared})}{\log_{10}(1 + C_{tot})}}_{\text{share depth}} + \gamma_2 \cdot \underbrace{\min\!\left(1,\,\frac{N_{exported}}{C_{tot}}\right)}_{\text{export reach}} + \gamma_3 \cdot \underbrace{\min\!\left(1,\,\frac{V_{library}}{20}\right)}_{\text{reciprocity}}$$

Weights: $\gamma_1 = 0.5,\; \gamma_2 = 0.3,\; \gamma_3 = 0.2$

| Sub-signal | Variable | Design Decision |
|--|--|--|
| **Share Depth** | $S_{shared}$ / $C_{tot}$ | Logarithmic — sharing 5/10 items is qualitatively different from 50/100 |
| **Export Reach** | $N_{exported}$ / $C_{tot}$ | Linear ratio — fraction of content classroom-ready (quality proxy) |
| **Reciprocity** | $V_{library}$ / 20 | Saturates at 20 visits — rewards community learners, not obsessive browsers |

### Rationale

**Why add a dedicated Community dimension?** The original model buried community sharing as a weak multiplier ($\times 1.05$) inside the Engagement dimension. This was architecturally wrong for three reasons:

1. **Orthogonality violation:** Community behaviour is conceptually independent from feature diversity. A teacher can use many features in isolation without contributing to the ecosystem.
2. **Underweighting:** A multiplier of 1.05 gives ~5% boost at best — inadequate to distinguish a community leader from a lurker.
3. **SahayakAI's mission:** The platform is explicitly a "community-driven intelligence layer." Teachers who share content are *multiplying platform impact* beyond their own classroom — this deserves first-class scoring.

**Why logarithmic share depth?**  
Linear sharing ratios reward volume ($50 / 100 = 50\%$) equally to proportional contribution ($5 / 10 = 50\%$). But $5$ shares from a library of $10$ items is a stronger "generosity signal" than $50$ shares from $100$ items — the log normalisation captures this intuition.

**Why export reach as a quality proxy?**  
Content that a teacher downloads and exports to PDF/print for actual classroom use has passed a human quality filter. It's a revealed preference signal: the teacher deemed it good enough to put in front of students.

---

## 8. Dynamic Risk Classification

$$P(\text{churn}) = 1 - \frac{H(t)}{100}$$

| Score Band | P(churn) | Risk Level | Interpretation |
|--|--|--|--|
| 70–100 | < 0.30 | 🟢 **Healthy** | Actively engaged, growing teacher |
| 40–69 | 0.30–0.60 | 🟡 **At-Risk** | Declining activity, needs re-engagement |
| 0–39 | > 0.60 | 🔴 **Critical** | High churn probability, requires intervention |

The churn probability is a continuous fluid variable — not a hard threshold — enabling smooth transitions in the dashboard UI.

---

## 9. Scoring Output Schema

```typescript
{
  score: number;                // 0–100, final H(t)
  risk_level: 'healthy' | 'at-risk' | 'critical';
  activity_score: number;       // 0–30  (A × 30)
  engagement_score: number;     // 0–30  (E × 30)
  success_score: number;        // 0–20  (S × 20)
  growth_score: number;         // 0–20  (G × 20)
  community_score: number;      // 0–20  (C × 20) [v2 new]
  days_since_last_use: number;
  consecutive_days_used: number;
  estimated_students_impacted: number;
}
```

---

## 10. Forensic Audit Log

Issues discovered and resolved via internal forensic investigation:

| Finding | Severity | Root Cause | Fix Applied |
|--|--|--|--|
| **Phantom Score for New Users (43/100)** | Design Decision | Bayesian prior Beta(8,2) gives all users 80% baseline | Documented as intentional; new users should not be `critical` |
| **Entropy Trap (single-feature E=0)** | HIGH | Shannon Entropy is 0 when only 1 feature used | Blended 70% entropy + 30% volume baseline |
| **Wrong Feature Count (k=6)** | HIGH | Hardcoded guess without code verification | Verified from `analytics-events.ts`; corrected to k=13 |
| **Community as weak multiplier** | MEDIUM | Sharing gave ≤5% boost inside Engagement | Elevated to full 5th dimension with wC=1.1 |

---

## 11. Hyperparameter Reference

| Parameter | Value | Description |
|--|--|--|
| `decayLambda` | `ln(2)/3` | Activity half-life = 3 days |
| `kFeatures` | `13` | Total platform features for entropy normalization |
| `alphaBlend` | `0.7` | Entropy-volume blend ratio in E(t) |
| `priorAlpha` | `8` | Bayesian prior successes (platform average) |
| `priorBeta` | `2` | Bayesian prior failures (platform average) |
| `regenDelta` | `0.4` | Regen thrashing penalty intensity |
| `kappa` | `0.2` | Growth velocity sensitivity in tanh |
| `streakCap` | `20` | Maximum streak bonus points |
| `gamma1` | `0.5` | Community: share depth weight |
| `gamma2` | `0.3` | Community: export reach weight |
| `gamma3` | `0.2` | Community: reciprocity weight |
| `wA` | `1.2` | Sigmoid weight: Activity |
| `wE` | `0.9` | Sigmoid weight: Engagement |
| `wS` | `0.8` | Sigmoid weight: Success |
| `wG` | `1.4` | Sigmoid weight: Growth |
| `wC` | `1.1` | Sigmoid weight: Community |
| `betaOffset` | `1.6` | Sigmoid centering bias |
| `scaleFactor` | `2.2` | Sigmoid spread factor |
