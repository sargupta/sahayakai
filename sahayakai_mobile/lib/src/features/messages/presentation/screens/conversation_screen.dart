import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/messages_repository.dart';
import '../../domain/message_models.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';

/// Full conversation thread screen showing messages between participants.
///
/// Displays chronological message bubbles with optimistic send, voice input,
/// and tappable resource cards. Follows the glassmorphic design system.
class ConversationScreen extends ConsumerStatefulWidget {
  final String conversationId;
  final String participantName;

  const ConversationScreen({
    super.key,
    required this.conversationId,
    required this.participantName,
  });

  @override
  ConsumerState<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends ConsumerState<ConversationScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  final _timeFormat = DateFormat('HH:mm');

  List<DirectMessage> _messages = [];
  bool _isLoading = true;
  String? _error;

  String get _currentUserId =>
      FirebaseAuth.instance.currentUser?.uid ?? '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadMessages();
      _markAsRead();
    });
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  Future<void> _loadMessages() async {
    try {
      final repo = ref.read(messagesRepositoryProvider);
      final messages = await repo.getMessages(widget.conversationId);
      if (!mounted) return;
      setState(() {
        _messages = messages;
        _isLoading = false;
      });
      _scrollToBottom(animate: false);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load messages. Pull down to retry.';
        _isLoading = false;
      });
    }
  }

  Future<void> _markAsRead() async {
    try {
      final repo = ref.read(messagesRepositoryProvider);
      await repo.markAsRead(widget.conversationId);
    } catch (_) {
      // Silent — non-critical.
    }
  }

  // ---------------------------------------------------------------------------
  // Send
  // ---------------------------------------------------------------------------

  Future<void> _send() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    _messageController.clear();

    final currentUser = FirebaseAuth.instance.currentUser;
    if (currentUser == null) return;

    // Optimistic local message.
    final optimistic = DirectMessage(
      id: 'temp_${DateTime.now().millisecondsSinceEpoch}',
      conversationId: widget.conversationId,
      authorId: currentUser.uid,
      authorName: currentUser.displayName ?? 'Me',
      authorPhotoURL: currentUser.photoURL,
      text: text,
      type: MessageType.text,
      createdAt: DateTime.now(),
      deliveryStatus: DeliveryStatus.sent,
    );

    setState(() => _messages = [..._messages, optimistic]);
    _scrollToBottom();

    try {
      final repo = ref.read(messagesRepositoryProvider);
      final persisted = await repo.sendMessage(
        widget.conversationId,
        text,
      );
      if (!mounted) return;
      setState(() {
        _messages = _messages
            .map((m) => m.id == optimistic.id ? persisted : m)
            .toList();
      });
    } catch (e) {
      if (!mounted) return;
      // Remove the optimistic message on failure.
      setState(() {
        _messages =
            _messages.where((m) => m.id != optimistic.id).toList();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to send message.')),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Scroll
  // ---------------------------------------------------------------------------

  void _scrollToBottom({bool animate = true}) {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (!_scrollController.hasClients) return;
      if (animate) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      } else {
        _scrollController
            .jumpTo(_scrollController.position.maxScrollExtent);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: widget.participantName,
      showBackButton: true,
      body: Column(
        children: [
          Expanded(child: _buildMessageList()),
          if (_error != null)
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: GlassSpacing.lg),
              child: Text(
                _error!,
                style: TextStyle(color: GlassColors.error, fontSize: 13),
              ),
            ),
          _buildInputBar(),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Message list
  // ---------------------------------------------------------------------------

  Widget _buildMessageList() {
    if (_isLoading) {
      return Center(
        child: CircularProgressIndicator(color: GlassColors.primary),
      );
    }

    if (_messages.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(GlassSpacing.xxl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.chat_bubble_outline_rounded,
                  size: 56, color: GlassColors.textTertiary),
              const SizedBox(height: GlassSpacing.lg),
              Text(
                'No messages yet',
                style: GlassTypography.headline3(
                    color: GlassColors.textSecondary),
              ),
              const SizedBox(height: GlassSpacing.sm),
              Text(
                'Say hello to ${widget.participantName}!',
                style: GlassTypography.bodyMedium(
                    color: GlassColors.textTertiary),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(
        horizontal: GlassSpacing.lg,
        vertical: GlassSpacing.md,
      ),
      itemCount: _messages.length,
      itemBuilder: (context, index) {
        final message = _messages[index];
        final isOutgoing = message.authorId == _currentUserId;
        return _buildMessageBubble(message, isOutgoing: isOutgoing);
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Message bubble
  // ---------------------------------------------------------------------------

  Widget _buildMessageBubble(
    DirectMessage message, {
    required bool isOutgoing,
  }) {
    final maxWidth = MediaQuery.of(context).size.width * 0.75;

    return Padding(
      padding: const EdgeInsets.only(bottom: GlassSpacing.sm),
      child: Row(
        mainAxisAlignment:
            isOutgoing ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // Incoming avatar
          if (!isOutgoing) ...[
            _buildAvatar(message),
            const SizedBox(width: GlassSpacing.sm),
          ],

          // Bubble
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxWidth),
            child: isOutgoing
                ? _buildOutgoingBubble(message)
                : _buildIncomingBubble(message),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatar(DirectMessage message) {
    return CircleAvatar(
      radius: 14,
      backgroundColor: GlassColors.primary.withOpacity(0.15),
      backgroundImage: message.authorPhotoURL != null
          ? NetworkImage(message.authorPhotoURL!)
          : null,
      child: message.authorPhotoURL == null
          ? Text(
              message.authorName.isNotEmpty
                  ? message.authorName[0].toUpperCase()
                  : '?',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: GlassColors.primary,
              ),
            )
          : null,
    );
  }

  Widget _buildOutgoingBubble(DirectMessage message) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: GlassSpacing.md,
        vertical: GlassSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: GlassColors.primary,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(16),
          topRight: Radius.circular(16),
          bottomLeft: Radius.circular(16),
          bottomRight: Radius.circular(4),
        ),
        boxShadow: [
          BoxShadow(
            color: GlassColors.primary.withOpacity(0.2),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (message.type == MessageType.resource && message.resource != null)
            _buildResourceCard(message.resource!, isOutgoing: true),
          if (message.text.isNotEmpty)
            Text(
              message.text,
              style: GlassTypography.bodyMedium(color: Colors.white),
            ),
          const SizedBox(height: 2),
          Text(
            _timeFormat.format(message.createdAt),
            style: const TextStyle(
              fontSize: 10,
              color: Colors.white70,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIncomingBubble(DirectMessage message) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (message.type == MessageType.resource && message.resource != null)
            _buildResourceCard(message.resource!, isOutgoing: false),
          if (message.text.isNotEmpty)
            Text(
              message.text,
              style: GlassTypography.bodyMedium(),
            ),
          const SizedBox(height: 2),
          Align(
            alignment: Alignment.bottomRight,
            child: Text(
              _timeFormat.format(message.createdAt),
              style: TextStyle(
                fontSize: 10,
                color: GlassColors.textTertiary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Resource card
  // ---------------------------------------------------------------------------

  Widget _buildResourceCard(
    SharedResource resource, {
    required bool isOutgoing,
  }) {
    final iconData = _resourceIcon(resource.type);
    final fgColor = isOutgoing ? Colors.white : GlassColors.textPrimary;
    final bgColor = isOutgoing
        ? Colors.white.withOpacity(0.15)
        : GlassColors.primary.withOpacity(0.08);

    return GestureDetector(
      onTap: () => _onResourceTapped(resource),
      child: Container(
        margin: const EdgeInsets.only(bottom: GlassSpacing.sm),
        padding: const EdgeInsets.all(GlassSpacing.sm),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(GlassRadius.sm),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(iconData, size: 20, color: fgColor),
            const SizedBox(width: GlassSpacing.sm),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    resource.title,
                    style: GlassTypography.labelLarge(color: fgColor),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (resource.subject != null || resource.classLevel != null)
                    Text(
                      [resource.subject, resource.classLevel]
                          .whereType<String>()
                          .join(' · '),
                      style: TextStyle(
                        fontSize: 11,
                        color: fgColor.withOpacity(0.7),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
            const SizedBox(width: GlassSpacing.xs),
            Icon(Icons.open_in_new_rounded, size: 14, color: fgColor),
          ],
        ),
      ),
    );
  }

  IconData _resourceIcon(String type) {
    return switch (type) {
      'lessonPlan' => Icons.menu_book_rounded,
      'quiz' => Icons.quiz_rounded,
      'worksheet' => Icons.assignment_rounded,
      'presentation' => Icons.slideshow_rounded,
      'examPaper' => Icons.description_rounded,
      _ => Icons.insert_drive_file_rounded,
    };
  }

  void _onResourceTapped(SharedResource resource) {
    // TODO: Navigate to the resource detail screen based on resource.type.
    debugPrint('[ConversationScreen] Resource tapped: ${resource.id}');
  }

  // ---------------------------------------------------------------------------
  // Input bar
  // ---------------------------------------------------------------------------

  Widget _buildInputBar() {
    return Container(
      padding: const EdgeInsets.all(GlassSpacing.md),
      decoration: BoxDecoration(
        color: GlassColors.surface.withOpacity(0.8),
        border: Border(
          top: BorderSide(color: GlassColors.border.withOpacity(0.5)),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            // Voice input
            VoiceInputWidget(
              onResult: (text) {
                _messageController.text = text;
                _send();
              },
            ),
            const SizedBox(width: GlassSpacing.sm),

            // Text field
            Expanded(
              child: TextField(
                controller: _messageController,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(),
                maxLines: 4,
                minLines: 1,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: 'Type a message...',
                  hintStyle: TextStyle(color: GlassColors.textTertiary),
                  filled: true,
                  fillColor: GlassColors.inputBackground,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                ),
              ),
            ),
            const SizedBox(width: GlassSpacing.sm),

            // Send button
            GestureDetector(
              onTap: _send,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: GlassColors.primary,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: GlassColors.primary.withOpacity(0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: const Icon(Icons.send_rounded,
                    color: Colors.white, size: 20),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
