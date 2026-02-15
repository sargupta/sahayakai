# SahayakAI Intelligence Hub: The Classroom Partner

This folder is the "brain" of the SahayakAI ecosystem. It contains shared knowledge, standards, and schemas used by both **sahayakai-main** (Web) and **sahayakai-mobile**.

## 🧠 The "Classroom Partner" Philosophy

SahayakAI is designed NOT as a content bot, but as a specialized partner for teachers in Bharat. Every AI flow must prioritize:
1. **Multigrade Management**: Acknowledging that one teacher often handles multiple levels.
2. **Remediation-First**: Focusing on Bridging foundational learning gaps.
3. **Low-Tech Reality**: Ensuring every output is printable or "Chalk & Talk" ready.
4. **Parent Inclusivity**: Using local dialects and audio scripts for low-literacy communities.

## 🤝 Core Team & Orchestration Layer (DEFAULT PROTOCOL)

### 🌟 Core Principles (MANDATORY)
1. **Detailed Planning**: You must plan in detail, think thoroughly, review your plan and decisions, and then break things down into tasks.
2. **Scalability-First**: You must develop things from a scalability point of view. Avoid quick hacks that break at scale (e.g. client-side filtering of massive datasets).
3. **Gemini Protocol**: Adhere to this document as the single source of truth for architectural decisions.

As of Feb 2026, SahayakAI operates as a **coordinated squad** by default. Every major task is primary-agent orchestrated but peer-reviewed by specialized personas.

1. **@Antigravity (Squad Lead)**: Primary orchestrator & user partner.
2. **@PedagogyAuditor**: Validates NCERT alignment and academic rigor.
3. **@RuralReality**: Verifies feasibility in low-tech/resource-constrained environments.
4. **@ScrumMaster**: Maintains discipline in `task.md` and project organization.
5. **@SocialImpactStoryteller**: Translates product wins into high-impact digital narratives.

**Protocol**: Significant changes MUST be noted in `TEAM_SYNC_LOG.md` with sign-offs from at least one audit persona.

## ⚖️ Real Data Compliance (MANDATORY)

To maintain the reputation and integrity of the platform:
1. **No Mocking**: Under no circumstances should user profiles, teacher registrations, or community interactions be mocked or faked in production-facing components.
2. **Authentic Populating**: Initial population of community pages must pull exclusively from the registered `users` collection in Firestore.
3. **Transparency**: If a list is empty, display a "No users found" message rather than populating with dummy profiles.

## 🌿 Git Branching Strategy (MANDATORY)

To maintain stability and a "Fresh Start" environment, SahayakAI follows a tiered branching model:

1. **`main`**: Production-ready code. No direct commits allowed.
2. **`develop`**: The primary integration branch. All features/fixes are merged here first.
3. **`feature/*`**, **`fix/*`**, **`hotfix/*`**: Ephemeral branches for specific tasks. Branched from `develop` and merged back via PR/Squad Review.

**Mandatory Workflow**: Never work directly on `main`. Always create a task-specific branch from `develop`.

## 🛠️ Infrastructure Hub

- **Shared Skills**: Located at `./.agent/skills/`.
- **Shared Schemas**: Located in `./schemas/`.
    - `web/`: Contains Zod-based definitions and flow logic from `sahayakai-main`.
    - `mobile/`: Contains Dart-based models from `sahayakai-mobile`.

## 🧬 Platform Schema Alignment

While both platforms share the same pedagogical goals, some technical divergences exist:

### Lesson Plan Divergence
- **Web**: Supports full NCERT chapter alignment and detailed difficulty levels.
- **Mobile**: Currently uses a simplified model for MVP.
- **Action**: Align Mobile `LessonPlanInput` to support `ncertChapter` and `difficultyLevel`.

## 🧬 Platform Schema Alignment

Detailed strategic roadmaps and business impact analysis are maintained in:
- [VISION_AND_ROADMAP.md](file:///Users/sargupta/SahayakAIV2/sahayakai/docs/investor_materials/VISION_AND_ROADMAP.md)
- [INVESTOR_MATERIALS.md](file:///Users/sargupta/SahayakAIV2/sahayakai/docs/investor_materials/INVESTOR_MATERIALS.md)
