import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/parent_message/presentation/widgets/parent_message_error_view.dart';
import 'package:sahayakai/shared/widgets/error_view.dart';
import 'package:sahayakai/shared/widgets/offline_view.dart';

/// Every failed request maps to the *right* recovery UI — retry, fill-a-field,
/// upgrade, wait or sign in — not one generic error. Pins the typed
/// [ApiException] -> widget mapping, including the SPECIFIC 400
/// missing-required-field message and the 503 Retry-After branch.
void main() {
  Future<void> pump(WidgetTester tester, Object error) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: SingleChildScrollView(
              child: ParentMessageErrorView(error: error, onRetry: () {}),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  /// A 503 whose body carries a Retry-After hint the view can surface.
  ApiException busyWithRetryAfter(int seconds) {
    final response = Response<dynamic>(
      requestOptions: RequestOptions(path: '/api/ai/parent-message'),
      statusCode: 503,
      data: {'error': 'AI_SERVICE_BUSY', 'retryAfterSeconds': seconds},
    );
    return ApiException(
      ApiErrorKind.server,
      'busy',
      statusCode: 503,
      raw: DioException(
        requestOptions: response.requestOptions,
        response: response,
        type: DioExceptionType.badResponse,
      ),
    );
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

  testWidgets('403 -> upgrade prompt with pricing, no retry', (tester) async {
    await pump(
      tester,
      const ApiException(ApiErrorKind.forbidden, 'x', statusCode: 403),
    );
    expect(find.text('A higher plan is needed'), findsOneWidget);
    expect(find.text('See plans and pricing'), findsOneWidget);
    expect(find.text('Try again'), findsNothing);
  });

  testWidgets('429 -> limit-reached prompt with pricing, no retry',
      (tester) async {
    await pump(
      tester,
      const ApiException(ApiErrorKind.rateLimited, 'x', statusCode: 429),
    );
    expect(find.text('You have reached your limit'), findsOneWidget);
    expect(find.text('See plans and pricing'), findsOneWidget);
    expect(find.text('Try again'), findsNothing);
  });

  testWidgets(
      '400 Missing required fields -> a SPECIFIC fill-these-in message + retry',
      (tester) async {
    // The route returns 400 { error: 'Missing required fields' } when a required
    // field is absent. It must read as a specific instruction, never a generic
    // failure (task requirement).
    await pump(
      tester,
      const ApiException(
        ApiErrorKind.badResponse,
        'Missing required fields',
        statusCode: 400,
      ),
    );
    expect(
      find.textContaining(
        "Please fill in the student, class, subject, reason and parent's language",
      ),
      findsOneWidget,
    );
    // It is NOT the generic error.
    expect(find.text('Something went wrong. Please try again.'), findsNothing);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('503 with no Retry-After -> generic busy message + retry',
      (tester) async {
    await pump(
      tester,
      const ApiException(ApiErrorKind.server, 'x', statusCode: 503),
    );
    expect(find.textContaining('busy right now'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('503 WITH Retry-After -> a timed busy message', (tester) async {
    await pump(tester, busyWithRetryAfter(30));
    expect(find.textContaining('about 30 seconds'), findsOneWidget);
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
    expect(find.textContaining('boom'), findsNothing);
  });
}
