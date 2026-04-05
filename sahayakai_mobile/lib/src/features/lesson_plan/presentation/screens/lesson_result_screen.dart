import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/services/pdf_generator_service.dart';
import '../../../../components/tts_play_button.dart';
import '../../../../components/save_to_library_button.dart';
import '../../../../components/share_to_community_button.dart';
import 'package:share_plus/share_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/services/metrics_service.dart';
import '../../domain/lesson_plan_models.dart';

class LessonResultScreen extends ConsumerWidget {
  final LessonPlanOutput plan;

  const LessonResultScreen({super.key, required this.plan});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Track lesson plan generated (fires each time screen builds for first time).
    MetricsService.trackEvent('lesson_plan_generated', properties: {
      'subject': plan.subject,
      'grade': plan.gradeLevel,
    });

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

    // Concise TTS text — just the essentials, not the full markdown.
    final ttsText = '${plan.title}. '
        'Objectives: ${plan.objectives.join(". ")}. '
        'Activities: ${plan.activities.map((a) => a.name).join(", ")}. '
        'Assessment: ${plan.assessment}';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Lesson Plan'),
        backgroundColor: const Color(0xFF16A34A),
        foregroundColor: Colors.white,
        actions: [
          // Save to library
          SaveToLibraryButton(
            type: 'lesson-plan',
            title: plan.title,
            data: {
              'title': plan.title,
              'subject': plan.subject,
              'gradeLevel': plan.gradeLevel,
              'duration': plan.duration,
              'objectives': plan.objectives,
              'materials': plan.materials,
              'activities': plan.activities
                  .map((a) => {
                        'name': a.name,
                        'description': a.description,
                        'duration': a.duration,
                      })
                  .toList(),
              'assessment': plan.assessment,
            },
            gradeLevel: plan.gradeLevel,
            subject: plan.subject,
          ),
          // TTS — always visible (primary action for teachers)
          TTSPlayButton(text: ttsText),
          // Overflow menu for secondary actions
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (action) async {
              switch (action) {
                case 'share':
                  Share.share(markdownContent);
                case 'pdf':
                  await PdfGeneratorService().generateLessonPlanPdf(plan);
              }
            },
            itemBuilder: (_) => [
              const PopupMenuItem(
                value: 'share',
                child: ListTile(
                  leading: Icon(Icons.share_rounded),
                  title: Text('Share'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              const PopupMenuItem(
                value: 'pdf',
                child: ListTile(
                  leading: Icon(Icons.picture_as_pdf_rounded),
                  title: Text('Export PDF'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              const PopupMenuItem(
                value: 'community',
                child: ListTile(
                  leading: Icon(Icons.people_rounded),
                  title: Text('Share to Community'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ],
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Lesson plan content
            MarkdownBody(data: markdownContent),
            const SizedBox(height: 16),

            // Share to Community CTA
            ShareToCommunityButton(
              type: 'lesson-plan',
              title: plan.title,
              data: {
                'title': plan.title,
                'subject': plan.subject,
                'gradeLevel': plan.gradeLevel,
                'duration': plan.duration,
                'objectives': plan.objectives,
                'materials': plan.materials,
                'activities': plan.activities
                    .map((a) => {
                          'name': a.name,
                          'description': a.description,
                          'duration': a.duration,
                        })
                    .toList(),
                'assessment': plan.assessment,
              },
              gradeLevel: plan.gradeLevel,
              subject: plan.subject,
            ),
            const SizedBox(height: 24),

            // Related Actions — cross-feature navigation
            Text('Next Steps',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    )),
            const SizedBox(height: 12),
            _RelatedActionTile(
              icon: Icons.extension_rounded,
              label: 'Create Quiz on "${plan.title}"',
              onTap: () => context.push('/quiz-config', extra: {
                'topic': plan.title,
                'gradeLevel': plan.gradeLevel,
                'subject': plan.subject,
              }),
            ),
            const SizedBox(height: 8),
            _RelatedActionTile(
              icon: Icons.assignment_rounded,
              label: 'Generate Worksheet',
              onTap: () => context.push('/worksheet-wizard', extra: {
                'topic': plan.title,
              }),
            ),
            const SizedBox(height: 8),
            _RelatedActionTile(
              icon: Icons.grading_rounded,
              label: 'Build Assessment Rubric',
              onTap: () => context.push('/rubric-generator', extra: {
                'assignmentDescription': 'Assessment for ${plan.title}',
              }),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _RelatedActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _RelatedActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: ListTile(
        dense: true,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: Colors.grey.shade300),
        ),
        leading: Icon(icon, color: const Color(0xFFFF9933)),
        title: Text(label, style: const TextStyle(fontSize: 14)),
        trailing: const Icon(Icons.arrow_forward_ios, size: 14),
        onTap: onTap,
      ),
    );
  }
}
