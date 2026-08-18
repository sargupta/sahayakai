import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// LabeledField v2 (PREMIUM_DESIGN_SPEC.md §5). A form field's label, an
/// optional inline note, an optional hint, the control, and an optional
/// field-level error — the one labelled-field layout in the app.
///
/// v2 adds an optional [leadingIcon] (a 20dp `onSurfaceVariant` Lucide glyph
/// before the label, for long forms) and an optional [counterText] (a
/// tabular-figure count, right-aligned on the label row). Both default to
/// null, so the v1 API ({label, child, optionalLabel, hint, errorText}) and
/// every call site are preserved.
///
/// v3 adds an optional [trailing] slot on the label row (right-aligned, after
/// any counter) — a general end-of-row affordance a form uses to hang, e.g.,
/// the VIDYA inline "dictate this field" mic beside a topic/question label. It
/// too defaults to null, so every existing call site is unchanged.
class LabeledField extends StatelessWidget {
  const LabeledField({
    super.key,
    required this.label,
    required this.child,
    this.optionalLabel,
    this.hint,
    this.errorText,
    this.leadingIcon,
    this.counterText,
    this.trailing,
  });

  final String label;
  final Widget child;

  /// A muted note shown inline after the label (e.g. an "optional" tag).
  final String? optionalLabel;

  /// A muted line under the label explaining the field.
  final String? hint;

  /// A field-level error shown under the control in the error colour.
  final String? errorText;

  /// An optional leading Lucide glyph before the label (long forms).
  final IconData? leadingIcon;

  /// An optional right-aligned tabular counter (e.g. "0 / 1000").
  final String? counterText;

  /// An optional right-aligned affordance on the label row (e.g. an inline
  /// voice-dictation mic). Sits after any [counterText].
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final extras = AppTextExtras.of(context);
    final labelStyle = text.titleSmall?.copyWith(letterSpacing: 0.2);
    final mutedStyle = text.bodySmall?.copyWith(color: scheme.onSurfaceVariant);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            if (leadingIcon != null) ...[
              Icon(leadingIcon,
                  size: AppIconSize.inline, color: scheme.onSurfaceVariant),
              const SizedBox(width: AppSpacing.space2),
            ],
            Flexible(child: Text(label, style: labelStyle)),
            if (optionalLabel != null) ...[
              const SizedBox(width: AppSpacing.space2),
              Text(optionalLabel!, style: mutedStyle),
            ],
            if (counterText != null || trailing != null) const Spacer(),
            if (counterText != null)
              Text(
                counterText!,
                style: extras.dataMedium.copyWith(color: scheme.onSurfaceVariant),
              ),
            if (trailing != null) ...[
              if (counterText != null) const SizedBox(width: AppSpacing.space2),
              trailing!,
            ],
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
