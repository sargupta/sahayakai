import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai_mobile/src/core/theme/extensions/sahayak_theme.dart';
import '../../../chat/data/chat_repository.dart';

class InstantAnswerScreen extends ConsumerStatefulWidget {
  const InstantAnswerScreen({super.key});

  @override
  ConsumerState<InstantAnswerScreen> createState() =>
      _InstantAnswerScreenState();
}

class _InstantAnswerScreenState extends ConsumerState<InstantAnswerScreen> {
  final _questionController = TextEditingController();
  String _selectedGrade = "6th Grade";
  String _selectedLanguage = "English";
  bool _isLoading = false;
  String? _answer;

  final List<String> _grades = [
    "1st Grade",
    "2nd Grade",
    "3rd Grade",
    "4th Grade",
    "5th Grade",
    "6th Grade",
    "7th Grade",
    "8th Grade",
    "9th Grade",
    "10th Grade"
  ];
  final List<String> _languages = [
    "English",
    "Hindi",
    "Tamil",
    "Telugu",
    "Kannada",
    "Malayalam",
    "Marathi",
    "Bengali"
  ];

  Future<void> _getAnswer() async {
    if (_questionController.text.trim().isEmpty) return;

    setState(() {
      _isLoading = true;
      _answer = null;
    });

    try {
      final response = await ref.read(chatRepositoryProvider).sendQuestion(
          _questionController.text, // Corrected: Pass question directly
          _selectedLanguage,
          _selectedGrade);

      if (mounted) {
        setState(() {
          _answer = response['answer'] ??
              "No answer received."; // Corrected: Access map key
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _answer = "Error: Failed to get answer. Please try again.";
          _isLoading = false;
        });
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text("Error: $e")));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).extension<SahayakTheme>()!;
    return Scaffold(
      appBar: AppBar(
        title: Text("Instant Answer",
            style: GoogleFonts.outfit(
                fontWeight: FontWeight.bold, color: Colors.black)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Center(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: theme.primary.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.auto_awesome,
                    size: 48, color: theme.primary),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              "Get quick answers for your students",
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87),
            ),
            const SizedBox(height: 32),

            // Form
            Text("Your Question",
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.w600, color: Colors.black87)),
            const SizedBox(height: 8),
            TextField(
              controller: _questionController,
              maxLines: 3,
              style: GoogleFonts.inter(color: Colors.black87),
              decoration: InputDecoration(
                hintText: "e.g., Explain photosynthesis...",
                hintStyle: GoogleFonts.inter(color: Colors.grey),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.grey.shade50,
              ),
            ),
            const SizedBox(height: 16),

            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("Grade Level",
                          style: GoogleFonts.inter(
                              fontWeight: FontWeight.w600,
                              color: Colors.black87)),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        initialValue: _selectedGrade,
                        items: _grades
                            .map((g) =>
                                DropdownMenuItem(value: g, child: Text(g)))
                            .toList(),
                        onChanged: (v) => setState(() => _selectedGrade = v!),
                        style: GoogleFonts.inter(color: Colors.black87),
                        dropdownColor: Colors.white,
                        decoration: InputDecoration(
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12)),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 8),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("Language",
                          style: GoogleFonts.inter(
                              fontWeight: FontWeight.w600,
                              color: Colors.black87)),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        initialValue: _selectedLanguage,
                        items: _languages
                            .map((l) =>
                                DropdownMenuItem(value: l, child: Text(l)))
                            .toList(),
                        onChanged: (v) =>
                            setState(() => _selectedLanguage = v!),
                        style: GoogleFonts.inter(color: Colors.black87),
                        dropdownColor: Colors.white,
                        decoration: InputDecoration(
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12)),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 8),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),

            ElevatedButton(
              onPressed: _isLoading ? null : _getAnswer,
              style: ElevatedButton.styleFrom(
                backgroundColor: theme.primary,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: _isLoading
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : Text("Get Answer",
                      style: GoogleFonts.inter(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.white)),
            ),

            const SizedBox(height: 32),

            // Result
            if (_answer != null)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4)),
                  ],
                  border: Border.all(color: Colors.grey.shade100),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.check_circle, color: Colors.green),
                        const SizedBox(width: 8),
                        Text("Answer",
                            style: GoogleFonts.outfit(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87)),
                      ],
                    ),
                    const Divider(height: 24),
                    Text(
                      _answer!,
                      style: GoogleFonts.inter(
                          fontSize: 16, height: 1.6, color: Colors.black87),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
