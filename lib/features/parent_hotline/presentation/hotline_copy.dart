import 'package:flutter/widgets.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/network/api_exception.dart';
import '../../parent_message/presentation/widgets/parent_message_error_view.dart';
import '../domain/parent_outreach.dart';

/// A parent language (the full English name the API uses, e.g. `"Kannada"`)
/// in its own script (`ಕನ್ನಡ`), as the teacher would recognise it. A name the
/// app does not know is shown as stored rather than guessed at.
String nativeLanguageLabel(String language) {
  final key = language.trim().toLowerCase();
  if (key.isEmpty) return '';
  for (final l in AppLocale.values) {
    if (l.aiName.toLowerCase() == key) return l.nativeLabel;
  }
  return language.trim();
}

/// The first word of a student's name, for "Contact Asha's parent".
String firstName(String fullName) {
  final parts = fullName.trim().split(RegExp(r'\s+'));
  return parts.isEmpty ? fullName.trim() : parts.first;
}

/// Translated copy for a failed hotline request, mapped by kind and status —
/// never the server's own text (English, and sometimes a machine code such as
/// `PLAN_UPGRADE_REQUIRED` or `Forbidden`).
///
/// [drafting] is true only for the AI message draft: its busy / daily-limit /
/// missing-field copy names the assistant, which would be wrong for a class
/// list, the evidence or a call.
String hotlineErrorText(
  AppLocalizations l10n,
  Object? cause, {
  bool drafting = false,
}) {
  if (cause is ApiException) {
    switch (cause.kind) {
      case ApiErrorKind.forbidden:
        // The draft route's plan gate is an upgrade, not an access problem.
        if (cause.hasCode('PLAN_UPGRADE_REQUIRED') ||
            cause.hasCode('PREMIUM_REQUIRED')) {
          return l10n.parentMessageUpgradeBody;
        }
        return l10n.parentHotlineErrorForbidden;
      case ApiErrorKind.notFound:
        return l10n.parentHotlineErrorNotFound;
      case ApiErrorKind.network:
        return l10n.parentHotlineErrorOffline;
      case ApiErrorKind.unauthorized:
        return l10n.parentMessageSignIn;
      case ApiErrorKind.timeout:
        return l10n.parentMessageTimeout;
      case ApiErrorKind.rateLimited:
      case ApiErrorKind.server:
      case ApiErrorKind.badResponse:
      case ApiErrorKind.cancelled:
      case ApiErrorKind.unknown:
        return drafting
            ? parentMessageErrorText(l10n, cause)
            : l10n.parentHotlineGenericError;
    }
  }
  return l10n.parentHotlineGenericError;
}

/// Icon, label and description for a reason card.
(IconData, String, String) reasonMeta(
  AppLocalizations l10n,
  OutreachReason reason,
) {
  switch (reason) {
    case OutreachReason.consecutiveAbsences:
      return (
        LucideIcons.calendarX2,
        l10n.parentHotlineReasonAbsencesLabel,
        l10n.parentHotlineReasonAbsencesDesc,
      );
    case OutreachReason.poorPerformance:
      return (
        LucideIcons.trendingDown,
        l10n.parentHotlineReasonPerformanceLabel,
        l10n.parentHotlineReasonPerformanceDesc,
      );
    case OutreachReason.behavioralConcern:
      return (
        LucideIcons.alertTriangle,
        l10n.parentHotlineReasonBehaviourLabel,
        l10n.parentHotlineReasonBehaviourDesc,
      );
    case OutreachReason.positiveFeedback:
      return (
        LucideIcons.star,
        l10n.parentHotlineReasonPositiveLabel,
        l10n.parentHotlineReasonPositiveDesc,
      );
  }
}

/// The short reason word ("Absences", "Good news").
String reasonWord(AppLocalizations l10n, OutreachReason reason) {
  switch (reason) {
    case OutreachReason.consecutiveAbsences:
      return l10n.parentHotlineSummaryReasonAbsences;
    case OutreachReason.poorPerformance:
      return l10n.parentHotlineSummaryReasonPerformance;
    case OutreachReason.behavioralConcern:
      return l10n.parentHotlineSummaryReasonBehaviour;
    case OutreachReason.positiveFeedback:
      return l10n.parentHotlineSummaryReasonPositive;
  }
}

/// m:ss for a countdown or an elapsed time.
String formatMinutesSeconds(int seconds) {
  final s = seconds < 0 ? 0 : seconds;
  return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
}
