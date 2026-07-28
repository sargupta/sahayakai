import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/platform/link_opener.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/virtual_field_trip/domain/virtual_field_trip.dart';
import 'package:sahayakai/features/virtual_field_trip/presentation/virtual_field_trip_controller.dart';
import 'package:sahayakai/features/virtual_field_trip/presentation/virtual_field_trip_screen.dart';
import 'package:sahayakai/features/virtual_field_trip/presentation/widgets/field_trip_stop_card.dart';
import 'package:sahayakai/features/virtual_field_trip/presentation/widgets/virtual_field_trip_error_view.dart';
import 'package:sahayakai/features/virtual_field_trip/presentation/widgets/virtual_field_trip_pending_view.dart';
import 'package:sahayakai/features/virtual_field_trip/presentation/widgets/virtual_field_trip_result_view.dart';
import 'package:sahayakai/features/virtual_field_trip/presentation/widgets/virtual_field_trip_skeleton.dart';
import 'package:sahayakai/shared/domain/tool_prefill.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';
import 'virtual_field_trip_fixtures.dart';

/// Screen-layer gates: the inputs render, tapping Plan drives the real
/// controller -> repository -> client chain, the render states resolve
/// (loading -> skeleton, data -> the itinerary document, 202 -> the calm pending
/// panel, 401 -> sign-in), tapping "Open in Google Earth" opens the exact stop
/// URL through the faked launcher (never a real URL), and the DESIGN_RUBRIC §12
/// overflow checks pass in light + dark with an Indic probe.
Widget _host({
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  List<Override> overrides = const [],
  ToolPrefill? prefill,
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: VirtualFieldTripScreen(prefill: prefill),
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

      expect(find.textContaining('Enter a topic'), findsOneWidget);
    });

    testWidgets('loading shows the itinerary-shaped skeleton', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            virtualFieldTripControllerProvider
                .overrideWith(_StubController.loading),
          ],
        ),
      );
      await tester.pump(); // don't settle: the loading future never completes

      expect(find.byType(VirtualFieldTripSkeleton), findsOneWidget);
    });

    testWidgets('data renders the itinerary document with numbered stop cards',
        (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            virtualFieldTripControllerProvider.overrideWith(
              () => _StubController(data: FieldTripResult(buildFieldTrip())),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(VirtualFieldTripResultView), findsOneWidget);
      // One card per surviving stop (the nameless junk entry was dropped): 3.
      expect(find.byType(FieldTripStopCard), findsNWidgets(3));
      // The masthead title and a stop name rode along.
      expect(find.textContaining('Great Rivers'), findsOneWidget);
      expect(find.textContaining('The Amazon River Basin'), findsOneWidget);
      // The per-stop fact + reflection sections render.
      expect(find.text('Did you know?'), findsWidgets);
      expect(find.text('Think about this'), findsWidgets);
      // The analogy + explanation section labels render.
      expect(find.text('In our context'), findsWidgets);
      expect(find.text('Why we visit'), findsWidgets);
      // The document footer offers Regenerate + Done.
      expect(find.text('Regenerate'), findsOneWidget);
      expect(find.text('Done'), findsOneWidget);
    });

    testWidgets('the footer Done action clears the result back to the form',
        (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            virtualFieldTripControllerProvider.overrideWith(
              () => _StubController(data: FieldTripResult(buildFieldTrip())),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(VirtualFieldTripResultView), findsOneWidget);

      final done = find.text('Done');
      await tester.ensureVisible(done);
      await tester.pumpAndSettle();
      await tester.tap(done);
      await tester.pumpAndSettle();

      // clear() returned the controller to idle: the itinerary is gone and the
      // empty prompt is back.
      expect(find.byType(VirtualFieldTripResultView), findsNothing);
      expect(find.textContaining('Enter a topic'), findsOneWidget);
    });

    testWidgets('the still-generating 202 renders the calm panel, not an error',
        (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            virtualFieldTripControllerProvider.overrideWith(
              () => _StubController(
                data: const FieldTripStillGenerating(
                  message: 'Your field trip is still generating.',
                ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // The calm pending panel, NOT the red error view.
      expect(find.byType(VirtualFieldTripPendingView), findsOneWidget);
      expect(find.byType(VirtualFieldTripErrorView), findsNothing);
      expect(find.textContaining('My Library'), findsOneWidget);
    });

    testWidgets('a 401 maps to the sign-in recovery copy', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            virtualFieldTripControllerProvider.overrideWith(
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

      expect(find.byType(VirtualFieldTripErrorView), findsOneWidget);
      expect(find.text('Please sign in again to use this tool.'),
          findsOneWidget);
    });
  });

  group('the Google Earth launch seam', () {
    testWidgets('tapping Open in Google Earth opens the exact stop URL',
        (tester) async {
      final opener = FakeLinkOpener();
      await tester.pumpWidget(
        _host(
          overrides: [
            linkOpenerProvider.overrideWithValue(opener),
            virtualFieldTripControllerProvider.overrideWith(
              () => _StubController(data: FieldTripResult(buildFieldTrip())),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // The first stop (Amazon) carries a valid URL and shows the action; tap it.
      // Its label leads the two rendered actions (Amazon, then Sahara).
      final firstOpen = find.text('Open in Google Earth').first;
      await tester.ensureVisible(firstOpen);
      await tester.pumpAndSettle();
      await tester.tap(firstOpen);
      await tester.pumpAndSettle();

      // The tap opened the first stop's URL, and only via the faked launcher —
      // never a real URL / platform channel.
      expect(opener.opened, hasLength(1));
      expect(opener.opened.single.toString(), kAmazonEarthUrl);
    });

    testWidgets('a stop with an unsafe URL shows no launch action',
        (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            virtualFieldTripControllerProvider.overrideWith(
              () => _StubController(data: FieldTripResult(buildFieldTrip())),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // Two of the three stops (Amazon, Sahara) carry valid URLs; the Andes stop
      // carried a javascript: URL, dropped to null, so only two actions render.
      expect(find.text('Open in Google Earth'), findsNWidgets(2));
    });
  });

  group('submission', () {
    testWidgets('tapping Plan drives the controller -> repository -> client',
        (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      final client = FakeApiClient(postResponse: virtualFieldTripJson());
      await tester.pumpWidget(_host(overrides: [apiClientOverride(client)]));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField), 'The Amazon River');
      final submit = find.text('Plan the trip');
      await tester.ensureVisible(submit);
      await tester.pumpAndSettle();
      await tester.tap(submit);
      await tester.pumpAndSettle();

      // The real chain fired exactly one POST to the endpoint with the topic...
      expect(client.posts.single.path, '/api/ai/virtual-field-trip');
      expect((client.posts.single.data! as Map)['topic'], 'The Amazon River');
      // ...and the decoded itinerary rendered.
      expect(find.byType(VirtualFieldTripResultView), findsOneWidget);
      expect(find.byType(FieldTripStopCard), findsWidgets);
    });

    testWidgets('an empty topic blocks submission (required field)',
        (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      final client = FakeApiClient(postResponse: virtualFieldTripJson());
      await tester.pumpWidget(_host(overrides: [apiClientOverride(client)]));
      await tester.pumpAndSettle();

      final submit = find.text('Plan the trip');
      await tester.ensureVisible(submit);
      await tester.pumpAndSettle();
      await tester.tap(submit);
      await tester.pumpAndSettle();

      // No request escaped (the validator blocked it) and the error copy shows.
      expect(client.posts, isEmpty);
      expect(find.text('Please enter a topic for the trip.'), findsOneWidget);
    });
  });

  group('zero-stops result keeps a retry affordance (T2-U11b dead-end fix)', () {
    testWidgets(
        'a zero-stops itinerary shows the empty state AND keeps the sticky Plan '
        'button', (tester) async {
      tester.view.physicalSize = const Size(400, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        _host(
          overrides: [
            virtualFieldTripControllerProvider.overrideWith(
              () => _StubController(
                data: const FieldTripResult(
                  FieldTrip(
                    title: 'A trip with no stops',
                    stops: <FieldTripStop>[],
                    gradeLevel: 'Class 7',
                    subject: 'Geography',
                  ),
                ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // The by-design empty state renders (every stop was dropped)...
      expect(find.byType(VirtualFieldTripResultView), findsOneWidget);
      expect(
        find.text('No stops came back for that. Try a different topic.'),
        findsOneWidget,
      );
      // ...and — the fix — the sticky Plan button survives a stop-less
      // itinerary, so the teacher can try again instead of hitting a dead end.
      expect(find.text('Plan the trip'), findsOneWidget);
      expect(tester.takeException(), isNull);
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

            expect(find.text('Topic or theme'), findsOneWidget);
            expect(find.text('Grade level'), findsOneWidget);
            expect(find.text('Language'), findsOneWidget);
          },
        );
      }
    }

    for (final brightness in Brightness.values) {
      testWidgets(
        'the itinerary does not overflow at 360dp x 1.3 in ${brightness.name} '
        '(Indic probe)',
        (tester) async {
          tester.view.physicalSize = kNarrowPhone;
          tester.view.devicePixelRatio = 1.0;
          addTearDown(tester.view.reset);

          await tester.pumpWidget(
            _host(
              brightness: brightness,
              textScale: 1.3,
              overrides: [
                virtualFieldTripControllerProvider.overrideWith(
                  () => _StubController(data: FieldTripResult(buildFieldTrip())),
                ),
              ],
            ),
          );
          await tester.pumpAndSettle();

          // The fixture title/stops carry Bengali, Tamil and Malayalam probes;
          // the document must lay them out at the narrow, scaled size without
          // overflow.
          expect(tester.takeException(), isNull);
          expect(find.byType(FieldTripStopCard), findsNWidgets(3));
        },
      );
    }

    testWidgets('a long Indic topic does not overflow the field',
        (tester) async {
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

  group('VIDYA prefill (T2-U9 review fix)', () {
    testWidgets('a VIDYA prefill seeds the topic and grade — no subject field',
        (tester) async {
      tester.view.physicalSize = const Size(420, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host(
        prefill: const ToolPrefill(
          topic: 'A trip through the solar system',
          gradeLevel: 'Class 10',
          subject: 'Science', // this screen has no subject field; must be ignored, not crash
          language: 'kn',
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('A trip through the solar system'), findsOneWidget);
      expect(find.text('Class 10'), findsOneWidget);
      // language 'kn' → the Kannada endonym is shown in the language picker.
      expect(find.text('ಕನ್ನಡ'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('an unknown grade is ignored, never crashing the dropdown',
        (tester) async {
      tester.view.physicalSize = const Size(420, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host(
        prefill: const ToolPrefill(
          topic: 'Ancient Rome',
          gradeLevel: 'Grade 99', // not a known grade
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Ancient Rome'), findsOneWidget);
      expect(find.text('Any grade'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('no prefill opens the blank form (existing behaviour unchanged)',
        (tester) async {
      tester.view.physicalSize = const Size(420, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      expect(find.text('A trip through the solar system'), findsNothing);
      expect(find.text('Any grade'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}

/// Injects a fixed async state so the render states can be asserted without a
/// live API. Mirrors the video-storyteller / visual-aid screen-test stubs.
class _StubController extends VirtualFieldTripController {
  _StubController({this.data, this.error, this.isLoading = false});

  factory _StubController.loading() => _StubController(isLoading: true);

  final FieldTripOutcome? data;
  final Object? error;
  final bool isLoading;

  @override
  FutureOr<FieldTripOutcome?> build() {
    if (isLoading) return Completer<FieldTripOutcome?>().future;
    if (error != null) throw error!;
    return data;
  }
}
