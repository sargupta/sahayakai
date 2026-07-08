# SahayakAI: Complete Solution Architecture

**Version:** 2.1  
**Last Updated:** 2026-06-10  
**Coverage:** Web (Main) + Mobile (scaffolded)  

---

## Overview

SahayakAI's production surface is a single web app, with a Flutter mobile client in development:

1. **sahayakai-main** - Production web app (Next.js 15, Cloud Run). This is the live system.
2. **sahayakai-flutter** - Cross-platform mobile app (Flutter), offline path scaffolded; not yet GA.

> The production web app runs as a single Next.js service on **Cloud Run** (`sahayakai-hotfix-resilience`, region `asia-southeast1`, project `sahayakai-b4248`), not on Firebase Hosting / Cloud Functions. AI runs server-side via **Genkit** (`googleai` plugin) calling **Google Gemini** (default `gemini-2.5-flash`); there is no Vertex AI "Agent Garden" / A2A protocol in the live code. An optional external **ADK-Python sidecar** exists for select agents, gated off by default via Firestore feature flags.

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph "User Layer"
        WEB_USER[👩‍🏫 Web Users<br/>Desktop/Tablet]
        MOBILE_USER[👨‍🏫 Mobile Users<br/>Android/iOS]
    end

    subgraph "Client Applications"
        WEB_MAIN[🌐 sahayakai-main<br/>Next.js 15<br/>Production Web]
        MOBILE_APP[📱 sahayakai-flutter<br/>Flutter<br/>Cross-Platform, in dev]
    end

    subgraph "Backend Services - Google Cloud Platform"
        subgraph "Compute"
            CLOUDRUN[Cloud Run<br/>sahayakai-hotfix-resilience<br/>Next.js server + API routes]
        end
        subgraph "Firebase Services"
            AUTH[Firebase Auth<br/>OTP + Google OAuth]
            FIRESTORE[Cloud Firestore<br/>NoSQL Database]
            STORAGE[Cloud Storage<br/>Files/Media]
        end
        
        subgraph "AI/ML Services"
            GENKIT[Genkit<br/>googleai plugin]
            GEMINI_FLASH[Gemini 2.5 Flash<br/>Default text model]
            GEMINI_PRO[Gemini 2.5 Pro<br/>Assignment grading]
            GEMINI_IMG[Gemini 3 Pro Image Preview<br/>+ 2.5 Flash Image avatars]
            SIDECAR[ADK-Python Sidecar<br/>optional, flag-gated off]
        end
    end

    subgraph "External Services"
        SECRETS[Secret Manager<br/>Credentials]
        ANALYTICS[Analytics<br/>User Insights]
    end

    WEB_USER --> WEB_MAIN
    MOBILE_USER --> MOBILE_APP

    WEB_MAIN --> CLOUDRUN
    MOBILE_APP --> CLOUDRUN
    
    WEB_MAIN --> AUTH
    MOBILE_APP --> AUTH

    CLOUDRUN --> GENKIT
    CLOUDRUN --> SIDECAR

    GENKIT --> GEMINI_FLASH
    GENKIT --> GEMINI_PRO
    GENKIT --> GEMINI_IMG
    
    CLOUDRUN --> FIRESTORE
    MOBILE_APP --> FIRESTORE
    
    CLOUDRUN --> SECRETS

    style WEB_MAIN fill:#a7d1e8
    style MOBILE_APP fill:#ffb347
    style CLOUDRUN fill:#4285f4
    style GENKIT fill:#8b5cf6
    style GEMINI_FLASH fill:#4285f4
    style GEMINI_IMG fill:#34a853
```

---

## 2. Web Application Architecture (sahayakai-main)

> The "agents" below are Genkit flows in `src/ai/flows/*.ts` invoked through `/api/ai/*` route handlers, plus the VIDYA voice assistant (`/api/assistant`) whose router classifies 11 intents. They are not Vertex AI Agent-Garden agents and do not use an A2A protocol.

```mermaid
graph TB
    subgraph "Frontend - Next.js Application"
        PAGES[Pages/Routes<br/>App Router]
        COMPONENTS[UI Components<br/>Shadcn/Radix]
        STATE[Client State<br/>React Hooks]
        ACTIONS[Server Actions<br/>Next.js RSC]
    end

    subgraph "Backend - Genkit Flows + API Routes"
        ROUTER[VIDYA Intent Router<br/>11 intents]
        
        subgraph "Genkit Flows (~17)"
            direction TB
            subgraph "Core Content Agents"
                LESSON[Lesson Plan Agent]
                QUIZ[Quiz Generator Agent]
                RUBRIC[Rubric Agent]
                INSTANT[Instant Answer Agent]
            end
            
            subgraph "Creative Agents"
                AVATAR[Avatar Generator]
                VISUAL[Visual Aid Designer]
                WORKSHEET[Worksheet Wizard]
                VIDEO[Video Storyteller]
                FIELD_TRIP[Virtual Field Trip]
            end
            
            subgraph "Support Agents"
                VOICE[Voice-to-Text Agent]
                TRAINING[Teacher Training]
                CONTENT[Content Creator]
            end
        end
        
        TOOLS[Shared Tools<br/>Google Search]
    end

    subgraph "Data Layer"
        FIRESTORE_WEB[Firestore Collections]
        subgraph "Collections"
            USERS_COL[users/]
            CONTENT_COL[content/]
            LIBRARY_COL[library_resources/]
            CACHE_COL[cached_lesson_plans/]
        end
        IDB_CACHE[IndexedDB<br/>Offline Cache]
    end

    subgraph "AI Engine - Genkit + Gemini"
        GEMINI_TEXT[Gemini 2.5 Flash<br/>Text flows]
        GEMINI_IMAGE[Gemini 3 Pro Image Preview<br/>+ 2.5 Flash Image<br/>Visual flows]
        SIDECAR_PROTO[ADK-Python Sidecar<br/>optional, flag-gated]
    end

    PAGES --> COMPONENTS
    COMPONENTS --> ACTIONS
    ACTIONS --> ROUTER
    
    ROUTER -->|Intent: lessonPlan| LESSON
    ROUTER -->|Intent: quiz| QUIZ
    ROUTER -->|Intent: instantAnswer| INSTANT
    
    LESSON --> GEMINI_TEXT
    QUIZ --> GEMINI_TEXT
    INSTANT --> GEMINI_TEXT
    RUBRIC --> GEMINI_TEXT
    
    AVATAR --> GEMINI_IMAGE
    VISUAL --> GEMINI_IMAGE
    
    LESSON -->|Tool Call| TOOLS
    INSTANT -->|Tool Call| TOOLS
    
    ACTIONS --> FIRESTORE_WEB
    FIRESTORE_WEB --> USERS_COL
    FIRESTORE_WEB --> CONTENT_COL
    FIRESTORE_WEB --> LIBRARY_COL
    FIRESTORE_WEB --> CACHE_COL
    
    COMPONENTS --> IDB_CACHE
    STATE --> IDB_CACHE

    style ROUTER fill:#8b5cf6
    style LESSON fill:#4caf50
    style GEMINI_TEXT fill:#4285f4
    style GEMINI_IMAGE fill:#34a853
    style SIDECAR_PROTO fill:#fbbc04
```

---

## 3. Mobile Application Architecture (sahayakai_mobile - Flutter)

### **Studio-Based Design System**

```mermaid
graph TB
    subgraph "Studio Layer - 9 Themed Workspaces"
        WIZARD[🧙 The Wizard<br/>Lesson Planning<br/>Saffron/Orange]
        GAME[🎮 Game Master<br/>Quiz Generator<br/>Green]
        DIRECTOR[🎬 Director's Cut<br/>Video Scripts<br/>Dark Purple]
        ART[🎨 Art Studio<br/>Visual Aids<br/>Violet/Pink]
        NOTEBOOK[📓 The Notebook<br/>Worksheets<br/>Paper Grey]
        GRID[📐 The Grid<br/>Rubrics<br/>Indigo]
        EDITOR[✍️ Editor's Desk<br/>Content Creation<br/>Slate]
        ACADEMY[🎓 The Academy<br/>Training<br/>Royal Blue]
        COMMUNITY[🤝 Community Hub<br/>Social<br/>Warm Gradient]
    end

    subgraph "Presentation Layer"
        SCREENS[Screens/Pages<br/>Material 3 UI]
        WIDGETS[Custom Widgets<br/>Glassmorphism + Studios]
    end

    subgraph "Business Logic Layer"
        PROVIDERS[Riverpod Providers<br/>State Management]
        REPOS[Repositories<br/>Data Abstraction]
    end

    subgraph "Data Layer"
        subgraph "Local Storage"
            ISAR[Isar Database<br/>NoSQL Offline DB]
            PREFS[Shared Preferences<br/>Settings]
        end
        
        subgraph "Remote Data"
            API[REST API Client<br/>Dio]
            FIREBASE_SDK[Firebase SDK<br/>Auth + Firestore]
        end
    end

    subgraph "Services"
        AUDIO[Audio Service<br/>flutter_sound]
        SYNC[Sync Service<br/>Background Worker]
        CONNECTIVITY[Connectivity Manager<br/>Network Monitor]
        THEME[Theme Service<br/>6-Layer Token System]
    end

    subgraph "Backend APIs"
        CLOUD_FUNC[Cloud Run<br/>Next.js /api/* endpoints]
        AGENT_API[Genkit Flows<br/>~17 AI flows + VIDYA]
    end

    WIZARD --> SCREENS
    GAME --> SCREENS
    DIRECTOR --> SCREENS
    ART --> SCREENS
    NOTEBOOK --> SCREENS
    GRID --> SCREENS
    EDITOR --> SCREENS
    ACADEMY --> SCREENS
    COMMUNITY --> SCREENS
    
    SCREENS --> WIDGETS
    SCREENS --> PROVIDERS
    PROVIDERS --> REPOS
    
    REPOS --> ISAR
    REPOS --> API
    REPOS --> FIREBASE_SDK
    
    WIDGETS --> AUDIO
    WIDGETS --> THEME
    PROVIDERS --> SYNC
    SYNC --> CONNECTIVITY
    
    API --> CLOUD_FUNC
    CLOUD_FUNC --> AGENT_API
    
    CONNECTIVITY -.Offline.-> ISAR
    CONNECTIVITY -.Online.-> API

    style WIZARD fill:#FFB347
    style GAME fill:#4caf50
    style DIRECTOR fill:#8b5cf6
    style ART fill:#ec4899
    style ISAR fill:#4caf50
    style SYNC fill:#ff9800
    style CONNECTIVITY fill:#ff5722
    style THEME fill:#8b5cf6
```

---

## 4. Data Flow Diagrams

### 4.1 Lesson Plan Generation Flow (Web)

```mermaid
sequenceDiagram
    participant User as 👩‍🏫 Teacher
    participant UI as Web UI
    participant Action as Server Action
    participant Genkit as Genkit Flow
    participant Gemini as Gemini API
    participant DB as Firestore

    User->>UI: Enters topic "Photosynthesis"
    User->>UI: Selects language (Hindi)
    User->>UI: Clicks "Generate"
    
    UI->>Action: generateLessonPlan()
    Action->>Genkit: lessonPlanFlow(input)
    
    Note over Genkit: Apply Indian Context<br/>Rural Resources Filter
    
    Genkit->>Gemini: Prompt with context
    Gemini-->>Genkit: Generated content (MD)
    
    Genkit-->>Action: LessonPlanOutput
    Action->>DB: Save to content/ (or library_resources/)
    Action-->>UI: Return content
    
    UI->>User: Display Lesson Plan
```

### 4.2 Offline-First Flow (Mobile)

```mermaid
sequenceDiagram
    participant User as 👨‍🏫 Teacher
    participant App as Flutter App
    participant Connectivity as Network Check
    participant Isar as Local DB
    participant API as Backend API
    participant Sync as Sync Service

    User->>App: Request lesson plan
    App->>Connectivity: Check connection
    
    alt No Internet
        Connectivity-->>App: Offline
        App->>Isar: Query local templates
        Isar-->>App: Return cached data
        App->>User: Show "Offline Draft"
        App->>Sync: Queue for later sync
    else Internet Available
        Connectivity-->>App: Online
        App->>API: HTTP request
        API-->>App: Generated content
        App->>Isar: Cache response
        App->>User: Display content
    end
    
    Note over Sync: When connection restored
    Sync->>API: Push queued requests
    API-->>Sync: Acknowledgment
    Sync->>Isar: Update sync status
```

---

## 5. Technology Stack Comparison

| Component | Web (Main) | Mobile (Flutter, in dev) |
|-----------|-------------------|------------------|
| **Framework** | Next.js 15 | Flutter 3.x |
| **Language** | TypeScript | Dart |
| **UI Library** | Shadcn/UI + Radix | Material 3 + Studio System |
| **State Management** | React Server Components + hooks | Riverpod 2.0 |
| **Routing** | App Router | Named Routes (Flutter) |
| **Local DB** | IndexedDB (via idb) | Isar (NoSQL) |
| **Networking** | Fetch API | Dio |
| **AI Orchestration** | Genkit flows via `/api/ai/*` (+ optional ADK-Python sidecar) | Calls same web API endpoints |
| **AI Models** | Gemini 2.5 Flash (default); 2.5 Pro grading; 3 Pro Image Preview + 2.5 Flash Image | Same (via API) |
| **Agent Count** | ~17 Genkit flows + VIDYA voice assistant | Same flows via REST API |
| **Auth** | Firebase Auth (ID token verified in middleware) | Firebase Auth (Flutter SDK) |
| **Styling** | Tailwind CSS | 6-Layer Token System (JSON) |
| **Offline** | Service Worker (PWA) + IndexedDB | Native Offline-First + Isar |
| **Voice** | MediaRecorder API | flutter_sound |
| **Design System** | Glassmorphism (static) | Studio-Based (9 themes) |
| **Unique Features** | NCERT Mapping, Resource Selector | Community Hub, Academy, 6 Studios |

---

## 6. Deployment Architecture

```mermaid
graph LR
    subgraph "Development"
        DEV_CODE[Source Code<br/>GitHub]
    end

    subgraph "CI/CD"
        BUILD[Cloud Build trigger<br/>sahayakai-main-deploy<br/>on push to main]
    end

    subgraph "Deployment Targets"
        subgraph "Web"
            CLOUDRUN_DEP[Cloud Run<br/>sahayakai-hotfix-resilience<br/>--no-traffic revision]
        end
        
        subgraph "Mobile"
            ANDROID[Google Play<br/>Internal Testing]
            IOS[TestFlight<br/>Apple]
        end
    end

    DEV_CODE --> BUILD
    BUILD --> CLOUDRUN_DEP
    BUILD --> ANDROID
    BUILD --> IOS

    style CLOUDRUN_DEP fill:#ffa726
    style ANDROID fill:#4caf50
    style IOS fill:#2196f3
```

> New Cloud Run revisions are built with `--no-traffic`; an operator flips traffic via `gcloud run services update-traffic ... --to-latest` after `./scripts/audit-deployments.sh` passes. There is no auto-route on deploy.

---

## 7. Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        CLIENT[Client Apps<br/>Web + Mobile]
        
        subgraph "Authentication"
            AUTH_LAYER[Firebase Auth]
            OTP[OTP Verification]
            OAUTH[Google OAuth]
        end
        
        subgraph "Authorization"
            RULES[Firestore Rules<br/>Server-side]
            TOKENS[JWT Tokens<br/>Secure Sessions]
        end
        
        subgraph "Data Protection"
            ENCRYPT[Data Encryption<br/>TLS/SSL]
            SECRETS_MGR[Secret Manager<br/>API Keys]
        end
    end

    CLIENT --> AUTH_LAYER
    AUTH_LAYER --> OTP
    AUTH_LAYER --> OAUTH
    AUTH_LAYER --> TOKENS
    
    TOKENS --> RULES
    CLIENT --> ENCRYPT
    ENCRYPT --> SECRETS_MGR

    style AUTH_LAYER fill:#f44336
    style RULES fill:#ff9800
    style ENCRYPT fill:#4caf50
```

---

## 8. Key Architectural Decisions

### 8.1 Why Separate Codebases?

| Aspect | Rationale |
|--------|-----------|
| **sahayakai-main** | The live production web app (Next.js on Cloud Run) |
| **sahayakai-flutter** | Native mobile UX and offline-first requirements (in development) |
| **sahayakai-voice-call** | Standalone streaming voicebot service for the Exotel parent-call path |
| **sahayakai-agents** | External ADK-Python sidecar for select agents (flag-gated off by default) |

### 8.2 Offline Strategy

**Web (PWA):**
- Service Workers cache UI assets
- IndexedDB stores generated content
- Background Sync queues API requests

**Mobile (Native):**
- Isar provides full NoSQL database
- Template-based fallback for offline generation
- Workmanager syncs when connection restored

### 8.3 AI Cost Optimization

1. **Semantic Caching:** Reuse similar lesson plans across teachers
2. **Template Library:** Pre-generated common topics
3. **Model Selection:** Gemini Flash (speed + cost balance)
4. **Request Batching:** Group quiz + rubric generation

---

## 9. Scalability Considerations

```mermaid
graph TB
    subgraph "Current Scale"
        PILOT[Pilot Phase<br/>~100 Teachers]
    end

    subgraph "Target Scale"
        NATIONWIDE[1M+ Teachers<br/>Nationwide]
    end

    subgraph "Scaling Strategies"
        CACHING[Aggressive Caching<br/>Redis/Firestore]
        CDN[CDN / Edge Caching<br/>in front of Cloud Run]
        ASYNC[Async Processing<br/>Cloud Tasks]
        SHARDING[Database Sharding<br/>By State/District]
    end

    PILOT --> NATIONWIDE
    NATIONWIDE -.requires.-> CACHING
    NATIONWIDE -.requires.-> CDN
    NATIONWIDE -.requires.-> ASYNC
    NATIONWIDE -.requires.-> SHARDING

    style PILOT fill:#ffeb3b
    style NATIONWIDE fill:#4caf50
```

---

## 10. Integration Points

| Integration | Purpose | Implementation |
|-------------|---------|----------------|
| **Web ↔ Mobile** | Shared user accounts | Firebase Auth sync |
| **Web ↔ Firestore** | Real-time data sync | Firebase SDK |
| **Mobile ↔ Web API** | AI generation API | `/api/ai/*` REST endpoints on Cloud Run |
| **Genkit ↔ Gemini** | LLM inference | `@genkit-ai/googleai` plugin (Gemini API key pool) |
| **App ↔ ADK-Python sidecar** | Optional agent dispatch | App Check + HMAC-signed calls (flag-gated) |
| **App ↔ Telephony** | Parent calls | Twilio REST (default) / Exotel (opt-in) |
| **All ↔ Secret Manager** | API key management | GCP SDK |

---

**Document Status:** ✅ Current  
**Last Updated:** 2026-06-10  
**Maintained By:** Engineering Team
