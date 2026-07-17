/// Path constants and the public (no-auth) route set.
class Routes {
  Routes._();

  static const String splash = '/splash';
  static const String login = '/login';
  static const String home = '/';

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

  /// Parent Message composer. Path mirrors the web's `/messages` composer
  /// (SCREEN_INVENTORY P1.5); the endpoint is `POST /api/ai/parent-message`.
  static const String parentMessage = '/messages';

  /// Routes reachable while signed out. `/try-call` (anon lead magnet) will
  /// join this set when that screen lands.
  static const Set<String> publicPaths = {splash, login};
}
