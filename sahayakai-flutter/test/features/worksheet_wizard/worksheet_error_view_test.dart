import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/platform/link_opener.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/worksheet_wizard/presentation/widgets/worksheet_error_view.dart';
import 'package:sahayakai/shared/widgets/error_view.dart';
import 'package:sahayakai/shared/widgets/offline_view.dart';

/// Every failed generation maps to the *right* recovery UI — retry, rephrase,
/// upgrade, wait or sign in — not one generic error. Pins the typed
/// [ApiException] -> widget mapping.
///
/// The 39-agent audit caught the 403/429 upgrade wall dead-ending with icon +
/// text and NO way out — an isolated regression unique to Worksheet, since
/// every sibling tool (Quiz, Lesson Plan, Instant Answer, ...) already offers
/// an actionable "See pricing" button on the same states. These tests pin
/// that Worksheet now matches its siblings.
void main() {
  Widget host(Widget child, {LinkOpener? linkOpener}) {
    return ProviderScope(
      overrides: [
        if (linkOpener != null)
          linkOpenerProvider.overrideWithValue(linkOpener),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: SingleChildScrollView(
            padding: AppSpacing.pagePadding,
            child: child,
          ),
        ),
      ),
    );
  }

  testWidgets(
    '403 -> upgrade prompt with an actionable pricing button, no retry',
    (tester) async {
      final opener = _FakeLinkOpener();
      await tester.pumpWidget(
        host(
          WorksheetErrorView(
            error: const ApiException(
              ApiErrorKind.forbidden,
              'PLAN_UPGRADE_REQUIRED',
              statusCode: 403,
            ),
            onRetry: () => fail('an upgrade wall must not offer a retry'),
          ),
          linkOpener: opener,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('A higher plan is needed'), findsOneWidget);
      expect(find.text('Try again'), findsNothing);

      final pricing = find.widgetWithText(
        OutlinedButton,
        'See plans and pricing',
      );
      expect(pricing, findsOneWidget);
      await tester.tap(pricing);
      await tester.pumpAndSettle();
      expect(opener.opened.single.toString(), 'https://sahayakai.com/pricing');
    },
  );

  testWidgets(
    '429 -> limit prompt with an actionable pricing button, no retry',
    (tester) async {
      final opener = _FakeLinkOpener();
      await tester.pumpWidget(
        host(
          WorksheetErrorView(
            error: const ApiException(
              ApiErrorKind.rateLimited,
              'USAGE_LIMIT_REACHED',
              statusCode: 429,
            ),
            onRetry: () => fail('the limit state must not offer a retry'),
          ),
          linkOpener: opener,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('You have reached your limit'), findsOneWidget);
      expect(find.text('Try again'), findsNothing);

      final pricing = find.widgetWithText(
        OutlinedButton,
        'See plans and pricing',
      );
      expect(pricing, findsOneWidget);
      await tester.tap(pricing);
      await tester.pumpAndSettle();
      expect(opener.opened.single.toString(), 'https://sahayakai.com/pricing');
    },
  );

  testWidgets('network -> offline card with a retry', (tester) async {
    await tester.pumpWidget(
      host(
        WorksheetErrorView(
          error: const ApiException(ApiErrorKind.network, 'x'),
          onRetry: () {},
        ),
        linkOpener: _FakeLinkOpener(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(OfflineView), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('401 -> sign-in message, no retry', (tester) async {
    await tester.pumpWidget(
      host(
        WorksheetErrorView(
          error: const ApiException(
            ApiErrorKind.unauthorized,
            'x',
            statusCode: 401,
          ),
          onRetry: () => fail('a stale token cannot be retried away'),
        ),
        linkOpener: _FakeLinkOpener(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Please sign in again to use this tool.'), findsOneWidget);
    expect(find.text('Try again'), findsNothing);
  });

  testWidgets('400 -> rephrase hint with a retry', (tester) async {
    await tester.pumpWidget(
      host(
        WorksheetErrorView(
          error: const ApiException(
            ApiErrorKind.badResponse,
            'x',
            statusCode: 400,
          ),
          onRetry: () {},
        ),
        linkOpener: _FakeLinkOpener(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('clearer photo'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('503 / server -> busy message with a retry', (tester) async {
    await tester.pumpWidget(
      host(
        WorksheetErrorView(
          error: const ApiException(ApiErrorKind.server, 'x', statusCode: 503),
          onRetry: () {},
        ),
        linkOpener: _FakeLinkOpener(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('busy right now'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('timeout -> timeout message with a retry', (tester) async {
    await tester.pumpWidget(
      host(
        WorksheetErrorView(
          error: const ApiException(ApiErrorKind.timeout, 'x'),
          onRetry: () {},
        ),
        linkOpener: _FakeLinkOpener(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('taking longer'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('a non-ApiException falls back to the generic error', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        WorksheetErrorView(error: StateError('boom'), onRetry: () {}),
        linkOpener: _FakeLinkOpener(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(ErrorView), findsOneWidget);
    expect(find.textContaining('our side'), findsNothing);
  });
}

/// Records what the app tried to open instead of hitting a platform channel.
class _FakeLinkOpener implements LinkOpener {
  final List<Uri> opened = <Uri>[];

  @override
  Future<bool> open(Uri url) async {
    opened.add(url);
    return true;
  }
}
