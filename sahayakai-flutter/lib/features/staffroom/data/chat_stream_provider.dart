import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../inbox/data/block_c_transport.dart';
import '../domain/chat_message.dart';
import '../domain/persona_pulse.dart';
import 'staffroom_providers.dart';
import 'staffroom_transport.dart';

part 'chat_stream_provider.g.dart';

/// # Staff Room chat providers (U-SI3)
///
/// The two live chat rooms (SPEC §A3.2) + the optimistic send controller + the
/// honest persona-pulse keep-warm controller (pillar 04). Same Block-C split as
/// the Pro Inbox: the chat **reads** are live Firestore `onSnapshot`s (typed
/// `Stream<TransportSnapshot<...>>` so the deferred seam emits `awaitingFirebase`
/// and the screen renders sign-in on-device), the **send** is a REST wrapper, and
/// the persona pulse is the one already-deployed REST route.
///
/// While Firebase is gated the bound transport is [DeferredStaffroomTransport]:
/// both streams emit a single `awaitingFirebase` snapshot, every send throws a
/// typed [TransportUnavailable], and `triggerPersonaPulse` returns `null` — so
/// the persona timer never arms on-device. Verified by code + widget/unit test,
/// not live.

// ─────────────────────────────────────────────────────────────────────────────
// Room key
// ─────────────────────────────────────────────────────────────────────────────

/// Which live chat room the screen + providers address: the global community
/// **Staff Room** (`community_chat`) or one **group** chat (`groups/{id}/chat`).
/// A value type (== + hashCode) so it can key a Riverpod `family`.
@immutable
class ChatRoom {
  /// The global, community-wide Staff Room.
  const ChatRoom.community() : groupId = null;

  /// One group's chat, by group id.
  const ChatRoom.group(String this.groupId);

  /// Null for the Staff Room; the group id for a group chat.
  final String? groupId;

  bool get isCommunity => groupId == null;

  @override
  bool operator ==(Object other) => other is ChatRoom && other.groupId == groupId;

  @override
  int get hashCode => groupId.hashCode;

  @override
  String toString() =>
      isCommunity ? 'ChatRoom.community()' : 'ChatRoom.group($groupId)';
}

// ─────────────────────────────────────────────────────────────────────────────
// Live-read streams
// ─────────────────────────────────────────────────────────────────────────────

/// **LIVE.** The global Staff Room chat — a `StreamProvider` over
/// [StaffroomTransport.watchStaffRoomChat] (`community_chat`,
/// `onSnapshot(orderBy createdAt asc, limitToLast(100))`). Messages arrive
/// oldest→newest.
@riverpod
Stream<TransportSnapshot<List<ChatMessage>>> staffRoomChat(Ref ref) =>
    ref.watch(staffroomTransportProvider).watchStaffRoomChat();

/// **LIVE.family.** One group's chat — a `StreamProvider.family` keyed by
/// groupId over [StaffroomTransport.watchGroupChat] (`groups/{id}/chat`, member-
/// gated by `firestore.rules`). Same doc shape as the Staff Room.
@riverpod
Stream<TransportSnapshot<List<ChatMessage>>> groupChat(
  Ref ref,
  String groupId,
) =>
    ref.watch(staffroomTransportProvider).watchGroupChat(groupId);

// ─────────────────────────────────────────────────────────────────────────────
// Optimistic send controller
// ─────────────────────────────────────────────────────────────────────────────

/// The lifecycle of one optimistic chat send.
enum ChatSendStatus {
  /// The write is in flight.
  sending,

  /// The write succeeded; the bubble stays visible until the live stream echoes
  /// it (then [mergeChatForDisplay] reconciles it away — no duplicate).
  sent,
}

/// One optimistic, in-flight (or just-sent) chat message. Rendered as a
/// [ChatMessage] whose `id` is the [clientMessageId], with [knownServerIds] — the
/// live stream ids present when the send began — so a *later* identical message
/// never wrongly reconciles a fresh send (see [mergeChatForDisplay]).
@immutable
class PendingChatSend {
  const PendingChatSend({
    required this.clientMessageId,
    required this.text,
    required this.authorId,
    required this.knownServerIds,
    this.status = ChatSendStatus.sending,
  });

  final String clientMessageId;
  final String text;
  final String authorId;

  /// The live stream message ids present at send time — the "novelty" baseline.
  final Set<String> knownServerIds;
  final ChatSendStatus status;

  PendingChatSend copyWith({ChatSendStatus? status}) => PendingChatSend(
        clientMessageId: clientMessageId,
        text: text,
        authorId: authorId,
        knownServerIds: knownServerIds,
        status: status ?? this.status,
      );

  /// The optimistic [ChatMessage] shown in the list (own bubble, no server
  /// timestamp yet). `authorName` is empty — an own bubble carries no author
  /// header, so it is never read.
  ChatMessage toOptimistic() => ChatMessage(
        id: clientMessageId,
        text: text,
        authorId: authorId,
        authorName: '',
      );

  @override
  bool operator ==(Object other) =>
      other is PendingChatSend &&
      other.clientMessageId == clientMessageId &&
      other.text == text &&
      other.authorId == authorId &&
      setEquals(other.knownServerIds, knownServerIds) &&
      other.status == status;

  @override
  int get hashCode => Object.hash(
        clientMessageId,
        text,
        authorId,
        Object.hashAll(knownServerIds),
        status,
      );
}

/// The optimistic-send state for one room: the [pending] sends (in flight or
/// sent-awaiting-echo) plus the most-recent [failed] (rolled-back) send, which
/// drives the inline "couldn't send · retry" bar.
@immutable
class ChatSendState {
  const ChatSendState({
    this.pending = const <PendingChatSend>[],
    this.failed,
  });

  final List<PendingChatSend> pending;

  /// The last send that rolled back on a [TransportUnavailable] / error, held so
  /// a retry re-sends it with the SAME [PendingChatSend.clientMessageId].
  final PendingChatSend? failed;

  bool get hasFailure => failed != null;

  ChatSendState copyWith({
    List<PendingChatSend>? pending,
    PendingChatSend? failed,
    bool clearFailed = false,
  }) =>
      ChatSendState(
        pending: pending ?? this.pending,
        failed: clearFailed ? null : (failed ?? this.failed),
      );

  @override
  bool operator ==(Object other) =>
      other is ChatSendState &&
      listEquals(other.pending, pending) &&
      other.failed == failed;

  @override
  int get hashCode => Object.hash(Object.hashAll(pending), failed);
}

/// The optimistic chat-send controller (SPEC §A3.2), one per [ChatRoom].
///
/// [send] appends a pending bubble and fires the REST-wrapper write
/// (`sendCommunityChatMessage` / `sendGroupChatMessage`) with a client-generated
/// [PendingChatSend.clientMessageId]; on success the bubble is marked `sent` and
/// the live stream reconciles it via [mergeChatForDisplay] (community_chat does
/// not echo a client id, so the reconcile matches on author + text + novelty). On
/// a typed [TransportUnavailable] / any error the bubble **rolls back** and the
/// screen shows a dignified inline retry; [retry] re-sends with the SAME
/// clientMessageId so it stays a single logical message (no double pending).
///
/// autoDispose per room: the pending list lives only while the chat screen is
/// open, matching the U-SI1 composer's widget-scoped optimistic state.
@riverpod
class ChatSendController extends _$ChatSendController {
  int _counter = 0;

  @override
  ChatSendState build(ChatRoom room) => const ChatSendState();

  String _newClientId() =>
      'ccid-${DateTime.now().microsecondsSinceEpoch}-${_counter++}';

  /// Optimistically append [text] and dispatch the send. [knownServerIds] are the
  /// live stream message ids currently on screen (the novelty baseline).
  Future<void> send({
    required String text,
    required Set<String> knownServerIds,
  }) async {
    final trimmed = text.trim();
    final authorId = ref.read(currentStaffroomUserIdProvider);
    if (trimmed.isEmpty || authorId == null) return;

    final pending = PendingChatSend(
      clientMessageId: _newClientId(),
      text: trimmed,
      authorId: authorId,
      knownServerIds: knownServerIds,
    );
    state = state.copyWith(
      pending: <PendingChatSend>[...state.pending, pending],
      clearFailed: true,
    );
    await _dispatch(pending);
  }

  /// Re-send the last rolled-back message with the SAME clientMessageId, so a
  /// server that received the first attempt treats it as one message.
  Future<void> retry({required Set<String> knownServerIds}) async {
    final failed = state.failed;
    final authorId = ref.read(currentStaffroomUserIdProvider);
    if (failed == null || authorId == null) return;

    final pending = PendingChatSend(
      clientMessageId: failed.clientMessageId,
      text: failed.text,
      authorId: authorId,
      knownServerIds: knownServerIds,
    );
    state = state.copyWith(
      pending: <PendingChatSend>[...state.pending, pending],
      clearFailed: true,
    );
    await _dispatch(pending);
  }

  Future<void> _dispatch(PendingChatSend pending) async {
    final transport = ref.read(staffroomTransportProvider);
    try {
      if (room.isCommunity) {
        await transport.sendCommunityChatMessage(text: pending.text);
      } else {
        await transport.sendGroupChatMessage(room.groupId!, text: pending.text);
      }
      _mark(pending.clientMessageId, ChatSendStatus.sent);
    } on TransportUnavailable {
      _rollback(pending);
    } catch (_) {
      _rollback(pending);
    }
  }

  void _mark(String clientMessageId, ChatSendStatus status) {
    state = state.copyWith(
      pending: <PendingChatSend>[
        for (final p in state.pending)
          if (p.clientMessageId == clientMessageId)
            p.copyWith(status: status)
          else
            p,
      ],
    );
  }

  void _rollback(PendingChatSend pending) {
    state = state.copyWith(
      pending: <PendingChatSend>[
        for (final p in state.pending)
          if (p.clientMessageId != pending.clientMessageId) p,
      ],
      failed: pending,
    );
  }
}

/// Merge the live server messages (oldest→newest) with the still-unreconciled
/// optimistic [pending] sends, for display.
///
/// A pending send is reconciled (dropped) once the live stream carries a message
/// from the same author with the same text that was **not** already present when
/// the send began ([PendingChatSend.knownServerIds]) — so a *later* identical
/// message does not wrongly cancel a fresh optimistic send. Each fresh server
/// echo reconciles at most one pending, oldest-first. This is the chat analogue
/// of U-SI1's dedup-by-`clientMessageId`; `community_chat` does not echo a client
/// id, so we match on author + text + novelty.
List<ChatMessage> mergeChatForDisplay(
  List<ChatMessage> server,
  List<PendingChatSend> pending,
) {
  if (pending.isEmpty) return server;
  final claimed = <String>{};
  final visible = <ChatMessage>[];
  for (final p in pending) {
    String? echoId;
    for (final s in server) {
      if (s.authorId == p.authorId &&
          s.text == p.text &&
          !p.knownServerIds.contains(s.id) &&
          !claimed.contains(s.id)) {
        echoId = s.id;
        break;
      }
    }
    if (echoId != null) {
      claimed.add(echoId); // reconciled — hide this optimistic bubble
    } else {
      visible.add(p.toOptimistic());
    }
  }
  return <ChatMessage>[...server, ...visible];
}

// ─────────────────────────────────────────────────────────────────────────────
// Persona-pulse keep-warm controller
// ─────────────────────────────────────────────────────────────────────────────

/// The polite minimum interval between persona-pulse heartbeats. The SPEC asks
/// for a 3–5 min cadence (§A1.4 / §A3.2); this uses the LOWER bound as a fixed,
/// polite floor — never faster — so the Staff Room stays warm without spamming
/// the demo endpoint or the teacher's data.
const Duration kPersonaPulseInterval = Duration(minutes: 3);

/// The keep-warm status a screen can surface. Informational — the pulse's real
/// output is the AI message the server writes to `community_chat`, which arrives
/// via the chat stream.
enum PersonaPulseStatus {
  /// Armed and waiting for the next interval (or not armed, for a group chat).
  idle,

  /// The last pulse returned a persona message (200); another is scheduled.
  warmed,

  /// A 503 (flag off) or an error permanently disarmed the timer this session.
  stopped,
}

/// The persona-pulse keep-warm controller (SPEC §A1.4 / §A3.2 · pillar 04).
///
/// While the Staff Room chat is open it POSTs `/api/community/persona-pulse` on a
/// polite [kPersonaPulseInterval] timer so an AI teacher persona keeps the room
/// feeling alive. HONEST + POLITE + LEAK-FREE — modelled on the parent-hotline
/// poll discipline:
///   • it arms **only** for the community Staff Room (the persona-pulse route
///     writes `community_chat`); a group chat never arms it;
///   • the timer is a self-rescheduling [Timer] (not `Timer.periodic`) guarded by
///     a generation counter [_gen] + a [_disposed] flag, so no fire survives a
///     dispose or a stop;
///   • `ref.onDispose` cancels the timer — leaving the screen (this autoDispose
///     provider is no longer watched) stops the pulses, no leak;
///   • a **null** result (a 503 — the `communityPersonas` flag is off) or ANY
///     thrown error (the deferred transport, a 401 on the stub) **permanently
///     disarms** the timer for the session — it never loops on a dead endpoint;
///   • a 200 reschedules exactly one next pulse.
///
/// The AI message it triggers is written to `community_chat` and rendered in the
/// chat with an explicit "AI teacher" badge — the persona is always labelled AI,
/// never posing as a real teacher.
@riverpod
class PersonaPulseController extends _$PersonaPulseController {
  bool _disposed = false;
  bool _stopped = false;
  Timer? _timer;
  int _gen = 0;

  @override
  PersonaPulseStatus build(ChatRoom room) {
    ref.onDispose(() {
      _disposed = true;
      _timer?.cancel();
      _timer = null;
      _gen++; // orphan any in-flight fire continuation (belt on _disposed)
    });
    // Arm only for the community Staff Room; a group chat has no persona pulse.
    if (room.isCommunity) {
      _schedule(++_gen);
    }
    return PersonaPulseStatus.idle;
  }

  void _schedule(int gen) {
    if (_disposed || _stopped) return;
    _timer?.cancel();
    _timer = Timer(kPersonaPulseInterval, () => unawaited(_fire(gen)));
  }

  Future<void> _fire(int gen) async {
    if (_disposed || _stopped || gen != _gen) return;
    final transport = ref.read(staffroomTransportProvider);
    final request = PersonaPulseRequest(recentMessages: _recentContext());

    PersonaPulse? pulse;
    try {
      pulse = await transport.triggerPersonaPulse(request);
    } catch (_) {
      // The deferred transport / a 401 on the stub — never loop on it.
      if (_disposed || gen != _gen) return;
      _stopPermanently();
      return;
    }
    // Post-await guard (load-bearing — see the "dispose in flight" test): a
    // dispose or a fresher generation abandons this continuation.
    if (_disposed || gen != _gen) return;

    if (pulse == null) {
      // 503 — the communityPersonas flag is off → disarm for the session.
      _stopPermanently();
      return;
    }
    _set(PersonaPulseStatus.warmed);
    _schedule(gen); // 200 → schedule exactly one more pulse
  }

  void _stopPermanently() {
    _stopped = true;
    _timer?.cancel();
    _timer = null;
    _gen++; // invalidate any scheduled / in-flight continuation
    _set(PersonaPulseStatus.stopped);
  }

  /// The last few chat messages as persona context (`{ authorName, text }`),
  /// **read** (not watched) at fire time so a new message never re-arms the
  /// timer. Empty when the chat is not yet resolved (deferred / loading).
  List<PersonaPulseContext> _recentContext() {
    final snapshot = ref.read(staffRoomChatProvider).valueOrNull;
    final messages = snapshot?.data ?? const <ChatMessage>[];
    final tail = messages.length <= 5
        ? messages
        : messages.sublist(messages.length - 5);
    return <PersonaPulseContext>[
      for (final m in tail)
        PersonaPulseContext(authorName: m.authorName, text: m.text),
    ];
  }

  void _set(PersonaPulseStatus status) {
    if (_disposed) return;
    state = status;
  }
}
