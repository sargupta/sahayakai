import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/theme/app_theme.dart';
import 'package:sahayakai_mobile/src/features/lesson_plan/presentation/providers/lesson_plan_provider.dart';
import 'package:sahayakai_mobile/src/features/lesson_plan/presentation/screens/lesson_result_screen.dart';

class MyLibraryScreen extends ConsumerWidget {
  const MyLibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(lessonHistoryProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text("My Library"),
      ),
      body: DefaultTabController(
        length: 2,
        child: Column(
          children: [
            const TabBar(
              labelColor: AppColors.primary,
              unselectedLabelColor: Colors.grey,
              indicatorColor: AppColors.primary,
              tabs: [
                Tab(text: "Lesson Plans"),
                Tab(text: "Quizzes"),
              ],
            ),
            Expanded(
              child: TabBarView(
                children: [
                  // 1. Lesson Plans Tab
                  historyAsync.when(
                    data: (plans) {
                      if (plans.isEmpty) {
                        return Center(child: Text("No plans yet. Create one!", style: GoogleFonts.inter()));
                      }
                      return ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: plans.length,
                        itemBuilder: (context, index) {
                          final plan = plans[index];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: ListTile(
                              contentPadding: const EdgeInsets.all(12),
                              leading: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), shape: BoxShape.circle),
                                child: const Icon(Icons.book, color: AppColors.primary),
                              ),
                              title: Text(plan.title, style: const TextStyle(fontWeight: FontWeight.bold)),
                              subtitle: Text("${plan.subject} • ${plan.gradeLevel}"),
                              trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                              onTap: () {
                                Navigator.push(context, MaterialPageRoute(builder: (c) => LessonResultScreen(plan: plan)));
                              },
                            ),
                          );
                        },
                      );
                    },
                    loading: () => const Center(child: CircularProgressIndicator()),
                    error: (err, stack) => Center(child: Text('Error: $err')),
                  ),

                  // 2. Quizzes Tab (Placeholder)
                  Center(child: Text("No quizzes saved yet.", style: GoogleFonts.inter())),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
