import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/instant_answer/presentation/widgets/instant_answer_error_view.dart';
import 'package:sahayakai/shared/widgets/offline_view.dart';

import 'instant_answer_fixtures.dart';

/// Error-layer gates. The headline case is 429 `DAILY_LIMIT_REACHED`: it is a
/// first-class state, distinct from the generic error, and it must NOT offer a
/// retry — the quota resets on a clock, so a retry button would only fail
/// again and read as the app being broken.
void main() {
  group('429 DAILY_LIMIT_REACHED (the first-class limit state)', () {
    testWidgets('shows the daily-limit prompt with NO retry button',
        (tester) async {
      await tester.pumpWidget(
        hostResult(
          InstantAnswerErrorView(
            error: _dailyLimit(),
            onRetry: () => fail('the daily-limit state must not offer a retry'),
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('That is all your questions for today'), findsOneWidget);
      expect(find.textContaining('reset tomorrow'), findsOneWidget);

      // The gate: no retry, however it is spelled.
      expect(find.text('Try again'), findsNothing);
      expect(find.byType(OutlinedButton), findsOneWidget); // pricing only
    });

    testWidgets('points at pricing and opens it externally', (tester) async {
      final opener = FakeLinkOpener();
      await tester.pumpWidget(
        hostResult(
          InstantAnswerErrorView(error: _dailyLimit()),
          linkOpener: opener,
        ),
      );
      await tester.pumpAndSettle();

      final pricing = find.text('See plans and pricing');
      expect(pricing, findsOneWidget);
      await tester.ensureVisible(pricing);
      await tester.pumpAndSettle();
      await tester.tap(pricing);
      await tester.pumpAndSettle();

      expect(opener.opened.single.toString(), 'https://sahayakai.com/pricing');
    });

    testWidgets('is read from the raw body, not just the message field',
        (tester) async {
      // The plan guard returns `{ error: 'DAILY_LIMIT_REACHED', message: ... }`.
      // The client copies `error` into ApiException.message today, but the raw
      // body is the contract; both paths must land on the daily state.
      await tester.pumpWidget(
        hostResult(
          InstantAnswerErrorView(
            error: ApiException(
              ApiErrorKind.rateLimited,
              "You've used all 5 instant answer interactions for today.",
              statusCode: 429,
              raw: _dio(429, const {
                'error': 'DAILY_LIMIT_REACHED',
                'message': 'You have used all 5 for today.',
              }),
            ),
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('That is all your questions for today'), findsOneWidget);
      expect(find.text('Try again'), findsNothing);
    });

    testWidgets('renders at 360dp, textScale 1.3, light and dark',
        (tester) async {
      for (final brightness in Brightness.values) {
        tester.view.physicalSize = kNarrowPhone;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(
          MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
            child: hostResult(
              InstantAnswerErrorView(error: _dailyLimit()),
              brightness: brightness,
              linkOpener: FakeLinkOpener(),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: brightness.name);
      }
    });
  });

  group('429 USAGE_LIMIT_REACHED is a different state', () {
    testWidgets('shows the monthly copy, still with no retry', (tester) async {
      await tester.pumpWidget(
        hostResult(
          InstantAnswerErrorView(
            error: ApiException(
              ApiErrorKind.rateLimited,
              'USAGE_LIMIT_REACHED',
              statusCode: 429,
              raw: _dio(429, const {'error': 'USAGE_LIMIT_REACHED'}),
            ),
            onRetry: () => fail('the usage-limit state must not offer a retry'),
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('You have reached your limit'), findsOneWidget);
      expect(find.textContaining('reset next month'), findsOneWidget);
      expect(find.text('That is all your questions for today'), findsNothing);
      expect(find.text('Try again'), findsNothing);
    });
  });

  group('403 PLAN_UPGRADE_REQUIRED', () {
    testWidgets('shows the upgrade prompt with pricing and no retry',
        (tester) async {
      await tester.pumpWidget(
        hostResult(
          InstantAnswerErrorView(
            error: ApiException(
              ApiErrorKind.forbidden,
              'PLAN_UPGRADE_REQUIRED',
              statusCode: 403,
              raw: _dio(403, const {'error': 'PLAN_UPGRADE_REQUIRED'}),
            ),
            onRetry: () => fail('an upgrade wall must not offer a retry'),
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('A higher plan is needed'), findsOneWidget);
      expect(find.text('See plans and pricing'), findsOneWidget);
      expect(find.text('Try again'), findsNothing);
    });
  });

  group('503 AI_SERVICE_BUSY', () {
    testWidgets('uses retryAfterSeconds from the body and offers a retry',
        (tester) async {
      var retried = false;
      await tester.pumpWidget(
        hostResult(
          InstantAnswerErrorView(
            error: ApiException(
              ApiErrorKind.server,
              'Something went wrong on our side.',
              statusCode: 503,
              raw: _dio(503, const {
                'error': 'AI_SERVICE_BUSY',
                'retryAfterSeconds': 30,
              }),
            ),
            onRetry: () => retried = true,
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('about 30 seconds'), findsOneWidget);
      await tester.tap(find.text('Try again'));
      expect(retried, isTrue);
    });

    testWidgets('falls back to the Retry-After header', (tester) async {
      await tester.pumpWidget(
        hostResult(
          InstantAnswerErrorView(
            error: ApiException(
              ApiErrorKind.server,
              'Something went wrong on our side.',
              statusCode: 503,
              raw: _dio(
                503,
                const {'error': 'AI_SERVICE_BUSY'},
                headers: {
                  'retry-after': ['45'],
                },
              ),
            ),
            onRetry: () {},
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('about 45 seconds'), findsOneWidget);
    });

    testWidgets('a nonsense Retry-After degrades to the plain busy message',
        (tester) async {
      for (final value in <Object>[0, -5, 99999, 'soon']) {
        await tester.pumpWidget(
          hostResult(
            InstantAnswerErrorView(
              error: ApiException(
                ApiErrorKind.server,
                'Something went wrong on our side.',
                statusCode: 503,
                raw: _dio(503, {'retryAfterSeconds': value}),
              ),
              onRetry: () {},
            ),
            linkOpener: FakeLinkOpener(),
          ),
        );
        await tester.pumpAndSettle();

        expect(
          find.text('The assistant is busy right now. Please try again in a moment.'),
          findsOneWidget,
          reason: 'retryAfterSeconds: $value',
        );
      }
    });

    testWidgets('a 500 with no Retry-After still offers a retry',
        (tester) async {
      await tester.pumpWidget(
        hostResult(
          InstantAnswerErrorView(
            error: const ApiException(
              ApiErrorKind.server,
              'Something went wrong on our side.',
              statusCode: 500,
            ),
            onRetry: () {},
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('busy right now'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });
  });

  group('the remaining typed kinds', () {
    testWidgets('401 shows a sign-in prompt with no retry', (tester) async {
      await tester.pumpWidget(
        hostResult(
          InstantAnswerErrorView(
            error: const ApiException(
              ApiErrorKind.unauthorized,
              'Please sign in again.',
              statusCode: 401,
            ),
            onRetry: () => fail('a stale token cannot be retried away'),
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Please sign in again to use this tool.'), findsOneWidget);
      expect(find.text('Try again'), findsNothing);
    });

    testWidgets('400 asks the teacher to rephrase, with a retry',
        (tester) async {
      await tester.pumpWidget(
        hostResult(
          InstantAnswerErrorView(
            error: const ApiException(
              ApiErrorKind.badResponse,
              'Invalid input.',
              statusCode: 400,
            ),
            onRetry: () {},
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('rephrase the question'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('a network failure shows the offline card with a retry',
        (tester) async {
      await tester.pumpWidget(
        hostResult(
          InstantAnswerErrorView(
            error: const ApiException(
              ApiErrorKind.network,
              'No internet connection.',
            ),
            onRetry: () {},
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(OfflineView), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('a timeout offers a retry', (tester) async {
      await tester.pumpWidget(
        hostResult(
          InstantAnswerErrorView(
            error: const ApiException(
              ApiErrorKind.timeout,
              'The request took too long. Please try again.',
            ),
            onRetry: () {},
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('taking longer than expected'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('a non-ApiException degrades to the generic error',
        (tester) async {
      await tester.pumpWidget(
        hostResult(
          InstantAnswerErrorView(
            error: Exception('boom'),
            onRetry: () {},
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Something went wrong. Please try again.'), findsOneWidget);
      // A raw exception string must never reach a teacher.
      expect(find.textContaining('boom'), findsNothing);
    });
  });
}

ApiException _dailyLimit() => ApiException(
      ApiErrorKind.rateLimited,
      // The client copies the body's `error` code into `message` for 429s.
      'DAILY_LIMIT_REACHED',
      statusCode: 429,
      raw: _dio(429, const {'error': 'DAILY_LIMIT_REACHED'}),
    );

DioException _dio(
  int status,
  Map<String, dynamic> body, {
  Map<String, List<String>>? headers,
}) {
  final options = RequestOptions(path: '/api/ai/instant-answer');
  return DioException(
    requestOptions: options,
    type: DioExceptionType.badResponse,
    response: Response<Map<String, dynamic>>(
      requestOptions: options,
      statusCode: status,
      data: body,
      headers: headers == null ? null : Headers.fromMap(headers),
    ),
  );
}
