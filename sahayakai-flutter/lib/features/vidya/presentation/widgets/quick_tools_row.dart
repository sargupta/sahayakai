import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/domain/tool_registry.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/icon_well.dart';

/// A compact preview of teaching tools shown on the VIDYA home's idle canvas,
/// below the mic cluster — so the first screen reads as a rich, populated
/// product (matching the PWA's dashboard hero + tool grid) rather than an
/// empty placeholder with a single mic on it.
///
/// Pulls from the single [kToolRegistry] source of truth — the SAME list the
/// Prep desk and the Create palette already walk — so this preview can never
/// list a tool that does not exist elsewhere, or drift from what the Prep
/// desk itself shows. It is a PREVIEW, not the full register: the caller
/// slices the first few entries; "See all" lives one tap away at the Prep
/// desk (the app-bar action), same as before.
///
/// TWO-COLUMN WRAP, NOT `GridView.count` / a fixed `childAspectRatio`. A
/// fixed aspect ratio forces a fixed height for text, which is the first
/// thing to clip at textScale 1.3 in Malayalam — the exact, already-fixed
/// bug `dashboard_screen.dart`'s `_ToolList` header comment documents. Each
/// tile only fixes its WIDTH (via `LayoutBuilder`); its height stays
/// intrinsic to its own content, so a long wrapped title just grows the tile
/// instead of clipping.
class QuickToolsRow extends StatelessWidget {
  const QuickToolsRow({super.key, required this.tools});

  final List<ToolEntry> tools;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final tileWidth = (constraints.maxWidth - AppSpacing.space3) / 2;
        return Wrap(
          spacing: AppSpacing.space3,
          runSpacing: AppSpacing.space3,
          children: [
            for (final tool in tools)
              SizedBox(
                width: tileWidth,
                child: _QuickToolTile(tool: tool),
              ),
          ],
        );
      },
    );
  }
}

/// One tool tile: an icon well, then the tool's name. Compact on purpose —
/// this is a preview row, not the Prep desk's full feature tile, so it skips
/// the subtitle to keep the row light.
class _QuickToolTile extends StatelessWidget {
  const _QuickToolTile({required this.tool});

  final ToolEntry tool;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AppCard(
      variant: AppCardVariant.elevated,
      onTap: () => context.push(tool.route),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          IconWell(icon: tool.icon),
          const SizedBox(height: AppSpacing.space2),
          Text(
            tool.title(l10n),
            style: Theme.of(context).textTheme.labelLarge,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
