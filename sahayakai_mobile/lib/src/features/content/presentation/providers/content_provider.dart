import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/content_repository.dart';
import '../../domain/content_models.dart';

/// Fetches the user's content library with optional filtering.
///
/// Usage:
/// ```dart
/// final content = ref.watch(contentListProvider(ContentFilter(type: 'quiz')));
/// ```
final contentListProvider = FutureProvider.autoDispose
    .family<ContentListResponse, ContentFilter>((ref, filter) async {
  final repo = ref.read(contentRepositoryProvider);
  return repo.listContent(
    type: filter.type,
    limit: filter.limit,
    cursor: filter.cursor,
    gradeLevels: filter.gradeLevels,
    subjects: filter.subjects,
  );
});

/// Fetches a single content item by ID.
final contentItemProvider =
    FutureProvider.autoDispose.family<ContentItem, String>((ref, id) async {
  final repo = ref.read(contentRepositoryProvider);
  return repo.getContent(id);
});
