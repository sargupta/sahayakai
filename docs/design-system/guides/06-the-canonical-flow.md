# The product, screen by screen

SahayakAI is one continuous flow. A teacher starts the day on Home, makes what she needs (by voice, by typing or with a tool), delivers it, takes the register, reaches the parents who need a call, and shares with other teachers. Every screen below is a page card in this system, built only from its components. A new screen extends a row of this map. It never invents a parallel one.

## Start

| Screen | What happens | Built from |
| --- | --- | --- |
| Onboarding (`ScreenOnboarding`) | VIDYA introduces herself in the teacher's language. The teacher picks a language, classes and board, and learns the orb can be dragged | `PhoneScreen`, `Orb`, `LanguagePicker`, `Chip`, `BoardSwitch`, `Button` lg |
| Home (`ScreenHome`) | Voice-first on the teacher's real day: the day as the headline, what is waiting written as things to say, the orb as the hero (tap to ask, hold to keep talking), a type bar | `ScreenHeader`, raised `GlassCard` with `TaskRow`s, `Orb` 112, `Composer`, `TabBar` |

## Talk to VIDYA

| Screen | What happens | Built from |
| --- | --- | --- |
| Ask in place (`ScreenListening`) | A tap on the orb opens a sheet over the page: what VIDYA heard, what page she is reading, interpretations, typing. "Keep talking" opens Live | `VoiceSheet`, `SuggestionRow`, `Composer` |
| Live · listening (`ScreenLiveListening`) | One screen, hands-free. The teacher's words appear as she speaks | `LiveHeader`, `LiveOrb`, `LiveTranscript`, `LiveControls` |
| Live · checking a source (`ScreenLiveWorking`) | VIDYA shows her receipts: what she heard, the board's book and chapter she matched, what she is building | `LiveOrb state="working"`, `LiveReceipts` |
| Live · speaking (`ScreenLiveSpeaking`) | She reads the result back, with captions in the spoken language and the source stated first | `LiveOrb state="speaking"`, `LiveCaption` |
| Live · couldn't hear (`ScreenLiveFailed`) | The connection dropped. She keeps what she caught and the teacher finishes by typing | `LiveError`, `LiveTranscript` (caught), `Field`, `Chip`, `Switch` |
| Conversation (`ScreenConversation`) | The typed thread: requests, results with their source, refine chips | `ChatHeader`, `ChatThread`, `ChatBubble`, `AnswerCard`, `TypingIndicator`, `Composer variant="chat"` |
| Instant answer (`ScreenInstantAnswerAsk`, `ScreenInstantAnswer`) | A quick, honest answer to a classroom question. It says when it was not checked against the web | `Field`, `SuggestionRow`, `HonestyNote`, `MediaRow` |

The full rules are in "VIDYA Live".

## Make

| Screen | What happens | Built from |
| --- | --- | --- |
| Make (`ScreenMake`) | One place for every tool, clustered Prepare, Assess, Explore | `SpeakCard`, `Tile`, `DisclosureRow` |
| Lesson composer (`ScreenComposer`) | Topic, class, length and board. The curriculum it will follow is stated up front | `Field`, `Chip`, `NoticeCard`, `Button` |
| Quiz composer (`ScreenQuizComposer`) | Question types, count and Bloom's levels drive the questions | `Field`, `BoardSwitch`, `CheckCard`, `Slider`, `Chip` |
| Worksheet wizard (`ScreenWorksheetWizard`) | A photo of the textbook page is required. The generate button says why it is waiting | `UploadDrop`, `Field`, `SuggestionRow` |

## Outputs

Every output wears the same chrome: the title, its provenance (board, book, chapter), the artefact, the action bar, "Was this helpful?" and one primary action. Ready outputs turn the orb leaf, and the deliver tray sends them anywhere.

| Screen | What happens | Built from |
| --- | --- | --- |
| Lesson plan (`ScreenLessonPlan`) | Timed sections. VIDYA can read it back step by step | `ScreenHeader`, `Pill`, `Accordion`, `ReadbackBar`, `Button` |
| Quiz (`ScreenQuizOutput`) | Difficulty in one control. Lettered options and the answer key on a toggle | `SegmentedControl`, `ActionBar`, `QuizQuestion`, `FeedbackRow` |
| Rubric (`ScreenRubric`) | Criteria stacked on the phone. The table (`RubricTable`) is for tablets, the web and print | `RubricCriterion`, `ActionBar` |
| Exam paper (`ScreenExamPaper`) | The board's blueprint: sections, marks and internal choice | `ActionBar`, `QuizQuestion variant="exam"`, `Chip` |
| Visual aid (`ScreenVisualAid`) | A board-ready diagram, its style and the monthly quota | `ArtifactFrame`, `Chip`, `Pill` |
| Deliver (`DeliverTray`) | One tray for every output: parent group, print, class, Community, download, read aloud | `DeliverTray` |

## Class and calls

| Screen | What happens | Built from |
| --- | --- | --- |
| Roll call (`ScreenRollCall`) | Voice marks the register | `RosterRow`, `Pill`, `Button variant="success"` |
| Register (`ScreenRegister`) | The class at a glance. Triage says who needs a call today | `ClassTabs`, `TriageCard`, `SegmentedControl`, `RosterRow` |
| Parent outreach (`ScreenOutreach`) | One Contact per student, grouped by reason | `ContactRow` |
| Reason, step 1 of 3 (`ScreenReason`) | Absences, academic concern, behaviour or good news | `Sheet`, `ReasonOption` |
| Evidence, step 2 of 3 (`ScreenEvidence`) | The real marks VIDYA will cite, and an optional note | `EvidenceCard`, `Field`, `NoticeCard` |
| Review, step 3 of 3 (`ScreenMessageReview`) | The message in the parent's language, citing only what the teacher entered | `MessagePreview`, `Button` |
| Send to parents (`ScreenSendToParents`) | Text plus a voice note for parents who don't read. The channel is chosen and nothing leaves without a tap | `MessagePreview`, `VoiceNoteCard`, `ChannelOption` |
| In call (`ScreenInCall`) | VIDYA speaks to the parent as the school. The teacher can listen in or end the call | `CallStage`, `CallTranscript`, `Button variant="danger"` |
| After the call (`ScreenCallSummary`) | What the parent said, committed to and worries about; what the teacher does next | `SummaryCard` |
| Student (`ScreenStudent`) | Attendance, quiz scores and the concepts she is struggling with, and the next step | `StatTile`, `ConceptRow`, `NoticeCard` |

## Community

| Screen | What happens | Built from |
| --- | --- | --- |
| Community (`ScreenCommunity`) | Posts by type (Resource, Tried this, Celebrate, Need help) and the automated Daily Briefing. VIDYA can turn a post into a worksheet | `SearchField`, `Chip`, `PostCard`, `OrbHint` |
| Your network (`ScreenNetwork`) | Groups to join and teachers to connect with | `GroupRow`, `PersonRow` |
| Shared resources (`ScreenResources`) | A filterable library of what teachers have published | `SearchField`, `ResourceCard` |
| Messages (`ScreenMessages`) | Chat opens only after a connection is accepted | `MessageRow`, `EmptyState` |
| Staff room (`ScreenStaffRoom`) | Subject and state groups, asking colleagues, sharing what worked | `GroupTile`, `SearchField`, `PostCard` |

## Library and you

| Screen | What happens | Built from |
| --- | --- | --- |
| Library · Generations (`ScreenLibrary`) | Everything VIDYA has made, one row per output, each with its sync state | `SegmentedControl`, `Chip`, `LibraryRow` |
| Library · Conversations (`ScreenLibraryConversations`) | Every chat and Live talk, kept and searchable | `ConversationRow` |
| Waiting to sync (`ScreenOffline`) | What is queued, and what still works without signal | `NoticeCard`, `TaskRow`, `Chip` |
| Scanner (`ScreenScanner`) | Camera grading on the one dark surface | `PhoneScreen wash="camera"`, `CaptureStrip` |
| Scan results (`ScreenScanResults`) | The class's marks, the shared mistake, and the sheets that need the teacher's eye | `StatTile`, `MarksChart`, `NoticeCard`, `ReviewRow` |
| You (`ScreenProfile`) | Profile, plan and usage, the offline queue, settings | `Avatar`, `UsageMeter`, `SettingsRow`, `Switch` |

## The web app and the console

| Screen | What happens | Built from |
| --- | --- | --- |
| Web home (`ScreenWebHome`) | The greeting and VIDYA's workspace presence, typing, Make, and today's work | `SideRail`, `TopBar`, `VidyaPresence`, `Composer`, `TaskRow`, `LibraryCard` |
| Web tool (`ScreenWebTool`) | Compose on the left, the result on the right. VIDYA is docked bottom-right | `Field`, `GlassCard`, `VidyaPresence size="compact"` |
| Web library (`ScreenWebLibrary`) | Generations as a grid, Conversations as a list | `LibraryCard`, `SegmentedControl` |
| Console calls (`ScreenConsoleCalls`) | Every call the school made, labelled by source, numbers masked | `StatTile`, `OutcomeBar`, `DataTable`, `SourceLabel` |
| Console integrations (`ScreenConsoleIntegrations`) | API keys for the school's own systems, shown once | `ApiKeyRow`, `KeyReveal`, `Dialog` |

## Where things live

- **Tabs.** There are four. Home holds the day, the register and calls. Library holds every output and conversation. Community and Profile are their own tabs. Make opens from the Library tab, from the rows on Home and from VIDYA.
- **Sheets.** VIDYA's sheets (ask, working, deliver) and the outreach steps open over whichever tab the teacher is on. From 768px wide, sheets become Dialogs.
- **Profile settings.** Board, classes, languages and the orb's hand are set once in Profile and remembered.
