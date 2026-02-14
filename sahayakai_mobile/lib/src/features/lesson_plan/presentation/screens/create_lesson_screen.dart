import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

// Architecture Imports
import '../../../../core/theme/widgets/studio_scaffold.dart';
import '../../../../core/theme/extensions/sahayak_theme.dart';
import '../../../../core/theme/widgets/glass_container.dart';
import '../../../../core/theme/studio_theme_resolver.dart'; // For StudioType enum

// Feature Imports
import '../../domain/lesson_plan_models.dart';
import '../widgets/voice_input_widget.dart';
import 'lesson_result_screen.dart';
import '../providers/lesson_plan_provider.dart';
import '../../../../core/providers/language_provider.dart';

class CreateLessonScreen extends ConsumerStatefulWidget {
  const CreateLessonScreen({super.key});

  @override
  ConsumerState<CreateLessonScreen> createState() => _CreateLessonScreenState();
}

class _CreateLessonScreenState extends ConsumerState<CreateLessonScreen> {
  final _formKey = GlobalKey<FormState>();
  final _topicController = TextEditingController();

  String _selectedGrade = 'Grade 6';
  final List<String> _grades = [
    'Grade 5',
    'Grade 6',
    'Grade 7',
    'Grade 8',
    'Grade 9',
    'Grade 10'
  ];

  late String _selectedLanguage;

  @override
  void initState() {
    super.initState();
    _selectedLanguage = ref.read(languageProvider);
  }

  @override
  Widget build(BuildContext context) {
    // Listen for success and navigate
    ref.listen(lessonPlanResultProvider, (previous, next) {
      if (next != null) {
        Navigator.push(
          context,
          MaterialPageRoute(
              builder: (context) => LessonResultScreen(plan: next)),
        );
      }
    });

    final isLoading = ref.watch(lessonPlanLoadingProvider);

    // Using StudioScaffold to provide the ambient SahayakTheme
    return StudioScaffold(
      studio: StudioType.wizard,
      title: "Lesson Planner",
      child: Builder(builder: (context) {
        // Now we can access the localized and studio-specific tokens!
        final theme = Theme.of(context).extension<SahayakTheme>()!;

        return SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildLanguageSelector(theme),
                const SizedBox(height: 32),

                // 1. Topic Section
                Text("What's the topic today?",
                    style: GoogleFonts.outfit(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87)),
                const SizedBox(height: 12),

                // GLASS INPUT FIELD
                GlassContainer(
                  radius: BorderRadius.circular(16),
                  tint: Colors.white,
                  opacity: 0.5,
                  blur: 10,
                  child: Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _topicController,
                            style: GoogleFonts.inter(fontSize: 16),
                            decoration: InputDecoration(
                              hintText:
                                  "e.g., Photosynthesis, The French Revolution...",
                              border: InputBorder.none,
                              hintStyle: GoogleFonts.inter(
                                  color: Colors.grey.shade500),
                            ),
                            validator: (value) =>
                                value!.isEmpty ? 'Please enter a topic' : null,
                          ),
                        ),
                        const SizedBox(width: 8),
                        VoiceInputWidget(
                          onResult: (text) {
                            setState(() {
                              _topicController.text = text;
                            });
                          },
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 32),

                // 2. Grade Section
                Text("For which grade?",
                    style: GoogleFonts.outfit(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87)),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: _grades
                      .map((grade) => _buildGradeChip(grade, theme))
                      .toList(),
                ),

                const SizedBox(height: 48),

                // 3. Action Button
                SizedBox(
                  height: 56,
                  child: ElevatedButton(
                    onPressed: isLoading ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: theme.primary,
                      foregroundColor: Colors.white,
                      elevation: 4,
                      shadowColor: theme.primary.withOpacity(0.4),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16)),
                    ),
                    child: isLoading
                        ? const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                      color: Colors.white, strokeWidth: 2)),
                              SizedBox(width: 12),
                              Text("Designing Lesson...",
                                  style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold)),
                            ],
                          )
                        : const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.auto_awesome),
                              SizedBox(width: 8),
                              Text("Generate Lesson Plan",
                                  style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold)),
                            ],
                          ),
                  ),
                ),
              ],
            ),
          ),
        );
      }),
    );
  }

  // Not strictly needed with StudioScaffold's AppBar, but kept if sub-header logic changes
  // Widget _buildHeader() ... removed as StudioScaffold handles AppBar

  Widget _buildLanguageSelector(SahayakTheme theme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: theme.accent.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.primary.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Icon(Icons.language, color: theme.primary, size: 20),
          const SizedBox(width: 8),
          Text("Language:",
              style: GoogleFonts.inter(
                  color: theme.primary, fontWeight: FontWeight.w600)),
          const SizedBox(width: 12),
          Expanded(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedLanguage,
                isDense: true,
                icon: Icon(Icons.keyboard_arrow_down, color: theme.primary),
                style: GoogleFonts.inter(
                    color: Colors.black87, fontWeight: FontWeight.w500),
                items: supportedLanguages
                    .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                    .toList(),
                onChanged: (v) => setState(() {
                  _selectedLanguage = v!;
                  // ref.read(languageProvider.notifier).setLanguage(v);
                }),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGradeChip(String grade, SahayakTheme theme) {
    final isSelected = _selectedGrade == grade;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        setState(() => _selectedGrade = grade);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? theme.primary : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: isSelected ? theme.primary : Colors.grey.shade300),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                      color: theme.primary.withOpacity(0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 4))
                ]
              : [],
        ),
        child: Text(
          grade,
          style: GoogleFonts.inter(
            color: isSelected ? Colors.white : Colors.black87,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  void _submit() {
    if (_formKey.currentState!.validate()) {
      HapticFeedback.mediumImpact();
      final input = LessonPlanInput(
        topic: _topicController.text,
        gradeLevels: [_selectedGrade],
        resourceLevel: 'low',
        useRuralContext: true,
        language: _selectedLanguage,
      );
      ref.read(lessonPlanControllerProvider).generate(input);
    }
  }
}
