import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// A form field's label, optional inline note, optional hint, its control, and
/// an optional field-level error — the one labelled-field layout in the app.
///
/// Six screens each kept a private `_Field`: settings/profile/onboarding had
/// {label, hint}, the tool forms had {label, optionalLabel}, and quiz had the
/// full {label, optionalLabel, hint, errorText}. They only differed in which
/// of those slots they exposed, so this is their union — the label always
/// wraps ([Flexible]) when it shares a row with the optional note, which the
/// lesson-plan copy did not, so a long Indic label no longer risks the row.
class LabeledField extends StatelessWidget {
  const LabeledField({
    super.key,
    required this.label,
    required this.child,
    this.optionalLabel,
    this.hint,
    this.errorText,
  });

  final String label;
  final Widget child;

  /// A muted note shown inline after the label (e.g. an "optional" tag).
  final String? optionalLabel;

  /// A muted line under the label explaining the field.
  final String? hint;

  /// A field-level error shown under the control in the error colour.
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    // A field label tracks tighter than a section label (which bakes ls 0.6):
    // this is the value all six `_Field`s already used.
    final labelStyle = text.titleSmall?.copyWith(letterSpacing: 0.2);
    final mutedStyle = text.bodySmall?.copyWith(color: scheme.onSurfaceVariant);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (optionalLabel == null)
          Text(label, style: labelStyle)
        else
          Row(
            children: [
              Flexible(child: Text(label, style: labelStyle)),
              const SizedBox(width: AppSpacing.space2),
              Text(optionalLabel!, style: mutedStyle),
            ],
          ),
        if (hint != null) ...[
          const SizedBox(height: AppSpacing.space1),
          Text(hint!, style: mutedStyle),
        ],
        const SizedBox(height: AppSpacing.space3),
        child,
        if (errorText != null) ...[
          const SizedBox(height: AppSpacing.space2),
          Text(
            errorText!,
            style: text.bodySmall?.copyWith(color: scheme.error),
          ),
        ],
      ],
    );
  }
}
