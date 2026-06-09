9# SahayakAI Data Architecture & Schema Plan

**Date:** Jan 31, 2026
**Status:** DRAFT (Planning Phase)
**Author:** Antigravity (Scrum Master / Lead Architect)

---

## 1. Overview
This document defines the comprehensive data models for the SahayakAI platform. It transitions the application from stateless/impromptu AI generations to a structured, persistent application state.

**Database Strategy:** Cloud Firestore (NoSQL)
**Structure:** User-Centric with Global Shared Libraries.

## 2. Shared Common Enumerations

### `GradeLevel` (Enum)
- `Class 5` to `Class 12`

### `Subject` (Enum)
- `Mathematics`, `Science`, `Social Science`, `history`, `Geography`, `Civics`, `English`, `Hindi`, `Sanskrit`, `Kannada`, `Computer Science`, `Environmental Studies (EVS)`

### `Language` (Enum)
- `English`, `Hindi`, `Kannada`, `Tamil`, `Telugu`, `Marathi`, `Bengali`

---

## 3. Core Entities (Collections)

### A. `users` (Collection)
Represents the authenticated teacher/educator.

```typescript
interface UserProfile {
  uid: string;                 // Firebase Auth ID
  email: string;
  displayName: string;
  photoURL?: string;
  
  // Professional Profile
  schoolName?: string;
  teachingGradeLevels: GradeLevel[];
  subjects: Subject[];
  preferredLanguage: Language;
  
  // Usage Metadata
  createdAt: Timestamp;
  lastLogin: Timestamp;
  planType: 'free' | 'pro' | 'institution';
  
  // Gamification (Future)
  impactScore: number;
  contentSharedCount: number;
}
```

### B. `users/{uid}/content` (Sub-collection)
Stores all generated content (Lesson Plans, Quizzes, etc.) for a specific user. This allows efficient querying of "My Library".
**Common Fields for all content docs:**

```typescript
interface BaseContent {
  id: string;                  // UUID
  type: 'lesson-plan' | 'quiz' | 'worksheet' | 'visual-aid' | 'rubric' | 'micro-lesson';
  title: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Search/Filter Metadata
  gradeLevel: GradeLevel;
  subject: Subject;
  topic: string;
  language: Language;
  
  // Storage
  // Large content (like full JSONs or Images) might be offloaded to Cloud Storage
  // and referenced here, or stored directly if < 1MB.
  storagePath?: string; 
  data?: any; // The actual schema-specific payload (see below)
  
  // Status
  isPublic: boolean;           // If true, indexed in Global Library
  isDraft: boolean;
}
```

---

## 4. Feature-Specific Schemas (Payloads)

### 1. Lesson Plan (`lesson-plan`)
*Current Status: Implemented (needs formalization)*

```typescript
interface LessonPlanSchema {
  metadata: {
    duration: string;         // e.g. "45 minutes"
    objectives: string[];
    materials: string[];
  };
  content: {
    // 5E Model Structure
    engage: Activity[];
    explore: Activity[];
    explain: Activity[];
    elaborate: Activity[];
    evaluate: Activity[];
  };
  teacherSupport: {
    tips: string;
    keyVocabulary: Array<{ term: string, definition: string }>;
    blackboardWork: string[]; // Descriptions of what to draw/write
  };
  assessment: string;
  homework: string;
}

interface Activity {
  title: string;
  duration: string;
  instructions: string;
  teacherScript?: string; // "Say this to the class..."
}
```

### 2. Quiz (`quiz`)
*Current Status: Implemented (Zod)*

```typescript
interface QuizSchema {
  format: 'print' | 'interactive';
  questions: Array<{
    id: string;
    text: string;
    type: 'multiple-choice' | 'fill-in-blank' | 'short-answer' | 'true-false';
    options?: string[];       // For MCQ
    correctAnswer: string;
    explanation: string;      // For teacher/student review
    difficulty: 'easy' | 'medium' | 'hard';
    bloomsLevel?: string;     // e.g. "Recall", "Application"
  }>;
  answerKey: Record<string, string>; // ID -> Answer mapping
}
```

### 3. Worksheet (`worksheet`)
*Current Status: Markdown String (Needs Structure)*

```typescript
interface WorksheetSchema {
  // Structured for PDF generation
  sections: Array<{
    title: string;          // e.g. "Part A: Vocabulary"
    instructions: string;
    items: Array<{
      type: 'text' | 'image' | 'drawing_box' | 'lines';
      content: string;      // The question or prompt
      spaceAllocated: string; // e.g. "3-lines", "half-page"
    }>;
  }>;
  layout: 'portrait' | 'landscape';
  theme?: 'minimal' | 'playful';
}
```

### 4. Visual Aid (`visual-aid`)
*Current Status: MVP*

```typescript
interface VisualAidSchema {
  prompt: string;
  style: 'photorealistic' | 'illustration' | 'diagram' | 'chart';
  imageUrl: string;          // Cloud Storage URL
  altText: string;
  
  // Pedagogical Context
  suggestedCaption: string;
  discussionQuestions: string[]; // "What do you see in this image?"
}
```

### 5. Micro-Lesson (`micro-lesson`)
*New Feature Schema*

```typescript
interface MicroLessonSchema {
  // Concept: A stack of "Stories" or Slides
  slides: Array<{
    id: string;
    type: 'title' | 'concept' | 'quiz' | 'video' | 'image';
    content: {
      headline: string;
      bodyText: string;
      mediaUrl?: string;     // Image or Video
      bulletPoints?: string[];
    };
    script: string;          // Voiceover script for the slide
    duration: number;        // Recommended seconds
  }>;
}
```

### 6. Rubric (`rubric`)
*Current Status: Needs Definition*

```typescript
interface RubricSchema {
  assignmentTitle: string;
  scale: number;             // e.g. 4-point, 5-point
  criteria: Array<{
    name: string;            // e.g. "Grammar"
    weight?: number;         // Percentage
    levels: Array<{
      score: number;         // e.g. 4
      label: string;         // e.g. "Exceeds Expectations"
      descriptor: string;    // "No grammatical errors..."
    }>;
  }>;
}
```

---

### 7. Global News Feed (`news-feed`)
*Shared global collection*

```typescript
interface NewsItemSchema {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: Timestamp;
  tags: string[];           // ["Education Policy", "CBSE"]
  relevanceScore: number;   // AI-calculated relevance to Indian teachers
}
```

### 8. Gamification & Impact (`user-impact`)
*Sub-collection or embedded in User Profile*

```typescript
interface UserImpactSchema {
  streakDays: number;
  totalContentGenerated: number;
  badges: Array<{
    id: string;
    name: string;      // e.g. "Early Adopter", "Curriculum Master"
    awardedAt: Timestamp;
    icon: string;
  }>;
  savings: {
    timeSavedHours: number;
    moneySavedINR: number;
  };
}
```

---

## 5. UX Considerations for Data Strategy
*Addressing user feedback regarding performance and experience.*

1.  **Optimistic UI:** All "Save" and "Star" actions must update the UI immediately, syncing to Firestore in the background.
2.  **Skeleton Loading:** Schemas are designed to allow partial data fetching (e.g., fetching only `metadata` for list views) to keep the "My Library" page fast.
3.  **Offline Support:** The Firestore SDK's offline persistence will be enabled to allow teachers in low-connectivity rural areas to view previously loaded content.
4.  **Instant Search:** Client-side indexing (using a lightweight engine like Fuse.js on the `title` and `tags` fields) will provide instant search results for personal libraries.

---

## 6. File Storage Strategy (Cloud Storage)

While metadata is stored in Firestore, heavy content generated by AI is stored in Google Cloud Storage buckets to reduce database costs and strictly separate data from files.

| Content Type | Storage Path Pattern | Format |
| :--- | :--- | :--- |
| **Lesson Plan** | `users/{uid}/lesson-plans/{timestamp}-{id}.json` | `application/json` |
| **Worksheet** | `users/{uid}/worksheets/{timestamp}-{id}.md` | `text/markdown` |
| **Quiz** | `users/{uid}/quizzes/{timestamp}-{id}.json` | `application/json` |
| **Visual Aid** | `users/{uid}/visual-aids/{timestamp}-{id}.png` | `image/png` |
| **Field Trip** | `users/{uid}/virtual-field-trips/{timestamp}-{id}.json` | `application/json` |
| **Rubric** | `users/{uid}/rubrics/{timestamp}-{id}.json` | `application/json` |

---

## 7. Implementation Roadmap

1.  **Phase 1: Type Definitions**
    -   Create `src/types/schema.d.ts` (or individual files in `src/ai/schemas`) to strictly type these models.
    -   Update existing Zod schemas to match these structured definitions.

2.  **Phase 2: Database Adapters**
    -   Create `src/lib/db/adapter.ts` to handle CRUD operations for `users/{uid}/content`.
    -   Implement "Save to Library" functionality in all flows.

3.  **Phase 3: Migration (Data Modeling)**
    -   Refactor `worksheet-wizard` to return JSON instead of Markdown string.
    -   Refactor `lesson-plan` to strictly match the new persisted schema.

4.  **Phase 4: UI Binding**
    -   Update UI components to render from these new structured types instead of loose props.
