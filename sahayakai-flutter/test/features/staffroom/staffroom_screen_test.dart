import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/inbox/data/block_c_transport.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_providers.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_transport.dart';
import 'package:sahayakai/features/staffroom/domain/community_post.dart';
import 'package:sahayakai/features/staffroom/domain/group.dart';
import 'package:sahayakai/features/staffroom/domain/staffroom_results.dart';
import 'package:sahayakai/features/staffroom/presentation/staffroom_screen.dart';
import 'package:sahayakai/shared/widgets/app_skeleton.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';
import 'package:sahayakai/shared/widgets/error_view.dart';
import 'package:sahayakai/shared/widgets/secondary_button.dart';

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

/// U-SI2 — the Staffroom home, driven by the fake transport (no Firebase). Every
/// state → its surface (sign-in / loading / error / empty / feed), plus the
/// OPTIMISTIC like (immediate toggle → reconcile on success → rollback + hint on
/// a thrown TransportUnavailable). The uid is injected via
/// [currentStaffroomUserIdProvider]; loading/error are injected by overriding
/// [unifiedFeedProvider] directly.

const _me = 'u-me';

Group _group({
  String id = 'g1',
  String name = 'Class 8 Science',
  int members = 42,
  String description = 'Science teachers, Class 8',
}) => Group(
  id: id,
  name: name,
  description: description,
  type: GroupType.subjectGrade,
  coverColor: '',
  memberCount: members,
  autoJoinRules: const GroupAutoJoinRules(),
  createdBy: 'system',
);

GroupPost _post({
  String id = 'p1',
  String groupId = 'g1',
  String author = 'Asha',
  String content = 'hello staffroom',
  PostType type = PostType.share,
  int likes = 3,
}) => GroupPost(
  id: id,
  groupId: groupId,
  authorUid: 'u1',
  authorName: author,
  content: content,
  postType: type,
  likesCount: likes,
  createdAt: '2026-07-19T09:00:00Z',
);

FeedItem _feedPost(GroupPost post, {String groupName = 'Class 8 Science'}) =>
    FeedItem(
      id: 'feed-${post.id}',
      type: FeedItemType.groupPost,
      groupName: groupName,
      post: post,
      timestamp: post.createdAt,
    );

Future<FakeStaffroomTransport> _pump(
  WidgetTester tester, {
  FakeStaffroomTransport? fake,
  String? uid = _me,
  List<Override> extraOverrides = const [],
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  Size surface = const Size(390, 1400),
  Locale locale = const Locale('en'),
  bool settle = true,
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

  final t = fake ?? FakeStaffroomTransport();
  addTearDown(t.dispose);

  final overrides = <Override>[
    staffroomTransportProvider.overrideWithValue(t),
    if (uid != null) currentStaffroomUserIdProvider.overrideWithValue(uid),
    ...extraOverrides,
  ];

  final theme = brightness == Brightness.dark
      ? AppTheme.dark()
      : AppTheme.light();

  if (router) {
    final config = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(path: '/', builder: (_, _) => const StaffroomScreen()),
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
          home: const StaffroomScreen(),
        ),
      ),
    );
  }
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
  return t;
}

AppLocalizations _en() => lookupAppLocalizations(const Locale('en'));

void main() {
  final l10n = _en();

  group('state → surface', () {
    testWidgets('null uid (awaiting / signed out) → sign-in EmptyView', (
      tester,
    ) async {
      await _pump(tester, uid: null);
      expect(find.text(l10n.staffroomSignInBody), findsOneWidget);
      expect(find.byType(EmptyView), findsOneWidget);
    });

    testWidgets('loading → AppSkeleton feed', (tester) async {
      await _pump(
        tester,
        settle: false,
        extraOverrides: [
          unifiedFeedProvider.overrideWith(
            (ref) => Completer<List<FeedItem>>().future,
          ),
        ],
      );
      expect(find.byType(AppSkeleton), findsOneWidget);
    });

    testWidgets('error → ErrorView with retry', (tester) async {
      await _pump(
        tester,
        extraOverrides: [
          unifiedFeedProvider.overrideWith(
            (ref) => Future<List<FeedItem>>.error(StateError('boom')),
          ),
        ],
      );
      expect(find.byType(ErrorView), findsOneWidget);
      expect(find.text(l10n.staffroomErrorBody), findsOneWidget);
      expect(find.text(l10n.actionRetry), findsOneWidget);
    });

    testWidgets('ready empty → "Your feed is quiet" EmptyView', (tester) async {
      await _pump(tester, fake: FakeStaffroomTransport()..feed = const []);
      expect(find.text(l10n.staffroomFeedEmptyTitle), findsOneWidget);
    });
  });

  group('DP-2: sign-in CTA (dead-end fix)', () {
    testWidgets(
      'sign-in EmptyView offers a Sign in action that navigates to /login',
      (tester) async {
        await _pump(tester, uid: null, router: true);

        // The dead end this unit fixes: the signed-out staffroom had no way
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
      'the genuinely-empty "Your feed is quiet" EmptyView does NOT gain a '
      'Sign in action',
      (tester) async {
        await _pump(tester, fake: FakeStaffroomTransport()..feed = const []);

        expect(find.text(l10n.staffroomFeedEmptyTitle), findsOneWidget);
        // A ready-but-empty feed is not a dead end (a real session with
        // nothing in it yet) — it must not pick up the sign-in CTA.
        expect(find.text(l10n.actionSignIn), findsNothing);
        expect(find.byIcon(LucideIcons.logIn), findsNothing);
      },
    );
  });

  group('U15: honest "Your groups" empty (dead browse-button removed)', () {
    testWidgets(
      'the groups-empty prompt no longer carries a "Browse groups" button',
      (tester) async {
        // A signed-in teacher on the shipping Firestore transport has no groups
        // AND an empty feed (discoverGroups / getUnifiedFeed are a real backend
        // gap, hardcoded empty). The button used to scroll to a "Discover groups"
        // section that never renders, dumping the teacher at "Your feed is quiet".
        // With no real destination, the honest empty prompt carries no button.
        await _pump(tester, fake: FakeStaffroomTransport()..feed = const []);

        // The empty prompt itself is still there — an honest statement, not a
        // dead affordance.
        expect(find.text(l10n.staffroomGroupsEmptyTitle), findsOneWidget);
        expect(find.text(l10n.staffroomGroupsEmptyBody), findsOneWidget);
        // The dead button is gone: no "Browse groups" label, and no
        // SecondaryButton at all in this (feed-empty, groups-empty) state — the
        // only SecondaryButton the screen has left is the signed-out sign-in one,
        // which does not render for a signed-in teacher.
        expect(find.text(l10n.staffroomBrowseGroups), findsNothing);
        expect(find.byType(SecondaryButton), findsNothing);
      },
    );
  });

  group('feed content', () {
    testWidgets(
      'renders a seeded group_post (author, body, group, like count)',
      (tester) async {
        await _pump(
          tester,
          fake: FakeStaffroomTransport()..feed = [_feedPost(_post())],
        );
        expect(find.text('Asha'), findsOneWidget);
        expect(find.text('hello staffroom'), findsOneWidget);
        expect(find.text('Class 8 Science'), findsOneWidget); // the group chip
        expect(find.text('3'), findsOneWidget); // the like count
        expect(find.byIcon(LucideIcons.heart), findsOneWidget);
      },
    );

    testWidgets('feed filter chips narrow the feed by real post type', (
      tester,
    ) async {
      await _pump(
        tester,
        fake: FakeStaffroomTransport()..feed = [_feedPost(_post())],
      );

      // The chip row over the real feed types (v2 Group H "Community").
      expect(find.text('All'), findsOneWidget);
      expect(find.text('Posts'), findsOneWidget);
      expect(find.text('Resources'), findsOneWidget);
      expect(find.text('Highlights'), findsOneWidget);

      // The seeded group_post shows under All and under Posts.
      expect(find.text('hello staffroom'), findsOneWidget);

      // Filtering to Resources hides the (group_post) item.
      await tester.tap(find.text('Resources'));
      await tester.pumpAndSettle();
      expect(find.text('hello staffroom'), findsNothing);

      // Back to All restores it.
      await tester.tap(find.text('All'));
      await tester.pumpAndSettle();
      expect(find.text('hello staffroom'), findsOneWidget);
    });
  });

  group('optimistic like', () {
    testWidgets('toggles immediately, then reconciles to the server count', (
      tester,
    ) async {
      final gate = Completer<void>();
      final fake = FakeStaffroomTransport()
        ..feed = [_feedPost(_post(likes: 3))]
        ..likeResult = const LikeResult(isLiked: true, newCount: 99)
        ..likeGate = gate;
      await _pump(tester, fake: fake);

      expect(find.text('3'), findsOneWidget);
      await tester.tap(find.byIcon(LucideIcons.heart));
      await tester.pump(); // optimistic frame, before the gated reply resolves
      expect(find.text('4'), findsOneWidget); // 3 → 4 immediately
      expect(find.text('3'), findsNothing);

      gate.complete();
      await tester.pumpAndSettle(); // reconcile
      expect(find.text('99'), findsOneWidget); // server count won
      expect(fake.likes.single.postId, 'p1');
    });

    testWidgets('rolls back + hints on a thrown TransportUnavailable', (
      tester,
    ) async {
      final fake = FakeStaffroomTransport()
        ..feed = [_feedPost(_post(likes: 3))]
        ..likeError = const TransportUnavailable.awaitingFirebase(
          'likeGroupPost',
        );
      await _pump(tester, fake: fake);

      expect(find.text('3'), findsOneWidget);
      await tester.tap(find.byIcon(LucideIcons.heart));
      await tester.pumpAndSettle(); // apply → throw → rollback

      expect(find.text('3'), findsOneWidget); // reverted to the pre-tap count
      expect(find.text(l10n.staffroomLikeFailed), findsOneWidget); // quiet hint
      // The write WAS attempted (recorded) before it threw.
      expect(fake.likes.single.postId, 'p1');
    });
  });

  group('overflow probe — 360dp × 1.3, light + dark', () {
    for (final brightness in Brightness.values) {
      testWidgets('no overflow (${brightness.name}) with bn/ta + a long post', (
        tester,
      ) async {
        final fake = FakeStaffroomTransport()
          ..myGroups = [_group(name: 'অষ্টম শ্রেণির বিজ্ঞান শিক্ষকমণ্ডলী')]
          ..feed = [
            _feedPost(
              _post(
                author: 'আশা মুখোপাধ্যায় শিক্ষিকা',
                content:
                    'இன்று எட்டாம் வகுப்பிற்கு பின்னங்களை கற்பிக்கும்போது, '
                    'சப்பாத்தியை வெட்டி நடைமுறை உதாரணம் காட்டினேன்; '
                    'மாணவர்கள் மிகவும் ஆர்வமாக கற்றுக்கொண்டனர். আপনারা কীভাবে পড়ান?',
              ),
              groupName: 'অষ্টম শ্রেণির বিজ্ঞান',
            ),
          ];
        await _pump(
          tester,
          fake: fake,
          surface: const Size(360, 900),
          textScale: 1.3,
          brightness: brightness,
        );
        expect(tester.takeException(), isNull);
      });
    }
  });
}
