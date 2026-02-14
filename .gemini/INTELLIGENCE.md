# SahayakAI Intelligence Hub: The Classroom Partner

This folder is the "brain" of the SahayakAI ecosystem. It contains shared knowledge, standards, and schemas used by both **sahayakai-main** (Web) and **sahayakai-mobile**.

## 🧠 The "Classroom Partner" Philosophy

SahayakAI is designed NOT as a content bot, but as a specialized partner for teachers in Bharat. Every AI flow must prioritize:
1. **Multigrade Management**: Acknowledging that one teacher often handles multiple levels.
2. **Remediation-First**: Focusing on Bridging foundational learning gaps.
3. **Low-Tech Reality**: Ensuring every output is printable or "Chalk & Talk" ready.
4. **Parent Inclusivity**: Using local dialects and audio scripts for low-literacy communities.

## 🛠️ Infrastructure Hub

- **Shared Skills**: Located at `../.agent/skills/`.
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
