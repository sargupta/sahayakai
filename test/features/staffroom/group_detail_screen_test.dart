import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/inbox/data/block_c_transport.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_providers.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_transport.dart';
import 'package:sahayakai/features/staffroom/domain/chat_message.dart';
import 'package:sahayakai/features/staffroom/domain/chat_quote.dart';
import 'package:sahayakai/features/staffroom/domain/group.dart';
import 'package:sahayakai/features/staffroom/presentation/group_detail_screen.dart';
import 'package:sahayakai/features/staffroom/presentation/staffroom_screen.dart';
import 'package:sahayakai/features/staffroom/presentation/widgets/feed_post_card.dart';
import 'package:sahayakai/shared/widgets/error_view.dart';

import '../../support/fake_block_c_transports.dart';

/// U-SI2 — the Group detail, driven by the fake transport. The header + posts,
/// the OPTIMISTIC join (immediate "Joined" + member-count bump → reconcile →
/// rollback on a thrown TransportUnavailable), the member-gated locked preview,
/// and tap-through from the Staffroom "Your groups" strip.

const _me = 'u-me';

Group _group({
  String id = 'g1',
  String name = 'Class 8 Science',
  int members = 42,
  String description = 'Science teachers, Class 8',
  GroupAutoJoinRules rules = const GroupAutoJoinRules(),
  String? lastActivityAt,
}) => Group(
  id: id,
  name: name,
  description: description,
  type: GroupType.subjectGrade,
  coverColor: '',
  memberCount: members,
  autoJoinRules: rules,
  createdBy: 'system',
  lastActivityAt: lastActivityAt,
);

GroupPost _post({
  String id = 'p1',
  String content = 'inside the group',
  int likes = 2,
  PostType type = PostType.share,
  String author = 'Asha',
}) => GroupPost(
  id: id,
  groupId: 'g1',
  authorUid: 'u1',
  authorName: author,
  content: content,
  postType: type,
  likesCount: likes,
  createdAt: '2026-07-19T09:00:00Z',
);

Future<void> _pump(
  WidgetTester tester, {
  required FakeStaffroomTransport fake,
  String initialLocation = '/staffroom/group/g1',
  String? uid = _me,
  List<Override> extraOverrides = const [],
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  Size surface = const Size(390, 1400),
  Locale locale = const Locale('en'),
  bool settle = true,
}) async {
  tester.view.physicalSize = surface;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

  addTearDown(fake.dispose);

  final router = GoRouter(
    initialLocation: initialLocation,
    routes: [
      GoRoute(
        path: Routes.staffroom,
        builder: (_, _) => const StaffroomScreen(),
      ),
      GoRoute(
        path: Routes.groupChatPattern,
        builder: (context, state) => _ChatMarker(
          groupId: state.pathParameters['id']!,
          args: state.extra is ChatRouteArgs
              ? state.extra! as ChatRouteArgs
              : null,
        ),
      ),
      GoRoute(
        path: Routes.groupDetailPattern,
        builder: (context, state) => GroupDetailScreen(
          groupId: state.pathParameters['id']!,
          group: state.extra is Group ? state.extra! as Group : null,
        ),
      ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        staffroomTransportProvider.overrideWithValue(fake),
        if (uid != null) currentStaffroomUserIdProvider.overrideWithValue(uid),
        ...extraOverrides,
      ],
      child: MaterialApp.router(
        theme: brightness == Brightness.dark
            ? AppTheme.light()
            : AppTheme.light(),
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    ),
  );
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
}

AppLocalizations _en() => lookupAppLocalizations(const Locale('en'));

/// Where "Group chat" lands: records the group and the route args it got.
class _ChatMarker extends StatelessWidget {
  const _ChatMarker({required this.groupId, this.args});

  final String groupId;
  final ChatRouteArgs? args;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Text('CHAT $groupId ${args?.title}', key: const Key('chat-marker')),
  );
}

/// A member's group: the posts load (that proves membership).
FakeStaffroomTransport _memberFake({Group? group, List<GroupPost>? posts}) =>
    FakeStaffroomTransport()
      ..group = group ?? _group()
      ..myGroups = [group ?? _group()]
      ..groupPosts = posts ?? [_post()];

void main() {
  final l10n = _en();

  testWidgets('null uid → sign-in EmptyView', (tester) async {
    await _pump(
      tester,
      fake: FakeStaffroomTransport()..group = _group(),
      uid: null,
    );
    expect(find.text(l10n.staffroomSignInBody), findsOneWidget);
  });

  testWidgets('renders the header (name, member count, description) + posts', (
    tester,
  ) async {
    final fake = FakeStaffroomTransport()
      ..group = _group()
      ..myGroups =
          [_group()] // a member
      ..groupPosts = [_post(content: 'a member-gated post body')];
    await _pump(tester, fake: fake);

    expect(find.text('Class 8 Science'), findsOneWidget); // the hero name
    expect(find.text(l10n.cmGroupTeacherCount(42)), findsOneWidget);
    expect(find.text('Science teachers, Class 8'), findsOneWidget);
    expect(find.text('a member-gated post body'), findsOneWidget);
    expect(find.byIcon(LucideIcons.heart), findsOneWidget); // the post like row
  });

  testWidgets('posts empty → the posts-empty EmptyView', (tester) async {
    final fake = FakeStaffroomTransport()
      ..group = _group()
      ..myGroups = [_group()]
      ..groupPosts = const [];
    await _pump(tester, fake: fake);
    expect(find.text(l10n.staffroomGroupPostsEmptyTitle), findsOneWidget);
  });

  testWidgets('member-gated: a 403 posts read → "For members" + Join', (
    tester,
  ) async {
    final fake = FakeStaffroomTransport()
      ..group = _group()
      ..myGroups =
          const [] // NOT a member
      ..groupPostsError = _forbidden;
    await _pump(tester, fake: fake);
    expect(find.text(l10n.cmGroupForMembersTitle), findsOneWidget);
    expect(find.text(l10n.cmGroupForMembersBody), findsOneWidget);
    // The shapes of what is shared here: kind strips only, no posts, no chat.
    expect(find.text(l10n.cmPostKindHelp), findsOneWidget);
    expect(find.text(l10n.cmPostKindTried), findsOneWidget);
    expect(find.byType(FeedPostCard), findsNothing);
    expect(find.text(l10n.staffroomGroupChatEntry), findsNothing);
    expect(find.text(l10n.cmGroupJoin), findsOneWidget);
  });

  testWidgets('any OTHER posts failure is a real error, not a lock', (
    tester,
  ) async {
    final fake = FakeStaffroomTransport()
      ..group = _group()
      ..myGroups = const []
      ..groupPostsError = const ApiException(
        ApiErrorKind.network,
        'No connection.',
      );
    await _pump(tester, fake: fake);
    expect(find.text(l10n.cmGroupForMembersTitle), findsNothing);
    expect(find.byType(ErrorView), findsOneWidget);
  });

  group('optimistic join', () {
    testWidgets('flips to "Joined" + bumps the count immediately, reconciles', (
      tester,
    ) async {
      final gate = Completer<void>();
      final fake = FakeStaffroomTransport()
        ..group = _group(members: 42)
        ..myGroups =
            const [] // not a member
        ..groupPostsError = _forbidden
        ..joinResult = true
        ..joinGate = gate;
      await _pump(tester, fake: fake);

      expect(find.text(l10n.cmGroupJoin), findsOneWidget);
      expect(find.text(l10n.cmGroupTeacherCount(42)), findsOneWidget);

      await tester.tap(find.text(l10n.cmGroupJoin));
      await tester.pump(); // optimistic, before the gated reply resolves
      expect(find.text(l10n.staffroomJoined), findsOneWidget);
      expect(find.text(l10n.cmGroupTeacherCount(43)), findsOneWidget);

      gate.complete();
      await tester
          .pumpAndSettle(); // reconcile (joinResult true → stays Joined)
      expect(find.text(l10n.staffroomJoined), findsOneWidget);
      expect(fake.joinedGroups.single, 'g1');
      // The posts unlocked: the member's actions sit side by side.
      expect(find.text(l10n.staffroomGroupChatEntry), findsWidgets);
    });

    testWidgets('rolls back + hints on a thrown TransportUnavailable', (
      tester,
    ) async {
      final fake = FakeStaffroomTransport()
        ..group = _group(members: 42)
        ..myGroups = const []
        ..groupPostsError = _forbidden
        ..joinError = const TransportUnavailable.awaitingFirebase('joinGroup');
      await _pump(tester, fake: fake);

      await tester.tap(find.text(l10n.cmGroupJoin));
      await tester.pumpAndSettle(); // apply → throw → rollback

      expect(find.text(l10n.cmGroupJoin), findsOneWidget); // back to Join
      expect(find.text(l10n.staffroomJoinFailed), findsOneWidget); // hint
      expect(find.text(l10n.cmGroupTeacherCount(42)), findsOneWidget); // 42
    });
  });

  testWidgets(
    'tapping a group in the "Your groups" strip → group detail posts',
    (tester) async {
      final fake = FakeStaffroomTransport()
        ..group = _group(name: 'Class 8 Science')
        ..myGroups =
            [_group(name: 'Class 8 Science')] // shows the strip chip
        ..feed =
            const [] // ready, quiet feed
        ..groupPosts = [_post(content: 'a post inside the group')];
      await _pump(tester, fake: fake, initialLocation: Routes.staffroom);

      // The "Your groups" strip chip is present; tap it.
      await tester.tap(find.byKey(const ValueKey<String>('group-card-g1')));
      await tester.pumpAndSettle();

      expect(find.byType(GroupDetailScreen), findsOneWidget);
      expect(find.text('a post inside the group'), findsOneWidget);
    },
  );

  group('the hero', () {
    testWidgets('shows only the chips and activity the group really has', (
      tester,
    ) async {
      final twoHoursAgo = DateTime.now()
          .subtract(const Duration(hours: 2, minutes: 5))
          .toUtc()
          .toIso8601String();
      final group = _group(
        rules: const GroupAutoJoinRules(
          grades: ['Class 8'],
          subjects: ['Science'],
          board: 'CBSE',
        ),
        lastActivityAt: twoHoursAgo,
      );
      await _pump(tester, fake: _memberFake(group: group));

      expect(find.text('Class 8'), findsOneWidget);
      expect(find.text('Science'), findsOneWidget);
      expect(find.text('CBSE'), findsOneWidget);
      expect(
        find.text(
          '${l10n.cmGroupTeacherCount(42)} · '
          '${l10n.cmGroupActiveAgo(l10n.inboxTimeHours(2))}',
        ),
        findsOneWidget,
      );
    });

    testWidgets('no rules → no chips; no activity time → just the count', (
      tester,
    ) async {
      await _pump(tester, fake: _memberFake());
      expect(find.text(l10n.cmGroupTeacherCount(42)), findsOneWidget);
      expect(find.text('CBSE'), findsNothing);
    });
  });

  group('member actions', () {
    testWidgets('"Joined" sits beside "Group chat", which opens the chat', (
      tester,
    ) async {
      await _pump(tester, fake: _memberFake());

      expect(find.text(l10n.staffroomJoined), findsOneWidget);
      expect(find.text(l10n.cmGroupJoin), findsNothing);
      // The hero button and the chat card both say "Group chat".
      expect(find.text(l10n.staffroomGroupChatEntry), findsNWidgets(2));

      await tester.tap(find.text(l10n.staffroomGroupChatEntry).first);
      await tester.pumpAndSettle();
      expect(find.text('CHAT g1 Class 8 Science'), findsOneWidget);
    });

    testWidgets('the chat card previews the newest message and opens chat', (
      tester,
    ) async {
      final fake = _memberFake()
        ..emitGroupChat(
          'g1',
          const TransportSnapshot<List<ChatMessage>>.ready([
            ChatMessage(
              id: 'm1',
              text: 'Good morning',
              authorId: 'u2',
              authorName: 'Lata',
            ),
            ChatMessage(
              id: 'm2',
              text: 'I cut paper plates into halves',
              authorId: 'u3',
              authorName: 'Rohit',
            ),
          ]),
        );
      await _pump(tester, fake: fake);

      final preview = find.text('Rohit: I cut paper plates into halves');
      expect(preview, findsOneWidget);
      expect(find.text('Lata: Good morning'), findsNothing);

      await tester.tap(preview);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('chat-marker')), findsOneWidget);
    });

    testWidgets('an empty chat says so', (tester) async {
      await _pump(tester, fake: _memberFake());
      expect(find.text(l10n.staffroomChatEmptyTitle), findsOneWidget);
    });
  });

  group('posts', () {
    testWidgets('filter by kind, with an honest empty line', (tester) async {
      final fake = _memberFake(
        posts: [
          _post(id: 'p1', content: 'a tried-this post'),
          _post(id: 'p2', content: 'a help post', type: PostType.askHelp),
        ],
      );
      await _pump(tester, fake: fake);

      expect(find.text(l10n.cmGroupInThisGroup.toUpperCase()), findsOneWidget);
      expect(find.text('a tried-this post'), findsOneWidget);
      expect(find.text('a help post'), findsOneWidget);

      await tester.tap(
        find.byKey(const ValueKey<String>('group-filter-ask_help')),
      );
      await tester.pumpAndSettle();
      expect(find.text('a tried-this post'), findsNothing);
      expect(find.text('a help post'), findsOneWidget);

      await tester.tap(
        find.byKey(const ValueKey<String>('group-filter-celebrate')),
      );
      await tester.pumpAndSettle();
      expect(find.text('a help post'), findsNothing);
      expect(find.text(l10n.cmGroupFilterEmpty), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey<String>('group-filter-all')));
      await tester.pumpAndSettle();
      expect(find.text('a tried-this post'), findsOneWidget);
      expect(find.text('a help post'), findsOneWidget);
    });

    testWidgets('a short page ends with "That is everything"', (tester) async {
      await _pump(tester, fake: _memberFake());
      expect(find.text(l10n.cmGroupEnd('Class 8 Science')), findsOneWidget);
    });

    testWidgets('a full page (there may be more) does not claim the end', (
      tester,
    ) async {
      await _pump(
        tester,
        fake: _memberFake(
          posts: [for (var i = 0; i < 20; i++) _post(id: 'p$i')],
        ),
      );
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey<String>('group-post-p19')),
        400,
        scrollable: find.byType(Scrollable).first, // the page, not a row
      );
      expect(find.text(l10n.cmGroupEnd('Class 8 Science')), findsNothing);
    });
  });

  group('overflow probe — 360dp × 1.3', () {
    const longName = 'ಎಂಟನೇ ತರಗತಿ ವಿಜ್ಞಾನ ಶಿಕ್ಷಕರ ಬಳಗ ಮತ್ತು ಚರ್ಚಾ ವೇದಿಕೆ';
    final group = _group(
      name: longName,
      description:
          'எட்டாம் வகுப்பு அறிவியல் ஆசிரியர்கள் பாடத்திட்டம், '
          'செயல்பாடுகள் மற்றும் வினாத்தாள்களைப் பகிரும் இடம்.',
      rules: const GroupAutoJoinRules(
        grades: ['कक्षा 8'],
        subjects: ['विज्ञान'],
        board: 'महाराष्ट्र राज्य मंडळ',
      ),
      lastActivityAt: '2026-07-19T09:00:00Z',
    );
    for (final code in ['hi', 'ta', 'ml']) {
      testWidgets('no overflow as a member ($code)', (tester) async {
        final fake =
            _memberFake(
              group: group,
              posts: [
                _post(
                  author: 'ശ്രീലക്ഷ്മി രാധാകൃഷ്ണൻ',
                  content:
                      'ഇന്ന് എട്ടാം ക്ലാസിൽ ഭിന്നസംഖ്യകൾ പഠിപ്പിക്കുമ്പോൾ '
                      'ചപ്പാത്തി മുറിച്ച് കാണിച്ചു.',
                  type: PostType.askHelp,
                ),
              ],
            )..emitGroupChat(
              'g1',
              const TransportSnapshot<List<ChatMessage>>.ready([
                ChatMessage(
                  id: 'm1',
                  text:
                      'ഇന്ന് എട്ടാം ക്ലാസിൽ ഭിന്നസംഖ്യകൾ പഠിപ്പിക്കുമ്പോൾ '
                      'ചപ്പാത്തി മുറിച്ച് കാണിച്ചു',
                  authorId: 'u2',
                  authorName: 'ശ്രീലക്ഷ്മി',
                  createdAt: '2026-07-19T09:00:00Z',
                ),
              ]),
            );
        await _pump(
          tester,
          fake: fake,
          locale: Locale(code),
          textScale: 1.3,
          surface: const Size(360, 2600),
        );
        expect(tester.takeException(), isNull);
        expect(find.text(longName), findsOneWidget);
      });

      testWidgets('no overflow before joining ($code)', (tester) async {
        final fake = FakeStaffroomTransport()
          ..group = group
          ..myGroups = const []
          ..groupPostsError = _forbidden;
        await _pump(
          tester,
          fake: fake,
          locale: Locale(code),
          textScale: 1.3,
          surface: const Size(360, 2000),
        );
        expect(tester.takeException(), isNull);
        expect(
          find.text(lookupAppLocalizations(Locale(code)).cmGroupJoin),
          findsOneWidget,
        );
      });
    }
  });
}

/// The posts route's answer to a teacher who is not in the group.
const _forbidden = ApiException(
  ApiErrorKind.forbidden,
  'Not a member',
  statusCode: 403,
);
