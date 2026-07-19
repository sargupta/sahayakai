import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/firebase/firebase_init.dart';
import '../domain/conversation_id.dart';
import '../domain/presence_status.dart';

part 'presence_transport.g.dart';

/// # PresenceTransport — the green dot + typing (Pillar 05, U-SI6)
///
/// The **only Realtime-Database** surface in Block C. Gated *separately* from the
/// rest (SPEC §B3.4) so the Inbox works without RTDB — presence is a nicety, not
/// a blocker. Streams here are typed on the domain models directly ([PresenceStatus]
/// carries an [Presence.unknown] state), so no `TransportSnapshot` wrapper is
/// needed: the deferred seam simply emits `unknown`/`empty` and the dot hides.
abstract interface class PresenceTransport {
  /// **LIVE (RTDB).** One teacher's presence. Real impl:
  /// `onValue(ref('presence/$uid/online'))` decoded via `PresenceDto.fromRtdbValue`.
  /// Exposed as a `StreamProvider.family(uid)` upstream. Deferred → a single
  /// `PresenceStatus.unknown(uid)` (no dot).
  Stream<PresenceStatus> watchPresence(String uid);

  /// **LIVE (RTDB).** Who is typing in a conversation. Real impl:
  /// `onValue(ref('typing/${conversationId.value}'))` → the uids mapped to true.
  /// Typing lives in RTDB (not Firestore) because a per-keystroke Firestore
  /// write would be prohibitively expensive. Deferred → an empty [TypingStatus].
  Stream<TypingStatus> watchTyping(ConversationId conversationId);

  /// **WRITE (RTDB).** Publish the current user's presence with an
  /// `onDisconnect` teardown. Real impl:
  /// `ref('presence/$myUid/online').set({online, lastChanged: ServerValue.timestamp})`
  /// + `onDisconnect().set({online:false,...})`. Deferred → no-op (safe to call).
  Future<void> setPresence({required bool online});

  /// **WRITE (RTDB).** Publish the current user's typing state in a conversation
  /// (debounced by the caller). Deferred → no-op.
  Future<void> setTyping(ConversationId conversationId, {required bool typing});
}

/// The default, Firebase-free implementation (U-SI0). Presence is always
/// [Presence.unknown] (no dot), typing is always empty, and the writes are
/// **no-ops** (NOT throws) — presence is best-effort, so a UI that publishes
/// presence must not blow up when the seam is deferred.
class DeferredPresenceTransport implements PresenceTransport {
  const DeferredPresenceTransport();

  @override
  Stream<PresenceStatus> watchPresence(String uid) =>
      Stream<PresenceStatus>.value(PresenceStatus.unknown(uid));

  @override
  Stream<TypingStatus> watchTyping(ConversationId conversationId) =>
      Stream<TypingStatus>.value(TypingStatus.empty(conversationId));

  @override
  Future<void> setPresence({required bool online}) async {
    // No-op: presence is best-effort and Firebase-gated (RTDB). Safe to call.
  }

  @override
  Future<void> setTyping(
    ConversationId conversationId, {
    required bool typing,
  }) async {
    // No-op: typing is best-effort and Firebase-gated (RTDB). Safe to call.
  }
}

@Riverpod(keepAlive: true)
PresenceTransport presenceTransport(Ref ref) {
  if (FirebaseInit.isConfigured) {
    throw StateError(
      'Firebase is configured but the live PresenceTransport (RTDB) is not '
      'wired. Bind RtdbPresenceTransport as part of the Block C handoff (U-SI6).',
    );
  }
  return const DeferredPresenceTransport();
}
