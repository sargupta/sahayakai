import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/icon_well.dart';
import '../../domain/parent_outreach.dart';
import 'call_plan_card.dart';

/// U-PH4 — the Parent Hotline `calling` stage (SPEC §B.1 stage 5): the signature
/// **honest waiting** state while the AI voice call runs on the phone and the
/// controller polls `call-summary`.
///
/// v3 screen 14 composition (a left-aligned column on the scaffold's sage wash):
///   • a header row — the headline "Calling {name}'s parent…", an optional
///     `className · parentLanguage` meta line under it, and a leaf-green status
///     pill on the right carrying [CallResult.callStatus] / [CallResult.turnCount]
///     driven copy (`initiated` with no turns → "Ringing…", then a
///     conversation-in-progress line once turns start flowing). The pill owns the
///     ONE live region so the ringing → in-progress change is announced;
///   • the centred saffron [IconWell]-style haloed `phone-call` glyph with ONE
///     **breathing** halo (a ~3000ms opacity/scale swell driven by an
///     [AnimationController] frozen at its still frame under reduce-motion — the
///     same rule [SealMic] follows);
///   • the shared [CallPlanCard] — what VIDYA is actually saying and doing;
///   • a live `dataMedium` **tabular** "{turnCount} exchanges" pill, shown ONLY
///     once `turnCount > 1`;
///   • a quiet `bodySmall` reassurance backing the resume path — leaving the
///     screen never cancels the server-side call (SPEC §B.5.5).
///
/// **Honest waiting (SPEC §B.5.4).** There is deliberately NO determinate
/// progress bar / percentage / spinner here, and no "End call" / "Mute" pair
/// either: the teacher is not on the line, so neither button could do anything.
/// A breathing halo is the only honest affordance. The `calling_stage_test`
/// pins the absence of any [LinearProgressIndicator] or determinate
/// [CircularProgressIndicator].
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
    this.className,
    this.parentLanguage,
  });

  /// The student whose parent is being called — the headline reads
  /// "Calling {parentName}'s parent…". Sourced from the controller's
  /// `studentName` (there is no distinct parent-name field in the data model).
  final String parentName;

  /// The latest polled projection. Null on the very first frame after entering
  /// `calling` (before any poll) — treated as "Ringing…". Drives the status pill
  /// and the exchanges pill.
  final CallResult? callResult;

  /// The class the student is in, and the language the parent will be spoken to
  /// in — the screen-14 header meta line. Both optional; the meta line is
  /// omitted when neither is available, and neither is ever interpolated into
  /// the headline.
  final String? className;
  final String? parentLanguage;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final extras = AppTextExtras.of(context);
    final isDark = scheme.brightness == Brightness.dark;
    // `ink600` is the design's muted 11px meta colour on the light sage wash;
    // dark has no wash to sit on, so it falls back to the theme's own role.
    final muted = isDark ? scheme.onSurfaceVariant : AppColors.ink600;

    final result = callResult;
    // The only non-terminal status is `initiated`. It is "Ringing…" until the
    // first turn lands (turnCount == 0); once turns start flowing (or any
    // non-ringing signal appears) it reads "Conversation in progress". A null
    // result (just entered `calling`, no poll yet) reads as ringing.
    final ringing = result == null ||
        (result.callStatus == CallStatus.initiated && result.turnCount == 0);
    final turnCount = result?.turnCount ?? 0;

    // "Class 6A · Kannada", omitting whichever half is missing. Plain
    // interpolation of already-resolved strings, not an l10n key: it is a
    // data line, and both halves come from the roster entry.
    final meta = [
      className?.trim(),
      parentLanguage?.trim(),
    ].whereType<String>().where((part) => part.isNotEmpty).join(' · ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        // The screen-14 header: identity on the left, live status on the right.
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    l10n.parentHotlineCallingTitle(parentName),
                    style: text.displaySmall,
                  ),
                  if (meta.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.space1),
                    Text(meta, style: text.bodySmall?.copyWith(color: muted)),
                  ],
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.space2),
            _StatusPill(
              label: ringing
                  ? l10n.parentHotlineCallingRinging
                  : l10n.parentHotlineCallingInProgress,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.space6),
        const Center(child: _BreathingCallGlyph()),
        const SizedBox(height: AppSpacing.space6),
        const CallPlanCard(),
        // The live exchanges pill — only once a real back-and-forth is under way
        // (turnCount > 1); a lone opening greeting (turnCount <= 1) shows nothing.
        if (turnCount > 1) ...[
          const SizedBox(height: AppSpacing.space4),
          Center(
            child: _ExchangesPill(
              label: l10n.parentHotlineCallingExchanges(turnCount),
              // Full-ink `onSurface` on the `surfaceContainerHigh` fill — the
              // Chip-label pairing (PREMIUM_DESIGN_SPEC §5): the count is normal-
              // size (15sp) text, so the muted `onSurfaceVariant` role would read
              // at only 3.86:1 (below the 4.5:1 AA floor) whereas `onSurface`
              // clears ~14.6:1 and reads as a proper ledger numeral. Tabular
              // figures are preserved by `dataMedium`.
              style: extras.dataMedium.copyWith(color: scheme.onSurface),
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.space5),
        Text(
          l10n.parentHotlineCallingReassurance,
          style: text.bodySmall?.copyWith(color: muted),
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

/// The screen-14 leaf status pill — `600 11px` on the leaf-500 fill, stadium
/// radius, flex-none so the header headline keeps the space it needs.
///
/// It carries the call's ONE live region: the ringing → in-progress change is
/// what a screen reader needs to hear, and it belongs to the status and not to
/// the headline (which never changes).
class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final isDark = scheme.brightness == Brightness.dark;
    // leaf500 on the light wash (the design's "on call" green); dark has no
    // wash, so it keeps the theme's own secondary role.
    final fill = isDark ? scheme.secondary : AppColors.leaf500;

    return Semantics(
      liveRegion: true,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: fill,
          shape: StadiumBorder(
            side: BorderSide(color: isDark ? scheme.outline : fill),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.space3,
            vertical: AppSpacing.space2,
          ),
          child: Text(
            label,
            style: text.bodySmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: isDark ? scheme.onSecondary : AppColors.milk100,
            ),
          ),
        ),
      ),
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
