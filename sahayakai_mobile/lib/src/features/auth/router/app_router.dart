import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/auth_repository.dart';
import '../presentation/providers/auth_provider.dart';
import '../presentation/screens/auth_gate_screen.dart';
import '../presentation/screens/phone_login_screen.dart';
import '../presentation/screens/otp_verification_screen.dart';
import '../presentation/screens/onboarding_screen.dart';

// Feature screen imports
import '../../lesson_plan/presentation/screens/create_lesson_screen.dart';
import '../../quiz/presentation/screens/quiz_config_screen.dart';
import '../../worksheet/presentation/screens/worksheet_wizard_screen.dart';
import '../../rubric/presentation/screens/rubric_generator_screen.dart';
import '../../visual_aid/presentation/screens/visual_aid_creator_screen.dart';
import '../../instant_answer/presentation/screens/instant_answer_screen.dart';
import '../../video/presentation/screens/video_storyteller_screen.dart';
import '../../virtual_field_trip/presentation/screens/virtual_field_trip_screen.dart';
import '../../content_creator/presentation/screens/content_creator_screen.dart';
import '../../training/presentation/screens/teacher_training_screen.dart';
import '../../exam_paper/presentation/screens/exam_paper_config_screen.dart';
import '../../exam_paper/presentation/screens/exam_paper_result_screen.dart';
import '../../billing/presentation/screens/pricing_screen.dart';

/// GoRouter configuration with Firebase auth-based redirect.
///
/// Unauthenticated users are redirected to /login.
/// Authenticated users on /login are redirected to / (auth gate).
/// HomeScreen's internal IndexedStack tab navigation is left untouched.
final routerProvider = Provider<GoRouter>((ref) {
  final isLoggedIn = ref.watch(isLoggedInProvider);
  final authRepo = ref.read(authRepositoryProvider);

  return GoRouter(
    refreshListenable: GoRouterRefreshStream(authRepo.authStateChanges()),
    initialLocation: '/',
    redirect: (context, state) {
      final onAuthPage = state.matchedLocation == '/login' ||
          state.matchedLocation == '/otp';

      // Not logged in → force to login (unless already there).
      if (!isLoggedIn && !onAuthPage) return '/login';

      // Logged in but still on auth page → go to auth gate.
      if (isLoggedIn && onAuthPage) return '/';

      return null; // No redirect needed.
    },
    routes: [
      // Auth gate: checks profile existence → onboarding or home.
      GoRoute(path: '/', builder: (_, __) => const AuthGateScreen()),
      GoRoute(path: '/login', builder: (_, __) => const PhoneLoginScreen()),
      GoRoute(path: '/otp', builder: (_, __) => const OtpVerificationScreen()),
      GoRoute(
          path: '/onboarding', builder: (_, __) => const OnboardingScreen()),

      // Feature routes (migrated from main.dart named routes map).
      GoRoute(
          path: '/create-lesson',
          builder: (_, __) => const CreateLessonScreen()),
      GoRoute(
          path: '/quiz-config',
          builder: (_, __) => const QuizConfigScreen()),
      GoRoute(
          path: '/worksheet-wizard',
          builder: (_, __) => const WorksheetWizardScreen()),
      GoRoute(
          path: '/rubric-generator',
          builder: (_, __) => const RubricGeneratorScreen()),
      GoRoute(
          path: '/visual-aid-creator',
          builder: (_, __) => const VisualAidCreatorScreen()),
      GoRoute(
          path: '/instant-answer',
          builder: (_, __) => const InstantAnswerScreen()),
      GoRoute(
          path: '/video-storyteller',
          builder: (_, __) => const VideoStorytellerScreen()),
      GoRoute(
          path: '/virtual-field-trip',
          builder: (_, __) => const VirtualFieldTripScreen()),
      GoRoute(
          path: '/content-creator',
          builder: (_, __) => const ContentCreatorScreen()),
      GoRoute(
          path: '/teacher-training',
          builder: (_, __) => const TeacherTrainingScreen()),
      GoRoute(
          path: '/exam-paper',
          builder: (_, __) => const ExamPaperConfigScreen()),
      GoRoute(
          path: '/exam-paper/result',
          builder: (_, __) => const ExamPaperResultScreen()),
      GoRoute(
          path: '/pricing',
          builder: (_, __) => const PricingScreen()),
    ],
  );
});

/// Converts a Stream into a ChangeNotifier so GoRouter can listen to it.
class GoRouterRefreshStream extends ChangeNotifier {
  late final StreamSubscription<dynamic> _subscription;

  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
