# Challenging Questions for SahayakAI (Indian Classroom Context)

**Last updated:** 2026-06-10

**Current self-assessment score:** `TODO(verify: challenging-questions self-assessment score)` (the previously stated 91% was an unverified self-rating).

> Framing note: these questions stress-test low-resource classroom conditions, one important segment. SahayakAI serves all school types.

These questions help ensure SahayakAI works in REAL-WORLD conditions, not just ideal scenarios. Each question represents an actual challenge faced by teachers in India.

---

## 🔴 CRITICAL SCENARIOS (Deal Breakers)

### Infrastructure & Connectivity
1. **"Does it work when the power is out, internet is down, and the teacher has 5 minutes to prepare for 50 students with no textbooks?"**
   - Tests: Offline mode, speed, resource awareness
   - Current Answer: ✅ Yes (Offline Mode + Pre-loaded Plans)
   - Target: ✅ Yes

2. **"Can a teacher with a basic smartphone and 2G internet use this effectively?"**
   - Tests: Mobile optimization, low bandwidth, data usage
   - Current Answer: ✅ Yes (PWA caches content, minimal data needed)
   - Target: ✅ Yes

3. **"If the app crashes mid-lesson, can the teacher continue without losing work?"**
   - Tests: Auto-save, offline caching, recovery
   - Current Answer: ✅ Yes (Auto-save draft implemented)
   - Target: ✅ Yes

4. **"Can a teacher download a week's worth of content on Sunday and use it all week offline?"**
   - Tests: Bulk download, offline storage, sync
   - Current Answer: ✅ Yes (Offline database enables this capability)
   - Target: ✅ Yes

### Resource Constraints
5. **"Can a teacher create a science lesson without assuming access to a lab, computer, or projector?"**
   - Tests: Resource-aware content, zero-cost alternatives
   - Current Answer: ✅ Yes (Resource Selector: Low)
   - Target: ✅ Yes

6. **"Can a teacher with only chalk and a blackboard implement the generated lesson plan?"**
   - Tests: Material requirements, practical activities
   - Current Answer: ✅ Yes (Explicitly handled by "Low" resource setting)
   - Target: ✅ Yes

7. **"If the school has only 10 copies for 50 students, can the worksheet still work?"**
   - Tests: Group activities, oral assessments, alternatives
   - Current Answer: ✅ Yes (Prompts suggest blackboard alternatives)
   - Target: ✅ Yes

### Time Constraints
8. **"Can a teacher generate and print a lesson plan in the 10-minute break between classes?"**
   - Tests: Speed, quick templates, print optimization
   - Current Answer: ✅ Yes (Quick Templates + Offline Plans = Instant)
   - Target: ✅ Yes

9. **"Can a teacher prepare for tomorrow's 6 classes in 30 minutes after school?"**
   - Tests: Batch generation, templates, efficiency
   - Current Answer: ✅ Yes (Fast generation with templates)
   - Target: ✅ Yes

10. **"Can a teacher modify a generated lesson plan in 2 minutes when the original plan doesn't work?"**
    - Tests: Edit functionality, quick adjustments
    - Current Answer: ✅ Yes (Direct Edit UI implemented)
    - Target: ✅ Yes

---

## 🟠 CURRICULUM & QUALITY

### Syllabus Alignment
11. **"Will this lesson plan help students pass the board exam?"**
    - Tests: NCERT alignment, exam pattern, learning outcomes
    - Current Answer: ✅ Yes (Strict NCERT alignment)
    - Target: ✅ Definitely

12. **"Does this quiz match the difficulty level of last year's board exam?"**
    - Tests: Question patterns, marking scheme, difficulty
    - Current Answer: ✅ Yes (Differentiation levels help match rigor)
    - Target: ✅ Yes

13. **"Can a teacher trust this content without cross-checking the textbook?"**
    - Tests: Accuracy, curriculum mapping, reliability
    - Current Answer: ✅ Yes (Mapped to specific chapters/outcomes)
    - Target: ✅ Yes

14. **"Does this cover the specific learning outcomes mentioned in the NCERT curriculum?"**
    - Tests: Learning outcome mapping, competency alignment
    - Current Answer: ✅ Yes (Explicitly selected in UI)
    - Target: ✅ Yes

### Language & Localization
15. **"Will a student from a Hindi-medium school understand this English lesson plan?"**
    - Tests: Language simplicity, code-mixing, translation quality
    - Current Answer: ⚠️ Partial (Hindi titles/prompts supported, full UI pending)
    - Target: ✅ Yes

16. **"Does this use examples that rural students can relate to (farming, local festivals, etc.)?"**
    - Tests: Cultural relevance, local context, examples
    - Current Answer: ✅ Yes (Indian Context Library implemented)
    - Target: ✅ Yes

17. **"Can a parent with 5th-grade education understand the homework assignment?"**
    - Tests: Simple language, parent communication, clarity
    - Current Answer: ✅ Yes (Remedial level + simple language prompts)
    - Target: ✅ Yes

---

## 🟡 CLASSROOM REALITY

### Student Diversity
18. **"In a class where reading levels range from 2nd grade to 8th grade, can all students participate?"**
    - Tests: Differentiation, multi-level activities, inclusion
    - Current Answer: ✅ Yes (Differentiation: Remedial/Standard/Advanced)
    - Target: ✅ Yes

19. **"Can a teacher use this for a class with 20 students who don't speak Hindi/English well?"**
    - Tests: Regional language quality, visual aids, oral activities
    - Current Answer: ⚠️ Partial (Visual aids help, full regional support pending)
    - Target: ✅ Yes

20. **"Will this work for a combined class of 5th and 6th graders (common in small schools)?"**
    - Tests: Multi-grade content, flexible activities
    - Current Answer: ⚠️ Partial (Can generate for multiple grades, but specific strategy needed)
    - Target: ✅ Yes

### Practical Implementation
21. **"Can a teacher implement this lesson without any prior training or tech skills?"**
    - Tests: Simplicity, clear instructions, ease of use
    - Current Answer: ✅ Yes (Simple UI, Offline mode is intuitive)
    - Target: ✅ Yes

22. **"If a student asks 'Why do we need to learn this?', does the lesson plan have an answer?"**
    - Tests: Real-world relevance, practical applications
    - Current Answer: ✅ Yes (Contextual examples provide relevance)
    - Target: ✅ Always

23. **"Can this lesson be completed in one 40-minute period, including setup and cleanup?"**
    - Tests: Time estimation, realistic planning
    - Current Answer: ✅ Yes (Duration explicitly handled in prompts)
    - Target: ✅ Yes

---

## 🟢 TEACHER SUPPORT

### Collaboration & Community
24. **"Can a teacher share this lesson plan with a colleague who teaches in a different language?"**
    - Tests: Sharing, translation, collaboration
    - Current Answer: ⚠️ Partial (Copy-paste possible, auto-translate pending)
    - Target: ✅ Yes

25. **"Can teachers in a cluster of schools build a shared library of best practices?"**
    - Tests: Community features, content sharing, ratings
    - Current Answer: ❌ No (Community features not built yet)
    - Target: ✅ Yes

26. **"If this lesson fails in the classroom, can the teacher report it and get alternatives?"**
    - Tests: Feedback mechanism, alternatives, improvement
    - Current Answer: ❌ No (Feedback loop pending)
    - Target: ✅ Yes

### Professional Development
27. **"Does this help a new teacher become better at teaching over time?"**
    - Tests: Learning from examples, best practices, guidance
    - Current Answer: ✅ Yes (High-quality templates serve as examples)
    - Target: ✅ Yes (with explanations and tips)

28. **"Can a teacher understand WHY a particular teaching method is suggested?"**
    - Tests: Pedagogical reasoning, teacher notes, rationale
    - Current Answer: ⚠️ Partial (Implicit in plan, not explicit notes)
    - Target: ✅ Yes

---

## 🔵 STUDENT OUTCOMES

### Learning Impact
29. **"Will students remember this lesson next week? Next month? For the exam?"**
    - Tests: Retention strategies, revision, reinforcement
    - Current Answer: ⚠️ Unknown (Needs longitudinal testing)
    - Target: ✅ Yes (with built-in revision)

30. **"Can a struggling student catch up using the materials generated?"**
    - Tests: Remedial content, self-study, scaffolding
    - Current Answer: ✅ Yes (Remedial differentiation level)
    - Target: ✅ Yes

31. **"Will this help students develop critical thinking, not just memorization?"**
    - Tests: Question types, activities, depth
    - Current Answer: ✅ Yes (Advanced differentiation level focuses on this)
    - Target: ✅ Yes

### Assessment Quality
32. **"Can a teacher identify exactly which students understood the concept using this quiz?"**
    - Tests: Diagnostic quality, formative assessment
    - Current Answer: ⚠️ Partial (Basic assessment included)
    - Target: ✅ Yes (detailed diagnostics)

33. **"Does the rubric help students understand what 'good work' looks like?"**
    - Tests: Clarity, examples, student-friendly language
    - Current Answer: ⚠️ Partial
    - Target: ✅ Yes (student-friendly too)

---

## 🟣 SYSTEM & SUSTAINABILITY

### Reliability
34. **"If 1000 teachers try to use this during exam time, will it still work?"**
    - Tests: Scalability, server capacity, performance
    - Current Answer: ✅ Yes (Offline mode + Semantic Caching + Firestore + IndexedDB)
    - Target: ✅ Yes

35. **"Can a teacher rely on this for an inspection or demonstration lesson?"**
    - Tests: Quality, formatting, alignment
    - Current Answer: ✅ Yes (NCERT aligned, professional PDF output)
    - Target: ✅ Yes

36. **"How do we know if the lesson plan actually worked in the classroom?"**
    - Tests: Feedback loop, analytics
    - Current Answer: ✅ Yes (Feedback Loop & Telemetry implemented)
    - Target: ✅ Yes

### Data & Privacy
37. **"Can this work without collecting personal data from students?"**
    - Tests: Privacy, COPPA compliance, minimal data
    - Current Answer: ✅ Yes
    - Target: ✅ Maintain

---

## 🎯 SPECIAL SCENARIOS

### Edge Cases
38. **"Can this help a teacher who is teaching a subject they're not trained in?"**
    - Tests: Explanations, background info, teaching tips
    - Current Answer: ✅ Yes (Detailed plans + NCERT alignment guide them)
    - Target: ✅ Yes

39. **"Can a substitute teacher use this to teach a class they know nothing about?"**
    - Tests: Completeness, clarity, step-by-step guidance
    - Current Answer: ✅ Yes (Quick Templates + Offline Plans are instant)
    - Target: ✅ Yes

40. **"Can this work in a school where students speak 5 different languages?"**
    - Tests: Multilingual support, visual learning, flexibility
    - Current Answer: ❌ No (Needs specific multilingual features)
    - Target: ✅ Yes

### Innovation
41. **"Can this help teachers try new teaching methods they've never used before?"**
    - Tests: Variety, innovation, guidance
    - Current Answer: ✅ Yes (AI suggests creative activities)
    - Target: ✅ Yes

42. **"Does this make teaching more enjoyable for the teacher?"**
    - Tests: User experience, satisfaction, motivation
    - Current Answer: ✅ Yes (Reduces drudgery of planning)
    - Target: ✅ Yes

---

## 📊 SCORING SYSTEM

For each question:
- ✅ **Yes** = 2 points (Fully addresses the challenge)
- ⚠️ **Partial** = 1 point (Partially addresses)
- ❌ **No** = 0 points (Doesn't address)
- ❓ **Unknown** = 0 points (Needs testing)

**Current Score:** `TODO(verify: challenging-questions self-assessment score)`
**Target Score:** 80+/84 (95%+)

---

## 🎯 HOW TO USE THIS

### For Development:
1. Before adding a feature, ask: "Which questions does this answer?"
2. Prioritize features that answer multiple critical (🔴) questions
3. Test each feature against relevant questions

### For Testing:
1. Use these as acceptance criteria
2. Real-world testing with actual teachers
3. Iterate based on answers

### For Product Decisions:
1. If a feature doesn't answer any question, reconsider it
2. Focus on moving ❌ to ⚠️ to ✅
3. Prioritize questions that teachers ask most

---

## 📝 ADDING NEW QUESTIONS

When you encounter a real teacher challenge, add it here:

**Template:**
```
### Category
X. **"[Question from teacher's perspective]"**
   - Tests: [What this tests]
   - Current Answer: [✅/⚠️/❌/❓]
   - Target: [✅ with explanation]
```

---

**Remember:** If we can answer "Yes" to most of these questions, SahayakAI will be truly useful for rural Indian teachers, not just a nice demo.

*Last Updated: 2026-06-10*
