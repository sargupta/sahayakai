import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/services/metrics_service.dart';
import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../../../core/providers/language_provider.dart';
import '../../../../components/tts_play_button.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';
import '../providers/vidya_provider.dart';
import '../widgets/vidya_action_card.dart';
import '../../domain/vidya_models.dart';

/// Full-screen VIDYA chat with glassmorphic message bubbles,
/// voice input/output, and action cards for flow navigation.
class VidyaChatScreen extends ConsumerStatefulWidget {
  const VidyaChatScreen({super.key});

  @override
  ConsumerState<VidyaChatScreen> createState() => _VidyaChatScreenState();
}

class _VidyaChatScreenState extends ConsumerState<VidyaChatScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  bool _restored = false;

  @override
  void initState() {
    super.initState();
    MetricsService.trackScreenView('vidya_chat');
    // Restore previous session on first open.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_restored) {
        _restored = true;
        ref.read(vidyaChatProvider.notifier).restoreSession();
      }
    });
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _send() {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    final language = ref.read(languageProvider);

    ref.read(vidyaChatProvider.notifier).sendMessage(
          text,
          language: language,
        );

    MetricsService.trackEvent('chat_message_sent', properties: {
      'screen': 'vidya_chat',
    });

    _messageController.clear();

    // Scroll to bottom after send.
    Future.delayed(const Duration(milliseconds: 300), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final chatState = ref.watch(vidyaChatProvider);

    return GlassScaffold(
      title: 'VIDYA',
      showBackButton: true,
      actions: [
        IconButton(
          icon: const Icon(Icons.delete_outline_rounded),
          tooltip: 'Clear Chat',
          onPressed: () => ref.read(vidyaChatProvider.notifier).clearHistory(),
        ),
      ],
      body: Column(
        children: [
          // Chat messages
          Expanded(
            child: chatState.turns.isEmpty
                ? _buildWelcome()
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(
                      horizontal: GlassSpacing.lg,
                      vertical: GlassSpacing.md,
                    ),
                    itemCount: chatState.turns.length +
                        (chatState.isLoading ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == chatState.turns.length) {
                        return _buildTypingIndicator();
                      }
                      return _buildTurn(chatState.turns[index]);
                    },
                  ),
          ),

          // Error
          if (chatState.error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.lg),
              child: Text(
                chatState.error!,
                style: TextStyle(color: GlassColors.error, fontSize: 13),
              ),
            ),

          // Input bar
          _buildInputBar(),
        ],
      ),
    );
  }

  Widget _buildWelcome() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(GlassSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.psychology_rounded,
                size: 64, color: GlassColors.primary),
            const SizedBox(height: GlassSpacing.lg),
            Text('Namaste! I\'m VIDYA',
                style: GlassTypography.headline2()),
            const SizedBox(height: GlassSpacing.sm),
            Text(
              'Your AI teaching assistant. Ask me to create lesson plans, quizzes, worksheets, or anything else!',
              style: GlassTypography.bodyMedium(
                  color: GlassColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTurn(VidyaTurn turn) {
    return Padding(
      padding: const EdgeInsets.only(bottom: GlassSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // User message
          Align(
            alignment: Alignment.centerRight,
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.75,
              ),
              padding: const EdgeInsets.all(GlassSpacing.md),
              decoration: BoxDecoration(
                color: GlassColors.primary.withOpacity(0.15),
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(16),
                  topRight: Radius.circular(16),
                  bottomLeft: Radius.circular(16),
                  bottomRight: Radius.circular(4),
                ),
              ),
              child: Text(turn.user, style: GlassTypography.bodyMedium()),
            ),
          ),
          const SizedBox(height: GlassSpacing.sm),

          // AI response
          Align(
            alignment: Alignment.centerLeft,
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.75,
              ),
              child: GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(turn.ai,
                              style: GlassTypography.bodyMedium()),
                        ),
                        TTSPlayButton(text: turn.ai, size: 32),
                      ],
                    ),
                    // Action card
                    if (turn.action != null) ...[
                      const SizedBox(height: GlassSpacing.md),
                      VidyaActionCard(action: turn.action!),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTypingIndicator() {
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(bottom: GlassSpacing.lg),
        child: GlassCard(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: GlassColors.primary,
                ),
              ),
              const SizedBox(width: GlassSpacing.md),
              Text('VIDYA is thinking...',
                  style: GlassTypography.bodySmall(
                      color: GlassColors.textSecondary)),
            ],
          ),
        ),
      ),
    );
  }

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
            // Text input
            Expanded(
              child: TextField(
                controller: _messageController,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(),
                decoration: InputDecoration(
                  hintText: 'Ask VIDYA anything...',
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
