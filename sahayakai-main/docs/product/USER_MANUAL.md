# SahayakAI: User Manual & Testing Guide
**Official Website:** [sahayakai.com](https://sahayakai.com)  
**Author:** Abhishek Gupta  
**Last updated:** 2026-06-10

---

## 📋 Instruction for the Research Analyst
Please execute the following test cases across the application. Your goal is to verify the AI's ability to handle **diverse subjects** across **multiple grade levels (Class 1-10)** and in **at least 2-3 languages per module (specifically including Kannada)**.

**Key Observation Points:**
*   **Response Accuracy:** Does the AI correctly interpret any specific terminology in Kannada?
*   **Cultural Fidelity:** Are the examples appropriately "Bharat-First"?
*   **Language Accuracy:** Is the grammar and terminology correct in Kannada, Hindi, or Bengali?
*   **System Speed:** Note any latency issues or failed generations.

---

## 🛠️ Feature 1: Lesson Plan Generator (`/lesson-plan`)

1.  **Science (Class 5):** "Explain the process of Photosynthesis for Class 5 students in a rural primary school."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಗ್ರಾಮೀಣ ಪ್ರಾಥಮಿಕ ಶಾಲೆಯ 5 ನೇ ತರಗತಿ ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಪ್ರಕ್ರಿಯೆಯನ್ನು ವಿವರಿಸಿ."

2.  **Mathematics (Class 3):** "Teach the concept of 'Money and Market' to Class 3 using only chalk and common household items."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಕೇವಲ ಚಾಕ್ ಮತ್ತು ಸಾಮಾನ್ಯ ಗೃಹೋಪಯೋಗಿ ವಸ್ತುಗಳನ್ನು ಬಳಸಿ 3 ನೇ ತರಗತಿಗೆ 'ಹಣ ಮತ್ತು ಮಾರುಕಟ್ಟೆ' ಪರಿಕಲ್ಪನೆಯನ್ನು ಬೋಧಿಸಿ."

3.  **Geography (Class 9):** "A 45-minute lesson on 'The Indian Monsoon' focusing on why it matters to farmers in Maharashtra."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಭಾರತೀಯ ಮಾನ್ಸೂನ್ ಕುರಿತು 45 ನಿಮಿಷಗಳ ಪಾಠ, ಇದು ಮಹಾರಾಷ್ಟ್ರದ ರೈತರಿಗೆ ಹೇಗೆ ಮುಖ್ಯವಾಗಿದೆ ಎಂಬುವುದರ ಮೇಲೆ ಕೇಂದ್ರೀಕರಿಸಿ."

4.  **Social Studies (Class 8):** "The story of India's Independence highlighting localized heroes from different regions."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ವಿವಿಧ ಪ್ರದೇಶಗಳ ಸ್ಥಳೀಯ ವೀರರನ್ನು ಎತ್ತಿ ತೋರಿಸುವ ಭಾರತದ ಸ್ವಾತಂತ್ರ್ಯದ ಕಥೆ."

5.  **Multi-Grade (Class 1-2):** "A combined lesson on 'Cleanliness and Hygiene' for a single classroom."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಒಂದೇ ತರಗತಿಯಲ್ಲಿ 'ಶುಚಿತ್ವ ಮತ್ತು ನೈರ್ಮಲ್ಯ' ಕುರಿತು ಸಂಯೋಜಿತ ಪಾಠ."

---

## 🛠️ Feature 2: Visual Aid Designer (`/visual-aid-designer`)

1.  **Biology (Class 10):** "Draw a detailed, labeled diagram of a Hibiscus flower (Gudhal) showing the stigma, petals, and ovary."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಶಲಾಕಾಗ್ರ, ದಳಗಳು ಮತ್ತು ಅಂಡಾಶಯವನ್ನು ತೋರಿಸುವ ದಾಸವಾಳ ಹೂವಿನ ವಿವರವಾದ, ಹೆಸರಿಸಲಾದ ರೇಖಾಚಿತ್ರವನ್ನು ಬಿಡಿಸಿ."

2.  **Physics (Class 8):** "Create a simple blackboard diagram showing how a hand-pump (Boring) works to pull water from the ground."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಭೂಮಿಯಿಂದ ನೀರನ್ನು ತೆಗೆಯಲು ಕೈ ಪಂಪ್ (ಬೋರಿಂಗ್) ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ ಎಂಬುದನ್ನು ತೋರಿಸುವ ಸರಳ ಕಪ್ಪುಹಲಗೆಯ ಚಿತ್ರವನ್ನು ರಚಿಸಿ."

3.  **Astronomy (Class 6):** "A sketch of the Solar System showing the relative positions of the Earth, Moon, and Sun during a Lunar Eclipse."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಚಂದ್ರಗ್ರಹಣದ ಸಮಯದಲ್ಲಿ ಭೂಮಿ, ಚಂದ್ರ ಮತ್ತು ಸೂರ್ಯನ ಸಾಪೇಕ್ಷ ಸ್ಥಾನಗಳನ್ನು ತೋರಿಸುವ ಸೌರವ್ಯೂಹದ ರೇಖಾಚಿತ್ರ."

4.  **Botany (Class 5):** "A blackboard drawing of a Mango tree seedling showing the roots, stem, and first two leaves."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಬೇರುಗಳು, ಕಾಂಡ ಮತ್ತು ಮೊದಲ ಎರಡು ಎಲೆಗಳನ್ನು ತೋರಿಸುವ ಮಾವಿನ ಮರದ ಸಸಿಯ ಕಪ್ಪುಹಲಗೆಯ ಚಿತ್ರ."

5.  **Chemistry (Class 9):** "A simple setup of a filtration process using a cloth, a pot, and muddy water."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಬಟ್ಟೆ, ಮಡಿಕೆ ಮತ್ತು ಕೆಸರು ನೀರನ್ನು ಬಳಸಿ ಶೋಧನೆ ಪ್ರಕ್ರಿಯೆಯ ಸರಳ ವಿನ್ಯಾಸ."

---

## 🛠️ Feature 3: Quiz Generator (`/quiz-generator`)

1.  **History (Class 7):** "5 Multiple Choice Questions on the 'Life of Mahatma Gandhi' in Hindi."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಮಹಾತ್ಮ ಗಾಂಧಿಯವರ ಜೀವನದ ಬಗ್ಗೆ ಕನ್ನಡದಲ್ಲಿ 5 ಬಹು ಆಯ್ಕೆಯ ಪ್ರಶ್ನೆಗಳು."

2.  **EVS (Class 4):** "A 10-question True/False quiz about 'Saving Water' with detailed explanations."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ನೀರು ಉಳಿಸುವ ಬಗ್ಗೆ ವಿವರವಾದ ವಿವರಣೆಗಳೊಂದಿಗೆ 10 ಪ್ರಶ್ನೆಗಳ ಹೌದು/ಅಲ್ಲ ರಸಪ್ರಶ್ನೆ."

3.  **Advanced Science (Class 10):** "3 'Hard' difficulty questions on 'Electric Circuits' focusing on HOTS."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ವಿದ್ಯುತ್ ಮಂಡಲಗಳ ಬಗ್ಗೆ 3 ಕಠಿಣ ಪ್ರಶ್ನೆಗಳು (HOTS ಮೇಲೆ ಕೇಂದ್ರೀಕರಿಸಿ)."

4.  **Language Arts (Class 6):** "A fill-in-the-blanks quiz based on a short story about an Indian festival like Pongal or Bihu."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಪೊಂಗಲ್ ಅಥವಾ ಬಿಹುವಿನಂತಹ ಭಾರತೀಯ ಹಬ್ಬದ ಕುರಿತಾದ ಸಣ್ಣ ಕಥೆಯ ಆಧಾರದ ಮೇಲೆ ಖಾಲಿ ಜಾಗ ತುಂಬುವ ರಸಪ್ರಶ್ನೆ."

5.  **Remedial (Class 3):** "A very simple 3-question visual quiz about 'Identifying Parts of a Plant'."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಸಸ್ಯದ ಭಾಗಗಳನ್ನು ಗುರುತಿಸುವ ಬಗ್ಗೆ ಅತಿ ಸರಳವಾದ 3 ಪ್ರಶ್ನೆಗಳ ಚಿತ್ರಾತ್ಮಕ ರಸಪ್ರಶ್ನೆ."

---

## 🛠️ Feature 4: Teacher Training / AI Coach (`/teacher-training`)

1.  **Classroom Management:** "How can I handle a student who is constantly talking while I am writing on the blackboard?"  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ನಾನು ಕಪ್ಪುಹಲಗೆಯ ಮೇಲೆ ಬರೆಯುವಾಗ ನಿರಂತರವಾಗಿ ಮಾತನಾಡುತ್ತಿರುವ ವಿದ್ಯಾರ್ಥಿಯನ್ನು ನಾನು ಹೇಗೆ ನಿಭಾಯಿಸಬಹುದು?"

2.  **Inclusion:** "How can I make my Science lesson more inclusive for a student with a mild hearing impairment?"  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಕಡಿಮೆ ಕೇಳುವ ದೋಷವಿರುವ ವಿದ್ಯಾರ್ಥಿಗಾಗಿ ನನ್ನ ವಿಜ್ಞಾನ ಪಾಠವನ್ನು ಹೆಚ್ಚು ಒಳಗೊಳ್ಳುವಂತೆ (inclusive) ಮಾಡುವುದು ಹೇಗೆ?"

3.  **Motivation:** "Give me 3 quick activities to re-energize students who look bored during a Math class."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಗಣಿತ ತರಗತಿಯಲ್ಲಿ ಬೇಸರಗೊಂಡಿರುವ ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಚೈತನ್ಯ ನೀಡಲು 3 ತ್ವರಿತ ಚಟುವಟಿಕೆಗಳನ್ನು ನೀಡಿ."

4.  **Sensitive Conversations:** "How do I explain a student's poor performance to a parent who is very defensive?"  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ತುಂಬಾ ರಕ್ಷಣಾತ್ಮಕವಾಗಿರುವ ಪೋಷಕರಿಗೆ ವಿದ್ಯಾರ್ಥಿಯ ಕಳಪೆ ಪ್ರದರ್ಶನವನ್ನು ನಾನು ಹೇಗೆ ವಿವರಿಸುವುದು?"

5.  **Ethics:** "What are the core ethics a teacher should follow while using AI in the classroom?"  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ತರಗತಿಯಲ್ಲಿ AI ಬಳಸುವಾಗ ಶಿಕ್ಷಕರು ಪಾಲಿಸಬೇಕಾದ ಪ್ರಮುಖ ನೀತಿಗಳು ಯಾವುವು?"

---

## 🛠️ Feature 5: Worksheet Wizard (`/worksheet-wizard`)

1.  **Comprehension:** "Create 5 fill-in-the-blank questions based on the uploaded textbook page about 'The Sun and Planets'."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಅಪ್-ಲೋಡ್ ಮಾಡಿದ 'ಸೂರ್ಯ ಮತ್ತು ಗ್ರಹಗಳು' ಎಂಬ ಪಠ್ಯಪುಸ್ತಕದ ಪುಟದ ಆಧಾರದ ಮೇಲೆ 5 ಖಾಲಿ ಜಾಗಗಳನ್ನು ತುಂಬುವ ಪ್ರಶ್ನೆಗಳನ್ನು ರಚಿಸಿ."

2.  **Creative Writing:** "Ask students to write 3 lines about their favorite character from the uploaded poem."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಅಪ್-ಲೋಡ್ ಮಾಡಿದ ಕವಿತೆಯಲ್ಲಿನ ಮೆಚ್ಚಿನ ಪಾತ್ರದ ಬಗ್ಗೆ 3 ಸಾಲುಗಳನ್ನು ಬರೆಯಲು ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ತಿಳಿಸಿ."

3.  **Math focus:** "Extract the 3 word problems from this page and create 2 more similar ones for extra practice."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಈ ಪುಟದಿಂದ 3 ಪದ ಸಮಸ್ಯೆಗಳನ್ನು (word problems) ಹೊರತೆಗೆಯಿರಿ ಮತ್ತು ಹೆಚ್ಚಿನ ಅಭ್ಯಾಸಕ್ಕಾಗಿ ಅಂತಹದ್ದೇ 2 ಸಮಸ್ಯೆಗಳನ್ನು ರಚಿಸಿ."

4.  **Vocab focus:** "List 5 difficult words from this page and ask students to find their meanings in their local language."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಈ ಪುಟದಿಂದ 5 ಕಠಿಣ ಪದಗಳನ್ನು ಪಟ್ಟಿ ಮಾಡಿ ಮತ್ತು ಅವುಗಳ ಅರ್ಥವನ್ನು ಸ್ಥಳೀಯ ಭಾಷೆಯಲ್ಲಿ ಹುಡುಕಲು ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ತಿಳಿಸಿ."

5.  **Activity-based:** "Suggest a group activity students can do in the playground based on the 'Seed Germination' chapter."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "'ಬೀಜ ಮೊಳಕೆಯೊಡೆಯುವಿಕೆ' ಪಾಠದ ಆಧಾರದ ಮೇಲೆ ಮೈದಾನದಲ್ಲಿ ಮಾಡಬಹುದಾದ ಒಂದು ಗುಂಪು ಚಟುವಟಿಕೆಯನ್ನು ಸೂಚಿಸಿ."

---

## 🛠️ Feature 6: Rubric Generator (`/rubric-generator`)

1.  **Art Project:** "Create a rubric for a Class 5 project where they have to make a model of a 'Village Market' using recycled materials."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಮರುಬಳಕೆ ಮಾಡಿದ ವಸ್ತುಗಳನ್ನು ಬಳಸಿ 'ಗ್ರಾಮದ ಮಾರುಕಟ್ಟೆ'ಯ ಮಾದರಿಯನ್ನು ತಯಾರಿಸಬೇಕಾದ 5 ನೇ ತರಗತಿಯ ಪ್ರಾಜೆಕ್ಟ್-ಗಾಗಿ ರಬ್ರಿಕ್ ಅನ್ನು ರಚಿಸಿ."

2.  **Oral Presentation:** "A rubric for grading a 2-minute speech on 'My Ambition' focusing on confidence, clarity, and content."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಆತ್ಮವಿಶ್ವಾಸ, ಸ್ಪಷ್ಟತೆ ಮತ್ತು ವಿಷಯದ ಮೇಲೆ ಕೇಂದ್ರೀಕರಿಸಿ 'ನನ್ನ ಮಹತ್ವಾಕಾಂಕ್ಷೆ' ಎಂಬ 2 ನಿಮಿಷಗಳ ಭಾಷಣವನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಲು ರಬ್ರಿಕ್."

3.  **Essay Writing:** "A simple rubric for a 100-word essay on 'Importance of Forests' for Class 6."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "6 ನೇ ತರಗತಿಗೆ 'ಅರಣ್ಯಗಳ ಮಹತ್ವ' ಕುರಿತ 100 ಪದಗಳ ಪ್ರಬಂಧಕ್ಕಾಗಿ ಸರಳ ರಬ್ರಿಕ್."

4.  **Group Work:** "Create a rubric to grade how students worked together during a 'Science Magic Show' group activity."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "'ವಿಜ್ಞಾನ ಮ್ಯಾಜಿಕ್ ಶೋ' ಗುಂಪು ಚಟುವಟಿಕೆಯಲ್ಲಿ ವಿದ್ಯಾರ್ಥಿಗಳು ಹೇಗೆ ಒಟ್ಟಾಗಿ ಕೆಲಸ ಮಾಡಿದರು ಎಂಬುದನ್ನು ಗ್ರೇಡ್ ಮಾಡಲು ರಬ್ರಿಕ್."

5.  **Hindi Handwriting:** "A basic rubric for a cursive writing assignment in Hindi for Class 2."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "2 ನೇ ತರಗತಿಯ ಹಿಂದಿ ಬರವಣಿಗೆಯ ಅಸೈನ್-ಮೆಂಟ್-ಗಾಗಿ ಸರಳ ರಬ್ರಿಕ್."

---

## 🛠️ Feature 7: Virtual Field Trip (`/virtual-field-trip`)

1.  **Heritage:** "Take my students on a tour of the 'Ajanta and Ellora Caves' to see the ancient rock-cut architecture."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಪ್ರಾಚೀನ ಕಲ್ಲಿನಲ್ಲಿ ಕೆತ್ತಲಾದ ವಾಸ್ತುಶಿಲ್ಪವನ್ನು ನೋಡಲು ನನ್ನ ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು 'ಅಜಂತಾ ಮತ್ತು ಎಲ್ಲೋರಾ ಗುಹೆಗಳ' ಪ್ರವಾಸಕ್ಕೆ ಕರೆದೊಯ್ಯಿರಿ."

2.  **Nature:** "A trip to the 'Sundarbans' to learn about the mangrove ecosystem and the Bengal Tiger."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಮ್ಯಾಂಗ್ರೋವ್ ಪರಿಸರ ವ್ಯವಸ್ಥೆ ಮತ್ತು ಬಂಗಾಳದ ಹುಲಿ ಬಗ್ಗೆ ತಿಳಿಯಲು 'ಸುಂದರಬನ' ಪ್ರವಾಸ."

3.  **Scientific Institutions:** "A virtual tour of ISRO's launch site (Satish Dhawan Space Centre) at Sriharikota."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಶ್ರೀಹರಿಕೋಟಾದಲ್ಲಿರುವ ಇಸ್ರೋ ಉಡಾವಣಾ ಕೇಂದ್ರದ (ಸತೀಶ್ ಧವನ್ ಬಾಹ್ಯಾಕಾಶ ಕೇಂದ್ರ) ವರ್ಚುವಲ್ ಪ್ರವಾಸ."

4.  **International History:** "A trip to the 'Egyptian Pyramids' to show how ancient civilizations lived."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಪ್ರಾಚೀನ ನಾಗರಿಕತೆಗಳು ಹೇಗೆ ವಾಸಿಸುತ್ತಿದ್ದವು ಎಂದು ತೋರಿಸಲು 'ಈಜಿಪ್ಟಿನ ಪಿರಮಿಡ್-ಗಳ' ಪ್ರವಾಸ."

5.  **Civics:** "A tour of the 'Sabarmati Ashram' to explain the life and simple living of Mahatma Gandhi."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಮಹಾತ್ಮ ಗಾಂಧಿಯವರ ಜೀವನ ಮತ್ತು ಸರಳ ಜೀವನವನ್ನು ವಿವರಿಸಲು 'ಸಬರಮತಿ ಆಶ್ರಮ' ಪ್ರವಾಸ."

---

## 🛠️ Feature 8: Instant Answer Bot (`/instant-answer`)

1.  **Current Affairs:** "What is the significance of the Republic Day parade in India for a 10-year-old?"  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "10 ವರ್ಷದ ಮಗುವಿಗೆ ಭಾರತದಲ್ಲಿ ಗಣರಾಜ್ಯೋತ್ಸವ ಪರೇಡ್-ನ ಮಹತ್ವವೇನು?"

2.  **Environmental Science:** "Why does the Taj Mahal look yellow, and how can we protect it?"  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ತಾಜ್ ಮಹಲ್ ಏಕೆ ಹಳದಿಯಾಗಿ ಕಾಣುತ್ತಿದೆ ಮತ್ತು ಅದನ್ನು ನಾವು ಹೇಗೆ ರಕ್ಷಿಸಬಹುದು?"

3.  **Creative Craft:** "Show me how to make a paper airplane that flies far."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ದೂರ ಹಾರುವ ಪೇಪರ್ ವಿಮಾನ ಮಾಡುವುದು ಹೇಗೆ ಎಂದು ತೋರಿಸಿ."

4.  **Local Botany:** "Explain the importance of the 'Banyan Tree' in Indian villages for Class 4."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "4 ನೇ ತರಗತಿಗೆ ಭಾರತೀಯ ಹಳ್ಳಿಗಳಲ್ಲಿ 'ಆಲದ ಮರದ' ಮಹತ್ವವನ್ನು ವಿವರಿಸಿ."

5.  **Physics Analogy:** "Why do we see rainbows after rain? Explain with a simple analogy."  
    *ಕನ್ನಡದಲ್ಲಿ ಪ್ರಶ್ನೆ:* "ಮಳೆಯ ನಂತರ ನಾವು ಕಾಮನಬಿಲ್ಲನ್ನು ಏಕೆ ನೋಡುತ್ತೇವೆ? ಸರಳ ಉದಾಹರಣೆಯೊಂದಿಗೆ ವಿವರಿಸಿ."

---

## 🛠️ Feature 9: Exam Paper Generator (`/exam-paper`)

Generates a full exam paper from a chosen board, grade, subject, and official NCERT chapters. The finished paper saves to My Library.

1.  **CBSE (Class 10 Science):** "Generate a full exam paper for the chapters on 'Light' and 'Electricity'."
2.  **State Board (Class 8 Math):** "A unit test with 1-mark, 3-mark, and 5-mark sections."
3.  **Social Science (Class 7):** "A half-yearly paper covering the first four chapters."
    *   *Note (test):* Choose a board/grade/subject with no chapters loaded and confirm the app asks you to add a chapter rather than failing.

## 🛠️ Feature 10: Video Storyteller (`/video-storyteller`)

Recommends teaching videos by category (Top Recommended, Storytelling, Pedagogy) and generates story or video scripts.

1.  **Storytelling:** "Write a short story script that teaches Class 4 the water cycle."
2.  **Recommendations:** "Do the recommended video categories reflect my profile's subjects and grades?"

## 🛠️ Feature 11: Assignment Assessor (`/assess-assignment`)

Teacher photographs or uploads a student assignment; the AI grades it and returns feedback.

1.  **Photo grade:** "Photograph a handwritten Math answer sheet and ask for a grade with feedback."
2.  **Upload grade:** "Upload an English essay image and request a score plus improvement notes."

## 🛠️ Feature 12: Assessment Scanner (`/assessment-scanner`)

Scans handwritten assessments and grades them. Distinct from the single Assignment Assessor.

1.  **Scan:** "Scan a set of handwritten answer sheets and confirm each is graded."
2.  *TODO(verify: exact scan-to-class linkage and where results display in the UI).*

## 🛠️ Feature 13: Attendance & Parent Outreach (`/attendance`)

Manage classes, mark daily attendance, record marks (`/attendance/[classId]/marks`), and send AI parent messages or calls in the parent's preferred language.

1.  **Create class:** "Add a class with students and parent phone numbers."
2.  **Mark attendance:** "Open the class, mark today's attendance, and submit."
3.  **Parent message:** "Draft an AI parent message for an absent student."
    *   *Note (test):* Parent calls go via Twilio by default; transcript and summary are saved after the call.

## 🛠️ Feature 14: Community, Library & Messages

1.  **Community Staff Room (`/community`):** "Open the Staff Room chat and send a text and a voice message."
2.  **Community Library (`/community-library`):** "Filter to 'Class 5 Mathematics' and save a colleague's worksheet."
3.  **My Library (`/my-library`):** "Confirm saved lesson plans, quizzes, and worksheets all appear."
4.  **Messages (`/messages`):** "Start a direct chat with a connected teacher and share a saved resource."
5.  **Impact Dashboard (`/impact-dashboard`):** "Check lesson plans created and students reached."

> *Kannada test prompts for Features 9-14 are pending native review:* `TODO(verify: Kannada copy needed)`.

> *Note: `/visual-aid-creator`, `/submit-content`, and `/review-panel` currently show "coming soon" placeholders. Use `/visual-aid-designer` for visual aids.*

---

## 📓 Observation Table (Research Analysts)

| Feature | Grade & Subject | Language | Observations | Fidelity (1-5) |
| :--- | :--- | :--- | :--- | :--- |
| Lesson Plan | Class 5 Science | Kannada | | |
| Visual Aid | Class 10 Bio | English | | |
| Worksheet | Class 4 EVS | Kannada | | |
| Rubric | Class 5 Art | Hindi | | |

---

> [!IMPORTANT]
> **Priority Check:** Ensure the **Kannada** outputs are reviewed for regional dialect accuracy. SahayakAI aims to provide precise vernacular support for teachers across Karnataka.
