import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/features/video_storyteller/data/video_storyteller_dtos.dart';
import 'package:sahayakai/features/video_storyteller/domain/video_storyteller.dart';

import 'video_storyteller_fixtures.dart';

/// The wire contract for `POST /api/ai/video-storyteller`, pinned against the
/// backend's `VideoStorytellerInputSchema` and the route's response shape in
/// `src/app/api/ai/video-storyteller/route.ts` — `categories`,
/// `personalizedMessage`, `categorizedVideos` (a MAP of category ->
/// `YouTubeVideo[]`), `fromCache`, `latencyScore`. Each `YouTubeVideo` is
/// `{ id, title, description, thumbnail, channelTitle, channelId?, publishedAt,
/// duration?, viewCount? }` (`src/lib/youtube.ts`). If the client ever drifts
/// from those field names or the map shape, these fail first.
void main() {
  group('VideoStorytellerRequestDto', () {
    test('serializes every field with the exact names the schema pins', () {
      final json = VideoStorytellerRequestDto.fromDomain(
        VideoStorytellerRequest(
          subject: '  Science  ',
          gradeLevel: 'Class 6',
          topic: 'The water cycle',
          language: AppLocale.kn.aiName,
        ),
      ).toJson();

      expect(json, {
        'subject': 'Science', // trimmed
        'gradeLevel': 'Class 6',
        'topic': 'The water cycle',
        'language': 'Kannada', // AppLocale.aiName, not the code
      });
    });

    test('never sends server-injected fields', () {
      // The route parses `{...json, userId}` with userId taken from the verified
      // token. A client that sent its own would be both wrong and a
      // trust-boundary hole. The web composer sends only these four keys.
      final json = VideoStorytellerRequestDto.fromDomain(
        const VideoStorytellerRequest(subject: 'Science'),
      ).toJson();

      for (final field in ['userId', 'user_id', 'state', 'educationBoard']) {
        expect(
          json.containsKey(field),
          isFalse,
          reason: '$field is server-injected/derived and must never be sent',
        );
      }
    });

    test('omits blank fields instead of sending explicit nulls', () {
      // Every input is optional; the endpoint back-fills from the profile for
      // absent keys, so an explicit null is a different (and wrong) request.
      final json = VideoStorytellerRequestDto.fromDomain(
        const VideoStorytellerRequest(subject: '   ', topic: 'Fractions'),
      ).toJson();

      expect(json, {'topic': 'Fractions'});
    });

    test('an entirely blank browse serializes to an empty body', () {
      // The web composer's initial request carries only language; a truly blank
      // form is still a valid browse (the server curates from the profile).
      final json = VideoStorytellerRequestDto.fromDomain(
        const VideoStorytellerRequest(),
      ).toJson();
      expect(json, isEmpty);
    });
  });

  group('VideoStorytellerResponseDto — the categorizedVideos map', () {
    test('decodes each bucket key to a VideoCategory with its videos', () {
      final recs =
          VideoStorytellerResponseDto.fromJson(videoStorytellerJson()).toDomain();

      // Every non-empty bucket decoded, keyed by the enum.
      expect(recs.categorizedVideos.keys, containsAll(VideoCategory.values));
      expect(recs.hasVideos, isTrue);
      expect(recs.personalizedMessage, contains('Namaste Adhyapak'));
      expect(recs.fromCache, isFalse);
      expect(recs.latencyScore, 1284);
    });

    test('sections come back in the canonical display order', () {
      final recs = buildRecommendations();
      expect(
        recs.sections.map((s) => s.category).toList(),
        const [
          VideoCategory.topRecommended,
          VideoCategory.storytelling,
          VideoCategory.pedagogy,
          VideoCategory.govtUpdates,
          VideoCategory.courses,
        ],
      );
    });

    test('decodes the exact YouTubeVideo fields', () {
      final recs = buildRecommendations();
      final top = recs.categorizedVideos[VideoCategory.topRecommended]!.first;

      expect(top.id, 'vid_top_1');
      expect(top.title, 'The water cycle explained. $kTa');
      expect(top.channelTitle, 'NCERT Official');
      expect(top.duration, '8:24');
    });

    test('builds the external watch URL from the video id', () {
      final recs = buildRecommendations();
      final top = recs.categorizedVideos[VideoCategory.topRecommended]!.first;

      expect(top.watchUrl.toString(),
          'https://www.youtube.com/watch?v=vid_top_1');
      expect(top.watchUrl.scheme, 'https');
    });

    test('drops a video that arrived without an id', () {
      // topRecommended carries a junk entry with an empty id in the fixture; it
      // cannot be opened or thumbnailed, so it must not survive decode.
      final recs = buildRecommendations();
      final top = recs.categorizedVideos[VideoCategory.topRecommended]!;
      expect(top, hasLength(1));
      expect(top.every((v) => v.id.isNotEmpty), isTrue);
    });

    test('resolves the thumbnail URL like the web card', () {
      final recs = buildRecommendations();

      // Provided, good-quality thumbnail is used as-is.
      final top = recs.categorizedVideos[VideoCategory.topRecommended]!.first;
      expect(top.thumbnailUrl, 'https://i.ytimg.com/vi/vid_top_1/mqdefault.jpg');

      // Missing thumbnail → derived mqdefault.
      final story =
          recs.categorizedVideos[VideoCategory.storytelling]!.first;
      expect(
          story.thumbnailUrl, 'https://i.ytimg.com/vi/vid_story_1/mqdefault.jpg');

      // Low-quality hqdefault → swapped to the mqdefault pattern.
      final ped = recs.categorizedVideos[VideoCategory.pedagogy]!.first;
      expect(ped.thumbnailUrl, 'https://i.ytimg.com/vi/vid_ped_1/mqdefault.jpg');
    });

    test('flags official Indian education sources', () {
      final recs = buildRecommendations();
      // NCERT, Ministry of Education, IGNOU are official; a generic channel is not.
      expect(
        recs.categorizedVideos[VideoCategory.topRecommended]!.first
            .isOfficialSource,
        isTrue,
      );
      expect(
        recs.categorizedVideos[VideoCategory.pedagogy]!.first.isOfficialSource,
        isTrue,
      );
      expect(
        recs.categorizedVideos[VideoCategory.storytelling]!.first
            .isOfficialSource,
        isFalse,
      );
    });

    test('decodes the categories (search-query) buckets', () {
      // Not user-facing, but part of the wire contract — prove it decodes.
      final dto =
          VideoStorytellerResponseDto.fromJson(videoStorytellerJson());
      expect(dto.categories, isNotNull);
      expect(dto.categories!.pedagogy, ['NEP 2020 pedagogy']);
      expect(dto.categories!.topRecommended, ['best science class 6']);
    });

    test('ignores an unknown bucket key and omits empty buckets', () {
      final recs = VideoStorytellerResponseDto.fromJson(<String, dynamic>{
        'personalizedMessage': 'hi',
        'categorizedVideos': <String, dynamic>{
          'topRecommended': <Map<String, dynamic>>[videoJson('a')],
          'someFutureBucket': <Map<String, dynamic>>[videoJson('b')],
          'courses': <Map<String, dynamic>>[], // empty → omitted
        },
      }).toDomain();

      expect(recs.categorizedVideos.keys, [VideoCategory.topRecommended]);
      expect(recs.categorizedVideos.containsKey(VideoCategory.courses), isFalse);
    });

    test('a fully-empty payload decodes to no-videos, not a crash', () {
      final recs =
          VideoStorytellerResponseDto.fromJson(const <String, dynamic>{})
              .toDomain();
      expect(recs.hasVideos, isFalse);
      expect(recs.personalizedMessage, '');
      expect(recs.fromCache, isFalse);
      expect(recs.latencyScore, 0);
      expect(recs.sections, isEmpty);
    });

    test('a fractional latencyScore decodes without throwing', () {
      final recs = VideoStorytellerResponseDto.fromJson(<String, dynamic>{
        'latencyScore': 1284.7,
        'categorizedVideos': <String, dynamic>{
          'topRecommended': <Map<String, dynamic>>[videoJson('a')],
        },
      }).toDomain();
      expect(recs.latencyScore, 1285);
    });
  });
}
