import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:sahayakai_mobile/src/core/theme/extensions/sahayak_theme.dart';
import '../../../tools/data/tool_repository.dart';
import '../../../../core/providers/language_provider.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';

class WorksheetWizardScreen extends ConsumerStatefulWidget {
  const WorksheetWizardScreen({super.key});

  @override
  ConsumerState<WorksheetWizardScreen> createState() =>
      _WorksheetWizardScreenState();
}

class _WorksheetWizardScreenState extends ConsumerState<WorksheetWizardScreen> {
  final _topicController = TextEditingController();
  bool _isGenerating = false;
  String? _generatedWorksheet;

  bool _includeAnswerKey = true;
  final List<String> _questionTypes = [
    'Multiple Choice',
    'Fill in Blanks',
    'Short Answer',
    'True/False'
  ];
  final Set<String> _selectedTypes = {'Multiple Choice', 'Short Answer'};

  Future<void> _generateWorksheet() async {
    if (_topicController.text.trim().isEmpty) return;

    setState(() => _isGenerating = true);

    try {
      final language = ref.read(languageProvider);
      final toolRepo = ref.read(toolRepositoryProvider);

      final prompt = "Create a worksheet about '${_topicController.text}'. "
          "Include these question types: ${_selectedTypes.join(', ')}. "
          "${_includeAnswerKey ? 'Include an Answer Key at the end.' : ''}";

      final result = await toolRepo.generateToolContent(
        toolName: "Worksheet Generator",
        prompt: prompt,
        language: language,
      );

      setState(() {
        _isGenerating = false;
        _generatedWorksheet = result;
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
      backgroundColor: const Color(0xFFF3F4F6), // Light Grey background
      appBar: AppBar(
        title: Text("Worksheet Wizard",
            style: GoogleFonts.outfit(
                fontWeight: FontWeight.bold, color: Colors.black87)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body:
          _generatedWorksheet != null ? _buildResultView() : _buildInputForm(),
    );
  }

  Widget _buildInputForm() {
    final theme = Theme.of(context).extension<SahayakTheme>()!;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildPaperCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Topic",
                    style: GoogleFonts.inter(
                        fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _topicController,
                        decoration: InputDecoration(
                          hintText: "e.g., Fractions, Water Cycle...",
                          hintStyle:
                              GoogleFonts.inter(color: Colors.grey.shade400),
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide:
                                  BorderSide(color: Colors.grey.shade300)),
                          enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide:
                                  BorderSide(color: Colors.grey.shade300)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    VoiceInputWidget(
                        onResult: (val) =>
                            setState(() => _topicController.text = val)),
                  ],
                ),
                const SizedBox(height: 24),
                Text("Question Types",
                    style: GoogleFonts.inter(
                        fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _questionTypes.map((type) {
                    final isSelected = _selectedTypes.contains(type);
                    return FilterChip(
                      label: Text(type),
                      selected: isSelected,
                      onSelected: (selected) {
                        setState(() {
                          if (selected) {
                            _selectedTypes.add(type);
                          } else {
                            _selectedTypes.remove(type);
                          }
                        });
                      },
                      selectedColor: theme.primary.withOpacity(0.2),
                      checkmarkColor: theme.primary,
                      labelStyle: GoogleFonts.inter(
                          color:
                              isSelected ? theme.primary : Colors.black87),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 24),
                SwitchListTile(
                  title: Text("Include Answer Key",
                      style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                  value: _includeAnswerKey,
                  onChanged: (v) => setState(() => _includeAnswerKey = v),
                  activeThumbColor: theme.primary,
                  contentPadding: EdgeInsets.zero,
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: _isGenerating ? null : _generateWorksheet,
            style: ElevatedButton.styleFrom(
              backgroundColor: theme.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 18),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              elevation: 4,
            ),
            child: _isGenerating
                ? const CircularProgressIndicator(color: Colors.white)
                : Text("Create Worksheet",
                    style: GoogleFonts.outfit(
                        fontSize: 18, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildResultView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () => setState(() => _generatedWorksheet = null)),
              const Spacer(),
              IconButton(icon: const Icon(Icons.print), onPressed: () {}),
              IconButton(icon: const Icon(Icons.share), onPressed: () {}),
            ],
          ),
          const SizedBox(height: 16),
          _buildPaperCard(
            padding: const EdgeInsets.all(32), // More padding for document look
            child: MarkdownBody(
              data: _generatedWorksheet!,
              styleSheet: MarkdownStyleSheet(
                h1: GoogleFonts.outfit(
                    fontSize: 24, fontWeight: FontWeight.bold),
                h2: GoogleFonts.outfit(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    decoration: TextDecoration.underline),
                p: GoogleFonts.inter(fontSize: 14, height: 1.6),
              ),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildPaperCard({required Widget child, EdgeInsetsGeometry? padding}) {
    return Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(2), // Sharp corners like paper
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 4,
              offset: const Offset(0, 2)),
        ],
      ),
      child: child,
    );
  }
}
