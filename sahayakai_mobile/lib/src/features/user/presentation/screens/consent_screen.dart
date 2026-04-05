import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/user_repository.dart';

/// DPDP Act compliance consent screen.
/// Shown after onboarding, before home — collects explicit consent for
/// analytics, community data sharing, and AI training data usage.
class ConsentScreen extends ConsumerStatefulWidget {
  const ConsentScreen({super.key});

  @override
  ConsumerState<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends ConsumerState<ConsentScreen> {
  bool _analytics = true;
  bool _community = true;
  bool _trainingData = false;
  bool _isSaving = false;

  Future<void> _save() async {
    setState(() => _isSaving = true);
    try {
      await ref.read(userRepositoryProvider).updateConsent(
            ConsentPreferences(
              analytics: _analytics,
              community: _community,
              trainingData: _trainingData,
            ),
          );
      if (mounted) context.go('/');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save preferences: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'Privacy & Consent',
      showBackButton: false,
      body: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.all(GlassSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(Icons.shield_rounded,
                size: 48, color: GlassColors.primary),
            const SizedBox(height: GlassSpacing.lg),
            Text(
              'Your Data, Your Choice',
              style: GlassTypography.headline2(),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: GlassSpacing.sm),
            Text(
              'We respect your privacy under the Digital Personal Data '
              'Protection Act (DPDP). Choose what data you\'re comfortable sharing.',
              style: GlassTypography.bodyMedium(
                  color: GlassColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: GlassSpacing.xxl),

            // Analytics toggle
            GlassCard(
              child: SwitchListTile(
                title: Text('Usage Analytics',
                    style: GlassTypography.labelLarge()),
                subtitle: Text(
                  'Help us improve the app by sharing anonymized usage patterns.',
                  style: GlassTypography.bodySmall(
                      color: GlassColors.textSecondary),
                ),
                value: _analytics,
                activeColor: GlassColors.primary,
                onChanged: (v) => setState(() => _analytics = v),
              ),
            ),
            const SizedBox(height: GlassSpacing.md),

            // Community toggle
            GlassCard(
              child: SwitchListTile(
                title: Text('Community Sharing',
                    style: GlassTypography.labelLarge()),
                subtitle: Text(
                  'Allow your shared content to appear in the community library.',
                  style: GlassTypography.bodySmall(
                      color: GlassColors.textSecondary),
                ),
                value: _community,
                activeColor: GlassColors.primary,
                onChanged: (v) => setState(() => _community = v),
              ),
            ),
            const SizedBox(height: GlassSpacing.md),

            // Training data toggle
            GlassCard(
              child: SwitchListTile(
                title: Text('AI Training Data',
                    style: GlassTypography.labelLarge()),
                subtitle: Text(
                  'Allow anonymized content to improve AI model quality. '
                  'Your personal details are never used.',
                  style: GlassTypography.bodySmall(
                      color: GlassColors.textSecondary),
                ),
                value: _trainingData,
                activeColor: GlassColors.primary,
                onChanged: (v) => setState(() => _trainingData = v),
              ),
            ),
            const SizedBox(height: GlassSpacing.xxl),

            // Privacy policy link
            Center(
              child: TextButton.icon(
                icon: Icon(Icons.open_in_new,
                    size: 16, color: GlassColors.primary),
                label: Text(
                  'Read our Privacy Policy',
                  style: TextStyle(color: GlassColors.primary),
                ),
                onPressed: () => launchUrl(
                  Uri.parse('https://sahayakai.app/privacy-for-teachers'),
                  mode: LaunchMode.externalApplication,
                ),
              ),
            ),
            const SizedBox(height: GlassSpacing.xxl),

            // Continue button
            GlassPrimaryButton(
              label: 'Continue',
              icon: Icons.check_rounded,
              isLoading: _isSaving,
              onPressed: _isSaving ? null : _save,
            ),
            const SizedBox(height: GlassSpacing.lg),

            Text(
              'You can change these preferences anytime in Settings.',
              style: GlassTypography.bodySmall(
                  color: GlassColors.textTertiary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
