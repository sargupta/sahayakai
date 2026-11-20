import 'package:flutter/material.dart';

import '../../core/i18n/script.dart';
import '../../core/theme/app_theme.dart';

/// LabeledField — the design system v2 field card (`Field`, `size="lg"`).
///
/// A field is a card the teacher fills by speaking or typing, never a grey box
/// with a floating label: the label is an eyebrow INSIDE a strong-glass card
/// and the value is set in Bricolage, exactly like the lesson composer's
/// "Topic" / "Class" / "Length" cards.
///
///   • Rest: `surface-glass-strong` with a 1px `border-glass` edge,
///     `radius-card` (18), padding 13 × 14.
///   • Focus (anything inside takes focus): a 2px `saffron-500` edge plus
///     `shadow-current`.
///   • Error ([errorText]): a 2px `red-500` edge and a `red-700` message.
///   • The label: 10px/600 UI, tracked .14em, UPPERCASE, `saffron-600`. In an
///     Indic script it is 12px, untracked and never uppercased.
///   • [hint] is the v2 helper line (11px, body ink) under the value;
///     [optionalLabel] and [counterText] sit in the label row (10px, muted).
///   • [trailing] (e.g. the inline VIDYA mic) sits on the value row, 10px
///     after the input, as the v2 mic disc does.
///   • No icon before the label: the v2 Field label is text only.
///
/// The card is drawn only around a text input or a dropdown — the controls
/// the v2 Field describes. Any other control (a chip group, a segmented
/// control, an image picker) keeps the same eyebrow label above it with no
/// card, because v2 never nests a card in a card and those controls carry
/// their own surfaces.
///
/// The API is {label, child, optionalLabel, hint, errorText, counterText,
/// trailing}.
class LabeledField extends StatefulWidget {
  const LabeledField({
    super.key,
    required this.label,
    required this.child,
    this.optionalLabel,
    this.hint,
    this.errorText,
    this.counterText,
    this.trailing,
  });

  final String label;
  final Widget child;

  /// A muted note shown inline after the label (e.g. an "optional" tag).
  final String? optionalLabel;

  /// The helper line under the value explaining the field.
  final String? hint;

  /// A field-level error shown under the value in `red-700`.
  final String? errorText;

  /// An optional right-aligned tabular counter (e.g. "0 / 1000").
  final String? counterText;

  /// An optional end-of-row affordance (e.g. an inline voice-dictation mic).
  final Widget? trailing;

  @override
  State<LabeledField> createState() => _LabeledFieldState();
}

class _LabeledFieldState extends State<LabeledField> {
  bool _focused = false;

  /// The controls the v2 Field card is drawn around.
  bool get _isInput =>
      widget.child is TextField ||
      widget.child is TextFormField ||
      widget.child is DropdownButtonFormField;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final type = AppTypeTokens.of(context);

    final indicLabel = isIndicText(widget.label);
    final eyebrow = AppTextExtras.of(context).overline;
    final labelStyle = indicLabel
        ? eyebrow.copyWith(fontSize: 12, height: 1.5, letterSpacing: 0)
        : eyebrow;
    final metaStyle = type.caption.copyWith(
      fontWeight: FontWeight.w500,
      height: 1.6,
      color: AppColors.textMuted,
    );
    final error = widget.errorText;

    final head = Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Flexible(
          child: Text(
            indicLabel ? widget.label : widget.label.toUpperCase(),
            style: labelStyle,
          ),
        ),
        if (widget.optionalLabel != null) ...[
          const SizedBox(width: 7),
          Text(widget.optionalLabel!, style: metaStyle),
        ],
        if (widget.counterText != null) ...[
          const Spacer(),
          Text(
            widget.counterText!,
            style: metaStyle.copyWith(
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
        if (!_isInput && widget.trailing != null) ...[
          if (widget.counterText == null) const Spacer(),
          const SizedBox(width: 10),
          widget.trailing!,
        ],
      ],
    );

    final below = <Widget>[
      if (widget.hint != null) ...[
        const SizedBox(height: 6),
        Text(widget.hint!, style: type.bodySm),
      ],
      if (error != null) ...[
        const SizedBox(height: 6),
        Text(
          error,
          style: type.status.copyWith(
            color: AppColors.red700,
          ),
        ),
      ],
    ];

    if (!_isInput) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          head,
          const SizedBox(height: AppSpacing.space2),
          widget.child,
          ...below,
        ],
      );
    }

    final valueRow = Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(child: _BorderlessInput(child: widget.child)),
        if (widget.trailing != null) ...[
          const SizedBox(width: 10), // space-5
          widget.trailing!,
        ],
      ],
    );

    // Focus (2px saffron-500 + shadow-current) wins over rest; error (2px
    // red-500) wins over both. The 2px edge is drawn inside the card, so the
    // card's size never changes between states.
    final edge = error != null
        ? BorderSide(color: scheme.error, width: 2)
        : _focused
        ? BorderSide(color: scheme.primary, width: 2)
        : const BorderSide(
            color: AppColors.borderGlass,
            width: 1,
          );
    final motion = MediaQuery.maybeOf(context)?.disableAnimations != true;

    return Focus(
      canRequestFocus: false,
      skipTraversal: true,
      onFocusChange: (f) => setState(() => _focused = f),
      child: AnimatedContainer(
        duration: motion ? AppMotion.change : Duration.zero,
        curve: AppMotion.standard,
        // 13 × 14 inside the 1px rest edge; a 2px edge takes its extra pixel
        // from the padding so the content never moves.
        padding: EdgeInsets.symmetric(
          vertical: 13 + 1 - edge.width,
          horizontal: 14 + 1 - edge.width,
        ),
        decoration: BoxDecoration(
          color: AppColors.surfaceGlassStrong,
          borderRadius: AppRadius.rCard,
          border: Border.fromBorderSide(edge),
          boxShadow: _focused && error == null ? AppShadows.current : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            head,
            const SizedBox(height: 6), // the lg value row's top margin
            valueRow,
            ...below,
          ],
        ),
      ),
    );
  }
}

/// The input inside the card: no fill, no border, no padding of its own (the
/// card is the control), the value in Bricolage 15/600 (`Field` lg) and the
/// placeholder in the UI face at 400 in `text-muted`.
class _BorderlessInput extends StatelessWidget {
  const _BorderlessInput({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final type = AppTypeTokens.of(context);
    // titleMedium is type-card-title (15/600 display) — the lg Field value —
    // and is what a dropdown already draws its value in. A TextField draws in
    // bodyLarge, so bodyLarge takes the same style here, for this input only.
    final value = theme.textTheme.titleMedium!;
    final placeholder = type.reading.copyWith(
      fontSize: value.fontSize,
      color: AppColors.textMuted,
    );
    const none = InputBorder.none;

    return Theme(
      data: theme.copyWith(
        textTheme: theme.textTheme.copyWith(bodyLarge: value),
        inputDecorationTheme: theme.inputDecorationTheme.copyWith(
          filled: false,
          isDense: true,
          contentPadding: EdgeInsets.zero,
          border: none,
          enabledBorder: none,
          focusedBorder: none,
          errorBorder: none,
          focusedErrorBorder: none,
          disabledBorder: none,
          hintStyle: placeholder,
        ),
      ),
      child: child,
    );
  }
}
