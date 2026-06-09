# AppSidebar Component

**File:** `src/components/app-sidebar.tsx`

---

## Purpose

Main navigation sidebar. Collapsible on mobile (Sheet/drawer). Shows all tool and platform links with a live unread message badge.

---

## Props

None — standalone component, reads from `useAuth()` and Firestore internally.

---

## Structure

### Header
- "AI Companion" text link → `/`
- App logo

### Nav Groups

**AI Tools**
| Item | Route | Icon |
|---|---|---|
| Lesson Plan | /lesson-plan | BookOpen |
| Rubric Generator | /rubric-generator | ClipboardList |
| Worksheet Wizard | /worksheet-wizard | FileSignature |
| Quiz Generator | /quiz-generator | ClipboardCheck |
| Visual Aid Designer | /visual-aid-designer | Images |
| Instant Answer | /instant-answer | Wand2 |
| Content Creator | /content-creator | PenTool |
| Video Storyteller | /video-storyteller | Video |
| Teacher Training | /teacher-training | GraduationCap |
| Virtual Field Trip | /virtual-field-trip | Globe2 |

**Platform**
| Item | Route | Icon | Special |
|---|---|---|---|
| My Library | /my-library | Library | |
| Community Library | /community-library | Users | |
| Messages | /messages | MessageCircle | Unread badge |
| Impact Dashboard | /impact-dashboard | BarChart | |
| Submit Content | /submit-content | Upload | |
| My Profile | /my-profile | User | |
| Notifications | /notifications | Bell | |
| Community | /community | Flame | |

**Admin** (bottom section)
| Item | Route | Icon |
|---|---|---|
| Mission Control | /admin/cost-dashboard | DollarSign |
| Log Dashboard | /admin/log-dashboard | FileText |
| Review Panel | /review-panel | Shield |

---

## Live Unread Badge

```
useEffect:
  1. onAuthStateChanged → get userId
  2. onSnapshot on conversations where participantIds array-contains userId
  3. Sum unreadCount[userId] across all conversations
  4. Display as orange badge on Messages link
  5. Shows "9+" if count > 9

Cleanup: unsubscribe both auth listener and Firestore listener
```

---

## Active State

Uses `usePathname()` to detect current route. Active link: bold text, orange-500 color, subtle background highlight.

---

## Mobile Behavior

On mobile, sidebar is a Sheet (drawer) triggered by hamburger menu in header. Content is identical to desktop sidebar.

---

## Key Pattern

Double cleanup: the Firestore subscription is created inside an auth state change listener. Both must be properly unsubscribed to prevent memory leaks:

```
let firestoreUnsub: (() => void) | null = null;
const authUnsub = onAuthStateChanged(auth, (user) => {
  if (user) {
    firestoreUnsub = onSnapshot(...);
  }
});
return () => {
  authUnsub();
  firestoreUnsub?.();
};
```
