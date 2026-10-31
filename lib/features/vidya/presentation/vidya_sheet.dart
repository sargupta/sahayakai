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
import '../../../shared/widgets/secondary_button.dart';
import 'background_generation_controller.dart';
import 'deliverables_controller.dart';
import 'vidya_controller.dart';
import 'vidya_nav_dispatcher.dart';
import 'vidya_status_ui.dart';
import 'widgets/conversation_block.dart';
import 'widgets/vidya_orb.dart';

/// True while the VIDYA sheet (v3 Screen 04) is on screen. The floating orb
/// hides underneath it — Screen 04 puts the ONLY orb inside the sheet's header,
/// and a second orb riding over the composer would be a duplicate.
final vidyaSheetOpenProvider = StateProvider<bool>((ref) => false);

/// Opens VIDYA as a modal sheet from anywhere — the "co-teacher on every page"
/// affordance (SPEC §C.6). Reuses the SAME top-level [VidyaController] as the
/// home, so the conversation is continuous across surfaces.
Future<void> showVidyaSheet(BuildContext context, {String? pagePath}) {
  final path = pagePath ?? GoRouter.maybeOf(context)?.state.uri.path;
  final container = ProviderScope.containerOf(context, listen: false);
  container.read(vidyaSheetOpenProvider.notifier).state = true;
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
    rethrow;
  }
  return sheet.whenComplete(() {
    container.read(vidyaSheetOpenProvider.notifier).state = false;
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

  String _titleFor(VidyaStatus status) {
    switch (status) {
      case VidyaStatus.listening:
      case VidyaStatus.requestingPermission:
        return 'Listening…';
      case VidyaStatus.transcribing:
      case VidyaStatus.thinking:
        return 'Thinking…';
      case VidyaStatus.speaking:
        return 'Speaking…';
      case VidyaStatus.idle:
      case VidyaStatus.micDenied:
      case VidyaStatus.signedOut:
      case VidyaStatus.limitReached:
      case VidyaStatus.upgradeRequired:
      case VidyaStatus.failed:
        return 'Ask VIDYA';
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final state = ref.watch(vidyaControllerProvider);
    final controller = ref.read(vidyaControllerProvider.notifier);
    final terminal = isVidyaTerminal(state.status);
    final title = _titleFor(state.status);

    ref.listen(vidyaControllerProvider.select((s) => s.pendingNavigation), (
      _,
      directive,
    ) {
      if (directive == null) return;
      final route = VidyaNavDispatcher.routeForFlow(directive.flow);
      controller.consumeNavigation();
      final router = GoRouter.of(context);
      Navigator.of(context).pop();
      if (route != null) {
        final prefill = VidyaNavDispatcher.prefillFor(directive.params);
        router.push(route, extra: prefill.isEmpty ? null : prefill);
      }
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
    final pageLabel = _pageLabelFor(widget.pagePath ?? Routes.home, l10n);

    // Auto-scroll to the newest message unless the user has scrolled up.
    if (conversation.length != _lastMessageCount) {
      _lastMessageCount = conversation.length;
      if (_stickToBottom && conversation.isNotEmpty) {
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
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      VidyaOrb(
                        state: visual,
                        size: 56,
                        semanticLabel: l10n.appTitle,
                        onTap: () {
                          final unavailable =
                              state.status == VidyaStatus.micDenied ||
                              state.status == VidyaStatus.failed ||
                              state.status == VidyaStatus.signedOut ||
                              state.status == VidyaStatus.limitReached ||
                              state.status == VidyaStatus.upgradeRequired;
                          if (unavailable) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Mic permission needed — open Settings to enable.',
                                ),
                                duration: Duration(seconds: 2),
                              ),
                            );
                            return;
                          }
                          controller.onMicTap();
                        },
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              title,
                              style: text.titleMedium,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 1),
                            Text(
                              '$nativeLanguage · ${pageLabel ?? 'Home'}',
                              style: text.bodySmall?.copyWith(
                                color: AppColors.textMuted,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(LucideIcons.x),
                        tooltip: MaterialLocalizations.of(
                          context,
                        ).closeButtonTooltip,
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  _StatusLine(status: state.status, visual: visual),
                  if (terminal)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: _SheetTerminalPanel(
                        status: state.status,
                        controller: controller,
                      ),
                    )
                  else ...[
                    if (conversation.isEmpty)
                      Flexible(
                        child: _EmptyState(
                          onSuggestion: (route) {
                            Navigator.of(context).pop();
                            GoRouter.of(context).push(route);
                          },
                        ),
                      )
                    else
                      Flexible(
                        child: ListView.builder(
                          controller: _scroll,
                          shrinkWrap: true,
                          padding: const EdgeInsets.only(top: 8),
                          itemCount: conversation.length,
                          itemBuilder: (context, index) {
                            final block = conversation[index];
                            final firstOfGroup =
                                index == 0 ||
                                conversation[index - 1].role != block.role;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: ConversationBlockView(
                                block: block,
                                showTimestamp: firstOfGroup,
                                onChipTap: controller.dispatchDirective,
                              ),
                            );
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
                hintText: 'Type your question',
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
  const _StatusLine({required this.status, required this.visual});

  final VidyaStatus status;
  final VidyaOrbVisual visual;

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    final text = _statusText(status);
    final listening =
        status == VidyaStatus.listening ||
        status == VidyaStatus.requestingPermission;

    return SizedBox(
      height: 24,
      child: Row(
        children: [
          if (!listening && text != null)
            Expanded(
              child: Text(
                text,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: AppColors.textMuted),
              ),
            ),
          if (listening) ...[
            Text(
              'Listening…',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.textMuted),
            ),
            const SizedBox(width: 8),
            _Waveform(reduceMotion: reduceMotion),
          ],
        ],
      ),
    );
  }

  String? _statusText(VidyaStatus status) {
    // Duplicated helper kept local for the line's own copy.
    switch (status) {
      case VidyaStatus.idle:
        return null;
      case VidyaStatus.requestingPermission:
        return 'Getting the mic ready…';
      case VidyaStatus.transcribing:
        return 'Transcribing…';
      case VidyaStatus.thinking:
        return 'Thinking…';
      case VidyaStatus.speaking:
        return 'Speaking…';
      case VidyaStatus.listening:
        return null;
      default:
        return null;
    }
  }
}

class _Waveform extends StatefulWidget {
  const _Waveform({required this.reduceMotion});

  final bool reduceMotion;

  @override
  State<_Waveform> createState() => _WaveformState();
}

class _WaveformState extends State<_Waveform>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    if (!widget.reduceMotion) _c.repeat();
  }

  @override
  void didUpdateWidget(covariant _Waveform old) {
    super.didUpdateWidget(old);
    if (widget.reduceMotion) {
      _c.stop();
      _c.value = 0;
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final t = widget.reduceMotion ? 0.0 : _c.value;
        final heights = [
          8 + 12 * (0.5 + 0.5 * math.sin(t * 2 * math.pi)),
          12 + 10 * (0.5 + 0.5 * math.sin(t * 2 * math.pi + 1)),
          10 + 16 * (0.5 + 0.5 * math.sin(t * 2 * math.pi + 2)),
          9 + 11 * (0.5 + 0.5 * math.sin(t * 2 * math.pi + 3)),
        ];
        return Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            for (final h in heights)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 1.5),
                child: Container(
                  width: 3,
                  height: h,
                  decoration: BoxDecoration(
                    color: AppColors.accentFill,
                    // Stadium cap on a 3 px bar (radius clamps to 1.5).
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onSuggestion});

  final ValueChanged<String> onSuggestion;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final suggestions = <(String, String)>[
      ('Lesson plan', Routes.lessonPlan),
      ('Quiz', Routes.quizGenerator),
      ('Attendance', Routes.attendance),
    ];

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Ask VIDYA anything',
              style: text.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            Text(
              'Type a question or tap the mic to start.',
              style: text.bodySmall?.copyWith(color: AppColors.textMuted),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: AppSpacing.space2,
              runSpacing: AppSpacing.space2,
              children: [
                for (final suggestion in suggestions)
                  ActionChip(
                    label: Text(suggestion.$1),
                    onPressed: () => onSuggestion(suggestion.$2),
                  ),
              ],
            ),
          ],
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
    } else if (status == VidyaStatus.failed) {
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
            child: const Text('Type instead'),
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

String? _pageLabelFor(String? path, AppLocalizations l10n) {
  if (path == null || path.isEmpty) return null;
  final mapped = <String?>[
    if (path == Routes.home) l10n.navHome,
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
    if (path.startsWith(Routes.network)) l10n.networkTitle,
    if (path.startsWith(Routes.profile)) l10n.navProfile,
  ];
  return mapped.isNotEmpty ? mapped.first : null;
}
