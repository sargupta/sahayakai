# Application Testing Roadmap (Comprehensive Feature Test)

This document provides a structured list of questions (test cases) to verify every core page and AI feature of SahayakAI. Use this to ensure high-fidelity outputs and consistent user experience.

---

## 1. **Home / Landing Page** (`/`)
*Goal: Verify branding, core navigation, and initial load performance.*
1.  **Visual Branding:** Does the "Glassmorphism" theme look premium, and is the logo correctly displayed?
2.  **Hero CTA:** Does clicking the primary "Get Started" or "Start Teaching" button lead to the correct page?
3.  **Responsive Layout:** Does the home page look correct on a mobile device (phone) vs. a laptop?
4.  **Value Proposition:** Is the "Bharat-First" messaging clear and localized?
5.  **Language Toggle:** Does changing the language on the home page update the UI text correctly?

## 2. **Lesson Plan Generator** (`/lesson-plan`)
*Goal: Test text-based AI generation and pedagogical structure.*
1.  **Topic Input:** If I enter "The Water Cycle for Class 4," is the generated title relevant?
2.  **5E Structure:** Does the output contain all 5 phases (Engage, Explore, Explain, Elaborate, Evaluate)?
3.  **Cultural Context:** Are the examples Indian (e.g., using "Rupees," local names, or monsoons instead of generic snow)?
4.  **Teacher Tips:** Are there actionable tips provided for the teacher to handle student questions?
5.  **Export/Save:** Can the lesson plan be saved to "My Library" successfully?

## 3. **Visual Aid Creator** (`/visual-aid-designer`)
*Goal: Test AI image generation and high-fidelity blackboard sketches.*
1.  **Chalk Style:** Does the generated image look like a high-fidelity white chalk line drawing on a black background?
2.  **Label Accuracy:** Are the labels in the diagram (e.g., "Mouth," "Stomach" for digestion) legible and correctly spelled?
3.  **Pedagogical Context:** Does the AI explain *how* a teacher should use this specific drawing?
4.  **Discussion Spark:** Is the generated discussion question relevant to the image?
5.  **Storage:** Does the image save correctly to Cloud Storage and display in the history?

## 4. **Quiz Generator** (`/quiz-generator`)
*Goal: Test assessment logic and distractor quality.*
1.  **Question Count:** If I request 5 questions, does the AI generate exactly 5?
2.  **Distractors:** Are the incorrect options plausible (e.g., common student misconceptions about the topic)?
3.  **Explanation Depth:** Does every answer have a detailed explanation for the teacher?
4.  **Bloom's Level:** If I select "Higher Order Thinking," are the questions challenging enough?
5.  **Grade Appropriateness:** Is the vocabulary suitable for the selected grade level?

## 5. **Instant Answer Bot** (`/instant-answer`)
*Goal: Test quick fact retrieval and multimodal search.*
1.  **Fact Accuracy:** Does the bot provide a correct, concise answer to a factual question (e.g., "Who was Rabindranath Tagore?")?
2.  **YouTube Suggestion:** Does it provide a valid YouTube search link for visual learners?
3.  **Grade Tailoring:** Is the answer significantly simpler for "Class 1" vs. "Class 10"?
4.  **Source Reliability:** If it uses Google Search, are the facts up-to-date?
5.  **Voice-to-Text:** Does the microphone input accurately transcribe a spoken question?

## 6. **Avatar Creator** (`/my-profile`)
*Goal: Test identity representation and photorealistic AI images.*
1.  **Name Sensitivity:** Does the avatar reflect the gender/ethnicity typically associated with the teacher's name?
2.  **Professional Look:** Does the avatar look like a professional, friendly portrait educator?
3.  **Uniqueness:** If I generate twice for different names, are the results distinct?
4.  **Profile Update:** Does the profile picture update instantly in the header/sidebar after generation?
5.  **Persistence:** Does the new avatar persist across a page refresh or login?

## 7. **Community & Library** (`/my-library` & `/community`)
*Goal: Test storage, sharing, and content discovery.*
1.  **Library Sync:** Do items generated in other modules appear instantly in "My Library"?
2.  **Search/Filter:** Can I find an old lesson plan using a search query?
3.  **Community Sharing:** If I share an item, does it appear in the "Community Library" for others?
4.  **Download:** Can I download a PDF or JSON version of my content?
5.  **Delete:** Does deleting an item remove it from both the UI and the database?

---

> [!TIP]
> **Beta Testing Tip:** When testing AI features, pay close attention to **Wait Times**. If a generation takes more than 15 seconds, check if the "Loading State" (Spinner/Skeleton) is visible to the user.
