// Small tolerant-decode helpers shared by the Staffroom DTOs, mirroring the
// private helpers in the inbox DTOs and the parent-hotline convention: a
// malformed / model-written field degrades to a safe default, never a crash.

/// Trims a string, returning null when it is null / blank.
String? cleanString(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

/// Keeps only the non-empty string entries of a (possibly `dynamic`) list,
/// trimmed. Tolerates a null list, nulls, and non-strings.
List<String> stringList(dynamic raw) {
  if (raw is! List) return const <String>[];
  return raw
      .whereType<String>()
      .map((e) => e.trim())
      .where((e) => e.isNotEmpty)
      .toList(growable: false);
}

/// Coerces a `Record<string, string>` (translations) to `Map<String, String>`,
/// dropping non-string / empty values.
Map<String, String> stringStringMap(Map<String, dynamic>? raw) {
  if (raw == null) return const <String, String>{};
  final out = <String, String>{};
  raw.forEach((key, value) {
    if (value is String && value.isNotEmpty) out[key] = value;
  });
  return out;
}

/// Coerces a value to `int`, tolerating `num` and numeric strings; null when
/// not parseable.
int? asInt(dynamic value) => switch (value) {
      final int v => v,
      final num v => v.toInt(),
      final String v => num.tryParse(v)?.toInt(),
      _ => null,
    };
