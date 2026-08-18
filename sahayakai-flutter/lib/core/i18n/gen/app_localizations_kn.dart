// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Kannada (`kn`).
class AppLocalizationsKn extends AppLocalizations {
  AppLocalizationsKn([String locale = 'kn']) : super(locale);

  @override
  String get appTitle => 'SahayakAI';

  @override
  String get navHome => 'ಮುಖಪುಟ';

  @override
  String get navCreate => 'ರಚಿಸಿ';

  @override
  String get navLibrary => 'ಗ್ರಂಥಾಲಯ';

  @override
  String get navProfile => 'ಪ್ರೊಫೈಲ್';

  @override
  String get actionRetry => 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ';

  @override
  String get actionSignIn => 'ಸೈನ್ ಇನ್ ಮಾಡಿ';

  @override
  String get actionSignOut => 'ಸೈನ್ ಔಟ್';

  @override
  String get actionGenerate => 'ರಚಿಸಿ';

  @override
  String get stateOfflineTitle => 'ನೀವು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ';

  @override
  String get stateOfflineBody =>
      'ನಿಮ್ಮ ಸಂಪರ್ಕವನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get errorGeneric => 'ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get emptyDefault => 'ಫಾರ್ಮ್ ಭರ್ತಿ ಮಾಡಿ ರಚಿಸಿ ಅನ್ನು ಟ್ಯಾಪ್ ಮಾಡಿ.';

  @override
  String get languageLabel => 'ಭಾಷೆ';

  @override
  String get splashTagline => 'ಪ್ರತಿ ತರಗತಿಗೆ ಬೋಧನಾ ಸಹಾಯಕ';

  @override
  String get splashFailedTitle => 'ಆ್ಯಪ್ ಅನ್ನು ಪ್ರಾರಂಭಿಸಲಾಗಲಿಲ್ಲ';

  @override
  String get splashFailedBody =>
      'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸಂಪರ್ಕವನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get loginTitle => 'SahayakAI ಗೆ ಸ್ವಾಗತ';

  @override
  String get loginSubtitle =>
      'ಪಾಠ ಯೋಜನೆ, ಕ್ವಿಜ್ ಮತ್ತು ಇನ್ನಷ್ಟುಗಳಿಗಾಗಿ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get loginGoogle => 'Google ಜೊತೆ ಮುಂದುವರಿಸಿ';

  @override
  String get loginPrivacyNote =>
      'ನಾವು ನಿಮ್ಮ Google ಖಾತೆಯನ್ನು ಸೈನ್ ಇನ್ ಮಾಡಲು ಮಾತ್ರ ಬಳಸುತ್ತೇವೆ. ನಿಮ್ಮ ಕೆಲಸ ನಿಮ್ಮದೇ ಆಗಿ ಉಳಿಯುತ್ತದೆ.';

  @override
  String get loginLanguagePrompt => 'ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get loginLanguageHint =>
      'SahayakAI ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತದೆ, ಮತ್ತು ನಿಮ್ಮ ಬೋಧನಾ ಸಾಮಗ್ರಿಯನ್ನೂ ಅದೇ ಭಾಷೆಯಲ್ಲಿ ಬರೆಯುತ್ತದೆ.';

  @override
  String get loginValueLessons => 'ನಿಮಿಷಗಳಲ್ಲಿ ಪೂರ್ಣ ಪಾಠ ಯೋಜನೆ ರೂಪಿಸಿ';

  @override
  String get loginValueQuizzes => 'ಮೂರು ಕಠಿಣತೆಯ ಮಟ್ಟಗಳಲ್ಲಿ ಕ್ವಿಜ್ ರಚಿಸಿ';

  @override
  String get loginValueAnswers =>
      'ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ, ತರಗತಿಯ ಯಾವುದೇ ಪ್ರಶ್ನೆಗೆ ಉತ್ತರಿಸಿ';

  @override
  String get onboardingTitle => 'SahayakAI ಅನ್ನು ಸಿದ್ಧಗೊಳಿಸಿ';

  @override
  String get onboardingSkip => 'ಸದ್ಯಕ್ಕೆ ಬಿಟ್ಟುಬಿಡಿ';

  @override
  String onboardingStepLabel(int current, int total) {
    return '$totalರಲ್ಲಿ ಹಂತ $current';
  }

  @override
  String get onboardingBack => 'ಹಿಂದೆ';

  @override
  String get onboardingNext => 'ಮುಂದೆ';

  @override
  String get onboardingSaveAndContinue => 'ಉಳಿಸಿ ಮತ್ತು ಮುಂದುವರಿಸಿ';

  @override
  String get onboardingFinish => 'ನನ್ನ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಹೋಗಿ';

  @override
  String get onboardingLanguageTitle => 'ನೀವು ಯಾವ ಭಾಷೆಯಲ್ಲಿ ಬೋಧಿಸುತ್ತೀರಿ?';

  @override
  String get onboardingLanguageBody =>
      'ನೀವು ಆಯ್ಕೆ ಮಾಡುವ ಭಾಷೆಯಲ್ಲೇ ಪಾಠ ಯೋಜನೆಗಳು, ಕ್ವಿಜ್‌ಗಳು ಮತ್ತು ಉತ್ತರಗಳು ಬರುತ್ತವೆ. ನೀವು ಇದನ್ನು ಯಾವಾಗ ಬೇಕಾದರೂ ಬದಲಾಯಿಸಬಹುದು.';

  @override
  String get onboardingProfileTitle => 'ನಿಮ್ಮ ತರಗತಿಯ ಬಗ್ಗೆ ನಮಗೆ ತಿಳಿಸಿ';

  @override
  String get onboardingProfileBody =>
      'ಪ್ರತಿ ಕ್ಷೇತ್ರವೂ ಐಚ್ಛಿಕ. ನೀವು ಹಂಚಿಕೊಳ್ಳುವುದನ್ನು ನಿಮ್ಮ ಬೋರ್ಡ್, ನಿಮ್ಮ ತರಗತಿಗಳು ಮತ್ತು ನಿಮ್ಮ ರಾಜ್ಯಕ್ಕೆ ತಕ್ಕಂತೆ ನಿಮ್ಮ ಸಾಮಗ್ರಿಯನ್ನು ಹೊಂದಿಸಲು ಬಳಸಲಾಗುತ್ತದೆ.';

  @override
  String get onboardingReadyTitle => 'ನೀವು ಪ್ರಾರಂಭಿಸಲು ಸಿದ್ಧರಿದ್ದೀರಿ';

  @override
  String get onboardingReadyBody =>
      'ನಿಮ್ಮ ಪಾಠ ಯೋಜನೆಗಳು, ಕ್ವಿಜ್‌ಗಳು ಮತ್ತು ಉತ್ತರಗಳು ಇದಕ್ಕೆ ಹೊಂದುತ್ತವೆ. ನೀವು ಇದನ್ನು ನಂತರ ಯಾವಾಗ ಬೇಕಾದರೂ ನಿಮ್ಮ ಪ್ರೊಫೈಲ್‌ನಿಂದ ಬದಲಾಯಿಸಬಹುದು.';

  @override
  String get onboardingSaveFailed =>
      'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಅನ್ನು ಉಳಿಸಲು ನಮಗೆ ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ನೀವು ಈಗ ಮುಂದುವರಿಯಬಹುದು ಮತ್ತು ನಂತರ ಅದನ್ನು ನಿಮ್ಮ ಪ್ರೊಫೈಲ್‌ನಿಂದ ಸೇರಿಸಬಹುದು.';

  @override
  String get onboardingSaveSignIn =>
      'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಅನ್ನು ಉಳಿಸಲು ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ. ನೀವು ಈಗ ಮುಂದುವರಿಯಬಹುದು ಮತ್ತು ನಂತರ ಅದನ್ನು ಸೇರಿಸಬಹುದು.';

  @override
  String get dashboardGreeting => 'ಮತ್ತೆ ಸ್ವಾಗತ';

  @override
  String dashboardGreetingNamed(String name) {
    return 'ಮತ್ತೆ ಸ್ವಾಗತ, $name';
  }

  @override
  String get dashboardGreetingMorning => 'ಶುಭೋದಯ';

  @override
  String get dashboardGreetingAfternoon => 'ಶುಭ ಮಧ್ಯಾಹ್ನ';

  @override
  String get dashboardGreetingEvening => 'ಶುಭ ಸಂಜೆ';

  @override
  String get actionOpen => 'ತೆರೆಯಿರಿ';

  @override
  String get actionRegenerate => 'ಮತ್ತೆ ರಚಿಸಿ';

  @override
  String get actionCopy => 'ನಕಲಿಸಿ';

  @override
  String get copyConfirmation => 'ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ನಕಲಿಸಲಾಗಿದೆ';

  @override
  String get readAloudListen => 'ಕೇಳಿ';

  @override
  String get readAloudStop => 'ನಿಲ್ಲಿಸಿ';

  @override
  String get readAloudError =>
      'ಆಡಿಯೊ ಪ್ಲೇ ಮಾಡಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String voiceResultReady(String tool) {
    return 'ನಿಮ್ಮ $tool ಸಿದ್ಧವಾಗಿದೆ.';
  }

  @override
  String voiceResultReadyWithTopic(String tool, String topic) {
    return '$topic ಬಗ್ಗೆ ನಿಮ್ಮ $tool ಸಿದ್ಧವಾಗಿದೆ.';
  }

  @override
  String get lessonPlanSectionLesson => 'ಪಾಠ';

  @override
  String get lessonPlanSectionApproach => 'ಬೋಧನಾ ವಿಧಾನ';

  @override
  String get quizSectionQuiz => 'ಕ್ವಿಜ್';

  @override
  String get sectionForYourClass => 'ನಿಮ್ಮ ತರಗತಿಗಾಗಿ';

  @override
  String get instantAnswerResultTitle => 'ಉತ್ತರ';

  @override
  String get dashboardToolsTitle => 'ನಿಮ್ಮ ಬೋಧನಾ ಸಾಧನಗಳು';

  @override
  String get createPaletteSearchHint => 'ಸಾಧನಗಳನ್ನು ಹುಡುಕಿ';

  @override
  String get createPaletteEmpty =>
      'ನಿಮ್ಮ ಹುಡುಕಾಟಕ್ಕೆ ಯಾವುದೇ ಸಾಧನ ಹೊಂದಿಕೆಯಾಗಿಲ್ಲ';

  @override
  String get dashboardRecentTitle => 'ಇತ್ತೀಚಿನ ಕೆಲಸ';

  @override
  String get dashboardRecentEmpty =>
      'ನೀವು ರಚಿಸುವ ಎಲ್ಲವೂ ಇಲ್ಲಿ ಉಳಿಯುತ್ತದೆ, ಮತ್ತೆ ತೆರೆಯಲು ಸಿದ್ಧ.';

  @override
  String get dashboardRecentFailed =>
      'ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಕೆಲಸವನ್ನು ತೆರೆಯಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get dashboardRecentSignedOut =>
      'ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಕೆಲಸ ನೋಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get dashboardUntitled => 'ಶೀರ್ಷಿಕೆ ಇಲ್ಲ';

  @override
  String get dashboardSetupTitle => 'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಳಿಸಿ';

  @override
  String get dashboardSetupBody =>
      'ನಿಮ್ಮ ಶಾಲೆ ಮತ್ತು ತರಗತಿಗಳನ್ನು ಸೇರಿಸಿ, ಆಗ ಪ್ರತಿ ಪಾಠ ಯೋಜನೆ ಮತ್ತು ಕ್ವಿಜ್ ನಿಮ್ಮ ತರಗತಿಗೆ ಸಿದ್ಧವಾಗಿ ಬರುತ್ತದೆ.';

  @override
  String get dashboardSetupAction => 'ನನ್ನ ಪ್ರೊಫೈಲ್ ಸಿದ್ಧಗೊಳಿಸಿ';

  @override
  String get dashboardSetupDismiss => 'ಈಗ ಬೇಡ';

  @override
  String get contentTypeLessonPlan => 'ಪಾಠ ಯೋಜನೆ';

  @override
  String get contentTypeQuiz => 'ಕ್ವಿಜ್';

  @override
  String get contentTypeWorksheet => 'ಕಾರ್ಯಪತ್ರಿಕೆ';

  @override
  String get contentTypeVisualAid => 'ದೃಶ್ಯ ಸಾಧನ';

  @override
  String get contentTypeRubric => 'ರೂಬ್ರಿಕ್';

  @override
  String get contentTypeMicroLesson => 'ಸೂಕ್ಷ್ಮ ಪಾಠ';

  @override
  String get contentTypeVirtualFieldTrip => 'ವರ್ಚುವಲ್ ಫೀಲ್ಡ್ ಟ್ರಿಪ್';

  @override
  String get contentTypeInstantAnswer => 'ತಕ್ಷಣ ಉತ್ತರ';

  @override
  String get contentTypeTeacherTraining => 'ಶಿಕ್ಷಕ ತರಬೇತಿ';

  @override
  String get contentTypeExamPaper => 'ಪ್ರಶ್ನೆಪತ್ರಿಕೆ';

  @override
  String get contentTypeAssessment => 'ಮೌಲ್ಯಮಾಪನ';

  @override
  String get contentTypeAssessmentSubmission => 'ಸ್ಕ್ಯಾನ್ ಮಾಡಿದ ಮೌಲ್ಯಮಾಪನ';

  @override
  String get contentTypeUnknown => 'ಉಳಿಸಿದ ಕೆಲಸ';

  @override
  String get libraryTitle => 'ನನ್ನ ಗ್ರಂಥಾಲಯ';

  @override
  String get librarySectionSaved => 'ಉಳಿಸಿದವು';

  @override
  String get libraryEmpty =>
      'ನೀವು ಉಳಿಸಿದ ಪಾಠ ಯೋಜನೆಗಳು ಮತ್ತು ಕ್ವಿಜ್‌ಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.';

  @override
  String get libraryEmptyAction => 'ಪಾಠ ಯೋಜನೆ ರಚಿಸಿ';

  @override
  String get librarySignedOut => 'ನಿಮ್ಮ ಉಳಿಸಿದ ಕೆಲಸ ನೋಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get libraryLoadFailed => 'ನಿಮ್ಮ ಗ್ರಂಥಾಲಯವನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.';

  @override
  String get libraryNewestOnly =>
      'ನಿಮ್ಮ ಇತ್ತೀಚಿನ 20 ಐಟಂಗಳನ್ನು ತೋರಿಸಲಾಗುತ್ತಿದೆ.';

  @override
  String get libraryFilterAll => 'ಎಲ್ಲ';

  @override
  String get libraryFilterEmpty => 'ಈ ಪ್ರಕಾರದ ಯಾವುದೇ ಐಟಂ ನೀವು ಇನ್ನೂ ಉಳಿಸಿಲ್ಲ.';

  @override
  String get libraryDetailTitle => 'ಉಳಿಸಿದ ಐಟಂ';

  @override
  String libraryDetailSavedOn(String date) {
    return '$date ರಂದು ಉಳಿಸಲಾಗಿದೆ';
  }

  @override
  String get libraryDetailSignedOut =>
      'ನಿಮ್ಮ ಉಳಿಸಿದ ಕೆಲಸ ತೆರೆಯಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get libraryDetailNotFound => 'ಈ ಐಟಂ ಇನ್ನು ನಿಮ್ಮ ಗ್ರಂಥಾಲಯದಲ್ಲಿ ಇಲ್ಲ.';

  @override
  String get libraryDetailLoadFailed =>
      'ಈ ಉಳಿಸಿದ ಐಟಂ ತೆರೆಯಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String libraryDetailReady(String type) {
    return 'ನೀವು ಉಳಿಸಿದ $type ಅನ್ನು ನೋಡುತ್ತಿದ್ದೀರಿ.';
  }

  @override
  String get profileTitle => 'ಪ್ರೊಫೈಲ್';

  @override
  String get lessonPlanTitle => 'ಪಾಠ ಯೋಜನೆ';

  @override
  String get lessonPlanSubtitle => 'ಪೂರ್ಣ 5E ಪಾಠವನ್ನು ಯೋಜಿಸಿ';

  @override
  String get lessonPlanEmpty =>
      'ಒಂದು ಟಾಪಿಕ್ ಸೇರಿಸಿ, 5E ಪಾಠ ಯೋಜನೆ ರಚಿಸಲು ರಚಿಸಿ ಒತ್ತಿರಿ.';

  @override
  String get lessonPlanTopicLabel => 'ಟಾಪಿಕ್';

  @override
  String get lessonPlanTopicHint => 'ಉದಾಹರಣೆಗೆ, ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ';

  @override
  String get lessonPlanTopicError => 'ದಯವಿಟ್ಟು ಯೋಜಿಸಲು ಒಂದು ಟಾಪಿಕ್ ನಮೂದಿಸಿ.';

  @override
  String get lessonPlanGradeLabel => 'ತರಗತಿ ಮಟ್ಟಗಳು';

  @override
  String get lessonPlanSubjectLabel => 'ವಿಷಯ';

  @override
  String get lessonPlanSubjectAny => 'ಯಾವುದೇ ವಿಷಯ';

  @override
  String get lessonPlanResourceLabel => 'ತರಗತಿಯ ಸಂಪನ್ಮೂಲಗಳು';

  @override
  String get lessonPlanResourceLow => 'ಕಡಿಮೆ';

  @override
  String get lessonPlanResourceMedium => 'ಮಧ್ಯಮ';

  @override
  String get lessonPlanResourceHigh => 'ಹೆಚ್ಚು';

  @override
  String get lessonPlanDifficultyLabel => 'ಕಠಿಣತೆ';

  @override
  String get lessonPlanDifficultyRemedial => 'ಪರಿಹಾರಾತ್ಮಕ';

  @override
  String get lessonPlanDifficultyStandard => 'ಸಾಮಾನ್ಯ';

  @override
  String get lessonPlanDifficultyAdvanced => 'ಮುಂದುವರಿದ';

  @override
  String get lessonPlanRuralLabel => 'ಸ್ಥಳೀಯ, ದಿನನಿತ್ಯದ ಉದಾಹರಣೆಗಳನ್ನು ಬಳಸಿ';

  @override
  String get lessonPlanRuralHint =>
      'ಚಟುವಟಿಕೆಗಳನ್ನು ಪರಿಚಿತ ಗ್ರಾಮೀಣ ಮತ್ತು ಸಮುದಾಯದ ಸಂದರ್ಭಗಳಲ್ಲಿ ಇರಿಸಿ.';

  @override
  String get lessonPlanOptional => 'ಐಚ್ಛಿಕ';

  @override
  String get lessonPlanObjectives => 'ಕಲಿಕೆಯ ಉದ್ದೇಶಗಳು';

  @override
  String get lessonPlanVocabulary => 'ಪ್ರಮುಖ ಪದಗಳು';

  @override
  String get lessonPlanMaterials => 'ಸಾಮಗ್ರಿಗಳು';

  @override
  String get lessonPlanActivities => '5E ಚಟುವಟಿಕೆಗಳು';

  @override
  String get lessonPlanAssessment => 'ಮೌಲ್ಯಮಾಪನ';

  @override
  String get lessonPlanHomework => 'ಮನೆಗೆಲಸ';

  @override
  String get lessonPlanTeacherTip => 'ಶಿಕ್ಷಕರಿಗೆ ಸಲಹೆ';

  @override
  String get lessonPlanUnderstandingCheck => 'ತಿಳಿವಳಿಕೆ ಪರಿಶೀಲನೆ';

  @override
  String get lessonPlanNoteLabel => 'ಪ್ರಾರಂಭಿಸುವ ಮೊದಲು ಒಂದು ಟಿಪ್ಪಣಿ';

  @override
  String get lessonPlanUpgradeTitle => 'ಹೆಚ್ಚಿನ ಯೋಜನೆ ಅಗತ್ಯವಿದೆ';

  @override
  String get lessonPlanUpgradeBody =>
      'ಪಾಠ ಯೋಜನೆ ರಚನೆ ಹೆಚ್ಚಿನ ಯೋಜನೆಯ ಭಾಗ. ಯೋಜನೆಗಳನ್ನು ರಚಿಸುತ್ತಿರಲು ದಯವಿಟ್ಟು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get lessonPlanLimitTitle => 'ನೀವು ನಿಮ್ಮ ಮಿತಿಯನ್ನು ತಲುಪಿದ್ದೀರಿ';

  @override
  String get lessonPlanLimitBody =>
      'ಸದ್ಯಕ್ಕೆ ನಿಮ್ಮ ಪಾಠ ಯೋಜನೆಗಳನ್ನು ಬಳಸಿದ್ದೀರಿ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ನಿಮ್ಮ ಯೋಜನೆಯನ್ನು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get lessonPlanSeePricing => 'ಯೋಜನೆಗಳು ಮತ್ತು ಬೆಲೆಗಳನ್ನು ನೋಡಿ';

  @override
  String get lessonPlanRephrase =>
      'ಅದರಿಂದ ಯೋಜನೆ ರಚಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಟಾಪಿಕ್ ಅನ್ನು ಬೇರೆ ರೀತಿ ಬರೆದು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get lessonPlanBusy =>
      'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get lessonPlanTimeout =>
      'ಇದು ನಿರೀಕ್ಷೆಗಿಂತ ಹೆಚ್ಚು ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get lessonPlanSignIn =>
      'ಈ ಸಾಧನವನ್ನು ಬಳಸಲು ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get quizTitle => 'ಕ್ವಿಜ್';

  @override
  String get quizSubtitle => 'ಮೂರು ಕಠಿಣತೆಯ ಮಟ್ಟಗಳಲ್ಲಿ ಕ್ವಿಜ್ ರಚಿಸಿ';

  @override
  String get quizEmpty => 'ಒಂದು ಟಾಪಿಕ್ ಸೇರಿಸಿ, ಕ್ವಿಜ್ ರಚಿಸಲು ರಚಿಸಿ ಒತ್ತಿರಿ.';

  @override
  String get quizTopicLabel => 'ಟಾಪಿಕ್';

  @override
  String get quizTopicHint => 'ಉದಾಹರಣೆಗೆ, ಭಿನ್ನರಾಶಿಗಳು';

  @override
  String get quizTopicError => 'ದಯವಿಟ್ಟು ಕ್ವಿಜ್‌ಗೆ ಒಂದು ಟಾಪಿಕ್ ನಮೂದಿಸಿ.';

  @override
  String get quizNumQuestionsLabel => 'ಪ್ರಶ್ನೆಗಳ ಸಂಖ್ಯೆ';

  @override
  String get quizFewerQuestions => 'ಕಡಿಮೆ ಪ್ರಶ್ನೆಗಳು';

  @override
  String get quizMoreQuestions => 'ಹೆಚ್ಚು ಪ್ರಶ್ನೆಗಳು';

  @override
  String get quizTypesLabel => 'ಪ್ರಶ್ನೆಗಳ ಪ್ರಕಾರಗಳು';

  @override
  String get quizTypesError => 'ದಯವಿಟ್ಟು ಕನಿಷ್ಠ ಒಂದು ಪ್ರಶ್ನೆ ಪ್ರಕಾರ ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get quizTypeMultipleChoice => 'ಬಹು ಆಯ್ಕೆ';

  @override
  String get quizTypeFillInTheBlanks => 'ಖಾಲಿ ಜಾಗ ತುಂಬಿ';

  @override
  String get quizTypeShortAnswer => 'ಕಿರು ಉತ್ತರ';

  @override
  String get quizTypeTrueFalse => 'ಸರಿ ಅಥವಾ ತಪ್ಪು';

  @override
  String get quizGradeLabel => 'ತರಗತಿ ಮಟ್ಟ';

  @override
  String get quizGradeAny => 'ಯಾವುದೇ ತರಗತಿ';

  @override
  String get quizSubjectLabel => 'ವಿಷಯ';

  @override
  String get quizSubjectAny => 'ಯಾವುದೇ ವಿಷಯ';

  @override
  String get quizDifficultyLabel => 'ಕಠಿಣತೆ';

  @override
  String get quizDifficultyHint =>
      'ಸುಲಭ, ಮಧ್ಯಮ ಮತ್ತು ಕಠಿಣ ಆವೃತ್ತಿಗಳನ್ನು ಪಡೆಯಲು ಇದನ್ನು ಎಲ್ಲಾ ಮಟ್ಟಗಳಲ್ಲಿ ಬಿಡಿ.';

  @override
  String get quizDifficultyAll => 'ಎಲ್ಲಾ ಮಟ್ಟಗಳು';

  @override
  String get quizDifficultyEasy => 'ಸುಲಭ';

  @override
  String get quizDifficultyMedium => 'ಮಧ್ಯಮ';

  @override
  String get quizDifficultyHard => 'ಕಠಿಣ';

  @override
  String get quizBloomsLabel => 'ಚಿಂತನಾ ಕೌಶಲಗಳು';

  @override
  String get quizBloomsHint =>
      'ಪ್ರಶ್ನೆಗಳು ಯಾವ ರೀತಿಯ ಚಿಂತನೆಯನ್ನು ಕೇಳಬೇಕೆಂದು ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get quizOptional => 'ಐಚ್ಛಿಕ';

  @override
  String quizQuestionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಪ್ರಶ್ನೆಗಳು',
      one: '1 ಪ್ರಶ್ನೆ',
    );
    return '$_temp0';
  }

  @override
  String get quizShowAnswer => 'ಉತ್ತರ ತೋರಿಸಿ';

  @override
  String get quizHideAnswer => 'ಉತ್ತರ ಮುಚ್ಚಿ';

  @override
  String get quizShowAllAnswers => 'ಎಲ್ಲಾ ಉತ್ತರ ತೋರಿಸಿ';

  @override
  String get quizHideAllAnswers => 'ಎಲ್ಲಾ ಉತ್ತರ ಮುಚ್ಚಿ';

  @override
  String get quizCorrectAnswer => 'ಸರಿಯಾದ ಉತ್ತರ';

  @override
  String get quizExplanation => 'ಏಕೆ';

  @override
  String get quizTeacherInstructions => 'ಇದನ್ನು ತರಗತಿಯಲ್ಲಿ ಹೇಗೆ ನಡೆಸುವುದು';

  @override
  String get quizNoteLabel => 'ಪ್ರಾರಂಭಿಸುವ ಮೊದಲು ಒಂದು ಟಿಪ್ಪಣಿ';

  @override
  String get quizNoQuestions =>
      'ಆ ಟಾಪಿಕ್‌ಗೆ ಯಾವುದೇ ಪ್ರಶ್ನೆಗಳು ಬರಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಬೇರೆ ಟಾಪಿಕ್ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get quizUpgradeTitle => 'ಹೆಚ್ಚಿನ ಯೋಜನೆ ಅಗತ್ಯವಿದೆ';

  @override
  String get quizUpgradeBody =>
      'ಕ್ವಿಜ್ ರಚನೆ ಹೆಚ್ಚಿನ ಯೋಜನೆಯ ಭಾಗ. ಕ್ವಿಜ್ ರಚಿಸುತ್ತಿರಲು ದಯವಿಟ್ಟು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get quizLimitTitle => 'ನೀವು ನಿಮ್ಮ ಮಿತಿಯನ್ನು ತಲುಪಿದ್ದೀರಿ';

  @override
  String get quizLimitBody =>
      'ಸದ್ಯಕ್ಕೆ ನಿಮ್ಮ ಕ್ವಿಜ್‌ಗಳನ್ನು ಬಳಸಿದ್ದೀರಿ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ನಿಮ್ಮ ಯೋಜನೆಯನ್ನು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get quizSeePricing => 'ಯೋಜನೆಗಳು ಮತ್ತು ಬೆಲೆಗಳನ್ನು ನೋಡಿ';

  @override
  String get quizRephrase =>
      'ಅದರಿಂದ ಕ್ವಿಜ್ ರಚಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಟಾಪಿಕ್ ಅನ್ನು ಬೇರೆ ರೀತಿ ಬರೆದು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get quizBusy =>
      'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get quizTimeout =>
      'ಇದು ನಿರೀಕ್ಷೆಗಿಂತ ಹೆಚ್ಚು ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get quizSignIn => 'ಈ ಸಾಧನವನ್ನು ಬಳಸಲು ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get instantAnswerTitle => 'ತಕ್ಷಣ ಉತ್ತರ';

  @override
  String get instantAnswerSubtitle => 'ತರಗತಿಯ ಯಾವುದೇ ಪ್ರಶ್ನೆ ಕೇಳಿ';

  @override
  String get instantAnswerAction => 'ಉತ್ತರ ಪಡೆಯಿರಿ';

  @override
  String get instantAnswerEmpty => 'ಒಂದು ಪ್ರಶ್ನೆ ಕೇಳಿ, ಉತ್ತರ ಪಡೆಯಿರಿ ಒತ್ತಿರಿ.';

  @override
  String get instantAnswerQuestionLabel => 'ನಿಮ್ಮ ಪ್ರಶ್ನೆ';

  @override
  String get instantAnswerQuestionHint =>
      'ಉದಾಹರಣೆಗೆ, ಚಂದ್ರನ ಆಕಾರ ಏಕೆ ಬದಲಾಗುತ್ತದೆ?';

  @override
  String get instantAnswerQuestionError => 'ದಯವಿಟ್ಟು ಒಂದು ಪ್ರಶ್ನೆ ನಮೂದಿಸಿ.';

  @override
  String get instantAnswerGradeLabel => 'ತರಗತಿ ಮಟ್ಟ';

  @override
  String get instantAnswerGradeAny => 'ಯಾವುದೇ ತರಗತಿ';

  @override
  String get instantAnswerSubjectLabel => 'ವಿಷಯ';

  @override
  String get instantAnswerSubjectAny => 'ಯಾವುದೇ ವಿಷಯ';

  @override
  String get instantAnswerOptional => 'ಐಚ್ಛಿಕ';

  @override
  String get instantAnswerVideoTitle => 'ಸಂಬಂಧಿತ ವೀಡಿಯೊ ನೋಡಿ';

  @override
  String get instantAnswerVideoBody =>
      'ಆ್ಯಪ್‌ನ ಹೊರಗೆ, ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ತೆರೆಯುತ್ತದೆ.';

  @override
  String get instantAnswerNoAnswer =>
      'ಆ ಪ್ರಶ್ನೆಗೆ ಯಾವುದೇ ಉತ್ತರ ಬರಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಅದನ್ನು ಬೇರೆ ರೀತಿ ಬರೆದು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get instantAnswerSeePricing => 'ಯೋಜನೆಗಳು ಮತ್ತು ಬೆಲೆಗಳನ್ನು ನೋಡಿ';

  @override
  String get instantAnswerDailyLimitTitle =>
      'ಇಂದಿನ ನಿಮ್ಮ ಎಲ್ಲಾ ಪ್ರಶ್ನೆಗಳು ಮುಗಿದವು';

  @override
  String get instantAnswerDailyLimitBody =>
      'ನಿಮ್ಮ ಯೋಜನೆಯಲ್ಲಿ ಪ್ರತಿದಿನ ನಿಗದಿತ ಸಂಖ್ಯೆಯ ತಕ್ಷಣ ಉತ್ತರಗಳಿವೆ. ನಿಮ್ಮ ಪ್ರಶ್ನೆಗಳು ನಾಳೆ ಮತ್ತೆ ಆರಂಭವಾಗುತ್ತವೆ, ಅಥವಾ ಹೆಚ್ಚಿನ ಯೋಜನೆಯಲ್ಲಿ ದೈನಂದಿನ ಮಿತಿಯನ್ನು ಹೆಚ್ಚಿಸಬಹುದು.';

  @override
  String get instantAnswerLimitTitle => 'ನೀವು ನಿಮ್ಮ ಮಿತಿಯನ್ನು ತಲುಪಿದ್ದೀರಿ';

  @override
  String get instantAnswerLimitBody =>
      'ಈ ತಿಂಗಳ ನಿಮ್ಮ ತಕ್ಷಣ ಉತ್ತರಗಳನ್ನು ಬಳಸಿದ್ದೀರಿ. ನಿಮ್ಮ ಪ್ರಶ್ನೆಗಳು ಮುಂದಿನ ತಿಂಗಳು ಮತ್ತೆ ಆರಂಭವಾಗುತ್ತವೆ, ಅಥವಾ ಹೆಚ್ಚಿನ ಯೋಜನೆಯಲ್ಲಿ ಮಿತಿಯನ್ನು ಹೆಚ್ಚಿಸಬಹುದು.';

  @override
  String get instantAnswerUpgradeTitle => 'ಹೆಚ್ಚಿನ ಯೋಜನೆ ಅಗತ್ಯವಿದೆ';

  @override
  String get instantAnswerUpgradeBody =>
      'ತಕ್ಷಣ ಉತ್ತರಗಳು ಹೆಚ್ಚಿನ ಯೋಜನೆಯ ಭಾಗ. ಪ್ರಶ್ನೆ ಕೇಳುತ್ತಿರಲು ದಯವಿಟ್ಟು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get instantAnswerRephrase =>
      'ಅದಕ್ಕೆ ಉತ್ತರಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಪ್ರಶ್ನೆಯನ್ನು ಬೇರೆ ರೀತಿ ಬರೆದು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get instantAnswerBusy =>
      'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String instantAnswerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸುಮಾರು $seconds ಸೆಕೆಂಡ್‌ಗಳಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      one:
          'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸುಮಾರು 1 ಸೆಕೆಂಡ್‌ನಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    );
    return '$_temp0';
  }

  @override
  String get instantAnswerTimeout =>
      'ಇದು ನಿರೀಕ್ಷೆಗಿಂತ ಹೆಚ್ಚು ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get instantAnswerSignIn =>
      'ಈ ಸಾಧನವನ್ನು ಬಳಸಲು ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get settingsTitle => 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು';

  @override
  String get settingsAppearanceTitle => 'ನೋಟ';

  @override
  String get settingsThemeSystem => 'ನನ್ನ ಸಾಧನದಂತೆ';

  @override
  String get settingsThemeLight => 'ತಿಳಿ';

  @override
  String get settingsThemeDark => 'ಗಾಢ';

  @override
  String get settingsLanguageHint =>
      'ಆ್ಯಪ್‌ನ ಭಾಷೆ ಮತ್ತು ನಿಮ್ಮ ಬೋಧನಾ ಸಾಮಗ್ರಿ ಬರೆಯುವ ಭಾಷೆಯನ್ನು ಇದು ನಿರ್ಧರಿಸುತ್ತದೆ.';

  @override
  String get settingsNotificationsTitle => 'ಅಧಿಸೂಚನೆಗಳು';

  @override
  String get settingsNotificationsLabel => 'ಜ್ಞಾಪನೆಗಳು ಮತ್ತು ನವೀಕರಣಗಳು';

  @override
  String get settingsNotificationsHint =>
      'ಹೊಸ ಬೋಧನಾ ಸಾಧನಗಳು ಮತ್ತು ನಿಮ್ಮ ಉಳಿಸಿದ ಕೆಲಸದ ಬಗ್ಗೆ ತಿಳಿಯಿರಿ.';

  @override
  String get settingsVoiceModeTitle => 'ಧ್ವನಿ ಮೋಡ್';

  @override
  String get settingsVoiceModeLabel => 'ಲೈವ್ ಧ್ವನಿ (ಬೀಟಾ)';

  @override
  String get settingsVoiceModeHint =>
      'VIDYA ಜೊತೆ ನೇರವಾಗಿ ಮಾತನಾಡಿ. ಆಫ್ ಇದ್ದಾಗ VIDYA ಕೇಳಿ, ನಂತರ ಒಂದೊಂದು ಸರದಿಯಲ್ಲಿ ಉತ್ತರಿಸುತ್ತದೆ.';

  @override
  String get settingsProfileTitle => 'ಬೋಧನಾ ಪ್ರೊಫೈಲ್';

  @override
  String get settingsProfileHint =>
      'ನಿಮ್ಮ ಸಾಮಗ್ರಿಯನ್ನು ನಿಮ್ಮ ಬೋರ್ಡ್ ಮತ್ತು ತರಗತಿಗೆ ಹೊಂದಿಸಲು ಇದು ನಮಗೆ ಸಹಾಯ ಮಾಡುತ್ತದೆ.';

  @override
  String get settingsBoardLabel => 'ಶಿಕ್ಷಣ ಬೋರ್ಡ್';

  @override
  String get settingsBoardNone => 'ಹೊಂದಿಸಿಲ್ಲ';

  @override
  String get settingsQualificationsLabel => 'ಅರ್ಹತೆಗಳು';

  @override
  String get settingsQualificationsHint =>
      'ನಿಮ್ಮ ಬಳಿ ಇರುವ ಎಲ್ಲಾ ಅರ್ಹತೆಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get settingsAdminRoleLabel => 'ಆಡಳಿತಾತ್ಮಕ ಪಾತ್ರ';

  @override
  String get settingsAdminRoleNone => 'ಹೊಂದಿಸಿಲ್ಲ';

  @override
  String get settingsRoleHod => 'ವಿಭಾಗ ಮುಖ್ಯಸ್ಥ (HoD)';

  @override
  String get settingsRoleCoordinator => 'ಶೈಕ್ಷಣಿಕ ಸಂಯೋಜಕ';

  @override
  String get settingsRoleExamController => 'ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕ';

  @override
  String get settingsRoleVicePrincipal => 'ಉಪ ಪ್ರಾಂಶುಪಾಲರು';

  @override
  String get settingsRolePrincipal => 'ಪ್ರಾಂಶುಪಾಲರು';

  @override
  String get settingsRoleNone => 'ಶಿಕ್ಷಕ, ಯಾವುದೇ ಆಡಳಿತಾತ್ಮಕ ಪಾತ್ರವಿಲ್ಲ';

  @override
  String get settingsSaveProfile => 'ಪ್ರೊಫೈಲ್ ಉಳಿಸಿ';

  @override
  String get settingsProfileSaved => 'ನಿಮ್ಮ ಬೋಧನಾ ಪ್ರೊಫೈಲ್ ಉಳಿಸಲಾಗಿದೆ.';

  @override
  String get settingsSaveFailed =>
      'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಉಳಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get settingsSignedOutTitle => 'ನೀವು ಸೈನ್ ಔಟ್ ಆಗಿದ್ದೀರಿ';

  @override
  String get settingsSignedOutBody =>
      'ನಿಮ್ಮ ಬೋಧನಾ ಪ್ರೊಫೈಲ್ ಮತ್ತು ಖಾತೆಯನ್ನು ನಿರ್ವಹಿಸಲು ಸೈನ್ ಇನ್ ಮಾಡಿ. ನಿಮ್ಮ ಭಾಷೆ ಮತ್ತು ನೋಟದ ಆಯ್ಕೆಗಳು ಹೇಗಿದ್ದರೂ ಈ ಸಾಧನದಲ್ಲಿ ಉಳಿಯುತ್ತವೆ.';

  @override
  String get settingsSignIn => 'ಸೈನ್ ಇನ್ ಮಾಡಿ';

  @override
  String get settingsDangerTitle => 'ಖಾತೆ ಅಳಿಸಿ';

  @override
  String get settingsDangerBody =>
      'ಇದು ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಮುಚ್ಚಿ ನಿಮ್ಮ ಉಳಿಸಿದ ಕೆಲಸವನ್ನು ತೆಗೆದುಹಾಕುತ್ತದೆ. ಶಾಶ್ವತವಾಗಿ ಅಳಿಸುವ ಮೊದಲು ಎಲ್ಲವನ್ನೂ ರಫ್ತು ಮಾಡಲು ನಿಮಗೆ 30 ದಿನ ಇರುತ್ತದೆ.';

  @override
  String get settingsDeleteAction => 'ಖಾತೆ ಅಳಿಸಿ';

  @override
  String get settingsDeleteDialogTitle => 'ನಿಮ್ಮ ಖಾತೆ ಅಳಿಸುವುದೇ?';

  @override
  String get settingsDeleteDialogBody =>
      'ನಿಮ್ಮ ಪಾಠ ಯೋಜನೆಗಳು, ಕ್ವಿಜ್‌ಗಳು ಮತ್ತು ಪ್ರೊಫೈಲ್ ಅಳಿಸಲು ನಿಗದಿಯಾಗುತ್ತವೆ. ತೆಗೆದುಹಾಕುವ ಮೊದಲು ನಿಮ್ಮ ಕೆಲಸವನ್ನು ರಫ್ತು ಮಾಡಲು ನಿಮಗೆ 30 ದಿನ ಇದೆ.';

  @override
  String settingsDeleteConfirmPrompt(String word) {
    return 'ಖಚಿತಪಡಿಸಲು ಕೆಳಗೆ $word ಎಂದು ಟೈಪ್ ಮಾಡಿ.';
  }

  @override
  String get settingsDeleteConfirmLabel => 'ಖಚಿತಪಡಿಸುವಿಕೆ';

  @override
  String get settingsDeleteCancel => 'ನನ್ನ ಖಾತೆ ಉಳಿಸಿಕೊಳ್ಳಿ';

  @override
  String get settingsDeleteConfirm => 'ಖಾತೆ ಅಳಿಸಿ';

  @override
  String get settingsDeleteScheduled =>
      'ನಿಮ್ಮ ಖಾತೆ ಅಳಿಸಲು ನಿಗದಿಯಾಗಿದೆ. ನಿಮ್ಮ ಕೆಲಸವನ್ನು ರಫ್ತು ಮಾಡಲು ನಿಮಗೆ 30 ದಿನ ಇದೆ.';

  @override
  String get settingsDeleteSuccessTitle => 'ಖಾತೆ ಅಳಿಸಲು ನಿಗದಿಯಾಗಿದೆ';

  @override
  String get settingsExportDataAction => 'ನನ್ನ ಡೇಟಾ ರಫ್ತು ಮಾಡಿ';

  @override
  String get settingsExportQueuedMessage =>
      'ನಿಮ್ಮ ರಫ್ತು ತಕ್ಷಣ ಸಿದ್ಧಪಡಿಸಲು ತುಂಬಾ ದೊಡ್ಡದಾಗಿದೆ, ಆದ್ದರಿಂದ ನಾವು ಅದನ್ನು ಸರತಿಯಲ್ಲಿ ಇಟ್ಟಿದ್ದೇವೆ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ, ಅಥವಾ ನಿಮ್ಮ ಡೇಟಾದ ಪ್ರತಿಗಾಗಿ ಬೆಂಬಲ ತಂಡವನ್ನು ಸಂಪರ್ಕಿಸಿ.';

  @override
  String get settingsExportFailedMessage =>
      'ನಿಮ್ಮ ರಫ್ತು ಸಿದ್ಧಪಡಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get settingsDeleteSuccessDone => 'ಆಯಿತು';

  @override
  String get settingsDeleteFailed =>
      'ನಿಮ್ಮ ಖಾತೆ ಅಳಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get settingsReauthTitle => 'ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ';

  @override
  String get settingsReauthBody =>
      'ನಿಮ್ಮ ಸುರಕ್ಷತೆಗಾಗಿ, ಖಾತೆ ಅಳಿಸಲು ಹೊಸದಾಗಿ ಸೈನ್ ಇನ್ ಬೇಕು. ದಯವಿಟ್ಟು ಸೈನ್ ಔಟ್ ಮಾಡಿ, ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ, ಐದು ನಿಮಿಷದೊಳಗೆ ಅಳಿಸಿ.';

  @override
  String get profilePlanLabel => 'ಯೋಜನೆ';

  @override
  String get profilePlanFree => 'ಉಚಿತ';

  @override
  String get profilePlanPro => 'ಪ್ರೊ';

  @override
  String get profilePlanGold => 'ಗೋಲ್ಡ್';

  @override
  String get profilePlanPremium => 'ಪ್ರೀಮಿಯಂ';

  @override
  String get profilePlanUnknown => 'ಲಭ್ಯವಿಲ್ಲ';

  @override
  String get profileNoName => 'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್';

  @override
  String get profileSectionAbout => 'ನಿಮ್ಮ ಬಗ್ಗೆ';

  @override
  String get profileSectionTeaching => 'ನೀವು ಏನು ಬೋಧಿಸುತ್ತೀರಿ';

  @override
  String get profileSectionLocation => 'ನೀವು ಎಲ್ಲಿ ಬೋಧಿಸುತ್ತೀರಿ';

  @override
  String get profileSectionContact => 'ನಾವು ನಿಮ್ಮನ್ನು ಹೇಗೆ ಸಂಪರ್ಕಿಸುವುದು';

  @override
  String get profileNameLabel => 'ನಿಮ್ಮ ಹೆಸರು';

  @override
  String get profileNameHint =>
      'ನೀವು ಹಂಚಿಕೊಳ್ಳುವ ಕೆಲಸದಲ್ಲಿ ಇತರ ಶಿಕ್ಷಕರಿಗೆ ಕಾಣುವ ಹೆಸರು ಇದು.';

  @override
  String get profileNameInvalid => 'ದಯವಿಟ್ಟು ಚಿಕ್ಕ ಹೆಸರನ್ನು ಬಳಸಿ.';

  @override
  String get profileSchoolLabel => 'ಶಾಲೆಯ ಹೆಸರು';

  @override
  String get profileBoardCategoryLabel => 'ಬೋರ್ಡ್ ಪ್ರಕಾರ';

  @override
  String get profileBoardCategoryHint =>
      'ಕೆಳಗಿನ ಪಟ್ಟಿಯನ್ನು ಚಿಕ್ಕದಾಗಿಸಲು ಬೋರ್ಡ್ ಪ್ರಕಾರವನ್ನು ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get profileBoardCategoryState => 'ರಾಜ್ಯ ಬೋರ್ಡ್';

  @override
  String get profileStateLabel => 'ರಾಜ್ಯ';

  @override
  String get profileStateNone => 'ಹೊಂದಿಸಿಲ್ಲ';

  @override
  String get profileDistrictLabel => 'ಜಿಲ್ಲೆ';

  @override
  String get profileDistrictHint => 'ನಿಮ್ಮ ಶಾಲೆ ಇರುವ ಜಿಲ್ಲೆ.';

  @override
  String get profileSubjectsLabel => 'ನೀವು ಬೋಧಿಸುವ ವಿಷಯಗಳು';

  @override
  String get profileSubjectsHint => 'ನಿಮಗೆ ಬೇಕಾದಷ್ಟು ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get profileGradesLabel => 'ನೀವು ಬೋಧಿಸುವ ತರಗತಿಗಳು';

  @override
  String get profileGradesHint => 'ನಿಮಗೆ ಬೇಕಾದಷ್ಟು ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get profileLanguageHint =>
      'ಇದು ಆ್ಯಪ್‌ನ ಉಳಿದ ಭಾಗದ ಭಾಷೆಯ ಆಯ್ಕೆಯೇ, ಆದ್ದರಿಂದ ಇಲ್ಲಿ ಬದಲಾಯಿಸಿದರೆ ಎಲ್ಲೆಡೆ ಬದಲಾಗುತ್ತದೆ.';

  @override
  String get profilePhoneLabel => 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ';

  @override
  String get profilePhoneHint => 'ಐಚ್ಛಿಕ. +91 ಸಹಿತ ಅಥವಾ ಇಲ್ಲದೆ, ಹತ್ತು ಅಂಕೆಗಳು.';

  @override
  String get profilePhoneInvalid =>
      'ದಯವಿಟ್ಟು ಹತ್ತು ಅಂಕೆಗಳ ಭಾರತೀಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ.';

  @override
  String get profilePincodeLabel => 'ಪಿನ್ ಕೋಡ್';

  @override
  String get profilePincodeHint => 'ಐಚ್ಛಿಕ. ಆರು ಅಂಕೆಗಳು.';

  @override
  String get profilePincodeInvalid => 'ದಯವಿಟ್ಟು ಆರು ಅಂಕೆಗಳ ಪಿನ್ ಕೋಡ್ ನಮೂದಿಸಿ.';

  @override
  String get profileEmptyTitle => 'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಖಾಲಿ ಇದೆ';

  @override
  String get profileEmptyBody =>
      'ನಿಮ್ಮ ಶಾಲೆ ಮತ್ತು ತರಗತಿಗಳನ್ನು ಸೇರಿಸಿ, ಆಗ ನೀವು ರಚಿಸುವ ಪ್ರತಿ ಪಾಠ ಯೋಜನೆ ಮತ್ತು ಕ್ವಿಜ್ ನಿಮ್ಮ ತರಗತಿಗೆ ಸಿದ್ಧವಾಗಿ ಬರುತ್ತದೆ.';

  @override
  String get profileLoadFailed =>
      'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ತೆರೆಯಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get profileSignedOutTitle => 'ನೀವು ಸೈನ್ ಔಟ್ ಆಗಿದ್ದೀರಿ';

  @override
  String get profileSignedOutBody =>
      'ನಿಮ್ಮ ಬೋಧನಾ ಪ್ರೊಫೈಲ್ ನೋಡಲು ಮತ್ತು ಸಂಪಾದಿಸಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get profileSaveSignIn =>
      'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಉಳಿಸಲು ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get meTitle => 'ಪ್ರೊಫೈಲ್';

  @override
  String get mePlanUsageTitle => 'ಯೋಜನೆ ಮತ್ತು ಬಳಕೆ';

  @override
  String get mePlanUsageSubtitle => 'ಈ ತಿಂಗಳು ನೀವು ಎಷ್ಟು ಬಳಸಿದ್ದೀರಿ.';

  @override
  String meUsageValue(int used, int limit) {
    return '$used / $limit';
  }

  @override
  String get meUsageUnlimited => 'ಅಪರಿಮಿತ';

  @override
  String get meUsageUnavailable =>
      'ನಿಮ್ಮ ಬಳಕೆಯನ್ನು ನಾವು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get meDefaultsTitle => 'ಡೀಫಾಲ್ಟ್‌ಗಳು';

  @override
  String get mePrivacyTitle => 'ಗೌಪ್ಯತೆ ಮತ್ತು ಸೆಟ್ಟಿಂಗ್‌ಗಳು';

  @override
  String get meRoleTeacher => 'ಶಿಕ್ಷಕ';

  @override
  String get usageFeatureAvatar => 'ಎಐ ಅವತಾರಗಳು';

  @override
  String get usageFeatureVoiceToText => 'ಧ್ವನಿಯಿಂದ ಪಠ್ಯ';

  @override
  String get usageFeatureAssistant => 'VIDYA ಸಹಾಯಕ';

  @override
  String get imageInputHint => 'ಪಠ್ಯಪುಸ್ತಕದ ಪುಟದ ಸ್ಪಷ್ಟ ಫೋಟೋ ಸೇರಿಸಿ.';

  @override
  String get imageInputTakePhoto => 'ಫೋಟೋ ತೆಗೆಯಿರಿ';

  @override
  String get imageInputChooseGallery => 'ಗ್ಯಾಲರಿಯಿಂದ ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get imageInputRetake => 'ಮತ್ತೆ ಫೋಟೋ ತೆಗೆಯಿರಿ';

  @override
  String get imageInputChangeGallery => 'ಬೇರೆ ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get imageInputRemove => 'ಫೋಟೋ ತೆಗೆದುಹಾಕಿ';

  @override
  String get imageInputPreviewLabel => 'ಆಯ್ಕೆ ಮಾಡಿದ ಚಿತ್ರದ ಮುನ್ನೋಟ';

  @override
  String imageInputSizeOfMax(String used, String max) {
    return '$max ರಲ್ಲಿ $used';
  }

  @override
  String imageInputTooLarge(String max) {
    return 'ಈ ಫೋಟೋ ತುಂಬಾ ದೊಡ್ಡದು. ದಯವಿಟ್ಟು $max ಗಿಂತ ಕಡಿಮೆ ಇರುವುದನ್ನು ಆಯ್ಕೆಮಾಡಿ.';
  }

  @override
  String get imageInputPermissionDenied =>
      'ನಿಮ್ಮ ಕ್ಯಾಮೆರಾ ಅಥವಾ ಫೋಟೋಗಳನ್ನು ಬಳಸಲು SahayakAI ಗೆ ಅನುಮತಿ ಬೇಕು. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸಾಧನದ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಅನುಮತಿ ನೀಡಿ.';

  @override
  String get imageInputFailed =>
      'ಆ ಚಿತ್ರವನ್ನು ತೆರೆಯಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get worksheetTitle => 'ಕಾರ್ಯಪತ್ರಿಕೆ';

  @override
  String get worksheetSubtitle => 'ಪಠ್ಯಪುಸ್ತಕದ ಫೋಟೋದಿಂದ ಕಾರ್ಯಪತ್ರಿಕೆ ರಚಿಸಿ';

  @override
  String get worksheetEmpty =>
      'ಪಠ್ಯಪುಸ್ತಕದ ಫೋಟೋ ಮತ್ತು ಸೂಚನೆ ಸೇರಿಸಿ, ನಂತರ ರಚಿಸಿ ಒತ್ತಿರಿ.';

  @override
  String get worksheetImageLabel => 'ಪಠ್ಯಪುಸ್ತಕದ ಪುಟದ ಫೋಟೋ';

  @override
  String get worksheetImageHint => 'ಈ ಪುಟದಿಂದ ಕಾರ್ಯಪತ್ರಿಕೆ ರಚನೆಯಾಗುತ್ತದೆ.';

  @override
  String get toolImageOptionalLabel => 'ಪಠ್ಯಪುಸ್ತಕದ ಪುಟದ ಫೋಟೋ (ಐಚ್ಛಿಕ)';

  @override
  String get toolImageOptionalHint =>
      'ಪುಟದ ಫೋಟೋ ಸೇರಿಸಿದರೆ ಅದೇ ಮುಖ್ಯ ಮೂಲವಾಗುತ್ತದೆ, ಅಥವಾ ಖಾಲಿ ಬಿಡಿ.';

  @override
  String get worksheetImageError => 'ದಯವಿಟ್ಟು ಪಠ್ಯಪುಸ್ತಕದ ಪುಟದ ಫೋಟೋ ಸೇರಿಸಿ.';

  @override
  String get worksheetPromptLabel => 'ನಿಮಗೆ ಯಾವ ಕಾರ್ಯಪತ್ರಿಕೆ ಬೇಕು?';

  @override
  String get worksheetPromptHint =>
      'ಉದಾಹರಣೆಗೆ, ಈ ಪುಟದಿಂದ ಗುಣಾಕಾರದ ಕಾರ್ಯಪತ್ರಿಕೆ ಮಾಡಿ';

  @override
  String get worksheetPromptError =>
      'ದಯವಿಟ್ಟು ನಿಮಗೆ ಬೇಕಾದ ಕಾರ್ಯಪತ್ರಿಕೆಯನ್ನು ವಿವರಿಸಿ.';

  @override
  String get worksheetGradeLabel => 'ತರಗತಿ ಮಟ್ಟ';

  @override
  String get worksheetGradeAny => 'ಯಾವುದೇ ತರಗತಿ';

  @override
  String get worksheetSubjectLabel => 'ವಿಷಯ';

  @override
  String get worksheetSubjectAny => 'ಯಾವುದೇ ವಿಷಯ';

  @override
  String get worksheetOptional => 'ಐಚ್ಛಿಕ';

  @override
  String get worksheetObjectives => 'ಕಲಿಕೆಯ ಉದ್ದೇಶಗಳು';

  @override
  String get worksheetInstructions => 'ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಸೂಚನೆಗಳು';

  @override
  String get worksheetActivities => 'ಚಟುವಟಿಕೆಗಳು';

  @override
  String get worksheetActivityQuestion => 'ಪ್ರಶ್ನೆ';

  @override
  String get worksheetActivityPuzzle => 'ಒಗಟು';

  @override
  String get worksheetActivityCreativeTask => 'ಸೃಜನಾತ್ಮಕ ಕಾರ್ಯ';

  @override
  String get worksheetExplanation => 'ಶಿಕ್ಷಕರಿಗಾಗಿ';

  @override
  String get worksheetChalkboardNote => 'ಕಪ್ಪು ಹಲಗೆಯಲ್ಲಿ';

  @override
  String get worksheetAnswerKey => 'ಉತ್ತರ ಕೀಲಿ';

  @override
  String get worksheetNoContent =>
      'ಆ ಪುಟಕ್ಕೆ ಯಾವುದೇ ಕಾರ್ಯಪತ್ರಿಕೆ ಬರಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ಪಷ್ಟ ಫೋಟೋ ಅಥವಾ ಬೇರೆ ಸೂಚನೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get worksheetSave => 'ಗ್ರಂಥಾಲಯಕ್ಕೆ ಉಳಿಸಿ';

  @override
  String get worksheetSaving => 'ಉಳಿಸಲಾಗುತ್ತಿದೆ';

  @override
  String get worksheetSaved => 'ನಿಮ್ಮ ಗ್ರಂಥಾಲಯಕ್ಕೆ ಉಳಿಸಲಾಗಿದೆ';

  @override
  String get worksheetSaveFailedTitle => 'ಉಳಿಸಲಾಗಲಿಲ್ಲ';

  @override
  String get worksheetSaveFailedBody =>
      'ಈ ಕಾರ್ಯಪತ್ರಿಕೆಯನ್ನು ನಿಮ್ಮ ಗ್ರಂಥಾಲಯಕ್ಕೆ ಉಳಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get worksheetSaveRetry => 'ಮತ್ತೆ ಉಳಿಸಲು ಪ್ರಯತ್ನಿಸಿ';

  @override
  String get worksheetUpgradeTitle => 'ಹೆಚ್ಚಿನ ಯೋಜನೆ ಅಗತ್ಯವಿದೆ';

  @override
  String get worksheetUpgradeBody =>
      'ಕಾರ್ಯಪತ್ರಿಕೆ ರಚನೆ ಹೆಚ್ಚಿನ ಯೋಜನೆಯ ಭಾಗ. ಕಾರ್ಯಪತ್ರಿಕೆಗಳನ್ನು ರಚಿಸುತ್ತಿರಲು ದಯವಿಟ್ಟು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get worksheetLimitTitle => 'ನೀವು ನಿಮ್ಮ ಮಿತಿಯನ್ನು ತಲುಪಿದ್ದೀರಿ';

  @override
  String get worksheetLimitBody =>
      'ಸದ್ಯಕ್ಕೆ ನಿಮ್ಮ ಕಾರ್ಯಪತ್ರಿಕೆಗಳನ್ನು ಬಳಸಿದ್ದೀರಿ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ನಿಮ್ಮ ಯೋಜನೆಯನ್ನು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get worksheetSeePricing => 'ಯೋಜನೆಗಳು ಮತ್ತು ಬೆಲೆಗಳನ್ನು ನೋಡಿ';

  @override
  String get worksheetRephrase =>
      'ಅದರಿಂದ ಕಾರ್ಯಪತ್ರಿಕೆ ರಚಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ಪಷ್ಟ ಫೋಟೋ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ನಿಮ್ಮ ಸೂಚನೆಯನ್ನು ಬೇರೆ ರೀತಿ ಬರೆಯಿರಿ.';

  @override
  String get worksheetBusy =>
      'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get worksheetTimeout =>
      'ಇದು ನಿರೀಕ್ಷೆಗಿಂತ ಹೆಚ್ಚು ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get worksheetSignIn =>
      'ಈ ಸಾಧನವನ್ನು ಬಳಸಲು ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get rubricTitle => 'ರೂಬ್ರಿಕ್';

  @override
  String get rubricSubtitle => 'ಅಸೈನ್‌ಮೆಂಟ್‌ಗೆ ಮೌಲ್ಯಮಾಪನ ರೂಬ್ರಿಕ್ ರಚಿಸಿ';

  @override
  String get rubricEmpty => 'ಅಸೈನ್‌ಮೆಂಟ್ ಅನ್ನು ವಿವರಿಸಿ, ನಂತರ ರಚಿಸಿ ಒತ್ತಿರಿ.';

  @override
  String get rubricAssignmentLabel => 'ಅಸೈನ್‌ಮೆಂಟ್ ಏನು?';

  @override
  String get rubricAssignmentHint => 'ಈ ಅಸೈನ್‌ಮೆಂಟ್‌ಗೆ ರೂಬ್ರಿಕ್ ಅಂಕ ನೀಡುತ್ತದೆ.';

  @override
  String get rubricAssignmentPlaceholder =>
      'ಉದಾಹರಣೆಗೆ, ನವೀಕರಿಸಬಹುದಾದ ಶಕ್ತಿಯ ಬಗ್ಗೆ 5ನೇ ತರಗತಿಯ ಯೋಜನೆ';

  @override
  String get rubricAssignmentError => 'ದಯವಿಟ್ಟು ಅಸೈನ್‌ಮೆಂಟ್ ಅನ್ನು ವಿವರಿಸಿ.';

  @override
  String get rubricGradeLabel => 'ತರಗತಿ ಮಟ್ಟ';

  @override
  String get rubricGradeAny => 'ಯಾವುದೇ ತರಗತಿ';

  @override
  String get rubricSubjectLabel => 'ವಿಷಯ';

  @override
  String get rubricSubjectAny => 'ಯಾವುದೇ ವಿಷಯ';

  @override
  String get rubricOptional => 'ಐಚ್ಛಿಕ';

  @override
  String get rubricCriteriaColumn => 'ಮಾನದಂಡಗಳು';

  @override
  String rubricPoints(String points) {
    return '$points ಅಂಕ';
  }

  @override
  String get rubricScrollHint => 'ಎಲ್ಲಾ ಮಟ್ಟಗಳನ್ನು ನೋಡಲು ಅಡ್ಡಲಾಗಿ ಸ್ವೈಪ್ ಮಾಡಿ.';

  @override
  String get rubricNoContent =>
      'ಅದಕ್ಕೆ ಯಾವುದೇ ರೂಬ್ರಿಕ್ ಬರಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಅಸೈನ್‌ಮೆಂಟ್ ಅನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ವಿವರಿಸಿ.';

  @override
  String get rubricUpgradeTitle => 'ಹೆಚ್ಚಿನ ಯೋಜನೆ ಅಗತ್ಯವಿದೆ';

  @override
  String get rubricUpgradeBody =>
      'ರೂಬ್ರಿಕ್ ರಚನೆ ಹೆಚ್ಚಿನ ಯೋಜನೆಯ ಭಾಗ. ರೂಬ್ರಿಕ್ ರಚಿಸುತ್ತಿರಲು ದಯವಿಟ್ಟು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get rubricLimitTitle => 'ನೀವು ನಿಮ್ಮ ಮಿತಿಯನ್ನು ತಲುಪಿದ್ದೀರಿ';

  @override
  String get rubricLimitBody =>
      'ಸದ್ಯಕ್ಕೆ ನಿಮ್ಮ ರೂಬ್ರಿಕ್‌ಗಳನ್ನು ಬಳಸಿದ್ದೀರಿ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ನಿಮ್ಮ ಯೋಜನೆಯನ್ನು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get rubricRephrase =>
      'ಅದರಿಂದ ರೂಬ್ರಿಕ್ ರಚಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಅಸೈನ್‌ಮೆಂಟ್ ಅನ್ನು ಬೇರೆ ರೀತಿ ಬರೆದು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get rubricBusy =>
      'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get rubricTimeout =>
      'ಇದು ನಿರೀಕ್ಷೆಗಿಂತ ಹೆಚ್ಚು ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get rubricSignIn => 'ಈ ಸಾಧನವನ್ನು ಬಳಸಲು ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get examPaperTitle => 'ಪ್ರಶ್ನೆಪತ್ರಿಕೆ';

  @override
  String get examPaperSubtitle =>
      'ಉತ್ತರ ಕೀಲಿ ಸಹಿತ ಬೋರ್ಡ್ ಮಾದರಿಯ ಪ್ರಶ್ನೆಪತ್ರಿಕೆ ರಚಿಸಿ';

  @override
  String get examPaperEmpty =>
      'ಬೋರ್ಡ್, ತರಗತಿ ಮತ್ತು ವಿಷಯ ಆಯ್ಕೆಮಾಡಿ, ನಂತರ ರಚಿಸಿ ಒತ್ತಿರಿ.';

  @override
  String get examPaperBoardLabel => 'ಬೋರ್ಡ್';

  @override
  String get examPaperBoardHint => 'ಬೋರ್ಡ್ ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get examPaperBoardError => 'ದಯವಿಟ್ಟು ಒಂದು ಬೋರ್ಡ್ ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get examPaperGradeLabel => 'ತರಗತಿ ಮಟ್ಟ';

  @override
  String get examPaperGradeHint => 'ತರಗತಿ ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get examPaperGradeError => 'ದಯವಿಟ್ಟು ತರಗತಿ ಮಟ್ಟ ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get examPaperSubjectLabel => 'ವಿಷಯ';

  @override
  String get examPaperSubjectHint => 'ವಿಷಯ ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get examPaperSubjectError => 'ದಯವಿಟ್ಟು ವಿಷಯ ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get examPaperSubjectOther => 'ಬೇರೆ ವಿಷಯ';

  @override
  String get examPaperSubjectOtherLabel => 'ವಿಷಯದ ಹೆಸರು';

  @override
  String get examPaperSubjectOtherHint => 'ಉದಾಹರಣೆಗೆ, ಅರ್ಥಶಾಸ್ತ್ರ';

  @override
  String get examPaperSubjectOtherError => 'ದಯವಿಟ್ಟು ಒಂದು ವಿಷಯ ನಮೂದಿಸಿ.';

  @override
  String get examPaperChaptersLabel => 'ಅಧ್ಯಾಯಗಳು';

  @override
  String get examPaperChaptersHint =>
      'ಒಳಗೊಳ್ಳಬೇಕಾದ ಅಧ್ಯಾಯಗಳನ್ನು ಸೇರಿಸಿ. ಅಧಿಕೃತ ನೀಲನಕ್ಷೆ ಇರುವಲ್ಲಿ ಪೂರ್ಣ ಪಠ್ಯಕ್ರಮಕ್ಕಾಗಿ ಖಾಲಿ ಬಿಡಿ.';

  @override
  String get examPaperChaptersPlaceholder => 'ಉದಾಹರಣೆಗೆ, ವರ್ಗ ಸಮೀಕರಣಗಳು';

  @override
  String get examPaperChaptersAdd => 'ಅಧ್ಯಾಯ ಸೇರಿಸಿ';

  @override
  String get examPaperChaptersError =>
      'ಈ ಬೋರ್ಡ್, ತರಗತಿ ಮತ್ತು ವಿಷಯಕ್ಕೆ ದಯವಿಟ್ಟು ಕನಿಷ್ಠ ಒಂದು ಅಧ್ಯಾಯ ಸೇರಿಸಿ.';

  @override
  String get examPaperDifficultyLabel => 'ಕಠಿಣತೆ';

  @override
  String get examPaperDifficultyEasy => 'ಸುಲಭ';

  @override
  String get examPaperDifficultyModerate => 'ಸಾಧಾರಣ';

  @override
  String get examPaperDifficultyHard => 'ಕಠಿಣ';

  @override
  String get examPaperDifficultyMixed => 'ಮಿಶ್ರ';

  @override
  String get examPaperIncludeAnswerKey => 'ಉತ್ತರ ಕೀಲಿ ಸೇರಿಸಿ';

  @override
  String get examPaperIncludeMarkingScheme => 'ಅಂಕ ಹಂಚಿಕೆ ಸೇರಿಸಿ';

  @override
  String get examPaperInProgressTitle => 'ನಿಮ್ಮ ಪ್ರಶ್ನೆಪತ್ರಿಕೆ ಸಿದ್ಧವಾಗುತ್ತಿದೆ';

  @override
  String get examPaperInProgressBody =>
      'ಪೂರ್ಣ ಬೋರ್ಡ್ ಪ್ರಶ್ನೆಪತ್ರಿಕೆ ರಚಿಸಲು ಸ್ವಲ್ಪ ಹೆಚ್ಚು ಸಮಯ ಬೇಕು. ನಾವು ಈಗ ಅದನ್ನು ಪೂರ್ಣಗೊಳಿಸುತ್ತಿದ್ದೇವೆ, ಅದು ನಿಮಗಾಗಿ ಉಳಿಯುತ್ತದೆ.';

  @override
  String get examPaperInProgressLibraryHint =>
      'ಒಂದು ನಿಮಿಷದಲ್ಲಿ ಗ್ರಂಥಾಲಯ ಟ್ಯಾಬ್ ತೆರೆದು ನಿಮ್ಮ ಸಿದ್ಧ ಪ್ರಶ್ನೆಪತ್ರಿಕೆಯನ್ನು ನೋಡಿ.';

  @override
  String examPaperMaxMarks(String marks) {
    return 'ಗರಿಷ್ಠ ಅಂಕ $marks';
  }

  @override
  String examPaperMarks(String marks) {
    return '$marks ಅಂಕ';
  }

  @override
  String examPaperSectionMarks(String marks) {
    return '$marks ಅಂಕ';
  }

  @override
  String examPaperPercent(String value) {
    return '$value ಶೇಕಡಾ';
  }

  @override
  String get examPaperGeneralInstructions => 'ಸಾಮಾನ್ಯ ಸೂಚನೆಗಳು';

  @override
  String get examPaperInternalChoice => 'ಅಥವಾ ಪ್ರಯತ್ನಿಸಿ';

  @override
  String get examPaperAnswerKey => 'ಉತ್ತರ';

  @override
  String get examPaperMarkingScheme => 'ಅಂಕ ಹಂಚಿಕೆ';

  @override
  String get examPaperBlueprintTitle => 'ನೀಲನಕ್ಷೆ ಸಾರಾಂಶ';

  @override
  String get examPaperBlueprintChapters => 'ಅಧ್ಯಾಯವಾರು ಅಂಕಗಳು';

  @override
  String get examPaperBlueprintDifficulty => 'ಕಠಿಣತೆ ಹಂಚಿಕೆ';

  @override
  String get examPaperPyqTitle => 'ಹಿಂದಿನ ವರ್ಷದ ಪ್ರಶ್ನೆಗಳು';

  @override
  String examPaperPyqChapterYear(String chapter, int year) {
    return '$chapter ($year)';
  }

  @override
  String examPaperPyqYear(int year) {
    return 'ವರ್ಷ $year';
  }

  @override
  String get examPaperNoContent =>
      'ಅದಕ್ಕೆ ಯಾವುದೇ ಪ್ರಶ್ನೆಪತ್ರಿಕೆ ಬರಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಕಡಿಮೆ ಅಧ್ಯಾಯಗಳು ಅಥವಾ ಬೇರೆ ವಿಷಯ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get examPaperUnstructuredTitle =>
      'ಆ ಪ್ರಶ್ನೆಪತ್ರಿಕೆಯನ್ನು ರೂಪಿಸಲಾಗಲಿಲ್ಲ';

  @override
  String get examPaperUnstructuredBody =>
      'ಸಹಾಯಕ ಇದನ್ನು ಪೂರ್ಣ ಪ್ರಶ್ನೆಪತ್ರಿಕೆಯಾಗಿ ಜೋಡಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಕೆಲವು ಅಧ್ಯಾಯಗಳನ್ನು ತೆಗೆದು ಮತ್ತೆ ರಚಿಸಿ.';

  @override
  String get examPaperUpgradeTitle => 'ಹೆಚ್ಚಿನ ಯೋಜನೆ ಅಗತ್ಯವಿದೆ';

  @override
  String get examPaperUpgradeBody =>
      'ಪ್ರಶ್ನೆಪತ್ರಿಕೆ ರಚನೆ ಹೆಚ್ಚಿನ ಯೋಜನೆಯ ಭಾಗ. ಪ್ರಶ್ನೆಪತ್ರಿಕೆಗಳನ್ನು ರಚಿಸುತ್ತಿರಲು ದಯವಿಟ್ಟು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get examPaperLimitTitle => 'ನೀವು ನಿಮ್ಮ ಮಿತಿಯನ್ನು ತಲುಪಿದ್ದೀರಿ';

  @override
  String get examPaperLimitBody =>
      'ಸದ್ಯಕ್ಕೆ ನಿಮ್ಮ ಪ್ರಶ್ನೆಪತ್ರಿಕೆಗಳನ್ನು ಬಳಸಿದ್ದೀರಿ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ನಿಮ್ಮ ಯೋಜನೆಯನ್ನು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get examPaperRephrase =>
      'ಅದರಿಂದ ಪ್ರಶ್ನೆಪತ್ರಿಕೆ ರಚಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಅಧ್ಯಾಯಗಳನ್ನು ಸರಿಪಡಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get examPaperBusy =>
      'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get examPaperTimeout =>
      'ಇದು ನಿರೀಕ್ಷೆಗಿಂತ ಹೆಚ್ಚು ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get examPaperSignIn =>
      'ಈ ಸಾಧನವನ್ನು ಬಳಸಲು ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get teacherTrainingTitle => 'ಬೋಧನಾ ಮಾರ್ಗದರ್ಶಕ';

  @override
  String get teacherTrainingSubtitle => 'ಬೋಧನಾ ಪ್ರಶ್ನೆಗೆ ಸಲಹೆ ಮತ್ತು ತಂತ್ರ';

  @override
  String get teacherTrainingAction => 'ಸಲಹೆ ಪಡೆಯಿರಿ';

  @override
  String get teacherTrainingEmpty =>
      'ಬೋಧನಾಶಾಸ್ತ್ರ ಆಧಾರಿತ ತಂತ್ರಗಳನ್ನು ಪಡೆಯಲು ಒಂದು ಬೋಧನಾ ಪ್ರಶ್ನೆ ಕೇಳಿ.';

  @override
  String get teacherTrainingQuestionLabel => 'ನಿಮ್ಮ ಪ್ರಶ್ನೆ';

  @override
  String get teacherTrainingQuestionHint =>
      'ಪಾಠ ರಚನೆ, ತರಗತಿ ನಿರ್ವಹಣೆ ಅಥವಾ ಮೌಲ್ಯಮಾಪನದ ಬಗ್ಗೆ ಕೇಳಿ.';

  @override
  String get teacherTrainingQuestionPlaceholder =>
      'ಉದಾಹರಣೆಗೆ, 40 ಮಕ್ಕಳ ತರಗತಿಯನ್ನು ಪೂರ್ಣ ಪಾಠದುದ್ದಕ್ಕೂ ತೊಡಗಿಸಿಕೊಳ್ಳುವುದು ಹೇಗೆ?';

  @override
  String get teacherTrainingQuestionError => 'ದಯವಿಟ್ಟು ಒಂದು ಪ್ರಶ್ನೆ ನಮೂದಿಸಿ.';

  @override
  String get teacherTrainingSubjectLabel => 'ವಿಷಯ';

  @override
  String get teacherTrainingSubjectAny => 'ಯಾವುದೇ ವಿಷಯ';

  @override
  String get teacherTrainingOptional => 'ಐಚ್ಛಿಕ';

  @override
  String get teacherTrainingStrategiesTitle => 'ತಂತ್ರಗಳು';

  @override
  String get teacherTrainingSectionQuestion => 'ಪ್ರಶ್ನೆ';

  @override
  String get teacherTrainingResultTitle => 'ಮಾರ್ಗದರ್ಶನ ಟಿಪ್ಪಣಿಗಳು';

  @override
  String get teacherTrainingNoContent =>
      'ಅದಕ್ಕೆ ಯಾವುದೇ ಸಲಹೆ ಬರಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ಪಷ್ಟ ಪ್ರಶ್ನೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get teacherTrainingUpgradeTitle => 'ಹೆಚ್ಚಿನ ಯೋಜನೆ ಅಗತ್ಯವಿದೆ';

  @override
  String get teacherTrainingUpgradeBody =>
      'ಬೋಧನಾ ಮಾರ್ಗದರ್ಶಕ ಹೆಚ್ಚಿನ ಯೋಜನೆಯ ಭಾಗ. ಕೇಳುತ್ತಿರಲು ದಯವಿಟ್ಟು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get teacherTrainingLimitTitle => 'ನೀವು ನಿಮ್ಮ ಮಿತಿಯನ್ನು ತಲುಪಿದ್ದೀರಿ';

  @override
  String get teacherTrainingLimitBody =>
      'ಸದ್ಯಕ್ಕೆ ಬೋಧನಾ ಮಾರ್ಗದರ್ಶಕವನ್ನು ಬಳಸಿದ್ದೀರಿ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ನಿಮ್ಮ ಯೋಜನೆಯನ್ನು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get teacherTrainingSeePricing => 'ಯೋಜನೆಗಳು ಮತ್ತು ಬೆಲೆಗಳನ್ನು ನೋಡಿ';

  @override
  String get teacherTrainingRephrase =>
      'ಅದರಿಂದ ಸಲಹೆ ರಚಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಪ್ರಶ್ನೆಯನ್ನು ಬೇರೆ ರೀತಿ ಬರೆದು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get teacherTrainingBusy =>
      'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String teacherTrainingBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸುಮಾರು $seconds ಸೆಕೆಂಡ್‌ಗಳಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      one:
          'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸುಮಾರು 1 ಸೆಕೆಂಡ್‌ನಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    );
    return '$_temp0';
  }

  @override
  String get teacherTrainingTimeout =>
      'ಇದು ನಿರೀಕ್ಷೆಗಿಂತ ಹೆಚ್ಚು ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get teacherTrainingSignIn =>
      'ಈ ಸಾಧನವನ್ನು ಬಳಸಲು ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get parentMessageTitle => 'ಪೋಷಕರಿಗೆ ಸಂದೇಶ';

  @override
  String get parentMessageSubtitle => 'ಪೋಷಕರ ಭಾಷೆಯಲ್ಲಿ ಮನೆಗೆ ಸಂದೇಶ ಬರೆಯಿರಿ';

  @override
  String get parentMessageAction => 'ಸಂದೇಶ ರಚಿಸಿ';

  @override
  String get parentMessageEmpty =>
      'ವಿದ್ಯಾರ್ಥಿ ಮತ್ತು ಕಾರಣವನ್ನು ತಿಳಿಸಿ, ಪೋಷಕರ ಭಾಷೆಯಲ್ಲಿ ಕಾಳಜಿಯ ಸಂದೇಶ ಸಿದ್ಧವಾಗುತ್ತದೆ.';

  @override
  String get parentMessageStudentLabel => 'ವಿದ್ಯಾರ್ಥಿಯ ಹೆಸರು';

  @override
  String get parentMessageStudentPlaceholder =>
      'ಸಂದೇಶ ಯಾರ ಬಗ್ಗೆ ಇದೆಯೋ ಆ ವಿದ್ಯಾರ್ಥಿ';

  @override
  String get parentMessageStudentError => 'ದಯವಿಟ್ಟು ವಿದ್ಯಾರ್ಥಿಯ ಹೆಸರು ನಮೂದಿಸಿ.';

  @override
  String get parentMessageClassLabel => 'ತರಗತಿ';

  @override
  String get parentMessageClassPlaceholder => 'ಉದಾಹರಣೆಗೆ, 6A ತರಗತಿ';

  @override
  String get parentMessageClassError => 'ದಯವಿಟ್ಟು ತರಗತಿ ನಮೂದಿಸಿ.';

  @override
  String get parentMessageSubjectLabel => 'ವಿಷಯ';

  @override
  String get parentMessageSubjectHint => 'ಒಂದು ವಿಷಯ ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get parentMessageSubjectError => 'ದಯವಿಟ್ಟು ವಿಷಯ ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get parentMessageReasonLabel => 'ಸಂದೇಶದ ಕಾರಣ';

  @override
  String get parentMessageReasonHint => 'ಒಂದು ಕಾರಣ ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get parentMessageReasonError => 'ದಯವಿಟ್ಟು ಕಾರಣ ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get parentMessageReasonAbsences => 'ಪದೇ ಪದೇ ಗೈರುಹಾಜರಿ';

  @override
  String get parentMessageReasonPerformance => 'ಶೈಕ್ಷಣಿಕ ಬೆಂಬಲ';

  @override
  String get parentMessageReasonBehavior => 'ತರಗತಿಯಲ್ಲಿ ವರ್ತನೆ';

  @override
  String get parentMessageReasonPositive => 'ಹಂಚಿಕೊಳ್ಳಲು ಒಳ್ಳೆಯ ಸುದ್ದಿ';

  @override
  String get parentMessageAbsentDaysLabel => 'ಗೈರುಹಾಜರಾದ ದಿನಗಳು';

  @override
  String get parentMessageAbsentDaysHint =>
      'ವಿದ್ಯಾರ್ಥಿ ಸತತವಾಗಿ ಎಷ್ಟು ದಿನ ಗೈರುಹಾಜರಾಗಿದ್ದಾರೆ.';

  @override
  String get parentMessageAbsentDaysPlaceholder => 'ಉದಾಹರಣೆಗೆ, 3';

  @override
  String get parentMessageParentLanguageLabel => 'ಪೋಷಕರ ಭಾಷೆ';

  @override
  String get parentMessageParentLanguageHint =>
      'ಸಂದೇಶ ಈ ಭಾಷೆಯಲ್ಲಿ ಬರೆಯಲಾಗುತ್ತದೆ, ಇದು ಆ್ಯಪ್‌ನ ಭಾಷೆಗಿಂತ ಬೇರೆಯಾಗಿರಬಹುದು.';

  @override
  String get parentMessageParentLanguagePlaceholder => 'ಪೋಷಕರ ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get parentMessageParentLanguageError =>
      'ದಯವಿಟ್ಟು ಪೋಷಕರ ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get parentMessageContextLabel => 'ಇದಕ್ಕೆ ಕಾರಣ ಏನು?';

  @override
  String get parentMessageContextHint =>
      'ಪರಿಸ್ಥಿತಿಯ ಬಗ್ಗೆ ಸಣ್ಣ ಟಿಪ್ಪಣಿ ಸಂದೇಶವನ್ನು ರೂಪಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.';

  @override
  String get parentMessageContextPlaceholder =>
      'ಉದಾಹರಣೆಗೆ, ಭಿನ್ನರಾಶಿಗಳ ಕಳೆದ ಎರಡು ವಾರ ತಪ್ಪಿಸಿಕೊಂಡರು';

  @override
  String get parentMessageNoteLabel => 'ವಿಶೇಷವಾಗಿ ಹೇಳಬೇಕಾದದ್ದು ಇದೆಯೇ?';

  @override
  String get parentMessageNoteHint =>
      'ಇಲ್ಲಿನ ವಿವರವನ್ನು ಸಂದೇಶದಲ್ಲಿ ಸೇರಿಸಲಾಗುತ್ತದೆ.';

  @override
  String get parentMessageNotePlaceholder =>
      'ಉದಾಹರಣೆಗೆ, ಗುಂಪು ಕೆಲಸದಲ್ಲಿ ಚೆನ್ನಾಗಿ ಮಾಡುತ್ತಿದ್ದಾರೆ';

  @override
  String get parentMessageTeacherNameLabel => 'ನಿಮ್ಮ ಹೆಸರು';

  @override
  String get parentMessageTeacherNameHint =>
      'ಸಂದೇಶದ ಕೊನೆಯಲ್ಲಿ ಬರುತ್ತದೆ. ಖಾಲಿ ಬಿಟ್ಟರೆ ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಹೆಸರು ಬಳಕೆಯಾಗುತ್ತದೆ.';

  @override
  String get parentMessageTeacherNamePlaceholder => 'ಉದಾಹರಣೆಗೆ, ಶ್ರೀಮತಿ ರಾವ್';

  @override
  String get parentMessageSchoolNameLabel => 'ಶಾಲೆಯ ಹೆಸರು';

  @override
  String get parentMessageSchoolNamePlaceholder => 'ನಿಮ್ಮ ಶಾಲೆಯ ಹೆಸರು';

  @override
  String get parentMessageOptional => 'ಐಚ್ಛಿಕ';

  @override
  String parentMessageWordCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಪದಗಳು',
      one: '1 ಪದ',
    );
    return '$_temp0';
  }

  @override
  String get parentMessageSectionMessage => 'ಸಂದೇಶ';

  @override
  String get parentMessageSectionDetails => 'ಹೆಚ್ಚುವರಿ ವಿವರಗಳು';

  @override
  String get parentMessageResultTitle => 'ಪೋಷಕರಿಗೆ ಸಂದೇಶ';

  @override
  String get parentMessageNoContent =>
      'ಅದಕ್ಕೆ ಯಾವುದೇ ಸಂದೇಶ ಬರಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಹೆಚ್ಚು ವಿವರ ಸೇರಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get parentMessageMissingFields =>
      'ದಯವಿಟ್ಟು ವಿದ್ಯಾರ್ಥಿ, ತರಗತಿ, ವಿಷಯ, ಕಾರಣ ಮತ್ತು ಪೋಷಕರ ಭಾಷೆಯನ್ನು ಭರ್ತಿ ಮಾಡಿ, ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get parentMessageUpgradeTitle => 'ಹೆಚ್ಚಿನ ಯೋಜನೆ ಅಗತ್ಯವಿದೆ';

  @override
  String get parentMessageUpgradeBody =>
      'ಪೋಷಕರಿಗೆ ಸಂದೇಶಗಳು ಹೆಚ್ಚಿನ ಯೋಜನೆಯ ಭಾಗ. ಅವುಗಳನ್ನು ರಚಿಸುತ್ತಿರಲು ದಯವಿಟ್ಟು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get parentMessageLimitTitle => 'ನೀವು ನಿಮ್ಮ ಮಿತಿಯನ್ನು ತಲುಪಿದ್ದೀರಿ';

  @override
  String get parentMessageLimitBody =>
      'ಸದ್ಯಕ್ಕೆ ನಿಮ್ಮ ಪೋಷಕರ ಸಂದೇಶಗಳನ್ನು ರಚಿಸಿದ್ದೀರಿ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ನಿಮ್ಮ ಯೋಜನೆಯನ್ನು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get parentMessageSeePricing => 'ಯೋಜನೆಗಳು ಮತ್ತು ಬೆಲೆಗಳನ್ನು ನೋಡಿ';

  @override
  String get parentMessageBusy =>
      'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String parentMessageBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸುಮಾರು $seconds ಸೆಕೆಂಡ್‌ಗಳಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      one:
          'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸುಮಾರು 1 ಸೆಕೆಂಡ್‌ನಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    );
    return '$_temp0';
  }

  @override
  String get parentMessageTimeout =>
      'ಇದು ನಿರೀಕ್ಷೆಗಿಂತ ಹೆಚ್ಚು ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get parentMessageSignIn =>
      'ಈ ಸಾಧನವನ್ನು ಬಳಸಲು ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get assessTitle => 'ಅಸೈನ್‌ಮೆಂಟ್ ಮೌಲ್ಯಮಾಪನ';

  @override
  String get assessSubtitle => 'ಫೋಟೋದಿಂದ ವಿದ್ಯಾರ್ಥಿಯ ಕೈಬರಹದ ಕೆಲಸಕ್ಕೆ ಅಂಕ ನೀಡಿ';

  @override
  String get assessEmpty =>
      'ವಿದ್ಯಾರ್ಥಿಯ ಕೆಲಸದ ಫೋಟೋ ಸೇರಿಸಿ, ನಂತರ ಮೌಲ್ಯಮಾಪನ ಒತ್ತಿರಿ.';

  @override
  String get assessSubmit => 'ಮೌಲ್ಯಮಾಪನ';

  @override
  String get assessImageLabel => 'ವಿದ್ಯಾರ್ಥಿಯ ಕೆಲಸದ ಫೋಟೋ';

  @override
  String get assessImageHint => 'ಪೂರ್ಣ ಪುಟದ ಸ್ಪಷ್ಟ ಫೋಟೋ ತೆಗೆಯಿರಿ.';

  @override
  String get assessImageError => 'ದಯವಿಟ್ಟು ವಿದ್ಯಾರ್ಥಿಯ ಕೆಲಸದ ಫೋಟೋ ಸೇರಿಸಿ.';

  @override
  String get assessModeLabel => 'ನಿಮಗೆ ಏನು ಬೇಕು?';

  @override
  String get assessModeHint =>
      'ಪೂರ್ಣ ಪರಿಶೀಲನೆ ಕೆಲಸವನ್ನು ಓದಿ ಅಂಕ ನೀಡುತ್ತದೆ. ಓದುವುದು ಮಾತ್ರ ಬರಹದ ಪಠ್ಯವನ್ನಷ್ಟೇ ನೀಡುತ್ತದೆ. ಪಠ್ಯಕ್ಕೆ ಅಂಕ ನೀವು ಅಂಟಿಸುವ ಪಠ್ಯಕ್ಕೆ ಅಂಕ ನೀಡುತ್ತದೆ.';

  @override
  String get assessModeFull => 'ಪೂರ್ಣ ಪರಿಶೀಲನೆ';

  @override
  String get assessModeTranscribe => 'ಓದುವುದು ಮಾತ್ರ';

  @override
  String get assessModeScore => 'ಪಠ್ಯಕ್ಕೆ ಅಂಕ';

  @override
  String get assessTranscriptLabel => 'ಸರಿಪಡಿಸಿದ ಪಠ್ಯ';

  @override
  String get assessTranscriptHint =>
      'ಫೋಟೋವನ್ನು ಮತ್ತೆ ಓದುವ ಬದಲು ಅಂಕ ನೀಡಲು ಸರಿಪಡಿಸಿದ ಪಠ್ಯವನ್ನು ಅಂಟಿಸಿ.';

  @override
  String get assessTranscriptPlaceholder =>
      'ವಿದ್ಯಾರ್ಥಿಯ ಸರಿಪಡಿಸಿದ ಉತ್ತರಗಳನ್ನು ಟೈಪ್ ಮಾಡಿ ಅಥವಾ ಅಂಟಿಸಿ';

  @override
  String get assessOptional => 'ಐಚ್ಛಿಕ';

  @override
  String get assessRubricNote =>
      'ರೂಬ್ರಿಕ್ ಇಲ್ಲದಿದ್ದರೆ ಕೆಲಸಕ್ಕೆ ಸಾಮಾನ್ಯ ರೂಬ್ರಿಕ್ ಪ್ರಕಾರ ಅಂಕ ನೀಡಲಾಗುತ್ತದೆ: ತಿಳಿವಳಿಕೆ, ನಿಖರತೆ, ನಿರೂಪಣೆ ಮತ್ತು ಪೂರ್ಣತೆ.';

  @override
  String get assessPrivacyNote =>
      'ಮೌಲ್ಯಮಾಪನಕ್ಕಾಗಿ ವಿದ್ಯಾರ್ಥಿಯ ಹೆಸರನ್ನು ಎಂದಿಗೂ ಕಳುಹಿಸಲಾಗುವುದಿಲ್ಲ.';

  @override
  String get assessScoreLabel => 'ಒಟ್ಟು ಅಂಕ';

  @override
  String get assessScoreOutOf => '100 ರಲ್ಲಿ';

  @override
  String assessPoints(String earned, String possible) {
    return '$possible ಅಂಕಗಳಲ್ಲಿ $earned';
  }

  @override
  String assessConfidence(String percent) {
    return 'ವಿಶ್ವಾಸ $percent%';
  }

  @override
  String assessRubricUsed(String title) {
    return 'ಮೌಲ್ಯಮಾಪನದ ಆಧಾರ: $title';
  }

  @override
  String get assessLowConfidence => 'ಕಡಿಮೆ ವಿಶ್ವಾಸ';

  @override
  String get assessTranscriptSection => 'ವಿದ್ಯಾರ್ಥಿ ಬರೆದದ್ದು';

  @override
  String get assessCriteriaSection => 'ಮಾನದಂಡವಾರು ಅಂಕಗಳು';

  @override
  String assessCriterionPoints(String points, String max) {
    return '$points / $max';
  }

  @override
  String get assessStrengthsSection => 'ಸಾಮರ್ಥ್ಯಗಳು';

  @override
  String get assessImprovementsSection => 'ಸುಧಾರಿಸಬೇಕಾದದ್ದು';

  @override
  String get assessNextStepsSection => 'ಮುಂದಿನ ಹೆಜ್ಜೆಗಳು';

  @override
  String get assessTeacherNoteSection => 'ವಿದ್ಯಾರ್ಥಿಗೆ ಟಿಪ್ಪಣಿ';

  @override
  String get assessWarningsSection => 'ದಯವಿಟ್ಟು ಪರಿಶೀಲಿಸಿ';

  @override
  String get assessWarningBlank =>
      'ಈ ಪುಟ ಖಾಲಿ ಕಾಣುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಫೋಟೋ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get assessWarningLowContrast =>
      'ಫೋಟೋ ಮಸುಕಾಗಿದೆ. ಹೆಚ್ಚು ಬೆಳಕಿನ ಫೋಟೋ ಹೆಚ್ಚು ನಿಖರವಾಗಿ ಅಂಕ ನೀಡುತ್ತದೆ.';

  @override
  String get assessWarningPartial => 'ಕೆಲಸದ ಒಂದು ಭಾಗವನ್ನಷ್ಟೇ ಓದಲು ಸಾಧ್ಯವಾಯಿತು.';

  @override
  String get assessWarningLanguageMismatch =>
      'ಬರಹ ನಿರೀಕ್ಷಿತಕ್ಕಿಂತ ಬೇರೆ ಭಾಷೆಯಲ್ಲಿ ಇರಬಹುದು.';

  @override
  String get assessNoContent =>
      'ಯಾವುದೇ ಮೌಲ್ಯಮಾಪನ ಬರಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ಪಷ್ಟ ಫೋಟೋ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get assessSignIn =>
      'ಅಸೈನ್‌ಮೆಂಟ್ ಮೌಲ್ಯಮಾಪನ ಮಾಡಲು ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get assessUpgradeTitle => 'ಹೆಚ್ಚಿನ ಯೋಜನೆ ಅಗತ್ಯವಿದೆ';

  @override
  String get assessUpgradeBody =>
      'ಕೈಬರಹದ ಕೆಲಸಕ್ಕೆ ಅಂಕ ನೀಡುವುದು ಹೆಚ್ಚಿನ ಯೋಜನೆಯ ಭಾಗ. ಮೌಲ್ಯಮಾಪನ ಮುಂದುವರಿಸಲು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get assessDailyLimitTitle => 'ಇಂದಿನ ನಿಮ್ಮ ಎಲ್ಲಾ ಮೌಲ್ಯಮಾಪನಗಳು ಮುಗಿದವು';

  @override
  String get assessDailyLimitBody =>
      'ನಿಮ್ಮ ಯೋಜನೆಯಲ್ಲಿ ಪ್ರತಿದಿನ ನಿಗದಿತ ಸಂಖ್ಯೆಯ ಮೌಲ್ಯಮಾಪನಗಳಿವೆ. ಅವು ನಾಳೆ ಮತ್ತೆ ಆರಂಭವಾಗುತ್ತವೆ, ಅಥವಾ ಹೆಚ್ಚಿನ ಯೋಜನೆಯಲ್ಲಿ ಮಿತಿಯನ್ನು ಹೆಚ್ಚಿಸಬಹುದು.';

  @override
  String get assessLimitTitle => 'ನೀವು ನಿಮ್ಮ ಮೌಲ್ಯಮಾಪನ ಮಿತಿಯನ್ನು ತಲುಪಿದ್ದೀರಿ';

  @override
  String get assessLimitBody =>
      'ನಿಮ್ಮ ಯೋಜನೆಯ ಎಲ್ಲಾ ಮೌಲ್ಯಮಾಪನಗಳನ್ನು ಬಳಸಿದ್ದೀರಿ. ಅವು ಮುಂದಿನ ತಿಂಗಳು ಮತ್ತೆ ಆರಂಭವಾಗುತ್ತವೆ, ಅಥವಾ ಹೆಚ್ಚಿನ ಯೋಜನೆಯಲ್ಲಿ ಮಿತಿಯನ್ನು ಹೆಚ್ಚಿಸಬಹುದು.';

  @override
  String get assessSeePricing => 'ಯೋಜನೆಗಳನ್ನು ನೋಡಿ';

  @override
  String get assessBusy =>
      'ಮೌಲ್ಯಮಾಪನ ಮಾದರಿ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಒಂದು ನಿಮಿಷದಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String assessBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'ಮೌಲ್ಯಮಾಪನ ಮಾದರಿ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸುಮಾರು $seconds ಸೆಕೆಂಡ್‌ಗಳಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      one:
          'ಮೌಲ್ಯಮಾಪನ ಮಾದರಿ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸುಮಾರು 1 ಸೆಕೆಂಡ್‌ನಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    );
    return '$_temp0';
  }

  @override
  String get assessTimeout =>
      'ಮೌಲ್ಯಮಾಪನಕ್ಕೆ ಎಂದಿಗಿಂತ ಹೆಚ್ಚು ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get assessRephrase =>
      'ಫೋಟೋಗೆ ಅಂಕ ನೀಡಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ಪಷ್ಟ ಫೋಟೋವನ್ನು ಮತ್ತೆ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.';

  @override
  String get assessSectionWork => 'ವಿದ್ಯಾರ್ಥಿಯ ಕೆಲಸ';

  @override
  String get assessResultTitle => 'ಮೌಲ್ಯಮಾಪನ';

  @override
  String get worksheetSectionWorksheet => 'ಕಾರ್ಯಪತ್ರಿಕೆ';

  @override
  String get rubricSectionAssignment => 'ಅಸೈನ್‌ಮೆಂಟ್';

  @override
  String get examPaperSectionPaper => 'ಪ್ರಶ್ನೆಪತ್ರಿಕೆ';

  @override
  String get examPaperSectionFormat => 'ಸ್ವರೂಪ';

  @override
  String get vidyaEyebrow => 'ನಿಮ್ಮ ಸಹ-ಶಿಕ್ಷಕ';

  @override
  String get vidyaDeck =>
      'ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಮಾತನಾಡಿ, ನಾನು ಕೆಲಸವನ್ನು ಸಿದ್ಧಪಡಿಸುತ್ತೇನೆ.';

  @override
  String get vidyaGreeting =>
      'ಸ್ವಾಗತ, ಶಿಕ್ಷಕರೇ. ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಮಾತನಾಡಿ, ನಾನು ನಿಮ್ಮ ಕೆಲಸವನ್ನು ಸಿದ್ಧಪಡಿಸುತ್ತೇನೆ.';

  @override
  String get vidyaHeroBadge => 'ನಿಮ್ಮ ಎಐ ಬೋಧನಾ ಸಹಾಯಕ';

  @override
  String get vidyaPromptLesson => 'ಪಾಠ ಯೋಜನೆ ಮಾಡಲು ನನ್ನನ್ನು ಕೇಳಿ';

  @override
  String get vidyaPromptQuiz => 'ಕ್ವಿಜ್ ಮಾಡಲು ನನ್ನನ್ನು ಕೇಳಿ';

  @override
  String get vidyaPromptParent => 'ಪೋಷಕರಿಗೆ ಸಂದೇಶ ಕಳುಹಿಸಲು ಕೇಳಿ';

  @override
  String get vidyaStateIdle => 'ಮಾತನಾಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ';

  @override
  String get vidyaStateReady => 'ಸಿದ್ಧವಾಗುತ್ತಿದೆ';

  @override
  String get vidyaStateListening => 'ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ';

  @override
  String get vidyaStateThinking => 'ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ';

  @override
  String get vidyaStateSpeaking => 'ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ';

  @override
  String get vidyaYouSaid => 'ನೀವು ಹೇಳಿದ್ದು';

  @override
  String get vidyaSignedOutTitle => 'VIDYA ಜೊತೆ ಮಾತನಾಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ';

  @override
  String get vidyaSignedOutBody =>
      'ಸೈನ್ ಇನ್ ಮಾಡಿ, VIDYA ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಪಾಠ, ಕ್ವಿಜ್ ಮತ್ತು ಇನ್ನಷ್ಟನ್ನು ಸಿದ್ಧಪಡಿಸುತ್ತದೆ.';

  @override
  String get vidyaMicOffTitle => 'ಮೈಕ್ರೊಫೋನ್ ಆನ್ ಮಾಡಿ';

  @override
  String get vidyaMicOffBody =>
      'ನಿಮ್ಮನ್ನು ಕೇಳಲು VIDYAಗೆ ಮೈಕ್ರೊಫೋನ್ ಬೇಕು. ಅದನ್ನು ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಆನ್ ಮಾಡಿ.';

  @override
  String get vidyaOpenSettings => 'ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ತೆರೆಯಿರಿ';

  @override
  String get vidyaSignIn => 'ಸೈನ್ ಇನ್ ಮಾಡಿ';

  @override
  String get vidyaLimitTitle => 'ನೀವು ಇಂದಿನ ಧ್ವನಿ ಮಿತಿಯನ್ನು ತಲುಪಿದ್ದೀರಿ';

  @override
  String get vidyaLimitBody =>
      'ನಿಮ್ಮ ಧ್ವನಿ ನಿಮಿಷಗಳು ಮತ್ತೆ ಸಿಗುತ್ತವೆ. ಅಲ್ಲಿಯವರೆಗೆ ನೀವು ಟೂಲ್‌ಗಳನ್ನು ಬಳಸಬಹುದು.';

  @override
  String get vidyaErrorTitle => 'ಅದು ಪೂರ್ಣಗೊಳ್ಳಲಿಲ್ಲ';

  @override
  String get vidyaErrorBody =>
      'ಏನೋ ತಪ್ಪಾಗಿದೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ಸೀಲ್ ಮೇಲೆ ಟ್ಯಾಪ್ ಮಾಡಿ.';

  @override
  String get vidyaPrepDesk => 'ಸಿದ್ಧತಾ ಡೆಸ್ಕ್';

  @override
  String get vidyaClearConversation => 'ಸಂಭಾಷಣೆ ಅಳಿಸಿ';

  @override
  String get vidyaFlowVisualAid => 'ದೃಶ್ಯ ಸಾಧನ';

  @override
  String get vidyaFlowVirtualFieldTrip => 'ವರ್ಚುವಲ್ ಕ್ಷೇತ್ರ ಪ್ರವಾಸ';

  @override
  String get vidyaFlowVideoStoryteller => 'ವೀಡಿಯೊ ಕಥೆ';

  @override
  String get vidyaFieldMicLabel => 'ಮಾತನಾಡಿ ಭರ್ತಿ ಮಾಡಿ';

  @override
  String get vidyaFieldMicFailed =>
      'ಕೇಳಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.';

  @override
  String get vidyaOpen => 'VIDYA ಅನ್ನು ಕೇಳಿ';

  @override
  String get parentHotlineTitle => 'ಪೋಷಕರ ಕರೆ';

  @override
  String get parentHotlineSubtitle =>
      'ವಿದ್ಯಾರ್ಥಿಯ ಪೋಷಕರಿಗೆ ಅವರ ಭಾಷೆಯಲ್ಲಿ ಕರೆ ಮಾಡಿ';

  @override
  String get parentHotlineEyebrow => 'ಪೋಷಕರ ಕರೆ';

  @override
  String get parentHotlinePickStudentIntro =>
      'ಯಾರ ಪೋಷಕರಿಗೆ ಕರೆ ಮಾಡಬೇಕೆಂದು ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get parentHotlineClassLabel => 'ತರಗತಿ';

  @override
  String get parentHotlineNoPhone => 'ಪೋಷಕರ ಫೋನ್ ಸಂಖ್ಯೆ ಉಳಿಸಿಲ್ಲ';

  @override
  String get parentHotlineSignedOutTitle =>
      'ನಿಮ್ಮ ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ನೋಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ';

  @override
  String get parentHotlineSignedOutBody =>
      'ನೀವು ಸೈನ್ ಇನ್ ಆದ ನಂತರ ನಿಮ್ಮ ತರಗತಿಯ ವಿದ್ಯಾರ್ಥಿ ಪಟ್ಟಿ ಕಾಣಿಸುತ್ತದೆ. ಕರೆ ಮಾಡುವ ಮೊದಲು ಪೋಷಕರ ಕರೆಗೆ ನಿಮ್ಮ ಖಾತೆಯ ಅಗತ್ಯವಿದೆ.';

  @override
  String get parentHotlineRosterUnavailableTitle =>
      'ನಿಮ್ಮ ತರಗತಿಯ ಪಟ್ಟಿ ಇನ್ನೂ ಲಭ್ಯವಿಲ್ಲ';

  @override
  String get parentHotlineRosterUnavailableBody =>
      'ನಾವು ಇನ್ನೂ ಇಲ್ಲಿ ನಿಮ್ಮ ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿಲ್ಲ. ಇದು ಮುಂದಿನ ಅಪ್‌ಡೇಟ್‌ನಲ್ಲಿ ಬರಲಿದೆ. ನೀವು ಈಗಾಗಲೇ ಸೈನ್ ಇನ್ ಆಗಿದ್ದೀರಿ, ಆದ್ದರಿಂದ ನೀವು ಏನನ್ನೂ ಸರಿಪಡಿಸಬೇಕಿಲ್ಲ.';

  @override
  String get parentHotlineRosterEmptyTitle =>
      'ನಿಮ್ಮ ಪಟ್ಟಿಯಲ್ಲಿ ಇನ್ನೂ ವಿದ್ಯಾರ್ಥಿಗಳಿಲ್ಲ';

  @override
  String get parentHotlineRosterEmptyBody =>
      'ಒಂದು ತರಗತಿಗೆ ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ಸೇರಿಸಿ, ಅವರು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತಾರೆ ಮತ್ತು ಮನೆಗೆ ಕರೆ ಮಾಡಲು ಸಿದ್ಧರಾಗಿರುತ್ತಾರೆ.';

  @override
  String get parentHotlineReasonEyebrow => 'ನೀವು ಏಕೆ ಕರೆ ಮಾಡುತ್ತಿದ್ದೀರಿ';

  @override
  String get parentHotlineReasonAbsencesLabel => 'ಪದೇ ಪದೇ ಗೈರುಹಾಜರಿ';

  @override
  String get parentHotlineReasonAbsencesDesc =>
      'ವಿದ್ಯಾರ್ಥಿ ಸತತವಾಗಿ ಹಲವು ದಿನಗಳು ಗೈರುಹಾಜರಾಗಿದ್ದಾರೆ.';

  @override
  String get parentHotlineReasonPerformanceLabel =>
      'ವಿಷಯದಲ್ಲಿ ಹಿಂದೆ ಬೀಳುತ್ತಿದ್ದಾರೆ';

  @override
  String get parentHotlineReasonPerformanceDesc =>
      'ಇತ್ತೀಚಿನ ಅಂಕಗಳು ಅಥವಾ ತರಗತಿ ಕೆಲಸಕ್ಕೆ ಗಮನ ಬೇಕು.';

  @override
  String get parentHotlineReasonBehaviourLabel => 'ತರಗತಿಯಲ್ಲಿ ವರ್ತನೆ';

  @override
  String get parentHotlineReasonBehaviourDesc =>
      'ಪೋಷಕರು ತಿಳಿಯಬೇಕಾದ ಏನೋ ನಡೆದಿದೆ.';

  @override
  String get parentHotlineReasonPositiveLabel => 'ಹಂಚಿಕೊಳ್ಳಲು ಒಳ್ಳೆಯ ಸುದ್ದಿ';

  @override
  String get parentHotlineReasonPositiveDesc =>
      'ಪೋಷಕರೊಂದಿಗೆ ಒಂದು ಸಾಧನೆಯನ್ನು ಸಂಭ್ರಮಿಸಿ.';

  @override
  String get parentHotlineComposeEyebrow => 'ಕರೆ ಸಿದ್ಧಪಡಿಸಿ';

  @override
  String get parentHotlineNoteLabel => 'ಟಿಪ್ಪಣಿ ಸೇರಿಸಿ';

  @override
  String get parentHotlineNoteHintAbsences =>
      'ಗೈರುಹಾಜರಾದ ದಿನಗಳ ಬಗ್ಗೆ ಪೋಷಕರು ತಿಳಿಯಬೇಕಾದ ಏನಾದರೂ ಇದೆಯೇ?';

  @override
  String get parentHotlineNoteHintPerformance =>
      'ವಿದ್ಯಾರ್ಥಿ ಸುಧಾರಿಸಲು ಏನು ಸಹಾಯ ಮಾಡುತ್ತದೆ?';

  @override
  String get parentHotlineNoteHintBehaviour =>
      'ಏನು ನಡೆಯಿತು, ಮತ್ತು ಮನೆಯಲ್ಲಿ ಯಾವ ಬೆಂಬಲ ಸಹಾಯ ಮಾಡುತ್ತದೆ?';

  @override
  String get parentHotlineNoteHintPositive =>
      'ಹಂಚಿಕೊಳ್ಳಬೇಕಾದ ಒಳ್ಳೆಯ ಸುದ್ದಿ ಏನು?';

  @override
  String get parentHotlineDraftAction => 'ಸಂದೇಶ ರಚಿಸಿ';

  @override
  String get parentHotlineErrorTitle => 'ಏನೋ ತಪ್ಪಾಗಿದೆ';

  @override
  String get parentHotlineGenericError =>
      'ಅದು ಪೂರ್ಣಗೊಳ್ಳಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get parentHotlineTelephonyUnavailable =>
      'ಸದ್ಯಕ್ಕೆ ಕರೆ ಮಾಡುವ ಸೌಲಭ್ಯ ಲಭ್ಯವಿಲ್ಲ. ಸಂದೇಶವನ್ನು ನಕಲಿಸಿ WhatsApp ನಲ್ಲಿ ಕಳುಹಿಸಬಹುದು.';

  @override
  String get parentHotlineEvidenceAttendanceHeader => 'ಹಾಜರಾತಿ';

  @override
  String get parentHotlineEvidenceMarksHeader => 'ಇತ್ತೀಚಿನ ಅಂಕಗಳು';

  @override
  String get parentHotlineEvidenceBehaviourHeader => 'ಏನು ನಡೆಯಿತು';

  @override
  String get parentHotlineEvidencePositiveHeader => 'ಒಳ್ಳೆಯ ಸುದ್ದಿ';

  @override
  String parentHotlineEvidenceAbsentDays(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: 'ಸತತವಾಗಿ $days ದಿನಗಳು ಗೈರುಹಾಜರಿ',
      one: 'ಸತತವಾಗಿ 1 ದಿನ ಗೈರುಹಾಜರಿ',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineEvidenceAbsencePrompt =>
      'ಪೋಷಕರಿಗೆ ನಿಖರವಾದ ದಾಖಲೆ ತಿಳಿಯುವಂತೆ ಗೈರುಹಾಜರಾದ ದಿನಗಳನ್ನು ಖಚಿತಪಡಿಸಿ.';

  @override
  String get parentHotlineEvidenceMarksPrompt =>
      'ಕರೆಯಲ್ಲಿ ಹೇಳಲು ಇತ್ತೀಚಿನ ಅಂಕಗಳು ಸಿದ್ಧವಾಗಿವೆ.';

  @override
  String get parentHotlineEvidenceMarksEmpty =>
      'ಇನ್ನೂ ಇತ್ತೀಚಿನ ಅಂಕಗಳು ದಾಖಲೆಯಲ್ಲಿ ಇಲ್ಲ. ಪೋಷಕರು ತಿಳಿಯಬೇಕಾದದ್ದನ್ನು ಕೆಳಗೆ ಸೇರಿಸಿ.';

  @override
  String get parentHotlineEvidenceBehaviourPrompt =>
      'ಏನು ನಡೆಯಿತು ಮತ್ತು ಮನೆಯಲ್ಲಿ ಯಾವ ಬೆಂಬಲ ಸಹಾಯ ಮಾಡುತ್ತದೆ ಎಂಬುದನ್ನು ವಿವರಿಸಿ.';

  @override
  String get parentHotlineEvidencePositivePrompt =>
      'ಪೋಷಕರು ಸಂಭ್ರಮಿಸಬೇಕೆಂದು ನೀವು ಬಯಸುವ ಸಾಧನೆಯನ್ನು ಹಂಚಿಕೊಳ್ಳಿ.';

  @override
  String get parentHotlineReviewEyebrow => 'ಮನೆಗೆ ಸಂದೇಶ';

  @override
  String get parentHotlineCall => 'ಪೋಷಕರಿಗೆ ಕರೆ ಮಾಡಿ';

  @override
  String get parentHotlineWhatsApp => 'WhatsApp ಗಾಗಿ ನಕಲಿಸಿ';

  @override
  String parentHotlineCallAgainIn(String time) {
    return '$time ನಂತರ ಮತ್ತೆ ಕರೆ ಮಾಡಿ';
  }

  @override
  String parentHotlineUnsupportedLanguage(String language) {
    return '$language ಗಾಗಿ ಸ್ವಯಂಚಾಲಿತ ಕರೆ ಇನ್ನೂ ಲಭ್ಯವಿಲ್ಲ. ಬದಲಿಗೆ WhatsApp ಗಾಗಿ ನಕಲಿಸಿ.';
  }

  @override
  String parentHotlinePhoneMask(String last4) {
    return '•••• $last4';
  }

  @override
  String get parentHotlineAiNotice =>
      'ಕರೆಯು ಸ್ವಯಂಚಾಲಿತ AI ಧ್ವನಿ ಸೂಚನೆಯೊಂದಿಗೆ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ.';

  @override
  String get parentHotlineCopied =>
      'ಸಂದೇಶ ನಕಲಿಸಲಾಗಿದೆ. ಕಳುಹಿಸಲು WhatsApp ನಲ್ಲಿ ಅಂಟಿಸಿ.';

  @override
  String get parentHotlinePremiumTitle => 'ಪೋಷಕರ ಕರೆಗೆ ಸುಧಾರಿತ ಯೋಜನೆ ಅಗತ್ಯವಿದೆ';

  @override
  String get parentHotlinePremiumBody =>
      'ಪೋಷಕರಿಗೆ AI ಧ್ವನಿ ಕರೆ ಮಾಡುವುದು ಸುಧಾರಿತ ಯೋಜನೆಯ ಭಾಗವಾಗಿದೆ. ನೀವು ಇನ್ನೂ ಉಚಿತವಾಗಿ WhatsApp ನಲ್ಲಿ ಕಳುಹಿಸಲು ಸಂದೇಶವನ್ನು ನಕಲಿಸಬಹುದು.';

  @override
  String get parentHotlineComingSoonTitle => 'ಕರೆ ವೀಕ್ಷಣೆ ಶೀಘ್ರದಲ್ಲೇ ಬರಲಿದೆ';

  @override
  String get parentHotlineComingSoonBody =>
      'ಕರೆ ಮಾಡುವುದು ಮತ್ತು ಅದನ್ನು ಅನುಸರಿಸುವುದು ಮುಂದಿನ ನವೀಕರಣದಲ್ಲಿ ಬರಲಿದೆ.';

  @override
  String parentHotlineCallingTitle(String name) {
    return '$name ಅವರ ಪೋಷಕರಿಗೆ ಕರೆ ಮಾಡಲಾಗುತ್ತಿದೆ…';
  }

  @override
  String get parentHotlineCallingRinging => 'ರಿಂಗ್ ಆಗುತ್ತಿದೆ…';

  @override
  String get parentHotlineCallingInProgress => 'ಸಂಭಾಷಣೆ ನಡೆಯುತ್ತಿದೆ';

  @override
  String parentHotlineCallingExchanges(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ವಿನಿಮಯಗಳು',
      one: '1 ವಿನಿಮಯ',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineCallingReassurance =>
      'ನೀವು ಈ ಪರದೆಯನ್ನು ಬಿಟ್ಟು ಹೋಗಬಹುದು — ಸಾರಾಂಶ ನಿಮಗಾಗಿ ಸಿದ್ಧವಾಗಿರುತ್ತದೆ.';

  @override
  String get parentHotlineSummaryDocType => 'ಪೋಷಕರ ಕರೆ';

  @override
  String get parentHotlineSummaryReasonAbsences => 'ಗೈರುಹಾಜರಿ';

  @override
  String get parentHotlineSummaryReasonPerformance => 'ಸಾಧನೆ';

  @override
  String get parentHotlineSummaryReasonBehaviour => 'ವರ್ತನೆ';

  @override
  String get parentHotlineSummaryReasonPositive => 'ಶುಭ ಸುದ್ದಿ';

  @override
  String parentHotlineSummaryTitle(String name) {
    return '$name ಅವರ ಪೋಷಕರು';
  }

  @override
  String parentHotlineSummaryDurationMin(int minutes) {
    return '$minutes ನಿಮಿಷ';
  }

  @override
  String get parentHotlineSentimentCooperative => 'ಸಹಕಾರ';

  @override
  String get parentHotlineSentimentConcerned => 'ಚಿಂತೆ';

  @override
  String get parentHotlineSentimentGrateful => 'ಕೃತಜ್ಞತೆ';

  @override
  String get parentHotlineSentimentUpset => 'ಬೇಸರ';

  @override
  String get parentHotlineSentimentIndifferent => 'ತಟಸ್ಥ';

  @override
  String get parentHotlineSentimentConfused => 'ಗೊಂದಲ';

  @override
  String get parentHotlineSummarySaidHeader => 'ಪೋಷಕರು ಹೇಳಿದ್ದು';

  @override
  String get parentHotlineSummaryConcernsHeader => 'ಎತ್ತಿದ ಕಳವಳಗಳು';

  @override
  String get parentHotlineSummaryCommitmentsHeader => 'ಪೋಷಕರ ಭರವಸೆಗಳು';

  @override
  String get parentHotlineSummaryActionsHeader => 'ನಿಮ್ಮ ಕಾರ್ಯಗಳು';

  @override
  String get parentHotlineSummaryGuidanceHeader => 'ಹಂಚಿದ ಮಾರ್ಗದರ್ಶನ';

  @override
  String get parentHotlineSummaryFollowUpHeader => 'ಮುಂದಿನ ಹೆಜ್ಜೆ';

  @override
  String parentHotlineSummaryTranscript(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'ಸಂಭಾಷಣೆ ನೋಡಿ · $count ಸಂದೇಶಗಳು',
      one: 'ಸಂಭಾಷಣೆ ನೋಡಿ · 1 ಸಂದೇಶ',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineSummaryDone => 'ಮುಗಿಯಿತು';

  @override
  String get parentHotlineSummaryCallAgain => 'ನಂತರ ಮತ್ತೆ ಕರೆ ಮಾಡಿ';

  @override
  String get parentHotlineSummaryManualTitle => 'ಸಂದೇಶ ನಕಲಾಗಿದೆ';

  @override
  String get parentHotlineSummaryManualBody =>
      'ಪೋಷಕರಿಗೆ ಕಳುಹಿಸಲು ಇದನ್ನು WhatsApp ನಲ್ಲಿ ಅಂಟಿಸಿ.';

  @override
  String get parentHotlineSummaryBusy => 'ಲೈನ್ ಕಾರ್ಯನಿರತವಾಗಿತ್ತು';

  @override
  String get parentHotlineSummaryNoAnswer => 'ಉತ್ತರವಿಲ್ಲ';

  @override
  String get parentHotlineSummaryFailed => 'ಕರೆ ಸಂಪರ್ಕವಾಗಲಿಲ್ಲ';

  @override
  String get parentHotlineSummaryFailedBody =>
      'ಕರೆ ಆಗಲಿಲ್ಲ. ನೀವು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಬಹುದು, ಅಥವಾ ಸಂದೇಶವನ್ನು ನಕಲಿಸಿ WhatsApp ನಲ್ಲಿ ಕಳುಹಿಸಬಹುದು.';

  @override
  String get parentHotlineSummaryTryAgain => 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ';

  @override
  String get parentHotlineSummaryNoConversationTitle => 'ಕರೆ ಬಹಳ ಬೇಗ ಮುಗಿಯಿತು';

  @override
  String get parentHotlineSummaryNoConversationBody =>
      'ಸಂಭಾಷಣೆ ಆರಂಭವಾಗುವ ಮೊದಲೇ ಕರೆ ಮುಗಿಯಿತು. ನೀವು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಬಹುದು, ಅಥವಾ ಸಂದೇಶವನ್ನು WhatsApp ನಲ್ಲಿ ಕಳುಹಿಸಬಹುದು.';

  @override
  String get parentHotlineSummaryUnavailableTitle => 'ಸಾರಾಂಶ ಲಭ್ಯವಿಲ್ಲ';

  @override
  String get parentHotlineSummaryUnavailableBody =>
      'ಈ ಕರೆಗೆ ಸಾರಾಂಶ ಸಿದ್ಧಪಡಿಸಲಾಗಲಿಲ್ಲ. ಸಂಭಾಷಣೆ ಕೆಳಗೆ ಇದೆ.';

  @override
  String get contentCreatorTitle => 'ವಿಷಯ ರಚನಾ ಸ್ಟುಡಿಯೋ';

  @override
  String get contentCreatorTileSubtitle => 'ನಿಮ್ಮ ತರಗತಿಗಾಗಿ ಮಲ್ಟಿಮೀಡಿಯಾ ರಚಿಸಿ';

  @override
  String get contentCreatorSubtitle =>
      'ನಿಮ್ಮ ತರಗತಿಗೆ ಆಕರ್ಷಕ ಮಲ್ಟಿಮೀಡಿಯಾ ವಿಷಯವನ್ನು ರಚಿಸಲು ಸಹಾಯ ಮಾಡುವ ಸಾಧನಗಳು.';

  @override
  String get contentCreatorSectionEyebrow => 'ಒಂದು ಸಾಧನವನ್ನು ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get contentCreatorVisualAidDesc =>
      'ನಿಮ್ಮ ಪಾಠಗಳಿಗಾಗಿ ಸರಳ ಗೆರೆ ಚಿತ್ರಗಳು ಮತ್ತು ರೇಖಾಚಿತ್ರಗಳನ್ನು ರಚಿಸಿ.';

  @override
  String get contentCreatorFieldTripDesc =>
      'Google Earth ಬಳಸಿ ರೋಮಾಂಚಕ ವರ್ಚುವಲ್ ಪ್ರವಾಸಗಳನ್ನು ಯೋಜಿಸಿ.';

  @override
  String get contentCreatorVideoDesc =>
      'ನಿಮ್ಮ ಪಾಠಗಳಿಗಾಗಿ ಆಯ್ದ ಶೈಕ್ಷಣಿಕ ವೀಡಿಯೊಗಳನ್ನು ಹುಡುಕಿ.';

  @override
  String get visualAidTitle => 'ದೃಶ್ಯ ಸಹಾಯಕ';

  @override
  String get visualAidSubtitle => 'ಬೋಧನಾ ಚಿತ್ರವನ್ನು ರಚಿಸಿ';

  @override
  String get visualAidEmpty => 'ಒಂದು ಚಿತ್ರವನ್ನು ವಿವರಿಸಿ ಮತ್ತು ರಚಿಸಿ ಒತ್ತಿರಿ.';

  @override
  String get visualAidPromptLabel => 'ಚಿತ್ರದಲ್ಲಿ ಏನನ್ನು ತೋರಿಸಬೇಕು?';

  @override
  String get visualAidPromptHint => 'ಉದಾಹರಣೆಗೆ, ಸಸ್ಯ ಕೋಶದ ಭಾಗಗಳು';

  @override
  String get visualAidPromptError => 'ನಿಮಗೆ ಯಾವ ರೀತಿಯ ಚಿತ್ರ ಬೇಕು ಎಂದು ವಿವರಿಸಿ.';

  @override
  String get visualAidGradeLabel => 'ತರಗತಿ ಮಟ್ಟ';

  @override
  String get visualAidGradeAny => 'ಯಾವುದೇ ತರಗತಿ';

  @override
  String get visualAidSubjectLabel => 'ವಿಷಯ';

  @override
  String get visualAidSubjectAny => 'ಯಾವುದೇ ವಿಷಯ';

  @override
  String get visualAidOptional => 'ಐಚ್ಛಿಕ';

  @override
  String get visualAidAction => 'ಚಿತ್ರ ರಚಿಸಿ';

  @override
  String get visualAidResultTitle => 'ದೃಶ್ಯ ಸಹಾಯಕ';

  @override
  String get visualAidHowToUse => 'ಇದನ್ನು ಹೇಗೆ ಬಳಸುವುದು';

  @override
  String get visualAidDiscussionSpark => 'ಚರ್ಚೆಯ ಪ್ರಶ್ನೆ';

  @override
  String get visualAidImageLabel => 'ರಚಿಸಲಾದ ಬೋಧನಾ ಚಿತ್ರ';

  @override
  String get visualAidImageError => 'ಈ ಚಿತ್ರವನ್ನು ತೋರಿಸಲಾಗಲಿಲ್ಲ.';

  @override
  String get visualAidNoImage =>
      'ಆ ವಿವರಣೆಗೆ ಯಾವುದೇ ಚಿತ್ರ ಬರಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಅದನ್ನು ಮತ್ತೆ ಬರೆದು ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get visualAidSignIn =>
      'ಈ ಸಾಧನವನ್ನು ಬಳಸಲು ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get visualAidUpgradeTitle => 'ಉನ್ನತ ಯೋಜನೆ ಅಗತ್ಯವಿದೆ';

  @override
  String get visualAidUpgradeBody =>
      'ದೃಶ್ಯ ಸಹಾಯಕವು ಉನ್ನತ ಯೋಜನೆಯ ಭಾಗವಾಗಿದೆ. ಚಿತ್ರಗಳನ್ನು ರಚಿಸುತ್ತಿರಲು ದಯವಿಟ್ಟು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get visualAidSeePricing => 'ಯೋಜನೆಗಳು ಮತ್ತು ಬೆಲೆಗಳನ್ನು ನೋಡಿ';

  @override
  String get visualAidDailyLimitTitle => 'ಇಂದಿನ ನಿಮ್ಮ ಎಲ್ಲಾ ಚಿತ್ರಗಳು ಮುಗಿದಿವೆ';

  @override
  String get visualAidDailyLimitBody =>
      'ನಿಮ್ಮ ಯೋಜನೆಯಲ್ಲಿ ಪ್ರತಿದಿನ ನಿಗದಿತ ಸಂಖ್ಯೆಯ ದೃಶ್ಯ ಸಹಾಯಕಗಳು ಸೇರಿವೆ. ನಿಮ್ಮ ಚಿತ್ರಗಳು ನಾಳೆ ಮತ್ತೆ ಲಭ್ಯವಾಗುತ್ತವೆ, ಅಥವಾ ನೀವು ಉನ್ನತ ಯೋಜನೆಯಲ್ಲಿ ದೈನಂದಿನ ಮಿತಿಯನ್ನು ಹೆಚ್ಚಿಸಬಹುದು.';

  @override
  String get visualAidLimitTitle => 'ನೀವು ನಿಮ್ಮ ಮಿತಿಯನ್ನು ತಲುಪಿದ್ದೀರಿ';

  @override
  String get visualAidLimitBody =>
      'ಈ ತಿಂಗಳ ನಿಮ್ಮ ದೃಶ್ಯ ಸಹಾಯಕಗಳನ್ನು ನೀವು ಬಳಸಿದ್ದೀರಿ. ನಿಮ್ಮ ಚಿತ್ರಗಳು ಮುಂದಿನ ತಿಂಗಳು ಮತ್ತೆ ಲಭ್ಯವಾಗುತ್ತವೆ, ಅಥವಾ ನೀವು ಉನ್ನತ ಯೋಜನೆಯಲ್ಲಿ ಮಿತಿಯನ್ನು ಹೆಚ್ಚಿಸಬಹುದು.';

  @override
  String get visualAidRephrase =>
      'ಆ ಚಿತ್ರವನ್ನು ನಾವು ರಚಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಅದನ್ನು ಮತ್ತೆ ಬರೆದು ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get visualAidEmptyGeneration =>
      'ಚಿತ್ರ ಖಾಲಿ ಬಂದಿತು. ಕಡಿಮೆ ಲೇಬಲ್‌ಗಳೊಂದಿಗೆ ವಿವರಿಸಲು ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get visualAidBusy =>
      'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String visualAidBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸುಮಾರು $seconds ಸೆಕೆಂಡ್‌ಗಳಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      one:
          'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸುಮಾರು 1 ಸೆಕೆಂಡ್‌ನಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    );
    return '$_temp0';
  }

  @override
  String get visualAidTimeout =>
      'ಇದು ನಿರೀಕ್ಷೆಗಿಂತ ಹೆಚ್ಚು ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get videoStorytellerTitle => 'ವೀಡಿಯೊ ಕಥೆಗಾರ';

  @override
  String get videoStorytellerSubtitle => 'ಬೋಧನಾ ವೀಡಿಯೊಗಳನ್ನು ಹುಡುಕಿ';

  @override
  String get videoStorytellerEmpty =>
      'ಒಂದು ವಿಷಯ ಅಥವಾ ಟಾಪಿಕ್ ಆಯ್ಕೆಮಾಡಿ ಮತ್ತು ವೀಡಿಯೊಗಳನ್ನು ಹುಡುಕಿ ಒತ್ತಿ.';

  @override
  String get videoStorytellerTopicLabel => 'ಟಾಪಿಕ್ ಅಥವಾ ಅಧ್ಯಾಯ';

  @override
  String get videoStorytellerTopicHint => 'ಉದಾಹರಣೆಗೆ, ಜಲಚಕ್ರ';

  @override
  String get videoStorytellerSubjectLabel => 'ವಿಷಯ';

  @override
  String get videoStorytellerSubjectAny => 'ಯಾವುದೇ ವಿಷಯ';

  @override
  String get videoStorytellerGradeLabel => 'ತರಗತಿ ಮಟ್ಟ';

  @override
  String get videoStorytellerGradeAny => 'ಯಾವುದೇ ತರಗತಿ';

  @override
  String get videoStorytellerOptional => 'ಐಚ್ಛಿಕ';

  @override
  String get videoStorytellerAction => 'ವೀಡಿಯೊಗಳನ್ನು ಹುಡುಕಿ';

  @override
  String get videoStorytellerNoResults =>
      'ಅದಕ್ಕೆ ಯಾವುದೇ ವೀಡಿಯೊ ಬರಲಿಲ್ಲ. ಬೇರೆ ವಿಷಯ ಅಥವಾ ಟಾಪಿಕ್ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String videoStorytellerViewAll(int count) {
    return 'ಎಲ್ಲಾ $count ನೋಡಿ';
  }

  @override
  String get videoStorytellerOfficialSource => 'ಅಧಿಕೃತ ಮೂಲ';

  @override
  String get videoStorytellerOpensExternally =>
      'ಯೂಟ್ಯೂಬ್‌ನಲ್ಲಿ, ಆ್ಯಪ್‌ನ ಹೊರಗೆ ತೆರೆಯುತ್ತದೆ.';

  @override
  String get videoStorytellerCategoryTopRecommended =>
      'ನಿಮಗಾಗಿ ಉನ್ನತ ಶಿಫಾರಸುಗಳು';

  @override
  String get videoStorytellerCategoryStorytelling =>
      'ನಿಮ್ಮ ವಿಷಯಗಳಿಗಾಗಿ ಕಥಾ ಕಥನ';

  @override
  String get videoStorytellerCategoryPedagogy =>
      'ಬೋಧನಾಶಾಸ್ತ್ರ ಮತ್ತು ಬೋಧನಾ ವಿಧಾನಗಳು';

  @override
  String get videoStorytellerCategoryGovtUpdates => 'ಸರ್ಕಾರಿ ನವೀಕರಣಗಳು';

  @override
  String get videoStorytellerCategoryCourses => 'ಶಿಕ್ಷಕ ತರಬೇತಿ ಕೋರ್ಸ್‌ಗಳು';

  @override
  String get videoStorytellerSignIn =>
      'ಈ ಸಾಧನವನ್ನು ಬಳಸಲು ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get videoStorytellerTimeout =>
      'ಇದು ನಿರೀಕ್ಷೆಗಿಂತ ಹೆಚ್ಚು ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get videoStorytellerBusy =>
      'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String videoStorytellerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸುಮಾರು $seconds ಸೆಕೆಂಡ್‌ಗಳಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      one:
          'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸುಮಾರು 1 ಸೆಕೆಂಡ್‌ನಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    );
    return '$_temp0';
  }

  @override
  String get videoStorytellerRephrase =>
      'ಅದಕ್ಕೆ ವೀಡಿಯೊಗಳನ್ನು ನಾವು ಹುಡುಕಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಬೇರೆ ಟಾಪಿಕ್ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get videoStorytellerLimit =>
      'ನೀವು ಇತ್ತೀಚೆಗೆ ಬಹಳಷ್ಟು ಹುಡುಕಿದ್ದೀರಿ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get actionDone => 'ಆಯಿತು';

  @override
  String get virtualFieldTripTitle => 'ವರ್ಚುವಲ್ ಫೀಲ್ಡ್ ಟ್ರಿಪ್';

  @override
  String get virtualFieldTripSubtitle =>
      'Google Earth ನಲ್ಲಿ ಜಗತ್ತನ್ನು ಸುತ್ತಾಡಿ';

  @override
  String get virtualFieldTripEmpty =>
      'ಒಂದು ವಿಷಯವನ್ನು ನಮೂದಿಸಿ ಮತ್ತು \'ಪ್ರವಾಸ ಯೋಜಿಸಿ\' ಒತ್ತಿ.';

  @override
  String get virtualFieldTripTopicLabel => 'ವಿಷಯ ಅಥವಾ ಥೀಮ್';

  @override
  String get virtualFieldTripTopicHint => 'ಉದಾಹರಣೆಗೆ, ಗ್ರೇಟ್ ಬ್ಯಾರಿಯರ್ ರೀಫ್';

  @override
  String get virtualFieldTripTopicError =>
      'ದಯವಿಟ್ಟು ಪ್ರವಾಸಕ್ಕೆ ಒಂದು ವಿಷಯವನ್ನು ನಮೂದಿಸಿ.';

  @override
  String get virtualFieldTripGradeLabel => 'ತರಗತಿ ಮಟ್ಟ';

  @override
  String get virtualFieldTripGradeAny => 'ಯಾವುದೇ ತರಗತಿ';

  @override
  String get virtualFieldTripOptional => 'ಐಚ್ಛಿಕ';

  @override
  String get virtualFieldTripAction => 'ಪ್ರವಾಸ ಯೋಜಿಸಿ';

  @override
  String get virtualFieldTripDocType => 'ವರ್ಚುವಲ್ ಫೀಲ್ಡ್ ಟ್ರಿಪ್';

  @override
  String virtualFieldTripStopCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ನಿಲ್ದಾಣಗಳು',
      one: '1 ನಿಲ್ದಾಣ',
    );
    return '$_temp0';
  }

  @override
  String virtualFieldTripStopSemantics(int number, String name) {
    return 'ನಿಲ್ದಾಣ $number: $name';
  }

  @override
  String get virtualFieldTripFactLabel => 'ನಿಮಗೆ ಗೊತ್ತೇ?';

  @override
  String get virtualFieldTripReflectionLabel => 'ಇದರ ಬಗ್ಗೆ ಯೋಚಿಸಿ';

  @override
  String get virtualFieldTripAnalogyLabel => 'ನಮ್ಮ ಸಂದರ್ಭದಲ್ಲಿ';

  @override
  String get virtualFieldTripExplanationLabel => 'ನಾವು ಏಕೆ ಭೇಟಿ ನೀಡುತ್ತೇವೆ';

  @override
  String get virtualFieldTripOpenEarth => 'Google Earth ನಲ್ಲಿ ತೆರೆಯಿರಿ';

  @override
  String get virtualFieldTripOpensExternally =>
      'ಆ್ಯಪ್‌ನ ಹೊರಗೆ, Google Earth ನಲ್ಲಿ ತೆರೆಯುತ್ತದೆ.';

  @override
  String get virtualFieldTripPendingTitle =>
      'ನಿಮ್ಮ ಪ್ರವಾಸ ಇನ್ನೂ ಯೋಜಿಸಲಾಗುತ್ತಿದೆ';

  @override
  String get virtualFieldTripPendingBody =>
      'ನಿಮ್ಮ ಫೀಲ್ಡ್ ಟ್ರಿಪ್ ಇನ್ನೂ ಸಿದ್ಧವಾಗುತ್ತಿದೆ. ಒಂದು ನಿಮಿಷದಲ್ಲಿ \'ನನ್ನ ಗ್ರಂಥಾಲಯ\' ನೋಡಿ.';

  @override
  String get virtualFieldTripNoStops =>
      'ಅದಕ್ಕೆ ಯಾವುದೇ ನಿಲ್ದಾಣಗಳು ಸಿಗಲಿಲ್ಲ. ಬೇರೆ ವಿಷಯವನ್ನು ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get virtualFieldTripSignIn =>
      'ಈ ಟೂಲ್ ಬಳಸಲು ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get virtualFieldTripUnavailable =>
      'ಈ ಟೂಲ್ ನಿಮ್ಮ ಪ್ರಸ್ತುತ ಯೋಜನೆಯ ಭಾಗವಲ್ಲ.';

  @override
  String get virtualFieldTripTimeout =>
      'ಇದಕ್ಕೆ ನಿರೀಕ್ಷೆಗಿಂತ ಹೆಚ್ಚು ಸಮಯ ಹಿಡಿಯುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get virtualFieldTripBusy =>
      'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String virtualFieldTripBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸುಮಾರು $seconds ಸೆಕೆಂಡ್ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      one:
          'ಸಹಾಯಕ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸುಮಾರು 1 ಸೆಕೆಂಡ್ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    );
    return '$_temp0';
  }

  @override
  String get virtualFieldTripRephrase =>
      'ಅದಕ್ಕೆ ನಾವು ಪ್ರವಾಸವನ್ನು ಯೋಜಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಬೇರೆ ವಿಷಯವನ್ನು ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get virtualFieldTripLimit =>
      'ನೀವು ಇತ್ತೀಚೆಗೆ ಬಹಳಷ್ಟು ಪ್ರವಾಸಗಳನ್ನು ಯೋಜಿಸಿದ್ದೀರಿ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get assessmentScannerTitle => 'ಮೌಲ್ಯಮಾಪನ ಸ್ಕ್ಯಾನರ್';

  @override
  String get assessmentScannerSubtitle =>
      'ವಿದ್ಯಾರ್ಥಿಯ ಉತ್ತರ ಪತ್ರಿಕೆಯನ್ನು ಪುಟದಿಂದ ಪುಟಕ್ಕೆ ಮೌಲ್ಯಮಾಪನ ಮಾಡಿ';

  @override
  String get assessmentScannerEmpty =>
      'ಉತ್ತರ ಪತ್ರಿಕೆಯ 3 ರವರೆಗೆ ಫೋಟೋಗಳನ್ನು ಸೇರಿಸಿ, ನಂತರ ಮೌಲ್ಯಮಾಪನ ಒತ್ತಿರಿ.';

  @override
  String get assessmentScannerSubmit => 'ಉತ್ತರ ಪತ್ರಿಕೆಯನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಿ';

  @override
  String get assessmentScannerResultTitle => 'ಮೌಲ್ಯಮಾಪನ';

  @override
  String get assessmentScannerSectionSheet => 'ಉತ್ತರ ಪತ್ರಿಕೆ';

  @override
  String get assessmentScannerPagesLabel => 'ಉತ್ತರ ಪತ್ರಿಕೆಯ ಪುಟಗಳು';

  @override
  String get assessmentScannerPagesHint =>
      '3 ರವರೆಗೆ ಸ್ಪಷ್ಟ ಫೋಟೋಗಳನ್ನು ಸೇರಿಸಿ, ಪ್ರತಿ ಪುಟಕ್ಕೆ ಒಂದು.';

  @override
  String get assessmentScannerPagesEmpty => 'ಮೊದಲ ಪುಟದ ಒಂದು ಫೋಟೋ ಸೇರಿಸಿ.';

  @override
  String assessmentScannerPageLabel(int number) {
    return 'ಪುಟ $number';
  }

  @override
  String assessmentScannerRemovePage(int number) {
    return 'ಪುಟ $number ತೆಗೆದುಹಾಕಿ';
  }

  @override
  String assessmentScannerPageCounter(int count, int max) {
    return '$max ರಲ್ಲಿ $count ಪುಟಗಳು';
  }

  @override
  String assessmentScannerPagesFull(int max) {
    return 'ನೀವು $max ರವರೆಗೆ ಪುಟಗಳನ್ನು ಸೇರಿಸಬಹುದು.';
  }

  @override
  String get assessmentScannerTakePhoto => 'ಫೋಟೋ ತೆಗೆಯಿರಿ';

  @override
  String get assessmentScannerChooseGallery => 'ಗ್ಯಾಲರಿಯಿಂದ ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get assessmentScannerSubjectLabel => 'ವಿಷಯ';

  @override
  String get assessmentScannerSubjectHint =>
      'ಮೌಲ್ಯಮಾಪನವು ವಿಷಯಕ್ಕೆ ಅನುಗುಣವಾಗಿರುತ್ತದೆ.';

  @override
  String get assessmentScannerSubjectPlaceholder => 'ವಿಷಯ ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get assessmentScannerSubjectError => 'ದಯವಿಟ್ಟು ವಿಷಯ ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get assessmentScannerGradeLabel => 'ತರಗತಿ ಮಟ್ಟ';

  @override
  String get assessmentScannerGradePlaceholder => 'ತರಗತಿ ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get assessmentScannerGradeError => 'ದಯವಿಟ್ಟು ತರಗತಿ ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get assessmentScannerOptional => 'ಐಚ್ಛಿಕ';

  @override
  String get assessmentScannerAnswerKeyLabel => 'ಉತ್ತರ ಕೀಲಿ';

  @override
  String get assessmentScannerAnswerKeyHint =>
      'ಸರಿಯಾದ ಉತ್ತರಗಳನ್ನು ಅಂಟಿಸಿ, ಅವುಗಳ ಪ್ರಕಾರ ಮೌಲ್ಯಮಾಪನವಾಗುತ್ತದೆ.';

  @override
  String get assessmentScannerAnswerKeyPlaceholder =>
      'ಉತ್ತರ ಕೀಲಿಯನ್ನು ಬರೆಯಿರಿ ಅಥವಾ ಅಂಟಿಸಿ';

  @override
  String get assessmentScannerPrivacyNote =>
      'ಮೌಲ್ಯಮಾಪನಕ್ಕಾಗಿ ವಿದ್ಯಾರ್ಥಿಯ ಹೆಸರನ್ನು ಎಂದಿಗೂ ಕಳುಹಿಸಲಾಗುವುದಿಲ್ಲ.';

  @override
  String assessmentScannerScoreCaption(String awarded, String max) {
    return '$max ರಲ್ಲಿ $awarded ಅಂಕಗಳು';
  }

  @override
  String get assessmentScannerScoreOutOf => '100 ರಲ್ಲಿ';

  @override
  String assessmentScannerMarks(String awarded, String max) {
    return '$awarded/$max';
  }

  @override
  String assessmentScannerPagesMeta(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಪುಟಗಳು',
      one: '1 ಪುಟ',
    );
    return '$_temp0';
  }

  @override
  String assessmentScannerReviewBadge(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಪರಿಶೀಲಿಸಿ',
      one: '1 ಪರಿಶೀಲಿಸಿ',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerQuestionsSection => 'ಪ್ರಶ್ನೆವಾರು';

  @override
  String get assessmentScannerStudentAnswerLabel => 'ವಿದ್ಯಾರ್ಥಿ ಬರೆದದ್ದು';

  @override
  String get assessmentScannerFeedbackLabel => 'ಪ್ರತಿಕ್ರಿಯೆ';

  @override
  String get assessmentScannerExpectedLabel => 'ನಿರೀಕ್ಷಿತ ಉತ್ತರ';

  @override
  String get assessmentScannerNextStepsSection =>
      'ಶಿಫಾರಸು ಮಾಡಿದ ಮುಂದಿನ ಹೆಜ್ಜೆಗಳು';

  @override
  String get assessmentScannerStudentSection => 'ವಿದ್ಯಾರ್ಥಿಗಾಗಿ';

  @override
  String get assessmentScannerQualitySection => 'ಫೋಟೋ ಗುಣಮಟ್ಟ';

  @override
  String get assessmentScannerNotScored => 'ಅಂಕ ನೀಡಿಲ್ಲ';

  @override
  String get assessmentScannerNoContent =>
      'ಯಾವುದೇ ಅಂಕಗಳು ಬರಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ಪಷ್ಟ ಫೋಟೋಗಳನ್ನು ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get assessmentScannerOutcomeCorrect => 'ಸರಿ';

  @override
  String get assessmentScannerOutcomePartial => 'ಭಾಗಶಃ ಸರಿ';

  @override
  String get assessmentScannerOutcomeIncorrect => 'ತಪ್ಪು';

  @override
  String get assessmentScannerReviewChip => 'ಇದನ್ನು ಪರಿಶೀಲಿಸಿ';

  @override
  String get assessmentScannerSignIn =>
      'ಉತ್ತರ ಪತ್ರಿಕೆಯನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಲು ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get assessmentScannerUpgradeTitle => 'ಹೆಚ್ಚಿನ ಯೋಜನೆ ಅಗತ್ಯವಿದೆ';

  @override
  String get assessmentScannerUpgradeBody =>
      'ಉತ್ತರ ಪತ್ರಿಕೆಗಳ ಮೌಲ್ಯಮಾಪನ ಹೆಚ್ಚಿನ ಯೋಜನೆಯ ಭಾಗ. ಮೌಲ್ಯಮಾಪನ ಮುಂದುವರಿಸಲು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get assessmentScannerSeePricing => 'ಯೋಜನೆಗಳನ್ನು ನೋಡಿ';

  @override
  String get assessmentScannerDailyLimitTitle =>
      'ಇಂದಿನ ನಿಮ್ಮ ಎಲ್ಲಾ ಉತ್ತರ ಪತ್ರಿಕೆಗಳು ಮುಗಿದವು';

  @override
  String get assessmentScannerDailyLimitBody =>
      'ನಿಮ್ಮ ಯೋಜನೆಯಲ್ಲಿ ಪ್ರತಿ ದಿನ ನಿಗದಿತ ಸಂಖ್ಯೆಯ ಉತ್ತರ ಪತ್ರಿಕೆಗಳಿವೆ. ಅವು ನಾಳೆ ಮತ್ತೆ ಆರಂಭವಾಗುತ್ತವೆ, ಅಥವಾ ಹೆಚ್ಚಿನ ಯೋಜನೆಯಲ್ಲಿ ಮಿತಿಯನ್ನು ಹೆಚ್ಚಿಸಬಹುದು.';

  @override
  String get assessmentScannerLimitTitle =>
      'ನೀವು ನಿಮ್ಮ ಮೌಲ್ಯಮಾಪನ ಮಿತಿಯನ್ನು ತಲುಪಿದ್ದೀರಿ';

  @override
  String get assessmentScannerLimitBody =>
      'ನಿಮ್ಮ ಯೋಜನೆಯ ಎಲ್ಲಾ ಉತ್ತರ ಪತ್ರಿಕೆಗಳನ್ನು ಬಳಸಿದ್ದೀರಿ. ಅವು ಮುಂದಿನ ತಿಂಗಳು ಮತ್ತೆ ಆರಂಭವಾಗುತ್ತವೆ, ಅಥವಾ ಹೆಚ್ಚಿನ ಯೋಜನೆಯಲ್ಲಿ ಮಿತಿಯನ್ನು ಹೆಚ್ಚಿಸಬಹುದು.';

  @override
  String get assessmentScannerBusy =>
      'ಮೌಲ್ಯಮಾಪನ ಮಾದರಿ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಒಂದು ನಿಮಿಷದಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String assessmentScannerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'ಮೌಲ್ಯಮಾಪನ ಮಾದರಿ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸುಮಾರು $seconds ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      one:
          'ಮೌಲ್ಯಮಾಪನ ಮಾದರಿ ಈಗ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸುಮಾರು 1 ಸೆಕೆಂಡಿನಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerTimeout =>
      'ಮೌಲ್ಯಮಾಪನಕ್ಕೆ ಎಂದಿನಂತಿಗಿಂತ ಹೆಚ್ಚು ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get assessmentScannerRephrase =>
      'ಫೋಟೋಗಳನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ಪಷ್ಟ ಪುಟಗಳನ್ನು ಮತ್ತೆ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.';

  @override
  String get inboxTitle => 'ಸಂದೇಶಗಳು';

  @override
  String get inboxSignInTitle => 'ನಿಮ್ಮ ಸಂದೇಶಗಳು';

  @override
  String get inboxSignInBody => 'ನಿಮ್ಮ ಸಂದೇಶಗಳನ್ನು ನೋಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ';

  @override
  String get inboxEmptyTitle => 'ಇನ್ನೂ ಯಾವುದೇ ಸಂಭಾಷಣೆಗಳಿಲ್ಲ';

  @override
  String get inboxEmptyBody =>
      'ನೀವು ಶಿಕ್ಷಕರೊಂದಿಗೆ ಸಂಪರ್ಕ ಸಾಧಿಸಿದಾಗ, ನಿಮ್ಮ ಸಂಭಾಷಣೆಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.';

  @override
  String get inboxErrorBody =>
      'ನಿಮ್ಮ ಸಂದೇಶಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get inboxNoMessagesYet => 'ಇನ್ನೂ ಯಾವುದೇ ಸಂದೇಶಗಳಿಲ್ಲ';

  @override
  String get inboxThreadFallbackTitle => 'ಸಂಭಾಷಣೆ';

  @override
  String get inboxThreadEmptyTitle => 'ಇನ್ನೂ ಯಾವುದೇ ಸಂದೇಶಗಳಿಲ್ಲ';

  @override
  String get inboxThreadEmptyBody => 'ಸಂಭಾಷಣೆ ಪ್ರಾರಂಭಿಸಲು ನಮಸ್ಕಾರ ಹೇಳಿ.';

  @override
  String get inboxComposerHint => 'ಒಂದು ಸಂದೇಶ ಬರೆಯಿರಿ';

  @override
  String get inboxComposerSend => 'ಕಳುಹಿಸಿ';

  @override
  String get inboxComposerTooLong =>
      'ಸಂದೇಶ ತುಂಬಾ ಉದ್ದವಾಗಿದೆ. ದಯವಿಟ್ಟು ಕಡಿಮೆ ಮಾಡಿ.';

  @override
  String get inboxLoadOlder => 'ಹಳೆಯ ಸಂದೇಶಗಳನ್ನು ಲೋಡ್ ಮಾಡಿ';

  @override
  String get inboxSendFailed => 'ನಿಮ್ಮ ಸಂದೇಶ ಕಳುಹಿಸಲಾಗಲಿಲ್ಲ.';

  @override
  String get inboxResourceLabel => 'ಸಂಪನ್ಮೂಲ';

  @override
  String get inboxVoiceNoteLabel => 'ಧ್ವನಿ ಟಿಪ್ಪಣಿ';

  @override
  String inboxUnreadLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಓದದಿರುವವು',
      one: '1 ಓದದಿರುವುದು',
    );
    return '$_temp0';
  }

  @override
  String get inboxTickSending => 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ';

  @override
  String get inboxTickSent => 'ಕಳುಹಿಸಲಾಗಿದೆ';

  @override
  String get inboxTickDelivered => 'ತಲುಪಿದೆ';

  @override
  String get inboxTickRead => 'ಓದಲಾಗಿದೆ';

  @override
  String get inboxTickFailed => 'ಕಳುಹಿಸಲಾಗಿಲ್ಲ';

  @override
  String get inboxTimeNow => 'ಈಗ';

  @override
  String inboxTimeMinutes(int count) {
    return '$count ನಿ';
  }

  @override
  String inboxTimeHours(int count) {
    return '$count ಗಂ';
  }

  @override
  String inboxTimeDays(int count) {
    return '$count ದಿ';
  }

  @override
  String inboxTimeWeeks(int count) {
    return '$count ವಾ';
  }

  @override
  String get networkTitle => 'ನೆಟ್‌ವರ್ಕ್';

  @override
  String get networkTooltip => 'ನೆಟ್‌ವರ್ಕ್';

  @override
  String get networkTabStaffroom => 'ಸ್ಟಾಫ್‌ರೂಮ್';

  @override
  String get networkTabMessages => 'ಸಂದೇಶಗಳು';

  @override
  String get networkTabUpdates => 'ಅಪ್‌ಡೇಟ್‌ಗಳು';

  @override
  String get notificationsEmptyTitle => 'ಇನ್ನೂ ಹೊಸದೇನೂ ಇಲ್ಲ';

  @override
  String get notificationsEmptyBody =>
      'ಕರೆಯ ಫಲಿತಾಂಶಗಳು, ಹಾಜರಾತಿ ಎಚ್ಚರಿಕೆಗಳು ಮತ್ತು ಸಿದ್ಧವಾದ ಪ್ರಶ್ನೆಪತ್ರಿಕೆಗಳು ನಡೆದಂತೆಯೇ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.';

  @override
  String get notificationsLocalNote =>
      'ನೀವು ಅಪ್ಲಿಕೇಶನ್ ತೆರೆದಾಗ ಇವು ಕಾಣಿಸುತ್ತವೆ. SahayakAI ಇನ್ನೂ ಫೋನ್ ಅಧಿಸೂಚನೆಗಳನ್ನು ಕಳುಹಿಸುವುದಿಲ್ಲ.';

  @override
  String get notificationsMarkAllRead => 'ಎಲ್ಲವನ್ನೂ ಓದಿದಂತೆ ಗುರುತಿಸಿ';

  @override
  String notificationCallCompletedTitle(String student) {
    return '$student ಅವರಿಗಾಗಿ ಪೋಷಕರ ಕರೆ ಮುಗಿದಿದೆ';
  }

  @override
  String get notificationCallCompletedBody =>
      'ಸಂಭಾಷಣೆಯ ಸಾರಾಂಶ ಪೋಷಕರ ಕರೆ ವಿಭಾಗದಲ್ಲಿ ಸಿದ್ಧವಾಗಿದೆ.';

  @override
  String notificationCallFailedTitle(String student) {
    return '$student ಅವರಿಗಾಗಿ ಪೋಷಕರ ಕರೆ ಸಂಪರ್ಕವಾಗಲಿಲ್ಲ';
  }

  @override
  String get notificationCallFailedBody =>
      'ಮತ್ತೆ ಕರೆ ಮಾಡಿ, ಅಥವಾ ಸಂದೇಶವನ್ನು WhatsApp ನಲ್ಲಿ ಕಳುಹಿಸಿ.';

  @override
  String notificationAbsenceTitle(String student, int count) {
    return '$student ಸತತ $count ದಿನ ಗೈರುಹಾಜರಾಗಿದ್ದಾರೆ';
  }

  @override
  String notificationAbsenceBody(String className) {
    return 'ತಪ್ಪಿದ ದಿನಗಳನ್ನು ನೋಡಲು $className ತೆರೆಯಿರಿ.';
  }

  @override
  String notificationExamPaperTitle(String subject) {
    return '$subject ಪ್ರಶ್ನೆಪತ್ರಿಕೆ ಸಿದ್ಧವಾಗುತ್ತಿದೆ';
  }

  @override
  String get notificationExamPaperBody =>
      'ಇದು ಇನ್ನೂ ಸಿದ್ಧವಾಗುತ್ತಿದೆ ಮತ್ತು ತಾನಾಗಿಯೇ ನಿಮ್ಮ ಗ್ರಂಥಾಲಯದಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.';

  @override
  String get staffroomTitle => 'ಸ್ಟಾಫ್‌ರೂಮ್';

  @override
  String get staffroomHeroTitle => 'ಸ್ಟಾಫ್‌ರೂಮ್';

  @override
  String get staffroomHeroDeck => 'ಭಾರತದಾದ್ಯಂತ ಶಿಕ್ಷಕರು, ಒಂದೇ ಕೋಣೆಯಲ್ಲಿ';

  @override
  String get staffroomSectionGroups => 'ನಿಮ್ಮ ಗುಂಪುಗಳು';

  @override
  String get staffroomSectionFeed => 'ನಿಮ್ಮ ಗುಂಪುಗಳಿಂದ';

  @override
  String get staffroomSectionDiscover => 'ಗುಂಪುಗಳನ್ನು ಹುಡುಕಿ';

  @override
  String get staffroomSectionPeople => 'ನಿಮಗೆ ಗೊತ್ತಿರಬಹುದಾದವರು';

  @override
  String get staffroomSignInTitle => 'ಸ್ಟಾಫ್‌ರೂಮ್‌ಗೆ ಸೇರಿ';

  @override
  String get staffroomSignInBody => 'ಸ್ಟಾಫ್‌ರೂಮ್‌ಗೆ ಸೇರಲು ಸೈನ್ ಇನ್ ಮಾಡಿ';

  @override
  String get staffroomFeedEmptyTitle => 'ನಿಮ್ಮ ಫೀಡ್ ಶಾಂತವಾಗಿದೆ';

  @override
  String get staffroomFeedEmptyBody =>
      'ನಿಮ್ಮ ಗುಂಪುಗಳ ಪೋಸ್ಟ್‌ಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.';

  @override
  String get staffroomErrorBody =>
      'ನಾವು ಸ್ಟಾಫ್‌ರೂಮ್ ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get staffroomGroupsEmptyTitle => 'ಇನ್ನೂ ಯಾವುದೇ ಗುಂಪುಗಳಿಲ್ಲ';

  @override
  String get staffroomGroupsEmptyBody =>
      'ಪೋಸ್ಟ್ ಮತ್ತು ಚಾಟ್ ನೋಡಲು ಒಂದು ಗುಂಪಿಗೆ ಸೇರಿ.';

  @override
  String get staffroomBrowseGroups => 'ಗುಂಪುಗಳನ್ನು ಬ್ರೌಸ್ ಮಾಡಿ';

  @override
  String staffroomMemberCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಸದಸ್ಯರು',
      one: '1 ಸದಸ್ಯ',
    );
    return '$_temp0';
  }

  @override
  String get staffroomJoin => 'ಸೇರಿ';

  @override
  String get staffroomJoined => 'ಸೇರಿದ್ದೀರಿ';

  @override
  String get staffroomJoinFailed =>
      'ಸೇರಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ.';

  @override
  String get staffroomGroupLockedTitle => 'ಸದಸ್ಯರಿಗೆ ಮಾತ್ರ';

  @override
  String get staffroomGroupLockedBody => 'ಈ ಗುಂಪಿನ ಪೋಸ್ಟ್‌ಗಳನ್ನು ನೋಡಲು ಸೇರಿ.';

  @override
  String get staffroomGroupPostsEmptyTitle => 'ಇನ್ನೂ ಯಾವುದೇ ಪೋಸ್ಟ್‌ಗಳಿಲ್ಲ';

  @override
  String get staffroomGroupPostsEmptyBody => 'ಇಲ್ಲಿ ಮೊದಲು ಹಂಚಿಕೊಳ್ಳಿ.';

  @override
  String get staffroomGroupNotFoundTitle => 'ಗುಂಪು ಸಿಗಲಿಲ್ಲ';

  @override
  String get staffroomGroupNotFoundBody => 'ಈ ಗುಂಪನ್ನು ತೆಗೆದುಹಾಕಲಾಗಿರಬಹುದು.';

  @override
  String get staffroomPostTypeShare => 'ಹಂಚಿಕೊಂಡರು';

  @override
  String get staffroomPostTypeAskHelp => 'ಸಹಾಯ ಬೇಕು';

  @override
  String get staffroomPostTypeCelebrate => 'ಸಂಭ್ರಮ';

  @override
  String get staffroomPostTypeResource => 'ಸಂಪನ್ಮೂಲ';

  @override
  String get staffroomLike => 'ಇಷ್ಟ';

  @override
  String get staffroomLiked => 'ಇಷ್ಟಪಟ್ಟಿದ್ದೀರಿ';

  @override
  String staffroomLikeCountLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಇಷ್ಟಗಳು',
      one: '1 ಇಷ್ಟ',
      zero: 'ಇಷ್ಟಗಳಿಲ್ಲ',
    );
    return '$_temp0';
  }

  @override
  String get staffroomLikeFailed =>
      'ಅಪ್‌ಡೇಟ್ ಮಾಡಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ.';

  @override
  String get staffroomResourceShared => 'ಒಂದು ಸಂಪನ್ಮೂಲ ಹಂಚಿಕೊಂಡರು';

  @override
  String staffroomChatHighlight(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಹೊಸ ಸಂದೇಶಗಳು',
      one: '1 ಹೊಸ ಸಂದೇಶ',
    );
    return '$_temp0';
  }

  @override
  String get staffroomConnect => 'ಸಂಪರ್ಕಿಸಿ';

  @override
  String get staffroomConnectSent => 'ವಿನಂತಿ ಕಳುಹಿಸಲಾಗಿದೆ';

  @override
  String get staffroomConnectPending => 'ವಿನಂತಿ ಈಗಾಗಲೇ ಬಾಕಿ ಇದೆ';

  @override
  String get staffroomConnectConnected => 'ಈಗಾಗಲೇ ಸಂಪರ್ಕಗೊಂಡಿದೆ';

  @override
  String get staffroomChatTitle => 'ಸ್ಟಾಫ್‌ರೂಮ್';

  @override
  String get staffroomChatEntryBody => 'ಭಾರತದಾದ್ಯಂತ ಶಿಕ್ಷಕರೊಂದಿಗೆ ಚಾಟ್ ಮಾಡಿ';

  @override
  String get staffroomChatSignInTitle => 'ಸ್ಟಾಫ್‌ರೂಮ್‌ಗೆ ಸೇರಿ';

  @override
  String get staffroomChatSignInBody => 'ಸ್ಟಾಫ್‌ರೂಮ್‌ಗೆ ಸೇರಲು ಸೈನ್ ಇನ್ ಮಾಡಿ';

  @override
  String get staffroomChatEmptyTitle => 'ಇನ್ನೂ ಯಾವುದೇ ಸಂದೇಶಗಳಿಲ್ಲ';

  @override
  String get staffroomChatEmptyBody => 'ಮೊದಲಿಗರಾಗಿ ನಮಸ್ಕಾರ ಹೇಳಿ.';

  @override
  String get staffroomChatAiBadge => 'AI ಶಿಕ್ಷಕ';

  @override
  String get staffroomGroupChatEntry => 'ಗುಂಪು ಚಾಟ್';

  @override
  String get staffroomDirectoryTitle => 'ಶಿಕ್ಷಕರನ್ನು ಹುಡುಕಿ';

  @override
  String get staffroomDirectoryEntryBody => 'ಶಿಕ್ಷಕ ಡೈರೆಕ್ಟರಿಯಲ್ಲಿ ಹುಡುಕಿ';

  @override
  String get staffroomDirectorySearchHint => 'ಹೆಸರು ಅಥವಾ ವಿಷಯದ ಮೂಲಕ ಹುಡುಕಿ';

  @override
  String get staffroomDirectoryErrorBody =>
      'ಡೈರೆಕ್ಟರಿ ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get staffroomDirectoryEmptyTitle => 'ಯಾವುದೇ ಶಿಕ್ಷಕರು ಸಿಗಲಿಲ್ಲ';

  @override
  String get staffroomDirectoryEmptyBody => 'ತೋರಿಸಲು ಇನ್ನೂ ಯಾವುದೇ ಶಿಕ್ಷಕರಿಲ್ಲ.';

  @override
  String get staffroomDirectorySearchEmpty =>
      'ನಿಮ್ಮ ಹುಡುಕಾಟಕ್ಕೆ ಯಾವುದೇ ಶಿಕ್ಷಕರು ಹೊಂದಿಕೆಯಾಗಲಿಲ್ಲ.';

  @override
  String get staffroomProfileTitle => 'ಶಿಕ್ಷಕ';

  @override
  String get staffroomProfileErrorBody =>
      'ಈ ಪ್ರೊಫೈಲ್ ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get staffroomProfileNotFoundTitle => 'ಪ್ರೊಫೈಲ್ ಲಭ್ಯವಿಲ್ಲ';

  @override
  String get staffroomProfileNotFoundBody => 'ಈ ಪ್ರೊಫೈಲ್ ಕಂಡುಬಂದಿಲ್ಲ.';

  @override
  String get staffroomProfileAboutLabel => 'ಪರಿಚಯ';

  @override
  String get staffroomProfileBioEmpty => 'ಇನ್ನೂ ಯಾವುದೇ ಪರಿಚಯವಿಲ್ಲ.';

  @override
  String get staffroomProfileVerified => 'ಪರಿಶೀಲಿಸಲಾಗಿದೆ';

  @override
  String staffroomProfileExperience(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ವರ್ಷಗಳ ಅನುಭವ',
      one: '1 ವರ್ಷದ ಅನುಭವ',
    );
    return '$_temp0';
  }

  @override
  String get staffroomProfileSubjectsLabel => 'ವಿಷಯಗಳು';

  @override
  String get staffroomProfileClassesLabel => 'ತರಗತಿಗಳು';

  @override
  String get staffroomProfileLanguagesLabel => 'ಭಾಷೆಗಳು';

  @override
  String get staffroomRequested => 'ವಿನಂತಿ ಕಳುಹಿಸಲಾಗಿದೆ';

  @override
  String get staffroomConnectionAccept => 'ಸ್ವೀಕರಿಸಿ';

  @override
  String get staffroomConnectionDecline => 'ತಿರಸ್ಕರಿಸಿ';

  @override
  String get staffroomConnected => 'ಕನೆಕ್ಟ್ ಆಗಿದೆ';

  @override
  String get staffroomConnectionWants => 'ಕನೆಕ್ಟ್ ಆಗಲು ಬಯಸುತ್ತಾರೆ';

  @override
  String get staffroomMessage => 'ಸಂದೇಶ ಕಳುಹಿಸಿ';

  @override
  String get staffroomConnectToMessage => 'ಸಂದೇಶ ಕಳುಹಿಸಲು ಕನೆಕ್ಟ್ ಆಗಿ';

  @override
  String get staffroomConnectionFailed =>
      'ಅಪ್‌ಡೇಟ್ ಮಾಡಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ.';

  @override
  String get staffroomDisconnect => 'ಡಿಸ್‌ಕನೆಕ್ಟ್ ಮಾಡಿ';

  @override
  String get staffroomDisconnectConfirmTitle => 'ಡಿಸ್‌ಕನೆಕ್ಟ್ ಮಾಡುವುದೇ?';

  @override
  String get staffroomDisconnectConfirmBody =>
      'ನೀವು ಇನ್ನು ಮುಂದೆ ಕನೆಕ್ಟ್ ಆಗಿರುವುದಿಲ್ಲ ಅಥವಾ ಪರಸ್ಪರ ಸಂದೇಶ ಕಳುಹಿಸಲು ಸಾಧ್ಯವಾಗುವುದಿಲ್ಲ.';

  @override
  String get staffroomDisconnectCancel => 'ಕನೆಕ್ಟ್ ಆಗಿರಿ';

  @override
  String get staffroomFollow => 'ಫಾಲೋ ಮಾಡಿ';

  @override
  String get staffroomFollowing => 'ಫಾಲೋ ಮಾಡುತ್ತಿದ್ದೀರಿ';

  @override
  String get staffroomFollowFailed =>
      'ಅಪ್‌ಡೇಟ್ ಮಾಡಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ.';

  @override
  String get actionShare => 'ಹಂಚಿಕೊಳ್ಳಿ';

  @override
  String get resultSaveToLibrary => 'ಗ್ರಂಥಾಲಯಕ್ಕೆ ಉಳಿಸಿ';

  @override
  String get resultSaving => 'ಉಳಿಸಲಾಗುತ್ತಿದೆ';

  @override
  String get resultSaved => 'ನಿಮ್ಮ ಗ್ರಂಥಾಲಯಕ್ಕೆ ಉಳಿಸಲಾಗಿದೆ';

  @override
  String get resultSaveFailedTitle => 'ಉಳಿಸಲಾಗಲಿಲ್ಲ';

  @override
  String get resultSaveFailedBody =>
      'ಇದನ್ನು ನಿಮ್ಮ ಗ್ರಂಥಾಲಯಕ್ಕೆ ಉಳಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get resultSaveRetry => 'ಮತ್ತೆ ಉಳಿಸಲು ಪ್ರಯತ್ನಿಸಿ';

  @override
  String get resultShareFailed =>
      'ಹಂಚಿಕೊಳ್ಳಲಾಗಲಿಲ್ಲ. ಬದಲಾಗಿ ಪಠ್ಯವನ್ನು ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ನಕಲಿಸಲಾಗಿದೆ.';

  @override
  String get actionCancel => 'ರದ್ದುಗೊಳಿಸಿ';

  @override
  String get attendanceTitle => 'ಹಾಜರಾತಿ';

  @override
  String get attendanceClassesEyebrow => 'ನಿಮ್ಮ ತರಗತಿಗಳು';

  @override
  String get attendanceClassesIntro =>
      'ಹಾಜರಾತಿ ಪುಸ್ತಕ ಭರ್ತಿ ಮಾಡಲು ಒಂದು ತರಗತಿಯನ್ನು ಆರಿಸಿ.';

  @override
  String get attendanceClassesEmptyTitle => 'ಇನ್ನೂ ತರಗತಿಗಳಿಲ್ಲ';

  @override
  String get attendanceClassesEmptyBody =>
      'ಮೊದಲು ನಿಮ್ಮ ತರಗತಿಯನ್ನು ರಚಿಸಿ, ನಂತರ ಅದರಲ್ಲಿ ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ಸೇರಿಸಿ.';

  @override
  String get attendanceClassesError =>
      'ನಿಮ್ಮ ತರಗತಿಗಳನ್ನು ನಮಗೆ ತರಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.';

  @override
  String get attendanceClassFullBadge => 'ಭರ್ತಿಯಾಗಿದೆ';

  @override
  String get attendanceNewClass => 'ಹೊಸ ತರಗತಿ';

  @override
  String get attendanceOpenRegister => 'ಹಾಜರಾತಿ ಬರೆಯಿರಿ';

  @override
  String get attendanceOpenRoster => 'ವಿದ್ಯಾರ್ಥಿಗಳು';

  @override
  String get attendanceOpenMonth => 'ಈ ತಿಂಗಳು';

  @override
  String get attendanceSignedOutTitle =>
      'ನಿಮ್ಮ ತರಗತಿಗಳನ್ನು ನೋಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ';

  @override
  String get attendanceSignedOutBody =>
      'ನಿಮ್ಮ ತರಗತಿಗಳು ಮತ್ತು ಹಾಜರಾತಿ ಪುಸ್ತಕಗಳು ನಿಮ್ಮ ಖಾತೆಯಲ್ಲಿ ಉಳಿಯುತ್ತವೆ. ಸೈನ್ ಇನ್ ಮಾಡಿದರೆ ಅವು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.';

  @override
  String get attendanceClassNameLabel => 'ತರಗತಿಯ ಹೆಸರು';

  @override
  String get attendanceClassNameHint => 'ಉದಾಹರಣೆಗೆ, ತರಗತಿ 6A';

  @override
  String get attendanceClassNameRequired => 'ತರಗತಿಯ ಹೆಸರನ್ನು ಬರೆಯಿರಿ.';

  @override
  String get attendanceSubjectLabel => 'ವಿಷಯ';

  @override
  String get attendanceGradeLabel => 'ತರಗತಿ ಹಂತ';

  @override
  String get attendanceAcademicYearLabel => 'ಶೈಕ್ಷಣಿಕ ವರ್ಷ';

  @override
  String get attendanceAcademicYearHint => 'ಉದಾಹರಣೆಗೆ, 2026-27';

  @override
  String get attendanceAcademicYearRequired => 'ಶೈಕ್ಷಣಿಕ ವರ್ಷವನ್ನು ಬರೆಯಿರಿ.';

  @override
  String get attendanceSectionLabel => 'ವಿಭಾಗ';

  @override
  String get attendanceSectionHint => 'ಉದಾಹರಣೆಗೆ, A';

  @override
  String get attendanceCreateClassSubmit => 'ತರಗತಿ ರಚಿಸಿ';

  @override
  String get attendanceClassCreated => 'ತರಗತಿ ರಚನೆಯಾಯಿತು.';

  @override
  String get attendanceCreateClassFailed =>
      'ಈ ತರಗತಿಯನ್ನು ನಮಗೆ ರಚಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.';

  @override
  String get attendanceRosterEyebrow => 'ತರಗತಿ ಪಟ್ಟಿ';

  @override
  String get attendanceRosterUnavailableTitle =>
      'ಪಟ್ಟಿ ಇನ್ನೂ ತೋರಿಸಲು ಸಿದ್ಧವಾಗಿಲ್ಲ';

  @override
  String get attendanceRosterUnavailableBody =>
      'ಪೋಷಕರ ಸಂಪರ್ಕ ವಿವರಗಳನ್ನು ನಮ್ಮ ಸರ್ವರ್‌ಗಳಲ್ಲಿ ಮರೆಮಾಡಿದ ರೂಪಕ್ಕೆ ಸರಿಸಲಾಗುತ್ತಿದೆ; ಅದು ಜಾರಿಗೆ ಬರುವವರೆಗೆ ಈ ಆ್ಯಪ್ ಅವುಗಳನ್ನು ಇಳಿಸಿಕೊಳ್ಳುವುದಿಲ್ಲ. ನಿಮ್ಮ ತರಗತಿಯಲ್ಲಿ ಯಾವ ತಪ್ಪೂ ಇಲ್ಲ, ಏನೂ ಕಳೆದುಹೋಗಿಲ್ಲ. ಹಾಜರಾತಿ ಬರೆಯುವುದು ಮತ್ತು ತಿಂಗಳ ವಿವರ ಎಂದಿನಂತೆ ಕೆಲಸ ಮಾಡುತ್ತವೆ.';

  @override
  String get attendanceRosterEmptyTitle => 'ಇನ್ನೂ ವಿದ್ಯಾರ್ಥಿಗಳಿಲ್ಲ';

  @override
  String get attendanceRosterEmptyBody =>
      'ಹಾಜರಾತಿ ಬರೆಯಲು ಆರಂಭಿಸಲು ಈ ತರಗತಿಯ ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ಸೇರಿಸಿ.';

  @override
  String get attendanceRosterError => 'ಈ ಪಟ್ಟಿಯನ್ನು ನಮಗೆ ತರಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.';

  @override
  String attendanceRollLabel(int roll) {
    return 'ರೋಲ್ $roll';
  }

  @override
  String get attendanceNoParentPhone => 'ಪೋಷಕರ ಸಂಖ್ಯೆ ಉಳಿಸಿಲ್ಲ';

  @override
  String attendanceParentPhoneMask(String last4) {
    return '•••• $last4';
  }

  @override
  String get attendanceAddStudent => 'ವಿದ್ಯಾರ್ಥಿಯನ್ನು ಸೇರಿಸಿ';

  @override
  String get attendanceStudentNameLabel => 'ವಿದ್ಯಾರ್ಥಿಯ ಹೆಸರು';

  @override
  String get attendanceStudentNameRequired => 'ವಿದ್ಯಾರ್ಥಿಯ ಹೆಸರನ್ನು ಬರೆಯಿರಿ.';

  @override
  String get attendanceRollNumberLabel => 'ರೋಲ್ ಸಂಖ್ಯೆ';

  @override
  String get attendanceRollNumberHint => '1 ರಿಂದ 40';

  @override
  String get attendanceRollNumberInvalid =>
      'ರೋಲ್ ಸಂಖ್ಯೆ 1 ರಿಂದ 40 ರ ನಡುವಿನ ಪೂರ್ಣ ಸಂಖ್ಯೆಯಾಗಿರಬೇಕು.';

  @override
  String get attendanceParentPhoneLabel => 'ಪೋಷಕರ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ';

  @override
  String get attendanceParentPhoneHint => '10 ಅಂಕಿಗಳ ಭಾರತೀಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ';

  @override
  String get attendanceParentPhoneRequired =>
      'ಪೋಷಕರ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ಬರೆಯಿರಿ.';

  @override
  String get attendanceParentPhoneInvalid =>
      '10 ಅಂಕಿಗಳ ಭಾರತೀಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ಬರೆಯಿರಿ.';

  @override
  String get attendanceParentLanguageLabel => 'ಪೋಷಕರ ಭಾಷೆ';

  @override
  String get attendanceParentPhonePrivacy =>
      'ನಿಮ್ಮ ಪರವಾಗಿ ಈ ಪೋಷಕರಿಗೆ ಕರೆ ಮಾಡಲು ಈ ಸಂಖ್ಯೆಯನ್ನು SahayakAI ಗೆ ಕಳುಹಿಸಲಾಗುತ್ತದೆ. ಇದನ್ನು ಎಂದಿಗೂ ಈ ಫೋನಿಗೆ ಮರಳಿ ಇಳಿಸಲಾಗುವುದಿಲ್ಲ.';

  @override
  String get attendanceStudentAdded => 'ವಿದ್ಯಾರ್ಥಿ ಸೇರಿಸಲಾಯಿತು.';

  @override
  String get attendanceAddStudentFailed =>
      'ಈ ವಿದ್ಯಾರ್ಥಿಯನ್ನು ನಮಗೆ ಸೇರಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.';

  @override
  String get attendanceClassFullTitle => 'ಈ ತರಗತಿ ಭರ್ತಿಯಾಗಿದೆ';

  @override
  String attendanceClassFullBody(int max) {
    return 'ಒಂದು ತರಗತಿಯಲ್ಲಿ ಗರಿಷ್ಠ $max ವಿದ್ಯಾರ್ಥಿಗಳು ಇರಬಹುದು, ಆದ್ದರಿಂದ ಇನ್ನಷ್ಟು ಸೇರಿಸಲಾಗದು.';
  }

  @override
  String get attendanceMarkEyebrow => 'ದೈನಂದಿನ ಹಾಜರಾತಿ ಪುಸ್ತಕ';

  @override
  String get attendanceMarkIntro =>
      'ಇಂದು, ಅಥವಾ ಅದಕ್ಕೂ ಹಿಂದಿನ ಏಳು ದಿನಗಳಲ್ಲಿ ಯಾವುದೇ ದಿನವನ್ನು ಬರೆಯಿರಿ.';

  @override
  String get attendanceDateToday => 'ಇಂದು';

  @override
  String get attendanceDateYesterday => 'ನಿನ್ನೆ';

  @override
  String get attendanceWindowNote =>
      'ಹಾಜರಾತಿ ಪುಸ್ತಕ ಇಂದು ಮತ್ತು ಅದಕ್ಕೂ ಹಿಂದಿನ ಏಳು ದಿನಗಳಿಗೆ ತೆರೆದಿರುತ್ತದೆ. ಅದಕ್ಕಿಂತ ಹಳೆಯ ದಿನಗಳು ಮುಚ್ಚಿರುತ್ತವೆ.';

  @override
  String get attendanceStatusPresent => 'ಹಾಜರು';

  @override
  String get attendanceStatusAbsent => 'ಗೈರುಹಾಜರು';

  @override
  String get attendanceStatusLate => 'ತಡವಾಗಿ';

  @override
  String get attendanceStatusUnmarked => 'ದಾಖಲಾಗಿಲ್ಲ';

  @override
  String attendanceMarkProgress(int marked, int total) {
    return '$total ರಲ್ಲಿ $marked ದಾಖಲಾಗಿದೆ';
  }

  @override
  String get attendanceMarkAllPresent => 'ಎಲ್ಲರನ್ನೂ ಹಾಜರು ಎಂದು ಗುರುತಿಸಿ';

  @override
  String get attendanceSaveRegister => 'ಹಾಜರಾತಿ ಉಳಿಸಿ';

  @override
  String get attendanceRegisterSaved => 'ಹಾಜರಾತಿ ಉಳಿಸಲಾಯಿತು.';

  @override
  String get attendanceSaveRegisterFailed =>
      'ಈ ಹಾಜರಾತಿಯನ್ನು ನಮಗೆ ಉಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.';

  @override
  String get attendanceRegisterError =>
      'ಈ ಹಾಜರಾತಿಯನ್ನು ನಮಗೆ ತರಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.';

  @override
  String get attendanceNoStudentsTitle => 'ಈ ತರಗತಿಯಲ್ಲಿ ಇನ್ನೂ ವಿದ್ಯಾರ್ಥಿಗಳಿಲ್ಲ';

  @override
  String get attendanceNoStudentsBody =>
      'ಹಾಜರಾತಿ ಬರೆಯುವ ಮೊದಲು ವಿದ್ಯಾರ್ಥಿಯನ್ನು ಸೇರಿಸಿ.';

  @override
  String get attendanceMonthEyebrow => 'ಮಾಸಿಕ ಹಾಜರಾತಿ';

  @override
  String get attendanceMonthError =>
      'ಈ ತಿಂಗಳ ವಿವರವನ್ನು ನಮಗೆ ತರಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.';

  @override
  String get attendanceMonthEmptyTitle => 'ಈ ತಿಂಗಳು ಏನೂ ದಾಖಲಾಗಿಲ್ಲ';

  @override
  String get attendanceMonthEmptyBody =>
      'ಹಾಜರಾತಿ ಬರೆಯಲು ಆರಂಭಿಸಿದ ಕೂಡಲೇ ಪ್ರತಿ ವಿದ್ಯಾರ್ಥಿಯ ತಿಂಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.';

  @override
  String get attendanceMonthPrevious => 'ಹಿಂದಿನ ತಿಂಗಳು';

  @override
  String get attendanceMonthNext => 'ಮುಂದಿನ ತಿಂಗಳು';

  @override
  String get attendanceAbsencesTitle => 'ಗೈರುಹಾಜರಾದ ದಿನಗಳು';

  @override
  String get attendanceAbsencesEmpty => 'ಈ ತಿಂಗಳು ಗೈರುಹಾಜರಿ ಇಲ್ಲ.';

  @override
  String get attendanceAbsencesError =>
      'ಗೈರುಹಾಜರಾದ ದಿನಗಳನ್ನು ನಮಗೆ ತರಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.';

  @override
  String get attendancePremiumTitle => 'ಹಾಜರಾತಿ ಬರೆಯಲು Pro ಯೋಜನೆ ಬೇಕು';

  @override
  String get attendancePremiumBody =>
      'ನಿಮ್ಮ ತರಗತಿಗಳು, ಹಾಜರಾತಿ ಪುಸ್ತಕಗಳು ಮತ್ತು ತಿಂಗಳ ವಿವರಗಳನ್ನು ನೋಡುವುದು ಉಚಿತವಾಗಿಯೇ ಇರುತ್ತದೆ. ತರಗತಿ ರಚಿಸುವುದು, ವಿದ್ಯಾರ್ಥಿಯನ್ನು ಸೇರಿಸುವುದು ಮತ್ತು ಹಾಜರಾತಿ ಉಳಿಸುವುದು Pro ಯೋಜನೆಯ ಭಾಗ.';
}
