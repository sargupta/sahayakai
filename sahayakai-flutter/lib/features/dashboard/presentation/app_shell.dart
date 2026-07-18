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
import '../../profile/presentation/profile_screen.dart';
import 'dashboard_screen.dart';
import 'floating_bottom_nav.dart';

/// The signed-in shell: the premium floating bottom navigation ([U9]) over 4
/// tabs (Home / Create / Library / Me). "Create" is an action — it opens the
/// searchable Create (command) palette rather than switching tabs, so the
/// selected index never lands on it and its pill never lights. See
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
      const DashboardScreen(),
      const SizedBox.shrink(),
      const LibraryScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: _AnimatedTabBody(index: _index, children: pages),
      bottomNavigationBar: FloatingBottomNav(
        currentIndex: _index,
        onSelected: _onSelect,
        items: [
          FloatingNavItem(icon: LucideIcons.home, label: l10n.navHome),
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
      showDragHandle: true,
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
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: AppMotion.small,
    // Start settled: the first tab does its own entrance; only SWITCHING replays
    // this one.
    value: 1,
  );

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
/// on which tools exist. The sheet's chrome (radius-12 top corners,
/// surfaceTint-transparent, shadow) comes from `bottomSheetTheme`; the height is
/// bounded here (a min-height [Column] with the list in a [Flexible]) so the
/// list scrolls inside the sheet rather than the sheet growing without limit.
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

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;

    final query = _fold(_query);
    final tools = query.isEmpty
        ? kToolRegistry
        : [
            for (final tool in kToolRegistry)
              if (_fold(tool.title(l10n)).contains(query)) tool,
          ];

    return SafeArea(
      // Lift the whole sheet above the keyboard so the focused search field is
      // never hidden behind it (DESIGN_RUBRIC §9).
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
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
                  Text(l10n.navCreate, style: text.titleMedium),
                  const SizedBox(height: AppSpacing.space3),
                  TextField(
                    controller: _controller,
                    textInputAction: TextInputAction.search,
                    onChanged: (value) => setState(() => _query = value),
                    // The themed input styling (radius, saffron focus ring,
                    // Indic fallback) comes from `inputDecorationTheme`; only the
                    // palette-specific affordances are set here.
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
