import 'package:flutter/material.dart';

/// Segmented control widget for tab selection
/// Matches the rounded pill style from Archive reference
class SegmentedControl extends StatelessWidget {
  final List<String> segments;
  final int selectedIndex;
  final ValueChanged<int> onSegmentTapped;

  const SegmentedControl({
    super.key,
    required this.segments,
    required this.selectedIndex,
    required this.onSegmentTapped,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withOpacity(0.05)
            : Colors.white.withOpacity(0.5),
        borderRadius: BorderRadius.circular(9999),
        border: Border.all(
          color: const Color(0xFF14B8A6).withOpacity(0.1),
        ),
      ),
      child: Row(
        children: List.generate(segments.length, (index) {
          final isSelected = index == selectedIndex;
          return Expanded(
            child: GestureDetector(
              onTap: () => onSegmentTapped(index),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding:
                    const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
                decoration: BoxDecoration(
                  color:
                      isSelected ? const Color(0xFFFF9933) : Colors.transparent,
                  borderRadius: BorderRadius.circular(9999),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: const Color(0xFFFF9933).withOpacity(0.2),
                            blurRadius: 8,
                          ),
                        ]
                      : null,
                ),
                child: Text(
                  segments[index],
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                    color: isSelected
                        ? Colors.white
                        : const Color(0xFF14B8A6).withOpacity(0.8),
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
