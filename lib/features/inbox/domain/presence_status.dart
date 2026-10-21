import 'package:flutter/foundation.dart';

import 'conversation_id.dart';

/// A teacher's online presence — the green dot on an inbox row / profile.
///
/// This is the **only Realtime-Database** surface in Block C (SPEC §B3.4): the
/// web reads `onValue(rtdb, presence/{uid}/online)`, separate from Firestore.
/// The RTDB node is typically `{ online: bool, lastChanged: <ms epoch> }`
/// (Firebase's canonical presence recipe writes a boolean + a server timestamp),
/// so this model tolerates both a bare boolean and that object shape at decode.
///
/// [unknown] is the safe default the deferred seam emits (no RTDB wired) and the
/// state when a uid has no presence node — the UI shows **no** dot for
/// [unknown]/[offline] and a green dot only for [online].
enum Presence {
  online,
  offline,
  unknown,
}

/// The presence of one teacher, with the last-changed timestamp when RTDB
/// carried one. Immutable + value-equal so the presence `StreamProvider.family`
/// does not thrash the dot.
@immutable
class PresenceStatus {
  const PresenceStatus({
    required this.uid,
    required this.presence,
    this.lastChangedMs,
  });

  /// The default: presence not known (no RTDB wired, or no node for this uid).
  const PresenceStatus.unknown(this.uid)
      : presence = Presence.unknown,
        lastChangedMs = null;

  final String uid;
  final Presence presence;

  /// Milliseconds since epoch of the last presence change (RTDB
  /// `lastChanged`), when present.
  final int? lastChangedMs;

  bool get isOnline => presence == Presence.online;

  /// Whether the UI should paint the green dot. Only a definite `online` shows
  /// a dot; `offline`/`unknown` show nothing (never a red/grey dot).
  bool get showsDot => presence == Presence.online;

  @override
  bool operator ==(Object other) =>
      other is PresenceStatus &&
      other.uid == uid &&
      other.presence == presence &&
      other.lastChangedMs == lastChangedMs;

  @override
  int get hashCode => Object.hash(uid, presence, lastChangedMs);
}

/// Who is currently typing in a conversation (the "…is typing" affordance).
///
/// Typing is an ephemeral, high-churn signal; the web keeps it in **RTDB**
/// alongside presence (e.g. `typing/{conversationId}/{uid}: true`), NOT in
/// Firestore (a Firestore write per keystroke would be prohibitively expensive).
/// Modelled here so U-SI1's thread can render it off the presence transport; it
/// is Firebase-gated with the rest and the deferred seam emits [empty].
@immutable
class TypingStatus {
  const TypingStatus({
    required this.conversationId,
    required this.typingUids,
  });

  /// Nobody typing — the default the deferred seam emits.
  const TypingStatus.empty(this.conversationId)
      : typingUids = const <String>[];

  final ConversationId conversationId;

  /// The uids currently typing (excluding the viewer, by convention of the
  /// caller). Empty when nobody is.
  final List<String> typingUids;

  /// Whether anyone (other than the viewer) is typing right now.
  bool get isAnyoneTyping => typingUids.isNotEmpty;

  @override
  bool operator ==(Object other) =>
      other is TypingStatus &&
      other.conversationId == conversationId &&
      listEquals(other.typingUids, typingUids);

  @override
  int get hashCode =>
      Object.hash(conversationId, Object.hashAll(typingUids));
}
