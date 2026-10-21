import 'package:flutter/foundation.dart';

/// The exact word a teacher must type before the delete-account confirm button
/// becomes tappable.
///
/// NOT localized, on purpose. It is a safety interlock, not prose: the same
/// literal is what the web app asks for, and a translated token would drift
/// against the 11 ARB files (most of which fall back to English anyway) and
/// silently weaken or break the guard in a locale nobody tested. The
/// *instruction* around it IS localized, with the word interpolated
/// (`settingsDeleteConfirmPrompt`), so the teacher always sees what to type in
/// their own language.
const String kDeleteConfirmWord = 'DELETE';

/// True only when [input] is exactly [kDeleteConfirmWord].
///
/// Whitespace is trimmed because soft keyboards love to append a space, and
/// trimming does not weaken the interlock. Everything else is exact and
/// case-sensitive: `delete`, `Delete`, `DELETE ME` and `` all return false.
/// Accidental deletion must be impossible.
bool isDeleteConfirmed(String? input) =>
    input?.trim() == kDeleteConfirmWord;

/// The `POST /api/user/delete-account` 200 result: the account is *scheduled*
/// for deletion, not gone. The teacher keeps a grace window to export their
/// work, and the UI must say so rather than imply an instant wipe.
@immutable
class AccountDeletion {
  const AccountDeletion({this.gracePeriodEnd, this.exportPath});

  /// When the grace window closes (the API sends now + 30 days). Null when the
  /// server omitted or malformed it.
  final DateTime? gracePeriodEnd;

  /// Server-provided path to the data export (`/api/export`).
  final String? exportPath;
}
