import 'attendance_record.dart';

/// One roster entry the resolver matches spoken names against.
typedef RollCallStudent = ({String id, String name});

/// Turns a spoken roll call into per-student marks (v3 screen 13 — "read the
/// names aloud, I mark each as you say it").
///
/// The teacher reads the register out; every name the resolver recognises is
/// marked **present** by default, and a status word spoken next to a name
/// ("absent", "late", or their Hindi/Marathi equivalents) overrides just that
/// one. It is deliberately a pure function over the transcript + roster: no
/// audio, no I/O — so the hard part (fuzzy name matching + status parsing) is
/// fully unit-testable, and the capture UI is thin glue on top.
///
/// Matching is conservative: a student is matched when their full name, or their
/// distinctive first name (≥3 letters), appears as a whole token in the
/// transcript. Unrecognised words are ignored, so ambient speech does not mark
/// anyone.
abstract final class RollCallResolver {
  // Status keywords, normalised (lowercased, punctuation-stripped). English plus
  // the two languages the register is most read in; unknown languages still work
  // by the present-by-default rule.
  static const _absentWords = <String>{
    'absent', 'absentee', 'gair', 'gairhaazir', 'gairhazir', 'anupasthit',
    'nahi', 'nahin', 'नहीं', 'नही', 'गैर', 'गैरहाज़िर', 'गैरहाजिर', 'अनुपस्थित',
  };
  static const _lateWords = <String>{
    'late', 'der', 'deri', 'vilamb', 'vilambit', 'लेट', 'देर', 'देरी', 'विलंब',
    'विलंबित', 'उशीरा',
  };

  /// Resolve [transcript] into `studentId → status` for the matched students.
  /// Students not named are absent from the map (left unmarked), never defaulted.
  static Map<String, AttendanceStatus> resolve({
    required String transcript,
    required List<RollCallStudent> roster,
  }) {
    final normalized = _normalize(transcript);
    if (normalized.isEmpty) return const {};
    final padded = ' $normalized ';

    // Find where each student's name lands in the transcript.
    final hits = <({String id, int index})>[];
    for (final student in roster) {
      final index = _matchIndex(padded, student.name);
      if (index >= 0) hits.add((id: student.id, index: index));
    }
    if (hits.isEmpty) return const {};

    // In transcript order, so each name owns the words up to the next name — the
    // window a status keyword for it can live in.
    hits.sort((a, b) => a.index.compareTo(b.index));

    final result = <String, AttendanceStatus>{};
    for (var i = 0; i < hits.length; i++) {
      final start = hits[i].index;
      final end = i + 1 < hits.length ? hits[i + 1].index : padded.length;
      final segment = padded.substring(start, end);
      result[hits[i].id] = _statusForSegment(segment);
    }
    return result;
  }

  static AttendanceStatus _statusForSegment(String segment) {
    final words = segment.split(' ').where((w) => w.isNotEmpty).toSet();
    if (words.any(_absentWords.contains)) return AttendanceStatus.absent;
    if (words.any(_lateWords.contains)) return AttendanceStatus.late;
    return AttendanceStatus.present;
  }

  /// The char index (into the space-padded transcript) where [name] is found as
  /// a whole token — full name first, then a distinctive first name — or -1.
  static int _matchIndex(String paddedTranscript, String name) {
    final normalized = _normalize(name);
    if (normalized.isEmpty) return -1;
    final full = paddedTranscript.indexOf(' $normalized ');
    if (full >= 0) return full;
    final first = normalized.split(' ').first;
    if (first.length < 3) return -1;
    return paddedTranscript.indexOf(' $first ');
  }

  /// Lowercase, and reduce every run of non-letter / non-digit characters to a
  /// single space (Unicode-aware, so Devanagari and other Indic scripts survive
  /// while punctuation does not). Combining marks (`\p{M}` — Indic matras and
  /// the virama) are KEPT: stripping them shreds every Indic name and keyword
  /// (भावना → भ व न), which silently defaulted Devanagari roll calls to present.
  static String _normalize(String input) {
    final lowered = input.toLowerCase();
    final stripped = lowered.replaceAll(
      RegExp(r'[^\p{L}\p{N}\p{M}]+', unicode: true),
      ' ',
    );
    return stripped.trim();
  }
}
