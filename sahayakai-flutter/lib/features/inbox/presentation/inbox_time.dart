import '../../../core/i18n/gen/app_localizations.dart';

/// A compact, localized relative time for an inbox row / message meta line
/// ("now", "5m", "3h", "2d", "4w"), computed from an ISO-8601 [iso] against
/// [now]. Returns an empty string when [iso] is null or unparseable, so a row
/// with no `lastMessageAt` (a conversation before its first message) simply
/// shows no timestamp rather than a fabricated one.
///
/// Rendered through `AppTextExtras.dataMedium` (tabular figures) at the call
/// site so the numerals never reflow. The ARB values keep the ICU `{count}`
/// placeholder in every language.
String inboxRelativeTime(String? iso, DateTime now, AppLocalizations l10n) {
  if (iso == null || iso.isEmpty) return '';
  final at = DateTime.tryParse(iso);
  if (at == null) return '';

  // A clock skew (a server timestamp a few seconds ahead of the device) must
  // not read as a negative age; clamp to zero so it shows "now".
  final delta = now.difference(at);
  final seconds = delta.inSeconds < 0 ? 0 : delta.inSeconds;

  if (seconds < 60) return l10n.inboxTimeNow;
  final minutes = seconds ~/ 60;
  if (minutes < 60) return l10n.inboxTimeMinutes(minutes);
  final hours = minutes ~/ 60;
  if (hours < 24) return l10n.inboxTimeHours(hours);
  final days = hours ~/ 24;
  if (days < 7) return l10n.inboxTimeDays(days);
  final weeks = days ~/ 7;
  return l10n.inboxTimeWeeks(weeks);
}
