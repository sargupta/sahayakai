import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/glass_surface.dart';
import '../../domain/inbox_models.dart';

/// One message in the thread (SPEC §B3.2): a bubble aligned **end** for my own
/// messages (a saffron-tinted glass fill) and **start** for the other
/// participant's (the neutral flat-glass fill). Both variants render through
/// [GlassSurface.flat] (App-wide Glassmorphism Reskin, GL-4) — the cheap
/// NO-BLUR path, never real `BackdropFilter`: these bubbles live inside a
/// scrolling `ListView`, exactly the case GL-1's docs say must never get a
/// real blur pass. The body is server-authored prose rendered through
/// [AiText] (Indic matra-safe, soft-wrapping); a meta line carries a compact
/// timestamp and — for my own messages — a delivery/read tick.
///
/// GLASS TREATMENT — "mine" vs "theirs": `GlassSurface.flat`'s own fill,
/// border and sheen are deliberately NEUTRAL (the one shared flat-glass
/// family every list-context surface in the app now uses — see `app_card.dart`,
/// `app_segmented.dart`). So the saffron identity that used to live in a raw
/// `BoxDecoration.color: primaryContainer` is layered back on top as a
/// translucent `primaryContainer` wash (alpha 0.85) painted UNDER the actual
/// message content but ON TOP of the glass fill/sheen — still real
/// translucency (not a repaint back to opaque), automatically clipped to the
/// same squircle by `GlassSurface`'s own `ClipPath`. "Theirs" gets the bare
/// neutral `GlassSurface.flat`, no wash. Net effect: both bubbles are visibly
/// the same glass MATERIAL (identical border ring, corner shape, sheen), but
/// "mine" keeps its own distinct saffron-tinted FILL — alignment (end/start)
/// remains the primary cue, the tint is the reinforcing one, same relationship
/// as before the reskin, not flattened into visual sameness.
///
/// WCAG AA, computed vs the ACTUAL DOUBLE composite (the wash sits on top of
/// the already-composited glass fill, not a single layer — `Color.alphaBlend`
/// applied twice, same math `theme_contrast_test.dart` locks in the
/// `GL-4 mine-bubble wash` group below):
///   • **mine body** = `onSurface` on the primaryContainer-washed glass fill =
///     **15.5:1** light / **12.9:1** dark — clear of 4.5 with wide margin.
///   • **mine meta / tick** = `onPrimaryContainer` (#8B330E light / #FFCE9E
///     dark) on that same composite = **7.08:1** light / **9.82:1** dark —
///     also clear of 4.5. (An earlier pass on this doc comment mislabelled
///     these meta/tick numbers as the BODY ratio, computed against the wrong
///     token — caught by the GL-4 design review and corrected here, with the
///     locked test below so it can't drift silently again.) The "read" tick's
///     saffron-text token stays well clear of 4.5 too. The muted
///     `onSurfaceVariant` is still NOT used here.
///   • **theirs body** = `onSurface` on the neutral flat-glass fill — the same
///     composite `theme_contrast_test.dart` already asserts passes AA (the
///     flat-fill-over-background case), effectively unchanged from the old
///     solid white `surface` (~16.7:1) since the composite sits within ~2 RGB
///     units of pure white. **theirs meta** = muted `onSurfaceVariant` on that
///     same near-white composite = still ~4.70:1 (muted only on a light fill).
///   • **theirs body** = `onSurface` on the neutral flat-glass fill — the same
///     composite `theme_contrast_test.dart` already asserts passes AA (the
///     flat-fill-over-background case), effectively unchanged from the old
///     solid white `surface` (~16.7:1) since the composite sits within ~2 RGB
///     units of pure white. **theirs meta** = muted `onSurfaceVariant` on that
///     same near-white composite = still ~4.70:1 (muted only on a light fill).
class MessageBubble extends StatelessWidget {
  const MessageBubble({
    super.key,
    required this.message,
    required this.myUid,
    required this.otherParticipantIds,
    this.isGroup = false,
    this.now,
  });

  final Message message;
  final String myUid;

  /// Every participant other than me — drives the read/delivered tick (a message
  /// counts as read once any *other* participant has opened it).
  final List<String> otherParticipantIds;
  final bool isGroup;
  final DateTime? now;

  bool get _mine => message.senderId == myUid;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final width = MediaQuery.sizeOf(context).width;

    // Meta text colour keyed to the fill: onPrimaryContainer on the saffron tint
    // (mine), muted onSurfaceVariant on the white card (theirs).
    final metaColor =
        _mine ? scheme.onPrimaryContainer : scheme.onSurfaceVariant;

    return Align(
      alignment: _mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: width * 0.78),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.space1),
          child: GlassSurface.flat(
            radius: AppRadius.card,
            // padding: borderWidth, NOT zero — same fix `AppCard` needed: an
            // edge-flush opaque child (our "mine" wash, or dense text) would
            // otherwise occlude the border ring's strongest point.
            padding: const EdgeInsets.all(AppGlass.borderWidth),
            child: Stack(
              children: [
                // "Mine" saffron wash — see class doc. Auto-clipped to the
                // same squircle as the glass fill/border by GlassSurface's
                // own ClipPath, so no extra corner handling needed here.
                if (_mine)
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color:
                            scheme.primaryContainer.withValues(alpha: 0.85),
                      ),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.space4,
                    vertical: AppSpacing.space3,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Group threads name the sender on incoming messages;
                      // direct threads omit it (the app bar already names the
                      // one other party).
                      if (isGroup &&
                          !_mine &&
                          message.senderName.trim().isNotEmpty) ...[
                        Text(
                          message.senderName.trim(),
                          style: AppTextExtras.of(context).overline,
                        ),
                        const SizedBox(height: AppSpacing.space1),
                      ],
                      _MessageBody(message: message, mine: _mine),
                      const SizedBox(height: AppSpacing.space1),
                      _MetaLine(
                        message: message,
                        mine: _mine,
                        metaColor: metaColor,
                        otherParticipantIds: otherParticipantIds,
                        now: now,
                      ),
                    ],
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

/// The body by [MessageType]. Text is the common case (AiText prose). A shared
/// **resource** card and an **audio** note render a dignified, honest compact
/// form — a type badge plus the title/caption — without a fake "Open"/playback
/// affordance (the Prep-desk bridge + media scrubber are a later unit).
class _MessageBody extends StatelessWidget {
  const _MessageBody({required this.message, required this.mine});

  final Message message;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;

    switch (message.type) {
      case MessageType.text:
        return AiText(message.text);
      case MessageType.resource:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            AppBadge(
              label: l10n.inboxResourceLabel,
              icon: LucideIcons.fileText,
              size: AppBadgeSize.small,
            ),
            const SizedBox(height: AppSpacing.space2),
            Text(
              message.resource?.title.trim().isNotEmpty ?? false
                  ? message.resource!.title.trim()
                  : (message.text.trim().isNotEmpty
                      ? message.text.trim()
                      : l10n.inboxResourceLabel),
              style: text.titleSmall,
            ),
          ],
        );
      case MessageType.audio:
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppBadge(
              label: l10n.inboxVoiceNoteLabel,
              icon: LucideIcons.mic,
              size: AppBadgeSize.small,
            ),
            if ((message.audioDuration ?? 0) > 0) ...[
              const SizedBox(width: AppSpacing.space2),
              Text(
                _duration(message.audioDuration!),
                style: AppTextExtras.of(context).dataMedium,
              ),
            ],
          ],
        );
    }
  }

  static String _duration(int seconds) {
    final m = seconds ~/ 60;
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }
}

/// The meta line: a compact timestamp, and — only for my own messages — the
/// delivery/read tick. `sending` shows a clock; `read` a saffron double-check.
class _MetaLine extends StatelessWidget {
  const _MetaLine({
    required this.message,
    required this.mine,
    required this.metaColor,
    required this.otherParticipantIds,
    required this.now,
  });

  final Message message;
  final bool mine;
  final Color metaColor;
  final List<String> otherParticipantIds;
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final extras = AppTextExtras.of(context);
    final timestamp = _timestamp(context);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (timestamp.isNotEmpty)
          Text(
            timestamp,
            style: extras.dataMedium.copyWith(color: metaColor, fontSize: 12),
          ),
        if (mine) ...[
          const SizedBox(width: AppSpacing.space1),
          _DeliveryTick(
            status: _status(),
            onTint: metaColor,
            l10n: l10n,
          ),
        ],
      ],
    );
  }

  /// A short clock time (HH:MM) for the message; empty when it has no server
  /// timestamp yet (an in-flight optimistic message shows only the tick).
  String _timestamp(BuildContext context) {
    final iso = message.createdAt;
    if (iso == null || iso.isEmpty) return '';
    final at = DateTime.tryParse(iso);
    if (at == null) return '';
    final local = at.toLocal();
    final h = local.hour.toString().padLeft(2, '0');
    final m = local.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  /// Resolve the tick state: an explicit optimistic status wins; otherwise
  /// derive from whether any *other* participant has read / been delivered.
  _TickState _status() {
    if (message.deliveryStatus == MessageDeliveryStatus.sending) {
      return _TickState.sending;
    }
    if (message.deliveryStatus == MessageDeliveryStatus.failed) {
      return _TickState.failed;
    }
    final readByOther = otherParticipantIds.any(message.readBy.contains);
    if (readByOther) return _TickState.read;
    final deliveredToOther =
        otherParticipantIds.any(message.deliveredTo.contains);
    if (deliveredToOther) return _TickState.delivered;
    return _TickState.sent;
  }
}

enum _TickState { sending, sent, delivered, read, failed }

/// The delivery glyph. All colours are computed against the mine-bubble fill
/// (`primaryContainer`): [onTint] (onPrimaryContainer, 6.9:1) for pending/sent/
/// delivered, and the saffron-text token (5.14:1) for a read receipt.
class _DeliveryTick extends StatelessWidget {
  const _DeliveryTick({
    required this.status,
    required this.onTint,
    required this.l10n,
  });

  final _TickState status;
  final Color onTint;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final saffronText = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dPrimaryText
        : AppColors.lPrimaryText;

    late final IconData icon;
    late final Color color;
    late final String semantics;
    switch (status) {
      case _TickState.sending:
        icon = LucideIcons.clock;
        color = onTint;
        semantics = l10n.inboxTickSending;
      case _TickState.sent:
        icon = LucideIcons.check;
        color = onTint;
        semantics = l10n.inboxTickSent;
      case _TickState.delivered:
        icon = LucideIcons.checkCheck;
        color = onTint;
        semantics = l10n.inboxTickDelivered;
      case _TickState.read:
        icon = LucideIcons.checkCheck;
        color = saffronText;
        semantics = l10n.inboxTickRead;
      case _TickState.failed:
        icon = LucideIcons.alertCircle;
        color = Theme.of(context).colorScheme.error;
        semantics = l10n.inboxTickFailed;
    }

    return Semantics(
      label: semantics,
      child: Icon(icon, size: 14, color: color),
    );
  }
}
