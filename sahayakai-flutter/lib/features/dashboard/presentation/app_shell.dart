import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/tool_registry.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/icon_well.dart';
import '../../library/presentation/library_screen.dart';
import '../../profile/presentation/me_screen.dart';
import '../../vidya/presentation/vidya_home_screen.dart';
import 'floating_bottom_nav.dart';

/// The signed-in shell: the premium floating bottom navigation ([U9]) over 4
/// tabs (Home / Create / Library / Me). Home is now the voice-first VIDYA canvas
/// ("The Almanac Speaks"), not the form-first dashboard — the founder's #1
/// correction. The teaching-tools grid (Prep desk) is one tap away from the
/// VIDYA home's app bar and still in the Create palette. "Create" is an action —
/// it opens the searchable Create (command) palette rather than switching tabs,
/// so the selected index never lands on it and its pill never lights. See
/// PREMIUM_DESIGN_SPEC.md §5 ("Bottom nav — floating").
///
/// The body is an [IndexedStack] (every tab stays warm, so the shared library
/// read serves both surfaces in one request and off-screen peers never slide);
/// switching tabs plays a fresh cross-fade + rise on the newly-shown tab via
/// [_AnimatedTabBody], guarded by reduce-motion.
///
/// A later unit can convert this to a StatefulShellRoute for deep-linkable tabs.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  static const _createIndex = 1;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    // index 1 (Create) is an action, so its stack slot is never shown.
    final pages = <Widget>[
      const VidyaHomeScreen(),
      const SizedBox.shrink(),
      const LibraryScreen(),
      // U-OS1 — the Me tab is now the operating-system hub, which composes the
      // profile summary, plan & usage, defaults and settings links. The full
      // profile editor ([ProfileScreen]) is one tap away, at `Routes.profile`.
      const MeScreen(),
    ];

    return Scaffold(
      body: _AnimatedTabBody(index: _index, children: pages),
      bottomNavigationBar: FloatingBottomNav(
        currentIndex: _index,
        onSelected: _onSelect,
        items: [
          // Home is the voice-first VIDYA canvas — a mic, not a house.
          FloatingNavItem(icon: LucideIcons.mic, label: l10n.navHome),
          FloatingNavItem(
            icon: LucideIcons.sparkles,
            label: l10n.navCreate,
            isAction: true,
          ),
          FloatingNavItem(icon: LucideIcons.library, label: l10n.navLibrary),
          FloatingNavItem(icon: LucideIcons.user, label: l10n.navProfile),
        ],
      ),
    );
  }

  void _onSelect(int index) {
    if (index == _createIndex) {
      _openCreatePalette();
      return;
    }
    setState(() => _index = index);
  }

  Future<void> _openCreatePalette() async {
    await showModalBottomSheet<void>(
      context: context,
      // The sheet hosts its own premium surface (rHero top corners + the e4
      // modal shadow, §5), so the modal route stays transparent and draws no
      // Material of its own. [_CreatePalette] carries its own grab handle.
      backgroundColor: Colors.transparent,
      elevation: 0,
      // The sheet carries a search field: it must be free to grow past the
      // default 9/16-screen cap and to lift above the keyboard. [_CreatePalette]
      // bounds its own height and scrolls its list inside that bound, so this
      // never becomes an unbounded list in an unbounded sheet.
      isScrollControlled: true,
      builder: (_) => const _CreatePalette(),
    );
  }
}

/// The shell body: an [IndexedStack] (every tab stays mounted, so the shared
/// library read serves the dashboard and the Library tab in one request and
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

/// The Create (command) palette: a search field over the shared [kToolRegistry],
/// each row deep-linking into its tool. Reached from the shell's Create action.
///
/// It walks the SAME registry the dashboard grid does, so the two always agree
/// on which tools exist. It is a premium floating sheet (§5): it draws its own
/// surface with rHero top corners and the e4 modal shadow (dark uses the black
/// key shadow), a serif masthead, and its own grab handle. The height is bounded
/// here (a min-height [Column] with the list in a [Flexible]) so the list
/// scrolls inside the sheet rather than the sheet growing without limit.
class _CreatePalette extends StatefulWidget {
  const _CreatePalette();

  @override
  State<_CreatePalette> createState() => _CreatePaletteState();
}

class _CreatePaletteState extends State<_CreatePalette> {
  final TextEditingController _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Case- (and, for Latin, diacritic-) folding so "quiz", "QUIZ" and a stray
  /// leading space all match. Indic scripts are caseless, so `toLowerCase` is a
  /// no-op there and `contains` matches on the raw glyphs.
  static String _fold(String s) => s.trim().toLowerCase();

  /// The sheet's own top-corner radius (rHero 20) — used by both the shadow
  /// carrier and the clip so the surface and its ripple share one edge. Derived
  /// from the `AppRadius.rHero` token (top corners only; the bottom sits at the
  /// screen edge) rather than an off-token literal.
  static final BorderRadius _sheetRadius = BorderRadius.only(
    topLeft: AppRadius.rHero.topLeft,
    topRight: AppRadius.rHero.topRight,
  );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final text = theme.textTheme;
    final scheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;

    final query = _fold(_query);
    final tools = query.isEmpty
        ? kToolRegistry
        : [
            for (final tool in kToolRegistry)
              if (_fold(tool.title(l10n)).contains(query)) tool,
          ];

    // Lift the whole sheet above the keyboard so the focused search field is
    // never hidden behind it (DESIGN_RUBRIC §9).
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: DecoratedBox(
        // The premium floating surface (§5): rHero top corners + the e4 modal
        // shadow in light; the black key shadow in dark.
        decoration: BoxDecoration(
          color: scheme.surface,
          borderRadius: _sheetRadius,
          boxShadow: isDark ? AppShadows.dKey : AppShadows.e4,
        ),
        child: ClipRRect(
          borderRadius: _sheetRadius,
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // A slim grab handle — the sheet hosts its own chrome now.
                Padding(
                  padding: const EdgeInsets.only(
                    top: AppSpacing.space3,
                    bottom: AppSpacing.space1,
                  ),
                  child: Center(
                    child: Container(
                      width: 36,
                      height: 4,
                      decoration: ShapeDecoration(
                        color: scheme.outlineVariant,
                        shape: const StadiumBorder(),
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.space4,
                    AppSpacing.space2,
                    AppSpacing.space4,
                    AppSpacing.space3,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Serif masthead (Fraunces titleLarge) over the search.
                      Text(l10n.navCreate, style: text.titleLarge),
                      const SizedBox(height: AppSpacing.space3),
                      TextField(
                        controller: _controller,
                        textInputAction: TextInputAction.search,
                        onChanged: (value) => setState(() => _query = value),
                        // The themed input styling (radius, saffron focus ring,
                        // Indic fallback) comes from `inputDecorationTheme`; only
                        // the palette-specific affordances are set here.
                        decoration: InputDecoration(
                          hintText: l10n.createPaletteSearchHint,
                          prefixIcon: Icon(
                            LucideIcons.search,
                            size: AppIconSize.inline,
                            color: scheme.onSurfaceVariant,
                          ),
                          suffixIcon: _query.isEmpty
                              ? null
                              : IconButton(
                                  icon: const Icon(
                                    LucideIcons.x,
                                    size: AppIconSize.inline,
                                  ),
                                  color: scheme.onSurfaceVariant,
                                  tooltip: MaterialLocalizations.of(context)
                                      .deleteButtonTooltip,
                                  onPressed: () => setState(() {
                                    _controller.clear();
                                    _query = '';
                                  }),
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (tools.isEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.space4,
                      AppSpacing.space2,
                      AppSpacing.space4,
                      AppSpacing.space6,
                    ),
                    child: EmptyView(
                      icon: LucideIcons.searchX,
                      message: l10n.createPaletteEmpty,
                    ),
                  )
                else
                  Flexible(
                    child: ListView.builder(
                      shrinkWrap: true,
                      padding: const EdgeInsets.only(bottom: AppSpacing.space4),
                      itemCount: tools.length,
                      itemBuilder: (context, index) =>
                          _CreatePaletteRow(tool: tools[index]),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// One tool row in the palette: the shared [IconWell], the localized name and
/// description, deep-linking into the tool's route and closing the sheet. Rows
/// are ListTiles, so each is comfortably past the 48dp touch floor.
class _CreatePaletteRow extends StatelessWidget {
  const _CreatePaletteRow({required this.tool});

  final ToolEntry tool;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return ListTile(
      key: ValueKey('create-palette-${tool.id}'),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space4,
        vertical: AppSpacing.space2,
      ),
      leading: IconWell(icon: tool.icon),
      title: Text(tool.title(l10n), style: text.titleMedium),
      subtitle: Text(
        tool.subtitle(l10n),
        style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
      ),
      trailing: Icon(
        LucideIcons.chevronRight,
        size: AppIconSize.inline,
        color: scheme.onSurfaceVariant,
      ),
      onTap: () {
        // Capture the router before the sheet pops: after the pop this row's
        // element is defunct, so `context.push` off it would look up a disposed
        // navigator.
        final router = GoRouter.of(context);
        Navigator.of(context).pop();
        router.push(tool.route);
      },
    );
  }
}
