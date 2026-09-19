import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import 'vidya_controller.dart';
import 'vidya_orb_placement_controller.dart';
import 'widgets/vidya_orb.dart';

/// The presence layer: mounts the draggable [VidyaOrb] above the app Navigator
/// (via `MaterialApp.router.builder`) so VIDYA floats over EVERY route — the
/// tool screens push on top of the shell, so an orb inside the shell would not
/// ride over them; this one does (v3 "VIDYA floats over everything").
///
/// It reads the live [VidyaController] phase (so the orb turns indigo while she
/// works and shows a green badge when a result is ready), owns the drag → snap →
/// remember-per-hand behaviour against [VidyaOrbPlacementController], and stays
/// out of the way where VIDYA already has a home: it is hidden on the pre-auth
/// screens and on the voice home itself, where the [SealMic] hero is the mic.
class VidyaOverlay extends StatefulWidget {
  const VidyaOverlay({super.key, required this.router});

  final GoRouter router;

  /// Distance from the screen edge to the orb's painted box.
  static const double _edgeInset = 6;

  /// Top-of-box inset below the safe area for the top band.
  static const double _topInset = 8;

  /// Bottom inset that clears the floating bottom nav / a screen's bottom CTA so
  /// a bottom-perched orb never sits on top of the primary action.
  static const double _bottomInset = 96;

  /// The orb's painted box: sphere (56) + halo (14) on each side. Matches
  /// [VidyaOrb]'s own footprint so a perch anchor positions the sphere true.
  static const double _box = 56 + 14 * 2;

  @override
  State<VidyaOverlay> createState() => _VidyaOverlayState();
}

class _VidyaOverlayState extends State<VidyaOverlay> {
  /// While a drag is live, the free box-top-left following the finger. Null when
  /// the orb is parked (it then sits at its perch anchor).
  Offset? _dragTopLeft;

  @override
  Widget build(BuildContext context) {
    // Rebuild on navigation so the visibility gate re-evaluates per route.
    return ValueListenableBuilder<RouteInformation>(
      valueListenable: widget.router.routeInformationProvider,
      builder: (context, info, _) {
        return Consumer(
          builder: (context, ref, _) {
            final signedIn =
                ref.watch(authControllerProvider) == AuthStatus.signedIn;
            if (!_visibleAt(info.uri.path, signedIn)) {
              return const SizedBox.shrink();
            }

            // Only the phase drives the orb — not the per-frame amplitude, which
            // would rebuild the overlay on every listening tick.
            final status =
                ref.watch(vidyaControllerProvider.select((s) => s.status));
            final placement = ref.watch(vidyaOrbPlacementControllerProvider);
            final placementNotifier =
                ref.read(vidyaOrbPlacementControllerProvider.notifier);
            final visual = _visualFor(status, placement);

            final media = MediaQuery.of(context);
            final screen = media.size;
            final pad = media.padding;
            const box = VidyaOverlay._box;

            final parked = _boxTopLeft(placement.perch, screen, pad);
            final at = _dragTopLeft ?? parked;

            return Stack(
              // The orb sits near the screen edges; its glow/badge/halo must not
              // be clipped to the stack bounds.
              clipBehavior: Clip.none,
              children: [
                if (placement.dragging)
                  Positioned.fill(
                    child: IgnorePointer(
                      child: _PerchGuides(screen: screen, pad: pad),
                    ),
                  ),
                // Parking animates; dragging tracks the finger 1:1 (no lag).
                AnimatedPositioned(
                  duration:
                      placement.dragging ? Duration.zero : AppMotion.medium,
                  curve: AppMotion.easeOutQuart,
                  left: at.dx,
                  top: at.dy,
                  width: box,
                  height: box,
                  child: GestureDetector(
                    behavior: HitTestBehavior.deferToChild,
                    onPanStart: (_) {
                      placementNotifier.beginDrag();
                      setState(() => _dragTopLeft = parked);
                    },
                    onPanUpdate: (d) {
                      final base = _dragTopLeft ?? parked;
                      setState(
                        () => _dragTopLeft = _clampBox(
                          base + d.delta,
                          screen,
                          pad,
                        ),
                      );
                    },
                    onPanEnd: (_) {
                      final released = _dragTopLeft;
                      setState(() => _dragTopLeft = null);
                      if (released == null) {
                        placementNotifier.cancelDrag();
                        return;
                      }
                      final centre =
                          released + const Offset(box / 2, box / 2);
                      placementNotifier
                          .endDrag(_nearestPerch(centre, screen, pad));
                    },
                    onPanCancel: () {
                      setState(() => _dragTopLeft = null);
                      placementNotifier.cancelDrag();
                    },
                    child: VidyaOrb(
                      state: visual,
                      readyCount: placement.readyCount,
                      semanticLabel: context.l10n.appTitle,
                      semanticHint: _hintFor(context, visual, status),
                      onTap: () => _onTap(ref, visual),
                    ),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // ── Visibility ─────────────────────────────────────────────────────────────

  /// The orb shows only when signed in and away from the surfaces that own their
  /// own VIDYA affordance or predate auth: splash, login, onboarding, and the
  /// voice home (`/`), where the SealMic hero is the mic.
  bool _visibleAt(String location, bool signedIn) {
    if (!signedIn) return false;
    const hidden = {Routes.splash, Routes.login, Routes.onboarding, Routes.home};
    return !hidden.contains(location);
  }

  // ── State mapping ────────────────────────────────────────────────────────

  VidyaOrbVisual _visualFor(VidyaStatus status, VidyaOrbPlacement placement) {
    if (placement.dragging) return VidyaOrbVisual.dragging;
    switch (status) {
      case VidyaStatus.requestingPermission:
      case VidyaStatus.listening:
        return VidyaOrbVisual.listening;
      case VidyaStatus.transcribing:
      case VidyaStatus.thinking:
      case VidyaStatus.speaking:
        return VidyaOrbVisual.working;
      case VidyaStatus.idle:
      case VidyaStatus.micDenied:
      case VidyaStatus.signedOut:
      case VidyaStatus.limitReached:
      case VidyaStatus.failed:
        return placement.readyCount > 0
            ? VidyaOrbVisual.ready
            : VidyaOrbVisual.resting;
    }
  }

  String _hintFor(BuildContext context, VidyaOrbVisual visual, VidyaStatus s) {
    final l10n = context.l10n;
    switch (visual) {
      case VidyaOrbVisual.listening:
        return l10n.vidyaStateListening;
      case VidyaOrbVisual.working:
        return s == VidyaStatus.speaking
            ? l10n.vidyaStateSpeaking
            : l10n.vidyaStateThinking;
      case VidyaOrbVisual.ready:
        return l10n.vidyaStateReady;
      case VidyaOrbVisual.dragging:
      case VidyaOrbVisual.resting:
        return l10n.vidyaStateIdle;
    }
  }

  // ── Interaction ────────────────────────────────────────────────────────────

  void _onTap(WidgetRef ref, VidyaOrbVisual visual) {
    if (visual == VidyaOrbVisual.ready) {
      // Acknowledge the waiting results; a later unit routes to the deliver tray.
      ref.read(vidyaOrbPlacementControllerProvider.notifier).clearReady();
      return;
    }
    ref.read(vidyaControllerProvider.notifier).onMicTap();
  }

  // ── Geometry ─────────────────────────────────────────────────────────────

  /// Keeps the whole box on-screen within the safe area.
  Offset _clampBox(Offset topLeft, Size screen, EdgeInsets pad) {
    final minX = pad.left + VidyaOverlay._edgeInset;
    final maxX =
        screen.width - pad.right - VidyaOverlay._edgeInset - VidyaOverlay._box;
    final minY = pad.top + VidyaOverlay._topInset;
    final maxY =
        screen.height - pad.bottom - VidyaOverlay._box - VidyaOverlay._edgeInset;
    return Offset(
      topLeft.dx.clamp(minX, maxX < minX ? minX : maxX),
      topLeft.dy.clamp(minY, maxY < minY ? minY : maxY),
    );
  }

  /// The box top-left for [perch] on this screen.
  Offset _boxTopLeft(VidyaPerch perch, Size screen, EdgeInsets pad) {
    final x = perch.isLeft
        ? pad.left + VidyaOverlay._edgeInset
        : screen.width - pad.right - VidyaOverlay._edgeInset - VidyaOverlay._box;
    return Offset(x, _bandTop(perch.band, screen, pad));
  }

  double _bandTop(VidyaPerchBand band, Size screen, EdgeInsets pad) {
    switch (band) {
      case VidyaPerchBand.top:
        return pad.top + VidyaOverlay._topInset;
      case VidyaPerchBand.mid:
        return (screen.height - VidyaOverlay._box) / 2;
      case VidyaPerchBand.bottom:
        return screen.height -
            pad.bottom -
            VidyaOverlay._bottomInset -
            VidyaOverlay._box;
    }
  }

  /// The perch whose anchor is nearest [centre] — side by the screen midline,
  /// band by the closest of the three band anchors.
  VidyaPerch _nearestPerch(Offset centre, Size screen, EdgeInsets pad) {
    final hand =
        centre.dx < screen.width / 2 ? VidyaHand.left : VidyaHand.right;
    var best = VidyaPerchBand.mid;
    var bestDist = double.infinity;
    for (final band in VidyaPerchBand.values) {
      final anchorY = _bandTop(band, screen, pad) + VidyaOverlay._box / 2;
      final dist = (anchorY - centre.dy).abs();
      if (dist < bestDist) {
        bestDist = dist;
        best = band;
      }
    }
    return VidyaPerch.of(hand, best);
  }
}

/// The six dashed snap targets shown only while dragging (v3 screen 03), painted
/// behind the orb and non-interactive.
class _PerchGuides extends StatelessWidget {
  const _PerchGuides({required this.screen, required this.pad});

  final Size screen;
  final EdgeInsets pad;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    const box = VidyaOverlay._box;
    const marker = 46.0;
    final guides = <Widget>[];
    for (final perch in VidyaPerch.values) {
      final x = perch.isLeft
          ? pad.left + VidyaOverlay._edgeInset
          : screen.width - pad.right - VidyaOverlay._edgeInset - box;
      final double y;
      switch (perch.band) {
        case VidyaPerchBand.top:
          y = pad.top + VidyaOverlay._topInset;
        case VidyaPerchBand.mid:
          y = (screen.height - box) / 2;
        case VidyaPerchBand.bottom:
          y = screen.height - pad.bottom - VidyaOverlay._bottomInset - box;
      }
      guides.add(
        Positioned(
          left: x + (box - marker) / 2,
          top: y + (box - marker) / 2,
          width: marker,
          height: marker,
          child: _DottedCircle(color: scheme.primary.withValues(alpha: 0.4)),
        ),
      );
    }
    return Stack(children: guides);
  }
}

/// A 2px dashed ring — the empty perch marker. Local to the overlay because it
/// exists only for the drag affordance.
class _DottedCircle extends StatelessWidget {
  const _DottedCircle({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _DottedCirclePainter(color));
  }
}

class _DottedCirclePainter extends CustomPainter {
  _DottedCirclePainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..color = color;
    final centre = size.center(Offset.zero);
    final radius = size.shortestSide / 2 - 1;
    const dashes = 16;
    const gapFraction = 0.45;
    const twoPi = 6.283185307179586;
    const step = twoPi / dashes;
    for (var i = 0; i < dashes; i++) {
      canvas.drawArc(
        Rect.fromCircle(center: centre, radius: radius),
        i * step,
        step * (1 - gapFraction),
        false,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_DottedCirclePainter old) => old.color != color;
}
