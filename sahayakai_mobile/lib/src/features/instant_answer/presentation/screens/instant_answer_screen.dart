import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';
import '../providers/instant_answer_provider.dart';
import '../../domain/instant_answer_models.dart';

class InstantAnswerScreen extends ConsumerStatefulWidget {
  const InstantAnswerScreen({super.key});

  @override
  ConsumerState<InstantAnswerScreen> createState() =>
      _InstantAnswerScreenState();
}

class _InstantAnswerScreenState extends ConsumerState<InstantAnswerScreen> {
  final _questionController = TextEditingController();
  String _selectedGrade = 'Class 6';
  String _selectedLanguage = 'English';

  final List<String> _grades = [
    'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
    'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
  ];
  final List<String> _languages = [
    'English', 'Hindi', 'Tamil', 'Telugu', 'Kannada',
    'Malayalam', 'Marathi', 'Bengali',
  ];

  @override
  void dispose() {
    _questionController.dispose();
    super.dispose();
  }

  Future<void> _getAnswer() async {
    final question = _questionController.text.trim();
    if (question.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a question'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    await ref.read(instantAnswerControllerProvider).getAnswer(
          InstantAnswerInput(
            question: question,
            language: _selectedLanguage,
            gradeLevel: _selectedGrade,
          ),
        );

    final error = ref.read(instantAnswerErrorProvider);
    if (error != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error), backgroundColor: Colors.red),
      );
    }
  }

  void _reset() {
    ref.read(instantAnswerControllerProvider).reset();
  }

  void _copyAnswer(String answer) {
    Clipboard.setData(ClipboardData(text: answer));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Copied to clipboard')),
    );
  }

  Future<void> _openVideoUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(instantAnswerLoadingProvider);
    final result = ref.watch(instantAnswerResultProvider);

    return GlassScaffold(
      title: 'Instant Answer',
      showBackButton: true,
      actions: [GlassMenuButton(onPressed: () {})],
      floatingActionButton: result == null
          ? GlassFloatingButton(
              label: 'Get Answer',
              icon: Icons.auto_awesome,
              onPressed: isLoading ? null : _getAnswer,
              isLoading: isLoading,
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(
          left: GlassSpacing.xl,
          right: GlassSpacing.xl,
          top: GlassSpacing.sm,
          bottom: 120,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Decorative Header
            Text(
              'Quick Knowledge...',
              style: GlassTypography.decorativeLabel(),
            ),
            const SizedBox(height: GlassSpacing.xs),
            Text(
              'Ask Anything',
              style: GlassTypography.headline1(),
            ),
            const SizedBox(height: GlassSpacing.sm),
            Container(
              width: 60,
              height: 2,
              color: GlassColors.textTertiary.withValues(alpha: 0.3),
            ),
            const SizedBox(height: GlassSpacing.xxl),

            // Question Card
            GlassIconCard(
              icon: Icons.help_outline_rounded,
              iconColor: GlassColors.primary,
              title: 'Your Question',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  GlassTextField(
                    controller: _questionController,
                    labelText: 'Ask Your Question',
                    hintText: 'e.g. Explain photosynthesis in simple terms...',
                    maxLines: 3,
                    suffixIcon: VoiceInputWidget(
                      onResult: (val) =>
                          setState(() => _questionController.text = val),
                    ),
                  ),
                  const SizedBox(height: GlassSpacing.xl),

                  // Grade and Language Row
                  Row(
                    children: [
                      Expanded(
                        child: GlassDropdown<String>(
                          labelText: 'Grade Level',
                          value: _selectedGrade,
                          items: _grades
                              .map((grade) => DropdownMenuItem(
                                    value: grade,
                                    child: Text(grade),
                                  ))
                              .toList(),
                          onChanged: (value) {
                            if (value != null) {
                              setState(() => _selectedGrade = value);
                            }
                          },
                        ),
                      ),
                      const SizedBox(width: GlassSpacing.lg),
                      Expanded(
                        child: GlassDropdown<String>(
                          labelText: 'Language',
                          value: _selectedLanguage,
                          items: _languages
                              .map((lang) => DropdownMenuItem(
                                    value: lang,
                                    child: Text(lang),
                                  ))
                              .toList(),
                          onChanged: (value) {
                            if (value != null) {
                              setState(() => _selectedLanguage = value);
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: GlassSpacing.xl),

            // Answer Section
            if (result != null) ...[
              GlassIconCard(
                icon: Icons.check_circle_rounded,
                iconColor: GlassColors.success,
                title: 'Answer',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    MarkdownBody(
                      data: result.answer,
                      styleSheet: MarkdownStyleSheet(
                        p: GlassTypography.bodyLarge(),
                        h1: GlassTypography.headline1(),
                        h2: GlassTypography.headline2(),
                        h3: GlassTypography.headline3(),
                      ),
                    ),

                    // Video suggestion
                    if (result.videoSuggestionUrl != null) ...[
                      const SizedBox(height: GlassSpacing.xl),
                      GestureDetector(
                        onTap: () => _openVideoUrl(result.videoSuggestionUrl!),
                        child: Container(
                          padding: const EdgeInsets.all(GlassSpacing.md),
                          decoration: BoxDecoration(
                            color: GlassColors.inputBackground,
                            borderRadius:
                                BorderRadius.circular(GlassRadius.sm),
                            border: Border.all(color: GlassColors.border),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.play_circle_outline_rounded,
                                color: Colors.red,
                                size: 28,
                              ),
                              const SizedBox(width: GlassSpacing.md),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Watch Related Video',
                                      style: GlassTypography.labelLarge(),
                                    ),
                                    Text(
                                      'Tap to open on YouTube',
                                      style: GlassTypography.bodySmall(
                                        color: GlassColors.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(
                                Icons.open_in_new_rounded,
                                size: 16,
                                color: GlassColors.textTertiary,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],

                    const SizedBox(height: GlassSpacing.xl),
                    Row(
                      children: [
                        Expanded(
                          child: GlassSecondaryButton(
                            label: 'Ask Another',
                            icon: Icons.refresh_rounded,
                            onPressed: _reset,
                          ),
                        ),
                        const SizedBox(width: GlassSpacing.lg),
                        Expanded(
                          child: GlassPrimaryButton(
                            label: 'Copy',
                            icon: Icons.copy_rounded,
                            onPressed: () => _copyAnswer(result.answer),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],

            // Preview Card (only show when no answer)
            if (result == null && !isLoading) ...[
              const GlassPreviewCard(
                label: 'Quick Answer Theme',
              ),
            ],
          ],
        ),
      ),
    );
  }
}
