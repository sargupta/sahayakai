import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';

class TrainingModule {
  final String title;
  final String duration;
  final String instructor;
  final String description;
  final double progress;
  final Color color;
  final IconData icon;

  TrainingModule({
    required this.title,
    required this.duration,
    required this.instructor,
    required this.description,
    this.progress = 0.0,
    required this.color,
    this.icon = Icons.school_rounded,
  });
}

class TeacherTrainingScreen extends ConsumerStatefulWidget {
  const TeacherTrainingScreen({super.key});

  @override
  ConsumerState<TeacherTrainingScreen> createState() =>
      _TeacherTrainingScreenState();
}

class _TeacherTrainingScreenState extends ConsumerState<TeacherTrainingScreen> {
  final List<TrainingModule> _modules = [
    TrainingModule(
      title: "AI in the Classroom",
      duration: "45 mins",
      instructor: "Dr. A. Rao",
      description:
          "Learn how to use SahayakAI to automate lesson planning and quizzes.",
      progress: 0.7,
      color: const Color(0xFF2563EB),
      icon: Icons.auto_awesome_rounded,
    ),
    TrainingModule(
      title: "Classroom Management",
      duration: "30 mins",
      instructor: "Sarah Jenkins",
      description:
          "Effective strategies for large, diverse classrooms in India.",
      progress: 0.0,
      color: GlassColors.primary,
      icon: Icons.groups_rounded,
    ),
    TrainingModule(
      title: "Inclusive Education",
      duration: "60 mins",
      instructor: "N. Gupta",
      description:
          "Techniques to ensure every student feels included and valued.",
      progress: 0.2,
      color: const Color(0xFF7C3AED),
      icon: Icons.diversity_3_rounded,
    ),
    TrainingModule(
      title: "Digital Assessment",
      duration: "40 mins",
      instructor: "Tech Team",
      description:
          "Mastering digital tools for quick and accurate student assessment.",
      progress: 0.0,
      color: const Color(0xFF0D9488),
      icon: Icons.assessment_rounded,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'Teacher Academy',
      showBackButton: true,
      actions: [GlassMenuButton(onPressed: () {})],
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(GlassSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Decorative Header
            Text(
              'Continuous Learning...',
              style: GlassTypography.decorativeLabel(),
            ),
            const SizedBox(height: GlassSpacing.xs),
            Text(
              'Grow as a Teacher',
              style: GlassTypography.headline1(),
            ),
            const SizedBox(height: GlassSpacing.sm),
            Container(
              width: 60,
              height: 2,
              color: GlassColors.textTertiary.withOpacity(0.3),
            ),
            const SizedBox(height: GlassSpacing.xxl),

            // Hero Card - Continue Learning
            _buildHeroCard(),
            const SizedBox(height: GlassSpacing.xxl),

            // Available Modules
            Text(
              'AVAILABLE MODULES',
              style: GlassTypography.sectionHeader(),
            ),
            const SizedBox(height: GlassSpacing.lg),
            
            ..._modules.map((m) => _buildModuleCard(context, m)),
          ],
        ),
      ),
    );
  }

  Widget _buildHeroCard() {
    final activeModule = _modules.first;
    return Container(
      padding: const EdgeInsets.all(GlassSpacing.xl),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            activeModule.color,
            activeModule.color.withOpacity(0.8),
          ],
        ),
        borderRadius: BorderRadius.circular(GlassRadius.xl),
        boxShadow: [
          BoxShadow(
            color: activeModule.color.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: GlassSpacing.md,
                  vertical: GlassSpacing.xs,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(GlassRadius.pill),
                ),
                child: Text(
                  'CONTINUE LEARNING',
                  style: GlassTypography.labelSmall(color: Colors.white),
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.play_arrow_rounded,
                  color: Colors.white,
                  size: 24,
                ),
              ),
            ],
          ),
          const SizedBox(height: GlassSpacing.xl),
          Text(
            activeModule.title,
            style: GlassTypography.headline1(color: Colors.white),
          ),
          const SizedBox(height: GlassSpacing.sm),
          Text(
            'Instructor: ${activeModule.instructor}',
            style: GlassTypography.bodyMedium(
              color: Colors.white.withOpacity(0.8),
            ),
          ),
          const SizedBox(height: GlassSpacing.xl),
          ClipRRect(
            borderRadius: BorderRadius.circular(GlassRadius.xs),
            child: LinearProgressIndicator(
              value: activeModule.progress,
              backgroundColor: Colors.white.withOpacity(0.2),
              valueColor: const AlwaysStoppedAnimation(Colors.white),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: GlassSpacing.sm),
          Text(
            '${(activeModule.progress * 100).toInt()}% Completed',
            style: GlassTypography.labelSmall(
              color: Colors.white.withOpacity(0.8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModuleCard(BuildContext context, TrainingModule module) {
    return Padding(
      padding: const EdgeInsets.only(bottom: GlassSpacing.lg),
      child: GlassCard(
        onTap: () => _showModuleDetail(context, module),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: module.color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(GlassRadius.md),
              ),
              child: Icon(module.icon, color: module.color, size: 24),
            ),
            const SizedBox(width: GlassSpacing.lg),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(module.title, style: GlassTypography.labelLarge()),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(
                        Icons.schedule_rounded,
                        size: 14,
                        color: GlassColors.textTertiary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        module.duration,
                        style: GlassTypography.bodySmall(),
                      ),
                      const SizedBox(width: GlassSpacing.lg),
                      const Icon(
                        Icons.person_outline_rounded,
                        size: 14,
                        color: GlassColors.textTertiary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        module.instructor,
                        style: GlassTypography.bodySmall(),
                      ),
                    ],
                  ),
                  if (module.progress > 0) ...[
                    const SizedBox(height: GlassSpacing.sm),
                    Row(
                      children: [
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(2),
                            child: LinearProgressIndicator(
                              value: module.progress,
                              backgroundColor: module.color.withOpacity(0.1),
                              valueColor: AlwaysStoppedAnimation(module.color),
                              minHeight: 4,
                            ),
                          ),
                        ),
                        const SizedBox(width: GlassSpacing.sm),
                        Text(
                          '${(module.progress * 100).toInt()}%',
                          style: GlassTypography.labelSmall(color: module.color),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const Icon(
              Icons.arrow_forward_ios_rounded,
              size: 16,
              color: GlassColors.textTertiary,
            ),
          ],
        ),
      ),
    );
  }

  void _showModuleDetail(BuildContext context, TrainingModule module) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.85,
        decoration: const BoxDecoration(
          gradient: GlassColors.warmBackgroundGradient,
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(GlassRadius.xl),
          ),
        ),
        padding: const EdgeInsets.all(GlassSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: GlassColors.textTertiary.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: GlassSpacing.xxl),
            
            // Icon
            Center(
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: module.color.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(module.icon, size: 48, color: module.color),
              ),
            ),
            const SizedBox(height: GlassSpacing.xl),
            
            // Title
            Text(
              module.title,
              textAlign: TextAlign.center,
              style: GlassTypography.headline1(),
            ),
            const SizedBox(height: GlassSpacing.sm),
            Text(
              'by ${module.instructor}',
              textAlign: TextAlign.center,
              style: GlassTypography.bodyMedium(color: GlassColors.textSecondary),
            ),
            const SizedBox(height: GlassSpacing.xxl),
            
            // About Section
            GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'ABOUT THIS COURSE',
                    style: GlassTypography.sectionHeader(),
                  ),
                  const SizedBox(height: GlassSpacing.md),
                  Text(
                    module.description,
                    style: GlassTypography.bodyLarge().copyWith(height: 1.6),
                  ),
                  const SizedBox(height: GlassSpacing.lg),
                  Row(
                    children: [
                      _buildInfoChip(Icons.schedule_rounded, module.duration),
                      const SizedBox(width: GlassSpacing.md),
                      _buildInfoChip(Icons.video_library_rounded, '8 lessons'),
                    ],
                  ),
                ],
              ),
            ),
            
            const Spacer(),
            
            // Start Button
            GlassPrimaryButton(
              label: module.progress > 0 ? 'Continue Learning' : 'Start Lesson',
              icon: Icons.play_arrow_rounded,
              onPressed: () => Navigator.pop(context),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: GlassSpacing.md,
        vertical: GlassSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: GlassColors.inputBackground,
        borderRadius: BorderRadius.circular(GlassRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: GlassColors.textSecondary),
          const SizedBox(width: 6),
          Text(label, style: GlassTypography.labelSmall()),
        ],
      ),
    );
  }
}
