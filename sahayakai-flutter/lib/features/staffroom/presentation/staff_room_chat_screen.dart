import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../inbox/data/block_c_transport.dart';
import '../data/chat_stream_provider.dart';
import '../data/staffroom_providers.dart';
import '../domain/chat_message.dart';
import 'widgets/chat_bubble.dart';

/// U-SI3 — the Staff Room chat (SPEC §A3.2), parameterized for the community
/// Staff Room ([ChatRoom.community]) OR one group ([ChatRoom.group]). A reversed
/// lazy list of [ChatBubble]s (own vs others vs AI persona) over the live
/// `staffRoomChat` / `groupChat` stream, with an optimistic composer and the
/// honest persona-pulse keep-warm timer.
///
/// State mapping mirrors the U-SI1 thread:
///   • `error` → an `ErrorView` + retry;
///   • `loading` → an `AppSkeleton`;
///   • `awaitingFirebase` / `signedOut` (or a null uid) → the sign-in `EmptyView`
///     ("Sign in to join the staff room"), composer hidden;
///   • `ready` empty → the "Be the first to say hello" `EmptyView`;
///   • `ready` → the bubbles + composer.
///
/// **Optimistic send** (via [ChatSendController]): a pending bubble is appended,
/// the REST-wrapper send fires, and on success it is marked sent and the live
/// stream reconciles it ([mergeChatForDisplay]); on a `TransportUnavailable` /
/// error it rolls back and a dignified inline "couldn't send · retry" appears —
/// the retry re-sends with the SAME clientMessageId.
///
/// **Persona pulse** (via [PersonaPulseController]): watched while the ready chat
/// is on screen so an AI teacher persona keeps the community room warm; it cancels
/// on dispose (leaving the screen) and permanently stops on a 503. Group chats do
/// not arm it.
///
/// **Firebase-gated:** on-device the transport is deferred, so this always
/// resolves to `awaitingFirebase` → the sign-in state and the composer is hidden
/// (verified by code + test, not live).
class StaffRoomChatScreen extends ConsumerStatefulWidget {
  const StaffRoomChatScreen({super.key, required this.room, this.title});

  /// The community Staff Room or a group chat.
  final ChatRoom room;

  /// A pre-known app-bar title (a group name handed through the route `extra`)
  /// for an instant paint; null → resolved from the group read, or the default
  /// "Staff room" for the community room.
  final String? title;

  @override
  ConsumerState<StaffRoomChatScreen> createState() =>
      _StaffRoomChatScreenState();
}

class _StaffRoomChatScreenState extends ConsumerState<StaffRoomChatScreen> {
  final TextEditingController _composer = TextEditingController();

  ChatRoom get _room => widget.room;

  @override
  void dispose() {
    _composer.dispose();
    super.dispose();
  }

  Future<void> _send(Set<String> knownServerIds) async {
    final text = _composer.text.trim();
    if (text.isEmpty) return;
    _composer.clear();
    await ref
        .read(chatSendControllerProvider(_room).notifier)
        .send(text: text, knownServerIds: knownServerIds);
  }

  Future<void> _retry(Set<String> knownServerIds) => ref
      .read(chatSendControllerProvider(_room).notifier)
      .retry(knownServerIds: knownServerIds);

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(
      _room.isCommunity
          ? staffRoomChatProvider
          : groupChatProvider(_room.groupId!),
    );
    final myUid = ref.watch(currentStaffroomUserIdProvider);

    return Scaffold(
      appBar: AppBar(title: Text(_appBarTitle(context))),
      body: SafeArea(
        child: async.when(
          loading: () => const Padding(
            padding: AppSpacing.pagePadding,
            child: AppSkeleton(lines: 5),
          ),
          error: (_, _) => _ChatError(room: _room),
          data: (snapshot) => _body(context, snapshot, myUid),
        ),
      ),
    );
  }

  String _appBarTitle(BuildContext context) {
    final l10n = context.l10n;
    if (_room.isCommunity) return l10n.staffroomChatTitle;
    final given = widget.title?.trim();
    if (given != null && given.isNotEmpty) return given;
    final group = ref.watch(staffroomGroupProvider(_room.groupId!)).valueOrNull;
    return (group?.name.trim().isNotEmpty ?? false)
        ? group!.name.trim()
        : l10n.staffroomChatTitle;
  }

  Widget _body(
    BuildContext context,
    TransportSnapshot<List<ChatMessage>> snapshot,
    String? myUid,
  ) {
    if (snapshot.hasError) return _ChatError(room: _room);
    if (snapshot.isLoading) {
      return const Padding(
        padding: AppSpacing.pagePadding,
        child: AppSkeleton(lines: 5),
      );
    }
    if (snapshot.isEmptyByDesign || myUid == null) {
      return const _ChatSignIn();
    }
    return _ready(context, snapshot.data, myUid);
  }

  Widget _ready(BuildContext context, List<ChatMessage> server, String myUid) {
    // Arm the honest keep-warm timer while the ready chat is open (community
    // only; a group chat's controller no-ops). Cancels on dispose, stops on 503.
    ref.watch(personaPulseControllerProvider(_room));

    final sendState = ref.watch(chatSendControllerProvider(_room));
    final display = mergeChatForDisplay(server, sendState.pending);
    final knownServerIds = <String>{for (final s in server) s.id};

    return Column(
      children: [
        Expanded(
          // A LAZY reversed list so bubbles build/recycle on demand — reverse:
          // true → item 0 sits at the bottom (newest); the room reads bottom-up.
          child: display.isEmpty
              ? const _ChatEmpty()
              : ListView.builder(
                  reverse: true,
                  padding: AppSpacing.pagePadding,
                  itemCount: display.length,
                  itemBuilder: (context, index) {
                    final message = display[display.length - 1 - index];
                    return ChatBubble(
                      key: ValueKey<String>('chat-${message.id}'),
                      message: message,
                      myUid: myUid,
                    );
                  },
                ),
        ),
        if (sendState.hasFailure)
          _SendFailedBar(onRetry: () => _retry(knownServerIds)),
        _Composer(controller: _composer, onSend: () => _send(knownServerIds)),
      ],
    );
  }
}

/// The sign-in / awaiting surface — what the chat shows on-device (deferred).
class _ChatSignIn extends StatelessWidget {
  const _ChatSignIn();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return SingleChildScrollView(
      padding: AppSpacing.pagePadding,
      child: EmptyView(
        icon: LucideIcons.messagesSquare,
        title: l10n.staffroomChatSignInTitle,
        message: l10n.staffroomChatSignInBody,
      ),
    );
  }
}

/// A ready but empty room: a gentle prompt to say the first hello.
class _ChatEmpty extends StatelessWidget {
  const _ChatEmpty();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return SingleChildScrollView(
      padding: AppSpacing.pagePadding,
      child: EmptyView(
        icon: LucideIcons.messagesSquare,
        title: l10n.staffroomChatEmptyTitle,
        message: l10n.staffroomChatEmptyBody,
      ),
    );
  }
}

class _ChatError extends ConsumerWidget {
  const _ChatError({required this.room});

  final ChatRoom room;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    return SingleChildScrollView(
      padding: AppSpacing.pagePadding,
      child: ErrorView(
        message: l10n.staffroomErrorBody,
        onRetry: () => ref.invalidate(
          room.isCommunity
              ? staffRoomChatProvider
              : groupChatProvider(room.groupId!),
        ),
      ),
    );
  }
}

/// The rolled-back-send notice with an inline retry (mirrors U-SI1). Dignified,
/// not a crash: the message did not go through, and the teacher can retry it
/// (same idempotent clientMessageId).
class _SendFailedBar extends StatelessWidget {
  const _SendFailedBar({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return Container(
      width: double.infinity,
      color: scheme.errorContainer,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space4,
        vertical: AppSpacing.space2,
      ),
      child: Row(
        children: [
          Icon(
            LucideIcons.alertCircle,
            size: AppIconSize.inline,
            color: scheme.onErrorContainer,
          ),
          const SizedBox(width: AppSpacing.space2),
          Expanded(
            child: Text(
              l10n.inboxSendFailed,
              style: text.bodyMedium?.copyWith(color: scheme.onErrorContainer),
            ),
          ),
          const SizedBox(width: AppSpacing.space2),
          TextButton(
            onPressed: onRetry,
            style: TextButton.styleFrom(
              foregroundColor: scheme.onErrorContainer,
              minimumSize: const Size(48, 48),
            ),
            child: Text(l10n.actionRetry),
          ),
        ],
      ),
    );
  }
}

/// The bottom composer (mirrors U-SI1): a growable text field (client-capped at
/// 500 chars, per SPEC §A3.2) + a ≥48dp send button. The send button uses the
/// AA-safe `primaryContainer` + `onPrimaryContainer` pairing (6.9:1) — a small
/// saffron glyph on the `#E0924D` fill would be only 2.5:1.
class _Composer extends StatefulWidget {
  const _Composer({required this.controller, required this.onSend});

  final TextEditingController controller;
  final VoidCallback onSend;

  @override
  State<_Composer> createState() => _ComposerState();
}

class _ComposerState extends State<_Composer> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final canSend = widget.controller.text.trim().isNotEmpty;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.space4,
          AppSpacing.space2,
          AppSpacing.space4,
          AppSpacing.space2,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: widget.controller,
                minLines: 1,
                maxLines: 5,
                // Chat text is capped at 500 chars server-side; mirror it here so
                // the teacher never types a message the server will reject.
                inputFormatters: [LengthLimitingTextInputFormatter(500)],
                textInputAction: TextInputAction.newline,
                keyboardType: TextInputType.multiline,
                decoration: InputDecoration(
                  hintText: l10n.inboxComposerHint,
                  isDense: true,
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
                      color: canSend
                          ? scheme.primaryContainer
                          : scheme.surfaceContainerHigh,
                      shape: const CircleBorder(),
                    ),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: canSend ? widget.onSend : null,
                      child: Icon(
                        LucideIcons.send,
                        size: AppIconSize.inline,
                        color: canSend
                            ? scheme.onPrimaryContainer
                            : scheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
