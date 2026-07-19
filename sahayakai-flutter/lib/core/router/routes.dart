/// Path constants and the public (no-auth) route set.
class Routes {
  Routes._();

  static const String splash = '/splash';
  static const String login = '/login';

  /// The app's landing after auth: the voice-first VIDYA home ("The Almanac
  /// Speaks") inside the signed-in shell. It replaced the form-first dashboard
  /// as the founder's #1 correction — the app must open on a nearly-empty mic.
  static const String home = '/';

  /// The Prep desk — the teaching-tools grid (the former dashboard). No longer
  /// the landing; reached from the VIDYA home's app-bar action and still in the
  /// Create palette. A deliberate destination, one tap from Home.
  static const String prepDesk = '/prep-desk';

  /// First-run setup. Auth-required, and deliberately NOT a gate.
  ///
  /// It is absent from [publicPaths] because the profile it collects is saved
  /// against `users/<uid>`, so it needs an identity. But nothing forces a
  /// teacher through it: the redirect guard never sends anyone here, every step
  /// offers "Skip for now", and the dashboard reaches it through a dismissible
  /// nudge. See `OnboardingScreen` for the incident this rule comes from.
  static const String onboarding = '/onboarding';

  // Reserved for later units (tabs currently live inside AppShell).
  static const String library = '/my-library';
  static const String profile = '/my-profile';

  /// One saved item, opened from a Library (or dashboard Recent) row. Pushed on
  /// top of the signed-in shell; the id is a path param so a future deep link
  /// resolves without the in-app `extra`. Reads `GET /api/content/get?id=<id>`.
  static const String libraryDetail = '/my-library/detail';

  /// The route pattern (`.../:id`) registered in the router.
  static const String libraryDetailPattern = '$libraryDetail/:id';

  /// The concrete path for [libraryDetail] with [id] filled in.
  static String libraryDetailPath(String id) => '$libraryDetail/$id';

  /// Settings. Auth-required per SCREEN_INVENTORY P0.7: it is pushed from the
  /// Profile (Me) tab's app-bar action. Its signed-out card is a defensive
  /// state (it renders on the sign-out frame, before the redirect lands, and if
  /// a token expires while the screen is open), not a public entry point.
  static const String settings = '/settings';

  // AI tools (pushed on top of the signed-in shell).
  static const String lessonPlan = '/lesson-plan';
  static const String quizGenerator = '/quiz-generator';
  static const String instantAnswer = '/instant-answer';
  static const String worksheetWizard = '/worksheet-wizard';
  static const String rubricGenerator = '/rubric-generator';
  static const String examPaper = '/exam-paper';
  static const String teacherTraining = '/teacher-training';

  /// Assess Assignment. Grades a student-work photo (SCREEN_INVENTORY P1.6);
  /// the endpoint is `POST /api/ai/assess-assignment`.
  static const String assessAssignment = '/assess-assignment';

  /// Assessment Scanner (U-PD5). Grades a student's answer sheet (up to 3 pages)
  /// question-by-question with subject-aware rubrics; the endpoint is
  /// `POST /api/ai/assessment-scanner`, which returns per-question marks +
  /// feedback, an overall `scorePct`, and recommended next steps. Distinct from
  /// [assessAssignment] (single-image, rubric scorecard) — this is the
  /// multi-page, per-question answer-sheet grader.
  static const String assessmentScanner = '/assessment-scanner';

  /// Visual Aid Designer (U-PD1). Generates a teaching illustration (an image)
  /// from a prompt (SCREEN_INVENTORY P1.7); the endpoint is
  /// `POST /api/ai/visual-aid`, which returns the drawing as a base64 data URI.
  static const String visualAid = '/visual-aid';

  /// Video Storyteller (U-PD3). Recommends curated educational YouTube videos
  /// for a teacher's lesson — a BROWSE result, not a generated document; the
  /// endpoint is `POST /api/ai/video-storyteller`, which returns
  /// `categorizedVideos` (category -> videos) plus a personalized message.
  static const String videoStoryteller = '/video-storyteller';

  /// Virtual Field Trip (U-PD4). Plans a curated itinerary of Google-Earth stops
  /// for a topic — a generated document, not a browse; the endpoint is
  /// `POST /api/ai/virtual-field-trip`, which returns `{ title, stops, gradeLevel,
  /// subject }` (and a benign 202 `still_generating` when the dispatcher's 45s
  /// budget elapses and the trip finishes saving to My Library server-side).
  static const String virtualFieldTrip = '/virtual-field-trip';

  /// Content Creator Studio (U-PD2). A NO-BACKEND hub that groups the three
  /// multimedia tools — Visual Aid Designer, Virtual Field Trip and Video
  /// Storyteller — as tappable cards and deep-links to each. It mirrors the web
  /// `content-creator/page.tsx`; it has no endpoint of its own.
  static const String contentCreator = '/content-creator';

  /// Parent Message composer. Path mirrors the web's `/messages` composer
  /// (SCREEN_INVENTORY P1.5); the endpoint is `POST /api/ai/parent-message`.
  static const String parentMessage = '/messages';

  /// Parent Hotline (U-PH3). The staged flow that places an AI voice call to a
  /// student's parent in their language (SPEC_parent_hotline §B.0). Pushed on
  /// top of the signed-in shell; the standalone Dashboard entry opens on the
  /// student picker, the U12 attendance hand-off will pass a studentId.
  static const String parentHotline = '/parent-hotline';

  /// Pro Inbox (Pillar 05 / U-SI1) — the conversation list. NOT `/messages`
  /// (that path is the Parent Message composer above). Pushed on top of the
  /// signed-in shell from the voice-home messages entry. The full Network tab
  /// (staffroom + inbox + notifications) IA is deferred to U-SI2.
  static const String inbox = '/inbox';

  /// One conversation thread (U-SI1), pushed from an inbox row (which hands the
  /// [Conversation] through `extra` so the app bar paints instantly) or a future
  /// `/messages?open={id}` deep link (which resolves from the `:id` alone).
  static const String conversationThread = '/inbox/thread';

  /// The route pattern (`.../:id`) registered in the router.
  static const String conversationThreadPattern = '$conversationThread/:id';

  /// The concrete thread path for [conversationId] (the Firestore doc id),
  /// percent-encoded so a deterministic `a_b` id or a server id is path-safe.
  static String conversationThreadPath(String conversationId) =>
      '$conversationThread/${Uri.encodeComponent(conversationId)}';

  /// The **Network** hub (Pillar 04 + 05 / U-SI2) — the surface that hosts the
  /// Staffroom feed and the Pro Inbox behind one `AppSegmented`. Reached from the
  /// voice-home app bar's network entry (next to the messages entry). The
  /// notifications surface (U-SI5) is the third Network tab and lands with it.
  static const String network = '/network';

  /// The Staffroom home (Pillar 04 / U-SI2) — the unified feed, groups, and
  /// recommendations. Reachable directly (deep link + group-detail back) and as
  /// the Staffroom tab inside the Network hub.
  static const String staffroom = '/staffroom';

  /// One group's detail (U-SI2): the group header (join/joined) + its posts.
  /// Pushed from a feed group chip / the "Your groups" strip.
  static const String groupDetail = '/staffroom/group';

  /// The route pattern (`.../:id`) registered in the router.
  static const String groupDetailPattern = '$groupDetail/:id';

  /// The concrete group-detail path for [groupId], percent-encoded so a server
  /// id is path-safe (and a future deep link resolves from the `:id` alone).
  static String groupDetailPath(String groupId) =>
      '$groupDetail/${Uri.encodeComponent(groupId)}';

  /// The global Staff Room chat (Pillar 04 / U-SI3) — the community-wide live
  /// chat room (`community_chat`). Pushed from the Staffroom home / Network hub
  /// Staff Room entry.
  static const String staffRoomChat = '/staffroom/chat';

  /// One group's chat (U-SI3) — `groups/{id}/chat`. Pushed from Group detail's
  /// "Group chat" entry (which hands the group name through `extra` so the app
  /// bar paints instantly).
  static const String groupChat = '/staffroom/group';

  /// The route pattern (`.../:id/chat`) registered in the router.
  static const String groupChatPattern = '$groupChat/:id/chat';

  /// The concrete group-chat path for [groupId], percent-encoded so a server id
  /// is path-safe (and a future deep link resolves from the `:id` alone).
  static String groupChatPath(String groupId) =>
      '$groupChat/${Uri.encodeComponent(groupId)}/chat';

  /// Routes reachable while signed out. `/try-call` (anon lead magnet) will
  /// join this set when that screen lands.
  static const Set<String> publicPaths = {splash, login};
}
