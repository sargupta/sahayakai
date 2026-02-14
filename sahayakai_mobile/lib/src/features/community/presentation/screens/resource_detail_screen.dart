import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/theme/app_theme.dart';

class ResourceDetailScreen extends StatelessWidget {
  final Map<String, dynamic> resource; // Passing mock map for simplicity

  const ResourceDetailScreen({super.key, required this.resource});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(resource['title'] ?? 'Resource Detail')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Card
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 8, offset: Offset(0, 4))],
              ),
              child: Column(
                children: [
                  Icon(Icons.description, size: 64, color: AppColors.primary.withOpacity(0.8)),
                  const SizedBox(height: 16),
                  Text(
                    resource['title'] ?? "Untitled Resource",
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    "By ${resource['author'] ?? 'Unknown'} • ${resource['type'] ?? 'General'}",
                    style: GoogleFonts.inter(color: Colors.grey),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Details
            Text("Description", style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 8),
            Text(
              "This is a detailed description of the resource. It explains how to use it in the classroom, the target grade level, and the expected learning outcomes.",
              style: GoogleFonts.inter(height: 1.6, color: Colors.grey.shade800),
            ),
            const SizedBox(height: 24),

            // Metadata Grid
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              childAspectRatio: 2.5,
              children: [
                _buildMeta("Grade Level", "Grade 6-8"),
                _buildMeta("Language", "English"),
                _buildMeta("Subject", "Science"),
                _buildMeta("Format", "PDF"),
              ],
            ),
            const SizedBox(height: 32),

            // Actions
            SizedBox(
              height: 50,
              child: ElevatedButton.icon(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Downloading...")));
                },
                icon: const Icon(Icons.download),
                label: const Text("Download Resource"),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMeta(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.inter(color: Colors.grey, fontSize: 12)),
        const SizedBox(height: 4),
        Text(value, style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 15)),
      ],
    );
  }
}
