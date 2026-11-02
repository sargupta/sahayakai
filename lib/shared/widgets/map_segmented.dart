import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../motion/animated_entrance.dart';

/// One choice in a [MapSegmented].
class MapSegment<T> {
  const MapSegment({required this.value, required this.label});

  final T value;
  final String label;
}

/// The UX map's segmented control (`.seg`): a white pill track with a hairline
/// ring and 4px padding; equal-width 34px segments; the selected one a
/// saffron-600 pill with white text.
///
/// A label that does not fit wraps rather than clipping (Indic scripts at
/// textScale 1.3).
class MapSegmented<T> extends StatelessWidget {
  const MapSegmented({
    super.key,
    required this.segments,
    required this.value,
    required this.onChanged,
  });

  final List<MapSegment<T>> segments;
  final T value;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final motion = context.motionEnabled;
    final text = Theme.of(context).textTheme;
    // The drawn track is the map's 42px; each segment's touch area reaches
    // 3px past it top and bottom, to the 48dp minimum.
    return Stack(
      children: [
        const Positioned.fill(
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 3),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppRadius.rPill,
                border: Border.fromBorderSide(
                  BorderSide(color: AppColors.borderHairline),
                ),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            children: [
              for (final segment in segments)
                Expanded(
                  child: Semantics(
                    button: true,
                    selected: segment.value == value,
                    excludeSemantics: true,
                    label: segment.label,
                    onTap: () => onChanged(segment.value),
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => onChanged(segment.value),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 7),
                        child: AnimatedContainer(
                          duration: motion ? AppMotion.small : Duration.zero,
                          curve: AppMotion.easeOutQuart,
                          constraints: const BoxConstraints(minHeight: 34),
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.space2,
                            vertical: AppSpacing.space1,
                          ),
                          alignment: Alignment.center,
                          decoration: ShapeDecoration(
                            color: segment.value == value
                                ? AppColors.accentFill
                                : null,
                            shape: const StadiumBorder(),
                          ),
                          child: Text(
                            segment.label,
                            textAlign: TextAlign.center,
                            style: text.bodyLarge?.copyWith(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: segment.value == value
                                  ? AppColors.textOnAccent
                                  : AppColors.textBody,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
