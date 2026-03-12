# SahayakAI — Data Schemas

## Firestore Collections

### `users/{uid}`
User profile document. Created/updated by `syncUserAction()` on login.

```
{
  uid: string
  email: string
  displayName: string
  photoURL: string | null
  schoolName?: string
  district?: string
  pincode?: string
  bio?: string
  department?: string
  subjects?: string[]          // from Subject enum
  preferredLanguage?: string   // from Language enum
  verifiedStatus?: boolean
  badges?: string[]
  followerCount?: number
  followingCount?: number
  planType?: 'free' | 'pro'
  impactScore?: number
  designation?: string
  contentSharedCount?: number
  lastLogin?: Timestamp
  createdAt?: Timestamp
}
```

### `users/{uid}/content/{contentId}`
Private content saved by a user. Created by `saveToLibrary()`.

```
{
  id: string                   // UUID
  type: ContentType            // lesson-plan | quiz | worksheet | visual-aid | rubric | ...
  title: string
  gradeLevel: GradeLevel
  subject: Subject
  topic: string
  language: Language
  isPublic: boolean
  isDraft?: boolean
  deletedAt?: Timestamp        // soft-delete
  expiresAt?: Timestamp        // TTL (30d after soft-delete)
  storagePath?: string         // GCS path if file uploaded
  data: object                 // feature-specific schema (see below)
  createdAt: Timestamp
}
```

### `library_resources/{id}`
Public community resources. Created by `publishContentToLibraryAction()`.

```
{
  id: string
  type: ContentType
  title: string
  gradeLevel: string
  subject: string
  language: string
  authorId: string
  authorName: string
  authorPhotoURL?: string
  stats: {
    likes: number
    saves: number
    downloads: number
    views?: number
  }
  tags?: string[]
  createdAt: Timestamp
  storagePath?: string
  data?: object
}
```

### `conversations/{conversationId}`
DM or group conversation. ID for DMs = `[uid1, uid2].sort().join('_')`.

```
{
  id: string
  type: 'direct' | 'group'
  participantIds: string[]
  participants: {
    [uid: string]: {
      displayName: string
      photoURL: string | null
      preferredLanguage?: string
    }
  }
  name?: string                // group only
  groupPhotoURL?: string       // group only
  lastMessage?: string         // preview text
  lastMessageAt?: Timestamp
  unreadCount: {
    [uid: string]: number      // per-user unread count
  }
  createdAt: Timestamp
  updatedAt?: Timestamp
}
```

### `conversations/{conversationId}/messages/{messageId}`
Individual messages in a conversation.

```
{
  id: string                   // Firestore docId
  type: 'text' | 'resource' | 'audio'
  text: string
  senderId: string
  senderName: string           // denormalized
  senderPhotoURL: string | null
  resource?: {                 // when type === 'resource'
    id: string
    type: ContentType
    title: string
    gradeLevel: string
    subject: string
    language: string
    route: string              // URL path to open the resource
  }
  audioUrl?: string            // when type === 'audio' — Firebase Storage URL
  audioDuration?: number       // seconds
  readBy: string[]             // UIDs that have opened the conversation
  createdAt: Timestamp
}
```

### `community_chat/{messageId}`
Global community chat messages (one shared channel).

```
{
  text: string
  audioUrl?: string            // Firebase Storage URL if voice message
  authorId: string
  authorName: string           // fetched server-side, never from client
  authorPhotoURL: string | null
  createdAt: Timestamp         // serverTimestamp()
}
```

### `connection_requests/{pairId}`
Pending connection requests. pairId = `[fromUid, toUid].sort().join('_')`.

```
{
  fromUid: string
  toUid: string
  createdAt: Timestamp
  expiresAt: Timestamp         // 30 days from creation
}
```

### `connections/{pairId}`
Accepted connections. pairId same deterministic format.

```
{
  uids: string[]               // both UIDs sorted
  initiatedBy: string
  connectedAt: Timestamp
}
```
**Note:** Created only by Admin SDK (server action). Deleted by either participant (client SDK allowed).

### `notifications/{notificationId}`
User notifications.

```
{
  type: NotificationType       // FOLLOW | NEW_POST | BADGE_EARNED | LIKE | RESOURCE_SAVED | RESOURCE_USED | CONNECT_REQUEST | CONNECT_ACCEPTED
  recipientId: string
  senderId?: string
  senderName?: string
  senderPhotoURL?: string
  title: string
  message: string
  isRead: boolean
  metadata?: object            // type-specific data (requestId, resourceId, etc.)
  createdAt: Timestamp
}
```

### `rate_limits/{userId}`
Rate limiting data. Managed by `server-safety.ts`.

```
{
  timestamps: number[]         // Unix ms timestamps of recent requests
}
```

### `follows/{followerId_followedId}` (inferred from community actions)
Follow relationships.

```
{
  followerId: string
  followedId: string
  createdAt: Timestamp
}
```

---

## Feature-Specific Content Schemas

### Lesson Plan (`data` field)
```
{
  title: string
  gradeLevel: string
  subject: string
  topic: string
  language: string
  duration: string
  objectives: string[]
  materials: string[]
  sections: {
    engage: string
    explore: string
    explain: string
    elaborate: string
    evaluate: string
  }
  assessment: string
  ncertAlignment?: string
  diffSuggestions?: string
}
```

### Quiz (`data` field)
```
{
  title: string
  questions: {
    easy: QuizQuestion[]
    medium: QuizQuestion[]
    hard: QuizQuestion[]
  }
}

QuizQuestion: {
  id: string
  question: string
  options?: string[]           // MCQ
  answer: string
  type: 'mcq' | 'true-false' | 'fill-blank' | 'short-answer'
  bloomsLevel?: string
  explanation?: string
}
```

### Worksheet (`data` field)
```
{
  title: string
  content: string              // Markdown with optional LaTeX math
  instructions?: string
}
```

### Visual Aid (`data` field)
```
{
  imageUrl: string             // Firebase Storage URL
  pedagogicalContext: string
  discussionSpark: string
  altText: string
}
```

### Rubric (`data` field)
```
{
  title: string
  criteria: {
    name: string
    levels: {
      exemplary: string
      proficient: string
      developing: string
      beginning: string
    }
  }[]
}
```

### Virtual Field Trip (`data` field)
```
{
  destination: string
  stops: {
    name: string
    googleEarthUrl: string
    description: string
    culturalAnalogy: string
    educationalFacts: string[]
    reflectionPrompt: string
  }[]
  overallTheme: string
}
```

---

## TypeScript Type Enums

### GradeLevel
`Nursery | LKG | UKG | Class 1 | Class 2 | ... | Class 12`

### Subject
`Mathematics | Science | Social Science | History | Geography | Civics | English | Hindi | Sanskrit | Kannada | Computer Science | EVS`

### Language
`English | Hindi | Kannada | Tamil | Telugu | Marathi | Bengali | Gujarati | Punjabi | Malayalam | Odia`

### ContentType
`lesson-plan | quiz | worksheet | visual-aid | rubric | micro-lesson | virtual-field-trip | instant-answer | teacher-training`

### NotificationType
`FOLLOW | NEW_POST | BADGE_EARNED | LIKE | RESOURCE_SAVED | RESOURCE_USED | CONNECT_REQUEST | CONNECT_ACCEPTED`

### ConnectionStatus
`none | pending_sent | pending_received | connected`

---

## Firebase Storage Paths

| Purpose | Path |
|---|---|
| User content files | `users/{uid}/{contentType}/{filename}` |
| Voice messages | `voice-messages/{uid}/{timestamp}.webm` or `.mp4` |
| Profile images | (managed by Firebase Auth, not custom storage) |
| Community post images | (via create-post-dialog) |

---

## API Contracts

### POST /api/ai/instant-answer
```
Request: { question: string, language: string, gradeLevel: string }
Response: { answer: string, sources?: string[] }
```

### POST /api/ai/lesson-plan
```
Request: { topic: string, gradeLevel: string, subject: string, language: string, duration?: string, ncertChapter?: object }
Response: LessonPlanSchema
```

### POST /api/ai/quiz
```
Request: { topic: string, gradeLevel: string, subject: string, language: string, questionTypes: string[], bloomsLevels: string[], questionCount: number }
Response: { questions: { easy: [], medium: [], hard: [] } }
```

### POST /api/assistant (streaming)
```
Request: { message: string, userId: string, context?: object }
Response: Server-Sent Events stream of text chunks
```
