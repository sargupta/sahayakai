import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_providers.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_transport.dart';
import 'package:sahayakai/features/staffroom/domain/connection.dart';
import 'package:sahayakai/features/staffroom/domain/group.dart';
import 'package:sahayakai/features/staffroom/presentation/widgets/feed_post_card.dart';

import '../../support/fake_block_c_transports.dart';

/// The Staffroom post card as the UX map draws it: two-initial avatar, the
/// real comment count, and Connect only where it is true.
const _me = 'u-me';

GroupPost _post({String author = 'u-sr', int comments = 0}) => GroupPost(
  id: 'p1',
  groupId: 'g1',
  authorUid: author,
  authorName: 'Suresh Reddy',
  content: 'Taught fractions by cutting chapatis.',
  postType: PostType.share,
  likesCount: 4,
  commentsCount: comments,
  createdAt: '2026-11-04T09:00:00Z',
);

Future<void> _pump(
  WidgetTester tester,
  GroupPost post, {
  MyConnectionData connections = const MyConnectionData(),
}) async {
  final fake = FakeStaffroomTransport()..connectionData = connections;
  addTearDown(fake.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
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
}

void main() {
  testWidgets('the avatar shows two initials', (tester) async {
    await _pump(tester, _post());
    expect(find.text('SR'), findsOneWidget);
  });

  testWidgets('the comment count shows only when there are comments', (
    tester,
  ) async {
    await _pump(tester, _post(comments: 12));
    expect(find.text('12 comments'), findsOneWidget);

    await _pump(tester, _post());
    expect(find.textContaining('comment'), findsNothing);
  });

  testWidgets("Connect shows on another teacher's post when not connected", (
    tester,
  ) async {
    await _pump(tester, _post());
    expect(find.text('Connect'), findsOneWidget);
  });

  testWidgets('a request already sent reads "Requested"', (tester) async {
    await _pump(
      tester,
      _post(),
      connections: const MyConnectionData(sentRequestUids: ['u-sr']),
    );
    expect(find.text('Requested'), findsOneWidget);
    expect(find.text('Connect'), findsNothing);
  });

  testWidgets('no Connect for someone already connected', (tester) async {
    await _pump(
      tester,
      _post(),
      connections: const MyConnectionData(connectedUids: ['u-sr']),
    );
    expect(find.text('Connect'), findsNothing);
    expect(find.text('Requested'), findsNothing);
  });

  testWidgets('a request from the author is not answered from the feed', (
    tester,
  ) async {
    await _pump(
      tester,
      _post(),
      connections: const MyConnectionData(
        receivedRequests: [
          ReceivedConnectionRequest(uid: 'u-sr', requestId: 'r1'),
        ],
      ),
    );
    expect(find.text('Accept'), findsNothing);
    expect(find.text('Connect'), findsNothing);
  });

  testWidgets('no Connect on my own post', (tester) async {
    await _pump(tester, _post(author: _me));
    expect(find.text('Connect'), findsNothing);
  });
}
