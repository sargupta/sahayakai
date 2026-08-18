/// Normalises the several shapes a timestamp arrives in across Block C's two
/// transports into a single canonical **ISO-8601 string** (the representation
/// the domain models store, matching the parent-hotline convention of keeping
/// server times as ISO strings).
///
/// A `createdAt` / `lastMessageAt` field can arrive as:
///   - an **ISO-8601 string** — the REST-wrapper path, where `dbAdapter.serialize`
///     already stringifies Firestore `Timestamp`s (and `getNotificationsAction`
///     etc. return ISO strings);
///   - an **int / num** — epoch **milliseconds** (a common serialize form, and
///     what the real cloud_firestore impl can pass via `Timestamp.millisecondsSinceEpoch`);
///   - a **`{seconds, nanoseconds}` / `{_seconds, _nanoseconds}` map** — how a
///     Firestore `Timestamp` JSON-serializes if handed through raw.
///
/// Anything else (null, a bool, an empty string) → `null`. Never throws — a
/// malformed time must degrade to "no timestamp", not crash a list.
///
/// The real `cloud_firestore` implementation should convert a `Timestamp` to its
/// millis (`ts.millisecondsSinceEpoch`) or `ts.toDate().toIso8601String()` before
/// building the DTO map; this helper's map-handling is a belt-and-braces fallback.
String? wireTimeToIso(dynamic value) {
  switch (value) {
    case null:
      return null;
    case final String s:
      final t = s.trim();
      return t.isEmpty ? null : t;
    case final int ms:
      return DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true)
          .toIso8601String();
    case final num ms:
      return DateTime.fromMillisecondsSinceEpoch(ms.round(), isUtc: true)
          .toIso8601String();
    case final Map<dynamic, dynamic> map:
      final seconds = map['seconds'] ?? map['_seconds'];
      if (seconds is num) {
        final nanos = map['nanoseconds'] ?? map['_nanoseconds'];
        final ms = (seconds * 1000).round() +
            (nanos is num ? (nanos / 1e6).round() : 0);
        return DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true)
            .toIso8601String();
      }
      return null;
    default:
      return null;
  }
}
