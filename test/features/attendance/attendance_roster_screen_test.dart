import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/attendance/presentation/attendance_roster_screen.dart';
import 'package:sahayakai/features/attendance/presentation/widgets/attendance_failure_view.dart';
import 'package:sahayakai/shared/widgets/error_view.dart';
import 'package:sahayakai/shared/widgets/note_banner.dart';
import 'package:sahayakai/shared/widgets/offline_view.dart';
import 'package:sahayakai/shared/widgets/primary_button.dart';

import '../../support/fake_api_client.dart';
import 'attendance_harness.dart';

/// U12 — the class roster.
///
/// The first group is the reason this screen needed care. `listRoster` throws
/// `RosterProjectionUnavailableException` against production today, on
/// purpose: the masked `?projection=roster` reply ships in draft PR #124 and
/// is unmerged, so the route still answers with the FULL student documents and
/// the repository refuses to decode every parent's phone number onto the
/// handset. That refusal is a SERVER-SIDE GAP, not a fault in the teacher's
/// class, and the tests below pin the three things that follow from it.
void main() {
  group('the masked projection is unavailable', () {
    /// Production's current reply: the unmasked student document, phone
    /// number and all.
    FakeApiClient unmaskedClient() => FakeApiClient(
      getResponsesByPath: <String, Object?>{
        studentsPath('c1'): <Map<String, dynamic>>[
          unmaskedStudent(parentPhone: '+919876543210'),
        ],
      },
    );

    testWidgets('renders its own specific state, not a generic failure', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        AttendanceRosterScreen(classId: 'c1', attendanceClass: testClass()),
        client: unmaskedClient(),
      );

      final l10n = strings(tester, AttendanceRosterScreen);
      expect(find.byType(RosterUnavailableView), findsOneWidget);
      expect(find.text(l10n.attendanceRosterUnavailableTitle), findsOneWidget);
      expect(find.text(l10n.attendanceRosterUnavailableBody), findsOneWidget);

      // Not an error, and not the generic roster-load message.
      expect(find.byType(ErrorView), findsNothing);
      expect(find.byType(OfflineView), findsNothing);
      expect(find.text(l10n.attendanceRosterError), findsNothing);
      expect(find.text(l10n.errorGeneric), findsNothing);
    });

    testWidgets('offers no retry, because a retry would fail identically', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        AttendanceRosterScreen(classId: 'c1', attendanceClass: testClass()),
        client: unmaskedClient(),
      );

      final l10n = strings(tester, AttendanceRosterScreen);
      expect(find.text(l10n.actionRetry), findsNothing);
    });

    testWidgets('never puts the parent phone number on screen', (tester) async {
      final client = unmaskedClient();
      await pumpScreen(
        tester,
        AttendanceRosterScreen(classId: 'c1', attendanceClass: testClass()),
        client: client,
      );

      // The whole point of failing closed: the number the route sent is not
      // rendered, in whole or in part, and neither is the raw body.
      for (final leak in const [
        '+919876543210',
        '919876543210',
        '9876543210',
        '3210',
      ]) {
        expect(
          find.textContaining(leak),
          findsNothing,
          reason: '$leak reached the UI from an unmasked roster reply',
        );
      }
    });

    testWidgets('adding a student still works, because that write goes UP', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        AttendanceRosterScreen(classId: 'c1', attendanceClass: testClass()),
        client: unmaskedClient(),
      );

      final l10n = strings(tester, AttendanceRosterScreen);
      final submit = find.widgetWithText(
        PrimaryButton,
        l10n.attendanceAddStudent,
      );
      expect(submit, findsOneWidget);
      expect(tester.widget<PrimaryButton>(submit).onPressed, isNotNull);
    });
  });

  group('the masked projection is available', () {
    testWidgets('renders a row per student with the last-4 mask only', (
      tester,
    ) async {
      final client = FakeApiClient(
        getResponsesByPath: <String, Object?>{
          studentsPath('c1'): <Map<String, dynamic>>[
            maskedStudent(),
            maskedStudent(
              id: 's2',
              name: 'Ravi Kumar',
              rollNumber: 2,
              parentLanguage: 'Hindi',
              hasParentPhone: false,
              parentPhoneLast4: '',
            ),
          ],
        },
      );

      await pumpScreen(
        tester,
        AttendanceRosterScreen(classId: 'c1', attendanceClass: testClass()),
        client: client,
      );

      final l10n = strings(tester, AttendanceRosterScreen);
      expect(find.text('Asha Rao'), findsOneWidget);
      expect(
        find.text('${l10n.attendanceRollLabel(1)} · Kannada'),
        findsOneWidget,
      );
      expect(find.text(l10n.attendanceParentPhoneMask('4821')), findsOneWidget);

      // A student with no number on file is stated plainly rather than left
      // blank, so the teacher knows why no call can be placed.
      expect(find.text('Ravi Kumar'), findsOneWidget);
      expect(find.text(l10n.attendanceNoParentPhone), findsOneWidget);
      expect(find.byType(RosterUnavailableView), findsNothing);
    });

    testWidgets('an empty class is an EmptyView with the next step', (
      tester,
    ) async {
      final client = FakeApiClient(
        getResponsesByPath: <String, Object?>{
          studentsPath('c1'): const <Map<String, dynamic>>[],
        },
      );

      await pumpScreen(
        tester,
        AttendanceRosterScreen(classId: 'c1', attendanceClass: testClass()),
        client: client,
      );

      final l10n = strings(tester, AttendanceRosterScreen);
      expect(find.text(l10n.attendanceRosterEmptyTitle), findsOneWidget);
      expect(find.byType(ErrorView), findsNothing);
    });
  });

  testWidgets('a full class withdraws Add student instead of letting it 400', (
    tester,
  ) async {
    final client = FakeApiClient(
      getResponsesByPath: <String, Object?>{
        studentsPath('c1'): <Map<String, dynamic>>[maskedStudent()],
      },
    );

    await pumpScreen(
      tester,
      AttendanceRosterScreen(
        classId: 'c1',
        attendanceClass: testClass(studentCount: 40),
      ),
      client: client,
    );

    final l10n = strings(tester, AttendanceRosterScreen);
    // The cap is explained where the disabled action is, not after a round
    // trip that would have said the same thing.
    expect(find.byType(NoteBanner), findsOneWidget);
    expect(find.text(l10n.attendanceClassFullTitle), findsOneWidget);
    expect(find.text(l10n.attendanceClassFullBody(40)), findsOneWidget);

    // The action is withdrawn, not left tappable: the count is the same
    // denormalized counter the server's transaction guards, so the UI can say
    // no before the round trip rather than apologise after it.
    expect(
      find.widgetWithText(PrimaryButton, l10n.attendanceAddStudent),
      findsNothing,
    );
  });
}
