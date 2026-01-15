import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../tools/data/tool_repository.dart';
import '../../../../core/providers/language_provider.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';

class ContentCreatorScreen extends ConsumerStatefulWidget {
  const ContentCreatorScreen({super.key});

  @override
  ConsumerState<ContentCreatorScreen> createState() =>
      _ContentCreatorScreenState();
}

class _ContentCreatorScreenState extends ConsumerState<ContentCreatorScreen> {
  final _promptController = TextEditingController();
  final _subjectController = TextEditingController();
  String _selectedType = "Lesson Note";
  bool _isLoading = false;
  String? _generatedContent;

  final List<String> _contentTypes = [
    "Lesson Note",
    "Email to Parents",
    "Class Announcement",
    "Creative Story",
    "Student Feedback",
    "Worksheet Plan"
  ];

  Future<void> _generateContent() async {
    if (_promptController.text.trim().isEmpty) return;

    setState(() => _isLoading = true);

    try {
      final language = ref.read(languageProvider);
      final toolRepo = ref.read(toolRepositoryProvider);

      final result = await toolRepo.generateToolContent(
        toolName: _selectedType,
        prompt: _promptController.text,
        language: language,
        subject: _subjectController.text.isNotEmpty
            ? _subjectController.text
            : "General",
      );

      setState(() {
        _isLoading = false;
        _generatedContent = result;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red));
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(languageProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text("Editor's Desk",
            style: GoogleFonts.outfit(
                fontWeight: FontWeight.bold, color: Colors.white)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Theme(
              data: Theme.of(context)
                  .copyWith(canvasColor: Colors.blueGrey.shade900),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: language,
                  icon: const Icon(Icons.language, color: Colors.white70),
                  style: GoogleFonts.inter(
                      color: Colors.white, fontWeight: FontWeight.w500),
                  onChanged: (v) =>
                      ref.read(languageProvider.notifier).setLanguage(v!),
                  items: supportedLanguages
                      .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                      .toList(),
                ),
              ),
            ),
          ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0F172A), Color(0xFF334155)], // Slate 900 to 700
          ),
        ),
        child: SafeArea(
          child: _generatedContent != null
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
          const SizedBox(height: 12),
          Text(
            "Draft Professional Content",
            style: GoogleFonts.outfit(
                fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          Text(
            "Select a format and let AI draft it for you in $language.",
            style: GoogleFonts.inter(
                color: Colors.blueGrey.shade200, fontSize: 16),
          ),

          const SizedBox(height: 32),

          // Type Selector
          Text("Document Type",
              style: GoogleFonts.inter(
                  color: Colors.white70, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: _contentTypes.map((type) {
              final isSelected = _selectedType == type;
              return ChoiceChip(
                label: Text(type),
                selected: isSelected,
                onSelected: (selected) => setState(() => _selectedType = type),
                selectedColor: Colors.cyan,
                backgroundColor: Colors.white.withOpacity(0.1),
                labelStyle: TextStyle(
                    color: isSelected ? Colors.black87 : Colors.white),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: BorderSide.none),
              );
            }).toList(),
          ),

          const SizedBox(height: 32),

          // Subject Input
          Text("Subject / Context",
              style: GoogleFonts.inter(
                  color: Colors.white70, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12)),
            child: TextField(
              controller: _subjectController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: "e.g., Annual Sports Day",
                hintStyle: TextStyle(color: Colors.white38),
                border: InputBorder.none,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
          ),

          const SizedBox(height: 32),

          // Main Input
          Text("Key Points",
              style: GoogleFonts.inter(
                  color: Colors.white70, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16)),
            child: Column(
              children: [
                TextField(
                  controller: _promptController,
                  maxLines: 6,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    hintText:
                        "Draft a polite email to parents reminding them about...",
                    hintStyle: TextStyle(color: Colors.white38),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.all(16),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    border: Border(
                        top: BorderSide(color: Colors.white.withOpacity(0.1))),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      VoiceInputWidget(
                          onResult: (val) => setState(
                              () => _promptController.text += " $val")),
                    ],
                  ),
                )
              ],
            ),
          ),

          const SizedBox(height: 48),

          ElevatedButton(
            onPressed: _isLoading ? null : _generateContent,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.cyan,
              foregroundColor: Colors.black87,
              padding: const EdgeInsets.symmetric(vertical: 18),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              elevation: 8,
              shadowColor: Colors.cyan.withOpacity(0.4),
            ),
            child: _isLoading
                ? const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.black87)),
                      SizedBox(width: 12),
                      Text("Drafting...",
                          style: TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  )
                : Text("GENERATE DRAFT",
                    style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1)),
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
          Row(children: [
            IconButton(
                icon: const Icon(Icons.close, color: Colors.white),
                onPressed: () => setState(() => _generatedContent = null))
          ]),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(2),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 20)
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                MarkdownBody(
                  data: _generatedContent!,
                  styleSheet: MarkdownStyleSheet(
                    p: GoogleFonts.merriweather(
                        fontSize: 16, height: 1.8, color: Colors.black87),
                    h1: GoogleFonts.merriweather(
                        fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.copy),
                  label: const Text("Copy"),
                  style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: Colors.black87,
                      padding: const EdgeInsets.symmetric(vertical: 16)),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.send),
                  label: const Text("Export"),
                  style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.cyan,
                      foregroundColor: Colors.black87,
                      padding: const EdgeInsets.symmetric(vertical: 16)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 48),
        ],
      ),
    );
  }
}
