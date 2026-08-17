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
import 'package:sahayakai/features/inbox/presentation/conversation_thread_screen.dart';
import 'package:sahayakai/features/inbox/presentation/inbox_screen.dart';
import 'package:sahayakai/shared/widgets/app_badge.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';
import 'package:sahayakai/shared/widgets/error_view.dart';

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

/// U-SI1 — the Pro Inbox list, driven by the fake transport (no Firebase). Every
/// [TransportSnapshot] state → its surface: sign-in / empty / error / rows, plus
/// row content (name, preview, timestamp, unread badge) and tap-through to the
/// thread. The current uid is injected via [currentInboxUserIdProvider].

const _me = 'u-me';
const _other = 'u-bina';

Conversation _convo({
  String id = 'u-bina_u-me',
  String otherName = 'Bina Devi',
  String preview = 'See you at the staff meeting',
  int unread = 0,
  String lastMessageAt = '2026-07-19T11:55:00Z',
}) => Conversation(
  id: ConversationId(id),
  type: ConversationType.direct,
  participantIds: const [_other, _me],
  participants: {
    _other: ParticipantSnapshot(displayName: otherName),
    _me: const ParticipantSnapshot(displayName: 'Me'),
  },
  lastMessage: preview,
  lastMessageSenderId: _other,
  unreadCount: {_me: unread},
  lastMessageAt: lastMessageAt,
);

Future<FakeInboxTransport> _pump(
  WidgetTester tester, {
  TransportSnapshot<List<Conversation>>? inbox,
  String? myUid = _me,
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  Size surface = const Size(390, 1200),
  Locale locale = const Locale('en'),
  bool router = false,
}) async {
  tester.view.physicalSize = surface;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

  final fake = FakeInboxTransport(initialInbox: inbox);
  addTearDown(fake.dispose);

  final overrides = <Override>[
    inboxTransportProvider.overrideWithValue(fake),
    if (myUid != null) currentInboxUserIdProvider.overrideWithValue(myUid),
  ];

  final theme = brightness == Brightness.dark
      ? AppTheme.dark()
      : AppTheme.light();

  if (router) {
    final config = GoRouter(
      initialLocation: Routes.inbox,
      routes: [
        GoRoute(path: Routes.inbox, builder: (_, _) => const InboxScreen()),
        GoRoute(
          path: Routes.conversationThreadPattern,
          builder: (context, state) => ConversationThreadScreen(
            conversationId: ConversationId(state.pathParameters['id']!),
            conversation: state.extra is Conversation
                ? state.extra! as Conversation
                : null,
          ),
        ),
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
          theme: theme,
          locale: locale,
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
          theme: theme,
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const InboxScreen(),
        ),
      ),
    );
  }
  await tester.pumpAndSettle();
  return fake;
}

AppLocalizations _en() => lookupAppLocalizations(const Locale('en'));

void main() {
  final l10n = _en();

  group('state → surface', () {
    testWidgets('awaitingFirebase → sign-in EmptyView (DM gate)', (
      tester,
    ) async {
      await _pump(
        tester,
        inbox: const TransportSnapshot<List<Conversation>>.awaitingFirebase(
          <Conversation>[],
        ),
      );
      expect(find.text(l10n.inboxSignInBody), findsOneWidget);
      expect(find.byType(EmptyView), findsOneWidget);
    });

    testWidgets('signedOut → sign-in EmptyView', (tester) async {
      await _pump(
        tester,
        inbox: const TransportSnapshot<List<Conversation>>.signedOut(
          <Conversation>[],
        ),
      );
      expect(find.text(l10n.inboxSignInBody), findsOneWidget);
    });

    testWidgets('ready + null uid → sign-in EmptyView (defensive)', (
      tester,
    ) async {
      await _pump(
        tester,
        inbox: TransportSnapshot<List<Conversation>>.ready([_convo()]),
        myUid: null,
      );
      expect(find.text(l10n.inboxSignInBody), findsOneWidget);
    });

    testWidgets('ready empty → "No conversations yet"', (tester) async {
      await _pump(
        tester,
        inbox: const TransportSnapshot<List<Conversation>>.ready(
          <Conversation>[],
        ),
      );
      expect(find.text(l10n.inboxEmptyTitle), findsOneWidget);
    });

    testWidgets('error snapshot → ErrorView with retry', (tester) async {
      await _pump(
        tester,
        inbox: TransportSnapshot<List<Conversation>>.error(
          const <Conversation>[],
          StateError('missing composite index'),
        ),
      );
      expect(find.byType(ErrorView), findsOneWidget);
      expect(find.text(l10n.inboxErrorBody), findsOneWidget);
      expect(find.text(l10n.actionRetry), findsOneWidget);
    });
  });

  group('DP-2: sign-in CTA (dead-end fix)', () {
    testWidgets(
      'awaitingFirebase sign-in EmptyView offers a Sign in action that '
      'navigates to /login',
      (tester) async {
        await _pump(
          tester,
          inbox: const TransportSnapshot<List<Conversation>>.awaitingFirebase(
            <Conversation>[],
          ),
          router: true,
        );

        // The dead end this unit fixes: the DM-gate sign-in state had no way
        // forward.
        final signIn = find.text(l10n.actionSignIn);
        expect(signIn, findsOneWidget);
        expect(find.byIcon(LucideIcons.logIn), findsOneWidget);

        await tester.tap(signIn);
        await tester.pumpAndSettle();

        expect(find.byKey(const Key('dest-login')), findsOneWidget);
      },
    );

    testWidgets(
      'the genuinely-empty "No conversations yet" EmptyView does NOT gain '
      'a Sign in action',
      (tester) async {
        await _pump(
          tester,
          inbox: const TransportSnapshot<List<Conversation>>.ready(
            <Conversation>[],
          ),
        );

        expect(find.text(l10n.inboxEmptyTitle), findsOneWidget);
        // A ready-but-empty inbox is not a dead end (a real session with
        // nothing in it yet) — it must not pick up the sign-in CTA.
        expect(find.text(l10n.actionSignIn), findsNothing);
        expect(find.byIcon(LucideIcons.logIn), findsNothing);
      },
    );
  });

  group('rows', () {
    testWidgets('renders name, preview and an unread badge when unread>0', (
      tester,
    ) async {
      await _pump(
        tester,
        inbox: TransportSnapshot<List<Conversation>>.ready([
          _convo(otherName: 'Bina Devi', preview: 'Notes ready', unread: 3),
        ]),
      );
      expect(find.text('Bina Devi'), findsOneWidget);
      expect(find.text('Notes ready'), findsOneWidget);
      // The AA-fixed unread pill.
      expect(find.byType(AppBadge), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
    });

    testWidgets('no unread badge when unread==0', (tester) async {
      await _pump(
        tester,
        inbox: TransportSnapshot<List<Conversation>>.ready([_convo(unread: 0)]),
      );
      expect(find.byType(AppBadge), findsNothing);
    });

    testWidgets('tapping a row opens the thread', (tester) async {
      await _pump(
        tester,
        inbox: TransportSnapshot<List<Conversation>>.ready([
          _convo(otherName: 'Bina Devi'),
        ]),
        router: true,
      );

      await tester.tap(find.text('Bina Devi'));
      await tester.pumpAndSettle();

      // The thread screen mounts its composer (the inbox has none) and names the
      // participant in its app bar.
      expect(find.byType(ConversationThreadScreen), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
    });
  });

  group('overflow probe — 360dp × 1.3, light + dark', () {
    for (final brightness in Brightness.values) {
      testWidgets('no overflow (${brightness.name}) with a long Bengali name', (
        tester,
      ) async {
        await _pump(
          tester,
          surface: const Size(360, 800),
          textScale: 1.3,
          brightness: brightness,
          inbox: TransportSnapshot<List<Conversation>>.ready([
            _convo(
              otherName: 'বিনা দেবী শিক্ষিকা মহাশয়া বিদ্যালয়',
              preview:
                  'আগামীকাল স্টাফ মিটিংয়ে দেখা হবে, দয়া করে নোটগুলি আনবেন',
              unread: 12,
            ),
          ]),
        );
        expect(tester.takeException(), isNull);
      });
    }
  });
}
