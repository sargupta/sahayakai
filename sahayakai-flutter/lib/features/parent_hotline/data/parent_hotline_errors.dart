import '../../../core/network/api_exception.dart';

/// Typed, branchable domain errors for the Parent Hotline data layer.
///
/// The repository translates the transport-level [ApiException] (which the
/// shared `ApiClient` already maps from Dio) into one of these where the U-PH2
/// controller needs to branch on the *reason* rather than a raw status code.
/// This keeps the controller free of status-code / machine-string archaeology:
/// it switches on a sealed type instead.
///
/// What is and isn't wrapped:
///   • createOutreach → [PremiumRequiredException] (403 `PREMIUM_REQUIRED`),
///     [NoParentPhoneException] (422), [OutreachDedupException] (429),
///     [OutreachTargetNotFoundException] (404).
///   • placeCall → [UnsupportedCallLanguageException] (422 unsupported-lang),
///     [NoParentPhoneException] (422 no-valid-phone),
///     [CallPlacementFailedException] (502),
///     [TwilioNotConfiguredException] (503),
///     [OutreachTargetNotFoundException] (404).
///   • Everything else — including **401 (signed-out / auth)**, a non-premium
///     403 (ownership `Forbidden`), 5xx, network, and timeout — is rethrown
///     as-is (the original [ApiException]). Auth stays an [ApiException] so the
///     feature's `authStateProvider` gate handles it uniformly with every other
///     repository (check `error is ApiException && error.isAuth`), exactly as
///     `parent_message` / `vidya` do. That is the deliberate "auth branch".
///
/// [ParentHotlineException] is `sealed`, so the controller can switch over it
/// exhaustively.
sealed class ParentHotlineException implements Exception {
  const ParentHotlineException(this.cause);

  /// The underlying transport error, retained for its user-safe [message], the
  /// raw Dio object, and the status code.
  final ApiException cause;

  /// The server's user-safe message (or a sensible fallback).
  String get message => cause.message;

  @override
  String toString() => '$runtimeType(${cause.statusCode}): $message';

  // ── Mapping factories ──────────────────────────────────────────────────────

  /// Maps a `POST /api/attendance/outreach` [ApiException] to a typed hotline
  /// error, or returns null to signal "not a case we specialize — rethrow the
  /// original" (401 auth, non-premium 403, 5xx, network…).
  ///
  /// 403 is decoded on the machine string: only `PREMIUM_REQUIRED` becomes
  /// [PremiumRequiredException]; an ownership `Forbidden` 403 is left to the
  /// original [ApiException].
  static ParentHotlineException? fromCreateOutreach(ApiException e) {
    switch (e.statusCode) {
      case 403:
        if (e.errorCode == _premiumRequiredCode) {
          return PremiumRequiredException(e);
        }
        return null; // ownership Forbidden → rethrow original
      case 404:
        return OutreachTargetNotFoundException(e);
      case 422:
        // The outreach route's only 422 is "Student has no parent phone on
        // record".
        return NoParentPhoneException(e);
      case 429:
        // The route returns `{ error, retryAfterSeconds }` + a `Retry-After`
        // header; `ApiException` decoded the number for us. Default to the
        // 5-minute dedup window if, somehow, neither was present.
        return OutreachDedupException(e,
            retryAfterSeconds: e.retryAfterSeconds ?? _defaultDedupSeconds);
      default:
        return null;
    }
  }

  /// Maps a `POST /api/attendance/call` [ApiException] to a typed hotline
  /// error, or returns null to rethrow the original.
  ///
  /// [parentLanguage] is the language the repository sent — the server does not
  /// echo it in the error body, so the repository supplies it for
  /// [UnsupportedCallLanguageException].
  ///
  /// The call route has TWO distinct 422s with no machine codes to tell them
  /// apart — "Outreach record has no valid parent phone" and "Auto-call not
  /// supported for {lang}. Use WhatsApp copy instead." — so the phrase "phone"
  /// in the server message is the only signal that disambiguates them.
  static ParentHotlineException? fromPlaceCall(
    ApiException e, {
    required String parentLanguage,
  }) {
    switch (e.statusCode) {
      case 404:
        return OutreachTargetNotFoundException(e);
      case 422:
        if (e.message.toLowerCase().contains('phone')) {
          return NoParentPhoneException(e);
        }
        return UnsupportedCallLanguageException(e, language: parentLanguage);
      case 502:
        return CallPlacementFailedException(e);
      case 503:
        return TwilioNotConfiguredException(e);
      default:
        return null;
    }
  }

  /// The exact machine string the outreach route emits for a non-advanced plan.
  static const String _premiumRequiredCode = 'PREMIUM_REQUIRED';

  /// The route's dedup window is 5 minutes; used only if a 429 carried no
  /// numeric hint at all (it always should).
  static const int _defaultDedupSeconds = 5 * 60;
}

/// 403 — the teacher is not on an advanced/premium plan
/// (`/api/attendance/outreach` → `{ error: 'PREMIUM_REQUIRED' }`). The whole
/// hotline is gated on this; U-PH2 shows the upgrade path.
final class PremiumRequiredException extends ParentHotlineException {
  const PremiumRequiredException(super.cause);
}

/// 422 — the student has no parent phone on record (create), or the stored
/// phone is not valid E.164 (call). There is nothing to dial; U-PH2 disables
/// the row / falls back to WhatsApp copy, mirroring the server.
final class NoParentPhoneException extends ParentHotlineException {
  const NoParentPhoneException(super.cause);
}

/// 429 — a recent outreach for this (teacher, student) already exists inside
/// the 5-minute dedup window. [retryAfterSeconds] is the exact cool-down so the
/// controller can render a countdown instead of an error loop.
final class OutreachDedupException extends ParentHotlineException {
  const OutreachDedupException(super.cause, {required this.retryAfterSeconds});

  /// Seconds until another outreach for this student is allowed.
  final int retryAfterSeconds;
}

/// 422 — auto-call is not available for [language] (no voice in
/// `TWILIO_LANGUAGE_MAP`). U-PH2 hides "Call parent" and offers WhatsApp copy.
final class UnsupportedCallLanguageException extends ParentHotlineException {
  const UnsupportedCallLanguageException(super.cause, {required this.language});

  /// The full language name the call was attempted in (e.g. `"Kannada"`).
  final String language;
}

/// 502 — the provider (Twilio/Exotel) failed to initiate the call. Transient;
/// U-PH2 offers "Try again".
final class CallPlacementFailedException extends ParentHotlineException {
  const CallPlacementFailedException(super.cause);
}

/// 503 — telephony is not configured server-side (Twilio creds / voice service
/// URL absent). U-PH2 falls back to WhatsApp copy.
final class TwilioNotConfiguredException extends ParentHotlineException {
  const TwilioNotConfiguredException(super.cause);
}

/// 404 — the class / student (create) or the outreach doc (call) was not
/// found. Usually a stale id; U-PH2 restarts the flow.
final class OutreachTargetNotFoundException extends ParentHotlineException {
  const OutreachTargetNotFoundException(super.cause);
}
