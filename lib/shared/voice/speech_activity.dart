/// How far above the room's level speech must rise (about 5 dB), so a dead-
/// silent line does not count every flicker as speech. Measured from the
/// room, never against a fixed level: a fixed onset (it was 0.18, about -37 dBFS)
/// sat UNDER the hum of a fan or a noisy mic, so the room itself counted as
/// speech, the trailing silence never came and every capture ran to the hard
/// cap until the teacher tapped the mic again.
const double kSpeechMargin = 0.12;

/// Sound this far above the room, heard before the initial-silence window
/// closes, is worth transcribing even though it never crossed the onset.
const double kSoundHeardMargin = 0.05;

/// How many recent readings (~4 s) the room level is learnt from: the room
/// is the quietest of them. A window rather than "the quietest ever, drifting
/// slowly up": the mic's first readings are near zero while it warms up, and
/// with the old slow drift (0.4% a reading) a room learnt from them took
/// ~25 s to rise to a normal background hum, so the hum counted as speech,
/// the trailing silence never came and every capture ran to the 30 s cap
/// (reproduced on the emulator, 2026-11-13). Long enough that the dips
/// between a teacher's words keep the room down while she talks.
const int kRoomWindow = 40;

/// Readings at the onset, within the last [kOnsetWindow] readings, that start
/// speech. One loud reading is a click or a knock; a spoken word spans several.
const int kOnsetReadings = 2;

/// How many recent readings (~3 s) are kept to judge speech against the room.
/// Kept so a teacher who was already talking when the mic opened still counts:
/// the room is then learnt from the pause after, and those first readings are
/// recognised as speech in hindsight.
const int kOnsetWindow = 30;

/// Follows one capture's mic levels (0..1, one every ~100 ms) and says which
/// readings are speech, against the room's own level rather than a fixed
/// threshold. The room level is the quietest reading of the last
/// [kRoomWindow], so it falls instantly to a quieter moment and rises to a
/// louder steady sound within a few seconds. Readings of exactly 0 before
/// the first sound are the mic warming up and are not the room.
///
/// Shared by VIDYA's capture and the form-field mic so both stop listening the
/// moment the teacher stops talking, in a quiet staffroom or a noisy class.
class SpeechActivity {
  final List<double> _levels = [];
  double _peak = 0;
  final List<double> _recent = [];
  bool _started = false;

  /// The room's current level (the quietest recent reading).
  double get room =>
      _levels.isEmpty ? 0 : _levels.reduce((a, b) => a < b ? a : b);

  /// The loudest reading so far.
  double get peak => _peak;

  /// Whether speech has begun in this capture.
  bool get speechStarted => _started;

  /// The level a reading must reach to count as speech.
  double get onset => room + kSpeechMargin;

  /// Whether something rose clearly above the room, even if it never reached
  /// the onset (soft speech worth sending to speech-to-text).
  bool get soundHeard => _peak >= room + kSoundHeardMargin;

  /// Takes one reading. Returns true when it is speech: once speech has
  /// begun, any reading at the onset keeps it going (and so restarts the
  /// trailing-silence wait). Speech begins when [kOnsetReadings] of the recent
  /// readings reach the onset; the reading that begins it returns true even
  /// when it is itself quiet (the talking came before the room was known).
  bool add(double level) {
    if (level > _peak) _peak = level;
    // Mic warm-up: zeros before any sound say nothing about the room.
    if (_levels.isEmpty && level <= 0) return false;
    _levels.add(level);
    if (_levels.length > kRoomWindow) _levels.removeAt(0);
    final threshold = onset;
    if (_started) return level >= threshold;
    _recent.add(level);
    if (_recent.length > kOnsetWindow) _recent.removeAt(0);
    if (_recent.where((r) => r >= threshold).length >= kOnsetReadings) {
      _started = true;
      return true;
    }
    return false;
  }

  /// Forgets everything, for the next capture.
  void reset() {
    _levels.clear();
    _peak = 0;
    _recent.clear();
    _started = false;
  }
}
