import 'dart:ui' show SemanticsFlag;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons/lucide_icons.dart';
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

GroupPost _post({
  String author = 'u-sr',
  int comments = 0,
  String content = 'Taught fractions by cutting chapatis.',
}) => GroupPost(
  id: 'p1',
  groupId: 'g1',
  authorUid: author,
  authorName: 'Suresh Reddy',
  content: content,
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

  testWidgets('the comment icon always shows; the number only with comments', (
    tester,
  ) async {
    await _pump(tester, _post(comments: 12));
    // An icon and the number, read out as "12 comments".
    expect(find.text('12'), findsOneWidget);
    expect(find.bySemanticsLabel('12 comments'), findsOneWidget);

    // With no comments the icon still invites a reply, but shows no number.
    await _pump(tester, _post());
    expect(find.byIcon(LucideIcons.messageCircle), findsOneWidget);
    expect(find.text('0'), findsNothing);
  });

  testWidgets('every post can be shared', (tester) async {
    await _pump(tester, _post());
    expect(find.byKey(const ValueKey('post-share-p1')), findsOneWidget);
    expect(find.text('Share'), findsOneWidget);
  });

  testWidgets('Connect is not on posts: it lives in Your network', (
    tester,
  ) async {
    await _pump(tester, _post());
    expect(find.text('Connect'), findsNothing);

    await _pump(
      tester,
      _post(),
      connections: const MyConnectionData(sentRequestUids: ['u-sr']),
    );
    expect(find.text('Requested'), findsNothing);
  });

  testWidgets('a long post opens folded and Read more shows it all', (
    tester,
  ) async {
    final long = List.filled(60, 'Fractions with chapatis works.').join(' ');
    await _pump(tester, _post(content: long));

    expect(find.text(long), findsNothing);
    expect(find.text('Read more'), findsOneWidget);

    await tester.tap(find.text('Read more'));
    await tester.pumpAndSettle();
    expect(find.text(long), findsOneWidget);
    expect(find.text('Show less'), findsOneWidget);
  });

  testWidgets('a short post shows whole, with no Read more', (tester) async {
    await _pump(tester, _post());
    expect(find.text('Taught fractions by cutting chapatis.'), findsOneWidget);
    expect(find.text('Read more'), findsNothing);
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

  testWidgets('a Daily Briefing opens as a digest, Read all unfolds it', (
    tester,
  ) async {
    const briefing =
        '🗓 Daily Briefing — Thu, 19 Nov\n\n'
        '🤖 Teachers should shape AI policy\n'
        '   A new report says teachers belong at the table.\n'
        '   ↪ Rediff · rediff.com\n\n'
        '📚 New Class 9 social science text\n'
        '   NCERT releases the revised book.\n'
        '   ↪ NCERT · ncert.nic.in';
    await _pump(tester, _post(content: briefing));

    // The digest: lead headline, the rest on one line, and Read all N.
    expect(find.text('Teachers should shape AI policy'), findsOneWidget);
    expect(find.text('Also: New Class 9 social science text'), findsOneWidget);
    expect(find.text('Read all 2 ›'), findsOneWidget);
    expect(find.textContaining('belong at the table'), findsNothing);

    await tester.tap(find.byKey(const ValueKey('post-more-p1')));
    await tester.pumpAndSettle();
    // Unfolded: the whole briefing, summaries and sources included.
    expect(find.textContaining('belong at the table'), findsOneWidget);
    expect(find.text('Show less'), findsOneWidget);
  });

  testWidgets('an attachment shows as a row; only a safe web link opens', (
    tester,
  ) async {
    final post = GroupPost(
      id: 'p2',
      groupId: 'g1',
      authorUid: 'u-sr',
      authorName: 'Suresh Reddy',
      content: 'Sharing the sheet I made.',
      postType: PostType.share,
      createdAt: '2026-11-04T09:00:00Z',
      attachments: const [
        PostAttachment(
          type: 'link',
          url: 'https://ncert.nic.in/sheet',
          title: 'Water cycle activity sheet',
        ),
        // A hostile link: never handed to the OS, so its row is inert.
        PostAttachment(
          type: 'link',
          url: 'javascript:alert(1)',
          title: 'Click me',
        ),
      ],
    );
    await _pump(tester, post);

    expect(find.text('Water cycle activity sheet'), findsOneWidget);
    expect(find.text('ncert.nic.in'), findsOneWidget);
    // The safe link is a button; the javascript: one is not.
    expect(
      tester
          .getSemantics(find.bySemanticsLabel('Water cycle activity sheet'))
          .hasFlag(SemanticsFlag.isButton),
      isTrue,
    );
    expect(
      tester
          .getSemantics(find.bySemanticsLabel('Click me'))
          .hasFlag(SemanticsFlag.isButton),
      isFalse,
    );
  });
}
