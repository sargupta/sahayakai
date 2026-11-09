import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/demo/demo_api_client.dart';
import 'package:sahayakai/demo/demo_core.dart';
import 'package:sahayakai/demo/demo_mode.dart';
import 'package:sahayakai/demo/demo_overrides.dart';
import 'package:sahayakai/features/attendance/domain/attendance_date.dart';
import 'package:sahayakai/features/attendance/domain/attendance_record.dart';
import 'package:sahayakai/features/attendance/presentation/attendance_providers.dart';
import 'package:sahayakai/features/notifications/domain/teacher_notification.dart';
import 'package:sahayakai/features/notifications/presentation/widgets/notification_row.dart';
import 'package:sahayakai/features/parent_hotline/data/dto/outreach_dtos.dart';
import 'package:sahayakai/features/parent_hotline/domain/parent_outreach.dart';
import 'package:sahayakai/shared/data/library_repository.dart';

/// The demo build's sample data must tell one consistent story, because a
/// presentation walks across features: Home's reminder, the outreach list,
/// the register and the call all have to agree.
void main() {
  // A Wednesday morning in IST, so "today" and the previous school days are
  // fixed (Sundays are skipped by the demo register).
  final wednesday = DateTime.utc(2026, 11, 11, 4);
  final today = AttendanceDate.fromIstInstant(wednesday);

  DemoAttendanceRepository attendance() =>
      DemoAttendanceRepository(DemoApiClient(), () => wednesday);

  test('Class 6 B was marked this morning with two absences', () async {
    final repo = attendance();
    final register = await repo.attendanceOn(kDemoClass6Id, today);
    expect(register, isNotNull);
    expect(
      register!.statuses.values.where((s) => s == AttendanceStatus.absent),
      hasLength(2),
    );
    // Class 7 A has no register yet, so its roll call starts fresh.
    expect(await repo.attendanceOn(kDemoClass7Id, today), isNull);
  });

  test("Rohan's current streak is three school days", () async {
    final summaries = await attendance().studentSummaries(
      kDemoClass7Id,
      year: today.year,
      month: today.month,
    );
    final rohan = summaries.singleWhere((s) => s.studentName == 'Rohan Shinde');
    expect(rohan.currentAbsenceStreak, 3);
    expect(
      summaries.where(
        (s) => (s.currentAbsenceStreak ?? 0) >= kAbsenceRunThreshold,
      ),
      hasLength(1),
    );
  });

  test('a saved register is what the next read returns', () async {
    final repo = attendance();
    final roster = await repo.listRoster(kDemoClass7Id);
    await repo.saveAttendance(
      kDemoClass7Id,
      date: today,
      statuses: {
        for (final s in roster)
          s.id: s.rollNumber == 3
              ? AttendanceStatus.absent
              : AttendanceStatus.present,
      },
    );
    final register = await repo.attendanceOn(kDemoClass7Id, today);
    expect(register!.statuses[roster[2].id], AttendanceStatus.absent);
  });

  test("Home's absentee count reads the saved registers", () async {
    final container = ProviderContainer(overrides: demoOverrides());
    addTearDown(container.dispose);
    // Only Class 6 B is marked today in the demo, with two absences.
    expect(await container.read(todayAbsentCountProvider.future), 2);
  });

  test('a demo call is in flight, then ends with a summary', () async {
    final hotline = DemoParentHotlineRepository(
      DemoApiClient(),
      callLength: const Duration(milliseconds: 300),
    );
    final id = await hotline.createOutreach(
      const CreateOutreachRequestDto(
        classId: kDemoClass7Id,
        className: kDemoClass7Name,
        studentId: 's7-03',
        studentName: 'Rohan Shinde',
        parentLanguage: 'Marathi',
        reason: 'consecutive_absences',
        generatedMessage: 'Namaskar',
        deliveryMethod: 'twilio_call',
      ),
    );
    await hotline.placeCall(outreachId: id, parentLanguage: 'Marathi');

    final during = await hotline.pollSummary(id);
    expect(during.callStatus, CallStatus.initiated);
    expect(during.isTerminal, isFalse);

    await Future<void>.delayed(const Duration(milliseconds: 350));
    final after = await hotline.pollSummary(id);
    expect(after.callStatus, CallStatus.completed);
    expect(after.hadConversation, isTrue);
    expect(after.callSummary, isNotNull);
    expect(after.callSummary!.parentCommitments, isNotEmpty);
    expect(after.transcript.first.text, contains('Rohan'));

    // Reopening that student's outreach finds the finished call.
    final latest = await hotline.latestForStudent('s7-03');
    expect(latest?.outreachId, id);
    expect(latest?.result.callStatus, CallStatus.completed);
  });

  test('the library lists items whose detail opens', () async {
    final repo = LibraryRepository(DemoApiClient());
    final items = await repo.fetchRecent(limit: 20);
    expect(items, isNotEmpty);
    final detail = await repo.fetchItem(items.first.id);
    expect(detail.title, items.first.title);
    expect(detail.data, isNotNull);
  });

  testWidgets('a follow-up reminder reads as one in Updates', (tester) async {
    late AppLocalizations l10n;
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) {
            l10n = AppLocalizations.of(context);
            return const SizedBox();
          },
        ),
      ),
    );
    final row = TeacherNotification(
      id: 'hotline:o-9:${TeacherNotificationKind.followUp.wire}',
      kind: TeacherNotificationKind.followUp,
      at: wednesday,
      label: 'Rohan Shinde',
    );
    expect(
      notificationTitle(row, l10n),
      "Follow up with Rohan Shinde's parent",
    );
    expect(notificationBody(row, l10n), l10n.notificationFollowUpBody);
    // Keyed like a call row, so tapping it reopens that call.
    expect(row.outreachId, 'o-9');
    expect(
      TeacherNotificationKind.fromWire(row.kind.wire),
      TeacherNotificationKind.followUp,
    );
  });
}
