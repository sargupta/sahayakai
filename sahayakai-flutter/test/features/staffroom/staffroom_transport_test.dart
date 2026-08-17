import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/inbox/data/block_c_transport.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_transport.dart';
import 'package:sahayakai/features/staffroom/domain/chat_message.dart';
import 'package:sahayakai/features/staffroom/domain/connection.dart';
import 'package:sahayakai/features/staffroom/domain/group.dart';
import 'package:sahayakai/features/staffroom/domain/persona_pulse.dart';
import 'package:sahayakai/features/staffroom/domain/staffroom_results.dart';

import '../../support/fake_block_c_transports.dart';

/// Contract tests for the Staffroom transport seam (U-SI0): the DEFERRED impl
/// keeps the APK green (chat streams emit `awaitingFirebase`, reads are empty,
/// writes throw typed, persona-pulse quietly disarms), and the FAKE impl is a
/// usable contract for U-SI2..U-SI4.
void main() {
  group('DeferredStaffroomTransport — keeps the APK green (no Firebase)', () {
    const transport = DeferredStaffroomTransport();

    test('both chat streams emit an awaitingFirebase empty snapshot', () async {
      final staff = await transport.watchStaffRoomChat().first;
      expect(staff.isAwaitingFirebase, isTrue);
      expect(staff.data, isEmpty);

      final group = await transport.watchGroupChat('g1').first;
      expect(group.isAwaitingFirebase, isTrue);
    });

    test('server-derived reads return safe empties / nulls', () async {
      expect(await transport.ensureUserGroups(), isEmpty);
      expect(await transport.getMyGroups(), isEmpty);
      expect(await transport.getGroup('g1'), isNull);
      expect(await transport.discoverGroups(), isEmpty);
      expect(await transport.getGroupPosts('g1'), isEmpty);
      expect(await transport.getUnifiedFeed(), isEmpty);
      expect(await transport.getRecommendedTeachers(), isEmpty);
      expect(await transport.getAllTeachers(), isEmpty);
      expect(await transport.getPublicProfile('u1'), isNull);
      expect((await transport.getLikedItemIds()).groupPostIds, isEmpty);
      expect((await transport.getMyConnectionData()).connectedUids, isEmpty);
    });

    test('every write throws a typed TransportUnavailable', () async {
      Future<void> expectUnavailable(Future<void> Function() op) =>
          expectLater(op, throwsA(isA<TransportUnavailable>()));

      await expectUnavailable(() => transport.joinGroup('g1'));
      await expectUnavailable(() => transport.leaveGroup('g1'));
      await expectUnavailable(
        () => transport.createGroupPost(
          groupId: 'g1',
          content: 'x',
          postType: PostType.share,
        ),
      );
      await expectUnavailable(() => transport.likeGroupPost('g1', 'p1'));
      await expectUnavailable(
        () => transport.sendGroupChatMessage('g1', text: 'hi'),
      );
      await expectUnavailable(
        () => transport.sendCommunityChatMessage(text: 'hi'),
      );
      await expectUnavailable(() => transport.sendConnectionRequest('u2'));
      await expectUnavailable(() => transport.acceptConnectionRequest('r1'));
      await expectUnavailable(() => transport.declineConnectionRequest('r1'));
      await expectUnavailable(() => transport.disconnect('u2'));
      await expectUnavailable(() => transport.followTeacher('u2'));
    });

    test(
      'triggerPersonaPulse returns null (503-equivalent stop, NOT an error)',
      () async {
        final result = await transport.triggerPersonaPulse(
          const PersonaPulseRequest(),
        );
        expect(result, isNull);
      },
    );
  });

  group('staffroomTransportProvider — binds the deferred impl', () {
    test(
      'resolves to DeferredStaffroomTransport (Firebase not configured)',
      () {
        final container = ProviderContainer();
        addTearDown(container.dispose);
        expect(
          container.read(staffroomTransportProvider),
          isA<DeferredStaffroomTransport>(),
        );
      },
    );

    test('a UI unit can override with the fake', () async {
      final fake = FakeStaffroomTransport()
        ..myGroups = const [
          Group(
            id: 'g1',
            name: 'Class 8 Science',
            description: 'd',
            type: GroupType.subjectGrade,
            coverColor: '',
            memberCount: 10,
            autoJoinRules: GroupAutoJoinRules(),
            createdBy: 'system',
          ),
        ];
      addTearDown(fake.dispose);
      final container = ProviderContainer(
        overrides: [staffroomTransportProvider.overrideWithValue(fake)],
      );
      addTearDown(container.dispose);

      final groups = await container
          .read(staffroomTransportProvider)
          .getMyGroups();
      expect(groups.single.name, 'Class 8 Science');
    });
  });

  group('FakeStaffroomTransport — drives streams + records writes', () {
    test('staff-room chat stream seeds then pushes new messages', () async {
      final fake = FakeStaffroomTransport();
      addTearDown(fake.dispose);

      final seen = <TransportSnapshot<List<ChatMessage>>>[];
      final sub = fake.watchStaffRoomChat().listen(seen.add);
      await Future<void>.delayed(Duration.zero);

      fake.emitStaffRoomChat(
        const TransportSnapshot<List<ChatMessage>>.ready([
          ChatMessage(
            id: 'c1',
            text: 'Namaste',
            authorId: 'u1',
            authorName: 'Asha',
          ),
        ]),
      );
      await Future<void>.delayed(Duration.zero);
      await sub.cancel();

      expect(seen.first.isReady, isTrue); // seeded empty ready
      expect(seen.last.data.single.text, 'Namaste');
    });

    test('like toggle records + returns the configured server reply', () async {
      final fake = FakeStaffroomTransport()
        ..likeResult = const LikeResult(isLiked: true, newCount: 7);
      addTearDown(fake.dispose);
      final result = await fake.likeGroupPost('g1', 'p1');
      expect(result.isLiked, isTrue);
      expect(result.newCount, 7);
      expect(fake.likes.single, (groupId: 'g1', postId: 'p1'));
    });

    test(
      'connection request records + returns the configured status',
      () async {
        final fake = FakeStaffroomTransport()
          ..connectionRequestResult = ConnectionRequestResult.alreadyPending;
        addTearDown(fake.dispose);
        final status = await fake.sendConnectionRequest('u2');
        expect(status, ConnectionRequestResult.alreadyPending);
        expect(fake.connectionRequests, ['u2']);
      },
    );

    test('community + group chat sends are distinguished by groupId', () async {
      final fake = FakeStaffroomTransport();
      addTearDown(fake.dispose);
      await fake.sendCommunityChatMessage(text: 'global');
      await fake.sendGroupChatMessage('g1', text: 'in group');
      expect(fake.sentChats, [
        (groupId: null, text: 'global'),
        (groupId: 'g1', text: 'in group'),
      ]);
    });

    test(
      'persona pulse records the request + returns the configured result',
      () async {
        final fake = FakeStaffroomTransport()
          ..personaPulseResult = const PersonaPulse(message: 'Hello teachers');
        addTearDown(fake.dispose);
        final result = await fake.triggerPersonaPulse(
          const PersonaPulseRequest(),
        );
        expect(result!.message, 'Hello teachers');
        expect(fake.personaPulses, hasLength(1));
      },
    );
  });
}
