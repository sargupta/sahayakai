import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/features/dashboard/presentation/dashboard_screen.dart';
import 'package:sahayakai/features/instant_answer/presentation/instant_answer_screen.dart';
import 'package:sahayakai/features/lesson_planner/presentation/lesson_plan_screen.dart';
import 'package:sahayakai/features/onboarding/presentation/onboarding_screen.dart';
import 'package:sahayakai/features/quiz_generator/presentation/quiz_generator_screen.dart';
import 'package:sahayakai/shared/widgets/app_skeleton.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';
import 'package:sahayakai/shared/widgets/error_view.dart';
import 'package:sahayakai/shared/widgets/offline_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'dashboard_fixtures.dart';

/// P0.3 — Dashboard Home.
///
/// Boots the real app and arrives here through the real redirect, so the tool
/// tiles are asserted against the routes they really reach.

/// A `users/<uid>` document with enough on it to be a real teacher.
Map<String, dynamic> _teacherDoc({
  Map<String, dynamic> overrides = const <String, dynamic>{},
}) {
  return <String, dynamic>{
    'displayName': 'Lakshmi Iyer',
    'schoolName': 'Government Higher Primary School',
    'subjects': <String>['Science'],
    'gradeLevels': <String>['Class 6'],
    ...overrides,
  };
}

Future<void> _scrollWholeList(WidgetTester tester) async {
  final position =
      tester.state<ScrollableState>(find.byType(Scrollable).first).position;
  var guard = 0;
  while (position.pixels < position.maxScrollExtent && guard++ < 60) {
    await tester.drag(find.byType(ListView).first, const Offset(0, -280));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  }
}

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('greeting', () {
    testWidgets('greets without a name when the profile cannot be read',
        (tester) async {
      // Today's runtime state: the token provider is the P0.2 stub, so the
      // profile read 401s. The greeting degrades; it never apologizes at the
      // top of the teacher's home screen.
      await pumpDashboard(tester);

      expect(find.text('Welcome back'), findsOneWidget);
      expect(find.byType(ErrorView), findsNothing);
    });

    testWidgets('uses the teacher\'s name once the profile loads',
        (tester) async {
      await pumpDashboard(tester, docs: FakeProfileDocSource(doc: _teacherDoc()));

      expect(find.text('Welcome back, Lakshmi Iyer'), findsOneWidget);
    });
  });

  group('tool tiles', () {
    testWidgets('lists only tools that exist, with no dead tiles',
        (tester) async {
      await pumpDashboard(tester);

      expect(find.text('Lesson Plan'), findsOneWidget);
      expect(find.text('Quiz'), findsOneWidget);
      expect(find.text('Instant Answer'), findsOneWidget);
      // Worksheet is P1.1 and has no screen. A tile that does nothing is worse
      // than an absent one.
      expect(find.text('Worksheet'), findsNothing);
    });

    testWidgets('the lesson plan tile opens the real lesson plan screen',
        (tester) async {
      await pumpDashboard(tester);

      await tester.tap(find.text('Lesson Plan'));
      await tester.pumpAndSettle();

      expect(find.byType(LessonPlanScreen), findsOneWidget);
    });

    testWidgets('the quiz tile opens the real quiz screen', (tester) async {
      await pumpDashboard(tester);

      await tester.tap(find.text('Quiz'));
      await tester.pumpAndSettle();

      expect(find.byType(QuizGeneratorScreen), findsOneWidget);
    });

    testWidgets('the instant answer tile opens the real instant answer screen',
        (tester) async {
      await pumpDashboard(tester);

      await tester.tap(find.text('Instant Answer'));
      await tester.pumpAndSettle();

      expect(find.byType(InstantAnswerScreen), findsOneWidget);
    });
  });

  group('recent work states', () {
    testWidgets('shows a skeleton while the list is in flight', (tester) async {
      await pumpDashboard(
        tester,
        // A request still in flight is the only state where a skeleton is the
        // right answer.
        client: libraryClient(delay: const Duration(milliseconds: 50)),
        settle: false,
      );

      // A shaped shimmer, never a bare centered spinner (DESIGN_RUBRIC §6).
      expect(find.byType(AppSkeleton), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 100));
      await tester.pumpAndSettle();

      expect(find.byType(AppSkeleton), findsNothing);
      expect(find.text('Photosynthesis for Class 6'), findsOneWidget);
    });

    testWidgets('renders the teacher\'s saved work', (tester) async {
      await pumpDashboard(
        tester,
        client: libraryClient(
          response: contentListResponse(
            items: [
              contentItem(),
              contentItem(overrides: {'type': 'quiz', 'title': 'Fractions quiz'}),
            ],
          ),
        ),
      );

      expect(find.text('Photosynthesis for Class 6'), findsOneWidget);
      expect(find.text('Fractions quiz'), findsOneWidget);
      // The meta line names the type, the class and the subject.
      expect(find.textContaining('Lesson plan'), findsOneWidget);
      expect(find.textContaining('Class 6'), findsWidgets);
    });

    testWidgets('an untitled document still shows, under a fallback label',
        (tester) async {
      await pumpDashboard(
        tester,
        client: libraryClient(
          response: contentListResponse(
            items: [contentItem(overrides: {'title': ''})],
          ),
        ),
      );

      expect(find.text('Untitled'), findsOneWidget);
    });

    testWidgets('an unknown content type renders rather than disappearing',
        (tester) async {
      await pumpDashboard(
        tester,
        client: libraryClient(
          response: contentListResponse(
            items: [
              contentItem(
                overrides: {'type': 'holographic-lesson', 'title': 'My work'},
              ),
            ],
          ),
        ),
      );

      expect(find.text('My work'), findsOneWidget);
      expect(find.textContaining('Saved work'), findsOneWidget);
    });

    testWidgets('an empty library gets the empty state, not an error',
        (tester) async {
      await pumpDashboard(
        tester,
        client: libraryClient(response: contentListResponse(items: [])),
      );

      expect(find.byType(EmptyView), findsWidgets);
      expect(
        find.text('Anything you make is saved here, ready to open again.'),
        findsOneWidget,
      );
      expect(find.byType(ErrorView), findsNothing);
    });

    testWidgets('a 401 offers sign-in, not a retry that cannot work',
        (tester) async {
      await pumpDashboard(tester, client: libraryClient(error: kUnauthorized));

      expect(find.text('Sign in to see your recent work.'), findsOneWidget);
      expect(find.byType(OfflineView), findsNothing);
      expect(find.byType(ErrorView), findsNothing);
    });

    testWidgets('a network failure shows the offline state with a retry',
        (tester) async {
      await pumpDashboard(tester, client: libraryClient(error: kOffline));

      expect(find.byType(OfflineView), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('any other failure shows the error state, with no raw exception',
        (tester) async {
      await pumpDashboard(tester, client: libraryClient(error: kServerError));

      expect(find.byType(ErrorView), findsOneWidget);
      expect(
        find.text('We could not open your recent work. Please try again.'),
        findsOneWidget,
      );
      expect(find.textContaining('our side'), findsNothing);
    });

    testWidgets('retry re-runs the fetch and recovers', (tester) async {
      final client = libraryClient(error: kOffline);
      await pumpDashboard(tester, client: client);
      expect(find.byType(OfflineView), findsOneWidget);
      expect(client.gets, hasLength(1));

      // The connection came back.
      client.error = null;
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();

      expect(client.gets, hasLength(2), reason: 'retry must re-run the fetch');
      expect(find.byType(OfflineView), findsNothing);
      expect(find.text('Photosynthesis for Class 6'), findsOneWidget);
    });
  });

  group('setup nudge (a nudge, never a gate)', () {
    testWidgets('appears only when the profile really is empty', (tester) async {
      await pumpDashboard(tester, docs: FakeProfileDocSource(doc: null));

      expect(find.text('Finish setting up your profile'), findsOneWidget);
    });

    testWidgets('never appears for a teacher whose profile is filled in',
        (tester) async {
      await pumpDashboard(tester, docs: FakeProfileDocSource(doc: _teacherDoc()));

      expect(find.text('Finish setting up your profile'), findsNothing);
    });

    testWidgets('never appears when the profile could not be read',
        (tester) async {
      // A failed read is not evidence of an empty profile. Nudging a teacher
      // whose profile is complete but unreadable is the gate incident in
      // miniature.
      await pumpDashboard(
        tester,
        docs: FakeProfileDocSource(readError: kUnauthorized),
      );

      expect(find.text('Finish setting up your profile'), findsNothing);
    });

    testWidgets('opens onboarding, which the teacher can still leave',
        (tester) async {
      await pumpDashboard(tester, docs: FakeProfileDocSource(doc: null));

      await tester.tap(find.text('Set up my profile'));
      await tester.pumpAndSettle();

      expect(find.byType(OnboardingScreen), findsOneWidget);
      expect(find.text('Skip for now'), findsOneWidget);
    });

    testWidgets('can be dismissed', (tester) async {
      await pumpDashboard(tester, docs: FakeProfileDocSource(doc: null));

      await tester.tap(find.text('Not now'));
      await tester.pumpAndSettle();

      expect(find.text('Finish setting up your profile'), findsNothing);
      // The tools are untouched by it either way.
      expect(find.text('Lesson Plan'), findsOneWidget);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9 / §12.10 / §12.11)', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          await pumpDashboard(
            tester,
            brightness: brightness,
            textScale: 1.3,
            surface: kNarrowPhone,
            docs: FakeProfileDocSource(doc: null),
          );

          expect(tester.takeException(), isNull);
          await _scrollWholeList(tester);
        },
      );
    }

    testWidgets('the dark theme really is dark', (tester) async {
      // The gates above only prove the dark run did not overflow. This proves
      // the dark run was actually dark.
      await pumpDashboard(tester, brightness: Brightness.dark);

      final theme = Theme.of(tester.element(find.byType(DashboardScreen)));
      expect(theme.brightness, Brightness.dark);
    });

    for (final locale in const [Locale('bn'), Locale('ta'), Locale('ml')]) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${locale.languageCode}',
        (tester) async {
          // The real localized screen at a real Indic locale, with Indic data
          // in the rows — not an English screen with a pasted string.
          await pumpDashboard(
            tester,
            locale: locale,
            textScale: 1.3,
            surface: kNarrowPhone,
            docs: FakeProfileDocSource(
              doc: _teacherDoc(overrides: {'displayName': kBn}),
            ),
            client: libraryClient(
              response: contentListResponse(
                items: [
                  contentItem(overrides: {'title': kTa}),
                  contentItem(overrides: {'title': kMl, 'type': 'quiz'}),
                ],
              ),
            ),
          );

          expect(tester.takeException(), isNull);
          await _scrollWholeList(tester);
        },
      );
    }

    testWidgets('an unbreakable compound word wraps, never scrolls sideways',
        (tester) async {
      await pumpDashboard(
        tester,
        textScale: 1.3,
        surface: kNarrowPhone,
        docs: FakeProfileDocSource(
          doc: _teacherDoc(overrides: {'displayName': kLongWord}),
        ),
        client: libraryClient(
          response: contentListResponse(
            items: [contentItem(overrides: {'title': kLongWord})],
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      await _scrollWholeList(tester);
    });

    testWidgets('the setup nudge does not overflow at 360dp x 1.3',
        (tester) async {
      // Two buttons plus a heading: the row that would break first.
      await pumpDashboard(
        tester,
        textScale: 1.3,
        surface: kNarrowPhone,
        locale: const Locale('ml'),
        docs: FakeProfileDocSource(doc: null),
      );

      expect(tester.takeException(), isNull);
      expect(find.text('Set up my profile'), findsOneWidget);
      await _scrollWholeList(tester);
    });
  });
}
