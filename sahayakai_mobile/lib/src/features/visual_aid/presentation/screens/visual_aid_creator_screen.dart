import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../../tools/data/tool_repository.dart';
import '../../../../core/providers/language_provider.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';

class VisualAidCreatorScreen extends ConsumerStatefulWidget {
  const VisualAidCreatorScreen({super.key});

  @override
  ConsumerState<VisualAidCreatorScreen> createState() =>
      _VisualAidCreatorScreenState();
}

class _VisualAidCreatorScreenState extends ConsumerState<VisualAidCreatorScreen> {
  final _promptController = TextEditingController();
  bool _isGenerating = false;
  String? _generatedDescription;

  String _selectedStyle = 'Realistic';
  final List<String> _styles = [
    'Realistic',
    'Illustration',
    'Diagram',
    'Sketch',
    '3D Render',
    'Pixel Art'
  ];

  String _selectedBoard = 'CBSE';
  String _selectedGrade = 'Class 8';
  final List<String> _boards = ['CBSE', 'ICSE', 'State Board', 'Cambridge'];
  final List<String> _grades = [
    'Class 5', 'Class 6', 'Class 7', 'Class 8',
    'Class 9', 'Class 10', 'Class 11', 'Class 12'
  ];

  Future<void> _generateVisualAid() async {
    if (_promptController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please describe your visual aid'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _isGenerating = true);

    try {
      final language = ref.read(languageProvider);
      final toolRepo = ref.read(toolRepositoryProvider);

      final fullPrompt =
          "Create a detailed image description/prompt for a $_selectedStyle image about: ${_promptController.text}";

      final result = await toolRepo.generateToolContent(
        toolName: "Visual Aid Designer",
        prompt: fullPrompt,
        language: language,
      );

      setState(() {
        _isGenerating = false;
        _generatedDescription = result;
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
      title: 'Visual Artist',
      showBackButton: true,
      actions: [GlassMenuButton(onPressed: () {})],
      floatingActionButton: _generatedDescription == null
          ? GlassFloatingButton(
              label: 'Generate Design',
              icon: Icons.palette_rounded,
              onPressed: _isGenerating ? null : _generateVisualAid,
              isLoading: _isGenerating,
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      body: _generatedDescription != null ? _buildResultView() : _buildInputForm(),
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
            'Creating Visual Magic...',
            style: GlassTypography.decorativeLabel(),
          ),
          const SizedBox(height: GlassSpacing.xs),
          Text(
            'The Art Studio',
            style: GlassTypography.headline1(),
          ),
          const SizedBox(height: GlassSpacing.sm),
          Container(
            width: 60,
            height: 2,
            color: GlassColors.textTertiary.withOpacity(0.3),
          ),
          const SizedBox(height: GlassSpacing.xxl),

          // Visual Description Card
          GlassIconCard(
            icon: Icons.image_rounded,
            iconColor: GlassColors.primary,
            title: 'Visual Description',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GlassTextField(
                  controller: _promptController,
                  labelText: 'Describe Your Visual',
                  hintText: 'e.g. A diagram of the human heart labeling the chambers...',
                  maxLines: 3,
                  suffixIcon: VoiceInputWidget(
                    onResult: (val) =>
                        setState(() => _promptController.text = val),
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

          // Style Selection Card
          GlassIconCard(
            icon: Icons.style_rounded,
            iconColor: GlassColors.primary,
            title: 'Visual Style',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'CHOOSE A STYLE',
                  style: GlassTypography.sectionHeader(),
                ),
                const SizedBox(height: GlassSpacing.md),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    crossAxisSpacing: GlassSpacing.sm,
                    mainAxisSpacing: GlassSpacing.sm,
                    childAspectRatio: 1.2,
                  ),
                  itemCount: _styles.length,
                  itemBuilder: (context, index) {
                    final style = _styles[index];
                    final isSelected = _selectedStyle == style;
                    return GestureDetector(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        setState(() => _selectedStyle = style);
                      },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? GlassColors.primary
                              : GlassColors.chipUnselected,
                          borderRadius: BorderRadius.circular(GlassRadius.md),
                          border: Border.all(
                            color: isSelected
                                ? GlassColors.primary
                                : GlassColors.chipBorder,
                          ),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              _getStyleIcon(style),
                              color: isSelected
                                  ? Colors.white
                                  : GlassColors.textSecondary,
                              size: 24,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              style,
                              style: GlassTypography.labelSmall(
                                color: isSelected
                                    ? Colors.white
                                    : GlassColors.textPrimary,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: GlassSpacing.xl),

          // Preview Card
          GlassPreviewCard(
            label: 'The Art Studio Theme',
          ),
        ],
      ),
    );
  }

  IconData _getStyleIcon(String style) {
    switch (style) {
      case 'Realistic':
        return Icons.photo_camera_rounded;
      case 'Illustration':
        return Icons.brush_rounded;
      case 'Diagram':
        return Icons.schema_rounded;
      case 'Sketch':
        return Icons.edit_rounded;
      case '3D Render':
        return Icons.view_in_ar_rounded;
      case 'Pixel Art':
        return Icons.grid_4x4_rounded;
      default:
        return Icons.image_rounded;
    }
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
                onPressed: () => setState(() => _generatedDescription = null),
              ),
              const Spacer(),
              GlassIconButton(
                icon: Icons.copy_rounded,
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: _generatedDescription!));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Copied to clipboard')),
                  );
                },
              ),
              const SizedBox(width: GlassSpacing.sm),
              GlassIconButton(
                icon: Icons.share_rounded,
                onPressed: () {},
              ),
            ],
          ),
        ),
        const SizedBox(height: GlassSpacing.lg),

        // Image Placeholder
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: GlassCard(
              padding: EdgeInsets.zero,
              child: Container(
                decoration: BoxDecoration(
                  color: GlassColors.inputBackground,
                  borderRadius: BorderRadius.circular(GlassRadius.lg),
                ),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.image_rounded,
                        size: 48,
                        color: GlassColors.textTertiary,
                      ),
                      const SizedBox(height: GlassSpacing.sm),
                      Text(
                        'AI Image Preview',
                        style: GlassTypography.bodySmall(),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: GlassSpacing.xl),

        // Generated Content
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Image Specification',
                  style: GlassTypography.headline2(),
                ),
                const SizedBox(height: GlassSpacing.md),
                GlassCard(
                  padding: const EdgeInsets.all(GlassSpacing.xl),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'DETAILED PROMPT',
                        style: GlassTypography.sectionHeader(),
                      ),
                      const SizedBox(height: GlassSpacing.md),
                      MarkdownBody(
                        data: _generatedDescription!,
                        styleSheet: MarkdownStyleSheet(
                          p: GlassTypography.bodyMedium(),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: GlassSpacing.lg),

        // Action Button
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GlassSpacing.xl,
            vertical: GlassSpacing.lg,
          ),
          child: GlassSecondaryButton(
            label: 'Create Another',
            icon: Icons.refresh_rounded,
            onPressed: () => setState(() => _generatedDescription = null),
          ),
        ),
      ],
    );
  }
}
