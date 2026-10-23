import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/glass_app_bar.dart';

/// A basic privacy policy / privacy explainer for teachers.
class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return Scaffold(
      appBar: const GlassAppBar(title: Text('Privacy for Teachers')),
      body: SafeArea(
        child: ListView(
          padding: AppSpacing.pagePadding,
          children: [
            Text(
              'Privacy Policy',
              style: text.titleLarge?.copyWith(color: scheme.onSurface),
            ),
            const SizedBox(height: AppSpacing.space4),
            Text(
              'SahayakAI is built for teachers. We use your Google account only '
              'to sign you in, and your work stays yours. We do not sell your '
              'data, and we do not share it with third parties for advertising.',
              style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.space4),
            Text(
              'Student names are never sent for grading. Phone numbers and other '
              'sensitive details you enter are used only to deliver the features '
              'you request, and are never downloaded back onto your device.',
              style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.space4),
            Text(
              'You can delete your account at any time from Settings. If you have '
              'questions, contact support.',
              style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}
