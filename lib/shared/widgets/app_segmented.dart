import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'map_chip.dart';
import 'map_segmented.dart';

/// One option in an [AppSegmented].
class AppSegment<T> {
  const AppSegment({required this.value, required this.label, this.icon});

  final T value;
  final String label;
  final IconData? icon;
}

/// A single choice among a few, drawn as the UX map's segmented control
/// (`.seg`, see [MapSegmented]): a white pill track, the chosen option a
/// saffron pill. Labels wrap rather than clip, so Indic scripts at large text
/// stay whole. More than four options become the map's chips instead, one
/// row that wraps.
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

  @override
  Widget build(BuildContext context) {
    if (segments.length <= 4) {
      return MapSegmented<T>(
        segments: [
          for (final s in segments) MapSegment(value: s.value, label: s.label),
        ],
        value: value,
        onChanged: onChanged,
      );
    }
    return Wrap(
      spacing: 7,
      runSpacing: 7,
      children: [
        for (final s in segments)
          MapChip(
            label: s.label,
            selected: s.value == value,
            selectedFill: AppColors.accentFill,
            onTap: () => onChanged(s.value),
          ),
      ],
    );
  }
}
