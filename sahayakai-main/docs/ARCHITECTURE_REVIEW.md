# SahayakAI Architecture Review
**Reviewer:** Senior Solutions Architect  
**Review Date:** 2026-01-27  
**Severity Legend:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | ✅ Strength

---

## Executive Summary

This is a **well-architected EdTech solution** with strong fundamentals for the Indian market. The "Bharat-First" approach and offline capabilities are commendable. However, there are **critical gaps in scalability, cost control, and operational resilience** that must be addressed before reaching 1M+ users.

**Overall Grade: B+ (Good foundation, needs hardening for scale)**

---

## 1. Architecture Strengths ✅

### 1.1 Smart Technology Choices
- ✅ **Gemini Flash Model:** Cost-effective choice for speed/price balance
- ✅ **Serverless Architecture:** Firebase + Cloud Functions = Low operational overhead
- ✅ **Multi-Layer Caching:** IndexedDB (local) + Firestore (cloud) implemented correctly
- ✅ **Offline-First Mobile:** Flutter + Isar is the right stack for rural connectivity

### 1.2 Security & Privacy
- ✅ **PII Detection in Caching:** Smart privacy-preserving logic (checks for email/phone before caching)
- ✅ **Rate Limiting Implemented:** Both client-side (Token Bucket) and server-side (Firestore)
- ✅ **Firebase Auth:** Industry-standard authentication with OTP support

### 1.3 Developer Experience
- ✅ **Clean Architecture:** Good separation of concerns (flows, actions, components)
- ✅ **Testing Strategy:** Unit tests for caching logic exist
- ✅ **TypeScript + Zod:** Type safety with runtime validation

---

## 2. Critical Issues 🔴

### 2.1 Scalability Showstoppers

#### 🔴 **Issue 1: Single-Instance Bottleneck**
```yaml
# apphosting.yaml
maxInstances: 1  # ❌ CRITICAL: Can't handle more than ~100 concurrent users
```
**Impact:** At 1M teachers, even 1% concurrent usage = 10,000 requests → Complete system failure.

**Recommendation:**
```yaml
runConfig:
  minInstances: 2  # Always-on for faster cold starts
  maxInstances: 100  # Auto-scale to handle traffic spikes
  concurrency: 80  # Requests per instance
```

---

#### 🔴 **Issue 2: No AI Cost Circuit Breaker**

**Note:** *Architecture uses VertexAI + Agent Garden + A2A protocol (not Genkit)*

**Current Risk:** Even with VertexAI's native quota controls, no application-level budget monitoring is visible in the codebase.

**Impact:** A single malicious user (or bug in agent orchestration) could generate unlimited API calls → ₹10 lakh+ bill overnight.

**Recommendation:**
```typescript
// Implement budget tracking at application level
import { CloudBillingClient } from '@google-cloud/billing';

class BudgetGuard {
  private readonly maxMonthlyUSD = 5000;
  private readonly alertThresholds = [0.7, 0.9];
  
  async checkBudget(userId: string): Promise<boolean> {
    const monthlyUsage = await this.getMonthlyUsage();
    
    if (monthlyUsage >= this.maxMonthlyUSD) {
      // Fallback to cached templates
      await this.sendAlert('BUDGET_EXCEEDED', monthlyUsage);
      return false;
    }
    
    // Log per-user usage for VertexAI calls
    await this.logUserUsage(userId, 'vertex_ai_call');
    return true;
  }
}

// In agent orchestration:
if (!await budgetGuard.checkBudget(userId)) {
  return getCachedTemplate(topic); // Graceful degradation
}
```

**VertexAI-Specific Controls:**
- Enable Quota Management in GCP Console
- Set per-project QPM (Queries Per Minute) limits
- Configure Agent Garden budget alerts

---

#### 🔴 **Issue 3: Semantic Cache Has No TTL or Eviction**
```typescript
// lesson-plan.ts
await db.collection('cached_lesson_plans').doc(cacheId).set({
  // ❌ MISSING: TTL, max cache size, LRU eviction
});
```

**Risk:**
- Firestore cache grows infinitely → ₹5/GB/month storage costs
- Stale content (6-month-old lesson plan still served)

**Recommendation:**
```typescript
await db.collection('cached_lesson_plans').doc(cacheId).set({
  ...plan,
  _metadata: {
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90*24*60*60*1000).toISOString(), // 90 days
    version: '1.0', // Invalidate old cache on curriculum updates
    hitCount: 0, // Track popularity for LRU
  }
});

// Add Firestore TTL policy via Firebase Console or terraform
```

---

### 2.2 Data Architecture Issues

#### 🟠 **Issue 4: No Database Indexing Strategy**
```typescript
// Firestore queries without composite indexes
db.collection('cached_lesson_plans').doc(cacheId).get();
// ❌ What if you need to query: "All grade 7 Science plans in Hindi"?
```

**Missing Indexes:**
- `grade + subject + language`
- `createdAt` (for cleanup jobs)
- `usageCount` (for popularity analytics)

**Recommendation:**
Create `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "cached_lesson_plans",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "_metadata.originalGrade", "order": "ASCENDING" },
        { "fieldPath": "_metadata.originalLanguage", "order": "ASCENDING" },
        { "fieldPath": "_metadata.createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

#### 🟠 **Issue 5: Three Codebases with Drift Risk**
```
sahayakai-main     → Production (stable)
sahayakai-replica  → Development (experimental)
sahayakai_mobile   → Mobile (separate stack)
```

**Problem:** No shared package/library. If you fix a bug in `main`, you have to manually port to `replica` and `mobile`.

**Recommendation:**
- Create `@sahayakai/shared` package (monorepo with pnpm/nx)
- Shared types, validation schemas, constants
- Single source of truth for business logic

---

### 2.3 Operational Gaps

#### 🟡 **Issue 6: No Monitoring/Observability**
**Missing:**
- ❌ Error tracking (Sentry/GCP Error Reporting)
- ❌ Performance monitoring (Cloud Trace)
- ❌ Cost tracking dashboard
- ❌ Cache hit rate metrics

**Recommendation:**
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% sampling to reduce costs
  beforeSend(event) {
    // Redact PII from error logs
    if (event.user) delete event.user.email;
    return event;
  }
});
```

---

#### 🟡 **Issue 7: No Graceful Degradation**
**Current Behavior:**
- If Gemini API is down → User gets error page
- If Firestore is slow → User waits indefinitely

**Recommendation:**
```typescript
// Add timeout + fallback
const lessonPlan = await Promise.race([
  generateLessonPlan(input),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), 15000)
  )
]).catch(async (error) => {
  // Fallback: Return a basic template
  return await getTemplateFromLibrary(input.topic, input.grade);
});
```

---

## 3. Mobile Architecture Concerns

#### 🟠 **Issue 8: Flutter App Needs Backend API Layer**
**Current Plan:** Mobile calls Cloud Functions → Which call Genkit

**Problem:** No API versioning, no request validation at edge.

**Recommendation:**
```
Mobile App → API Gateway (Cloud Endpoints) → Cloud Functions → Genkit
                ↓
            - Rate limiting per user
            - Request validation
            - API versioning (/v1/, /v2/)
```

---

#### 🟡 **Issue 9: Isar Sync Strategy Missing Details**
**Question:** How does offline data sync back to Firestore?

**Missing:**
- Conflict resolution (What if 2 teachers offline-edit the same plan?)
- Partial sync (Don't sync 1000s of cached plans, just user's library)
- Retry logic with exponential backoff

---

## 4. Security Hardening Needed

#### 🟡 **Issue 10: Firestore Security Rules Not Shown**
**Critical Question:** Are the following protected?
- Can User A read User B's saved plans?
- Can a user delete the shared cache?

**Recommendation:**
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Community cache - Read-only for all
    match /cached_lesson_plans/{cacheId} {
      allow read: if request.auth != null;
      allow write: if false; // Only Cloud Functions can write
    }
    
    // User library - Private
    match /users/{userId}/my_library/{planId} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

---

## 5. Cost Optimization Opportunities

| Component | Current Cost Risk | Optimization |
|-----------|-------------------|--------------|
| **Gemini API** | 🔴 High (No cap) | Implement budget manager, fallback to templates |
| **Firestore Reads** | 🟡 Medium | Add CDN layer for static templates (Cloud Storage) |
| **Cloud Functions** | 🟢 Low (Pay-per-use) | Keep serverless, but add min instances for latency |
| **Firebase Hosting** | 🟢 Low (CDN is cheap) | Already optimal |

**Estimated Monthly Cost at Scale:**
- 1M teachers, 10% active daily = 100k generations/day
- Cache hit rate: 60% → 40k API calls/day
- Gemini Flash: $0.075/1M input tokens, $0.30/1M output tokens
- **Estimated:** $1,500-3,000/month (without optimization)
- **With caching + templates:** $500-800/month ✅

---

## 6. Recommended Roadmap

### Immediate (Before Pilot Expansion)
1. 🔴 Increase `maxInstances` to at least 10
2. 🔴 Add AI budget circuit breaker
3. 🔴 Implement cache TTL (90 days)
4. 🟠 Add Sentry error tracking

### Short-Term (Next 2 Months)
5. 🟠 Create shared library package
6. 🟠 Add Firestore composite indexes
7. 🟡 Implement graceful degradation
8. 🟡 Add API Gateway for mobile

### Long-Term (Before Nationwide)
9. Migrate to managed semantic search (Vertex AI Vector Search)
10. Add multi-region deployment
11. Implement A/B testing framework
12. Build teacher analytics dashboard

---

## 7. Final Verdict

**This architecture is production-ready for a PILOT (100-1000 users).**  
**It is NOT ready for SCALE (100k+ users) without the critical fixes above.**

### Key Strengths:
- ✅ Right tech stack for the problem
- ✅ Privacy-conscious design
- ✅ Offline-first for mobile

### Must-Fix Before Scale:
- 🔴 Cost controls (budget manager)
- 🔴 Scalability (maxInstances, caching strategy)
- 🔴 Monitoring (observability gaps)

---

**Recommendation:** Implement the 🔴 Critical fixes within 2 weeks, then run a stress test simulating 10,000 concurrent users before expanding beyond pilot.

---
**Reviewed By:** Senior Solutions Architect  
**Confidence Level:** High (based on code review + architecture doc)
