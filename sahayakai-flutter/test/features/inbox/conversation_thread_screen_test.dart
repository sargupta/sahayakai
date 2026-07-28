import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/inbox/data/block_c_transport.dart';
import 'package:sahayakai/features/inbox/data/inbox_transport.dart';
import 'package:sahayakai/features/inbox/data/messages_stream_provider.dart';
import 'package:sahayakai/features/inbox/domain/conversation_id.dart';
import 'package:sahayakai/features/inbox/domain/inbox_models.dart';
import 'package:sahayakai/features/inbox/presentation/conversation_thread_screen.dart';

import '../../support/fake_block_c_transports.dart';

/// U-SI1 — the conversation thread, driven by the fake transport. Covers mine
/// vs theirs bubbles, mark-read on open, honest pagination, and the optimistic
/// send (reconcile on success / roll back + retry on a typed TransportUnavailable).

const _me = 'u-me';
const _other = 'u-bina';
final _id = ConversationId('${_other}_$_me');

Conversation _convo() => Conversation(
      id: _id,
      type: ConversationType.direct,
      participantIds: const [_other, _me],
      participants: {
        _other: const ParticipantSnapshot(displayName: 'Bina Devi'),
        _me: const ParticipantSnapshot(displayName: 'Me'),
      },
      lastMessage: 'hi',
      lastMessageSenderId: _other,
      unreadCount: const {_me: 1},
    );

Message _msg({
  required String id,
  required String text,
  required String senderId,
  List<String> readBy = const [],
  String createdAt = '2026-07-19T11:00:00Z',
}) =>
    Message(
      id: id,
      type: MessageType.text,
      text: text,
      senderId: senderId,
      senderName: senderId == _other ? 'Bina Devi' : 'Me',
      readBy: readBy,
      createdAt: createdAt,
    );

Future<FakeInboxTransport> _pump(
  WidgetTester tester, {
  TransportSnapshot<List<Message>>? thread,
  String? myUid = _me,
  Object? sendError,
  List<Message> older = const <Message>[],
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

  final fake = FakeInboxTransport()
    ..sendMessageError = sendError
    ..olderMessages = older;
  addTearDown(fake.dispose);
  if (thread != null) fake.emitThread(_id, thread);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        inboxTransportProvider.overrideWithValue(fake),
        if (myUid != null)
          currentInboxUserIdProvider.overrideWithValue(myUid),
      ],
      child: MaterialApp(
        theme:
            brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: ConversationThreadScreen(
          conversationId: _id,
          conversation: _convo(),
        ),
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

  testWidgets('renders seeded messages: mine (with a read tick) vs theirs',
      (tester) async {
    await _pump(
      tester,
      thread: TransportSnapshot<List<Message>>.ready([
        _msg(id: 'm1', text: 'Notes are ready', senderId: _other),
        _msg(id: 'm2', text: 'Thank you Bina', senderId: _me, readBy: [_other]),
      ]),
    );

    expect(find.text('Notes are ready'), findsOneWidget); // theirs
    expect(find.text('Thank you Bina'), findsOneWidget); // mine
    // My message carries a read receipt (double check); their message has none.
    expect(find.byIcon(LucideIcons.checkCheck), findsOneWidget);
  });

  testWidgets('markConversationRead fires once on open', (tester) async {
    final fake = await _pump(
      tester,
      thread: const TransportSnapshot<List<Message>>.ready(<Message>[]),
    );
    expect(fake.markedRead, [_id]);
  });

  testWidgets('awaitingFirebase → sign-in, composer hidden', (tester) async {
    await _pump(
      tester,
      thread: const TransportSnapshot<List<Message>>.awaitingFirebase(
        <Message>[],
      ),
    );
    expect(find.text(l10n.inboxSignInBody), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
  });

  testWidgets('load-older calls loadOlderMessages(beforeId=oldest) and prepends',
      (tester) async {
    final fake = await _pump(
      tester,
      thread: TransportSnapshot<List<Message>>.ready([
        _msg(id: 'm1', text: 'first shown', senderId: _other),
        _msg(id: 'm2', text: 'second shown', senderId: _me),
      ]),
      older: [_msg(id: 'm0', text: 'an older message', senderId: _other)],
    );

    final loadOlder = find.text(l10n.inboxLoadOlder);
    expect(loadOlder, findsOneWidget);
    await tester.ensureVisible(loadOlder);
    await tester.tap(loadOlder);
    await tester.pumpAndSettle();

    expect(fake.olderRequests, hasLength(1));
    expect(fake.olderRequests.single.beforeMessageId, 'm1');
    expect(find.text('an older message'), findsOneWidget);
  });

  testWidgets('optimistic send appends, records, then reconciles on success',
      (tester) async {
    final fake = await _pump(
      tester,
      thread: const TransportSnapshot<List<Message>>.ready(<Message>[]),
    );

    await tester.enterText(find.byType(TextField), 'Hello Bina');
    await tester.pump();
    await tester.tap(find.byIcon(LucideIcons.send));
    await tester.pumpAndSettle();

    // The write was recorded with a clientMessageId, and the optimistic bubble
    // is on screen.
    expect(fake.sentMessages, hasLength(1));
    expect(fake.sentMessages.single.text, 'Hello Bina');
    final clientId = fake.sentMessages.single.clientMessageId;
    expect(clientId, isNotNull);
    expect(find.text('Hello Bina'), findsOneWidget);

    // The live stream now carries the real message (idempotent id == clientId);
    // it must reconcile (dedup), not duplicate.
    fake.emitThread(
      _id,
      TransportSnapshot<List<Message>>.ready([
        Message(
          id: clientId!,
          type: MessageType.text,
          text: 'Hello Bina',
          senderId: _me,
          senderName: 'Me',
          clientMessageId: clientId,
          createdAt: '2026-07-19T12:00:00Z',
        ),
      ]),
    );
    await tester.pumpAndSettle();
    expect(find.text('Hello Bina'), findsOneWidget);
  });

  testWidgets(
      'a TransportUnavailable rolls the bubble back and shows an inline retry',
      (tester) async {
    final fake = await _pump(
      tester,
      thread: const TransportSnapshot<List<Message>>.ready(<Message>[]),
      sendError: const TransportUnavailable.awaitingFirebase('sendMessage'),
    );

    await tester.enterText(find.byType(TextField), 'Oops offline');
    await tester.pump();
    await tester.tap(find.byIcon(LucideIcons.send));
    await tester.pumpAndSettle();

    // The attempt was made, the optimistic bubble rolled back, and a dignified
    // inline retry is offered — not a crash.
    expect(fake.sentMessages, hasLength(1));
    expect(find.text('Oops offline'), findsNothing);
    expect(find.text(l10n.inboxSendFailed), findsOneWidget);
    expect(find.text(l10n.actionRetry), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('retry re-sends with the SAME clientMessageId (idempotent)',
      (tester) async {
    final fake = await _pump(
      tester,
      thread: const TransportSnapshot<List<Message>>.ready(<Message>[]),
      sendError: const TransportUnavailable.awaitingFirebase('sendMessage'),
    );

    await tester.enterText(find.byType(TextField), 'Retry me');
    await tester.pump();
    await tester.tap(find.byIcon(LucideIcons.send));
    await tester.pumpAndSettle();
    final firstId = fake.sentMessages.single.clientMessageId;

    await tester.tap(find.text(l10n.actionRetry));
    await tester.pumpAndSettle();

    expect(fake.sentMessages, hasLength(2));
    expect(fake.sentMessages.last.clientMessageId, firstId);
  });

  group('U15: composer 1000-BYTE length guard (firestore.rules:123)', () {
    testWidgets(
        'an over-1000-byte ASCII message blocks send and shows an honest hint',
        (tester) async {
      final fake = await _pump(
        tester,
        thread: const TransportSnapshot<List<Message>>.ready(<Message>[]),
      );

      // 1001 ASCII bytes — one past the cap.
      final tooLong = 'a' * (kInboxMessageMaxBytes + 1);
      await tester.enterText(find.byType(TextField), tooLong);
      await tester.pump();

      // The honest block state: a "too long" hint appears...
      expect(find.text(l10n.inboxComposerTooLong), findsOneWidget);
      // ...and tapping send does nothing (the button is disabled), so the
      // oversized message never reaches the transport to loop in retry.
      await tester.tap(find.byIcon(LucideIcons.send));
      await tester.pumpAndSettle();
      expect(fake.sentMessages, isEmpty);
    });

    testWidgets(
        'the cap counts UTF-8 BYTES, not characters: a multi-byte Indic '
        'message under 1000 CHARS but over 1000 BYTES is blocked',
        (tester) async {
      final fake = await _pump(
        tester,
        thread: const TransportSnapshot<List<Message>>.ready(<Message>[]),
      );

      // Devanagari 'क' (U+0915): 1 UTF-16 code unit, 3 UTF-8 bytes. 400 of them
      // is 400 chars (well under the cap) but 1200 bytes (over it). Counting
      // `String.length` would wave this straight through to a PERMISSION_DENIED
      // at the rules layer — the exact silent failure on the one script family
      // this app is built for.
      final indic = 'क' * 400;
      expect(indic.length, lessThan(kInboxMessageMaxBytes)); // char count OK
      expect(
        utf8.encode(indic).length,
        greaterThan(kInboxMessageMaxBytes),
      ); // byte count over
      expect(inboxMessageByteLength(indic), utf8.encode(indic).length);

      await tester.enterText(find.byType(TextField), indic);
      await tester.pump();

      expect(find.text(l10n.inboxComposerTooLong), findsOneWidget);
      await tester.tap(find.byIcon(LucideIcons.send));
      await tester.pumpAndSettle();
      expect(fake.sentMessages, isEmpty);
    });

    testWidgets('a message exactly at the 1000-byte cap still sends',
        (tester) async {
      final fake = await _pump(
        tester,
        thread: const TransportSnapshot<List<Message>>.ready(<Message>[]),
      );

      final atCap = 'a' * kInboxMessageMaxBytes; // exactly 1000 bytes
      await tester.enterText(find.byType(TextField), atCap);
      await tester.pump();

      // At the boundary the guard does NOT fire, and the send goes through.
      expect(find.text(l10n.inboxComposerTooLong), findsNothing);
      await tester.tap(find.byIcon(LucideIcons.send));
      await tester.pumpAndSettle();
      expect(fake.sentMessages, hasLength(1));
      expect(fake.sentMessages.single.text, atCap);
    });
  });

  group('overflow probe — 360dp × 1.3, light + dark', () {
    for (final brightness in Brightness.values) {
      testWidgets('no overflow (${brightness.name}) with long bn/ta bubbles',
          (tester) async {
        await _pump(
          tester,
          surface: const Size(360, 800),
          textScale: 1.3,
          brightness: brightness,
          thread: TransportSnapshot<List<Message>>.ready([
            _msg(
              id: 'm1',
              text: 'আগামীকাল স্টাফ মিটিংয়ে আপনার তৈরি করা পাঠ পরিকল্পনা এবং '
                  'মূল্যায়নের নোটগুলি অনুগ্রহ করে সঙ্গে নিয়ে আসবেন।',
              senderId: _other,
            ),
            _msg(
              id: 'm2',
              text: 'நாளை ஆசிரியர் கூட்டத்திற்கு உங்கள் பாடத் திட்டத்தையும் '
                  'மதிப்பீட்டுக் குறிப்புகளையும் தயவுசெய்து கொண்டு வாருங்கள்.',
              senderId: _me,
              readBy: const [_other],
            ),
          ]),
        );
        expect(tester.takeException(), isNull);
      });
    }
  });
}
