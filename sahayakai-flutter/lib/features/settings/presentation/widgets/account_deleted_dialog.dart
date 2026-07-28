import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/network/dio_config.dart';
import '../../../../core/platform/link_opener.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/account_deletion.dart';

/// Shown once, immediately after `POST /api/user/delete-account` succeeds —
/// the teacher's one chance to see the grace-window confirmation and (when
/// the server sent one) a real export link before Settings signs them out.
///
/// `FirebaseAuth.instance.authStateChanges()` can take up to an hour to
/// notice a server-side deletion, so the screen does not wait on it: it forces
/// an immediate local sign-out and leaves Settings as soon as this dialog is
/// dismissed (see `SettingsScreen._deleteAccount`). This dialog is that
/// acknowledgement step, not a place the teacher can linger — which is also
/// why the export action, when present, has to live here rather than inline
/// in the danger-zone card: by the time the card's "scheduled" text would
/// render, the teacher is already gone.
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

    return AlertDialog(
      scrollable: true,
      icon: Icon(LucideIcons.checkCircle,
          color: scheme.primary, size: AppIconSize.standalone),
      title: Text(l10n.settingsDeleteSuccessTitle),
      content: Text(l10n.settingsDeleteScheduled),
      actions: [
        if (exportPath != null)
          OutlinedButton.icon(
            onPressed: () => ref
                .read(linkOpenerProvider)
                .open(Uri.parse('$kApiBaseUrl$exportPath')),
            icon: const Icon(LucideIcons.download, size: AppIconSize.inline),
            label: Text(l10n.settingsExportDataAction),
          ),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.settingsDeleteSuccessDone),
        ),
      ],
    );
  }
}
