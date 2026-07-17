import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/teacher_training/domain/teacher_advice.dart';
import 'package:sahayakai/features/teacher_training/presentation/teacher_training_controller.dart';
import 'package:sahayakai/features/teacher_training/presentation/teacher_training_screen.dart';
import 'package:sahayakai/features/teacher_training/presentation/widgets/teacher_training_error_view.dart';
import 'package:sahayakai/features/teacher_training/presentation/widgets/teacher_training_result_view.dart';
import 'package:sahayakai/features/teacher_training/presentation/widgets/teacher_training_skeleton.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'teacher_training_fixtures.dart';

/// Screen-layer gates: the required-question validation the endpoint depends on,
/// the four async states, the deliberate absence of a grade field, and the
/// DESIGN_RUBRIC §12 overflow checks. No live API is exercised: the controller
/// is stubbed for the state tests and no test taps the submit button with a
/// valid form (a live call would 401 anyway — auth is still stubbed).
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
      home: const TeacherTrainingScreen(),
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

      expect(find.textContaining('Ask a teaching question'), findsOneWidget);
    });

    testWidgets('loading shows the advice-shaped skeleton', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            teacherTrainingControllerProvider
                .overrideWith(_StubController.loading),
          ],
        ),
      );
      await tester.pump(); // don't settle: the loading future never completes

      expect(find.byType(TeacherTrainingSkeleton), findsOneWidget);
    });

    testWidgets('data renders the advice result', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            teacherTrainingControllerProvider
                .overrideWith(() => _StubController(data: buildAdvice())),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(TeacherTrainingResultView), findsOneWidget);
      expect(find.text('Strategies'), findsOneWidget);
    });

    testWidgets('an error maps to the error view', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            teacherTrainingControllerProvider.overrideWith(
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

      expect(find.byType(TeacherTrainingErrorView), findsOneWidget);
      expect(find.textContaining('busy right now'), findsOneWidget);
    });
  });

  group('form', () {
    testWidgets('offers subject and language but NOT a grade field',
        (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      expect(find.text('Your question'), findsOneWidget);
      expect(find.text('Subject'), findsOneWidget);
      expect(find.text('Language'), findsOneWidget);
      // The endpoint's input schema has no gradeLevel, so the form must not
      // offer one (a pin against re-adding it).
      expect(find.text('Grade level'), findsNothing);
      expect(find.text('Any subject'), findsOneWidget);
      expect(find.text('Optional'), findsOneWidget);
    });

    testWidgets('the question field caps at the endpoint 2000-char limit',
        (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      // TeacherTrainingInputSchema is `question: z.string().max(2000)`; the form
      // stops it here so the teacher never eats a 400 for length.
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.maxLength, kMaxTeacherTrainingQuestionLength);
      expect(field.maxLength, 2000);
    });
  });

  group('validation', () {
    testWidgets('an empty question blocks submit', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      final submit = find.text('Get advice');
      await tester.ensureVisible(submit);
      await tester.pumpAndSettle();
      await tester.tap(submit);
      await tester.pumpAndSettle();

      expect(find.text('Please enter a question.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a whitespace-only question blocks submit', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField), '    ');
      await tester.pumpAndSettle();

      expect(find.text('Please enter a question.'), findsOneWidget);
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

            expect(find.text('Your question'), findsOneWidget);
            expect(find.text('Subject'), findsOneWidget);
            expect(find.text('Language'), findsOneWidget);
          },
        );
      }
    }

    testWidgets('a long Indic question does not overflow the field',
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

/// A controller with a fixed outcome, so the screen's four async states can be
/// rendered without a live request.
class _StubController extends TeacherTrainingController {
  _StubController({this.data, this.error, this.isLoading = false});

  factory _StubController.loading() => _StubController(isLoading: true);

  final TeacherAdvice? data;
  final Object? error;
  final bool isLoading;

  @override
  FutureOr<TeacherAdvice?> build() {
    if (isLoading) return Completer<TeacherAdvice?>().future;
    if (error != null) throw error!;
    return data;
  }
}
