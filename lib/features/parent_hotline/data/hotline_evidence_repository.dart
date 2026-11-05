import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../../../core/platform/clock.dart';
import '../../attendance/data/attendance_repository.dart';
import '../../attendance/domain/attendance_date.dart';
import '../domain/hotline_evidence.dart';

/// Reads the evidence a parent call is grounded in — the student's recent
/// absences and recent marks — from the routes the web's Contact-Parent modal
/// reads, verified against `sahayakai-main`:
///
///   • `GET /api/attendance/classes/{classId}/students/{studentId}/absences`
///     `?limitDays=30` → `string[]` of `YYYY-MM-DD`, newest first;
///   • `GET /api/attendance/classes/{classId}/summaries?year=&month=` → the
///     month's rollups, of which only this student's `currentAbsenceStreak` is
///     used (the one absence figure that may be phrased in the present tense);
///   • `GET /api/performance/student/{studentId}?classId=` →
///     `{ assessments: Assessment[] }`, of which the latest three are kept.
///
/// Every read stands alone: a failing marks read never hides the absences, and
/// the controller shows each failure as "could not load", never as "nothing on
/// record".
class HotlineEvidenceRepository {
  const HotlineEvidenceRepository(this._client, this._attendance, this._now);

  final ApiClient _client;
  final AttendanceRepository _attendance;
  final DateTime Function() _now;

  /// How far back the absence list reaches — the route's own default.
  static const int absenceLookbackDays = 30;

  /// How many recent results are shown and cited — the web modal's three.
  static const int recentAssessmentCount = 3;

  Future<List<AttendanceDate>> absenceDates(String classId, String studentId) {
    return _attendance.absenceDates(
      classId,
      studentId,
      limitDays: absenceLookbackDays,
    );
  }

  /// The student's current absence run this month (IST), or null when the
  /// summary does not list them or does not carry the figure.
  Future<int?> currentAbsenceStreak(String classId, String studentId) async {
    final today = AttendanceDate.fromIstInstant(_now());
    final summaries = await _attendance.studentSummaries(
      classId,
      year: today.year,
      month: today.month,
    );
    for (final s in summaries) {
      if (s.studentId == studentId) return s.currentAbsenceStreak;
    }
    return null;
  }

  /// The latest results on record, newest first, at most
  /// [recentAssessmentCount].
  Future<List<RecentAssessment>> recentAssessments(
    String classId,
    String studentId,
  ) {
    return _client.get<List<RecentAssessment>>(
      '/api/performance/student/${Uri.encodeComponent(studentId)}',
      query: <String, dynamic>{'classId': classId},
      decode: decodeAssessments,
    );
  }

  /// Decodes `{ assessments: [...] }`. An entry missing a number it would be
  /// cited by is dropped rather than shown with an invented value.
  static List<RecentAssessment> decodeAssessments(dynamic json) {
    final raw = json is Map ? json['assessments'] : null;
    if (raw is! List) return const <RecentAssessment>[];
    final out = <RecentAssessment>[];
    for (final entry in raw.whereType<Map>()) {
      final obtained = entry['marksObtained'];
      final max = entry['maxMarks'];
      if (obtained is! num || max is! num || max <= 0) continue;
      final pct = entry['percentage'];
      final subject = entry['subject'];
      final name = entry['name'];
      out.add(
        RecentAssessment(
          id: entry['id'] is String ? entry['id'] as String : '',
          subject: subject is String ? subject.trim() : '',
          name: name is String ? name.trim() : '',
          marksObtained: obtained,
          maxMarks: max,
          percentage: pct is num ? pct.toDouble() : obtained / max * 100,
          date: AttendanceDate.tryParse(
            entry['date'] is String ? entry['date'] as String : null,
          ),
        ),
      );
    }
    // Newest first; an undated result sorts last rather than being guessed.
    out.sort((a, b) {
      final da = a.date, db = b.date;
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return db.wire.compareTo(da.wire);
    });
    return List<RecentAssessment>.unmodifiable(
      out.take(recentAssessmentCount),
    );
  }
}

/// A plain [Provider] (no codegen) so a test overrides it with
/// `overrideWithValue`, exactly as `attendanceRepositoryProvider`.
final hotlineEvidenceRepositoryProvider = Provider<HotlineEvidenceRepository>(
  (ref) => HotlineEvidenceRepository(
    ref.watch(apiClientProvider),
    ref.watch(attendanceRepositoryProvider),
    ref.watch(nowProvider),
  ),
);
