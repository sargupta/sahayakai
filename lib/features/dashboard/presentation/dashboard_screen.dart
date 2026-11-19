import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/data/recent_tools_provider.dart';
import '../../../shared/domain/tool_registry.dart';
import '../../../shared/widgets/map_card.dart';
import '../../../shared/widgets/map_icon_tile.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../../../shared/widgets/tool_tint.dart';
import '../../vidya/presentation/vidya_sheet.dart';

/// The Make hub (`/prep-desk`, UX map "Make hub", App board B3): one place to
/// start any job, grouped by what the teacher is doing.
///
/// "What are we making?", then "Tap and speak" (VIDYA routes a spoken request
/// to the right tool), then the tools as the map's two-column tiles under
/// Prepare, Assess, Explore and Parents. Every tile opens a real tool; the
/// map's "8 more tools" tile is spelled out as the tools themselves.
///
/// Tiles in a row share a height and grow with their text (no fixed aspect
/// ratio), so a long Malayalam name at large text wraps instead of clipping.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  /// A tool's tile line where the map writes its own; else the registry's.
  static String? _mapLine(String id, AppLocalizations l10n) => switch (id) {
    'lesson-plan' => l10n.makeHubLessonSub,
    'worksheet' => l10n.makeHubWorksheetSub,
    'quiz' => l10n.makeHubQuizSub,
    'rubric' => l10n.makeHubRubricSub,
    'assessment-scanner' => l10n.makeHubScannerSub,
    'attendance' => l10n.makeHubAttendanceSub,
    'instant-answer' => l10n.makeHubInstantSub,
    _ => null,
  };

  static const List<(String Function(AppLocalizations), List<String>)> _groups =
      [
        (_prepare, ['lesson-plan', 'worksheet', 'exam-paper', 'visual-aid']),
        (
          _assess,
          [
            'quiz',
            'rubric',
            'assessment-scanner',
            'attendance',
            'assess-assignment',
          ],
        ),
        (
          _explore,
          [
            'instant-answer',
            'virtual-field-trip',
            'video-storyteller',
            'teacher-training',
          ],
        ),
        (_parents, ['parent-message', 'parent-hotline']),
      ];

  static String _prepare(AppLocalizations l10n) => l10n.makeHubPrepare;
  static String _assess(AppLocalizations l10n) => l10n.makeHubAssess;
  static String _explore(AppLocalizations l10n) => l10n.makeHubExplore;
  static String _parents(AppLocalizations l10n) => l10n.makeHubParents;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tools = {
      for (final tool in [...kToolRegistry, kAttendanceEntry]) tool.id: tool,
    };
    final recent = [
      for (final id in ref.watch(recentToolsProvider)) ?tools[id],
    ];

    void open(ToolEntry tool) {
      ref.read(recentToolsProvider.notifier).record(tool.id);
      context.push(tool.route);
    }

    return ToolScaffold(
      title: l10n.makeHubTitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _SpeakCard(),
          if (recent.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space5),
            MapOverline(l10n.makeHubRecent, color: AppColors.textEyebrow),
            const SizedBox(height: AppSpacing.space2),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final tool in recent)
                  _RecentChip(
                    key: ValueKey('make-recent-${tool.id}'),
                    tool: tool,
                    onTap: () => open(tool),
                  ),
              ],
            ),
          ],
          for (final (heading, ids) in _groups) ...[
            const SizedBox(height: AppSpacing.space5),
            MapOverline(heading(l10n), color: AppColors.textEyebrow),
            const SizedBox(height: AppSpacing.space2),
            _TileGrid(
              tiles: [
                for (final id in ids)
                  if (tools[id] case final tool?)
                    _Tile(
                      key: ValueKey('make-${tool.id}'),
                      title: tool.title(l10n),
                      line: _mapLine(id, l10n) ?? tool.subtitle(l10n),
                      icon: tool.icon,
                      tint: toolTint(tool.id),
                      onTap: () => open(tool),
                    ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// A recently used tool: its icon in a tinted circle and its name, one tap
/// back into it.
class _RecentChip extends StatelessWidget {
  const _RecentChip({super.key, required this.tool, required this.onTap});

  final ToolEntry tool;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tint = toolTint(tool.id);
    return Material(
      color: AppColors.surfaceMapCard,
      shape: const StadiumBorder(
        side: BorderSide(color: AppColors.borderHairline),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44),
          child: Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(6, 6, 14, 6),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: tint.fill,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    tool.icon,
                    size: AppIconSize.micro,
                    color: tint.ink,
                  ),
                ),
                const SizedBox(width: AppSpacing.space2),
                Text(
                  tool.title(context.l10n),
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textStrong,
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

/// "Tap and speak": a mic, the example of what to say, and "Or type a topic".
/// The whole card opens the VIDYA sheet, where both work.
class _SpeakCard extends StatelessWidget {
  const _SpeakCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    return MapCard(
      onTap: () => showVidyaSheet(context, pagePath: Routes.prepDesk),
      child: Row(
        children: [
          // A mic, not a second sphere: the floating orb is VIDYA on this
          // page, and one screen never shows her twice.
          const MapIconTile(icon: LucideIcons.mic),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  l10n.makeHubSpeak,
                  style: text.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textStrong,
                  ),
                ),
                Text(
                  l10n.makeHubSpeakExample,
                  style: text.bodySmall?.copyWith(
                    fontSize: 13,
                    color: AppColors.textBody,
                  ),
                ),
                Text(
                  '${l10n.makeHubType} ›',
                  style: text.labelMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.textLink,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Tiles two to a row, each row as tall as its tallest tile.
class _TileGrid extends StatelessWidget {
  const _TileGrid({required this.tiles});

  final List<Widget> tiles;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < tiles.length; i += 2) ...[
          if (i > 0) const SizedBox(height: 10),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: tiles[i]),
                const SizedBox(width: 10),
                Expanded(
                  child: i + 1 < tiles.length
                      ? tiles[i + 1]
                      : const SizedBox.shrink(),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// The map's `.tile`: 86% white, 16px corners, a hairline ring; the tool in
/// bold, one muted line under it.
class _Tile extends StatelessWidget {
  const _Tile({
    super.key,
    required this.title,
    required this.line,
    required this.icon,
    required this.tint,
    required this.onTap,
  });

  final String title;
  final String line;
  final IconData icon;
  final MapTint tint;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      label: title,
      hint: line,
      excludeSemantics: true,
      onTap: onTap,
      child: Material(
        color: AppColors.surfaceMapCard,
        shape: const RoundedRectangleBorder(
          borderRadius: AppRadius.rTile,
          side: BorderSide(color: AppColors.borderHairline),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          // Every tile at least this tall, so a row of short names and a row
          // of long ones read as one grid; text still grows it at large scale.
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 88),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // The icon sits above the name, never beside it: a long
                  // Malayalam or Tamil name at large text needs the tile's
                  // whole width, or it breaks mid-word.
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: tint.fill,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Icon(icon, size: AppIconSize.micro, color: tint.ink),
                  ),
                  const SizedBox(height: AppSpacing.space2),
                  Text(
                    title,
                    style: text.bodyLarge?.copyWith(
                      fontSize: AppText.rowTitleSize,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textStrong,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    line,
                    style: text.bodySmall?.copyWith(
                      fontSize: 12,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
