import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../inbox/presentation/widgets/inbox_entry_button.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/secondary_button.dart';
import 'vidya_controller.dart';
import 'vidya_nav_dispatcher.dart';
import 'vidya_status_ui.dart';
import 'widgets/conversation_block.dart';
import 'widgets/seal_mic.dart';

/// "The Almanac Speaks" — the voice-first home (PREMIUM_DESIGN_SPEC §B). A
/// nearly-empty warm-ivory page: a time-aware Fraunces greeting, a rotating
/// prompt, and one large saffron Seal Mic at the optical centre. The teacher
/// taps and speaks; each turn inks onto the page as a document block (never a
/// chat thread). A single valid intent routes to its tool prefilled; a compound
/// intent renders confirm chips. Signed-out (401 on the stub token) degrades to
/// a dignified "Sign in to talk to VIDYA" state with the mic still present.
///
/// This replaces the form-first dashboard as the app's landing; the tool grid
/// stays one tap away as the Prep desk (the app-bar action).
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
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final state = ref.watch(vidyaControllerProvider);
    final controller = ref.read(vidyaControllerProvider.notifier);

    // A single valid intent → route to its tool, prefilled, then clear it. The
    // dispatcher owns the flow→route map and drops not-yet-built tools.
    ref.listen(
      vidyaControllerProvider.select((s) => s.pendingNavigation),
      (_, directive) {
        if (directive == null) return;
        // Only the topmost VIDYA surface routes: when a tool or the VIDYA sheet
        // sits above the home, that surface owns the navigation (else the home
        // would double-push the same intent). See U-V7.
        if (!(ModalRoute.of(context)?.isCurrent ?? true)) return;
        controller.consumeNavigation();
        VidyaNavDispatcher.dispatch(context, directive);
      },
    );

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(l10n.appTitle),
        actions: [
          // The Pro Inbox entry (U-SI1): a messages glyph with a live unread
          // badge. Firebase-gated → the badge stays hidden (deferred unread = 0)
          // until the transport goes live.
          const InboxEntryButton(),
          IconButton(
            icon: const Icon(LucideIcons.layoutGrid),
            tooltip: l10n.vidyaPrepDesk,
            onPressed: () => context.push(Routes.prepDesk),
          ),
        ],
      ),
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: isDark ? AppGradients.darkVignette : AppGradients.lightPaper,
        ),
        child: SafeArea(
          child: state.hasConversation
              ? _ActiveLayout(state: state, controller: controller)
              : _EmptyLayout(state: state, controller: controller),
        ),
      ),
    );
  }
}

/// The nearly-empty first canvas: masthead pinned high-left, the Seal Mic at the
/// optical centre (slightly above middle). Uses a `Stack` so it never throws a
/// RenderFlex overflow at 360dp × textScale 1.3 — the composed still just holds.
class _EmptyLayout extends StatelessWidget {
  const _EmptyLayout({required this.state, required this.controller});

  final VidyaState state;
  final VidyaController controller;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: AppSpacing.pagePadding,
      child: Stack(
        children: [
          const Align(alignment: Alignment.topLeft, child: _Masthead()),
          Align(
            alignment: const Alignment(0, -0.08), // the optical centre, a touch high
            child: _MicCluster(state: state, controller: controller, big: true),
          ),
        ],
      ),
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
          child: _MicCluster(state: state, controller: controller, big: false),
        ),
      ],
    );
  }
}

/// The idle masthead: saffron eyebrow → time-aware Fraunces greeting → a saffron
/// masthead rule → the deck. Reuses the dashboard's time-aware l10n keys.
class _Masthead extends StatelessWidget {
  const _Masthead();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final extras = AppTextExtras.of(context);
    final scheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: AppSpacing.space6),
        EditorialSectionHeader(l10n.vidyaEyebrow, rule: false),
        const SizedBox(height: AppSpacing.space3),
        Text(_salutation(l10n), style: text.displayLarge),
        const SizedBox(height: AppSpacing.space3),
        const SizedBox(
          width: 48,
          height: 2,
          child: DecoratedBox(
            decoration: BoxDecoration(gradient: AppGradients.accentBar),
          ),
        ),
        const SizedBox(height: AppSpacing.space3),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Text(
            l10n.vidyaDeck,
            style: extras.lead.copyWith(color: scheme.onSurfaceVariant),
          ),
        ),
      ],
    );
  }
}

/// The Seal Mic + its caption. In the empty state the idle caption trails a
/// rotating prompt; the terminal error phases render a dignified panel instead.
class _MicCluster extends StatelessWidget {
  const _MicCluster({
    required this.state,
    required this.controller,
    required this.big,
  });

  final VidyaState state;
  final VidyaController controller;
  final bool big;

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
          size: big ? 128 : 88,
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
          if (state.status == VidyaStatus.idle && big) ...[
            const SizedBox(height: AppSpacing.space3),
            const _RotatingPrompt(),
          ],
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

/// The rotating hint under an idle mic. Cycles a few real prompt examples via a
/// gentle cross-fade — only when motion is enabled, so reduce-motion (and the
/// test harness) shows a single static line and schedules no timer.
class _RotatingPrompt extends StatefulWidget {
  const _RotatingPrompt();

  @override
  State<_RotatingPrompt> createState() => _RotatingPromptState();
}

class _RotatingPromptState extends State<_RotatingPrompt> {
  static const Duration _dwell = Duration(seconds: 4);
  int _index = 0;
  Timer? _timer;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (context.motionEnabled) {
      _timer = Timer.periodic(_dwell, (_) {
        if (mounted) setState(() => _index++);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final prompts = [
      l10n.vidyaPromptLesson,
      l10n.vidyaPromptQuiz,
      l10n.vidyaPromptParent,
    ];
    final label = prompts[_index % prompts.length];
    return AnimatedSwitcher(
      duration: AppMotion.small,
      switchInCurve: AppMotion.easeOutQuart,
      switchOutCurve: AppMotion.easeOutQuart,
      child: Text(
        label,
        key: ValueKey(label),
        style: text.bodyMedium?.copyWith(
          color: scheme.onSurfaceVariant,
          fontStyle: FontStyle.italic,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}

// ─── Mappings ────────────────────────────────────────────────────────────────

String _salutation(AppLocalizations l10n) {
  final hour = DateTime.now().hour;
  if (hour < 12) return l10n.dashboardGreetingMorning;
  if (hour < 17) return l10n.dashboardGreetingAfternoon;
  return l10n.dashboardGreetingEvening;
}

// The seal-state / caption / terminal mappings moved to `vidya_status_ui.dart`,
// and the flow→route map + prefill to `VidyaNavDispatcher` (U-V6/U-V7), so the
// home and the everywhere VIDYA sheet render and route from one source of truth.

