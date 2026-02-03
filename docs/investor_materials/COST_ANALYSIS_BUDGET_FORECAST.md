# SahayakAI - Cost Analysis & Budget Forecast (B2G Model)

**Prepared by:** FinOps Engineering Team  
**Role:** Product Cost Analyst & Infrastructure Budgeting  
**Date:** January 28, 2026  
**Currency:** Indian Rupees (₹)  
**Exchange Rate:** 1 USD = ₹83  
**Business Model:** B2G (Government Contracts) + NGO Partnerships  
**Analysis Period:** Current State + 12-Month Projection  
**Usage Model:** Broader Estimates (Continuous Active Teachers)

---

## Executive Summary

### Key Findings (B2G Cost Structure)

| **Metric** | **Value (₹)** | **Details** |
|------------|--------------|-------------|
| **1,000 DAU Cost** | ₹2,11,000/month | Based on 8.8 features/user/day |
| **10,000 DAU Cost** | ₹21,12,000/month | Aligned with Year 1 targets (50K teachers) |
| **50,000 DAU Cost** | ₹1.06 Crore/month | Year 1 projection (10 pilot districts) |
| **Per-User Cost** | ₹211/user/month | Consistent across all scales |
| **Government Contract Margin** | 65-70% gross | Per-teacher license: ₹1,000/year vs ₹2,532/year cost |
| **Primary Cost Driver** | Visual Aid Images (94%) | ₹1,99,200/month @ 1K DAU |
| **Recommended Budget (Year 1)** | ₹1.2 Crore | Covers 50K teachers + infrastructure |

### Critical Business Insights (B2G Context)

✅ **Aligned with Government RFPs:** Cost per teacher (₹211/month = ₹2,532/year) vs revenue (₹1,000/year) requires optimization  
⚠️ **Current Model Unprofitable:** Need 40% cost reduction via caching + pre-generated content to reach 65% margin  
✅ **Scalability Proven:** Linear cost scaling supports state-wide rollouts  
✅ **NGO Partnerships Critical:** CSR funding (Tata Trusts, Azim Premji) can offset pilot costs  

---

## 1. Current Feature Inventory & API Consumption Profile

### 1.1 Feature-Level API Call Breakdown

| **Feature** | **Model** | **Avg Input Tokens** | **Avg Output Tokens** | **API Calls/Use** | **Usage Frequency** |
|-------------|-----------|---------------------|----------------------|-------------------|---------------------|
| **Lesson Plan Generator** | `gemini-2.5-flash` | 1,500 | 2,500 | 1-2 | 60% of users (primary) |
| **Quiz Generator** | `gemini-2.5-flash` | 600 | 800 | 1 | 40% of users |
| **Visual Aid Designer** | `gemini-3-pro-image` + `2.5-flash` | 400 + 800 | 100 + 600 | 2 | 20% of users (expensive) |
| **Avatar Generator** | `gemini-2.5-flash-image` | 300 | 100 | 1 | 10% of users (one-time) |
| **Voice Transcription** | `gemini-2.5-flash` | 200 | 150 | 1 | 30% of users |
| **Instant Answer** | `gemini-2.5-flash` | 100 | 200 | 1 | 25% of users |
| **Teacher Training** | `gemini-2.5-flash` | 250 | 350 | 1 | 15% of users |
| **Rubric Generator** | `gemini-2.5-flash` | 500 | 700 | 1 | 30% of users |
| **Worksheet Wizard** | `gemini-2.5-flash` | 400 | 600 | 1 | 25% of users |
| **Virtual Field Trip** | `gemini-2.5-flash` | 600 | 900 | 1 | 15% of users |

### 1.2 User Behavior Assumptions (Broader Estimates - Continuous Active Teachers)

**Typical User Session:**
- **Active Teachers (70% of users):** 5-8 features/session, 2-3 sessions/day (morning prep, afternoon, evening)
- **Regular Teachers (20% of users):** 3-4 features/session, 1-2 sessions/day
- **Casual/Trial (10% of users):** 1-2 features/session, 2-3 sessions/week

**Average Actions Per User Per Day:**
- **2.5 Lesson Plans** (multiple subjects, 5-6 periods/day)
- **1.5 Quizzes** (daily assessments for different classes)
- **0.8 Visual Aids** (for complex topics like science/math)
- **1.2 Voice Transcriptions** (meeting notes, student responses)
- **2.0 Instant Answers** (quick clarifications, student doubts)
- **0.5 Rubrics/Worksheets** (weekly creation)
- **0.3 Other Features** (training, field trips - occasional)

**Total Average: ~8.8 features/user/day** (up from conservative 3.0)

**Justification:**
- Indian teachers teach 5-6 classes/day on average
- Each class requires preparation
- CBSE/NCERT curriculum demands regular assessments
- Teachers often plan multiple days ahead in one sitting

---

## 2. API Pricing Model (Google Gemini - January 2026)

### 2.1 Text Generation Models

| **Model** | **Input Tokens (₹)** | **Output Tokens (₹)** | **Notes** |
|-----------|---------------------|----------------------|-----------|
| `gemini-2.5-flash` | ₹6.22 / 1M | ₹24.90 / 1M | Primary model for all text |
| `gemini-1.5-flash` | ₹6.22 / 1M | ₹24.90 / 1M | Fallback (if used) |

**Conversion Method:**
- Original: $0.075/1M input, $0.30/1M output
- Converted: $0.075 × 83 = ₹6.22, $0.30 × 83 = ₹24.90

### 2.2 Image Generation Models

| **Model** | **Cost Per Image (₹)** | **Notes** |
|-----------|----------------------|-----------|
| `gemini-2.5-flash-image` | ₹3.32 / image | Avatar generation |
| `gemini-3-pro-image-preview` | ₹8.30 / image | Visual aids (blackboard style) |

**Conversion:**
- $0.04 × 83 = ₹3.32
- $0.10 × 83 = ₹8.30

### 2.3 Free Tier Allocation (Per API Key)

- **Daily:** First 1,500 requests FREE
- **Monthly:** ~45,000 requests FREE
- **Spillover:** Automatically uses paid tier when exceeded

---

## 3. Cost Analysis: 1,000 Daily Active Users (DAU)

### 3.1 Monthly API Call Projections (Broader Estimates)

**Assumptions:**
- 1,000 DAU × 30 days = 30,000 total user-days/month
- **Broader usage model:** 8.8 features/user/day (realistic continuous usage)

| **Feature** | **Uses/User/Day** | **Monthly Uses** | **Total API Calls** | **Free Tier** | **Paid Calls** |
|-------------|------------------|-----------------|---------------------|---------------|----------------|
| Lesson Plan | 2.5 | 75,000 | 75,000 | 45,000 | 30,000 |
| Quiz Generator | 1.5 | 45,000 | 45,000 | exhausted | 45,000 |
| Visual Aid | 0.8 | 24,000 | 48,000 (2 calls) | exhausted | 48,000 |
| Voice Transcription | 1.2 | 36,000 | 36,000 | exhausted | 36,000 |
| Instant Answer | 2.0 | 60,000 | 60,000 | exhausted | 60,000 |
| Rubric/Worksheet | 0.5 | 15,000 | 15,000 | exhausted | 15,000 |
| Other Features | 0.3 | 9,000 | 9,000 | exhausted | 9,000 |
| **TOTAL** | **8.8** | **264,000** | **288,000** | **45,000** | **243,000** |

**Note:** Free tier (45K) only covers first ~16% of usage, rest is paid

### 3.2 Token Consumption Estimate (1,000 DAU - Broader)

**Monthly Token Usage:**
- **Input Tokens:** ~158M tokens (3x increase from conservative)
- **Output Tokens:** ~211M tokens (3x increase)

**Cost Breakdown (₹):**
```
Input Cost:  158,000,000 × ₹6.22 / 1,000,000 = ₹982.76
Output Cost: 211,000,000 × ₹24.90 / 1,000,000 = ₹5,253.90
Image Cost:  24,000 images × ₹8.30 = ₹1,99,200.00
-------------------------------------------------------------
TOTAL TEXT API COST:    ₹6,236.66
TOTAL IMAGE API COST:   ₹1,99,200.00
-------------------------------------------------------------
GRAND TOTAL (1K DAU):   ₹2,05,437/month (~₹2.05 lakh)
```

**Comparison:**
- Conservative (3.0 features/day): ₹76,829
- **Broader (8.8 features/day): ₹2,05,437** ← **2.7x higher (realistic)**

### 3.3 Additional GCP Infrastructure Costs (1,000 DAU - Higher Traffic)

| **Service** | **Monthly Cost (₹)** | **Notes** |
|-------------|---------------------|-----------|
| Cloud Run (Compute) | ₹2,490-4,150 | 288K requests/month (up from 100K) |
| Firestore (Database) | ₹830-1,660 | 500K reads, 150K writes (3x) |
| Firebase Storage | ₹415-830 | 15GB storage (3x) |
| Cloud Build (CI/CD) | ₹0 (free tier) | Still within limits |
| Secret Manager | ₹83 | <10 secrets |
| Cloud Logging | ₹415-830 | Higher log volume |
| **SUBTOTAL** | **₹4,233-7,553** | |

### 3.4 Total Cost @ 1,000 DAU (Broader Estimate)

```
API Costs:           ₹2,05,437
Infrastructure:      ₹5,900 (average)
---------------------------------------------
TOTAL MONTHLY COST:  ₹2,11,337 (~₹2.1 lakh)

Per-User Cost:       ₹211.34/user/month
```

**Comparison with Conservative:**
- Conservative: ₹79,729/month
- **Broader: ₹2,11,337/month** ← **2.65x higher (more realistic for active teachers)**

---

## 4. Cost Analysis: 10,000 Daily Active Users (DAU)

### 4.1 Monthly API Call Projections (Broader Estimates)

**Assumptions:**
- 10,000 DAU × 30 days = 300,000 total user-days/month
- **Broader usage:** 8.8 features/user/day

| **Feature** | **Uses/User/Day** | **Monthly Uses** | **Total API Calls** | **Paid Calls** |
|-------------|------------------|-----------------|---------------------|----------------|
| Lesson Plan | 2.5 | 750,000 | 750,000 | 705,000 |
| Quiz Generator | 1.5 | 450,000 | 450,000 | 405,000 |
| Visual Aid | 0.8 | 240,000 | 480,000 (2 calls) | 435,000 |
| Voice Transcription | 1.2 | 360,000 | 360,000 | 315,000 |
| Instant Answer | 2.0 | 600,000 | 600,000 | 555,000 |
| Rubric/Worksheet | 0.5 | 150,000 | 150,000 | 105,000 |
| Other Features | 0.3 | 90,000 | 90,000 | 45,000 |
| **TOTAL** | **8.8** | **2,640,000** | **2,880,000** | **2,835,000** |

### 4.2 Token Consumption Estimate (10,000 DAU - Broader)

**Monthly Token Usage:**
- **Input Tokens:** ~1,580M tokens (3x from conservative)
- **Output Tokens:** ~2,110M tokens (3x from conservative)

**Cost Breakdown (₹):**
```
Input Cost:  1,580,000,000 × ₹6.22 / 1,000,000 = ₹9,827.60
Output Cost: 2,110,000,000 × ₹24.90 / 1,000,000 = ₹52,539.00
Image Cost:  240,000 images × ₹8.30 = ₹19,92,000.00
-------------------------------------------------------------
TOTAL TEXT API COST:    ₹62,366.60
TOTAL IMAGE API COST:   ₹19,92,000.00
-------------------------------------------------------------
GRAND TOTAL (10K DAU):  ₹20,54,367/month (~₹20.5 lakh)
```

**Comparison:**
- Conservative (3.0 features/day): ₹7,68,287
- **Broader (8.8 features/day): ₹20,54,367** ← **2.7x higher (realistic)**

### 4.3 Additional GCP Infrastructure Costs (10,000 DAU - Higher Traffic)

| **Service** | **Monthly Cost (₹)** | **Notes** |
|-------------|---------------------|-----------|
| Cloud Run (Compute) | ₹24,900-41,500 | 2.88M requests/month (3x) |
| Firestore (Database) | ₹8,300-16,600 | 5M reads, 1.5M writes (3x) |
| Firebase Storage | ₹4,150-8,300 | 150GB storage (3x) |
| Cloud Logging | ₹1,660-3,320 | 3x log volume |
| Cloud Build (CI/CD) | ₹415-830 | More deployments |
| CDN/Bandwidth | ₹2,490-4,150 | Increased traffic |
| **SUBTOTAL** | **₹41,915-74,700** | |

### 4.4 Total Cost @ 10,000 DAU (Broader Estimate)

```
API Costs:           ₹20,54,367
Infrastructure:      ₹58,000 (average)
---------------------------------------------
TOTAL MONTHLY COST:  ₹21,12,367 (~₹21.1 lakh)

Per-User Cost:       ₹211.24/user/month
```

**Comparison with Conservative:**
- Conservative: ₹7,97,287/month (~₹8 lakh)
- **Broader: ₹21,12,367/month (~₹21 lakh)** ← **2.65x higher (realistic for active teachers)**

### 4.5 Critical Insights

**Per-User Cost Consistency:**
- @ 1K DAU: ₹211.34/user
- @ 10K DAU: ₹211.24/user
- **Conclusion:** Costs scale linearly (good unit economics)

**Scaling Efficiency:**
- 10x users = 10x cost (no significant economies of scale yet)
- Optimization becomes critical as we grow
- Caching can reduce costs by 40% across all scales

---

## 5. Future Feature Expansion Scenarios

### 5.1 Scenario A: Moderate Growth (6-12 Months)

**New Features Planned:**
- Real-time Collaboration (WebSocket + Firestore)
- AI Tutor Chat (conversational AI)
- Automated Grading System
- Parent Progress Reports
- School Admin Dashboard

**Estimated Impact:**
- **+40% API calls** (AI Chat adds 1.5 calls/user/day)
- **+60% token consumption** (longer conversations)
- **+20% infrastructure** (real-time connections)

**Revised Costs (₹):**
```
@ 1,000 DAU:  ₹2,11,000 × 1.5 = ~₹3,17,000/month
@ 10,000 DAU: ₹21,12,000 × 1.5 = ~₹31,68,000/month
```

### 5.2 Scenario B: Aggressive Growth (12-24 Months)

**New Features Planned:**
- Voice-Enabled AI Assistant (24/7 support)
- Video Lesson Summarization (Gemini multimodal)
- Personalized Learning Paths (ML recommendations)
- Multilingual Support (10+ Indian languages)
- School District Integration (LMS APIs)

**Estimated Impact:**
- **+100% API calls** (video, voice, personalization)
- **+150% token consumption** (multimodal, longer responses)
- **+80% infrastructure** (video storage, CDN)

**Revised Costs (₹):**
```
@ 1,000 DAU:  ₹2,11,000 × 2.5 = ~₹5,28,000/month
@ 10,000 DAU: ₹21,12,000 × 2.5 = ~₹52,80,000/month
```

### 5.3 Feature Cost Impact Matrix (@ 10K DAU)

| **New Feature** | **API Calls/Use** | **Token Increase %** | **Monthly Cost Impact (₹)** |
|----------------|------------------|---------------------|----------------------------|
| AI Tutor Chat | 3-5 | +150% | +₹7,50,000 |
| Video Summarization | 1 | +200% | +₹4,50,000 |
| Voice Assistant | 2-4 | +80% | +₹3,50,000 |
| Automated Grading | 1 | +40% | +₹2,00,000 |
| Learning Paths | 0.5 | +20% | +₹1,25,000 |

---

## 6. Revenue Model & Profitability Analysis (B2G Model)

### 6.1 Government Contract Pricing (As per Investor Materials)

| **Contract Type** | **Price Structure** | **Target Customer** | **Sales Cycle** |
|-------------------|---------------------|---------------------|-----------------|
| **Pilot District** | ₹8-12 Lakh/1,000 teachers/year | District Education Officers | 9-18 months |
| **State Contract** | ₹50-200 Crore (volume discounts) | State Directors of Education | 12-24 months |
| **NGO Partnership** | ₹600-800/teacher/year (subsidized) | Tata Trusts, Azim Premji Foundation | 6-12 months |
| **NEAT Platform** | ₹400/teacher/year (govt-subsidized) | National EdTech Authority | 3-6 months |

**Blended Average Revenue:** ₹700-750/teacher/year (Year 2-5)

### 6.2 Cost vs Revenue Analysis (Critical for Government RFPs)

#### **Current State (Before Optimization):**

```
Per-Teacher Annual Cost: ₹211/month × 12 = ₹2,532/year
Per-Teacher Annual Revenue: ₹700-1,000/year (government contracts)
---------------------------------------------------
GROSS MARGIN: NEGATIVE (-60% to -150%)
```

**⚠️ CRITICAL ISSUE:** Current model loses money on every teacher!

#### **After Optimization (Target):**

```
Optimizations Implemented:
1. Caching (40% reduction): ₹2,532 → ₹1,519/year
2. Pre-generated visual aids (30% further): ₹1,519 → ₹1,063/year
3. Model routing (10% further): ₹1,063 → ₹957/year

Final Per-Teacher Cost: ₹957/year
Government Revenue: ₹1,000/year
---------------------------------------------------
GROSS MARGIN: 4% (break-even, need further optimization)
```

**✅ TARGET STATE (With Scale + Fine-Tuned Model):**

```
Fine-tuned model + aggressive caching: ₹957 → ₹500/year
Government Revenue: ₹1,000/year
---------------------------------------------------
GROSS MARGIN: 50% (Acceptable for B2G SaaS)
```

### 6.3 Year 1 Profitability Analysis (50,000 Teachers)

**Scenario: 10 Pilot Districts**

**Revenue (Year 1):**
```
50,000 teachers × ₹600/year (pilot pricing) = ₹3.0 Crore
```

**Costs (Year 1 - Before Optimization):**
```
API Costs: 50,000 DAU × ₹211/month × 12 = ₹12.66 Crore
Infrastructure: ₹58,000/month × 12 × 5 = ₹34.8 Lakh
Total COGS: ₹13.01 Crore

Sales & Marketing (35% of OpEx): ₹4.5 Crore (tender prep, pilots)
Engineering & Product (30%): ₹3.5 Crore
Regional Support (20%): ₹2.5 Crore
Admin (15%): ₹1.5 Crore
Total OpEx: ₹12.0 Crore
---------------------------------------------------
TOTAL COSTS: ₹25.01 Crore
NET LOSS: -₹22.01 Crore
```

**Costs (Year 1 - With Optimization):**
```
Optimized API Costs: ₹13.01 Crore × 0.4 = ₹5.20 Crore (60% reduction)
OpEx: ₹12.0 Crore (same)
---------------------------------------------------
TOTAL COSTS: ₹17.20 Crore
NET LOSS: -₹14.20 Crore

REQUIRES: ₹17 Crore Series A funding for Year 1
```

### 6.4 Path to Profitability (Year 2-3)

| **Year** | **Teachers** | **Revenue (₹ Cr)** | **Optimized COGS (₹ Cr)** | **OpEx (₹ Cr)** | **EBITDA (₹ Cr)** | **Margin %** |
|----------|--------------|-------------------|--------------------------|----------------|------------------|--------------|
| **Year 1 (2026)** | 50,000 | 3.0 | 5.2 | 12.0 | -14.2 | -473% |
| **Year 2 (2027)** | 250,000 | 16.25 | 12.0 (volume discounts) | 8.5 | -4.25 | -26% |
| **Year 3 (2028)** | 750,000 | 52.5 | 22.5 (fine-tuned model) | 15.0 | +15.0 | **+28%** |
| **Year 4 (2029)** | 1,500,000 | 108.75 | 36.0 | 25.0 | +47.75 | **+44%** |
| **Year 5 (2030)** | 3,000,000 | 225.0 | 63.0 | 40.0 | +122.0 | **+54%** |

**Profitability Achieved:** Year 3 (2028) with 750,000 teachers

### 6.5 Government Contract Win Strategy

**Key Success Factors:**

1. **Outcome-Based Pricing:**
   - Link payment to student learning outcomes (NCERT assessment scores)
   - Reduces government risk, increases adoption

2. **Pilot Program Success Metrics:**
   - 20% reduction in lesson prep time (measured)
   - 15% improvement in student engagement (feedback surveys)
   - 90% teacher satisfaction rate

3. **Cost Optimization Timeline:**
   - Month 3: Implement caching (40% savings)
   - Month 6: Pre-generate 500 NCERT visual aids (30% savings)
   - Month 12: Fine-tune custom model (50% total savings)

4. **NGO Partnership Revenue:**
   - Tata Trusts: 10,000 teachers @ ₹800/year = ₹80 Lakh/year
   - Azim Premji Foundation: 15,000 teachers @ ₹800/year = ₹1.2 Crore/year
   - **Total NGO Revenue (Year 1):** ₹2 Crore (helps offset losses)

### 6.6 Break-Even Analysis (Government Model)

**Option A: Conservative (No Optimization)**
- Need ₹2,532/teacher revenue to break even
- **Not viable** - government RFPs cap at ₹1,000/teacher

**Option B: With Full Optimization**
- Cost reduced to ₹500/teacher/year
- Revenue: ₹1,000/teacher/year
- **Gross Margin: 50%** → Sustainable model

**Option C: Hybrid (NGO Subsidy)**
- Government pays: ₹600/teacher
- NGO subsidy: ₹400/teacher
- Total revenue: ₹1,000/teacher
- **Enables Year 1-2 growth** while optimizing costs

---

## 7. Cost Optimization Strategies

### 7.1 Immediate Actions (0-3 Months) - High Priority

#### **Priority 1: Implement Caching (CRITICAL)**
- **Target:** Reduce API calls by 30-40%
- **Method:** Cache lesson plans in Firestore for 7 days
- **Implementation:**
  - Hash input parameters (topic, grade, language)
  - Store generated content with TTL (time-to-live)
  - Return cached version if available
- **Estimated Savings:**
  - @ 1K DAU: ₹63,000/month (30% of ₹2,11,000)
  - @ 10K DAU: ₹6,34,000/month

#### **Priority 2: Optimize Visual Aid Generation**
- **Target:** Reduce image costs by 70%
- **Method:**
  - Pre-generate common visual aids (100 NCERT topics)
  - Cache user-generated images for 30 days
  - Reduce from ₹8.30 to ₹2.50 per image (use cheaper model)
- **Estimated Savings:**
  - @ 1K DAU: ₹1,25,000/month (saves 63% of total cost!)
  - @ 10K DAU: ₹12,50,000/month

#### **Priority 3: Rate Limiting**
- **Target:** Prevent abuse, reduce free user costs
- **Method:**
  - Free users: 10 requests/day
  - Basic users: 50 requests/day
  - Pro users: Unlimited
- **Estimated Savings:**
  - @ 1K DAU: ₹35,000/month
  - @ 10K DAU: ₹3,50,000/month

### 7.2 Medium-Term Actions (3-6 Months)

#### **Optimize Prompts**
- Reduce average input tokens by 20% (shorter, more efficient prompts)
- **Savings:** ₹1,00,000/month @ 10K DAU

#### **Model Routing**
- Use cheaper `gemini-1.5-flash` for simple tasks (Instant Answers, etc.)
- **Savings:** ₹75,000/month @ 10K DAU

#### **Batch Requests**
- Combine multiple quiz questions into 1 API call
- **Savings:** ₹50,000/month @ 10K DAU

### 7.3 Long-Term Actions (6-12 Months)

#### **Fine-Tune Custom Model**
- Train smaller model specifically for Indian curriculum
- **Savings:** 50% reduction in token costs = ₹10,00,000/month @ 10K DAU

#### **Self-Hosted Inference (Advanced)**
- Host open-source LLM on GCP Compute Engine
- **Savings:** 80% reduction in API costs (but +₹2,00,000 infrastructure)
- **Net Savings:** ₹15,00,000/month @ 10K DAU

---

## 8. Budget Recommendations

### 8.1 Startup Phase (0-500 DAU)

**Monthly Budget:** ₹50,000-1,00,000
- API Costs: ₹25,000-50,000
- Infrastructure: ₹10,000-20,000
- Buffer (20%): ₹10,000-20,000
- Marketing: ₹5,000-10,000
- **Funding Source:** Bootstrapped / Angel Investment

**Runway:** 6 months with ₹3L initial capital

### 8.2 Growth Phase (500-5,000 DAU)

**Monthly Budget:** ₹2,00,000-5,00,000
- API Costs: ₹1,00,000-2,50,000
- Infrastructure: ₹30,000-75,000
- Marketing (30%): ₹60,000-1,50,000
- Team Support: ₹10,000-25,000
- **Funding Source:** Seed Round (₹50L-₹2Cr)

**Runway:** 12 months with ₹50L seed funding

### 8.3 Scale Phase (5,000-50,000 DAU)

**Monthly Budget:** ₹10,00,000-40,00,000
- API Costs: ₹5,00,000-20,00,000
- Infrastructure: ₹1,50,000-5,00,000
- Team (Full-time support): ₹2,00,000-8,00,000
- Marketing (30%): ₹1,50,000-7,00,000
- **Funding Source:** Series A (₹5Cr-₹20Cr)

---

## 9. Financial Projections (12-Month Roadmap)

### 9.1 Conservative Growth Path (Without Aggressive Marketing)

| **Month** | **DAU** | **API Cost (₹)** | **Infra (₹)** | **Total Cost (₹)** | **Revenue (₹)** | **Net (₹)** |
|-----------|---------|----------------|---------------|-------------------|----------------|------------|
| 1-2 | 200 | 42,000 | 6,000 | 48,000 | 8,000 | -40,000 |
| 3-4 | 500 | 1,06,000 | 12,000 | 1,18,000 | 25,000 | -93,000 |
| 5-6 | 1,000 | 2,11,000 | 20,000 | 2,31,000 | 50,000 | -1,81,000 |
| 7-9 | 2,500 | 5,28,000 | 40,000 | 5,68,000 | 1,50,000 | -4,18,000 |
| 10-12 | 5,000 | 10,56,000 | 75,000 | 11,31,000 | 3,50,000 | -7,81,000 |
| **Total** | | | | **20,96,000** | **5,83,000** | **-15,13,000** |

**Total Capital Required:** ₹20 lakh for first year  
**Burn Rate:** ₹1.5-2 lakh/month average

### 9.2 Optimistic Growth Path (With B2B Focus)

| **Month** | **DAU** | **API Cost (₹)** | **Infra (₹)** | **Total Cost (₹)** | **Revenue (₹)** | **Net (₹)** |
|-----------|---------|----------------|---------------|-------------------|----------------|------------|
| 1-2 | 300 | 63,000 | 8,000 | 71,000 | 15,000 | -56,000 |
| 3-4 | 800 | 1,69,000 | 15,000 | 1,84,000 | 80,000 | -1,04,000 |
| 5-6 | 2,000 | 4,23,000 | 30,000 | 4,53,000 | 2,50,000 | -2,03,000 |
| 7-9 | 5,000 | 10,56,000 | 60,000 | 11,16,000 | 7,50,000 | -3,66,000 |
| 10-12 | 10,000 | 21,12,000 | 1,00,000 | 22,12,000 | 16,00,000 | -6,12,000 |
| **Total** | | | | **39,36,000** | **26,95,000** | **-12,41,000** |

**Profitability Achieved:** Month 13-14 with:
- 15K DAU
- 200 School plans (40K monthly revenue)
- 1,000 Pro users (3L monthly revenue)

---

## 10. Risk Assessment & Mitigation

### 10.1 High-Risk Scenarios

| **Risk** | **Probability** | **Impact (₹)** | **Mitigation Strategy** |
|----------|----------------|---------------|------------------------|
| API Pricing Increase (50%) | Medium | +₹10L/month @ 10K DAU | Lock annual contract, diversify providers |
| User Growth Outpaces Revenue | High | Burn ₹20L/month | Enforce stricter free tier, focus B2B |
| Model Quality Degradation | Low | User churn | A/B test alternatives, maintain fallbacks |
| Competitor with Free Offering | Medium | Revenue loss | Focus on premium features, NCERT alignment |
| GCP Outage | Low | Lost revenue (1-2 days) | Multi-cloud backup (AWS Bedrock) |

### 10.2 Cost Spike Triggers & Alerts

**Set Up Billing Alerts in GCP:**
1. ₹1,00,000/month → Review free tier usage
2. ₹3,00,000/month → Implement caching immediately
3. ₹10,00,000/month → Activate full optimization plan
4. ₹20,00,000/month → Emergency cost review meeting

---

## 11. Conclusion & Actionable Recommendations

### 11.1 Key Takeaways

✅ **Realistic Costs are 2.7x Higher:** ₹2.1L @ 1K DAU vs ₹0.8L conservative  
✅ **Per-User Economics Stable:** ₹211/user across all scales (good!)  
✅ **Image Generation is 94% of Cost:** Critical optimization target  
✅ **B2B is Non-Negotiable:** School plans essential for profitability  
✅ **Caching Can Save 40%:** Immediate implementation needed  

### 11.2 Top 3 Immediate Actions (This Week)

**1. Implement Firestore Caching (Saves ₹63K/month @ 1K DAU)**
```typescript
// Priority: CRITICAL
// Timeline: 1 week
// Impact: 30% cost reduction
```

**2. Optimize Visual Aid Feature (Saves ₹1.25L/month @ 1K DAU)**
- Pre-generate 100 common NCERT visual aids
- Cache all generated images for 30 days
- Switch to cheaper image model where acceptable

**3. Launch School Pilot Program (Generate ₹50K/month revenue)**
- Target 10 schools at ₹4,999/month
- Offer 1-month free trial
- Focus on Delhi NCR, Bangalore, Mumbai

### 11.3 Funding Strategy

**Recommended Raise:** ₹50L-₹1Cr Seed Round  
**Valuation:** ₹4Cr-₹8Cr (pre-money)  
**Runway:** 12-18 months to profitability  

**Use of Funds:**
- 50% (₹25L-50L) → API/Infrastructure costs
- 30% (₹15L-30L) → B2B Marketing & Sales
- 20% (₹10L-20L) → Team (2-3 engineers, 1 sales)

### 11.4 Success Metrics (Next 6 Months)

**User Growth:**
- Month 3: 500 DAU
- Month 6: 2,000 DAU
- Month 12: 10,000 DAU

**Revenue Growth:**
- Month 3: ₹25K MRR
- Month 6: ₹2.5L MRR
- Month 12: ₹15L MRR

**Cost Optimization:**
- Month 3: Implement caching (30% savings)
- Month 6: Launch pre-generated visual aids (60% savings on images)
- Month 12: Fine-tune custom model (50% overall savings)

---

## 12. Quick Reference Summary Table

| **Metric** | **1,000 DAU** | **10,000 DAU** | **Notes** |
|------------|--------------|----------------|-----------|
| **Monthly API Cost** | ₹2,05,437 | ₹20,54,367 | Based on 8.8 features/day |
| **Monthly Infrastructure** | ₹5,900 | ₹58,000 | Scales linearly |
| **Total Monthly Cost** | ₹2,11,337 | ₹21,12,367 | ~₹2.1L vs ₹21L |
| **Per-User Cost** | ₹211.34 | ₹211.24 | Consistent! |
| **Revenue (Current Model)** | ₹22,040 | ₹2,20,400 | 5% Basic, 0.7% Pro, 0.3% School |
| **Net Loss** | -₹1,89,297 | -₹18,91,967 | Need B2B focus |
| **Break-Even Users** | 800 Pro | 8,000 Pro | Or 42 Schools vs 425 Schools |
| **Realistic Path** | 50 Schools | 150 Schools | More achievable |

---

**Next Steps:**
1. ✅ Review this analysis with team/investors
2. ✅ Set up GCP billing alerts (₹1L, ₹3L, ₹10L thresholds)
3. ✅ Allocate ₹2.5L/month initial operating budget
4. ✅ Implement caching (Sprint 1 - highest priority)
5. ✅ Launch 10-school pilot program (Month 2)
6. ✅ Begin fundraising for ₹50L-1Cr seed round

**Document Version:** 2.0 (Broader Estimates)  
**Last Updated:** 28 January 2026  
**Prepared by:** FinOps Engineering Team  
**Contact:** finance@sahayakai.com
