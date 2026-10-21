import 'package:flutter/foundation.dart';

/// What kind of thing happened. Every member is something the app **observed
/// itself** — a status the server told it, or a 202 the server answered with.
/// Nothing here is inferred, and nothing here is polled for in the background.
///
/// WHAT IS DELIBERATELY ABSENT
///
/// "A parent called back" is the third outcome a teacher would want, and there
/// is no signal for it. `GET /api/attendance/call-summary` projects one
/// outreach the client already started; an inbound call would arrive at
/// `/api/attendance/twiml` on the server and is never surfaced on any read
/// route. Inventing an enum member for it would mean inventing the data behind
/// it, so it is named in the handoff instead of modelled here.
enum TeacherNotificationKind {
  /// A Parent Hotline call reached a terminal status with a conversation
  /// (`CallStatus.completed`, via the controller's summary outcome).
  callCompleted,

  /// A Parent Hotline call ended without connecting (`failed` / `no_answer` /
  /// `busy`), or the poll ran out before a conversation happened.
  callFailed,

  /// A consecutive-absence run at or past [kAbsenceRunThreshold], read off the
  /// server-computed monthly rollup the teacher just opened.
  absenceRun,

  /// `POST /api/ai/exam-paper` answered **202** — the paper is still being
  /// generated server-side and will be saved to the Library.
  examPaperQueued;

  /// The wire token persisted in shared_preferences.
  String get wire => name;

  /// Tolerant decode. Returns null for an unknown token: a row whose kind the
  /// app cannot render must be DROPPED, not defaulted into some other kind —
  /// defaulting would show a teacher a call outcome that never happened.
  static TeacherNotificationKind? fromWire(String? wire) {
    for (final k in TeacherNotificationKind.values) {
      if (k.wire == wire) return k;
    }
    return null;
  }
}

/// The consecutive-absence run that earns a row. Matches the run length the
/// Parent Hotline's `consecutive_absences` reason is raised on, so the update
/// and the action it leads to agree on what "worth acting on" means.
const int kAbsenceRunThreshold = 3;

/// One row on the Network hub's **Updates** tab.
///
/// This is a *local* record, written when the app sees the event and kept on
/// the device. It is not a projection of a server feed: `GET /api/notifications`
/// exists on `origin/main` but carries only social events (FOLLOW, LIKE,
/// CONNECT_REQUEST, NEW_GROUP_POST …) — none of the three things a teacher
/// actually needs here. See the class-level note in
/// `data/notifications_store.dart`.
@immutable
class TeacherNotification {
  const TeacherNotification({
    required this.id,
    required this.kind,
    required this.at,
    required this.label,
    this.className,
    this.classId,
    this.count = 0,
    this.isRead = false,
  });

  /// A STABLE identity for the underlying event, not a random id: the store
  /// dedupes on it, which is what stops one outreach polled twice, or one
  /// month view reopened five times, from stacking five identical rows.
  final String id;

  final TeacherNotificationKind kind;

  /// When the app observed the event.
  final DateTime at;

  /// The name the row's title interpolates: the student for the call and
  /// absence kinds, the subject for [TeacherNotificationKind.examPaperQueued].
  final String label;

  /// The class the absence run belongs to, for the row's body. Null on the
  /// other kinds, whose bodies take no placeholder.
  final String? className;

  /// Deep-link target for [TeacherNotificationKind.absenceRun] (the class whose
  /// month view the row opens). Null elsewhere — the other kinds route to a
  /// fixed destination.
  final String? classId;

  /// Consecutive absent days for [TeacherNotificationKind.absenceRun]; 0 on the
  /// kinds whose title takes no count.
  final int count;

  final bool isRead;

  TeacherNotification markRead() => TeacherNotification(
    id: id,
    kind: kind,
    at: at,
    label: label,
    className: className,
    classId: classId,
    count: count,
    isRead: true,
  );

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'kind': kind.wire,
    'at': at.toIso8601String(),
    'label': label,
    if (className != null) 'className': className,
    if (classId != null) 'classId': classId,
    if (count != 0) 'count': count,
    'read': isRead,
  };

  /// Decodes one persisted row, or null when the row is unusable — an unknown
  /// kind, a missing id, an unparseable timestamp. A single corrupt entry must
  /// cost that entry and nothing else; it must never throw and take the whole
  /// feed (and, through it, the Network hub) down with it.
  static TeacherNotification? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final map = raw.cast<String, dynamic>();
    final id = map['id'];
    final kind = TeacherNotificationKind.fromWire(map['kind'] as String?);
    final at = DateTime.tryParse(map['at'] as String? ?? '');
    if (id is! String || id.isEmpty || kind == null || at == null) return null;
    return TeacherNotification(
      id: id,
      kind: kind,
      at: at,
      label: map['label'] as String? ?? '',
      className: map['className'] as String?,
      classId: map['classId'] as String?,
      count: map['count'] is int ? map['count'] as int : 0,
      isRead: map['read'] == true,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is TeacherNotification &&
      other.id == id &&
      other.kind == kind &&
      other.at == at &&
      other.label == label &&
      other.className == className &&
      other.classId == classId &&
      other.count == count &&
      other.isRead == isRead;

  @override
  int get hashCode =>
      Object.hash(id, kind, at, label, className, classId, count, isRead);
}
