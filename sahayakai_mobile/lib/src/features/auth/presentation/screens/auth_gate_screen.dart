import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';
import '../../../home/presentation/home_screen.dart';
import '../../../../core/theme/widgets/magical_loading_orb.dart';
import '../../../../core/theme/glassmorphic/glass_components.dart';

/// Intermediate screen that checks whether the user has completed onboarding.
///
/// - Loading → splash with MagicalLoadingOrb
/// - Profile exists → HomeScreen
/// - No profile → redirect to /onboarding
/// - Error → HomeScreen (graceful fallback for returning users)
class AuthGateScreen extends ConsumerWidget {
  const AuthGateScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileExistsProvider);

    return profileAsync.when(
      loading: () => Scaffold(
        backgroundColor: GlassColors.background,
        body: const Center(
          child: MagicalLoadingOrb(
              gradient: const LinearGradient(
                colors: [GlassColors.primary, GlassColors.primaryDark],
              ),
            ),
        ),
      ),
      error: (_, __) => const HomeScreen(),
      data: (exists) {
        if (!exists) {
          // Schedule navigation after build to avoid building during build.
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) context.go('/onboarding');
          });
          return Scaffold(
            backgroundColor: GlassColors.background,
            body: const Center(
              child: MagicalLoadingOrb(
                gradient: LinearGradient(
                  colors: [GlassColors.primary, GlassColors.primaryDark],
                ),
              ),
            ),
          );
        }
        return const HomeScreen();
      },
    );
  }
}
