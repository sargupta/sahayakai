import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/glassmorphic/glass_components.dart';

class ToolsGridScreen extends StatelessWidget {
  const ToolsGridScreen({super.key});

  static const List<Map<String, dynamic>> _tools = [
    {
      'title': 'Lesson Planner',
      'icon': Icons.edit_note_rounded,
      'route': '/create-lesson'
    },
    {
      'title': 'Quiz Generator',
      'icon': Icons.extension_rounded,
      'route': '/quiz-config'
    },
    {
      'title': 'Worksheet Wizard',
      'icon': Icons.assignment_rounded,
      'route': '/worksheet-wizard'
    },
    {
      'title': 'Rubric Maker',
      'icon': Icons.grid_on_rounded,
      'route': '/rubric-generator'
    },
    {
      'title': 'Visual Aid',
      'icon': Icons.image_rounded,
      'route': '/visual-aid-creator'
    },
    {
      'title': 'Instant Answer',
      'icon': Icons.flash_on_rounded,
      'route': '/instant-answer'
    },
    {
      'title': 'Video Story',
      'icon': Icons.video_camera_back_rounded,
      'route': '/video-storyteller'
    },
    {
      'title': 'Field Trip',
      'icon': Icons.public_rounded,
      'route': '/virtual-field-trip'
    },
    {
      'title': 'Content Creator',
      'icon': Icons.create_rounded,
      'route': '/content-creator'
    },
    {
      'title': 'Training',
      'icon': Icons.school_rounded,
      'route': '/teacher-training'
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Background Image
        Positioned.fill(
          child: Image.asset(
            'assets/images/app_background.png',
            fit: BoxFit.cover,
          ),
        ),
        // Content
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(GlassSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your Creative Studio',
                  style: GlassTypography.decorativeLabel(),
                ),
                const SizedBox(height: GlassSpacing.xs),
                Text(
                  'AI Tools',
                  style: GlassTypography.headline1(),
                ),
                const SizedBox(height: GlassSpacing.sm),
                Container(
                  width: 60,
                  height: 2,
                  color: GlassColors.textTertiary.withOpacity(0.3),
                ),
              ],
            ),
          ),
          
          // Grid
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.symmetric(
                horizontal: GlassSpacing.xl,
                vertical: GlassSpacing.sm,
              ),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: GlassSpacing.lg,
                mainAxisSpacing: GlassSpacing.lg,
                childAspectRatio: 1.0,
              ),
              itemCount: _tools.length,
              itemBuilder: (context, index) {
                final tool = _tools[index];
                return GlassToolCard(
                  title: tool['title'],
                  icon: tool['icon'],
                  // Using default orange iconColor from GlassColors.primary
                  height: double.infinity,
                  onTap: () {
                    try {
                      context.push(tool['route']);
                    } catch (e) {
                      Navigator.of(context).pushNamed(tool['route']);
                    }
                  },
                );
              },
            ),
          ),
        ],
      ),
      ],
    );
  }
}
