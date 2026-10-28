// ignore_for_file: prefer_const_constructors
import 'package:flutter/material.dart';

import '../../core/i18n/l10n_ext.dart';
import '../../core/theme/app_theme.dart';
import '../../features/vidya/presentation/vidya_sheet.dart';
import '../motion/animated_entrance.dart';
import 'glass_app_bar.dart';
import 'primary_button.dart';

/// Every AI tool page's shell: surface AppBar + a scrolling form capped at
/// 640dp (so it never stretches edge-to-edge on tablets) + an optional sticky
/// Generate button above the gesture inset. See ARCHITECTURE §9.1.
///
/// Carries the **per-screen wash** of Design System v3: the whole frame sits
/// on its `168deg` gradient ([wash]), so each tool wears the exact background
/// its canonical screen specifies (composer → `washComposer`, quiz →
/// `washQuiz`, rubric → `washRubric`, roll call → `washRollCall`, …) while
/// tools without a canonical screen keep `washDefault`.
///
/// The app bar carries the VIDYA co-teacher action by default ([vidyaAction]),
/// so VIDYA is reachable from every tool screen ("on every page", U-V7) without
/// leaving the task; pass `vidyaAction: false` to opt a scaffold out.
///
/// A tool that can hand its in-flight generation to VIDYA passes [onMinimise]
/// (and, to abandon it, [onStop]): while it is busy the sticky action becomes
/// the v3 screen 06 "working" bar — *Minimise to orb* lets the teacher leave
/// and VIDYA finishes in the background, *Stop* cancels. Tools that pass neither
/// keep the plain busy button, so nothing changes for them.
class ToolScaffold extends StatelessWidget {
  const ToolScaffold({
    super.key,
    required this.title,
    required this.child,
    this.result,
    this.onSubmit,
    this.submitLabel,
    this.isBusy = false,
    this.vidyaAction = true,
    this.onMinimise,
    this.onStop,
    this.wash,
  });

  final String title;
  final Widget child;
  final Widget? result;
  final VoidCallback? onSubmit;
  final String? submitLabel;
  final bool isBusy;

  /// The per-screen v3 wash (Design System v3: every screen has its own
  /// `168deg` gradient). `null` → `washDefault`.
  final Gradient? wash;

  /// Whether the app bar shows the VIDYA co-teacher action (default true).
  final bool vidyaAction;

  /// Hands the running generation to VIDYA and leaves the screen (v3 06). When
  /// non-null, the busy state shows a *Minimise to orb* action instead of a
  /// disabled spinner button.
  final VoidCallback? onMinimise;

  /// Abandons the running generation and returns to the form. Shown beside
  /// *Minimise to orb*; ignored unless [onMinimise] is also set.
  final VoidCallback? onStop;

  @override
  Widget build(BuildContext context) {
    // v3 Screen 06: while a minimisable generation runs, the whole screen is
    // the "working" state — the page recedes behind the working sheet.
    final working = isBusy && onMinimise != null;

    // While busy AND minimisable, the working bar replaces the submit button;
    // otherwise the plain sticky Generate button (when there is a submit).
    final Widget? bottom;
    if (working) {
      bottom = _WorkingBar(onMinimise: onMinimise!, onStop: onStop);
    } else if (onSubmit != null) {
      bottom = PrimaryButton(
        label: submitLabel ?? 'Generate',
        onPressed: isBusy ? null : onSubmit,
        isBusy: isBusy,
      );
    } else {
      bottom = null;
    }

    // The v3 wash covers the ENTIRE frame (status bar → bottom edge), the way
    // the canonical screens paint it — so it lives behind a transparent
    // Scaffold, not in the body. Screen 06's working state swaps in the cool
    // indigo wash (light themes; dark keeps the vignette).
    final brightness = Theme.of(context).brightness;
    final effectiveWash = (working && brightness != Brightness.dark)
        ? AppGradients.washWorking
        : (wash ??
            (brightness == Brightness.dark
                ? AppGradients.darkVignette
                : AppGradients.washDefault));

    return DecoratedBox(
      decoration: BoxDecoration(gradient: effectiveWash),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        resizeToAvoidBottomInset: true,
        appBar: GlassAppBar(
          title: Text(title),
          actions: [if (vidyaAction) const VidyaAppBarAction()],
        ),
        body: SafeArea(
          child: Stack(
            children: [
              // Screen 06: the page recedes behind the working sheet — content
              // at .4 under a .12 ink scrim (the design's paired dim), while
              // staying scrollable and tappable ("keep using the app").
              Opacity(
                opacity: working ? 0.4 : 1,
                child: SingleChildScrollView(
                  padding: AppSpacing.pagePadding,
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 640),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          child,
                          if (result != null) ...[
                            const SizedBox(height: AppSpacing.sectionGap),
                            result!,
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              if (working)
                Positioned.fill(
                  child: ColoredBox(
                    color: AppColors.ink900.withValues(alpha: 0.12),
                  ),
                ),
            ],
          ),
        ),
        bottomNavigationBar: bottom == null
            ? null
            : SafeArea(
                // The working sheet is full-bleed (its own sheetPadding sets
                // the inset); the plain submit button keeps the page gutter.
                child: Padding(
                  padding: working
                      ? EdgeInsets.zero
                      : AppSpacing.pagePadding,
                  child: bottom,
                ),
              ),
      ),
    );
  }
}

/// The v3 screen 06 "working" action: the design's milk bottom sheet — grab
/// handle, the 42px pulsing indigo orb, "VIDYA is working — keep using the
/// app", and two side-by-side pills (*Minimise to orb* outline, *Stop* tonal).
/// No fake step checklist or percentage: the backend streams no progress, so
/// the surface promises only what it can keep.
class _WorkingBar extends StatefulWidget {
  const _WorkingBar({required this.onMinimise, this.onStop});

  final VoidCallback onMinimise;
  final VoidCallback? onStop;

  @override
  State<_WorkingBar> createState() => _WorkingBarState();
}

class _WorkingBarState extends State<_WorkingBar>
    with SingleTickerProviderStateMixin {
  /// The orb's CSS `pulse 1.8s ease-in-out infinite`.
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );
    // NOTE: no inherited-lookups here — `_syncPulse` reads `motionEnabled`,
    // which must happen in didChangeDependencies (called before the first
    // build) instead.
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncPulse();
  }

  void _syncPulse() {
    if (!context.motionEnabled) {
      _pulse.stop();
      _pulse.value = 0;
      return;
    }
    if (!_pulse.isAnimating) _pulse.repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final scale = Tween<double>(
      begin: 1.0,
      end: 1.06,
    ).animate(CurvedAnimation(parent: _pulse, curve: Curves.easeInOut));

    // The opaque milk sheet (Screen 06): 26px top radius, sheet lift, and the
    // design's own 14 / 18 / 20 padding — the same grammar as the VIDYA sheet.
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.milk50,
        borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
        boxShadow: [AppShadows.sheet],
      ),
      child: Padding(
        padding: AppSpacing.sheetPadding,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4,
                decoration: ShapeDecoration(
                  color: AppColors.ink900.withValues(alpha: 0.14),
                  shape: const StadiumBorder(),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.space3),
            Row(
              children: [
                // The working orb, breathing: VIDYA's indigo, 42px.
                ScaleTransition(
                  scale: scale,
                  child: Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const RadialGradient(
                        center: Alignment(-0.32, -0.4),
                        radius: 0.95,
                        colors: [AppColors.indigo100, AppColors.indigo500],
                        stops: [0.0, 0.74],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.indigo500.withValues(alpha: 0.32), // indigo @ .32
                          offset: Offset(0, 6),
                          blurRadius: 18,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // 13/600 Bricolage.
                      Text(l10n.vidyaWorkingTitle, style: text.titleMedium),
                      const SizedBox(height: 1),
                      // 11px muted ink.
                      Text(
                        l10n.vidyaWorkingBody,
                        style: text.bodySmall?.copyWith(
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.space3),
            Row(
              children: [
                Expanded(
                  child: _WorkingPill(
                    label: l10n.vidyaWorkingMinimise,
                    onTap: widget.onMinimise,
                  ),
                ),
                if (widget.onStop != null) ...[
                  const SizedBox(width: 9),
                  Expanded(
                    child: _WorkingPill(
                      label: l10n.vidyaWorkingStop,
                      tonal: true,
                      onTap: widget.onStop!,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// One 46px working-state pill: outline (*Minimise to orb*) or tonal ink
/// (*Stop*), 13/600 ink600 — the design's exact pair, side by side.
class _WorkingPill extends StatelessWidget {
  const _WorkingPill({
    required this.label,
    required this.onTap,
    this.tonal = false,
  });

  final String label;
  final VoidCallback onTap;
  final bool tonal;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: tonal
          ? AppColors.ink900.withValues(alpha: 0.06)
          : Colors.transparent,
      borderRadius: BorderRadius.circular(9999),
      child: InkWell(
        borderRadius: BorderRadius.circular(9999),
        onTap: onTap,
        child: Container(
          height: 46,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(9999),
            border: tonal
                ? null
                : Border.all(
                    color: AppColors.ink900.withValues(alpha: 0.14),
                  ),
          ),
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.ink600,
            ),
          ),
        ),
      ),
    );
  }
}
