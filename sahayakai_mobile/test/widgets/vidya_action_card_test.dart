import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/features/vidya/domain/vidya_models.dart';
import 'package:sahayakai_mobile/src/features/vidya/presentation/widgets/vidya_action_card.dart';
import '../helpers/test_utils.dart';

void main() {
  VidyaAction makeAction({
    required String flow,
    String label = 'Test Action',
    Map<String, dynamic> params = const {},
  }) {
    return VidyaAction(
      type: 'NAVIGATE_AND_FILL',
      flow: flow,
      label: label,
      params: params,
    );
  }

  group('VidyaActionCard', () {
    testWidgets('renders label text', (tester) async {
      await pumpTestApp(
        tester,
        VidyaActionCard(
          action: makeAction(flow: 'lesson-plan', label: 'Create Lesson Plan'),
        ),
      );

      expect(find.text('Create Lesson Plan'), findsOneWidget);
    });

    testWidgets('renders topic text when present in params', (tester) async {
      await pumpTestApp(
        tester,
        VidyaActionCard(
          action: makeAction(
            flow: 'lesson-plan',
            label: 'Create Lesson Plan',
            params: {'topic': 'Photosynthesis'},
          ),
        ),
      );

      expect(find.text('Photosynthesis'), findsOneWidget);
    });

    testWidgets('does not render topic text when absent', (tester) async {
      await pumpTestApp(
        tester,
        VidyaActionCard(
          action: makeAction(flow: 'lesson-plan', label: 'Create Lesson Plan'),
        ),
      );

      // Only the label should be present, no topic subtitle.
      expect(find.text('Create Lesson Plan'), findsOneWidget);
      // The forward arrow icon should be present.
      expect(find.byIcon(Icons.arrow_forward_rounded), findsOneWidget);
    });

    testWidgets('renders forward arrow icon', (tester) async {
      await pumpTestApp(
        tester,
        VidyaActionCard(
          action: makeAction(flow: 'lesson-plan'),
        ),
      );

      expect(find.byIcon(Icons.arrow_forward_rounded), findsOneWidget);
    });

    // ── Icon-per-flow tests ──────────────────────────────────────────────

    group('_iconForFlow renders correct icon', () {
      final flowIconMap = <String, IconData>{
        'lesson-plan': Icons.book_rounded,
        'quiz-generator': Icons.extension_rounded,
        'worksheet-wizard': Icons.assignment_rounded,
        'visual-aid-designer': Icons.image_rounded,
        'rubric-generator': Icons.grading_rounded,
        'exam-paper': Icons.description_rounded,
      };

      for (final entry in flowIconMap.entries) {
        testWidgets('flow "${entry.key}" shows ${entry.value}',
            (tester) async {
          await pumpTestApp(
            tester,
            VidyaActionCard(
              action: makeAction(flow: entry.key),
            ),
          );

          expect(find.byIcon(entry.value), findsOneWidget);
        });
      }

      testWidgets('unknown flow shows auto_awesome_rounded (default)',
          (tester) async {
        await pumpTestApp(
          tester,
          VidyaActionCard(
            action: makeAction(flow: 'unknown-flow'),
          ),
        );

        expect(find.byIcon(Icons.auto_awesome_rounded), findsOneWidget);
      });

      testWidgets('empty flow string shows default icon', (tester) async {
        await pumpTestApp(
          tester,
          VidyaActionCard(
            action: makeAction(flow: ''),
          ),
        );

        expect(find.byIcon(Icons.auto_awesome_rounded), findsOneWidget);
      });
    });
  });
}
