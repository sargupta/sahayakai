import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';

final ncertRepositoryProvider = Provider((ref) {
  return NcertRepository(ref.read(apiClientProvider));
});

/// Repository for fetching NCERT chapter data for curriculum alignment.
///
/// Used by exam paper config, lesson plan creator, and quiz config
/// to offer chapter-level topic selection.
class NcertRepository {
  final ApiClient _apiClient;

  NcertRepository(this._apiClient);

  /// Fetch NCERT chapters for a given grade and subject.
  ///
  /// Returns a list of chapter objects with id, number, and title.
  Future<List<NcertChapter>> getChapters({
    required String grade,
    required String subject,
  }) async {
    final response = await _apiClient.client.get(
      '/ncert/chapters',
      queryParameters: {
        'grade': grade,
        'subject': subject,
      },
    );

    if (response.statusCode == 200) {
      final data = response.data;
      final chapters = (data['chapters'] as List<dynamic>?) ?? [];
      return chapters
          .map((c) => NcertChapter.fromJson(c as Map<String, dynamic>))
          .toList();
    }
    throw Exception('Failed to fetch NCERT chapters: ${response.statusCode}');
  }
}

class NcertChapter {
  final String id;
  final int number;
  final String title;
  final String? description;

  const NcertChapter({
    required this.id,
    required this.number,
    required this.title,
    this.description,
  });

  factory NcertChapter.fromJson(Map<String, dynamic> json) => NcertChapter(
        id: json['id'] as String? ?? '',
        number: json['number'] as int? ?? 0,
        title: json['title'] as String? ?? '',
        description: json['description'] as String?,
      );

  @override
  String toString() => 'Ch $number: $title';
}

/// Riverpod provider that fetches chapters for a specific grade+subject combo.
final ncertChaptersProvider = FutureProvider.autoDispose
    .family<List<NcertChapter>, ({String grade, String subject})>(
        (ref, params) async {
  final repo = ref.read(ncertRepositoryProvider);
  return repo.getChapters(grade: params.grade, subject: params.subject);
});
