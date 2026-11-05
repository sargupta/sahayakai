import 'package:flutter/foundation.dart';

import 'parent_outreach.dart';

/// Everything a screen can hand the Parent Hotline when it opens it: a class
/// to show, a student to start with, and the students just marked absent
/// (who are listed first, flagged). Every field is optional; a plain open
/// lands on the picker.
///
/// The `/parent-hotline` route reads it from `GoRouterState.extra`, as this
/// type or as the plain map older call sites pass ([HotlineLaunch.fromExtra]).
@immutable
class HotlineLaunch {
  const HotlineLaunch({
    this.studentId,
    this.studentName,
    this.classId,
    this.className,
    this.parentLanguage,
    this.subject,
    this.suggestedReason,
    this.taskId,
    this.absentStudentIds = const <String>{},
    this.outreachId,
  });

  /// Reads the route's `extra`: a [HotlineLaunch], a `Map` with the same
  /// keys (`suggestedReason` as its wire value), or nothing.
  factory HotlineLaunch.fromExtra(Object? extra) {
    if (extra is HotlineLaunch) return extra;
    if (extra is! Map) return const HotlineLaunch();
    String? text(String key) {
      final v = extra[key];
      return v is String && v.trim().isNotEmpty ? v : null;
    }

    final reason = extra['suggestedReason'];
    final absent = extra['absentStudentIds'];
    return HotlineLaunch(
      studentId: text('studentId'),
      studentName: text('studentName'),
      classId: text('classId'),
      className: text('className'),
      parentLanguage: text('parentLanguage'),
      subject: text('subject'),
      suggestedReason: reason is OutreachReason
          ? reason
          // An unknown token means no suggestion, not "absences" (which is
          // what the tolerant [OutreachReason.fromWire] would answer).
          : OutreachReason.values.where((r) => r.wire == reason).firstOrNull,
      taskId: text('taskId'),
      absentStudentIds: absent is Iterable
          ? {
              for (final id in absent)
                if (id is String) id,
            }
          : const <String>{},
      outreachId: text('outreachId'),
    );
  }

  final String? studentId;
  final String? studentName;
  final String? classId;
  final String? className;
  final String? parentLanguage;
  final String? subject;
  final OutreachReason? suggestedReason;
  final String? taskId;

  /// Students marked absent on the register that opened the hotline.
  final Set<String> absentStudentIds;

  /// One call to open directly (a call row in Updates); [studentName] is its
  /// student. Wins over every other field.
  final String? outreachId;
}
