import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/account_deletion.dart';

/// The typed-confirmation interlock in front of account deletion.
///
/// Deleting an account is irreversible in practice (a 30-day grace window, then
/// gone), so it must be impossible to trigger by accident. Three guards stack:
///   1. it is a dialog, not an inline button, so a stray tap cannot reach it;
///   2. the confirm button is DISABLED until [kDeleteConfirmWord] is typed
///      exactly — muscle memory and misfires both fail closed;
///   3. the confirm button is error-coloured and never the default focus, so
///      "Keep my account" is the easy path.
///
/// Returns `true` only when the teacher typed the word AND tapped confirm.
/// Anything else (barrier tap, back gesture, cancel) returns null.
class DeleteAccountDialog extends StatefulWidget {
  const DeleteAccountDialog({super.key});

  /// Shows the dialog. `barrierDismissible` stays true: escaping must always be
  /// easy — it is only *confirming* that is made hard.
  static Future<bool?> show(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (_) => const DeleteAccountDialog(),
    );
  }

  @override
  State<DeleteAccountDialog> createState() => _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends State<DeleteAccountDialog> {
  final _controller = TextEditingController();
  bool _confirmed = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    final next = isDeleteConfirmed(value);
    // Only rebuild when the gate actually flips, not on every keystroke.
    if (next != _confirmed) setState(() => _confirmed = next);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return AlertDialog(
      // Lets the title + content scroll instead of overflowing at textScale
      // 1.3 with a long Indic body.
      scrollable: true,
      icon: Icon(LucideIcons.alertTriangle, color: scheme.error, size: 28),
      title: Text(l10n.settingsDeleteDialogTitle),
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(l10n.settingsDeleteDialogBody, style: text.bodyMedium),
          const SizedBox(height: AppSpacing.space4),
          Text(
            l10n.settingsDeleteConfirmPrompt(kDeleteConfirmWord),
            style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: AppSpacing.space3),
          TextField(
            controller: _controller,
            onChanged: _onChanged,
            autocorrect: false,
            enableSuggestions: false,
            textCapitalization: TextCapitalization.characters,
            decoration: InputDecoration(
              labelText: l10n.settingsDeleteConfirmLabel,
              hintText: kDeleteConfirmWord,
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          // The theme's TextButton floor is 44dp; Settings holds the rubric's
          // 48dp line locally rather than lowering it app-wide.
          style: TextButton.styleFrom(minimumSize: const Size(0, 48)),
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.settingsDeleteCancel),
        ),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: scheme.error,
            foregroundColor: scheme.onError,
            // The theme sets a flat (non-state-aware) primary background, so
            // the disabled colours must be spelled out or the locked button
            // would still look tappable.
            disabledBackgroundColor: scheme.onSurface.withValues(alpha: 0.12),
            disabledForegroundColor: scheme.onSurface.withValues(alpha: 0.38),
            minimumSize: const Size(0, 48),
          ),
          onPressed:
              _confirmed ? () => Navigator.of(context).pop(true) : null,
          child: Text(l10n.settingsDeleteConfirm),
        ),
      ],
    );
  }
}
