import 'dart:math' as math;

/// A RFC-4122 version-4 UUID, generated without a package dependency.
///
/// `POST /api/content/save` validates its body against `SaveContentSchema`,
/// whose `id` is `z.string().uuid()` (verified in
/// `sahayakai-main/src/ai/schemas/content-schemas.ts`). The id is generated on
/// the CLIENT — the route echoes it back rather than minting one — so the
/// format matters: a random 32-char hex string is rejected with a 400 because
/// the version and variant nibbles are wrong.
///
/// [math.Random.secure] rather than `Random()`: the id doubles as the document
/// key, and a predictable sequence would let one teacher guess another's.
/// Twenty lines here beat a package for the same twenty lines.
String newContentId() {
  final rnd = math.Random.secure();
  final bytes = List<int>.generate(16, (_) => rnd.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}
