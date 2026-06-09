# User Testing Prompts (Complete Feature-by-Feature)

**Last updated:** 2026-06-10

Use these specific "Teacher Prompts" to test the AI output quality, cultural context, and accuracy across **every active module** of SahayakAI. The app now ships far more than the original eight tools, so this guide is grouped by area: AI teacher tools, assessment tools, classroom & attendance, content library & community, messaging, and account.

---

## 1. **Home / Discovery** (`/`)
*Testing: Navigation and UI consistency.*
1.  **Search:** "Can I find community-shared lesson plans for 'Soil Erosion'?"
2.  **Language:** "Can I switch the entire interface to Marathi and back to English?"
3.  **Recent Activity:** "Do my recently generated items show up on the dashboard?"
4.  **Navigation:** "Does the sidebar accurately lead me to the Worksheet Wizard?"
5.  **Branding:** "Does the glassmorphism effect look consistent across different screen sizes?"

## 2. **Lesson Plan Generator** (`/lesson-plan`)
*Testing: Pedagogy and Local Context.*
1.  **Science:** "Explain the process of Photosynthesis for Class 5 students in a rural primary school."
2.  **Mathematics:** "Teach the concept of 'Money and Market' to Class 3 using only chalk and common household items."
3.  **Geography:** "A 45-minute lesson on 'The Indian Monsoon' focusing on why it matters to farmers in Maharashtra."
4.  **Social Studies:** "The story of India's Independence for Class 8, highlighting localized heroes from different regions."
5.  **Multi-Grade:** "A combined lesson on 'Cleanliness and Hygiene' for Class 1 and Class 2 together in a single classroom."

## 3. **Visual Aid Designer** (`/visual-aid-designer`)
*Testing: Artistic style, labels, and pedagogical logic.*
1.  **Biology:** "Draw a detailed, labeled diagram of a Hibiscus flower (Gudhal) showing the stigma, petals, and ovary."
2.  **Physics:** "Create a simple blackboard diagram showing how a hand-pump (Boring) works to pull water from the ground."
3.  **Astronomy:** "A sketch of the Solar System showing the relative positions of the Earth, Moon, and Sun during a Lunar Eclipse."
4.  **Botany:** "A blackboard drawing of a Mango tree seedling showing the roots, stem, and first two leaves."
5.  **Chemistry:** "A simple setup of a filtration process using a cloth, a pot, and muddy water."

## 4. **Quiz Generator** (`/quiz-generator`)
*Testing: Cognitive depth, distractors, and teacher instructions.*
1.  **History:** "5 Multiple Choice Questions on the 'Life of Mahatma Gandhi' for Class 7 in Hindi."
2.  **Environmental Science (EVS):** "A 10-question True/False quiz about 'Saving Water' with detailed explanations for why each is true or false."
3.  **Advanced Science:** "3 'Hard' difficulty questions on 'Electric Circuits' focusing on Higher Order Thinking (HOTS)."
4.  **Language Arts:** "A fill-in-the-blanks quiz based on a short story about an Indian festival (e.g., Pongal or Bihu)."
5.  **Remedial:** "A very simple 3-question visual quiz about 'Identifying Parts of a Plant' for students struggling with the topic."

## 4b. **Exam Paper Generator** (`/exam-paper`)
*Testing: Board alignment, chapter coverage, mark distribution. Generates a full exam paper from a chosen board / grade / subject and selected NCERT chapters. Output saves to My Library.*
1.  **CBSE Class 10 Science:** "Generate a full-marks exam paper for the chapters on 'Light' and 'Electricity'."
2.  **State Board Class 8 Math:** "A unit test with sections for 1-mark, 3-mark, and 5-mark questions."
3.  **Class 7 Social Science:** "A half-yearly paper covering the first four chapters."
4.  **Chapter check:** "Pick a board/grade/subject that has no official chapters loaded. Confirm the app warns you to add a chapter instead of failing silently."
5.  **Long-run:** "Start a large paper, then open My Library after a minute to confirm the saved paper appears."

## 5. **Instant Answer Bot** (`/instant-answer`)
*Testing: Speed, fact accuracy, and video recommendations.*
1.  **Current Affairs:** "What is the significance of the Republic Day parade in India for a 10-year-old?"
2.  **Quick Fact:** "Why does the Taj Mahal look yellow, and how can we protect it? Give a simple answer."
3.  **Video Search:** "Show me how to make a paper airplane that flies far. (Testing for a YouTube search link)."
4.  **Local Knowledge:** "Explain the importance of the 'Banyan Tree' in Indian villages for Class 4."
5.  **Science Mystery:** "Why do we see rainbows after rain? Explain with a simple analogy of a shopkeeper and mirrors."

## 6. **Teacher Training / AI Coach** (`/teacher-training`)
*Testing: Classroom management and soft skills.*
1.  **Management:** "How can I handle a student who is constantly talking while I am writing on the blackboard?"
2.  **Inclusion:** "How can I make my Science lesson more inclusive for a student with a mild hearing impairment?"
3.  **Motivation:** "Give me 3 quick activities to re-energize students who look bored during a Math class on a hot afternoon."
4.  **Communication:** "How do I explain a student's poor performance to a parent who is very sensitive or defensive?"
5.  **Professionalism:** "What are the core ethics a teacher should follow while using AI in the classroom?"

## 7. **Worksheet Wizard** (`/worksheet-wizard`)
*Testing: Content extraction and student engagement.*
1.  **Comprehension:** "Create 5 fill-in-the-blank questions based on the uploaded textbook page about 'The Sun and Planets'."
2.  **Creative Writing:** "Ask students to write 3 lines about their favorite character from the uploaded poem."
3.  **Math focus:** "Extract the 3 word problems from this page and create 2 more similar ones for extra practice."
4.  **Vocab focus:** "List 5 difficult words from this page and ask students to find their meanings in their local language."
5.  **Activity-based:** "Suggest a group activity students can do in the playground based on the 'Seed Germination' chapter."

## 8. **Rubric Generator** (`/rubric-generator`)
*Testing: Fairness and clarity in grading.*
1.  **Art Project:** "Create a rubric for a Class 5 project where they have to make a model of a 'Village Market' using recycled materials."
2.  **Oral Presentation:** "A rubric for grading a 2-minute speech on 'My Ambition' focusing on confidence, clarity, and content."
3.  **Essay Writing:** "A simple rubric for a 100-word essay on 'Importance of Forests' for Class 6."
4.  **Group Work:** "Create a rubric to grade how students worked together during a 'Science Magic Show' group activity."
5.  **Handwriting:** "A basic rubric for a cursive writing assignment in Hindi for Class 2."

## 9. **Virtual Field Trip** (`/virtual-field-trip`)
*Testing: Itinerary flow and Google Earth integration.*
1.  **Heritage:** "Take my students on a tour of the 'Ajanta and Ellora Caves' to see the ancient rock-cut architecture."
2.  **Nature:** "A trip to the 'Sundarbans' to learn about the mangrove ecosystem and the Bengal Tiger."
3.  **Space (Meta):** "A virtual tour of ISRO's launch site (Satish Dhawan Space Centre) at Sriharikota."
4.  **International:** "A trip to the 'Egyptian Pyramids' to show how ancient civilizations lived."
5.  **Local Hero:** "A tour of the 'Sabarmati Ashram' to explain the life and simple living of Mahatma Gandhi."

## 10. **Video Storyteller** (`/video-storyteller`)
*Testing: Story script quality and curated video recommendations. The page surfaces recommended videos by category (Top Recommended, Storytelling, Pedagogy) and generates story or video scripts.*
1.  **Storytelling:** "Write a short story script that teaches Class 4 the water cycle."
2.  **Subject match:** "Do the recommended video categories reflect the subjects and grades on my profile?"
3.  **Pedagogy:** "Recommend videos on activity-based teaching methods for primary classrooms."
4.  **Language:** "Generate the story in Bengali and confirm the script reads naturally."
5.  **Save:** "Save a generated script and confirm it appears in My Library."

## 11. **Assignment Assessor** (`/assess-assignment`)
*Testing: Camera capture and AI grading of student work. Teacher photographs or uploads an assignment; the AI grades and gives feedback.*
1.  **Photo grade:** "Photograph a handwritten Math answer sheet and ask for a grade with feedback."
2.  **Upload grade:** "Upload an image of an English essay and request a score plus improvement notes."
3.  **Rubric link:** "Grade against a rubric you generated earlier and check the marks are consistent."
4.  **Language:** "Confirm feedback can be returned in Hindi or Bengali."
5.  **Edge case:** "Submit a blurry or partial image and confirm the app fails gracefully with a retry prompt."

## 12. **Assessment Scanner** (`/assessment-scanner`)
*Testing: Bulk scan-and-grade of handwritten assessments. Distinct from the single Assignment Assessor.*
1.  **Scan:** "Scan a set of handwritten answer sheets and confirm each is graded."
2.  **Retry:** "If a scan fails, confirm the error message points you back to My Library."
3.  **Marks export:** "Check graded marks can be reviewed after the scan completes."
4.  **TODO(verify: exact scan-to-class linkage and where results are stored in the UI).**

## 13. **Content Creator Hub** (`/content-creator`)
*Testing: This is a hub that links to Visual Aid Designer, Virtual Field Trip, and Video Storyteller.*
1.  **Navigation:** "From the hub, open the Visual Aid Designer and confirm it loads."
2.  **Navigation:** "From the hub, open the Virtual Field Trip and confirm it loads."
3.  **Navigation:** "From the hub, open the Video Storyteller and confirm it loads."

## 14. **Attendance & Parent Outreach** (`/attendance`)
*Testing: Class management, daily attendance, marks entry, and AI parent messages/calls.*
1.  **Create class:** "Add a new class with a few students and parent phone numbers."
2.  **Mark attendance:** "Open a class (`/attendance/[classId]`), mark today's attendance, and submit."
3.  **Marks entry:** "Record an assessment's marks for the class (`/attendance/[classId]/marks`)."
4.  **At-risk view:** "Confirm the class view flags students who are at-risk academically or absent several days in a row."
5.  **Parent message:** "Draft an AI parent message for an absent student in the parent's preferred language."
6.  **Parent call:** "Trigger a parent call and confirm a transcript and summary are recorded afterward. TODO(verify: live call UI states; telephony provider is Twilio by default, Exotel when enabled)."

## 15. **Impact Dashboard** (`/impact-dashboard`)
*Testing: Data visualization and reporting.*
1.  **Usage:** "How many lesson plans have I generated this month?"
2.  **Students reached:** "Does the dashboard show students reached and classroom time saved?"
3.  **Engagement:** "Does it show how many items I've shared with the community?"
4.  **Mobile:** "Are the charts easy to read on a mobile screen?"

## 16. **My Library** (`/my-library`)
*Testing: Personal saved content.*
1.  **Saved items:** "Do my saved lesson plans, quizzes, worksheets, and resources all appear here?"
2.  **Open:** "Open a saved item and confirm it reloads exactly as generated."
3.  **Create New:** "Does the 'Create New' shortcut take me to the right tool?"

## 17. **Community** (`/community`)
*Testing: Teacher network and Staff Room chat.*
1.  **Staff Room:** "Open the Staff Room chat and confirm messages send and receive."
2.  **Voice message:** "Send a voice message in chat and confirm it plays back."
3.  **Connect:** "Find another teacher and send a connection request."
4.  **Profile:** "Open another teacher's profile (`/profile/[uid]`) and view their shared work."

## 18. **Community Library** (`/community-library`)
*Testing: Global discovery and collaboration.*
1.  **Subject Filter:** "Filter to see only 'Class 5 Mathematics' resources."
2.  **Search:** "Search for lesson plans, quizzes, and more from the search bar."
3.  **Save:** "Save a colleague's worksheet to My Library."
4.  **Contributions:** "Does my shared content correctly display my name and profile?"

## 19. **Messages** (`/messages`)
*Testing: Direct and group messaging.*
1.  **Direct:** "Start a direct conversation with a connected teacher."
2.  **Voice:** "Send a voice message and confirm playback and duration display."
3.  **Resource:** "Share a saved resource in a conversation."
4.  **Unread:** "Confirm unread counts update correctly."

## 20. **Notifications** (`/notifications`)
*Testing: Activity alerts.*
1.  **Display:** "Confirm new connection requests and chat replies show as notifications."
2.  **Read state:** "Open a notification and confirm it marks as read."

## 21. **My Profile / Avatar Creator** (`/my-profile`)
*Testing: Identity representation and photorealism.*
1.  **Traditional:** Generate an avatar for: "Saraswati Devi, a veteran primary school teacher from a village in Bengal."
2.  **Young Professional:** Generate an avatar for: "Rajiv Sharma, a young Math teacher who loves technology."
3.  **Regional:** Generate an avatar for: "Meenakshi Iyer, an English teacher from Tamil Nadu."
4.  **Profile edit:** "Update your school, board, grades, and subjects and confirm they save."

## 22. **Onboarding, Settings, Usage & Pricing**
*Testing: Account setup and plan management.*
1.  **Onboarding (`/onboarding`):** "Complete onboarding as a new teacher and confirm profile fields persist."
2.  **Settings (`/settings`):** "Change your preferred language and confirm the interface follows."
3.  **Usage (`/usage`):** "Review your usage counters for AI generations."
4.  **Pricing (`/pricing`):** "View plans (free, pro, gold, premium) and confirm the page loads."

---

> [!TIP]
> Try mixing languages! Ask for a Lesson Plan in English but with some **"Hindi keywords"** to see how the AI adapts to a multilingual classroom.

> [!NOTE]
> **Not yet live (placeholder / coming-soon screens):** `/visual-aid-creator`, `/submit-content`, and `/review-panel` currently show "coming soon" copy. Use `/visual-aid-designer` for visual aids in the meantime.
