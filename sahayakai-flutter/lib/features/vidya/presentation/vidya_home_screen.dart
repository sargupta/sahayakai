import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/secondary_button.dart';
import '../data/dto/vidya_action.dart';
import 'vidya_controller.dart';
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
    // Tell VIDYA which screen she is on, once, after the first frame (so the
    // state write does not run during build).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref.read(vidyaControllerProvider.notifier).registerScreenContext('/');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final state = ref.watch(vidyaControllerProvider);
    final controller = ref.read(vidyaControllerProvider.notifier);

    // A single valid intent → route to its tool, prefilled, then clear it.
    ref.listen(
      vidyaControllerProvider.select((s) => s.pendingNavigation),
      (_, directive) {
        if (directive == null) return;
        controller.consumeNavigation();
        final route = _routeForFlow(directive.flow);
        if (route == null) return; // not-yet-built tools (U-PD*): nothing to open
        context.push(
          Uri(path: route, queryParameters: _prefill(directive.params)).toString(),
        );
      },
    );

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(l10n.appTitle),
        actions: [
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
    final caption = _captionFor(state.status, l10n);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SealMic(
          state: _sealStateFor(state.status),
          amplitude: state.amplitude,
          size: big ? 128 : 88,
          onTap: controller.onMicTap,
          semanticLabel: l10n.appTitle,
          semanticHint: caption ?? _terminalTitle(state.status, l10n),
        ),
        const SizedBox(height: AppSpacing.space5),
        if (_isTerminal(state.status))
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

    String title;
    String body;
    Widget? action;
    switch (status) {
      case VidyaStatus.signedOut:
        title = l10n.vidyaSignedOutTitle;
        body = l10n.vidyaSignedOutBody;
      case VidyaStatus.micDenied:
        title = l10n.vidyaMicOffTitle;
        body = l10n.vidyaMicOffBody;
        action = SecondaryButton(
          label: l10n.vidyaOpenSettings,
          icon: LucideIcons.settings,
          onPressed: controller.openMicSettings,
        );
      case VidyaStatus.limitReached:
        title = l10n.vidyaLimitTitle;
        body = l10n.vidyaLimitBody;
      case VidyaStatus.failed:
        title = l10n.vidyaErrorTitle;
        body = l10n.vidyaErrorBody;
        action = SecondaryButton(
          label: l10n.actionRetry,
          icon: LucideIcons.refreshCw,
          onPressed: controller.onMicTap,
        );
      default:
        title = '';
        body = '';
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

SealMicState _sealStateFor(VidyaStatus status) {
  switch (status) {
    case VidyaStatus.listening:
      return SealMicState.listening;
    case VidyaStatus.transcribing:
      return SealMicState.transcribing;
    case VidyaStatus.thinking:
      return SealMicState.thinking;
    case VidyaStatus.speaking:
      return SealMicState.speaking;
    case VidyaStatus.idle:
    case VidyaStatus.requestingPermission:
    case VidyaStatus.micDenied:
    case VidyaStatus.signedOut:
    case VidyaStatus.limitReached:
    case VidyaStatus.failed:
      return SealMicState.idle;
  }
}

String? _captionFor(VidyaStatus status, AppLocalizations l10n) {
  switch (status) {
    case VidyaStatus.idle:
      return l10n.vidyaStateIdle;
    case VidyaStatus.requestingPermission:
      return l10n.vidyaStateReady;
    case VidyaStatus.listening:
      return l10n.vidyaStateListening;
    case VidyaStatus.transcribing:
    case VidyaStatus.thinking:
      return l10n.vidyaStateThinking;
    case VidyaStatus.speaking:
      return l10n.vidyaStateSpeaking;
    case VidyaStatus.micDenied:
    case VidyaStatus.signedOut:
    case VidyaStatus.limitReached:
    case VidyaStatus.failed:
      return null; // rendered as a panel
  }
}

bool _isTerminal(VidyaStatus s) =>
    s == VidyaStatus.signedOut ||
    s == VidyaStatus.micDenied ||
    s == VidyaStatus.limitReached ||
    s == VidyaStatus.failed;

String _terminalTitle(VidyaStatus s, AppLocalizations l10n) {
  switch (s) {
    case VidyaStatus.signedOut:
      return l10n.vidyaSignedOutTitle;
    case VidyaStatus.micDenied:
      return l10n.vidyaMicOffTitle;
    case VidyaStatus.limitReached:
      return l10n.vidyaLimitTitle;
    case VidyaStatus.failed:
      return l10n.vidyaErrorTitle;
    default:
      return l10n.vidyaStateIdle;
  }
}

/// The tool route a flow opens, or null for the three not-yet-built tools
/// (U-PD*). The full nav+prefill dispatcher (and inline field mics) is U-V6;
/// this is the minimal single-intent routing the home needs now.
String? _routeForFlow(VidyaFlow flow) {
  switch (flow) {
    case VidyaFlow.lessonPlan:
      return Routes.lessonPlan;
    case VidyaFlow.quizGenerator:
      return Routes.quizGenerator;
    case VidyaFlow.worksheetWizard:
      return Routes.worksheetWizard;
    case VidyaFlow.rubricGenerator:
      return Routes.rubricGenerator;
    case VidyaFlow.examPaper:
      return Routes.examPaper;
    case VidyaFlow.teacherTraining:
      return Routes.teacherTraining;
    case VidyaFlow.instantAnswer:
      return Routes.instantAnswer;
    case VidyaFlow.visualAidDesigner:
    case VidyaFlow.virtualFieldTrip:
    case VidyaFlow.videoStoryteller:
      return null;
  }
}

Map<String, String> _prefill(VidyaDirectiveParams p) {
  return {
    'topic': ?p.topic,
    'gradeLevel': ?p.gradeLevel,
    'subject': ?p.subject,
    'language': ?normaliseVidyaLanguage(p.language),
  };
}
