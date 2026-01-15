import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';

import '../../../tools/data/tool_repository.dart';
import '../../../../core/providers/language_provider.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';

class VisualAidCreatorScreen extends ConsumerStatefulWidget {
  const VisualAidCreatorScreen({super.key});

  @override
  ConsumerState<VisualAidCreatorScreen> createState() =>
      _VisualAidCreatorScreenState();
}

class _VisualAidCreatorScreenState
    extends ConsumerState<VisualAidCreatorScreen> {
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

  Future<void> _generateVisualAid() async {
    if (_promptController.text.trim().isEmpty) return;

    setState(() => _isGenerating = true);

    try {
      final language = ref.read(languageProvider);
      final toolRepo = ref.read(toolRepositoryProvider);

      // Append style to prompt
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
    final language = ref.watch(languageProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text("Visual Artist",
            style: GoogleFonts.outfit(
                fontWeight: FontWeight.bold, color: Colors.white)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF8B5CF6), Color(0xFFEC4899)], // Violet to Pink
          ),
        ),
        child: SafeArea(
          child: _generatedDescription != null
              ? _buildResultView()
              : _buildInputForm(language),
        ),
      ),
    );
  }

  Widget _buildInputForm(String language) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 20),
          const Center(
            child: Icon(Icons.palette_outlined, size: 64, color: Colors.white),
          ),
          const SizedBox(height: 16),
          Text(
            "Design Your Visual Aid",
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(
                fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            "Describe the image, diagram, or chart you need. AI will create a detailed visual specification for your class.",
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
                color: Colors.white.withOpacity(0.8), fontSize: 16),
          ),

          const SizedBox(height: 32),

          // Style Selector
          Text("Choose a Style:",
              style: GoogleFonts.inter(
                  color: Colors.white, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: _styles.map((style) {
              final isSelected = _selectedStyle == style;
              return ChoiceChip(
                label: Text(style,
                    style: TextStyle(
                        color: isSelected ? Colors.purple : Colors.white)),
                selected: isSelected,
                onSelected: (selected) =>
                    setState(() => _selectedStyle = style),
                selectedColor: Colors.white,
                backgroundColor: Colors.white.withOpacity(0.2),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: BorderSide.none),
              );
            }).toList(),
          ),

          const SizedBox(height: 32),

          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 10,
                    offset: const Offset(0, 4)),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _promptController,
                    maxLines: 4,
                    style: GoogleFonts.inter(fontSize: 16),
                    decoration: InputDecoration(
                      hintText:
                          "e.g., A diagram of the human heart labeling the chambers...",
                      hintStyle: GoogleFonts.inter(color: Colors.grey.shade400),
                      contentPadding: const EdgeInsets.all(20),
                      border: InputBorder.none,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: VoiceInputWidget(
                    onResult: (val) =>
                        setState(() => _promptController.text = val),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 32),

          ElevatedButton(
            onPressed: _isGenerating ? null : _generateVisualAid,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: Colors.purple,
              padding: const EdgeInsets.symmetric(vertical: 20),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              shadowColor: Colors.black26,
              elevation: 4,
            ),
            child: _isGenerating
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : Text("GENERATE DESIGN",
                    style: GoogleFonts.outfit(
                        fontSize: 18, fontWeight: FontWeight.bold)),
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
            children: [
              IconButton(
                  icon: const Icon(Icons.arrow_back, color: Colors.white),
                  onPressed: () =>
                      setState(() => _generatedDescription = null)),
              const Spacer(),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            "Image Specification",
            style: GoogleFonts.outfit(
                fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 16),

          // Placeholder Image Area
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.black26,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white30),
              ),
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.image, size: 48, color: Colors.white54),
                    SizedBox(height: 8),
                    Text("AI Image Preview",
                        style: TextStyle(color: Colors.white54)),
                  ],
                ),
              ),
            ),
          ),

          const SizedBox(height: 24),

          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 10)
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Detailed Prompt:",
                    style: GoogleFonts.inter(
                        fontWeight: FontWeight.bold,
                        color: Colors.grey,
                        fontSize: 12)),
                const SizedBox(height: 8),
                MarkdownBody(data: _generatedDescription!),
              ],
            ),
          ),

          const SizedBox(height: 24),

          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => setState(() => _generatedDescription = null),
                  style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Colors.white),
                      padding: const EdgeInsets.symmetric(vertical: 16)),
                  child: const Text("Create Another",
                      style: TextStyle(color: Colors.white)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }
}
