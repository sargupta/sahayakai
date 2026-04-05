import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/community_repository.dart';
import '../../domain/community_models.dart';

/// Screen displaying the user's community groups with pull-to-refresh.
class GroupsScreen extends ConsumerStatefulWidget {
  const GroupsScreen({super.key});

  @override
  ConsumerState<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends ConsumerState<GroupsScreen> {
  @override
  Widget build(BuildContext context) {
    final groupsAsync = ref.watch(groupsProvider);

    return GlassScaffold(
      title: 'My Groups',
      body: groupsAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: GlassColors.primary),
        ),
        error: (error, _) => _buildErrorState(error),
        data: (groups) {
          if (groups.isEmpty) {
            return _buildEmptyState();
          }
          return RefreshIndicator(
            color: GlassColors.primary,
            onRefresh: () => ref.refresh(groupsProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(
                horizontal: GlassSpacing.lg,
                vertical: GlassSpacing.md,
              ),
              itemCount: groups.length,
              separatorBuilder: (_, __) =>
                  const SizedBox(height: GlassSpacing.md),
              itemBuilder: (context, index) =>
                  _GroupCard(group: groups[index]),
            ),
          );
        },
      ),
    );
  }

  Widget _buildErrorState(Object error) {
    return Center(
      child: Padding(
        padding: GlassSpacing.screenPadding,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.cloud_off_rounded,
              size: 48,
              color: GlassColors.textTertiary,
            ),
            const SizedBox(height: GlassSpacing.lg),
            Text(
              'Could not load groups',
              style: GlassTypography.headline3(),
            ),
            const SizedBox(height: GlassSpacing.sm),
            Text(
              error.toString(),
              style: GlassTypography.bodySmall(),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: GlassSpacing.xl),
            TextButton.icon(
              onPressed: () => ref.invalidate(groupsProvider),
              icon: const Icon(Icons.refresh_rounded),
              label: Text(
                'Retry',
                style: GlassTypography.buttonMedium(
                  color: GlassColors.primary,
                ),
              ),
              style: TextButton.styleFrom(
                foregroundColor: GlassColors.primary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: GlassSpacing.screenPadding,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.groups_outlined,
              size: 64,
              color: GlassColors.textTertiary.withOpacity(0.5),
            ),
            const SizedBox(height: GlassSpacing.lg),
            Text(
              'No groups yet',
              style: GlassTypography.headline3(),
            ),
            const SizedBox(height: GlassSpacing.sm),
            Text(
              'Groups are auto-created based on your subjects and grade levels.',
              style: GlassTypography.bodyMedium(
                color: GlassColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Group Card
// ---------------------------------------------------------------------------

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.group});

  final CommunityGroup group;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: () {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            const SnackBar(
              content: Text('Group detail coming soon'),
              behavior: SnackBarBehavior.floating,
              duration: Duration(seconds: 2),
            ),
          );
      },
      padding: const EdgeInsets.all(GlassSpacing.lg),
      child: Row(
        children: [
          // First-letter avatar
          _GroupAvatar(group: group),
          const SizedBox(width: GlassSpacing.lg),

          // Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Name
                Text(
                  group.name,
                  style: GlassTypography.labelLarge(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: GlassSpacing.xs),

                // Type chip + member count
                Row(
                  children: [
                    _GroupTypeChip(type: group.type),
                    const SizedBox(width: GlassSpacing.sm),
                    Icon(
                      Icons.people_outline_rounded,
                      size: 14,
                      color: GlassColors.textTertiary,
                    ),
                    const SizedBox(width: 3),
                    Text(
                      '${group.memberCount}',
                      style: GlassTypography.bodySmall(),
                    ),
                  ],
                ),
                const SizedBox(height: GlassSpacing.xs),

                // Last activity
                Text(
                  _formatLastActivity(group.lastActivityAt),
                  style: GlassTypography.labelSmall(),
                ),
              ],
            ),
          ),

          // Right arrow
          Icon(
            Icons.chevron_right_rounded,
            color: GlassColors.textTertiary,
            size: 24,
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Supporting Widgets
// ---------------------------------------------------------------------------

class _GroupAvatar extends StatelessWidget {
  const _GroupAvatar({required this.group});

  final CommunityGroup group;

  static const _typeColors = {
    GroupType.subject: Color(0xFF6366F1), // Indigo
    GroupType.grade: Color(0xFF10B981), // Emerald
    GroupType.school: Color(0xFFF59E0B), // Amber
  };

  @override
  Widget build(BuildContext context) {
    final color = _typeColors[group.type] ?? GlassColors.primary;
    final letter = group.name.isNotEmpty ? group.name[0].toUpperCase() : '?';

    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(GlassRadius.sm),
      ),
      alignment: Alignment.center,
      child: Text(
        letter,
        style: GlassTypography.headline3(color: color),
      ),
    );
  }
}

class _GroupTypeChip extends StatelessWidget {
  const _GroupTypeChip({required this.type});

  final GroupType type;

  static const _chipColors = {
    GroupType.subject: Color(0xFF6366F1),
    GroupType.grade: Color(0xFF10B981),
    GroupType.school: Color(0xFFF59E0B),
  };

  @override
  Widget build(BuildContext context) {
    final color = _chipColors[type] ?? GlassColors.primary;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: GlassSpacing.sm,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: color.withOpacity(0.10),
        borderRadius: BorderRadius.circular(GlassRadius.pill),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Text(
        type.displayName,
        style: GlassTypography.labelSmall(color: color),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

String _formatLastActivity(String? lastActivityStr) {
  if (lastActivityStr == null) return 'No recent activity';
  final lastActivity = DateTime.tryParse(lastActivityStr);
  if (lastActivity == null) return 'No recent activity';
  final now = DateTime.now();
  final diff = now.difference(lastActivity);

  if (diff.inMinutes < 1) return 'Active just now';
  if (diff.inMinutes < 60) return 'Active ${diff.inMinutes}m ago';
  if (diff.inHours < 24) return 'Active ${diff.inHours}h ago';
  if (diff.inDays == 1) return 'Active yesterday';
  if (diff.inDays < 7) return 'Active ${diff.inDays}d ago';
  return 'Active ${diff.inDays ~/ 7}w ago';
}
