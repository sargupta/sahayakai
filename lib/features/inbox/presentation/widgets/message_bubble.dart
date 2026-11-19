import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/avatar_initials.dart';
import '../../../../shared/widgets/map_icon_tile.dart';
import '../../../staffroom/presentation/widgets/chat_parts.dart';
import '../../domain/inbox_models.dart';

/// One message in the thread (SPEC §B3.2), in the same bubble grammar as the
/// Staff Room chat ([chatBubbleRadius] and friends): the other teacher's on
/// the start side on the card surface, mine on the end side in the filled
/// accent with white text. A meta line carries the time and — for my own
/// messages — the delivery/read tick.
///
/// A shared resource sits in the bubble as a white card (type tile, title, and
/// the subject / class / language the resource carries); an audio note is an
/// honest "Voice note" line with its length. Neither offers an "Open" or a
/// player: the Prep-desk bridge and the media player are a later unit.
///
/// The screen reader hears one sentence per bubble: who, the content, the
/// time, then the delivery state for my own messages.
///
/// Contrast (light): white on saffron-600 ≈ 5.4:1 (body, time, ticks);
/// ink-900 on the card surface ≈ 17:1; the muted time ≈ 5.6:1.
class MessageBubble extends StatelessWidget {
  const MessageBubble({
    super.key,
    required this.message,
    required this.myUid,
    required this.otherParticipantIds,
    this.isGroup = false,
    this.now,
    this.showSender = true,
    this.continued = false,
  });

  final Message message;
  final String myUid;

  /// Every participant other than me — drives the read/delivered tick (a message
  /// counts as read once any *other* participant has opened it).
  final List<String> otherParticipantIds;
  final bool isGroup;
  final DateTime? now;

  /// First of a run from this sender: a group thread names them.
  final bool showSender;

  /// Same sender as the bubble above (tucks the tail-side top corner).
  final bool continued;

  bool get _mine => message.senderId == myUid;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final width = MediaQuery.sizeOf(context).width;
    final time = chatTimeLabel(context, message.createdAt);
    final sender = message.senderName.trim();
    final showName = isGroup && !_mine && showSender && sender.isNotEmpty;
    final tick = _mine ? _status() : null;

    final spoken = [
      if (_mine) l10n.cmChatYou else if (sender.isNotEmpty) sender,
      ..._spokenBody(l10n),
      if (time.isNotEmpty) time,
      if (tick != null) _tickLabel(l10n, tick),
    ].join(', ');

    final resource = message.type == MessageType.resource;
    final caption = message.text.trim();
    final resourceTitle = message.resource?.title.trim() ?? '';

    final content = IntrinsicWidth(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showName) ...[
            Text(
              sender,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: avatarTint(sender).$2,
              ),
            ),
            const SizedBox(height: 3),
          ],
          switch (message.type) {
            MessageType.text => Text(
              message.text,
              textHeightBehavior: kChatTextHeight,
              style: chatBodyStyle(context, mine: _mine),
            ),
            MessageType.resource => _ResourceCard(message: message),
            MessageType.audio => _VoiceNote(message: message, mine: _mine),
          },
          // A resource's own caption, when it says more than the title.
          if (resource && caption.isNotEmpty && caption != resourceTitle) ...[
            const SizedBox(height: AppSpacing.space2),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Text(
                caption,
                textHeightBehavior: kChatTextHeight,
                style: chatBodyStyle(context, mine: _mine),
              ),
            ),
          ],
          if (time.isNotEmpty || tick != null) ...[
            const SizedBox(height: 2),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: resource ? 6 : 0),
              child: _MetaLine(time: time, mine: _mine, tick: tick),
            ),
          ],
        ],
      ),
    );

    final bubble = DecoratedBox(
      decoration: _mine
          ? chatMineBubbleDecoration(continued: continued)
          : chatOtherBubbleDecoration(continued: continued),
      child: Padding(
        // A resource card sits nearly edge to edge, as in the map.
        padding: resource
            ? const EdgeInsets.fromLTRB(6, 6, 6, 7)
            : kChatBubblePadding,
        child: content,
      ),
    );

    return Semantics(
      container: true,
      label: spoken,
      excludeSemantics: true,
      child: Align(
        alignment: _mine
            ? AlignmentDirectional.centerEnd
            : AlignmentDirectional.centerStart,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: width * 0.78),
          child: bubble,
        ),
      ),
    );
  }

  List<String> _spokenBody(AppLocalizations l10n) => switch (message.type) {
    MessageType.text => [if (message.text.trim().isNotEmpty) message.text],
    MessageType.resource => [
      l10n.inboxResourceLabel,
      _resourceTitle(message, l10n),
      if (message.text.trim().isNotEmpty &&
          message.text.trim() != _resourceTitle(message, l10n))
        message.text.trim(),
    ],
    MessageType.audio => [
      l10n.inboxVoiceNoteLabel,
      if ((message.audioDuration ?? 0) > 0) _duration(message.audioDuration!),
    ],
  };

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
    final deliveredToOther = otherParticipantIds.any(
      message.deliveredTo.contains,
    );
    if (deliveredToOther) return _TickState.delivered;
    return _TickState.sent;
  }
}

/// The resource's title, falling back to its caption, then to the type word.
String _resourceTitle(Message message, AppLocalizations l10n) {
  final title = message.resource?.title.trim() ?? '';
  if (title.isNotEmpty) return title;
  final caption = message.text.trim();
  return caption.isNotEmpty ? caption : l10n.inboxResourceLabel;
}

String _duration(int seconds) {
  final m = seconds ~/ 60;
  final s = (seconds % 60).toString().padLeft(2, '0');
  return '$m:$s';
}

/// A shared resource: a white card inside the bubble with a type tile, the
/// title, and the subject / class / language the resource itself carries.
class _ResourceCard extends StatelessWidget {
  const _ResourceCard({required this.message});

  final Message message;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final resource = message.resource;
    final meta = [
      l10n.inboxResourceLabel,
      if (resource?.subject?.trim().isNotEmpty ?? false)
        resource!.subject!.trim(),
      if (resource?.gradeLevel?.trim().isNotEmpty ?? false)
        resource!.gradeLevel!.trim(),
      if (resource?.language?.trim().isNotEmpty ?? false)
        resource!.language!.trim(),
    ].join(' · ');

    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: const BorderRadius.all(Radius.circular(AppRadius.field)),
        border: Border.all(color: AppColors.borderHairline),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.space3,
          vertical: 10,
        ),
        child: Row(
          children: [
            const MapIconTile(icon: LucideIcons.fileText, tint: MapTint.leaf),
            const SizedBox(width: 10),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _resourceTitle(message, l10n),
                    style: text.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.textStrong,
                    ),
                  ),
                  Text(
                    meta,
                    style: text.bodyMedium?.copyWith(
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// An honest voice-note line: a mic glyph, "Voice note" and its length. No
/// player exists for a conversation recording in this build, so none is shown.
class _VoiceNote extends StatelessWidget {
  const _VoiceNote({required this.message, required this.mine});

  final Message message;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    final ink = mine ? AppColors.textOnAccent : AppColors.tileSaffronInk;
    final style = Theme.of(
      context,
    ).textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w600, color: ink);
    final seconds = message.audioDuration ?? 0;
    return Wrap(
      spacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Icon(LucideIcons.mic, size: 16, color: ink),
        Text(context.l10n.inboxVoiceNoteLabel, style: style),
        if (seconds > 0)
          Text(
            _duration(seconds),
            style: style?.copyWith(
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
      ],
    );
  }
}

/// The meta line, end-aligned: the time and, for my own messages, the tick.
class _MetaLine extends StatelessWidget {
  const _MetaLine({required this.time, required this.mine, this.tick});

  final String time;
  final bool mine;
  final _TickState? tick;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        if (time.isNotEmpty)
          Flexible(
            child: Text(
              time,
              textAlign: TextAlign.end,
              style: chatTimeStyle(context, mine: mine),
            ),
          ),
        if (tick != null) ...[
          const SizedBox(width: AppSpacing.space1),
          _DeliveryTick(status: tick!),
        ],
      ],
    );
  }
}

enum _TickState { sending, sent, delivered, read, failed }

String _tickLabel(AppLocalizations l10n, _TickState state) => switch (state) {
  _TickState.sending => l10n.inboxTickSending,
  _TickState.sent => l10n.inboxTickSent,
  _TickState.delivered => l10n.inboxTickDelivered,
  _TickState.read => l10n.inboxTickRead,
  _TickState.failed => l10n.inboxTickFailed,
};

/// The delivery glyph, white on the accent fill. Each state has its own shape
/// (clock, check, double check, alert); "read" is the double check at full
/// strength, "delivered" the same glyph softened — and the bubble's spoken
/// label names the state, so colour is never the only signal.
class _DeliveryTick extends StatelessWidget {
  const _DeliveryTick({required this.status});

  final _TickState status;

  @override
  Widget build(BuildContext context) {
    final (icon, color) = switch (status) {
      _TickState.sending => (LucideIcons.clock, AppColors.textOnAccent),
      _TickState.sent => (LucideIcons.check, AppColors.textOnAccent),
      _TickState.delivered => (
        LucideIcons.checkCheck,
        AppColors.textOnAccent.withValues(alpha: 0.78),
      ),
      _TickState.read => (LucideIcons.checkCheck, AppColors.textOnAccent),
      _TickState.failed => (LucideIcons.alertCircle, AppColors.textOnAccent),
    };
    return Semantics(
      label: _tickLabel(context.l10n, status),
      child: Icon(icon, size: 14, color: color),
    );
  }
}
