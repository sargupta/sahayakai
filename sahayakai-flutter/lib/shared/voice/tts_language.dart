// ─── TTS language mapping (SPEC §A.5, the client owns this) ──────────────────
//
// Shared voice infrastructure: the STT/AI language → TTS BCP-47 resolution.
// Extracted here (out of the VIDYA controller) so BOTH the VIDYA conversation
// path AND the result-level read-aloud / spoken-summary path (VOICE_FIRST_GAP
// §5.6) resolve a spoken language identically — one map, no drift. The VIDYA
// controller re-exports these for its existing call sites and tests.

/// STT 2-letter code → TTS BCP-47 tag. Note `mr` borrows the Hindi voice and
/// `or` has no native voice so it falls to English (SPEC §A.5 `LANG_TO_BCP47`).
const Map<String, String> kLangToBcp47 = {
  'en': 'en-IN',
  'hi': 'hi-IN',
  'bn': 'bn-IN',
  'ta': 'ta-IN',
  'te': 'te-IN',
  'kn': 'kn-IN',
  'ml': 'ml-IN',
  'gu': 'gu-IN',
  'pa': 'pa-IN',
  'mr': 'hi-IN',
  'or': 'en-IN',
};

/// Full English names / Sarvam aliases → the supported ISO-2 code.
const Map<String, String> _kLangAliases = {
  'od': 'or', 'ori': 'or', 'oriya': 'or', 'odia': 'or',
  'english': 'en', 'hindi': 'hi', 'kannada': 'kn', 'tamil': 'ta',
  'telugu': 'te', 'marathi': 'mr', 'bengali': 'bn', 'bangla': 'bn',
  'gujarati': 'gu', 'punjabi': 'pa', 'panjabi': 'pa', 'malayalam': 'ml',
};

/// Normalise a classifier / STT language hint to a supported ISO-2 code, or
/// null when unknown. Handles Sarvam's `od`→`or`, full English names
/// (`Hindi`→`hi`), casing, and region suffixes (`hi-IN`→`hi`). This is half the
/// fix for the "form shows English, output Hindi" bug (SPEC §A.8); the other
/// half is `_learnProfile` never persisting an utterance's language.
String? normaliseVidyaLanguage(String? raw) {
  if (raw == null) return null;
  var s = raw.trim().toLowerCase();
  if (s.isEmpty) return null;
  s = s.split(RegExp(r'[-_]')).first; // hi-IN / hi_IN → hi
  s = _kLangAliases[s] ?? s;
  return kLangToBcp47.containsKey(s) ? s : null;
}

/// The TTS BCP-47 tag a reply should be spoken in, defaulting to `en-IN`.
/// Accepts anything the app carries for a language — an ISO-2 code (`kn`), a
/// region tag (`kn-IN`), or the full English `aiName` the tool domains store
/// (`Kannada`) — so a result view can feed its domain's raw `language` straight
/// in without knowing the format.
String vidyaTtsBcp47(String? lang) =>
    kLangToBcp47[normaliseVidyaLanguage(lang) ?? 'en'] ?? 'en-IN';
