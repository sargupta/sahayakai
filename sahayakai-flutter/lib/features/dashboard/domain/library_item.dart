import 'package:flutter/widgets.dart';
import 'package:lucide_icons/lucide_icons.dart';

/// One saved generation from the teacher's library, as
/// `GET /api/content/list` returns it.
///
/// The dashboard shows the most recent few; the full list is P1.7. The model
/// lives here because the dashboard is the first (and today the only) consumer;
/// P1.7 should move it to a shared library feature rather than copy it.
@immutable
class LibraryItem {
  const LibraryItem({
    required this.id,
    required this.type,
    required this.title,
    this.gradeLevel,
    this.subject,
    this.topic,
    this.language,
    this.createdAt,
  });

  /// The document id. Stable, and the cursor value for the next page.
  final String id;

  /// What kind of generation this is. Never null: an unrecognized wire value
  /// becomes [ContentType.unknown] rather than dropping the row.
  final ContentType type;

  /// What the teacher sees. The backend's `BaseContentSchema` requires it, but
  /// documents predate schemas, so an absent title reads as empty and the view
  /// substitutes the type's own label rather than rendering a blank row.
  final String title;

  final String? gradeLevel;
  final String? subject;
  final String? topic;
  final String? language;

  /// Serialized server-side from a Firestore `Timestamp` to an ISO 8601 string
  /// (`dbAdapter.serialize`). Null when the document has no `createdAt` or
  /// carries one this build cannot parse — the row still renders, just undated.
  final DateTime? createdAt;

  @override
  bool operator ==(Object other) =>
      other is LibraryItem &&
      other.id == id &&
      other.type == type &&
      other.title == title &&
      other.gradeLevel == gradeLevel &&
      other.subject == subject &&
      other.topic == topic &&
      other.language == language &&
      other.createdAt == createdAt;

  @override
  int get hashCode => Object.hash(
        id,
        type,
        title,
        gradeLevel,
        subject,
        topic,
        language,
        createdAt,
      );
}

/// The backend's `ContentTypeSchema` (`src/ai/schemas/content-schemas.ts`),
/// verbatim, plus an [unknown] fallback.
///
/// COUNT DEVIATION FROM THE BACKEND'S OWN DOCS (verified, deliberate): the
/// swagger block above `GET /api/content/list` lists EIGHT types and omits
/// `teacher-training`, `exam-paper` and `assessment`. `ContentTypeSchema` — the
/// value the route actually validates and the writer actually stores — has
/// ELEVEN. The Zod enum is the truth here; this is a copy of it.
///
/// [unknown] is not decoration. The library is server-authored and older than
/// this app: a document written by a future tool, or by a build that renamed a
/// type, must still appear in a teacher's recent list. Dropping or throwing on
/// an unrecognized type would silently hide a teacher's own work.
enum ContentType {
  lessonPlan('lesson-plan', LucideIcons.bookOpen),
  quiz('quiz', LucideIcons.clipboardList),
  worksheet('worksheet', LucideIcons.penTool),
  visualAid('visual-aid', LucideIcons.image),
  rubric('rubric', LucideIcons.listChecks),
  microLesson('micro-lesson', LucideIcons.playCircle),
  virtualFieldTrip('virtual-field-trip', LucideIcons.compass),
  instantAnswer('instant-answer', LucideIcons.messageSquare),
  teacherTraining('teacher-training', LucideIcons.graduationCap),
  examPaper('exam-paper', LucideIcons.fileText),
  assessment('assessment', LucideIcons.clipboardCheck),

  /// A type this build has never heard of.
  unknown('', LucideIcons.fileQuestion);

  const ContentType(this.wire, this.icon);

  /// The exact string on the wire.
  final String wire;

  /// The Lucide glyph for this type. Every name here was checked against
  /// lucide_icons 0.257 rather than guessed: the package is a partial port and
  /// the aliases are a trap (`checkCircle` resolves, `circleCheck` does not).
  final IconData icon;

  static ContentType fromWire(String? value) {
    for (final type in ContentType.values) {
      if (type != ContentType.unknown && type.wire == value) return type;
    }
    return ContentType.unknown;
  }
}
