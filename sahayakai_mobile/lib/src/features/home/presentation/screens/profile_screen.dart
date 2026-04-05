import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../../../core/database/database_service.dart';
import '../../../auth/data/auth_repository.dart';
import '../../../auth/domain/user_profile_model.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../chat/presentation/providers/chat_provider.dart';
import '../../../lesson_plan/presentation/providers/lesson_plan_provider.dart';
import '../../../quiz/presentation/providers/quiz_provider.dart';
import '../../../auth/presentation/providers/user_profile_provider.dart';
import '../../../user/data/user_repository.dart';
import '../../../export/data/export_repository.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(fullUserProfileProvider);
    final firebaseUser = ref.watch(authStateProvider).valueOrNull;

    return Container(
      decoration: const BoxDecoration(
        gradient: GlassColors.warmBackgroundGradient,
      ),
      child: profileAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: GlassColors.primary),
        ),
        error: (_, __) => _buildBody(context, ref, null, firebaseUser?.email),
        data: (profile) =>
            _buildBody(context, ref, profile, firebaseUser?.email),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref,
    UserProfileModel? profile,
    String? fallbackEmail,
  ) {
    final displayName = profile?.displayName.isNotEmpty == true
        ? profile!.displayName
        : (fallbackEmail ?? 'Teacher');
    final subtitle = _buildSubtitle(profile);
    final photoUrl = profile?.photoURL;
    final planType = profile?.planType ?? 'free';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(GlassSpacing.xl),
      child: Column(
        children: [
          const SizedBox(height: GlassSpacing.lg),

          // Profile Header Card
          GlassCard(
            child: Column(
              children: [
                // Avatar
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: GlassColors.primary,
                      width: 3,
                    ),
                    color: GlassColors.inputBackground,
                    image: photoUrl != null
                        ? DecorationImage(
                            image: NetworkImage(photoUrl),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                  child: photoUrl == null
                      ? Icon(Icons.person_rounded,
                          size: 48, color: GlassColors.primary)
                      : null,
                ),
                const SizedBox(height: GlassSpacing.lg),
                Text(displayName, style: GlassTypography.headline2()),
                const SizedBox(height: GlassSpacing.xs),
                Text(
                  subtitle,
                  style: GlassTypography.bodyMedium(
                    color: GlassColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: GlassSpacing.md),
                // Plan badge
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: planType == 'pro'
                        ? const Color(0xFFFFF3CD)
                        : GlassColors.inputBackground,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: planType == 'pro'
                          ? const Color(0xFFF59E0B)
                          : GlassColors.border,
                    ),
                  ),
                  child: Text(
                    planType == 'pro' ? 'Pro Plan' : 'Free Plan',
                    style: GlassTypography.bodySmall(
                      color: planType == 'pro'
                          ? const Color(0xFF92400E)
                          : GlassColors.textSecondary,
                    ),
                  ),
                ),
                const SizedBox(height: GlassSpacing.lg),
                // Stats row — followers, following, impact
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _buildStatColumn(
                      '${profile?.followersCount ?? 0}',
                      'Followers',
                    ),
                    Container(
                      width: 1,
                      height: 30,
                      color: GlassColors.border,
                    ),
                    _buildStatColumn(
                      '${profile?.followingCount ?? 0}',
                      'Following',
                    ),
                    Container(
                      width: 1,
                      height: 30,
                      color: GlassColors.border,
                    ),
                    _buildStatColumn(
                      '${profile?.contentSharedCount ?? 0}',
                      'Shared',
                    ),
                  ],
                ),
                // Impact score
                if (profile?.impactScore != null &&
                    profile!.impactScore! > 0) ...[
                  const SizedBox(height: GlassSpacing.lg),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFFF9933), Color(0xFFFFB366)],
                      ),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.star_rounded,
                            color: Colors.white, size: 18),
                        const SizedBox(width: 6),
                        Text(
                          'Impact Score: ${profile.impactScore}',
                          style: GlassTypography.labelMedium(
                              color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                ],
                // Badges
                if (profile?.badges != null &&
                    profile!.badges!.isNotEmpty) ...[
                  const SizedBox(height: GlassSpacing.md),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    alignment: WrapAlignment.center,
                    children: profile.badges!
                        .take(5)
                        .map((badge) => Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: GlassColors.primary.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(badge,
                                  style: GlassTypography.labelSmall(
                                      color: GlassColors.primary)),
                            ))
                        .toList(),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: GlassSpacing.xl),

          // Quick actions
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('ACCOUNT', style: GlassTypography.sectionHeader()),
              const SizedBox(height: GlassSpacing.md),
              _buildSettingItem(
                Icons.person_outline_rounded,
                'Edit Profile',
                onTap: () => context.push('/edit-profile'),
              ),
              const SizedBox(height: GlassSpacing.sm),
              _buildSettingItem(
                Icons.workspace_premium_rounded,
                'Upgrade Plan',
                trailing: Text(
                  'View Plans',
                  style: GlassTypography.bodySmall(
                      color: GlassColors.primary),
                ),
                onTap: () => context.push('/pricing'),
              ),
            ],
          ),
          const SizedBox(height: GlassSpacing.xl),

          // Settings Section
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('SETTINGS', style: GlassTypography.sectionHeader()),
              const SizedBox(height: GlassSpacing.md),
              _buildSettingItem(
                Icons.settings_rounded,
                'Settings',
                onTap: () => context.push('/settings'),
              ),
              const SizedBox(height: GlassSpacing.sm),
              _buildSettingItem(
                Icons.download_rounded,
                'Download My Data',
                onTap: () => _showExportDialog(context, ref),
              ),
            ],
          ),
          const SizedBox(height: GlassSpacing.xxl),

          // Log Out Button
          GlassSecondaryButton(
            label: 'Log Out',
            icon: Icons.logout_rounded,
            onPressed: () async {
              ref.invalidate(chatMessagesProvider);
              ref.invalidate(lessonPlanResultProvider);
              ref.invalidate(quizResultProvider);
              ref.invalidate(profileExistsProvider);
              ref.invalidate(fullUserProfileProvider);
              await ref.read(databaseServiceProvider).clearLocalData();
              await ref.read(authRepositoryProvider).signOut();
            },
          ),
          const SizedBox(height: GlassSpacing.xxl),

          // Delete Account — Danger Zone
          GlassSecondaryButton(
            label: 'Delete Account',
            icon: Icons.delete_forever_rounded,
            onPressed: () => _showDeleteAccountDialog(context, ref),
          ),

          const SizedBox(height: GlassSpacing.xxxl),
        ],
      ),
    );
  }

  String _buildSubtitle(UserProfileModel? profile) {
    if (profile == null) return 'Teacher';
    final parts = <String>[];
    if (profile.schoolName != null && profile.schoolName!.isNotEmpty) {
      parts.add(profile.schoolName!);
    }
    if (profile.gradeLevels.isNotEmpty) {
      parts.add('Grade ${profile.gradeLevels.join(', ')}');
    }
    return parts.isNotEmpty ? parts.join(' • ') : 'Teacher';
  }

  void _showDeleteAccountDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Account?'),
        content: const Text(
          'Your account and all data will be permanently deleted after 30 days. '
          'You can recover your account by signing in again within this period.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ref.read(userRepositoryProvider).deleteAccount();
                await ref.read(databaseServiceProvider).clearLocalData();
                ref.invalidate(profileExistsProvider);
                ref.invalidate(fullUserProfileProvider);
                await ref.read(authRepositoryProvider).signOut();
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Deletion failed: $e')),
                  );
                }
              }
            },
            child: const Text('Delete Permanently'),
          ),
        ],
      ),
    );
  }

  void _showExportDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Download My Data'),
        content: const Text(
          'We will prepare a ZIP file with all your data '
          '(lesson plans, quizzes, profile). This may take a few minutes.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                final result =
                    await ref.read(exportRepositoryProvider).requestExport();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        result.downloadUrl != null
                            ? 'Export ready! Check your downloads.'
                            : 'Export started. We\'ll notify you when ready.',
                      ),
                      duration: const Duration(seconds: 5),
                    ),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Export failed: $e')),
                  );
                }
              }
            },
            child: const Text('Request Export'),
          ),
        ],
      ),
    );
  }

  Widget _buildStatColumn(String value, String label) {
    return Column(
      children: [
        Text(value,
            style: GlassTypography.headline3()),
        const SizedBox(height: 2),
        Text(label,
            style: GlassTypography.bodySmall(
                color: GlassColors.textSecondary)),
      ],
    );
  }

  Widget _buildSettingItem(
    IconData icon,
    String title, {
    Widget? trailing,
    VoidCallback? onTap,
  }) {
    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(
        horizontal: GlassSpacing.lg,
        vertical: GlassSpacing.md,
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: GlassColors.inputBackground,
              borderRadius: BorderRadius.circular(GlassRadius.sm),
            ),
            child: Icon(icon, color: GlassColors.textPrimary, size: 20),
          ),
          const SizedBox(width: GlassSpacing.lg),
          Expanded(
            child: Text(title, style: GlassTypography.labelLarge()),
          ),
          if (trailing != null) ...[
            trailing,
            const SizedBox(width: GlassSpacing.sm),
          ],
          const Icon(
            Icons.arrow_forward_ios_rounded,
            size: 14,
            color: GlassColors.textTertiary,
          ),
        ],
      ),
    );
  }
}
