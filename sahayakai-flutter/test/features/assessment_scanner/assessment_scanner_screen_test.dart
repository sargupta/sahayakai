import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/assessment_scanner/domain/assessment_scan.dart';
import 'package:sahayakai/features/assessment_scanner/presentation/assessment_scanner_controller.dart';
import 'package:sahayakai/features/assessment_scanner/presentation/assessment_scanner_screen.dart';
import 'package:sahayakai/features/assessment_scanner/presentation/widgets/assessment_scanner_error_view.dart';
import 'package:sahayakai/features/assessment_scanner/presentation/widgets/assessment_scanner_result_view.dart';
import 'package:sahayakai/features/assessment_scanner/presentation/widgets/assessment_scanner_skeleton.dart';
import 'package:sahayakai/shared/media/image_input.dart';
import 'package:sahayakai/shared/widgets/score_ring.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';
import 'assessment_scanner_fixtures.dart';

/// Screen-layer gates: the multi-page capture over the FAKED image seam (add up
/// to 3, remove, cap enforced), the required subject/grade validation, the four
/// async states, and the DESIGN_RUBRIC §12 overflow checks. No live API is
/// exercised: the controller is stubbed for the state tests, the picker seam is
/// faked, and the one grade that reaches the wire goes through a [FakeApiClient].
Widget _host({
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  Locale locale = const Locale('en'),
  ImagePickerService? picker,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: [
      imagePickerServiceProvider.overrideWithValue(
        picker ?? FakeImagePickerService(result: tinyRaw()),
      ),
      ...overrides,
    ],
    child: MaterialApp(
      theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: const AssessmentScannerScreen(),
    ),
  );
}

Future<void> _addPage(WidgetTester tester) async {
  // Find the camera "add a page" source button by its glyph, so the helper is
  // locale-independent (the label is translated under the Indic probes).
  final take = find.widgetWithIcon(OutlinedButton, LucideIcons.camera);
  await tester.ensureVisible(take);
  await tester.pumpAndSettle();
  await tester.tap(take);
  await tester.pumpAndSettle();
}

Future<void> _pickDropdown(
  WidgetTester tester,
  String placeholder,
  String value,
) async {
  final field = find.text(placeholder);
  await tester.ensureVisible(field);
  await tester.tap(field);
  await tester.pumpAndSettle();
  await tester.tap(find.text(value).last);
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('idle + the page gate', () {
    testWidgets('opens on the empty page-capture prompt, no Grade button yet', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      // v3 11 — the dark scan-framing guide is the empty prompt.
      expect(find.text('Fit the whole sheet inside the frame'), findsOneWidget);
      expect(find.text('Choose a subject'), findsOneWidget);
      expect(find.text('Choose a grade'), findsOneWidget);
      // The Grade button is gated until at least one page is captured.
      expect(find.text('Grade the answer sheet'), findsNothing);
    });

    testWidgets('capturing a page reveals the Grade button', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      await _addPage(tester);

      expect(find.text('Page 1'), findsOneWidget);
      expect(find.text('1 of 3 pages'), findsOneWidget);
      expect(find.text('Grade the answer sheet'), findsOneWidget);
    });
  });

  group('multi-page capture over the faked seam', () {
    testWidgets('adds up to 3 pages, then the cap is enforced', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      await _addPage(tester);
      await _addPage(tester);
      await _addPage(tester);

      expect(find.text('Page 1'), findsOneWidget);
      expect(find.text('Page 2'), findsOneWidget);
      expect(find.text('Page 3'), findsOneWidget);
      expect(find.text('3 of 3 pages'), findsOneWidget);
      expect(find.text('You can add up to 3 pages.'), findsOneWidget);

      // A fourth attempt does nothing — the sources are disabled at the cap.
      await _addPage(tester);
      expect(find.text('Page 4'), findsNothing);
      expect(find.text('3 of 3 pages'), findsOneWidget);
    });

    testWidgets('a page can be removed', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      await _addPage(tester);
      await _addPage(tester);
      expect(find.text('Page 2'), findsOneWidget);

      final remove = find.byTooltip('Remove page 1');
      await tester.ensureVisible(remove);
      await tester.tap(remove);
      await tester.pumpAndSettle();

      // One page left (the list re-labels from 1).
      expect(find.text('Page 2'), findsNothing);
      expect(find.text('1 of 3 pages'), findsOneWidget);
    });
  });

  group('validation + submit', () {
    testWidgets('Grade with no subject chosen blocks and shows the error', (
      tester,
    ) async {
      final client = FakeApiClient(postResponse: scanJson());
      await tester.pumpWidget(_host(overrides: [apiClientOverride(client)]));
      await tester.pumpAndSettle();

      await _addPage(tester);
      await tester.tap(find.text('Grade the answer sheet'));
      await tester.pumpAndSettle();

      expect(find.text('Please choose the subject.'), findsOneWidget);
      expect(client.posts, isEmpty);
    });

    testWidgets('a complete form grades: posts the multi-page body, renders', (
      tester,
    ) async {
      final client = FakeApiClient(postResponse: scanJson());
      await tester.pumpWidget(_host(overrides: [apiClientOverride(client)]));
      await tester.pumpAndSettle();

      await _addPage(tester);
      await _pickDropdown(tester, 'Choose a subject', 'Mathematics');
      await _pickDropdown(tester, 'Choose a grade', 'Class 5');

      await tester.tap(find.text('Grade the answer sheet'));
      await tester.pumpAndSettle();

      // The scorecard rendered from the fixture...
      expect(find.byType(AssessmentScannerResultView), findsOneWidget);
      expect(find.byType(ScoreRing), findsOneWidget);

      // ...and the request carried exactly the captured page as `pageUrls`.
      expect(client.posts.single.path, '/api/ai/assessment-scanner');
      final body = client.posts.single.data! as Map<String, dynamic>;
      expect(body['pageUrls'] as List, hasLength(1));
      expect(body['subject'], 'Mathematics');
      expect(body['gradeLevel'], 'Class 5');
    });
  });

  group('async states', () {
    testWidgets('loading shows the scorecard-shaped skeleton', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            assessmentScannerControllerProvider.overrideWith(
              _StubController.loading,
            ),
          ],
        ),
      );
      await tester.pump(); // don't settle: the loading future never completes

      expect(find.byType(AssessmentScannerSkeleton), findsOneWidget);
    });

    testWidgets('data renders the scorecard result', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            assessmentScannerControllerProvider.overrideWith(
              () => _StubController(data: buildResult()),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(AssessmentScannerResultView), findsOneWidget);
      expect(find.text('58'), findsOneWidget); // the overall score
    });

    testWidgets('a 401 maps to the signed-out error view', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            assessmentScannerControllerProvider.overrideWith(
              () => _StubController(
                error: const ApiException(
                  ApiErrorKind.unauthorized,
                  'x',
                  statusCode: 401,
                ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(AssessmentScannerErrorView), findsOneWidget);
      expect(
        find.text('Please sign in again to grade an answer sheet.'),
        findsOneWidget,
      );
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

            expect(find.text('Answer sheet pages'), findsOneWidget);
          },
        );
      }
    }

    for (final locale in const [Locale('bn'), Locale('ta')]) {
      testWidgets(
        'no overflow at 360dp x 1.3 in ${locale.languageCode} (Indic probe)',
        (tester) async {
          tester.view.physicalSize = kNarrowPhone;
          tester.view.devicePixelRatio = 1.0;
          addTearDown(tester.view.reset);

          await tester.pumpWidget(_host(locale: locale, textScale: 1.3));
          await tester.pumpAndSettle();

          // The chrome renders in the Indic script; add a page so the tile,
          // counter and Grade button all lay out under the scaled Indic glyphs.
          await _addPage(tester);
          expect(tester.takeException(), isNull);
        },
      );
    }
  });
}

/// A scanner controller with a fixed outcome, so the screen's async states
/// render without a live request.
class _StubController extends AssessmentScannerController {
  _StubController({this.data, this.error, this.isLoading = false});

  factory _StubController.loading() => _StubController(isLoading: true);

  final AssessmentResult? data;
  final Object? error;
  final bool isLoading;

  @override
  FutureOr<AssessmentResult?> build() {
    if (isLoading) return Completer<AssessmentResult?>().future;
    if (error != null) throw error!;
    return data;
  }
}
