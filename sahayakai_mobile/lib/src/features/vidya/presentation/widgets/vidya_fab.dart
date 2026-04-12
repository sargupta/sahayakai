import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';

/// Floating brain icon that opens the VIDYA chat screen.
/// Add this to HomeScreen's floatingActionButton.
class VidyaFab extends StatelessWidget {
  const VidyaFab({super.key});

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton(
      onPressed: () => context.push('/vidya-chat'),
      backgroundColor: GlassColors.primary,
      elevation: 8,
      child: const Icon(Icons.psychology_rounded, color: Colors.white, size: 28),
    );
  }
}
