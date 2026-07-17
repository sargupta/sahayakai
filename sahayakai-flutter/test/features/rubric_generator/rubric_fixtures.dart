import 'package:flutter/material.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/rubric_generator/domain/rubric.dart';

/// Shared fixtures for the rubric-generator suites. Not a `_test.dart` file, so
/// the runner ignores it.

/// The DESIGN_RUBRIC §11 Indic probe strings (Bengali, Tamil, Malayalam).
/// Every prose slot in the fixtures carries one so a clipped matra or a missing
/// wrap shows up as a real overflow, not a silent regression.
const String kBn = 'শিক্ষকদের জন্য কৃত্রিম বুদ্ধিমত্তা সহায়ক প্রশ্ন';
const String kTa = 'ஆசிரியர்களுக்கான செயற்கை நுண்ணறிவு உதவியாளர்';
const String kMl = 'അധ്യാപകർക്കുള്ള നിർമ്മിത ബുദ്ധി സഹായി';

/// A deliberately unbreakable compound word: DESIGN_RUBRIC §8 says long words
/// must wrap, never scroll the body sideways. It lives in a grid CELL so the
/// grid, not the page, absorbs it.
const String kLongWord = 'A supercalifragilisticexpialidociousrubriccriterionword?';

/// The 360dp phone gate from DESIGN_RUBRIC §12.9.
const Size kNarrowPhone = Size(360, 900);

/// Hosts a result-layer widget in the same shell the real screen uses: a
/// scrolling, page-padded body, so height and wrapping behave as in production.
/// The page scroll is VERTICAL only — any horizontal scroll a test observes is
/// the rubric grid's own.
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

/// The four mandated performance levels, highest score first, carrying Indic
/// probe strings and (in the top level) an unbreakable compound word.
List<RubricLevel> _levels() => <RubricLevel>[
      RubricLevel(
        name: 'Exemplary',
        description: 'Exceeds every expectation. $kTa $kLongWord',
        points: 4,
      ),
      RubricLevel(
        name: 'Proficient',
        description: 'Meets the standard expectations. $kMl',
        points: 3,
      ),
      RubricLevel(
        name: 'Developing',
        description: 'Shows some understanding. $kBn',
        points: 2,
      ),
      const RubricLevel(
        name: 'Beginning',
        description: 'Minimal evidence of the skill.',
        points: 1,
      ),
    ];

/// A fully-populated rubric (a 4x4 grid). [empty] returns one the model gave no
/// usable content for; [partial] returns criteria with no levels (the grid's
/// no-levels fallback path).
Rubric buildRubric({bool empty = false, bool partial = false}) {
  if (empty) return const Rubric(title: '');
  if (partial) {
    return Rubric(
      title: 'Renewable Energy Project Rubric $kBn',
      description: 'Grades a Class 5 renewable-energy project. $kMl',
      gradeLevel: 'Class 5',
      subject: 'Science',
      criteria: <RubricCriterion>[
        RubricCriterion(name: 'Research and Content $kTa'),
        const RubricCriterion(name: 'Presentation'),
      ],
    );
  }
  return Rubric(
    title: 'Renewable Energy Project Rubric $kBn',
    description: 'Grades a Class 5 renewable-energy project. $kMl',
    gradeLevel: 'Class 5',
    subject: 'Science',
    criteria: <RubricCriterion>[
      RubricCriterion(
        name: 'Research and Content $kTa',
        description: 'Depth and accuracy of the sources used. $kBn',
        levels: _levels(),
      ),
      RubricCriterion(
        name: 'Organisation',
        description: 'How clearly the project is structured. $kMl',
        levels: _levels(),
      ),
      RubricCriterion(
        name: 'Presentation $kLongWord',
        description: 'Clarity of the spoken and visual delivery.',
        levels: _levels(),
      ),
      RubricCriterion(
        name: 'Teamwork',
        description: 'Contribution of each member. $kTa',
        levels: _levels(),
      ),
    ],
  );
}
