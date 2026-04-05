import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../../../core/providers/language_provider.dart';
import '../../../../core/database/database_service.dart';
import '../../../auth/data/auth_repository.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../auth/presentation/providers/user_profile_provider.dart';
import '../../../user/data/user_repository.dart';
import '../../../export/data/export_repository.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final currentLang = ref.watch(languageProvider);

    return GlassScaffold(
      title: 'Settings',
      showBackButton: true,
      body: SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.all(GlassSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Language
            Text('LANGUAGE', style: GlassTypography.sectionHeader()),
            const SizedBox(height: GlassSpacing.md),
            GlassDropdown<String>(
              labelText: 'App Language',
              value: currentLang,
              items: languageDisplayNames
                  .map((l) => DropdownMenuItem(value: l, child: Text(l)))
                  .toList(),
              onChanged: (v) {
                if (v != null) {
                  ref.read(languageProvider.notifier).setLanguage(v);
                }
              },
            ),
            const SizedBox(height: GlassSpacing.xxl),

            // AI Tools
            Text('AI TOOLS', style: GlassTypography.sectionHeader()),
            const SizedBox(height: GlassSpacing.md),
            _buildItem(
              Icons.face_retouching_natural,
              'AI Avatar',
              'Create and manage your AI avatar',
              onTap: () => context.push('/avatar'),
            ),
            const SizedBox(height: GlassSpacing.xxl),

            // Community
            Text('COMMUNITY', style: GlassTypography.sectionHeader()),
            const SizedBox(height: GlassSpacing.md),
            _buildItem(
              Icons.groups,
              'Staff Room',
              'Connect with fellow staff members',
              onTap: () => context.push('/staff-room'),
            ),
            const SizedBox(height: GlassSpacing.sm),
            _buildItem(
              Icons.people,
              'My Connections',
              'View and manage your connections',
              onTap: () => context.push('/community/connections'),
            ),
            const SizedBox(height: GlassSpacing.sm),
            _buildItem(
              Icons.local_library,
              'Community Library',
              'Browse shared resources and materials',
              onTap: () => context.push('/community/library'),
            ),
            const SizedBox(height: GlassSpacing.xxl),

            // School
            Text('SCHOOL', style: GlassTypography.sectionHeader()),
            const SizedBox(height: GlassSpacing.md),
            _buildItem(
              Icons.school,
              'My Classes',
              'Manage your classes and attendance',
              onTap: () => context.push('/attendance/classes'),
            ),
            const SizedBox(height: GlassSpacing.sm),
            _buildItem(
              Icons.newspaper,
              'Edu News',
              'Latest education news and updates',
              onTap: () => context.push('/news'),
            ),
            const SizedBox(height: GlassSpacing.xxl),

            // Messages
            Text('MESSAGES', style: GlassTypography.sectionHeader()),
            const SizedBox(height: GlassSpacing.md),
            _buildItem(
              Icons.chat_bubble_outline,
              'Messages',
              'View and send messages',
              onTap: () => context.push('/messages'),
            ),
            const SizedBox(height: GlassSpacing.sm),
            _buildItem(
              Icons.notifications_outlined,
              'Notifications',
              'Manage your notification preferences',
              onTap: () => context.push('/notifications'),
            ),
            const SizedBox(height: GlassSpacing.xxl),

            // Privacy
            Text('PRIVACY', style: GlassTypography.sectionHeader()),
            const SizedBox(height: GlassSpacing.md),
            _buildItem(
              Icons.shield_rounded,
              'Consent Preferences',
              'Manage analytics & data sharing',
              onTap: () => context.push('/consent'),
            ),
            const SizedBox(height: GlassSpacing.sm),
            _buildItem(
              Icons.download_rounded,
              'Download My Data',
              'Export all your data as a ZIP',
              onTap: () => _requestExport(),
            ),
            const SizedBox(height: GlassSpacing.xxl),

            // Feedback
            Text('FEEDBACK', style: GlassTypography.sectionHeader()),
            const SizedBox(height: GlassSpacing.md),
            _buildItem(
              Icons.feedback_rounded,
              'Send Feedback',
              'Report bugs, request features, or share thoughts',
              onTap: () => context.push('/feedback'),
            ),
            const SizedBox(height: GlassSpacing.xxl),

            // About
            Text('ABOUT', style: GlassTypography.sectionHeader()),
            const SizedBox(height: GlassSpacing.md),
            _buildItem(
              Icons.help_outline_rounded,
              'Help & Support',
              'FAQ, guides, and contact',
              onTap: () => launchUrl(
                Uri.parse('https://sahayakai.app/help'),
                mode: LaunchMode.externalApplication,
              ),
            ),
            const SizedBox(height: GlassSpacing.sm),
            _buildItem(
              Icons.privacy_tip_outlined,
              'Privacy Policy',
              'How we handle your data',
              onTap: () => launchUrl(
                Uri.parse('https://sahayakai.app/privacy-for-teachers'),
                mode: LaunchMode.externalApplication,
              ),
            ),
            const SizedBox(height: GlassSpacing.sm),
            _buildItem(
              Icons.info_outline_rounded,
              'About & Licenses',
              'Version info, open-source credits',
              onTap: () => showLicensePage(
                context: context,
                applicationName: 'SahayakAI',
                applicationVersion: '1.0.0',
              ),
            ),
            const SizedBox(height: GlassSpacing.xxl),

            // Danger Zone
            Text('DANGER ZONE',
                style: GlassTypography.sectionHeader()
                    .copyWith(color: Colors.red)),
            const SizedBox(height: GlassSpacing.md),
            GlassSecondaryButton(
              label: 'Delete Account',
              icon: Icons.delete_forever_rounded,
              onPressed: () => _showDeleteDialog(),
            ),
            const SizedBox(height: GlassSpacing.xxxl),
          ],
        ),
      ),
    );
  }

  Widget _buildItem(
    IconData icon,
    String title,
    String subtitle, {
    VoidCallback? onTap,
  }) {
    return GlassCard(
      onTap: onTap,
      child: Row(
        children: [
          Icon(icon, color: GlassColors.textPrimary, size: 22),
          const SizedBox(width: GlassSpacing.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: GlassTypography.labelLarge()),
                Text(subtitle,
                    style: GlassTypography.bodySmall(
                        color: GlassColors.textSecondary)),
              ],
            ),
          ),
          const Icon(Icons.arrow_forward_ios_rounded,
              size: 14, color: GlassColors.textTertiary),
        ],
      ),
    );
  }

  Future<void> _requestExport() async {
    try {
      final result =
          await ref.read(exportRepositoryProvider).requestExport();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.downloadUrl != null
                ? 'Export ready!'
                : 'Export started. We\'ll notify you when ready.'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Export failed: $e')),
        );
      }
    }
  }

  void _showDeleteDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Account?'),
        content: const Text(
          'Your account will be permanently deleted after 30 days. '
          'Sign in again within this period to recover.',
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
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed: $e')),
                  );
                }
              }
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}
