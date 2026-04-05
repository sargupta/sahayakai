/// Content types matching the backend ContentType enum.
const contentTypes = [
  'lesson-plan',
  'quiz',
  'worksheet',
  'visual-aid',
  'rubric',
  'virtual-field-trip',
  'instant-answer',
  'teacher-training',
  'exam-paper',
];

/// Human-readable labels for content types.
const contentTypeLabels = {
  'lesson-plan': 'Lesson Plan',
  'quiz': 'Quiz',
  'worksheet': 'Worksheet',
  'visual-aid': 'Visual Aid',
  'rubric': 'Rubric',
  'virtual-field-trip': 'Virtual Field Trip',
  'instant-answer': 'Instant Answer',
  'teacher-training': 'Teacher Training',
  'exam-paper': 'Exam Paper',
};

/// A single content item from the user's library.
class ContentItem {
  final String id;
  final String type;
  final String title;
  final String? gradeLevel;
  final String? subject;
  final String? topic;
  final String? language;
  final bool isPublic;
  final bool isDraft;
  final String? createdAt; // ISO-8601
  final String? updatedAt;
  final String? storagePath;
  final Map<String, dynamic>? data; // Type-specific payload

  const ContentItem({
    required this.id,
    required this.type,
    required this.title,
    this.gradeLevel,
    this.subject,
    this.topic,
    this.language,
    this.isPublic = false,
    this.isDraft = false,
    this.createdAt,
    this.updatedAt,
    this.storagePath,
    this.data,
  });

  factory ContentItem.fromJson(Map<String, dynamic> json) => ContentItem(
        id: json['id'] as String? ?? '',
        type: json['type'] as String? ?? '',
        title: json['title'] as String? ?? '',
        gradeLevel: json['gradeLevel'] as String?,
        subject: json['subject'] as String?,
        topic: json['topic'] as String?,
        language: json['language'] as String?,
        isPublic: json['isPublic'] as bool? ?? false,
        isDraft: json['isDraft'] as bool? ?? false,
        createdAt: json['createdAt'] as String?,
        updatedAt: json['updatedAt'] as String?,
        storagePath: json['storagePath'] as String?,
        data: json['data'] as Map<String, dynamic>?,
      );

  String get typeLabel => contentTypeLabels[type] ?? type;
}

/// Paginated response from GET /content/list.
class ContentListResponse {
  final List<ContentItem> items;
  final int count;
  final String? nextCursor;

  const ContentListResponse({
    required this.items,
    required this.count,
    this.nextCursor,
  });

  factory ContentListResponse.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    return ContentListResponse(
      items: rawItems
          .map((e) => ContentItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      count: json['count'] as int? ?? rawItems.length,
      nextCursor: json['nextCursor'] as String?,
    );
  }
}

/// Filter for content list queries.
class ContentFilter {
  final String? type;
  final int limit;
  final String? cursor;
  final List<String>? gradeLevels;
  final List<String>? subjects;

  const ContentFilter({
    this.type,
    this.limit = 10,
    this.cursor,
    this.gradeLevels,
    this.subjects,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ContentFilter &&
          type == other.type &&
          limit == other.limit &&
          cursor == other.cursor;

  @override
  int get hashCode => Object.hash(type, limit, cursor);
}
