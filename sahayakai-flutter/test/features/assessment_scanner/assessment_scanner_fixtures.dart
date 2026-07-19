import 'package:flutter/material.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/platform/link_opener.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/assessment_scanner/data/assessment_scanner_dtos.dart';
import 'package:sahayakai/features/assessment_scanner/domain/assessment_scan.dart';

// The image-picker fake, sample bytes and raw builder are shared with the
// image-input suite, so they live once in the media fixtures.
export '../../shared/media/image_input_fixtures.dart'
    show FakeImagePickerService, kTinyPng, tinyRaw, tinyPicked, oversizedRaw;

/// Shared fixtures for the Assessment Scanner suites. Not a `_test.dart` file,
/// so the runner ignores it.

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
Widget hostResult(
  Widget child, {
  Brightness brightness = Brightness.light,
  bool reduceMotion = false,
}) {
  return MaterialApp(
    theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
    locale: const Locale('en'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(
      body: SingleChildScrollView(
        padding: AppSpacing.pagePadding,
        child: reduceMotion
            ? Builder(
                builder: (context) => MediaQuery(
                  data: MediaQuery.of(context).copyWith(disableAnimations: true),
                  child: child,
                ),
              )
            : child,
      ),
    ),
  );
}

/// A [LinkOpener] that records what it was asked to open instead of standing up
/// a platform channel.
class FakeLinkOpener implements LinkOpener {
  final List<Uri> opened = <Uri>[];

  @override
  Future<bool> open(Uri url) async {
    opened.add(url);
    return true;
  }
}

/// The `POST /api/ai/assessment-scanner` 200 body — a graded multi-page answer
/// sheet with an overall `scorePct`, per-question marks + feedback, and next
/// steps. Indic probes ride in every prose slot. Field names mirror
/// `AssessmentScannerOutputSchema` exactly.
Map<String, dynamic> scanJson() => <String, dynamic>{
      'assessmentId': '11111111-1111-4111-8111-111111111111',
      'status': 'graded',
      'pageCount': 2,
      'totalAwardedMarks': 7,
      'totalMaxMarks': 12,
      'scorePct': 58,
      'letterGrade': 'C',
      'questions': <Map<String, dynamic>>[
        {
          'questionId': 'p0-q1',
          'pageIndex': 0,
          'questionText': 'What is 2 + 3? $kBn',
          'studentAnswer': '5',
          'expectedAnswer': '5',
          'marksAwarded': 5,
          'marksMax': 5,
          'feedback': 'Correct and neatly written. $kTa',
          'studentFacingFeedback': 'Great work! $kMl',
          'conceptTested': 'Addition',
          'mistakePattern': 'none',
          'needsTeacherReview': false,
          'confidence': 0.95,
        },
        {
          'questionId': 'p0-q2',
          'pageIndex': 0,
          'questionText': 'Solve 1/2 + 1/4. $kTa',
          'studentAnswer': '2/6',
          'expectedAnswer': '3/4',
          'marksAwarded': 2,
          'marksMax': 4,
          'feedback': 'Right method, wrong common denominator. $kMl $kLongWord',
          'studentFacingFeedback': 'Close — check the denominator. $kBn',
          'conceptTested': 'Fractions',
          'mistakePattern': 'computational',
          'needsTeacherReview': false,
          'confidence': 0.7,
        },
        {
          'questionId': 'p1-q3',
          'pageIndex': 1,
          'questionText': 'Name the process of water turning to vapour. $kMl',
          'studentAnswer': 'melting',
          'expectedAnswer': 'evaporation',
          'marksAwarded': 0,
          'marksMax': 3,
          'feedback': 'This is evaporation, not melting. $kBn',
          'studentFacingFeedback': 'Revise the water cycle. $kTa',
          'conceptTested': 'Water cycle',
          'mistakePattern': 'conceptual',
          'needsTeacherReview': true,
          'confidence': 0.5,
        },
      ],
      'classAverageAtScan': null,
      'conceptMastery': <dynamic>[],
      'recommendedNextSteps': <String>[
        'Re-teach adding fractions with unlike denominators. $kBn',
        kLongWord,
      ],
      'studentRecommendations': <String>[
        'Practise the water cycle this week. $kMl',
      ],
      'needsReviewCount': 1,
      'imageQualityWarnings': <String>['Page 1: blurry. $kTa'],
    };

/// A fully-decoded result, built through the real DTO so the fixture and the
/// production decode path can never drift.
AssessmentResult buildResult() =>
    AssessmentScannerResponseDto.fromJson(scanJson()).toDomain();

/// A result the model returned with nothing worth rendering (the empty state).
AssessmentResult buildEmptyResult() => const AssessmentResult(
      assessmentId: 'x',
      status: 'failed',
      pageCount: 1,
      totalAwardedMarks: 0,
      totalMaxMarks: 0,
      scorePct: 0,
      letterGrade: '',
    );
