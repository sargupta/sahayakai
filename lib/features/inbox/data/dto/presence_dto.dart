import '../../domain/presence_status.dart';

/// Decodes an RTDB `presence/{uid}/online` value.
///
/// This is **not** json_serializable — an RTDB `onValue` event hands Dart a
/// bare, untyped value (`Object?`), not a JSON object, so decode is a tolerant
/// switch rather than a generated `fromJson`. The node arrives as either:
///   - a **bare boolean** (`presence/{uid}/online: true`), or
///   - a **`{ online, lastChanged }` object** — Firebase's canonical presence
///     recipe writes `online: bool` + `lastChanged: <server ms>`.
///
/// Anything unrecognised (null node, absent uid) → [Presence.unknown], so the UI
/// simply shows no dot rather than guessing offline.
class PresenceDto {
  const PresenceDto._();

  /// Builds a [PresenceStatus] for [uid] from a raw RTDB value.
  static PresenceStatus fromRtdbValue(String uid, Object? value) {
    switch (value) {
      case null:
        return PresenceStatus.unknown(uid);
      case final bool online:
        return PresenceStatus(
          uid: uid,
          presence: online ? Presence.online : Presence.offline,
        );
      case final Map<dynamic, dynamic> map:
        final online = map['online'];
        final lastChanged = map['lastChanged'];
        final presence = switch (online) {
          final bool b => b ? Presence.online : Presence.offline,
          final num n => n != 0 ? Presence.online : Presence.offline,
          _ => Presence.unknown,
        };
        return PresenceStatus(
          uid: uid,
          presence: presence,
          lastChangedMs: lastChanged is num ? lastChanged.round() : null,
        );
      case final num n:
        return PresenceStatus(
          uid: uid,
          presence: n != 0 ? Presence.online : Presence.offline,
        );
      default:
        return PresenceStatus.unknown(uid);
    }
  }
}
