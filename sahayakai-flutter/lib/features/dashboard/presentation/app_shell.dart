import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../library/presentation/library_screen.dart';
import '../../profile/presentation/me_screen.dart';
import '../../staffroom/presentation/network_hub_screen.dart';
import '../../vidya/presentation/vidya_home_screen.dart';
import '../../vidya/presentation/vidya_orb_placement_controller.dart';
import 'app_tab_bar.dart';
import 'shell_tab_controller.dart';

/// The signed-in shell: the design-system-v2 [AppTabBar] over four tabs —
/// Home, Library, Community, Profile — never five.
///
/// Home is the voice-first VIDYA canvas. Creation is not a tab: VIDYA starts
/// it from any screen (the SealMic on Home, the orb everywhere else), and the
/// searchable tool palette that used to sit behind a Create slot now opens
/// from the Prep desk (`create_palette.dart`). Community is the Network hub
/// (Staffroom feed, Pro Inbox, Updates), which used to be reachable only from
/// Home's app bar; that entry stays.
///
/// The body is an [IndexedStack] so Home, Library and Profile stay warm (the
/// shared library read serves both surfaces in one request, and off-screen
/// peers never slide). Community is built on its first visit and kept warm
/// after, so its live feeds do not open at app start for a teacher who never
/// visits it — the same moment they opened before it was a tab. Switching
/// tabs plays a fresh cross-fade + rise on the newly-shown tab via
/// [_AnimatedTabBody], guarded by reduce-motion.
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  /// Tabs built so far; Community joins on its first visit.
  final Set<AppTab> _built = {AppTab.home, AppTab.library, AppTab.profile};

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    // The current tab lives in [shellTabControllerProvider] so the VIDYA
    // overlay (above the Navigator) can tell Home from the other tabs, which
    // all share the `/` route.
    final tab = ref.watch(shellTabControllerProvider);

    Widget page(AppTab tab, Widget Function() build) =>
        _built.contains(tab) ? build() : const SizedBox.shrink();

    final pages = <Widget>[
      page(AppTab.home, () => const VidyaHomeScreen()),
      page(AppTab.library, () => const LibraryScreen()),
      page(AppTab.community, () => const NetworkHubScreen()),
      // U-OS1 — the profile tab is the operating-system hub, which composes
      // the profile summary, plan & usage, defaults and settings links. The
      // full profile editor ([ProfileScreen]) is one tap away.
      page(AppTab.profile, () => const MeScreen()),
    ];

    return Scaffold(
      body: _AnimatedTabBody(index: tab.index, children: pages),
      bottomNavigationBar: AppTabBar(
        current: tab,
        // While VIDYA's orb is dragged the bar dims (v2 TabBar `dimmed`).
        dimmed: ref.watch(
          vidyaOrbPlacementControllerProvider.select((p) => p.dragging),
        ),
        labels: {
          AppTab.home: l10n.navHome,
          AppTab.library: l10n.navLibrary,
          AppTab.community: l10n.navCommunity,
          AppTab.profile: l10n.navProfile,
        },
        onSelected: _onSelect,
      ),
    );
  }

  void _onSelect(AppTab tab) {
    setState(() => _built.add(tab));
    ref.read(shellTabControllerProvider.notifier).select(tab);
  }
}

/// The shell body: an [IndexedStack] (every built tab stays mounted, so the
/// shared library read serves Home and the Library tab in one request and
/// off-screen peers keep their state and never slide) wrapped in a one-shot
/// cross-fade + rise that replays whenever the selected tab changes — the
/// "fresh content entrance" of PREMIUM_DESIGN_SPEC.md §4/§5, reusing the
/// `staggeredItem` recipe (fade + moveY, `small`/`standard`). Under reduce-motion
/// it renders the final composed frame instantly.
class _AnimatedTabBody extends StatefulWidget {
  const _AnimatedTabBody({required this.index, required this.children});

  final int index;
  final List<Widget> children;

  @override
  State<_AnimatedTabBody> createState() => _AnimatedTabBodyState();
}

class _AnimatedTabBodyState extends State<_AnimatedTabBody>
    with SingleTickerProviderStateMixin {
  // Created eagerly in initState, NOT as a lazy `late final`: under reduce-motion
  // build() returns before ever touching it, so a lazy field would first
  // initialize inside dispose() — which creates a Ticker and looks up TickerMode
  // on a deactivated element, and Flutter throws. Eager init keeps dispose safe.
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: AppMotion.small,
      // Start settled: the first tab does its own entrance; only SWITCHING
      // replays this one.
      value: 1,
    );
  }

  @override
  void didUpdateWidget(_AnimatedTabBody old) {
    super.didUpdateWidget(old);
    if (old.index != widget.index) {
      if (context.motionEnabled) {
        _controller.forward(from: 0);
      } else {
        _controller.value = 1;
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final stack = IndexedStack(index: widget.index, children: widget.children);
    if (!context.motionEnabled) return stack;

    return AnimatedBuilder(
      animation: _controller,
      child: stack,
      builder: (context, child) {
        final t = AppMotion.standard.transform(_controller.value);
        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, (1 - t) * 12),
            child: child,
          ),
        );
      },
    );
  }
}
