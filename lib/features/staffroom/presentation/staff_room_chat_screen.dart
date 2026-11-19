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
import '../../moderation/presentation/blocked_teachers_controller.dart';
import '../../moderation/presentation/moderation_actions.dart';
import '../../vidya/presentation/vidya_cta_clearance.dart';
import '../data/chat_stream_provider.dart';
import '../data/staffroom_providers.dart';
import '../domain/chat_message.dart';
import '../domain/chat_quote.dart';
import 'widgets/chat_bubble.dart';
import 'widgets/chat_parts.dart';

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
  const StaffRoomChatScreen({
    super.key,
    required this.room,
    this.title,
    this.quote,
  });

  /// The community Staff Room or a group chat.
  final ChatRoom room;

  /// A feed post being replied to: the composer starts with its quote.
  final ChatQuote? quote;

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
  void initState() {
    super.initState();
    final quote = widget.quote;
    if (quote != null) _composer.text = quote.asDraft();
  }

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

  /// Re-sends one failed message; skipped when its echo already arrived.
  Future<void> _retry(String clientMessageId, List<ChatMessage> server) => ref
      .read(chatSendControllerProvider(_room).notifier)
      .retry(clientMessageId, server: server);

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(
      _room.isCommunity
          ? staffRoomChatProvider
          : groupChatProvider(_room.groupId!),
    );
    final myUid = ref.watch(currentStaffroomUserIdProvider);

    return Scaffold(
      body: Column(
        children: [
          ChatHeader(
            title: _appBarTitle(context),
            subline: _subline(context, async.valueOrNull, myUid),
          ),
          Expanded(
            child: SafeArea(
              top: false,
              child: async.when(
                loading: () => const Padding(
                  padding: AppSpacing.pagePadding,
                  child: AppSkeleton(lines: 5),
                ),
                error: (_, _) => _ChatError(room: _room),
                data: (snapshot) => _body(context, snapshot, myUid),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// "Teachers across Bharat" for the community room, plus "N here today" when
  /// the loaded messages show real teachers (not AI personas) writing today.
  String? _subline(
    BuildContext context,
    TransportSnapshot<List<ChatMessage>>? snapshot,
    String? myUid,
  ) {
    final l10n = context.l10n;
    final ready =
        snapshot != null &&
        myUid != null &&
        !snapshot.hasError &&
        !snapshot.isLoading &&
        !snapshot.isEmptyByDesign;
    final here = ready
        ? chatAuthorsToday(
            snapshot.data,
            blocked: ref.watch(blockedUidsProvider),
            now: DateTime.now(),
          )
        : 0;
    final parts = [
      if (_room.isCommunity) l10n.communityDeck,
      if (here > 0) l10n.cmChatHereToday(here),
    ];
    return parts.isEmpty ? null : parts.join(' · ');
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
    // Blocked teachers' messages are hidden at once.
    final blocked = ref.watch(blockedUidsProvider);
    final display = [
      for (final m in mergeChatForDisplay(server, sendState.pending))
        if (!blocked.contains(m.authorId)) m,
    ];
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
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.space4,
                    vertical: AppSpacing.space3,
                  ),
                  itemCount: display.length,
                  itemBuilder: (context, index) {
                    final i = display.length - 1 - index;
                    final message = display[i];
                    final previous = i > 0 ? display[i - 1] : null;
                    final day = chatDay(message.createdAt);
                    // A new day opens with a pill — only when the timestamps
                    // say so (an in-flight send has none).
                    final newDay =
                        day != null && day != chatDay(previous?.createdAt);
                    final sameRun =
                        previous != null &&
                        !newDay &&
                        previous.authorId == message.authorId &&
                        previous.isDemoPersona == message.isDemoPersona;

                    Widget bubble = ChatBubble(
                      key: ValueKey<String>('chat-${message.id}'),
                      message: message,
                      myUid: myUid,
                      showAuthor: !sameRun,
                      continued: sameRun,
                    );
                    if (message.authorId.isNotEmpty &&
                        message.authorId != myUid) {
                      // Another teacher's message: long-press to report it or
                      // block them.
                      bubble = GestureDetector(
                        onLongPress: () => showMessageModerationSheet(
                          context,
                          ref,
                          messageId: message.id,
                          authorUid: message.authorId,
                          authorName: message.authorName,
                        ),
                        child: bubble,
                      );
                    }
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (newDay)
                          ChatDayPill(
                            chatDayLabel(context, day, DateTime.now()),
                          ),
                        Padding(
                          padding: EdgeInsets.only(
                            top: previous == null || newDay
                                ? 0
                                : (sameRun ? AppSpacing.space1 : 10),
                          ),
                          child: bubble,
                        ),
                      ],
                    );
                  },
                ),
        ),
        // One bar per message that failed, each with its own retry.
        for (final failed in unresolvedFailures(server, sendState.failed))
          _SendFailedBar(
            message: failed.text,
            onRetry: () => _retry(failed.clientMessageId, server),
          ),
        // The floating orb parks above the pinned composer.
        VidyaCtaClearance(
          child: _Composer(
            controller: _composer,
            onSend: () => _send(knownServerIds),
          ),
        ),
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
  const _SendFailedBar({required this.message, required this.onRetry});

  /// The text that did not send, so the teacher knows which one this is.
  final String message;
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  l10n.inboxSendFailed,
                  style: text.bodyMedium?.copyWith(
                    color: scheme.onErrorContainer,
                  ),
                ),
                Text(
                  '“$message”',
                  style: text.bodySmall?.copyWith(
                    color: scheme.onErrorContainer,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.space2),
          // A long translation wraps inside the button instead of overflowing.
          Flexible(
            child: TextButton(
              onPressed: onRetry,
              style: TextButton.styleFrom(
                foregroundColor: scheme.onErrorContainer,
                minimumSize: const Size(48, 48),
              ),
              child: Text(l10n.actionRetry, textAlign: TextAlign.center),
            ),
          ),
        ],
      ),
    );
  }
}

/// The bottom composer (mirrors U-SI1): a rounded, growable text field
/// (client-capped at 500 chars, per SPEC §A3.2) + a round 48dp send button —
/// white on saffron-600, 5.4:1 ([ChatComposerRow]).
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
    final canSend = widget.controller.text.trim().isNotEmpty;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.space3,
          AppSpacing.space2,
          AppSpacing.space3,
          AppSpacing.space3,
        ),
        child: ChatComposerRow(
          controller: widget.controller,
          canSend: canSend,
          onSend: widget.onSend,
          // Chat text is capped at 500 chars server-side; mirror it here so
          // the teacher never types a message the server will reject.
          inputFormatters: [LengthLimitingTextInputFormatter(500)],
        ),
      ),
    );
  }
}

/// How many different real teachers (never an AI persona, never a blocked
/// teacher) wrote a message on [now]'s local day, counted from the loaded
/// messages only — the room's honest "here today".
@visibleForTesting
int chatAuthorsToday(
  List<ChatMessage> messages, {
  required Set<String> blocked,
  required DateTime now,
}) {
  final local = now.toLocal();
  final today = DateTime(local.year, local.month, local.day);
  return <String>{
    for (final m in messages)
      if (!m.isDemoPersona &&
          m.authorId.isNotEmpty &&
          !blocked.contains(m.authorId) &&
          chatDay(m.createdAt) == today)
        m.authorId,
  }.length;
}
