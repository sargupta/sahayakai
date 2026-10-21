import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/rubric_generator/domain/rubric.dart';
import 'package:sahayakai/features/rubric_generator/presentation/rubric_controller.dart';
import 'package:sahayakai/features/rubric_generator/presentation/rubric_generator_screen.dart';
import 'package:sahayakai/features/rubric_generator/presentation/widgets/rubric_error_view.dart';
import 'package:sahayakai/features/rubric_generator/presentation/widgets/rubric_result_view.dart';
import 'package:sahayakai/features/rubric_generator/presentation/widgets/rubric_skeleton.dart';
import 'package:sahayakai/shared/domain/tool_prefill.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'rubric_fixtures.dart';

/// Screen-layer gates: the required-assignment validation the endpoint depends
/// on, the four async states, the U9 VIDYA prefill, and the DESIGN_RUBRIC §12
/// overflow checks. No live API is exercised: the controller is stubbed for the
/// state tests and no test taps Generate with a valid form.
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
        data: MediaQuery.of(
          context,
        ).copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: RubricGeneratorScreen(prefill: prefill),
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

      expect(find.textContaining('Describe the assignment'), findsOneWidget);
    });

    testWidgets('loading shows the rubric-shaped skeleton', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            rubricControllerProvider.overrideWith(_StubController.loading),
          ],
        ),
      );
      await tester.pump(); // don't settle: the loading future never completes

      expect(find.byType(RubricSkeleton), findsOneWidget);
    });

    testWidgets('data renders the rubric result', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            rubricControllerProvider.overrideWith(
              () => _StubController(data: buildRubric()),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(RubricResultView), findsOneWidget);
      expect(
        find.textContaining('Renewable Energy Project Rubric'),
        findsOneWidget,
      );
    });

    testWidgets('an error maps to the rubric error view', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            rubricControllerProvider.overrideWith(
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

      expect(find.byType(RubricErrorView), findsOneWidget);
      expect(find.textContaining('busy right now'), findsOneWidget);
    });
  });

  group('validation', () {
    testWidgets('an empty assignment blocks submit', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Generate'));
      await tester.pumpAndSettle();

      expect(find.text('Please describe the assignment.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('U9: VIDYA prefill', () {
    testWidgets(
      'a VIDYA prefill seeds the assignment, grade, subject and language',
      (tester) async {
        tester.view.physicalSize = const Size(420, 1600);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(
          _host(
            prefill: const ToolPrefill(
              topic: 'Renewable energy poster',
              gradeLevel: 'Class 10',
              subject: 'Science',
              language: 'kn',
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Renewable energy poster'), findsOneWidget);
        expect(find.text('Class 10'), findsOneWidget);
        expect(find.text('Science'), findsOneWidget);
        // language 'kn' → the Kannada endonym is shown in the language picker.
        expect(find.text('ಕನ್ನಡ'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'an unknown grade/subject is ignored, never crashing a dropdown',
      (tester) async {
        tester.view.physicalSize = const Size(420, 1600);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(
          _host(
            prefill: const ToolPrefill(
              topic: 'Photosynthesis',
              gradeLevel: 'Grade 99', // not a known grade
              subject: 'Astrophysics', // not a known subject
            ),
          ),
        );
        await tester.pumpAndSettle();

        // The assignment still seeds; the unknown grade/subject simply do not
        // apply (the dropdowns fall back to their "Any" placeholder).
        expect(find.text('Photosynthesis'), findsOneWidget);
        expect(find.text('Any grade'), findsOneWidget);
        expect(find.text('Any subject'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'no prefill opens the blank form (existing behaviour unchanged)',
      (tester) async {
        tester.view.physicalSize = const Size(420, 1600);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(_host());
        await tester.pumpAndSettle();

        expect(find.text('Renewable energy poster'), findsNothing);
        expect(find.text('Any grade'), findsOneWidget);
        expect(find.text('Any subject'), findsOneWidget);
      },
    );
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

            expect(find.text('What is the assignment?'), findsOneWidget);
            expect(find.text('Grade level'), findsOneWidget);
          },
        );
      }
    }
  });
}

/// A rubric controller with a fixed outcome, so the screen's four async states
/// can be rendered without a live request.
class _StubController extends RubricController {
  _StubController({this.data, this.error, this.isLoading = false});

  factory _StubController.loading() => _StubController(isLoading: true);

  final Rubric? data;
  final Object? error;
  final bool isLoading;

  @override
  FutureOr<Rubric?> build() {
    if (isLoading) return Completer<Rubric?>().future;
    if (error != null) throw error!;
    return data;
  }
}
