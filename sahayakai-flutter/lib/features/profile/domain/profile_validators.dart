/// Field rules for the teacher profile, as pure predicates.
///
/// They live in the domain, and not next to a form, because the SAME profile is
/// collected twice: once by first-run onboarding (P0.2) and once by the profile
/// editor (P0.8). Two copies of "what a valid phone number is" would drift, and
/// the copy that drifted would be the one that silently accepted a number the
/// other rejected.
///
/// They return bool rather than a message: the message is localized, and these
/// have no business knowing about `AppLocalizations`. Each form maps false to
/// its own copy.
library;

/// True when [value] is blank OR a real Indian mobile number.
///
/// BLANK IS VALID: every profile field is optional. Most teachers will not give
/// a phone number on day one, and refusing to save the rest of their profile
/// over a field they chose to skip would be a bug, not a validation.
///
/// Accepts the three ways a teacher actually writes their number — bare, `+91`,
/// or a leading `0` — and forgives spaces, hyphens and brackets rather than
/// rejecting a number that is perfectly readable. Indian mobile numbers start
/// with 6, 7, 8 or 9.
bool isValidIndianMobile(String? value) {
  final raw = value?.replaceAll(RegExp(r'[\s\-()]'), '').trim() ?? '';
  if (raw.isEmpty) return true;
  return RegExp(r'^(?:\+?91|0)?[6-9]\d{9}$').hasMatch(raw);
}

/// True when [value] is blank OR a six-digit Indian PIN code.
///
/// Blank is valid, for the same reason as [isValidIndianMobile]. No Indian PIN
/// code begins with 0, so the first digit must be 1-9.
bool isValidIndianPincode(String? value) {
  final raw = value?.trim() ?? '';
  if (raw.isEmpty) return true;
  return RegExp(r'^[1-9]\d{5}$').hasMatch(raw);
}
