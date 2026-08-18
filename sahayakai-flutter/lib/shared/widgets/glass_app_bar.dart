import 'package:flutter/material.dart';

import 'glass_surface.dart';

/// Chrome `AppBar` wrapper — App-wide Glassmorphism Reskin, GL-2.
///
/// Wraps Flutter's [AppBar] so it renders on glass instead of a flat surface
/// fill: transparent + no elevation, with a [GlassSurface] filling
/// `flexibleSpace` behind the title/leading/actions.
///
/// Uses [GlassSurface.flat] (no `BackdropFilter`), NOT the real-blur
/// constructor — the GL-2 design review found none of this app's ~16 app-bar
/// screens set `extendBodyBehindAppBar: true` (confirmed: zero hits app-wide
/// for that flag), so a `Scaffold`'s `body` never actually scrolls behind
/// the app bar by default; the bar composites against a static background.
/// A real `BackdropFilter` there would pay a genuine per-frame `saveLayer` +
/// GPU blur cost for a result visually indistinguishable from the flat
/// path — exactly the "real blur only where something actually passes
/// underneath it" discipline GL-1's own docs establish, applied here rather
/// than violated. [FloatingBottomNav] is the opposite, correct case: it
/// genuinely floats over scrolling/sheet content, so its blur earns its
/// cost.
///
/// Forwards only the [AppBar] parameters this app's ~16 call sites actually
/// use (`title`, `actions`, `leading`, `automaticallyImplyLeading` — verified
/// via `grep -rn "AppBar(" lib` before writing this), not a speculative full
/// passthrough API. Add a parameter here only once a real call site needs it.
///
/// A zero radius — an `AppBar`'s `flexibleSpace` sits BEHIND its content and
/// is a plain rectangle spanning the full top edge, not a floating rounded
/// panel, so this uses a plain rect glass surface rather than the squircle
/// chrome shape used by [FloatingBottomNav]/sheets/the dialog.
/// `AppGlass.squircle` (via `GlassSurface`) degenerates a zero radius
/// cleanly to a plain rect border — verified in `glass_surface_test.dart`'s
/// pattern of exercising `GlassSurface` at arbitrary radii; no exception.
///
/// `addSheen: false` — the diagonal corner sheen is tuned for a compact
/// floating panel (nav bar, sheet, the floating bottom nav's squircle
/// panel); stretched across the full app-bar width it would read as a
/// horizontal stripe rather than a corner glow, so it is switched off for
/// this specific chrome surface.
class GlassAppBar extends StatelessWidget implements PreferredSizeWidget {
  const GlassAppBar({
    super.key,
    required this.title,
    this.actions,
    this.leading,
    this.automaticallyImplyLeading = true,
  });

  final Widget title;
  final List<Widget>? actions;
  final Widget? leading;
  final bool automaticallyImplyLeading;

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      // No tint shift when content scrolls underneath: the glass panel's own
      // translucent fill is the entire visual language here, so the M3
      // scroll-under elevation tint (which would otherwise blend into the
      // transparent background) is turned off rather than fighting it.
      scrolledUnderElevation: 0,
      title: title,
      actions: actions,
      leading: leading,
      automaticallyImplyLeading: automaticallyImplyLeading,
      flexibleSpace: const GlassSurface.flat(
        radius: 0,
        addSheen: false,
        child: SizedBox.expand(),
      ),
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}
