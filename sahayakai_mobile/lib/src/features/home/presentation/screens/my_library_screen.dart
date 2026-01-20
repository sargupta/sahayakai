import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import 'package:sahayakai_mobile/src/features/lesson_plan/presentation/providers/lesson_plan_provider.dart';
import 'package:sahayakai_mobile/src/features/lesson_plan/presentation/screens/lesson_result_screen.dart';

class MyLibraryScreen extends ConsumerWidget {
  const MyLibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(lessonHistoryProvider);

    return Container(
      decoration: const BoxDecoration(
        gradient: GlassColors.warmBackgroundGradient,
      ),
      child: DefaultTabController(
        length: 2,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(GlassSpacing.xl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Your Collection',
                    style: GlassTypography.decorativeLabel(),
                  ),
                  const SizedBox(height: GlassSpacing.xs),
                  Text(
                    'My Library',
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

            // Tab Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
              child: GlassCard(
                padding: const EdgeInsets.all(GlassSpacing.xs),
                child: TabBar(
                  labelColor: Colors.white,
                  unselectedLabelColor: GlassColors.textSecondary,
                  labelStyle: GlassTypography.labelMedium(),
                  unselectedLabelStyle: GlassTypography.labelMedium(),
                  indicator: BoxDecoration(
                    color: GlassColors.primary,
                    borderRadius: BorderRadius.circular(GlassRadius.sm),
                  ),
                  indicatorSize: TabBarIndicatorSize.tab,
                  dividerColor: Colors.transparent,
                  tabs: const [
                    Tab(text: "Lesson Plans"),
                    Tab(text: "Quizzes"),
                  ],
                ),
              ),
            ),
            const SizedBox(height: GlassSpacing.lg),

            // Tab Content
            Expanded(
              child: TabBarView(
                children: [
                  // 1. Lesson Plans Tab
                  historyAsync.when(
                    data: (plans) {
                      if (plans.isEmpty) {
                        return GlassEmptyState(
                          icon: Icons.menu_book_rounded,
                          title: 'No Lesson Plans Yet',
                          message: 'Create your first lesson plan to see it here.',
                        );
                      }
                      return ListView.builder(
                        padding: const EdgeInsets.symmetric(
                          horizontal: GlassSpacing.xl,
                        ),
                        itemCount: plans.length,
                        itemBuilder: (context, index) {
                          final plan = plans[index];
                          return Padding(
                            padding: const EdgeInsets.only(
                              bottom: GlassSpacing.md,
                            ),
                            child: GlassListItem(
                              icon: Icons.book_rounded,
                              iconColor: const Color(0xFFDC2626),
                              iconBackgroundColor: const Color(0xFFFEF2F2),
                              title: plan.title,
                              subtitle: '${plan.subject} • ${plan.gradeLevel}',
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (c) => LessonResultScreen(plan: plan),
                                  ),
                                );
                              },
                            ),
                          );
                        },
                      );
                    },
                    loading: () => Center(
                      child: GlassLoadingIndicator(message: 'Loading...'),
                    ),
                    error: (err, stack) => GlassEmptyState(
                      icon: Icons.error_outline_rounded,
                      title: 'Error Loading',
                      message: err.toString(),
                    ),
                  ),

                  // 2. Quizzes Tab
                  GlassEmptyState(
                    icon: Icons.extension_rounded,
                    title: 'No Quizzes Yet',
                    message: 'Create your first quiz to see it here.',
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
