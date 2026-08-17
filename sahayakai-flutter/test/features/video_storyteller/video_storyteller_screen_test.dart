import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/platform/link_opener.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/video_storyteller/domain/video_storyteller.dart';
import 'package:sahayakai/features/video_storyteller/presentation/video_storyteller_controller.dart';
import 'package:sahayakai/features/video_storyteller/presentation/video_storyteller_screen.dart';
import 'package:sahayakai/features/video_storyteller/presentation/widgets/video_card.dart';
import 'package:sahayakai/features/video_storyteller/presentation/widgets/video_storyteller_error_view.dart';
import 'package:sahayakai/features/video_storyteller/presentation/widgets/video_storyteller_result_view.dart';
import 'package:sahayakai/features/video_storyteller/presentation/widgets/video_storyteller_skeleton.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';
import 'video_storyteller_fixtures.dart';

/// Screen-layer gates: the inputs render, tapping Find drives the real
/// controller -> repository -> client chain, the four render states resolve
/// (loading -> skeleton, data -> video cards with thumbnails, 401 -> sign-in),
/// tapping a card opens its video through the faked launcher (never a real URL),
/// and the DESIGN_RUBRIC §12 overflow checks pass in light + dark with an Indic
/// probe.
///
/// Video cards render `Image.network`. In flutter_test the binding's HTTP client
/// returns a failure for every request, so no socket is ever opened; each
/// thumbnail's `errorBuilder` paints the labelled fallback instead of a red X.
/// The tests assert on the card structure + the `Image` widgets, which prove the
/// thumbnail slot renders without depending on the network.
Widget _host({
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: const VideoStorytellerScreen(),
    ),
  );
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  group('states', () {
    testWidgets('opens in the idle/empty state', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      expect(find.textContaining('Pick a subject or topic'), findsOneWidget);
    });

    testWidgets('loading shows the video-card-shaped skeleton', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            videoStorytellerControllerProvider.overrideWith(
              _StubController.loading,
            ),
          ],
        ),
      );
      await tester.pump(); // don't settle: the loading future never completes

      expect(find.byType(VideoStorytellerSkeleton), findsOneWidget);
    });

    testWidgets('data renders the curated video cards with thumbnails', (
      tester,
    ) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            videoStorytellerControllerProvider.overrideWith(
              () => _StubController(data: buildRecommendations()),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(VideoStorytellerResultView), findsOneWidget);
      // One card per surviving video (the junk no-id entry was dropped): 5.
      expect(find.byType(VideoCard), findsNWidgets(5));
      // Each card carries a thumbnail Image (falls back gracefully in-test).
      expect(find.byType(Image), findsWidgets);
      // A category heading and a video title rode along.
      expect(find.text('Top recommended for you'), findsOneWidget);
      expect(find.textContaining('The water cycle explained'), findsOneWidget);
      // The official-source badge shows on the NCERT video.
      expect(find.text('Official source'), findsWidgets);
    });

    testWidgets(
      'tapping a video card opens its URL through the launcher seam',
      (tester) async {
        final opener = FakeLinkOpener();
        await tester.pumpWidget(
          _host(
            overrides: [
              linkOpenerProvider.overrideWithValue(opener),
              videoStorytellerControllerProvider.overrideWith(
                () => _StubController(data: buildRecommendations()),
              ),
            ],
          ),
        );
        await tester.pumpAndSettle();

        final firstCard = find.byType(VideoCard).first;
        await tester.ensureVisible(firstCard);
        await tester.pumpAndSettle();
        await tester.tap(firstCard);
        await tester.pumpAndSettle();

        // The tap opened the first (top-recommended) video, and only via the
        // faked launcher — never a real URL / platform channel.
        expect(opener.opened, hasLength(1));
        expect(
          opener.opened.single.toString(),
          'https://www.youtube.com/watch?v=vid_top_1',
        );
      },
    );

    testWidgets('a 401 maps to the sign-in recovery copy', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            videoStorytellerControllerProvider.overrideWith(
              () => _StubController(
                error: const ApiException(
                  ApiErrorKind.unauthorized,
                  'Please sign in again.',
                  statusCode: 401,
                ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(VideoStorytellerErrorView), findsOneWidget);
      expect(
        find.text('Please sign in again to use this tool.'),
        findsOneWidget,
      );
    });
  });

  group('submission', () {
    testWidgets('tapping Find drives the controller -> repository -> client', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      final client = FakeApiClient(postResponse: videoStorytellerJson());
      await tester.pumpWidget(_host(overrides: [apiClientOverride(client)]));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField), 'The water cycle');
      final submit = find.text('Find videos');
      await tester.ensureVisible(submit);
      await tester.pumpAndSettle();
      await tester.tap(submit);
      await tester.pumpAndSettle();

      // The real chain fired exactly one POST to the endpoint with the topic...
      expect(client.posts.single.path, '/api/ai/video-storyteller');
      expect((client.posts.single.data! as Map)['topic'], 'The water cycle');
      // ...and the decoded videos rendered.
      expect(find.byType(VideoStorytellerResultView), findsOneWidget);
      expect(find.byType(VideoCard), findsWidgets);
    });
  });

  group('category "View all" expand (T2-U11b 6-cap escape hatch)', () {
    VideoRecommendations recsWith(int count) {
      return VideoRecommendations(
        personalizedMessage: '',
        categorizedVideos: <VideoCategory, List<Video>>{
          VideoCategory.topRecommended: <Video>[
            for (var i = 0; i < count; i++)
              Video(
                id: 'vid_$i',
                title: 'Video number $i',
                channelTitle: 'Channel $i',
                thumbnailUrl: 'https://i.ytimg.com/vi/vid_$i/mqdefault.jpg',
                watchUrl: Uri.parse('https://www.youtube.com/watch?v=vid_$i'),
              ),
          ],
        },
        fromCache: false,
        latencyScore: 0,
      );
    }

    testWidgets(
      'a bucket with more than six videos caps at six then expands to all',
      (tester) async {
        // A tall surface so all cards + the button lay out without scrolling.
        tester.view.physicalSize = const Size(400, 6000);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(
          hostResult(
            VideoStorytellerResultView(recommendations: recsWith(8)),
            linkOpener: FakeLinkOpener(),
          ),
        );
        await tester.pumpAndSettle();

        // Capped at six on first paint, with a "View all 8" escape hatch — the
        // backend sends the full ranked list, so nothing is lost, just deferred.
        expect(find.byType(VideoCard), findsNWidgets(6));
        expect(find.text('View all 8'), findsOneWidget);

        // Tapping it reveals every video the bucket carries.
        await tester.tap(find.text('View all 8'));
        await tester.pumpAndSettle();

        expect(find.byType(VideoCard), findsNWidgets(8));
        expect(find.text('View all 8'), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets('a bucket at the cap shows no expand affordance', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(400, 6000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        hostResult(
          VideoStorytellerResultView(recommendations: recsWith(6)),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(VideoCard), findsNWidgets(6));
      expect(find.textContaining('View all'), findsNothing);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9, §12.10, §12.13)', () {
    for (final brightness in Brightness.values) {
      for (final scale in <double>[1.0, 1.3]) {
        testWidgets(
          'form renders at 360dp, textScale $scale, ${brightness.name}',
          (tester) async {
            tester.view.physicalSize = kNarrowPhone;
            tester.view.devicePixelRatio = 1.0;
            addTearDown(tester.view.reset);

            await tester.pumpWidget(
              _host(brightness: brightness, textScale: scale),
            );
            await tester.pumpAndSettle();
            expect(tester.takeException(), isNull);

            expect(find.text('Topic or chapter'), findsOneWidget);
            expect(find.text('Subject'), findsOneWidget);
            expect(find.text('Grade level'), findsOneWidget);
            expect(find.text('Language'), findsOneWidget);
          },
        );
      }
    }

    testWidgets('the video cards do not overflow at 360dp x 1.3 (Indic probe)', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        _host(
          textScale: 1.3,
          overrides: [
            videoStorytellerControllerProvider.overrideWith(
              () => _StubController(data: buildRecommendations()),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // The fixture titles/message carry Bengali, Tamil and Malayalam probes;
      // the cards must lay them out at the narrow, scaled size without overflow.
      expect(tester.takeException(), isNull);
      expect(find.byType(VideoCard), findsNWidgets(5));
    });

    testWidgets('a long Indic topic does not overflow the field', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host(textScale: 1.3));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byType(TextFormField),
        '$kBn $kTa $kMl $kLongWord',
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}

/// Injects a fixed async state so the render states can be asserted without a
/// live API. Mirrors the visual-aid / worksheet screen-test stubs.
class _StubController extends VideoStorytellerController {
  _StubController({this.data, this.error, this.isLoading = false});

  factory _StubController.loading() => _StubController(isLoading: true);

  final VideoRecommendations? data;
  final Object? error;
  final bool isLoading;

  @override
  FutureOr<VideoRecommendations?> build() {
    if (isLoading) return Completer<VideoRecommendations?>().future;
    if (error != null) throw error!;
    return data;
  }
}
