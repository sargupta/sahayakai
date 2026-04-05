import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';
import '../../data/community_repository.dart';
import '../../domain/community_models.dart';

// ---------------------------------------------------------------------------
// Provider — manages staff-room chat state
// ---------------------------------------------------------------------------

final _staffRoomProvider =
    StateNotifierProvider.autoDispose<_StaffRoomNotifier, _StaffRoomState>(
        (ref) {
  final repo = ref.watch(communityRepositoryProvider);
  return _StaffRoomNotifier(repo);
});

@immutable
class _StaffRoomState {
  final List<ChatMessage> messages;
  final bool isLoading;
  final bool isLoadingOlder;
  final bool hasMoreOlder;
  final String? error;

  const _StaffRoomState({
    this.messages = const [],
    this.isLoading = false,
    this.isLoadingOlder = false,
    this.hasMoreOlder = true,
    this.error,
  });

  _StaffRoomState copyWith({
    List<ChatMessage>? messages,
    bool? isLoading,
    bool? isLoadingOlder,
    bool? hasMoreOlder,
    String? error,
  }) {
    return _StaffRoomState(
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      isLoadingOlder: isLoadingOlder ?? this.isLoadingOlder,
      hasMoreOlder: hasMoreOlder ?? this.hasMoreOlder,
      error: error,
    );
  }
}

class _StaffRoomNotifier extends StateNotifier<_StaffRoomState> {
  final CommunityRepository _repo;
  static const _groupId = 'staff-room';

  _StaffRoomNotifier(this._repo) : super(const _StaffRoomState()) {
    _loadInitial();
  }

  Future<void> _loadInitial() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final messages = await _repo.getGroupChat(_groupId);
      state = state.copyWith(
        messages: messages,
        isLoading: false,
        hasMoreOlder: messages.length >= 50,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to load messages. Pull down to retry.',
      );
    }
  }

  Future<void> loadOlderMessages() async {
    if (state.isLoadingOlder || !state.hasMoreOlder) return;
    state = state.copyWith(isLoadingOlder: true);
    try {
      final oldest =
          state.messages.isNotEmpty ? state.messages.first.id : null;
      final older =
          await _repo.getGroupChat(_groupId, before: oldest);
      state = state.copyWith(
        messages: [...older, ...state.messages],
        isLoadingOlder: false,
        hasMoreOlder: older.isNotEmpty,
      );
    } catch (_) {
      state = state.copyWith(isLoadingOlder: false);
    }
  }

  Future<void> sendMessage(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;

    // Optimistic add
    final sent = await _repo.sendGroupChat(_groupId, trimmed);
    state = state.copyWith(messages: [...state.messages, sent]);
  }

  Future<void> refresh() => _loadInitial();
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/// Full-screen group chat for the Staff Room.
class StaffRoomScreen extends ConsumerStatefulWidget {
  const StaffRoomScreen({super.key});

  @override
  ConsumerState<StaffRoomScreen> createState() => _StaffRoomScreenState();
}

class _StaffRoomScreenState extends ConsumerState<StaffRoomScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  final _timeFormat = DateFormat('HH:mm');

  int _prevMessageCount = 0;

  String get _currentUserId =>
      FirebaseAuth.instance.currentUser?.uid ?? 'me';

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  // Pull-to-top to load older messages
  void _onScroll() {
    if (_scrollController.position.pixels <= 0) {
      ref.read(_staffRoomProvider.notifier).loadOlderMessages();
    }
  }

  void _scrollToBottom({bool animated = true}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      final target = _scrollController.position.maxScrollExtent;
      if (animated) {
        _scrollController.animateTo(
          target,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      } else {
        _scrollController.jumpTo(target);
      }
    });
  }

  void _send() {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;
    ref.read(_staffRoomProvider.notifier).sendMessage(text);
    _messageController.clear();
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final chatState = ref.watch(_staffRoomProvider);

    // Auto-scroll when new messages arrive
    if (chatState.messages.length > _prevMessageCount) {
      _prevMessageCount = chatState.messages.length;
      _scrollToBottom();
    }

    return GlassScaffold(
      title: 'Staff Room',
      showBackButton: true,
      body: Column(
        children: [
          // Messages
          Expanded(
            child: chatState.isLoading
                ? _buildLoading()
                : chatState.error != null && chatState.messages.isEmpty
                    ? _buildError(chatState.error!)
                    : _buildMessageList(chatState),
          ),

          // Input bar
          _buildInputBar(),
        ],
      ),
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────

  Widget _buildLoading() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(color: GlassColors.primary),
          const SizedBox(height: GlassSpacing.lg),
          Text(
            'Loading messages...',
            style:
                GlassTypography.bodyMedium(color: GlassColors.textSecondary),
          ),
        ],
      ),
    );
  }

  // ── Error ────────────────────────────────────────────────────────────

  Widget _buildError(String error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(GlassSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.wifi_off_rounded, size: 48, color: GlassColors.error),
            const SizedBox(height: GlassSpacing.lg),
            Text(error,
                style: GlassTypography.bodyMedium(
                    color: GlassColors.textSecondary),
                textAlign: TextAlign.center),
            const SizedBox(height: GlassSpacing.lg),
            TextButton.icon(
              onPressed: () =>
                  ref.read(_staffRoomProvider.notifier).refresh(),
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  // ── Message list ─────────────────────────────────────────────────────

  Widget _buildMessageList(_StaffRoomState chatState) {
    final messages = chatState.messages;

    return RefreshIndicator(
      onRefresh: () =>
          ref.read(_staffRoomProvider.notifier).loadOlderMessages(),
      color: GlassColors.primary,
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.symmetric(
          horizontal: GlassSpacing.lg,
          vertical: GlassSpacing.md,
        ),
        itemCount: messages.length + (chatState.isLoadingOlder ? 1 : 0),
        itemBuilder: (context, index) {
          // Loading-older spinner at the top
          if (chatState.isLoadingOlder && index == 0) {
            return Padding(
              padding:
                  const EdgeInsets.symmetric(vertical: GlassSpacing.md),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: GlassColors.primary,
                  ),
                ),
              ),
            );
          }

          final msgIndex =
              chatState.isLoadingOlder ? index - 1 : index;
          final message = messages[msgIndex];
          final isMe = message.senderId == _currentUserId ||
              message.senderId == 'me';

          return _buildBubble(message, isMe: isMe);
        },
      ),
    );
  }

  // ── Message bubble ───────────────────────────────────────────────────

  Widget _buildBubble(ChatMessage message, {required bool isMe}) {
    final maxWidth = MediaQuery.of(context).size.width * 0.75;
    final timeString = _timeFormat.format(message.timestamp);

    if (isMe) {
      return _buildOutgoingBubble(message, maxWidth, timeString);
    }
    return _buildIncomingBubble(message, maxWidth, timeString);
  }

  Widget _buildOutgoingBubble(
      ChatMessage message, double maxWidth, String time) {
    return Padding(
      padding: const EdgeInsets.only(bottom: GlassSpacing.md),
      child: Align(
        alignment: Alignment.centerRight,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: GlassSpacing.lg,
              vertical: GlassSpacing.md,
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
                  color: GlassColors.primary.withOpacity(0.25),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  message.text,
                  style: GlassTypography.bodyMedium(color: Colors.white),
                ),
                const SizedBox(height: GlassSpacing.xs),
                Text(
                  time,
                  style: GlassTypography.labelSmall(
                      color: Colors.white.withOpacity(0.7)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildIncomingBubble(
      ChatMessage message, double maxWidth, String time) {
    // Derive initials for avatar fallback
    final initials = message.senderName
        .split(' ')
        .where((w) => w.isNotEmpty)
        .take(2)
        .map((w) => w[0].toUpperCase())
        .join();

    return Padding(
      padding: const EdgeInsets.only(bottom: GlassSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar
          CircleAvatar(
            radius: 16,
            backgroundColor: GlassColors.primary.withOpacity(0.15),
            backgroundImage: message.senderAvatarUrl.isNotEmpty
                ? NetworkImage(message.senderAvatarUrl)
                : null,
            child: message.senderAvatarUrl.isEmpty
                ? Text(initials,
                    style: GlassTypography.labelSmall(
                        color: GlassColors.primary))
                : null,
          ),
          const SizedBox(width: GlassSpacing.sm),

          // Bubble
          Flexible(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxWidth),
              child: GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Sender name
                    Text(
                      message.senderName,
                      style: GlassTypography.labelMedium(
                          color: GlassColors.primary),
                    ),
                    const SizedBox(height: GlassSpacing.xs),

                    // Message text
                    Text(
                      message.text,
                      style: GlassTypography.bodyMedium(),
                    ),
                    const SizedBox(height: GlassSpacing.xs),

                    // Timestamp
                    Align(
                      alignment: Alignment.bottomRight,
                      child: Text(
                        time,
                        style: GlassTypography.labelSmall(
                            color: GlassColors.textTertiary),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Input bar ────────────────────────────────────────────────────────

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
                textCapitalization: TextCapitalization.sentences,
                maxLines: 4,
                minLines: 1,
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
