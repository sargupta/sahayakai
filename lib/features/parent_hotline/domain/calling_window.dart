/// When a parent may be phoned — a client mirror of `src/lib/calling-hours.ts`.
///
/// The call route refuses (`409 OUTSIDE_CALLING_HOURS`) outside 09:00–21:00
/// IST, and that refusal stays the guarantee. The app mirrors the same window
/// for one reason: the flow CREATES the outreach before it dials, and an
/// outreach created at night and then refused is left on the server as an
/// `initiated` record that counts toward the 5-minute dedup and looks like a
/// call in progress to the resume lookup. Withholding "Call parent" outside the
/// window means that record is never written in the first place.
///
/// IST is fixed (+05:30, no DST), and it is the parents' clock that matters, so
/// the device's own time zone is irrelevant here — exactly as on the server.
abstract final class CallingWindow {
  /// First IST hour calling is allowed (inclusive).
  static const int startHour = 9;

  /// First IST hour calling is no longer allowed (exclusive).
  static const int endHour = 21;

  static const Duration _ist = Duration(hours: 5, minutes: 30);

  /// Whether a call may be placed at [instant].
  static bool isOpen(DateTime instant) {
    final hour = instant.toUtc().add(_ist).hour;
    return hour >= startHour && hour < endHour;
  }

  /// When calling next opens (a UTC instant), or null when it is open now.
  static DateTime? nextOpening(DateTime instant) {
    if (isOpen(instant)) return null;
    final ist = instant.toUtc().add(_ist);
    // Wall-clock 09:00 on the IST calendar day, expressed as if it were UTC,
    // then shifted back by the offset to the real UTC instant.
    var opening = DateTime.utc(ist.year, ist.month, ist.day, startHour);
    if (ist.hour >= endHour) opening = opening.add(const Duration(days: 1));
    return opening.subtract(_ist);
  }
}
