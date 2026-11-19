import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/platform/clock.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/tool_prefill.dart';
import '../../../shared/domain/tool_registry.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/language_switcher.dart';
import '../../../shared/widgets/map_icon_tile.dart';
import '../../../shared/widgets/tool_tint.dart';
import '../../attendance/presentation/attendance_providers.dart';
import '../../inbox/data/messages_stream_provider.dart';
import '../../inbox/presentation/widgets/inbox_entry_button.dart';
import '../../notifications/data/notifications_store.dart';
import '../../notifications/domain/teacher_notification.dart';
import '../../notifications/presentation/widgets/notification_row.dart'
    show notificationTitle;
import '../../parent_hotline/presentation/hotline_copy.dart' show firstName;
import '../../parent_hotline/presentation/parent_hotline_controller.dart';
import '../../profile/domain/teacher_profile.dart';
import '../../profile/presentation/profile_controller.dart';
import '../domain/deliverable.dart';
import 'deliver_tray.dart';
import 'deliverables_controller.dart';
import 'vidya_controller.dart';
import 'vidya_greeting.dart' show maybeSpeakVidyaGreeting;
import 'vidya_presence.dart';
import 'vidya_sheet.dart';
import 'widgets/vidya_orb.dart';

/// The Home tab: voice-first, the mic is the screen (UX map H-01).
///
/// Top to bottom: the teacher's header (avatar → Me, the day, her name, the
/// language pill, messages, and — only while VIDYA holds a thread — clear it);
/// "Ask for anything in the app"; three example requests that open their tool
/// prefilled ("Say it, she routes it"); VIDYA as a big orb that carries her
/// state; the type box; then what is waiting, the eight everyday tools and
/// "Explore all 15 tools".
///
/// The big orb is VIDYA on Home, so the shell hides the docked orb on this tab.
/// Everything "waiting" is real: ready results, unread messages and unread
/// updates — never a sample count.
class VidyaHomeScreen extends ConsumerStatefulWidget {
  const VidyaHomeScreen({super.key, this.onOpenTab});

  /// Switches the shell to another tab (avatar → Me, updates → Community).
  /// Null outside the shell, where those taps fall back to pushing a route.
  final ValueChanged<int>? onOpenTab;

  /// The shell's tab indices Home opens.
  static const int communityTab = 2;
  static const int meTab = 3;

  @override
  ConsumerState<VidyaHomeScreen> createState() => _VidyaHomeScreenState();
}

class _VidyaHomeScreenState extends ConsumerState<VidyaHomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final controller = ref.read(vidyaControllerProvider.notifier);
      controller.registerScreenContext(Routes.home);
      // Cold start stays fresh: do not restore a previous VIDYA thread here.
      // Manual pull-to-refresh can still reload, and stored threads remain
      // accessible via the history list / backend.
      maybeSpeakVidyaGreeting(
        ref,
        motionEnabled: context.motionEnabled,
        greeting: context.l10n.vidyaGreeting,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    // VIDYA's tool directives are routed app-wide by VidyaToolLauncher.

    final profile = ref.watch(profileControllerProvider).valueOrNull;

    // Background is provided by AppBackground in app.dart — keep Scaffold
    // transparent so it shows through.
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          Positioned.fill(child: _homeScroll(context, profile)),
          // A soft fade behind the floating tab bar, so a card scrolling
          // under it never clashes with the Home pill. Under the bar only;
          // taps and the screen reader pass straight through.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: MediaQuery.paddingOf(context).bottom + AppSpacing.space6,
            child: const IgnorePointer(
              child: ExcludeSemantics(
                child: DecoratedBox(
                  key: ValueKey('home-dock-fade'),
                  decoration: BoxDecoration(gradient: AppGradients.dockFade),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _homeScroll(BuildContext context, TeacherProfile? profile) {
    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: () async {
          try {
            await ref.read(profileControllerProvider.notifier).refresh();
          } catch (_) {}
        },
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.screenGutter,
            AppSpacing.space4,
            AppSpacing.screenGutter,
            // Clears the floating tab bar (the shell's Scaffold extends
            // the body under it and reports its height here).
            MediaQuery.paddingOf(context).bottom + AppSpacing.space8,
          ),
          physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics(),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _HeaderRow(onOpenTab: widget.onOpenTab),
              const SizedBox(height: AppSpacing.space6),
              const _AskHeading(),
              const SizedBox(height: AppSpacing.space3),
              const _SayItList(),
              const _BigOrb(),
              const _AskBox(),
              const SizedBox(height: AppSpacing.space8),
              _WaitingCard(onOpenTab: widget.onOpenTab),
              const SizedBox(height: AppSpacing.space6),
              if (profile != null && profile.isEmpty) ...[
                const _CompleteProfileCard(),
                const SizedBox(height: AppSpacing.space6),
              ],
              _Eyebrow(context.l10n.homeYourTools),
              const SizedBox(height: AppSpacing.space3),
              const _ToolGrid(),
              const SizedBox(height: AppSpacing.space3),
              const _AllToolsLink(),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Header: avatar, day and name, language, messages ───────────────────────

class _HeaderRow extends ConsumerWidget {
  const _HeaderRow({required this.onOpenTab});

  final ValueChanged<int>? onOpenTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final profile = ref.watch(profileControllerProvider).valueOrNull;
    final storedName = profile?.displayName?.trim();
    final hasName = storedName != null && storedName.isNotEmpty;
    final initials = hasName ? _initialsOf(storedName) : null;
    final today = _formatToday(context, ref.read(nowProvider)());
    final language = ref.watch(localeControllerProvider);
    final hasConversation = ref.watch(
      vidyaControllerProvider.select((s) => s.hasConversation),
    );

    return Row(
      children: [
        Semantics(
          button: true,
          label: l10n.navProfile,
          excludeSemantics: true,
          child: Material(
            color: Colors.transparent,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => _openMe(context),
              child: Container(
                width: AppSpacing.targetMin,
                height: AppSpacing.targetMin,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.surfaceGlass,
                  border: Border.all(color: AppColors.borderHairline),
                ),
                alignment: Alignment.center,
                child: initials == null
                    ? const Icon(
                        LucideIcons.user,
                        size: 18,
                        color: AppColors.textBody,
                      )
                    : Text(
                        initials,
                        style: text.labelMedium?.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textBody,
                        ),
                      ),
              ),
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.space3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                today,
                style: text.bodyMedium?.copyWith(color: AppColors.textMuted),
              ),
              if (hasName)
                Text(
                  storedName,
                  style: text.titleLarge?.copyWith(
                    fontSize: 15,
                    color: AppColors.textStrong,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.space2),
        _LanguagePill(label: language.nativeLabel),
        const InboxEntryButton(),
        // Only while VIDYA holds a thread: the one place to start fresh.
        if (hasConversation)
          IconButton(
            icon: const Icon(LucideIcons.trash2, size: 20),
            tooltip: l10n.vidyaClearConversation,
            onPressed: ref
                .read(vidyaControllerProvider.notifier)
                .clearConversation,
          ),
      ],
    );
  }

  void _openMe(BuildContext context) {
    final open = onOpenTab;
    if (open != null) {
      open(VidyaHomeScreen.meTab);
    } else {
      context.push(Routes.profile);
    }
  }
}

/// The app language as a small saffron-text pill; a tap opens the one
/// language picker every surface shares.
class _LanguagePill extends ConsumerWidget {
  const _LanguagePill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      label: '${context.l10n.languageLabel}: $label',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: AppRadius.rPill,
        onTap: () => showLanguagePickerSheet(context, ref),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: AppSpacing.targetMin),
          child: Center(
            widthFactor: 1,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.surfaceGlass,
                borderRadius: AppRadius.rPill,
                border: Border.all(color: AppColors.borderHairline),
              ),
              child: Text(
                label,
                style: text.labelMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textEyebrow,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─── "Ask for anything in the app" ──────────────────────────────────────────

class _AskHeading extends StatelessWidget {
  const _AskHeading();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Eyebrow(l10n.homeAskEyebrow),
        const SizedBox(height: AppSpacing.space1),
        Semantics(
          header: true,
          child: Text(
            l10n.homeAskTitle,
            style: text.displayLarge?.copyWith(
              fontSize: 30,
              color: AppColors.textStrong,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.space2),
        Text(
          l10n.homeAskSubtitle,
          style: text.bodyLarge?.copyWith(
            fontSize: 13,
            color: AppColors.textBody,
          ),
        ),
        const SizedBox(height: AppSpacing.space4),
        _Eyebrow(l10n.homeSayEyebrow, color: AppColors.textBody),
      ],
    );
  }
}

/// A tracked eyebrow: uppercase in Latin script only, never for Indic text.
class _Eyebrow extends StatelessWidget {
  const _Eyebrow(this.label, {this.color = AppColors.textEyebrow});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final latin = Localizations.localeOf(context).languageCode == 'en';
    return Text(
      latin ? label.toUpperCase() : label,
      style: Theme.of(context).textTheme.labelMedium?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: latin ? 1.7 : 0,
        color: color,
      ),
    );
  }
}

// ─── "Say it, she routes it" ────────────────────────────────────────────────

class _SayItList extends StatelessWidget {
  const _SayItList();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      children: [
        _SayItRow(
          key: const ValueKey('home-say-lesson'),
          phrase: l10n.homeSayLesson,
          tool: l10n.lessonPlanTitle,
          color: AppColors.saffron600,
          onTap: () => context.push(
            Routes.lessonPlan,
            extra: ToolPrefill(
              topic: l10n.homeSayLessonTopic,
              gradeLevel: 'Class 7',
            ),
          ),
        ),
        const SizedBox(height: 7),
        _SayItRow(
          key: const ValueKey('home-say-quiz'),
          phrase: l10n.homeSayQuiz,
          tool: l10n.quizTitle,
          color: AppColors.indigo500,
          onTap: () => context.push(
            Routes.quizGenerator,
            extra: const ToolPrefill(questionCount: 10, difficulty: 'medium'),
          ),
        ),
        const SizedBox(height: 7),
        _SayItRow(
          key: const ValueKey('home-say-attendance'),
          phrase: l10n.homeSayAttendance,
          tool: l10n.attendanceTitle,
          color: AppColors.leaf500,
          onTap: () => context.push(Routes.attendance),
        ),
      ],
    );
  }
}

/// One example request: the words on the left, the tool it opens on the right.
/// The whole row is one button, named by both.
class _SayItRow extends StatelessWidget {
  const _SayItRow({
    super.key,
    required this.phrase,
    required this.tool,
    required this.color,
    required this.onTap,
  });

  final String phrase;
  final String tool;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      label: '$phrase, $tool',
      excludeSemantics: true,
      child: Material(
        color: AppColors.surfaceCard,
        borderRadius: AppRadius.rField,
        child: InkWell(
          borderRadius: AppRadius.rField,
          onTap: onTap,
          child: Container(
            constraints: const BoxConstraints(minHeight: AppSpacing.targetMin),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              borderRadius: AppRadius.rField,
              border: Border.all(color: AppColors.borderHairline),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    phrase,
                    style: text.bodyMedium?.copyWith(
                      fontSize: 13,
                      color: AppColors.textStrong,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.space3),
                Text(
                  tool,
                  style: text.labelMedium?.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
                Icon(LucideIcons.chevronRight, size: 14, color: color),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── The big VIDYA orb ──────────────────────────────────────────────────────

/// VIDYA on Home: a 144px orb that carries her state like every other orb
/// (saffron resting, indigo working, green with a count when something is
/// ready), with the words for what a tap does under it.
class _BigOrb extends ConsumerWidget {
  const _BigOrb();

  static const double _size = 144;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    var visual = ref.watch(vidyaOrbVisualProvider);
    // The big orb never lifts: drag-to-perch belongs to the floating orb.
    if (visual == VidyaOrbVisual.dragging) visual = VidyaOrbVisual.resting;
    final readyCount = ref.watch(vidyaReadyCountProvider);
    final label = switch (visual) {
      VidyaOrbVisual.resting || VidyaOrbVisual.dragging => l10n.homeOrbRest,
      VidyaOrbVisual.listening => l10n.vidyaStateListening,
      VidyaOrbVisual.working => l10n.vidyaWorkingTitle,
      VidyaOrbVisual.ready => l10n.vidyaDockReadyHint,
      VidyaOrbVisual.offline => l10n.homeOrbOffline,
    };
    final shadows = switch (visual) {
      VidyaOrbVisual.working => AppShadows.orbHeroWorking,
      VidyaOrbVisual.ready => AppShadows.orbHeroReady,
      VidyaOrbVisual.offline => AppShadows.orbHeroOffline,
      _ => AppShadows.orbHero,
    };

    void open() => openVidyaFromOrb(context, ref, visual, Routes.home);

    return Padding(
      padding: const EdgeInsets.only(top: 26, bottom: AppSpacing.space4),
      child: Column(
        children: [
          VidyaOrb(
            key: const ValueKey('home-big-orb'),
            state: visual,
            size: _size,
            readyCount: readyCount,
            shadows: shadows,
            semanticLabel: l10n.appTitle,
            semanticHint: label,
            onTap: open,
            onLongPress: open,
          ),
          const SizedBox(height: AppSpacing.space2),
          ExcludeSemantics(
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.textStrong,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── The type box ───────────────────────────────────────────────────────────

/// "Ask VIDYA, or type what you need…": a typed request goes to VIDYA in her
/// sheet over Home, which answers it or opens the right tool, exactly as a
/// spoken one would. The mic is the same as tapping the orb.
class _AskBox extends ConsumerStatefulWidget {
  const _AskBox();

  @override
  ConsumerState<_AskBox> createState() => _AskBoxState();
}

class _AskBoxState extends ConsumerState<_AskBox> {
  final _controller = TextEditingController();
  final _focus = FocusNode();

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _send() {
    final message = _controller.text.trim();
    if (message.isEmpty) {
      _focus.requestFocus();
      return;
    }
    _controller.clear();
    _focus.unfocus();
    showVidyaSheet(context, pagePath: Routes.home);
    ref.read(vidyaControllerProvider.notifier).sendText(message);
  }

  void _speak() {
    _focus.unfocus();
    showVidyaSheet(context, pagePath: Routes.home);
    ref.read(vidyaControllerProvider.notifier).onMicTap();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(18, 4, 4, 4),
          decoration: const BoxDecoration(
            color: AppColors.surfaceCard,
            borderRadius: AppRadius.rPill,
            boxShadow: [AppShadows.float],
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  key: const ValueKey('home-ask-field'),
                  controller: _controller,
                  focusNode: _focus,
                  minLines: 1,
                  maxLines: 3,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _send(),
                  style: text.bodyLarge?.copyWith(color: AppColors.textStrong),
                  decoration: InputDecoration(
                    isCollapsed: true,
                    filled: false,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    hintText: l10n.homeAskPlaceholder,
                    hintStyle: text.bodyLarge?.copyWith(
                      fontSize: 13,
                      color: AppColors.textMuted,
                    ),
                  ),
                ),
              ),
              _RoundButton(
                key: const ValueKey('home-ask-send'),
                label: l10n.deliverSend,
                icon: LucideIcons.send,
                diameter: 36,
                fill: AppColors.ink900.withValues(alpha: 0.07),
                iconColor: AppColors.textBody,
                onTap: _send,
              ),
              _RoundButton(
                key: const ValueKey('home-ask-mic'),
                label: l10n.homeSpeakToVidya,
                icon: LucideIcons.mic,
                diameter: 40,
                fill: AppColors.accentFill,
                iconColor: AppColors.textOnAccent,
                onTap: _speak,
                onLongPress: _speak,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.space2),
        Text(
          l10n.homeAskCaption,
          textAlign: TextAlign.center,
          style: text.bodyMedium?.copyWith(color: AppColors.textMuted),
        ),
      ],
    );
  }
}

/// A round icon control drawn at [diameter] inside a 44px touch area.
class _RoundButton extends StatelessWidget {
  const _RoundButton({
    super.key,
    required this.label,
    required this.icon,
    required this.diameter,
    required this.fill,
    required this.iconColor,
    required this.onTap,
    this.onLongPress,
  });

  final String label;
  final IconData icon;
  final double diameter;
  final Color fill;
  final Color iconColor;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        onLongPress: onLongPress,
        child: SizedBox.square(
          dimension: AppSpacing.targetMin,
          child: Center(
            child: Container(
              width: diameter,
              height: diameter,
              decoration: BoxDecoration(color: fill, shape: BoxShape.circle),
              alignment: Alignment.center,
              child: Icon(icon, size: diameter * 0.45, color: iconColor),
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Waiting for you ────────────────────────────────────────────────────────

/// What needs the teacher, from real state only: a parent call left running,
/// today's absentees, results VIDYA finished in the background, unread
/// messages and unread updates.
///
/// The eyebrow sits above the card, like "Your tools", with how many things
/// wait beside it. Each item is one row: its icon, what it is, a detail line
/// when the data has one (the result's subtitle, the newest chat, the newest
/// update) and the action a tap takes. Nothing waiting is one slim line.
class _WaitingCard extends ConsumerWidget {
  const _WaitingCard({required this.onOpenTab});

  final ValueChanged<int>? onOpenTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final ready = ref.watch(deliverablesControllerProvider);
    final unreadMessages = ref
        .watch(unreadConversationsProvider)
        .maybeWhen(
          data: (snapshot) => snapshot.isReady ? snapshot.data : 0,
          orElse: () => 0,
        );
    final newestChat = unreadMessages > 0 ? _newestUnreadChat(ref) : null;
    final unreadUpdates = ref.watch(unreadNotificationCountProvider);
    TeacherNotification? newestUpdate;
    if (unreadUpdates > 0) {
      for (final n in ref.watch(notificationsProvider)) {
        if (n.isRead) continue;
        if (newestUpdate == null || n.at.isAfter(newestUpdate.at)) {
          newestUpdate = n;
        }
      }
    }
    // Students marked absent today in a SAVED register: the map's "N
    // absentees to call" reminder. Zero while loading or on a failed read —
    // a reminder never shows an error.
    final absentToday = ref
        .watch(todayAbsentCountProvider)
        .maybeWhen(data: (n) => n, orElse: () => 0);
    // A parent call the teacher left running (the hotline controller lives
    // on; the call carries on server-side). Tapping returns to it.
    final callingStudent = ref.watch(
      parentHotlineControllerProvider.select(
        (s) =>
            s.stage == HotlineStage.calling &&
                (s.outreachId?.isNotEmpty ?? false)
            ? s.studentName?.trim()
            : null,
      ),
    );

    final rows = <Widget>[
      if (callingStudent != null && callingStudent.isNotEmpty)
        _WaitingRow(
          icon: LucideIcons.phoneCall,
          tint: MapTint.leaf,
          label: l10n.homeWaitingParentCall(firstName(callingStudent)),
          action: l10n.actionOpen,
          onOpen: () => context.push(Routes.parentHotline),
        ),
      // While a call is running the row above already leads to outreach.
      if (absentToday > 0 && (callingStudent?.isEmpty ?? true))
        _WaitingRow(
          icon: LucideIcons.userX,
          tint: MapTint.saffron,
          label: l10n.attendanceCallParents(absentToday),
          action: l10n.homeBriefingActionCall,
          onOpen: () => context.push(Routes.parentHotline),
        ),
      for (final Deliverable item in ready.reversed.take(3))
        _WaitingRow(
          icon: LucideIcons.fileCheck,
          tint: MapTint.leaf,
          label: l10n.homeWaitingReady(item.title),
          detail: item.subtitle,
          action: l10n.actionOpen,
          onOpen: () => showDeliverTray(context, item),
        ),
      if (unreadMessages > 0)
        _WaitingRow(
          icon: LucideIcons.messageCircle,
          tint: MapTint.indigo,
          label:
              '${l10n.inboxTitle} · ${l10n.inboxUnreadLabel(unreadMessages)}',
          detail: newestChat,
          action: l10n.homeWaitingRead,
          onOpen: () => context.push(Routes.inbox),
        ),
      if (unreadUpdates > 0)
        _WaitingRow(
          icon: LucideIcons.bell,
          tint: MapTint.amber,
          label: l10n.homeWaitingUpdates(unreadUpdates),
          detail: newestUpdate == null
              ? null
              : notificationTitle(newestUpdate, l10n),
          action: l10n.homeWaitingSee,
          onOpen: () {
            final open = onOpenTab;
            if (open != null) {
              open(VidyaHomeScreen.communityTab);
            } else {
              context.push(Routes.network);
            }
          },
        ),
    ];

    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(child: _Eyebrow(l10n.homeEyebrowWaiting)),
            if (rows.isNotEmpty)
              Text(
                l10n.homeWaitingCount(rows.length),
                style: text.bodySmall?.copyWith(
                  fontSize: 12.5,
                  color: AppColors.textMuted,
                ),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.space2),
        Container(
          padding: rows.isEmpty
              ? const EdgeInsets.symmetric(horizontal: 16, vertical: 15)
              : const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
          decoration: BoxDecoration(
            color: AppColors.surfaceGlass,
            borderRadius: AppRadius.rCard,
            border: Border.all(color: AppColors.borderGlass),
            boxShadow: const [AppShadows.card],
          ),
          child: rows.isEmpty
              ? Row(
                  children: [
                    const Icon(
                      LucideIcons.checkCircle,
                      size: 20,
                      color: AppColors.tileLeafInk,
                    ),
                    const SizedBox(width: AppSpacing.space3),
                    Expanded(
                      child: Text(
                        l10n.homeWaitingNothing,
                        style: text.bodyLarge?.copyWith(
                          color: AppColors.textBody,
                        ),
                      ),
                    ),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < rows.length; i++) ...[
                      if (i > 0)
                        const Divider(
                          height: 1,
                          color: AppColors.borderHairline,
                        ),
                      rows[i],
                    ],
                  ],
                ),
        ),
      ],
    );
  }

  /// The newest conversation with something unread for this teacher, as
  /// "Name: last message". Null while the list loads or has no such chat.
  static String? _newestUnreadChat(WidgetRef ref) {
    final myUid = ref.watch(currentInboxUserIdProvider);
    if (myUid == null) return null;
    final list = ref
        .watch(inboxListProvider)
        .maybeWhen(
          data: (snapshot) => snapshot.isReady ? snapshot.data : null,
          orElse: () => null,
        );
    if (list == null) return null;
    for (final chat in list) {
      if (chat.unreadFor(myUid) <= 0) continue;
      final message = chat.lastMessage.trim();
      if (message.isEmpty) return null;
      final who = (chat.otherParticipant(myUid)?.displayName ?? chat.name)
          ?.trim();
      return who == null || who.isEmpty ? message : '$who: $message';
    }
    return null;
  }
}

/// One waiting item: its icon in a tint, what it is, a detail line when there
/// is one, and the action as a pill. The whole row is one button; the icon is
/// never the only signal — the words say what is waiting.
class _WaitingRow extends StatelessWidget {
  const _WaitingRow({
    required this.icon,
    required this.tint,
    required this.label,
    required this.action,
    required this.onOpen,
    this.detail,
  });

  final IconData icon;
  final MapTint tint;
  final String label;
  final String? detail;
  final String action;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final detail = this.detail?.trim();
    final hasDetail = detail != null && detail.isNotEmpty;
    return Semantics(
      button: true,
      label: [label, if (hasDetail) detail, action].join(', '),
      excludeSemantics: true,
      child: InkWell(
        onTap: onOpen,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 62),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.space2),
            child: Row(
              children: [
                MapIconTile(icon: icon, tint: tint),
                const SizedBox(width: AppSpacing.space3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        label,
                        style: text.bodyLarge?.copyWith(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textStrong,
                        ),
                      ),
                      if (hasDetail) ...[
                        const SizedBox(height: 2),
                        // A preview of someone else's words: two lines at
                        // most; the rest is one tap away.
                        Text(
                          detail,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: text.bodySmall?.copyWith(
                            fontSize: 12.5,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.space2),
                Container(
                  constraints: const BoxConstraints(minHeight: 36),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: AppColors.tileSaffronBg,
                    borderRadius: AppRadius.rPill,
                  ),
                  child: Text(
                    action,
                    style: text.labelMedium?.copyWith(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.tileAmberInk,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Your tools ─────────────────────────────────────────────────────────────

class _ToolGrid extends ConsumerWidget {
  const _ToolGrid();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final language = ref.watch(localeControllerProvider);
    final tiles = <Widget>[
      _Tile(
        title: l10n.homeTileRollCall,
        toolId: 'attendance',
        subtitle: l10n.homeTileRollCallSub,
        onTap: () => context.push(Routes.attendance),
      ),
      _Tile(
        title: l10n.homeTileLesson,
        toolId: 'lesson-plan',
        subtitle: l10n.homeTileLessonSub,
        onTap: () => context.push(Routes.lessonPlan),
      ),
      _Tile(
        key: const ValueKey('home-tile-scan'),
        title: l10n.homeTileScan,
        toolId: 'assessment-scanner',
        subtitle: l10n.homeTileScanSub,
        onTap: () => context.push(Routes.assessmentScanner),
      ),
      _Tile(
        title: l10n.homeTileCall,
        toolId: 'parent-hotline',
        subtitle: l10n.homeTileCallSubLanguage(language.nativeLabel),
        onTap: () => context.push(Routes.parentHotline),
      ),
      _Tile(
        key: const ValueKey('home-tile-quiz'),
        title: l10n.quizTitle,
        toolId: 'quiz',
        subtitle: l10n.homeTileQuizSub,
        onTap: () => context.push(Routes.quizGenerator),
      ),
      _Tile(
        title: l10n.worksheetTitle,
        toolId: 'worksheet',
        subtitle: l10n.homeTileWorksheetSub,
        onTap: () => context.push(Routes.worksheetWizard),
      ),
      _Tile(
        title: l10n.instantAnswerTitle,
        toolId: 'instant-answer',
        subtitle: l10n.homeTileAnswerSub,
        onTap: () => context.push(Routes.instantAnswer),
      ),
      _Tile(
        key: const ValueKey('home-tile-exam'),
        title: l10n.examPaperTitle,
        toolId: 'exam-paper',
        subtitle: l10n.homeTileExamSub,
        onTap: () => context.push(Routes.examPaper),
      ),
    ];
    // Two across; each row takes its taller tile's height, so long words in
    // any script wrap instead of being cut.
    return Column(
      children: [
        for (var row = 0; row < tiles.length; row += 2) ...[
          if (row > 0) const SizedBox(height: 10),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: tiles[row]),
                const SizedBox(width: 10),
                Expanded(child: tiles[row + 1]),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    super.key,
    required this.title,
    required this.toolId,
    required this.subtitle,
    required this.onTap,
  });

  final String title;

  /// The registry id: the tile's icon and tint are the ones the tool has on
  /// the Tools page, so a tool looks the same everywhere.
  final String toolId;
  final String subtitle;
  final VoidCallback onTap;

  static IconData _toolIcon(String id) {
    for (final tool in [...kToolRegistry, kAttendanceEntry]) {
      if (tool.id == id) return tool.icon;
    }
    return LucideIcons.sparkles;
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final tint = toolTint(toolId);
    return Semantics(
      button: true,
      label: '$title, $subtitle',
      excludeSemantics: true,
      child: Material(
        color: AppColors.surfaceGlass,
        borderRadius: AppRadius.rTile,
        child: InkWell(
          borderRadius: AppRadius.rTile,
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: AppRadius.rTile,
              border: Border.all(color: AppColors.borderHairline),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Above the name, never beside it: a long Malayalam or Tamil
                // name at large text needs the tile's whole width.
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: tint.fill,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Icon(_toolIcon(toolId), size: 15, color: tint.ink),
                ),
                const SizedBox(height: AppSpacing.space2),
                Text(
                  title,
                  style: text.titleLarge?.copyWith(
                    fontSize: 15,
                    color: AppColors.textStrong,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: text.bodyMedium?.copyWith(color: AppColors.textMuted),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// "Explore all 15 tools": every tool, counted from the registry the Prep desk
/// lists, with a one-line hint of what else is in there.
///
/// A full-width pill in the map's white secondary style (`.btn.w`): the same
/// 52dp stadium every other button in the app uses, so it reads as an action
/// and not as a stray link. A MINIMUM height, so a long translation at a large
/// text scale grows the pill instead of clipping.
class _AllToolsLink extends StatelessWidget {
  const _AllToolsLink();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final label = l10n.homeAllToolsExplore(kToolRegistry.length);
    final hint = l10n.homeAllToolsHint;
    return Semantics(
      button: true,
      label: '$label, $hint',
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          borderRadius: AppRadius.rPill,
          boxShadow: [AppShadows.card],
        ),
        child: Material(
          color: AppColors.milk50,
          shape: const StadiumBorder(
            side: BorderSide(color: AppColors.borderHairline),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            customBorder: const StadiumBorder(),
            onTap: () => context.push(Routes.prepDesk),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 52),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.space5,
                  vertical: AppSpacing.space3,
                ),
                child: Row(
                  children: [
                    const Icon(
                      LucideIcons.layoutGrid,
                      size: 18,
                      color: AppColors.accentFill,
                    ),
                    const SizedBox(width: AppSpacing.space3),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            label,
                            style: text.titleLarge?.copyWith(
                              fontSize: 15,
                              color: AppColors.textStrong,
                            ),
                          ),
                          Text(
                            hint,
                            style: text.bodyMedium?.copyWith(
                              color: AppColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.space2),
                    const Icon(
                      LucideIcons.chevronRight,
                      size: 18,
                      color: AppColors.textMuted,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Complete profile ───────────────────────────────────────────────────────

class _CompleteProfileCard extends StatelessWidget {
  const _CompleteProfileCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: AppRadius.rTile,
        border: Border.all(color: AppColors.accentTintBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.dashboardSetupTitle,
            style: text.titleLarge?.copyWith(color: AppColors.textStrong),
          ),
          const SizedBox(height: AppSpacing.space1),
          Text(
            l10n.dashboardSetupBody,
            style: text.bodyMedium?.copyWith(color: AppColors.textBody),
          ),
          const SizedBox(height: AppSpacing.space3),
          Semantics(
            button: true,
            label: l10n.dashboardSetupAction,
            excludeSemantics: true,
            child: InkWell(
              borderRadius: AppRadius.rPill,
              onTap: () => context.push(Routes.profile),
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  minHeight: AppSpacing.targetMin,
                ),
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  widthFactor: 1,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    decoration: const BoxDecoration(
                      color: AppColors.accentFill,
                      borderRadius: AppRadius.rPill,
                    ),
                    child: Text(
                      l10n.dashboardSetupAction,
                      style: text.labelMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textOnAccent,
                      ),
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

String _formatToday(BuildContext context, DateTime day) {
  final locale = Localizations.localeOf(context);
  if (locale.languageCode == 'en') {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sept',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${DateFormat('EEE', locale.toString()).format(day)}, '
        '${day.day} ${months[day.month - 1]}';
  }
  return DateFormat('EEE, d MMM', locale.toString()).format(day);
}

String? _initialsOf(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return null;
  final words = trimmed
      .split(RegExp(r'\s+'))
      .where((w) => w.isNotEmpty)
      .take(2);
  final buffer = StringBuffer();
  for (final word in words) {
    buffer.write(String.fromCharCode(word.runes.first).toUpperCase());
  }
  final initials = buffer.toString();
  return initials.isEmpty ? null : initials;
}
