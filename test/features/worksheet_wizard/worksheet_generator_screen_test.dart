import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/worksheet_wizard/domain/worksheet.dart';
import 'package:sahayakai/features/worksheet_wizard/presentation/widgets/worksheet_error_view.dart';
import 'package:sahayakai/features/worksheet_wizard/presentation/widgets/worksheet_result_view.dart';
import 'package:sahayakai/features/worksheet_wizard/presentation/widgets/worksheet_skeleton.dart';
import 'package:sahayakai/features/worksheet_wizard/presentation/worksheet_controller.dart';
import 'package:sahayakai/features/worksheet_wizard/presentation/worksheet_wizard_screen.dart';
import 'package:sahayakai/shared/media/image_input.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'worksheet_fixtures.dart';

/// Screen-layer gates: the required-image + required-prompt validation the
/// endpoint depends on, the four async states, and the DESIGN_RUBRIC §12
/// overflow checks. No live API is exercised: the controller is stubbed for the
/// state tests and no test taps Generate with a valid form.
Widget _host({
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  ImagePickerService? picker,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: [
      imagePickerServiceProvider.overrideWithValue(
        picker ?? FakeImagePickerService(),
      ),
      ...overrides,
    ],
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
      home: const WorksheetWizardScreen(),
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

      expect(
        find.textContaining('Add a textbook photo and a prompt'),
        findsOneWidget,
      );
    });

    testWidgets('loading shows the worksheet-shaped skeleton', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            worksheetControllerProvider.overrideWith(_StubController.loading),
          ],
        ),
      );
      await tester.pump(); // don't settle: the loading future never completes

      expect(find.byType(WorksheetSkeleton), findsOneWidget);
    });

    testWidgets('data renders the worksheet result', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            worksheetControllerProvider.overrideWith(
              () => _StubController(data: buildWorksheet()),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(WorksheetResultView), findsOneWidget);
      expect(find.textContaining('Counting mangoes'), findsOneWidget);
    });

    testWidgets('an error maps to the worksheet error view', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            worksheetControllerProvider.overrideWith(
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

      expect(find.byType(WorksheetErrorView), findsOneWidget);
      expect(find.textContaining('busy right now'), findsOneWidget);
    });
  });

  group('validation', () {
    testWidgets('an empty form blocks submit on both image and prompt', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Generate'));
      await tester.pumpAndSettle();

      expect(
        find.text('Please add a photo of the textbook page.'),
        findsOneWidget,
      );
      expect(
        find.text('Please describe the worksheet you need.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('picking an image clears the required-image error', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        _host(picker: FakeImagePickerService(result: tinyRaw())),
      );
      await tester.pumpAndSettle();

      // Surface the errors first.
      await tester.tap(find.text('Generate'));
      await tester.pumpAndSettle();
      expect(
        find.text('Please add a photo of the textbook page.'),
        findsOneWidget,
      );

      // Now pick a photo; the image error clears and the preview appears.
      await tester.tap(find.text('Take photo'));
      await tester.pumpAndSettle();

      expect(
        find.text('Please add a photo of the textbook page.'),
        findsNothing,
      );
      expect(find.text('Remove photo'), findsOneWidget);
      // The prompt is still required, so the form is still incomplete.
      expect(
        find.text('Please describe the worksheet you need.'),
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

            expect(find.text('Textbook page photo'), findsOneWidget);
            expect(find.text('What worksheet do you need?'), findsOneWidget);
            expect(find.text('Take photo'), findsOneWidget);
          },
        );
      }
    }
  });
}

/// A worksheet controller with a fixed outcome, so the screen's four async
/// states can be rendered without a live request.
class _StubController extends WorksheetController {
  _StubController({this.data, this.error, this.isLoading = false});

  factory _StubController.loading() => _StubController(isLoading: true);

  final Worksheet? data;
  final Object? error;
  final bool isLoading;

  @override
  FutureOr<Worksheet?> build() {
    if (isLoading) return Completer<Worksheet?>().future;
    if (error != null) throw error!;
    return data;
  }
}
