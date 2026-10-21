import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/platform/clock.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/attendance/presentation/attendance_month_screen.dart';
import 'package:sahayakai/features/exam_paper/presentation/exam_paper_screen.dart';
import 'package:sahayakai/features/notifications/data/notifications_store.dart';
import 'package:sahayakai/features/notifications/domain/teacher_notification.dart';
import 'package:sahayakai/features/parent_hotline/domain/call_summary.dart';
import 'package:sahayakai/features/parent_hotline/domain/parent_outreach.dart';
import 'package:sahayakai/features/parent_hotline/presentation/parent_hotline_controller.dart';
import 'package:sahayakai/features/parent_hotline/presentation/parent_hotline_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../attendance/attendance_harness.dart';
import '../exam_paper/exam_paper_fixtures.dart';

/// The three seams that FEED the Updates tab.
///
/// These are the tests that keep the surface honest end to end: the store on
/// its own would happily hold rows nobody ever writes, and a screen that never
/// records is a notifications tab that is permanently empty in the field while
/// green in CI.

Future<ProviderContainer> _pump(
  WidgetTester tester,
  Widget home, {
  required List<Override> overrides,
  Size surface = const Size(390, 2400),
}) async {
  tester.view.physicalSize = surface;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

  final container = ProviderContainer(overrides: overrides);
  addTearDown(container.dispose);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return container;
}

Future<void> _selectDropdown(
  WidgetTester tester,
  Finder field,
  String value,
) async {
  await tester.ensureVisible(field);
  await tester.tap(field);
  await tester.pumpAndSettle();
  await tester.tap(find.text(value).last);
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  group('exam paper: the 202 is the one content event the app can report', () {
    testWidgets('a queued generation writes exactly one row, named for the '
        'subject the teacher asked for', (tester) async {
      final container = await _pump(
        tester,
        const ExamPaperScreen(),
        overrides: [
          apiClientProvider.overrideWithValue(
            FakeApiClient(postResponse: examPaperInProgressJson()),
          ),
          nowProvider.overrideWithValue(() => DateTime.utc(2026, 8, 18, 10)),
        ],
      );

      final boardField = find.byType(DropdownButtonFormField<String?>).at(0);
      final gradeField = find.byType(DropdownButtonFormField<String?>).at(1);
      final subjectField = find.byType(DropdownButtonFormField<String?>).at(2);
      await _selectDropdown(tester, boardField, 'CBSE');
      await _selectDropdown(tester, gradeField, 'Nursery');
      await _selectDropdown(tester, subjectField, 'Mathematics');

      final chapters = find.byType(TextField);
      await tester.ensureVisible(chapters);
      await tester.enterText(chapters, 'Counting');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();

      expect(container.read(notificationsProvider), isEmpty);

      await tester.tap(find.text('Generate'));
      await tester.pumpAndSettle();

      final rows = container.read(notificationsProvider);
      expect(rows, hasLength(1));
      expect(rows.single.kind, TeacherNotificationKind.examPaperQueued);
      expect(rows.single.label, 'Mathematics');
      expect(rows.single.isRead, isFalse);
    });

    testWidgets('a paper that came back READY writes nothing — there is no '
        'event to report, the paper is on screen', (tester) async {
      final container = await _pump(
        tester,
        const ExamPaperScreen(),
        overrides: [
          apiClientProvider.overrideWithValue(
            FakeApiClient(postResponse: examPaperJson()),
          ),
          nowProvider.overrideWithValue(() => DateTime.utc(2026, 8, 18, 10)),
        ],
      );

      final boardField = find.byType(DropdownButtonFormField<String?>).at(0);
      final gradeField = find.byType(DropdownButtonFormField<String?>).at(1);
      final subjectField = find.byType(DropdownButtonFormField<String?>).at(2);
      await _selectDropdown(tester, boardField, 'CBSE');
      await _selectDropdown(tester, gradeField, 'Nursery');
      await _selectDropdown(tester, subjectField, 'Mathematics');

      final chapters = find.byType(TextField);
      await tester.ensureVisible(chapters);
      await tester.enterText(chapters, 'Counting');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();

      await tester.tap(find.text('Generate'));
      await tester.pumpAndSettle();

      expect(container.read(notificationsProvider), isEmpty);
    });
  });

  group('attendance: a consecutive-absence run worth acting on', () {
    FakeApiClient client(List<Map<String, dynamic>> summaries) => FakeApiClient(
      getResponsesByPath: <String, Object?>{summariesPath('c1'): summaries},
    );

    Future<ProviderContainer> pumpMonth(
      WidgetTester tester,
      List<Map<String, dynamic>> summaries,
    ) => _pump(
      tester,
      AttendanceMonthScreen(classId: 'c1', attendanceClass: testClass()),
      overrides: attendanceOverrides(client(summaries)),
    );

    testWidgets('a run at the threshold is recorded, with the class it belongs '
        'to', (tester) async {
      final container = await pumpMonth(tester, [
        summaryJson(absentDays: 4, consecutiveAbsences: kAbsenceRunThreshold),
      ]);

      final rows = container.read(notificationsProvider);
      expect(rows, hasLength(1));
      expect(rows.single.kind, TeacherNotificationKind.absenceRun);
      expect(rows.single.label, 'Asha Rao');
      expect(rows.single.count, kAbsenceRunThreshold);
      expect(rows.single.classId, 'c1');
      expect(rows.single.className, testClass().name);
    });

    testWidgets('a run below the threshold is not an alert', (tester) async {
      final container = await pumpMonth(tester, [
        summaryJson(
          absentDays: 2,
          consecutiveAbsences: kAbsenceRunThreshold - 1,
        ),
      ]);
      expect(container.read(notificationsProvider), isEmpty);
    });

    testWidgets('one row per student, and the same month twice does not '
        'duplicate', (tester) async {
      final container = await pumpMonth(tester, [
        summaryJson(consecutiveAbsences: 5),
        summaryJson(studentId: 's2', studentName: 'Ravi', rollNumber: 2),
        summaryJson(
          studentId: 's3',
          studentName: 'Meena',
          rollNumber: 3,
          consecutiveAbsences: 3,
        ),
      ]);

      // Rebuild the screen — the same rollup, read again.
      await tester.pump();
      await tester.pumpAndSettle();

      final rows = container.read(notificationsProvider);
      expect(rows.map((n) => n.label).toSet(), <String>{'Asha Rao', 'Meena'});
      expect(rows, hasLength(2));
    });
  });

  group('parent hotline: only outcomes the app has honest copy for', () {
    const base = ParentHotlineState(
      stage: HotlineStage.calling,
      studentId: 's1',
      studentName: 'Asha Rao',
      outreachId: 'o1',
      callResult: CallResult(callStatus: CallStatus.initiated),
    );

    Future<(ProviderContainer, _StagedHotlineController)> pumpHotline(
      WidgetTester tester,
    ) async {
      final controller = _StagedHotlineController(base);
      final container = await _pump(
        tester,
        const ParentHotlineScreen(),
        overrides: [
          parentHotlineControllerProvider.overrideWith(() => controller),
          nowProvider.overrideWithValue(() => DateTime.utc(2026, 8, 18, 10)),
        ],
      );
      return (container, controller);
    }

    Future<List<TeacherNotification>> settleWith(
      WidgetTester tester,
      ProviderContainer container,
      _StagedHotlineController controller,
      ParentHotlineState next,
    ) async {
      controller.push(next);
      await tester.pumpAndSettle();
      return container.read(notificationsProvider);
    }

    testWidgets('a completed call with a summary is recorded', (tester) async {
      final (container, controller) = await pumpHotline(tester);
      final rows = await settleWith(
        tester,
        container,
        controller,
        base.copyWith(
          stage: HotlineStage.summary,
          callResult: const CallResult(
            callStatus: CallStatus.completed,
            turnCount: 4,
            callSummary: CallSummary(
              parentResponse: 'Understood.',
              actionItemsForTeacher: <String>['Share the weekly plan.'],
              parentSentiment: ParentSentiment.cooperative,
              callQuality: CallQuality.productive,
            ),
          ),
        ),
      );

      expect(rows, hasLength(1));
      expect(rows.single.kind, TeacherNotificationKind.callCompleted);
      expect(rows.single.label, 'Asha Rao');
      expect(rows.single.id, 'hotline:o1:callCompleted');
    });

    testWidgets('a call that never connected is recorded as a failure', (
      tester,
    ) async {
      final (container, controller) = await pumpHotline(tester);
      final rows = await settleWith(
        tester,
        container,
        controller,
        base.copyWith(
          stage: HotlineStage.summary,
          callResult: const CallResult(callStatus: CallStatus.noAnswer),
        ),
      );

      expect(rows, hasLength(1));
      expect(rows.single.kind, TeacherNotificationKind.callFailed);
    });

    testWidgets('the WhatsApp-copy path records nothing — no call was placed', (
      tester,
    ) async {
      final (container, controller) = await pumpHotline(tester);
      final rows = await settleWith(
        tester,
        container,
        controller,
        base.copyWith(
          stage: HotlineStage.summary,
          deliveryMethod: DeliveryMethod.whatsappCopy,
          callResult: const CallResult(callStatus: CallStatus.manual),
        ),
      );

      expect(rows, isEmpty);
    });

    testWidgets('a conversation whose summary never generated records nothing '
        '— the completed row would promise a summary that is not there', (
      tester,
    ) async {
      final (container, controller) = await pumpHotline(tester);
      final rows = await settleWith(
        tester,
        container,
        controller,
        base.copyWith(
          stage: HotlineStage.summary,
          callResult: const CallResult(
            callStatus: CallStatus.completed,
            turnCount: 4,
            transcript: <TranscriptTurn>[
              TranscriptTurn(
                role: TranscriptRole.agent,
                text: 'Namaste',
                timestamp: '2026-08-18T10:00:00Z',
              ),
              TranscriptTurn(
                role: TranscriptRole.parent,
                text: 'Ji',
                timestamp: '2026-08-18T10:00:05Z',
              ),
            ],
          ),
        ),
      );

      expect(rows, isEmpty);
    });

    testWidgets('the same outcome re-landing does not stack a second row', (
      tester,
    ) async {
      final (container, controller) = await pumpHotline(tester);
      final terminal = base.copyWith(
        stage: HotlineStage.summary,
        callResult: const CallResult(callStatus: CallStatus.busy),
      );
      await settleWith(tester, container, controller, terminal);
      // The poll re-lands the same terminal state with one more field settled.
      final rows = await settleWith(
        tester,
        container,
        controller,
        terminal.copyWith(
          callResult: const CallResult(
            callStatus: CallStatus.busy,
            callDurationSeconds: 3,
          ),
        ),
      );

      expect(rows, hasLength(1));
    });
  });
}

/// A hotline controller whose state a test drives by hand, so the screen sees a
/// real TRANSITION. The suite's own `_FakeHotlineController` returns a fixed
/// state and therefore never fires a `ref.listen` — which is itself the reason
/// none of the existing hotline tests started recording rows.
class _StagedHotlineController extends ParentHotlineController {
  _StagedHotlineController(this._initial);

  final ParentHotlineState _initial;

  @override
  ParentHotlineState build() => _initial;

  @override
  Future<void> init({
    String? studentId,
    String? studentName,
    String? classId,
    String? className,
    String? parentLanguage,
    String? subject,
    OutreachReason? suggestedReason,
  }) async {}

  @override
  void leaveCalling() {}

  void push(ParentHotlineState next) => state = next;
}
