import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/language_switcher.dart';
import '../../../shared/widgets/primary_button.dart';

/// Placeholder login. "Continue" flips the STUB auth to signed-in; the router
/// redirect then routes to Home. Real Google sign-in lands in P0.2.
class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: AppSpacing.pagePadding,
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: AppSpacing.space12),
                  Text(context.l10n.loginTitle, style: text.headlineMedium),
                  const SizedBox(height: AppSpacing.space2),
                  Text(
                    context.l10n.loginSubtitle,
                    style: text.bodyLarge
                        ?.copyWith(color: scheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: AppSpacing.space8),
                  const LanguageSwitcher(),
                  const SizedBox(height: AppSpacing.space8),
                  PrimaryButton(
                    label: context.l10n.actionContinue,
                    onPressed: () =>
                        ref.read(authControllerProvider.notifier).signIn(),
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
