import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/shared/data/ai_report_repository.dart';
import 'package:sahayakai/shared/widgets/ai_report_sheet.dart';

import '../support/fake_api_client.dart';

/// Google Play's AI-generated content policy: a teacher can report offensive
/// AI output to the team from inside the app. These pin what is sent and that
/// a report is only confirmed once the backend really stored it.
void main() {
  group('AiReportRepository', () {
    test('sends a thumbs-down with the reason, note and an excerpt', () async {
      final client = FakeApiClient(
        postResponse: const <String, dynamic>{'success': true, 'id': 'f1'},
      );
      await AiReportRepository(client).report(
        feature: 'vidya',
        page: '/',
        reason: AiReportReason.offensive,
        content: 'x' * 1500,
        note: '  rude words  ',
      );
      final sent = client.posts.single;
      expect(sent.path, '/api/feedback/app');
      final body = sent.data! as Map<String, dynamic>;
      expect(body['rating'], 'thumbs-down');
      expect(body['feature'], 'ai-report:vidya');
      expect(body['comment'], '[offensive_or_harmful] rude words');
      final context = body['context'] as Map<String, dynamic>;
      expect(context['kind'], 'ai_content_report');
      expect(
        (context['excerpt'] as String).length,
        AiReportRepository.excerptMax,
      );
    });

    test('without a note the comment still carries the reason (the route '
        'requires a comment on a thumbs-down)', () async {
      final client = FakeApiClient(
        postResponse: const <String, dynamic>{'success': true},
      );
      await AiReportRepository(client).report(
        feature: 'tool-result',
        page: '/quiz-generator',
        reason: AiReportReason.wrong,
        content: 'answer',
      );
      final body = client.posts.single.data! as Map<String, dynamic>;
      expect(body['comment'], '[wrong_or_misleading]');
    });

    test('a 200 with success:false is a failure, not a stored report', () {
      final client = FakeApiClient(
        postResponse: const <String, dynamic>{'success': false},
      );
      expect(
        AiReportRepository(client).report(
          feature: 'vidya',
          page: '/',
          reason: AiReportReason.other,
          content: 'x',
        ),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('AiReportSheet', () {
    Future<void> pumpSheet(WidgetTester tester, FakeApiClient client) async {
      tester.view.physicalSize = const Size(400, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [apiClientProvider.overrideWithValue(client)],
          child: MaterialApp(
            theme: AppTheme.light(),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: Builder(
                builder: (context) => Center(
                  child: TextButton(
                    onPressed: () => showAiReportSheet(
                      context,
                      content: 'A reply',
                      feature: 'vidya',
                    ),
                    child: const Text('open'),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
    }

    testWidgets('nothing is sent until a reason is picked', (tester) async {
      final client = FakeApiClient(
        postResponse: const <String, dynamic>{'success': true},
      );
      await pumpSheet(tester, client);
      expect(find.text('Report this AI content'), findsOneWidget);
      await tester.tap(find.text('Send report'));
      await tester.pump();
      expect(client.posts, isEmpty);
    });

    testWidgets('a picked reason sends, closes and thanks the teacher', (
      tester,
    ) async {
      final client = FakeApiClient(
        postResponse: const <String, dynamic>{'success': true},
      );
      await pumpSheet(tester, client);
      await tester.tap(find.text('Not suitable for students'));
      await tester.pump();
      await tester.tap(find.text('Send report'));
      await tester.pumpAndSettle();
      expect(client.posts, hasLength(1));
      expect(find.text('Report this AI content'), findsNothing);
      expect(find.text('Thanks. Our team will review this.'), findsOneWidget);
    });

    testWidgets('a failed send keeps the sheet open with an error', (
      tester,
    ) async {
      final client = FakeApiClient(
        postError: const ApiException(ApiErrorKind.network, 'offline'),
      );
      await pumpSheet(tester, client);
      await tester.tap(find.text('Offensive or harmful'));
      await tester.pump();
      await tester.tap(find.text('Send report'));
      await tester.pumpAndSettle();
      expect(find.text('Report this AI content'), findsOneWidget);
      expect(find.text("We couldn't send your report"), findsOneWidget);
    });
  });
}
