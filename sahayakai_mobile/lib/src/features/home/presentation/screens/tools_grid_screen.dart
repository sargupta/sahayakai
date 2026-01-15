import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';

class ToolsGridScreen extends StatelessWidget {
  const ToolsGridScreen({super.key});

  final List<Map<String, dynamic>> _tools = const [
    {'title': 'Lesson Planner', 'icon': Icons.edit_note, 'color': Colors.blue, 'route': '/create-lesson'},
    {'title': 'Quiz Generator', 'icon': Icons.quiz, 'color': Colors.orange, 'route': '/quiz-config'},
    {'title': 'Worksheet Wizard', 'icon': Icons.assignment, 'color': Colors.green, 'route': '/worksheet-wizard'},
    {'title': 'Rubric Maker', 'icon': Icons.grid_on, 'color': Colors.purple, 'route': '/rubric-generator'},
    {'title': 'Visual Aid', 'icon': Icons.image, 'color': Colors.pink, 'route': '/visual-aid-creator'},
    {'title': 'Instant Answer', 'icon': Icons.flash_on, 'color': Colors.amber, 'route': '/instant-answer'},
    {'title': 'Video Story', 'icon': Icons.video_camera_back, 'color': Colors.red, 'route': '/video-storyteller'},
    {'title': 'Field Trip', 'icon': Icons.public, 'color': Colors.teal, 'route': '/virtual-field-trip'},
    {'title': 'Content Creator', 'icon': Icons.create, 'color': Colors.indigo, 'route': '/content-creator'},
    {'title': 'Training', 'icon': Icons.school, 'color': Colors.brown, 'route': '/teacher-training'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("AI Tools", style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.black)),
        backgroundColor: Colors.white,
        elevation: 0,
        automaticallyImplyLeading: false, // Hide back button if on bottom nav
      ),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          childAspectRatio: 1.1,
        ),
        itemCount: _tools.length,
        itemBuilder: (context, index) {
          final tool = _tools[index];
          return Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () {
                // Handle navigation logic here (GoRouter or Navigator)
                try {
                  context.push(tool['route']);
                } catch (e) {
                   Navigator.of(context).pushNamed(tool['route']);
                }
              },
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: (tool['color'] as Color).withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(tool['icon'], size: 32, color: tool['color']),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    tool['title'],
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
