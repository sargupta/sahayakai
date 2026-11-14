import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/auth/auth_providers.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/inbox/domain/conversation_id.dart';
import 'package:sahayakai/features/inbox/domain/inbox_models.dart';
import 'package:sahayakai/features/inbox/presentation/visible_conversations.dart';
import 'package:sahayakai/features/moderation/data/moderation_repository.dart';
import 'package:sahayakai/features/moderation/domain/moderation.dart';
import 'package:sahayakai/features/moderation/presentation/blocked_teachers_controller.dart';
import 'package:sahayakai/features/moderation/presentation/blocked_teachers_screen.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_providers.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_transport.dart';
import 'package:sahayakai/features/staffroom/domain/group.dart';
import 'package:sahayakai/features/staffroom/presentation/widgets/feed_post_card.dart';

import '../../support/fake_api_client.dart';
import '../../support/fake_block_c_transports.dart';

/// Report and block for community content (Google Play's user-generated
/// content policy).
const _me = 'u-me';

GroupPost _post({String author = 'u-sr'}) => GroupPost(
  id: 'p1',
  groupId: 'g1',
  authorUid: author,
  authorName: 'Suresh Reddy',
  content: 'Taught fractions by cutting chapatis.',
  postType: PostType.share,
  likesCount: 4,
  commentsCount: 0,
  createdAt: '2026-11-04T09:00:00Z',
);

Map<String, dynamic> _body(Object? data) => data! as Map<String, dynamic>;

Future<FakeApiClient> _pumpCard(
  WidgetTester tester,
  GroupPost post, {
  FakeApiClient? api,
}) async {
  final client =
      api ??
      FakeApiClient(
        postResponse: const <String, dynamic>{'ok': true},
        getResponse: const <String, dynamic>{'blocks': <Object>[]},
      );
  final fake = FakeStaffroomTransport();
  addTearDown(fake.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(client),
        isSignedInProvider.overrideWithValue(true),
        staffroomTransportProvider.overrideWithValue(fake),
        currentStaffroomUserIdProvider.overrideWithValue(_me),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: FeedPostCard(post: post)),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return client;
}

Conversation _dm(String other) => Conversation(
  id: ConversationId.direct(_me, other),
  type: ConversationType.direct,
  participantIds: [_me, other],
  participants: const {},
  lastMessage: '',
  lastMessageSenderId: other,
  unreadCount: const {},
);

void main() {
  group('ModerationRepository', () {
    test('report posts the target, reason and a trimmed note', () async {
      final api = FakeApiClient(postResponse: const <String, dynamic>{});
      await ModerationRepository(api).report(
        target: ReportTarget.message,
        targetId: 'm1',
        reason: ReportReason.harassment,
        details: '  rude  ',
      );
      expect(api.posts.single.path, '/api/moderation/report');
      expect(_body(api.posts.single.data), {
        'targetType': 'message',
        'targetId': 'm1',
        'reason': 'harassment',
        'freeText': 'rude',
      });
    });

    test('a blank note is left out and a long one is capped', () async {
      final api = FakeApiClient(postResponse: const <String, dynamic>{});
      final repo = ModerationRepository(api);
      await repo.report(
        target: ReportTarget.post,
        targetId: 'p1',
        reason: ReportReason.spam,
        details: '   ',
      );
      expect(_body(api.posts.last.data).containsKey('freeText'), isFalse);

      await repo.report(
        target: ReportTarget.post,
        targetId: 'p1',
        reason: ReportReason.other,
        details: 'x' * 900,
      );
      expect(
        (_body(api.posts.last.data)['freeText'] as String).length,
        kReportDetailsMax,
      );
    });

    test('block posts and unblock deletes the same route', () async {
      final api = FakeApiClient(postResponse: const <String, dynamic>{});
      final repo = ModerationRepository(api);
      await repo.block('u-x');
      await repo.unblock('u-x');
      expect(api.posts.single.path, '/api/moderation/block');
      expect(_body(api.posts.single.data), {'blockedUid': 'u-x'});
      expect(api.deletes.single.path, '/api/moderation/block');
      expect(_body(api.deletes.single.data), {'blockedUid': 'u-x'});
    });

    test('blocked() reads the list and skips malformed rows', () async {
      final api = FakeApiClient(
        getResponse: const <String, dynamic>{
          'blocks': [
            {'blockedUid': 'u-a', 'displayName': ' Asha ', 'photoURL': null},
            {'displayName': 'no uid'},
          ],
        },
      );
      final list = await ModerationRepository(api).blocked();
      expect(list, [const BlockedTeacher(uid: 'u-a', name: 'Asha')]);
      expect(api.gets.single.path, '/api/moderation/blocks');
    });
  });

  group('BlockedTeachers', () {
    ProviderContainer container(FakeApiClient api, {bool signedIn = true}) {
      final c = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          isSignedInProvider.overrideWithValue(signedIn),
        ],
      );
      addTearDown(c.dispose);
      return c;
    }

    test('signed out: nothing is blocked and nothing is fetched', () async {
      final api = FakeApiClient();
      final c = container(api, signedIn: false);
      expect(await c.read(blockedTeachersProvider.future), isEmpty);
      expect(api.gets, isEmpty);
    });

    test('a failed read hides nothing', () async {
      final c = container(
        FakeApiClient(error: const ApiException(ApiErrorKind.network, 'x')),
      );
      expect(await c.read(blockedTeachersProvider.future), isEmpty);
    });

    test('block then unblock updates the uids after the server', () async {
      final api = FakeApiClient(
        postResponse: const <String, dynamic>{},
        getResponse: const <String, dynamic>{'blocks': <Object>[]},
      );
      final c = container(api);
      await c.read(blockedTeachersProvider.future);

      await c.read(blockedTeachersProvider.notifier).block('u-x', 'Ravi');
      expect(c.read(blockedUidsProvider), {'u-x'});

      await c.read(blockedTeachersProvider.notifier).unblock('u-x');
      expect(c.read(blockedUidsProvider), isEmpty);
    });

    test('a refused block leaves the list as it was', () async {
      final api = FakeApiClient(
        postError: const ApiException(ApiErrorKind.server, 'x'),
        getResponse: const <String, dynamic>{'blocks': <Object>[]},
      );
      final c = container(api);
      await c.read(blockedTeachersProvider.future);
      await expectLater(
        c.read(blockedTeachersProvider.notifier).block('u-x', 'Ravi'),
        throwsA(isA<ApiException>()),
      );
      expect(c.read(blockedUidsProvider), isEmpty);
    });
  });

  test('blocked one-to-one conversations leave the inbox', () {
    final all = [_dm('u-a'), _dm('u-b')];
    expect(withoutBlockedConversations(all, _me, const {}), same(all));
    expect(
      withoutBlockedConversations(all, _me, const {
        'u-a',
      }).map((c) => c.otherParticipantId(_me)),
      ['u-b'],
    );
  });

  group('FeedPostCard', () {
    testWidgets("another teacher's post has the ⋮ menu; mine does not", (
      tester,
    ) async {
      await _pumpCard(tester, _post());
      expect(find.byKey(const ValueKey('moderation-menu')), findsOneWidget);

      await _pumpCard(tester, _post(author: _me));
      expect(find.byKey(const ValueKey('moderation-menu')), findsNothing);
    });

    testWidgets('report: pick a reason, send, and the report is posted', (
      tester,
    ) async {
      final api = await _pumpCard(tester, _post());
      await tester.tap(find.byKey(const ValueKey('moderation-menu')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Report post'));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const ValueKey('report-reason-spam')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('report-send')));
      await tester.pumpAndSettle();

      final report = api.posts.singleWhere(
        (p) => p.path == '/api/moderation/report',
      );
      expect(_body(report.data), {
        'targetType': 'post',
        'targetId': 'p1',
        'reason': 'spam',
      });
      expect(find.text('Thanks. Our team will review this.'), findsOneWidget);
    });

    testWidgets('the daily limit says so and keeps the sheet open', (
      tester,
    ) async {
      final api = FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.rateLimited,
          'x',
          statusCode: 429,
        ),
        getResponse: const <String, dynamic>{'blocks': <Object>[]},
      );
      await _pumpCard(tester, _post(), api: api);
      await tester.tap(find.byKey(const ValueKey('moderation-menu')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Report post'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('report-reason-harassment')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('report-send')));
      await tester.pumpAndSettle();

      expect(
        find.text("You've reached today's report limit. Try again tomorrow."),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('report-send')), findsOneWidget);
    });

    testWidgets('block: confirm, and the post disappears', (tester) async {
      final api = await _pumpCard(tester, _post());
      await tester.tap(find.byKey(const ValueKey('moderation-menu')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Block Suresh Reddy'));
      await tester.pumpAndSettle();
      expect(find.text('Block Suresh Reddy?'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('moderation-block-confirm')));
      await tester.pumpAndSettle();

      expect(api.posts.single.path, '/api/moderation/block');
      expect(find.text('Taught fractions by cutting chapatis.'), findsNothing);
      expect(find.text('Suresh Reddy is blocked.'), findsOneWidget);
    });

    testWidgets('cancelling the block sends nothing', (tester) async {
      final api = await _pumpCard(tester, _post());
      await tester.tap(find.byKey(const ValueKey('moderation-menu')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Block Suresh Reddy'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      expect(api.posts, isEmpty);
      expect(
        find.text('Taught fractions by cutting chapatis.'),
        findsOneWidget,
      );
    });
  });

  group('BlockedTeachersScreen', () {
    Future<FakeApiClient> pumpScreen(
      WidgetTester tester,
      List<Map<String, Object?>> blocks,
    ) async {
      final api = FakeApiClient(getResponse: {'blocks': blocks});
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(api),
            isSignedInProvider.overrideWithValue(true),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const BlockedTeachersScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      return api;
    }

    testWidgets('empty list says so', (tester) async {
      await pumpScreen(tester, const []);
      expect(find.text("You haven't blocked anyone."), findsOneWidget);
    });

    testWidgets('Unblock removes the teacher', (tester) async {
      final api = await pumpScreen(tester, const [
        {'blockedUid': 'u-a', 'displayName': 'Asha Rao'},
      ]);
      expect(find.text('Asha Rao'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('unblock-u-a')));
      await tester.pumpAndSettle();

      expect(api.deletes.single.path, '/api/moderation/block');
      expect(find.text('Asha Rao is unblocked.'), findsOneWidget);
      expect(find.text("You haven't blocked anyone."), findsOneWidget);
    });
  });
}
