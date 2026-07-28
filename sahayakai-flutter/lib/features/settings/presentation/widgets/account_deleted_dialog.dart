import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/platform/share_service.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/account_deletion.dart';
import '../../domain/export_result.dart';
import '../settings_controller.dart';

/// Shown once, immediately after `POST /api/user/delete-account` succeeds —
/// the teacher's one chance to see the grace-window confirmation and (when
/// the server sent one) a real, working export action before Settings signs
/// them out.
///
/// The export action goes through [ExportDataController] ->
/// `SettingsRepository.requestExport` -> the authenticated `ApiClient`, NOT an
/// external browser tab. The previous implementation opened `exportUrl` via
/// `linkOpenerProvider` (`LaunchMode.externalApplication`), which 401ed for
/// essentially every teacher: a mobile app's external browser tab carries
/// neither the Bearer token the export route's middleware requires nor the
/// web-only session cookie it also accepts. Routing the request through the
/// app's own `Dio` client (which already attaches a real Bearer token, see
/// `AuthInterceptor`) is what actually authenticates it.
///
/// `POST /api/export` (not the `GET`, which only returns a JSON stats
/// estimate — see `sahayakai-main/src/app/api/export/route.ts`) is also the
/// real trigger: for an individual teacher within the server's 500-file
/// inline cap — the overwhelming common case — it returns the ZIP archive
/// itself in the same response, which this dialog hands straight to the OS
/// share sheet. Above that cap the server queues a background job instead;
/// see [ExportResult] for why that path shows an honest "queued" notice
/// rather than a promise this app cannot keep.
///
/// `FirebaseAuth.instance.authStateChanges()` can take up to an hour to
/// notice a server-side deletion, so the screen does not wait on it: it forces
/// an immediate local sign-out and leaves Settings as soon as this dialog is
/// dismissed (see `SettingsScreen._deleteAccount`). This dialog is that
/// acknowledgement step, not a place the teacher can linger — which is also
/// why the export action, when present, has to live here rather than inline
/// in the danger-zone card: by the time the card's "scheduled" text would
/// render, the teacher is already gone. "Done" is disabled while an export
/// request is in flight so a mistimed tap can't sign the teacher out (and
/// navigate away) out from under their own download.
class AccountDeletedDialog extends ConsumerWidget {
  const AccountDeletedDialog({super.key, required this.deletion});

  final AccountDeletion deletion;

  static Future<void> show(BuildContext context, AccountDeletion deletion) {
    return showDialog<void>(
      context: context,
      builder: (_) => AccountDeletedDialog(deletion: deletion),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final exportPath = deletion.exportPath;
    final exportState = ref.watch(exportDataControllerProvider);

    // One-shot reactions to the export request settling: hand a ready
    // archive to the OS share sheet, or surface an honest message for the
    // two shapes that are NOT a ready archive (queued job / error). Runs
    // once per state transition, not on every rebuild.
    ref.listen<AsyncValue<ExportResult?>>(exportDataControllerProvider,
        (previous, next) {
      final result = next.valueOrNull;
      if (result is ExportArchiveReady) {
        ref.read(shareServiceProvider).shareFile(
              result.bytes,
              filename: result.filename,
              mimeType: 'application/zip',
            );
        return;
      }
      if (result is ExportJobQueued) {
        ScaffoldMessenger.of(context)
          ..clearSnackBars()
          ..showSnackBar(
            SnackBar(content: Text(l10n.settingsExportQueuedMessage)),
          );
        return;
      }
      if (next.hasError) {
        // No tailored copy per `ApiErrorKind` here (unlike
        // `SettingsScreen._ReauthOrErrorView`): a 401 mid-export is not the
        // same situation as a stale re-auth token on delete, and there is no
        // accurate dedicated message for it, so a plain retry prompt is the
        // honest choice rather than reusing copy that describes a different
        // flow.
        ScaffoldMessenger.of(context)
          ..clearSnackBars()
          ..showSnackBar(
            SnackBar(content: Text(l10n.settingsExportFailedMessage)),
          );
      }
    });

    return AlertDialog(
      scrollable: true,
      icon: Icon(LucideIcons.checkCircle,
          color: scheme.primary, size: AppIconSize.standalone),
      title: Text(l10n.settingsDeleteSuccessTitle),
      content: Text(l10n.settingsDeleteScheduled),
      actions: [
        if (exportPath != null)
          OutlinedButton.icon(
            onPressed: exportState.isLoading
                ? null
                : () => ref
                    .read(exportDataControllerProvider.notifier)
                    .requestExport(exportPath),
            icon: exportState.isLoading
                ? const _ButtonSpinner()
                : const Icon(LucideIcons.download, size: AppIconSize.inline),
            label: Text(l10n.settingsExportDataAction),
          ),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
          onPressed:
              exportState.isLoading ? null : () => Navigator.of(context).pop(),
          child: Text(l10n.settingsDeleteSuccessDone),
        ),
      ],
    );
  }
}

/// A spinner sized to sit inside a button icon slot without changing the
/// button's height. Mirrors `SettingsScreen._ButtonSpinner`.
class _ButtonSpinner extends StatelessWidget {
  const _ButtonSpinner();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 18,
      height: 18,
      child: CircularProgressIndicator(strokeWidth: 2),
    );
  }
}
