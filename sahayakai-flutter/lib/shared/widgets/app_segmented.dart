import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../motion/animated_entrance.dart';
import 'glass_surface.dart';

/// One option in an [AppSegmented].
class AppSegment<T> {
  const AppSegment({required this.value, required this.label, this.icon});

  final T value;
  final String label;
  final IconData? icon;
}

/// AppSegmented (PREMIUM_DESIGN_SPEC.md §5). For binary/tertiary choices: a
/// glass-flat track (radius 12) with a sliding glass-flat thumb (`e1` shadow
/// carrier, 240ms easeOutQuart), selected label `onSurface` w600, unselected
/// `onSurface` w500 (the thumb/fill is the selection affordance, so the
/// unselected label stays full-ink for AA — `onSurfaceVariant` is only 3.86:1
/// on the track fill, under the 4.5 floor for the `labelLarge` text; this
/// matches the `_chips` fallback, which already uses `onSurface`), each segment
/// >=48dp, `labelLarge`.
///
/// GL-3 (App-wide Glassmorphism Reskin): the track's `surfaceContainerHigh`
/// fill and the thumb's `surface` fill + flat `outline` border are both
/// tuned to [AppGlass]'s cheap NO-BLUR "flat" tokens (the thumb reuses
/// [GlassSurface.flat] directly) — the same list-context glass fill
/// `AppCard` now uses, already GL-1-review-proven AA-safe (see the
/// `theme_contrast_test.dart` "flat-fill token" group). The thumb's `e1`
/// shadow is kept as an external carrier, since `GlassSurface` casts none of
/// its own (same pattern as `AppCard`/`FloatingBottomNav`).
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
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final text = theme.textTheme;
    final isDark = theme.brightness == Brightness.dark;
    final trackFill = isDark ? AppGlass.dFlatFill : AppGlass.lFlatFill;
    final n = segments.length;
    final index = segments.indexWhere((s) => s.value == value);
    // Align the thumb's centre to the selected segment (x in -1..1).
    final alignX = n <= 1 ? 0.0 : (index.clamp(0, n - 1)) / (n - 1) * 2 - 1;

    return Container(
      height: _height,
      decoration: BoxDecoration(
        color: trackFill,
        borderRadius: AppRadius.rControl,
      ),
      padding: const EdgeInsets.all(4),
      child: LayoutBuilder(
        builder: (context, constraints) {
          return Stack(
            children: [
              // Sliding thumb (jumps to the final position under reduce-motion).
              AnimatedAlign(
                alignment: Alignment(alignX, 0),
                duration: context.motionEnabled ? AppMotion.small : Duration.zero,
                curve: AppMotion.easeOutQuart,
                child: FractionallySizedBox(
                  widthFactor: 1 / n,
                  heightFactor: 1,
                  // Shadow-only carrier: GlassSurface.flat below draws the
                  // glass fill/border/sheen but casts no shadow of its own
                  // (see class doc) — this DecoratedBox supplies the static
                  // `e1` shadow the thumb always had.
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: AppRadius.rControl,
                      boxShadow: AppShadows.e1,
                    ),
                    child: GlassSurface.flat(
                      radius: AppRadius.control,
                      padding: EdgeInsets.zero,
                      child: const SizedBox.expand(),
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
                              // Full-ink for BOTH states (MD3-standard for an
                              // unselected segment; the thumb is the selection
                              // affordance). onSurfaceVariant on the track fill
                              // is 3.86:1 — below the 4.5 floor for this
                              // labelLarge text. Weight carries the emphasis.
                              color: scheme.onSurface,
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
