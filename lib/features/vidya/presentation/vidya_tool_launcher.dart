import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'vidya_controller.dart';
import 'vidya_nav_dispatcher.dart';
import 'vidya_sheet.dart';

/// Carries out VIDYA's tool directives wherever the teacher is. In a
/// conversation VIDYA keeps listening after she opens a tool, with her sheet
/// closed: "make a worksheet on photosynthesis", then "make it for Class 5",
/// then "now a quiz on it" all land here and open, re-run or switch the tool.
/// While her sheet is open it routes them itself (it closes first).
///
/// Also keeps VIDYA's screen context true: once the teacher leaves the tool
/// she opened, she stops reasoning about it.
///
/// Mounted once, above the app's Navigator (`MaterialApp.router.builder`).
class VidyaToolLauncher extends ConsumerStatefulWidget {
  const VidyaToolLauncher({
    super.key,
    required this.router,
    required this.child,
  });

  final GoRouter router;
  final Widget child;

  @override
  ConsumerState<VidyaToolLauncher> createState() => _VidyaToolLauncherState();
}

class _VidyaToolLauncherState extends ConsumerState<VidyaToolLauncher> {
  @override
  void initState() {
    super.initState();
    widget.router.routerDelegate.addListener(_onRouteChanged);
  }

  @override
  void didUpdateWidget(VidyaToolLauncher old) {
    super.didUpdateWidget(old);
    if (old.router != widget.router) {
      old.router.routerDelegate.removeListener(_onRouteChanged);
      widget.router.routerDelegate.addListener(_onRouteChanged);
    }
  }

  @override
  void dispose() {
    widget.router.routerDelegate.removeListener(_onRouteChanged);
    super.dispose();
  }

  /// The teacher left the tool VIDYA opened: forget it, and point VIDYA's
  /// screen context at where they are now. Deferred a microtask, because a
  /// route can change while the tree builds and providers must not change then.
  void _onRouteChanged() {
    scheduleMicrotask(() {
      if (!mounted) return;
      final opened = ref.read(vidyaOpenedToolProvider);
      if (opened == null) return;
      final here = topLocation(widget.router);
      if (here == opened.route) return;
      ref.read(vidyaOpenedToolProvider.notifier).state = null;
      ref.read(vidyaControllerProvider.notifier).registerScreenContext(here);
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(vidyaControllerProvider.select((s) => s.pendingNavigation), (
      _,
      directive,
    ) {
      if (directive == null) return;
      // The open sheet routes it (it has to close first).
      if (ref.read(vidyaConversationSheetOpenProvider)) return;
      final controller = ref.read(vidyaControllerProvider.notifier);
      controller.consumeNavigation();
      openVidyaTool(ref, widget.router, directive);
    });
    return widget.child;
  }
}
