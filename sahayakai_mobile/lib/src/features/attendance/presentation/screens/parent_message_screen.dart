import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../../../core/providers/language_provider.dart';
import '../../data/parent_message_repository.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';

class ParentMessageScreen extends ConsumerStatefulWidget {
  const ParentMessageScreen({super.key});

  @override
  ConsumerState<ParentMessageScreen> createState() => _ParentMessageScreenState();
}

class _ParentMessageScreenState extends ConsumerState<ParentMessageScreen> {
  final _studentController = TextEditingController();
  final _contextController = TextEditingController();
  bool _isGenerating = false;
  ParentMessageOutput? _result;

  Future<void> _generate() async {
    if (_contextController.text.trim().isEmpty) return;
    setState(() => _isGenerating = true);

    try {
      final language = ref.read(languageProvider);
      final repo = ref.read(parentMessageRepositoryProvider);
      final result = await repo.generate(
        context: _contextController.text.trim(),
        studentName: _studentController.text.trim().isEmpty
            ? null
            : _studentController.text.trim(),
        language: language,
      );
      setState(() { _isGenerating = false; _result = result; });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
        setState(() => _isGenerating = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'Parent Message',
      showBackButton: true,
      body: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.all(GlassSpacing.xl),
        child: _result != null ? _buildResult() : _buildForm(),
      ),
    );
  }

  Widget _buildForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GlassTextField(
          controller: _studentController,
          labelText: 'STUDENT NAME (OPTIONAL)',
          hintText: 'e.g. Rahul Sharma',
        ),
        const SizedBox(height: GlassSpacing.lg),
        GlassTextField(
          controller: _contextController,
          labelText: 'CONTEXT',
          hintText: 'e.g. absent for 3 days, great improvement in Maths',
          maxLines: 3,
          suffixIcon: VoiceInputWidget(
            onResult: (val) => setState(() => _contextController.text = val),
          ),
        ),
        const SizedBox(height: GlassSpacing.xxl),
        GlassPrimaryButton(
          label: 'Generate Message',
          icon: Icons.auto_awesome,
          isLoading: _isGenerating,
          onPressed: _isGenerating ? null : _generate,
        ),
      ],
    );
  }

  Widget _buildResult() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Generated Message', style: GlassTypography.headline3()),
              const SizedBox(height: GlassSpacing.md),
              SelectableText(
                _result!.message,
                style: GlassTypography.bodyLarge().copyWith(height: 1.6),
              ),
            ],
          ),
        ),
        const SizedBox(height: GlassSpacing.lg),
        Row(
          children: [
            Expanded(
              child: GlassPrimaryButton(
                label: 'Share via WhatsApp',
                icon: Icons.share_rounded,
                onPressed: () => Share.share(_result!.message),
              ),
            ),
            const SizedBox(width: GlassSpacing.md),
            GlassIconButton(
              icon: Icons.copy_rounded,
              onPressed: () {
                Clipboard.setData(ClipboardData(text: _result!.message));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Copied to clipboard')),
                );
              },
            ),
          ],
        ),
        const SizedBox(height: GlassSpacing.lg),
        GlassSecondaryButton(
          label: 'Generate Another',
          icon: Icons.refresh_rounded,
          onPressed: () => setState(() => _result = null),
        ),
      ],
    );
  }
}
