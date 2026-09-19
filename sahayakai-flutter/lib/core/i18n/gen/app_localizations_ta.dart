// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Tamil (`ta`).
class AppLocalizationsTa extends AppLocalizations {
  AppLocalizationsTa([String locale = 'ta']) : super(locale);

  @override
  String get appTitle => 'SahayakAI';

  @override
  String get navHome => 'முகப்பு';

  @override
  String get navCreate => 'உருவாக்கு';

  @override
  String get navLibrary => 'நூலகம்';

  @override
  String get navProfile => 'சுயவிவரம்';

  @override
  String get actionRetry => 'மீண்டும் முயற்சிக்கவும்';

  @override
  String get actionSignIn => 'உள்நுழையவும்';

  @override
  String get actionSignOut => 'வெளியேறு';

  @override
  String get actionGenerate => 'உருவாக்கு';

  @override
  String get stateOfflineTitle => 'நீங்கள் ஆஃப்லைனில் உள்ளீர்கள்';

  @override
  String get stateOfflineBody =>
      'உங்கள் இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get errorGeneric => 'ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get emptyDefault => 'படிவத்தை நிரப்பி உருவாக்கு என்பதைத் தட்டவும்.';

  @override
  String get languageLabel => 'மொழி';

  @override
  String get splashTagline => 'ஒவ்வொரு வகுப்பறைக்கும் கற்பித்தல் உதவியாளர்';

  @override
  String get splashFailedTitle => 'செயலியைத் தொடங்க முடியவில்லை';

  @override
  String get splashFailedBody =>
      'உங்கள் இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get loginTitle => 'SahayakAI-க்கு வரவேற்கிறோம்';

  @override
  String get loginSubtitle =>
      'பாடத் திட்டங்கள், வினாடி வினா மற்றும் பலவற்றுக்கு உள்நுழையவும்.';

  @override
  String get loginGoogle => 'Google மூலம் தொடரவும்';

  @override
  String get loginPrivacyNote =>
      'உங்களை உள்நுழைய வைக்க மட்டுமே நாங்கள் உங்கள் Google கணக்கைப் பயன்படுத்துகிறோம். உங்கள் பணி உங்களுடையதாகவே இருக்கும்.';

  @override
  String get loginLanguagePrompt => 'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்';

  @override
  String get loginLanguageHint =>
      'SahayakAI உங்கள் மொழியில் செயல்படுகிறது, மேலும் உங்கள் கற்பித்தல் பொருட்களையும் அதே மொழியில் எழுதுகிறது.';

  @override
  String get loginValueLessons =>
      'நிமிடங்களில் முழுமையான பாட திட்டத்தை உருவாக்குங்கள்';

  @override
  String get loginValueQuizzes =>
      'மூன்று சிரம நிலைகளில் வினாடி வினா உருவாக்குங்கள்';

  @override
  String get loginValueAnswers =>
      'உங்கள் மொழியில், வகுப்பறையின் எந்தக் கேள்விக்கும் பதில் அளியுங்கள்';

  @override
  String get onboardingTitle => 'SahayakAI-ஐ அமைக்கவும்';

  @override
  String get onboardingSkip => 'இப்போது வேண்டாம்';

  @override
  String onboardingStepLabel(int current, int total) {
    return '$total இல் படி $current';
  }

  @override
  String get onboardingBack => 'பின்';

  @override
  String get onboardingNext => 'அடுத்து';

  @override
  String get onboardingSaveAndContinue => 'சேமித்து தொடரவும்';

  @override
  String get onboardingFinish => 'எனது டாஷ்போர்டுக்குச் செல்லவும்';

  @override
  String get onboardingLanguageTitle =>
      'நீங்கள் எந்த மொழியில் கற்பிக்கிறீர்கள்?';

  @override
  String get onboardingLanguageBody =>
      'நீங்கள் தேர்ந்தெடுக்கும் மொழியில் தான் பாட திட்டங்கள், வினாடி வினாக்கள் மற்றும் பதில்கள் கிடைக்கும். நீங்கள் இதை எப்போது வேண்டுமானாலும் மாற்றலாம்.';

  @override
  String get onboardingProfileTitle =>
      'உங்கள் வகுப்பறையைப் பற்றி எங்களிடம் கூறுங்கள்';

  @override
  String get onboardingProfileBody =>
      'ஒவ்வொரு புலமும் விருப்பத்தேர்வு. நீங்கள் பகிரும் தகவல், உங்கள் பாடத்திட்டப் பொருட்களை உங்கள் வாரியம், வகுப்புகள் மற்றும் மாநிலத்திற்கு ஏற்ப பொருத்த பயன்படுத்தப்படுகிறது.';

  @override
  String get onboardingReadyTitle => 'நீங்கள் தொடங்கத் தயார்';

  @override
  String get onboardingReadyBody =>
      'உங்கள் பாட திட்டங்கள், வினாடி வினாக்கள் மற்றும் பதில்கள் இதற்கு ஏற்ப இருக்கும். பின்னர் எப்போது வேண்டுமானாலும் உங்கள் சுயவிவரத்திலிருந்து இதை மாற்றலாம்.';

  @override
  String get onboardingSaveFailed =>
      'உங்கள் சுயவிவரத்தை சேமிக்க முடியவில்லை. நீங்கள் இப்போது தொடரலாம், பின்னர் உங்கள் சுயவிவரத்திலிருந்து இதைச் சேர்க்கலாம்.';

  @override
  String get onboardingSaveSignIn =>
      'உங்கள் சுயவிவரத்தைச் சேமிக்க மீண்டும் உள்நுழையவும். நீங்கள் இப்போது தொடரலாம், பின்னர் இதைச் சேர்க்கலாம்.';

  @override
  String get dashboardGreeting => 'மீண்டும் வரவேற்கிறோம்';

  @override
  String dashboardGreetingNamed(String name) {
    return 'மீண்டும் வரவேற்கிறோம், $name';
  }

  @override
  String get dashboardGreetingMorning => 'காலை வணக்கம்';

  @override
  String get dashboardGreetingAfternoon => 'மதிய வணக்கம்';

  @override
  String get dashboardGreetingEvening => 'மாலை வணக்கம்';

  @override
  String get actionOpen => 'திறக்கவும்';

  @override
  String get actionRegenerate => 'மீண்டும் உருவாக்கு';

  @override
  String get actionCopy => 'நகலெடு';

  @override
  String get copyConfirmation => 'கிளிப்போர்டுக்கு நகலெடுக்கப்பட்டது';

  @override
  String get readAloudListen => 'கேட்கவும்';

  @override
  String get readAloudStop => 'நிறுத்தவும்';

  @override
  String get readAloudError =>
      'ஒலியை இயக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String voiceResultReady(String tool) {
    return 'உங்கள் $tool தயார்.';
  }

  @override
  String voiceResultReadyWithTopic(String tool, String topic) {
    return '$topic பற்றிய உங்கள் $tool தயார்.';
  }

  @override
  String get lessonPlanSectionLesson => 'பாடம்';

  @override
  String get lessonPlanSectionApproach => 'கற்பித்தல் அணுகுமுறை';

  @override
  String get quizSectionQuiz => 'வினாடி வினா';

  @override
  String get sectionForYourClass => 'உங்கள் வகுப்பிற்கு';

  @override
  String get instantAnswerResultTitle => 'பதில்';

  @override
  String get dashboardToolsTitle => 'உங்கள் கற்பித்தல் கருவிகள்';

  @override
  String get createPaletteSearchHint => 'கருவிகளைத் தேடுங்கள்';

  @override
  String get createPaletteEmpty =>
      'உங்கள் தேடலுக்கு எந்தக் கருவியும் பொருந்தவில்லை';

  @override
  String get dashboardRecentTitle => 'சமீபத்திய பணிகள்';

  @override
  String get dashboardRecentEmpty =>
      'நீங்கள் உருவாக்கும் அனைத்தும் இங்கே சேமிக்கப்படும், மீண்டும் திறக்கத் தயாராக.';

  @override
  String get dashboardRecentFailed =>
      'உங்கள் சமீபத்திய பணிகளைத் திறக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get dashboardRecentSignedOut =>
      'உங்கள் சமீபத்திய பணிகளைப் பார்க்க உள்நுழையவும்.';

  @override
  String get dashboardUntitled => 'தலைப்பு இல்லை';

  @override
  String get dashboardSetupTitle => 'உங்கள் சுயவிவரத்தை நிரப்பி முடிக்கவும்';

  @override
  String get dashboardSetupBody =>
      'உங்கள் பள்ளியையும் வகுப்புகளையும் சேர்த்தால், ஒவ்வொரு பாடத் திட்டமும் வினாடி வினாவும் உங்கள் வகுப்பறைக்குத் தயாராக வரும்.';

  @override
  String get dashboardSetupAction => 'எனது சுயவிவரத்தை அமைக்கவும்';

  @override
  String get dashboardSetupDismiss => 'இப்போது வேண்டாம்';

  @override
  String get contentTypeLessonPlan => 'பாடத் திட்டம்';

  @override
  String get contentTypeQuiz => 'வினாடி வினா';

  @override
  String get contentTypeWorksheet => 'பணித்தாள்';

  @override
  String get contentTypeVisualAid => 'காட்சி உதவி';

  @override
  String get contentTypeRubric => 'ரூப்ரிக்';

  @override
  String get contentTypeMicroLesson => 'குறு பாடம்';

  @override
  String get contentTypeVirtualFieldTrip => 'மெய்நிகர் கள சுற்றுலா';

  @override
  String get contentTypeInstantAnswer => 'உடனடி பதில்';

  @override
  String get contentTypeTeacherTraining => 'ஆசிரியர் பயிற்சி';

  @override
  String get contentTypeExamPaper => 'வினாத்தாள்';

  @override
  String get contentTypeAssessment => 'மதிப்பீடு';

  @override
  String get contentTypeAssessmentSubmission => 'ஸ்கேன் செய்த மதிப்பீடு';

  @override
  String get contentTypeUnknown => 'சேமித்த பணி';

  @override
  String get libraryTitle => 'எனது நூலகம்';

  @override
  String get librarySectionSaved => 'சேமித்தவை';

  @override
  String get libraryEmpty =>
      'நீங்கள் சேமித்த பாடத் திட்டங்கள் மற்றும் வினாடி வினாக்கள் இங்கே தோன்றும்.';

  @override
  String get libraryEmptyAction => 'பாடத் திட்டம் உருவாக்கு';

  @override
  String get librarySignedOut =>
      'உங்கள் சேமித்த பணிகளைப் பார்க்க உள்நுழையவும்.';

  @override
  String get libraryLoadFailed => 'உங்கள் நூலகத்தை ஏற்ற முடியவில்லை.';

  @override
  String get libraryNewestOnly =>
      'உங்கள் சமீபத்திய 20 உருப்படிகள் காட்டப்படுகின்றன.';

  @override
  String get libraryFilterAll => 'அனைத்தும்';

  @override
  String get libraryFilterEmpty =>
      'இந்த வகையில் நீங்கள் சேமித்த உருப்படிகள் இன்னும் இல்லை.';

  @override
  String get libraryDetailTitle => 'சேமித்த உருப்படி';

  @override
  String libraryDetailSavedOn(String date) {
    return '$date அன்று சேமிக்கப்பட்டது';
  }

  @override
  String get libraryDetailSignedOut =>
      'உங்கள் சேமித்த பணியைத் திறக்க உள்நுழையவும்.';

  @override
  String get libraryDetailNotFound =>
      'இந்த உருப்படி இனி உங்கள் நூலகத்தில் இல்லை.';

  @override
  String get libraryDetailLoadFailed =>
      'இந்த சேமித்த உருப்படியைத் திறக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String libraryDetailReady(String type) {
    return 'நீங்கள் சேமித்த $type காண்கிறீர்கள்.';
  }

  @override
  String get profileTitle => 'சுயவிவரம்';

  @override
  String get lessonPlanTitle => 'பாடத் திட்டம்';

  @override
  String get lessonPlanIncludeLabel => 'சேர்க்கவும்';

  @override
  String get lessonPlanIncludeActivity => 'செயல்பாடு';

  @override
  String get lessonPlanIncludeBoardWork => 'பலகை வேலை';

  @override
  String get lessonPlanIncludeHomework => 'வீட்டுப்பாடம்';

  @override
  String get lessonPlanIncludeStoryHook => 'கதைத் தொடக்கம்';

  @override
  String get lessonPlanNcertTitle => 'NCERT-இணக்கம்';

  @override
  String lessonPlanNcertBody(String grade) {
    return 'உங்கள் திட்டம் $grade-க்கான NCERT பாடத்திட்டத்துடன் சரிபார்க்கப்படுகிறது.';
  }

  @override
  String get lessonPlanSubtitle => 'முழு 5E பாடத்தைத் திட்டமிடுங்கள்';

  @override
  String get lessonPlanEmpty =>
      'ஒரு தலைப்பைச் சேர்த்து, 5E பாடத் திட்டத்தை உருவாக்க உருவாக்கு என்பதைத் தட்டவும்.';

  @override
  String get lessonPlanTopicLabel => 'தலைப்பு';

  @override
  String get lessonPlanTopicHint => 'எடுத்துக்காட்டாக, ஒளிச்சேர்க்கை';

  @override
  String get lessonPlanTopicError => 'திட்டமிட ஒரு தலைப்பை உள்ளிடவும்.';

  @override
  String get lessonPlanGradeLabel => 'வகுப்பு நிலைகள்';

  @override
  String get lessonPlanSubjectLabel => 'பாடம்';

  @override
  String get lessonPlanSubjectAny => 'எந்த பாடமும்';

  @override
  String get lessonPlanResourceLabel => 'வகுப்பறை வளங்கள்';

  @override
  String get lessonPlanResourceLow => 'குறைவு';

  @override
  String get lessonPlanResourceMedium => 'நடுத்தரம்';

  @override
  String get lessonPlanResourceHigh => 'அதிகம்';

  @override
  String get lessonPlanDifficultyLabel => 'சிரம நிலை';

  @override
  String get lessonPlanDifficultyRemedial => 'கூடுதல் உதவி';

  @override
  String get lessonPlanDifficultyStandard => 'நிலையானது';

  @override
  String get lessonPlanDifficultyAdvanced => 'மேம்பட்டது';

  @override
  String get lessonPlanRuralLabel =>
      'உள்ளூர், அன்றாட எடுத்துக்காட்டுகளைப் பயன்படுத்து';

  @override
  String get lessonPlanRuralHint =>
      'கிராமப்புற மற்றும் சமூகச் சூழலில் பரிச்சயமான செயல்பாடுகளை அமைக்கவும்.';

  @override
  String get lessonPlanOptional => 'விருப்பத்தேர்வு';

  @override
  String get lessonPlanObjectives => 'கற்றல் நோக்கங்கள்';

  @override
  String get lessonPlanVocabulary => 'முக்கிய சொற்கள்';

  @override
  String get lessonPlanMaterials => 'பொருட்கள்';

  @override
  String get lessonPlanActivities => '5E செயல்பாடுகள்';

  @override
  String get lessonPlanAssessment => 'மதிப்பீடு';

  @override
  String get lessonPlanHomework => 'வீட்டுப்பாடம்';

  @override
  String get lessonPlanTeacherTip => 'ஆசிரியர் குறிப்பு';

  @override
  String get lessonPlanUnderstandingCheck => 'புரிதலைச் சரிபார்க்கவும்';

  @override
  String get lessonPlanNoteLabel => 'தொடங்கும் முன் ஒரு குறிப்பு';

  @override
  String get lessonPlanUpgradeTitle => 'உயர்ந்த திட்டம் தேவை';

  @override
  String get lessonPlanUpgradeBody =>
      'பாடத் திட்டம் உருவாக்குவது உயர்ந்த திட்டத்தின் ஒரு பகுதி. திட்டங்களைத் தொடர்ந்து உருவாக்க மேம்படுத்தவும்.';

  @override
  String get lessonPlanLimitTitle => 'நீங்கள் உங்கள் வரம்பை அடைந்துவிட்டீர்கள்';

  @override
  String get lessonPlanLimitBody =>
      'இப்போதைக்கு உங்கள் பாடத் திட்டங்களைப் பயன்படுத்திவிட்டீர்கள். பின்னர் முயற்சிக்கவும் அல்லது உங்கள் திட்டத்தை மேம்படுத்தவும்.';

  @override
  String get lessonPlanSeePricing => 'திட்டங்கள் மற்றும் விலையைப் பார்க்கவும்';

  @override
  String get lessonPlanRephrase =>
      'அதிலிருந்து ஒரு திட்டத்தை உருவாக்க முடியவில்லை. தலைப்பை மாற்றி எழுதி மீண்டும் முயற்சிக்கவும்.';

  @override
  String get lessonPlanBusy =>
      'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.';

  @override
  String get lessonPlanTimeout =>
      'எதிர்பார்த்ததை விட அதிக நேரம் ஆகிறது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get lessonPlanSignIn =>
      'இந்தக் கருவியைப் பயன்படுத்த மீண்டும் உள்நுழையவும்.';

  @override
  String get quizTitle => 'வினாடி வினா';

  @override
  String get quizSubtitle => 'மூன்று சிரம நிலைகளில் வினாடி வினா உருவாக்குங்கள்';

  @override
  String get quizEmpty =>
      'ஒரு தலைப்பைச் சேர்த்து, வினாடி வினா உருவாக்க உருவாக்கு என்பதைத் தட்டவும்.';

  @override
  String get quizTopicLabel => 'தலைப்பு';

  @override
  String get quizTopicHint => 'எடுத்துக்காட்டாக, பின்னங்கள்';

  @override
  String get quizTopicError => 'வினாடி வினாவுக்கு ஒரு தலைப்பை உள்ளிடவும்.';

  @override
  String get quizNumQuestionsLabel => 'வினாக்களின் எண்ணிக்கை';

  @override
  String get quizFewerQuestions => 'குறைவான வினாக்கள்';

  @override
  String get quizMoreQuestions => 'அதிக வினாக்கள்';

  @override
  String get quizTypesLabel => 'வினா வகைகள்';

  @override
  String get quizTypesError => 'குறைந்தது ஒரு வினா வகையைத் தேர்ந்தெடுக்கவும்.';

  @override
  String get quizTypeMultipleChoice => 'பலவுள் தெரிவு';

  @override
  String get quizTypeFillInTheBlanks => 'கோடிட்ட இடங்களை நிரப்புக';

  @override
  String get quizTypeShortAnswer => 'சிறு விடை';

  @override
  String get quizTypeTrueFalse => 'சரியா தவறா';

  @override
  String get quizGradeLabel => 'வகுப்பு நிலை';

  @override
  String get quizGradeAny => 'எந்த வகுப்பும்';

  @override
  String get quizSubjectLabel => 'பாடம்';

  @override
  String get quizSubjectAny => 'எந்த பாடமும்';

  @override
  String get quizDifficultyLabel => 'சிரம நிலை';

  @override
  String get quizDifficultyHint =>
      'எளிய, நடுத்தர மற்றும் கடின வடிவங்கள் அனைத்தும் வேண்டுமெனில் இதை எல்லா நிலைகள் என்றே விடவும்.';

  @override
  String get quizDifficultyAll => 'எல்லா நிலைகள்';

  @override
  String get quizDifficultyEasy => 'எளிது';

  @override
  String get quizDifficultyMedium => 'நடுத்தரம்';

  @override
  String get quizDifficultyHard => 'கடினம்';

  @override
  String get quizBloomsLabel => 'சிந்தனைத் திறன்கள்';

  @override
  String get quizBloomsHint =>
      'வினாக்கள் எத்தகைய சிந்தனையைக் கேட்க வேண்டும் என்பதைத் தேர்ந்தெடுக்கவும்.';

  @override
  String get quizOptional => 'விருப்பத்தேர்வு';

  @override
  String quizQuestionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count வினாக்கள்',
      one: '1 வினா',
    );
    return '$_temp0';
  }

  @override
  String get quizShowAnswer => 'விடையைக் காட்டு';

  @override
  String get quizHideAnswer => 'விடையை மறை';

  @override
  String get quizShowAllAnswers => 'எல்லா விடைகளையும் காட்டு';

  @override
  String get quizHideAllAnswers => 'எல்லா விடைகளையும் மறை';

  @override
  String get quizCorrectAnswer => 'சரியான விடை';

  @override
  String get quizExplanation => 'காரணம்';

  @override
  String get quizTeacherInstructions => 'வகுப்பில் இதை எப்படி நடத்துவது';

  @override
  String get quizNoteLabel => 'தொடங்கும் முன் ஒரு குறிப்பு';

  @override
  String get quizNoQuestions =>
      'அந்தத் தலைப்புக்கு வினாக்கள் எதுவும் வரவில்லை. வேறு தலைப்பை முயற்சிக்கவும்.';

  @override
  String get quizUpgradeTitle => 'உயர்ந்த திட்டம் தேவை';

  @override
  String get quizUpgradeBody =>
      'வினாடி வினா உருவாக்குவது உயர்ந்த திட்டத்தின் ஒரு பகுதி. வினாடி வினாக்களைத் தொடர்ந்து உருவாக்க மேம்படுத்தவும்.';

  @override
  String get quizLimitTitle => 'நீங்கள் உங்கள் வரம்பை அடைந்துவிட்டீர்கள்';

  @override
  String get quizLimitBody =>
      'இப்போதைக்கு உங்கள் வினாடி வினாக்களைப் பயன்படுத்திவிட்டீர்கள். பின்னர் முயற்சிக்கவும் அல்லது உங்கள் திட்டத்தை மேம்படுத்தவும்.';

  @override
  String get quizSeePricing => 'திட்டங்கள் மற்றும் விலையைப் பார்க்கவும்';

  @override
  String get quizRephrase =>
      'அதிலிருந்து ஒரு வினாடி வினாவை உருவாக்க முடியவில்லை. தலைப்பை மாற்றி எழுதி மீண்டும் முயற்சிக்கவும்.';

  @override
  String get quizBusy =>
      'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.';

  @override
  String get quizTimeout =>
      'எதிர்பார்த்ததை விட அதிக நேரம் ஆகிறது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get quizSignIn => 'இந்தக் கருவியைப் பயன்படுத்த மீண்டும் உள்நுழையவும்.';

  @override
  String get instantAnswerTitle => 'உடனடி பதில்';

  @override
  String get instantAnswerSubtitle =>
      'வகுப்பறையின் எந்தக் கேள்வியையும் கேளுங்கள்';

  @override
  String get instantAnswerAction => 'பதில் பெறு';

  @override
  String get instantAnswerEmpty =>
      'ஒரு கேள்வியைக் கேட்டு பதில் பெறு என்பதைத் தட்டவும்.';

  @override
  String get instantAnswerQuestionLabel => 'உங்கள் கேள்வி';

  @override
  String get instantAnswerQuestionHint =>
      'எடுத்துக்காட்டாக, நிலா ஏன் வடிவம் மாறுகிறது?';

  @override
  String get instantAnswerQuestionError => 'ஒரு கேள்வியை உள்ளிடவும்.';

  @override
  String get instantAnswerGradeLabel => 'வகுப்பு நிலை';

  @override
  String get instantAnswerGradeAny => 'எந்த வகுப்பும்';

  @override
  String get instantAnswerSubjectLabel => 'பாடம்';

  @override
  String get instantAnswerSubjectAny => 'எந்த பாடமும்';

  @override
  String get instantAnswerOptional => 'விருப்பத்தேர்வு';

  @override
  String get instantAnswerVideoTitle => 'தொடர்புடைய வீடியோவைப் பாருங்கள்';

  @override
  String get instantAnswerVideoBody =>
      'செயலிக்கு வெளியே, உங்கள் உலாவியில் திறக்கும்.';

  @override
  String get instantAnswerNoAnswer =>
      'அந்தக் கேள்விக்கு பதில் வரவில்லை. அதை மாற்றி எழுதி மீண்டும் முயற்சிக்கவும்.';

  @override
  String get instantAnswerSeePricing =>
      'திட்டங்கள் மற்றும் விலையைப் பார்க்கவும்';

  @override
  String get instantAnswerDailyLimitTitle =>
      'இன்றைக்கான உங்கள் கேள்விகள் அனைத்தும் முடிந்தன';

  @override
  String get instantAnswerDailyLimitBody =>
      'உங்கள் திட்டத்தில் ஒவ்வொரு நாளும் குறிப்பிட்ட எண்ணிக்கையிலான உடனடி பதில்கள் உள்ளன. உங்கள் கேள்விகள் நாளை மீண்டும் தொடங்கும், அல்லது உயர்ந்த திட்டத்தில் தினசரி வரம்பை உயர்த்தலாம்.';

  @override
  String get instantAnswerLimitTitle =>
      'நீங்கள் உங்கள் வரம்பை அடைந்துவிட்டீர்கள்';

  @override
  String get instantAnswerLimitBody =>
      'இந்த மாதத்திற்கான உங்கள் உடனடி பதில்களைப் பயன்படுத்திவிட்டீர்கள். உங்கள் கேள்விகள் அடுத்த மாதம் மீண்டும் தொடங்கும், அல்லது உயர்ந்த திட்டத்தில் வரம்பை உயர்த்தலாம்.';

  @override
  String get instantAnswerUpgradeTitle => 'உயர்ந்த திட்டம் தேவை';

  @override
  String get instantAnswerUpgradeBody =>
      'உடனடி பதில்கள் உயர்ந்த திட்டத்தின் ஒரு பகுதி. தொடர்ந்து கேள்விகள் கேட்க மேம்படுத்தவும்.';

  @override
  String get instantAnswerRephrase =>
      'அதற்கு பதில் அளிக்க முடியவில்லை. கேள்வியை மாற்றி எழுதி மீண்டும் முயற்சிக்கவும்.';

  @override
  String get instantAnswerBusy =>
      'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.';

  @override
  String instantAnswerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சுமார் $seconds வினாடிகளில் மீண்டும் முயற்சிக்கவும்.',
      one:
          'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சுமார் 1 வினாடியில் மீண்டும் முயற்சிக்கவும்.',
    );
    return '$_temp0';
  }

  @override
  String get instantAnswerTimeout =>
      'எதிர்பார்த்ததை விட அதிக நேரம் ஆகிறது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get instantAnswerSignIn =>
      'இந்தக் கருவியைப் பயன்படுத்த மீண்டும் உள்நுழையவும்.';

  @override
  String get settingsTitle => 'அமைப்புகள்';

  @override
  String get settingsAppearanceTitle => 'தோற்றம்';

  @override
  String get settingsThemeSystem => 'எனது சாதனத்தின்படி';

  @override
  String get settingsThemeLight => 'வெளிர்';

  @override
  String get settingsThemeDark => 'இருண்ட';

  @override
  String get settingsLanguageHint =>
      'செயலியின் மொழியையும், உங்கள் கற்பித்தல் பொருட்கள் எழுதப்படும் மொழியையும் இது அமைக்கிறது.';

  @override
  String get settingsNotificationsTitle => 'அறிவிப்புகள்';

  @override
  String get settingsNotificationsLabel =>
      'நினைவூட்டல்கள் மற்றும் புதுப்பிப்புகள்';

  @override
  String get settingsNotificationsHint =>
      'புதிய கற்பித்தல் கருவிகள் மற்றும் உங்கள் சேமித்த பணிகள் பற்றி அறிந்துகொள்ளுங்கள்.';

  @override
  String get settingsVoiceModeTitle => 'குரல் பயன்முறை';

  @override
  String get settingsVoiceModeLabel => 'நேரடி குரல் (பீட்டா)';

  @override
  String get settingsVoiceModeHint =>
      'VIDYA உடன் நேரடியாகப் பேசுங்கள். இது அணைந்திருந்தால், VIDYA கேட்டு, ஒரு முறைக்கு ஒன்றாகப் பதிலளிக்கும்.';

  @override
  String get settingsProfileTitle => 'கற்பித்தல் சுயவிவரம்';

  @override
  String get settingsProfileHint =>
      'உங்கள் பொருட்களை உங்கள் வாரியம் மற்றும் வகுப்பறைக்கு ஏற்ப பொருத்த இது உதவுகிறது.';

  @override
  String get settingsBoardLabel => 'கல்வி வாரியம்';

  @override
  String get settingsBoardNone => 'அமைக்கப்படவில்லை';

  @override
  String get settingsQualificationsLabel => 'தகுதிகள்';

  @override
  String get settingsQualificationsHint =>
      'உங்களுக்கு உள்ள ஒவ்வொரு தகுதியையும் தேர்ந்தெடுக்கவும்.';

  @override
  String get settingsAdminRoleLabel => 'நிர்வாகப் பங்கு';

  @override
  String get settingsAdminRoleNone => 'அமைக்கப்படவில்லை';

  @override
  String get settingsRoleHod => 'துறைத் தலைவர் (HoD)';

  @override
  String get settingsRoleCoordinator => 'கல்வி ஒருங்கிணைப்பாளர்';

  @override
  String get settingsRoleExamController => 'தேர்வுக் கட்டுப்பாட்டாளர்';

  @override
  String get settingsRoleVicePrincipal => 'துணை முதல்வர்';

  @override
  String get settingsRolePrincipal => 'முதல்வர்';

  @override
  String get settingsRoleNone => 'ஆசிரியர், நிர்வாகப் பங்கு இல்லை';

  @override
  String get settingsSaveProfile => 'சுயவிவரத்தைச் சேமி';

  @override
  String get settingsProfileSaved =>
      'உங்கள் கற்பித்தல் சுயவிவரம் சேமிக்கப்பட்டது.';

  @override
  String get settingsSaveFailed =>
      'உங்கள் சுயவிவரத்தைச் சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get settingsSignedOutTitle => 'நீங்கள் வெளியேறியுள்ளீர்கள்';

  @override
  String get settingsSignedOutBody =>
      'உங்கள் கற்பித்தல் சுயவிவரத்தையும் கணக்கையும் நிர்வகிக்க உள்நுழையவும். எப்படியிருந்தாலும் உங்கள் மொழி மற்றும் தோற்ற விருப்பங்கள் இந்தச் சாதனத்தில் சேமிக்கப்படும்.';

  @override
  String get settingsSignIn => 'உள்நுழையவும்';

  @override
  String get settingsDangerTitle => 'கணக்கை நீக்கு';

  @override
  String get settingsDangerBody =>
      'இது உங்கள் கணக்கை மூடி, சேமித்த பணிகளை அகற்றும். நிரந்தரமாக நீக்கப்படும் முன் அனைத்தையும் ஏற்றுமதி செய்ய 30 நாட்கள் உங்களுக்கு இருக்கும்.';

  @override
  String get settingsDeleteAction => 'கணக்கை நீக்கு';

  @override
  String get settingsDeleteDialogTitle => 'உங்கள் கணக்கை நீக்கவா?';

  @override
  String get settingsDeleteDialogBody =>
      'உங்கள் பாடத் திட்டங்கள், வினாடி வினாக்கள் மற்றும் சுயவிவரம் நீக்கத்திற்குத் திட்டமிடப்படும். அகற்றப்படும் முன் உங்கள் பணியை ஏற்றுமதி செய்ய 30 நாட்கள் உள்ளன.';

  @override
  String settingsDeleteConfirmPrompt(String word) {
    return 'உறுதிப்படுத்த கீழே $word என்று தட்டச்சு செய்யவும்.';
  }

  @override
  String get settingsDeleteConfirmLabel => 'உறுதிப்படுத்தல்';

  @override
  String get settingsDeleteCancel => 'எனது கணக்கை வைத்திருக்கவும்';

  @override
  String get settingsDeleteConfirm => 'கணக்கை நீக்கு';

  @override
  String get settingsDeleteScheduled =>
      'உங்கள் கணக்கு நீக்கத்திற்குத் திட்டமிடப்பட்டுள்ளது. உங்கள் பணியை ஏற்றுமதி செய்ய 30 நாட்கள் உள்ளன.';

  @override
  String get settingsDeleteSuccessTitle =>
      'கணக்கு நீக்கத்திற்குத் திட்டமிடப்பட்டது';

  @override
  String get settingsExportDataAction => 'எனது தரவை ஏற்றுமதி செய்';

  @override
  String get settingsExportQueuedMessage =>
      'உங்கள் ஏற்றுமதி உடனே தயாரிக்க முடியாத அளவுக்குப் பெரியது, எனவே அதை வரிசையில் சேர்த்துள்ளோம். பின்னர் மீண்டும் முயற்சிக்கவும், அல்லது உங்கள் தரவின் நகலுக்கு ஆதரவுக் குழுவைத் தொடர்பு கொள்ளவும்.';

  @override
  String get settingsExportFailedMessage =>
      'உங்கள் ஏற்றுமதியைத் தயாரிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get settingsDeleteSuccessDone => 'முடிந்தது';

  @override
  String get settingsDeleteFailed =>
      'உங்கள் கணக்கை நீக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get settingsReauthTitle => 'மீண்டும் உள்நுழையவும்';

  @override
  String get settingsReauthBody =>
      'உங்கள் பாதுகாப்புக்காக, கணக்கை நீக்குவதற்குப் புதிதாக உள்நுழைவு தேவை. வெளியேறி, மீண்டும் உள்நுழைந்து, ஐந்து நிமிடங்களுக்குள் நீக்கவும்.';

  @override
  String get profilePlanLabel => 'திட்டம்';

  @override
  String get profilePlanFree => 'இலவசம்';

  @override
  String get profilePlanPro => 'ப்ரோ';

  @override
  String get profilePlanGold => 'கோல்ட்';

  @override
  String get profilePlanPremium => 'பிரீமியம்';

  @override
  String get profilePlanUnknown => 'கிடைக்கவில்லை';

  @override
  String get profileNoName => 'உங்கள் சுயவிவரம்';

  @override
  String get profileSectionAbout => 'உங்களைப் பற்றி';

  @override
  String get profileSectionTeaching => 'நீங்கள் என்ன கற்பிக்கிறீர்கள்';

  @override
  String get profileSectionLocation => 'நீங்கள் எங்கு கற்பிக்கிறீர்கள்';

  @override
  String get profileSectionContact => 'நாங்கள் உங்களை எவ்வாறு தொடர்பு கொள்வது';

  @override
  String get profileNameLabel => 'உங்கள் பெயர்';

  @override
  String get profileNameHint =>
      'நீங்கள் பகிரும் பணியில் மற்ற ஆசிரியர்கள் காணும் பெயர் இதுவே.';

  @override
  String get profileNameInvalid => 'தயவுசெய்து குறுகிய பெயரைப் பயன்படுத்தவும்.';

  @override
  String get profileSchoolLabel => 'பள்ளியின் பெயர்';

  @override
  String get profileBoardCategoryLabel => 'வாரிய வகை';

  @override
  String get profileBoardCategoryHint =>
      'கீழே உள்ள பட்டியலைச் சுருக்க ஒரு வாரிய வகையைத் தேர்ந்தெடுக்கவும்.';

  @override
  String get profileBoardCategoryState => 'மாநில வாரியம்';

  @override
  String get profileStateLabel => 'மாநிலம்';

  @override
  String get profileStateNone => 'அமைக்கப்படவில்லை';

  @override
  String get profileDistrictLabel => 'மாவட்டம்';

  @override
  String get profileDistrictHint => 'உங்கள் பள்ளி அமைந்துள்ள மாவட்டம்.';

  @override
  String get profileSubjectsLabel => 'நீங்கள் கற்பிக்கும் பாடங்கள்';

  @override
  String get profileSubjectsHint =>
      'உங்களுக்குத் தேவையான அளவுக்குத் தேர்ந்தெடுக்கவும்.';

  @override
  String get profileGradesLabel => 'நீங்கள் கற்பிக்கும் வகுப்புகள்';

  @override
  String get profileGradesHint =>
      'உங்களுக்குத் தேவையான அளவுக்குத் தேர்ந்தெடுக்கவும்.';

  @override
  String get profileLanguageHint =>
      'இது செயலி முழுவதற்கும் பொதுவான அதே மொழித் தேர்வு, எனவே இங்கே மாற்றினால் எல்லா இடங்களிலும் மாறும்.';

  @override
  String get profilePhoneLabel => 'மொபைல் எண்';

  @override
  String get profilePhoneHint =>
      'விருப்பத்தேர்வு. +91 உடன் அல்லது இல்லாமல், பத்து இலக்கங்கள்.';

  @override
  String get profilePhoneInvalid =>
      'தயவுசெய்து பத்து இலக்க இந்திய மொபைல் எண்ணை உள்ளிடவும்.';

  @override
  String get profilePincodeLabel => 'பின் கோடு';

  @override
  String get profilePincodeHint => 'விருப்பத்தேர்வு. ஆறு இலக்கங்கள்.';

  @override
  String get profilePincodeInvalid =>
      'தயவுசெய்து ஆறு இலக்க பின் கோடை உள்ளிடவும்.';

  @override
  String get profileEmptyTitle => 'உங்கள் சுயவிவரம் காலியாக உள்ளது';

  @override
  String get profileEmptyBody =>
      'உங்கள் பள்ளியையும் வகுப்புகளையும் சேர்த்தால், நீங்கள் உருவாக்கும் ஒவ்வொரு பாடத் திட்டமும் வினாடி வினாவும் உங்கள் வகுப்பறைக்குத் தயாராக வரும்.';

  @override
  String get profileLoadFailed =>
      'உங்கள் சுயவிவரத்தைத் திறக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get profileSignedOutTitle => 'நீங்கள் வெளியேறியுள்ளீர்கள்';

  @override
  String get profileSignedOutBody =>
      'உங்கள் கற்பித்தல் சுயவிவரத்தைப் பார்க்கவும் திருத்தவும் உள்நுழையவும்.';

  @override
  String get profileSaveSignIn =>
      'உங்கள் சுயவிவரத்தைச் சேமிக்க மீண்டும் உள்நுழையவும்.';

  @override
  String get meTitle => 'சுயவிவரம்';

  @override
  String get mePlanUsageTitle => 'திட்டம் & பயன்பாடு';

  @override
  String get mePlanUsageSubtitle =>
      'இந்த மாதம் நீங்கள் எவ்வளவு பயன்படுத்தியுள்ளீர்கள்.';

  @override
  String meUsageValue(int used, int limit) {
    return '$used / $limit';
  }

  @override
  String get meUsageUnlimited => 'வரம்பற்றது';

  @override
  String get meUsageUnavailable =>
      'உங்கள் பயன்பாட்டை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get meDefaultsTitle => 'இயல்புநிலைகள்';

  @override
  String get mePrivacyTitle => 'தனியுரிமை & அமைப்புகள்';

  @override
  String get meRoleTeacher => 'ஆசிரியர்';

  @override
  String get usageFeatureAvatar => 'AI அவதாரங்கள்';

  @override
  String get usageFeatureVoiceToText => 'குரலிலிருந்து உரை';

  @override
  String get usageFeatureAssistant => 'VIDYA உதவியாளர்';

  @override
  String get imageInputHint =>
      'பாடநூல் பக்கத்தின் தெளிவான புகைப்படத்தைச் சேர்க்கவும்.';

  @override
  String get imageInputTakePhoto => 'புகைப்படம் எடு';

  @override
  String get imageInputChooseGallery => 'கேலரியிலிருந்து தேர்வுசெய்';

  @override
  String get imageInputRetake => 'மீண்டும் புகைப்படம் எடு';

  @override
  String get imageInputChangeGallery => 'வேறொன்றைத் தேர்வுசெய்';

  @override
  String get imageInputRemove => 'புகைப்படத்தை அகற்று';

  @override
  String get imageInputPreviewLabel => 'தேர்ந்தெடுத்த படத்தின் முன்னோட்டம்';

  @override
  String imageInputSizeOfMax(String used, String max) {
    return '$max இல் $used';
  }

  @override
  String imageInputTooLarge(String max) {
    return 'இந்தப் புகைப்படம் மிகப் பெரியது. $max க்கும் குறைவான ஒன்றைத் தேர்வுசெய்யவும்.';
  }

  @override
  String get imageInputPermissionDenied =>
      'உங்கள் கேமரா அல்லது படங்களைப் பயன்படுத்த SahayakAI-க்கு அனுமதி தேவை. உங்கள் சாதன அமைப்புகளில் அனுமதி வழங்கவும்.';

  @override
  String get imageInputFailed =>
      'அந்தப் படத்தைத் திறக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get worksheetTitle => 'பணித்தாள்';

  @override
  String get worksheetSubtitle =>
      'பாடநூல் புகைப்படத்திலிருந்து பணித்தாள் உருவாக்குங்கள்';

  @override
  String get worksheetEmpty =>
      'பாடநூல் புகைப்படத்தையும் ஒரு விவரத்தையும் சேர்த்து, உருவாக்கு என்பதைத் தட்டவும்.';

  @override
  String get worksheetImageLabel => 'பாடநூல் பக்கத்தின் புகைப்படம்';

  @override
  String get worksheetImageHint =>
      'இந்தப் பக்கத்திலிருந்து பணித்தாள் உருவாக்கப்படும்.';

  @override
  String get toolImageOptionalLabel =>
      'பாடநூல் பக்க புகைப்படம் (விருப்பத்தேர்வு)';

  @override
  String get toolImageOptionalHint =>
      'பக்கத்தின் புகைப்படத்தைச் சேர்த்தால் அது முதன்மை ஆதாரமாகும், அல்லது காலியாக விடவும்.';

  @override
  String get worksheetImageError =>
      'பாடநூல் பக்கத்தின் புகைப்படத்தைச் சேர்க்கவும்.';

  @override
  String get worksheetPromptLabel => 'உங்களுக்கு எந்தப் பணித்தாள் வேண்டும்?';

  @override
  String get worksheetPromptHint =>
      'எடுத்துக்காட்டாக, இந்தப் பக்கத்திலிருந்து ஒரு பெருக்கல் பணித்தாள் உருவாக்கு';

  @override
  String get worksheetPromptError =>
      'உங்களுக்குத் தேவையான பணித்தாளை விவரிக்கவும்.';

  @override
  String get worksheetGradeLabel => 'வகுப்பு நிலை';

  @override
  String get worksheetGradeAny => 'எந்த வகுப்பும்';

  @override
  String get worksheetSubjectLabel => 'பாடம்';

  @override
  String get worksheetSubjectAny => 'எந்த பாடமும்';

  @override
  String get worksheetOptional => 'விருப்பத்தேர்வு';

  @override
  String get worksheetObjectives => 'கற்றல் நோக்கங்கள்';

  @override
  String get worksheetInstructions => 'மாணவர்களுக்கான வழிமுறைகள்';

  @override
  String get worksheetActivities => 'செயல்பாடுகள்';

  @override
  String get worksheetActivityQuestion => 'வினா';

  @override
  String get worksheetActivityPuzzle => 'புதிர்';

  @override
  String get worksheetActivityCreativeTask => 'படைப்பாற்றல் பணி';

  @override
  String get worksheetExplanation => 'ஆசிரியருக்கு';

  @override
  String get worksheetChalkboardNote => 'கரும்பலகையில்';

  @override
  String get worksheetAnswerKey => 'விடைக் குறிப்பு';

  @override
  String get worksheetNoContent =>
      'அந்தப் பக்கத்திற்கு பணித்தாள் வரவில்லை. தெளிவான புகைப்படம் அல்லது வேறு விவரத்தை முயற்சிக்கவும்.';

  @override
  String get worksheetSave => 'நூலகத்தில் சேமி';

  @override
  String get worksheetSaving => 'சேமிக்கிறது';

  @override
  String get worksheetSaved => 'உங்கள் நூலகத்தில் சேமிக்கப்பட்டது';

  @override
  String get worksheetSaveFailedTitle => 'சேமிக்க முடியவில்லை';

  @override
  String get worksheetSaveFailedBody =>
      'இந்தப் பணித்தாளை உங்கள் நூலகத்தில் சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get worksheetSaveRetry => 'மீண்டும் சேமிக்க முயற்சிக்கவும்';

  @override
  String get worksheetUpgradeTitle => 'உயர்ந்த திட்டம் தேவை';

  @override
  String get worksheetUpgradeBody =>
      'பணித்தாள் உருவாக்குவது உயர்ந்த திட்டத்தின் ஒரு பகுதி. பணித்தாள்களைத் தொடர்ந்து உருவாக்க மேம்படுத்தவும்.';

  @override
  String get worksheetLimitTitle => 'நீங்கள் உங்கள் வரம்பை அடைந்துவிட்டீர்கள்';

  @override
  String get worksheetLimitBody =>
      'இப்போதைக்கு உங்கள் பணித்தாள்களைப் பயன்படுத்திவிட்டீர்கள். பின்னர் முயற்சிக்கவும் அல்லது உங்கள் திட்டத்தை மேம்படுத்தவும்.';

  @override
  String get worksheetSeePricing => 'திட்டங்கள் மற்றும் விலையைப் பார்க்கவும்';

  @override
  String get worksheetRephrase =>
      'அதிலிருந்து ஒரு பணித்தாளை உருவாக்க முடியவில்லை. தெளிவான புகைப்படம் அல்லது வேறு விவரத்தை முயற்சிக்கவும்.';

  @override
  String get worksheetBusy =>
      'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.';

  @override
  String get worksheetTimeout =>
      'எதிர்பார்த்ததை விட அதிக நேரம் ஆகிறது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get worksheetSignIn =>
      'இந்தக் கருவியைப் பயன்படுத்த மீண்டும் உள்நுழையவும்.';

  @override
  String get rubricTitle => 'ரூப்ரிக்';

  @override
  String get rubricSubtitle =>
      'ஒப்படைப்புக்கு மதிப்பீட்டு ரூப்ரிக் உருவாக்குங்கள்';

  @override
  String get rubricEmpty =>
      'ஒப்படைப்பை விவரித்து, உருவாக்கு என்பதைத் தட்டவும்.';

  @override
  String get rubricAssignmentLabel => 'ஒப்படைப்பு என்ன?';

  @override
  String get rubricAssignmentHint => 'ரூப்ரிக் இந்த ஒப்படைப்பை மதிப்பிடும்.';

  @override
  String get rubricAssignmentPlaceholder =>
      'எடுத்துக்காட்டாக, புதுப்பிக்கத்தக்க எரிசக்தி பற்றிய 5-ஆம் வகுப்புத் திட்டப்பணி';

  @override
  String get rubricAssignmentError => 'ஒப்படைப்பை விவரிக்கவும்.';

  @override
  String get rubricGradeLabel => 'வகுப்பு நிலை';

  @override
  String get rubricGradeAny => 'எந்த வகுப்பும்';

  @override
  String get rubricSubjectLabel => 'பாடம்';

  @override
  String get rubricSubjectAny => 'எந்த பாடமும்';

  @override
  String get rubricOptional => 'விருப்பத்தேர்வு';

  @override
  String get rubricCriteriaColumn => 'அளவுகோல்கள்';

  @override
  String rubricPoints(String points) {
    return '$points புள்ளிகள்';
  }

  @override
  String get rubricScrollHint =>
      'எல்லா நிலைகளையும் காண பக்கவாட்டில் நகர்த்தவும்.';

  @override
  String get rubricNoContent =>
      'அதற்கு ரூப்ரிக் வரவில்லை. ஒப்படைப்பை தெளிவாக விவரிக்க முயற்சிக்கவும்.';

  @override
  String get rubricUpgradeTitle => 'உயர்ந்த திட்டம் தேவை';

  @override
  String get rubricUpgradeBody =>
      'ரூப்ரிக் உருவாக்குவது உயர்ந்த திட்டத்தின் ஒரு பகுதி. ரூப்ரிக்குகளைத் தொடர்ந்து உருவாக்க மேம்படுத்தவும்.';

  @override
  String get rubricLimitTitle => 'நீங்கள் உங்கள் வரம்பை அடைந்துவிட்டீர்கள்';

  @override
  String get rubricLimitBody =>
      'இப்போதைக்கு உங்கள் ரூப்ரிக்குகளைப் பயன்படுத்திவிட்டீர்கள். பின்னர் முயற்சிக்கவும் அல்லது உங்கள் திட்டத்தை மேம்படுத்தவும்.';

  @override
  String get rubricRephrase =>
      'அதிலிருந்து ஒரு ரூப்ரிக்கை உருவாக்க முடியவில்லை. ஒப்படைப்பை மாற்றி எழுதி மீண்டும் முயற்சிக்கவும்.';

  @override
  String get rubricBusy =>
      'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.';

  @override
  String get rubricTimeout =>
      'எதிர்பார்த்ததை விட அதிக நேரம் ஆகிறது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get rubricSignIn =>
      'இந்தக் கருவியைப் பயன்படுத்த மீண்டும் உள்நுழையவும்.';

  @override
  String get examPaperTitle => 'வினாத்தாள்';

  @override
  String get examPaperSubtitle =>
      'விடைக் குறிப்புடன் வாரிய முறை வினாத்தாள் உருவாக்குங்கள்';

  @override
  String get examPaperEmpty =>
      'வாரியம், வகுப்பு மற்றும் பாடத்தைத் தேர்ந்தெடுத்து, உருவாக்கு என்பதைத் தட்டவும்.';

  @override
  String get examPaperBoardLabel => 'வாரியம்';

  @override
  String get examPaperBoardHint => 'வாரியத்தைத் தேர்வுசெய்';

  @override
  String get examPaperBoardError => 'ஒரு வாரியத்தைத் தேர்வுசெய்யவும்.';

  @override
  String get examPaperGradeLabel => 'வகுப்பு நிலை';

  @override
  String get examPaperGradeHint => 'வகுப்பைத் தேர்வுசெய்';

  @override
  String get examPaperGradeError => 'வகுப்பு நிலையைத் தேர்வுசெய்யவும்.';

  @override
  String get examPaperSubjectLabel => 'பாடம்';

  @override
  String get examPaperSubjectHint => 'பாடத்தைத் தேர்வுசெய்';

  @override
  String get examPaperSubjectError => 'பாடத்தைத் தேர்வுசெய்யவும்.';

  @override
  String get examPaperSubjectOther => 'வேறு பாடம்';

  @override
  String get examPaperSubjectOtherLabel => 'பாடத்தின் பெயர்';

  @override
  String get examPaperSubjectOtherHint => 'எடுத்துக்காட்டாக, பொருளியல்';

  @override
  String get examPaperSubjectOtherError => 'ஒரு பாடத்தை உள்ளிடவும்.';

  @override
  String get examPaperChaptersLabel => 'அத்தியாயங்கள்';

  @override
  String get examPaperChaptersHint =>
      'உள்ளடக்க வேண்டிய அத்தியாயங்களைச் சேர்க்கவும். அதிகாரப்பூர்வ வரைவு உள்ள இடத்தில் முழுப் பாடத்திட்டத்திற்கு இதைக் காலியாக விடவும்.';

  @override
  String get examPaperChaptersPlaceholder =>
      'எடுத்துக்காட்டாக, இருபடிச் சமன்பாடுகள்';

  @override
  String get examPaperChaptersAdd => 'அத்தியாயம் சேர்';

  @override
  String get examPaperChaptersError =>
      'இந்த வாரியம், வகுப்பு மற்றும் பாடத்திற்கு குறைந்தது ஒரு அத்தியாயத்தைச் சேர்க்கவும்.';

  @override
  String get examPaperDifficultyLabel => 'சிரம நிலை';

  @override
  String get examPaperDifficultyEasy => 'எளிது';

  @override
  String get examPaperDifficultyModerate => 'நடுத்தரம்';

  @override
  String get examPaperDifficultyHard => 'கடினம்';

  @override
  String get examPaperDifficultyMixed => 'கலவை';

  @override
  String get examPaperIncludeAnswerKey => 'விடைக் குறிப்பைச் சேர்';

  @override
  String get examPaperIncludeMarkingScheme => 'மதிப்பெண் திட்டத்தைச் சேர்';

  @override
  String get examPaperInProgressTitle => 'உங்கள் வினாத்தாள் தயாராகிறது';

  @override
  String get examPaperInProgressBody =>
      'முழு வாரிய வினாத்தாளை உருவாக்க சிறிது கூடுதல் நேரம் ஆகும். நாங்கள் இப்போது முடித்து வருகிறோம், அது உங்களுக்காகச் சேமிக்கப்படும்.';

  @override
  String get examPaperInProgressLibraryHint =>
      'முடிந்த வினாத்தாளைக் காண ஒரு நிமிடத்தில் நூலகம் தாவலைத் திறக்கவும்.';

  @override
  String examPaperMaxMarks(String marks) {
    return 'அதிக மதிப்பெண் $marks';
  }

  @override
  String examPaperMarks(String marks) {
    return '$marks மதிப்பெண்கள்';
  }

  @override
  String examPaperSectionMarks(String marks) {
    return '$marks மதிப்பெண்கள்';
  }

  @override
  String examPaperPercent(String value) {
    return '$value சதவீதம்';
  }

  @override
  String get examPaperGeneralInstructions => 'பொது வழிமுறைகள்';

  @override
  String get examPaperInternalChoice => 'அல்லது எழுதுக';

  @override
  String get examPaperAnswerKey => 'விடை';

  @override
  String get examPaperMarkingScheme => 'மதிப்பெண் திட்டம்';

  @override
  String get examPaperBlueprintTitle => 'வரைவுச் சுருக்கம்';

  @override
  String get examPaperBlueprintChapters => 'அத்தியாயம் வாரியாக மதிப்பெண்கள்';

  @override
  String get examPaperBlueprintDifficulty => 'சிரம நிலைப் பிரிவு';

  @override
  String get examPaperPyqTitle => 'முந்தைய ஆண்டு வினாக்கள்';

  @override
  String examPaperPyqChapterYear(String chapter, int year) {
    return '$chapter ($year)';
  }

  @override
  String examPaperPyqYear(int year) {
    return 'ஆண்டு $year';
  }

  @override
  String get examPaperNoContent =>
      'அதற்கு வினாத்தாள் வரவில்லை. குறைவான அத்தியாயங்கள் அல்லது வேறு பாடத்தை முயற்சிக்கவும்.';

  @override
  String get examPaperUnstructuredTitle =>
      'அந்த வினாத்தாளை ஒழுங்குபடுத்த முடியவில்லை';

  @override
  String get examPaperUnstructuredBody =>
      'இதை முழு வினாத்தாளாக அமைக்க உதவியாளரால் முடியவில்லை. சில அத்தியாயங்களை நீக்கி மீண்டும் உருவாக்கவும்.';

  @override
  String get examPaperUpgradeTitle => 'உயர்ந்த திட்டம் தேவை';

  @override
  String get examPaperUpgradeBody =>
      'வினாத்தாள் உருவாக்குவது உயர்ந்த திட்டத்தின் ஒரு பகுதி. வினாத்தாள்களைத் தொடர்ந்து உருவாக்க மேம்படுத்தவும்.';

  @override
  String get examPaperLimitTitle => 'நீங்கள் உங்கள் வரம்பை அடைந்துவிட்டீர்கள்';

  @override
  String get examPaperLimitBody =>
      'இப்போதைக்கு உங்கள் வினாத்தாள்களைப் பயன்படுத்திவிட்டீர்கள். பின்னர் முயற்சிக்கவும் அல்லது உங்கள் திட்டத்தை மேம்படுத்தவும்.';

  @override
  String get examPaperRephrase =>
      'அதிலிருந்து ஒரு வினாத்தாளை உருவாக்க முடியவில்லை. அத்தியாயங்களை மாற்றி மீண்டும் முயற்சிக்கவும்.';

  @override
  String get examPaperBusy =>
      'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.';

  @override
  String get examPaperTimeout =>
      'எதிர்பார்த்ததை விட அதிக நேரம் ஆகிறது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get examPaperSignIn =>
      'இந்தக் கருவியைப் பயன்படுத்த மீண்டும் உள்நுழையவும்.';

  @override
  String get teacherTrainingTitle => 'கற்பித்தல் வழிகாட்டி';

  @override
  String get teacherTrainingSubtitle =>
      'கற்பித்தல் கேள்விக்கு ஆலோசனையும் உத்தியும்';

  @override
  String get teacherTrainingAction => 'ஆலோசனை பெறு';

  @override
  String get teacherTrainingEmpty =>
      'கல்வியியல் அடிப்படையிலான உத்திகளைப் பெற ஒரு கற்பித்தல் கேள்வியைக் கேளுங்கள்.';

  @override
  String get teacherTrainingQuestionLabel => 'உங்கள் கேள்வி';

  @override
  String get teacherTrainingQuestionHint =>
      'பாட வடிவமைப்பு, வகுப்பறை நடைமுறை அல்லது மதிப்பீடு பற்றிக் கேளுங்கள்.';

  @override
  String get teacherTrainingQuestionPlaceholder =>
      'எடுத்துக்காட்டாக, 40 மாணவர்கள் உள்ள வகுப்பை முழுப் பாடம் முழுவதும் ஈடுபாட்டுடன் வைப்பது எப்படி?';

  @override
  String get teacherTrainingQuestionError => 'ஒரு கேள்வியை உள்ளிடவும்.';

  @override
  String get teacherTrainingSubjectLabel => 'பாடம்';

  @override
  String get teacherTrainingSubjectAny => 'எந்த பாடமும்';

  @override
  String get teacherTrainingOptional => 'விருப்பத்தேர்வு';

  @override
  String get teacherTrainingStrategiesTitle => 'உத்திகள்';

  @override
  String get teacherTrainingSectionQuestion => 'கேள்வி';

  @override
  String get teacherTrainingResultTitle => 'வழிகாட்டல் குறிப்புகள்';

  @override
  String get teacherTrainingNoContent =>
      'அதற்கு ஆலோசனை வரவில்லை. தெளிவான கேள்வியை முயற்சிக்கவும்.';

  @override
  String get teacherTrainingUpgradeTitle => 'உயர்ந்த திட்டம் தேவை';

  @override
  String get teacherTrainingUpgradeBody =>
      'கற்பித்தல் வழிகாட்டி உயர்ந்த திட்டத்தின் ஒரு பகுதி. தொடர்ந்து கேட்க மேம்படுத்தவும்.';

  @override
  String get teacherTrainingLimitTitle =>
      'நீங்கள் உங்கள் வரம்பை அடைந்துவிட்டீர்கள்';

  @override
  String get teacherTrainingLimitBody =>
      'இப்போதைக்கு கற்பித்தல் வழிகாட்டியைப் பயன்படுத்திவிட்டீர்கள். பின்னர் முயற்சிக்கவும் அல்லது உங்கள் திட்டத்தை மேம்படுத்தவும்.';

  @override
  String get teacherTrainingSeePricing =>
      'திட்டங்கள் மற்றும் விலையைப் பார்க்கவும்';

  @override
  String get teacherTrainingRephrase =>
      'அதிலிருந்து ஆலோசனை உருவாக்க முடியவில்லை. கேள்வியை மாற்றி எழுதி மீண்டும் முயற்சிக்கவும்.';

  @override
  String get teacherTrainingBusy =>
      'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.';

  @override
  String teacherTrainingBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சுமார் $seconds வினாடிகளில் மீண்டும் முயற்சிக்கவும்.',
      one:
          'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சுமார் 1 வினாடியில் மீண்டும் முயற்சிக்கவும்.',
    );
    return '$_temp0';
  }

  @override
  String get teacherTrainingTimeout =>
      'எதிர்பார்த்ததை விட அதிக நேரம் ஆகிறது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get teacherTrainingSignIn =>
      'இந்தக் கருவியைப் பயன்படுத்த மீண்டும் உள்நுழையவும்.';

  @override
  String get parentMessageTitle => 'பெற்றோருக்கான செய்தி';

  @override
  String get parentMessageSubtitle =>
      'பெற்றோரின் மொழியில் வீட்டிற்கு ஒரு செய்தியை உருவாக்குங்கள்';

  @override
  String get parentMessageAction => 'செய்தியை உருவாக்கு';

  @override
  String get parentMessageEmpty =>
      'மாணவரையும் காரணத்தையும் பகிர்ந்தால், பெற்றோரின் மொழியில் அன்பான செய்தி ஒன்று வீட்டிற்கு உருவாக்கப்படும்.';

  @override
  String get parentMessageStudentLabel => 'மாணவரின் பெயர்';

  @override
  String get parentMessageStudentPlaceholder =>
      'செய்தி யாரைப் பற்றியதோ அந்த மாணவர்';

  @override
  String get parentMessageStudentError => 'மாணவரின் பெயரை உள்ளிடவும்.';

  @override
  String get parentMessageClassLabel => 'வகுப்பு';

  @override
  String get parentMessageClassPlaceholder => 'எடுத்துக்காட்டாக, 6A வகுப்பு';

  @override
  String get parentMessageClassError => 'வகுப்பை உள்ளிடவும்.';

  @override
  String get parentMessageSubjectLabel => 'பாடம்';

  @override
  String get parentMessageSubjectHint => 'ஒரு பாடத்தைத் தேர்வுசெய்';

  @override
  String get parentMessageSubjectError => 'ஒரு பாடத்தைத் தேர்வுசெய்யவும்.';

  @override
  String get parentMessageReasonLabel => 'செய்திக்கான காரணம்';

  @override
  String get parentMessageReasonHint => 'ஒரு காரணத்தைத் தேர்வுசெய்';

  @override
  String get parentMessageReasonError => 'ஒரு காரணத்தைத் தேர்வுசெய்யவும்.';

  @override
  String get parentMessageReasonAbsences => 'தொடர் வருகையின்மை';

  @override
  String get parentMessageReasonPerformance => 'கல்வி ஆதரவு';

  @override
  String get parentMessageReasonBehavior => 'வகுப்பில் நடத்தை';

  @override
  String get parentMessageReasonPositive => 'பகிர ஒரு நற்செய்தி';

  @override
  String get parentMessageAbsentDaysLabel => 'வராத நாட்கள்';

  @override
  String get parentMessageAbsentDaysHint =>
      'மாணவர் தொடர்ந்து எத்தனை நாட்கள் வரவில்லை.';

  @override
  String get parentMessageAbsentDaysPlaceholder => 'எடுத்துக்காட்டாக, 3';

  @override
  String get parentMessageParentLanguageLabel => 'பெற்றோரின் மொழி';

  @override
  String get parentMessageParentLanguageHint =>
      'செய்தி இந்த மொழியில் எழுதப்படும், இது செயலியின் மொழியிலிருந்து வேறுபடலாம்.';

  @override
  String get parentMessageParentLanguagePlaceholder =>
      'பெற்றோரின் மொழியைத் தேர்வுசெய்';

  @override
  String get parentMessageParentLanguageError =>
      'பெற்றோரின் மொழியைத் தேர்வுசெய்யவும்.';

  @override
  String get parentMessageContextLabel => 'இதற்குக் காரணம் என்ன?';

  @override
  String get parentMessageContextHint =>
      'நிலைமை பற்றிய ஒரு சிறு குறிப்பு செய்தியை வடிவமைக்க உதவும்.';

  @override
  String get parentMessageContextPlaceholder =>
      'எடுத்துக்காட்டாக, கடந்த இரண்டு வாரங்கள் பின்னங்கள் பாடம் தவறியது';

  @override
  String get parentMessageNoteLabel => 'குறிப்பாகச் சொல்ல ஏதேனும் உள்ளதா?';

  @override
  String get parentMessageNoteHint =>
      'இங்குள்ள ஒரு விவரம் செய்தியில் இணைக்கப்படும்.';

  @override
  String get parentMessageNotePlaceholder =>
      'எடுத்துக்காட்டாக, குழுப் பணியில் நன்றாகச் செய்கிறார்';

  @override
  String get parentMessageTeacherNameLabel => 'உங்கள் பெயர்';

  @override
  String get parentMessageTeacherNameHint =>
      'செய்தியில் கையொப்பமாக இடம்பெறும். காலியாக விட்டால், உங்கள் சுயவிவரப் பெயர் பயன்படும்.';

  @override
  String get parentMessageTeacherNamePlaceholder =>
      'எடுத்துக்காட்டாக, திருமதி ராவ்';

  @override
  String get parentMessageSchoolNameLabel => 'பள்ளியின் பெயர்';

  @override
  String get parentMessageSchoolNamePlaceholder => 'உங்கள் பள்ளியின் பெயர்';

  @override
  String get parentMessageOptional => 'விருப்பத்தேர்வு';

  @override
  String parentMessageWordCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count சொற்கள்',
      one: '1 சொல்',
    );
    return '$_temp0';
  }

  @override
  String get parentMessageSectionMessage => 'செய்தி';

  @override
  String get parentMessageSectionDetails => 'கூடுதல் விவரங்கள்';

  @override
  String get parentMessageResultTitle => 'பெற்றோருக்கான செய்தி';

  @override
  String get parentMessageNoContent =>
      'அதற்கு செய்தி வரவில்லை. சற்று கூடுதல் விவரம் சேர்த்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get parentMessageMissingFields =>
      'மாணவர், வகுப்பு, பாடம், காரணம் மற்றும் பெற்றோரின் மொழியை நிரப்பி மீண்டும் முயற்சிக்கவும்.';

  @override
  String get parentMessageUpgradeTitle => 'உயர்ந்த திட்டம் தேவை';

  @override
  String get parentMessageUpgradeBody =>
      'பெற்றோருக்கான செய்திகள் உயர்ந்த திட்டத்தின் ஒரு பகுதி. தொடர்ந்து உருவாக்க மேம்படுத்தவும்.';

  @override
  String get parentMessageLimitTitle =>
      'நீங்கள் உங்கள் வரம்பை அடைந்துவிட்டீர்கள்';

  @override
  String get parentMessageLimitBody =>
      'இப்போதைக்கு உங்கள் பெற்றோர் செய்திகளை உருவாக்கிவிட்டீர்கள். பின்னர் முயற்சிக்கவும் அல்லது உங்கள் திட்டத்தை மேம்படுத்தவும்.';

  @override
  String get parentMessageSeePricing =>
      'திட்டங்கள் மற்றும் விலையைப் பார்க்கவும்';

  @override
  String get parentMessageBusy =>
      'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.';

  @override
  String parentMessageBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சுமார் $seconds வினாடிகளில் மீண்டும் முயற்சிக்கவும்.',
      one:
          'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சுமார் 1 வினாடியில் மீண்டும் முயற்சிக்கவும்.',
    );
    return '$_temp0';
  }

  @override
  String get parentMessageTimeout =>
      'எதிர்பார்த்ததை விட அதிக நேரம் ஆகிறது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get parentMessageSignIn =>
      'இந்தக் கருவியைப் பயன்படுத்த மீண்டும் உள்நுழையவும்.';

  @override
  String get assessTitle => 'ஒப்படைப்பை மதிப்பிடு';

  @override
  String get assessSubtitle =>
      'மாணவரின் கையெழுத்துப் பணியை புகைப்படத்திலிருந்து மதிப்பிடுங்கள்';

  @override
  String get assessEmpty =>
      'மாணவரின் பணியின் புகைப்படத்தைச் சேர்த்து, மதிப்பிடு என்பதைத் தட்டவும்.';

  @override
  String get assessSubmit => 'மதிப்பிடு';

  @override
  String get assessImageLabel => 'மாணவரின் பணியின் புகைப்படம்';

  @override
  String get assessImageHint =>
      'முழுப் பக்கத்தின் தெளிவான புகைப்படம் எடுக்கவும்.';

  @override
  String get assessImageError => 'மாணவரின் பணியின் புகைப்படத்தைச் சேர்க்கவும்.';

  @override
  String get assessModeLabel => 'உங்களுக்கு என்ன வேண்டும்?';

  @override
  String get assessModeHint =>
      'முழு மதிப்பீடு பணியைப் படித்து மதிப்பெண் அளிக்கும். படித்தல் மட்டும் உரையை மட்டும் தரும். உரையை மதிப்பிடு நீங்கள் ஒட்டும் உரைக்கு மதிப்பெண் அளிக்கும்.';

  @override
  String get assessModeFull => 'முழு மதிப்பீடு';

  @override
  String get assessModeTranscribe => 'படித்தல் மட்டும்';

  @override
  String get assessModeScore => 'உரையை மதிப்பிடு';

  @override
  String get assessTranscriptLabel => 'திருத்திய உரை';

  @override
  String get assessTranscriptHint =>
      'புகைப்படத்தை மீண்டும் படிக்காமல், மதிப்பிட வேண்டிய திருத்திய உரையை ஒட்டவும்.';

  @override
  String get assessTranscriptPlaceholder =>
      'மாணவரின் திருத்திய விடைகளை எழுதவும் அல்லது ஒட்டவும்';

  @override
  String get assessOptional => 'விருப்பத்தேர்வு';

  @override
  String get assessRubricNote =>
      'ரூப்ரிக் இல்லாமல், பணி ஒரு பொதுவான ரூப்ரிக்கின்படி மதிப்பிடப்படும்: புரிதல், துல்லியம், தரம் மற்றும் நிறைவு.';

  @override
  String get assessPrivacyNote =>
      'மதிப்பீட்டிற்கு மாணவரின் பெயர் ஒருபோதும் அனுப்பப்படாது.';

  @override
  String get assessScoreLabel => 'மொத்த மதிப்பெண்';

  @override
  String get assessScoreOutOf => '100 இல்';

  @override
  String assessPoints(String earned, String possible) {
    return '$possible இல் $earned புள்ளிகள்';
  }

  @override
  String assessConfidence(String percent) {
    return 'நம்பகத்தன்மை $percent%';
  }

  @override
  String assessRubricUsed(String title) {
    return 'இதன்படி மதிப்பிடப்பட்டது: $title';
  }

  @override
  String get assessLowConfidence => 'குறைந்த நம்பகத்தன்மை';

  @override
  String get assessTranscriptSection => 'மாணவர் எழுதியது';

  @override
  String get assessCriteriaSection => 'அளவுகோல் வாரியாக மதிப்பெண்கள்';

  @override
  String assessCriterionPoints(String points, String max) {
    return '$points / $max';
  }

  @override
  String get assessStrengthsSection => 'வலிமைகள்';

  @override
  String get assessImprovementsSection => 'மேம்படுத்த வேண்டியவை';

  @override
  String get assessNextStepsSection => 'அடுத்த படிகள்';

  @override
  String get assessTeacherNoteSection => 'மாணவருக்கான குறிப்பு';

  @override
  String get assessWarningsSection => 'சரிபார்க்கவும்';

  @override
  String get assessWarningBlank =>
      'இந்தப் பக்கம் காலியாகத் தெரிகிறது. புகைப்படத்தைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get assessWarningLowContrast =>
      'புகைப்படம் மங்கலாக உள்ளது. பிரகாசமான புகைப்படம் இன்னும் துல்லியமாக மதிப்பிட உதவும்.';

  @override
  String get assessWarningPartial =>
      'பணியின் ஒரு பகுதியை மட்டுமே படிக்க முடிந்தது.';

  @override
  String get assessWarningLanguageMismatch =>
      'எழுத்து எதிர்பார்த்ததை விட வேறு மொழியில் இருக்கலாம்.';

  @override
  String get assessNoContent =>
      'மதிப்பீடு வரவில்லை. தெளிவான புகைப்படத்தை முயற்சிக்கவும்.';

  @override
  String get assessSignIn => 'ஒப்படைப்பை மதிப்பிட மீண்டும் உள்நுழையவும்.';

  @override
  String get assessUpgradeTitle => 'உயர்ந்த திட்டம் தேவை';

  @override
  String get assessUpgradeBody =>
      'கையெழுத்துப் பணியை மதிப்பிடுவது உயர்ந்த திட்டத்தின் ஒரு பகுதி. தொடர்ந்து மதிப்பிட மேம்படுத்தவும்.';

  @override
  String get assessDailyLimitTitle =>
      'இன்றைக்கான உங்கள் மதிப்பீடுகள் அனைத்தும் முடிந்தன';

  @override
  String get assessDailyLimitBody =>
      'உங்கள் திட்டத்தில் ஒவ்வொரு நாளும் குறிப்பிட்ட எண்ணிக்கையிலான மதிப்பீடுகள் உள்ளன. அவை நாளை மீண்டும் தொடங்கும், அல்லது உயர்ந்த திட்டத்தில் வரம்பை உயர்த்தலாம்.';

  @override
  String get assessLimitTitle => 'உங்கள் மதிப்பீட்டு வரம்பை அடைந்துவிட்டீர்கள்';

  @override
  String get assessLimitBody =>
      'உங்கள் திட்டத்தின் அனைத்து மதிப்பீடுகளையும் பயன்படுத்திவிட்டீர்கள். அவை அடுத்த மாதம் மீண்டும் தொடங்கும், அல்லது உயர்ந்த திட்டத்தில் வரம்பை உயர்த்தலாம்.';

  @override
  String get assessSeePricing => 'திட்டங்களைப் பார்க்கவும்';

  @override
  String get assessBusy =>
      'மதிப்பீட்டு மாதிரி இப்போது பணிமிகுதியில் உள்ளது. ஒரு நிமிடத்தில் மீண்டும் முயற்சிக்கவும்.';

  @override
  String assessBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'மதிப்பீட்டு மாதிரி இப்போது பணிமிகுதியில் உள்ளது. சுமார் $seconds வினாடிகளில் மீண்டும் முயற்சிக்கவும்.',
      one:
          'மதிப்பீட்டு மாதிரி இப்போது பணிமிகுதியில் உள்ளது. சுமார் 1 வினாடியில் மீண்டும் முயற்சிக்கவும்.',
    );
    return '$_temp0';
  }

  @override
  String get assessTimeout =>
      'மதிப்பீடு வழக்கத்தை விட அதிக நேரம் எடுக்கிறது. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get assessRephrase =>
      'புகைப்படத்தை மதிப்பிட முடியவில்லை. தெளிவான புகைப்படத்தை மீண்டும் பதிவேற்றவும்.';

  @override
  String get assessSectionWork => 'மாணவரின் பணி';

  @override
  String get assessResultTitle => 'மதிப்பீடு';

  @override
  String get worksheetSectionWorksheet => 'பணித்தாள்';

  @override
  String get rubricSectionAssignment => 'ஒப்படைப்பு';

  @override
  String get examPaperSectionPaper => 'வினாத்தாள்';

  @override
  String get examPaperSectionFormat => 'வடிவம்';

  @override
  String get vidyaEyebrow => 'உங்கள் இணை ஆசிரியர்';

  @override
  String get vidyaDeck =>
      'உங்கள் மொழியில் பேசுங்கள், நான் வேலையைத் தயார் செய்கிறேன்.';

  @override
  String get vidyaGreeting =>
      'வணக்கம் ஆசிரியரே. உங்கள் மொழியில் பேசுங்கள், நான் உங்கள் வேலையைத் தயார் செய்கிறேன்.';

  @override
  String get vidyaHeroBadge => 'உங்கள் AI கற்பித்தல் உதவியாளர்';

  @override
  String get vidyaPromptLesson => 'ஒரு பாடத்தைத் திட்டமிடச் சொல்லுங்கள்';

  @override
  String get vidyaPromptQuiz => 'ஒரு வினாடி வினா உருவாக்கச் சொல்லுங்கள்';

  @override
  String get vidyaPromptParent => 'பெற்றோருக்குச் செய்தி அனுப்பச் சொல்லுங்கள்';

  @override
  String get vidyaStateIdle => 'பேச தட்டவும்';

  @override
  String get vidyaStateReady => 'தயாராகிறது';

  @override
  String get vidyaWorkingTitle => 'இதில் வேலை செய்கிறேன்';

  @override
  String get vidyaWorkingBody =>
      'செயலியைத் தொடர்ந்து பயன்படுத்துங்கள். நான் பின்னணியில் முடிக்கிறேன்.';

  @override
  String get vidyaWorkingMinimise => 'VIDYA-வில் சுருக்கு';

  @override
  String get vidyaWorkingStop => 'நிறுத்து';

  @override
  String get vidyaStateListening => 'நான் கேட்கிறேன்';

  @override
  String get vidyaStateThinking => 'யோசிக்கிறேன்';

  @override
  String get vidyaStateSpeaking => 'பேசுகிறேன்';

  @override
  String get vidyaYouSaid => 'நீங்கள் சொன்னது';

  @override
  String get vidyaSignedOutTitle => 'VIDYA உடன் பேச உள்நுழையவும்';

  @override
  String get vidyaSignedOutBody =>
      'உள்நுழையுங்கள், VIDYA உங்கள் மொழியில் பாடங்கள், வினாடி வினாக்கள் மற்றும் பலவற்றைத் தயார் செய்யும்.';

  @override
  String get vidyaMicOffTitle => 'மைக்ரோஃபோனை இயக்கவும்';

  @override
  String get vidyaMicOffBody =>
      'உங்களைக் கேட்க VIDYA-க்கு மைக்ரோஃபோன் தேவை. அமைப்புகளில் அதை இயக்கவும்.';

  @override
  String get vidyaOpenSettings => 'அமைப்புகளைத் திற';

  @override
  String get vidyaSignIn => 'உள்நுழையவும்';

  @override
  String get vidyaLimitTitle => 'இன்றைய குரல் வரம்பை அடைந்துவிட்டீர்கள்';

  @override
  String get vidyaLimitBody =>
      'உங்கள் குரல் நிமிடங்கள் புதுப்பிக்கப்படும். அதுவரை கருவிகளைப் பயன்படுத்தலாம்.';

  @override
  String get vidyaErrorTitle => 'அது நிறைவேறவில்லை';

  @override
  String get vidyaErrorBody =>
      'ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்க முத்திரையைத் தட்டவும்.';

  @override
  String get vidyaPrepDesk => 'தயாரிப்பு மேசை';

  @override
  String get vidyaClearConversation => 'உரையாடலை அழி';

  @override
  String get vidyaFlowVisualAid => 'காட்சி உதவி';

  @override
  String get vidyaFlowVirtualFieldTrip => 'மெய்நிகர் கள பயணம்';

  @override
  String get vidyaFlowVideoStoryteller => 'வீடியோ கதை';

  @override
  String get vidyaFieldMicLabel => 'பேசி நிரப்பு';

  @override
  String get vidyaFieldMicFailed =>
      'கேட்கவில்லை. மீண்டும் முயற்சிக்கவும் அல்லது தட்டச்சு செய்யவும்.';

  @override
  String get vidyaOpen => 'VIDYA-விடம் கேளுங்கள்';

  @override
  String get parentHotlineTitle => 'பெற்றோர் அழைப்பு';

  @override
  String get parentHotlineSubtitle =>
      'மாணவரின் பெற்றோரை அவர்களின் மொழியில் அழைக்கவும்';

  @override
  String get parentHotlineEyebrow => 'பெற்றோர் அழைப்பு';

  @override
  String get parentHotlinePickStudentIntro =>
      'யாருடைய பெற்றோரை அழைக்க வேண்டும் எனத் தேர்ந்தெடுக்கவும்.';

  @override
  String get parentHotlineClassLabel => 'வகுப்பு';

  @override
  String get parentHotlineNoPhone => 'பெற்றோர் எண் சேமிக்கப்படவில்லை';

  @override
  String get parentHotlineSignedOutTitle =>
      'உங்கள் மாணவர்களைப் பார்க்க உள்நுழையவும்';

  @override
  String get parentHotlineSignedOutBody =>
      'நீங்கள் உள்நுழைந்ததும் உங்கள் வகுப்பு பட்டியல் ஏற்றப்படும். அழைப்பைச் செய்வதற்கு முன் பெற்றோர் அழைப்புக்கு உங்கள் கணக்கு தேவை.';

  @override
  String get parentHotlineRosterUnavailableTitle =>
      'உங்கள் வகுப்புப் பட்டியல் இன்னும் கிடைக்கவில்லை';

  @override
  String get parentHotlineRosterUnavailableBody =>
      'உங்கள் மாணவர்களை இங்கு இன்னும் ஏற்ற முடியவில்லை. இது வரவிருக்கும் புதுப்பிப்பில் வரும். நீங்கள் ஏற்கனவே உள்நுழைந்துள்ளீர்கள், எனவே நீங்கள் எதையும் சரிசெய்ய வேண்டியதில்லை.';

  @override
  String get parentHotlineRosterEmptyTitle =>
      'உங்கள் பட்டியலில் இன்னும் மாணவர்கள் இல்லை';

  @override
  String get parentHotlineRosterEmptyBody =>
      'ஒரு வகுப்பில் மாணவர்களைச் சேர்த்தால், அவர்கள் இங்கே தோன்றி வீட்டிற்கு அழைக்கத் தயாராக இருப்பார்கள்.';

  @override
  String get parentHotlineReasonEyebrow => 'நீங்கள் ஏன் அழைக்கிறீர்கள்';

  @override
  String get parentHotlineReasonAbsencesLabel => 'தொடர் வருகையின்மை';

  @override
  String get parentHotlineReasonAbsencesDesc =>
      'மாணவர் தொடர்ந்து பல நாட்கள் வரவில்லை.';

  @override
  String get parentHotlineReasonPerformanceLabel =>
      'ஒரு பாடத்தில் பின்தங்குதல்';

  @override
  String get parentHotlineReasonPerformanceDesc =>
      'சமீபத்திய மதிப்பெண்கள் அல்லது வகுப்புப் பணிக்குக் கவனம் தேவை.';

  @override
  String get parentHotlineReasonBehaviourLabel => 'வகுப்பில் நடத்தை';

  @override
  String get parentHotlineReasonBehaviourDesc =>
      'பெற்றோர் அறிந்திருக்க வேண்டிய ஒன்று நடந்துள்ளது.';

  @override
  String get parentHotlineReasonPositiveLabel => 'பகிர ஒரு நற்செய்தி';

  @override
  String get parentHotlineReasonPositiveDesc =>
      'பெற்றோருடன் ஒரு வெற்றியைக் கொண்டாடுங்கள்.';

  @override
  String get parentHotlineComposeEyebrow => 'அழைப்பைத் தயாரிக்கவும்';

  @override
  String get parentHotlineNoteLabel => 'ஒரு குறிப்பைச் சேர்க்கவும்';

  @override
  String get parentHotlineNoteHintAbsences =>
      'வராத நாட்கள் குறித்து பெற்றோர் அறிந்திருக்க வேண்டியது ஏதேனும் உள்ளதா?';

  @override
  String get parentHotlineNoteHintPerformance => 'மாணவர் முன்னேற எது உதவும்?';

  @override
  String get parentHotlineNoteHintBehaviour =>
      'என்ன நடந்தது, வீட்டில் எந்த ஆதரவு உதவும்?';

  @override
  String get parentHotlineNoteHintPositive => 'பகிர வேண்டிய நற்செய்தி என்ன?';

  @override
  String get parentHotlineDraftAction => 'செய்தியை உருவாக்கவும்';

  @override
  String get parentHotlineErrorTitle => 'ஏதோ தவறு நடந்துவிட்டது';

  @override
  String get parentHotlineGenericError =>
      'அது நிறைவேறவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get parentHotlineTelephonyUnavailable =>
      'இப்போது அழைப்பு வசதி இல்லை. செய்தியை நகலெடுத்து WhatsApp வழியாக அனுப்பலாம்.';

  @override
  String get parentHotlineEvidenceAttendanceHeader => 'வருகை';

  @override
  String get parentHotlineEvidenceMarksHeader => 'சமீபத்திய மதிப்பெண்கள்';

  @override
  String get parentHotlineEvidenceBehaviourHeader => 'என்ன நடந்தது';

  @override
  String get parentHotlineEvidencePositiveHeader => 'நற்செய்தி';

  @override
  String parentHotlineEvidenceAbsentDays(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: 'தொடர்ந்து $days நாட்கள் வரவில்லை',
      one: 'தொடர்ந்து 1 நாள் வரவில்லை',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineEvidenceAbsencePrompt =>
      'பெற்றோர் சரியான பதிவைக் கேட்கும் வகையில், வராத நாட்களை உறுதிப்படுத்தவும்.';

  @override
  String get parentHotlineEvidenceMarksPrompt =>
      'அழைப்பில் குறிப்பிட சமீபத்திய மதிப்பெண்கள் தயாராக உள்ளன.';

  @override
  String get parentHotlineEvidenceMarksEmpty =>
      'இதுவரை சமீபத்திய மதிப்பெண்கள் எதுவும் பதிவில் இல்லை. பெற்றோர் அறிய வேண்டியதைக் கீழே சேர்க்கவும்.';

  @override
  String get parentHotlineEvidenceBehaviourPrompt =>
      'என்ன நடந்தது என்பதையும் வீட்டில் உதவும் ஆதரவையும் விவரிக்கவும்.';

  @override
  String get parentHotlineEvidencePositivePrompt =>
      'பெற்றோர் கொண்டாட நீங்கள் விரும்பும் வெற்றியைப் பகிரவும்.';

  @override
  String get parentHotlineReviewEyebrow => 'வீட்டிற்கான செய்தி';

  @override
  String get parentHotlineCall => 'பெற்றோரை அழைக்கவும்';

  @override
  String get parentHotlineWhatsApp => 'WhatsApp-க்கு நகலெடுக்கவும்';

  @override
  String parentHotlineCallAgainIn(String time) {
    return '$time கழித்து மீண்டும் அழைக்கவும்';
  }

  @override
  String parentHotlineUnsupportedLanguage(String language) {
    return '$language மொழிக்கு தானியங்கு அழைப்பு இன்னும் கிடைக்கவில்லை. பதிலாக WhatsApp-க்கு நகலெடுக்கவும்.';
  }

  @override
  String parentHotlinePhoneMask(String last4) {
    return '•••• $last4';
  }

  @override
  String get parentHotlineAiNotice =>
      'இந்த அழைப்பு ஒரு தானியங்கு AI குரல் அறிவிப்புடன் தொடங்குகிறது.';

  @override
  String get parentHotlineCopied =>
      'செய்தி நகலெடுக்கப்பட்டது. அனுப்ப WhatsApp-இல் ஒட்டவும்.';

  @override
  String get parentHotlinePremiumTitle =>
      'பெற்றோர் அழைப்புக்கு மேம்பட்ட திட்டம் தேவை';

  @override
  String get parentHotlinePremiumBody =>
      'பெற்றோருக்கு AI குரல் அழைப்பு செய்வது மேம்பட்ட திட்டத்தின் ஒரு பகுதி. இருப்பினும், WhatsApp-இல் அனுப்ப ஒரு செய்தியை இலவசமாக நகலெடுக்கலாம்.';

  @override
  String get parentHotlineComingSoonTitle =>
      'அழைப்புக் காட்சி விரைவில் வருகிறது';

  @override
  String get parentHotlineComingSoonBody =>
      'அழைப்பைச் செய்து அதைப் பின்தொடரும் வசதி அடுத்த புதுப்பிப்பில் வரும்.';

  @override
  String parentHotlineCallingTitle(String name) {
    return '$name இன் பெற்றோரை அழைக்கிறோம்…';
  }

  @override
  String get parentHotlineCallingRinging => 'மணி ஒலிக்கிறது…';

  @override
  String get parentHotlineCallingInProgress =>
      'உரையாடல் நடந்து கொண்டிருக்கிறது';

  @override
  String parentHotlineCallingExchanges(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count பரிமாற்றங்கள்',
      one: '1 பரிமாற்றம்',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineCallingReassurance =>
      'இந்தத் திரையை நீங்கள் விட்டு வெளியேறலாம் — சுருக்கம் உங்களுக்காகக் காத்திருக்கும்.';

  @override
  String get parentHotlineSummaryDocType => 'பெற்றோர் அழைப்பு';

  @override
  String get parentHotlineSummaryReasonAbsences => 'வருகையின்மை';

  @override
  String get parentHotlineSummaryReasonPerformance => 'செயல்திறன்';

  @override
  String get parentHotlineSummaryReasonBehaviour => 'நடத்தை';

  @override
  String get parentHotlineSummaryReasonPositive => 'நற்செய்தி';

  @override
  String parentHotlineSummaryTitle(String name) {
    return '$name இன் பெற்றோர்';
  }

  @override
  String parentHotlineSummaryDurationMin(int minutes) {
    return '$minutes நிமிடம்';
  }

  @override
  String get parentHotlineSentimentCooperative => 'ஒத்துழைப்பு';

  @override
  String get parentHotlineSentimentConcerned => 'கவலை';

  @override
  String get parentHotlineSentimentGrateful => 'நன்றியுடன்';

  @override
  String get parentHotlineSentimentUpset => 'வருத்தம்';

  @override
  String get parentHotlineSentimentIndifferent => 'நடுநிலை';

  @override
  String get parentHotlineSentimentConfused => 'குழப்பம்';

  @override
  String get parentHotlineSummarySaidHeader => 'பெற்றோர் சொன்னது';

  @override
  String get parentHotlineSummaryConcernsHeader => 'எழுப்பப்பட்ட கவலைகள்';

  @override
  String get parentHotlineSummaryCommitmentsHeader => 'பெற்றோரின் உறுதிமொழிகள்';

  @override
  String get parentHotlineSummaryActionsHeader => 'உங்கள் செயல் பணிகள்';

  @override
  String get parentHotlineSummaryGuidanceHeader => 'பகிர்ந்த வழிகாட்டுதல்';

  @override
  String get parentHotlineSummaryFollowUpHeader => 'தொடர் நடவடிக்கை';

  @override
  String parentHotlineSummaryTranscript(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'உரையாடலைப் பார்க்க · $count செய்திகள்',
      one: 'உரையாடலைப் பார்க்க · 1 செய்தி',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineSummaryDone => 'முடிந்தது';

  @override
  String get parentHotlineSummaryCallAgain => 'பின்னர் மீண்டும் அழைக்கவும்';

  @override
  String get parentHotlineSummaryManualTitle => 'செய்தி நகலெடுக்கப்பட்டது';

  @override
  String get parentHotlineSummaryManualBody =>
      'பெற்றோருக்கு அனுப்ப WhatsApp இல் ஒட்டவும்.';

  @override
  String get parentHotlineSummaryBusy => 'இணைப்பு பிஸியாக இருந்தது';

  @override
  String get parentHotlineSummaryNoAnswer => 'பதில் இல்லை';

  @override
  String get parentHotlineSummaryFailed => 'அழைப்பை இணைக்க முடியவில்லை';

  @override
  String get parentHotlineSummaryFailedBody =>
      'அழைப்பு முடியவில்லை. மீண்டும் முயற்சிக்கலாம், அல்லது செய்தியை நகலெடுத்து WhatsApp இல் அனுப்பலாம்.';

  @override
  String get parentHotlineSummaryTryAgain => 'மீண்டும் முயற்சிக்கவும்';

  @override
  String get parentHotlineSummaryNoConversationTitle =>
      'அழைப்பு மிக விரைவில் முடிந்தது';

  @override
  String get parentHotlineSummaryNoConversationBody =>
      'உரையாடல் தொடங்கும் முன்பே அழைப்பு முடிந்தது. மீண்டும் முயற்சிக்கலாம், அல்லது செய்தியை WhatsApp இல் அனுப்பலாம்.';

  @override
  String get parentHotlineSummaryUnavailableTitle => 'சுருக்கம் கிடைக்கவில்லை';

  @override
  String get parentHotlineSummaryUnavailableBody =>
      'இந்த அழைப்புக்கான சுருக்கத்தைத் தயாரிக்க முடியவில்லை. உரையாடல் கீழே உள்ளது.';

  @override
  String get contentCreatorTitle => 'உள்ளடக்க உருவாக்க ஸ்டுடியோ';

  @override
  String get contentCreatorTileSubtitle =>
      'உங்கள் வகுப்பிற்கான மல்டிமீடியாவை உருவாக்குங்கள்';

  @override
  String get contentCreatorSubtitle =>
      'உங்கள் வகுப்பறைக்கு கவர்ச்சிகரமான மல்டிமீடியா உள்ளடக்கத்தை உருவாக்க உதவும் கருவிகள்.';

  @override
  String get contentCreatorSectionEyebrow => 'ஒரு கருவியைத் தேர்ந்தெடுக்கவும்';

  @override
  String get contentCreatorVisualAidDesc =>
      'உங்கள் பாடங்களுக்கு எளிய கோட்டுப் படங்களையும் வரைபடங்களையும் உருவாக்குங்கள்.';

  @override
  String get contentCreatorFieldTripDesc =>
      'Google Earth-ஐப் பயன்படுத்தி சுவாரஸ்யமான மெய்நிகர் சுற்றுலாக்களைத் திட்டமிடுங்கள்.';

  @override
  String get contentCreatorVideoDesc =>
      'உங்கள் பாடங்களுக்கு தேர்ந்தெடுக்கப்பட்ட கல்வி வீடியோக்களைக் கண்டறியுங்கள்.';

  @override
  String get visualAidTitle => 'காட்சி உதவி';

  @override
  String get visualAidSubtitle => 'கற்பித்தல் படத்தை உருவாக்குங்கள்';

  @override
  String get visualAidEmpty =>
      'ஒரு படத்தை விவரித்து உருவாக்கு என்பதை அழுத்துங்கள்.';

  @override
  String get visualAidPromptLabel => 'படத்தில் என்ன காட்ட வேண்டும்?';

  @override
  String get visualAidPromptHint =>
      'எடுத்துக்காட்டாக, தாவர உயிரணுவின் பாகங்கள்';

  @override
  String get visualAidPromptError =>
      'உங்களுக்கு எந்த மாதிரி படம் வேண்டும் என்பதை விவரிக்கவும்.';

  @override
  String get visualAidGradeLabel => 'வகுப்பு நிலை';

  @override
  String get visualAidGradeAny => 'எந்த வகுப்பும்';

  @override
  String get visualAidSubjectLabel => 'பாடம்';

  @override
  String get visualAidSubjectAny => 'எந்த பாடமும்';

  @override
  String get visualAidOptional => 'விருப்பத்தேர்வு';

  @override
  String get visualAidAction => 'படத்தை உருவாக்கு';

  @override
  String get visualAidResultTitle => 'காட்சி உதவி';

  @override
  String get visualAidHowToUse => 'இதை எப்படி பயன்படுத்துவது';

  @override
  String get visualAidDiscussionSpark => 'விவாத கேள்வி';

  @override
  String get visualAidImageLabel => 'உருவாக்கப்பட்ட கற்பித்தல் படம்';

  @override
  String get visualAidImageError => 'இந்தப் படத்தைக் காட்ட முடியவில்லை.';

  @override
  String get visualAidNoImage =>
      'அந்த விவரத்திற்கு எந்தப் படமும் வரவில்லை. தயவுசெய்து அதை மீண்டும் எழுதி முயற்சிக்கவும்.';

  @override
  String get visualAidSignIn =>
      'இந்தக் கருவியைப் பயன்படுத்த மீண்டும் உள்நுழையவும்.';

  @override
  String get visualAidUpgradeTitle => 'உயர்ந்த திட்டம் தேவை';

  @override
  String get visualAidUpgradeBody =>
      'காட்சி உதவி ஒரு உயர்ந்த திட்டத்தின் பகுதி. படங்களை உருவாக்கத் தொடர, தயவுசெய்து மேம்படுத்தவும்.';

  @override
  String get visualAidSeePricing => 'திட்டங்கள் மற்றும் விலையைப் பார்க்கவும்';

  @override
  String get visualAidDailyLimitTitle =>
      'இன்றைக்கான உங்கள் எல்லாப் படங்களும் முடிந்துவிட்டன';

  @override
  String get visualAidDailyLimitBody =>
      'உங்கள் திட்டத்தில் ஒவ்வொரு நாளும் குறிப்பிட்ட எண்ணிக்கையிலான காட்சி உதவிகள் அடங்கும். உங்கள் படங்கள் நாளை மீண்டும் கிடைக்கும், அல்லது உயர்ந்த திட்டத்தில் தினசரி வரம்பை உயர்த்தலாம்.';

  @override
  String get visualAidLimitTitle => 'நீங்கள் உங்கள் வரம்பை அடைந்துவிட்டீர்கள்';

  @override
  String get visualAidLimitBody =>
      'இந்த மாதத்திற்கான உங்கள் காட்சி உதவிகளை நீங்கள் பயன்படுத்திவிட்டீர்கள். உங்கள் படங்கள் அடுத்த மாதம் மீண்டும் கிடைக்கும், அல்லது உயர்ந்த திட்டத்தில் வரம்பை உயர்த்தலாம்.';

  @override
  String get visualAidRephrase =>
      'அந்தப் படத்தை எங்களால் உருவாக்க முடியவில்லை. தயவுசெய்து அதை மீண்டும் எழுதி முயற்சிக்கவும்.';

  @override
  String get visualAidEmptyGeneration =>
      'படம் காலியாக வந்தது. குறைவான லேபிள்களுடன் விவரிக்க முயற்சிக்கவும்.';

  @override
  String get visualAidBusy =>
      'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.';

  @override
  String visualAidBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சுமார் $seconds வினாடிகளில் மீண்டும் முயற்சிக்கவும்.',
      one:
          'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சுமார் 1 வினாடியில் மீண்டும் முயற்சிக்கவும்.',
    );
    return '$_temp0';
  }

  @override
  String get visualAidTimeout =>
      'எதிர்பார்த்ததை விட அதிக நேரம் ஆகிறது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get videoStorytellerTitle => 'வீடியோ கதைசொல்லி';

  @override
  String get videoStorytellerSubtitle =>
      'கற்பித்தல் வீடியோக்களைக் கண்டறியுங்கள்';

  @override
  String get videoStorytellerEmpty =>
      'ஒரு பாடம் அல்லது தலைப்பைத் தேர்ந்தெடுத்து வீடியோக்களைக் கண்டறி என்பதைத் தட்டவும்.';

  @override
  String get videoStorytellerTopicLabel => 'தலைப்பு அல்லது பாடப்பகுதி';

  @override
  String get videoStorytellerTopicHint => 'எடுத்துக்காட்டாக, நீர் சுழற்சி';

  @override
  String get videoStorytellerSubjectLabel => 'பாடம்';

  @override
  String get videoStorytellerSubjectAny => 'எந்த பாடமும்';

  @override
  String get videoStorytellerGradeLabel => 'வகுப்பு நிலை';

  @override
  String get videoStorytellerGradeAny => 'எந்த வகுப்பும்';

  @override
  String get videoStorytellerOptional => 'விருப்பத்தேர்வு';

  @override
  String get videoStorytellerAction => 'வீடியோக்களைக் கண்டறி';

  @override
  String get videoStorytellerNoResults =>
      'அதற்கு எந்த வீடியோவும் வரவில்லை. வேறு பாடம் அல்லது தலைப்பை முயற்சிக்கவும்.';

  @override
  String videoStorytellerViewAll(int count) {
    return '$count அனைத்தையும் காண்க';
  }

  @override
  String get videoStorytellerOfficialSource => 'அதிகாரப்பூர்வ ஆதாரம்';

  @override
  String get videoStorytellerOpensExternally =>
      'யூடியூபில், ஆப்பிற்கு வெளியே திறக்கும்.';

  @override
  String get videoStorytellerCategoryTopRecommended =>
      'உங்களுக்கான சிறந்த பரிந்துரைகள்';

  @override
  String get videoStorytellerCategoryStorytelling =>
      'உங்கள் பாடங்களுக்கான கதைசொல்லல்';

  @override
  String get videoStorytellerCategoryPedagogy =>
      'கல்வியியல் மற்றும் கற்பித்தல் முறைகள்';

  @override
  String get videoStorytellerCategoryGovtUpdates => 'அரசு புதுப்பிப்புகள்';

  @override
  String get videoStorytellerCategoryCourses => 'ஆசிரியர் பயிற்சி பாடநெறிகள்';

  @override
  String get videoStorytellerSignIn =>
      'இந்தக் கருவியைப் பயன்படுத்த மீண்டும் உள்நுழையவும்.';

  @override
  String get videoStorytellerTimeout =>
      'எதிர்பார்த்ததை விட அதிக நேரம் ஆகிறது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get videoStorytellerBusy =>
      'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.';

  @override
  String videoStorytellerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சுமார் $seconds வினாடிகளில் மீண்டும் முயற்சிக்கவும்.',
      one:
          'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சுமார் 1 வினாடியில் மீண்டும் முயற்சிக்கவும்.',
    );
    return '$_temp0';
  }

  @override
  String get videoStorytellerRephrase =>
      'அதற்கு வீடியோக்களைக் கண்டறிய முடியவில்லை. வேறு தலைப்பை முயற்சிக்கவும்.';

  @override
  String get videoStorytellerLimit =>
      'நீங்கள் சமீபத்தில் நிறைய தேடியுள்ளீர்கள். சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get actionDone => 'முடிந்தது';

  @override
  String get virtualFieldTripTitle => 'மெய்நிகர் கள சுற்றுலா';

  @override
  String get virtualFieldTripSubtitle =>
      'Google Earth-இல் உலகைச் சுற்றிப் பாருங்கள்';

  @override
  String get virtualFieldTripEmpty =>
      'ஒரு தலைப்பை உள்ளிட்டு \'சுற்றுலாவைத் திட்டமிடு\' என்பதைத் தட்டவும்.';

  @override
  String get virtualFieldTripTopicLabel => 'தலைப்பு அல்லது கருப்பொருள்';

  @override
  String get virtualFieldTripTopicHint =>
      'எடுத்துக்காட்டாக, கிரேட் பேரியர் ரீஃப்';

  @override
  String get virtualFieldTripTopicError =>
      'சுற்றுலாவுக்கு ஒரு தலைப்பை உள்ளிடவும்.';

  @override
  String get virtualFieldTripGradeLabel => 'வகுப்பு நிலை';

  @override
  String get virtualFieldTripGradeAny => 'எந்த வகுப்பும்';

  @override
  String get virtualFieldTripOptional => 'விருப்பத்திற்குரியது';

  @override
  String get virtualFieldTripAction => 'சுற்றுலாவைத் திட்டமிடு';

  @override
  String get virtualFieldTripDocType => 'மெய்நிகர் கள சுற்றுலா';

  @override
  String virtualFieldTripStopCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count நிறுத்தங்கள்',
      one: '1 நிறுத்தம்',
    );
    return '$_temp0';
  }

  @override
  String virtualFieldTripStopSemantics(int number, String name) {
    return 'நிறுத்தம் $number: $name';
  }

  @override
  String get virtualFieldTripFactLabel => 'உங்களுக்குத் தெரியுமா?';

  @override
  String get virtualFieldTripReflectionLabel => 'இதைப் பற்றி சிந்தியுங்கள்';

  @override
  String get virtualFieldTripAnalogyLabel => 'நம் சூழலில்';

  @override
  String get virtualFieldTripExplanationLabel => 'நாம் ஏன் செல்கிறோம்';

  @override
  String get virtualFieldTripOpenEarth => 'Google Earth-இல் திற';

  @override
  String get virtualFieldTripOpensExternally =>
      'செயலிக்கு வெளியே, Google Earth-இல் திறக்கும்.';

  @override
  String get virtualFieldTripPendingTitle =>
      'உங்கள் சுற்றுலா இன்னும் திட்டமிடப்படுகிறது';

  @override
  String get virtualFieldTripPendingBody =>
      'உங்கள் கள சுற்றுலா இன்னும் தயாராகி வருகிறது. ஒரு நிமிடத்தில் \'எனது நூலகம்\' பார்க்கவும்.';

  @override
  String get virtualFieldTripNoStops =>
      'அதற்கு நிறுத்தங்கள் எதுவும் வரவில்லை. வேறு தலைப்பை முயற்சிக்கவும்.';

  @override
  String get virtualFieldTripSignIn =>
      'இந்தக் கருவியைப் பயன்படுத்த மீண்டும் உள்நுழையவும்.';

  @override
  String get virtualFieldTripUnavailable =>
      'இந்தக் கருவி உங்கள் தற்போதைய திட்டத்தில் இல்லை.';

  @override
  String get virtualFieldTripTimeout =>
      'இது எதிர்பார்த்ததை விட அதிக நேரம் எடுக்கிறது. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get virtualFieldTripBusy =>
      'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String virtualFieldTripBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சுமார் $seconds வினாடிகள் கழித்து மீண்டும் முயற்சிக்கவும்.',
      one:
          'உதவியாளர் இப்போது பணிமிகுதியில் உள்ளார். சுமார் 1 வினாடி கழித்து மீண்டும் முயற்சிக்கவும்.',
    );
    return '$_temp0';
  }

  @override
  String get virtualFieldTripRephrase =>
      'அதற்கு எங்களால் சுற்றுலாவைத் திட்டமிட முடியவில்லை. வேறு தலைப்பை முயற்சிக்கவும்.';

  @override
  String get virtualFieldTripLimit =>
      'நீங்கள் சமீபத்தில் நிறைய சுற்றுலாக்களைத் திட்டமிட்டுள்ளீர்கள். சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get assessmentScannerTitle => 'மதிப்பீட்டு ஸ்கேனர்';

  @override
  String get assessmentScannerSubtitle =>
      'மாணவரின் விடைத்தாளைப் பக்கம் பக்கமாக மதிப்பிடுங்கள்';

  @override
  String get assessmentScannerEmpty =>
      'விடைத்தாளின் 3 வரை புகைப்படங்களைச் சேர்த்து, பிறகு மதிப்பிடு என்பதை அழுத்துங்கள்.';

  @override
  String get assessmentScannerSubmit => 'விடைத்தாளை மதிப்பிடுங்கள்';

  @override
  String get assessmentScannerResultTitle => 'மதிப்பீடு';

  @override
  String get assessmentScannerSectionSheet => 'விடைத்தாள்';

  @override
  String get assessmentScannerPagesLabel => 'விடைத்தாள் பக்கங்கள்';

  @override
  String get assessmentScannerPagesHint =>
      '3 வரை தெளிவான புகைப்படங்களைச் சேர்க்கவும், ஒவ்வொரு பக்கத்திற்கும் ஒன்று.';

  @override
  String get assessmentScannerPagesEmpty =>
      'முதல் பக்கத்தின் ஒரு புகைப்படத்தைச் சேர்க்கவும்.';

  @override
  String assessmentScannerPageLabel(int number) {
    return 'பக்கம் $number';
  }

  @override
  String assessmentScannerRemovePage(int number) {
    return 'பக்கம் $number அகற்று';
  }

  @override
  String assessmentScannerPageCounter(int count, int max) {
    return '$max இல் $count பக்கங்கள்';
  }

  @override
  String assessmentScannerPagesFull(int max) {
    return 'நீங்கள் $max வரை பக்கங்களைச் சேர்க்கலாம்.';
  }

  @override
  String get assessmentScannerTakePhoto => 'புகைப்படம் எடு';

  @override
  String get assessmentScannerChooseGallery => 'கேலரியிலிருந்து தேர்வுசெய்';

  @override
  String get assessmentScannerSubjectLabel => 'பாடம்';

  @override
  String get assessmentScannerSubjectHint =>
      'மதிப்பீடு பாடத்திற்கு ஏற்ப அமைகிறது.';

  @override
  String get assessmentScannerSubjectPlaceholder => 'பாடத்தைத் தேர்வுசெய்';

  @override
  String get assessmentScannerSubjectError => 'பாடத்தைத் தேர்வுசெய்யவும்.';

  @override
  String get assessmentScannerGradeLabel => 'வகுப்பு நிலை';

  @override
  String get assessmentScannerGradePlaceholder => 'வகுப்பைத் தேர்வுசெய்';

  @override
  String get assessmentScannerGradeError => 'வகுப்பைத் தேர்வுசெய்யவும்.';

  @override
  String get assessmentScannerOptional => 'விருப்பத்தேர்வு';

  @override
  String get assessmentScannerAnswerKeyLabel => 'விடைக் குறிப்பு';

  @override
  String get assessmentScannerAnswerKeyHint =>
      'சரியான விடைகளை ஒட்டவும், அவற்றின்படி மதிப்பிடப்படும்.';

  @override
  String get assessmentScannerAnswerKeyPlaceholder =>
      'விடைக் குறிப்பை எழுதவும் அல்லது ஒட்டவும்';

  @override
  String get assessmentScannerPrivacyNote =>
      'மதிப்பீட்டிற்கு மாணவரின் பெயர் ஒருபோதும் அனுப்பப்படாது.';

  @override
  String assessmentScannerScoreCaption(String awarded, String max) {
    return '$max இல் $awarded மதிப்பெண்கள்';
  }

  @override
  String get assessmentScannerScoreOutOf => '100 இல்';

  @override
  String assessmentScannerMarks(String awarded, String max) {
    return '$awarded/$max';
  }

  @override
  String assessmentScannerPagesMeta(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count பக்கங்கள்',
      one: '1 பக்கம்',
    );
    return '$_temp0';
  }

  @override
  String assessmentScannerReviewBadge(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count சரிபார்க்கவும்',
      one: '1 சரிபார்க்கவும்',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerQuestionsSection => 'வினா வாரியாக';

  @override
  String get assessmentScannerStudentAnswerLabel => 'மாணவர் எழுதியது';

  @override
  String get assessmentScannerFeedbackLabel => 'பின்னூட்டம்';

  @override
  String get assessmentScannerExpectedLabel => 'எதிர்பார்க்கப்படும் விடை';

  @override
  String get assessmentScannerNextStepsSection =>
      'பரிந்துரைக்கப்பட்ட அடுத்த படிகள்';

  @override
  String get assessmentScannerStudentSection => 'மாணவருக்கு';

  @override
  String get assessmentScannerQualitySection => 'புகைப்பட தரம்';

  @override
  String get assessmentScannerNotScored => 'மதிப்பெண் வழங்கப்படவில்லை';

  @override
  String get assessmentScannerNoContent =>
      'மதிப்பெண்கள் எதுவும் வரவில்லை. தெளிவான புகைப்படங்களை முயற்சிக்கவும்.';

  @override
  String get assessmentScannerOutcomeCorrect => 'சரி';

  @override
  String get assessmentScannerOutcomePartial => 'பகுதி சரி';

  @override
  String get assessmentScannerOutcomeIncorrect => 'தவறு';

  @override
  String get assessmentScannerReviewChip => 'இதைச் சரிபார்க்கவும்';

  @override
  String get assessmentScannerSignIn =>
      'விடைத்தாளை மதிப்பிட மீண்டும் உள்நுழையவும்.';

  @override
  String get assessmentScannerUpgradeTitle => 'உயர் திட்டம் தேவை';

  @override
  String get assessmentScannerUpgradeBody =>
      'விடைத்தாள்களை மதிப்பிடுவது உயர் திட்டத்தின் ஒரு பகுதி. மதிப்பீட்டைத் தொடர மேம்படுத்துங்கள்.';

  @override
  String get assessmentScannerSeePricing => 'திட்டங்களைப் பார்க்கவும்';

  @override
  String get assessmentScannerDailyLimitTitle =>
      'இன்றைக்கான உங்கள் விடைத்தாள்கள் அனைத்தும் முடிந்தன';

  @override
  String get assessmentScannerDailyLimitBody =>
      'உங்கள் திட்டத்தில் ஒவ்வொரு நாளும் குறிப்பிட்ட எண்ணிக்கையிலான விடைத்தாள்கள் உள்ளன. அவை நாளை மீண்டும் தொடங்கும், அல்லது உயர் திட்டத்தில் வரம்பை உயர்த்தலாம்.';

  @override
  String get assessmentScannerLimitTitle =>
      'உங்கள் மதிப்பீட்டு வரம்பை அடைந்துவிட்டீர்கள்';

  @override
  String get assessmentScannerLimitBody =>
      'உங்கள் திட்டத்தின் அனைத்து விடைத்தாள்களையும் பயன்படுத்திவிட்டீர்கள். அவை அடுத்த மாதம் மீண்டும் தொடங்கும், அல்லது உயர் திட்டத்தில் வரம்பை உயர்த்தலாம்.';

  @override
  String get assessmentScannerBusy =>
      'மதிப்பீட்டு மாதிரி இப்போது பணிமிகுதியில் உள்ளது. ஒரு நிமிடத்தில் மீண்டும் முயற்சிக்கவும்.';

  @override
  String assessmentScannerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'மதிப்பீட்டு மாதிரி இப்போது பணிமிகுதியில் உள்ளது. சுமார் $seconds வினாடிகளில் மீண்டும் முயற்சிக்கவும்.',
      one:
          'மதிப்பீட்டு மாதிரி இப்போது பணிமிகுதியில் உள்ளது. சுமார் 1 வினாடியில் மீண்டும் முயற்சிக்கவும்.',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerTimeout =>
      'மதிப்பீடு வழக்கத்தை விட அதிக நேரம் எடுக்கிறது. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get assessmentScannerRephrase =>
      'புகைப்படங்களை மதிப்பிட முடியவில்லை. தெளிவான பக்கங்களை மீண்டும் பதிவேற்றவும்.';

  @override
  String get inboxTitle => 'செய்திகள்';

  @override
  String get inboxSignInTitle => 'உங்கள் செய்திகள்';

  @override
  String get inboxSignInBody => 'உங்கள் செய்திகளைப் பார்க்க உள்நுழையவும்';

  @override
  String get inboxEmptyTitle => 'இன்னும் உரையாடல்கள் இல்லை';

  @override
  String get inboxEmptyBody =>
      'நீங்கள் ஆசிரியர்களுடன் இணையும்போது, உங்கள் உரையாடல்கள் இங்கே தோன்றும்.';

  @override
  String get inboxErrorBody =>
      'உங்கள் செய்திகளை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get inboxNoMessagesYet => 'இன்னும் செய்திகள் இல்லை';

  @override
  String get inboxThreadFallbackTitle => 'உரையாடல்';

  @override
  String get inboxThreadEmptyTitle => 'இன்னும் செய்திகள் இல்லை';

  @override
  String get inboxThreadEmptyBody => 'உரையாடலைத் தொடங்க வணக்கம் சொல்லுங்கள்.';

  @override
  String get inboxComposerHint => 'ஒரு செய்தியை எழுதுங்கள்';

  @override
  String get inboxComposerSend => 'அனுப்பு';

  @override
  String get inboxComposerTooLong => 'செய்தி மிக நீளமாக உள்ளது. சுருக்கவும்.';

  @override
  String get inboxLoadOlder => 'பழைய செய்திகளை ஏற்று';

  @override
  String get inboxSendFailed => 'உங்கள் செய்தியை அனுப்ப முடியவில்லை.';

  @override
  String get inboxResourceLabel => 'வளம்';

  @override
  String get inboxVoiceNoteLabel => 'குரல் குறிப்பு';

  @override
  String inboxUnreadLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count படிக்காதவை',
      one: '1 படிக்காதது',
    );
    return '$_temp0';
  }

  @override
  String get inboxTickSending => 'அனுப்புகிறது';

  @override
  String get inboxTickSent => 'அனுப்பப்பட்டது';

  @override
  String get inboxTickDelivered => 'வழங்கப்பட்டது';

  @override
  String get inboxTickRead => 'படிக்கப்பட்டது';

  @override
  String get inboxTickFailed => 'அனுப்பப்படவில்லை';

  @override
  String get inboxTimeNow => 'இப்போது';

  @override
  String inboxTimeMinutes(int count) {
    return '$count நி';
  }

  @override
  String inboxTimeHours(int count) {
    return '$count ம';
  }

  @override
  String inboxTimeDays(int count) {
    return '$count நா';
  }

  @override
  String inboxTimeWeeks(int count) {
    return '$count வா';
  }

  @override
  String get networkTitle => 'நெட்வொர்க்';

  @override
  String get networkTooltip => 'நெட்வொர்க்';

  @override
  String get networkTabStaffroom => 'ஸ்டாஃப்ரூம்';

  @override
  String get networkTabMessages => 'செய்திகள்';

  @override
  String get networkTabUpdates => 'புதுப்பிப்புகள்';

  @override
  String get notificationsEmptyTitle => 'இதுவரை புதிதாக ஏதுமில்லை';

  @override
  String get notificationsEmptyBody =>
      'அழைப்பின் முடிவுகள், வருகை எச்சரிக்கைகள், தயாரான வினாத்தாள்கள் ஆகியவை நடக்கும்போதே இங்கே தோன்றும்.';

  @override
  String get notificationsLocalNote =>
      'நீங்கள் செயலியைத் திறக்கும்போது இவை தோன்றும். SahayakAI இன்னும் தொலைபேசி அறிவிப்புகளை அனுப்ப முடியாது.';

  @override
  String get notificationsMarkAllRead => 'அனைத்தையும் படித்ததாகக் குறிக்கவும்';

  @override
  String notificationCallCompletedTitle(String student) {
    return '$student தொடர்பாக பெற்றோர் அழைப்பு முடிந்தது';
  }

  @override
  String get notificationCallCompletedBody =>
      'உரையாடலின் சுருக்கம் பெற்றோர் அழைப்பு பகுதியில் தயாராக உள்ளது.';

  @override
  String notificationCallFailedTitle(String student) {
    return '$student தொடர்பாக பெற்றோர் அழைப்பு இணையவில்லை';
  }

  @override
  String get notificationCallFailedBody =>
      'மீண்டும் அழைக்கவும், அல்லது செய்தியை WhatsApp வழியாக அனுப்பவும்.';

  @override
  String notificationAbsenceTitle(String student, int count) {
    return '$student தொடர்ச்சியாக $count நாட்கள் வரவில்லை';
  }

  @override
  String notificationAbsenceBody(String className) {
    return 'தவறவிட்ட நாட்களைப் பார்க்க $className திறக்கவும்.';
  }

  @override
  String notificationExamPaperTitle(String subject) {
    return '$subject வினாத்தாள் தயாராகிக் கொண்டிருக்கிறது';
  }

  @override
  String get notificationExamPaperBody =>
      'இது இன்னும் தயாராகிக் கொண்டிருக்கிறது, தானாகவே உங்கள் நூலகத்தில் வந்துவிடும்.';

  @override
  String get staffroomTitle => 'ஸ்டாஃப்ரூம்';

  @override
  String get staffroomHeroTitle => 'ஸ்டாஃப்ரூம்';

  @override
  String get staffroomHeroDeck =>
      'பாரதம் முழுவதும் உள்ள ஆசிரியர்கள், ஒரே அறையில்';

  @override
  String get staffroomSectionGroups => 'உங்கள் குழுக்கள்';

  @override
  String get staffroomSectionFeed => 'உங்கள் குழுக்களிலிருந்து';

  @override
  String get staffroomSectionDiscover => 'குழுக்களைக் கண்டறியுங்கள்';

  @override
  String get staffroomSectionPeople => 'உங்களுக்குத் தெரிந்தவர்கள்';

  @override
  String get staffroomSignInTitle => 'ஸ்டாஃப்ரூமில் இணையுங்கள்';

  @override
  String get staffroomSignInBody => 'ஸ்டாஃப்ரூமில் இணைய உள்நுழையவும்';

  @override
  String get staffroomFeedEmptyTitle => 'உங்கள் ஃபீட் அமைதியாக உள்ளது';

  @override
  String get staffroomFeedEmptyBody =>
      'உங்கள் குழுக்களின் இடுகைகள் இங்கே தோன்றும்.';

  @override
  String get staffroomErrorBody =>
      'ஸ்டாஃப்ரூமை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get staffroomGroupsEmptyTitle => 'இன்னும் குழுக்கள் இல்லை';

  @override
  String get staffroomGroupsEmptyBody =>
      'இடுகைகளையும் அரட்டையையும் காண ஒரு குழுவில் இணையுங்கள்.';

  @override
  String get staffroomBrowseGroups => 'குழுக்களை உலாவுக';

  @override
  String staffroomMemberCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count உறுப்பினர்கள்',
      one: '1 உறுப்பினர்',
    );
    return '$_temp0';
  }

  @override
  String get staffroomJoin => 'இணை';

  @override
  String get staffroomJoined => 'இணைந்தீர்கள்';

  @override
  String get staffroomJoinFailed =>
      'இணைய முடியவில்லை. மீண்டும் முயற்சிக்க தட்டவும்.';

  @override
  String get staffroomGroupLockedTitle => 'உறுப்பினர்களுக்கு மட்டும்';

  @override
  String get staffroomGroupLockedBody =>
      'இந்தக் குழுவின் இடுகைகளைக் காண இணையுங்கள்.';

  @override
  String get staffroomGroupPostsEmptyTitle => 'இன்னும் இடுகைகள் இல்லை';

  @override
  String get staffroomGroupPostsEmptyBody => 'இங்கே முதலில் பகிருங்கள்.';

  @override
  String get staffroomGroupNotFoundTitle => 'குழு கிடைக்கவில்லை';

  @override
  String get staffroomGroupNotFoundBody => 'இந்தக் குழு அகற்றப்பட்டிருக்கலாம்.';

  @override
  String get staffroomPostTypeShare => 'பகிர்ந்தது';

  @override
  String get staffroomPostTypeAskHelp => 'உதவி தேவை';

  @override
  String get staffroomPostTypeCelebrate => 'கொண்டாட்டம்';

  @override
  String get staffroomPostTypeResource => 'வளம்';

  @override
  String get staffroomLike => 'விருப்பம்';

  @override
  String get staffroomLiked => 'விரும்பியது';

  @override
  String staffroomLikeCountLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count விருப்பங்கள்',
      one: '1 விருப்பம்',
      zero: 'விருப்பங்கள் இல்லை',
    );
    return '$_temp0';
  }

  @override
  String get staffroomLikeFailed =>
      'புதுப்பிக்க முடியவில்லை. மீண்டும் முயற்சிக்க தட்டவும்.';

  @override
  String get staffroomResourceShared => 'ஒரு வளத்தைப் பகிர்ந்தது';

  @override
  String staffroomChatHighlight(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count புதிய செய்திகள்',
      one: '1 புதிய செய்தி',
    );
    return '$_temp0';
  }

  @override
  String get staffroomConnect => 'தொடர்பு கொள்';

  @override
  String get staffroomConnectSent => 'கோரிக்கை அனுப்பப்பட்டது';

  @override
  String get staffroomConnectPending => 'கோரிக்கை ஏற்கனவே நிலுவையில் உள்ளது';

  @override
  String get staffroomConnectConnected => 'ஏற்கனவே இணைக்கப்பட்டுள்ளது';

  @override
  String get staffroomChatTitle => 'ஸ்டாஃப்ரூம்';

  @override
  String get staffroomChatEntryBody =>
      'இந்தியா முழுவதும் உள்ள ஆசிரியர்களுடன் அரட்டையடிக்கவும்';

  @override
  String get staffroomChatSignInTitle => 'ஸ்டாஃப்ரூமில் இணையுங்கள்';

  @override
  String get staffroomChatSignInBody => 'ஸ்டாஃப்ரூமில் இணைய உள்நுழையவும்';

  @override
  String get staffroomChatEmptyTitle => 'இதுவரை செய்திகள் இல்லை';

  @override
  String get staffroomChatEmptyBody => 'முதலில் வணக்கம் சொல்லுங்கள்.';

  @override
  String get staffroomChatAiBadge => 'AI ஆசிரியர்';

  @override
  String get staffroomGroupChatEntry => 'குழு அரட்டை';

  @override
  String get staffroomDirectoryTitle => 'ஆசிரியர்களைக் கண்டறியுங்கள்';

  @override
  String get staffroomDirectoryEntryBody => 'ஆசிரியர் அடைவில் தேடுங்கள்';

  @override
  String get staffroomDirectorySearchHint =>
      'பெயர் அல்லது பாடத்தின் மூலம் தேடுங்கள்';

  @override
  String get staffroomDirectoryErrorBody =>
      'அடைவை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get staffroomDirectoryEmptyTitle => 'ஆசிரியர்கள் யாரும் கிடைக்கவில்லை';

  @override
  String get staffroomDirectoryEmptyBody =>
      'காட்ட இன்னும் ஆசிரியர்கள் யாரும் இல்லை.';

  @override
  String get staffroomDirectorySearchEmpty =>
      'உங்கள் தேடலுக்கு ஆசிரியர்கள் யாரும் பொருந்தவில்லை.';

  @override
  String get staffroomProfileTitle => 'ஆசிரியர்';

  @override
  String get staffroomProfileErrorBody =>
      'இந்த சுயவிவரத்தை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get staffroomProfileNotFoundTitle => 'சுயவிவரம் கிடைக்கவில்லை';

  @override
  String get staffroomProfileNotFoundBody =>
      'இந்த சுயவிவரம் கண்டறியப்படவில்லை.';

  @override
  String get staffroomProfileAboutLabel => 'அறிமுகம்';

  @override
  String get staffroomProfileBioEmpty => 'இன்னும் அறிமுகம் எதுவும் இல்லை.';

  @override
  String get staffroomProfileVerified => 'சரிபார்க்கப்பட்டது';

  @override
  String staffroomProfileExperience(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ஆண்டுகள் அனுபவம்',
      one: '1 ஆண்டு அனுபவம்',
    );
    return '$_temp0';
  }

  @override
  String get staffroomProfileSubjectsLabel => 'பாடங்கள்';

  @override
  String get staffroomProfileClassesLabel => 'வகுப்புகள்';

  @override
  String get staffroomProfileLanguagesLabel => 'மொழிகள்';

  @override
  String get staffroomRequested => 'கோரிக்கை அனுப்பப்பட்டது';

  @override
  String get staffroomConnectionAccept => 'ஏற்கவும்';

  @override
  String get staffroomConnectionDecline => 'நிராகரிக்கவும்';

  @override
  String get staffroomConnected => 'இணைக்கப்பட்டது';

  @override
  String get staffroomConnectionWants => 'இணைய விரும்புகிறார்';

  @override
  String get staffroomMessage => 'செய்தி அனுப்பு';

  @override
  String get staffroomConnectToMessage => 'செய்தி அனுப்ப இணையுங்கள்';

  @override
  String get staffroomConnectionFailed =>
      'புதுப்பிக்க முடியவில்லை. மீண்டும் முயல தட்டவும்.';

  @override
  String get staffroomDisconnect => 'தொடர்பைத் துண்டி';

  @override
  String get staffroomDisconnectConfirmTitle => 'தொடர்பைத் துண்டிக்கவா?';

  @override
  String get staffroomDisconnectConfirmBody =>
      'நீங்கள் இனி இணைந்திருக்க மாட்டீர்கள் அல்லது ஒருவருக்கொருவர் செய்தி அனுப்ப முடியாது.';

  @override
  String get staffroomDisconnectCancel => 'இணைந்திருங்கள்';

  @override
  String get staffroomFollow => 'பின்தொடரவும்';

  @override
  String get staffroomFollowing => 'பின்தொடர்கிறீர்கள்';

  @override
  String get staffroomFollowFailed =>
      'புதுப்பிக்க முடியவில்லை. மீண்டும் முயல தட்டவும்.';

  @override
  String get actionShare => 'பகிர்';

  @override
  String get resultSaveToLibrary => 'நூலகத்தில் சேமி';

  @override
  String get resultSaving => 'சேமிக்கிறது';

  @override
  String get resultSaved => 'உங்கள் நூலகத்தில் சேமிக்கப்பட்டது';

  @override
  String get resultSaveFailedTitle => 'சேமிக்க முடியவில்லை';

  @override
  String get resultSaveFailedBody =>
      'இதை உங்கள் நூலகத்தில் சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get resultSaveRetry => 'மீண்டும் சேமிக்க முயற்சிக்கவும்';

  @override
  String get resultShareFailed =>
      'பகிர முடியவில்லை. அதற்குப் பதிலாக உரை கிளிப்போர்டுக்கு நகலெடுக்கப்பட்டது.';

  @override
  String get actionCancel => 'ரத்து செய்';

  @override
  String get attendanceTitle => 'வருகை';

  @override
  String get attendanceClassesEyebrow => 'உங்கள் வகுப்புகள்';

  @override
  String get attendanceClassesIntro =>
      'வருகைப் பதிவேட்டை நிரப்ப ஒரு வகுப்பைத் தேர்ந்தெடுங்கள்.';

  @override
  String get attendanceClassesEmptyTitle => 'இன்னும் வகுப்புகள் இல்லை';

  @override
  String get attendanceClassesEmptyBody =>
      'முதலில் உங்கள் வகுப்பை உருவாக்கி, பிறகு அதில் மாணவர்களைச் சேர்க்கவும்.';

  @override
  String get attendanceClassesError =>
      'உங்கள் வகுப்புகளை எங்களால் ஏற்ற முடியவில்லை.';

  @override
  String get attendanceClassFullBadge => 'நிரம்பியது';

  @override
  String get attendanceNewClass => 'புதிய வகுப்பு';

  @override
  String get attendanceOpenRegister => 'பதிவேடு நிரப்பு';

  @override
  String get attendanceOpenRoster => 'மாணவர்கள்';

  @override
  String get attendanceOpenMonth => 'இந்த மாதம்';

  @override
  String get attendanceSignedOutTitle =>
      'உங்கள் வகுப்புகளைப் பார்க்க உள்நுழையவும்';

  @override
  String get attendanceSignedOutBody =>
      'உங்கள் வகுப்புகளும் பதிவேடுகளும் உங்கள் கணக்கில் சேமிக்கப்படுகின்றன. உள்நுழைந்தால் அவை இங்கே தெரியும்.';

  @override
  String get attendanceClassNameLabel => 'வகுப்பின் பெயர்';

  @override
  String get attendanceClassNameHint => 'எடுத்துக்காட்டாக, வகுப்பு 6A';

  @override
  String get attendanceClassNameRequired => 'வகுப்பின் பெயரை உள்ளிடவும்.';

  @override
  String get attendanceSubjectLabel => 'பாடம்';

  @override
  String get attendanceGradeLabel => 'வகுப்பு நிலை';

  @override
  String get attendanceAcademicYearLabel => 'கல்வி ஆண்டு';

  @override
  String get attendanceAcademicYearHint => 'எடுத்துக்காட்டாக, 2026-27';

  @override
  String get attendanceAcademicYearRequired => 'கல்வி ஆண்டை உள்ளிடவும்.';

  @override
  String get attendanceSectionLabel => 'பிரிவு';

  @override
  String get attendanceSectionHint => 'எடுத்துக்காட்டாக, A';

  @override
  String get attendanceCreateClassSubmit => 'வகுப்பை உருவாக்கு';

  @override
  String get attendanceClassCreated => 'வகுப்பு உருவாக்கப்பட்டது.';

  @override
  String get attendanceCreateClassFailed =>
      'இந்த வகுப்பை எங்களால் உருவாக்க முடியவில்லை.';

  @override
  String get attendanceRosterEyebrow => 'வகுப்புப் பட்டியல்';

  @override
  String get attendanceRosterUnavailableTitle =>
      'பட்டியல் இன்னும் காட்டத் தயாராகவில்லை';

  @override
  String get attendanceRosterUnavailableBody =>
      'பெற்றோரின் தொடர்பு விவரங்கள் எங்கள் சேவையகங்களில் மறைக்கப்பட்ட வடிவத்திற்கு மாற்றப்படுகின்றன; அது நடைமுறைக்கு வரும் வரை இந்தச் செயலி அவற்றைப் பதிவிறக்காது. உங்கள் வகுப்பில் எந்தத் தவறும் இல்லை, எதுவும் தொலையவில்லை. பதிவேடு நிரப்புவதும் மாதக் காட்சியும் வழக்கம் போலவே செயல்படும்.';

  @override
  String get attendanceRosterEmptyTitle => 'இன்னும் மாணவர்கள் இல்லை';

  @override
  String get attendanceRosterEmptyBody =>
      'பதிவேடு நிரப்பத் தொடங்க இந்த வகுப்பின் மாணவர்களைச் சேர்க்கவும்.';

  @override
  String get attendanceRosterError =>
      'இந்தப் பட்டியலை எங்களால் ஏற்ற முடியவில்லை.';

  @override
  String attendanceRollLabel(int roll) {
    return 'வரிசை எண் $roll';
  }

  @override
  String get attendanceNoParentPhone => 'பெற்றோரின் எண் சேமிக்கப்படவில்லை';

  @override
  String attendanceParentPhoneMask(String last4) {
    return '•••• $last4';
  }

  @override
  String get attendanceAddStudent => 'மாணவரைச் சேர்';

  @override
  String get attendanceStudentNameLabel => 'மாணவரின் பெயர்';

  @override
  String get attendanceStudentNameRequired => 'மாணவரின் பெயரை உள்ளிடவும்.';

  @override
  String get attendanceRollNumberLabel => 'வரிசை எண்';

  @override
  String get attendanceRollNumberHint => '1 முதல் 40 வரை';

  @override
  String get attendanceRollNumberInvalid =>
      'வரிசை எண் 1 முதல் 40 வரையிலான முழு எண்ணாக இருக்க வேண்டும்.';

  @override
  String get attendanceParentPhoneLabel => 'பெற்றோரின் கைபேசி எண்';

  @override
  String get attendanceParentPhoneHint => '10 இலக்க இந்திய கைபேசி எண்';

  @override
  String get attendanceParentPhoneRequired =>
      'பெற்றோரின் கைபேசி எண்ணை உள்ளிடவும்.';

  @override
  String get attendanceParentPhoneInvalid =>
      '10 இலக்க இந்திய கைபேசி எண்ணை உள்ளிடவும்.';

  @override
  String get attendanceParentLanguageLabel => 'பெற்றோரின் மொழி';

  @override
  String get attendanceParentPhonePrivacy =>
      'இந்த எண் SahayakAI-க்கு அனுப்பப்படுகிறது, அதனால் உங்களுக்காக இந்தப் பெற்றோரை அழைக்க முடியும். இது எப்போதும் இந்தத் தொலைபேசிக்குத் திரும்பப் பதிவிறக்கப்படுவதில்லை.';

  @override
  String get attendanceStudentAdded => 'மாணவர் சேர்க்கப்பட்டார்.';

  @override
  String get attendanceAddStudentFailed =>
      'இந்த மாணவரை எங்களால் சேர்க்க முடியவில்லை.';

  @override
  String get attendanceClassFullTitle => 'இந்த வகுப்பு நிரம்பிவிட்டது';

  @override
  String attendanceClassFullBody(int max) {
    return 'ஒரு வகுப்பில் அதிகபட்சம் $max மாணவர்கள் இருக்கலாம், எனவே மேலும் சேர்க்க முடியாது.';
  }

  @override
  String get attendanceMarkEyebrow => 'தினசரி பதிவேடு';

  @override
  String get attendanceMarkIntro =>
      'இன்று, அல்லது அதற்கு முந்தைய ஏழு நாட்களில் ஏதேனும் ஒரு நாளை நிரப்புங்கள்.';

  @override
  String get attendanceDateToday => 'இன்று';

  @override
  String get attendanceDateYesterday => 'நேற்று';

  @override
  String get attendanceWindowNote =>
      'பதிவேடு இன்றைக்கும் அதற்கு முந்தைய ஏழு நாட்களுக்கும் திறந்திருக்கும். அதற்கும் பழைய நாட்கள் மூடப்படும்.';

  @override
  String get attendanceStatusPresent => 'வந்தார்';

  @override
  String get attendanceStatusAbsent => 'வரவில்லை';

  @override
  String get attendanceStatusLate => 'தாமதம்';

  @override
  String get attendanceStatusUnmarked => 'பதியப்படவில்லை';

  @override
  String attendanceMarkProgress(int marked, int total) {
    return '$total இல் $marked பேர் பதியப்பட்டனர்';
  }

  @override
  String get attendanceMarkAllPresent => 'அனைவரையும் வந்ததாகக் குறி';

  @override
  String get attendanceSaveRegister => 'பதிவேட்டைச் சேமி';

  @override
  String get attendanceRegisterSaved => 'பதிவேடு சேமிக்கப்பட்டது.';

  @override
  String get attendanceSaveRegisterFailed =>
      'இந்தப் பதிவேட்டை எங்களால் சேமிக்க முடியவில்லை.';

  @override
  String get attendanceRegisterError =>
      'இந்தப் பதிவேட்டை எங்களால் ஏற்ற முடியவில்லை.';

  @override
  String get attendanceNoStudentsTitle =>
      'இந்த வகுப்பில் இன்னும் மாணவர்கள் இல்லை';

  @override
  String get attendanceNoStudentsBody =>
      'பதிவேடு நிரப்பும் முன் மாணவரைச் சேர்க்கவும்.';

  @override
  String get attendanceMonthEyebrow => 'மாதாந்திர வருகை';

  @override
  String get attendanceMonthError => 'இந்த மாதத்தை எங்களால் ஏற்ற முடியவில்லை.';

  @override
  String get attendanceMonthEmptyTitle => 'இந்த மாதம் எதுவும் பதியப்படவில்லை';

  @override
  String get attendanceMonthEmptyBody =>
      'பதிவேடு நிரப்பத் தொடங்கியதும் ஒவ்வொரு மாணவரின் மாதமும் இங்கே தெரியும்.';

  @override
  String get attendanceMonthPrevious => 'முந்தைய மாதம்';

  @override
  String get attendanceMonthNext => 'அடுத்த மாதம்';

  @override
  String get attendanceAbsencesTitle => 'வராத நாட்கள்';

  @override
  String get attendanceAbsencesEmpty => 'இந்த மாதம் வராத நாட்கள் இல்லை.';

  @override
  String get attendanceAbsencesError =>
      'வராத நாட்களை எங்களால் ஏற்ற முடியவில்லை.';

  @override
  String get attendancePremiumTitle => 'பதிவேடு நிரப்ப Pro திட்டம் தேவை';

  @override
  String get attendancePremiumBody =>
      'உங்கள் வகுப்புகள், பதிவேடுகள், மாதக் கணக்குகளைப் பார்ப்பது இலவசமாகவே இருக்கும். வகுப்பை உருவாக்குவது, மாணவரைச் சேர்ப்பது, பதிவேட்டைச் சேமிப்பது Pro திட்டத்தின் பகுதி.';

  @override
  String get deliverTrayTitle => 'வழங்கு';

  @override
  String get deliverPrivacyNote =>
      'நீங்கள் அனுப்பு என்பதைத் தட்டும் வரை எதுவும் தொலைபேசியை விட்டு வெளியேறாது.';

  @override
  String get deliverSend => 'அனுப்பு';

  @override
  String get deliverParentGroup => 'பெற்றோர் குழு';

  @override
  String get deliverParentGroupMeta => 'WhatsApp இல் பகிரவும்';

  @override
  String get deliverPrint => 'அச்சிடு';

  @override
  String get deliverPrintMeta => 'அச்சுப்பொறிக்கு அனுப்பு';

  @override
  String get deliverSaveToClass => 'வகுப்பில் சேமி';

  @override
  String get deliverSaveToClassMeta => 'உங்கள் நூலகத்தில் வைக்கவும்';

  @override
  String get deliverPostCommunity => 'சமூகத்தில் இடுகையிடு';

  @override
  String get deliverPostCommunityMeta => 'வளமாகப் பகிரவும்';

  @override
  String get deliverDownloadPdf => 'PDF பதிவிறக்கு';

  @override
  String get deliverDownloadPdfMeta => 'ஆஃப்லைனில் இயங்கும்';

  @override
  String get deliverReadAloud => 'உரக்கப் படி';

  @override
  String get deliverReadAloudMeta => 'வகுப்பிற்கு';

  @override
  String get settingsOrbHandTitle => 'மிதக்கும் உதவியாளர்';

  @override
  String get settingsOrbHandLabel => 'இடதுபுறம்';

  @override
  String get settingsOrbHandHint =>
      'உங்கள் கட்டைவிரல் எட்டும் இடத்தில் VIDYA-வை வையுங்கள்';

  @override
  String get scanRemedialBody =>
      'சிரமப்பட்ட கருத்துகளுக்கு நான் ஒரு பயிற்சித் தாள் உருவாக்க முடியும்.';

  @override
  String get scanRemedialBuild => 'பயிற்சித் தாள் உருவாக்கு';

  @override
  String get scanRemedialMessageParents => 'பெற்றோருக்கு செய்தி அனுப்பு';

  @override
  String get communityFilterAll => 'அனைத்தும்';

  @override
  String get communityFilterPosts => 'இடுகைகள்';

  @override
  String get communityFilterResources => 'வளங்கள்';

  @override
  String get communityFilterHighlights => 'சிறப்பம்சங்கள்';

  @override
  String get attendanceVoiceRollCall => 'பெயர்களை உரக்கப் படியுங்கள்';

  @override
  String get attendanceVoiceListeningTitle => 'கேட்கிறேன்…';

  @override
  String get attendanceVoiceListeningBody =>
      'உங்கள் வகுப்பு வருகைப் பட்டியலை உரக்கப் படியுங்கள். ஒவ்வொரு பெயரையும் வந்ததாக நான் குறிப்பேன்; ஒன்றை மாற்ற \'வரவில்லை\' அல்லது \'தாமதம்\' எனச் சொல்லுங்கள்.';

  @override
  String get attendanceVoiceWorking => 'ஒரு கணம்…';

  @override
  String get attendanceVoiceWorkingBody =>
      'நீங்கள் சொன்னதிலிருந்து வருகையைக் குறிக்கிறேன்.';

  @override
  String get attendanceVoiceMicOffTitle => 'ஒலிவாங்கி தேவை';

  @override
  String get attendanceVoiceMicOffBody =>
      'குரலால் வருகை எடுக்க ஒலிவாங்கிக்கு அனுமதி அளிக்கவும்.';

  @override
  String get attendanceVoiceFailedTitle => 'புரியவில்லை';

  @override
  String get attendanceVoiceFailedBody =>
      'ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.';

  @override
  String get attendanceVoiceNone =>
      'எந்தப் பெயரும் புரியவில்லை. மீண்டும் முயற்சிக்கவும்.';

  @override
  String attendanceVoiceMarked(int count) {
    return '$count பெயர்கள் குறிக்கப்பட்டன.';
  }
}
