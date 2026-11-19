import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/inbox/data/inbox_transport.dart';
import 'package:sahayakai/features/inbox/data/messages_stream_provider.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_providers.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_transport.dart';
import 'package:sahayakai/features/staffroom/data/teacher_profiles.dart';
import 'package:sahayakai/features/staffroom/domain/connection.dart';
import 'package:sahayakai/features/staffroom/domain/group.dart';
import 'package:sahayakai/features/staffroom/domain/teacher.dart';
import 'package:sahayakai/features/staffroom/presentation/community_network_screen.dart';

import '../../support/fake_block_c_transports.dart';

/// "Your network": the count pills, the teacher's groups as a grid, groups to
/// join, teachers to connect with, and the connected teachers' tiles — each
/// section loading and failing on its own, all from the (fake) live routes.

const _me = 'u-me';

Group _group(String id, String name, {int members = 12}) => Group(
  id: id,
  name: name,
  description: '',
  type: GroupType.subjectGrade,
  coverColor: '',
  memberCount: members,
  autoJoinRules: const GroupAutoJoinRules(),
  createdBy: 'system',
);

const _kavita = TeacherSuggestion(
  uid: 'u-kavita',
  displayName: 'KAVITA NAIR',
  subjects: ['Science'],
  gradeLevels: ['Class 8'],
  schoolName: 'Govt. High School, Kochi',
  recommendationReason: 'Science Peer',
);

const _anita = TeacherSuggestion(uid: 'u-anita', displayName: 'anita rao');

/// Names connected uids the way `POST /api/community/profiles` would.
class _Profiles implements TeacherProfileSource {
  const _Profiles(this.byUid);

  final Map<String, TeacherSuggestion> byUid;

  @override
  Future<Map<String, TeacherSuggestion>> lookup(List<String> uids) async => {
    for (final uid in uids)
      if (byUid[uid] != null) uid: byUid[uid]!,
  };
}

/// A route a real `context.push` lands on.
class _Marker extends StatelessWidget {
  const _Marker(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Scaffold(body: Text(text));
}

FakeStaffroomTransport _fullFake() => FakeStaffroomTransport()
  ..myGroups = [
    _group('g1', 'Class 5 Maths', members: 214),
    _group('g2', 'Maharashtra Teachers', members: 312),
    _group('g3', 'Daily Briefing', members: 1284),
  ]
  ..discoverableGroups = [_group('g9', 'Class 5 Science', members: 21)]
  ..recommended = const [_kavita]
  ..connectionData = const MyConnectionData(
    connectedUids: ['u-anita'],
    receivedRequests: [
      ReceivedConnectionRequest(uid: 'u-someone', requestId: 'r1'),
    ],
  );

Future<({FakeStaffroomTransport fake, FakeInboxTransport inbox})> _pump(
  WidgetTester tester, {
  FakeStaffroomTransport? fake,
  String? uid = _me,
  Locale locale = const Locale('en'),
  double textScale = 1.0,
  Size surface = const Size(412, 2400),
  List<Override> extraOverrides = const [],
}) async {
  tester.view.physicalSize = surface;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

  final t = fake ?? _fullFake();
  addTearDown(t.dispose);
  final inbox = FakeInboxTransport();
  addTearDown(inbox.dispose);

  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (_, _) => const CommunityNetworkScreen()),
      GoRoute(
        path: Routes.groupDetailPattern,
        builder: (_, state) => _Marker('GROUP ${state.pathParameters['id']}'),
      ),
      GoRoute(
        path: Routes.conversationThreadPattern,
        builder: (_, state) => _Marker('THREAD ${state.pathParameters['id']}'),
      ),
      GoRoute(path: Routes.login, builder: (_, _) => const _Marker('LOGIN')),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        staffroomTransportProvider.overrideWithValue(t),
        if (uid != null) currentStaffroomUserIdProvider.overrideWithValue(uid),
        inboxTransportProvider.overrideWithValue(inbox),
        currentInboxUserIdProvider.overrideWithValue(uid),
        teacherProfileSourceProvider.overrideWithValue(
          const _Profiles({'u-anita': _anita}),
        ),
        ...extraOverrides,
      ],
      child: MaterialApp.router(
        theme: AppTheme.light(),
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return (fake: t, inbox: inbox);
}

void main() {
  final l10n = lookupAppLocalizations(const Locale('en'));

  group('networkDisplayName', () {
    test('title-cases a name typed all caps or all lower case', () {
      expect(networkDisplayName('ANITA RAO'), 'Anita Rao');
      expect(networkDisplayName('anita rao'), 'Anita Rao');
    });

    test('leaves mixed case and caseless scripts exactly as typed', () {
      expect(networkDisplayName('Anita McRao'), 'Anita McRao');
      expect(networkDisplayName('अनीता राव'), 'अनीता राव');
    });
  });

  testWidgets('signed out → the sign-in note, whose button signs in', (
    tester,
  ) async {
    await _pump(tester, uid: null);
    expect(find.text(l10n.communityYourNetwork), findsOneWidget);
    expect(find.text(l10n.staffroomSignInBody), findsOneWidget);
    await tester.tap(find.text(l10n.actionSignIn));
    await tester.pumpAndSettle();
    expect(find.text('LOGIN'), findsOneWidget);
  });

  testWidgets('the title, and the count pills the reads really give', (
    tester,
  ) async {
    await _pump(tester);
    expect(find.text(l10n.communityYourNetwork), findsOneWidget);
    expect(find.text(l10n.cmNetSubtitle), findsOneWidget);
    expect(find.text(l10n.cmNetGroupCount(3)), findsOneWidget);
    expect(find.text(l10n.cmGroupTeacherCount(1)), findsOneWidget);
    expect(find.text(l10n.communityRequestsWaiting(1)), findsOneWidget);
  });

  testWidgets('no requests waiting → no requests pill', (tester) async {
    await _pump(
      tester,
      fake: _fullFake()..connectionData = const MyConnectionData(),
    );
    expect(find.text(l10n.communityRequestsWaiting(0)), findsNothing);
    expect(find.text(l10n.cmGroupTeacherCount(0)), findsOneWidget);
  });

  testWidgets('your groups: a tile per group; a tap opens the group', (
    tester,
  ) async {
    await _pump(tester);
    expect(find.text(l10n.cmNetYourGroups(3).toUpperCase()), findsOneWidget);
    expect(find.text('Class 5 Maths'), findsOneWidget);
    expect(find.text(l10n.cmGroupTeacherCount(214)), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('network-group-g2')));
    await tester.pumpAndSettle();
    expect(find.text('GROUP g2'), findsOneWidget);
  });

  testWidgets('no groups yet → the empty note', (tester) async {
    await _pump(tester, fake: _fullFake()..myGroups = const []);
    expect(find.text(l10n.staffroomGroupsEmptyTitle), findsOneWidget);
    expect(find.text(l10n.cmNetGroupCount(0)), findsOneWidget);
  });

  testWidgets('groups for you: Join joins, then reads "Joined"', (
    tester,
  ) async {
    final (:fake, inbox: _) = await _pump(tester);
    expect(find.text(l10n.cmNetGroupsForYou.toUpperCase()), findsOneWidget);
    final row = find.byKey(const ValueKey('network-suggested-g9'));
    expect(
      find.descendant(of: row, matching: find.text('Class 5 Science')),
      findsOneWidget,
    );
    await tester.tap(
      find.descendant(of: row, matching: find.text(l10n.staffroomJoin)),
    );
    await tester.pumpAndSettle();
    expect(fake.joinedGroups, ['g9']);
    expect(
      find.descendant(of: row, matching: find.text(l10n.staffroomJoined)),
      findsOneWidget,
    );
  });

  testWidgets('a failed section shows a retry; the others still show', (
    tester,
  ) async {
    await _pump(
      tester,
      extraOverrides: [
        discoverGroupsProvider.overrideWith(
          (ref) => Future<List<Group>>.error(StateError('offline')),
        ),
      ],
    );
    expect(find.text(l10n.communityNetworkLoadFailed), findsOneWidget);
    expect(find.text(l10n.actionRetry), findsOneWidget);
    expect(find.text('Class 5 Maths'), findsOneWidget);
    expect(find.text('Kavita Nair'), findsOneWidget);
  });

  testWidgets('teachers you may know: profile facts, reason, and Connect', (
    tester,
  ) async {
    final (:fake, inbox: _) = await _pump(tester);
    expect(
      find.text(l10n.cmNetTeachersYouMayKnow.toUpperCase()),
      findsOneWidget,
    );
    // Typed all caps, shown in title case.
    expect(find.text('Kavita Nair'), findsOneWidget);
    expect(find.text('KAVITA NAIR'), findsNothing);
    expect(
      find.text('Science · Class 8 · Govt. High School, Kochi'),
      findsOneWidget,
    );
    expect(
      find.text(l10n.communityReasonSubjectPeer('Science')),
      findsOneWidget,
    );

    final row = find.byKey(const ValueKey('network-person-u-kavita'));
    await tester.tap(
      find.descendant(of: row, matching: find.text(l10n.staffroomConnect)),
    );
    await tester.pumpAndSettle();
    expect(fake.connectionRequests, ['u-kavita']);
  });

  testWidgets('your teachers: a tile opens the DM', (tester) async {
    final (fake: _, :inbox) = await _pump(tester);
    expect(find.text(l10n.cmNetYourTeachers(1).toUpperCase()), findsOneWidget);
    final tile = find.byKey(const ValueKey('network-connection-u-anita'));
    expect(
      find.descendant(of: tile, matching: find.text('Anita Rao')),
      findsOneWidget,
    );
    await tester.tap(
      find.descendant(of: tile, matching: find.text(l10n.staffroomMessage)),
    );
    await tester.pumpAndSettle();
    expect(inbox.directConversationRequests, ['u-anita']);
    expect(find.text('THREAD a_b'), findsOneWidget);
  });

  testWidgets('your teachers: press and hold → confirm → disconnect', (
    tester,
  ) async {
    final (:fake, inbox: _) = await _pump(tester);
    await tester.longPress(
      find.byKey(const ValueKey('network-connection-u-anita')),
    );
    await tester.pumpAndSettle();
    expect(find.text(l10n.staffroomDisconnectConfirmTitle), findsOneWidget);
    await tester.tap(find.text(l10n.staffroomDisconnect));
    await tester.pumpAndSettle();
    expect(fake.disconnected, ['u-anita']);
  });

  testWidgets('no connections → no "Your teachers" section', (tester) async {
    await _pump(
      tester,
      fake: _fullFake()..connectionData = const MyConnectionData(),
    );
    expect(find.text(l10n.cmNetYourTeachers(0).toUpperCase()), findsNothing);
  });

  group('overflow probe — 360dp × 1.3', () {
    for (final code in ['hi', 'ta', 'ml']) {
      testWidgets('no overflow ($code)', (tester) async {
        final fake = _fullFake()
          ..myGroups = [
            _group('g1', 'எட்டாம் வகுப்பு அறிவியல் ஆசிரியர்கள் குழு'),
            _group('g2', 'മഹാരാഷ്ട്ര സംസ്ഥാന അധ്യാപക കൂട്ടായ്മ', members: 1284),
            _group('g3', 'कक्षा 5 गणित'),
          ]
          ..discoverableGroups = [
            _group('g9', 'ഏഴാം ക്ലാസ് സാമൂഹ്യശാസ്ത്രം അധ്യാപകർ', members: 999),
          ]
          ..recommended = const [
            TeacherSuggestion(
              uid: 'u-kavita',
              displayName: 'ശ്രീലക്ഷ്മി രാധാകൃഷ്ണൻ നായർ',
              subjects: ['സാമൂഹ്യശാസ്ത്രം'],
              gradeLevels: ['ക്ലാസ് 8'],
              schoolName: 'ഗവൺമെന്റ് ഹയർ സെക്കൻഡറി സ്കൂൾ, തിരുവനന്തപുരം',
              recommendationReason: 'Same School',
            ),
          ];
        await _pump(
          tester,
          fake: fake,
          locale: Locale(code),
          textScale: 1.3,
          surface: const Size(360, 3000),
        );
        expect(tester.takeException(), isNull);
        expect(find.text('ശ്രീലക്ഷ്മി രാധാകൃഷ്ണൻ നായർ'), findsOneWidget);
      });
    }
  });
}
