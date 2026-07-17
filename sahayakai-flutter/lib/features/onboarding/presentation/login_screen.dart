import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/icon_well.dart';
import '../../../shared/widgets/language_switcher.dart';
import '../../../shared/widgets/primary_button.dart';

/// P0.2 — Login.
///
/// BUILT-PENDING-FIREBASE. The button below is wired to the STUB
/// [AuthController], not to Google: `firebase_auth` / `google_sign_in` are
/// deliberately absent from `pubspec.yaml` this pass, so the app builds with no
/// Firebase config at all. Everything except the credential exchange is real —
/// the destination logic, the router handoff, the states and the copy.
/// TODO(P0.2-firebase): replace [_signIn]'s stub call with
/// `GoogleSignIn().signIn()` -> `signInWithCredential`, per
/// docs/flutter/HANDOFF.md §1.
///
/// LAYOUT: left-aligned, and the page leads with what SahayakAI actually does
/// for a teacher before it asks for anything. No centred hero stack
/// (DESIGN_RUBRIC §11).
///
/// LANGUAGE IS STEP 0, and it is on this screen ON PURPOSE. It sits ABOVE the
/// sign-in button because a teacher who reads Odia should not have to sign in
/// to an English screen first to discover that the app speaks Odia. It writes
/// the single `AppLocale`, so it sets both the UI language and the language the
/// AI writes teaching material in.
class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  /// Where a teacher lands after signing in.
  ///
  /// `next` is the deep link the router preserved when it bounced an
  /// unauthenticated teacher off a protected route; honouring it is what makes
  /// that bounce invisible.
  ///
  /// With no deep link, first-run setup is the destination — as a SUGGESTION,
  /// never a gate. Onboarding's own skip lands on the dashboard, and nothing
  /// ever re-routes anyone back here.
  ///
  /// TODO(P0.2-firebase): a RETURNING teacher should skip straight to the
  /// dashboard. The check is `GET /api/auth/profile-check?uid=<uid>` ->
  /// `{exists, onboardingComplete}`. It is public (it runs before the app has a
  /// session, so it takes the uid as a query param rather than a Bearer token)
  /// and it is the only read that answers this — there is no
  /// `GET /api/user/profile`. Route to [Routes.home] when `exists` is true, to
  /// [Routes.onboarding] when it is false. Until Firebase lands there is no uid
  /// to ask about, and every stub sign-in is a first one.
  @visibleForTesting
  static String destinationFor(String? next) {
    if (next != null && next.isNotEmpty) return next;
    return Routes.onboarding;
  }

  void _signIn(BuildContext context, WidgetRef ref) {
    // Captured BEFORE the auth flip. Signing in makes the router's redirect
    // re-evaluate immediately, which can unmount this screen and take its
    // context with it; the router itself outlives that.
    final router = GoRouter.of(context);
    final next = GoRouterState.of(context).uri.queryParameters['next'];

    ref.read(authControllerProvider.notifier).signIn();

    // Runs after that redirect, so it is the navigation that wins. The redirect
    // sends a signed-in teacher sitting on /login to `next` or home; this then
    // places them on the destination this screen chose.
    router.go(destinationFor(next));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      // No AppBar on this screen, so nothing else sets the status-bar style.
      value: isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: Scaffold(
        body: SafeArea(
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              // A reading column on tablets; full width on a 360dp phone.
              constraints: const BoxConstraints(maxWidth: 480),
              child: ListView(
                padding: AppSpacing.pagePadding,
                children: [
                  const _BrandRow(),
                  const SizedBox(height: AppSpacing.space8),
                  Text(l10n.loginTitle, style: text.headlineMedium),
                  const SizedBox(height: AppSpacing.space2),
                  Text(
                    l10n.loginSubtitle,
                    style: text.bodyLarge?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space8),
                  // The three tools that actually exist in this build. Real
                  // capabilities, not "Get started" filler (DESIGN_RUBRIC §11).
                  _ValueRow(
                    icon: LucideIcons.bookOpen,
                    label: l10n.loginValueLessons,
                  ),
                  const SizedBox(height: AppSpacing.space3),
                  _ValueRow(
                    icon: LucideIcons.clipboardList,
                    label: l10n.loginValueQuizzes,
                  ),
                  const SizedBox(height: AppSpacing.space3),
                  _ValueRow(
                    icon: LucideIcons.messageSquare,
                    label: l10n.loginValueAnswers,
                  ),
                  const SizedBox(height: AppSpacing.space8),
                  Text(
                    l10n.loginLanguagePrompt,
                    style: text.titleSmall?.copyWith(letterSpacing: 0.2),
                  ),
                  const SizedBox(height: AppSpacing.space1),
                  Text(
                    l10n.loginLanguageHint,
                    style: text.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space3),
                  // All 11 languages, each in its own script.
                  const AppCard(
                    padding: EdgeInsets.zero,
                    child: LanguageSwitcher(),
                  ),
                  const SizedBox(height: AppSpacing.space8),
                  PrimaryButton(
                    label: l10n.loginGoogle,
                    // Lucide has no Google mark, and a Google button must carry
                    // Google's own asset to meet their branding terms. See
                    // docs/flutter/HANDOFF.md §1: the real asset lands with the
                    // real sign-in.
                    icon: LucideIcons.logIn,
                    onPressed: () => _signIn(context, ref),
                  ),
                  const SizedBox(height: AppSpacing.space3),
                  Text(
                    l10n.loginPrivacyNote,
                    style: text.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
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

/// The brand mark, left-aligned and small: this screen is about the teacher's
/// decision, not about the logo.
class _BrandRow extends StatelessWidget {
  const _BrandRow();

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Row(
      children: [
        const IconWell(icon: LucideIcons.graduationCap),
        const SizedBox(width: AppSpacing.space3),
        Expanded(child: Text(context.l10n.appTitle, style: text.titleLarge)),
      ],
    );
  }
}

/// One capability line: a functional Lucide glyph and a real sentence.
class _ValueRow extends StatelessWidget {
  const _ValueRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: AppIconSize.inline, color: scheme.primary),
        const SizedBox(width: AppSpacing.space3),
        // Expanded so a long Malayalam line wraps rather than overflowing the
        // row at textScale 1.3 (DESIGN_RUBRIC §8).
        Expanded(child: Text(label, style: text.bodyMedium)),
      ],
    );
  }
}
