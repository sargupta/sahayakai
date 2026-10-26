import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/tool_registry.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/glass_surface.dart';
import '../../../shared/widgets/icon_well.dart';

/// Opens the Create (command) palette: a search field over the shared
/// [kToolRegistry], each row deep-linking into its tool.
///
/// It used to open from a Create slot in the bottom bar. Design system v2
/// draws four tabs and never five, and moves creation to VIDYA (the orb), so
/// the palette now opens from the Prep desk's search action — the tools grid
/// it searches — and nothing it did is lost.
Future<void> showCreatePalette(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    // The sheet draws its own v2 surface (solid `surface-card`, `radius-sheet`
    // top corners, `shadow-sheet`), so the modal route stays transparent.
    backgroundColor: Colors.transparent,
    elevation: 0,
    // The sheet carries a search field: it must be free to grow past the
    // default 9/16-screen cap and to lift above the keyboard. The palette
    // bounds its own height and scrolls its list inside that bound.
    isScrollControlled: true,
    builder: (_) => const CreatePalette(),
  );
}

/// The palette sheet. It walks the SAME registry the Prep desk grid does, so
/// the two always agree on which tools exist. The height is bounded here (a
/// min-height [Column] with the list in a [Flexible]) so the list scrolls
/// inside the sheet rather than the sheet growing without limit.
class CreatePalette extends StatefulWidget {
  const CreatePalette({super.key});

  @override
  State<CreatePalette> createState() => _CreatePaletteState();
}

class _CreatePaletteState extends State<CreatePalette> {
  final TextEditingController _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Case-folding so "quiz", "QUIZ" and a stray leading space all match.
  /// Indic scripts are caseless, so `toLowerCase` is a no-op there and
  /// `contains` matches on the raw glyphs.
  static String _fold(String s) => s.trim().toLowerCase();

  /// `radius-sheet` on the top corners; the bottom sits at the screen edge.
  static final BorderRadius _sheetRadius = BorderRadius.only(
    topLeft: AppRadius.rSheet.topLeft,
    topRight: AppRadius.rSheet.topRight,
  );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final type = AppTypeTokens.of(context);
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
        decoration: BoxDecoration(
          borderRadius: _sheetRadius,
          boxShadow: isDark ? AppShadows.dKey : AppShadows.sheet,
        ),
        child: GlassSurface(
          borderRadius: _sheetRadius,
          fill: AppColors.surfaceCard,
          padding: EdgeInsets.zero,
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // The v2 sheet handle: 44 × 4, `border-control`.
                Padding(
                  padding: const EdgeInsets.only(top: 14),
                  child: Center(
                    child: Container(
                      width: 44,
                      height: 4,
                      decoration: ShapeDecoration(
                        color: isDark
                            ? scheme.outlineVariant
                            : AppColors.borderControl,
                        shape: const StadiumBorder(),
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 12, 18, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // The v2 sheet title: 14/600 in the display face.
                      Text(l10n.navCreate, style: type.value),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _controller,
                        textInputAction: TextInputAction.search,
                        onChanged: (value) => setState(() => _query = value),
                        // Radius, focus edge and the Indic fallback come from
                        // `inputDecorationTheme`; only the palette-specific
                        // affordances are set here.
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
        horizontal: 18,
        vertical: AppSpacing.space1,
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
