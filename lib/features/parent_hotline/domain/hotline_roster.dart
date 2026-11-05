import 'package:flutter/foundation.dart';

import 'hotline_student.dart';

/// One of the teacher's classes as the Parent Hotline picker lists it: the
/// class identity, and either its students or the reason they could not be
/// read.
///
/// Per class, not one flat list, so that one class failing to load does not
/// blank the whole picker — the other classes stay callable and the failing
/// one says so in place, with its own retry.
@immutable
class HotlineClassRoster {
  const HotlineClassRoster({
    required this.classId,
    required this.className,
    this.subject,
    this.students = const [],
    this.error,
  });

  final String classId;
  final String className;

  /// The class's subject (a `Subject` token, e.g. `"Science"`), or null when
  /// the class record has none. Sent as the message draft's `subject`.
  final String? subject;

  final List<HotlineStudent> students;

  /// Why this class's students could not be read, or null when they were.
  final Object? error;

  bool get failed => error != null;

  /// Students with a parent phone on file (the ones a call can reach).
  int get reachableCount => students.where((s) => s.hasParentPhone).length;
}
