import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

/// Pieces shared by the two chat surfaces — the Staff Room / group chat and
/// the one-to-one conversation thread — so a teacher sees one chat grammar:
/// the header, the bubble shape and fills, the day pill and the composer.

/// The corner a bubble "points" from: 6px against the map's 18px card radius.
const double kChatBubbleTail = 6;

/// The bubble outline. The tail sits bottom-start for others and bottom-end
/// for my own; a [continued] bubble (same author as the one above) tucks its
/// top corner on that side too, so a run reads as one voice.
BorderRadiusGeometry chatBubbleRadius({
  required bool mine,
  bool continued = false,
}) {
  const round = Radius.circular(AppRadius.card);
  const tail = Radius.circular(kChatBubbleTail);
  return BorderRadiusDirectional.only(
    topStart: !mine && continued ? tail : round,
    topEnd: mine && continued ? tail : round,
    bottomStart: mine ? round : tail,
    bottomEnd: mine ? tail : round,
  );
}

/// Another teacher's bubble: the solid card surface, a white hairline and the
/// map card's soft shadow.
BoxDecoration chatOtherBubbleDecoration({bool continued = false}) =>
    BoxDecoration(
      color: AppColors.surfaceCard,
      borderRadius: chatBubbleRadius(mine: false, continued: continued),
      border: Border.all(color: AppColors.borderGlass),
      boxShadow: const [AppShadows.mapCard],
    );

/// My own bubble: the filled accent (white on saffron-600 clears 4.5:1).
BoxDecoration chatMineBubbleDecoration({bool continued = false}) =>
    BoxDecoration(
      color: AppColors.accentFill,
      borderRadius: chatBubbleRadius(mine: true, continued: continued),
    );

/// The bubble's inner padding (the map's 9 / 12 / 7).
const EdgeInsets kChatBubblePadding = EdgeInsets.fromLTRB(
  AppSpacing.space3,
  9,
  AppSpacing.space3,
  7,
);

/// The message body style inside a bubble, matra-safe for Indic scripts.
TextStyle? chatBodyStyle(BuildContext context, {required bool mine}) =>
    Theme.of(context).textTheme.bodyLarge?.copyWith(
      color: mine ? AppColors.textOnAccent : AppColors.textStrong,
    );

/// Same height behaviour as `AiText`: the first ascent and last descent keep
/// their line height, so an Indic matra is never clipped.
const TextHeightBehavior kChatTextHeight = TextHeightBehavior(
  applyHeightToFirstAscent: true,
  applyHeightToLastDescent: true,
);

/// The small time under a bubble's text.
TextStyle? chatTimeStyle(BuildContext context, {required bool mine}) =>
    Theme.of(context).textTheme.bodySmall?.copyWith(
      color: mine ? AppColors.textOnAccent : AppColors.textMuted,
      fontFeatures: const [FontFeature.tabularFigures()],
    );

/// The local calendar day of an ISO timestamp, or null when the message has no
/// usable server time yet (an in-flight optimistic send).
DateTime? chatDay(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  final at = DateTime.tryParse(iso);
  if (at == null) return null;
  final local = at.toLocal();
  return DateTime(local.year, local.month, local.day);
}

/// The clock time for a message in the teacher's locale and 12/24h setting;
/// empty when there is no server time yet.
String chatTimeLabel(BuildContext context, String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final at = DateTime.tryParse(iso);
  if (at == null) return '';
  return MaterialLocalizations.of(context).formatTimeOfDay(
    TimeOfDay.fromDateTime(at.toLocal()),
    alwaysUse24HourFormat: MediaQuery.alwaysUse24HourFormatOf(context),
  );
}

/// "Today", "Yesterday" or a medium date for a day separator.
String chatDayLabel(BuildContext context, DateTime day, DateTime now) {
  final l10n = context.l10n;
  final local = now.toLocal();
  final today = DateTime(local.year, local.month, local.day);
  final daysAgo = today.difference(day).inDays;
  if (daysAgo == 0) return l10n.libraryDayToday;
  if (daysAgo == 1) return l10n.libraryDayYesterday;
  // MaterialLocalizations, not intl's DateFormat: its delegates are loaded for
  // all 11 locales, so this cannot throw on an uninitialised locale.
  return MaterialLocalizations.of(context).formatMediumDate(day);
}

/// A small centred pill that opens a new day in the conversation.
class ChatDayPill extends StatelessWidget {
  const ChatDayPill(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.space2),
      child: Center(
        child: Semantics(
          header: true,
          child: DecoratedBox(
            decoration: const BoxDecoration(
              color: AppColors.borderHairline,
              borderRadius: AppRadius.rPill,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.space3,
                vertical: AppSpacing.space1,
              ),
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textBody,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The chat header: back, an optional leading avatar, the title over a
/// one-line subline, and optional trailing actions. It grows with its text
/// (a long group name wraps) instead of living in a fixed-height app bar.
class ChatHeader extends StatelessWidget {
  const ChatHeader({
    super.key,
    required this.title,
    this.subline,
    this.leading,
    this.actions = const <Widget>[],
  });

  final String title;
  final String? subline;
  final Widget? leading;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final canPop = ModalRoute.of(context)?.canPop ?? false;
    final sub = subline?.trim() ?? '';

    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surfaceCapsule,
        border: Border(bottom: BorderSide(color: AppColors.borderHairline)),
      ),
      child: SafeArea(
        bottom: false,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 68),
          child: Padding(
            padding: EdgeInsetsDirectional.fromSTEB(
              canPop ? AppSpacing.space1 : AppSpacing.space4,
              AppSpacing.space2,
              actions.isEmpty ? AppSpacing.space4 : AppSpacing.space1,
              AppSpacing.space2,
            ),
            child: Row(
              children: [
                if (canPop)
                  IconButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    tooltip: MaterialLocalizations.of(
                      context,
                    ).backButtonTooltip,
                    constraints: const BoxConstraints(
                      minWidth: 48,
                      minHeight: 48,
                    ),
                    color: AppColors.textStrong,
                    icon: const Icon(LucideIcons.arrowLeft, size: 20),
                  ),
                if (leading != null) ...[
                  ExcludeSemantics(child: leading!),
                  const SizedBox(width: AppSpacing.space3),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Semantics(
                        header: true,
                        child: Text(
                          title,
                          style: text.titleLarge?.copyWith(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textStrong,
                          ),
                        ),
                      ),
                      if (sub.isNotEmpty)
                        Text(
                          sub,
                          style: text.bodySmall?.copyWith(
                            fontSize: 12,
                            color: AppColors.textMuted,
                          ),
                        ),
                    ],
                  ),
                ),
                ...actions,
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The composer row: a rounded field and a round send button. Behaviour (what
/// "can send" means, length caps, the too-long state) stays with each screen;
/// this is only the look, shared so both chats feel the same.
class ChatComposerRow extends StatelessWidget {
  const ChatComposerRow({
    super.key,
    required this.controller,
    required this.canSend,
    required this.onSend,
    this.inputFormatters,
    this.error = false,
  });

  final TextEditingController controller;
  final bool canSend;
  final VoidCallback onSend;
  final List<TextInputFormatter>? inputFormatters;

  /// Paints the field's outline in the error colour (e.g. over a length cap),
  /// beside the screen's own written hint.
  final bool error;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;

    OutlineInputBorder outline(Color color) => OutlineInputBorder(
      borderRadius: AppRadius.rPill,
      borderSide: BorderSide(color: color),
    );

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: TextField(
            controller: controller,
            minLines: 1,
            maxLines: 5,
            inputFormatters: inputFormatters,
            textInputAction: TextInputAction.newline,
            keyboardType: TextInputType.multiline,
            style: Theme.of(
              context,
            ).textTheme.bodyLarge?.copyWith(color: AppColors.textStrong),
            decoration: InputDecoration(
              hintText: l10n.inboxComposerHint,
              isDense: true,
              filled: true,
              fillColor: AppColors.surfaceCard,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.space4,
                vertical: 13,
              ),
              border: outline(AppColors.borderAskBar),
              enabledBorder: outline(
                error ? scheme.error : AppColors.borderAskBar,
              ),
              focusedBorder: outline(
                error ? scheme.error : AppColors.accentFill,
              ),
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.space2),
        Semantics(
          button: true,
          enabled: canSend,
          label: l10n.inboxComposerSend,
          child: SizedBox(
            width: 48,
            height: 48,
            child: Material(
              type: MaterialType.transparency,
              child: Ink(
                decoration: ShapeDecoration(
                  // White on saffron-600 clears 4.5:1; the disabled fill is
                  // the map's `.btn.dis`, and the screen reader hears
                  // "disabled" from `enabled` above, not from the colour.
                  color: canSend
                      ? AppColors.accentFill
                      : AppColors.mapButtonDisabled,
                  shape: const CircleBorder(),
                ),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: canSend ? onSend : null,
                  child: const Icon(
                    LucideIcons.send,
                    size: AppIconSize.inline,
                    color: AppColors.textOnAccent,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
