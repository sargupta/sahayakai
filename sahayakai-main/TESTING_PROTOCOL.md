# SahayakAI — QA & Testing Protocol

> Run this checklist before every production deployment. Each section maps to a user-reported bug cluster. Cover at least **Kannada** as the non-English language in every AI flow test.

---

## 0. Pre-flight

| Check | Pass? |
|-------|-------|
| `npm run build` exits 0 | ☐ |
| `npm run lint` exits 0 | ☐ |
| No TypeScript errors (`tsc --noEmit`) | ☐ |
| `.env.local` has all required secrets | ☐ |

---

## 1. Authentication & Middleware

| Test | Expected | Pass? |
|------|----------|-------|
| Open any `/api/ai/*` route without login | 401 Unauthorized | ☐ |
| Open app while logged out → protected page | Redirect / auth modal | ☐ |
| Login with Google → refresh → still logged in | Session persists | ☐ |

---

## 2. Lesson Plan Page

| Test | Expected | Pass? |
|------|----------|-------|
| Select **Kannada**, Class 7, topic in Kannada script → Generate | Entire plan in Kannada (title, objectives, activities, tips) | ☐ |
| Select **Hindi**, generate | Entire plan in Hindi | ☐ |
| Open Advanced Options **without selecting a class** | NCERT section shows with hint "Select a class above…" (NOT hidden) | ☐ |
| Open Advanced Options **after selecting Class 6** | NCERTChapterSelector renders with chapter list | ☐ |
| Select an NCERT chapter → click Generate | Plan title includes chapter name | ☐ |
| Open library → click saved lesson-plan | Navigates to `/lesson-plan?id=XXX`, plan loads | ☐ |
| Cloud cache hit (same topic+grade+language second time) | `☁️ Community Cache` toast OR `⚡ Instant Load` toast | ☐ |

---

## 3. Instant Answer Page

| Test | Expected | Pass? |
|------|----------|-------|
| Select **Kannada**, ask a question in Kannada | Answer fully in Kannada | ☐ |
| Open library → click saved instant-answer | Navigates to `/instant-answer?id=XXX`, question pre-filled, previous answer displayed | ☐ |
| Ask question → check video suggestion URL format | URL starts with `https://www.youtube.com/results?search_query=` | ☐ |

---

## 4. Visual Aid Designer

| Test | Expected | Pass? |
|------|----------|-------|
| Select **Kannada**, generate a diagram | Image generated; pedagogicalContext and discussionSpark in Kannada | ☐ |
| Generate image → verify it appears | Image renders in result card | ☐ |
| Trigger a timeout / error deliberately (very complex prompt) | Rate limit counter NOT incremented (retry next time works) | ☐ |
| Generate 5 images in one day | 6th attempt blocked with "Daily image limit reached" toast | ☐ |
| Save a visual aid → open from library | Page loads, prompt pre-filled, "Image not stored — click Generate to recreate" placeholder shown | ☐ |

---

## 5. My Library (content-gallery)

| Test | Expected | Pass? |
|------|----------|-------|
| Open saved **lesson-plan** | Navigates to `/lesson-plan?id=XXX` (NOT `/lesson-plan-generator`) | ☐ |
| Open saved **teacher-training** | Navigates to `/teacher-training?id=XXX` | ☐ |
| Open saved **instant-answer** | Navigates to `/instant-answer?id=XXX`, answer shown | ☐ |
| Open saved **visual-aid** | Navigates to `/visual-aid-designer?id=XXX`, graceful "no image" state shown | ☐ |
| Open saved **quiz** | Navigates to `/quiz-generator?id=XXX` | ☐ |
| Open saved **worksheet** | Navigates to `/worksheet-wizard?id=XXX` | ☐ |
| Delete an item | Item removed from list immediately | ☐ |
| Download lesson-plan | HTML file downloaded | ☐ |

---

## 6. Teacher Training Page

| Test | Expected | Pass? |
|------|----------|-------|
| Select **Kannada**, ask a classroom management question | Advice fully in Kannada | ☐ |
| Open library → click saved teacher-training | Question pre-filled, saved advice displayed | ☐ |

---

## 7. Attendance

| Test | Expected | Pass? |
|------|----------|-------|
| Create a new class (Pro account) | Class appears in list | ☐ |
| Add a student with Kannada as parent language | Student saved | ☐ |
| Mark today's attendance → Save | "Attendance saved" toast | ☐ |
| Try saving attendance for a date > 7 days ago | Error: "Cannot mark attendance older than 7 days" | ☐ |
| Contact parent (Kannada language) → Generate Message | Message generated in Kannada | ☐ |
| Contact parent (Kannada) → review step | **No "Call Parent" button** (Twilio unsupported); amber warning shown | ☐ |
| Contact parent → Copy for WhatsApp | Clipboard populated with Kannada message | ☐ |
| Attendance page on Free plan | "Premium feature" toast | ☐ |

---

## 8. Multi-language Smoke Test

Run these for **each** language: Kannada (kn), Hindi (hi), Tamil (ta), Telugu (te).

| Feature | Verify | Pass? |
|---------|--------|-------|
| Lesson Plan | Output in selected language | ☐ |
| Instant Answer | Answer in selected language | ☐ |
| Visual Aid metadata | `pedagogicalContext` & `discussionSpark` in selected language | ☐ |
| Parent Message | Generated message in selected language | ☐ |

---

## 9. API Route Tests (curl / Postman)

### 9a. Without auth token → must reject
```bash
curl -X POST https://<HOST>/api/ai/lesson-plan \
  -H "Content-Type: application/json" \
  -d '{"topic":"photosynthesis"}' \
  -w "\n%{http_code}"
# Expected: 401
```

### 9b. Lesson Plan — Kannada lock
```bash
curl -X POST https://<HOST>/api/ai/lesson-plan \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"topic":"ನೀರಿನ ಚಕ್ರ","language":"kn","gradeLevels":["Class 6"]}' | \
  jq '.title'
# Expected: Kannada string (starts with Kannada script)
```

### 9c. Visual Aid — rate limit only on success
```bash
# 1. Force a prompt that times out (huge/complex) — verify counter NOT incremented
# 2. Generate a simple diagram — counter increments
# Check Firestore: rate_limits/{uid}_image.requests array length
```

### 9d. Instant Answer — language lock
```bash
curl -X POST https://<HOST>/api/ai/instant-answer \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"question":"ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಎಂದರೇನು?","language":"kn"}' | \
  jq '.answer' | head -c 50
# Expected: starts with Kannada characters
```

### 9e. Parent message — Kannada
```bash
curl -X POST https://<HOST>/api/ai/parent-message \
  -H "Content-Type: application/json" \
  -d '{"studentName":"Ravi","className":"Class 6 A","subject":"Science","reason":"consecutive_absences","parentLanguage":"Kannada"}' | \
  jq '.message' | head -c 80
# Expected: Kannada message
```

### 9f. Attendance call — Kannada must return 422
```bash
curl -X POST https://<HOST>/api/attendance/call \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"outreachId":"test","to":"+919999999999","parentLanguage":"Kannada"}'
# Expected: 422 with message about WhatsApp fallback
```

---

## 10. Root-Cause Categories (for future bug triage)

| Category | Pattern | Files to check |
|----------|---------|----------------|
| **Missing language lock** | AI output in English despite non-English selection | `src/ai/flows/*.ts` — verify Language Lock instruction names the exact language and says "writing in English is a critical failure" |
| **Library routing** | "Page Not Found" when opening saved content | `src/components/library/content-gallery.tsx` routeMap — verify every CONTENT_TYPE has a route |
| **Missing ?id= handler** | Saved content opens blank form | Page component — verify `searchParams.get("id")` useEffect exists for all pages in routeMap |
| **Rate limit on failed attempts** | Quota exhausted after errors | `src/app/api/ai/*/route.ts` — rate limit check must be AFTER success, not before |
| **Stripped data on save** | Feature accepts input but shows no output | `src/ai/flows/*.ts` persistence block — `imageDataUri: undefined` pattern |
| **Conditional UI hiding fields** | Fields invisible without prerequisite | Sidebar/form — avoid `{condition && <Component />}` for discoverable fields; use disabled state or hint instead |
