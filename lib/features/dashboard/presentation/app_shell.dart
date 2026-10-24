import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/tool_registry.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/glass_surface.dart';
import '../../../shared/widgets/icon_well.dart';
import '../../library/presentation/library_screen.dart';
import '../../profile/presentation/me_screen.dart';
import '../../staffroom/presentation/network_hub_screen.dart';
import '../../vidya/presentation/vidya_home_screen.dart';
import 'floating_bottom_nav.dart';

/// The signed-in shell: 4 swipeable tabs (Home · Library · Community · You)
/// held in a [PageView] with a WhatsApp-style swipe between them. The floating
/// bottom nav indicator follows the swipe progress.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  static Future<void> openCreatePalette(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      elevation: 0,
      isScrollControlled: true,
      builder: (_) => const _CreatePalette(),
    );
  }

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  final PageController _pageController = PageController();
  int _currentIndex = 0;

  final List<Widget> _pages = const [
    VidyaHomeScreen(),
    LibraryScreen(),
    NetworkHubScreen(),
    MeScreen(),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onPageChanged(int index) {
    if (_currentIndex != index) {
      HapticFeedback.selectionClick();
      setState(() => _currentIndex = index);
    }
  }

  void _onNavTap(int index) {
    if (index == _currentIndex) return;
    _pageController.animateToPage(
      index,
      duration: AppMotion.fadeThrough,
      curve: AppMotion.easeOutQuart,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBody: true,
      body: PageView(
        controller: _pageController,
        onPageChanged: _onPageChanged,
        // Allow swipe between tabs. No wrap-around (default behavior).
        // Offscreen pages: keep 1 adjacent tab loaded.
        allowImplicitScrolling: false,
        children: _pages.map((p) => _PageWrapper(child: p)).toList(),
      ),
      bottomNavigationBar: FloatingBottomNav(
        currentIndex: _currentIndex,
        onSelected: _onNavTap,
      ),
    );
  }
}

/// Wraps each page to preserve scroll state via PageStorageKey.
class _PageWrapper extends StatelessWidget {
  const _PageWrapper({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return child;
  }
}

// _CreatePalette unchanged below
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

  static String _fold(String s) => s.trim().toLowerCase();

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

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: _sheetRadius,
          boxShadow: isDark ? AppShadows.dKey : AppShadows.e4,
        ),
        child: GlassSurface(
          borderRadius: _sheetRadius,
          padding: EdgeInsets.zero,
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
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
                      Text(l10n.navCreate, style: text.titleLarge),
                      const SizedBox(height: AppSpacing.space3),
                      TextField(
                        controller: _controller,
                        textInputAction: TextInputAction.search,
                        onChanged: (value) => setState(() => _query = value),
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
                                  tooltip: MaterialLocalizations.of(
                                    context,
                                  ).deleteButtonTooltip,
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
        final router = GoRouter.of(context);
        Navigator.of(context).pop();
        router.push(tool.route);
      },
    );
  }
}