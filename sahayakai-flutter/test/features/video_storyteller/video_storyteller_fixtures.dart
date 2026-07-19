import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/platform/link_opener.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/video_storyteller/data/video_storyteller_dtos.dart';
import 'package:sahayakai/features/video_storyteller/domain/video_storyteller.dart';

/// Shared fixtures for the video-storyteller suites. Not a `_test.dart` file, so
/// the runner ignores it.

/// The DESIGN_RUBRIC §11 Indic probe strings (Bengali, Tamil, Malayalam). Every
/// prose slot in the fixtures carries one so a clipped matra or a missing wrap
/// shows up as a real overflow, not a silent regression.
const String kBn = 'শিক্ষকদের জন্য কৃত্রিম বুদ্ধিমত্তা সহায়ক ভিডিও';
const String kTa = 'ஆசிரியர்களுக்கான செயற்கை நுண்ணறிவு உதவி வீடியோ';
const String kMl = 'അധ്യാപകർക്കുള്ള നിർമ്മിത ബുദ്ധി സഹായി';

/// A deliberately unbreakable compound word: DESIGN_RUBRIC §8 says long words
/// must wrap, never scroll the body sideways.
const String kLongWord = 'Supercalifragilisticexpialidociousphotosynthesisword';

/// The 360dp phone gate from DESIGN_RUBRIC §12.9.
const Size kNarrowPhone = Size(360, 900);

/// Records what the app tried to open instead of hitting a platform channel, so
/// the video card's tap can be asserted without a real launcher / a real URL.
class FakeLinkOpener implements LinkOpener {
  final List<Uri> opened = <Uri>[];

  @override
  Future<bool> open(Uri url) async {
    opened.add(url);
    return true;
  }
}

/// One `YouTubeVideo` wire object as it appears inside `categorizedVideos`.
/// [thumbnail] null models the server omitting it (the DTO derives the
/// `mqdefault`); pass an `hqdefault` URL to exercise the low-quality fallback.
Map<String, dynamic> videoJson(
  String id, {
  String? title = 'A lesson video',
  String channel = 'Khan Academy India',
  String? thumbnail,
  String? duration,
}) {
  return <String, dynamic>{
    'id': id,
    'title': ?title,
    'description': 'A short description.',
    'thumbnail': ?thumbnail,
    'channelTitle': channel,
    'publishedAt': '2026-03-04T00:00:00Z',
    'duration': ?duration,
  };
}

/// The `POST /api/ai/video-storyteller` 200 body, matching the route's exact
/// shape: `categories` (search-query buckets), `personalizedMessage`,
/// `categorizedVideos` (category -> `YouTubeVideo[]`), `fromCache`,
/// `latencyScore`. Populated across all five buckets, with an official-source
/// video (NCERT), a video that carries a duration, one with a low-quality
/// `hqdefault` thumbnail, one with no thumbnail at all, and — in
/// `topRecommended` — a junk entry with no id that the decode must drop.
Map<String, dynamic> videoStorytellerJson() {
  return <String, dynamic>{
    'categories': <String, dynamic>{
      'pedagogy': <String>['NEP 2020 pedagogy'],
      'storytelling': <String>['water cycle animated'],
      'govtUpdates': <String>['NCERT circular'],
      'courses': <String>['teacher training course'],
      'topRecommended': <String>['best science class 6'],
    },
    'personalizedMessage':
        'Namaste Adhyapak! Here are curated videos for your class. $kBn',
    'categorizedVideos': <String, dynamic>{
      'topRecommended': <Map<String, dynamic>>[
        videoJson(
          'vid_top_1',
          title: 'The water cycle explained. $kTa',
          channel: 'NCERT Official',
          thumbnail: 'https://i.ytimg.com/vi/vid_top_1/mqdefault.jpg',
          duration: '8:24',
        ),
        // A video that arrived with no id — cannot be opened or thumbnailed, so
        // the DTO must drop it rather than render a dead tile.
        videoJson('', title: 'Junk with no id'),
      ],
      'storytelling': <Map<String, dynamic>>[
        videoJson(
          'vid_story_1',
          title: 'A story about photosynthesis. $kMl',
          channel: 'Storyteller Channel',
          // No thumbnail → the DTO derives the mqdefault URL.
        ),
      ],
      'pedagogy': <Map<String, dynamic>>[
        videoJson(
          'vid_ped_1',
          title: 'Active learning methods',
          channel: 'Ministry of Education India',
          // A low-quality hqdefault → the DTO swaps to the mqdefault pattern.
          thumbnail: 'https://i.ytimg.com/vi/vid_ped_1/hqdefault.jpg',
          duration: '12:00',
        ),
      ],
      'govtUpdates': <Map<String, dynamic>>[
        videoJson('vid_gov_1', title: 'Latest circular', channel: 'PIB India'),
      ],
      'courses': <Map<String, dynamic>>[
        videoJson('vid_course_1',
            title: 'Free teacher course', channel: 'IGNOU'),
      ],
    },
    'fromCache': false,
    'latencyScore': 1284,
  };
}

/// A fully-decoded recommendation set, built through the real DTO so the fixture
/// and the production decode path can never drift.
VideoRecommendations buildRecommendations() {
  return VideoStorytellerResponseDto.fromJson(videoStorytellerJson()).toDomain();
}

/// Hosts a result-layer widget in the same shell the real screen uses: a
/// scrolling, page-padded body, so height and wrapping behave as in production.
/// Wrapped in a ProviderScope because the result view reads `linkOpenerProvider`.
Widget hostResult(
  Widget child, {
  Brightness brightness = Brightness.light,
  LinkOpener? linkOpener,
  bool reduceMotion = false,
}) {
  return ProviderScope(
    overrides: [
      if (linkOpener != null) linkOpenerProvider.overrideWithValue(linkOpener),
    ],
    child: MaterialApp(
      theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: SingleChildScrollView(
          padding: AppSpacing.pagePadding,
          child: reduceMotion
              ? Builder(
                  builder: (context) => MediaQuery(
                    data: MediaQuery.of(context)
                        .copyWith(disableAnimations: true),
                    child: child,
                  ),
                )
              : child,
        ),
      ),
    ),
  );
}
