import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/theme/app_theme.dart';

class SubmitContentScreen extends StatefulWidget {
  const SubmitContentScreen({super.key});

  @override
  State<SubmitContentScreen> createState() => _SubmitContentScreenState();
}

class _SubmitContentScreenState extends State<SubmitContentScreen> {
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  String _selectedCategory = "Lesson Plan";
  String _selectedLanguage = "English";
  bool _isUploading = false;
  String? _attachedFile;

  final List<String> _categories = ["Lesson Plan", "Quiz", "Worksheet", "Rubric", "Visual Aid"];
  final List<String> _languages = ["English", "Hindi", "Tamil", "Other"];

  Future<void> _submit() async {
    if (_titleController.text.isEmpty) return;

    setState(() => _isUploading = true);
    // Simulate upload
    await Future.delayed(const Duration(seconds: 2));

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Submitted successfully! Pending review."),
          backgroundColor: Colors.green,
        )
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Submit Resource", style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.black)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              "Share with the Community",
              style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              "Contribute your best teaching materials to help other teachers across India.",
              style: GoogleFonts.inter(fontSize: 14, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 32),

            // Form
            _buildLabel("Title"),
            TextField(
              controller: _titleController,
              decoration: _inputDecoration("e.g., Solar System Interactive Lesson"),
            ),
            const SizedBox(height: 20),

            _buildLabel("Description"),
            TextField(
              controller: _descriptionController,
              maxLines: 3,
              decoration: _inputDecoration("Briefly describe your resource..."),
            ),
            const SizedBox(height: 20),

            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildLabel("Category"),
                      DropdownButtonFormField<String>(
                        value: _selectedCategory,
                        items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                        onChanged: (v) => setState(() => _selectedCategory = v!),
                        decoration: _inputDecoration(""),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildLabel("Language"),
                      DropdownButtonFormField<String>(
                        value: _selectedLanguage,
                        items: _languages.map((l) => DropdownMenuItem(value: l, child: Text(l))).toList(),
                        onChanged: (v) => setState(() => _selectedLanguage = v!),
                        decoration: _inputDecoration(""),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),

            // File Attachment
            InkWell(
              onTap: () async {
                setState(() => _attachedFile = "solar_system_lesson.pdf (Mock)");
              },
              child: Container(
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  border: Border.all(color: Colors.grey.shade300, style: BorderStyle.solid),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  children: [
                     Icon(
                       _attachedFile != null ? Icons.check_circle : Icons.cloud_upload_outlined,
                       size: 48,
                       color: _attachedFile != null ? Colors.green : Colors.grey,
                     ),
                     const SizedBox(height: 12),
                     Text(
                       _attachedFile ?? "Tap to Upload File (PDF, DOCX)",
                       style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: Colors.grey.shade700),
                     ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),

            ElevatedButton(
              onPressed: _isUploading ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isUploading
                  ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Text("Submit for Review", style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }

  Widget _buildLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(label, style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.black87)),
    );
  }
}
