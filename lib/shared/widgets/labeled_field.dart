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
    this.trailingBesideChild = false,
  });

  final String label;
  final Widget child;

  /// A muted note shown inline after the label (e.g. an "optional" tag).
  final String? optionalLabel;

  /// A muted line under the label explaining the field.
  final String? hint;

  /// A field-level error shown under the control in the error colour.
  final String? errorText;

  /// Kept for call sites; the UX map draws no icon beside a field label.
  final IconData? leadingIcon;

  /// An optional right-aligned tabular counter (e.g. "0 / 1000").
  final String? counterText;

  /// An optional right-aligned affordance on the label row (e.g. an inline
  /// voice-dictation mic). Sits after any [counterText].
  final Widget? trailing;

  /// Puts [trailing] at the end of the control's own row instead of the label
  /// row: the map's topic card, where the small mic sits beside the text.
  final bool trailingBesideChild;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final extras = AppTextExtras.of(context);
    // The UX map's field label is its `.ov` overline: saffron, bold, tracked
    // and uppercase in Latin script only (Indic scripts have no case, and
    // tracking breaks their joins). The map draws no icon beside it.
    final latin = Localizations.localeOf(context).languageCode == 'en';
    final labelStyle = text.labelMedium?.copyWith(
      fontSize: 12,
      fontWeight: FontWeight.w700,
      letterSpacing: latin ? 1.5 : 0,
      color: AppColors.textEyebrow,
    );
    final mutedStyle = text.bodySmall?.copyWith(
      fontSize: 12.5,
      color: AppColors.textMuted,
    );

    final besideChild = trailingBesideChild ? trailing : null;
    final rowTrailing = trailingBesideChild ? null : trailing;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            // Expanded when something sits at the end of the row, so that
            // thing is pushed to the edge; Flexible otherwise, so the
            // optional tag stays beside the label.
            if (counterText != null || rowTrailing != null)
              Expanded(
                child: Text(
                  latin ? label.toUpperCase() : label,
                  style: labelStyle,
                ),
              )
            else
              Flexible(
                child: Text(
                  latin ? label.toUpperCase() : label,
                  style: labelStyle,
                ),
              ),
            if (optionalLabel != null) ...[
              const SizedBox(width: AppSpacing.space2),
              Text(optionalLabel!, style: mutedStyle),
            ],
            if (counterText != null)
              Text(
                counterText!,
                style: extras.dataMedium.copyWith(color: AppColors.textMuted),
              ),
            if (rowTrailing != null) ...[
              if (counterText != null) const SizedBox(width: AppSpacing.space2),
              rowTrailing,
            ],
          ],
        ),
        if (hint != null) ...[
          const SizedBox(height: 2),
          Text(hint!, style: mutedStyle),
        ],
        SizedBox(height: besideChild == null ? AppSpacing.space2 : 2),
        if (besideChild == null)
          child
        else
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: child),
              const SizedBox(width: AppSpacing.space1),
              besideChild,
            ],
          ),
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

/// An input drawn straight on a UX map card, where the card is the field (the
/// map's topic and question cards): no fill and no ring of its own.
InputDecoration mapBareInput(String? hint) => InputDecoration(
  hintText: hint,
  filled: false,
  isDense: true,
  contentPadding: const EdgeInsets.symmetric(vertical: 4),
  border: InputBorder.none,
  enabledBorder: InputBorder.none,
  focusedBorder: InputBorder.none,
  errorBorder: InputBorder.none,
  focusedErrorBorder: InputBorder.none,
);
