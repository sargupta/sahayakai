import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/icon_well.dart';
import '../../domain/parent_outreach.dart';

/// U-PH4 — the Parent Hotline `calling` stage (SPEC §B.1 stage 5): the signature
/// **honest waiting** state while the AI voice call runs on the phone and the
/// controller polls `call-summary`.
///
/// Composition (a full-body centred column on the scaffold's warm ground — no
/// separate ivory rect, the page bg *is* the ground):
///   • a centred saffron [IconWell]-style haloed `phone-call` glyph with ONE
///     **breathing** halo (reuse the codebase breathe idiom: a ~3000ms opacity/
///     scale swell driven by an [AnimationController] frozen at its still frame
///     under reduce-motion — the same rule [SealMic] follows);
///   • a `displaySmall` headline "Calling {name}'s parent…";
///   • a muted `bodyMedium` status line driven by [CallResult.callStatus] /
///     [CallResult.turnCount] — `initiated` with no turns → "Ringing…", then a
///     conversation-in-progress line once turns start flowing;
///   • a live `dataMedium` **tabular** "{turnCount} exchanges" pill, shown ONLY
///     once `turnCount > 1`;
///   • a quiet `bodySmall` reassurance backing the resume path — leaving the
///     screen never cancels the server-side call (SPEC §B.5.5).
///
/// **Honest waiting (SPEC §B.5.4).** There is deliberately NO determinate
/// progress bar / percentage / spinner-with-ETA here: a real phone call is of
/// unknown length and the teacher is not on the line, so a breathing halo is the
/// only honest affordance. The `calling_stage_test` pins the absence of any
/// [LinearProgressIndicator] or determinate [CircularProgressIndicator].
///
/// A dumb, prop-driven widget (no Riverpod) so it renders deterministically in
/// isolation, mirroring [ReasonCard] / the evidence panel. The screen passes the
/// controller's `studentName` (the parent is identified via the student — there
/// is no separate parent-name field) and the polled `callResult`.
class CallingStage extends StatelessWidget {
  const CallingStage({
    super.key,
    required this.parentName,
    required this.callResult,
  });

  /// The student whose parent is being called — the headline reads
  /// "Calling {parentName}'s parent…". Sourced from the controller's
  /// `studentName` (there is no distinct parent-name field in the data model).
  final String parentName;

  /// The latest polled projection. Null on the very first frame after entering
  /// `calling` (before any poll) — treated as "Ringing…". Drives the status line
  /// and the exchanges pill.
  final CallResult? callResult;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final extras = AppTextExtras.of(context);

    final result = callResult;
    // The only non-terminal status is `initiated`. It is "Ringing…" until the
    // first turn lands (turnCount == 0); once turns start flowing (or any
    // non-ringing signal appears) it reads "Conversation in progress". A null
    // result (just entered `calling`, no poll yet) reads as ringing.
    final ringing = result == null ||
        (result.callStatus == CallStatus.initiated && result.turnCount == 0);
    final turnCount = result?.turnCount ?? 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        // A calm top gap so the waiting state settles below the app bar rather
        // than jamming under it (the scaffold body is a top-aligned scroll view).
        const SizedBox(height: AppSpacing.space10),
        const _BreathingCallGlyph(),
        const SizedBox(height: AppSpacing.space8),
        Text(
          l10n.parentHotlineCallingTitle(parentName),
          style: text.displaySmall,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.space3),
        // A live region so a screen reader announces the ringing → in-progress
        // transition (the headline stays a plain Text).
        Semantics(
          liveRegion: true,
          child: Text(
            ringing
                ? l10n.parentHotlineCallingRinging
                : l10n.parentHotlineCallingInProgress,
            style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
            textAlign: TextAlign.center,
          ),
        ),
        // The live exchanges pill — only once a real back-and-forth is under way
        // (turnCount > 1); a lone opening greeting (turnCount <= 1) shows nothing.
        if (turnCount > 1) ...[
          const SizedBox(height: AppSpacing.space4),
          _ExchangesPill(
            label: l10n.parentHotlineCallingExchanges(turnCount),
            // Full-ink `onSurface` on the `surfaceContainerHigh` fill — the
            // Chip-label pairing (PREMIUM_DESIGN_SPEC §5): the count is normal-
            // size (15sp) text, so the muted `onSurfaceVariant` role would read
            // at only 3.86:1 (below the 4.5:1 AA floor) whereas `onSurface`
            // clears ~14.6:1 and reads as a proper ledger numeral. Tabular
            // figures are preserved by `dataMedium`.
            style: extras.dataMedium.copyWith(color: scheme.onSurface),
          ),
        ],
        const SizedBox(height: AppSpacing.space6),
        Text(
          l10n.parentHotlineCallingReassurance,
          style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
          textAlign: TextAlign.center,
          // Matra-safe metrics so Indic top/bottom vowel signs are never cropped
          // when this reassurance wraps (DESIGN_RUBRIC §12.4).
          textHeightBehavior: const TextHeightBehavior(
            applyHeightToFirstAscent: true,
            applyHeightToLastDescent: true,
          ),
        ),
      ],
    );
  }
}

/// The live "{n} exchanges" pill — a stadium-radius chip carrying the tabular
/// `dataMedium` count so the figures never reflow as the number grows.
class _ExchangesPill extends StatelessWidget {
  const _ExchangesPill({required this.label, required this.style});

  final String label;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: scheme.surfaceContainerHigh,
        shape: StadiumBorder(side: BorderSide(color: scheme.outline)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.space3,
          vertical: AppSpacing.space2,
        ),
        child: Text(label, style: style),
      ),
    );
  }
}

/// The centred saffron [IconWell]-style `phone-call` glyph with ONE breathing
/// halo. The halo is a soft saffron disc behind the well whose diameter and
/// opacity swell on a ~3000ms cycle; the well itself ([IconWell]) is the
/// production glyph treatment. Saffron stays an accent — the halo peaks at
/// `primary@0.10` over a small footprint, well under the 10% surface budget.
///
/// Reduce-motion (`context.motionEnabled == false` / `MediaQuery.disableAnimations`)
/// stops the controller and pins it at its still frame, exactly as [SealMic]
/// does, so a pumped test settles with no infinite ticker.
class _BreathingCallGlyph extends StatefulWidget {
  const _BreathingCallGlyph();

  @override
  State<_BreathingCallGlyph> createState() => _BreathingCallGlyphState();
}

class _BreathingCallGlyphState extends State<_BreathingCallGlyph>
    with SingleTickerProviderStateMixin {
  static const double _footprint = 128;
  static const double _haloMin = 84;
  static const double _haloSwell = 24;

  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000), // slow breathing
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncMotion();
  }

  /// Run the breathe only when motion is allowed; otherwise freeze at phase 0 —
  /// the composed still — so reduce-motion renders one static frame.
  void _syncMotion() {
    if (!context.motionEnabled) {
      _c.stop();
      _c.value = 0;
      return;
    }
    if (!_c.isAnimating) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final motion = context.motionEnabled;

    return SizedBox(
      width: _footprint,
      height: _footprint,
      child: AnimatedBuilder(
        animation: _c,
        // The well is built once and handed in as `child` so the breathe only
        // rebuilds the halo.
        child: const IconWell(icon: LucideIcons.phoneCall, feature: true),
        builder: (context, child) {
          // 0..1 swell; frozen at the mid-frame (0.5) when motion is off.
          final swell =
              motion ? 0.5 + 0.5 * math.sin(_c.value * 2 * math.pi) : 0.5;
          // The halo is a FIXED-size disc scaled by the swell via
          // Transform.scale (the seal_mic.dart pattern) so the 3000ms breathe
          // composites without forcing a per-frame relayout — the size used to
          // animate width/height, which janks on low-end Android. Same visual
          // range (84dp → 108dp); the opacity swell is a paint-only fill change.
          final haloScale = (_haloMin + _haloSwell * swell) / _haloMin;
          return Stack(
            alignment: Alignment.center,
            children: [
              Transform.scale(
                scale: haloScale,
                child: Container(
                  width: _haloMin,
                  height: _haloMin,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color:
                        scheme.primary.withValues(alpha: 0.05 + 0.05 * swell),
                  ),
                ),
              ),
              child!,
            ],
          );
        },
      ),
    );
  }
}
