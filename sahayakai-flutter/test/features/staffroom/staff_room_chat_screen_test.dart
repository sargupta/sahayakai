import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/inbox/data/block_c_transport.dart';
import 'package:sahayakai/features/staffroom/data/chat_stream_provider.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_providers.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_transport.dart';
import 'package:sahayakai/features/staffroom/domain/chat_message.dart';
import 'package:sahayakai/features/staffroom/presentation/staff_room_chat_screen.dart';
import 'package:sahayakai/features/staffroom/presentation/widgets/staffroom_avatar.dart';
import 'package:sahayakai/shared/widgets/app_skeleton.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';
import 'package:sahayakai/shared/widgets/error_view.dart';

import '../../support/fake_block_c_transports.dart';

/// U-SI3 — the Staff Room chat, driven by the fake transport (no Firebase).
/// Own vs others vs AI-persona bubbles, the state→surface mapping, the optimistic
/// send (append → reconcile on the stream echo / rollback + retry on a thrown
/// TransportUnavailable), and a group chat by groupId. The persona-pulse timer
/// discipline is covered separately in `persona_pulse_controller_test.dart` (fake
/// time); here the community screen simply must not leak its keep-warm Timer, so
/// `_pump` unmounts at teardown.

const _me = 'u-me';
const _other = 'u-bina';

ChatMessage _msg({
  required String id,
  required String text,
  required String authorId,
  String authorName = '',
  bool persona = false,
  String? createdAt = '2026-07-19T11:00:00Z',
}) =>
    ChatMessage(
      id: id,
      text: text,
      authorId: authorId,
      authorName: authorName,
      isDemoPersona: persona,
      createdAt: createdAt,
    );

Future<FakeStaffroomTransport> _pump(
  WidgetTester tester, {
  ChatRoom room = const ChatRoom.community(),
  TransportSnapshot<List<ChatMessage>>? chat,
  String? myUid = _me,
  Object? sendError,
  String? title,
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  Size surface = const Size(390, 1200),
  Locale locale = const Locale('en'),
}) async {
  tester.view.physicalSize = surface;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

  final fake = FakeStaffroomTransport()..sendChatError = sendError;
  addTearDown(fake.dispose);
  // Unmount at teardown so the persona keep-warm Timer (armed for a ready
  // community chat) is cancelled before the pending-timer check — proof of the
  // cancel-on-dispose discipline, and a clean test exit.
  addTearDown(() async => tester.pumpWidget(const SizedBox.shrink()));

  if (chat != null) {
    if (room.isCommunity) {
      fake.emitStaffRoomChat(chat);
    } else {
      fake.emitGroupChat(room.groupId!, chat);
    }
  }

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        staffroomTransportProvider.overrideWithValue(fake),
        if (myUid != null)
          currentStaffroomUserIdProvider.overrideWithValue(myUid),
      ],
      child: MaterialApp(
        theme:
            brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: StaffRoomChatScreen(room: room, title: title),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return fake;
}

AppLocalizations _en() => lookupAppLocalizations(const Locale('en'));

void main() {
  setUp(() => GoogleFonts.config.allowRuntimeFetching = false);
  final l10n = _en();

  group('bubbles', () {
    testWidgets('own (no author header) vs others (avatar + author header)',
        (tester) async {
      await _pump(
        tester,
        chat: TransportSnapshot<List<ChatMessage>>.ready([
          _msg(
            id: 'm1',
            text: 'Notes are ready',
            authorId: _other,
            authorName: 'Bina Devi',
          ),
          _msg(id: 'm2', text: 'Thank you Bina', authorId: _me, authorName: 'Me'),
        ]),
      );

      expect(find.text('Notes are ready'), findsOneWidget); // theirs
      expect(find.text('Thank you Bina'), findsOneWidget); // mine
      // Others carry an author header (name + avatar); mine carries neither.
      expect(find.text('Bina Devi'), findsOneWidget);
      expect(find.text('Me'), findsNothing);
      expect(find.byType(StaffroomAvatar), findsOneWidget); // only the other's
    });

    testWidgets('AI persona bubble is honestly labelled + distinct (no avatar)',
        (tester) async {
      await _pump(
        tester,
        chat: TransportSnapshot<List<ChatMessage>>.ready([
          _msg(
            id: 'p1',
            text: 'Try a chapati fraction demo!',
            authorId: 'persona-1',
            authorName: 'Meera',
            persona: true,
          ),
        ]),
      );

      expect(find.text('Try a chapati fraction demo!'), findsOneWidget);
      expect(find.text('Meera'), findsOneWidget); // the persona name
      // Honest AI label present…
      expect(find.text(l10n.staffroomChatAiBadge), findsOneWidget);
      // …and it is rendered distinctly (sparkles glyph), NOT with a teacher's
      // StaffroomAvatar — never posing as a real teacher.
      expect(find.byIcon(LucideIcons.sparkles), findsWidgets);
      expect(find.byType(StaffroomAvatar), findsNothing);
    });
  });

  group('state → surface', () {
    testWidgets('awaitingFirebase → sign-in EmptyView, composer hidden',
        (tester) async {
      await _pump(
        tester,
        chat: const TransportSnapshot<List<ChatMessage>>.awaitingFirebase(
          <ChatMessage>[],
        ),
      );
      expect(find.text(l10n.staffroomChatSignInBody), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
    });

    testWidgets('null uid → sign-in EmptyView, composer hidden', (tester) async {
      await _pump(
        tester,
        myUid: null,
        chat: TransportSnapshot<List<ChatMessage>>.ready([
          _msg(id: 'm1', text: 'hello', authorId: _other, authorName: 'Bina'),
        ]),
      );
      expect(find.text(l10n.staffroomChatSignInBody), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
    });

    testWidgets('ready empty → "be the first" EmptyView, composer shown',
        (tester) async {
      await _pump(
        tester,
        chat: const TransportSnapshot<List<ChatMessage>>.ready(<ChatMessage>[]),
      );
      expect(find.text(l10n.staffroomChatEmptyBody), findsOneWidget);
      expect(find.byType(EmptyView), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget); // can still say hello
    });

    testWidgets('error → ErrorView with retry', (tester) async {
      await _pump(
        tester,
        chat: TransportSnapshot<List<ChatMessage>>.error(
          const <ChatMessage>[],
          StateError('missing index'),
        ),
      );
      expect(find.byType(ErrorView), findsOneWidget);
      expect(find.text(l10n.staffroomErrorBody), findsOneWidget);
      expect(find.text(l10n.actionRetry), findsOneWidget);
    });

    testWidgets('loading → AppSkeleton', (tester) async {
      // No emitted snapshot: the StreamProvider is in AsyncLoading before its
      // first value.
      final fake = FakeStaffroomTransport();
      addTearDown(fake.dispose);
      addTearDown(() async => tester.pumpWidget(const SizedBox.shrink()));
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(
        tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            staffroomTransportProvider.overrideWithValue(fake),
            currentStaffroomUserIdProvider.overrideWithValue(_me),
            // Hold the stream in AsyncLoading (never emits a first value).
            staffRoomChatProvider.overrideWith(
              (ref) => const Stream<
                  TransportSnapshot<List<ChatMessage>>>.empty(),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            locale: const Locale('en'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const StaffRoomChatScreen(room: ChatRoom.community()),
          ),
        ),
      );
      await tester.pump();
      expect(find.byType(AppSkeleton), findsOneWidget);
    });
  });

  group('optimistic send', () {
    testWidgets('appends a pending bubble, records the send, reconciles on echo',
        (tester) async {
      final fake = await _pump(
        tester,
        chat: const TransportSnapshot<List<ChatMessage>>.ready(<ChatMessage>[]),
      );

      await tester.enterText(find.byType(TextField), 'Hello room');
      await tester.pump();
      await tester.tap(find.byIcon(LucideIcons.send));
      await tester.pumpAndSettle();

      // The community send was recorded (groupId null) and the optimistic bubble
      // is on screen.
      expect(fake.sentChats, hasLength(1));
      expect(fake.sentChats.single.groupId, isNull);
      expect(fake.sentChats.single.text, 'Hello room');
      expect(find.text('Hello room'), findsOneWidget);

      // The live stream now carries the server echo (same author + text, a new
      // id): it must reconcile (dedup), not duplicate.
      fake.emitStaffRoomChat(
        TransportSnapshot<List<ChatMessage>>.ready([
          _msg(
            id: 'srv-1',
            text: 'Hello room',
            authorId: _me,
            authorName: 'Me',
            createdAt: '2026-07-19T12:00:00Z',
          ),
        ]),
      );
      await tester.pumpAndSettle();
      expect(find.text('Hello room'), findsOneWidget);
    });

    testWidgets('a thrown TransportUnavailable rolls back + inline retry',
        (tester) async {
      final fake = await _pump(
        tester,
        chat: const TransportSnapshot<List<ChatMessage>>.ready(<ChatMessage>[]),
        sendError: const TransportUnavailable.awaitingFirebase(
          'sendCommunityChatMessage',
        ),
      );

      await tester.enterText(find.byType(TextField), 'Oops offline');
      await tester.pump();
      await tester.tap(find.byIcon(LucideIcons.send));
      await tester.pumpAndSettle();

      // The attempt was made, the optimistic bubble rolled back, and a dignified
      // inline retry is offered — not a crash.
      expect(fake.sentChats, hasLength(1));
      expect(find.text('Oops offline'), findsNothing);
      expect(find.text(l10n.inboxSendFailed), findsOneWidget);
      expect(find.text(l10n.actionRetry), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('retry re-sends the same message (idempotent) after clearing',
        (tester) async {
      final fake = await _pump(
        tester,
        chat: const TransportSnapshot<List<ChatMessage>>.ready(<ChatMessage>[]),
        sendError: const TransportUnavailable.awaitingFirebase(
          'sendCommunityChatMessage',
        ),
      );

      await tester.enterText(find.byType(TextField), 'Retry me');
      await tester.pump();
      await tester.tap(find.byIcon(LucideIcons.send));
      await tester.pumpAndSettle();
      expect(fake.sentChats, hasLength(1));

      fake.sendChatError = null; // the retry will succeed
      await tester.tap(find.text(l10n.actionRetry));
      await tester.pumpAndSettle();

      expect(fake.sentChats, hasLength(2));
      expect(fake.sentChats.last.text, 'Retry me');
      expect(find.text('Retry me'), findsOneWidget); // re-appended optimistic
    });
  });

  group('group chat', () {
    testWidgets('renders a group message + the group name title; send targets it',
        (tester) async {
      final fake = await _pump(
        tester,
        room: const ChatRoom.group('g1'),
        title: 'Class 8 Science',
        chat: TransportSnapshot<List<ChatMessage>>.ready([
          _msg(
            id: 'gm1',
            text: 'Anyone tried the volcano demo?',
            authorId: _other,
            authorName: 'Bina Devi',
          ),
        ]),
      );

      expect(find.text('Class 8 Science'), findsOneWidget); // app-bar title
      expect(find.text('Anyone tried the volcano demo?'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'Not yet!');
      await tester.pump();
      await tester.tap(find.byIcon(LucideIcons.send));
      await tester.pumpAndSettle();

      // The send targets THIS group (groupId g1), not the community room.
      expect(fake.sentChats, hasLength(1));
      expect(fake.sentChats.single.groupId, 'g1');
      expect(fake.sentChats.single.text, 'Not yet!');
    });
  });

  group('overflow probe — 360dp × 1.3, light + dark', () {
    for (final brightness in Brightness.values) {
      testWidgets('no overflow (${brightness.name}) with bn/ta + persona',
          (tester) async {
        await _pump(
          tester,
          surface: const Size(360, 800),
          textScale: 1.3,
          brightness: brightness,
          chat: TransportSnapshot<List<ChatMessage>>.ready([
            _msg(
              id: 'm1',
              authorId: _other,
              authorName: 'আশা মুখোপাধ্যায় শিক্ষিকা',
              text: 'আগামীকাল স্টাফ মিটিংয়ে আপনার তৈরি করা পাঠ পরিকল্পনা এবং '
                  'মূল্যায়নের নোটগুলি অনুগ্রহ করে সঙ্গে নিয়ে আসবেন।',
            ),
            _msg(
              id: 'm2',
              authorId: _me,
              authorName: 'Me',
              text: 'நாளை ஆசிரியர் கூட்டத்திற்கு உங்கள் பாடத் திட்டத்தையும் '
                  'மதிப்பீட்டுக் குறிப்புகளையும் தயவுசெய்து கொண்டு வாருங்கள்.',
            ),
            _msg(
              id: 'p1',
              authorId: 'persona-1',
              authorName: 'মীরা',
              persona: true,
              text: 'দারুণ আইডিয়া! ভগ্নাংশ শেখাতে রুটি কেটে দেখানো যেতে পারে।',
            ),
          ]),
        );
        expect(tester.takeException(), isNull);
      });
    }
  });
}
