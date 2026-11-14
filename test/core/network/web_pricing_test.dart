import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/network/web_pricing.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/lesson_planner/presentation/widgets/lesson_plan_error_view.dart';

/// Google Play (and the App Store) do not allow an app to send users to
/// another way to pay for digital plans. App builds must show no link to the
/// web pricing page; only the web build keeps it.
void main() {
  test('app builds have no web pricing link by default', () {
    // Tests run as a non-web build with no WEB_PRICING_LINKS define.
    expect(webPricingLinksByDefault, isFalse);
    final container = ProviderContainer();
    addTearDown(container.dispose);
    expect(container.read(webPricingUriProvider), isNull);
  });

  testWidgets('a plan limit in an app build explains it with no pricing link', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(
            body: LessonPlanErrorView(
              error: ApiException(
                ApiErrorKind.rateLimited,
                'LIMIT',
                statusCode: 429,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('You have reached your limit'), findsOneWidget);
    expect(find.text('See plans and pricing'), findsNothing);
    expect(find.byType(OutlinedButton), findsNothing);
  });
}
