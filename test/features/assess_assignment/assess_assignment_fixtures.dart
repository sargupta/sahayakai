import 'package:flutter/material.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/assess_assignment/domain/assessment.dart';

// The image-picker fake, sample bytes and oversized-image builder are shared
// with the image-input suite, so they live once in the media fixtures.
export '../../shared/media/image_input_fixtures.dart'
    show FakeImagePickerService, kTinyPng, tinyRaw, tinyPicked, oversizedRaw;

/// Shared fixtures for the Assess Assignment suites. Not a `_test.dart` file, so
/// the runner ignores it.

/// The DESIGN_RUBRIC §11 Indic probe strings (Bengali, Tamil, Malayalam). Every
/// prose slot carries one so a clipped matra or a missing wrap shows up as a
/// real overflow, not a silent regression.
const String kBn = 'শিক্ষকদের জন্য কৃত্রিম বুদ্ধিমত্তা সহায়ক প্রশ্ন';
const String kTa = 'ஆசிரியர்களுக்கான செயற்கை நுண்ணறிவு உதவியாளர்';
const String kMl = 'അധ്യാപകർക്കുള്ള നിർമ്മിത ബുദ്ധി സഹായി';

/// A deliberately unbreakable compound word: DESIGN_RUBRIC §8 says long words
/// must wrap, never scroll the body sideways.
const String kLongWord = 'A supercalifragilisticexpialidociousassessmentword?';

/// The 360dp phone gate from DESIGN_RUBRIC §12.9.
const Size kNarrowPhone = Size(360, 900);

/// Hosts a result-layer widget in the same shell the real screen uses: a
/// scrolling, page-padded body, so height and wrapping behave as in production.
Widget hostResult(Widget child, {Brightness brightness = Brightness.light}) {
  return MaterialApp(
    theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
    locale: const Locale('en'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(
      body: SingleChildScrollView(
        padding: AppSpacing.pagePadding,
        child: child,
      ),
    ),
  );
}

/// A sample rubric the grade was measured against.
AssessmentRubric buildRubric() => const AssessmentRubric(
  title: 'Short-answer rubric $kBn',
  description: 'Grades a short written answer. $kTa',
  criteria: <AssessmentRubricCriterion>[
    AssessmentRubricCriterion(
      name: 'Understanding',
      description: 'Conceptual grasp.',
      levels: <AssessmentRubricLevel>[
        AssessmentRubricLevel(
          name: 'Exemplary',
          description: 'Complete.',
          points: 4,
        ),
        AssessmentRubricLevel(
          name: 'Beginning',
          description: 'Minimal.',
          points: 1,
        ),
      ],
    ),
  ],
  gradeLevel: 'Class 5',
  subject: 'Science',
);

/// A fully-graded assessment (the `full` mode shape) with Indic probes in every
/// prose slot and an unbreakable compound word.
Assessment buildAssessment() => Assessment(
  rawTranscript: 'The water cycle has evaporation and rain. $kBn $kLongWord',
  overallScore: 75,
  pointsEarned: 12,
  pointsPossible: 16,
  confidenceOverall: 0.82,
  perCriterionScores: <CriterionScore>[
    const CriterionScore(
      criterionName: 'Understanding $kTa',
      level: 'Proficient',
      points: 3,
      maxPoints: 4,
      feedback: 'Named evaporation correctly. $kMl',
      confidence: 0.9,
    ),
    const CriterionScore(
      criterionName: 'Accuracy',
      level: 'Developing',
      points: 2,
      maxPoints: 4,
      // Below 0.5 -> a low-confidence tag.
      feedback: 'Some steps were hard to read. $kLongWord',
      confidence: 0.3,
    ),
  ],
  strengths: <String>['Clear opening sentence. $kBn', kLongWord],
  improvements: <String>['Add the condensation step. $kTa'],
  nextSteps: <String>['Draw the cycle with labels. $kMl'],
  teacherNote: 'You have understood the main idea. Keep going. $kBn',
  warnings: const <String>['low_contrast'],
  rubric: buildRubric(),
  language: 'English',
);

/// A `transcribe`-only result: a transcript and nothing to score. Proves the
/// view leads with the transcript and shows no score card.
Assessment buildTranscribeOnly() => const Assessment(
  rawTranscript: 'पानी का चक्र. $kBn $kTa',
  language: 'English',
);

/// A blank-page result: score 0 plus the page_appears_blank warning.
Assessment buildBlankPage() => const Assessment(
  rawTranscript: '[BLANK]',
  overallScore: 0,
  pointsEarned: 0,
  pointsPossible: 16,
  confidenceOverall: 0.1,
  warnings: <String>['page_appears_blank'],
  teacherNote: 'No student work was detected in this image. Please try again.',
);

/// The empty-result state (nothing worth rendering).
Assessment buildEmpty() => const Assessment();
