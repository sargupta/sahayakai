import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../motion/animated_entrance.dart';

/// One option in an [AppSegmented].
class AppSegment<T> {
  const AppSegment({required this.value, required this.label, this.icon});

  final T value;
  final String label;
  final IconData? icon;
}

/// AppSegmented — the design system v2 `SegmentedControl`: a 62% glass pill
/// (`surface-segment`, 1px `border-glass`, 4px padding) holding equal
/// segments 5px apart; the chosen one is a solid `saffron-500` pill with a
/// white label, the rest are `text-body`. Labels are 600 12/15 in the UI
/// face. The saffron pill slides between segments on the standard curve
/// (.25s), and jumps under reduce-motion.
///
/// The pill draws 41px tall, as the system does; its touch band is 48px, so
/// each segment's tap area extends past the visual edge without overlapping
/// its neighbour. The group reads as a radio group: each segment is checked
/// or not, in a mutually exclusive set.
///
/// Falls back to a wrapped row of the theme's choice chips (the v2 `Chip`)
/// when there are more than 3 options or any label is long or in an Indic
/// script, so a translated label wraps instead of clipping in a fixed track.
/// Dark keeps the pre-v2 glass track (dark mode is an open founder decision).
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

  /// The touch band; the visual pill is [_pill] high, centred in it.
  static const double _height = 48;

  /// 15px label + 2 × 8px segment padding + 2 × 4px track padding + 2 × 1px
  /// edge.
  static const double _pill = 41;
  static const double _gap = 5;

  bool get _useChips =>
      segments.length > 3 ||
      segments.any(
        (s) => s.label.characters.length > 14 || _hasNonLatin(s.label),
      );

  @override
  Widget build(BuildContext context) {
    return _useChips ? _chips(context) : _track(context);
  }

  Widget _chips(BuildContext context) {
    return Wrap(
      spacing: 7, // v2: chips sit 7px apart
      runSpacing: 7,
      children: [
        for (final s in segments)
          ChoiceChip(
            label: Text(s.label),
            avatar: s.icon == null
                ? null
                : Icon(s.icon, size: AppIconSize.inline),
            selected: s.value == value,
            showCheckmark: false,
            onSelected: (_) => onChanged(s.value),
          ),
      ],
    );
  }

  Widget _track(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final type = AppTypeTokens.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final n = segments.length;
    final index = segments.indexWhere((s) => s.value == value).clamp(0, n - 1);
    final duration = context.motionEnabled ? AppMotion.change : Duration.zero;

    return SizedBox(
      height: _height,
      child: LayoutBuilder(
        builder: (context, constraints) {
          // Inside the 1px edge and the 4px track padding.
          final inner = constraints.maxWidth - 2 * (1 + 4);
          final segW = (inner - _gap * (n - 1)) / n;

          return Stack(
            alignment: Alignment.center,
            children: [
              // The visual pill; the touch band below carries the semantics.
              ExcludeSemantics(
                child: Container(
                  height: _pill,
                  // 4px track padding; the 1px edge adds its own inset.
                  padding: const EdgeInsets.all(4),
                  decoration: ShapeDecoration(
                    color: isDark
                        ? AppGlass.dFlatFill
                        : AppColors.surfaceSegment,
                    shape: StadiumBorder(
                      side: BorderSide(
                        color: isDark ? scheme.outline : AppColors.borderGlass,
                      ),
                    ),
                  ),
                  child: Stack(
                    children: [
                      AnimatedPositioned(
                        duration: duration,
                        curve: AppMotion.standard,
                        left: index * (segW + _gap),
                        top: 0,
                        bottom: 0,
                        width: segW,
                        child: DecoratedBox(
                          decoration: ShapeDecoration(
                            color: scheme.primary,
                            shape: const StadiumBorder(),
                          ),
                        ),
                      ),
                      Row(
                        children: [
                          for (final (i, s) in segments.indexed) ...[
                            if (i > 0) const SizedBox(width: _gap),
                            SizedBox(
                              width: segW,
                              child: Center(
                                child: AnimatedDefaultTextStyle(
                                  duration: duration,
                                  curve: AppMotion.standard,
                                  style: type.chip.copyWith(
                                    height: 15 / 12,
                                    color: s.value == value
                                        ? scheme.onPrimary
                                        : (isDark
                                              ? scheme.onSurface
                                              : AppColors.textBody),
                                  ),
                                  child: Text(
                                    s.label,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              // The 48px touch band, one target per segment, over the pill.
              Positioned.fill(
                child: Row(
                  children: [
                    for (final (i, s) in segments.indexed) ...[
                      if (i > 0) const SizedBox(width: _gap),
                      SizedBox(
                        width: i == 0 || i == n - 1 ? segW + 5 : segW,
                        child: Semantics(
                          inMutuallyExclusiveGroup: true,
                          checked: s.value == value,
                          button: true,
                          label: s.label,
                          child: InkWell(
                            customBorder: const StadiumBorder(),
                            onTap: () => onChanged(s.value),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

bool _hasNonLatin(String s) => s.runes.any((r) => r > 0x24F);
