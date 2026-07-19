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

  /// Parent Message composer. Path mirrors the web's `/messages` composer
  /// (SCREEN_INVENTORY P1.5); the endpoint is `POST /api/ai/parent-message`.
  static const String parentMessage = '/messages';

  /// Parent Hotline (U-PH3). The staged flow that places an AI voice call to a
  /// student's parent in their language (SPEC_parent_hotline §B.0). Pushed on
  /// top of the signed-in shell; the standalone Dashboard entry opens on the
  /// student picker, the U12 attendance hand-off will pass a studentId.
  static const String parentHotline = '/parent-hotline';

  /// Routes reachable while signed out. `/try-call` (anon lead magnet) will
  /// join this set when that screen lands.
  static const Set<String> publicPaths = {splash, login};
}
