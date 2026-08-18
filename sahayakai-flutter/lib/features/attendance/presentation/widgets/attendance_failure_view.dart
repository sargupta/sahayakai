import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/router/routes.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/offline_view.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../attendance_failure.dart';

/// The one place a failed attendance READ is turned into a panel.
///
/// Four shapes, chosen by [attendanceFailureOf]:
///
///   • **signed out** — a sign-in `EmptyView` with the action that actually
///     helps. A retry here would be a lie: the read would fail identically.
///   • **offline** — `OfflineView` with a retry, because rural connectivity is
///     intermittent and this is an expected failure, not an exceptional one.
///   • **roster unavailable** — the state this feature exists to get right;
///     see [RosterUnavailableView] below.
///   • **anything else** — `ErrorView` with the caller's own localized
///     [message] and a retry.
class AttendanceFailureView extends StatelessWidget {
  const AttendanceFailureView({
    super.key,
    required this.error,
    required this.message,
    this.onRetry,
  });

  final Object error;

  /// The screen's own localized line for an ordinary failure ("We could not
  /// load your classes", …). Never the server's message — see
  /// `attendance_failure.dart`.
  final String message;

  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    switch (attendanceFailureOf(error)) {
      case AttendanceFailure.signedOut:
        return EmptyView(
          icon: LucideIcons.logIn,
          title: l10n.attendanceSignedOutTitle,
          message: l10n.attendanceSignedOutBody,
          action: SecondaryButton(
            label: l10n.actionSignIn,
            icon: LucideIcons.logIn,
            onPressed: () => context.push(Routes.login),
          ),
        );
      case AttendanceFailure.offline:
        return OfflineView(onRetry: onRetry);
      case AttendanceFailure.rosterUnavailable:
        return const RosterUnavailableView();
      case AttendanceFailure.message:
        return ErrorView(
          message: attendanceFailureMessage(l10n, error, fallback: message),
          onRetry: onRetry,
        );
    }
  }
}

/// **The state this unit exists to get right.**
///
/// `listRoster` throws `RosterProjectionUnavailableException` today, on
/// purpose. The masked `?projection=roster` response ships in draft PR #124
/// and is not merged, so production ignores the unknown query parameter and
/// answers with the FULL student documents — every parent's E.164 number, for
/// every student in the class. The repository refuses to decode that rather
/// than putting those numbers on the handset, and the refusal reaches here.
///
/// Three things this panel must therefore be, and one it must not:
///
///   1. **Specific.** "Something went wrong" would send a teacher to check
///      their connection, re-open the class, or ring the school office about a
///      roster that is perfectly intact.
///   2. **Not the teacher's fault, and said so.** Nothing they did caused
///      this, nothing in their class is broken, and nothing has been lost.
///   3. **Honest about what still works.** Marking the register and the
///      monthly view are unaffected — they read routes that carry no contact
///      detail — so the teacher is not left thinking Attendance is down.
///
///   4. **Not an error.** No red, no alert triangle, no retry button. A retry
///      would fail identically until a server change lands, and offering one
///      would be a small lie repeated on every tap. The glyph is a shield,
///      because a withheld phone number is the feature working.
class RosterUnavailableView extends StatelessWidget {
  const RosterUnavailableView({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return EmptyView(
      icon: LucideIcons.shieldCheck,
      title: l10n.attendanceRosterUnavailableTitle,
      message: l10n.attendanceRosterUnavailableBody,
    );
  }
}
