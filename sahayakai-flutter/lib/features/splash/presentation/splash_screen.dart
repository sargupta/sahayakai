import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';

/// P0.1 — Splash.
///
/// The brand mark on `background` while [appBootstrap] resolves what will
/// become Firebase init, App Check activation, and the FIRST auth snapshot. The
/// router's redirect parks here for exactly as long as that future has no
/// value, then sends the teacher to Login or Home.
///
/// WHY THIS IS NOT JUST A SPINNER. The bootstrap can fail — App Check's Play
/// Integrity handshake needs the network, and this app's teachers are on rural
/// 2G. On failure the router has no honest answer to "is this teacher signed
/// in" (guessing either leaks a protected screen or signs out a signed-in
/// teacher), so it keeps parking here. A lone spinner would then spin forever
/// with no way out. So the failure is a first-class state on this screen, with
/// a retry that re-runs the bootstrap.
///
/// LAYOUT: the brand mark is centred, which on a splash is the brand moment
/// itself and not the centred-hero filler DESIGN_RUBRIC §11 bans — that rule is
/// about content screens dressing up emptiness. There is no content to be dense
/// with here. The failure block below it is left-aligned and real.
class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final boot = ref.watch(appBootstrapProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      // This screen has no AppBar, so nothing else sets the status-bar style
      // for it. Derived from the theme rather than hardcoded, so the dark
      // theme gets light icons (DESIGN_RUBRIC §9).
      value: isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: Scaffold(
        body: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              // Centres when it fits, scrolls when it does not. A Spacer-based
              // Column would overflow at textScale 1.3 on a short screen, and a
              // Spacer inside a scroll view has no bounded height to expand
              // into (it crashes).
              return SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: Padding(
                    padding: AppSpacing.pagePadding,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const _BrandMark(),
                        const SizedBox(height: AppSpacing.space8),
                        if (boot.hasError)
                          _BootstrapFailed(
                            onRetry: () => ref.invalidate(appBootstrapProvider),
                          )
                        else
                          const _Booting(),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// The letter-mark in its saffron-tinted well, the app name, and the tagline.
/// Saffron stays an accent here: it tints a 64dp well and the glyph, never the
/// page (DESIGN_RUBRIC §4).
class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: scheme.primary.withValues(alpha: 0.12),
            borderRadius: AppRadius.rXl,
          ),
          alignment: Alignment.center,
          child: Icon(
            LucideIcons.graduationCap,
            size: 32,
            color: scheme.primary,
          ),
        ),
        const SizedBox(height: AppSpacing.space4),
        Text(
          context.l10n.appTitle,
          style: text.headlineMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.space2),
        Text(
          context.l10n.splashTagline,
          textAlign: TextAlign.center,
          style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
        ),
      ],
    );
  }
}

/// The bootstrap is still running. Deliberately quiet: this is a sub-second
/// state on a good connection, and the brand mark above is what the teacher is
/// meant to be looking at.
class _Booting extends StatelessWidget {
  const _Booting();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: 24,
      height: 24,
      child: CircularProgressIndicator(strokeWidth: 2, color: scheme.primary),
    );
  }
}

/// The bootstrap failed. The router keeps the teacher here until it succeeds,
/// so this state owns the only way forward.
class _BootstrapFailed extends StatelessWidget {
  const _BootstrapFailed({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return ConstrainedBox(
      // Reading column, not a full-bleed 10" line (DESIGN_RUBRIC §7).
      constraints: const BoxConstraints(maxWidth: 480),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                LucideIcons.wifiOff,
                size: 20,
                color: scheme.onSurfaceVariant,
              ),
              const SizedBox(width: AppSpacing.space3),
              // Expanded so a long Malayalam heading wraps instead of taking
              // the row over the edge (DESIGN_RUBRIC §8).
              Expanded(
                child: Text(l10n.splashFailedTitle, style: text.titleMedium),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.space2),
          Text(
            l10n.splashFailedBody,
            style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.space4),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(LucideIcons.refreshCw, size: 18),
              label: Text(l10n.actionRetry),
            ),
          ),
        ],
      ),
    );
  }
}
