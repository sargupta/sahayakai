import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/exam_paper/domain/exam_paper.dart';
import 'package:sahayakai/features/exam_paper/presentation/exam_paper_controller.dart';
import 'package:sahayakai/features/exam_paper/presentation/exam_paper_screen.dart';
import 'package:sahayakai/features/exam_paper/presentation/widgets/exam_paper_error_view.dart';
import 'package:sahayakai/features/exam_paper/presentation/widgets/exam_paper_in_progress_view.dart';
import 'package:sahayakai/features/exam_paper/presentation/widgets/exam_paper_result_view.dart';
import 'package:sahayakai/features/exam_paper/presentation/widgets/exam_paper_skeleton.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';
import 'exam_paper_fixtures.dart';

/// Screen-layer gates for the highest-risk screen: the async states (incl. the
/// distinct **202** in-progress and **422** fewer-chapters guidance), the
/// chapter add/remove chip flow and its >= 1 requirement, and the DESIGN_RUBRIC
/// §12 overflow checks. No live API: the controller is stubbed for the state
/// tests, a fake client is bound so nothing can escape to the network, and no
/// test taps Generate with a valid+blueprinted-or-chaptered form except through
/// a spy.
Widget _host({
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: [apiClientOverride(FakeApiClient()), ...overrides],
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
      home: const ExamPaperScreen(),
    ),
  );
}

Future<void> _selectDropdown(
  WidgetTester tester,
  Finder field,
  String value,
) async {
  await tester.ensureVisible(field);
  await tester.tap(field);
  await tester.pumpAndSettle();
  await tester.tap(find.text(value).last);
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  final boardField = find.byType(DropdownButtonFormField<String?>).at(0);
  final gradeField = find.byType(DropdownButtonFormField<String?>).at(1);
  final subjectField = find.byType(DropdownButtonFormField<String?>).at(2);

  group('states', () {
    testWidgets('opens in the idle/empty state', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      expect(find.textContaining('Choose a board'), findsOneWidget);
    });

    testWidgets('loading shows the exam-paper-shaped skeleton', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            examPaperControllerProvider.overrideWith(_StubController.loading),
          ],
        ),
      );
      await tester.pump(); // don't settle: the loading future never completes

      expect(find.byType(ExamPaperSkeleton), findsOneWidget);
    });

    testWidgets('data renders the exam-paper result', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            examPaperControllerProvider
                .overrideWith(() => _StubController(data: buildReady())),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(ExamPaperResultView), findsOneWidget);
      expect(find.byType(ExamPaperErrorView), findsNothing);
    });

    testWidgets('a 202 renders the in-progress state, NOT an error', (
      tester,
    ) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            examPaperControllerProvider.overrideWith(
              () => _StubController(
                data: const ExamPaperInProgress(message: 'still generating'),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(ExamPaperInProgressView), findsOneWidget);
      expect(find.byType(ExamPaperErrorView), findsNothing);
      expect(find.textContaining('being prepared'), findsOneWidget);
    });

    testWidgets('a 422 renders the fewer-chapters guidance, NOT generic error', (
      tester,
    ) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            examPaperControllerProvider.overrideWith(
              () => _StubController(
                error: const ApiException(
                  ApiErrorKind.badResponse,
                  'exam_paper_unstructured',
                  statusCode: 422,
                  errorCode: 'exam_paper_unstructured',
                ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(ExamPaperErrorView), findsOneWidget);
      // The distinct guidance copy — proves it is NOT the generic failure.
      expect(
        find.textContaining('could not structure that paper'),
        findsOneWidget,
      );
      expect(find.textContaining('remove a few chapters'), findsOneWidget);
      // And it keeps a retry (unlike the upgrade / limit prompts).
      expect(find.widgetWithText(OutlinedButton, 'Try again'), findsOneWidget);
    });
  });

  group('chapters chip flow', () {
    testWidgets('adds and removes chapter chips', (tester) async {
      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      final textField = find.byType(TextField);
      await tester.ensureVisible(textField);

      // The "done" keyboard action adds the chapter (same path as the + button;
      // the button's own tap is exercised implicitly and avoids the text-field
      // selection overlay swallowing a suffix-icon tap in the harness).
      await tester.enterText(textField, 'Quadratic Equations');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();
      expect(find.widgetWithText(InputChip, 'Quadratic Equations'),
          findsOneWidget);

      await tester.enterText(textField, 'Triangles');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();
      expect(find.widgetWithText(InputChip, 'Triangles'), findsOneWidget);

      // Remove the first chip (Quadratic Equations) via its delete glyph.
      await tester.tap(find.byIcon(LucideIcons.x).first);
      await tester.pumpAndSettle();

      expect(find.widgetWithText(InputChip, 'Quadratic Equations'), findsNothing);
      expect(find.widgetWithText(InputChip, 'Triangles'), findsOneWidget);
    });
  });

  group('the >= 1 chapter requirement (non-blueprinted combos)', () {
    testWidgets('an empty chapter list blocks submit and does not call generate',
        (tester) async {
      final spy = _SpyController();
      await tester.pumpWidget(
        _host(overrides: [examPaperControllerProvider.overrideWith(() => spy)]),
      );
      await tester.pumpAndSettle();

      // CBSE + Nursery + Mathematics is NOT blueprinted (only Class 9/10
      // Maths/Science are), so it requires at least one chapter.
      await _selectDropdown(tester, boardField, 'CBSE');
      await _selectDropdown(tester, gradeField, 'Nursery');
      await _selectDropdown(tester, subjectField, 'Mathematics');

      await tester.tap(find.text('Generate'));
      await tester.pumpAndSettle();

      expect(find.textContaining('at least one chapter'), findsOneWidget);
      expect(spy.calls, 0);
    });

    testWidgets('adding a chapter satisfies the requirement and submits', (
      tester,
    ) async {
      final spy = _SpyController();
      await tester.pumpWidget(
        _host(overrides: [examPaperControllerProvider.overrideWith(() => spy)]),
      );
      await tester.pumpAndSettle();

      await _selectDropdown(tester, boardField, 'CBSE');
      await _selectDropdown(tester, gradeField, 'Nursery');
      await _selectDropdown(tester, subjectField, 'Mathematics');

      final textField = find.byType(TextField);
      await tester.ensureVisible(textField);
      await tester.enterText(textField, 'Counting');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();

      await tester.tap(find.text('Generate'));
      await tester.pumpAndSettle();

      expect(spy.calls, 1);
      expect(spy.last?.chapters, ['Counting']);
      expect(find.textContaining('at least one chapter'), findsNothing);
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

            expect(find.text('Board'), findsOneWidget);
            expect(find.text('Chapters'), findsOneWidget);
          },
        );
      }
    }
  });
}

/// An exam-paper controller with a fixed outcome, so the screen's async states
/// can be rendered without a live request.
class _StubController extends ExamPaperController {
  _StubController({this.data, this.error, this.isLoading = false});

  factory _StubController.loading() => _StubController(isLoading: true);

  final ExamPaperResult? data;
  final Object? error;
  final bool isLoading;

  @override
  FutureOr<ExamPaperResult?> build() {
    if (isLoading) return Completer<ExamPaperResult?>().future;
    if (error != null) throw error!;
    return data;
  }
}

/// Records whether (and with what) generate was called, so the >= 1 chapter
/// requirement can be proven to gate the request.
class _SpyController extends ExamPaperController {
  int calls = 0;
  ExamPaperRequest? last;

  @override
  FutureOr<ExamPaperResult?> build() => null;

  @override
  Future<void> generate(ExamPaperRequest request) async {
    calls++;
    last = request;
  }
}
