import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../motion/animated_entrance.dart';

/// The UX map's small chip (`.chip.s`): 28px tall, drawn inside a 44px touch
/// row so it stays thumb-sized.
///
/// Selected, it fills with [selectedFill] (leaf in the Library, saffron in
/// Community) and white text. Unselected, it is [idleFill] with [idleInk]: a
/// white chip with a hairline by default, or a type's tint (the map's `t-*`
/// chips) when a caller passes one.
class MapChip extends StatelessWidget {
  const MapChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.selectedFill = AppColors.leaf500,
    this.idleFill,
    this.idleInk = AppColors.textStrong,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Color selectedFill;

  /// Null draws the default white chip with a hairline edge.
  final Color? idleFill;
  final Color idleInk;

  @override
  Widget build(BuildContext context) {
    final fill = selected ? selectedFill : (idleFill ?? Colors.white);
    final ink = selected ? AppColors.textOnAccent : idleInk;
    final edge = selected || idleFill != null
        ? BorderSide.none
        : const BorderSide(color: AppColors.borderHairline);
    return Semantics(
      button: true,
      selected: selected,
      excludeSemantics: true,
      label: label,
      onTap: onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: AnimatedContainer(
            duration: context.motionEnabled ? AppMotion.small : Duration.zero,
            height: 28,
            padding: const EdgeInsets.symmetric(horizontal: 11),
            decoration: ShapeDecoration(
              color: fill,
              shape: StadiumBorder(side: edge),
            ),
            // Centre the label without stretching the chip across the row.
            child: Center(
              widthFactor: 1,
              child: Text(
                label,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: ink,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
