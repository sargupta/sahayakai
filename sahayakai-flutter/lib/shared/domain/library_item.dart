import 'package:flutter/widgets.dart';
import 'package:lucide_icons/lucide_icons.dart';

/// One saved generation from the teacher's library, as
/// `GET /api/content/list` returns it.
///
/// Lives in `shared/` because it has two consumers — the dashboard's Recent
/// section and the Library tab — and ARCHITECTURE §7 forbids a feature's
/// presentation from importing another feature's `data`. Shared, not copied.
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
    this.data,
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

  /// The generation itself — `GET /api/content/get`'s `data` field, `z.any()`
  /// server-side. Null from `GET /api/content/list` (the list route never
  /// sends it) and from every deep-link header this app paints before the
  /// per-item read lands; populated only by [LibraryRepository.fetchItem].
  ///
  /// Left as the raw decoded JSON (a `Map<String, dynamic>` for every content
  /// type this app knows how to render, but deliberately untyped here — this
  /// is a `shared/domain` model with no business reshaping it into a tool's
  /// render model, that is `library_result_mapper.dart`'s job). See
  /// `library_detail_screen.dart` for where it is finally read.
  final Object? data;

  /// [data] is deliberately excluded: it is a bulky, server-authored payload
  /// that plays no part in this item's identity, and two decodes of the same
  /// document would otherwise compare unequal (`Map` uses identity equality),
  /// which would make this operator lie for no benefit — the metadata fields
  /// already say whether two items are "the same".
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
/// plus an [unknown] fallback.
///
/// COUNT DEVIATION FROM THE BACKEND'S OWN DOCS (verified, deliberate): the
/// swagger block above `GET /api/content/list` lists EIGHT types and omits
/// `teacher-training`, `exam-paper` and `assessment`. `ContentTypeSchema` — the
/// value the route actually validates and the writer actually stores — has
/// ELEVEN.
///
/// A TWELFTH deviation, also verified directly against the writer rather than
/// the schema (`ContentTypeSchema` does not list it at all):
/// `assessment-scanner.ts`'s own `persist()` helper calls
/// `dbAdapter.saveContent(..., { type: 'assessment-submission', ... })` — a
/// distinct wire value from Assess Assignment's `assessment`
/// (`assignment-assessor.ts`), for a different tool's saved shape. Before this
/// enum carried [assessmentSubmission], every document written with that type
/// silently fell through to [unknown] — not a decode bug, just a genuinely
/// undocumented type this copy hadn't caught up to yet.
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

  /// The Assessment Scanner's saved grade (`assessment-scanner.ts`) — NOT the
  /// same tool or shape as [assessment] (Assess Assignment,
  /// `assignment-assessor.ts`). Same icon family as Assessment Scanner's own
  /// tool tile (`tool_registry.dart`) for visual continuity.
  assessmentSubmission('assessment-submission', LucideIcons.scanLine),

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
