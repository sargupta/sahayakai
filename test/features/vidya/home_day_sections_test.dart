import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/attendance/domain/attendance_date.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_providers.dart';
import 'package:sahayakai/features/staffroom/domain/community_post.dart';
import 'package:sahayakai/features/staffroom/domain/group.dart';
import 'package:sahayakai/features/staffroom/domain/staffroom_results.dart';
import 'package:sahayakai/features/vidya/domain/home_day.dart';
import 'package:sahayakai/features/vidya/presentation/home_day_providers.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/home_day_sections.dart';
import 'package:sahayakai/shared/domain/library_item.dart';

import '../../support/fake_api_client.dart';

/// Home's day sections: Today (classes and registers), This week, Pick up
/// where you left off and From the staff room — each from real state, each
/// leading where it says, none overflowing in Indic scripts at large text.

const _today = AttendanceDate(2026, 11, 19); // a Thursday

const _classes = [
  TodayClass(
    classId: 'c7b',
    name: '7B',
    subject: 'Maths',
    state: ClassDayState.toMark,
  ),
  TodayClass(
    classId: 'c5a',
    name: '5A',
    subject: 'EVS',
    state: ClassDayState.absences,
    absent: 2,
  ),
  TodayClass(
    classId: 'c8c',
    name: '8C',
    subject: 'Science',
    state: ClassDayState.marked,
  ),
];

final _work = [
  LibraryItem(
    id: 'w1',
    type: ContentType.lessonPlan,
    title: 'Water cycle',
    gradeLevel: 'Class 7',
    createdAt: DateTime.now(),
  ),
  const LibraryItem(id: 'w2', type: ContentType.quiz, title: 'Fractions'),
];

final _post = FeedItem(
  id: 'f1',
  type: FeedItemType.groupPost,
  groupName: 'Staff room',
  post: GroupPost(
    id: 'p1',
    groupId: 'g1',
    authorUid: 'u1',
    authorName: 'Anita Rao',
    content: 'Who has a good fractions game for Class 5?',
    postType: PostType.askHelp,
    createdAt: DateTime.now().toUtc().toIso8601String(),
  ),
);

class _Dest extends StatelessWidget {
  const _Dest(this.id);
  final String id;
  @override
  Widget build(BuildContext context) =>
      Scaffold(body: Text('DEST', key: Key('dest-$id')));
}

Future<void> _pump(
  WidgetTester tester, {
  List<TodayClass> classes = _classes,
  Locale locale = const Locale('en'),
  double textScale = 1.0,
  double width = 390,
}) async {
  tester.view.physicalSize = Size(width, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

  GoRoute dest(String path, String id) =>
      GoRoute(path: path, builder: (_, _) => _Dest(id));
  final router = GoRouter(
    initialLocation: Routes.home,
    routes: [
      GoRoute(
        path: Routes.home,
        builder: (_, _) => Scaffold(
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const HomeTodayCard(),
                const SizedBox(height: 24),
                const HomeWeekStrip(),
                const SizedBox(height: 24),
                HomePickUp(onOpenMyWork: () {}),
                HomeStaffRoom(onOpenCommunity: () {}),
              ],
            ),
          ),
        ),
      ),
      dest(Routes.attendanceMarkPattern, 'mark'),
      dest(Routes.attendanceNewClass, 'new-class'),
      dest(Routes.libraryDetailPattern, 'detail'),
      dest(Routes.prepDesk, 'prep-desk'),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(FakeApiClient()),
        homeTodayProvider.overrideWithValue(_today),
        todayClassesProvider.overrideWith((ref) async => classes),
        weekStreakProvider.overrideWithValue(
          buildWeekStreak(_today, {
            _today.addDays(-3),
            _today.addDays(-2),
            _today.addDays(-1),
          }),
        ),
        recentWorkProvider.overrideWithValue(_work),
        staffRoomGlanceProvider.overrideWithValue(
          StaffRoomGlance(postedToday: const ['Anita Rao'], lead: _post),
        ),
        likedItemIdsProvider.overrideWith((ref) async => const LikedItemIds()),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        theme: AppTheme.light(),
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('Today', () {
    testWidgets('the day, the counts and each class by its register', (
      tester,
    ) async {
      await _pump(tester);
      expect(find.text('THURSDAY'), findsOneWidget);
      expect(find.text('19 Nov'), findsOneWidget);
      expect(find.text('3 classes'), findsOneWidget);
      expect(find.text('1 register to mark'), findsOneWidget);
      expect(find.bySemanticsLabel('7B, Maths, To mark'), findsOneWidget);
      expect(find.bySemanticsLabel('5A, EVS, 2 absent'), findsOneWidget);
      expect(find.bySemanticsLabel('8C, Science, Marked'), findsOneWidget);
      expect(find.text("7B's register isn't marked"), findsOneWidget);
    });

    testWidgets('Mark now opens the unmarked class\'s register', (
      tester,
    ) async {
      await _pump(tester);
      await tester.tap(find.bySemanticsLabel('Mark now'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('dest-mark')), findsOneWidget);
    });

    testWidgets('every register saved says so, with no Mark now', (
      tester,
    ) async {
      await _pump(
        tester,
        classes: const [
          TodayClass(
            classId: 'c8c',
            name: '8C',
            subject: 'Science',
            state: ClassDayState.marked,
          ),
        ],
      );
      expect(find.text('All registers marked'), findsOneWidget);
      expect(find.text('Every register is marked for today.'), findsOneWidget);
      expect(find.bySemanticsLabel('Mark now'), findsNothing);
    });

    testWidgets('a teacher with no classes is shown how to add them', (
      tester,
    ) async {
      await _pump(tester, classes: const []);
      await tester.tap(find.bySemanticsLabel('Add your classes'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('dest-new-class')), findsOneWidget);
    });
  });

  group('This week', () {
    testWidgets('the run and the nudge for today', (tester) async {
      await _pump(tester);
      expect(find.text('3 days in a row'), findsOneWidget);
      expect(
        find.text('Mark a register or make something today to keep it going.'),
        findsOneWidget,
      );
      expect(find.text('Today'), findsWidgets);
    });
  });

  group('Pick up where you left off', () {
    testWidgets('the newest work opens its page; the last card opens tools', (
      tester,
    ) async {
      await _pump(tester);
      expect(find.text('Water cycle'), findsOneWidget);
      expect(find.text('Fractions'), findsOneWidget);
      await tester.tap(find.text('Water cycle'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('dest-detail')), findsOneWidget);
    });

    testWidgets('Make something new opens every tool', (tester) async {
      await _pump(tester);
      await tester.ensureVisible(find.bySemanticsLabel('Make something new'));
      await tester.tap(find.bySemanticsLabel('Make something new'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('dest-prep-desk')), findsOneWidget);
    });
  });

  group('From the staff room', () {
    testWidgets('who posted today and the post', (tester) async {
      await _pump(tester);
      expect(find.text('1 teacher posted today'), findsOneWidget);
      expect(
        find.textContaining('good fractions game', findRichText: true),
        findsOneWidget,
      );
    });
  });

  group('overflow gates', () {
    for (final code in ['en', 'hi', 'ta', 'ml']) {
      testWidgets('no overflow in $code at 360dp x 1.3', (tester) async {
        await _pump(tester, locale: Locale(code), textScale: 1.3, width: 360);
        expect(tester.takeException(), isNull);
      });
    }
  });
}
