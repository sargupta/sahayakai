import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../../tools/data/tool_repository.dart';
import '../../../../core/providers/language_provider.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';

class VideoStorytellerScreen extends ConsumerStatefulWidget {
  const VideoStorytellerScreen({super.key});

  @override
  ConsumerState<VideoStorytellerScreen> createState() =>
      _VideoStorytellerScreenState();
}

class _VideoStorytellerScreenState extends ConsumerState<VideoStorytellerScreen> {
  final _scriptController = TextEditingController();
  bool _isGenerating = false;
  String? _generatedScript;

  String _selectedBoard = 'CBSE';
  String _selectedGrade = 'Class 8';
  final List<String> _boards = ['CBSE', 'ICSE', 'State Board', 'Cambridge'];
  final List<String> _grades = [
    'Class 5', 'Class 6', 'Class 7', 'Class 8',
    'Class 9', 'Class 10', 'Class 11', 'Class 12'
  ];

  String _selectedDuration = '3-5 mins';
  final List<String> _durations = ['1-2 mins', '3-5 mins', '5-10 mins', '10+ mins'];

  String _selectedTone = 'Educational';
  final List<String> _tones = ['Educational', 'Fun & Engaging', 'Storytelling', 'Documentary'];

  Future<void> _generateVideoScript() async {
    if (_scriptController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a video topic'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _isGenerating = true);

    try {
      final language = ref.read(languageProvider);
      final toolRepo = ref.read(toolRepositoryProvider);

      final result = await toolRepo.generateToolContent(
        toolName: "Video Script Writer",
        prompt: _scriptController.text,
        language: language,
      );

      setState(() {
        _isGenerating = false;
        _generatedScript = result;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red));
        setState(() => _isGenerating = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'Video Storyteller',
      showBackButton: true,
      actions: [GlassMenuButton(onPressed: () {})],
      floatingActionButton: _generatedScript == null
          ? GlassFloatingButton(
              label: 'Create Script',
              icon: Icons.movie_creation_rounded,
              onPressed: _isGenerating ? null : _generateVideoScript,
              isLoading: _isGenerating,
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      body: _generatedScript != null ? _buildResultView() : _buildInputForm(),
    );
  }

  Widget _buildInputForm() {
    return SingleChildScrollView(
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
            'Lights, Camera, Action!',
            style: GlassTypography.decorativeLabel(),
          ),
          const SizedBox(height: GlassSpacing.xs),
          Text(
            'Director\'s Studio',
            style: GlassTypography.headline1(),
          ),
          const SizedBox(height: GlassSpacing.sm),
          Container(
            width: 60,
            height: 2,
            color: GlassColors.textTertiary.withOpacity(0.3),
          ),
          const SizedBox(height: GlassSpacing.xxl),

          // Video Topic Card
          GlassIconCard(
            icon: Icons.videocam_rounded,
            iconColor: GlassColors.primary,
            title: 'Video Topic',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GlassTextField(
                  controller: _scriptController,
                  labelText: 'What\'s Your Video About?',
                  hintText: 'e.g. Explain Gravity using a falling apple...',
                  maxLines: 3,
                  suffixIcon: VoiceInputWidget(
                    onResult: (val) =>
                        setState(() => _scriptController.text = val),
                  ),
                ),
                const SizedBox(height: GlassSpacing.xl),

                // Board and Grade Row
                Row(
                  children: [
                    Expanded(
                      child: GlassDropdown<String>(
                        labelText: 'Board',
                        value: _selectedBoard,
                        items: _boards
                            .map((board) => DropdownMenuItem(
                                  value: board,
                                  child: Text(board),
                                ))
                            .toList(),
                        onChanged: (value) {
                          if (value != null) {
                            setState(() => _selectedBoard = value);
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: GlassSpacing.lg),
                    Expanded(
                      child: GlassDropdown<String>(
                        labelText: 'Grade',
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
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: GlassSpacing.xl),

          // Script Settings Card
          GlassIconCard(
            icon: Icons.tune_rounded,
            iconColor: GlassColors.primary,
            title: 'Script Settings',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Duration
                Text(
                  'VIDEO DURATION',
                  style: GlassTypography.sectionHeader(),
                ),
                const SizedBox(height: GlassSpacing.md),
                Wrap(
                  spacing: GlassSpacing.sm,
                  runSpacing: GlassSpacing.sm,
                  children: _durations.map((duration) {
                    final isSelected = _selectedDuration == duration;
                    return GlassChip(
                      label: duration,
                      isSelected: isSelected,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        setState(() => _selectedDuration = duration);
                      },
                    );
                  }).toList(),
                ),
                const SizedBox(height: GlassSpacing.xl),

                // Tone
                Text(
                  'VIDEO TONE',
                  style: GlassTypography.sectionHeader(),
                ),
                const SizedBox(height: GlassSpacing.md),
                Wrap(
                  spacing: GlassSpacing.sm,
                  runSpacing: GlassSpacing.sm,
                  children: _tones.map((tone) {
                    final isSelected = _selectedTone == tone;
                    return GlassChip(
                      label: tone,
                      isSelected: isSelected,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        setState(() => _selectedTone = tone);
                      },
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
          const SizedBox(height: GlassSpacing.xl),

          // Preview Card
          GlassPreviewCard(
            label: 'The Director\'s Theme',
          ),
        ],
      ),
    );
  }

  Widget _buildResultView() {
    return Column(
      children: [
        // Action Bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
          child: Row(
            children: [
              GlassIconButton(
                icon: Icons.arrow_back_rounded,
                onPressed: () => setState(() => _generatedScript = null),
              ),
              const Spacer(),
              GlassIconButton(
                icon: Icons.copy_rounded,
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: _generatedScript!));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Copied to clipboard')),
                  );
                },
              ),
              const SizedBox(width: GlassSpacing.sm),
              GlassIconButton(
                icon: Icons.picture_as_pdf_rounded,
                onPressed: () {},
              ),
            ],
          ),
        ),
        const SizedBox(height: GlassSpacing.lg),

        // Header
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Video Script',
                style: GlassTypography.headline1(),
              ),
              const SizedBox(height: GlassSpacing.xs),
              Text(
                'Topic: ${_scriptController.text}',
                style: GlassTypography.bodySmall(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        const SizedBox(height: GlassSpacing.lg),

        // Generated Content
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
            child: GlassCard(
              padding: const EdgeInsets.all(GlassSpacing.xl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Scene badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: GlassSpacing.md,
                      vertical: GlassSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: GlassColors.textPrimary,
                      borderRadius: BorderRadius.circular(GlassRadius.xs),
                    ),
                    child: Text(
                      'SCENE 1',
                      style: GlassTypography.labelSmall(color: Colors.white),
                    ),
                  ),
                  const SizedBox(height: GlassSpacing.lg),
                  MarkdownBody(
                    data: _generatedScript!,
                    styleSheet: MarkdownStyleSheet(
                      h1: GlassTypography.headline1(),
                      h2: GlassTypography.headline2(),
                      h3: GlassTypography.headline3(),
                      p: GlassTypography.bodyMedium(),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: GlassSpacing.lg),

        // Action Buttons
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GlassSpacing.xl,
            vertical: GlassSpacing.lg,
          ),
          child: Row(
            children: [
              Expanded(
                child: GlassSecondaryButton(
                  label: 'New Script',
                  icon: Icons.refresh_rounded,
                  onPressed: () => setState(() => _generatedScript = null),
                ),
              ),
              const SizedBox(width: GlassSpacing.lg),
              Expanded(
                child: GlassPrimaryButton(
                  label: 'Export PDF',
                  icon: Icons.download_rounded,
                  onPressed: () {},
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
