import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/network/api_exception.dart';
import '../data/staffroom_transport.dart';

/// The cool-down a rate-limited (429) Community write asked for, in whole
/// minutes, or null when the server gave no hint.
///
/// Prefers the structured hint ([ApiException.retryAfterSeconds], from a
/// `retryAfterSeconds` body field or a `Retry-After` header). The Community
/// routes send neither today: their 429 body is the service's
/// `{ error: "Rate limit exceeded. Please wait N minutes." }`, so the number is
/// read out of that sentence — only the number is used; the English text is
/// never shown.
int? communityRetryMinutes(ApiException error) {
  final seconds = error.retryAfterSeconds;
  if (seconds != null && seconds > 0) return (seconds / 60).ceil();
  final match = RegExp(r'wait\s+(\d+)\s+minute', caseSensitive: false)
      .firstMatch(error.message);
  final minutes = match == null ? null : int.tryParse(match.group(1)!);
  return (minutes != null && minutes > 0) ? minutes : null;
}

/// Translated, user-facing copy for a failed Community write (post, chat,
/// connection, join). [fallback] is the action-specific "couldn't …" line used
/// when the failure is not one of the cases worth naming.
String communityErrorText(
  AppLocalizations l10n,
  Object? error, {
  required String fallback,
}) {
  if (error is ChatMessageTooLongException) return l10n.inboxComposerTooLong;
  if (error is! ApiException) return fallback;
  switch (error.kind) {
    case ApiErrorKind.rateLimited:
      final minutes = communityRetryMinutes(error);
      return minutes == null
          ? l10n.communityRateLimited
          : l10n.communityRateLimitedMinutes(minutes);
    case ApiErrorKind.network:
    case ApiErrorKind.timeout:
      return l10n.communityOffline;
    case ApiErrorKind.forbidden:
      // The group routes' membership gate ("Not a member of this group").
      return error.message.toLowerCase().contains('member')
          ? l10n.communityNotMember
          : fallback;
    case ApiErrorKind.unauthorized:
    case ApiErrorKind.notFound:
    case ApiErrorKind.server:
    case ApiErrorKind.badResponse:
    case ApiErrorKind.cancelled:
    case ApiErrorKind.unknown:
      return fallback;
  }
}

/// Translates a `recommendationReason` from
/// `GET /api/community/teachers/recommended`. The server picks from a fixed
/// English set (`src/server/community.ts`): "Same School", "Nearby Peer",
/// "Active Educator", or "{subject} Peer". Known values are translated; the
/// subject itself is server data and stays as written. Anything else is shown
/// as-is rather than guessed at.
String? communityReasonLabel(AppLocalizations l10n, String? reason) {
  final value = reason?.trim();
  if (value == null || value.isEmpty) return null;
  switch (value) {
    case 'Same School':
      return l10n.communityReasonSameSchool;
    case 'Nearby Peer':
      return l10n.communityReasonNearby;
    case 'Active Educator':
      return l10n.communityReasonActive;
  }
  const suffix = ' Peer';
  if (value.endsWith(suffix) && value.length > suffix.length) {
    return l10n.communityReasonSubjectPeer(
      value.substring(0, value.length - suffix.length).trim(),
    );
  }
  return value;
}
