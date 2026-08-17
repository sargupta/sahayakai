import 'package:flutter/material.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/teacher_training/domain/teacher_advice.dart';

/// Shared fixtures for the Teaching Coach suites. Not a `_test.dart` file, so
/// the runner ignores it.

/// The DESIGN_RUBRIC §11 Indic probe strings (Bengali, Tamil, Malayalam).
/// Every prose slot in the fixtures carries one so a clipped matra or a missing
/// wrap shows up as a real overflow, not a silent regression.
const String kBn = 'শিক্ষকদের জন্য কৃত্রিম বুদ্ধিমত্তা সহায়ক প্রশ্ন';
const String kTa = 'ஆசிரியர்களுக்கான செயற்கை நுண்ணறிவு உதவியாளர்';
const String kMl = 'അധ്യാപകർക്കുള്ള നിർമ്മിത ബുദ്ധി സഹായി';

/// A deliberately unbreakable compound word: DESIGN_RUBRIC §8 says long words
/// must wrap, never scroll the body sideways.
const String kLongWord =
    'A supercalifragilisticexpialidociouspedagogicalstrategyword?';

/// The 360dp phone gate from DESIGN_RUBRIC §12.9.
const Size kNarrowPhone = Size(360, 900);

/// Hosts a result-layer widget in the same shell the real screen uses: a
/// scrolling, page-padded body, so height and wrapping behave as in production.
/// The page scroll is VERTICAL only — the advice list is a plain column of
/// cards, so no horizontal scroll should ever appear.
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

/// The three advice points, each carrying Indic probe strings; the first also
/// carries an unbreakable compound word so wrapping is proven inside a card.
List<TeacherAdvicePoint> _points() => <TeacherAdvicePoint>[
  const TeacherAdvicePoint(
    strategy: 'Use think-pair-share to raise participation. $kTa $kLongWord',
    pedagogy: 'Social Constructivism',
    explanation:
        'Learners build understanding through dialogue. $kMl Like a '
        'village discussing before a decision.',
  ),
  const TeacherAdvicePoint(
    strategy: 'Break the lesson into short, checked steps. $kBn',
    pedagogy: 'Scaffolding',
    explanation:
        'Each step supports the next until the support is removed. '
        '$kTa',
  ),
  const TeacherAdvicePoint(
    strategy: 'Revisit key ideas across the week. $kMl',
    pedagogy: 'Spaced Repetition',
    explanation: 'Recall strengthens with spacing. $kBn',
  ),
];

/// A fully-populated advice result. [empty] returns one the model gave no usable
/// content for; [partial] returns one with an empty advice list, no conclusion,
/// and a point missing its pedagogy tag (the partial-render paths).
TeacherAdvice buildAdvice({bool empty = false, bool partial = false}) {
  if (empty) return const TeacherAdvice(introduction: '', conclusion: '');
  if (partial) {
    return const TeacherAdvice(
      introduction: 'A fair question about classroom practice. $kBn',
      conclusion: '',
      gradeLevel: 'Class 6',
      subject: 'General',
      advice: <TeacherAdvicePoint>[
        TeacherAdvicePoint(
          strategy: 'Set one clear routine and hold it. $kTa',
          pedagogy: '',
          explanation: 'Predictability lowers cognitive load. $kMl',
        ),
      ],
    );
  }
  return TeacherAdvice(
    introduction:
        'Engagement across a full lesson is a real challenge. $kBn $kMl',
    conclusion: 'You are already asking the right questions. Keep going. $kTa',
    gradeLevel: 'Class 8',
    subject: 'General',
    advice: _points(),
  );
}
