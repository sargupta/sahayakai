// ignore_for_file: prefer_const_constructors
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/i18n/l10n_ext.dart';
import '../../core/theme/app_theme.dart';
import '../../features/vidya/domain/deliverable.dart';
import '../../features/vidya/presentation/deliver_tray.dart';
import '../../features/vidya/presentation/vidya_cta_clearance.dart';
import '../../features/vidya/presentation/vidya_presence.dart';
import '../motion/animated_entrance.dart';
import 'map_page_header.dart';
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
///
/// **The Output screen** (UX map Flow 4). When [hasResult] is true and nothing
/// is generating, the scaffold becomes the tool's output: the form stays
/// mounted but hidden (so its inputs survive), the [result] fills the page
/// under *Edit* and *Regenerate* ([onRegenerate]), and *Deliver* is the one
/// primary action when the tool supplies a [deliverable].
///
/// *Edit* never throws the result away: it brings the form back while the
/// result stays in the tool's state, *Back to result* returns to it untouched,
/// and the sticky Generate runs [onResubmit]. Only a finished regeneration
/// replaces the result. While the output shows, that deliverable is the result on
/// screen ([visibleDeliverableProvider]), so the orb turns green with a badge.
class ToolScaffold extends ConsumerStatefulWidget {
  const ToolScaffold({
    super.key,
    required this.title,
    required this.child,
    this.subtitle,
    this.headerTrailing,
    this.dark = false,
    this.inkSubmit = false,
    this.canSubmit = true,
    this.result,
    this.onSubmit,
    this.submitLabel,
    this.isBusy = false,
    this.vidyaAction = true,
    this.onMinimise,
    this.onStop,
    this.wash,
    this.hasResult = false,
    this.onResubmit,
    this.onRegenerate,
    this.deliverable,
  });

  /// The page title: the UX map's large Bricolage heading at the top of the
  /// page ("Make a lesson", "Quiz Generator").
  final String title;
  final Widget child;

  /// The muted line under the title ("Spoken or typed, same result").
  final String? subtitle;

  /// Shown at the end of the header row, opposite Back (a count pill).
  final Widget? headerTrailing;

  /// The map's one dark screen (the scanner): a near-black wash, light ink,
  /// and a dark Back button.
  final bool dark;

  /// The map's ink primary button (Instant Answer's "Get instant answer")
  /// instead of the saffron one.
  final bool inkSubmit;

  /// False while a required input is missing (the worksheet's page, the
  /// scanner's first sheet): the button shows, disabled, as the map draws it.
  final bool canSubmit;
  final Widget? result;
  final VoidCallback? onSubmit;
  final String? submitLabel;
  final bool isBusy;

  /// The per-screen v3 wash (Design System v3: every screen has its own
  /// `168deg` gradient). `null` → `washDefault`.
  final Gradient? wash;

  /// Kept for call sites: the UX map has no app bar, and VIDYA is the orb
  /// that floats over every tool.
  final bool vidyaAction;

  /// Hands the running generation to VIDYA and leaves the screen (v3 06). When
  /// non-null, the busy state shows a *Minimise to orb* action instead of a
  /// disabled spinner button.
  final VoidCallback? onMinimise;

  /// Abandons the running generation and returns to the form. Shown beside
  /// *Minimise to orb*; ignored unless [onMinimise] is also set.
  final VoidCallback? onStop;

  /// Whether a finished result is ready to show as the Output screen.
  final bool hasResult;

  /// The tool's own submit, run from the form while editing a finished
  /// result (tools withdraw [onSubmit] while a result exists). Without it the
  /// Output screen offers no Edit.
  final VoidCallback? onResubmit;

  /// Runs the same request again from the Output screen.
  final VoidCallback? onRegenerate;

  /// The finished result as the deliver tray takes it. When given, the Output
  /// screen's primary action is *Deliver* and the orb counts it as ready.
  final Deliverable? deliverable;

  @override
  ConsumerState<ToolScaffold> createState() => _ToolScaffoldState();
}

class _ToolScaffoldState extends ConsumerState<ToolScaffold> {
  /// Captured while mounted, so leaving the screen can still clear the result
  /// it put on screen.
  late VisibleDeliverableController _visible;

  /// The deliverable this screen has registered as on screen, if any.
  Deliverable? _shown;

  /// The teacher tapped Edit: the form is back, the result is kept.
  bool _editing = false;

  bool get _hasFinishedResult =>
      widget.hasResult && !widget.isBusy && widget.result != null;

  bool get _output => _hasFinishedResult && !_editing;

  bool get _editingResult => _hasFinishedResult && _editing;

  @override
  void initState() {
    super.initState();
    _visible = ref.read(visibleDeliverableProvider.notifier);
    _syncVisible();
  }

  @override
  void didUpdateWidget(ToolScaffold oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A finished generation shows its new result; a cleared one ends editing.
    if ((oldWidget.isBusy && !widget.isBusy) || !widget.hasResult) {
      _editing = false;
    }
    _syncVisible();
  }

  @override
  void dispose() {
    final shown = _shown;
    if (shown != null) {
      // Providers cannot change while the tree is finalising: defer.
      final visible = _visible;
      Future.microtask(() => visible.hide(shown));
    }
    super.dispose();
  }

  /// Keeps [visibleDeliverableProvider] in step with what this screen shows.
  /// Compared by id: a tool may build a fresh [Deliverable] for the same
  /// result on every frame.
  void _syncVisible() {
    final next = _output ? widget.deliverable : null;
    if (next?.id == _shown?.id) return;
    final previous = _shown;
    _shown = next;
    // Providers cannot change during build or initState: after the frame.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (previous != null) _visible.hide(previous);
      if (next != null && mounted) _visible.show(next);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final output = _output;
    final editing = _editingResult;

    // v3 Screen 06: while a minimisable generation runs, the whole screen is
    // the "working" state — the page recedes behind the working sheet.
    final working = widget.isBusy && widget.onMinimise != null;

    // While busy AND minimisable, the working bar replaces the submit button;
    // the Output screen's one primary action is Deliver; otherwise the plain
    // sticky Generate button (when there is a submit).
    final Widget? bottom;
    final deliverable = widget.deliverable;
    if (working) {
      bottom = _WorkingBar(
        onMinimise: widget.onMinimise!,
        onStop: widget.onStop,
      );
    } else if (output) {
      bottom = deliverable == null
          ? null
          : PrimaryButton(
              label: l10n.deliverTrayTitle,
              onPressed: () => showDeliverTray(context, deliverable),
            );
    } else if (editing && widget.onResubmit != null) {
      bottom = PrimaryButton(
        label: widget.submitLabel ?? 'Generate',
        onPressed: widget.onResubmit,
        ink: widget.inkSubmit,
      );
    } else if (widget.onSubmit != null) {
      bottom = PrimaryButton(
        label: widget.submitLabel ?? 'Generate',
        onPressed: (widget.isBusy || !widget.canSubmit)
            ? null
            : widget.onSubmit,
        isBusy: widget.isBusy,
        ink: widget.inkSubmit,
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
        : (widget.wash ??
              (brightness == Brightness.dark
                  ? AppGradients.darkVignette
                  : AppGradients.washDefault));

    final page = DecoratedBox(
      decoration: widget.dark
          ? const BoxDecoration(color: AppColors.scanWash)
          : BoxDecoration(gradient: effectiveWash),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        resizeToAvoidBottomInset: true,
        body: SafeArea(
          child: Stack(
            children: [
              // Screen 06: the page recedes behind the working sheet — content
              // at .4 under a .12 ink scrim (the design's paired dim), while
              // staying scrollable and tappable ("keep using the app").
              Opacity(
                opacity: working ? 0.4 : 1,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.mapGutter,
                    AppSpacing.space2,
                    AppSpacing.mapGutter,
                    AppSpacing.space6,
                  ),
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 640),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          MapPageHeader(
                            dark: widget.dark,
                            trailing: widget.headerTrailing,
                          ),
                          // The result carries its own masthead.
                          if (!output) ...[
                            const SizedBox(height: AppSpacing.space2),
                            MapPageTitle(
                              title: widget.title,
                              subtitle: widget.subtitle,
                              dark: widget.dark,
                            ),
                            const SizedBox(height: AppSpacing.space4),
                          ],
                          if (editing) ...[
                            _ScaffoldPill(
                              label: l10n.outputBackToResult,
                              onTap: () => setState(() => _editing = false),
                            ),
                            const SizedBox(height: AppSpacing.space3),
                          ],
                          // The form stays mounted on the Output screen so
                          // Edit returns to it with every input intact.
                          Offstage(offstage: output, child: widget.child),
                          if (output) ...[
                            _OutputActions(
                              onEdit: widget.onResubmit == null
                                  ? null
                                  : () => setState(() => _editing = true),
                              onRegenerate: widget.onRegenerate,
                            ),
                            const SizedBox(height: AppSpacing.space3),
                          ],
                          if (widget.result != null) ...[
                            if (!output && !editing)
                              const SizedBox(height: AppSpacing.sectionGap),
                            // Kept mounted while editing: the result is only
                            // hidden, never dropped.
                            Offstage(offstage: editing, child: widget.result!),
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
        // The floating orb parks above whatever is pinned here.
        bottomNavigationBar: bottom == null
            ? null
            : VidyaCtaClearance(
                child: SafeArea(
                  // The working sheet is full-bleed (its own sheetPadding sets
                  // the inset); the plain submit button keeps the page gutter.
                  child: Padding(
                    padding: working ? EdgeInsets.zero : AppSpacing.pagePadding,
                    child: bottom,
                  ),
                ),
              ),
      ),
    );
    // The dark scanner needs light status-bar icons.
    return widget.dark
        ? AnnotatedRegion<SystemUiOverlayStyle>(
            value: SystemUiOverlayStyle.light,
            child: page,
          )
        : page;
  }
}

/// The Output screen's two ways back into the request: *Edit* (the form) and
/// *Regenerate* (the same request again). Either is left out when the tool
/// offers no handler for it.
class _OutputActions extends StatelessWidget {
  const _OutputActions({this.onEdit, this.onRegenerate});

  final VoidCallback? onEdit;
  final VoidCallback? onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final onEdit = this.onEdit;
    final onRegenerate = this.onRegenerate;
    if (onEdit == null && onRegenerate == null) return const SizedBox.shrink();
    return Row(
      children: [
        if (onEdit != null)
          Expanded(
            child: _ScaffoldPill(label: l10n.outputEdit, onTap: onEdit),
          ),
        if (onEdit != null && onRegenerate != null) const SizedBox(width: 9),
        if (onRegenerate != null)
          Expanded(
            child: _ScaffoldPill(
              label: l10n.actionRegenerate,
              onTap: onRegenerate,
            ),
          ),
      ],
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
                          color: AppColors.indigo500.withValues(
                            alpha: 0.32,
                          ), // indigo @ .32
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
                  child: _ScaffoldPill(
                    label: l10n.vidyaWorkingMinimise,
                    onTap: widget.onMinimise,
                  ),
                ),
                if (widget.onStop != null) ...[
                  const SizedBox(width: 9),
                  Expanded(
                    child: _ScaffoldPill(
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

/// One 46px pill: outline (*Minimise to orb*, *Edit*, *Regenerate*) or tonal
/// ink (*Stop*), 13/600 ink600 — the design's exact pair, side by side.
class _ScaffoldPill extends StatelessWidget {
  const _ScaffoldPill({
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
                : Border.all(color: AppColors.ink900.withValues(alpha: 0.14)),
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
