import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/content_creator/presentation/content_creator_screen.dart';
import 'package:sahayakai/features/content_creator/presentation/widgets/content_creator_card.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// U-PD2 — the Content Creator Studio hub.
///
/// The hub is a NO-BACKEND navigation screen: it groups the three multimedia
/// tools and deep-links to each with `context.push`. So the seam under test is
/// navigation, not generation — the tests boot the screen inside a real
/// [GoRouter] whose three tool destinations are lightweight markers, tap each
/// card, and assert the right route was pushed. The registry-count contract (the
/// hub also earns a Prep-desk / Create-palette tile) lives in the shared
/// `create_palette_test.dart`; here we prove the hub screen itself.

/// The narrow phone the overflow gates target (DESIGN_RUBRIC §12).
const Size _kNarrowPhone = Size(360, 900);

/// The three tool destinations, keyed so a push resolves to a findable marker
/// without dragging each tool's provider graph into the hub's test.
class _DestMarker extends StatelessWidget {
  const _DestMarker(this.id);

  final String id;

  @override
  Widget build(BuildContext context) {
    return Scaffold(body: Center(child: Text('DEST', key: Key('dest-$id'))));
  }
}

GoRouter _buildRouter() {
  return GoRouter(
    initialLocation: Routes.contentCreator,
    routes: [
      GoRoute(
        path: Routes.contentCreator,
        builder: (_, _) => const ContentCreatorScreen(),
      ),
      GoRoute(
        path: Routes.visualAid,
        builder: (_, _) => const _DestMarker('visual-aid'),
      ),
      GoRoute(
        path: Routes.virtualFieldTrip,
        builder: (_, _) => const _DestMarker('virtual-field-trip'),
      ),
      GoRoute(
        path: Routes.videoStoryteller,
        builder: (_, _) => const _DestMarker('video-storyteller'),
      ),
    ],
  );
}

Widget _host({
  required GoRouter router,
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  Locale locale = const Locale('en'),
}) {
  return ProviderScope(
    child: MaterialApp.router(
      routerConfig: router,
      theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
    ),
  );
}

/// Taps the hub card carrying [title] and settles the push transition.
Future<void> _tapCard(WidgetTester tester, String title) async {
  final card = find.widgetWithText(ContentCreatorCard, title);
  expect(card, findsOneWidget, reason: 'the "$title" card should render');
  await tester.ensureVisible(card);
  await tester.pumpAndSettle();
  await tester.tap(card);
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    // The theme leans on Google Fonts; never let a test reach for the network.
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('renders', () {
    testWidgets('the studio title, its intro and all three tool cards',
        (tester) async {
      await tester.pumpWidget(_host(router: _buildRouter()));
      await tester.pumpAndSettle();

      // The ToolScaffold app-bar title.
      expect(find.text('Content Creator Studio'), findsOneWidget);
      // The hub intro line (web parity).
      expect(
        find.text(
          'Tools to help you create engaging multimedia content '
          'for your classroom.',
        ),
        findsOneWidget,
      );

      // Exactly the three curated tool cards, in the web order, each carrying
      // its reused registry title.
      expect(find.byType(ContentCreatorCard), findsNWidgets(3));
      expect(find.widgetWithText(ContentCreatorCard, 'Visual Aid'),
          findsOneWidget);
      expect(find.widgetWithText(ContentCreatorCard, 'Virtual Field Trip'),
          findsOneWidget);
      expect(find.widgetWithText(ContentCreatorCard, 'Video Storyteller'),
          findsOneWidget);
    });

    testWidgets('no generation surface: the hub has no submit button',
        (tester) async {
      // The hub is a router, not a tool — it must not sprout a Generate button.
      await tester.pumpWidget(_host(router: _buildRouter()));
      await tester.pumpAndSettle();

      expect(find.byType(FilledButton), findsNothing);
      expect(find.byType(TextField), findsNothing);
    });
  });

  group('navigation (context.push to each live tool route)', () {
    testWidgets('the Visual Aid card deep-links to Routes.visualAid',
        (tester) async {
      await tester.pumpWidget(_host(router: _buildRouter()));
      await tester.pumpAndSettle();

      await _tapCard(tester, 'Visual Aid');

      expect(find.byKey(const Key('dest-visual-aid')), findsOneWidget);
      expect(find.byKey(const Key('dest-virtual-field-trip')), findsNothing);
      expect(find.byKey(const Key('dest-video-storyteller')), findsNothing);
    });

    testWidgets(
        'the Virtual Field Trip card deep-links to Routes.virtualFieldTrip',
        (tester) async {
      await tester.pumpWidget(_host(router: _buildRouter()));
      await tester.pumpAndSettle();

      await _tapCard(tester, 'Virtual Field Trip');

      expect(find.byKey(const Key('dest-virtual-field-trip')), findsOneWidget);
      expect(find.byKey(const Key('dest-visual-aid')), findsNothing);
      expect(find.byKey(const Key('dest-video-storyteller')), findsNothing);
    });

    testWidgets('the Video Storyteller card deep-links to Routes.videoStoryteller',
        (tester) async {
      await tester.pumpWidget(_host(router: _buildRouter()));
      await tester.pumpAndSettle();

      await _tapCard(tester, 'Video Storyteller');

      expect(find.byKey(const Key('dest-video-storyteller')), findsOneWidget);
      expect(find.byKey(const Key('dest-visual-aid')), findsNothing);
      expect(find.byKey(const Key('dest-virtual-field-trip')), findsNothing);
    });
  });

  group('tap targets (DESIGN_RUBRIC §13 — >=48dp)', () {
    testWidgets('every hub card clears the 48dp minimum', (tester) async {
      await tester.pumpWidget(_host(router: _buildRouter()));
      await tester.pumpAndSettle();

      final cards = find.byType(ContentCreatorCard);
      expect(cards, findsNWidgets(3));
      for (var i = 0; i < 3; i++) {
        final size = tester.getSize(cards.at(i));
        // The whole card is the tap target; a 48dp icon well plus 16dp card
        // padding puts it well past the floor, but assert the floor explicitly.
        expect(size.height, greaterThanOrEqualTo(48.0),
            reason: 'card $i height');
        expect(size.width, greaterThanOrEqualTo(48.0), reason: 'card $i width');
      }
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9 / §12.10 / §12.13)', () {
    for (final brightness in Brightness.values) {
      for (final locale in const [Locale('bn'), Locale('ta')]) {
        testWidgets(
          'no overflow at 360dp x textScale 1.3 in ${brightness.name} '
          '(${locale.languageCode} Indic ARB probe)',
          (tester) async {
            tester.view.physicalSize = _kNarrowPhone;
            tester.view.devicePixelRatio = 1.0;
            addTearDown(tester.view.reset);

            await tester.pumpWidget(
              _host(
                router: _buildRouter(),
                brightness: brightness,
                textScale: 1.3,
                locale: locale,
              ),
            );
            await tester.pumpAndSettle();

            // The whole hub chrome — title, intro, section eyebrow — and all
            // three cards render in Bengali / Tamil from the ARB at the narrow,
            // scaled size, with no RenderFlex overflow.
            expect(tester.takeException(), isNull);
            expect(find.byType(ContentCreatorCard), findsNWidgets(3));
          },
        );
      }
    }

    testWidgets('the dark host really is dark', (tester) async {
      await tester.pumpWidget(
        _host(router: _buildRouter(), brightness: Brightness.dark),
      );
      await tester.pumpAndSettle();

      final theme = Theme.of(tester.element(find.byType(ContentCreatorScreen)));
      expect(theme.brightness, Brightness.dark);
    });
  });
}
