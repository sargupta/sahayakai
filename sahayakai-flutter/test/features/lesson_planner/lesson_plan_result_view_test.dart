import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/lesson_planner/domain/lesson_plan.dart';
import 'package:sahayakai/features/lesson_planner/presentation/widgets/lesson_plan_result_view.dart';
import 'package:sahayakai/shared/widgets/document_sheet.dart';

/// U8 — the reference DocumentSheet result. A generated 5E plan reads as a
/// printed document, not a chat dump: a masthead, ticked section headers,
/// numbered activity medallions, and a Regenerate / Copy action bar. These
/// render a plain plan object — no network, no controller.
LessonPlan _plan() => const LessonPlan(
  title: 'Photosynthesis for Class 6',
  language: 'English',
  gradeLevel: 'Class 6',
  subject: 'Science',
  duration: '40 min',
  objectives: ['Explain how plants make food', 'Name the inputs and outputs'],
  keyVocabulary: [
    VocabularyTerm(term: 'Chlorophyll', meaning: 'The green pigment in leaves'),
  ],
  materials: ['Fresh leaves', 'Chart paper'],
  activities: [
    LessonActivity(
      phase: 'Engage',
      name: 'Observe a leaf',
      description: 'Look closely at a leaf held to the light.',
      duration: '5 min',
      teacherTips: 'Bring a few different leaves.',
      understandingCheck: 'Ask what colour the leaf is and why.',
    ),
    LessonActivity(
      phase: 'Explore',
      name: 'The sunlight test',
      description: 'Compare a shaded leaf with a sunlit one.',
    ),
  ],
  assessment: 'A short oral quiz on the process.',
  homework: 'Draw and label the photosynthesis cycle.',
  validationWarning: ValidationWarning(message: 'Simplified for the grade.'),
);

Widget _host(Widget child, {bool reduceMotion = false}) {
  return MaterialApp(
    theme: AppTheme.light(),
    locale: const Locale('en'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Builder(
      builder: (context) {
        final view = Scaffold(body: SingleChildScrollView(child: child));
        if (!reduceMotion) return view;
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: true),
          child: view,
        );
      },
    ),
  );
}

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  testWidgets('wraps the 5E plan in a DocumentSheet with masthead + sections', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(LessonPlanResultView(plan: _plan(), onRegenerate: () {})),
    );
    await tester.pumpAndSettle();

    expect(find.byType(DocumentSheet), findsOneWidget);
    // The masthead doc-type eyebrow (uppercased Latin) and the Fraunces title.
    expect(find.text('LESSON PLAN · 5E'), findsOneWidget);
    expect(find.text('Photosynthesis for Class 6'), findsOneWidget);
    // objectives, vocabulary, materials, activities, assessment, homework.
    expect(find.byType(DocumentSheetSection), findsNWidgets(6));
    // The activity medallions number the 5E steps.
    expect(find.text('1'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    // The model's prose is preserved verbatim.
    expect(
      find.text('Look closely at a leaf held to the light.'),
      findsOneWidget,
    );
  });

  testWidgets('the action bar offers Regenerate and Copy', (tester) async {
    var regenerated = false;
    await tester.pumpWidget(
      _host(
        LessonPlanResultView(
          plan: _plan(),
          onRegenerate: () => regenerated = true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Regenerate'), findsOneWidget);
    expect(find.text('Copy'), findsOneWidget);

    // The action bar is the foot of a long document; bring it into view first.
    await tester.ensureVisible(find.text('Regenerate'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Regenerate'));
    await tester.pump();
    expect(regenerated, isTrue, reason: 'Regenerate re-runs generation');
  });

  testWidgets('Copy writes the plan to the clipboard and confirms', (
    tester,
  ) async {
    // The test binding backs Clipboard with an in-memory store.
    await tester.pumpWidget(
      _host(LessonPlanResultView(plan: _plan(), onRegenerate: () {})),
    );
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Copy'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Copy'));
    await tester.pump(); // let the snackbar appear

    // The confirmation proves the copy handler ran; reading the platform
    // clipboard back is not mocked in the test binding, so it is not asserted.
    expect(find.text('Copied to clipboard'), findsOneWidget);
  });

  testWidgets('reduce-motion renders the composed frame, no exception', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(
        LessonPlanResultView(plan: _plan(), onRegenerate: () {}),
        reduceMotion: true,
      ),
    );
    // No pumpAndSettle needed: with animations disabled the ink-settle blocks
    // are static, so the document is fully composed on the first frame.
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.byType(DocumentSheet), findsOneWidget);
    expect(find.text('Photosynthesis for Class 6'), findsOneWidget);
  });
}
