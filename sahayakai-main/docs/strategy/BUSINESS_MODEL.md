# SahayakAI: Business Model & Strategic Framework

**Version:** 1.1
**Date:** 2026-06-10
**Status:** Draft / Pilot Phase

---

## 1. Executive Summary
SahayakAI is an AI-powered teaching assistant that addresses India's systemic education-quality crisis across **all school types** (government, private, and chain/enterprise). The platform already supports a `resourceLevel` setting of low, medium, and high, so it adapts equally to a chalk-and-blackboard classroom and a smart classroom. Built on a "Bharat First" philosophy, it addresses linguistic diversity, curriculum alignment, and the need for culturally relevant pedagogy. By leveraging Google Gemini (default model `gemini-2.5-flash`) through Genkit on a serverless Cloud Run architecture, it democratizes access to high-quality lesson planning and content creation.

## 2. Mission & Vision
*   **Mission:** To transform every rural teacher into a "Super Teacher" by providing an intelligent, voice-first assistant that works in their local language and context.
*   **Vision:** A nationwide platform where high-quality, standardized, and engaging education is accessible to every student in India, regardless of their location or school infrastructure.

## 3. Value Proposition

### For Teachers (The Users)
*   **Contextual Relevance:** Generates lesson plans using local examples (e.g., farming, monsoon, local festivals, Indian currency) rather than alien western concepts.
*   **Resource Awareness:** Intelligently adapts suggestions based on available infrastructure (e.g., "Chalk & Blackboard only" vs. "Smart Classroom").
*   **Accessibility:** Voice-first interface eliminates typing barriers; full support for Indian regional languages.
*   **Time Efficiency:** Reduces lesson planning time from hours to minutes, allowing teachers to focus on student interaction.
*   **Offline Resilience:** Designed as a PWA to function in areas with intermittent or zero internet connectivity.

### For Government & Schools (The Customers/Partners)
*   **Standardization:** Ensures alignment with National Curriculum Framework (NCF) and State Board syllabi.
*   **Teacher Empowerment:** Acts as an on-the-job training and support tool, uplifting teaching quality at scale.
*   **Data-Driven Capabilities:** (Future) Provides visibility into teaching activities and curriculum coverage through anonymized analytics.

## 4. Target Market
*   **Total Addressable Market:** All ~10.1M teachers across every school type in India, estimated at ₹15,000-20,000 Cr. This is NOT limited to the government-only segment.
*   **Segments:** Government schools, private schools (Tier 2 CBSE mid-fee being the strongest private beachhead), school chains/enterprise, and individual teachers via B2C freemium.
*   **Key Stakeholders:** State Education Departments, Ministry of Education, private school managements, chain operators, and individual teachers.

## 5. Revenue Model & Sustainability
SahayakAI operates a four-lane revenue model rather than a government-only model:

*   **Lane 1, B2G:** Licensing the platform to State Education Boards for statewide deployment.
*   **Lane 2, B2B Private School:** Per-school or per-seat subscriptions for private schools.
*   **Lane 3, B2B Chain/Enterprise:** Multi-school contracts for chains and enterprise operators (seat-based `Organization` plans already modelled in code: gold/premium).
*   **Lane 4, B2C Freemium:** Individual teachers on free/pro/gold/premium plans via Razorpay subscriptions; generates cash from Month 1.
*   **Supplementary Revenue Stream:** CSR Partnerships. `TODO(verify: named CSR/corporate partners)`
*   **Cost Management Strategy:**
    *   **Semantic Caching:** To mitigate high LLM API costs, the system uses a semantic cache. If a lesson plan for "Photosynthesis Class 7" is generated once, subsequent requests from other teachers are served from the cache, drastically reducing token usage.
    *   **Serverless Architecture:** Pay-per-use infrastructure (Firebase) prevents paying for idle server time.

## 6. Key Resources & Infrastructure
*   **Technology Stack:** Next.js on Google Cloud Run (region asia-southeast1, project sahayakai-b4248), Firebase (Auth, Firestore, Storage, Admin SDK), Google Genkit, Gemini (default `gemini-2.5-flash`; `gemini-2.5-pro` for assignment grading; `gemini-3-pro-image-preview` and `gemini-2.5-flash-image` for image generation). Payments via Razorpay. Parent-call telephony via Twilio (default) with an opt-in Exotel streaming path. STT/TTS via Google Cloud TTS and Sarvam AI.
*   **Knowledge Base:** NCERT Curriculum database, State Board mappings, "Indian Context" example repository.
*   **Human Capital:** Engineering team, pedagogical experts, regional language translators.

## 7. Operational Roadmap to Scale
*   **Phase 1: Pilot (Current):** Focus on usability, "Indian Context" features, and field testing with a small group of teachers.
*   **Phase 2: Community & Growth:** Introduce gamification, teacher profiles, and a shared library of lesson plans.
*   **Phase 3: Ecosystem:** Integration with student/parent communication channels (SMS summaries) and expansion to all State Boards.

## 8. Competitive Advantage
| Feature | Generic AI (ChatGPT/Claude) | SahayakAI |
| :--- | :--- | :--- |
| **Context** | Generic, often Western | Hyper-local "Bharat" context |
| **Interface** | Text-heavy, typing required | Voice-first, regional languages |
| **Curriculum** | General knowledge | Strictly mapped to NCERT/State Boards |
| **Connectivity** | Requires always-on Internet | "Hybrid Offline" / PWA support |
| **Resources** | Assumes high-tech availability | Adapts to low-resource settings |

## 9. Risks & Mitigation
*   **Risk:** ongoing AI API costs. -> **Mitigation:** Aggressive caching and model optimization (Flash models).
*   **Risk:** Low digital literacy among teachers. -> **Mitigation:** Voice-first UX and "Zero-Learning-Curve" design.
*   **Risk:** Device fragmentation. -> **Mitigation:** Lightweight web app (PWA) compatible with low-end Android devices.

---
**Prepared for:** SahayakAI Leadership Team
