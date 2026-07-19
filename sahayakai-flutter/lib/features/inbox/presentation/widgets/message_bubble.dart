import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../domain/inbox_models.dart';

/// One message in the thread (SPEC §B3.2): a bubble aligned **end** for my own
/// messages (a saffron `primaryContainer` tint) and **start** for the other
/// participant's (a bordered `surface` card). The body is server-authored prose
/// rendered through [AiText] (Indic matra-safe, soft-wrapping); a meta line
/// carries a compact timestamp and — for my own messages — a delivery/read tick.
///
/// WCAG AA, computed vs the ACTUAL fill (never `#E0924D` routed as text):
///   • **mine body** = `onSurface` on `primaryContainer` (saffron-100 light /
///     #3D2A15 dark) = **15.2:1** light / **12.4:1** dark — well clear of 4.5.
///     `primaryContainer` is deliberately the *lighter* tint (not the `#E0924D`
///     fill, which is only ~2.5:1 with any dark ink); on it, ink reads cleanly.
///   • **mine meta / tick** = `onPrimaryContainer` (#8B330E light / #FFCE9E dark)
///     = **6.9:1** / **9.5:1**; the "read" tick uses the saffron-text token
///     (#AC4815 / #EB9447) = **5.14:1** on the tint — both clear 4.5. The muted
///     `onSurfaceVariant` is NOT used here (it is only ~3.99:1 on this fill).
///   • **theirs body** = `onSurface` on white `surface` = ~16.7:1; **theirs meta**
///     = muted `onSurfaceVariant` on white = **4.70:1** (muted only on white).
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
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: AppSpacing.space1),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.space4,
            vertical: AppSpacing.space3,
          ),
          decoration: BoxDecoration(
            color: _mine ? scheme.primaryContainer : scheme.surface,
            borderRadius: AppRadius.rCard,
            border: _mine
                ? null
                : Border.all(color: scheme.outline, width: 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Group threads name the sender on incoming messages; direct
              // threads omit it (the app bar already names the one other party).
              if (isGroup && !_mine && message.senderName.trim().isNotEmpty) ...[
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
