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

/// How fast the room level drifts up towards a steady sound, per reading
/// (readings come every 100 ms). Slow, so a teacher talking for a while is not
/// mistaken for the room, but steady noise that rose after the first reading
/// (a fan switched on) still becomes the room within seconds.
const double kRoomRise = 0.004;

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
/// threshold. The room level starts at the first reading, falls instantly to
/// any quieter one and drifts slowly up towards steady sound.
///
/// Shared by VIDYA's capture and the form-field mic so both stop listening the
/// moment the teacher stops talking, in a quiet staffroom or a noisy class.
class SpeechActivity {
  double _room = double.infinity;
  double _peak = 0;
  final List<double> _recent = [];
  bool _started = false;

  /// The room's current level (the quietest steady sound heard).
  double get room => _room.isFinite ? _room : 0;

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
    if (!_room.isFinite || level < _room) {
      _room = level;
    } else {
      _room += (level - _room) * kRoomRise;
    }
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
    _room = double.infinity;
    _peak = 0;
    _recent.clear();
    _started = false;
  }
}
