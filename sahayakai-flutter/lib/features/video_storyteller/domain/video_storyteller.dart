import 'package:flutter/foundation.dart';

/// Immutable input the teacher assembles on the Video Storyteller form.
///
/// Every field is optional: the web composer's initial request carries only
/// `language`, and the endpoint back-fills `subject`/`gradeLevel` from the
/// teacher's profile (and, failing that, `General` / `Class 5`) — so an
/// otherwise-blank browse still returns curated content. `userId` is injected
/// server-side from the verified token (the flow's `VideoStorytellerInputSchema`
/// parses `{...json, userId}`) and is deliberately NOT modelled here.
@immutable
class VideoStorytellerRequest {
  const VideoStorytellerRequest({
    this.subject,
    this.gradeLevel,
    this.topic,
    this.language,
  });

  /// The academic subject to curate around (e.g. `Science`). Optional.
  final String? subject;

  /// The target class/grade (e.g. `Class 6`). Optional.
  final String? gradeLevel;

  /// A specific chapter or topic within the subject (e.g. `The water cycle`).
  /// Maps to the endpoint's `topic` field (the web calls it `searchQuery`).
  final String? topic;

  /// Full English language name the endpoint expects (e.g. `Kannada`), sourced
  /// from [AppLocale.aiName].
  final String? language;
}

/// The five curation buckets the endpoint returns, in the order the result view
/// renders them. The wire keys match the flow's `categorizedVideos` map keys
/// (`src/ai/flows/video-storyteller.ts`); the display label + glyph are resolved
/// in the presentation layer so the domain stays free of l10n and Flutter icons.
enum VideoCategory {
  topRecommended('topRecommended'),
  storytelling('storytelling'),
  pedagogy('pedagogy'),
  govtUpdates('govtUpdates'),
  courses('courses');

  const VideoCategory(this.wire);

  /// The exact `categorizedVideos` map key the endpoint emits.
  final String wire;

  /// Tolerant parse: an unknown bucket the server adds later reads as null and
  /// is skipped rather than crashing the decode.
  static VideoCategory? fromWire(String wire) {
    for (final c in VideoCategory.values) {
      if (c.wire == wire) return c;
    }
    return null;
  }
}

/// One curated educational video, decoded from a `YouTubeVideo` object inside
/// `categorizedVideos` (`src/lib/youtube.ts`). The DTO layer resolves the
/// thumbnail and the watch URL once, so the card renders without re-deriving
/// them on every rebuild.
@immutable
class Video {
  const Video({
    required this.id,
    required this.title,
    required this.channelTitle,
    required this.thumbnailUrl,
    required this.watchUrl,
    this.duration,
    this.reason,
  });

  /// The YouTube video id. Always non-empty — a video that arrives without one
  /// cannot be opened or thumbnailed, so the DTO drops it.
  final String id;

  /// The video's title. May be empty if the server omitted it; the card falls
  /// back to the channel name.
  final String title;

  /// The channel that published the video (e.g. `NCERT Official`).
  final String channelTitle;

  /// The resolved thumbnail image URL (the server's `thumbnail`, or the derived
  /// `i.ytimg.com/.../mqdefault.jpg` when that is missing/low-quality). Always a
  /// valid absolute http(s) URL, so `Image.network` never receives junk.
  final String thumbnailUrl;

  /// The external YouTube watch URL (`https://www.youtube.com/watch?v=<id>`),
  /// pre-validated so the launcher only ever receives an absolute http(s) URI.
  final Uri watchUrl;

  /// The video's duration string (e.g. `12:04`), when the server provided one.
  final String? duration;

  /// An optional model-authored note on why this video was recommended. Absent
  /// from the current endpoint output (local ranking drops it), but tolerated so
  /// a future ranking that surfaces it renders through [AiText] without a schema
  /// change.
  final String? reason;

  /// True when the channel is a recognised official Indian education source
  /// (NCERT / Ministry of Education / IGNOU / UGC). Mirrors the web card's
  /// `isOfficial` heuristic so the same videos earn the same badge.
  bool get isOfficialSource {
    final channel = channelTitle.toLowerCase();
    return channel.contains('ncert') ||
        channel.contains('ministry') ||
        channel.contains('ignou') ||
        channel.contains('ugc');
  }
}

/// The fully-decoded `/api/ai/video-storyteller` result.
///
/// This is a BROWSE result — curated existing videos, not a generated document.
/// [personalizedMessage] is the model's supportive intro; [categorizedVideos]
/// maps each [VideoCategory] to its ranked videos. [fromCache] and
/// [latencyScore] are the endpoint's telemetry, carried for parity with the wire
/// contract (the view does not surface them).
@immutable
class VideoRecommendations {
  const VideoRecommendations({
    required this.personalizedMessage,
    required this.categorizedVideos,
    required this.fromCache,
    required this.latencyScore,
  });

  /// A brief, supportive message explaining why these videos were chosen.
  final String personalizedMessage;

  /// Ranked videos by bucket. Empty buckets are omitted at decode time, so a key
  /// present here always has at least one video.
  final Map<VideoCategory, List<Video>> categorizedVideos;

  /// Whether the endpoint served this from its semantic cache.
  final bool fromCache;

  /// The endpoint's self-reported curation latency, in milliseconds.
  final int latencyScore;

  /// The non-empty buckets in canonical display order — the sections the result
  /// view walks. Skips any bucket with no videos.
  List<VideoCategorySection> get sections => <VideoCategorySection>[
        for (final category in VideoCategory.values)
          if ((categorizedVideos[category] ?? const <Video>[]).isNotEmpty)
            VideoCategorySection(category, categorizedVideos[category]!),
      ];

  /// False when every bucket came back empty, so the view shows the "no videos"
  /// empty state rather than a bare set of section headers.
  bool get hasVideos =>
      categorizedVideos.values.any((videos) => videos.isNotEmpty);
}

/// A single rendered section: a [category] and its ranked [videos]. A tiny value
/// type instead of a raw record so the view reads by name, not by `.$1/.$2`.
@immutable
class VideoCategorySection {
  const VideoCategorySection(this.category, this.videos);

  final VideoCategory category;
  final List<Video> videos;
}
