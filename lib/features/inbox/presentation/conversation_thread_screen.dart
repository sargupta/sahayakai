import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/secondary_button.dart';
import '../../moderation/domain/moderation.dart';
import '../../moderation/presentation/moderation_actions.dart';
import '../../staffroom/presentation/widgets/chat_parts.dart';
import '../../vidya/presentation/vidya_cta_clearance.dart';
import '../data/block_c_transport.dart';
import '../data/inbox_transport.dart';
import '../data/messages_stream_provider.dart';
import '../domain/conversation_id.dart';
import '../domain/inbox_models.dart';
import 'widgets/conversation_row.dart';
import 'widgets/message_bubble.dart';

/// The server-side message-text cap the composer guards BEFORE dispatch
/// (`firestore.rules:123` — `request.resource.data.text.size() <= 1000` on
/// `conversations/{convId}/messages/{msgId}` create).
///
/// **Characters, matching the production web app.** The web send path
/// (`sahayakai-main/src/app/actions/messages.ts` — `if (trimmed.length > 1000)
/// throw 'Message too long (max 1000 chars)'`) and its composer
/// (`maxLength={1000}`) both cap at 1000 *characters* (JS `String.length` =
/// UTF-16 code units) and rely on this same `text.size() <= 1000` rule as the
/// backstop — a shipped, working product that Indic teachers use every day, so
/// the rule's `size()` is a 1000-**character** cap in practice, not bytes. An
/// earlier version of this guard (and the staffroom guard) counted UTF-8 bytes;
/// that under-cut the real limit ~3x for Indic scripts (~3 bytes/char), wrongly
/// blocking a normal 400-character Bengali reply the server would happily
/// accept. Dart's `String.length` is UTF-16 code units, exactly matching the
/// web's `String.length`, so this guard mirrors the web character-for-character.
const int kInboxMessageMaxChars = 1000;

/// The trimmed text's length in the same unit the web caps on and the rule
/// backstops (UTF-16 code units, matching web's `String.length`).
int inboxMessageLength(String text) => text.trim().length;

/// U-SI1 — the conversation thread (SPEC §B3.2). A reversed list of message
/// bubbles (mine vs theirs), honest "load older" pagination, and an optimistic
/// composer, over the live `conversationThreadProvider` tail.
///
/// State mapping mirrors the inbox list: `awaitingFirebase` / `signedOut` (or a
/// null uid) → the sign-in `EmptyView`; `error` → an `ErrorView` + retry;
/// `loading` → an `AppSkeleton`; `ready` → the bubbles + composer.
///
/// **Optimistic send** (SPEC §B3.2): a pending bubble is appended and
/// `sendMessage` fires with a stable `clientMessageId` (idempotent). On success
/// the bubble is marked sent and the live stream reconciles it (dedup by
/// `clientMessageId`); on a `TransportUnavailable`/typed error the bubble rolls
/// back and a dignified inline "couldn't send · retry" appears — the retry
/// re-sends with the SAME id, so a server that did receive the first attempt
/// dedups it. **markConversationRead** fires once on open (swallowing the
/// deferred `TransportUnavailable` — opening a thread must never crash).
///
/// **Firebase-gated:** on-device the transport is deferred, so this always
/// resolves to `awaitingFirebase` → the sign-in state and the composer is hidden
/// (verified by code + test, not live).
class ConversationThreadScreen extends ConsumerStatefulWidget {
  const ConversationThreadScreen({
    super.key,
    required this.conversationId,
    this.conversation,
  });

  final ConversationId conversationId;

  /// The conversation handed through the route `extra` (from the inbox row) so
  /// the app bar paints the other participant instantly. Null on a cold deep
  /// link — the app bar then shows a neutral fallback title.
  final Conversation? conversation;

  @override
  ConsumerState<ConversationThreadScreen> createState() =>
      _ConversationThreadScreenState();
}

class _ConversationThreadScreenState
    extends ConsumerState<ConversationThreadScreen> {
  final TextEditingController _composer = TextEditingController();

  /// Older pages loaded above the live tail (oldest-first).
  List<Message> _older = const <Message>[];

  /// Optimistic, in-flight (or just-sent) messages, keyed by clientMessageId.
  final List<_PendingSend> _pending = <_PendingSend>[];

  bool _loadingOlder = false;
  bool _noMoreOlder = false;
  bool _markReadFired = false;

  // Inline retry state after a rolled-back send.
  bool _sendFailed = false;
  String? _failedText;
  String? _failedClientId;

  static int _clientIdCounter = 0;

  @override
  void initState() {
    super.initState();
    // Clear unread + the bell on open — once, after the first frame. Best-effort:
    // the deferred transport throws TransportUnavailable, which we swallow so
    // opening a thread on-device never crashes.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _markReadFired) return;
      _markReadFired = true;
      _markRead();
    });
  }

  @override
  void dispose() {
    _composer.dispose();
    super.dispose();
  }

  Future<void> _markRead() async {
    try {
      await ref
          .read(inboxTransportProvider)
          .markConversationRead(widget.conversationId);
    } on TransportUnavailable {
      // Awaiting Firebase — there is no unread to clear yet.
    } catch (_) {
      // Best-effort: a mark-read failure must never block reading the thread.
    }
  }

  String _newClientId() =>
      'cmid-${DateTime.now().microsecondsSinceEpoch}-${_clientIdCounter++}';

  Future<void> _send() async {
    final text = _composer.text.trim();
    final myUid = ref.read(currentInboxUserIdProvider);
    if (text.isEmpty || myUid == null) return;
    // Stop an oversized message HERE, before dispatch — the composer already
    // disables the send button while over the cap, but this belt-and-suspenders
    // guard means no code path can push a >1000-character message into the
    // "couldn't send · retry" loop against firestore.rules:123. Characters,
    // matching the web cap — see [kInboxMessageMaxChars].
    if (inboxMessageLength(text) > kInboxMessageMaxChars) return;

    final pending = _PendingSend(
      clientMessageId: _newClientId(),
      text: text,
      senderId: myUid,
    );
    setState(() {
      _pending.add(pending);
      _composer.clear();
      _sendFailed = false;
      _failedText = null;
      _failedClientId = null;
    });
    await _dispatch(pending);
  }

  Future<void> _retry() async {
    final text = _failedText;
    final clientId = _failedClientId;
    final myUid = ref.read(currentInboxUserIdProvider);
    if (text == null || clientId == null || myUid == null) return;

    // Reuse the SAME clientMessageId so a server that received the first attempt
    // dedups the retry (no double message, no double unread increment).
    final pending = _PendingSend(
      clientMessageId: clientId,
      text: text,
      senderId: myUid,
    );
    setState(() {
      _pending.add(pending);
      _sendFailed = false;
      _failedText = null;
      _failedClientId = null;
    });
    await _dispatch(pending);
  }

  Future<void> _dispatch(_PendingSend pending) async {
    try {
      await ref
          .read(inboxTransportProvider)
          .sendMessage(
            SendMessageInput(
              conversationId: widget.conversationId,
              type: MessageType.text,
              text: pending.text,
              clientMessageId: pending.clientMessageId,
            ),
          );
      if (!mounted) return;
      // Mark sent; the live stream carries the real message and dedups it.
      setState(() => pending.status = MessageDeliveryStatus.sent);
    } on TransportUnavailable {
      _rollback(pending);
    } catch (_) {
      _rollback(pending);
    }
  }

  void _rollback(_PendingSend pending) {
    if (!mounted) return;
    setState(() {
      _pending.remove(pending);
      _sendFailed = true;
      _failedText = pending.text;
      _failedClientId = pending.clientMessageId;
    });
  }

  Future<void> _loadOlder(List<Message> currentOldestFirst) async {
    if (_loadingOlder || currentOldestFirst.isEmpty) return;
    final oldestId = currentOldestFirst.first.id;
    setState(() => _loadingOlder = true);
    try {
      final older = await ref
          .read(inboxTransportProvider)
          .loadOlderMessages(widget.conversationId, beforeMessageId: oldestId);
      if (!mounted) return;
      setState(() {
        if (older.isEmpty) {
          _noMoreOlder = true;
        } else {
          _older = _dedupById(<Message>[...older, ..._older]);
        }
        _loadingOlder = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingOlder = false);
    }
  }

  static List<Message> _dedupById(List<Message> msgs) {
    final seen = <String>{};
    final out = <Message>[];
    for (final m in msgs) {
      if (seen.add(m.id)) out.add(m);
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(conversationThreadProvider(widget.conversationId));
    final myUid = ref.watch(currentInboxUserIdProvider);

    // A message that arrives while the thread is open has been seen: mark the
    // thread read again, so it does not come back as unread on the inbox and
    // the bell. Only for a NEW latest message from the other side (the thread
    // is oldest-first), and only after the on-open mark has fired.
    ref.listen<AsyncValue<TransportSnapshot<List<Message>>>>(
      conversationThreadProvider(widget.conversationId),
      (previous, next) {
        final latest = next.valueOrNull?.data.lastOrNull;
        // The first load is covered by the on-open mark.
        final before = previous?.valueOrNull;
        if (!_markReadFired || latest == null || before == null) return;
        if (latest.id == before.data.lastOrNull?.id) return;
        if (latest.senderId == ref.read(currentInboxUserIdProvider)) return;
        unawaited(_markRead());
      },
    );

    // One-to-one: report or block the other teacher from the title bar.
    final convo = widget.conversation;
    final otherUid = (convo == null || myUid == null)
        ? null
        : convo.otherParticipantId(myUid);
    final otherName = (otherUid == null || myUid == null)
        ? ''
        : convo?.otherParticipant(myUid)?.displayName ?? '';

    return Scaffold(
      body: Column(
        children: [
          ChatHeader(
            title: threadTitle(context.l10n, convo, myUid),
            subline: threadSubline(context.l10n, convo, myUid),
            leading: (convo == null || myUid == null)
                ? null
                : InboxAvatarShim(conversation: convo, myUid: myUid, size: 38),
            actions: [
              if (otherUid != null && otherUid.isNotEmpty)
                ModerationMenuButton(
                  reportLabel: context.l10n.moderationReportTeacher(
                    moderationName(context.l10n, otherName),
                  ),
                  target: ReportTarget.profile,
                  targetId: otherUid,
                  authorUid: otherUid,
                  authorName: otherName,
                  // They can no longer message each other: leave the thread.
                  onBlocked: () {
                    if (mounted) Navigator.of(context).maybePop();
                  },
                ),
            ],
          ),
          Expanded(
            child: SafeArea(
              top: false,
              child: async.when(
                loading: () => const Padding(
                  padding: AppSpacing.pagePadding,
                  child: AppSkeleton(lines: 5),
                ),
                error: (_, _) =>
                    _ThreadError(conversationId: widget.conversationId),
                data: (snapshot) => _body(context, snapshot, myUid),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _body(
    BuildContext context,
    TransportSnapshot<List<Message>> snapshot,
    String? myUid,
  ) {
    if (snapshot.hasError) {
      return _ThreadError(conversationId: widget.conversationId);
    }
    if (snapshot.isLoading) {
      return const Padding(
        padding: AppSpacing.pagePadding,
        child: AppSkeleton(lines: 5),
      );
    }
    if (snapshot.isEmptyByDesign || myUid == null) {
      return const _ThreadSignIn();
    }

    // Ready. Assemble the display list oldest→newest: older pages + the live
    // tail + any still-unreconciled optimistic sends.
    final tail = snapshot.data;
    final merged = _dedupById(<Message>[..._older, ...tail]);
    final reconciled = <String>{
      for (final m in merged) m.id,
      for (final m in merged)
        if (m.clientMessageId != null) m.clientMessageId!,
    };
    final visiblePending = _pending
        .where((p) => !reconciled.contains(p.clientMessageId))
        .toList();
    final ordered = <Message>[
      ...merged,
      for (final p in visiblePending) p.toMessage(),
    ];

    final otherIds = _otherParticipantIds(myUid);
    final isGroup = widget.conversation?.isGroup ?? false;
    final showLoadOlder = merged.isNotEmpty && !_noMoreOlder;

    return Column(
      children: [
        Expanded(
          // A LAZY reversed list so bubbles build/recycle on demand — the loaded
          // history only grows as "load older" pages in, and the cheap phones we
          // target must not lay out every bubble eagerly. reverse:true → item 0
          // sits at the bottom (newest); the "load older" trigger is the last
          // item → visually on top.
          child: ordered.isEmpty
              ? const _ThreadEmpty()
              : ListView.builder(
                  reverse: true,
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.space4,
                    vertical: AppSpacing.space3,
                  ),
                  itemCount: ordered.length + (showLoadOlder ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (index < ordered.length) {
                      final i = ordered.length - 1 - index;
                      final m = ordered[i];
                      final previous = i > 0 ? ordered[i - 1] : null;
                      final day = chatDay(m.createdAt);
                      // A new day opens with a pill — only when timestamps
                      // allow (an optimistic send has none yet).
                      final newDay =
                          day != null && day != chatDay(previous?.createdAt);
                      final sameRun =
                          previous != null &&
                          !newDay &&
                          previous.senderId == m.senderId;
                      final bubble = MessageBubble(
                        key: ValueKey<String>('msg-${m.id}'),
                        message: m,
                        myUid: myUid,
                        otherParticipantIds: otherIds,
                        isGroup: isGroup,
                        showSender: !sameRun,
                        continued: sameRun,
                      );
                      return staggeredItem(
                        context,
                        Column(
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
                              child: m.senderId.isEmpty || m.senderId == myUid
                                  ? bubble
                                  // Someone else's message: long-press to
                                  // report it or block them.
                                  : GestureDetector(
                                      onLongPress: () =>
                                          showMessageModerationSheet(
                                            context,
                                            ref,
                                            messageId: m.id,
                                            authorUid: m.senderId,
                                            authorName: m.senderName,
                                          ),
                                      child: bubble,
                                    ),
                            ),
                          ],
                        ),
                        index: index,
                      );
                    }
                    // index == ordered.length → the load-older trigger (top).
                    return Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.space4),
                      child: SecondaryButton(
                        label: context.l10n.inboxLoadOlder,
                        icon: LucideIcons.arrowUp,
                        isBusy: _loadingOlder,
                        onPressed: () => _loadOlder(merged),
                      ),
                    );
                  },
                ),
        ),
        if (_sendFailed) _SendFailedBar(onRetry: _retry),
        // The floating orb parks above the pinned composer.
        VidyaCtaClearance(
          child: _Composer(controller: _composer, onSend: _send),
        ),
      ],
    );
  }

  /// Every participant other than me — for the delivery/read tick. From the
  /// route's conversation when present, else recovered from the deterministic
  /// direct id (`a_b`).
  List<String> _otherParticipantIds(String myUid) {
    final ids =
        widget.conversation?.participantIds ??
        () {
          final pair = widget.conversationId.directPair;
          return pair == null ? const <String>[] : <String>[pair.a, pair.b];
        }();
    return ids.where((u) => u != myUid).toList();
  }
}

/// The header title: the other participant's name (or the group name), falling
/// back to a neutral label on a cold deep link.
@visibleForTesting
String threadTitle(AppLocalizations l10n, Conversation? convo, String? myUid) {
  if (convo == null || myUid == null) return l10n.inboxThreadFallbackTitle;
  final label = convo.isGroup
      ? convo.name?.trim()
      : convo.otherParticipant(myUid)?.displayName.trim();
  return (label == null || label.isEmpty)
      ? l10n.inboxThreadFallbackTitle
      : label;
}

/// The header subline, from data the conversation actually carries: a group's
/// member count, or the other teacher's preferred language in its own script.
/// Null when there is nothing true to say.
@visibleForTesting
String? threadSubline(
  AppLocalizations l10n,
  Conversation? convo,
  String? myUid,
) {
  if (convo == null || myUid == null) return null;
  if (convo.isGroup) {
    final count = convo.participantIds.length;
    return count > 0 ? l10n.cmThreadMembers(count) : null;
  }
  final language = convo.otherParticipant(myUid)?.preferredLanguage?.trim();
  if (language == null || language.isEmpty) return null;
  return l10n.cmThreadLanguage(_nativeLanguage(language));
}

/// A language stored as its English name ("Kannada") or code ("kn") shown in
/// its own script (ಕನ್ನಡ); one the app does not know is shown as stored.
String _nativeLanguage(String language) {
  final key = language.toLowerCase();
  for (final l in AppLocale.values) {
    if (l.aiName.toLowerCase() == key || l.code.toLowerCase() == key) {
      return l.nativeLabel;
    }
  }
  return language;
}

/// The sign-in / awaiting surface — what the thread shows on-device (deferred).
class _ThreadSignIn extends StatelessWidget {
  const _ThreadSignIn();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return SingleChildScrollView(
      padding: AppSpacing.pagePadding,
      child: staggeredItem(
        context,
        EmptyView(
          icon: LucideIcons.messageCircle,
          title: l10n.inboxSignInTitle,
          message: l10n.inboxSignInBody,
        ),
        index: 0,
      ),
    );
  }
}

/// A ready but empty thread (no messages yet): a gentle prompt to write the
/// first message.
class _ThreadEmpty extends StatelessWidget {
  const _ThreadEmpty();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return SingleChildScrollView(
      padding: AppSpacing.pagePadding,
      child: staggeredItem(
        context,
        EmptyView(
          icon: LucideIcons.messageCircle,
          title: l10n.inboxThreadEmptyTitle,
          message: l10n.inboxThreadEmptyBody,
        ),
        index: 0,
      ),
    );
  }
}

class _ThreadError extends ConsumerWidget {
  const _ThreadError({required this.conversationId});

  final ConversationId conversationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    return SingleChildScrollView(
      padding: AppSpacing.pagePadding,
      child: ErrorView(
        message: l10n.inboxErrorBody,
        onRetry: () =>
            ref.invalidate(conversationThreadProvider(conversationId)),
      ),
    );
  }
}

/// The rolled-back-send notice with an inline retry. Dignified, not a crash: the
/// message did not go through, and the teacher can retry it (same idempotent id).
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
          // ≥48dp text-button retry; a long translation wraps inside it.
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

/// The bottom composer: a rounded, growable text field + a round 48dp send
/// button — white on saffron-600, 5.4:1 ([ChatComposerRow]).
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
    // The 1000-character server cap, matching the web app's `String.length`
    // cap so the client and the shipped web product agree (and never wrongly
    // block a normal-length Indic message). Over the cap → the send button
    // greys out and an honest hint appears, so the message is stopped here, not
    // looped in retry.
    final length = inboxMessageLength(widget.controller.text);
    final tooLong = length > kInboxMessageMaxChars;
    final hasText = widget.controller.text.trim().isNotEmpty;
    final canSend = hasText && !tooLong;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.space3,
          AppSpacing.space2,
          AppSpacing.space3,
          AppSpacing.space3,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (tooLong) _TooLongHint(length: length),
            ChatComposerRow(
              controller: widget.controller,
              canSend: canSend,
              onSend: widget.onSend,
              // Turn the field's own border red while over the cap, so the
              // block state reads even without looking at the hint.
              error: tooLong,
            ),
          ],
        ),
      ),
    );
  }
}

/// The honest over-limit state: an inline hint + a character counter, shown
/// when the composer text exceeds the 1000-character server cap
/// ([kInboxMessageMaxChars]). Send is disabled while it shows, so an oversized
/// paste is stopped in the composer instead of failing forever at
/// `firestore.rules:123`.
class _TooLongHint extends StatelessWidget {
  const _TooLongHint({required this.length});

  final int length;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.space2),
      child: Row(
        children: [
          Icon(
            LucideIcons.alertCircle,
            size: AppIconSize.inline,
            color: scheme.error,
          ),
          const SizedBox(width: AppSpacing.space2),
          Expanded(
            child: Text(
              l10n.inboxComposerTooLong,
              style: text.bodySmall?.copyWith(color: scheme.error),
            ),
          ),
          const SizedBox(width: AppSpacing.space2),
          // A character counter, matching the web app's character cap.
          Text(
            '$length / $kInboxMessageMaxChars',
            style: text.bodySmall?.copyWith(color: scheme.error),
          ),
        ],
      ),
    );
  }
}

/// An optimistic, in-flight (or just-sent) message. Rendered as a [Message] with
/// its `id` == `clientMessageId`, so the live stream reconciles it by that id.
class _PendingSend {
  _PendingSend({
    required this.clientMessageId,
    required this.text,
    required this.senderId,
  });

  final String clientMessageId;
  final String text;
  final String senderId;
  MessageDeliveryStatus status = MessageDeliveryStatus.sending;

  Message toMessage() => Message(
    id: clientMessageId,
    type: MessageType.text,
    text: text,
    senderId: senderId,
    senderName: '',
    clientMessageId: clientMessageId,
    deliveryStatus: status,
  );
}
