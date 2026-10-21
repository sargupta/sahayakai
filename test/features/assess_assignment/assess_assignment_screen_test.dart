import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/assess_assignment/domain/assessment.dart';
import 'package:sahayakai/features/assess_assignment/presentation/assess_assignment_controller.dart';
import 'package:sahayakai/features/assess_assignment/presentation/assess_assignment_screen.dart';
import 'package:sahayakai/features/assess_assignment/presentation/widgets/assess_assignment_error_view.dart';
import 'package:sahayakai/features/assess_assignment/presentation/widgets/assess_assignment_result_view.dart';
import 'package:sahayakai/features/assess_assignment/presentation/widgets/assess_assignment_skeleton.dart';
import 'package:sahayakai/shared/media/image_input.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'assess_assignment_fixtures.dart';

/// Screen-layer gates: the required-image validation the endpoint depends on,
/// the mode selector and its score-mode transcript field, the four async
/// states, and the DESIGN_RUBRIC §12 overflow checks. No live API is exercised:
/// the controller is stubbed for the state tests and no test taps Assess with a
/// valid form.
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
      home: const AssessAssignmentScreen(),
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
        find.textContaining("Add a photo of the student's work"),
        findsOneWidget,
      );
    });

    testWidgets('loading shows the scorecard-shaped skeleton', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            assessAssignmentControllerProvider.overrideWith(
              _StubController.loading,
            ),
          ],
        ),
      );
      await tester.pump(); // don't settle: the loading future never completes

      expect(find.byType(AssessAssignmentSkeleton), findsOneWidget);
    });

    testWidgets('data renders the scorecard result', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            assessAssignmentControllerProvider.overrideWith(
              () => _StubController(data: buildAssessment()),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(AssessAssignmentResultView), findsOneWidget);
      expect(find.text('75'), findsOneWidget); // the score
    });

    testWidgets('an error maps to the assess error view', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            assessAssignmentControllerProvider.overrideWith(
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

      expect(find.byType(AssessAssignmentErrorView), findsOneWidget);
      expect(find.textContaining('busy right now'), findsOneWidget);
    });
  });

  group('validation', () {
    testWidgets('an empty form blocks submit on the required image', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Assess'));
      await tester.pumpAndSettle();

      expect(
        find.text("Please add a photo of the student's work."),
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

      await tester.tap(find.text('Assess'));
      await tester.pumpAndSettle();
      expect(
        find.text("Please add a photo of the student's work."),
        findsOneWidget,
      );

      await tester.tap(find.text('Take photo'));
      await tester.pumpAndSettle();

      expect(
        find.text("Please add a photo of the student's work."),
        findsNothing,
      );
      expect(find.text('Remove photo'), findsOneWidget);
    });
  });

  group('mode selector', () {
    testWidgets('offers exactly the three backend modes', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      expect(find.widgetWithText(ChoiceChip, 'Grade'), findsOneWidget);
      expect(find.widgetWithText(ChoiceChip, 'Read only'), findsOneWidget);
      expect(
        find.widgetWithText(ChoiceChip, 'Score a transcript'),
        findsOneWidget,
      );
    });

    testWidgets('the corrected-transcript field appears only in score mode', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      // Hidden by default (full mode).
      expect(find.text('Corrected transcript'), findsNothing);

      final scoreChip = find.widgetWithText(ChoiceChip, 'Score a transcript');
      await tester.ensureVisible(scoreChip);
      await tester.tap(scoreChip);
      await tester.pumpAndSettle();

      // Now revealed.
      expect(find.text('Corrected transcript'), findsOneWidget);

      // Switching back to Read only hides it again.
      final readChip = find.widgetWithText(ChoiceChip, 'Read only');
      await tester.ensureVisible(readChip);
      await tester.tap(readChip);
      await tester.pumpAndSettle();
      expect(find.text('Corrected transcript'), findsNothing);
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

            expect(find.text('Student work photo'), findsOneWidget);
            expect(find.text('Take photo'), findsOneWidget);
            expect(find.text('Assess'), findsOneWidget);
          },
        );
      }
    }
  });
}

/// An assess controller with a fixed outcome, so the screen's four async states
/// render without a live request.
class _StubController extends AssessAssignmentController {
  _StubController({this.data, this.error, this.isLoading = false});

  factory _StubController.loading() => _StubController(isLoading: true);

  final Assessment? data;
  final Object? error;
  final bool isLoading;

  @override
  FutureOr<Assessment?> build() {
    if (isLoading) return Completer<Assessment?>().future;
    if (error != null) throw error!;
    return data;
  }
}
