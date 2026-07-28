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
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/language_switcher.dart';
import '../../../shared/widgets/primary_button.dart';

/// P0.2 — Login. Re-skinned as a heritage-almanac title page
/// (PREMIUM_DESIGN_SPEC.md §6b U6): a saffron kicker rule, a Fraunces
/// `displayHero` masthead, a `lead` deck, the app's real capabilities as a
/// hairline-ruled editorial register (not saffron bullets), an
/// `EditorialSectionHeader` over the language picker, and one glowing CTA.
///
/// REAL Google sign-in (the auth handoff has landed — see [AuthController]).
/// The button icon is still a Lucide glyph, not Google's official mark: Lucide
/// has no Google logo, and Google's branding terms require their own asset on
/// a "Sign in with Google" button — still open, tracked in
/// docs/flutter/HANDOFF.md §1.
///
/// LAYOUT: left-aligned, the hero sitting 40dp below the top (the quiet-luxury
/// top margin, §3.4), and the page leads with what SahayakAI actually does for
/// a teacher before it asks for anything. No centred hero stack
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

  Future<void> _signIn(BuildContext context, WidgetRef ref) async {
    // Captured BEFORE the await: the real sign-in is asynchronous (a Google
    // account picker + a network credential exchange), so this screen may be
    // unmounted by the time it resolves (the router's redirect re-evaluates
    // the moment auth state flips, which can navigate away from here); the
    // router and the query param are read up front so neither depends on a
    // `context` that might not survive the await.
    final router = GoRouter.of(context);
    final next = GoRouterState.of(context).uri.queryParameters['next'];
    final l10n = context.l10n;

    bool signedIn;
    try {
      signedIn = await ref.read(authControllerProvider.notifier).signIn();
    } catch (_) {
      // A real FirebaseAuthException (network failure, misconfigured
      // credential, etc). The teacher dismissing the Google account picker is
      // NOT an error (signIn() returns false for that, not a throw) — only a
      // genuine failure reaches here.
      if (context.mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(l10n.errorGeneric)));
      }
      return;
    }
    if (!signedIn) return; // teacher dismissed the account picker

    // Runs after the redirect, so it is the navigation that wins. The redirect
    // sends a signed-in teacher sitting on /login to `next` or home; this then
    // places them on the destination this screen chose.
    if (context.mounted) router.go(destinationFor(next));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final extras = AppTextExtras.of(context);
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;

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
                // The hero sits 40dp below the top — the quiet-luxury margin.
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.space4,
                  AppSpacing.space10,
                  AppSpacing.space4,
                  AppSpacing.space6,
                ),
                children: [
                  // The 2dp x 32dp saffron kicker rule above the masthead.
                  Container(
                    width: 32,
                    height: 2,
                    decoration: BoxDecoration(
                      color: saffron,
                      borderRadius: AppRadius.rSm,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space4),
                  Text(l10n.loginTitle, style: extras.displayHero),
                  const SizedBox(height: AppSpacing.space3),
                  Text(
                    l10n.loginSubtitle,
                    style: extras.lead.copyWith(color: scheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: AppSpacing.space8),
                  // The three tools that actually exist in this build, as a
                  // hairline-ruled register — real capabilities, not "Get
                  // started" filler (DESIGN_RUBRIC §11), and not saffron bullets.
                  const _ValueRegister(
                    items: [
                      (icon: LucideIcons.bookOpen, key: _ValueKey.lessons),
                      (icon: LucideIcons.clipboardList, key: _ValueKey.quizzes),
                      (icon: LucideIcons.messageSquare, key: _ValueKey.answers),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.space8),
                  EditorialSectionHeader(l10n.loginLanguagePrompt),
                  const SizedBox(height: AppSpacing.space2),
                  Text(
                    l10n.loginLanguageHint,
                    style: text.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space3),
                  // A compact switcher: the current language's own endonym on
                  // the tile, opening a sheet of all 11 scripts. The inline
                  // all-scripts list a first-run teacher confirms lives on
                  // onboarding step 0; here the tile now opens ALREADY on the
                  // device language (see LocaleController.build), so an Odia
                  // phone reads "ଓଡ଼ିଆ", not "English", before sign-in.
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

/// Which capability line to render; the copy resolves against the active
/// locale, so a value prop reads in the teacher's language.
enum _ValueKey { lessons, quizzes, answers }

/// The app's real capabilities as a hairline-ruled editorial register: each
/// line is a muted (never saffron) Lucide glyph and a real sentence, the rows
/// framed and separated by 1px `outlineVariant` rules — the ledger register,
/// not a bulleted list.
class _ValueRegister extends StatelessWidget {
  const _ValueRegister({required this.items});

  final List<({IconData icon, _ValueKey key})> items;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final l10n = context.l10n;

    String labelOf(_ValueKey key) => switch (key) {
          _ValueKey.lessons => l10n.loginValueLessons,
          _ValueKey.quizzes => l10n.loginValueQuizzes,
          _ValueKey.answers => l10n.loginValueAnswers,
        };

    Widget rule() => Container(height: 1, color: scheme.outlineVariant);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        rule(),
        for (final item in items) ...[
          _ValueRow(icon: item.icon, label: labelOf(item.key)),
          rule(),
        ],
      ],
    );
  }
}

/// One register row: a muted glyph and a real sentence, generously spaced.
class _ValueRow extends StatelessWidget {
  const _ValueRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.space4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: AppIconSize.inline, color: scheme.onSurfaceVariant),
          const SizedBox(width: AppSpacing.space4),
          // Expanded so a long Malayalam line wraps rather than overflowing the
          // row at textScale 1.3 (DESIGN_RUBRIC §8).
          Expanded(child: Text(label, style: text.bodyLarge)),
        ],
      ),
    );
  }
}
