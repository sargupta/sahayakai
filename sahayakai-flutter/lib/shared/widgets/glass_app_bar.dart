import 'package:flutter/material.dart';

/// Chrome `AppBar` wrapper for design system v2: a transparent bar with no
/// elevation and no fill, so the title sits straight on the screen wash as
/// the v2 ScreenHeader does.
///
/// Forwards only the [AppBar] parameters this app's ~16 call sites actually
/// use (`title`, `actions`, `leading`, `automaticallyImplyLeading` — verified
/// via `grep -rn "AppBar(" lib` before writing this), not a speculative full
/// passthrough API. Add a parameter here only once a real call site needs it.
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
      // No bar fill: the v2 ScreenHeader is the title set straight on the
      // screen wash, and the body never scrolls under this bar (no screen
      // sets `extendBodyBehindAppBar`), so a fill would only draw a band
      // across the wash.
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}
