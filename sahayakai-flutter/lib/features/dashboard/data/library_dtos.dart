import 'package:json_annotation/json_annotation.dart';

import '../domain/library_item.dart';

part 'library_dtos.g.dart';

/// Decodes one item of `GET /api/content/list`'s `items` array.
///
/// Every field is nullable and every conversion is total. This list is
/// server-authored and OLDER than its own schema: `BaseContentSchema` marks
/// `createdAt` optional and the collection holds documents written before some
/// of these keys existed. A decode that threw on a surprising row would take
/// out the teacher's whole recent list over one bad document, so each field
/// degrades on its own instead.
@JsonSerializable(createToJson: false)
class LibraryItemDto {
  const LibraryItemDto({
    this.id,
    this.type,
    this.title,
    this.gradeLevel,
    this.subject,
    this.topic,
    this.language,
    this.createdAt,
  });

  factory LibraryItemDto.fromJson(Map<String, dynamic> json) =>
      _$LibraryItemDtoFromJson(json);

  final String? id;

  /// One of `ContentTypeSchema`'s 11 wire values. Anything else, including
  /// null, maps to [ContentType.unknown] — see that enum for why an unknown
  /// type is rendered rather than dropped.
  final String? type;

  final String? title;
  final String? gradeLevel;
  final String? subject;
  final String? topic;
  final String? language;

  /// An ISO 8601 string on the wire: the route runs every item through
  /// `dbAdapter.serialize`, which turns Firestore's `{_seconds, _nanoseconds}`
  /// into `new Date(...).toISOString()`. Typed `dynamic` rather than `String?`
  /// because a document that somehow escapes that conversion must not throw a
  /// cast error mid-list; [_parseDate] simply reports null for it.
  final dynamic createdAt;

  LibraryItem toDomain() {
    return LibraryItem(
      id: id?.trim() ?? '',
      type: ContentType.fromWire(type?.trim()),
      title: title?.trim() ?? '',
      gradeLevel: _clean(gradeLevel),
      subject: _clean(subject),
      topic: _clean(topic),
      language: _clean(language),
      createdAt: _parseDate(createdAt),
    );
  }
}

/// Decodes the `GET /api/content/list` envelope: `{ items, count, nextCursor }`.
///
/// `count` is deliberately not modelled. It is `items.length` computed
/// server-side, so keeping it would give the view two sources for one fact and
/// a way for them to disagree; the list's own length is the truth.
@JsonSerializable(createToJson: false)
class LibraryListDto {
  const LibraryListDto({this.items, this.nextCursor});

  factory LibraryListDto.fromJson(Map<String, dynamic> json) =>
      _$LibraryListDtoFromJson(json);

  final List<dynamic>? items;

  /// The id to pass back as `?cursor=` for the next page, or null on the last
  /// page. The route sends an explicit `null` rather than omitting the key.
  /// Unused until P1.7 (the dashboard shows only the newest few), but decoded
  /// so the repository's contract is the endpoint's contract.
  final String? nextCursor;

  List<LibraryItem> toDomain() {
    final raw = items;
    if (raw == null) return const <LibraryItem>[];
    return <LibraryItem>[
      for (final item in raw)
        // A non-object entry is not a content item. Skipping it keeps the rest
        // of the teacher's list on screen.
        if (item is Map<String, dynamic>) LibraryItemDto.fromJson(item).toDomain(),
    ];
  }
}

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

/// Total by design: anything that is not a parseable ISO 8601 string reports
/// null, and the row renders undated rather than vanishing.
DateTime? _parseDate(dynamic value) {
  if (value is! String) return null;
  return DateTime.tryParse(value)?.toLocal();
}
