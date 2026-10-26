import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/i18n/locale_provider.dart';
import '../../../../core/i18n/script.dart';
import '../../../../core/platform/clock.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/language_switcher.dart';
import '../../../profile/presentation/profile_controller.dart';
import '../../domain/home_day.dart';
import '../deliver_tray.dart';
import '../home_day_provider.dart';

/// The pieces of Home (design system v2 `ScreenHome`): VIDYA's voice-first
/// front door, set on the teacher's real day.
///
///   • [HomeGreeting] — initials, today's date and name, the language pill.
///   • [HomeDayHeadline] — the day in one headline, the classes as subline.
///   • [HomeSayItCard] — what is waiting, phrased as what to say, each row
///     opening its tool.
///   • [HomeComposer] — the type bar: voice's equal sibling.
///
/// The hero orb and its states live in `vidya_home_screen.dart`, beside the
/// controller they drive.

/// The greeting row: the teacher's initials, today's date over her name, and
/// the language pill that opens the language picker.
class HomeGreeting extends ConsumerWidget {
  const HomeGreeting({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final type = AppTypeTokens.of(context);
    final name = ref
        .watch(profileControllerProvider)
        .valueOrNull
        ?.displayName
        ?.trim();
    final locale = ref.watch(localeControllerProvider);
    final date = MaterialLocalizations.of(
      context,
    ).formatMediumDate(ref.read(nowProvider)());

    return Row(
      children: [
        ExcludeSemantics(
          child: Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.surfaceDisc,
              border: Border.all(
                color: AppColors.borderGlass,
              ),
            ),
            child: (name == null || name.isEmpty)
                ? Icon(
                    LucideIcons.user,
                    size: 16,
                    color: scheme.onSurfaceVariant,
                  )
                : Text(
                    _initials(name),
                    style: type.labelStrong.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                date,
                style: type.caption.copyWith(fontWeight: FontWeight.w500),
              ),
              if (name != null && name.isNotEmpty)
                Text(
                  name,
                  style: type.value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Semantics(
          button: true,
          label: '${l10n.languageLabel}: ${locale.nativeLabel}',
          excludeSemantics: true,
          child: InkWell(
            key: const ValueKey('home-language-pill'),
            customBorder: const StadiumBorder(),
            onTap: () => showLanguagePicker(context, ref),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 44),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: const ShapeDecoration(
                    color: AppColors.surfaceGlass,
                    shape: StadiumBorder(
                      side: BorderSide(
                        color: AppColors.borderGlass,
                      ),
                    ),
                  ),
                  child: Text(
                    locale.nativeLabel,
                    style: type.chip.copyWith(
                      color: AppColors.textEyebrow,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Up to two initials, taken by rune so an Indic name keeps a whole
  /// character rather than half a UTF-16 pair.
  static String _initials(String name) {
    final parts = name.split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    return parts
        .take(2)
        .map((p) => String.fromCharCode(p.runes.first))
        .join()
        .toUpperCase();
  }
}

/// The day in one headline, with the teacher's classes as the subline.
///
/// The headline only states a count when the whole day was read
/// ([HomeDay.complete]); otherwise — offline, signed out, a register that
/// failed — it falls back to the time of day rather than guess.
class HomeDayHeadline extends ConsumerWidget {
  const HomeDayHeadline({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final type = AppTypeTokens.of(context);
    final day = ref.watch(homeDayProvider).valueOrNull;
    final now = ref.read(nowProvider)();

    final String title;
    if (day == null || !day.complete) {
      title = homeSalutation(l10n, now);
    } else if (day.waitingCount > 0) {
      title = l10n.homeDayWaiting(day.waitingCount);
    } else {
      title = l10n.homeDayClear;
    }
    final classes = day?.classNames ?? const <String>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          header: true,
          child: Text(
            title,
            key: const ValueKey('home-day-headline'),
            style: type.screenTitle,
          ),
        ),
        if (classes.isNotEmpty) ...[
          const SizedBox(height: 7),
          Text(_classLine(classes), style: type.body),
        ],
      ],
    );
  }

  /// The first three classes, joined by middle dots, then "+N".
  static String _classLine(List<String> classes) {
    final shown = classes.take(3).join(' · ');
    final more = classes.length - 3;
    return more > 0 ? '$shown · +$more' : shown;
  }
}

/// The time-of-day greeting: Home's honest fallback headline when the day
/// could not be read.
String homeSalutation(AppLocalizations l10n, DateTime now) {
  final hour = now.hour;
  if (hour < 12) return l10n.dashboardGreetingMorning;
  if (hour < 17) return l10n.dashboardGreetingAfternoon;
  return l10n.dashboardGreetingEvening;
}

/// The raised card of things to say. Each row is a real waiting item (or, if
/// nothing waits, an example), written as the words that open it, and is one
/// button that opens its tool. "All tools" opens the Prep desk.
class HomeSayItCard extends ConsumerWidget {
  const HomeSayItCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final extras = AppTextExtras.of(context);
    final type = AppTypeTokens.of(context);
    final day = ref.watch(homeDayProvider);
    final eyebrow = l10n.homeSayItTitle;
    final indicEyebrow = isIndicText(eyebrow);

    return AppCard(
      variant: AppCardVariant.elevated,
      padding: const EdgeInsets.fromLTRB(15, 8, 8, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  indicEyebrow ? eyebrow : eyebrow.toUpperCase(),
                  style: indicEyebrow
                      ? extras.eyebrow.copyWith(fontSize: 12, letterSpacing: 0)
                      : extras.eyebrow,
                ),
              ),
              TextButton(
                key: const ValueKey('home-all-tools'),
                onPressed: () => context.push(Routes.prepDesk),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 7),
                  textStyle: type.action,
                ),
                child: Text(l10n.vidyaPrepDesk),
              ),
            ],
          ),
          ...switch (day) {
            AsyncData(:final value) => [
              for (final item in value.rows) _SayItRow(item: item),
            ],
            // While the day loads, show no rows rather than a guess.
            _ => [const SizedBox(height: 44)],
          },
        ],
      ),
    );
  }
}

class _SayItRow extends StatelessWidget {
  const _SayItRow({required this.item});

  final HomeDayItem item;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final type = AppTypeTokens.of(context);

    final (
      Color dot,
      String status,
      String phrase,
      String action,
    ) = switch (item.kind) {
      HomeDayItemKind.callAbsentees => (
        AppColors.red500,
        l10n.homeStatusUrgent,
        l10n.homeSayCallAbsentees(item.count, item.className ?? ''),
        l10n.homeActionCall,
      ),
      HomeDayItemKind.takeAttendance => (
        AppColors.amber500,
        l10n.homeStatusToDo,
        l10n.homeSayTakeAttendance(item.className ?? ''),
        l10n.homeActionMark,
      ),
      HomeDayItemKind.openReady => (
        AppColors.leaf500,
        l10n.homeStatusReady,
        l10n.homeSayOpenReady(item.deliverable?.title ?? ''),
        l10n.actionOpen,
      ),
      HomeDayItemKind.exampleLesson => (
        AppColors.saffron500,
        l10n.homeStatusIdea,
        l10n.homeSayLessonExample,
        l10n.homeActionMake,
      ),
      HomeDayItemKind.exampleQuiz => (
        AppColors.saffron500,
        l10n.homeStatusIdea,
        l10n.homeSayQuizExample,
        l10n.homeActionMake,
      ),
      HomeDayItemKind.exampleAnswer => (
        AppColors.saffron500,
        l10n.homeStatusIdea,
        l10n.homeSayAnswerExample,
        l10n.homeActionAsk,
      ),
    };

    return Semantics(
      button: true,
      label: '$action: $phrase. $status',
      excludeSemantics: true,
      child: InkWell(
        key: ValueKey(
          'home-say-${item.kind.name}-${item.classId ?? item.deliverable?.id ?? ''}',
        ),
        borderRadius: AppRadius.rRow,
        onTap: () => _open(context),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44),
          child: Padding(
            padding: const EdgeInsets.only(right: 7),
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: dot,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Text(phrase, style: type.label),
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  action,
                  style: type.action.copyWith(
                    color: AppColors.textEyebrow,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _open(BuildContext context) {
    switch (item.kind) {
      case HomeDayItemKind.callAbsentees:
        context.push(Routes.parentHotline);
      case HomeDayItemKind.takeAttendance:
        final id = item.classId;
        if (id != null) context.push(Routes.attendanceMarkPath(id));
      case HomeDayItemKind.openReady:
        final d = item.deliverable;
        if (d != null) showDeliverTray(context, d);
      case HomeDayItemKind.exampleLesson:
        context.push(Routes.lessonPlan);
      case HomeDayItemKind.exampleQuiz:
        context.push(Routes.quizGenerator);
      case HomeDayItemKind.exampleAnswer:
        context.push(Routes.instantAnswer);
    }
  }
}

/// The type bar (v2 `Composer`): an inset pill holding a real text input and
/// the saffron mic. Enter sends the line to VIDYA as a typed turn; the mic
/// does what the orb does.
class HomeComposer extends StatefulWidget {
  const HomeComposer({super.key, required this.onSubmit, required this.onMic});

  final ValueChanged<String> onSubmit;
  final VoidCallback onMic;

  @override
  State<HomeComposer> createState() => _HomeComposerState();
}

class _HomeComposerState extends State<HomeComposer> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _send(String text) {
    if (text.trim().isEmpty) return;
    widget.onSubmit(text);
    _controller.clear();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final type = AppTypeTokens.of(context);
    final focused = _focus.hasFocus;

    // `composer-height` 54 inside a 1px `border-strong` edge (56 overall);
    // focus takes a 2px saffron-500 edge and `shadow-current`, as a field does.
    final edge = focused
        ? BorderSide(color: scheme.primary, width: 2)
        : const BorderSide(color: AppColors.borderStrong);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AnimatedContainer(
          duration: MediaQuery.maybeOf(context)?.disableAnimations == true
              ? Duration.zero
              : AppMotion.change,
          curve: AppMotion.standard,
          constraints: const BoxConstraints(minHeight: 56),
          padding: EdgeInsets.fromLTRB(15 - edge.width, 0, 9 - edge.width, 0),
          decoration: ShapeDecoration(
            color: AppColors.surfaceInset,
            shape: StadiumBorder(side: edge),
            shadows: focused ? AppShadows.current : null,
          ),
          child: Row(
            children: [
              Expanded(
                child: Semantics(
                  label: l10n.homeComposerLabel,
                  child: TextField(
                    key: const ValueKey('home-composer'),
                    controller: _controller,
                    focusNode: _focus,
                    textInputAction: TextInputAction.send,
                    onSubmitted: _send,
                    minLines: 1,
                    maxLines: 3,
                    style: type.reading,
                    decoration: InputDecoration(
                      isDense: true,
                      filled: false,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 8),
                      hintText: l10n.homeComposerHint,
                      hintStyle: type.reading.copyWith(
                        color: AppColors.textMuted,
                      ),
                      semanticCounterText: '',
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // The mic: a 40px saffron disc, its touch area 48. A mic glyph
              // marks it as a control; the orb above is VIDYA herself.
              Semantics(
                button: true,
                label: l10n.vidyaStateIdle,
                excludeSemantics: true,
                child: InkResponse(
                  onTap: widget.onMic,
                  radius: 24,
                  child: SizedBox.square(
                    dimension: 48,
                    child: Center(
                      child: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: scheme.primary,
                          boxShadow: AppShadows.mic,
                        ),
                        child: Icon(
                          LucideIcons.mic,
                          size: 18,
                          color: scheme.onPrimary,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Text(l10n.homeOrbHint, textAlign: TextAlign.center, style: type.bodySm),
      ],
    );
  }
}
