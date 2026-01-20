import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../../chat/data/chat_repository.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';

class InstantAnswerScreen extends ConsumerStatefulWidget {
  const InstantAnswerScreen({super.key});

  @override
  ConsumerState<InstantAnswerScreen> createState() =>
      _InstantAnswerScreenState();
}

class _InstantAnswerScreenState extends ConsumerState<InstantAnswerScreen> {
  final _questionController = TextEditingController();
  String _selectedGrade = "Class 6";
  String _selectedLanguage = "English";
  bool _isLoading = false;
  String? _answer;

  final List<String> _grades = [
    "Class 1", "Class 2", "Class 3", "Class 4", "Class 5",
    "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"
  ];
  final List<String> _languages = [
    "English", "Hindi", "Tamil", "Telugu", "Kannada",
    "Malayalam", "Marathi", "Bengali"
  ];

  Future<void> _getAnswer() async {
    if (_questionController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a question'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _isLoading = true;
      _answer = null;
    });

    try {
      final response = await ref.read(chatRepositoryProvider).sendQuestion(
          _questionController.text,
          _selectedLanguage,
          _selectedGrade);

      if (mounted) {
        setState(() {
          _answer = response['answer'] ?? "No answer received.";
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _answer = "Error: Failed to get answer. Please try again.";
          _isLoading = false;
        });
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text("Error: $e")));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'Instant Answer',
      showBackButton: true,
      actions: [GlassMenuButton(onPressed: () {})],
      floatingActionButton: _answer == null
          ? GlassFloatingButton(
              label: 'Get Answer',
              icon: Icons.auto_awesome,
              onPressed: _isLoading ? null : _getAnswer,
              isLoading: _isLoading,
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
              color: GlassColors.textTertiary.withOpacity(0.3),
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
            if (_answer != null) ...[
              GlassIconCard(
                icon: Icons.check_circle_rounded,
                iconColor: GlassColors.success,
                title: 'Answer',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    MarkdownBody(
                      data: _answer!,
                      styleSheet: MarkdownStyleSheet(
                        p: GlassTypography.bodyLarge(),
                        h1: GlassTypography.headline1(),
                        h2: GlassTypography.headline2(),
                        h3: GlassTypography.headline3(),
                      ),
                    ),
                    const SizedBox(height: GlassSpacing.xl),
                    Row(
                      children: [
                        Expanded(
                          child: GlassSecondaryButton(
                            label: 'Ask Another',
                            icon: Icons.refresh_rounded,
                            onPressed: () => setState(() => _answer = null),
                          ),
                        ),
                        const SizedBox(width: GlassSpacing.lg),
                        Expanded(
                          child: GlassPrimaryButton(
                            label: 'Copy',
                            icon: Icons.copy_rounded,
                            onPressed: () {
                              // Copy to clipboard
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],

            // Preview Card (only show when no answer)
            if (_answer == null) ...[
              GlassPreviewCard(
                label: 'Quick Answer Theme',
              ),
            ],
          ],
        ),
      ),
    );
  }
}
