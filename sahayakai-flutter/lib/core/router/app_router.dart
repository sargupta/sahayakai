import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../features/assess_assignment/presentation/assess_assignment_screen.dart';
import '../../features/dashboard/presentation/app_shell.dart';
import '../../features/exam_paper/presentation/exam_paper_screen.dart';
import '../../features/instant_answer/presentation/instant_answer_screen.dart';
import '../../features/lesson_planner/presentation/lesson_plan_screen.dart';
import '../../features/onboarding/presentation/login_screen.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/parent_message/presentation/parent_message_screen.dart';
import '../../features/quiz_generator/presentation/quiz_generator_screen.dart';
import '../../features/rubric_generator/presentation/rubric_generator_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../../features/splash/presentation/splash_screen.dart';
import '../../features/teacher_training/presentation/teacher_training_screen.dart';
import '../../features/worksheet_wizard/presentation/worksheet_wizard_screen.dart';
import '../auth/auth_providers.dart';
import 'routes.dart';

part 'app_router.g.dart';

/// The app's [GoRouter], rebuilt (its `redirect` re-evaluated) whenever the
/// stub auth state or the bootstrap future changes.
@Riverpod(keepAlive: true)
GoRouter appRouter(Ref ref) {
  final refresh = ValueNotifier<int>(0);
  ref
    ..listen(authControllerProvider, (_, _) => refresh.value++)
    ..listen(appBootstrapProvider, (_, _) => refresh.value++)
    ..onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: Routes.splash,
    refreshListenable: refresh,
    redirect: (context, state) {
      final booted = ref.read(appBootstrapProvider);
      final loc = state.matchedLocation;

      // No first auth snapshot yet -> hold on splash. This covers BOTH
      // `AsyncLoading` (still bootstrapping) and `AsyncError` (bootstrap
      // failed), and the error case is deliberate: with App Check / Firebase
      // init unresolved there is no honest answer to "is this teacher signed
      // in", so guessing one would either leak a protected screen or sign out
      // a signed-in teacher. The splash owns that error and offers a retry
      // (see `SplashScreen`) rather than spinning forever.
      if (booted.isLoading || !booted.hasValue) {
        return loc == Routes.splash ? null : Routes.splash;
      }

      final signedIn =
          ref.read(authControllerProvider) == AuthStatus.signedIn;
      final isPublic = Routes.publicPaths.contains(loc);

      // Signed out on a protected route -> login (preserve intended dest).
      if (!signedIn && !isPublic) {
        return '${Routes.login}?next=${Uri.encodeComponent(loc)}';
      }
      // Signed in but parked on login/splash -> home (honor ?next).
      if (signedIn && (loc == Routes.login || loc == Routes.splash)) {
        final next = state.uri.queryParameters['next'];
        return (next != null && next.isNotEmpty) ? next : Routes.home;
      }
      // Booted, signed out, still on splash -> login.
      if (!signedIn && loc == Routes.splash) {
        return Routes.login;
      }
      return null;
    },
    routes: [
      GoRoute(
        path: Routes.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: Routes.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: Routes.onboarding,
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: Routes.home,
        builder: (context, state) => const AppShell(),
      ),
      GoRoute(
        path: Routes.lessonPlan,
        builder: (context, state) => const LessonPlanScreen(),
      ),
      GoRoute(
        path: Routes.quizGenerator,
        builder: (context, state) => const QuizGeneratorScreen(),
      ),
      GoRoute(
        path: Routes.instantAnswer,
        builder: (context, state) => const InstantAnswerScreen(),
      ),
      GoRoute(
        path: Routes.worksheetWizard,
        builder: (context, state) => const WorksheetWizardScreen(),
      ),
      GoRoute(
        path: Routes.rubricGenerator,
        builder: (context, state) => const RubricGeneratorScreen(),
      ),
      GoRoute(
        path: Routes.examPaper,
        builder: (context, state) => const ExamPaperScreen(),
      ),
      GoRoute(
        path: Routes.teacherTraining,
        builder: (context, state) => const TeacherTrainingScreen(),
      ),
      GoRoute(
        path: Routes.parentMessage,
        builder: (context, state) => const ParentMessageScreen(),
      ),
      GoRoute(
        path: Routes.assessAssignment,
        builder: (context, state) => const AssessAssignmentScreen(),
      ),
      GoRoute(
        path: Routes.settings,
        builder: (context, state) => const SettingsScreen(),
      ),
    ],
    errorBuilder: (context, state) => const _RouteNotFound(),
  );
}

class _RouteNotFound extends StatelessWidget {
  const _RouteNotFound();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Text(
          'Page not found',
          style: Theme.of(context).textTheme.titleMedium,
        ),
      ),
    );
  }
}
