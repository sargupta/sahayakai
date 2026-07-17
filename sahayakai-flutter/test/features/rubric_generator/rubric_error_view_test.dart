import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/rubric_generator/presentation/widgets/rubric_error_view.dart';
import 'package:sahayakai/shared/widgets/error_view.dart';
import 'package:sahayakai/shared/widgets/offline_view.dart';

/// Every failed generation maps to the *right* recovery UI — retry, rephrase,
/// upgrade, wait or sign in — not one generic error. Pins the typed
/// [ApiException] -> widget mapping.
void main() {
  Future<void> pump(WidgetTester tester, Object error) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: SingleChildScrollView(
            child: RubricErrorView(error: error, onRetry: () {}),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('network -> offline card with a retry', (tester) async {
    await pump(tester, const ApiException(ApiErrorKind.network, 'x'));
    expect(find.byType(OfflineView), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('401 -> sign-in message, no retry', (tester) async {
    await pump(
      tester,
      const ApiException(ApiErrorKind.unauthorized, 'x', statusCode: 401),
    );
    expect(find.text('Please sign in again to use this tool.'), findsOneWidget);
    expect(find.text('Try again'), findsNothing);
  });

  testWidgets('403 -> upgrade prompt, no retry', (tester) async {
    await pump(
      tester,
      const ApiException(ApiErrorKind.forbidden, 'x', statusCode: 403),
    );
    expect(find.text('A higher plan is needed'), findsOneWidget);
    expect(find.textContaining('part of a higher plan'), findsOneWidget);
    expect(find.text('Try again'), findsNothing);
  });

  testWidgets('429 -> limit-reached prompt, no retry', (tester) async {
    await pump(
      tester,
      const ApiException(ApiErrorKind.rateLimited, 'x', statusCode: 429),
    );
    expect(find.text('You have reached your limit'), findsOneWidget);
    expect(find.text('Try again'), findsNothing);
  });

  testWidgets('400 -> rephrase hint with a retry', (tester) async {
    await pump(
      tester,
      const ApiException(ApiErrorKind.badResponse, 'x', statusCode: 400),
    );
    expect(find.textContaining('rephrase the assignment'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('503 / server -> busy message with a retry', (tester) async {
    await pump(
      tester,
      const ApiException(ApiErrorKind.server, 'x', statusCode: 503),
    );
    expect(find.textContaining('busy right now'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('timeout -> timeout message with a retry', (tester) async {
    await pump(tester, const ApiException(ApiErrorKind.timeout, 'x'));
    expect(find.textContaining('taking longer'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('a non-ApiException falls back to the generic error',
      (tester) async {
    await pump(tester, StateError('boom'));
    expect(find.byType(ErrorView), findsOneWidget);
    expect(find.textContaining('our side'), findsNothing);
  });
}
