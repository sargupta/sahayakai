import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../motion/animated_entrance.dart';

/// The UX map's toggle (`.tgl`): a 44×26 track, stone when off and leaf when
/// on, with a white 20px knob that slides across. Drawn inside a 48dp touch
/// area and exposed as a toggled control carrying [label].
class MapToggle extends StatelessWidget {
  const MapToggle({
    super.key,
    required this.value,
    required this.onChanged,
    required this.label,
  });

  final bool value;
  final ValueChanged<bool> onChanged;

  /// The accessible name (the row's visible label).
  final String label;

  @override
  Widget build(BuildContext context) {
    final duration = context.motionEnabled ? AppMotion.small : Duration.zero;
    return Semantics(
      toggled: value,
      label: label,
      excludeSemantics: true,
      onTap: () => onChanged(!value),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => onChanged(!value),
        child: SizedBox(
          width: 48,
          height: 48,
          child: Center(
            child: AnimatedContainer(
              duration: duration,
              width: 44,
              height: 26,
              padding: const EdgeInsets.all(3),
              decoration: ShapeDecoration(
                color: value ? AppColors.leaf500 : AppColors.mapToggleOff,
                shape: const StadiumBorder(),
              ),
              child: AnimatedAlign(
                duration: duration,
                curve: AppMotion.easeOutQuart,
                alignment: value
                    ? AlignmentDirectional.centerEnd
                    : AlignmentDirectional.centerStart,
                child: Container(
                  width: 20,
                  height: 20,
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [AppShadows.mapKnob],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
