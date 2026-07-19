import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/staffroom/data/chat_stream_provider.dart';
import 'package:sahayakai/features/staffroom/domain/chat_message.dart';

/// U-SI3 — the optimistic-send reconcile (`mergeChatForDisplay`). `community_chat`
/// does not echo a client id, so a pending send is reconciled by author + text +
/// NOVELTY (a server message that was not present when the send began). These
/// pin that logic so the composer never shows a duplicate — and never cancels a
/// fresh send just because an identical message already exists.

const _me = 'u-me';

ChatMessage _server(String id, String text, {String author = _me}) =>
    ChatMessage(
      id: id,
      text: text,
      authorId: author,
      authorName: author == _me ? 'Me' : 'Bina',
      createdAt: '2026-07-19T11:00:00Z',
    );

PendingChatSend _pending(
  String text, {
  Set<String> knownServerIds = const <String>{},
}) =>
    PendingChatSend(
      clientMessageId: 'ccid-$text',
      text: text,
      authorId: _me,
      knownServerIds: knownServerIds,
    );

void main() {
  test('no pending → the server list is returned unchanged', () {
    final server = [_server('s1', 'hello')];
    expect(mergeChatForDisplay(server, const []), server);
  });

  test('an in-flight pending (no echo yet) is appended as an optimistic bubble',
      () {
    final out = mergeChatForDisplay(const <ChatMessage>[], [_pending('draft')]);
    expect(out, hasLength(1));
    expect(out.single.text, 'draft');
    expect(out.single.authorId, _me);
  });

  test('a FRESH server echo (novel id) reconciles the pending — no duplicate',
      () {
    // The send began with no server messages, so srv-1 is novel → it covers the
    // pending; only the single server message shows.
    final out = mergeChatForDisplay(
      [_server('srv-1', 'hi team')],
      [_pending('hi team', knownServerIds: const <String>{})],
    );
    expect(out, hasLength(1));
    expect(out.single.id, 'srv-1'); // the server copy, not the optimistic one
  });

  test('a PRE-EXISTING identical message does NOT reconcile a fresh send', () {
    // "ok" already existed (old-1) when the new send began, so it must NOT cancel
    // the new optimistic bubble — the teacher genuinely sent "ok" again.
    final out = mergeChatForDisplay(
      [_server('old-1', 'ok')],
      [_pending('ok', knownServerIds: const {'old-1'})],
    );
    expect(out, hasLength(2), reason: 'the old "ok" is not the new send');
    expect(out.first.id, 'old-1');
    expect(out.last.text, 'ok'); // the optimistic bubble stays
  });

  test('two identical pendings each need their own fresh echo', () {
    // One fresh echo arrived (new-1); the second identical send has no echo yet.
    final out = mergeChatForDisplay(
      [_server('new-1', 'brb')],
      [
        _pending('brb', knownServerIds: const <String>{}),
        _pending('brb', knownServerIds: const <String>{}),
      ],
    );
    // new-1 reconciles ONE pending; the other stays as an optimistic bubble.
    expect(out, hasLength(2));
    expect(out.first.id, 'new-1');
    expect(out.last.text, 'brb');
  });

  test("another author's identical text never reconciles my send", () {
    final out = mergeChatForDisplay(
      [_server('srv-1', 'same', author: 'u-bina')],
      [_pending('same', knownServerIds: const <String>{})],
    );
    // The echo is from Bina, not me → my optimistic bubble stays.
    expect(out, hasLength(2));
    expect(out.last.authorId, _me);
  });
}
