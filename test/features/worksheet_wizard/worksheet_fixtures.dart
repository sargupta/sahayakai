import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/worksheet_wizard/domain/worksheet.dart';

// The image-picker fake, sample bytes and oversized-image builder are shared
// with the image-input suite, so they live once in the media fixtures.
export '../../shared/media/image_input_fixtures.dart'
    show FakeImagePickerService, kTinyPng, tinyRaw, tinyPicked, oversizedRaw;

/// Shared fixtures for the worksheet-wizard suites. Not a `_test.dart` file, so
/// the runner ignores it.

/// The DESIGN_RUBRIC §11 Indic probe strings (Bengali, Tamil, Malayalam).
/// Every prose slot in the fixtures carries one so a clipped matra or a missing
/// wrap shows up as a real overflow, not a silent regression.
const String kBn = 'শিক্ষকদের জন্য কৃত্রিম বুদ্ধিমত্তা সহায়ক প্রশ্ন';
const String kTa = 'ஆசிரியர்களுக்கான செயற்கை நுண்ணறிவு உதவியாளர்';
const String kMl = 'അധ്യാപകർക്കുള്ള നിർമ്മിത ബുദ്ധി സഹായി';

/// A deliberately unbreakable compound word: DESIGN_RUBRIC §8 says long words
/// must wrap, never scroll the body sideways.
const String kLongWord = 'A supercalifragilisticexpialidociousworksheetword?';

/// The 360dp phone gate from DESIGN_RUBRIC §12.9.
const Size kNarrowPhone = Size(360, 900);

/// Hosts a result-layer widget in the same shell the real screen uses: a
/// scrolling, page-padded body inside a [ProviderScope] (so the Save bar's
/// providers resolve), so height and wrapping behave as in production.
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

/// A fully-populated worksheet. [empty] returns one the model gave no usable
/// content for (the empty-result state).
Worksheet buildWorksheet({bool empty = false}) {
  if (empty) return const Worksheet(title: '');
  return const Worksheet(
    title: 'Counting mangoes $kBn',
    gradeLevel: 'Class 2',
    subject: 'Mathematics',
    learningObjectives: <String>['Count objects up to 20 $kTa', kLongWord],
    studentInstructions: 'Look at the pictures and solve the problems. $kMl',
    activities: <WorksheetActivity>[
      WorksheetActivity(
        type: WorksheetActivityType.question,
        content:
            r'If there are $5$ mangoes and $3$ more, how many? '
            '$kBn $kTa',
        explanation: 'Uses local fruit to teach addition. $kMl',
        chalkboardNote: 'Draw two baskets with circles for mangoes. $kTa',
      ),
      WorksheetActivity(
        type: WorksheetActivityType.creativeTask,
        content: kLongWord,
      ),
    ],
    answerKey: <AnswerKeyEntry>[
      AnswerKeyEntry(
        activityIndex: 0,
        answer:
            r'$8$ mangoes. '
            '$kMl',
      ),
      AnswerKeyEntry(answer: 'Any labelled drawing is fine. $kTa'),
    ],
  );
}
