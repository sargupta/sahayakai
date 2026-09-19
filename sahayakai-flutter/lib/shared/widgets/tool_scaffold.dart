import 'package:flutter/material.dart';

import '../../core/i18n/l10n_ext.dart';
import '../../core/theme/app_theme.dart';
import '../../features/vidya/presentation/vidya_sheet.dart';
import 'glass_app_bar.dart';
import 'primary_button.dart';
import 'secondary_button.dart';

/// Every AI tool page's shell: surface AppBar + a scrolling form capped at
/// 640dp (so it never stretches edge-to-edge on tablets) + an optional sticky
/// Generate button above the gesture inset. See ARCHITECTURE §9.1.
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
  });

  final String title;
  final Widget child;
  final Widget? result;
  final VoidCallback? onSubmit;
  final String? submitLabel;
  final bool isBusy;

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
    // While busy AND minimisable, the working bar replaces the submit button;
    // otherwise the plain sticky Generate button (when there is a submit).
    final Widget? bottom;
    if (isBusy && onMinimise != null) {
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

    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: GlassAppBar(
        title: Text(title),
        actions: [if (vidyaAction) const VidyaAppBarAction()],
      ),
      body: SafeArea(
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
      bottomNavigationBar: bottom == null
          ? null
          : SafeArea(
              child: Padding(padding: AppSpacing.pagePadding, child: bottom),
            ),
    );
  }
}

/// The v3 screen 06 "working" action: an honest, progress-free line ("VIDYA is
/// working — keep using the app") over *Minimise to orb* and *Stop*. No fake
/// step checklist or percentage: the backend streams no progress, so the
/// surface promises only what it can keep.
class _WorkingBar extends StatelessWidget {
  const _WorkingBar({required this.onMinimise, this.onStop});

  final VoidCallback onMinimise;
  final VoidCallback? onStop;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            // The working orb, in miniature: VIDYA's indigo (scheme.tertiary).
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  center: const Alignment(-0.3, -0.4),
                  colors: [
                    Color.lerp(scheme.tertiary, Colors.white, 0.55)!,
                    scheme.tertiary,
                  ],
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.space3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(l10n.vidyaWorkingTitle, style: text.titleSmall),
                  Text(
                    l10n.vidyaWorkingBody,
                    style: text.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.space3),
        PrimaryButton(label: l10n.vidyaWorkingMinimise, onPressed: onMinimise),
        if (onStop != null) ...[
          const SizedBox(height: AppSpacing.space2),
          SecondaryButton(label: l10n.vidyaWorkingStop, onPressed: onStop),
        ],
      ],
    );
  }
}
