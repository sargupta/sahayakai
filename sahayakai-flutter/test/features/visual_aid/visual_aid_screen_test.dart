import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/visual_aid/domain/visual_aid.dart';
import 'package:sahayakai/features/visual_aid/presentation/visual_aid_controller.dart';
import 'package:sahayakai/features/visual_aid/presentation/visual_aid_screen.dart';
import 'package:sahayakai/features/visual_aid/presentation/widgets/visual_aid_error_view.dart';
import 'package:sahayakai/features/visual_aid/presentation/widgets/visual_aid_result_view.dart';
import 'package:sahayakai/features/visual_aid/presentation/widgets/visual_aid_skeleton.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';
import 'visual_aid_fixtures.dart';

/// Screen-layer gates: the one validation rule the endpoint depends on (a prompt
/// is required), the full loading -> data/error path (incl. the drawing actually
/// rendering as an Image and the 401 / busy recovery copy), that tapping Create
/// drives the real controller -> repository -> client chain, and the
/// DESIGN_RUBRIC §12 overflow checks in light + dark with an Indic probe.
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
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: const VisualAidScreen(),
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

      expect(find.textContaining('Describe a drawing'), findsOneWidget);
    });

    testWidgets('loading shows the drawing-shaped skeleton', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            visualAidControllerProvider.overrideWith(_StubController.loading),
          ],
        ),
      );
      await tester.pump(); // don't settle: the loading future never completes

      expect(find.byType(VisualAidSkeleton), findsOneWidget);
    });

    testWidgets('data renders the generated drawing as an image', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            visualAidControllerProvider
                .overrideWith(() => _StubController(data: buildVisualAid())),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(VisualAidResultView), findsOneWidget);
      // The drawing itself painted (Image.memory over the decoded PNG), and the
      // teacher-facing guidance rode along.
      expect(find.byType(Image), findsOneWidget);
      expect(find.textContaining('blackboard'), findsOneWidget);
    });

    testWidgets('a 401 maps to the sign-in recovery copy', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            visualAidControllerProvider.overrideWith(
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

      expect(find.byType(VisualAidErrorView), findsOneWidget);
      expect(find.text('Please sign in again to use this tool.'),
          findsOneWidget);
    });

    testWidgets('a 5xx maps to the busy recovery copy + retry', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            visualAidControllerProvider.overrideWith(
              () => _StubController(
                error: const ApiException(
                  ApiErrorKind.server,
                  'x',
                  statusCode: 503,
                ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(VisualAidErrorView), findsOneWidget);
      expect(find.textContaining('busy right now'), findsOneWidget);
    });
  });

  group('validation', () {
    testWidgets('an empty prompt blocks submit', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      final submit = find.text('Create visual aid');
      await tester.ensureVisible(submit);
      await tester.pumpAndSettle();
      await tester.tap(submit);
      await tester.pumpAndSettle();

      expect(find.text('Please describe the drawing you need.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('the prompt field caps at the flow 1000-char limit',
        (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.maxLength, 1000);
    });
  });

  group('submission', () {
    testWidgets('tapping Create drives the controller -> repository -> client',
        (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      final client = FakeApiClient(postResponse: visualAidJson());
      await tester.pumpWidget(_host(overrides: [apiClientOverride(client)]));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byType(TextFormField),
        'Structure of a plant cell',
      );
      final submit = find.text('Create visual aid');
      await tester.ensureVisible(submit);
      await tester.pumpAndSettle();
      await tester.tap(submit);
      await tester.pumpAndSettle();

      // The real chain fired exactly one POST to the endpoint...
      expect(client.posts.single.path, '/api/ai/visual-aid');
      expect((client.posts.single.data! as Map)['prompt'],
          'Structure of a plant cell');
      // ...and the decoded drawing rendered.
      expect(find.byType(VisualAidResultView), findsOneWidget);
      expect(find.byType(Image), findsOneWidget);
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

            expect(find.text('What should the drawing show?'), findsOneWidget);
            expect(find.text('Grade level'), findsOneWidget);
            expect(find.text('Subject'), findsOneWidget);
            expect(find.text('Language'), findsOneWidget);
          },
        );
      }
    }

    testWidgets('a long Indic prompt does not overflow the field',
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
}

/// Injects a fixed async state so the four render states can be asserted without
/// a live API. Mirrors the worksheet/exam-paper screen-test stubs.
class _StubController extends VisualAidController {
  _StubController({this.data, this.error, this.isLoading = false});

  factory _StubController.loading() => _StubController(isLoading: true);

  final VisualAid? data;
  final Object? error;
  final bool isLoading;

  @override
  FutureOr<VisualAid?> build() {
    if (isLoading) return Completer<VisualAid?>().future;
    if (error != null) throw error!;
    return data;
  }
}
