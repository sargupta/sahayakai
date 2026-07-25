import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/glass_surface.dart';

/// P0.1 — Splash. "The Seal" (PREMIUM_DESIGN_SPEC.md §4 / §6b U5).
///
/// The brand mark on the ivory ground while [appBootstrap] resolves what will
/// become Firebase init, App Check activation, and the FIRST auth snapshot. The
/// router's redirect parks here for exactly as long as that future has no
/// value, then sends the teacher to Login or Home.
///
/// THE SIGNATURE MOMENT. A saffron wax-seal presses in (scale 0.92→1.0 + fade),
/// then an ink underline draws left-to-right (the signature of authorship), then
/// the Fraunces wordmark rises — a single ~600ms orchestration, each element
/// ≤420ms. Under reduce-motion (`MediaQuery.disableAnimations`) the composed
/// final frame renders instantly, no tween. Route-out is the theme's Lift-&-
/// Settle push (a cross-fade when motion is reduced), the seal's saffron mark
/// echoing the login masthead.
///
/// WHY THIS IS NOT JUST A SPINNER. The bootstrap can fail — App Check's Play
/// Integrity handshake needs the network, and this app's teachers are on rural
/// 2G. On failure the router has no honest answer to "is this teacher signed
/// in" (guessing either leaks a protected screen or signs out a signed-in
/// teacher), so it keeps parking here. A lone spinner would then spin forever
/// with no way out. So the failure is a first-class state on this screen, with
/// a retry that re-runs the bootstrap.
///
/// LAYOUT: the seal is centred, which on a splash is the brand moment itself and
/// not the centred-hero filler DESIGN_RUBRIC §11 bans — that rule is about
/// content screens dressing up emptiness. There is no content to be dense with
/// here. The failure block below it is left-aligned and real.
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
                        const _SealBrand(),
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

/// The animated brand: the saffron wax-seal presses in, an ink underline draws
/// left-to-right, then the Fraunces wordmark and tagline rise. Orchestrated on
/// one controller so the three beats are staged; degrades to the composed final
/// frame under reduce-motion. Plays once per mount (the seal sits first in the
/// Column, so a boot state change rebuilds around it without restarting it).
class _SealBrand extends StatefulWidget {
  const _SealBrand();

  @override
  State<_SealBrand> createState() => _SealBrandState();
}

class _SealBrandState extends State<_SealBrand>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _seal; // press-in + fade
  late final Animation<double> _underline; // draw left-to-right
  late final Animation<double> _wordmark; // fade + rise
  bool _kicked = false;

  @override
  void initState() {
    super.initState();
    // ≤600ms wall-clock orchestration; each staged element clears in ≤420ms
    // (PREMIUM_DESIGN_SPEC.md §4 / relaxation R2).
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _seal = CurvedAnimation(
      parent: _c,
      curve: const Interval(0.0, 0.70, curve: AppMotion.easeOutQuart),
    );
    _underline = CurvedAnimation(
      parent: _c,
      curve: const Interval(0.50, 0.80, curve: AppMotion.easeOutQuart),
    );
    _wordmark = CurvedAnimation(
      parent: _c,
      curve: const Interval(0.65, 1.0, curve: AppMotion.easeOutQuart),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // MediaQuery is available here (unlike initState). Kick once: reduce-motion
    // jumps to the final composed frame, everyone else plays the sequence.
    if (_kicked) return;
    _kicked = true;
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (reduce) {
      _c.value = 1.0;
    } else {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final sealV = _seal.value.clamp(0.0, 1.0);
        final underlineV = _underline.value.clamp(0.0, 1.0);
        final wordV = _wordmark.value.clamp(0.0, 1.0);
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Beat 1 — the seal presses in, framed by a frosted glass halo
            // (App-wide Glassmorphism Reskin, GL-4 — see [_HaloedSeal]).
            Opacity(
              opacity: sealV,
              child: Transform.scale(
                scale: 0.92 + 0.08 * sealV,
                child: const _HaloedSeal(),
              ),
            ),
            const SizedBox(height: AppSpacing.space5),
            // Beat 2 — the ink underline draws left-to-right (transform-only, so
            // nothing reflows): a solid stroke scaled in X from its left edge.
            SizedBox(
              width: 56,
              height: 2,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Transform(
                  alignment: Alignment.centerLeft,
                  transform: Matrix4.diagonal3Values(underlineV, 1.0, 1.0),
                  child: Container(
                    decoration: BoxDecoration(
                      color: scheme.onSurface,
                      borderRadius: AppRadius.rSm,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.space5),
            // Beat 3 — the Fraunces wordmark and tagline rise into place.
            Opacity(
              opacity: wordV,
              child: Transform.translate(
                offset: Offset(0, 10 * (1 - wordV)),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      context.l10n.appTitle,
                      style: text.displaySmall,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppSpacing.space2),
                    Text(
                      context.l10n.splashTagline,
                      textAlign: TextAlign.center,
                      style: text.bodyMedium
                          ?.copyWith(color: scheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// A restrained frosted-glass halo behind the brand seal (App-wide
/// Glassmorphism Reskin, GL-4). Kept deliberately restrained: a single soft
/// glass card, sized just large enough to frame the 96dp seal with breathing
/// room on every side, default sheen strength, no extra ornament layered on —
/// "the splash gained a tasteful glass touch," not a rebuild. This is the one
/// candidate in this unit for visibly overdoing the effect (a
/// first-impression screen invites exactly that temptation), so it stays a
/// single quiet panel rather than, say, a stack of concentric glass rings or
/// a full-bleed frosted background.
///
/// Uses [GlassSurface.flat], NOT the real-blur constructor: the GL-4 design
/// review found `scaffoldBackgroundColor` here is a flat, uniform
/// `scheme.surfaceContainerLowest` (`app_theme.dart` — "must stay a solid
/// Color") with no gradient/image behind this panel, so a real
/// `BackdropFilter` blurring a mathematically uniform colour field returns
/// that same uniform colour — visually identical to the flat path, but at a
/// real `saveLayer` + GPU blur cost for zero benefit. Exactly the "does the
/// blur earn its cost" mistake GL-2's review already caught once on
/// `GlassAppBar`; the fill/border/sheen are the only parts of this panel
/// doing visible work either way.
///
/// Fixed pixel size (not textScale-dependent) so the overflow-gate tests
/// (360dp x textScale 1.3, the short-screen scroll case) are unaffected: this
/// sits behind the fixed-size [_Seal], not the reflowing wordmark/tagline
/// text rendered below it in [_SealBrandState].
class _HaloedSeal extends StatelessWidget {
  const _HaloedSeal();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 152,
      height: 152,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // .flat, not real blur (see class doc — nothing behind this panel
          // for a real BackdropFilter to blur). radius: 40 on a 152dp box
          // reads as a soft, almost-circular squircle behind the seal's true
          // circle, echoing it without needing a separate circular-clip code
          // path.
          GlassSurface.flat(radius: 40, child: const SizedBox.expand()),
          const _Seal(),
        ],
      ),
    );
  }
}

/// The saffron wax-seal that authenticates the work: a `brandSaffron` disc (the
/// large-decorative saffron, exempt from the contrast gate) inside a brass ring,
/// its monogram embossed in `onPrimary`, lifting off the paper on a warm shadow.
class _Seal extends StatelessWidget {
  const _Seal();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final brass = isDark ? AppColors.dBrandBrass : AppColors.brandBrass;
    return Container(
      width: 96,
      height: 96,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.brandSaffron,
        border: Border.all(color: brass, width: 2),
        // Lift off the ivory ground; on espresso the bright seal carries itself,
        // so no muddy warm shadow there (§2.3 dark model).
        boxShadow: isDark ? null : AppShadows.e2,
      ),
      alignment: Alignment.center,
      child: Icon(
        LucideIcons.graduationCap,
        size: 40,
        color: scheme.onPrimary,
      ),
    );
  }
}

/// The bootstrap is still running. Deliberately quiet: this is a sub-second
/// state on a good connection, and the seal above is what the teacher is meant
/// to be looking at.
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
                size: AppIconSize.inline,
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
              icon: const Icon(LucideIcons.refreshCw, size: AppIconSize.inline),
              label: Text(l10n.actionRetry),
            ),
          ),
        ],
      ),
    );
  }
}
