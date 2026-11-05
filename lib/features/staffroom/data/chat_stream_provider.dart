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

/// # Staff Room chat providers
///
/// The two live chat rooms + the optimistic send controller + the honest
/// persona-pulse keep-warm controller (pillar 04). The chat **reads** are live
/// Firestore `onSnapshot`s (typed `Stream<TransportSnapshot<...>>`), the
/// **sends** are REST (`POST /api/community/chat`, `POST
/// /api/groups/{id}/chat`), and the persona pulse is `POST
/// /api/community/persona-pulse`.
///
/// Signed out the bound transport is [DeferredStaffroomTransport]: both
/// streams emit a single `awaitingFirebase` snapshot (the screen shows sign-in),
/// every send throws a typed [TransportUnavailable], and `triggerPersonaPulse`
/// returns `null`, so the persona timer never arms.

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
/// sent-awaiting-echo) plus EVERY [failed] (rolled-back) send — each one keeps
/// its own inline "not sent · retry" row, so a second failure never hides the
/// first.
@immutable
class ChatSendState {
  const ChatSendState({
    this.pending = const <PendingChatSend>[],
    this.failed = const <PendingChatSend>[],
    this.lastError,
  });

  final List<PendingChatSend> pending;

  /// The rolled-back sends, oldest first. A retry re-sends one by its
  /// [PendingChatSend.clientMessageId].
  final List<PendingChatSend> failed;

  /// The error behind the most recent rollback (a 429 rate limit, a 403
  /// non-member, offline …), so the screen can say WHY in translated copy.
  final Object? lastError;

  bool get hasFailure => failed.isNotEmpty;

  @override
  bool operator ==(Object other) =>
      other is ChatSendState &&
      listEquals(other.pending, pending) &&
      listEquals(other.failed, failed) &&
      other.lastError == lastError;

  @override
  int get hashCode =>
      Object.hash(Object.hashAll(pending), Object.hashAll(failed), lastError);
}

/// The optimistic chat-send controller, one per [ChatRoom].
///
/// [send] appends a pending bubble and posts it (`POST /api/community/chat` or
/// `POST /api/groups/{id}/chat`); on success the bubble is marked `sent` and
/// the live stream reconciles it via [mergeChatForDisplay]. On any error the
/// bubble **rolls back** into [ChatSendState.failed], each with its own retry.
///
/// **No duplicates on retry.** Neither chat route accepts a client message id,
/// so the server cannot dedupe a retry of a send that actually landed (e.g. a
/// timeout after the write). [retry] therefore checks the live stream FIRST:
/// if a matching echo (same author + text, not present when the original send
/// began) has already arrived, the failure is simply cleared instead of
/// re-posted. [unresolvedFailures] applies the same rule for display, so a
/// "failed" send whose echo shows up never lingers as a false failure.
///
/// autoDispose per room: the state lives only while the chat screen is open.
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
    state = ChatSendState(
      pending: <PendingChatSend>[...state.pending, pending],
      failed: state.failed,
      lastError: state.lastError,
    );
    await _dispatch(pending);
  }

  /// Re-send the failed message [clientMessageId]. [server] is the live room
  /// as currently on screen: when it already carries this send's echo, the
  /// failure is dropped instead of posted again (see the class doc).
  Future<void> retry(
    String clientMessageId, {
    required List<ChatMessage> server,
  }) async {
    final failed = _failedById(clientMessageId);
    if (failed == null) return;
    final remaining = <PendingChatSend>[
      for (final f in state.failed)
        if (f.clientMessageId != clientMessageId) f,
    ];
    if (_hasEcho(failed, server)) {
      state = ChatSendState(pending: state.pending, failed: remaining);
      return;
    }
    // Keep the ORIGINAL novelty baseline, so an echo of the first attempt that
    // arrives late still reconciles this bubble instead of doubling it.
    final pending = failed.copyWith(status: ChatSendStatus.sending);
    state = ChatSendState(
      pending: <PendingChatSend>[...state.pending, pending],
      failed: remaining,
    );
    await _dispatch(pending);
  }

  /// Drop a failed send the teacher no longer wants to retry.
  void discard(String clientMessageId) {
    state = ChatSendState(
      pending: state.pending,
      failed: <PendingChatSend>[
        for (final f in state.failed)
          if (f.clientMessageId != clientMessageId) f,
      ],
      lastError: state.failed.length > 1 ? state.lastError : null,
    );
  }

  PendingChatSend? _failedById(String clientMessageId) {
    for (final f in state.failed) {
      if (f.clientMessageId == clientMessageId) return f;
    }
    return null;
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
    } catch (error) {
      _rollback(pending, error);
    }
  }

  void _mark(String clientMessageId, ChatSendStatus status) {
    state = ChatSendState(
      pending: <PendingChatSend>[
        for (final p in state.pending)
          if (p.clientMessageId == clientMessageId)
            p.copyWith(status: status)
          else
            p,
      ],
      failed: state.failed,
      lastError: state.lastError,
    );
  }

  void _rollback(PendingChatSend pending, Object error) {
    state = ChatSendState(
      pending: <PendingChatSend>[
        for (final p in state.pending)
          if (p.clientMessageId != pending.clientMessageId) p,
      ],
      failed: <PendingChatSend>[...state.failed, pending],
      lastError: error,
    );
  }
}

/// Whether [server] already carries the echo of [send]: a message by the same
/// author with the same text that was NOT on screen when the send began.
bool _hasEcho(PendingChatSend send, List<ChatMessage> server) => server.any(
      (s) =>
          s.authorId == send.authorId &&
          s.text == send.text &&
          !send.knownServerIds.contains(s.id),
    );

/// The failed sends still worth showing: those whose echo has NOT arrived on
/// the live stream (a timed-out send that actually landed is not a failure).
List<PendingChatSend> unresolvedFailures(
  List<ChatMessage> server,
  List<PendingChatSend> failed,
) =>
    <PendingChatSend>[
      for (final f in failed)
        if (!_hasEcho(f, server)) f,
    ];

/// Merge the live server messages (oldest→newest) with the still-unreconciled
/// optimistic [pending] sends, for display.
///
/// A pending send is reconciled (dropped) once the live stream carries a message
/// from the same author with the same text that was **not** already present when
/// the send began ([PendingChatSend.knownServerIds]) — so a *later* identical
/// message does not wrongly cancel a fresh optimistic send. Each fresh server
/// echo reconciles at most one pending, oldest-first. Neither chat route echoes
/// a client id, so we match on author + text + novelty.
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
