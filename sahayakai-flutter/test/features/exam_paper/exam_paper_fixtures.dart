import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/exam_paper/data/exam_paper_dtos.dart';
import 'package:sahayakai/features/exam_paper/domain/exam_paper.dart';

/// Shared fixtures for the exam-paper suites. Not a `_test.dart` file, so the
/// runner ignores it.

/// The DESIGN_RUBRIC §11 Indic probe strings (Bengali, Tamil, Malayalam).
/// Every prose slot in the fixtures carries one so a clipped matra or a missing
/// wrap shows up as a real overflow, not a silent regression.
const String kBn = 'শিক্ষকদের জন্য কৃত্রিম বুদ্ধিমত্তা সহায়ক প্রশ্ন';
const String kTa = 'ஆசிரியர்களுக்கான செயற்கை நுண்ணறிவு உதவியாளர்';
const String kMl = 'അധ്യാപകർക്കുള്ള നിർമ്മിത ബുദ്ധി സഹായി';

/// A deliberately unbreakable compound word: DESIGN_RUBRIC §8 says long words
/// must wrap, never scroll the body sideways. Lives inside a question card.
const String kLongWord =
    'A supercalifragilisticexpialidociousexampaperquestionword?';

/// The 360dp phone gate from DESIGN_RUBRIC §12.9.
const Size kNarrowPhone = Size(360, 900);

/// Hosts a result-layer widget in the same shell the real screen uses: a
/// scrolling, page-padded body inside a [ProviderScope], so height/wrapping
/// behave as in production AND the save-bar's providers resolve. The page scroll
/// is VERTICAL only.
Widget hostResult(
  Widget child, {
  Brightness brightness = Brightness.light,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
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
    ),
  );
}

/// The verbatim `POST /api/ai/exam-paper` 200 body, carrying every field the
/// route returns plus Indic probes and an unbreakable word. Pinned against
/// `ExamPaperDataSchema` / the route handler in `sahayakai-main`.
Map<String, dynamic> examPaperJson() => <String, dynamic>{
      'title': 'CBSE Class 10 Mathematics Sample Paper $kBn',
      'board': 'CBSE',
      'subject': 'Mathematics',
      'gradeLevel': 'Class 10',
      'duration': '3 Hours',
      'maxMarks': 80,
      'generalInstructions': <String>[
        'All questions are compulsory. $kTa',
        'Section A carries one mark each. $kMl',
      ],
      'sections': <Map<String, dynamic>>[
        <String, dynamic>{
          'name': 'Section A',
          'label': 'Multiple Choice Questions',
          'totalMarks': 20,
          'questions': <Map<String, dynamic>>[
            <String, dynamic>{
              'number': 1,
              'text': 'What is the value of x here? $kBn $kLongWord',
              'marks': 1,
              'options': <String>['(a) 2', '(b) 3', '(c) 4', '(d) 5'],
              'answerKey': '(c) 4',
              'markingScheme': 'One mark for the correct option. $kTa',
              'source': 'AI Generated',
            },
            <String, dynamic>{
              'number': 2,
              'text': 'Solve the quadratic equation shown. $kMl',
              'marks': 3,
              'internalChoice': 'Or, factorise the given expression. $kTa',
              'answerKey': 'x equals 2 or x equals 3',
              'markingScheme': 'One mark for each correct step.',
              'source': 'PYQ 2019',
            },
          ],
        },
      ],
      'blueprintSummary': <String, dynamic>{
        'chapterWise': <Map<String, dynamic>>[
          <String, dynamic>{'chapter': 'Quadratic Equations $kBn', 'marks': 12},
          <String, dynamic>{'chapter': 'Triangles', 'marks': 8},
        ],
        'difficultyWise': <Map<String, dynamic>>[
          <String, dynamic>{'level': 'Easy', 'percentage': 40},
          <String, dynamic>{'level': 'Hard', 'percentage': 20},
        ],
      },
      'pyqSources': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'pyq-1',
          'year': 2019,
          'chapter': 'Quadratic Equations',
        },
      ],
    };

/// The verbatim **202 `generation_in_progress`** body.
Map<String, dynamic> examPaperInProgressJson() => <String, dynamic>{
      'error': 'generation_in_progress',
      'message': 'Exam paper still generating. Check My Library in 1 minute.',
      'budgetMs': 75000,
      'elapsedMs': 75001,
    };

/// The success body decoded into the ready result (carries the raw JSON, so the
/// save round-trip can be asserted).
ExamPaperReady buildReady() =>
    ExamPaperResponseDto.resultFrom(examPaperJson()) as ExamPaperReady;
