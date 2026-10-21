import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// The app-wide tap-depress: presses its child from 1.0 to [pressedScale] on
/// pointer-down and releases on up/cancel. It only OBSERVES pointers (a
/// `Listener`), so the child's own `InkWell` / button still receives the tap
/// and paints its M3 ink underneath. Degrades to a static frame when
/// animations are disabled (reduce-motion) or [enabled] is false.
///
/// See PREMIUM_DESIGN_SPEC.md §4 ("Tap depress · micro 160 · easeOutQuart").
class PressableScale extends StatefulWidget {
  const PressableScale({
    super.key,
    required this.child,
    this.pressedScale = 0.98,
    this.enabled = true,
  });

  final Widget child;
  final double pressedScale;
  final bool enabled;

  @override
  State<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<PressableScale> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final active = widget.enabled && !reduce;

    void set(bool v) {
      if (_down != v) setState(() => _down = v);
    }

    return Listener(
      onPointerDown: active ? (_) => set(true) : null,
      onPointerUp: active ? (_) => set(false) : null,
      onPointerCancel: active ? (_) => set(false) : null,
      child: AnimatedScale(
        scale: (active && _down) ? widget.pressedScale : 1.0,
        duration: AppMotion.micro,
        curve: AppMotion.easeOutQuart,
        child: widget.child,
      ),
    );
  }
}
