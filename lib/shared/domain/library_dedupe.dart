import 'library_item.dart';

/// How close two saves of the same thing must be to count as one.
const Duration kSavedTwiceWindow = Duration(minutes: 10);

/// Drops the second copy of anything saved twice.
///
/// A lesson plan is stored twice today: the backend saves it when it is
/// generated, and "Save to Library" posts it again under a fresh id (see
/// `LessonPlanRepository`, "HONEST NOTE ON DOUBLE-SAVING"). The two rows look
/// identical, so the teacher sees every plan twice. Until the server upserts,
/// rows of the same type, title, topic and class saved within
/// [kSavedTwiceWindow] of each other are shown once: the first one in [items]
/// (the list is newest first) is kept.
///
/// Items without a date are never merged: there is no way to tell a copy from
/// a second, deliberate save.
List<LibraryItem> withoutSavedTwice(List<LibraryItem> items) {
  final kept = <LibraryItem>[];
  for (final item in items) {
    final created = item.createdAt;
    final isCopy =
        created != null &&
        kept.any((other) {
          final otherCreated = other.createdAt;
          return otherCreated != null &&
              other.type == item.type &&
              other.title.trim() == item.title.trim() &&
              (other.topic ?? '') == (item.topic ?? '') &&
              (other.gradeLevel ?? '') == (item.gradeLevel ?? '') &&
              otherCreated.difference(created).abs() <= kSavedTwiceWindow;
        });
    if (!isCopy) kept.add(item);
  }
  return kept;
}
