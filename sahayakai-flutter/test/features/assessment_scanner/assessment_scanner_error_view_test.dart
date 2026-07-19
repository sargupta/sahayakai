import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/platform/link_opener.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/assessment_scanner/presentation/widgets/assessment_scanner_error_view.dart';
import 'package:sahayakai/shared/widgets/error_view.dart';
import 'package:sahayakai/shared/widgets/offline_view.dart';

import 'assessment_scanner_fixtures.dart';

/// Every failed scan maps to the *right* recovery UI — retry, re-upload,
/// upgrade, wait or sign in — not one generic error. Because this is an IMAGE
/// tool, the day-budget 429 is a distinct, no-retry state, and the 422
/// (unreadable / empty extraction) reads as "clearer pages", not a failure.
void main() {
  Future<void> pump(
    WidgetTester tester,
    Object error, {
    VoidCallback? onRetry,
    LinkOpener? linkOpener,
    Brightness brightness = Brightness.light,
    double textScale = 1.0,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          if (linkOpener != null)
            linkOpenerProvider.overrideWithValue(linkOpener),
        ],
        child: MaterialApp(
          theme:
              brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
          home: Scaffold(
            body: SingleChildScrollView(
              child: AssessmentScannerErrorView(error: error, onRetry: onRetry),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  group('the day-budget limit is a distinct, no-retry state', () {
    testWidgets('429 DAILY_LIMIT_REACHED shows the daily prompt, NO retry',
        (tester) async {
      await pump(
        tester,
        _rateLimited('DAILY_LIMIT_REACHED'),
        onRetry: () => fail('the daily-limit state must not offer a retry'),
        linkOpener: FakeLinkOpener(),
      );

      expect(find.text('That is all your answer sheets for today'),
          findsOneWidget);
      expect(find.textContaining('reset tomorrow'), findsOneWidget);
      expect(find.text('Try again'), findsNothing);
      expect(find.byType(OutlinedButton), findsOneWidget); // pricing only
    });

    testWidgets('429 USAGE_LIMIT_REACHED is the DIFFERENT monthly state',
        (tester) async {
      await pump(
        tester,
        _rateLimited('USAGE_LIMIT_REACHED'),
        onRetry: () => fail('the usage-limit state must not offer a retry'),
        linkOpener: FakeLinkOpener(),
      );

      expect(find.text('You have reached your grading limit'), findsOneWidget);
      expect(find.textContaining('reset next month'), findsOneWidget);
      expect(find.text('That is all your answer sheets for today'), findsNothing);
    });

    testWidgets('the pricing action opens the pricing page externally',
        (tester) async {
      final opener = FakeLinkOpener();
      await pump(tester, _rateLimited('USAGE_LIMIT_REACHED'), linkOpener: opener);

      final pricing = find.text('See plans');
      expect(pricing, findsOneWidget);
      await tester.ensureVisible(pricing);
      await tester.tap(pricing);
      await tester.pumpAndSettle();

      expect(opener.opened.single.toString(), 'https://sahayakai.com/pricing');
    });
  });

  group('the other states', () {
    testWidgets('network -> offline card with a retry', (tester) async {
      await pump(tester, const ApiException(ApiErrorKind.network, 'x'),
          onRetry: () {}, linkOpener: FakeLinkOpener());
      expect(find.byType(OfflineView), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('401 -> sign-in message, no retry', (tester) async {
      await pump(
        tester,
        const ApiException(ApiErrorKind.unauthorized, 'x', statusCode: 401),
        onRetry: () {},
        linkOpener: FakeLinkOpener(),
      );
      expect(find.text('Please sign in again to grade an answer sheet.'),
          findsOneWidget);
      expect(find.text('Try again'), findsNothing);
    });

    testWidgets('403 -> upgrade prompt + pricing, no retry', (tester) async {
      await pump(
        tester,
        const ApiException(ApiErrorKind.forbidden, 'PLAN_UPGRADE_REQUIRED',
            statusCode: 403),
        onRetry: () => fail('upgrade must not offer a retry'),
        linkOpener: FakeLinkOpener(),
      );
      expect(find.text('A higher plan is needed'), findsOneWidget);
      expect(find.text('See plans'), findsOneWidget);
      expect(find.text('Try again'), findsNothing);
    });

    testWidgets('503 -> busy with the Retry-After seconds and a retry',
        (tester) async {
      await pump(
        tester,
        ApiException(
          ApiErrorKind.server,
          'busy',
          statusCode: 503,
          raw: _dio(503, const {'retryAfterSeconds': 30}),
        ),
        onRetry: () {},
        linkOpener: FakeLinkOpener(),
      );
      expect(find.textContaining('about 30 seconds'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('400 -> re-upload clearer pages, with a retry', (tester) async {
      await pump(
        tester,
        const ApiException(ApiErrorKind.badResponse, 'x', statusCode: 400),
        onRetry: () {},
        linkOpener: FakeLinkOpener(),
      );
      expect(find.textContaining('clearer pages'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('422 unreadable -> re-upload clearer pages, with a retry',
        (tester) async {
      await pump(
        tester,
        const ApiException(ApiErrorKind.badResponse, 'x', statusCode: 422),
        onRetry: () {},
        linkOpener: FakeLinkOpener(),
      );
      expect(find.textContaining('clearer pages'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('timeout -> timeout message with a retry', (tester) async {
      await pump(tester, const ApiException(ApiErrorKind.timeout, 'x'),
          onRetry: () {}, linkOpener: FakeLinkOpener());
      expect(find.textContaining('taking longer'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('a non-ApiException falls back to the generic error',
        (tester) async {
      await pump(tester, StateError('boom'),
          onRetry: () {}, linkOpener: FakeLinkOpener());
      expect(find.byType(ErrorView), findsOneWidget);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9, §12.10, §12.13)', () {
    for (final brightness in Brightness.values) {
      testWidgets('daily-limit prompt at 360dp x 1.3 in ${brightness.name}',
          (tester) async {
        tester.view.physicalSize = kNarrowPhone;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await pump(
          tester,
          _rateLimited('DAILY_LIMIT_REACHED'),
          linkOpener: FakeLinkOpener(),
          brightness: brightness,
          textScale: 1.3,
        );
        expect(tester.takeException(), isNull, reason: brightness.name);
      });
    }
  });
}

ApiException _rateLimited(String code) => ApiException(
      ApiErrorKind.rateLimited,
      code,
      statusCode: 429,
      raw: _dio(429, {'error': code}),
    );

DioException _dio(int status, Map<String, dynamic> body) {
  final options = RequestOptions(path: '/api/ai/assessment-scanner');
  return DioException(
    requestOptions: options,
    type: DioExceptionType.badResponse,
    response: Response<dynamic>(
      requestOptions: options,
      statusCode: status,
      data: body,
    ),
  );
}
