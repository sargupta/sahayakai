import 'package:json_annotation/json_annotation.dart';

import '../domain/video_storyteller.dart';

part 'video_storyteller_dtos.g.dart';

/// Serializes a [VideoStorytellerRequest] into the exact
/// `POST /api/ai/video-storyteller` body. `includeIfNull: false` drops the
/// fields the teacher left blank so the endpoint applies its own defaults (the
/// flow back-fills subject/grade/language from the profile, then `General` /
/// `Class 5`). The web composer sends exactly these four keys
/// (`subject`, `gradeLevel`, `language`, `topic`).
///
/// `userId` is injected server-side from the verified token and is never sent
/// from the client.
@JsonSerializable(includeIfNull: false, createFactory: false)
class VideoStorytellerRequestDto {
  const VideoStorytellerRequestDto({
    this.subject,
    this.gradeLevel,
    this.topic,
    this.language,
  });

  factory VideoStorytellerRequestDto.fromDomain(VideoStorytellerRequest r) {
    return VideoStorytellerRequestDto(
      subject: _clean(r.subject),
      gradeLevel: _clean(r.gradeLevel),
      topic: _clean(r.topic),
      language: _clean(r.language),
    );
  }

  final String? subject;
  final String? gradeLevel;
  final String? topic;
  final String? language;

  Map<String, dynamic> toJson() => _$VideoStorytellerRequestDtoToJson(this);
}

/// The five search-query buckets the flow returns under `categories`. These are
/// the AI-generated YouTube search strings (not user-facing) — decoded for wire
/// fidelity but not forwarded to the domain, which only renders the resolved
/// `categorizedVideos`.
@JsonSerializable(createToJson: false)
class VideoCategoriesDto {
  const VideoCategoriesDto({
    this.pedagogy,
    this.storytelling,
    this.govtUpdates,
    this.courses,
    this.topRecommended,
  });

  factory VideoCategoriesDto.fromJson(Map<String, dynamic> json) =>
      _$VideoCategoriesDtoFromJson(json);

  final List<String>? pedagogy;
  final List<String>? storytelling;
  final List<String>? govtUpdates;
  final List<String>? courses;
  final List<String>? topRecommended;
}

/// One `YouTubeVideo` object inside `categorizedVideos` (see the exact shape in
/// `src/lib/youtube.ts`: `id`, `title`, `description`, `thumbnail`,
/// `channelTitle`, `channelId?`, `publishedAt`, `duration?`, `viewCount?`). Every
/// field is nullable on decode because the objects come from the YouTube Data
/// API / RSS / a curated fallback and any of them can be sparse; [toDomain]
/// normalizes and drops anything unusable.
@JsonSerializable(createToJson: false)
class VideoDto {
  const VideoDto({
    this.id,
    this.title,
    this.description,
    this.thumbnail,
    this.channelTitle,
    this.channelId,
    this.publishedAt,
    this.duration,
    this.viewCount,
    this.reason,
    this.relevanceReason,
  });

  factory VideoDto.fromJson(Map<String, dynamic> json) =>
      _$VideoDtoFromJson(json);

  final String? id;
  final String? title;
  final String? description;

  /// The server-provided thumbnail URL (`i.ytimg.com/...`). May be absent or a
  /// low-quality `hqdefault`, in which case [toDomain] derives the `mqdefault`.
  final String? thumbnail;
  final String? channelTitle;
  final String? channelId;
  final String? publishedAt;

  /// Duration string when present (the search API omits it; the videos API and
  /// the curated fallback can carry it).
  final String? duration;
  final String? viewCount;

  /// Not part of the current endpoint output (local ranking drops the reason),
  /// but tolerated under either of the two names the ranking schemas have used
  /// (`reason` / `relevanceReason`) so a future build that surfaces it renders
  /// without a DTO change.
  final String? reason;
  final String? relevanceReason;

  /// Normalizes this wire object to a domain [Video], or null when it cannot be
  /// rendered. A video with no id is dropped: without it neither the watch URL
  /// nor the fallback thumbnail can be built, so the card would be a dead,
  /// image-less tile.
  Video? toDomain() {
    final videoId = _clean(id);
    if (videoId == null) return null;

    final watch = _safeWatchUrl(videoId);
    if (watch == null) return null;

    return Video(
      id: videoId,
      title: _clean(title) ?? '',
      channelTitle: _clean(channelTitle) ?? '',
      thumbnailUrl: _resolveThumbnailUrl(videoId, thumbnail),
      watchUrl: watch,
      duration: _clean(duration),
      reason: _clean(reason) ?? _clean(relevanceReason),
    );
  }
}

/// The `/api/ai/video-storyteller` 200 payload. The route responds with exactly
/// these five keys (`categories`, `personalizedMessage`, `categorizedVideos`,
/// `fromCache`, `latencyScore`). `categorizedVideos` is a MAP of category key ->
/// video list (`Record<string, YouTubeVideo[]>`), decoded here as
/// `Map<String, List<VideoDto>>`.
@JsonSerializable(createToJson: false)
class VideoStorytellerResponseDto {
  const VideoStorytellerResponseDto({
    this.categories,
    this.personalizedMessage,
    this.categorizedVideos,
    this.fromCache,
    this.latencyScore,
  });

  factory VideoStorytellerResponseDto.fromJson(Map<String, dynamic> json) =>
      _$VideoStorytellerResponseDtoFromJson(json);

  final VideoCategoriesDto? categories;
  final String? personalizedMessage;

  /// The category -> videos map. The key is a [VideoCategory] wire name; unknown
  /// keys are skipped in [toDomain].
  final Map<String, List<VideoDto>>? categorizedVideos;
  final bool? fromCache;

  /// The endpoint's latency telemetry — an `int` millisecond count on the wire,
  /// typed as `num` so a serialized double never throws on decode.
  final num? latencyScore;

  VideoRecommendations toDomain() {
    final byCategory = <VideoCategory, List<Video>>{};
    final raw = categorizedVideos ?? const <String, List<VideoDto>>{};
    for (final entry in raw.entries) {
      final category = VideoCategory.fromWire(entry.key);
      if (category == null) continue; // ignore buckets this build does not know
      final videos = <Video>[
        for (final dto in entry.value)
          if (dto.toDomain() case final Video video) video,
      ];
      if (videos.isNotEmpty) byCategory[category] = videos;
    }

    return VideoRecommendations(
      personalizedMessage: _clean(personalizedMessage) ?? '',
      categorizedVideos: byCategory,
      fromCache: fromCache ?? false,
      latencyScore: (latencyScore ?? 0).round(),
    );
  }
}

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

/// Resolves the best thumbnail URL for a video, mirroring the web card's
/// `getThumbnailUrl`: prefer the server's own thumbnail unless it is missing, a
/// low-quality `hqdefault`, or not a safe absolute http(s) URL — in which case
/// fall back to the deterministic `mqdefault` pattern, which is valid for any
/// video id. The result is always a renderable https URL, so `Image.network`
/// never receives a `javascript:`/`file:`/relative string.
String _resolveThumbnailUrl(String videoId, String? thumbnail) {
  final provided = _clean(thumbnail);
  if (provided != null && !provided.contains('hqdefault')) {
    final uri = Uri.tryParse(provided);
    if (uri != null &&
        uri.isAbsolute &&
        uri.host.isNotEmpty &&
        (uri.scheme == 'http' || uri.scheme == 'https')) {
      return provided;
    }
  }
  return 'https://i.ytimg.com/vi/$videoId/mqdefault.jpg';
}

/// Builds the external YouTube watch URL for [videoId] and validates it before
/// it can ever reach the launcher. `Uri.https` percent-encodes the id into the
/// query, so a stray id character cannot break out of the URL; the guard is
/// belt-and-braces. Returns null only for the degenerate case of an id that
/// yields no host.
Uri? _safeWatchUrl(String videoId) {
  final uri = Uri.https('www.youtube.com', '/watch', {'v': videoId});
  if (!uri.isAbsolute || uri.host.isEmpty) return null;
  return uri;
}
