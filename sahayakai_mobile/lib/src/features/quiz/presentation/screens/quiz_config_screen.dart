import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';
import '../providers/quiz_provider.dart';
import '../../domain/quiz_models.dart';
import 'quiz_play_screen.dart';
import '../../../../core/providers/language_provider.dart';

class QuizConfigScreen extends ConsumerStatefulWidget {
  const QuizConfigScreen({super.key});

  @override
  ConsumerState<QuizConfigScreen> createState() => _QuizConfigScreenState();
}

class _QuizConfigScreenState extends ConsumerState<QuizConfigScreen> {
  final _topicController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  String _grade = 'Grade 6';
  final List<String> _grades = [
    'Grade 5',
    'Grade 6',
    'Grade 7',
    'Grade 8',
    'Grade 9',
    'Grade 10'
  ];

  int _numQuestions = 5;
  late String _selectedLanguage;

  // Gamification: Difficulty Level
  String _difficulty = 'Medium';
  final Map<String, List<String>> _difficultyMap = {
    'Easy': ['Remember', 'Understand'],
    'Medium': ['Apply', 'Analyze'],
    'Hard': ['Evaluate', 'Create'],
  };

  @override
  void initState() {
    super.initState();
    _selectedLanguage = ref.read(languageProvider);
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(quizLoadingProvider);

    ref.listen(quizResultProvider, (previous, next) {
      if (next != null) {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => QuizPlayScreen(quiz: next)),
        );
      }
    });

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFF0FDF4), Colors.white], // Green-50 to White
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24.0),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _buildLanguageSelector(),
                        const SizedBox(height: 24),

                        // 1. Topic
                        Text("Quiz Topic",
                            style: GoogleFonts.outfit(
                                fontSize: 18, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.green.shade100),
                          ),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 4),
                          child: Row(
                            children: [
                              Expanded(
                                child: TextFormField(
                                  controller: _topicController,
                                  style: GoogleFonts.inter(
                                      fontWeight: FontWeight.w600),
                                  decoration: InputDecoration(
                                    hintText: "e.g., Solar System",
                                    border: InputBorder.none,
                                    icon: const Icon(Icons.psychology,
                                        color: Colors.green),
                                    hintStyle: GoogleFonts.inter(
                                        color: Colors.grey.shade400),
                                  ),
                                  validator: (v) =>
                                      v!.isEmpty ? "Required" : null,
                                ),
                              ),
                              const SizedBox(width: 8),
                              VoiceInputWidget(
                                  onResult: (val) => setState(
                                      () => _topicController.text = val)),
                            ],
                          ),
                        ),

                        const SizedBox(height: 32),

                        // 2. Grade & Difficulty Row
                        Row(
                          children: [
                            Expanded(
                                child: _buildDropdownCard(
                                    "Grade",
                                    _grade,
                                    _grades,
                                    (v) => setState(() => _grade = v!))),
                            const SizedBox(width: 16),
                            Expanded(
                                child: _buildDropdownCard(
                                    "Difficulty",
                                    _difficulty,
                                    ['Easy', 'Medium', 'Hard'],
                                    (v) => setState(() => _difficulty = v!))),
                          ],
                        ),

                        const SizedBox(height: 32),

                        // 3. Question Count Slider
                        Text("Number of Questions: $_numQuestions",
                            style: GoogleFonts.outfit(
                                fontSize: 18, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              vertical: 16, horizontal: 8),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: SliderTheme(
                            data: SliderTheme.of(context).copyWith(
                              activeTrackColor: Colors.green,
                              inactiveTrackColor: Colors.green.shade100,
                              thumbColor: Colors.green,
                              overlayColor: Colors.green.withOpacity(0.2),
                              trackHeight: 8,
                              thumbShape: const RoundSliderThumbShape(
                                  enabledThumbRadius: 12),
                            ),
                            child: Slider(
                              value: _numQuestions.toDouble(),
                              min: 3,
                              max: 15,
                              divisions: 12,
                              label: _numQuestions.toString(),
                              onChanged: (v) =>
                                  setState(() => _numQuestions = v.toInt()),
                            ),
                          ),
                        ),

                        const SizedBox(height: 48),

                        // 4. Action
                        SizedBox(
                          height: 56,
                          child: ElevatedButton(
                            onPressed: isLoading ? null : _submit,
                            style: ElevatedButton.styleFrom(
                              backgroundColor:
                                  const Color(0xFF16A34A), // Green-600
                              foregroundColor: Colors.white,
                              elevation: 4,
                              shadowColor: Colors.green.withOpacity(0.4),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16)),
                            ),
                            child: isLoading
                                ? const CircularProgressIndicator(
                                    color: Colors.white)
                                : Text("Start Quiz Challenge",
                                    style: GoogleFonts.outfit(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          IconButton(
              icon: const Icon(Icons.arrow_back_ios_new),
              onPressed: () => Navigator.pop(context)),
          const SizedBox(width: 8),
          Text("Quiz Generator",
              style: GoogleFonts.outfit(
                  fontSize: 24, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildLanguageSelector() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.green.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.green.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          const Icon(Icons.language, color: Colors.green, size: 20),
          const SizedBox(width: 8),
          Text("Language:",
              style: GoogleFonts.inter(
                  color: Colors.green, fontWeight: FontWeight.w600)),
          const SizedBox(width: 12),
          Expanded(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedLanguage,
                isDense: true,
                icon:
                    const Icon(Icons.keyboard_arrow_down, color: Colors.green),
                style: GoogleFonts.inter(
                    color: Colors.black87, fontWeight: FontWeight.w500),
                items: supportedLanguages
                    .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                    .toList(),
                onChanged: (v) => setState(() {
                  _selectedLanguage = v!;
                }),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDropdownCard(String label, String value, List<String> items,
      Function(String?) onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: GoogleFonts.inter(
                fontWeight: FontWeight.w600, color: Colors.grey.shade700)),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade300),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              isExpanded: true,
              items: items
                  .map((e) => DropdownMenuItem(
                      value: e, child: Text(e, style: GoogleFonts.inter())))
                  .toList(),
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }

  void _submit() {
    if (_formKey.currentState!.validate()) {
      final config = QuizConfig(
        topic: _topicController.text,
        gradeLevel: _grade,
        numQuestions: _numQuestions,
        language: _selectedLanguage,
        bloomsLevels: _difficultyMap[_difficulty] ??
            ['Remember'], // Pass mapped complexity
      );
      ref.read(quizControllerProvider).createQuiz(config);
    }
  }
}
