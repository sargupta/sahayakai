import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/inbox/data/block_c_transport.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_providers.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_transport.dart';
import 'package:sahayakai/features/staffroom/domain/group.dart';
import 'package:sahayakai/features/staffroom/presentation/group_detail_screen.dart';
import 'package:sahayakai/features/staffroom/presentation/staffroom_screen.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';

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
}) =>
    Group(
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
  String content = 'inside the group',
  int likes = 2,
}) =>
    GroupPost(
      id: id,
      groupId: 'g1',
      authorUid: 'u1',
      authorName: 'Asha',
      content: content,
      postType: PostType.share,
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
        theme:
            brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
        locale: const Locale('en'),
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

void main() {
  setUp(() => GoogleFonts.config.allowRuntimeFetching = false);

  final l10n = _en();

  testWidgets('null uid → sign-in EmptyView', (tester) async {
    await _pump(tester, fake: FakeStaffroomTransport()..group = _group(), uid: null);
    expect(find.text(l10n.staffroomSignInBody), findsOneWidget);
  });

  testWidgets('renders the header (name, member count, description) + posts',
      (tester) async {
    final fake = FakeStaffroomTransport()
      ..group = _group()
      ..myGroups = [_group()] // a member
      ..groupPosts = [_post(content: 'a member-gated post body')];
    await _pump(tester, fake: fake);

    expect(find.text('Class 8 Science'), findsWidgets); // app bar + header
    expect(find.text(l10n.staffroomMemberCount(42)), findsOneWidget);
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

  testWidgets('member-gated: a Forbidden posts read → the locked preview',
      (tester) async {
    final fake = FakeStaffroomTransport()
      ..group = _group()
      ..myGroups = const []; // NOT a member
    await _pump(
      tester,
      fake: fake,
      extraOverrides: [
        groupPostsProvider('g1').overrideWith(
          (ref) => Future<List<GroupPost>>.error(StateError('Forbidden')),
        ),
      ],
    );
    expect(find.text(l10n.staffroomGroupLockedTitle), findsOneWidget);
    expect(find.byType(EmptyView), findsOneWidget);
  });

  group('optimistic join', () {
    testWidgets('flips to "Joined" + bumps the count immediately, reconciles',
        (tester) async {
      final gate = Completer<void>();
      final fake = FakeStaffroomTransport()
        ..group = _group(members: 42)
        ..myGroups = const [] // not a member
        ..groupPosts = const []
        ..joinResult = true
        ..joinGate = gate;
      await _pump(tester, fake: fake);

      expect(find.text(l10n.staffroomJoin), findsOneWidget);
      expect(find.text(l10n.staffroomMemberCount(42)), findsOneWidget);

      await tester.tap(find.text(l10n.staffroomJoin));
      await tester.pump(); // optimistic, before the gated reply resolves
      expect(find.text(l10n.staffroomJoined), findsOneWidget);
      expect(find.text(l10n.staffroomMemberCount(43)), findsOneWidget);

      gate.complete();
      await tester.pumpAndSettle(); // reconcile (joinResult true → stays Joined)
      expect(find.text(l10n.staffroomJoined), findsOneWidget);
      expect(fake.joinedGroups.single, 'g1');
    });

    testWidgets('rolls back + hints on a thrown TransportUnavailable',
        (tester) async {
      final fake = FakeStaffroomTransport()
        ..group = _group(members: 42)
        ..myGroups = const []
        ..groupPosts = const []
        ..joinError = const TransportUnavailable.awaitingFirebase('joinGroup');
      await _pump(tester, fake: fake);

      await tester.tap(find.text(l10n.staffroomJoin));
      await tester.pumpAndSettle(); // apply → throw → rollback

      expect(find.text(l10n.staffroomJoin), findsOneWidget); // back to Join
      expect(find.text(l10n.staffroomJoinFailed), findsOneWidget); // hint
      expect(find.text(l10n.staffroomMemberCount(42)), findsOneWidget); // 42
    });
  });

  testWidgets('tapping a group in the "Your groups" strip → group detail posts',
      (tester) async {
    final fake = FakeStaffroomTransport()
      ..group = _group(name: 'Class 8 Science')
      ..myGroups = [_group(name: 'Class 8 Science')] // shows the strip chip
      ..feed = const [] // ready, quiet feed
      ..groupPosts = [_post(content: 'a post inside the group')];
    await _pump(tester, fake: fake, initialLocation: Routes.staffroom);

    // The "Your groups" strip chip is present; tap it.
    await tester.tap(find.byKey(const ValueKey<String>('group-chip-g1')));
    await tester.pumpAndSettle();

    expect(find.byType(GroupDetailScreen), findsOneWidget);
    expect(find.text('a post inside the group'), findsOneWidget);
  });
}
