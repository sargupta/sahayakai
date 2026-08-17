import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/inbox/data/block_c_transport.dart';
import 'package:sahayakai/features/inbox/data/inbox_transport.dart';
import 'package:sahayakai/features/inbox/data/messages_stream_provider.dart';
import 'package:sahayakai/features/inbox/domain/conversation_id.dart';
import 'package:sahayakai/features/inbox/domain/inbox_models.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_providers.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_transport.dart';
import 'package:sahayakai/features/staffroom/domain/community_post.dart';
import 'package:sahayakai/features/staffroom/domain/group.dart';
import 'package:sahayakai/features/staffroom/presentation/network_hub_screen.dart';

import '../../support/fake_block_c_transports.dart';

/// A marker screen a real `context.push` resolves to, so the DP-2 sign-in
/// navigation assertion does not have to drag a whole login screen's own
/// provider graph into this suite (mirrors vidya_home_screen_test.dart's
/// `_DestMarker`).
class _DestMarker extends StatelessWidget {
  const _DestMarker(this.id);

  final String id;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(child: Text('DEST', key: Key('dest-$id'))),
    );
  }
}

/// U-SI2 — the Network hub: the `AppSegmented [Staffroom | Messages]` over the
/// Staffroom feed body and the reused U-SI1 inbox list. Verifies the segments
/// render, the default is Staffroom, and switching to Messages surfaces the
/// (reused) inbox — the offstage panes keep both tabs warm while an
/// offstage-respecting finder sees exactly the active one.

const _me = 'u-me';
const _other = 'u-bina';

FeedItem _feedPost(String content) => FeedItem(
  id: 'feed-p1',
  type: FeedItemType.groupPost,
  groupName: 'Class 8 Science',
  post: GroupPost(
    id: 'p1',
    groupId: 'g1',
    authorUid: 'u1',
    authorName: 'Asha',
    content: content,
    postType: PostType.share,
    likesCount: 1,
    createdAt: '2026-07-19T09:00:00Z',
  ),
);

Conversation _convo({String otherName = 'Bina Devi'}) => Conversation(
  id: const ConversationId('u-bina_u-me'),
  type: ConversationType.direct,
  participantIds: const [_other, _me],
  participants: {
    _other: ParticipantSnapshot(displayName: otherName),
    _me: const ParticipantSnapshot(displayName: 'Me'),
  },
  lastMessage: 'See you at the meeting',
  lastMessageSenderId: _other,
  unreadCount: const {_me: 0},
  lastMessageAt: '2026-07-19T11:55:00Z',
);

Future<void> _pumpHub(
  WidgetTester tester, {
  required FakeStaffroomTransport staffroom,
  required FakeInboxTransport inbox,
  bool router = false,
}) async {
  tester.view.physicalSize = const Size(390, 1400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

  addTearDown(staffroom.dispose);
  addTearDown(inbox.dispose);

  final overrides = [
    staffroomTransportProvider.overrideWithValue(staffroom),
    currentStaffroomUserIdProvider.overrideWithValue(_me),
    inboxTransportProvider.overrideWithValue(inbox),
    currentInboxUserIdProvider.overrideWithValue(_me),
  ];

  if (router) {
    final config = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(path: '/', builder: (_, _) => const NetworkHubScreen()),
        GoRoute(
          path: Routes.login,
          builder: (_, _) => const _DestMarker('login'),
        ),
      ],
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: overrides,
        child: MaterialApp.router(
          theme: AppTheme.light(),
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          routerConfig: config,
        ),
      ),
    );
  } else {
    await tester.pumpWidget(
      ProviderScope(
        overrides: overrides,
        child: MaterialApp(
          theme: AppTheme.light(),
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const NetworkHubScreen(),
        ),
      ),
    );
  }
  await tester.pumpAndSettle();
}

AppLocalizations _en() => lookupAppLocalizations(const Locale('en'));

void main() {
  final l10n = _en();

  testWidgets('renders both segments; defaults to the Staffroom feed', (
    tester,
  ) async {
    await _pumpHub(
      tester,
      staffroom: FakeStaffroomTransport()..feed = [_feedPost('staffroom body')],
      inbox: FakeInboxTransport(
        initialInbox: TransportSnapshot<List<Conversation>>.ready([_convo()]),
      ),
    );

    // Both segment labels are present.
    expect(find.text(l10n.networkTabStaffroom), findsWidgets);
    expect(find.text(l10n.networkTabMessages), findsWidgets);
    // The Network hub title.
    expect(find.text(l10n.networkTitle), findsOneWidget);
    // The Staffroom tab is active → the feed body shows; the Messages tab is
    // offstage → its conversation is not found.
    expect(find.text('staffroom body'), findsOneWidget);
    expect(find.text('Bina Devi'), findsNothing);
  });

  testWidgets('switching to Messages surfaces the reused inbox list', (
    tester,
  ) async {
    await _pumpHub(
      tester,
      staffroom: FakeStaffroomTransport()..feed = [_feedPost('staffroom body')],
      inbox: FakeInboxTransport(
        initialInbox: TransportSnapshot<List<Conversation>>.ready([_convo()]),
      ),
    );

    await tester.tap(find.text(l10n.networkTabMessages));
    await tester.pumpAndSettle();

    // The inbox row (U-SI1 ConversationRow) is now visible; the staffroom feed
    // is offstage.
    expect(find.text('Bina Devi'), findsOneWidget);
    expect(find.text('staffroom body'), findsNothing);
  });

  testWidgets('the Messages segment shows the inbox sign-in when awaiting', (
    tester,
  ) async {
    await _pumpHub(
      tester,
      staffroom: FakeStaffroomTransport(),
      inbox: FakeInboxTransport(
        initialInbox:
            const TransportSnapshot<List<Conversation>>.awaitingFirebase([]),
      ),
    );

    await tester.tap(find.text(l10n.networkTabMessages));
    await tester.pumpAndSettle();
    expect(find.text(l10n.inboxSignInBody), findsOneWidget);
  });

  group('DP-2: sign-in CTA (dead-end fix)', () {
    testWidgets('the Messages sign-in EmptyView offers a Sign in action that '
        'navigates to /login', (tester) async {
      await _pumpHub(
        tester,
        staffroom: FakeStaffroomTransport(),
        inbox: FakeInboxTransport(
          initialInbox:
              const TransportSnapshot<List<Conversation>>.awaitingFirebase([]),
        ),
        router: true,
      );

      await tester.tap(find.text(l10n.networkTabMessages));
      await tester.pumpAndSettle();

      // The dead end this unit fixes: the Network hub's reused Messages
      // sign-in state had no way forward.
      final signIn = find.text(l10n.actionSignIn);
      expect(signIn, findsOneWidget);
      expect(find.byIcon(LucideIcons.logIn), findsOneWidget);

      await tester.tap(signIn);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('dest-login')), findsOneWidget);
    });

    testWidgets(
      'the genuinely-empty Messages EmptyView (ready, no conversations) '
      'does NOT gain a Sign in action',
      (tester) async {
        await _pumpHub(
          tester,
          staffroom: FakeStaffroomTransport(),
          inbox: FakeInboxTransport(
            initialInbox: const TransportSnapshot<List<Conversation>>.ready(
              <Conversation>[],
            ),
          ),
        );

        await tester.tap(find.text(l10n.networkTabMessages));
        await tester.pumpAndSettle();

        expect(find.text(l10n.inboxEmptyTitle), findsOneWidget);
        // A ready-but-empty inbox is not a dead end — it must not pick up the
        // sign-in CTA.
        expect(find.text(l10n.actionSignIn), findsNothing);
        expect(find.byIcon(LucideIcons.logIn), findsNothing);
      },
    );
  });
}
