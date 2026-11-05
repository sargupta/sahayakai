import 'package:flutter/foundation.dart';

import '../../attendance/domain/attendance_date.dart';

/// Where one half of the evidence read stands.
enum EvidenceStatus {
  /// The read is in flight.
  loading,

  /// The read answered (possibly with nothing on record).
  loaded,

  /// The read failed. The panel says it could not load — it never presents a
  /// failure as "nothing on record".
  failed,
}

/// One real assessment result, as `GET /api/performance/student/{id}` returns
/// it (`Assessment` in `src/types/performance.ts`). Only the fields the
/// evidence panel shows and the message draft cites are kept.
@immutable
class RecentAssessment {
  const RecentAssessment({
    required this.id,
    required this.subject,
    required this.name,
    required this.marksObtained,
    required this.maxMarks,
    required this.percentage,
    required this.date,
  });

  final String id;
  final String subject;

  /// e.g. "Unit Test 1 — Fractions & Decimals".
  final String name;
  final num marksObtained;
  final num maxMarks;

  /// 0–100, as stored server-side.
  final double percentage;

  /// The assessment day, when the record carried a valid one.
  final AttendanceDate? date;

  @override
  bool operator ==(Object other) =>
      other is RecentAssessment &&
      other.id == id &&
      other.subject == subject &&
      other.name == name &&
      other.marksObtained == marksObtained &&
      other.maxMarks == maxMarks &&
      other.percentage == percentage &&
      other.date == date;

  @override
  int get hashCode => Object.hash(
    id,
    subject,
    name,
    marksObtained,
    maxMarks,
    percentage,
    date,
  );
}

/// The evidence behind one parent call: the student's recent absences and
/// recent marks, exactly as the server reported them.
///
/// Nothing here is derived beyond what the web's Contact-Parent modal derives
/// from the same records (the average and at-risk flag of the latest three
/// results). In particular [currentAbsenceStreak] is the server's own
/// `currentAbsenceStreak` — the one absence figure that may be phrased in the
/// present tense to a parent — never a count of [absenceDates], which are not
/// necessarily consecutive school days.
@immutable
class HotlineEvidence {
  const HotlineEvidence({
    required this.studentId,
    this.absences = EvidenceStatus.loading,
    this.absenceDates = const [],
    this.currentAbsenceStreak,
    this.marks = EvidenceStatus.loading,
    this.recentAssessments = const [],
  });

  /// The student this evidence belongs to — a guard against a slow read for
  /// one student landing on another.
  final String studentId;

  final EvidenceStatus absences;

  /// Days marked absent in the last 30, newest first.
  final List<AttendanceDate> absenceDates;

  /// The unbroken run of absences the student is CURRENTLY on, from the
  /// server's monthly summary. Null when not known.
  final int? currentAbsenceStreak;

  final EvidenceStatus marks;

  /// Up to three most recent results, newest first.
  final List<RecentAssessment> recentAssessments;

  /// Mean percentage of [recentAssessments], or null when there are none.
  double? get averagePercentage {
    if (recentAssessments.isEmpty) return null;
    final sum = recentAssessments.fold<double>(0, (s, a) => s + a.percentage);
    return sum / recentAssessments.length;
  }

  /// The server's at-risk line: an average below 35%.
  bool get isAtRisk => (averagePercentage ?? 100) < 35;

  /// The `PerformanceContext` the message draft and the outreach carry, built
  /// exactly as the web modal builds it. Null when there are no results — the
  /// AI is then given no figures at all, so it has none to cite.
  Map<String, dynamic>? get performanceContext {
    final average = averagePercentage;
    if (average == null) return null;
    return <String, dynamic>{
      'recentAssessmentIds': [for (final a in recentAssessments) a.id],
      'latestPercentage': (average * 10).round() / 10,
      'isAtRisk': isAtRisk,
      'subjectBreakdown': [
        for (final a in recentAssessments)
          <String, dynamic>{
            'subject': a.subject,
            'name': a.name,
            'marksObtained': a.marksObtained,
            'maxMarks': a.maxMarks,
            'percentage': (a.percentage * 10).round() / 10,
            'date': a.date?.wire ?? '',
          },
      ],
    };
  }

  HotlineEvidence copyWith({
    EvidenceStatus? absences,
    List<AttendanceDate>? absenceDates,
    int? currentAbsenceStreak,
    EvidenceStatus? marks,
    List<RecentAssessment>? recentAssessments,
  }) {
    return HotlineEvidence(
      studentId: studentId,
      absences: absences ?? this.absences,
      absenceDates: absenceDates ?? this.absenceDates,
      currentAbsenceStreak: currentAbsenceStreak ?? this.currentAbsenceStreak,
      marks: marks ?? this.marks,
      recentAssessments: recentAssessments ?? this.recentAssessments,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is HotlineEvidence &&
      other.studentId == studentId &&
      other.absences == absences &&
      listEquals(other.absenceDates, absenceDates) &&
      other.currentAbsenceStreak == currentAbsenceStreak &&
      other.marks == marks &&
      listEquals(other.recentAssessments, recentAssessments);

  @override
  int get hashCode => Object.hash(
    studentId,
    absences,
    Object.hashAll(absenceDates),
    currentAbsenceStreak,
    marks,
    Object.hashAll(recentAssessments),
  );
}
