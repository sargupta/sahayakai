import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';

import '../../../tools/data/tool_repository.dart';
import '../../../../core/providers/language_provider.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';

class RubricGeneratorScreen extends ConsumerStatefulWidget {
  const RubricGeneratorScreen({super.key});

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

  final List<String> _criteriaOptions = [
    'Clarity',
    'Grammar',
    'Creativity',
    'Research',
    'Presentation',
    'Effort'
  ];
  final Set<String> _selectedCriteria = {
    'Clarity',
    'Content',
    'Grammar'
  }; // Default

  Future<void> _generateRubric() async {
    if (_assignmentController.text.trim().isEmpty) return;

    setState(() => _isGenerating = true);

    try {
      final language = ref.read(languageProvider);
      final toolRepo = ref.read(toolRepositoryProvider);

      final prompt =
          "Create a grading rubric for an assignment about: '${_assignmentController.text}'. "
          "Use a $_gradeScale scale. "
          "Include these criteria: ${_selectedCriteria.join(', ')}. "
          "Format as a Markdown table.";

      final result = await toolRepo.generateToolContent(
        toolName: "Rubric Maker",
        prompt: prompt,
        language: language,
      );

      setState(() {
        _isGenerating = false;
        _generatedRubric = result;
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
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text("Rubric Architect",
            style: GoogleFonts.outfit(
                fontWeight: FontWeight.bold, color: Colors.indigo)),
        backgroundColor: Colors.indigo.shade50,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.indigo),
      ),
      body: _generatedRubric != null ? _buildResultView() : _buildInputForm(),
    );
  }

  Widget _buildInputForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                    color: Colors.indigo.shade100,
                    borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.grid_on, color: Colors.indigo),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("New Rubric",
                        style: GoogleFonts.outfit(
                            fontSize: 20, fontWeight: FontWeight.bold)),
                    Text("Define your evaluation matrix",
                        style: GoogleFonts.inter(color: Colors.grey)),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 32),

          // Assignment Input
          Text("Assignment Description",
              style:
                  GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _assignmentController,
                    decoration: InputDecoration(
                      hintText: "e.g., Essay on Climate Change...",
                      border: InputBorder.none,
                      hintStyle: GoogleFonts.inter(color: Colors.grey.shade400),
                    ),
                  ),
                ),
                VoiceInputWidget(
                    onResult: (val) =>
                        setState(() => _assignmentController.text = val)),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Scale Selector
          Text("Grading Scale",
              style:
                  GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(30)),
            child: Row(
              children: _scales.map((scale) {
                final isSelected = _gradeScale == scale;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _gradeScale = scale),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: isSelected ? Colors.indigo : Colors.transparent,
                        borderRadius: BorderRadius.circular(30),
                      ),
                      child: Text(
                        scale,
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.bold,
                          color:
                              isSelected ? Colors.white : Colors.grey.shade600,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: 24),

          // Criteria Chips
          Text("Evaluation Criteria",
              style:
                  GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _criteriaOptions.map((opt) {
              final isSelected = _selectedCriteria.contains(opt);
              return FilterChip(
                label: Text(opt),
                selected: isSelected,
                onSelected: (selected) {
                  setState(() {
                    if (selected)
                      _selectedCriteria.add(opt);
                    else
                      _selectedCriteria.remove(opt);
                  });
                },
                selectedColor: Colors.indigo.withOpacity(0.2),
                checkmarkColor: Colors.indigo,
                labelStyle: TextStyle(
                    color: isSelected ? Colors.indigo : Colors.black87),
              );
            }).toList(),
          ),

          const SizedBox(height: 48),

          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton(
              onPressed: _isGenerating ? null : _generateRubric,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.indigo,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                elevation: 4,
              ),
              child: _isGenerating
                  ? const CircularProgressIndicator(color: Colors.white)
                  : Text("Build Table",
                      style: GoogleFonts.outfit(
                          fontSize: 18, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResultView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () => setState(() => _generatedRubric = null)),
              Row(
                children: [
                  IconButton(icon: const Icon(Icons.copy), onPressed: () {}),
                  IconButton(icon: const Icon(Icons.share), onPressed: () {}),
                ],
              )
            ],
          ),
          const SizedBox(height: 16),
          const Text("Evaluation Rubric",
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey.shade300),
              boxShadow: [
                BoxShadow(
                    color: Colors.grey.shade200,
                    blurRadius: 10,
                    offset: const Offset(0, 4))
              ],
            ),
            child: MarkdownBody(data: _generatedRubric!),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}
