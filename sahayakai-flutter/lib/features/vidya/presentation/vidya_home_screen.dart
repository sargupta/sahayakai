import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/glass_app_bar.dart';
import '../../../shared/widgets/secondary_button.dart';
import 'background_generation_controller.dart';
import 'deliver_tray.dart';
import 'deliverables_controller.dart';
import 'vidya_controller.dart';
import 'vidya_greeting.dart';
import 'vidya_nav_dispatcher.dart';
import 'vidya_status_ui.dart';
import 'widgets/conversation_block.dart';
import 'widgets/home_day_view.dart';
import 'widgets/seal_mic.dart';
import 'widgets/vidya_orb.dart';

/// Home: VIDYA's voice-first front door, set on the teacher's real day
/// (design system v2 `ScreenHome`). Idle, it shows the day — a greeting, the
/// day in one headline, what is waiting phrased as what to say — with the orb
/// as the hero and a type bar at the foot. The teacher taps the orb and
/// speaks, or types; each turn inks onto the page as a document block (never
/// a chat thread). A single valid intent routes to its tool prefilled; a
/// compound intent renders confirm chips. Signed-out (401) degrades to a
/// dignified "Sign in to talk to VIDYA" panel under the orb.
///
/// The tool grid stays one tap away as the Prep desk (the card's link, and
/// the app bar once a conversation is on the page).
class VidyaHomeScreen extends ConsumerStatefulWidget {
  const VidyaHomeScreen({super.key});

  @override
  ConsumerState<VidyaHomeScreen> createState() => _VidyaHomeScreenState();
}

class _VidyaHomeScreenState extends ConsumerState<VidyaHomeScreen> {
  @override
  void initState() {
    super.initState();
    // Tell VIDYA which screen she is on, and restore the prior session — both
    // once, after the first frame (so the state write does not run during
    // build). The restore 401s on the stub token and degrades to a fresh empty
    // session (U-V7).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final controller = ref.read(vidyaControllerProvider.notifier);
      controller.registerScreenContext('/');
      controller.restoreSession();
      // Mother-tongue welcome: auto-spoken once per session in the teacher's
      // language via the existing TTS, skipped under reduce-motion. Trigger is a
      // founder UX call (auto vs tap) — see [maybeSpeakVidyaGreeting].
      maybeSpeakVidyaGreeting(
        ref,
        motionEnabled: context.motionEnabled,
        greeting: context.l10n.vidyaGreeting,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(vidyaControllerProvider);
    final controller = ref.read(vidyaControllerProvider.notifier);

    // A single valid intent → route to its tool, prefilled, then clear it. The
    // dispatcher owns the flow→route map and drops not-yet-built tools.
    ref.listen(vidyaControllerProvider.select((s) => s.pendingNavigation), (
      _,
      directive,
    ) {
      if (directive == null) return;
      // Only the topmost VIDYA surface routes: when a tool or the VIDYA sheet
      // sits above the home, that surface owns the navigation (else the home
      // would double-push the same intent). See U-V7.
      if (!(ModalRoute.of(context)?.isCurrent ?? true)) return;
      controller.consumeNavigation();
      VidyaNavDispatcher.dispatch(context, directive);
    });

    return Scaffold(
      // Idle, Home has no app bar: the greeting row is its header (v2). Once
      // a conversation is on the page, the bar returns for clearing it and for
      // the Prep desk. Network and Messages live in the Community tab.
      appBar: state.hasConversation
          ? GlassAppBar(
              title: Text(l10n.appTitle),
              actions: [
                // U9 — the manual "Clear conversation" action (the app's
                // analogue of the web's Trash2 "Clear Context" button).
                IconButton(
                  icon: const Icon(LucideIcons.trash2),
                  tooltip: l10n.vidyaClearConversation,
                  onPressed: controller.clearConversation,
                ),
                IconButton(
                  icon: const Icon(LucideIcons.layoutGrid),
                  tooltip: l10n.vidyaPrepDesk,
                  onPressed: () => context.push(Routes.prepDesk),
                ),
              ],
            )
          : null,
      // The page route already paints the v2 wash and saffron glow under
      // this transparent scaffold (`ScreenWash`); painting the wash again here
      // would cover the glow.
      body: SafeArea(
        child: state.hasConversation
            ? _ActiveLayout(state: state, controller: controller)
            : _EmptyLayout(state: state, controller: controller),
      ),
    );
  }
}

/// The idle Home: the greeting, the day headline, the card of things to say,
/// the orb as the hero, and the type bar pinned at the foot so it rides above
/// the keyboard.
///
/// The top block scrolls, so it never overflows at 360dp × textScale 1.3 or in
/// a long-script locale; while everything fits, the orb centres in the space
/// left between the card and the type bar.
class _EmptyLayout extends StatelessWidget {
  const _EmptyLayout({required this.state, required this.controller});

  final VidyaState state;
  final VidyaController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) => SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: (constraints.maxHeight - 4).clamp(
                    0.0,
                    double.infinity,
                  ),
                ),
                // No IntrinsicHeight: with a viewport-height minimum and an
                // unbounded maximum, a Column hands its leftover height to
                // `spaceBetween`, so the orb centres in the space under the
                // card while it fits and everything scrolls when it does not —
                // without measuring intrinsics (which a button under-reports).
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        HomeGreeting(),
                        SizedBox(height: 14),
                        HomeDayHeadline(),
                        SizedBox(height: 14),
                        HomeSayItCard(),
                        SizedBox(height: 14),
                      ],
                    ),
                    _HomeOrb(state: state, controller: controller),
                    const SizedBox(height: 14),
                  ],
                ),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
          child: HomeComposer(
            onSubmit: controller.submitText,
            onMic: controller.onMicTap,
          ),
        ),
      ],
    );
  }
}

/// Home's hero: the orb, 112px, and the one line under it. On Home the orb is
/// VIDYA's only presence (the parked orb stays off this screen), so it takes
/// every state the parked orb would: working while a minimised generation
/// runs, ready with a count — a tap then opens the deliver tray.
class _HomeOrb extends ConsumerWidget {
  const _HomeOrb({required this.state, required this.controller});

  final VidyaState state;
  final VidyaController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final type = AppTypeTokens.of(context);
    final readyCount = ref.watch(
      deliverablesControllerProvider.select((d) => d.length),
    );
    final bgActive = ref.watch(backgroundGenerationControllerProvider) != null;
    final visual = vidyaOrbVisualFor(
      state.status,
      readyCount: readyCount,
      bgActive: bgActive,
    );
    final caption = switch (visual) {
      VidyaOrbVisual.ready when state.status == VidyaStatus.idle =>
        '${ref.read(deliverablesControllerProvider.notifier).latest?.title ?? ''}'
            ' · ${l10n.homeStatusReady}',
      VidyaOrbVisual.working when state.status == VidyaStatus.idle =>
        l10n.vidyaStateThinking,
      _ => vidyaStateCaption(state.status, l10n),
    };

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        VidyaOrb(
          key: const ValueKey('home-orb'),
          state: visual,
          size: 112,
          glyph: false,
          readyCount: readyCount,
          semanticLabel: l10n.appTitle,
          semanticHint: caption ?? vidyaTerminalTitle(state.status, l10n),
          onTap: () {
            final latest = ref
                .read(deliverablesControllerProvider.notifier)
                .latest;
            if (visual == VidyaOrbVisual.ready && latest != null) {
              showDeliverTray(context, latest);
            } else {
              controller.onMicTap();
            }
          },
        ),
        const SizedBox(height: 12),
        if (isVidyaTerminal(state.status))
          _TerminalPanel(status: state.status, controller: controller)
        else
          Text(
            caption ?? l10n.vidyaStateIdle,
            textAlign: TextAlign.center,
            style: type.button.copyWith(height: 1.4),
          ),
      ],
    );
  }
}

/// Once turns land: the transcript scrolls above, the Seal Mic settles to a
/// smaller anchored control at the bottom (thumb-reachable). The masthead fades
/// out — the conversation is the page now.
class _ActiveLayout extends StatelessWidget {
  const _ActiveLayout({required this.state, required this.controller});

  final VidyaState state;
  final VidyaController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: AppSpacing.pagePadding,
            itemCount: state.conversation.length,
            itemBuilder: (context, index) {
              final block = state.conversation[index];
              // Only newly-appended blocks mount (ListView.builder preserves the
              // earlier elements), so each inks in once instead of re-animating
              // the whole transcript.
              return Padding(
                padding: EdgeInsets.only(
                  bottom: index == state.conversation.length - 1
                      ? 0
                      : AppSpacing.space3,
                ),
                child: inkSettle(
                  context,
                  ConversationBlockView(
                    block: block,
                    onChipTap: controller.dispatchDirective,
                  ),
                ),
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(
            left: AppSpacing.space4,
            right: AppSpacing.space4,
            bottom: AppSpacing.space4,
            top: AppSpacing.space2,
          ),
          child: _MicCluster(state: state, controller: controller),
        ),
      ],
    );
  }
}

/// The anchored Seal Mic + its caption under a conversation; the terminal
/// error phases render a dignified panel instead.
class _MicCluster extends StatelessWidget {
  const _MicCluster({required this.state, required this.controller});

  final VidyaState state;
  final VidyaController controller;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final caption = vidyaStateCaption(state.status, l10n);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SealMic(
          state: sealStateForStatus(state.status),
          amplitude: state.amplitude,
          size: 88,
          onTap: controller.onMicTap,
          semanticLabel: l10n.appTitle,
          semanticHint: caption ?? vidyaTerminalTitle(state.status, l10n),
        ),
        const SizedBox(height: AppSpacing.space5),
        if (isVidyaTerminal(state.status))
          _TerminalPanel(status: state.status, controller: controller)
        else ...[
          Text(
            caption ?? l10n.vidyaStateIdle,
            style: Theme.of(context).textTheme.titleMedium,
            textAlign: TextAlign.center,
          ),
        ],
      ],
    );
  }
}

/// A dignified panel for the terminal phases (signed-out / mic-off / limit /
/// failed) — a title, a body, and a recovery action where one exists.
class _TerminalPanel extends StatelessWidget {
  const _TerminalPanel({required this.status, required this.controller});

  final VidyaStatus status;
  final VidyaController controller;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;

    final title = vidyaTerminalTitle(status, l10n);
    final body = vidyaTerminalBody(status, l10n);
    Widget? action;
    if (status == VidyaStatus.micDenied) {
      action = SecondaryButton(
        label: l10n.vidyaOpenSettings,
        icon: LucideIcons.settings,
        onPressed: controller.openMicSettings,
      );
    } else if (status == VidyaStatus.failed) {
      action = SecondaryButton(
        label: l10n.actionRetry,
        icon: LucideIcons.refreshCw,
        onPressed: controller.onMicTap,
      );
    } else if (status == VidyaStatus.signedOut) {
      action = SecondaryButton(
        label: l10n.vidyaSignIn,
        icon: LucideIcons.logIn,
        // Real auth landed (core/auth/auth_providers.dart): the router's
        // `authControllerProvider` and VIDYA's own 401-driven `signedOut`
        // status now derive from the SAME Firebase session, so a plain push
        // is correct — the earlier "clear a stub flag first" workaround is
        // gone. (That workaround was masking a real bug in the stub, not a
        // permanent pattern: forcibly signing a teacher out before every
        // sign-in tap would be wrong the moment auth is real.)
        onPressed: () => context.push(Routes.login),
      );
    }

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 360),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(title, style: text.titleMedium, textAlign: TextAlign.center),
          const SizedBox(height: AppSpacing.space2),
          Text(
            body,
            style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
            textAlign: TextAlign.center,
          ),
          if (action != null) ...[
            const SizedBox(height: AppSpacing.space4),
            action,
          ],
        ],
      ),
    );
  }
}

// ─── Mappings ────────────────────────────────────────────────────────────────

// The seal-state / caption / terminal mappings moved to `vidya_status_ui.dart`,
// and the flow→route map + prefill to `VidyaNavDispatcher` (U-V6/U-V7), so the
// home and the everywhere VIDYA sheet render and route from one source of truth.
