import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../studio_theme_resolver.dart';
import '../extensions/sahayak_theme.dart';
import '../providers/studio_config_provider.dart';
import '../physics/light_provider.dart';
import '../culture/festival_config.dart';
import 'glass_container.dart';
import 'magical_loading_orb.dart';

/// One shell to rule all Studios.
/// Wraps content in a consistent, themed, motion-aware, connected scaffold.
class StudioScaffold extends ConsumerWidget {
  final StudioType studio;
  final String title;
  final Widget child;
  final List<Widget>? actions;
  final Widget? floatingActionButton;
  final Widget? bottomNavigationBar;
  final Widget? drawer;

  const StudioScaffold({
    super.key,
    required this.studio,
    required this.title,
    required this.child,
    this.actions,
    this.floatingActionButton,
    this.bottomNavigationBar,
    this.drawer,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 1. Resolve Dynamic Configs
    final sahayakTheme = Theme.of(context).extension<SahayakTheme>()!;
    final motion = ref.watch(studioConfigProvider(studio));
    final isOnlineAsync = ref.watch(connectivityProvider);
    final isThinking = ref.watch(aiProcessingProvider);
    final lightConfigAsync = ref.watch(lightEngineProvider);
    final festivalConfig = ref.watch(festivalProvider);

    // Cultural Override: If a festival is active, tint the glass
    final glassTint = festivalConfig.type != FestivalType.none &&
            festivalConfig.overlayColor != null
        ? festivalConfig.overlayColor!
        : sahayakTheme.glassTint;

    return AnimatedTheme(
      duration: motion.transition,
      curve: motion.pageCurve,
      data: Theme.of(context),
      child: Scaffold(
        extendBodyBehindAppBar: true,
        appBar: PreferredSize(
          preferredSize: const Size.fromHeight(64),
          child: GlassContainer(
            radius: BorderRadius.zero,
            tint: glassTint,
            blur: sahayakTheme.glassBlur,
            opacity: sahayakTheme.glassOpacity,
            child: AppBar(
              title: Text(title),
              backgroundColor: Colors.transparent,
              elevation: 0,
              actions: actions,
              iconTheme: const IconThemeData(color: Colors.white),
              titleTextStyle: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold),
            ),
          ),
        ),
        drawer: drawer,
        floatingActionButton: floatingActionButton,
        bottomNavigationBar: bottomNavigationBar,
        body: Stack(
          children: [
            // 1. Ambient Light Layer (Background Tint)
            lightConfigAsync.when(
              data: (lightConfig) => Positioned.fill(
                child: IgnorePointer(
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin:
                            Alignment(lightConfig.globalLightSource.dx, -1.0),
                        end: Alignment.bottomCenter,
                        colors: [
                          lightConfig.ambientLightColor.withOpacity(0.15),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),

            // 2. Main Content
            MediaQuery(
              data: MediaQuery.of(context).copyWith(
                textScaler: MediaQuery.of(context)
                    .textScaler
                    .clamp(minScaleFactor: 1.0, maxScaleFactor: 1.3),
              ),
              child: Padding(
                padding: const EdgeInsets.only(top: 80.0),
                child: child,
              ),
            ),

            // 3. Offline Banner
            isOnlineAsync.when(
              data: (isOnline) => !isOnline
                  ? const Positioned(
                      top: 80,
                      left: 0,
                      right: 0,
                      child: _OfflineBanner(),
                    )
                  : const SizedBox.shrink(),
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),

            // 4. AI Thinking Overlay
            if (isThinking)
              _AIThinkingOverlay(
                gradient: sahayakTheme.aiThinkingGradient,
                curve: motion.thinkingCurve,
                sahayakTheme: sahayakTheme,
              ),
          ],
        ),
      ),
    );
  }
}

class _AIThinkingOverlay extends StatelessWidget {
  final Gradient gradient;
  final Curve curve;
  final SahayakTheme sahayakTheme;

  const _AIThinkingOverlay({
    required this.gradient,
    required this.curve,
    required this.sahayakTheme,
  });

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: AnimatedOpacity(
        opacity: 1,
        duration: const Duration(milliseconds: 300),
        curve: curve,
        child: GlassContainer(
          radius: BorderRadius.zero,
          blur: 30,
          opacity: 0.15,
          borderOpacity: 0.2,
          tint: Colors.black, // Dark overlay for thinking
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                MagicalLoadingOrb(gradient: gradient),
                const SizedBox(height: 24),
                const Text("Sahayak is thinking...",
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      decoration: TextDecoration.none,
                    )),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
      color: Colors.orange.shade800,
      width: double.infinity,
      child: const Text(
        "Offline mode: You can view saved content",
        textAlign: TextAlign.center,
        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
      ),
    );
  }
}
