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
import 'package:sahayakai/shared/widgets/empty_view.dart';
import 'package:sahayakai/shared/widgets/primary_button.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'worksheet_fixtures.dart';

/// Screen-layer gates: the required-image + required-prompt validation the
/// endpoint depends on, the four async states, and the DESIGN_RUBRIC §12
/// overflow checks. No live API is exercised: the controller is stubbed for the
/// state tests and no test taps Generate with a valid form. Generate is only
/// enabled once a textbook page is in (the map keeps it off until then).
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
      theme: brightness == Brightness.dark
          ? AppTheme.light()
          : AppTheme.light(),
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

      // Before the first result the result region renders nothing (no idle
      // EmptyView); the form itself carries the guidance: the textbook page
      // is flagged required and Generate stays off until a page is in.
      expect(find.byType(EmptyView), findsNothing);
      expect(find.text('Worksheet Wizard'), findsOneWidget);
      expect(find.text('TEXTBOOK PAGE · REQUIRED'), findsOneWidget);
      expect(find.text('Take a photo or browse'), findsOneWidget);
      expect(_generate(tester).onPressed, isNull);
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
    testWidgets('submit is blocked until a textbook photo is added', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        _host(picker: FakeImagePickerService(result: tinyRaw())),
      );
      await tester.pumpAndSettle();

      // No photo: the page is flagged required and Generate shows disabled
      // (the endpoint cannot run without the page).
      expect(find.text('TEXTBOOK PAGE · REQUIRED'), findsOneWidget);
      expect(_generate(tester).onPressed, isNull);
      // Even with instructions typed, the missing photo still blocks.
      await tester.enterText(
        find.byType(TextFormField).first,
        'Make a multiplication worksheet',
      );
      await tester.pumpAndSettle();
      expect(_generate(tester).onPressed, isNull);

      // A photo arrives: the required flag clears and Generate is enabled.
      await tester.tap(find.text('Take photo'));
      await tester.pumpAndSettle();
      expect(find.text('TEXTBOOK PAGE · REQUIRED'), findsNothing);
      expect(find.text('TEXTBOOK PAGE'), findsOneWidget);
      expect(_generate(tester).onPressed, isNotNull);
      expect(tester.takeException(), isNull);
    });

    testWidgets('with a photo in, an empty prompt still blocks submit', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      final generated = <WorksheetRequest>[];
      await tester.pumpWidget(
        _host(
          picker: FakeImagePickerService(result: tinyRaw()),
          overrides: [
            worksheetControllerProvider.overrideWith(
              () => _RecordingController(generated),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Take photo'));
      await tester.pumpAndSettle();
      // The picked card replaces the empty box.
      expect(find.byTooltip('Remove photo'), findsOneWidget);

      await tester.tap(find.text('Generate worksheet'));
      await tester.pumpAndSettle();

      // The image is in, so its error never shows; the prompt is required.
      expect(
        find.text('Please add a photo of the textbook page.'),
        findsNothing,
      );
      expect(
        find.text('Please describe the worksheet you need.'),
        findsOneWidget,
      );
      expect(generated, isEmpty, reason: 'an empty prompt must not generate');
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

            expect(find.text('TEXTBOOK PAGE · REQUIRED'), findsOneWidget);
            expect(find.text('WORKSHEET INSTRUCTIONS'), findsOneWidget);
            expect(find.text('Take photo'), findsOneWidget);
            expect(find.text('More options'), findsOneWidget);
          },
        );
      }
    }
  });
}

/// The sticky Generate button.
PrimaryButton _generate(WidgetTester tester) => tester.widget<PrimaryButton>(
  find.widgetWithText(PrimaryButton, 'Generate worksheet'),
);

/// Records generate calls without a repository; the screen stays idle.
class _RecordingController extends WorksheetController {
  _RecordingController(this.log);

  final List<WorksheetRequest> log;

  @override
  Future<void> generate(WorksheetRequest request) async => log.add(request);
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
