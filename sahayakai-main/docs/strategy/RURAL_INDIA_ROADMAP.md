# Rural India Adaptation - Implementation Roadmap

**Last updated:** 2026-06-10

> Framing note: this roadmap targets the low-resource classroom segment. The same features serve all school types via the `resourceLevel` setting. SahayakAI addresses India's systemic education-quality crisis broadly, not rural government schools alone.

## 🎯 Branch: feature/rural-india-adaptation

### Mission
Make SahayakAI a practical, robust tool for low-resource classrooms in India (Grades 5-10), as one segment of a broader all-school-type platform.

---

## 📋 Phase 1: Foundation (Week 1-2) - IMMEDIATE

### 1.1 Local Context & Examples ✅ STARTING HERE
**Goal:** Make content feel Indian, not Western

**Status:** In Progress

**Tasks:**
- [x] Update all AI prompts to use Indian context by default
- [ ] Add "Rural Context" toggle in settings
- [ ] Create Indian example database (farming, monsoon, local festivals, etc.)
- [ ] Update lesson plan prompts with local examples
- [ ] Update quiz prompts with Indian context
- [ ] Test with sample generations

**Notes:**
- A UI bug in the rubric generator causing duplicate points has been fixed. This improves the user experience for a key feature.

**Files to Modify:**
- `src/ai/flows/lesson-plan-generator.ts`
- `src/ai/flows/quiz-generator.ts`
- `src/ai/flows/rubric-generator.ts`
- Create: `src/lib/indian-context.ts` (example database)

**Success Criteria:**
- ✅ Examples use "roti" not "pizza"
- ✅ Weather examples use "monsoon" not "snow"
- ✅ Math problems use Indian currency (₹)
- ✅ Geography uses Indian locations
- ✅ Festivals and cultural references are Indian

---

### 1.2 Resource-Aware Content
**Goal:** Generate content that works with zero/minimal resources

**Tasks:**
- [ ] Add "Available Resources" selector to all tools
  - Options: Chalk & Blackboard Only, Basic (+ Chart Paper), Standard (+ Some Books), Full
- [ ] Update AI prompts to respect resource constraints
- [ ] Add "Zero-Cost Alternative" suggestions
- [ ] Create resource-aware activity database

**Files to Modify:**
- `src/components/resource-selector.tsx` (NEW)
- `src/ai/flows/lesson-plan-generator.ts`
- Update all generator prompts

**Success Criteria:**
- ✅ "Chalk & Blackboard Only" generates practical lessons
- ✅ No suggestions for projectors, computers, labs unless resources allow
- ✅ Activities use locally available materials (stones, leaves, etc.)

---

### 1.3 NCERT Chapter Mapping (Critical!)
**Goal:** Align content with actual curriculum

**Tasks:**
- [ ] Create NCERT chapter database for grades 5-10
  - Mathematics
  - Science
  - Social Studies
  - English
  - Hindi
- [ ] Add chapter selector to lesson plan tool
- [ ] Map learning outcomes to chapters
- [ ] Update prompts to reference specific chapters

**Files to Create:**
- `src/data/ncert/` (directory)
  - `mathematics.ts`
  - `science.ts`
  - `social-studies.ts`
  - `english.ts`
  - `hindi.ts`

**Files to Modify:**
- `src/components/ncert-chapter-selector.tsx` (NEW)
- `src/app/lesson-plan/page.tsx`
- `src/ai/flows/lesson-plan-generator.ts`

**Success Criteria:**
- ✅ Teacher can select "Class 6 > Mathematics > Chapter 3: Playing with Numbers"
- ✅ Generated content matches chapter exactly
- ✅ Learning outcomes are explicitly stated
- ✅ Textbook page references included

---

## 📋 Phase 2: Offline & Performance (Week 3-4)

### 2.1 Progressive Web App (PWA)
**Goal:** Make app installable and work offline

**Tasks:**
- [ ] Configure Next.js for PWA
- [ ] Add service worker
- [ ] Implement offline caching strategy
- [ ] Add install prompt
- [ ] Test offline functionality

**Files to Create:**
- `public/manifest.json`
- `public/sw.js`
- `next.config.js` (update)

**Success Criteria:**
- ✅ App can be installed on phone
- ✅ Works without internet for cached content
- ✅ Syncs when internet available

---

### 2.2 Quick Templates
**Goal:** Generate content in < 5 seconds

**Tasks:**
- [ ] Create pre-generated template library
- [ ] Add "Quick Start" templates for common topics
- [ ] Implement template customization
- [ ] Add favorites/bookmarks

**Files to Create:**
- `src/data/templates/` (directory)
- `src/components/quick-templates.tsx`

**Success Criteria:**
- ✅ Common topics load instantly
- ✅ Teacher can customize template in 2 minutes
- ✅ Batch generation for week's content

---

## 📋 Phase 3: Differentiation & Assessment (Week 5-6)

### 3.1 Multi-Level Content
**Goal:** Support diverse student abilities

**Tasks:**
- [ ] Add difficulty level selector (Remedial, Standard, Advanced)
- [ ] Generate 3 versions of same content
- [ ] Add scaffolding for struggling students
- [ ] Add extension activities for advanced

**Files to Modify:**
- All generator flows
- Add: `src/components/difficulty-selector.tsx`

**Success Criteria:**
- ✅ One topic, three difficulty levels
- ✅ Remedial version uses simpler language
- ✅ Advanced version has challenging questions

---

### 3.2 Board Exam Alignment
**Goal:** Match actual exam patterns

**Tasks:**
- [ ] Add board exam pattern database (CBSE, State Boards)
- [ ] Include previous year question patterns
- [ ] Add marking schemes
- [ ] Include diagram-based questions

**Files to Create:**
- `src/data/exam-patterns/`

**Success Criteria:**
- ✅ Quiz matches board exam format
- ✅ Marking scheme included
- ✅ Difficulty progression (easy → hard)

---

## 📋 Phase 4: Community & Support (Week 7-8)

### 4.1 Parent Communication
**Goal:** Help parents support learning

**Tasks:**
- [ ] Generate parent-friendly summaries
- [ ] Simple language homework assignments
- [ ] Progress reports in regional languages

**Files to Create:**
- `src/components/parent-summary.tsx`

---

### 4.2 Teacher Collaboration
**Goal:** Build community

**Tasks:**
- [ ] Add content sharing
- [ ] Rating and review system
- [ ] Community library
- [ ] Feedback mechanism

---

## 🎯 Success Metrics

### Immediate (Phase 1):
- [ ] 80% of examples use Indian context
- [ ] 100% of lessons work with chalk & blackboard
- [ ] NCERT chapters mapped for at least 3 subjects

### Short-term (Phase 2):
- [ ] App works offline
- [ ] Template generation < 5 seconds
- [ ] 50+ quick templates available

### Medium-term (Phase 3):
- [ ] 3 difficulty levels for all content
- [ ] Board exam patterns for CBSE + 2 state boards

### Long-term (Phase 4) targets:
- [ ] Regular active teachers: `TODO(verify: active teacher count)`
- [ ] Shared lesson plans: `TODO(verify: shared lesson plan count)`
- [ ] Teacher satisfaction: `TODO(verify: teacher satisfaction %)`

---

## 📊 Current Status

**Branch:** `feature/rural-india-adaptation`
**Phase:** Phase 1 - Foundation
**Next Task:** 1.1 Local Context & Examples

**Challenging Questions Score:** `TODO(verify: challenging-questions self-assessment score)`

---

## 🚀 Let's Start!

**First Implementation:** Local Context & Examples
**Impact:** HIGH - Makes content immediately more relevant

*Last Updated: 2026-06-10*
