import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../../../core/theme/glassmorphic/glass_buttons.dart';
import '../../../../core/theme/glassmorphic/glass_inputs.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';
import '../../domain/exam_paper_models.dart';
import '../providers/exam_paper_provider.dart';

// ─────────────────── Constants ───────────────────

const _boards = ['CBSE', 'ICSE', 'State Board'];
const _grades = [
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
  'Class 11', 'Class 12',
];
const _difficulties = ['easy', 'moderate', 'hard', 'mixed'];
const _difficultyLabels = {
  'easy': 'Easy',
  'moderate': 'Moderate',
  'hard': 'Hard',
  'mixed': 'Mixed',
};
const _languages = [
  'English', 'Hindi', 'Bengali', 'Tamil', 'Kannada',
  'Telugu', 'Malayalam', 'Gujarati', 'Marathi', 'Punjabi', 'Odia',
];

// ─────────────────── Screen ───────────────────

class ExamPaperConfigScreen extends ConsumerStatefulWidget {
  const ExamPaperConfigScreen({super.key});

  @override
  ConsumerState<ExamPaperConfigScreen> createState() =>
      _ExamPaperConfigScreenState();
}

class _ExamPaperConfigScreenState
    extends ConsumerState<ExamPaperConfigScreen> {
  final _subjectController = TextEditingController();
  final _chaptersController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  String _selectedBoard = 'CBSE';
  String _selectedGrade = 'Class 10';
  String _selectedDifficulty = 'mixed';
  String _selectedLanguage = 'English';
  bool _includeAnswerKey = true;
  bool _includeMarkingScheme = true;

  @override
  void dispose() {
    _subjectController.dispose();
    _chaptersController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    // Listen for result and navigate when ready.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.listenManual(examPaperResultProvider, (_, result) {
        if (result != null && mounted) {
          context.push('/exam-paper/result');
        }
      });
    });
  }

  Future<void> _generate() async {
    if (!_formKey.currentState!.validate()) return;

    final chapters = _chaptersController.text.trim().isEmpty
        ? <String>[]
        : _chaptersController.text
            .split(',')
            .map((s) => s.trim())
            .where((s) => s.isNotEmpty)
            .toList();

    final input = ExamPaperInput(
      board: _selectedBoard,
      gradeLevel: _selectedGrade,
      subject: _subjectController.text.trim(),
      chapters: chapters,
      difficulty: _selectedDifficulty,
      language: _selectedLanguage,
      includeAnswerKey: _includeAnswerKey,
      includeMarkingScheme: _includeMarkingScheme,
    );

    await ref.read(examPaperControllerProvider.notifier).generate(input);
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(examPaperLoadingProvider);
    final error = ref.watch(examPaperErrorProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF1A0A2E), // Deep indigo — exam studio
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            Expanded(
              child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.all(GlassSpacing.xl),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Board selector
                      _buildSectionLabel('Board'),
                      const SizedBox(height: GlassSpacing.sm),
                      _buildChipSelector(
                        options: _boards,
                        selected: _selectedBoard,
                        onSelect: (v) =>
                            setState(() => _selectedBoard = v),
                      ),
                      const SizedBox(height: GlassSpacing.lg),

                      // Grade selector
                      _buildSectionLabel('Grade'),
                      const SizedBox(height: GlassSpacing.sm),
                      _buildChipSelector(
                        options: _grades,
                        selected: _selectedGrade,
                        onSelect: (v) =>
                            setState(() => _selectedGrade = v),
                        wrapMode: true,
                      ),
                      const SizedBox(height: GlassSpacing.lg),

                      // Subject field
                      _buildSectionLabel('Subject'),
                      const SizedBox(height: GlassSpacing.sm),
                      GlassTextField(
                        controller: _subjectController,
                        hintText: 'e.g. Mathematics, Science, History',
                        suffixIcon: VoiceInputWidget(
                          onResult: (text) => setState(() {
                            _subjectController.text = text;
                          }),
                        ),
                      ),
                      const SizedBox(height: GlassSpacing.lg),

                      // Chapters field (optional)
                      _buildSectionLabel('Chapters (optional)'),
                      const SizedBox(height: GlassSpacing.xs),
                      Text(
                        'Leave blank for all chapters. Separate multiple with commas.',
                        style: GlassTypography.bodySmall()
                            .copyWith(color: GlassColors.textTertiary),
                      ),
                      const SizedBox(height: GlassSpacing.sm),
                      GlassTextField(
                        controller: _chaptersController,
                        hintText: 'e.g. Algebra, Geometry, Trigonometry',
                      ),
                      const SizedBox(height: GlassSpacing.lg),

                      // Difficulty
                      _buildSectionLabel('Difficulty'),
                      const SizedBox(height: GlassSpacing.sm),
                      _buildChipSelector(
                        options: _difficulties,
                        selected: _selectedDifficulty,
                        onSelect: (v) =>
                            setState(() => _selectedDifficulty = v),
                        labelOverrides: _difficultyLabels,
                        accentColor: const Color(0xFF9C27B0),
                      ),
                      const SizedBox(height: GlassSpacing.lg),

                      // Language
                      _buildSectionLabel('Language'),
                      const SizedBox(height: GlassSpacing.sm),
                      GlassDropdown<String>(
                        value: _selectedLanguage,
                        items: _languages
                            .map((l) => DropdownMenuItem(
                                  value: l,
                                  child: Text(l),
                                ))
                            .toList(),
                        onChanged: (v) =>
                            setState(() => _selectedLanguage = v ?? 'English'),
                      ),
                      const SizedBox(height: GlassSpacing.lg),

                      // Toggles
                      _buildToggleRow(
                        label: 'Include Answer Key',
                        value: _includeAnswerKey,
                        onChanged: (v) =>
                            setState(() => _includeAnswerKey = v),
                      ),
                      const SizedBox(height: GlassSpacing.sm),
                      _buildToggleRow(
                        label: 'Include Marking Scheme',
                        value: _includeMarkingScheme,
                        onChanged: (v) =>
                            setState(() => _includeMarkingScheme = v),
                      ),
                      const SizedBox(height: GlassSpacing.xl),

                      // Error message
                      if (error != null) ...[
                        _buildErrorCard(error),
                        const SizedBox(height: GlassSpacing.lg),
                      ],

                      // Generate button
                      SizedBox(
                        width: double.infinity,
                        child: GlassPrimaryButton(
                          label: isLoading
                              ? 'Generating Paper...'
                              : 'Generate Exam Paper',
                          icon: isLoading
                              ? null
                              : Icons.description_rounded,
                          isLoading: isLoading,
                          onPressed: isLoading ? null : _generate,
                        ),
                      ),
                      const SizedBox(height: GlassSpacing.xl),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Widgets ───

  Widget _buildHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: GlassSpacing.lg,
        vertical: GlassSpacing.md,
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded,
                color: Colors.white70),
            onPressed: () => context.pop(),
          ),
          const SizedBox(width: GlassSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Exam Architect',
                style: GlassTypography.decorativeLabel()
                    .copyWith(color: const Color(0xFFCE93D8)),
              ),
              Text(
                'Exam Paper Generator',
                style: GlassTypography.headline2()
                    .copyWith(color: Colors.white),
              ),
            ],
          ),
          const Spacer(),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF6A0DAD).withOpacity(0.3),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.assignment_outlined,
              color: Color(0xFFCE93D8),
              size: 24,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionLabel(String label) {
    return Text(
      label,
      style: GoogleFonts.outfit(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: Colors.white60,
        letterSpacing: 1.2,
      ),
    );
  }

  Widget _buildChipSelector({
    required List<String> options,
    required String selected,
    required void Function(String) onSelect,
    Map<String, String>? labelOverrides,
    bool wrapMode = false,
    Color? accentColor,
  }) {
    final accent = accentColor ?? const Color(0xFF6A0DAD);
    final chips = options.map((opt) {
      final label = labelOverrides?[opt] ?? opt;
      final isSelected = opt == selected;
      return GestureDetector(
        onTap: () => onSelect(opt),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? accent : Colors.white.withOpacity(0.08),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isSelected ? accent : Colors.white.withOpacity(0.15),
            ),
          ),
          child: Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 13,
              fontWeight:
                  isSelected ? FontWeight.w600 : FontWeight.w400,
              color: isSelected ? Colors.white : Colors.white70,
            ),
          ),
        ),
      );
    }).toList();

    if (wrapMode) {
      return Wrap(spacing: 8, runSpacing: 8, children: chips);
    }
    return SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      scrollDirection: Axis.horizontal,
      child: Row(children: chips.map((c) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: c,
      )).toList()),
    );
  }

  Widget _buildToggleRow({
    required String label,
    required bool value,
    required void Function(bool) onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: GlassSpacing.md, vertical: GlassSpacing.sm),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: GlassTypography.bodyMedium()
                .copyWith(color: const Color(0xDEFFFFFF)),
          ),
          Switch.adaptive(
            value: value,
            onChanged: onChanged,
            activeColor: const Color(0xFF9C27B0),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorCard(String error) {
    return Container(
      padding: const EdgeInsets.all(GlassSpacing.md),
      decoration: BoxDecoration(
        color: Colors.redAccent.withOpacity(0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.redAccent.withOpacity(0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: Colors.redAccent, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              error,
              style: GlassTypography.bodySmall()
                  .copyWith(color: Colors.redAccent),
            ),
          ),
        ],
      ),
    );
  }
}
