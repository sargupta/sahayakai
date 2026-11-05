import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../inbox/data/inbox_transport.dart';
import '../../../inbox/data/messages_stream_provider.dart';
import '../../../inbox/domain/inbox_models.dart';
import '../../data/staffroom_providers.dart';
import '../../domain/connection.dart';
import '../community_errors.dart';
import 'community_pill_button.dart';

/// Opens (creating if needed) the 1:1 conversation with [otherUid] —
/// `POST /api/messages/conversations/direct` — then pushes its thread.
///
/// The thread is handed a [Conversation] built only from facts already on
/// screen (the uids, and the other teacher's name/photo as the server listed
/// them) so its app bar paints at once; the live inbox doc takes over from
/// there. Throws when the conversation cannot be opened, for the caller to
/// show inline.
Future<void> openDirectMessage(
  BuildContext context,
  WidgetRef ref, {
  required String otherUid,
  required String displayName,
  String? photoURL,
}) async {
  final myUid = ref.read(currentInboxUserIdProvider);
  final id = await ref
      .read(inboxTransportProvider)
      .getOrCreateDirectConversation(otherUid);
  if (!context.mounted) return;
  final name = displayName.trim();
  // Not awaited: the push future completes only when the thread is popped.
  unawaited(
    context.push<void>(
      Routes.conversationThreadPath(id.value),
      extra: myUid == null || name.isEmpty
          ? null
          : Conversation(
              id: id,
              type: ConversationType.direct,
              participantIds: <String>[myUid, otherUid],
              participants: <String, ParticipantSnapshot>{
                otherUid: ParticipantSnapshot(
                  displayName: name,
                  photoURL: photoURL,
                ),
              },
              lastMessage: '',
              lastMessageSenderId: '',
              unreadCount: const <String, int>{},
            ),
    ),
  );
}

/// The connection control for one teacher, driven by
/// [connectionsControllerProvider] so every place that teacher appears agrees:
///
///   - none             → **Connect** (`POST /api/connections/request`);
///   - pending, sent    → a settled **Requested** label;
///   - pending, received→ **Accept** + **Decline**;
///   - connected        → **Message** (opens the DM), plus **Disconnect**
///     (confirmed) when [allowDisconnect] is set.
///
/// A failed action keeps the control as it was and shows a translated inline
/// reason under it (rate limit, offline, or a generic "couldn't update").
/// The settled label after Connect comes from the server's answer
/// (`sent` / `already_pending` / `already_connected`), never assumed.
class TeacherConnectionAction extends ConsumerStatefulWidget {
  const TeacherConnectionAction({
    super.key,
    required this.uid,
    required this.displayName,
    this.photoURL,
    this.allowDisconnect = false,
    this.compact = false,
    this.filled = false,
    this.respond = false,
  });

  final String uid;
  final String displayName;
  final String? photoURL;
  final bool allowDisconnect;

  /// The feed's small chip (the map's post footer): "Connect" while not
  /// connected, "Requested" once asked, and nothing otherwise — or while the
  /// teacher's connections have not loaded, so it never offers Connect to
  /// someone already connected. Errors go to a snackbar.
  final bool compact;

  /// Compact only: Connect as the map's filled saffron chip (`.chip.s.on`,
  /// the network page) instead of the outline chip (the feed).
  final bool filled;

  /// Compact only: a request from this teacher shows Decline and a green
  /// Accept (the map's Messages pane) instead of nothing.
  final bool respond;

  @override
  ConsumerState<TeacherConnectionAction> createState() =>
      _TeacherConnectionActionState();
}

class _TeacherConnectionActionState
    extends ConsumerState<TeacherConnectionAction> {
  bool _busy = false;
  String? _error;

  ConnectionsController get _controller =>
      ref.read(connectionsControllerProvider.notifier);

  Future<void> _run(
    Future<void> Function() action, {
    required String fallback,
  }) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      if (mounted) setState(() => _busy = false);
    } catch (error) {
      if (!mounted) return;
      final message = communityErrorText(
        context.l10n,
        error,
        fallback: fallback,
      );
      setState(() {
        _busy = false;
        _error = widget.compact ? null : message;
      });
      if (widget.compact) _snack(message);
    }
  }

  void _connect() => _run(() async {
    final result = await _controller.request(widget.uid);
    if (!mounted) return;
    final l10n = context.l10n;
    final message = switch (result) {
      ConnectionRequestResult.sent => l10n.staffroomConnectSent,
      ConnectionRequestResult.alreadyPending => l10n.staffroomConnectPending,
      ConnectionRequestResult.alreadyConnected =>
        l10n.staffroomConnectConnected,
    };
    _snack(message);
  }, fallback: context.l10n.staffroomConnectionFailed);

  void _accept() => _run(() async {
    await _controller.accept(widget.uid);
    if (mounted) _snack(context.l10n.communityNowConnected);
  }, fallback: context.l10n.staffroomConnectionFailed);

  void _decline() => _run(
    () => _controller.decline(widget.uid),
    fallback: context.l10n.staffroomConnectionFailed,
  );

  void _message() => _run(
    () => openDirectMessage(
      context,
      ref,
      otherUid: widget.uid,
      displayName: widget.displayName,
      photoURL: widget.photoURL,
    ),
    fallback: context.l10n.communityMessageFailed,
  );

  Future<void> _confirmDisconnect() async {
    final l10n = context.l10n;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.staffroomDisconnectConfirmTitle),
        content: Text(l10n.staffroomDisconnectConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.staffroomDisconnectCancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: Text(l10n.staffroomDisconnect),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _run(
      () => _controller.disconnect(widget.uid),
      fallback: l10n.staffroomConnectionFailed,
    );
  }

  void _snack(String message) {
    ScaffoldMessenger.maybeOf(context)
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final loaded = ref.watch(connectionsControllerProvider).valueOrNull;
    if (widget.compact) {
      if (loaded == null) return const SizedBox.shrink();
      return switch (loaded.statusFor(widget.uid)) {
        ConnectionStatus.none => _CompactChip(
          label: l10n.staffroomConnect,
          busy: _busy,
          onTap: _connect,
          fill: widget.filled ? AppColors.accentFill : null,
        ),
        ConnectionStatus.pendingSent => _CompactChip(
          label: l10n.staffroomRequested,
        ),
        ConnectionStatus.pendingReceived when widget.respond => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _CompactChip(
              label: l10n.staffroomConnectionDecline,
              busy: _busy,
              onTap: _decline,
              ink: AppColors.textBody,
            ),
            const SizedBox(width: 6),
            _CompactChip(
              label: l10n.staffroomConnectionAccept,
              busy: _busy,
              onTap: _accept,
              fill: AppColors.leaf500,
            ),
          ],
        ),
        ConnectionStatus.pendingReceived ||
        ConnectionStatus.connected => const SizedBox.shrink(),
      };
    }
    final data = loaded ?? const MyConnectionData();
    final status = data.statusFor(widget.uid);

    final Widget action = switch (status) {
      ConnectionStatus.none => CommunityPillButton(
        label: l10n.staffroomConnect,
        icon: LucideIcons.userPlus,
        busy: _busy,
        onPressed: _connect,
      ),
      ConnectionStatus.pendingSent => _Settled(label: l10n.staffroomRequested),
      ConnectionStatus.pendingReceived => Wrap(
        spacing: AppSpacing.space1,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          CommunityPillButton(
            label: l10n.staffroomConnectionAccept,
            busy: _busy,
            onPressed: _accept,
          ),
          CommunityPillButton(
            label: l10n.staffroomConnectionDecline,
            tone: CommunityPillTone.outline,
            onPressed: _busy ? null : _decline,
          ),
        ],
      ),
      ConnectionStatus.connected => Wrap(
        spacing: AppSpacing.space1,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          CommunityPillButton(
            label: l10n.staffroomMessage,
            icon: LucideIcons.messageCircle,
            busy: _busy,
            onPressed: _message,
          ),
          if (widget.allowDisconnect)
            CommunityPillButton(
              label: l10n.staffroomDisconnect,
              tone: CommunityPillTone.outline,
              onPressed: _busy ? null : _confirmDisconnect,
            ),
        ],
      ),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        action,
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.space1),
            child: Text(
              _error!,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.danger),
            ),
          ),
      ],
    );
  }
}

/// The map's small post-footer chip (`.chip.s`, saffron ink): white with a
/// hairline ring, 28px drawn inside a 44dp touch row. Without [onTap] it is the
/// settled "Requested" state, with a check.
class _CompactChip extends StatelessWidget {
  const _CompactChip({
    required this.label,
    this.onTap,
    this.busy = false,
    this.fill,
    this.ink = AppColors.textLink,
  });

  final String label;
  final VoidCallback? onTap;
  final bool busy;

  /// A filled chip (white label) — saffron Connect, green Accept. Null is the
  /// white chip with a hairline ring and [ink] label.
  final Color? fill;
  final Color ink;

  @override
  Widget build(BuildContext context) {
    final settled = onTap == null;
    final chip = Container(
      height: 28,
      padding: const EdgeInsets.symmetric(horizontal: 11),
      decoration: ShapeDecoration(
        color: fill ?? Colors.white,
        shape: StadiumBorder(
          side: fill == null
              ? const BorderSide(color: AppColors.borderHairline)
              : BorderSide.none,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (settled) ...[
            Icon(LucideIcons.check, size: 13, color: ink),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: fill == null ? ink : AppColors.textOnAccent,
            ),
          ),
        ],
      ),
    );
    return Semantics(
      button: !settled,
      enabled: !busy,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: settled || busy ? null : onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44, minWidth: 44),
          child: Center(
            widthFactor: 1,
            child: Opacity(opacity: busy ? 0.55 : 1, child: chip),
          ),
        ),
      ),
    );
  }
}

/// A settled, non-interactive state ("Requested"): a check + label in the
/// saffron text token, inside the same 48dp row height as the buttons.
class _Settled extends StatelessWidget {
  const _Settled({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 48),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(LucideIcons.check, size: 15, color: AppColors.textLink),
          const SizedBox(width: AppSpacing.space1),
          Flexible(
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: AppColors.textLink,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
