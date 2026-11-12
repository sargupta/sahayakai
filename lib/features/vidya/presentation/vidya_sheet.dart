import 'dart:async';
import 'dart:math' as math;

// ignore_for_file: prefer_const_constructors
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/secondary_button.dart';
import 'background_generation_controller.dart';
import 'deliverables_controller.dart';
import 'vidya_controller.dart';
import 'vidya_nav_dispatcher.dart';
import 'vidya_status_ui.dart';
import 'widgets/conversation_block.dart';
import 'widgets/vidya_conversation.dart';
import 'widgets/vidya_orb.dart';

/// True while the VIDYA sheet (v3 Screen 04) is on screen. The floating orb
/// hides underneath it — Screen 04 puts the ONLY orb inside the sheet's header,
/// and a second orb riding over the composer would be a duplicate.
final vidyaSheetOpenProvider = StateProvider<bool>((ref) => false);

/// True while the VIDYA sheet itself is open (not the deliver tray, which also
/// sets [vidyaSheetOpenProvider]). The sheet then routes VIDYA's tool
/// directives itself; otherwise `VidyaToolLauncher` does.
final vidyaConversationSheetOpenProvider = StateProvider<bool>((ref) => false);

/// The shell tab on screen (0 Home, 1 Library, 2 Community, 3 Profile). All
/// four share the `/` route, so the sheet reads this to name the page.
final vidyaShellTabProvider = StateProvider<int>((ref) => 0);

/// Opens VIDYA as a modal sheet from anywhere — the "co-teacher on every page"
/// affordance (SPEC §C.6). Reuses the SAME top-level [VidyaController] as the
/// home, so the conversation is continuous across surfaces.
Future<void> showVidyaSheet(BuildContext context, {String? pagePath}) {
  final path = pagePath ?? GoRouter.maybeOf(context)?.state.uri.path;
  final container = ProviderScope.containerOf(context, listen: false);
  container.read(vidyaSheetOpenProvider.notifier).state = true;
  container.read(vidyaConversationSheetOpenProvider.notifier).state = true;
  late final Future<void> sheet;
  try {
    sheet = showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      elevation: 0,
      isScrollControlled: true,
      barrierColor: AppColors.ink900.withValues(alpha: 0.28),
      builder: (_) => VidyaSheet(pagePath: path),
    );
  } catch (_) {
    container.read(vidyaSheetOpenProvider.notifier).state = false;
    container.read(vidyaConversationSheetOpenProvider.notifier).state = false;
    rethrow;
  }
  return sheet.whenComplete(() {
    container.read(vidyaSheetOpenProvider.notifier).state = false;
    container.read(vidyaConversationSheetOpenProvider.notifier).state = false;
  });
}

/// A small app-bar action that opens the VIDYA sheet.
class VidyaAppBarAction extends StatelessWidget {
  const VidyaAppBarAction({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return IconButton(
      icon: const Icon(LucideIcons.sparkles),
      tooltip: l10n.vidyaOpen,
      onPressed: () => showVidyaSheet(context),
    );
  }
}

class VidyaSheet extends ConsumerStatefulWidget {
  const VidyaSheet({super.key, this.pagePath});

  final String? pagePath;

  @override
  ConsumerState<VidyaSheet> createState() => _VidyaSheetState();
}

class _VidyaSheetState extends ConsumerState<VidyaSheet>
    with SingleTickerProviderStateMixin {
  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();
  late final AnimationController _pulse;

  bool _stickToBottom = true;
  int _lastMessageCount = 0;
  VidyaOrbVisual _visualFor(VidyaStatus status, int readyCount, bool bgActive) {
    switch (status) {
      case VidyaStatus.requestingPermission:
      case VidyaStatus.listening:
        return VidyaOrbVisual.listening;
      case VidyaStatus.transcribing:
      case VidyaStatus.thinking:
      case VidyaStatus.speaking:
        return VidyaOrbVisual.working;
      case VidyaStatus.idle:
      case VidyaStatus.micDenied:
      case VidyaStatus.signedOut:
      case VidyaStatus.limitReached:
      case VidyaStatus.upgradeRequired:
      case VidyaStatus.notHeard:
      case VidyaStatus.failed:
        if (bgActive) return VidyaOrbVisual.working;
        return readyCount > 0 ? VidyaOrbVisual.ready : VidyaOrbVisual.resting;
    }
  }

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    );
    _scroll.addListener(() {
      if (!_scroll.hasClients) return;
      final pos = _scroll.position;
      _stickToBottom = pos.pixels >= pos.maxScrollExtent - 40;
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_pulse.isAnimating && context.motionEnabled) _pulse.repeat();
    if (!context.motionEnabled) {
      _pulse.stop();
      _pulse.value = 0;
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _input.text;
    _input.clear();
    if (mounted) setState(() {});
    await ref.read(vidyaControllerProvider.notifier).sendText(text);
  }

  /// The header title (UX map Listening screen): what VIDYA is doing, or
  /// "Heard you" once the teacher's words are in.
  String _titleFor(VidyaState state, AppLocalizations l10n) {
    switch (state.status) {
      case VidyaStatus.listening:
      case VidyaStatus.requestingPermission:
        return l10n.vidyaStateListening;
      case VidyaStatus.transcribing:
      case VidyaStatus.thinking:
        return l10n.vidyaStateThinking;
      case VidyaStatus.speaking:
        return l10n.vidyaStateSpeaking;
      case VidyaStatus.idle:
      case VidyaStatus.micDenied:
      case VidyaStatus.signedOut:
      case VidyaStatus.limitReached:
      case VidyaStatus.upgradeRequired:
      case VidyaStatus.notHeard:
      case VidyaStatus.failed:
        final heard = state.conversation.any(
          (b) => b.role == ConversationRole.teacher,
        );
        return heard ? l10n.vidyaHeardYou : l10n.vidyaOpen;
    }
  }

  /// What VIDYA will open once the teacher says "Looks right", or null when
  /// nothing is held.
  String? _heldLabel(VidyaState state, AppLocalizations l10n) {
    final nav = state.heldNavigation;
    if (nav != null) return vidyaFlowLabel(nav.flow, l10n);
    return state.heldScreen?.label(l10n);
  }

  /// The orb starts or stops listening in every state; only a denied mic
  /// sends the teacher to Settings, because a tap cannot fix that.
  void _onOrbTap(VidyaState state, VidyaController controller) {
    if (state.status == VidyaStatus.micDenied) {
      unawaited(controller.openMicSettings());
      return;
    }
    unawaited(controller.onMicTap());
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final state = ref.watch(vidyaControllerProvider);
    final controller = ref.read(vidyaControllerProvider.notifier);
    final terminal = isVidyaTerminal(state.status);
    final title = _titleFor(state, l10n);

    ref.listen(vidyaControllerProvider.select((s) => s.pendingNavigation), (
      _,
      directive,
    ) {
      if (directive == null) return;
      controller.consumeNavigation();
      final router = GoRouter.of(context);
      Navigator.of(context).pop();
      openVidyaTool(ref, router, directive);
    });

    final hasText = _input.text.trim().isNotEmpty;
    final readyCount = ref.watch(
      deliverablesControllerProvider.select((d) => d.length),
    );
    final bgActive = ref.watch(backgroundGenerationControllerProvider) != null;
    final visual = _visualFor(state.status, readyCount, bgActive);
    final conversation = state.conversation;

    final locale = Localizations.localeOf(context);
    final nativeLanguage = AppLocale.fromCode(locale.languageCode).nativeLabel;
    final pageLabel = _pageLabelFor(
      widget.pagePath ?? Routes.home,
      ref.watch(vidyaShellTabProvider),
      l10n,
    );
    final micOn =
        state.status == VidyaStatus.listening ||
        state.status == VidyaStatus.requestingPermission;
    final busy =
        state.status == VidyaStatus.transcribing ||
        state.status == VidyaStatus.thinking ||
        state.status == VidyaStatus.speaking;

    // The current turn: the teacher's latest words, quoted, and VIDYA's
    // replies to them. Earlier turns stay in the session, off the sheet.
    final lastTeacher = conversation.lastIndexWhere(
      (b) => b.role == ConversationRole.teacher,
    );
    final heard = lastTeacher < 0 ? null : conversation[lastTeacher].text;
    final replies = conversation.sublist(lastTeacher + 1);

    // Auto-scroll to the newest message unless the user has scrolled up.
    if (conversation.length != _lastMessageCount) {
      _lastMessageCount = conversation.length;
      if (_stickToBottom && replies.isNotEmpty) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scroll.hasClients) {
            final motion = context.motionEnabled;
            final target = _scroll.position.maxScrollExtent;
            if (!motion) {
              _scroll.jumpTo(target);
            } else {
              _scroll.animateTo(
                target,
                duration: const Duration(milliseconds: 200),
                curve: AppMotion.easeOutQuart,
              );
            }
          }
        });
      }
    }

    final insets = MediaQuery.viewInsetsOf(context).bottom;
    final maxHeight = MediaQuery.sizeOf(context).height * 0.72;
    final available = MediaQuery.sizeOf(context).height - insets;
    final sheetMax = available < maxHeight ? available : maxHeight;

    return Padding(
      padding: EdgeInsets.only(bottom: insets),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: sheetMax),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: AppColors.milk50,
            borderRadius: AppRadius.rSheet,
            boxShadow: [AppShadows.sheet],
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: AppSpacing.sheetPadding,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _GrabHandle(),
                  const SizedBox(height: AppSpacing.space3),
                  Row(
                    children: [
                      VidyaOrb(
                        state: visual,
                        size: 46,
                        semanticLabel: l10n.appTitle,
                        onTap: () => _onOrbTap(state, controller),
                      ),
                      const SizedBox(width: AppSpacing.space3),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              title,
                              style: text.titleMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              '$nativeLanguage · ${l10n.vidyaAboutThisPage}',
                              style: text.bodySmall?.copyWith(
                                color: AppColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // While a conversation is on: "Mic on" when she is
                      // listening, and End to close it. Otherwise the close X.
                      if (micOn) _MicOnPill(label: l10n.vidyaMicOn),
                      if (state.conversing)
                        const Padding(
                          padding: EdgeInsetsDirectional.only(start: 6),
                          child: VidyaEndButton(),
                        )
                      else if (!micOn)
                        IconButton(
                          onPressed: () => Navigator.of(context).pop(),
                          icon: const Icon(LucideIcons.x),
                          tooltip: MaterialLocalizations.of(
                            context,
                          ).closeButtonTooltip,
                        ),
                    ],
                  ),
                  if (micOn || busy) ...[
                    const SizedBox(height: AppSpacing.space2),
                    _StatusLine(
                      status: state.status,
                      conversing: state.conversing,
                      micHint: state.micHint,
                    ),
                  ],
                  if (pageLabel != null) ...[
                    const SizedBox(height: AppSpacing.space3),
                    _ThisPageCard(label: pageLabel),
                  ],
                  if (terminal)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.space3),
                      child: _SheetTerminalPanel(
                        status: state.status,
                        controller: controller,
                      ),
                    )
                  else ...[
                    if (heard != null)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.space3),
                        child: _HeardCard(
                          heard: heard,
                          willOpen: _heldLabel(state, l10n),
                          onRetry: () => unawaited(controller.retryHeard()),
                          onConfirm: controller.confirmHeard,
                        ),
                      ),
                    if (replies.isNotEmpty)
                      Flexible(
                        child: ListView.builder(
                          controller: _scroll,
                          shrinkWrap: true,
                          padding: const EdgeInsets.only(
                            top: AppSpacing.space3,
                          ),
                          itemCount: replies.length,
                          itemBuilder: (context, index) => Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.space2,
                            ),
                            child: ConversationBlockView(
                              block: replies[index],
                              showTimestamp: index == 0,
                              onChipTap: controller.dispatchDirective,
                            ),
                          ),
                        ),
                      )
                    else if (!busy)
                      Flexible(
                        child: _SuggestionRows(
                          suggestions: _suggestionsFor(
                            widget.pagePath ?? Routes.home,
                            ref.watch(vidyaShellTabProvider),
                            l10n,
                          ),
                          onSuggestion: (route) {
                            final router = GoRouter.of(context);
                            Navigator.of(context).pop();
                            router.push(route);
                          },
                        ),
                      ),
                    _buildComposer(text, l10n, controller, hasText, state),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildComposer(
    TextTheme text,
    AppLocalizations l10n,
    VidyaController controller,
    bool hasText,
    VidyaState state,
  ) {
    final isGenerating =
        state.status == VidyaStatus.thinking ||
        state.status == VidyaStatus.transcribing ||
        state.status == VidyaStatus.speaking;

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: TextField(
              controller: _input,
              maxLines: 4,
              minLines: 1,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) {
                if (hasText && !isGenerating) unawaited(_send());
              },
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: l10n.vidyaTypeHint,
                hintStyle: text.bodyMedium?.copyWith(
                  color: AppColors.textMuted,
                ),
                filled: true,
                fillColor: AppColors.milk300,
                border: const OutlineInputBorder(
                  borderRadius: AppRadius.rField,
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
              ),
              style: text.bodyMedium,
            ),
          ),
          const SizedBox(width: 8),
          if (isGenerating)
            SizedBox(
              width: 48,
              height: 48,
              child: IconButton(
                onPressed: () => controller.cancel(),
                icon: const Icon(LucideIcons.square, size: 18),
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.accentFill,
                  foregroundColor: Colors.white,
                ),
              ),
            )
          else
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: hasText ? () => unawaited(_send()) : controller.onMicTap,
              child: SizedBox(
                width: 48,
                height: 48,
                child: Center(
                  child: AnimatedBuilder(
                    animation: _pulse,
                    builder: (context, child) {
                      final t = _pulse.value;
                      final scale = hasText
                          ? 1.0
                          : 1 + 0.07 * (0.5 - 0.5 * math.cos(2 * math.pi * t));
                      return Transform.scale(scale: scale, child: child);
                    },
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: hasText
                            ? AppColors.accentFill
                            : _composerMicColor(state.status),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.accentFill.withValues(alpha: 0.36),
                            offset: const Offset(0, 5),
                            blurRadius: 14,
                          ),
                        ],
                      ),
                      child: Icon(
                        hasText ? LucideIcons.arrowUp : LucideIcons.mic,
                        size: 18,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Color _composerMicColor(VidyaStatus status) {
    // Mirrors the header mapping so the two mics never drift.
    switch (status) {
      case VidyaStatus.transcribing:
      case VidyaStatus.thinking:
      case VidyaStatus.speaking:
        return AppColors.indigo500;
      default:
        return AppColors.accentFill;
    }
  }
}

class _StatusLine extends StatelessWidget {
  const _StatusLine({
    required this.status,
    this.conversing = false,
    this.micHint = VidyaMicHint.none,
  });

  final VidyaStatus status;

  /// In a conversation the listening line says how to end it.
  final bool conversing;

  /// Too loud / too quiet: a short line of advice, only when it matters.
  final VidyaMicHint micHint;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final listening =
        status == VidyaStatus.listening ||
        status == VidyaStatus.requestingPermission;
    final line = listening
        ? (conversing ? l10n.vidyaSayStop : l10n.vidyaListeningSpeakNow)
        : _statusText(status, l10n);
    final style = Theme.of(
      context,
    ).textTheme.bodyMedium?.copyWith(color: AppColors.textMuted);
    final hint = switch (micHint) {
      VidyaMicHint.tooLoud => l10n.vidyaMicTooLoud,
      VidyaMicHint.tooQuiet => l10n.vidyaMicTooQuiet,
      VidyaMicHint.none => null,
    };
    // Words only, no graph: what to do, and a hint when the level is off.
    // Lines wrap (Indic scripts at large text), never clipped or ellipsized.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (listening && hint != null)
          Semantics(
            liveRegion: true,
            child: Container(
              key: const ValueKey('vidya-mic-hint'),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: const BoxDecoration(
                color: AppColors.tileAmberBg,
                borderRadius: AppRadius.rPill,
              ),
              child: Row(
                children: [
                  const Icon(
                    LucideIcons.volume1,
                    size: 18,
                    color: AppColors.saffron800,
                  ),
                  const SizedBox(width: AppSpacing.space2),
                  Expanded(
                    child: Text(
                      hint,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.saffron800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        if (listening && hint != null && line != null)
          const SizedBox(height: AppSpacing.space2),
        if (line != null) Text(line, style: style),
      ],
    );
  }

  String? _statusText(VidyaStatus status, AppLocalizations l10n) {
    switch (status) {
      case VidyaStatus.requestingPermission:
        return l10n.vidyaStateReady;
      case VidyaStatus.transcribing:
      case VidyaStatus.thinking:
        return l10n.vidyaStateThinking;
      case VidyaStatus.speaking:
        return l10n.vidyaStateSpeaking;
      case VidyaStatus.idle:
      case VidyaStatus.listening:
      case VidyaStatus.micDenied:
      case VidyaStatus.signedOut:
      case VidyaStatus.limitReached:
      case VidyaStatus.upgradeRequired:
      case VidyaStatus.notHeard:
      case VidyaStatus.failed:
        return null;
    }
  }
}

/// "I heard": the teacher's words as VIDYA understood them. When a spoken
/// request would open a tool or screen, it says which, and waits for "Looks
/// right" (or "Say it again", which listens afresh) before acting.
class _HeardCard extends StatelessWidget {
  const _HeardCard({
    required this.heard,
    required this.willOpen,
    required this.onRetry,
    required this.onConfirm,
  });

  final String heard;

  /// The tool or screen VIDYA will open; null when nothing is waiting.
  final String? willOpen;
  final VoidCallback onRetry;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final latin = Localizations.localeOf(context).languageCode == 'en';
    final eyebrow = l10n.vidyaIHeard;
    final held = willOpen;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          key: const ValueKey('vidya-heard-card'),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
          decoration: BoxDecoration(
            color: AppColors.milk300,
            borderRadius: AppRadius.rTile,
            border: Border.all(color: AppColors.borderHairline),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                latin ? eyebrow.toUpperCase() : eyebrow,
                style: text.labelMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  letterSpacing: latin ? 1.7 : 0,
                  color: AppColors.textEyebrow,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '\u201C$heard\u201D',
                style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              if (held != null) ...[
                const SizedBox(height: 4),
                Text(
                  l10n.vidyaHeldWillOpen(held),
                  style: text.bodyMedium?.copyWith(color: AppColors.textMuted),
                ),
              ],
            ],
          ),
        ),
        if (held != null) ...[
          const SizedBox(height: AppSpacing.space3),
          Row(
            children: [
              Expanded(
                child: SecondaryButton(
                  key: const ValueKey('vidya-say-again'),
                  label: l10n.vidyaSayAgain,
                  icon: LucideIcons.mic,
                  onPressed: onRetry,
                ),
              ),
              const SizedBox(width: AppSpacing.space3),
              Expanded(
                child: PrimaryButton(
                  key: const ValueKey('vidya-looks-right'),
                  label: l10n.vidyaLooksRight,
                  icon: LucideIcons.check,
                  onPressed: onConfirm,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/// What VIDYA can do from here, as rows to pick (UX map `SuggestionRow`s). The
/// first is the likeliest, so it carries the selected look.
class _SuggestionRows extends StatelessWidget {
  const _SuggestionRows({
    required this.suggestions,
    required this.onSuggestion,
  });

  /// (label, route) pairs, likeliest first — see [_suggestionsFor].
  final List<(String, String)> suggestions;
  final ValueChanged<String> onSuggestion;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;

    return SingleChildScrollView(
      padding: const EdgeInsets.only(top: AppSpacing.space3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (index, suggestion) in suggestions.indexed)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.space2),
              child: Material(
                color: index == 0 ? AppColors.accentTint : AppColors.milk50,
                shape: RoundedRectangleBorder(
                  borderRadius: AppRadius.rCard,
                  side: BorderSide(
                    color: index == 0
                        ? AppColors.accentTintBorder
                        : AppColors.ink900.withValues(alpha: 0.08),
                  ),
                ),
                child: InkWell(
                  borderRadius: AppRadius.rCard,
                  onTap: () => onSuggestion(suggestion.$2),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 48),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.space4,
                        vertical: AppSpacing.space3,
                      ),
                      child: Row(
                        children: [
                          ExcludeSemantics(
                            child: Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: index == 0
                                    ? AppColors.accentFill
                                    : AppColors.textFaint,
                              ),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.space3),
                          Expanded(
                            child: Text(
                              suggestion.$1,
                              style: text.bodyMedium?.copyWith(
                                color: AppColors.textStrong,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// "THIS PAGE · My Library": the page VIDYA is reading before she acts (design
/// guide: context first).
class _ThisPageCard extends StatelessWidget {
  const _ThisPageCard({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final latin = Localizations.localeOf(context).languageCode == 'en';
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.milk300,
        borderRadius: AppRadius.rCard,
        border: Border.all(color: AppColors.ink900.withValues(alpha: 0.06)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.space4,
          vertical: AppSpacing.space3,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              latin ? l10n.vidyaThisPage.toUpperCase() : l10n.vidyaThisPage,
              style: text.labelMedium?.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: latin ? 1.7 : 0,
                color: AppColors.textEyebrow,
              ),
            ),
            const SizedBox(height: AppSpacing.space1),
            Text(
              label,
              style: text.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: AppColors.textStrong,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The leaf "Mic on" pill, shown whenever the sheet's microphone is open
/// (design guide: no background listening, and the teacher can always see it).
class _MicOnPill extends StatelessWidget {
  const _MicOnPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.leaf100,
        borderRadius: AppRadius.rPill,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.space3,
          vertical: AppSpacing.space1,
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.leaf700,
          ),
        ),
      ),
    );
  }
}

class _SheetTerminalPanel extends ConsumerWidget {
  const _SheetTerminalPanel({required this.status, required this.controller});

  final VidyaStatus status;
  final VidyaController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;

    Widget? action;
    if (status == VidyaStatus.micDenied) {
      action = SecondaryButton(
        label: l10n.vidyaOpenSettings,
        icon: LucideIcons.settings,
        onPressed: controller.openMicSettings,
      );
    } else if (status == VidyaStatus.failed || status == VidyaStatus.notHeard) {
      action = SecondaryButton(
        label: l10n.actionRetry,
        icon: LucideIcons.refreshCw,
        onPressed: controller.onMicTap,
      );
    } else if (status == VidyaStatus.upgradeRequired) {
      action = SecondaryButton(
        label: l10n.vidyaSeePricing,
        icon: LucideIcons.creditCard,
        onPressed: () => openVidyaPricing(ref),
      );
    }

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 360),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            vidyaTerminalTitle(status, l10n),
            style: text.titleMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.space2),
          Text(
            vidyaTerminalBody(status, l10n),
            style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
            textAlign: TextAlign.center,
          ),
          if (action != null) ...[
            const SizedBox(height: AppSpacing.space4),
            action,
          ],
          const SizedBox(height: AppSpacing.space3),
          TextButton(
            onPressed: controller.dismissTerminal,
            child: Text(l10n.vidyaTypeInstead),
          ),
        ],
      ),
    );
  }
}

class _GrabHandle extends StatelessWidget {
  const _GrabHandle();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.space3),
      child: Center(
        child: Container(
          width: 44,
          height: 4,
          decoration: ShapeDecoration(
            color: AppColors.ink900.withValues(alpha: 0.14),
            shape: const StadiumBorder(),
          ),
        ),
      ),
    );
  }
}

/// What VIDYA offers from the page behind her sheet, likeliest first (the
/// map's "Ask in place": the suggestions follow the page). Same page reading
/// as [_pageLabelFor]: on the shell route the tab decides.
List<(String, String)> _suggestionsFor(
  String path,
  int shellTab,
  AppLocalizations l10n,
) {
  final lesson = (l10n.homeTileLesson, Routes.lessonPlan);
  final rollCall = (l10n.homeTileRollCall, Routes.attendance);
  final scan = (l10n.homeTileScan, Routes.assessmentScanner);
  final callParents = (l10n.homeTileCall, Routes.parentHotline);
  final quiz = (l10n.vidyaSuggestQuiz, Routes.quizGenerator);
  final worksheet = (l10n.vidyaSuggestWorksheet, Routes.worksheetWizard);
  final allTools = (l10n.vidyaSuggestAllTools, Routes.prepDesk);

  final tab = path == Routes.home ? shellTab : -1;
  if (tab == 1 || path.startsWith(Routes.library)) {
    return [lesson, quiz, allTools];
  }
  if (tab == 2 ||
      path.startsWith(Routes.staffroom) ||
      path.startsWith(Routes.network) ||
      path.startsWith(Routes.inbox)) {
    return [
      (l10n.vidyaSuggestPostToWorksheet, Routes.worksheetWizard),
      lesson,
      callParents,
    ];
  }
  if (tab == 3 ||
      path.startsWith(Routes.profile) ||
      path.startsWith(Routes.settings)) {
    return [lesson, rollCall, allTools];
  }
  if (path.startsWith(Routes.attendance) ||
      path.startsWith(Routes.parentHotline) ||
      path.startsWith(Routes.parentMessage)) {
    return [callParents, rollCall, scan];
  }
  if (path.startsWith(Routes.lessonPlan)) return [quiz, worksheet, scan];
  if (path.startsWith(Routes.assessmentScanner) ||
      path.startsWith(Routes.quizGenerator) ||
      path.startsWith(Routes.examPaper) ||
      path.startsWith(Routes.rubricGenerator)) {
    return [worksheet, callParents, lesson];
  }
  return [lesson, rollCall, scan];
}

String? _pageLabelFor(String? path, int shellTab, AppLocalizations l10n) {
  if (path == null || path.isEmpty) return null;
  final mapped = <String?>[
    if (path == Routes.home)
      switch (shellTab) {
        1 => l10n.libraryTitle,
        2 => l10n.communityTitle,
        3 => l10n.navProfile,
        _ => l10n.navHome,
      },
    if (path.startsWith('/attendance')) l10n.attendanceTitle,
    if (path.startsWith(Routes.lessonPlan)) l10n.lessonPlanTitle,
    if (path.startsWith(Routes.quizGenerator)) l10n.quizTitle,
    if (path.startsWith(Routes.rubricGenerator)) l10n.rubricTitle,
    if (path.startsWith(Routes.worksheetWizard)) l10n.worksheetTitle,
    if (path.startsWith(Routes.examPaper)) l10n.examPaperTitle,
    if (path.startsWith(Routes.assessmentScanner)) l10n.assessmentScannerTitle,
    if (path.startsWith(Routes.instantAnswer)) l10n.instantAnswerTitle,
    if (path.startsWith(Routes.visualAid)) l10n.visualAidTitle,
    if (path.startsWith(Routes.videoStoryteller)) l10n.videoStorytellerTitle,
    if (path.startsWith(Routes.virtualFieldTrip)) l10n.virtualFieldTripTitle,
    if (path.startsWith(Routes.contentCreator)) l10n.contentCreatorTitle,
    if (path.startsWith(Routes.teacherTraining)) l10n.teacherTrainingTitle,
    if (path.startsWith(Routes.parentMessage)) l10n.parentMessageTitle,
    if (path.startsWith(Routes.parentHotline)) l10n.parentHotlineTitle,
    if (path.startsWith(Routes.inbox)) l10n.inboxTitle,
    if (path.startsWith(Routes.library)) l10n.libraryTitle,
    if (path.startsWith(Routes.settings)) l10n.settingsTitle,
    if (path.startsWith(Routes.staffroom)) l10n.staffroomTitle,
    if (path.startsWith(Routes.network)) l10n.communityTitle,
    if (path.startsWith(Routes.profile)) l10n.navProfile,
  ];
  return mapped.isNotEmpty ? mapped.first : null;
}
