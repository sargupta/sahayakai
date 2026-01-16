import 'package:flutter/material.dart';

/// Page indicator dots for multi-step flows
/// Active step shows as a pill, inactive as circles
///
/// Usage:
/// ```dart
/// PageIndicator(
///   totalSteps: 3,
///   currentStep: 0,
///   activeColor: Colors.orange,
/// )
/// ```
class PageIndicator extends StatelessWidget {
  final int totalSteps;
  final int currentStep;
  final Color? activeColor;
  final Color? inactiveColor;

  const PageIndicator({
    super.key,
    required this.totalSteps,
    required this.currentStep,
    this.activeColor,
    this.inactiveColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final defaultActive = activeColor ?? const Color(0xFFFF9933);
    final defaultInactive = inactiveColor ??
        (theme.brightness == Brightness.dark
            ? Colors.grey.shade700
            : Colors.grey.shade300);

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(totalSteps, (index) {
        final isActive = index == currentStep;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: isActive ? 32 : 8,
          height: 8,
          decoration: BoxDecoration(
            color: isActive ? defaultActive : defaultInactive,
            borderRadius: BorderRadius.circular(4),
          ),
        );
      }),
    );
  }
}
