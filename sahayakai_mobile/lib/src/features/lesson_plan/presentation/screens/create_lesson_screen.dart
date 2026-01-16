import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

// Glassmorphic Design System
import '../../../../core/theme/widgets/mesh_background.dart';
import '../../../../core/theme/widgets/glass_card.dart';
import '../../../../core/theme/widgets/selection_card.dart';
import '../../../../core/theme/widgets/premium_fab.dart';
import '../../../../core/theme/extensions/sahayak_theme.dart';

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
    final theme = Theme.of(context).extension<SahayakTheme>()!;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: MeshBackground(
        child: SafeArea(
          child: Stack(
            children: [
              CustomScrollView(
                slivers: [
                  // App Bar
                  SliverAppBar(
                    floating: true,
                    backgroundColor: Colors.transparent,
                    elevation: 0,
                    leading: IconButton(
                      icon: const Icon(Icons.arrow_back_ios_new),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                    title: Text(
                      'Lesson Planner',
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    actions: [
                      _buildLanguageSelector(theme),
                    ],
                  ),

                  // Content
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
                        Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Section Title
                              Text(
                                "What's the topic today?",
                                style: GoogleFonts.outfit(
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 16),

                              // Topic Input Card
                              GlassCard(
                                padding: const EdgeInsets.all(4),
                                borderRadius: 20,
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: TextFormField(
                                        controller: _topicController,
                                        style: GoogleFonts.inter(fontSize: 16),
                                        decoration: InputDecoration(
                                          hintText:
                                              "e.g., Photosynthesis, Mughal Architecture...",
                                          border: InputBorder.none,
                                          contentPadding:
                                              const EdgeInsets.symmetric(
                                            horizontal: 20,
                                            vertical: 16,
                                          ),
                                          hintStyle: GoogleFonts.inter(
                                            color: Colors.grey.shade500,
                                          ),
                                        ),
                                        validator: (value) => value!.isEmpty
                                            ? 'Please enter a topic'
                                            : null,
                                      ),
                                    ),
                                    Container(
                                      margin: const EdgeInsets.only(right: 4),
                                      width: 48,
                                      height: 48,
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF14B8A6)
                                            .withOpacity(0.2),
                                        borderRadius: BorderRadius.circular(16),
                                      ),
                                      child: VoiceInputWidget(
                                        onResult: (text) {
                                          setState(() {
                                            _topicController.text = text;
                                          });
                                        },
                                      ),
                                    ),
                                  ],
                                ),
                              ),

                              const SizedBox(height: 32),

                              // Grade Section
                              Text(
                                "For which grade?",
                                style: GoogleFonts.outfit(
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 16),

                              // Grade Cards
                              ..._grades.map((grade) => Padding(
                                    padding: const EdgeInsets.only(bottom: 12),
                                    child: SelectionCard(
                                      icon: Icons.school,
                                      iconColor: _selectedGrade == grade
                                          ? theme.primary
                                          : const Color(0xFF14B8A6),
                                      title: grade,
                                      subtitle: 'Primary/Secondary Education',
                                      isSelected: _selectedGrade == grade,
                                      onTap: () {
                                        setState(() {
                                          _selectedGrade = grade;
                                        });
                                      },
                                    ),
                                  )),
                            ],
                          ),
                        ),
                      ]),
                    ),
                  ),
                ],
              ),

              // Floating Bottom Button
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Theme.of(context)
                            .scaffoldBackgroundColor
                            .withOpacity(0),
                        Theme.of(context).scaffoldBackgroundColor,
                      ],
                    ),
                  ),
                  child: isLoading
                      ? GlassCard(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          borderRadius: 9999,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 2,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Text(
                                "Designing Lesson...",
                                style: GoogleFonts.outfit(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        )
                      : PremiumFAB(
                          label: 'Generate Lesson Plan',
                          icon: Icons.auto_awesome,
                          backgroundColor: theme.primary,
                          onPressed: _submit,
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLanguageSelector(SahayakTheme theme) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: PopupMenuButton<String>(
        initialValue: _selectedLanguage,
        icon: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: theme.primary.withOpacity(0.1),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.language,
                size: 18,
                color: theme.primary,
              ),
              const SizedBox(width: 4),
              Text(
                _selectedLanguage == 'en' ? 'EN' : 'हि',
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.bold,
                  color: theme.primary,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
        onSelected: (String lang) {
          setState(() {
            _selectedLanguage = lang;
          });
          ref.read(languageProvider.notifier).state = lang;
        },
        itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
          const PopupMenuItem<String>(
            value: 'en',
            child: Text('English'),
          ),
          const PopupMenuItem<String>(
            value: 'hi',
            child: Text('हिन्दी (Hindi)'),
          ),
        ],
      ),
    );
  }

  void _submit() {
    if (_formKey.currentState!.validate()) {
      HapticFeedback.mediumImpact();

      final input = LessonPlanInput(
        topic: _topicController.text,
        language: _selectedLanguage,
        gradeLevels: [_selectedGrade],
        resourceLevel: 'low',
        useRuralContext: true,
      );

      ref.read(lessonPlanControllerProvider).generate(input);
    }
  }

  @override
  void dispose() {
    _topicController.dispose();
    super.dispose();
  }
}
