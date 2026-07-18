import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// One option in an [AppSegmented].
class AppSegment<T> {
  const AppSegment({required this.value, required this.label, this.icon});

  final T value;
  final String label;
  final IconData? icon;
}

/// AppSegmented (PREMIUM_DESIGN_SPEC.md §5). For binary/tertiary choices: a
/// `surfaceContainerHigh` track (radius 12) with a sliding `surface` thumb
/// (`e1` + 1px border, 240ms easeOutQuart), selected label `onSurface` w600,
/// unselected `onSurfaceVariant`, each segment >=48dp, `labelLarge`.
///
/// Falls back to a wrapped chip row when there are more than 3 options or any
/// label is long / Indic (unicameral scripts wrap badly in a fixed track), so
/// a translated label never clips.
class AppSegmented<T> extends StatelessWidget {
  const AppSegmented({
    super.key,
    required this.segments,
    required this.value,
    required this.onChanged,
  });

  final List<AppSegment<T>> segments;
  final T value;
  final ValueChanged<T> onChanged;

  static const double _height = 48;

  bool get _useChips =>
      segments.length > 3 ||
      segments.any((s) => s.label.characters.length > 14 || _hasNonLatin(s.label));

  @override
  Widget build(BuildContext context) {
    return _useChips ? _chips(context) : _track(context);
  }

  Widget _chips(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Wrap(
      spacing: AppSpacing.space2,
      runSpacing: AppSpacing.space2,
      children: [
        for (final s in segments)
          ChoiceChip(
            label: Text(s.label, style: text.labelLarge),
            avatar: s.icon == null
                ? null
                : Icon(s.icon, size: AppIconSize.inline),
            selected: s.value == value,
            showCheckmark: false,
            selectedColor: scheme.primaryContainer,
            backgroundColor: scheme.surfaceContainerHigh,
            side: BorderSide(
              color: s.value == value ? scheme.primary : scheme.outline,
              width: s.value == value ? 1.5 : 1,
            ),
            labelStyle: text.labelLarge?.copyWith(
              color: s.value == value
                  ? scheme.onPrimaryContainer
                  : scheme.onSurface,
              fontWeight: FontWeight.w600,
            ),
            onSelected: (_) => onChanged(s.value),
          ),
      ],
    );
  }

  Widget _track(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final n = segments.length;
    final index = segments.indexWhere((s) => s.value == value);
    // Align the thumb's centre to the selected segment (x in -1..1).
    final alignX = n <= 1 ? 0.0 : (index.clamp(0, n - 1)) / (n - 1) * 2 - 1;

    return Container(
      height: _height,
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHigh,
        borderRadius: AppRadius.rControl,
      ),
      padding: const EdgeInsets.all(4),
      child: LayoutBuilder(
        builder: (context, constraints) {
          return Stack(
            children: [
              // Sliding thumb.
              AnimatedAlign(
                alignment: Alignment(alignX, 0),
                duration: AppMotion.small,
                curve: AppMotion.easeOutQuart,
                child: FractionallySizedBox(
                  widthFactor: 1 / n,
                  heightFactor: 1,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: scheme.surface,
                      borderRadius: AppRadius.rControl,
                      border: Border.all(color: scheme.outline, width: 1),
                      boxShadow: AppShadows.e1,
                    ),
                  ),
                ),
              ),
              // Tappable labels.
              Row(
                children: [
                  for (final s in segments)
                    Expanded(
                      child: InkWell(
                        borderRadius: AppRadius.rControl,
                        onTap: () => onChanged(s.value),
                        child: Center(
                          child: Text(
                            s.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: text.labelLarge?.copyWith(
                              color: s.value == value
                                  ? scheme.onSurface
                                  : scheme.onSurfaceVariant,
                              fontWeight: s.value == value
                                  ? FontWeight.w600
                                  : FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

/// True if the string carries any non-Latin (Indic) codepoint — those scripts
/// are unicameral, so the caller skips UPPERCASE and prefers a wrapping layout.
bool _hasNonLatin(String s) => s.runes.any((r) => r > 0x24F);
