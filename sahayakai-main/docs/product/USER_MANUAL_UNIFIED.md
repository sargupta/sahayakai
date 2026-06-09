# SahayakAI: Unified Multilingual User Manual & Testing Guide
**Official Website:** [sahayakai.com](https://sahayakai.com)  
**Last updated:** 2026-06-10

---

## 🎯 Testing Objectives
**Goal:** Verify SahayakAI's ability to handle **multilingual queries** and **core UI functionality** across diverse subjects.

### Core Components to Test:
1.  **Microphone Input:** Verify accurate voice-to-text transcription in all three languages.
2.  **Action Bar:** Test **Copy**, **Save**, and **PDF Download** buttons.
3.  **Content Generators:** Verify the core pedagogical flows (Lesson Plan, Quiz, Exam Paper, Worksheet, Rubric, Instant Answer, Visual Aid, Field Trip, Video Storyteller).
4.  **Assessment & Classroom:** Verify Assignment Assessor, Assessment Scanner, and Attendance / parent outreach.
5.  **Community & Account:** Verify Community Staff Room chat, Community Library, My Library, Messages, and profile.

---

## 🛠️ Feature 0: UI & Hardware Functionality (Start Here)

Before testing specific subjects, verify the core tools work in your language.

### 0.1 Microphone / Voice Input 🎤
*   **English Test:** Click Mic -> Say "Hello, how are you?" -> Check if text appears exactly.
*   **Hindi Test:** Click Mic -> Say "Namaste, kaise hain aap?" (नमस्ते, कैसे हैं आप?) -> Check transcription.
*   **Bengali (WB) Test:** Click Mic -> Say "Nomoshkar, kemon achen?" (নমস্কার, কেমন আছেন?) -> Check transcription.
    *   *Note:* Ensure the browser permission for Microphone is "Allowed".

### 0.2 Action Bar Features 💾
After generating any content (like a Lesson Plan), test the buttons at the bottom of the card:

1.  **Copy to Clipboard (📋):**
    *   Click the "Copy" icon.
    *   Paste into a separate Notepad/Word doc.
    *   *Verify:* Does the pasted text match the generated content perfectly?

2.  **Save to History (💾):**
    *   Click the "Save" icon.
    *   Go to "My History" / "Saved Items" section.
    *   *Verify:* Is the generated lesson saved there with the correct date?

3.  **Download PDF (📥):**
    *   Click the "Download PDF" button.
    *   Open the downloaded file.
    *   *Verify:* is the formatting (bolding, lists) preserved in the PDF?
    *   *Verify:* Are correct fonts used for Hindi/Bengali (no question marks `????` or boxes `[][]`)?

---

## 🛠️ Feature 1: Lesson Plan Generator (`/lesson-plan`)

1.  **Science (Class 5): Photosynthesis**
    *   🇺🇸 **English:** "Explain the process of Photosynthesis for Class 5 students in a rural primary school."
    *   🇮🇳 **Hindi:** "ग्रामीण प्राथमिक विद्यालय के कक्षा 5 के छात्रों के लिए प्रकाश संश्लेषण (Photosynthesis) की प्रक्रिया को समझाएं।"
    *   🇮🇳 **Bengali (WB):** "গ্রামের প্রাথমিক স্কুলের পঞ্চম শ্রেণীর পড়ুয়াদের জন্য সালোকসংশ্লেষণ (Photosynthesis) প্রক্রিয়াটি বুঝিয়ে বলুন।"

2.  **Mathematics (Class 3): Money & Market**
    *   🇺🇸 **English:** "Teach the concept of 'Money and Market' to Class 3 using only chalk and common household items."
    *   🇮🇳 **Hindi:** "केवल चॉक और सामान्य घरेलू वस्तुओं का उपयोग करके कक्षा 3 को 'पैसा और बाजार' (Money and Market) की अवधारणा सिखाएं।"
    *   🇮🇳 **Bengali (WB):** "শুধুমাত্র চক আর সাধারণ গৃহস্থালি জিনিস ব্যবহার করে তৃতীয় শ্রেণীর ছাত্রছাত্রীদের 'টাকা আর বাজার'-এর ধারণাটি শেখান।"

3.  **Geography (Class 9): Indian Monsoon**
    *   🇺🇸 **English:** "A 45-minute lesson on 'The Indian Monsoon' focusing on why it matters to farmers in Maharashtra."
    *   🇮🇳 **Hindi:** "महर्षि के किसानों के लिए 'भारतीय मानसून' क्यों महत्वपूर्ण है, इस पर केंद्रित 45 मिनट का पाठ तैयार करें।"
    *   🇮🇳 **Bengali (WB):** "মহারাষ্ট্রের কৃষকদের কাছে 'ভারতীয় মৌসুমি বায়ু' বা মনসুন কেন এত জরুরি, তার ওপর জোর দিয়ে ৪৫ মিনিটের একটি পাঠ তৈরি করুন।"

4.  **Social Studies (Class 8): Independence Heroes**
    *   🇺🇸 **English:** "The story of India's Independence highlighting localized heroes from different regions."
    *   🇮🇳 **Hindi:** "विभिन्न क्षेत्रों के स्थानीय नायकों को उजागर करते हुए भारत की स्वतंत्रता की कहानी।"
    *   🇮🇳 **Bengali (WB):** "বিভিন্ন অঞ্চলের স্থানীয় বিপ্লবীদের কথা তুলে ধরে ভারতের স্বাধীনতা সংগ্রামের কাহিনী।"

5.  **Multi-Grade (Class 1-2): Hygiene**
    *   🇺🇸 **English:** "A combined lesson on 'Cleanliness and Hygiene' for a single classroom."
    *   🇮🇳 **Hindi:** "एक ही कक्षा के लिए 'सफाई और स्वच्छता' पर एक संयुक्त पाठ।"
    *   🇮🇳 **Bengali (WB):** "একই শ্রেণীকক্ষের জন্য 'পরিচ্ছন্নতা ও স্বাস্থ্যবিধি' নিয়ে একটি যৌথ বা কম্বাইন্ড পাঠ (Combined Lesson)।"

---

## 🛠️ Feature 2: Visual Aid Designer (`/visual-aid-designer`)

1.  **Biology (Class 10): Hibiscus Flower**
    *   🇺🇸 **English:** "Draw a detailed, labeled diagram of a Hibiscus flower (Gudhal) showing the stigma, petals, and ovary."
    *   🇮🇳 **Hindi:** "गुड़हल (Hibiscus) के फूल का एक विस्तृत, नामांकित चित्र बनाएं जिसमें वर्तिकाग्र (stigma), पंखुड़ियाँ (petals) और अंडाशय (ovary) दिखाई दें।"
    *   🇮🇳 **Bengali (WB):** "গর্ভমুণ্ড (Stigma), পাপড়ি আর ডিম্বাশয় (Ovary) দেখিয়ে একটি জবা ফুলের বিস্তারিত চিহ্নিত চিত্র আঁকুন।"

2.  **Physics (Class 8): Hand-Pump**
    *   🇺🇸 **English:** "Create a simple blackboard diagram showing how a hand-pump (Boring) works to pull water from the ground."
    *   🇮🇳 **Hindi:** "जमीन से पानी खींचने के लिए हैंड-पंप (बोरिंग) कैसे काम करता है, यह दिखाने वाला एक सरल ब्लैकबोर्ड चित्र बनाएं।"
    *   🇮🇳 **Bengali (WB):** "মাটির নিচ থেকে জল তুলতে হ্যান্ডপাম্প বা টিউবওয়েল কীভাবে কাজ করে, তা বোঝানোর জন্য একটি সরল ব্ল্যাকবোর্ড ডায়াগ্রাম তৈরি করুন।"

3.  **Astronomy (Class 6): Solar System**
    *   🇺🇸 **English:** "A sketch of the Solar System showing the relative positions of the Earth, Moon, and Sun during a Lunar Eclipse."
    *   🇮🇳 **Hindi:** "चंद्र ग्रहण के दौरान पृथ्वी, चंद्रमा और सूर्य की सापेक्ष स्थिति को दिखाते हुए सौर मंडल का एक स्केच।"
    *   🇮🇳 **Bengali (WB):** "চন্দ্রগ্রহণের সময় পৃথিবী, চাঁদ আর সূর্যের অবস্থান দেখিয়ে সৌরজগতের একটি স্কেচ বা রেখাচিত্র।"

---

## 🛠️ Feature 3: Quiz Generator (`/quiz-generator`)

1.  **History (Class 7): Mahatma Gandhi**
    *   🇺🇸 **English:** "5 Multiple Choice Questions on the 'Life of Mahatma Gandhi'."
    *   🇮🇳 **Hindi:** "'महात्मा गांधी के जीवन' पर 5 बहुविकल्पीय प्रश्न।"
    *   🇮🇳 **Bengali (WB):** "'মহাত্মা গান্ধীর জীবন' নিয়ে ৫টি মাল্টিপল চয়েস প্রশ্ন (MCQ)।"

2.  **EVS (Class 4): Saving Water**
    *   🇺🇸 **English:** "A 10-question True/False quiz about 'Saving Water' with detailed explanations."
    *   🇮🇳 **Hindi:** "विस्तृत स्पष्टीकरण के साथ 'जल संरक्षण' (Saving Water) के बारे में 10-प्रश्न वाला सही/गलत प्रश्नोत्तरी।"
    *   🇮🇳 **Bengali (WB):** "'জল সংরক্ষণ'-এর ওপর বিস্তারিত ব্যাখ্যাসহ ১০টি ঠিক/ভুল প্রশ্ন।"

---

## 🛠️ Feature 3b: Exam Paper Generator (`/exam-paper`)

Generates a full exam paper from a chosen board, grade, subject, and official NCERT chapters. Saves to My Library.

1.  **CBSE Class 10 Science: Light & Electricity**
    *   🇺🇸 **English:** "Generate a full exam paper for the chapters on 'Light' and 'Electricity'."
    *   🇮🇳 **Hindi:** "'प्रकाश' और 'विद्युत' अध्यायों के लिए एक पूर्ण परीक्षा पत्र तैयार करें।"
    *   🇮🇳 **Bengali (WB):** `TODO(verify: Bengali copy needed)`

2.  **State Board Class 8 Math: Unit Test**
    *   🇺🇸 **English:** "A unit test with 1-mark, 3-mark, and 5-mark sections."
    *   🇮🇳 **Hindi:** "1-अंक, 3-अंक और 5-अंक वाले खंडों के साथ एक इकाई परीक्षा।"
    *   🇮🇳 **Bengali (WB):** `TODO(verify: Bengali copy needed)`

## 🛠️ Feature 4: Teacher Training / AI Coach (`/teacher-training`)

1.  **Classroom Management**
    *   🇺🇸 **English:** "How can I handle a student who is constantly talking while I am writing on the blackboard?"
    *   🇮🇳 **Hindi:** "मैं उस छात्र को कैसे संभालूँ जो मेरे ब्लैकबोर्ड पर लिखते समय लगातार बात कर रहा है?"
    *   🇮🇳 **Bengali (WB):** "আমি যখন ব্ল্যাকবোর্ডে লিখছি তখন যে ছাত্রটি অনবরত কথা বলছে, তাকে আমি কীভাবে সামলাব?"

2.  **Inclusion (Hearing Impairment)**
    *   🇺🇸 **English:** "How can I make my Science lesson more inclusive for a student with a mild hearing impairment?"
    *   🇮🇳 **Hindi:** "हल्की श्रवण बाधित छात्र के लिए मैं अपने विज्ञान के पाठ को और अधिक समावेशी (inclusive) कैसे बना सकता हूँ?"
    *   🇮🇳 **Bengali (WB):** "শ্রবণশক্তি কিছুটা কম এমন একজন ছাত্রের জন্য আমি আমার বিজ্ঞানের ক্লাসকে আরও অন্তর্ভুক্তিমূলক (Inclusive) করব কীভাবে?"

---

## 🛠️ Feature 5: Worksheet Wizard (`/worksheet-wizard`)

1.  **Comprehension: Sun & Planets**
    *   🇺🇸 **English:** "Create 5 fill-in-the-blank questions based on the uploaded textbook page about 'The Sun and Planets'."
    *   🇮🇳 **Hindi:** "'सूर्य और ग्रह' के बारे में पाठ्यपुस्तक के पृष्ठ के आधार पर 5 रिक्त स्थान भरने वाले प्रश्न बनाएं।"
    *   🇮🇳 **Bengali (WB):** "'সূর্য ও তার গ্রহ' বিষয়ক টেক্সটবুক পৃষ্ঠা থেকে ৫টি শূন্যস্থান পূরণ (Fill in the blanks) প্রশ্ন তৈরি করুন।"

2.  **Math Word Problems**
    *   🇺🇸 **English:** "Extract the 3 word problems from this page and create 2 more similar ones for extra practice."
    *   🇮🇳 **Hindi:** "इस पृष्ठ से 3 शब्द समस्याओं (word problems) को निकालें और अतिरिक्त अभ्यास के लिए 2 और समान समस्याएं बनाएं।"
    *   🇮🇳 **Bengali (WB):** "এই পৃষ্ঠা থেকে ৩টি গাণিতিক সমস্যা (Word Problems) বের করুন এবং অনুশীলনের জন্য আরও ২টি একই ধরণের সমস্যা বানিয়ে দিন।"

---

## 🛠️ Feature 6: Rubric Generator (`/rubric-generator`)

1.  **Art Project: Village Market**
    *   🇺🇸 **English:** "Create a rubric for a Class 5 project where they have to make a model of a 'Village Market' using recycled materials."
    *   🇮🇳 **Hindi:** "कक्षा 5 की परियोजना के लिए एक रूब्रिक बनाएं जहाँ उन्हें पुनर्नवीनीकरण सामग्री (recycled materials) का उपयोग करके 'गाँव के बाज़ार' का मॉडल बनाना है।"
    *   🇮🇳 **Bengali (WB):** "ফেলে দেওয়া জিনিস বা রিসাইকেলড মেটিরিয়াল দিয়ে 'গ্রামের হাট'-এর মডেল বানানোর ক্লাস ফাইভের প্রজেক্টের জন্য একটি রুব্রিক (Rubric) তৈরি করুন।"

2.  **Essay Writing: Forests**
    *   🇺🇸 **English:** "A simple rubric for a 100-word essay on 'Importance of Forests' for Class 6."
    *   🇮🇳 **Hindi:** "कक्षा 6 के लिए 'वनों का महत्व' पर 100-शब्दों के निबंध के लिए एक सरल रूब्रिक।"
    *   🇮🇳 **Bengali (WB):** "ষষ্ঠ শ্রেণীর জন্য 'বনজঙ্গলের গুরুত্ব' নিয়ে ১০০ শব্দের প্রবন্ধের একটি সহজ রুব্রিক।"

---

## 🛠️ Feature 7: Virtual Field Trip (`/virtual-field-trip`)

1.  **Heritage: Ajanta Caves**
    *   🇺🇸 **English:** "Take my students on a tour of the 'Ajanta and Ellora Caves' to see the ancient rock-cut architecture."
    *   🇮🇳 **Hindi:** "प्राचीन रॉक-कट वास्तुकला को देखने के लिए मेरे छात्रों को 'अजंता और एलोरा की गुफाओं' की सैर पर ले जाएं।"
    *   🇮🇳 **Bengali (WB):** "প্রাচীন প্রস্তরশিল্প বা রক-কাট আর্কিটেকচার দেখাতে আমার ছাত্রছাত্রীদের 'অজন্তা ও ইলোরা গুহা' সফরে নিয়ে চলুন।"

2.  **Nature: Sundarbans**
    *   🇺🇸 **English:** "A trip to the 'Sundarbans' to learn about the mangrove ecosystem and the Bengal Tiger."
    *   🇮🇳 **Hindi:** "मैंग्रोव पारिस्थितिकी तंत्र (ecosystem) और बंगाल टाइगर के बारे में जानने के लिए 'सुंदरवन' की यात्रा।"
    *   🇮🇳 **Bengali (WB):** "ম্যানগ্রোভ ইকোসিস্টেম আর রয়্যাল বেঙ্গল টাইগার সম্পর্কে জানতে 'সুন্দরবন'-এ একটি ভার্চুয়াল ট্যুর।"

---

## 🛠️ Feature 8: Instant Answer (`/instant-answer`)

1.  **Current Affairs: Republic Day**
    *   🇺🇸 **English:** "What is the significance of the Republic Day parade in India for a 10-year-old?"
    *   🇮🇳 **Hindi:** "एक 10 साल के बच्चे के लिए भारत में गणतंत्र दिवस परेड का क्या महत्व है?"
    *   🇮🇳 **Bengali (WB):** "১০ বছরের বাচ্চার কাছে ভারতের প্রজাতন্ত্র দিবসের কুচকাওয়াজ বা প্যারেড-এর গুরুত্ব কী?"

2.  **Science: Rainbows**
    *   🇺🇸 **English:** "Why do we see rainbows after rain? Explain with a simple analogy."
    *   🇮🇳 **Hindi:** "बारिश के बाद हमें इंद्रधनुष क्यों दिखाई देता है? एक सरल सादृश्य (analogy) के साथ समझाएं।"
    *   🇮🇳 **Bengali (WB):** "বৃষ্টির পরে আমরা রামধনু (Rainbow) দেখি কেন? সহজ উদাহরণ দিয়ে বুঝিয়ে বলুন।"

---

## 🛠️ Feature 9: Video Storyteller (`/video-storyteller`)

Recommends teaching videos by category and generates story or video scripts.

1.  **Water Cycle Story**
    *   🇺🇸 **English:** "Write a short story script that teaches Class 4 the water cycle."
    *   🇮🇳 **Hindi:** "कक्षा 4 को जल चक्र सिखाने वाली एक छोटी कहानी की पटकथा लिखें।"
    *   🇮🇳 **Bengali (WB):** `TODO(verify: Bengali copy needed)`

## 🛠️ Feature 10: Assignment Assessor (`/assess-assignment`)

Photograph or upload a student assignment; the AI grades it and returns feedback.

1.  **Grade a handwritten answer sheet**
    *   🇺🇸 **English:** "Photograph a handwritten Math answer sheet and ask for a grade with feedback."
    *   🇮🇳 **Hindi:** "हाथ से लिखी गणित की उत्तर पुस्तिका की फोटो लें और प्रतिक्रिया के साथ ग्रेड मांगें।"
    *   🇮🇳 **Bengali (WB):** `TODO(verify: Bengali copy needed)`

## 🛠️ Feature 11: Assessment Scanner (`/assessment-scanner`)

Scans handwritten assessments and grades them. Distinct from the Assignment Assessor.

1.  **Scan a set of sheets**
    *   🇺🇸 **English:** "Scan a set of handwritten answer sheets and confirm each is graded."
    *   🇮🇳 **Hindi:** "हाथ से लिखी उत्तर पुस्तिकाओं का एक सेट स्कैन करें और जांचें कि प्रत्येक को ग्रेड किया गया है।"
    *   🇮🇳 **Bengali (WB):** `TODO(verify: Bengali copy needed)`
    *   *TODO(verify: exact scan-to-class linkage and where results display in the UI).*

## 🛠️ Feature 12: Attendance & Parent Outreach (`/attendance`)

Manage classes, mark daily attendance, record marks (`/attendance/[classId]/marks`), and send AI parent messages or calls in the parent's preferred language. Parent calls go via Twilio by default; transcript and summary are saved after the call.

1.  **Draft a parent message for an absentee**
    *   🇺🇸 **English:** "Draft an AI parent message for a student absent three days in a row."
    *   🇮🇳 **Hindi:** "लगातार तीन दिन अनुपस्थित छात्र के लिए एक अभिभावक संदेश तैयार करें।"
    *   🇮🇳 **Bengali (WB):** `TODO(verify: Bengali copy needed)`

## 🛠️ Feature 13: Community, Library & Messages

*   **Community Staff Room (`/community`):** open the Staff Room chat; send a text and a voice message.
*   **Community Library (`/community-library`):** filter resources, search, and save to My Library.
*   **My Library (`/my-library`):** confirm saved lesson plans, quizzes, and worksheets appear.
*   **Messages (`/messages`):** start a direct chat and share a saved resource.
*   **Impact Dashboard (`/impact-dashboard`):** check lesson plans created and students reached.

> *Note: `/visual-aid-creator`, `/submit-content`, and `/review-panel` currently show "coming soon" placeholders. Use `/visual-aid-designer` for visual aids.*

---

## 📓 Observation Log

| Functional Test | Status (Pass/Fail) | Notes |
| :--- | :--- | :--- |
| English Mic Input | | |
| Hindi Mic Input | | |
| Bengali Mic Input | | |
| Copy Text | | |
| Save to History | | |
| PDF Content Check | | |
