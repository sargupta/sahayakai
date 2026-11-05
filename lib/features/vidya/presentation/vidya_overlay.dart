import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import 'vidya_controller.dart';
import 'vidya_cta_clearance.dart';
import 'vidya_nav_dispatcher.dart' show topLocation;
import 'vidya_orb_placement_controller.dart';
import 'vidya_presence.dart';
import 'vidya_sheet.dart';
import 'widgets/vidya_conversation.dart';
import 'widgets/vidya_orb.dart';

/// The presence layer: mounts the draggable [VidyaOrb] above the app Navigator
/// (via `MaterialApp.router.builder`) so VIDYA floats over the tool screens
/// that push on top of the shell.
///
/// On the shell itself VIDYA is docked in the tab bar ([VidyaDockOrb], v2 9a),
/// so this orb hides there: one orb per screen, wherever it is drawn. It reads
/// the shared [vidyaOrbVisualProvider] (indigo while she works, a green badge
/// when a result is ready), owns the drag → snap → remember-per-hand behaviour
/// against [VidyaOrbPlacementController], hides on the pre-auth screens, and
/// hides whenever the [VidyaSheet] is open — Screen 04 puts the only orb inside
/// the sheet's header.
class VidyaOverlay extends StatefulWidget {
  const VidyaOverlay({super.key, required this.router});

  final GoRouter router;

  /// Sphere-anchor insets from the design (v3): parked `right: 16` for a
  /// right-handed teacher, `left: 18` for left-handed. Converted to box
  /// coordinates by subtracting the 14px halo (the sphere sits inside the box).
  static const double _sphereRight = 16;
  static const double _sphereLeft = 18;
  static const double _halo = 14;

  /// Distance from the screen edge to the orb's painted box (edge → box edge).
  static const double _edgeInsetRight = _sphereRight - _halo; // 2
  static const double _edgeInsetLeft = _sphereLeft - _halo; // 4

  /// Top-of-box inset below the safe area for the top band.
  static const double _topInset = 8;

  /// Bottom inset that clears the floating bottom nav / a screen's bottom CTA so
  /// a bottom-perched orb never sits on top of the primary action. Design parks
  /// the SPHERE at `bottom: 100` (or 172 over a full-width CTA).
  static const double _bottomInset = 100 - _halo; // 86 → sphere at 100

  /// Extra lift over a page's pinned full-width button: sphere at 172.
  static const double _ctaLift = 172 - 100;

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
    //
    // Listen to BOTH the route-information provider and the router delegate.
    // The boot-time redirect (splash -> home) is applied through the DELEGATE,
    // and the provider only picks the new value up afterwards without
    // notifying — a listener on the provider alone never re-runs after splash,
    // which leaves the orb hidden on the home screen until the next manual
    // navigation. The location is read from the delegate, which holds the
    // applied configuration synchronously with its notification.
    return ListenableBuilder(
      listenable: Listenable.merge([
        widget.router.routeInformationProvider,
        widget.router.routerDelegate,
      ]),
      builder: (context, _) {
        // The screen ON TOP: a pushed route (a tool, Settings…) does not
        // change the router's `uri`, which still names the shell underneath,
        // so reading `uri` hid the orb on every pushed screen.
        final applied = topLocation(widget.router);
        // Before the delegate's initial route lands the match list is empty;
        // fall back to the provider so the first frame still sees splash.
        final location = applied.isEmpty
            ? widget.router.routeInformationProvider.value.uri.path
            : applied;
        return Consumer(
          builder: (context, ref, _) {
            final signedIn =
                ref.watch(authControllerProvider) == AuthStatus.signedIn;
            // The sheet owns the orb while it is open (v3 Screen 04).
            final sheetOpen = ref.watch(vidyaSheetOpenProvider);

            final status = ref.watch(
              vidyaControllerProvider.select((s) => s.status),
            );
            final placement = ref.watch(vidyaOrbPlacementControllerProvider);
            final placementNotifier = ref.read(
              vidyaOrbPlacementControllerProvider.notifier,
            );
            final readyCount = ref.watch(vidyaReadyCountProvider);
            final visual = ref.watch(vidyaOrbVisualProvider);

            if (sheetOpen || !_visibleAt(location, signedIn)) {
              return const SizedBox.shrink();
            }

            final media = MediaQuery.of(context);
            final screen = media.size;
            // Everything the orb must clear at the bottom: the safe area, the
            // keyboard while the teacher types, and a page's pinned
            // full-width button (the map parks the sphere at 172 over one,
            // not 100). Folded into one inset so parking, dragging and the
            // perch guides all agree.
            final hasCta =
                (ref.watch(vidyaCtaRoutesProvider)[location] ?? 0) > 0;
            final pad = media.padding.copyWith(
              bottom:
                  media.padding.bottom +
                  media.viewInsets.bottom +
                  (hasCta ? VidyaOverlay._ctaLift : 0),
            );
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
                // A conversation going on: "Mic on · End" just above the orb,
                // aligned to its side of the screen.
                if (!placement.dragging)
                  Positioned(
                    left: placement.hand == VidyaHand.left ? at.dx : null,
                    right: placement.hand == VidyaHand.left
                        ? null
                        : screen.width - (at.dx + box),
                    bottom: screen.height - at.dy - 4,
                    child: const VidyaMicOnCapsule(),
                  ),
                // Parking animates; dragging tracks the finger 1:1 (no lag).
                AnimatedPositioned(
                  duration: placement.dragging
                      ? Duration.zero
                      : AppMotion.medium,
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
                      final centre = released + const Offset(box / 2, box / 2);
                      placementNotifier.endDrag(
                        _nearestPerch(centre, screen, pad),
                      );
                    },
                    onPanCancel: () {
                      setState(() => _dragTopLeft = null);
                      placementNotifier.cancelDrag();
                    },
                    child: VidyaOrb(
                      state: visual,
                      readyCount: readyCount,
                      semanticLabel: context.l10n.appTitle,
                      semanticHint: vidyaOrbHintFor(context, visual, status),
                      onTap: () => openVidyaFromOrb(
                        _sheetContext,
                        ref,
                        visual,
                        location,
                      ),
                      onLongPress: () {
                        HapticFeedback.lightImpact();
                        showVidyaSheet(_sheetContext, pagePath: location);
                      },
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
  /// shell (`/`), where VIDYA is docked in the tab bar.
  bool _visibleAt(String location, bool signedIn) {
    if (!signedIn) return false;
    const owned = {Routes.splash, Routes.login, Routes.onboarding, Routes.home};
    return !owned.contains(location);
  }

  // ── Interaction ────────────────────────────────────────────────────────────

  /// A [BuildContext] that can actually push a modal route.
  ///
  /// This overlay is mounted as a SIBLING of the app [Navigator] (inside
  /// `MaterialApp.router`'s `builder` Stack), so its own [context] has NO
  /// [Navigator] ancestor. Calling `showModalBottomSheet` with that context
  /// throws "No Navigator found" — and because [showVidyaSheet] /
  /// [showDeliverTray] set `vidyaSheetOpenProvider` to true *before* the
  /// `showModalBottomSheet` call, a failure there permanently latched the orb
  /// off (the orb hides while `sheetOpen` is true, and the unawaited rejection
  /// never ran the `.whenComplete` reset). Routing both sheet pushes through
  /// the GoRouter's navigator — whose own context resolves via
  /// `Navigator.of`'s StatefulElement self-check — fixes it. Falls back to the
  /// overlay context if the Navigator hasn't been built yet (first frame).
  BuildContext get _sheetContext {
    final nav = widget.router.routerDelegate.navigatorKey.currentContext;
    return nav ?? context;
  }

  // ── Geometry ─────────────────────────────────────────────────────────────

  /// Keeps the whole box on-screen within the safe area.
  Offset _clampBox(Offset topLeft, Size screen, EdgeInsets pad) {
    final minX = pad.left + VidyaOverlay._edgeInsetLeft;
    final maxX =
        screen.width -
        pad.right -
        VidyaOverlay._edgeInsetRight -
        VidyaOverlay._box;
    final minY = pad.top + VidyaOverlay._topInset;
    final maxY =
        screen.height -
        pad.bottom -
        VidyaOverlay._box -
        VidyaOverlay._bottomInset;
    return Offset(
      topLeft.dx.clamp(minX, maxX < minX ? minX : maxX),
      topLeft.dy.clamp(minY, maxY < minY ? minY : maxY),
    );
  }

  /// The box top-left for [perch] on this screen.
  Offset _boxTopLeft(VidyaPerch perch, Size screen, EdgeInsets pad) {
    final x = perch.isLeft
        ? pad.left + VidyaOverlay._edgeInsetLeft
        : screen.width -
              pad.right -
              VidyaOverlay._edgeInsetRight -
              VidyaOverlay._box;
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
    final hand = centre.dx < screen.width / 2
        ? VidyaHand.left
        : VidyaHand.right;
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
          ? pad.left + VidyaOverlay._edgeInsetLeft
          : screen.width -
                pad.right -
                VidyaOverlay._edgeInsetRight -
                VidyaOverlay._box;
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
