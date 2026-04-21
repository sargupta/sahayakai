# SahayakAI: Complete AI Flows Inventory
**Teacher UX Review | April 21, 2026**

> This document catalogs every AI feature in SahayakAI, detailing flows, API routes, inputs, outputs, costs, and language support. Use this to plan the full teacher journey and estimate implementation costs.

---

## Executive Summary

- **Total AI Flows**: 16 exported functions
- **API Endpoints**: 16 public routes (17 with streaming variants)
- **AI Models Used**: Primarily `gemini-2.0-flash` (text), `gemini-2.5-flash` (text/metadata), `gemini-3-pro-image-preview` (image gen)
- **Language Support**: 11 Indian languages + English (Hindi, Tamil, Telugu, Kannada, Bengali, Marathi, Gujarati, Punjabi, Odia, Malayalam, Assamese)
- **Estimated Cost (One Teacher, All Features Once)**: ~$0.214 USD (per COST_ANALYSIS.md)

---

## SECTION A: Text Generation Flows

### 1. Instant Answer
- **Function Export**: `instantAnswer()`
- **File**: `/src/ai/flows/instant-answer.ts`
- **API Route**: `POST /api/ai/instant-answer`
- **What It Does**: Answers teacher questions with web grounding (Google Search), returns optional YouTube video suggestion. E.g., "What is photosynthesis?" → structured answer + video link.
- **Inputs**:
  - `question` (string, required)
  - `language` (optional, e.g., "Hindi", "Tamil")
  - `gradeLevel` (optional, e.g., "Class 5")
  - `subject` (optional)
  - `userId` (optional)
- **Output Shape**:
  ```json
  {
    "answer": "string (in specified language)",
    "videoSuggestionUrl": "string or null",
    "gradeLevel": "string or null",
    "subject": "string or null"
  }
  ```
- **SDK Calls**:
  - `ai.generate({ model: 'googleai/gemini-2.0-flash' })` with `googleSearch` tool
  - **Cost Signal**: Uses Google Search grounding ($35/1000 calls) + LLM tokens
- **Streaming**: No
- **Tool Use**: Yes (`googleSearch` tool)
- **Language Support**: ✅ 11 Indian languages (enforced in prompt with language lock)
- **UI Page Trigger**: Likely sidebar "Ask Sahayak" or instant-answer page
- **Estimated Cost**: ~$0.035/call (dominated by grounding request at $0.035)

---

### 2. Quiz Generator (Quiz Definitions)
- **Function Export**: `quizGeneratorFlow()`
- **File**: `/src/ai/flows/quiz-definitions.ts`
- **API Route**: `POST /api/ai/quiz`
- **What It Does**: Generates structured quizzes (MCQ, true/false, etc.) from text topic or textbook image. Returns questions with answers, explanations, and difficulty levels.
- **Inputs**:
  - `topic` (string, required)
  - `numQuestions` (number, e.g., 10)
  - `questionTypes` (array, e.g., ["mcq", "true_false"])
  - `gradeLevel` (string, e.g., "Class 5")
  - `language` (string, required)
  - `imageDataUri` (optional, textbook page)
  - `targetDifficulty` (optional: "easy", "medium", "hard")
  - `bloomsTaxonomyLevels` (optional array)
  - `userId` (optional)
  - `teacherContext` (optional)
- **Output Shape**:
  ```json
  {
    "title": "Photosynthesis & Plant Life Quiz",
    "questions": [
      {
        "questionText": "string",
        "questionType": "mcq|true_false|...",
        "options": ["a", "b", "c", "d"],
        "correctAnswer": "a",
        "explanation": "string",
        "difficultyLevel": "easy|medium|hard",
        "bloomsLevel": "remember|understand|apply|..."
      }
    ],
    "gradeLevel": "Class X",
    "subject": "Science",
    "language": "English|Hindi|...",
    "teacherInstructions": "string"
  }
  ```
- **SDK Calls**:
  - `ai.generate({ model: 'googleai/gemini-2.0-flash' })`
  - Optional image processing if `imageDataUri` provided
- **Streaming**: No (but validation pass exists)
- **Tool Use**: No
- **Language Support**: ✅ 11 Indian languages (enforced in prompt)
- **UI Page Trigger**: "Quiz" page / quiz-creation form
- **Estimated Cost**: ~$0.001/call (text-only, no grounding)

---

### 3. Lesson Plan Generator
- **Function Export**: `generateLessonPlan()`
- **File**: `/src/ai/flows/lesson-plan-generator.ts`
- **API Route**: `POST /api/ai/lesson-plan` + streaming variant `POST /api/ai/lesson-plan/stream`
- **What It Does**: Generates complete lesson plans (5E model: Engage, Explore, Explain, Elaborate, Evaluate) with activities, materials, assessments. Includes materials audit (2nd LLM call) to ensure consistency.
- **Inputs**:
  - `topic` (string, required)
  - `language` (optional, e.g., "Hindi")
  - `gradeLevels` (array, e.g., ["Class 5", "Class 6"])
  - `imageDataUri` (optional, textbook image)
  - `userId` (optional)
  - `teacherContext` (optional)
  - `useRuralContext` (optional boolean, default true)
  - `ncertChapter` (optional, aligned content)
  - `resourceLevel` (optional: "low"=chalk, "medium"=basic, "high"=tech)
  - `difficultyLevel` (optional: "remedial", "standard", "advanced")
  - `subject` (optional)
- **Output Shape**:
  ```json
  {
    "title": "string",
    "gradeLevel": "Class X",
    "duration": "45 minutes",
    "subject": "Science",
    "objectives": ["SWBAT identify...", "..."],
    "keyVocabulary": [
      {"term": "Photosynthesis", "meaning": "..."}
    ],
    "materials": ["chalk", "leaves", "..."],
    "activities": [
      {
        "phase": "Engage|Explore|Explain|Elaborate|Evaluate",
        "name": "string",
        "description": "string",
        "duration": "15 minutes",
        "teacherTips": "string",
        "understandingCheck": "string"
      }
    ],
    "assessment": "string",
    "homework": "string",
    "language": "Hindi|English|..."
  }
  ```
- **SDK Calls**:
  - Main generation: `ai.generate({ model: 'googleai/gemini-2.0-flash' })`
  - Materials audit: `ai.generate({ model: 'googleai/gemini-2.0-flash' })` (second call)
  - Cache lookup before generation (Firestore)
- **Streaming**: Yes (via `/stream` endpoint)
- **Tool Use**: No (but uses Google Search grounding internally if enabled — currently optional)
- **Language Support**: ✅ 11 Indian languages (language lock enforced)
- **UI Page Trigger**: "Lesson Plan" page / lesson-plan-wizard
- **Estimated Cost**: ~$0.037/call (2 LLM calls + materials audit; note: some versions include Google Search grounding at $0.035 additional)
- **Caching**: Yes (6-hour TTL for identical topic/grade/language)

---

### 4. Worksheet Wizard
- **Function Export**: `generateWorksheet()`
- **File**: `/src/ai/flows/worksheet-wizard.ts`
- **API Route**: `POST /api/ai/worksheet`
- **What It Does**: Creates structured worksheets from textbook image + prompt. Returns activities (questions, puzzles, tasks), answer key, learning objectives. Designed for blackboard transcription.
- **Inputs**:
  - `imageDataUri` (string, required — base64 textbook page)
  - `prompt` (string, required — e.g., "Create MCQs about chapter 2")
  - `language` (optional)
  - `gradeLevel` (optional)
  - `userId` (optional)
  - `subject` (optional)
  - `teacherContext` (optional)
- **Output Shape**:
  ```json
  {
    "title": "Worksheet: [Topic]",
    "gradeLevel": "Class X",
    "subject": "Science",
    "learningObjectives": ["string"],
    "studentInstructions": "string",
    "activities": [
      {
        "type": "question|puzzle|creative_task",
        "content": "string (LaTeX supported)",
        "explanation": "Bharat-First pedagogical note",
        "chalkboardNote": "How to write on blackboard"
      }
    ],
    "answerKey": [
      {
        "activityIndex": 0,
        "answer": "string"
      }
    ],
    "worksheetContent": "string (Markdown, auto-generated)"
  }
  ```
- **SDK Calls**:
  - Image processing: `fetchImageAsBase64()` if needed
  - Generation: `ai.generate({ model: 'googleai/gemini-2.0-flash' })`
- **Streaming**: No
- **Tool Use**: No
- **Language Support**: ✅ 11 Indian languages (language lock enforced)
- **UI Page Trigger**: "Worksheet" page / worksheet-creation form
- **Estimated Cost**: ~$0.002/call (multimodal input with image)

---

### 5. Virtual Field Trip
- **Function Export**: `planVirtualFieldTrip()`
- **File**: `/src/ai/flows/virtual-field-trip.ts`
- **API Route**: `POST /api/ai/virtual-field-trip`
- **What It Does**: Plans immersive Google Earth virtual field trips with 3-5 stops, educational facts, reflection prompts, Bharat-First analogies. Each stop includes Google Earth URL.
- **Inputs**:
  - `topic` (string, required, e.g., "Indus Valley Civilization")
  - `language` (optional)
  - `gradeLevel` (optional)
  - `userId` (optional)
- **Output Shape**:
  ```json
  {
    "title": "string",
    "stops": [
      {
        "name": "Location Name",
        "description": "string",
        "educationalFact": "string",
        "reflectionPrompt": "string",
        "googleEarthUrl": "https://earth.google.com/web/search/...",
        "culturalAnalogy": "Like [Indian example]...",
        "explanation": "Pedagogical reasoning"
      }
    ],
    "gradeLevel": "Class X",
    "subject": "Geography|History|..."
  }
  ```
- **SDK Calls**:
  - `ai.generate({ model: 'googleai/gemini-2.0-flash' })`
- **Streaming**: No
- **Tool Use**: No
- **Language Support**: ✅ 11 Indian languages
- **UI Page Trigger**: "Virtual Field Trip" page / geography/social studies section
- **Estimated Cost**: ~$0.001/call (text-only)

---

### 6. Rubric Generator
- **Function Export**: `generateRubric()`
- **File**: `/src/ai/flows/rubric-generator.ts`
- **API Route**: `POST /api/ai/rubric`
- **What It Does**: Creates detailed 4-level grading rubrics (Exemplary, Proficient, Developing, Beginning) with point allocations and measurable criteria.
- **Inputs**:
  - `assignmentDescription` (string, required)
  - `gradeLevel` (optional)
  - `subject` (optional)
  - `language` (optional)
  - `userId` (optional)
  - `teacherContext` (optional)
- **Output Shape**:
  ```json
  {
    "title": "Science Project Rubric",
    "description": "string",
    "criteria": [
      {
        "name": "Research and Content",
        "description": "string",
        "levels": [
          {
            "name": "Exemplary",
            "description": "string",
            "points": 4
          },
          {
            "name": "Proficient",
            "description": "string",
            "points": 3
          },
          {
            "name": "Developing",
            "description": "string",
            "points": 2
          },
          {
            "name": "Beginning",
            "description": "string",
            "points": 1
          }
        ]
      }
    ],
    "gradeLevel": "Class X",
    "subject": "Science"
  }
  ```
- **SDK Calls**:
  - `ai.generate({ model: 'googleai/gemini-2.0-flash' })`
- **Streaming**: No
- **Tool Use**: No
- **Language Support**: ✅ 11 Indian languages
- **UI Page Trigger**: "Assessment" / "Rubric" page
- **Estimated Cost**: ~$0.0005/call (simple structured output)

---

### 7. Teacher Training (Pedagogical Advice)
- **Function Export**: `getTeacherTrainingAdvice()`
- **File**: `/src/ai/flows/teacher-training.ts`
- **API Route**: `POST /api/ai/teacher-training`
- **What It Does**: Provides rigorous pedagogical coaching on classroom challenges (e.g., "How do I manage a chaotic class?" → actionable strategies grounded in pedagogy theory).
- **Inputs**:
  - `question` (string, required, e.g., "How do I engage disengaged students?")
  - `language` (optional)
  - `subject` (optional)
  - `userId` (optional)
- **Output Shape**:
  ```json
  {
    "introduction": "string",
    "advice": [
      {
        "strategy": "string",
        "pedagogy": "Constructivism|Scaffolding|...",
        "explanation": "string with Indian analogy"
      }
    ],
    "conclusion": "string (motivational)",
    "gradeLevel": "Class X or null",
    "subject": "Pedagogy|Classroom Management|..."
  }
  ```
- **SDK Calls**:
  - `ai.generate({ model: 'googleai/gemini-2.0-flash' })`
- **Streaming**: No
- **Tool Use**: No
- **Language Support**: ✅ 11 Indian languages
- **UI Page Trigger**: "Teacher Training" / "Ask an Expert" section
- **Estimated Cost**: ~$0.0007/call (Q&A, no grounding)

---

### 8. Exam Paper Generator
- **Function Export**: `generateExamPaper()`
- **File**: `/src/ai/flows/exam-paper-generator.ts`
- **API Route**: `POST /api/ai/exam-paper` + streaming `/api/ai/exam-paper/stream`
- **What It Does**: Generates complete board-pattern exam papers (CBSE/ICSE/State) with sections, questions, answer keys, marking schemes. Retrieves relevant Previous Year Questions (PYQs) from in-memory store or Firestore.
- **Inputs**:
  - `board` (string, required, e.g., "CBSE")
  - `gradeLevel` (string, required, e.g., "Class 10")
  - `subject` (string, required)
  - `chapters` (array of strings)
  - `duration` (optional, in minutes)
  - `maxMarks` (optional, defaults to blueprint)
  - `language` (optional)
  - `difficulty` (optional: "easy", "moderate", "hard", "mixed")
  - `includeAnswerKey` (boolean, default true)
  - `includeMarkingScheme` (boolean, default true)
  - `userId` (optional)
  - `teacherContext` (optional)
- **Output Shape**:
  ```json
  {
    "title": "CBSE Class 10 Mathematics Sample Paper",
    "board": "CBSE",
    "subject": "Mathematics",
    "gradeLevel": "Class 10",
    "duration": "3 Hours",
    "maxMarks": 100,
    "generalInstructions": ["string"],
    "sections": [
      {
        "name": "Section A",
        "label": "Multiple Choice Questions",
        "totalMarks": 20,
        "questions": [
          {
            "number": 1,
            "text": "string",
            "marks": 1,
            "options": ["(a)...", "(b)...", "(c)...", "(d)..."],
            "answerKey": "string",
            "markingScheme": "string",
            "source": "AI Generated|PYQ 2023"
          }
        ]
      }
    ],
    "blueprintSummary": {
      "chapterWise": [{"chapter": "...", "marks": 25}],
      "difficultyWise": [{"level": "easy", "percentage": 30}]
    },
    "pyqSources": [
      {"id": "...", "year": 2023, "chapter": "..."}
    ]
  }
  ```
- **SDK Calls**:
  - PYQ retrieval: In-memory `pyq-store` or Firestore vector search
  - Generation: `ai.generate({ model: 'googleai/gemini-2.0-flash' })`
- **Streaming**: Yes (via `/stream` endpoint)
- **Tool Use**: No
- **Language Support**: ✅ 11 Indian languages
- **UI Page Trigger**: "Exam Paper" / board-selection page
- **Estimated Cost**: ~$0.001–0.015/call (varies with PYQ retrieval overhead)

---

### 9. Parent Message Generator
- **Function Export**: `generateParentMessage()`
- **File**: `/src/ai/flows/parent-message-generator.ts`
- **API Route**: `POST /api/ai/parent-message`
- **What It Does**: Generates empathetic, ready-to-send parent notifications (absence alerts, performance concerns, behavioral notes, positive feedback). Outputs BCP-47 language code for TTS integration.
- **Inputs**:
  - `studentName` (string)
  - `className` (string, e.g., "Class 5A")
  - `subject` (string)
  - `reason` (enum: "consecutive_absences", "poor_performance", "behavioral_concern", "positive_feedback")
  - `parentLanguage` (string, e.g., "Hindi")
  - `consecutiveAbsentDays` (optional)
  - `teacherNote` (optional)
  - `teacherName` (optional)
  - `schoolName` (optional)
  - `userId` (optional)
- **Output Shape**:
  ```json
  {
    "message": "string (complete message, <250 words, in parent's language)",
    "languageCode": "hi-IN",
    "wordCount": 120
  }
  ```
- **SDK Calls**:
  - `ai.generate({ model: 'googleai/gemini-2.0-flash' })`
- **Streaming**: No
- **Tool Use**: No
- **Language Support**: ✅ 11 Indian languages (BCP-47 codes hardcoded)
- **UI Page Trigger**: "Parent Engagement" / "Send Message to Parent" page
- **Estimated Cost**: ~$0.0008/call (template-based, short output)

---

## SECTION B: Image Generation Flows

### 10. Visual Aid Designer
- **Function Export**: `generateVisualAid()`
- **File**: `/src/ai/flows/visual-aid-designer.ts`
- **API Route**: `POST /api/ai/visual-aid`
- **What It Does**: Generates black-and-white chalkboard-style educational diagrams. Uses image-generation model, then a second LLM call for pedagogical context + discussion prompt.
- **Inputs**:
  - `prompt` (string, required, e.g., "plant cell diagram with labels")
  - `language` (optional)
  - `gradeLevel` (optional)
  - `userId` (optional)
  - `subject` (optional)
- **Output Shape**:
  ```json
  {
    "imageDataUri": "data:image/png;base64,...",
    "pedagogicalContext": "string",
    "discussionSpark": "string (focus question)",
    "subject": "Science",
    "storagePath": "users/{userId}/visual-aids/..." (if persisted)
  }
  ```
- **SDK Calls**:
  - Image generation: `ai.generate({ model: 'googleai/gemini-3-pro-image-preview' })`
  - Metadata generation: `ai.generate({ model: 'googleai/gemini-2.5-flash' })`
- **Streaming**: No (but 90s timeout on image generation)
- **Tool Use**: No
- **Language Support**: ✅ 11 Indian languages (for pedagogical context)
- **UI Page Trigger**: "Visual Aids" / content-creation page
- **Estimated Cost**: ~$0.040/call (dominated by image generation at $0.03–0.05)
- **Rate Limits**: Image generation rate-limited per user (checkImageRateLimit)

---

### 11. Avatar Generator
- **Function Export**: `generateAvatar()`
- **File**: `/src/ai/flows/avatar-generator.ts`
- **API Route**: `POST /api/ai/avatar`
- **What It Does**: Generates unique, photorealistic profile avatars for teachers. Ensures diversity based on name (gender inference).
- **Inputs**:
  - `name` (string, required, e.g., "Priya Singh")
  - `userId` (optional)
- **Output Shape**:
  ```json
  {
    "imageDataUri": "data:image/png;base64,..."
  }
  ```
- **SDK Calls**:
  - `ai.generate({ model: 'googleai/gemini-2.5-flash-image' })`
- **Streaming**: No
- **Tool Use**: No
- **Language Support**: N/A (image generation is language-agnostic)
- **UI Page Trigger**: "Profile" / "Edit Profile" page
- **Estimated Cost**: ~$0.040/call
- **Note**: One-time per teacher; can be regenerated if teacher changes name

---

## SECTION C: Voice/Audio Flows

### 12. Voice-to-Text (Speech-to-Text)
- **Function Export**: `voiceToText()` and `voiceToTextFormData()`
- **File**: `/src/ai/flows/voice-to-text.ts`
- **API Route**: `POST /api/ai/voice-to-text`
- **What It Does**: Transcribes audio (multimodal Gemini) and detects language. Handles Indian languages + English, noisy classrooms, code-switching (Hinglish).
- **Inputs**:
  - `audioDataUri` (string, base64 audio) OR FormData with 'audio' file
- **Output Shape**:
  ```json
  {
    "text": "Transcribed text",
    "language": "en|hi|ta|te|kn|bn|mr|gu|pa|ml|or"
  }
  ```
- **SDK Calls**:
  - `ai.generate({ model: 'googleai/gemini-2.0-flash' })` with audio input (multimodal)
- **Streaming**: No
- **Tool Use**: No
- **Language Support**: ✅ 11 Indian languages (auto-detection via model)
- **UI Page Trigger**: Mic button on any AI flow (quiz creation, lesson plan, etc.)
- **Estimated Cost**: ~$0.02/minute of audio (gemini-2.0-flash audio pricing)

---

## SECTION D: Multi-Turn / Agent Flows

### 13. Parent Call Agent (Conversational)
- **Function Export**: `generateAgentReply()` and `generateCallSummary()`
- **File**: `/src/ai/flows/parent-call-agent.ts`
- **API Routes**: Not yet mapped (internal functions)
- **What It Does**: Two functions:
  1. **generateAgentReply**: Generates next conversational turn for a phone call with a parent. Maintains context from transcript.
  2. **generateCallSummary**: Summarizes completed call with action items, parent sentiment, recommendations for follow-up.
- **Inputs (Agent Reply)**:
  - `studentName`, `className`, `subject` (context)
  - `reason` (enum)
  - `teacherMessage` (original message)
  - `parentLanguage` (string)
  - `transcript` (array of {role, text})
  - `parentSpeech` (what parent just said)
  - `turnNumber` (max 6)
- **Output (Agent Reply)**:
  ```json
  {
    "reply": "string (3-4 sentences, in parent's language)",
    "shouldEndCall": boolean,
    "followUpQuestion": "string or null"
  }
  ```
- **Inputs (Call Summary)**:
  - Same context + full transcript + `callDurationSeconds`
- **Output (Call Summary)**:
  ```json
  {
    "parentResponse": "string (1-2 sentences, English)",
    "parentConcerns": ["string"],
    "parentCommitments": ["string"],
    "actionItemsForTeacher": ["string"],
    "guidanceGiven": ["string"],
    "parentSentiment": "cooperative|concerned|grateful|upset|indifferent|confused",
    "callQuality": "productive|brief|difficult|unanswered",
    "followUpNeeded": boolean,
    "followUpSuggestion": "string or null"
  }
  ```
- **SDK Calls**:
  - `ai.generate({ model: 'googleai/gemini-2.0-flash' })`
- **Streaming**: No
- **Tool Use**: No
- **Language Support**: ✅ 11 Indian languages (reply), output in English (summary)
- **UI Page Trigger**: Not yet integrated into UI (future feature)
- **Estimated Cost**: ~$0.0008–0.001/turn (short prompts)

---

### 14. Agent Router (Intent Classification)
- **Function Export**: `agentRouterFlow()`
- **File**: `/src/ai/flows/agent-definitions.ts`
- **API Route**: `POST /api/ai/intent`
- **What It Does**: Classifies teacher's natural-language intent and extracts parameters (topic, grade, subject, language) to route to appropriate AI flow. Handles Hindi/Hinglish/Indian language names for content types.
- **Inputs**:
  - `prompt` (string, required, e.g., "बनाइए class 5 के लिए विज्ञान क्विज")
  - `language` (optional)
  - `gradeLevels` (optional array)
  - `imageDataUri` (optional)
  - `userId` (optional)
- **Output Shape**:
  ```json
  {
    "type": "lessonPlan|quiz|visualAid|worksheet|virtualFieldTrip|teacherTraining|rubric|examPaper|instantAnswer|videoStoryteller|unknown",
    "topic": "string or null",
    "gradeLevel": "Class X or null",
    "subject": "string or null",
    "language": "string or null",
    "result": null (awaits downstream flow)
  }
  ```
- **SDK Calls**:
  - `ai.generate({ model: 'googleai/gemini-2.0-flash' })`
- **Streaming**: No
- **Tool Use**: No
- **Language Support**: ✅ Handles 11 Indian languages in input
- **UI Page Trigger**: "Search bar" / "Ask Sahayak" command entry
- **Estimated Cost**: ~$0.0003/call (lightweight classification)

---

## SECTION E: Video/Resource Discovery Flows

### 15. Video Storyteller (YouTube Recommendation)
- **Function Export**: `getVideoRecommendations()`
- **File**: `/src/ai/flows/video-storyteller.ts`
- **API Route**: `POST /api/ai/video-storyteller`
- **What It Does**: Multi-tier video recommendation system. Generates YouTube search queries via LLM, fetches videos via RSS + YouTube API, ranks locally by authority (Govt > NGO > EdTech), language, state SCERT alignment, and topic relevance. Returns 5 categorized carousels (storytelling, pedagogy, courses, government updates, top recommended). Caches results (6-hour TTL).
- **Inputs**:
  - `subject` (string, e.g., "Science")
  - `gradeLevel` (string, e.g., "Class 5")
  - `language` (optional, e.g., "Hindi")
  - `state` (optional, e.g., "Maharashtra")
  - `educationBoard` (optional, "CBSE", "ICSE", or state board)
  - `topic` (optional, e.g., "Photosynthesis")
  - `userId` (optional)
- **Output Shape**:
  ```json
  {
    "categories": {
      "storytelling": [{video objects}],
      "pedagogy": [{video objects}],
      "courses": [{video objects}],
      "govtUpdates": [{video objects}],
      "topRecommended": [{video objects}]
    },
    "personalizedMessage": "Namaste Adhyapak! Here are curated videos...",
    "categorizedVideos": {...},
    "fromCache": boolean,
    "latencyScore": milliseconds
  }
  ```
- **SDK Calls**:
  - LLM query generation: `ai.generate({ model: 'googleai/gemini-2.0-flash' })`
  - Parallel: YouTube RSS fetch + YouTube API call
  - Firestore cache read/write
- **Streaming**: No (but highly optimized for latency)
- **Tool Use**: No (custom ranking algorithm, deterministic)
- **Language Support**: ✅ 11 Indian languages (searches Indian channels, state SCERT channels, respects language preference)
- **UI Page Trigger**: "Video Storyteller" / "Resources" page
- **Estimated Cost**: ~$0.0001/call (LLM call only; RSS and YouTube API are free; Firestore write ~$0.0000018)
- **Caching**: Yes (6-hour TTL by subject+grade; cache hit = $0)
- **Special Notes**:
  - State SCERT channels hardcoded per state (e.g., Maharashtra SCERT for teachers in Maharashtra)
  - Language-first: Videos in teacher's language get +15 boost
  - Penalizes exam-coaching content (NEET, JEE) — designed for classroom teachers, not students

---

## SECTION F: Support / Utility Flows

### 16. Quiz Definitions (Enhanced Validation)
- **File**: `/src/ai/flows/quiz-definitions-enhanced-validation.ts`
- **What It Does**: Validation and sanitization utilities for quiz output. Not itself a flow, but critical for quiz-generator robustness.
- **Functions**:
  - `validateQuizOutput()`: Checks schema compliance
  - `sanitizeQuizOutput()`: Fixes common AI mistakes before validation

---

## SECTION G: Tools

### Google Search Tool
- **File**: `/src/ai/tools/google-search.ts`
- **Used By**: `instantAnswer`, `lessonPlan` (optional)
- **What It Does**: Searches Google for up-to-date information. Returns results (title, link, snippet) and optional video URL.
- **Cost**: $35/1,000 requests (when used)

---

## SECTION H: API Routes Summary

| Route | HTTP Method | Flow Function | Streaming? |
|-------|------------|---------------|-----------|
| `/api/ai/instant-answer` | POST | `instantAnswer()` | No |
| `/api/ai/quiz` | POST | `quizGeneratorFlow()` | No |
| `/api/ai/lesson-plan` | POST | `lessonPlanFlow()` | No |
| `/api/ai/lesson-plan/stream` | POST | `lessonPlanFlow()` | Yes |
| `/api/ai/worksheet` | POST | `worksheetWizardFlow()` | No |
| `/api/ai/virtual-field-trip` | POST | `virtualFieldTripFlow()` | No |
| `/api/ai/rubric` | POST | `rubricGeneratorFlow()` | No |
| `/api/ai/teacher-training` | POST | `teacherTrainingFlow()` | No |
| `/api/ai/visual-aid` | POST | `visualAidFlow()` | No |
| `/api/ai/avatar` | POST | `generateAvatar()` | No |
| `/api/ai/voice-to-text` | POST | `voiceToText()` / `voiceToTextFormData()` | No |
| `/api/ai/video-storyteller` | POST | `getVideoRecommendations()` | No |
| `/api/ai/exam-paper` | POST | `examPaperGeneratorFlow()` | No |
| `/api/ai/exam-paper/stream` | POST | `examPaperGeneratorFlow()` | Yes |
| `/api/ai/parent-message` | POST | `generateParentMessage()` | No |
| `/api/ai/intent` | POST | `agentRouterFlow()` | No |

---

## Cost Breakdown: Full Teacher Journey

One teacher exercises **every AI feature once** (realistic monthly scenario):

| Feature | Cost | Notes |
|---------|------|-------|
| Instant Answer (1 call) | $0.035 | Google Search grounding dominates |
| Lesson Plan (1 call) | $0.037 | 2 LLM calls + materials audit |
| Visual Aid (1 image) | $0.040 | Image generation ($0.03–0.05) |
| Avatar (1 image) | $0.040 | Image generation |
| Quiz Generator (1 call) | $0.001 | Text-only |
| Worksheet Wizard (1 call) | $0.002 | Multimodal with image |
| Virtual Field Trip (1 call) | $0.001 | Text-only |
| Rubric Generator (1 call) | $0.0005 | Simple structured output |
| Teacher Training (1 call) | $0.0007 | Q&A |
| Exam Paper (1 call) | $0.001 | Text-only (PYQ retrieval overhead negligible) |
| Parent Message (1 call) | $0.0008 | Template-based |
| Video Storyteller (1 call) | $0.0001 | Cache hit likely; LLM call minimal |
| Voice-to-Text (3 min audio) | $0.060 | $0.02/min × 3 |
| **Gemini LLM tokens (~2,000 chars TTS)** | $0.0032 | Neural2 TTS chars |
| **Firestore** (60 reads, 25 writes) | $0.0008 | Negligible |
| **Cloud Storage** (10 files, 5 MB) | $0.0001 | Negligible |
| **Cloud Run compute** (3 min) | $0.007 | 1 vCPU-second @ $0.000048 |
| **TOTAL** | **~$0.224** | ~22 US cents per full journey |

---

## Language Support Matrix

| Language | Code | Supported? | TTS Tier | Notes |
|----------|------|-----------|----------|-------|
| English | en | ✅ | Standard | Fallback if others fail |
| Hindi | hi | ✅ | Neural2 | Devanagari script |
| Tamil | ta | ✅ | Wavenet | Southern India |
| Telugu | te | ✅ | Standard | Southern India |
| Kannada | kn | ✅ | Wavenet | Southern India |
| Bengali | bn | ✅ | Wavenet | Eastern India |
| Marathi | mr | ✅ | Wavenet | Western India |
| Gujarati | gu | ✅ | Wavenet | Western India |
| Punjabi | pa | ✅ | Wavenet | Northern India |
| Odia | or | ✅ | Standard | Eastern India |
| Malayalam | ml | ✅ | Wavenet | South-Western India |
| Assamese | as | ⚠️ (Limited) | — | Not yet in TTS tier config |

**Language Lock Implementation**: Every flow enforces language via prompt constraint: "You MUST ONLY respond in {language}. Do NOT shift into other languages."

---

## Streaming & Real-Time Capabilities

| Flow | Streaming? | Format | Use Case |
|------|-----------|--------|----------|
| Lesson Plan | ✅ Yes | Chunked JSON or text | Real-time generation progress |
| Exam Paper | ✅ Yes | Chunked sections | Progressive reveal of sections |
| All Others | ❌ No | Full response | Standard request-response |

---

## Caching & Performance Optimization

| Flow | Cache Type | Key | TTL | Cost Impact |
|------|-----------|-----|-----|-------------|
| Lesson Plan | Firestore | topic + grade + language | 24h | 100% hit → $0 cost |
| Video Storyteller | Firestore | subject + gradeLevel | 6h | Cache hit → $0 LLM cost |
| Instant Answer | ❌ None | — | — | No caching |
| Parent Message | ❌ None | — | — | No caching |
| VIDYA Assistant | In-memory + Firestore | user_id + prompt | 1h (L1) + 24h (L2) | Hit → $0 cost |
| TTS Responses | In-memory | text hash | Session | Common phrases → $0 cost |

---

## Security & Safety Features

All flows include:
- **Safety validation** (`validateTopicSafety()`) — blocks unsafe topics before LLM
- **Rate limiting** — per-user (15 req/10 min) via `checkServerRateLimit()`
- **Image rate limiting** — visual-aid and avatar limited per user
- **Language lock** — enforced in every system prompt to prevent language drift
- **No Repetition Loop Detection** — prompts instruct LLM to break loops immediately
- **Scope Integrity** — prompts restrict responses to educational domain only

---

## Missing / Future Flows

**In Codebase But Not Yet Exposed**:
- Parent Call Agent (conversational, implemented but no API route)

**Not Yet Implemented**:
- Image upload from library (read existing visual aids)
- Content remix (combine multiple sources)
- Collaboration (real-time co-editing of lesson plans)

---

## Recommended Teacher Journey (UX Order)

### Phase 1: Instant Answers (Quick Wins)
1. Ask instant answer → immediate result
2. Generate quiz from instant answer topic
3. Create visual aid for concept

### Phase 2: Lesson Planning (Depth)
4. Generate lesson plan (5E model)
5. Create worksheet from lesson materials
6. Generate rubric for student assignments

### Phase 3: Assessment & Iteration
7. Generate exam paper (board-aligned)
8. Get teacher training advice ("How do I improve engagement?")
9. Plan virtual field trip (geographical/historical topics)

### Phase 4: Parent Engagement (Scaling)
10. Send parent messages (absence, achievement, concern)
11. Discover videos (video-storyteller carousels)

### Phase 5: Profile & Personalization (One-Time)
12. Generate avatar
13. Enable voice input (voice-to-text for any flow)

---

## Cost Optimization Levers

From COST_ANALYSIS.md:

1. **Cache Grounding Results** (Instant Answer + Lesson Plan)
   - Multiple teachers ask same question → serve from cache
   - Potential savings: 40–60% on Google Search costs

2. **Limit Image Generation**
   - Visual Aid + Avatar = $0.04 each
   - Free tier: 5 images/month, then premium
   - Potential savings: 30% of total costs

3. **Compress Audio Before Submission**
   - Voice-to-text: $0.02/min
   - Client-side silence trimming before send
   - Potential savings: 20–40% on voice costs

4. **Switch to Vertex AI (Long-Term)**
   - 10–50% committed use discounts
   - Better cost tracking & allocation by feature

5. **Add Gemini Context Caching** (Lesson Plan)
   - Large context prompt (NCERT + schema + Indian context)
   - Cache pay-once, then $0.0000375/1K cached tokens per request
   - Potential savings: 30–40% on lesson plan costs

---

## Data Export & Persistence

All flows persist generated content to:
- **Cloud Storage**: `users/{userId}/{content-type}/{timestamp}-{id}.{ext}`
- **Firestore**: `users/{userId}/content/{documentId}`
  - Fields: id, type, title, gradeLevel, subject, topic, language, storagePath, isPublic, isDraft, createdAt, updatedAt, data (full output)

Example paths:
- `/users/user123/lesson-plans/20260421_083012_photosynthesis.json`
- `/users/user123/visual-aids/20260421_083015_plant_cell.png`
- `/users/user123/exam-papers/2026-04-21-08-30-15-abc123.json`

---

## Conclusion: Cost Estimate for Full Teacher Tour

**One teacher, all 15 AI flows used once, realistic monthly volume:**

- **AI API costs**: ~$0.17
- **Infrastructure (Firestore, Storage, Cloud Run)**: ~$0.03
- **Total**: **~$0.20 USD per teacher per month**

**At Scale** (1,000 active teachers):
- Monthly AI: ~$170
- Monthly infrastructure: ~$30
- **Monthly total: ~$200** (or **$0.20/teacher**)

**Key drivers**:
1. Google Search grounding (instant-answer) — 35% of AI cost
2. Image generation (visual-aid + avatar) — 30% of AI cost
3. Voice-to-text — 25% of AI cost
4. All other text LLM calls — 10% of AI cost

With caching and rate-limiting, this scales sub-linearly. At 10,000 teachers, cost-per-teacher drops to ~$0.05/month due to shared cache hits.

---

**Document prepared for teacher UX review.**
**Baseline: COST_ANALYSIS.md (March 2026) + complete flow audit (April 21, 2026).**

