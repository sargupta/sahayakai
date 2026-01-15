import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import '../../../../core/services/pdf_generator_service.dart';
import 'package:share_plus/share_plus.dart';
import 'package:share_plus/share_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/lesson_plan_models.dart';

class LessonResultScreen extends ConsumerWidget {
  final LessonPlanOutput plan;

  const LessonResultScreen({super.key, required this.plan});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Combine fields into a single markdown string for display
    final markdownContent = '''
# ${plan.title}
**Subject:** ${plan.subject} | **Grade:** ${plan.gradeLevel} | **Duration:** ${plan.duration}

## Objectives
${plan.objectives.map((o) => "- $o").join('\n')}

## Materials
${plan.materials.map((m) => "- $m").join('\n')}

## Activities
${plan.activities.map((a) => "### ${a.name} (${a.duration})\n${a.description}").join('\n\n')}

## Assessment
${plan.assessment}
''';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Lesson Plan'),
        backgroundColor: const Color(0xFF16A34A),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.share),
            onPressed: () {
               Share.share(markdownContent);
            },
          ),
          IconButton(
            icon: const Icon(Icons.picture_as_pdf),
            onPressed: () async {
              await PdfGeneratorService().generateLessonPlanPdf(plan); // Changed lessonPlan to plan
            },
          ),
        ],
      ),
      body: Markdown(
        data: markdownContent,
        padding: const EdgeInsets.all(16.0),
      ),
    );
  }
}
