import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';

import '../../../tools/data/tool_repository.dart';
import '../../../../core/providers/language_provider.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';

class VideoStorytellerScreen extends ConsumerStatefulWidget {
  const VideoStorytellerScreen({super.key});

  @override
  ConsumerState<VideoStorytellerScreen> createState() =>
      _VideoStorytellerScreenState();
}

class _VideoStorytellerScreenState
    extends ConsumerState<VideoStorytellerScreen> {
  final _scriptController = TextEditingController();
  bool _isGenerating = false;
  String? _generatedScript;

  Future<void> _generateVideoScript() async {
    if (_scriptController.text.trim().isEmpty) return;

    setState(() => _isGenerating = true);

    try {
      final language = ref.read(languageProvider);
      final toolRepo = ref.read(toolRepositoryProvider);

      final result = await toolRepo.generateToolContent(
        toolName: "Video Script Writer",
        prompt: _scriptController.text,
        language: language,
      );

      setState(() {
        _isGenerating = false;
        _generatedScript = result;
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
    // Current language from global provider
    final language = ref.watch(languageProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text("Director's Studio",
            style: GoogleFonts.outfit(
                fontWeight: FontWeight.bold, color: Colors.white)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Theme(
              data: Theme.of(context).copyWith(canvasColor: Colors.black87),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: language,
                  icon: const Icon(Icons.language, color: Colors.white),
                  style: GoogleFonts.inter(
                      color: Colors.white, fontWeight: FontWeight.w600),
                  onChanged: (String? newValue) {
                    if (newValue != null) {
                      ref.read(languageProvider.notifier).setLanguage(newValue);
                    }
                  },
                  items: supportedLanguages
                      .map<DropdownMenuItem<String>>((String value) {
                    return DropdownMenuItem<String>(
                      value: value,
                      child: Text(value),
                    );
                  }).toList(),
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
            colors: [
              Color(0xFF2E0249),
              Color(0xFFA80038)
            ], // Deep Purple to Red
          ),
        ),
        child: SafeArea(
          // Use SafeArea to respect notches
          child: _generatedScript != null
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
          Center(
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.1),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white24, width: 2),
              ),
              child: const Icon(Icons.movie_filter_outlined,
                  size: 60, color: Colors.white),
            ),
          ),
          const SizedBox(height: 32),
          Text(
            "Lights, Camera, Action!",
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(
                fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 12),
          Text(
            "Enter a topic, and SahayakAI will write a compelling video script in $language, complete with scene directions and dialogue.",
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
                color: Colors.white70, fontSize: 16, height: 1.5),
          ),
          const SizedBox(height: 48),

          // Input Card
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withOpacity(0.2),
                    blurRadius: 20,
                    offset: const Offset(0, 10)),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _scriptController,
                    maxLines: 5,
                    style:
                        GoogleFonts.inter(fontSize: 16, color: Colors.black87),
                    decoration: InputDecoration(
                      hintText:
                          "e.g., Explain Gravity using a falling apple...",
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
                        setState(() => _scriptController.text = val),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 32),

          ElevatedButton(
            onPressed: _isGenerating ? null : _generateVideoScript,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFFD700), // Gold
              padding: const EdgeInsets.symmetric(vertical: 20),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              shadowColor: Colors.black38,
              elevation: 8,
            ),
            child: _isGenerating
                ? Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              color: Colors.black87, strokeWidth: 2)),
                      const SizedBox(width: 12),
                      Text("Writing Script...",
                          style: GoogleFonts.inter(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.black87)),
                    ],
                  )
                : Text("CREATE SCRIPT",
                    style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                        letterSpacing: 1.2)),
          ),
        ],
      ),
    );
  }

  Widget _buildResultView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.white),
                onPressed: () => setState(() => _generatedScript = null),
              ),
              const Expanded(child: SizedBox()),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            "Video Script",
            style: GoogleFonts.outfit(
                fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 16)
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                          color: Colors.black87,
                          borderRadius: BorderRadius.circular(4)),
                      child: Text("SCENE 1",
                          style: GoogleFonts.courierPrime(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 12)),
                    ),
                    const Spacer(),
                    Icon(Icons.video_camera_front,
                        color: Colors.grey.shade400, size: 20),
                  ],
                ),
                const SizedBox(height: 16),
                MarkdownBody(
                  data: _generatedScript!,
                  styleSheet: MarkdownStyleSheet(
                    p: GoogleFonts.courierPrime(
                        fontSize: 14, height: 1.5, color: Colors.black87),
                    h1: GoogleFonts.outfit(
                        fontSize: 20, fontWeight: FontWeight.bold),
                    h2: GoogleFonts.outfit(
                        fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => setState(() => _generatedScript = null),
                  icon: const Icon(Icons.refresh, color: Colors.white),
                  label: const Text("New Script",
                      style: TextStyle(color: Colors.white)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.white54),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.download, color: Colors.black87),
                  label: const Text("Export PDF",
                      style: TextStyle(
                          color: Colors.black87, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFFD700), // Gold
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
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
