import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'map_choice_sheet.dart';

/// The UX map's tap-to-change selector (`.sel`): a white 14px tile with a
/// hairline ring, a small tracked label over the bold current value. Tapping
/// it opens a sheet of [options] (see [showMapChoiceSheet]); the pick comes
/// back through [onChanged]. Used where the map shows "Class", "Subject",
/// "Language" side by side, in place of a dropdown.
class MapSelect<T> extends StatelessWidget {
  const MapSelect({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
    this.sheetTitle,
    this.errorText,
    this.dark = false,
  });

  /// Drawn for the map's dark scanner: a dark tile with light ink.
  final bool dark;

  /// "Class", "Subject"…: the tile's small label and, unless [sheetTitle] is
  /// given, the sheet's title.
  final String label;

  /// The current value; its label (from [options]) is the tile's bold line.
  final T value;

  /// Every choice, in order, as (value, label).
  final List<(T, String)> options;

  final ValueChanged<T> onChanged;
  final String? sheetTitle;

  /// A field-level error under the tile (a required choice still unmade).
  final String? errorText;

  String get _valueLabel {
    for (final (v, l) in options) {
      if (v == value) return l;
    }
    return '';
  }

  Future<void> _pick(BuildContext context) async {
    final picked = await showMapChoiceSheet<T>(
      context,
      title: sheetTitle ?? label,
      selected: value,
      options: options,
    );
    if (picked != null) onChanged(picked.value);
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final latin = Localizations.localeOf(context).languageCode == 'en';
    final error = errorText;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          button: true,
          label: label,
          value: _valueLabel,
          excludeSemantics: true,
          onTap: () => _pick(context),
          child: Material(
            color: dark ? AppColors.scanControl : Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: AppRadius.rField,
              side: error != null
                  ? const BorderSide(color: AppColors.red500, width: 1.5)
                  : dark
                  ? BorderSide.none
                  : const BorderSide(color: AppColors.borderHairline),
            ),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => _pick(context),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 56),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        latin ? label.toUpperCase() : label,
                        style: text.labelSmall?.copyWith(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: latin ? 1.2 : 0,
                          color: dark
                              ? AppColors.scanMuted
                              : AppColors.textMuted,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        _valueLabel,
                        style: text.bodyLarge?.copyWith(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w700,
                          color: dark
                              ? AppColors.scanInk
                              : AppColors.textStrong,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        if (error != null) ...[
          const SizedBox(height: AppSpacing.space1),
          Text(
            error,
            style: text.bodySmall?.copyWith(
              color: dark ? AppColors.saffron200 : AppColors.red500,
            ),
          ),
        ],
      ],
    );
  }
}
