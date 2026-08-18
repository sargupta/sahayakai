import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import 'widgets/content_creator_card.dart';

/// U-PD2 — Content Creator Studio. A NO-BACKEND hub.
///
/// It mirrors the web `content-creator/page.tsx`: a titled studio page with a
/// descriptive intro and a curated set of tool cards. It groups the three
/// multimedia tools — Visual Aid Designer, Virtual Field Trip and Video
/// Storyteller — and deep-links to each. There is no API call, no controller and
/// no generation here; the tools it links to own that.
///
/// The cards carry the dashboard tool-row grammar ([ContentCreatorCard]), so the
/// hub reads as a smaller, curated slice of the Prep desk. The list is
/// full-width rows, NOT a fixed-aspect grid — the same DESIGN_RUBRIC §7 reason
/// the dashboard uses rows: a fixed tile height is the first thing to clip a
/// Malayalam description at textScale 1.3.
class ContentCreatorScreen extends StatelessWidget {
  const ContentCreatorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    // The three multimedia tools this hub groups, in the web's order. Each row
    // reuses the tool's registered Lucide glyph and deep-links to its live
    // route; the description is the hub's richer, web-parity copy (distinct from
    // the terse dashboard-tile subtitle each tool carries in the registry).
    final tools = <_HubTool>[
      _HubTool(
        icon: LucideIcons.image,
        title: l10n.visualAidTitle,
        description: l10n.contentCreatorVisualAidDesc,
        route: Routes.visualAid,
      ),
      _HubTool(
        icon: LucideIcons.globe,
        title: l10n.virtualFieldTripTitle,
        description: l10n.contentCreatorFieldTripDesc,
        route: Routes.virtualFieldTrip,
      ),
      _HubTool(
        icon: LucideIcons.video,
        title: l10n.videoStorytellerTitle,
        description: l10n.contentCreatorVideoDesc,
        route: Routes.videoStoryteller,
      ),
    ];

    return ToolScaffold(
      title: l10n.contentCreatorTitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // The intro sits on the warm page ground, so it renders full-ink
          // (onSurface): the muted onSurfaceVariant would fall to ~4.4:1 there,
          // below AA. Muted copy is reserved for the white card surfaces below.
          Text(
            l10n.contentCreatorSubtitle,
            style: text.bodyLarge?.copyWith(color: scheme.onSurface),
          ),
          const SizedBox(height: AppSpacing.space8),
          EditorialSectionHeader(l10n.contentCreatorSectionEyebrow),
          const SizedBox(height: AppSpacing.space4),
          for (final (index, tool) in tools.indexed) ...[
            if (index > 0) const SizedBox(height: AppSpacing.space3),
            ContentCreatorCard(
              icon: tool.icon,
              title: tool.title,
              description: tool.description,
              onTap: () => context.push(tool.route),
            ),
          ],
        ],
      ),
    );
  }
}

/// A row in the hub: the tool's glyph, its localized name, the hub-card
/// description and the route it deep-links to. Local to the screen — the hub is
/// the single place these three are grouped.
class _HubTool {
  const _HubTool({
    required this.icon,
    required this.title,
    required this.description,
    required this.route,
  });

  final IconData icon;
  final String title;
  final String description;
  final String route;
}
