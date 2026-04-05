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

// Feature screen imports (migrated from main.dart named routes)
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
import '../../vidya/presentation/screens/vidya_chat_screen.dart';
import '../../attendance/presentation/screens/parent_message_screen.dart';
import '../../attendance/presentation/screens/attendance_screen.dart';
import '../../user/presentation/screens/edit_profile_screen.dart';
import '../../usage/presentation/screens/usage_screen.dart';
import '../../organizations/presentation/screens/organization_screen.dart';
import '../../performance/presentation/screens/marks_entry_screen.dart';
import '../../user/presentation/screens/consent_screen.dart';
import '../../home/presentation/screens/settings_screen.dart';
import '../../feedback/presentation/screens/feedback_screen.dart';
import '../../community/presentation/screens/compose_post_screen.dart';
import '../../community/presentation/screens/groups_screen.dart';
import '../../community/presentation/screens/community_library_screen.dart';
import '../../community/presentation/screens/connections_screen.dart';
import '../../community/presentation/screens/staff_room_screen.dart';
import '../../messages/presentation/screens/messages_screen.dart';
import '../../messages/presentation/screens/conversation_screen.dart';
import '../../notifications/presentation/screens/notifications_screen.dart';
import '../../attendance/presentation/screens/class_list_screen.dart';
import '../../attendance/presentation/screens/class_detail_screen.dart';
import '../../avatar/presentation/screens/avatar_generator_screen.dart';
import '../../news/presentation/screens/news_feed_screen.dart';

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

      // Feature routes — accept optional extra params for cross-feature pre-fill.
      GoRoute(
          path: '/create-lesson',
          builder: (_, state) => CreateLessonScreen(
              initialParams: state.extra as Map<String, dynamic>?)),
      GoRoute(
          path: '/quiz-config',
          builder: (_, state) => QuizConfigScreen(
              initialParams: state.extra as Map<String, dynamic>?)),
      GoRoute(
          path: '/worksheet-wizard',
          builder: (_, state) => WorksheetWizardScreen(
              initialParams: state.extra as Map<String, dynamic>?)),
      GoRoute(
          path: '/rubric-generator',
          builder: (_, state) => RubricGeneratorScreen(
              initialParams: state.extra as Map<String, dynamic>?)),
      GoRoute(
          path: '/visual-aid-creator',
          builder: (_, state) => VisualAidCreatorScreen(
              initialParams: state.extra as Map<String, dynamic>?)),
      GoRoute(
          path: '/instant-answer',
          builder: (_, state) => InstantAnswerScreen(
              initialParams: state.extra as Map<String, dynamic>?)),
      GoRoute(
          path: '/video-storyteller',
          builder: (_, state) => VideoStorytellerScreen(
              initialParams: state.extra as Map<String, dynamic>?)),
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

      // VIDYA assistant
      GoRoute(
          path: '/vidya-chat',
          builder: (_, __) => const VidyaChatScreen()),

      // User & Settings
      GoRoute(
          path: '/edit-profile',
          builder: (_, __) => const EditProfileScreen()),
      GoRoute(
          path: '/usage',
          builder: (_, __) => const UsageScreen()),

      // School admin
      GoRoute(
          path: '/organization',
          builder: (_, __) => const OrganizationScreen()),
      GoRoute(
          path: '/attendance',
          builder: (_, __) => const AttendanceScreen()),
      GoRoute(
          path: '/parent-message',
          builder: (_, __) => const ParentMessageScreen()),
      GoRoute(
          path: '/marks-entry',
          builder: (_, __) => const MarksEntryScreen()),

      // Privacy & Settings
      GoRoute(
          path: '/consent',
          builder: (_, __) => const ConsentScreen()),
      GoRoute(
          path: '/settings',
          builder: (_, __) => const SettingsScreen()),
      GoRoute(
          path: '/feedback',
          builder: (_, __) => const FeedbackScreen()),

      // Community
      GoRoute(path: '/community/compose', builder: (context, state) => const ComposePostScreen()),
      GoRoute(path: '/community/groups', builder: (context, state) => const GroupsScreen()),
      GoRoute(path: '/community/library', builder: (context, state) => const CommunityLibraryScreen()),
      GoRoute(path: '/community/connections', builder: (context, state) => const ConnectionsScreen()),
      GoRoute(path: '/staff-room', builder: (context, state) => const StaffRoomScreen()),

      // Messages
      GoRoute(path: '/messages', builder: (context, state) => const MessagesScreen()),
      GoRoute(path: '/messages/:id', builder: (context, state) {
        final id = state.pathParameters['id']!;
        final name = (state.extra as Map<String, dynamic>?)?['name'] as String? ?? 'Chat';
        return ConversationScreen(conversationId: id, participantName: name);
      }),

      // Notifications
      GoRoute(path: '/notifications', builder: (context, state) => const NotificationsScreen()),

      // Attendance (class management)
      GoRoute(path: '/attendance/classes', builder: (context, state) => const ClassListScreen()),
      GoRoute(path: '/attendance/classes/:id', builder: (context, state) {
        final id = state.pathParameters['id']!;
        return ClassDetailScreen(classId: id);
      }),

      // Avatar & News
      GoRoute(path: '/avatar', builder: (context, state) => const AvatarGeneratorScreen()),
      GoRoute(path: '/news', builder: (context, state) => const NewsFeedScreen()),
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
