import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/icon_well.dart';
import '../../../../shared/widgets/map_card.dart';
import '../../domain/call_summary.dart';
import '../../domain/parent_outreach.dart';
import '../hotline_copy.dart';

/// The Parent Hotline `calling` stage, as the UX map draws it ("Parent call"):
/// centred on the sage wash, a green "Call in progress · m:ss" overline
/// ticking from when the call was placed, the breathing call glyph, the
/// parent, "Speaking {language} · N exchanges so far", the live transcript
/// once turns arrive, and the reassurance that leaving never ends the call.
///
/// **Honest waiting.** No progress bar or percentage: the call has no known
/// length. The timer counts only from a real placement time and is left out
/// when there is none (a resumed call); the transcript shows only turns the
/// server returned. When status checks keep failing it says so plainly
/// ([pollTrouble]) rather than inventing an outcome. There is no End call or
/// Listen in: the backend has no route for either.
class CallingStage extends StatefulWidget {
  const CallingStage({
    super.key,
    required this.parentName,
    required this.callResult,
    this.className,
    this.parentLanguage,
    this.callStartedAt,
    this.pollTrouble = false,
    this.now,
  });

  /// The student's name: the parent is identified through the student.
  final String parentName;
  final CallResult? callResult;
  final String? className;

  /// The parent's language as the API names it ("Kannada"); shown in its own
  /// script.
  final String? parentLanguage;

  /// When this call was placed in this session; null for a resumed call.
  final DateTime? callStartedAt;

  /// Recent status checks failed; the call may well still be going.
  final bool pollTrouble;

  /// The clock (injectable for tests).
  final DateTime Function()? now;

  @override
  State<CallingStage> createState() => _CallingStageState();
}

class _CallingStageState extends State<CallingStage> {
  Timer? _tick;

  DateTime _now() => (widget.now ?? DateTime.now)();

  @override
  void initState() {
    super.initState();
    _syncTick();
  }

  @override
  void didUpdateWidget(CallingStage old) {
    super.didUpdateWidget(old);
    if (old.callStartedAt != widget.callStartedAt) _syncTick();
  }

  void _syncTick() {
    _tick?.cancel();
    _tick = widget.callStartedAt == null
        ? null
        : Timer.periodic(const Duration(seconds: 1), (_) {
            if (mounted) setState(() {});
          });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  String _elapsed() {
    final started = widget.callStartedAt!;
    var seconds = _now().difference(started).inSeconds;
    if (seconds < 0) seconds = 0;
    return '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final result = widget.callResult;
    final turnCount = result?.turnCount ?? 0;
    final language = nativeLanguageLabel(widget.parentLanguage ?? '');
    final transcript = result?.transcript ?? const <TranscriptTurn>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: AppSpacing.space3),
        // The call's one live region: the timer line.
        Semantics(
          liveRegion: true,
          child: Center(
            child: MapOverline(
              widget.callStartedAt == null
                  ? l10n.parentHotlineCallingNoTimer
                  : l10n.parentHotlineCallingTimer(_elapsed()),
              color: AppColors.leaf700,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.space5),
        const Center(child: _BreathingCallGlyph()),
        const SizedBox(height: AppSpacing.space5),
        Text(
          l10n.parentHotlineCallingTitle(widget.parentName),
          textAlign: TextAlign.center,
          style: text.displayLarge?.copyWith(
            fontSize: 22,
            color: AppColors.textStrong,
          ),
        ),
        if (language.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.space1),
          Text(
            l10n.parentHotlineCallingSpeaking(turnCount, language),
            textAlign: TextAlign.center,
            style: text.bodyMedium?.copyWith(color: AppColors.textBody),
          ),
        ],
        if (widget.pollTrouble) ...[
          const SizedBox(height: AppSpacing.space4),
          Text(
            l10n.parentHotlinePollTrouble,
            textAlign: TextAlign.center,
            style: text.bodySmall?.copyWith(color: AppColors.amber500),
          ),
        ],
        if (transcript.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.space5),
          MapCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                MapOverline(l10n.parentHotlineLiveTranscript),
                const SizedBox(height: AppSpacing.space2),
                for (final (i, turn) in transcript.indexed) ...[
                  if (i > 0) const SizedBox(height: AppSpacing.space2),
                  _TranscriptLine(turn: turn),
                ],
              ],
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.space5),
        Text(
          l10n.parentHotlineCallingReassurance,
          style: text.bodySmall?.copyWith(color: AppColors.textMuted),
          textAlign: TextAlign.center,
          // Matra-safe metrics so Indic vowel signs are never cropped.
          textHeightBehavior: const TextHeightBehavior(
            applyHeightToFirstAscent: true,
            applyHeightToLastDescent: true,
          ),
        ),
      ],
    );
  }
}

/// One transcript turn: a small speaker tag (AI / Parent) and the words. A
/// turn whose speaker the server did not say gets no tag, never a guess.
class _TranscriptLine extends StatelessWidget {
  const _TranscriptLine({required this.turn});

  final TranscriptTurn turn;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final role = turn.role;
    final (label, fill, ink) = switch (role) {
      TranscriptRole.agent => (
        l10n.parentHotlineSpeakerAi,
        AppColors.mapOptLeaf,
        AppColors.leaf700,
      ),
      TranscriptRole.parent => (
        l10n.parentHotlineSpeakerParent,
        AppColors.tileSaffronBg,
        AppColors.tileSaffronInk,
      ),
      null => ('', AppColors.mapOptLeaf, AppColors.leaf700),
    };
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (role != null) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: ShapeDecoration(
              color: fill,
              shape: const StadiumBorder(),
            ),
            child: Text(
              label,
              style: text.labelSmall?.copyWith(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: ink,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.space2),
        ],
        Expanded(
          child: Text(
            turn.text,
            style: text.bodySmall?.copyWith(
              fontSize: 13,
              color: AppColors.textStrong,
            ),
          ),
        ),
      ],
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
          final swell = motion
              ? 0.5 + 0.5 * math.sin(_c.value * 2 * math.pi)
              : 0.5;
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
                    color: scheme.primary.withValues(
                      alpha: 0.05 + 0.05 * swell,
                    ),
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
