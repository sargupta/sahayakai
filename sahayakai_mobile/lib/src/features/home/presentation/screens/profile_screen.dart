import 'package:flutter/material.dart';
import '../../../../core/theme/glassmorphic/glass_components.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: GlassColors.warmBackgroundGradient,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(GlassSpacing.xl),
        child: Column(
          children: [
            const SizedBox(height: GlassSpacing.lg),
            
            // Profile Header Card
            GlassCard(
              child: Column(
                children: [
                  Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: GlassColors.primary,
                        width: 3,
                      ),
                      image: const DecorationImage(
                        image: NetworkImage('https://i.pravatar.cc/300?img=12'),
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  const SizedBox(height: GlassSpacing.lg),
                  Text(
                    'Sarthak Gupta',
                    style: GlassTypography.headline2(),
                  ),
                  const SizedBox(height: GlassSpacing.xs),
                  Text(
                    'Teacher • Grade 6-10',
                    style: GlassTypography.bodyMedium(
                      color: GlassColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: GlassSpacing.xl),

            // Stats Card
            GlassCard(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildStat('128', 'Lessons'),
                  Container(
                    width: 1,
                    height: 40,
                    color: GlassColors.divider,
                  ),
                  _buildStat('1.2k', 'Students'),
                  Container(
                    width: 1,
                    height: 40,
                    color: GlassColors.divider,
                  ),
                  _buildStat('45', 'Hours Saved'),
                ],
              ),
            ),
            const SizedBox(height: GlassSpacing.xl),

            // Settings Section
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'SETTINGS',
                  style: GlassTypography.sectionHeader(),
                ),
                const SizedBox(height: GlassSpacing.md),
                _buildSettingItem(
                  Icons.person_outline_rounded,
                  'Edit Profile',
                  onTap: () {},
                ),
                const SizedBox(height: GlassSpacing.sm),
                _buildSettingItem(
                  Icons.notifications_outlined,
                  'Notifications',
                  onTap: () {},
                ),
                const SizedBox(height: GlassSpacing.sm),
                _buildSettingItem(
                  Icons.language_rounded,
                  'App Language',
                  trailing: Text(
                    'English',
                    style: GlassTypography.bodySmall(
                      color: GlassColors.primary,
                    ),
                  ),
                  onTap: () {},
                ),
                const SizedBox(height: GlassSpacing.sm),
                _buildSettingItem(
                  Icons.color_lens_outlined,
                  'Theme',
                  trailing: Text(
                    'Light',
                    style: GlassTypography.bodySmall(
                      color: GlassColors.primary,
                    ),
                  ),
                  onTap: () {},
                ),
                const SizedBox(height: GlassSpacing.sm),
                _buildSettingItem(
                  Icons.help_outline_rounded,
                  'Help & Support',
                  onTap: () {},
                ),
              ],
            ),
            const SizedBox(height: GlassSpacing.xxl),

            // Log Out Button
            GlassSecondaryButton(
              label: 'Log Out',
              icon: Icons.logout_rounded,
              onPressed: () {},
            ),
            
            const SizedBox(height: GlassSpacing.xxxl),
          ],
        ),
      ),
    );
  }

  Widget _buildStat(String value, String label) {
    return Column(
      children: [
        Text(
          value,
          style: GlassTypography.headline2(color: GlassColors.primary),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: GlassTypography.bodySmall(),
        ),
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
