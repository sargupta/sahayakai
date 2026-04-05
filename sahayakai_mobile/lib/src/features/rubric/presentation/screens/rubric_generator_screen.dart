import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/rubric_repository.dart';
import '../../../../core/providers/language_provider.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';
import '../../../../components/tts_play_button.dart';
import '../../../../components/share_to_community_button.dart';

class RubricGeneratorScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic>? initialParams;

  const RubricGeneratorScreen({super.key, this.initialParams});

  @override
  ConsumerState<RubricGeneratorScreen> createState() =>
      _RubricGeneratorScreenState();
}

class _RubricGeneratorScreenState extends ConsumerState<RubricGeneratorScreen> {
  final _assignmentController = TextEditingController();
  bool _isGenerating = false;
  String? _generatedRubric;

  // Configuration
  String _gradeScale = '4-Point';
  final List<String> _scales = ['3-Point', '4-Point', '5-Point'];

  String _selectedBoard = 'CBSE';
  String _selectedGrade = 'Class 8';
  final List<String> _boards = ['CBSE', 'ICSE', 'State Board', 'Cambridge'];
  final List<String> _grades = [
    'Class 5', 'Class 6', 'Class 7', 'Class 8', 
    'Class 9', 'Class 10', 'Class 11', 'Class 12'
  ];

  final List<String> _criteriaOptions = [
    'Clarity',
    'Grammar',
    'Creativity',
    'Research',
    'Presentation',
    'Effort',
    'Content',
    'Organization'
  ];
  final Set<String> _selectedCriteria = {'Clarity', 'Content', 'Grammar'};

  @override
  void initState() {
    super.initState();
    // Pre-fill from VIDYA action cards or cross-feature navigation
    final params = widget.initialParams;
    if (params != null) {
      if (params['assignmentDescription'] != null) {
        _assignmentController.text = params['assignmentDescription'] as String;
      }
      if (params['gradeLevel'] != null) {
        final grade = params['gradeLevel'] as String;
        if (_grades.contains(grade)) _selectedGrade = grade;
      }
    }
  }

  Future<void> _generateRubric() async {
    if (_assignmentController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter an assignment description'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _isGenerating = true);

    try {
      final language = ref.read(languageProvider);
      final repo = ref.read(rubricRepositoryProvider);

      final result = await repo.generate(
        assignmentDescription:
            '${_assignmentController.text}. '
            'Use a $_gradeScale scale. '
            'Criteria: ${_selectedCriteria.join(', ')}.',
        gradeLevel: _selectedGrade,
        language: language,
      );

      // Format structured rubric as markdown for display.
      final md = StringBuffer('# ${result.title}\n\n${result.description}\n\n');
      for (final c in result.criteria) {
        md.writeln('## ${c.name}');
        md.writeln(c.description);
        md.writeln('');
        for (final l in c.levels) {
          md.writeln('- **${l.name}** (${l.points} pts): ${l.description}');
        }
        md.writeln('');
      }

      setState(() {
        _isGenerating = false;
        _generatedRubric = md.toString();
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
      title: 'Rubric Architect',
      showBackButton: true,
      actions: [GlassMenuButton(onPressed: () {})],
      floatingActionButton: _generatedRubric == null
          ? GlassFloatingButton(
              label: 'Build Rubric Table',
              icon: Icons.grid_on_rounded,
              onPressed: _isGenerating ? null : _generateRubric,
              isLoading: _isGenerating,
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      body: _generatedRubric != null ? _buildResultView() : _buildInputForm(),
    );
  }

  Widget _buildInputForm() {
    return SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
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
            'Crafting Evaluation Matrix...',
            style: GlassTypography.decorativeLabel(),
          ),
          const SizedBox(height: GlassSpacing.xs),
          Text(
            'The Grid Layout',
            style: GlassTypography.headline1(),
          ),
          const SizedBox(height: GlassSpacing.sm),
          Container(
            width: 60,
            height: 2,
            color: GlassColors.textTertiary.withOpacity(0.3),
          ),
          const SizedBox(height: GlassSpacing.xxl),

          // Assignment Details Card
          GlassIconCard(
            icon: Icons.description_outlined,
            iconColor: GlassColors.primary,
            title: 'Assignment Details',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GlassTextField(
                  controller: _assignmentController,
                  labelText: 'Assignment Description',
                  hintText: 'e.g. Essay on Climate Change, Science Project...',
                  maxLines: 2,
                  suffixIcon: VoiceInputWidget(
                    onResult: (val) =>
                        setState(() => _assignmentController.text = val),
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

          // Configuration Card
          GlassIconCard(
            icon: Icons.tune_rounded,
            iconColor: GlassColors.primary,
            title: 'Rubric Configuration',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Grading Scale
                Text(
                  'GRADING SCALE',
                  style: GlassTypography.sectionHeader(),
                ),
                const SizedBox(height: GlassSpacing.md),
                Row(
                  children: _scales.map((scale) {
                    final isSelected = _gradeScale == scale;
                    return Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(
                          right: scale != _scales.last ? GlassSpacing.sm : 0,
                        ),
                        child: GestureDetector(
                          onTap: () {
                            HapticFeedback.lightImpact();
                            setState(() => _gradeScale = scale);
                          },
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            padding: const EdgeInsets.symmetric(
                              vertical: GlassSpacing.md,
                            ),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? GlassColors.primary
                                  : GlassColors.chipUnselected,
                              borderRadius: BorderRadius.circular(GlassRadius.sm),
                              border: Border.all(
                                color: isSelected
                                    ? GlassColors.primary
                                    : GlassColors.chipBorder,
                              ),
                            ),
                            child: Text(
                              scale,
                              textAlign: TextAlign.center,
                              style: GlassTypography.labelMedium(
                                color: isSelected
                                    ? Colors.white
                                    : GlassColors.textPrimary,
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: GlassSpacing.xl),

                // Evaluation Criteria
                GlassChipGroup(
                  labelText: 'Evaluation Criteria',
                  options: _criteriaOptions,
                  selectedOptions: _selectedCriteria,
                  onToggle: (criteria) {
                    setState(() {
                      if (_selectedCriteria.contains(criteria)) {
                        if (_selectedCriteria.length > 1) {
                          _selectedCriteria.remove(criteria);
                        }
                      } else {
                        _selectedCriteria.add(criteria);
                      }
                    });
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: GlassSpacing.xl),

          // Preview Card
          const GlassPreviewCard(
            label: 'The Grid Theme',
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
                onPressed: () => setState(() => _generatedRubric = null),
              ),
              const Spacer(),
              TTSPlayButton(text: _generatedRubric!),
              const SizedBox(width: GlassSpacing.sm),
              GlassIconButton(
                icon: Icons.copy_rounded,
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: _generatedRubric!));
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

        // Header
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Evaluation Rubric',
                style: GlassTypography.headline1(),
              ),
              const SizedBox(height: GlassSpacing.xs),
              Text(
                'Generated for: ${_assignmentController.text}',
                style: GlassTypography.bodySmall(),
              ),
            ],
          ),
        ),
        const SizedBox(height: GlassSpacing.lg),

        // Generated Content
        Expanded(
          child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
            child: GlassCard(
              padding: const EdgeInsets.all(GlassSpacing.xl),
              child: MarkdownBody(
                data: _generatedRubric!,
                styleSheet: MarkdownStyleSheet(
                  h1: GlassTypography.headline1(),
                  h2: GlassTypography.headline2(),
                  h3: GlassTypography.headline3(),
                  p: GlassTypography.bodyLarge(),
                  tableHead: GlassTypography.labelLarge(),
                  tableBody: GlassTypography.bodyMedium(),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: GlassSpacing.md),

        // Share to Community
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
          child: ShareToCommunityButton(
            type: 'rubric',
            title: 'Evaluation Rubric',
            data: {'content': _generatedRubric},
          ),
        ),
        const SizedBox(height: GlassSpacing.md),

        // Regenerate Button
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GlassSpacing.xl,
            vertical: GlassSpacing.lg,
          ),
          child: GlassPrimaryButton(
            label: 'Regenerate',
            icon: Icons.refresh_rounded,
            onPressed: _generateRubric,
            isLoading: _isGenerating,
          ),
        ),
      ],
    );
  }
}
