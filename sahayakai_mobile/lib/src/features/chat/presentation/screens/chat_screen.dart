import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../providers/chat_provider.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent + 60,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final messages = ref.watch(chatMessagesProvider);
    
    ref.listen(chatMessagesProvider, (prev, next) {
      Future.delayed(const Duration(milliseconds: 100), _scrollToBottom);
    });

    return GlassScaffold(
      title: 'Sahayak Assistant',
      showBackButton: true,
      actions: [GlassMenuButton(onPressed: () {})],
      body: Column(
        children: [
          // Messages List
          Expanded(
            child: messages.isEmpty
                ? _buildEmptyState()
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(GlassSpacing.xl),
                    itemCount: messages.length,
                    itemBuilder: (context, index) {
                      final msg = messages[index];
                      return _buildMessageBubble(msg);
                    },
                  ),
          ),
          
          // Input Area
          _buildInputArea(),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(GlassSpacing.xxl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: GlassColors.primary.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.auto_awesome_rounded,
                size: 48,
                color: GlassColors.primary,
              ),
            ),
            const SizedBox(height: GlassSpacing.xl),
            Text(
              'Ask Sahayak Anything',
              style: GlassTypography.headline2(),
            ),
            const SizedBox(height: GlassSpacing.md),
            Text(
              'I can help you with lesson plans, explain concepts, suggest activities, and more!',
              textAlign: TextAlign.center,
              style: GlassTypography.bodyMedium(color: GlassColors.textSecondary),
            ),
            const SizedBox(height: GlassSpacing.xxl),
            
            // Suggestion Chips
            Wrap(
              spacing: GlassSpacing.sm,
              runSpacing: GlassSpacing.sm,
              alignment: WrapAlignment.center,
              children: [
                _buildSuggestionChip('Explain photosynthesis'),
                _buildSuggestionChip('Create a quiz on fractions'),
                _buildSuggestionChip('Classroom activity ideas'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSuggestionChip(String text) {
    return GestureDetector(
      onTap: () {
        _controller.text = text;
        _sendMessage();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: GlassSpacing.lg,
          vertical: GlassSpacing.md,
        ),
        decoration: BoxDecoration(
          color: GlassColors.cardBackground,
          borderRadius: BorderRadius.circular(GlassRadius.pill),
          border: Border.all(color: GlassColors.cardBorder),
        ),
        child: Text(
          text,
          style: GlassTypography.bodySmall(color: GlassColors.primary),
        ),
      ),
    );
  }

  Widget _buildMessageBubble(dynamic msg) {
    final isUser = msg.isUser;
    
    return Padding(
      padding: const EdgeInsets.only(bottom: GlassSpacing.lg),
      child: Row(
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isUser) ...[
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: GlassColors.primary.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.auto_awesome_rounded,
                size: 16,
                color: GlassColors.primary,
              ),
            ),
            const SizedBox(width: GlassSpacing.sm),
          ],
          Flexible(
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.75,
              ),
              padding: const EdgeInsets.all(GlassSpacing.lg),
              decoration: BoxDecoration(
                color: isUser ? GlassColors.primary : GlassColors.cardBackground,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(GlassRadius.lg),
                  topRight: const Radius.circular(GlassRadius.lg),
                  bottomLeft: isUser
                      ? const Radius.circular(GlassRadius.lg)
                      : const Radius.circular(GlassRadius.xs),
                  bottomRight: isUser
                      ? const Radius.circular(GlassRadius.xs)
                      : const Radius.circular(GlassRadius.lg),
                ),
                border: isUser ? null : Border.all(color: GlassColors.cardBorder),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (isUser)
                    Text(
                      msg.text,
                      style: GlassTypography.bodyMedium(color: Colors.white),
                    )
                  else
                    MarkdownBody(
                      data: msg.text,
                      styleSheet: MarkdownStyleSheet(
                        p: GlassTypography.bodyMedium(),
                        h1: GlassTypography.headline2(),
                        h2: GlassTypography.headline3(),
                        code: GlassTypography.bodySmall().copyWith(
                          fontFamily: 'monospace',
                          backgroundColor: GlassColors.inputBackground,
                        ),
                      ),
                    ),
                  if (!isUser && msg.videoUrl != null)
                    Padding(
                      padding: const EdgeInsets.only(top: GlassSpacing.sm),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.play_circle_outline_rounded,
                            size: 16,
                            color: GlassColors.primary,
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              'Video: ${msg.videoUrl}',
                              style: GlassTypography.bodySmall(
                                color: GlassColors.primary,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
          if (isUser) ...[
            const SizedBox(width: GlassSpacing.sm),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: GlassColors.primary.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.person_rounded,
                size: 16,
                color: GlassColors.primary,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.all(GlassSpacing.lg),
      decoration: const BoxDecoration(
        color: GlassColors.cardBackground,
        border: Border(
          top: BorderSide(color: GlassColors.cardBorder),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: GlassColors.inputBackground,
                  borderRadius: BorderRadius.circular(GlassRadius.pill),
                  border: Border.all(color: GlassColors.inputBorder),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        style: GlassTypography.bodyMedium(),
                        decoration: InputDecoration(
                          hintText: 'Ask anything...',
                          hintStyle: GlassTypography.bodyMedium(
                            color: GlassColors.textTertiary,
                          ),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: GlassSpacing.xl,
                            vertical: GlassSpacing.md,
                          ),
                        ),
                        onSubmitted: (_) => _sendMessage(),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(
                        Icons.mic_none_rounded,
                        color: GlassColors.textTertiary,
                      ),
                      onPressed: () {},
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: GlassSpacing.md),
            Container(
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
              child: IconButton(
                onPressed: _sendMessage,
                icon: const Icon(
                  Icons.send_rounded,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _sendMessage() {
    final text = _controller.text.trim();
    if (text.isNotEmpty) {
      ref.read(chatMessagesProvider.notifier).askQuestion(text);
      _controller.clear();
    }
  }
}
