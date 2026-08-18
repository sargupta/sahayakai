import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/assessment_scanner/presentation/widgets/assessment_scanner_result_view.dart';
import 'package:sahayakai/features/parent_message/presentation/widgets/parent_message_result_view.dart';
import 'package:sahayakai/features/quiz_generator/domain/quiz.dart';
import 'package:sahayakai/features/quiz_generator/presentation/widgets/quiz_result_view.dart';
import 'package:sahayakai/features/video_storyteller/presentation/widgets/video_storyteller_result_view.dart';
import 'package:sahayakai/features/visual_aid/presentation/widgets/visual_aid_result_view.dart';

import 'assessment_scanner/assessment_scanner_fixtures.dart' as scanner;
import 'parent_message/parent_message_fixtures.dart' as parent;
import 'quiz_generator/quiz_fixtures.dart' as quiz;
import 'video_storyteller/video_storyteller_fixtures.dart' as video;
import 'visual_aid/visual_aid_fixtures.dart' as aid;

/// The rollout's judgement calls, gated where they can actually regress: WHICH
/// result views offer "Save to Library" and which deliberately do not.
///
/// These are not cosmetic assertions. Every omission below is a case where a
/// Save button would post a body `POST /api/content/save` REJECTS — its `type`
/// is validated against the closed `ContentTypeSchema` enum in
/// `sahayakai-main/src/ai/schemas/content-schemas.ts`, which has no member for a
/// parent message or a video shelf, and whose `assessment-submission` (what the
/// scanner's own backend writes) is likewise absent — or, for the visual aid, a
/// re-upload of an image the generation flow already stored, which comes back
/// from the Library with no pixels at all. A well-meaning "make it consistent"
/// change that adds Save to any of these ships a button that fails; this test is
/// what tells the next person that the gap is the design.
void main() {
  const saveLabel = 'Save to Library';

  group('Save is offered where the result is genuinely saveable', () {
    testWidgets('quiz: with a request and a verbatim payload behind it', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 3000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        quiz.hostResult(
          QuizResultView(
            quiz: _saveableQuiz(),
            onRegenerate: () {},
            saveRequest: const QuizRequest(
              topic: 'Fractions',
              questionTypes: <QuestionType>[QuestionType.multipleChoice],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text(saveLabel), findsOneWidget);
    });

    testWidgets('quiz: withheld when no request produced the result', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 3000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        quiz.hostResult(
          QuizResultView(quiz: _saveableQuiz(), onRegenerate: () {}),
        ),
      );
      await tester.pumpAndSettle();

      // No topic/grade/language to build the save body from, so no button that
      // would file a half-empty row. Copy and Share still work.
      expect(find.text(saveLabel), findsNothing);
      expect(find.text('Copy'), findsOneWidget);
      expect(find.text('Share'), findsOneWidget);
    });

    testWidgets('quiz: withheld when the result carries no verbatim payload', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 3000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        quiz.hostResult(
          QuizResultView(
            // A Library item re-rendered read-only has no `raw` to persist.
            quiz: quiz.buildQuiz(),
            onRegenerate: () {},
            saveRequest: const QuizRequest(
              topic: 'Fractions',
              questionTypes: <QuestionType>[QuestionType.multipleChoice],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text(saveLabel), findsNothing);
    });
  });

  group('Save is deliberately absent where it cannot honestly work', () {
    testWidgets('parent message: no content type accepts a note home', (
      tester,
    ) async {
      await tester.pumpWidget(
        parent.hostResult(
          ParentMessageResultView(
            message: parent.buildMessage(),
            onRegenerate: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text(saveLabel), findsNothing);
      expect(find.text('Copy'), findsOneWidget);
      expect(find.text('Share'), findsOneWidget);
    });

    testWidgets('visual aid: the drawing cannot be re-saved usefully', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        aid.hostResult(
          VisualAidResultView(
            aid: aid.buildVisualAid(),
            prompt: 'The water cycle',
            onRegenerate: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text(saveLabel), findsNothing);
      expect(find.text('Copy'), findsOneWidget);
      expect(find.text('Share'), findsOneWidget);
    });

    testWidgets('assessment scanner: its own type is not in the save enum', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 4000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        scanner.hostResult(
          AssessmentScannerResultView(
            result: scanner.buildResult(),
            onRegenerate: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text(saveLabel), findsNothing);
      expect(find.text('Copy'), findsOneWidget);
      expect(find.text('Share'), findsOneWidget);
    });

    testWidgets('video storyteller: a shelf of third-party links', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 6000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        video.hostResult(
          VideoStorytellerResultView(
            recommendations: video.buildRecommendations(),
          ),
          linkOpener: video.FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text(saveLabel), findsNothing);
      // Copy and Share still close the dead end: the links can be forwarded.
      expect(find.text('Copy'), findsOneWidget);
      expect(find.text('Share'), findsOneWidget);
    });
  });
}

/// A quiz as a live generation leaves it: rendered content PLUS the verbatim
/// server body a save would persist.
Quiz _saveableQuiz() {
  final base = quiz.buildQuiz(onlyMedium: true);
  return Quiz(
    variants: base.variants,
    gradeLevel: base.gradeLevel,
    subject: base.subject,
    topic: base.topic,
    raw: const <String, dynamic>{'medium': <String, dynamic>{}},
  );
}
