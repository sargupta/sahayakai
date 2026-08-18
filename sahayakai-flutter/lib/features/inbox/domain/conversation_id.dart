import 'package:flutter/foundation.dart';

/// The deterministic id of a 1:1 direct-message conversation.
///
/// Mirrors `src/types/messages.ts::buildDirectConversationId` **exactly**:
///
/// ```ts
/// export function buildDirectConversationId(uid1, uid2) {
///   return [uid1, uid2].sort().join('_');
/// }
/// ```
///
/// The sort makes a DM idempotent: `direct(a, b) == direct(b, a)`, so a thread
/// opened from Flutter and from the web collide on the **same** Firestore doc.
/// Keeping this identical to the web is load-bearing — a divergent sort (locale
/// collation, case-folding) would fork the conversation into two docs and split
/// the history.
///
/// The web sort is JavaScript's default `Array.prototype.sort` on strings:
/// UTF-16 code-unit order, ascending. Firebase UIDs are ASCII
/// (`[A-Za-z0-9]{28}`), for which Dart's [String.compareTo] (UTF-16 code-unit
/// order) is identical — so [buildDirectConversationId] uses `compareTo` and is
/// byte-for-byte equal to the web for every real uid.
String buildDirectConversationId(String uid1, String uid2) {
  final pair = <String>[uid1, uid2]..sort();
  return '${pair[0]}_${pair[1]}';
}

/// A typed conversation id. A thin value wrapper so signatures read as
/// `ConversationId` rather than a bare `String`, and so the deterministic-DM
/// construction has one home. Group conversation ids are server-generated
/// (`convRef.id`), so [ConversationId] wraps any id, and [ConversationId.direct]
/// is the DM-specific constructor.
@immutable
class ConversationId {
  const ConversationId(this.value);

  /// The deterministic id for the DM between [myUid] and [otherUid].
  factory ConversationId.direct(String myUid, String otherUid) =>
      ConversationId(buildDirectConversationId(myUid, otherUid));

  /// The raw Firestore document id.
  final String value;

  /// A direct-conversation id encodes both participant uids as `a_b`; splitting
  /// on the single `_` recovers them. Returns null for a group id (server ids
  /// have no `_`) or a malformed value. Useful for the `/messages?with={uid}`
  /// deep link and for deriving "the other participant" without a doc read.
  ({String a, String b})? get directPair {
    final parts = value.split('_');
    if (parts.length != 2 || parts[0].isEmpty || parts[1].isEmpty) return null;
    return (a: parts[0], b: parts[1]);
  }

  bool get isEmpty => value.isEmpty;

  @override
  bool operator ==(Object other) =>
      other is ConversationId && other.value == value;

  @override
  int get hashCode => value.hashCode;

  @override
  String toString() => value;
}
