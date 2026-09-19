// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Telugu (`te`).
class AppLocalizationsTe extends AppLocalizations {
  AppLocalizationsTe([String locale = 'te']) : super(locale);

  @override
  String get appTitle => 'SahayakAI';

  @override
  String get navHome => 'హోమ్';

  @override
  String get navCreate => 'సృష్టించండి';

  @override
  String get navLibrary => 'గ్రంథాలయం';

  @override
  String get navProfile => 'ప్రొఫైల్';

  @override
  String get actionRetry => 'మళ్లీ ప్రయత్నించండి';

  @override
  String get actionSignIn => 'సైన్ ఇన్ చేయండి';

  @override
  String get actionSignOut => 'సైన్ అవుట్';

  @override
  String get actionGenerate => 'సృష్టించండి';

  @override
  String get stateOfflineTitle => 'మీరు ఆఫ్‌లైన్‌లో ఉన్నారు';

  @override
  String get stateOfflineBody =>
      'మీ కనెక్షన్‌ను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get errorGeneric => 'ఏదో తప్పు జరిగింది. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get emptyDefault => 'ఫారమ్‌ను పూరించి సృష్టించండి నొక్కండి.';

  @override
  String get languageLabel => 'భాష';

  @override
  String get splashTagline => 'ప్రతి తరగతికి బోధన సహాయకుడు';

  @override
  String get splashFailedTitle => 'యాప్‌ను ప్రారంభించలేకపోయాము';

  @override
  String get splashFailedBody =>
      'దయచేసి మీ కనెక్షన్‌ను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get loginTitle => 'SahayakAI కి స్వాగతం';

  @override
  String get loginSubtitle =>
      'పాఠ ప్రణాళికలు, క్విజ్‌లు మరియు మరిన్నింటి కోసం సైన్ ఇన్ చేయండి.';

  @override
  String get loginGoogle => 'Google తో కొనసాగించండి';

  @override
  String get loginPrivacyNote =>
      'మేము మీ Google ఖాతాను మిమ్మల్ని సైన్ ఇన్ చేయించడానికి మాత్రమే ఉపయోగిస్తాము. మీ పని మీదిగానే ఉంటుంది.';

  @override
  String get loginLanguagePrompt => 'మీ భాషను ఎంచుకోండి';

  @override
  String get loginLanguageHint =>
      'SahayakAI మీ భాషలో పనిచేస్తుంది, మరియు మీ బోధన సామగ్రిని కూడా అదే భాషలో రాస్తుంది.';

  @override
  String get loginValueLessons =>
      'నిమిషాల్లో పూర్తి పాఠ ప్రణాళికను రూపొందించండి';

  @override
  String get loginValueQuizzes => 'మూడు కష్టతర స్థాయిల్లో క్విజ్ తయారు చేయండి';

  @override
  String get loginValueAnswers =>
      'మీ భాషలో, తరగతి గదిలోని ఏ ప్రశ్నకైనా సమాధానం ఇవ్వండి';

  @override
  String get onboardingTitle => 'SahayakAI సెటప్ చేయండి';

  @override
  String get onboardingSkip => 'ఇప్పుడు వద్దు';

  @override
  String onboardingStepLabel(int current, int total) {
    return '$totalలో దశ $current';
  }

  @override
  String get onboardingBack => 'వెనుకకు';

  @override
  String get onboardingNext => 'తరువాత';

  @override
  String get onboardingSaveAndContinue => 'సేవ్ చేసి కొనసాగించండి';

  @override
  String get onboardingFinish => 'నా డాష్‌బోర్డ్‌కు వెళ్లండి';

  @override
  String get onboardingLanguageTitle => 'మీరు ఏ భాషలో బోధిస్తారు?';

  @override
  String get onboardingLanguageBody =>
      'మీరు ఎంచుకున్న భాషలోనే పాఠ ప్రణాళికలు, క్విజ్‌లు మరియు సమాధానాలు వస్తాయి. మీరు దీన్ని ఎప్పుడైనా మార్చుకోవచ్చు.';

  @override
  String get onboardingProfileTitle => 'మీ తరగతి గురించి మాకు చెప్పండి';

  @override
  String get onboardingProfileBody =>
      'ప్రతి ఫీల్డ్ ఐచ్ఛికం. మీరు పంచుకున్నది మీ సామగ్రిని మీ బోర్డు, తరగతులు మరియు రాష్ట్రానికి సరిపోయేలా చేయడానికి ఉపయోగించబడుతుంది.';

  @override
  String get onboardingReadyTitle => 'మీరు ప్రారంభించడానికి సిద్ధంగా ఉన్నారు';

  @override
  String get onboardingReadyBody =>
      'మీ పాఠ ప్రణాళికలు, క్విజ్‌లు మరియు సమాధానాలు దీనికి సరిపోతాయి. మీరు తర్వాత ఎప్పుడైనా మీ ప్రొఫైల్ నుండి దీన్ని మార్చుకోవచ్చు.';

  @override
  String get onboardingSaveFailed =>
      'మేము మీ ప్రొఫైల్‌ను సేవ్ చేయలేకపోయాము. మీరు ఇప్పుడు కొనసాగించవచ్చు, తర్వాత దీన్ని మీ ప్రొఫైల్ నుండి జోడించవచ్చు.';

  @override
  String get onboardingSaveSignIn =>
      'మీ ప్రొఫైల్‌ను సేవ్ చేయడానికి దయచేసి మళ్లీ సైన్ ఇన్ చేయండి. మీరు ఇప్పుడు కొనసాగించవచ్చు, తర్వాత దీన్ని జోడించవచ్చు.';

  @override
  String get dashboardGreeting => 'తిరిగి స్వాగతం';

  @override
  String dashboardGreetingNamed(String name) {
    return 'తిరిగి స్వాగతం, $name';
  }

  @override
  String get dashboardGreetingMorning => 'శుభోదయం';

  @override
  String get dashboardGreetingAfternoon => 'శుభ మధ్యాహ్నం';

  @override
  String get dashboardGreetingEvening => 'శుభ సాయంత్రం';

  @override
  String get actionOpen => 'తెరవండి';

  @override
  String get actionRegenerate => 'మళ్లీ రూపొందించు';

  @override
  String get actionCopy => 'కాపీ చేయి';

  @override
  String get copyConfirmation => 'క్లిప్‌బోర్డుకు కాపీ చేయబడింది';

  @override
  String get readAloudListen => 'వినండి';

  @override
  String get readAloudStop => 'ఆపండి';

  @override
  String get readAloudError =>
      'ఆడియోను ప్లే చేయలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String voiceResultReady(String tool) {
    return 'మీ $tool సిద్ధంగా ఉంది.';
  }

  @override
  String voiceResultReadyWithTopic(String tool, String topic) {
    return '$topic మీద మీ $tool సిద్ధంగా ఉంది.';
  }

  @override
  String get lessonPlanSectionLesson => 'పాఠం';

  @override
  String get lessonPlanSectionApproach => 'బోధనా విధానం';

  @override
  String get quizSectionQuiz => 'క్విజ్';

  @override
  String get sectionForYourClass => 'మీ తరగతి కోసం';

  @override
  String get instantAnswerResultTitle => 'సమాధానం';

  @override
  String get dashboardToolsTitle => 'మీ బోధన సాధనాలు';

  @override
  String get createPaletteSearchHint => 'సాధనాలను వెతకండి';

  @override
  String get createPaletteEmpty => 'మీ శోధనకు ఏ సాధనమూ సరిపోలలేదు';

  @override
  String get dashboardRecentTitle => 'ఇటీవలి పని';

  @override
  String get dashboardRecentEmpty =>
      'మీరు సృష్టించినవన్నీ ఇక్కడ సేవ్ అవుతాయి, మళ్లీ తెరవడానికి సిద్ధంగా.';

  @override
  String get dashboardRecentFailed =>
      'మీ ఇటీవలి పనిని తెరవలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get dashboardRecentSignedOut =>
      'మీ ఇటీవలి పనిని చూడటానికి సైన్ ఇన్ చేయండి.';

  @override
  String get dashboardUntitled => 'శీర్షిక లేదు';

  @override
  String get dashboardSetupTitle => 'మీ ప్రొఫైల్ సెటప్‌ను పూర్తి చేయండి';

  @override
  String get dashboardSetupBody =>
      'మీ పాఠశాల, మీ తరగతులను జోడించండి. అప్పుడు ప్రతి పాఠ ప్రణాళిక, క్విజ్ మీ తరగతికి సిద్ధంగా వస్తాయి.';

  @override
  String get dashboardSetupAction => 'నా ప్రొఫైల్‌ను సెటప్ చేయండి';

  @override
  String get dashboardSetupDismiss => 'ఇప్పుడు వద్దు';

  @override
  String get contentTypeLessonPlan => 'పాఠ ప్రణాళిక';

  @override
  String get contentTypeQuiz => 'క్విజ్';

  @override
  String get contentTypeWorksheet => 'వర్క్‌షీట్';

  @override
  String get contentTypeVisualAid => 'దృశ్య సహాయకం';

  @override
  String get contentTypeRubric => 'రూబ్రిక్';

  @override
  String get contentTypeMicroLesson => 'చిన్న పాఠం';

  @override
  String get contentTypeVirtualFieldTrip => 'వర్చువల్ ఫీల్డ్ ట్రిప్';

  @override
  String get contentTypeInstantAnswer => 'తక్షణ సమాధానం';

  @override
  String get contentTypeTeacherTraining => 'ఉపాధ్యాయ శిక్షణ';

  @override
  String get contentTypeExamPaper => 'ప్రశ్నపత్రం';

  @override
  String get contentTypeAssessment => 'మూల్యాంకనం';

  @override
  String get contentTypeAssessmentSubmission => 'స్కాన్ చేసిన మూల్యాంకనం';

  @override
  String get contentTypeUnknown => 'సేవ్ చేసిన పని';

  @override
  String get libraryTitle => 'నా గ్రంథాలయం';

  @override
  String get librarySectionSaved => 'సేవ్ చేసినవి';

  @override
  String get libraryEmpty =>
      'మీరు సేవ్ చేసిన పాఠ ప్రణాళికలు మరియు క్విజ్‌లు ఇక్కడ కనిపిస్తాయి.';

  @override
  String get libraryEmptyAction => 'పాఠ ప్రణాళికను సృష్టించండి';

  @override
  String get librarySignedOut =>
      'మీ సేవ్ చేసిన పనిని చూడటానికి సైన్ ఇన్ చేయండి.';

  @override
  String get libraryLoadFailed => 'మీ గ్రంథాలయాన్ని లోడ్ చేయలేకపోయాము.';

  @override
  String get libraryNewestOnly => 'మీ ఇటీవలి 20 అంశాలను చూపుతున్నాము.';

  @override
  String get libraryFilterAll => 'అన్నీ';

  @override
  String get libraryFilterEmpty => 'ఈ రకంలో మీరు సేవ్ చేసిన అంశాలు ఇంకా లేవు.';

  @override
  String get libraryDetailTitle => 'సేవ్ చేసిన అంశం';

  @override
  String libraryDetailSavedOn(String date) {
    return '$dateన సేవ్ చేయబడింది';
  }

  @override
  String get libraryDetailSignedOut =>
      'మీ సేవ్ చేసిన పనిని తెరవడానికి సైన్ ఇన్ చేయండి.';

  @override
  String get libraryDetailNotFound => 'ఈ అంశం ఇక మీ గ్రంథాలయంలో లేదు.';

  @override
  String get libraryDetailLoadFailed =>
      'ఈ సేవ్ చేసిన అంశాన్ని తెరవలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String libraryDetailReady(String type) {
    return 'మీరు సేవ్ చేసిన $type చూస్తున్నారు.';
  }

  @override
  String get profileTitle => 'ప్రొఫైల్';

  @override
  String get lessonPlanTitle => 'పాఠ ప్రణాళిక';

  @override
  String get lessonPlanSubtitle => 'పూర్తి 5E పాఠాన్ని ప్లాన్ చేయండి';

  @override
  String get lessonPlanEmpty =>
      'ఒక అంశాన్ని జోడించి, 5E పాఠ ప్రణాళిక కోసం సృష్టించండి నొక్కండి.';

  @override
  String get lessonPlanTopicLabel => 'అంశం';

  @override
  String get lessonPlanTopicHint => 'ఉదాహరణకు, కిరణజన్య సంయోగక్రియ';

  @override
  String get lessonPlanTopicError =>
      'దయచేసి ప్లాన్ చేయవలసిన అంశాన్ని నమోదు చేయండి.';

  @override
  String get lessonPlanGradeLabel => 'తరగతి స్థాయులు';

  @override
  String get lessonPlanSubjectLabel => 'విషయం';

  @override
  String get lessonPlanSubjectAny => 'ఏ విషయం అయినా';

  @override
  String get lessonPlanResourceLabel => 'తరగతి గది వనరులు';

  @override
  String get lessonPlanResourceLow => 'తక్కువ';

  @override
  String get lessonPlanResourceMedium => 'మధ్యస్థం';

  @override
  String get lessonPlanResourceHigh => 'ఎక్కువ';

  @override
  String get lessonPlanDifficultyLabel => 'కష్టతర స్థాయి';

  @override
  String get lessonPlanDifficultyRemedial => 'అదనపు సహాయం';

  @override
  String get lessonPlanDifficultyStandard => 'ప్రామాణికం';

  @override
  String get lessonPlanDifficultyAdvanced => 'ఉన్నతం';

  @override
  String get lessonPlanRuralLabel =>
      'స్థానిక, నిత్య జీవిత ఉదాహరణలను ఉపయోగించండి';

  @override
  String get lessonPlanRuralHint =>
      'కార్యకలాపాలను తెలిసిన గ్రామీణ, సామాజిక పరిసరాల్లో నిలిపండి.';

  @override
  String get lessonPlanOptional => 'ఐచ్ఛికం';

  @override
  String get lessonPlanObjectives => 'అభ్యసన లక్ష్యాలు';

  @override
  String get lessonPlanVocabulary => 'ముఖ్య పదజాలం';

  @override
  String get lessonPlanMaterials => 'సామగ్రి';

  @override
  String get lessonPlanActivities => '5E కార్యకలాపాలు';

  @override
  String get lessonPlanAssessment => 'మూల్యాంకనం';

  @override
  String get lessonPlanHomework => 'ఇంటి పని';

  @override
  String get lessonPlanTeacherTip => 'ఉపాధ్యాయుల సూచన';

  @override
  String get lessonPlanUnderstandingCheck => 'అవగాహనను తనిఖీ చేయండి';

  @override
  String get lessonPlanNoteLabel => 'ప్రారంభించే ముందు ఒక గమనిక';

  @override
  String get lessonPlanUpgradeTitle => 'ఉన్నత ప్లాన్ అవసరం';

  @override
  String get lessonPlanUpgradeBody =>
      'పాఠ ప్రణాళిక ఉన్నత ప్లాన్‌లో భాగం. ప్రణాళికలు సృష్టిస్తూ ఉండటానికి దయచేసి అప్‌గ్రేడ్ చేయండి.';

  @override
  String get lessonPlanLimitTitle => 'మీరు మీ పరిమితిని చేరుకున్నారు';

  @override
  String get lessonPlanLimitBody =>
      'ఇప్పటికి మీ పాఠ ప్రణాళికలను ఉపయోగించారు. దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి లేదా మీ ప్లాన్‌ను అప్‌గ్రేడ్ చేయండి.';

  @override
  String get lessonPlanSeePricing => 'ప్లాన్‌లు మరియు ధరలను చూడండి';

  @override
  String get lessonPlanRephrase =>
      'దాని నుండి ప్రణాళికను రూపొందించలేకపోయాము. దయచేసి అంశాన్ని మళ్లీ రాసి ప్రయత్నించండి.';

  @override
  String get lessonPlanBusy =>
      'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి కొద్దిసేపటిలో మళ్లీ ప్రయత్నించండి.';

  @override
  String get lessonPlanTimeout =>
      'ఇది ఊహించిన దానికంటే ఎక్కువ సమయం తీసుకుంటోంది. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get lessonPlanSignIn =>
      'ఈ సాధనాన్ని ఉపయోగించడానికి దయచేసి మళ్లీ సైన్ ఇన్ చేయండి.';

  @override
  String get quizTitle => 'క్విజ్';

  @override
  String get quizSubtitle => 'మూడు కష్టతర స్థాయిల్లో క్విజ్ తయారు చేయండి';

  @override
  String get quizEmpty =>
      'ఒక అంశాన్ని జోడించి, క్విజ్ కోసం సృష్టించండి నొక్కండి.';

  @override
  String get quizTopicLabel => 'అంశం';

  @override
  String get quizTopicHint => 'ఉదాహరణకు, భిన్నాలు';

  @override
  String get quizTopicError => 'దయచేసి క్విజ్ కోసం ఒక అంశాన్ని నమోదు చేయండి.';

  @override
  String get quizNumQuestionsLabel => 'ప్రశ్నల సంఖ్య';

  @override
  String get quizFewerQuestions => 'తక్కువ ప్రశ్నలు';

  @override
  String get quizMoreQuestions => 'ఎక్కువ ప్రశ్నలు';

  @override
  String get quizTypesLabel => 'ప్రశ్నల రకాలు';

  @override
  String get quizTypesError => 'దయచేసి కనీసం ఒక ప్రశ్న రకాన్ని ఎంచుకోండి.';

  @override
  String get quizTypeMultipleChoice => 'బహుళైచ్ఛికం';

  @override
  String get quizTypeFillInTheBlanks => 'ఖాళీలను పూరించండి';

  @override
  String get quizTypeShortAnswer => 'లఘు సమాధానం';

  @override
  String get quizTypeTrueFalse => 'సరి లేదా తప్పు';

  @override
  String get quizGradeLabel => 'తరగతి స్థాయి';

  @override
  String get quizGradeAny => 'ఏ తరగతి అయినా';

  @override
  String get quizSubjectLabel => 'విషయం';

  @override
  String get quizSubjectAny => 'ఏ విషయం అయినా';

  @override
  String get quizDifficultyLabel => 'కష్టతర స్థాయి';

  @override
  String get quizDifficultyHint =>
      'సులభం, మధ్యస్థం, కఠినం అనే మూడు రూపాలు రావాలంటే దీన్ని అన్ని స్థాయుల మీద ఉంచండి.';

  @override
  String get quizDifficultyAll => 'అన్ని స్థాయులు';

  @override
  String get quizDifficultyEasy => 'సులభం';

  @override
  String get quizDifficultyMedium => 'మధ్యస్థం';

  @override
  String get quizDifficultyHard => 'కఠినం';

  @override
  String get quizBloomsLabel => 'ఆలోచనా నైపుణ్యాలు';

  @override
  String get quizBloomsHint => 'ప్రశ్నలు ఏ రకమైన ఆలోచనను కోరాలో ఎంచుకోండి.';

  @override
  String get quizOptional => 'ఐచ్ఛికం';

  @override
  String quizQuestionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ప్రశ్నలు',
      one: '1 ప్రశ్న',
    );
    return '$_temp0';
  }

  @override
  String get quizShowAnswer => 'సమాధానం చూపించు';

  @override
  String get quizHideAnswer => 'సమాధానం దాచు';

  @override
  String get quizShowAllAnswers => 'అన్ని సమాధానాలు చూపించు';

  @override
  String get quizHideAllAnswers => 'అన్ని సమాధానాలు దాచు';

  @override
  String get quizCorrectAnswer => 'సరైన సమాధానం';

  @override
  String get quizExplanation => 'ఎందుకు';

  @override
  String get quizTeacherInstructions => 'తరగతిలో దీన్ని ఎలా నిర్వహించాలి';

  @override
  String get quizNoteLabel => 'ప్రారంభించే ముందు ఒక గమనిక';

  @override
  String get quizNoQuestions =>
      'ఆ అంశానికి ఏ ప్రశ్నలూ రాలేదు. దయచేసి వేరే అంశాన్ని ప్రయత్నించండి.';

  @override
  String get quizUpgradeTitle => 'ఉన్నత ప్లాన్ అవసరం';

  @override
  String get quizUpgradeBody =>
      'క్విజ్ సృష్టి ఉన్నత ప్లాన్‌లో భాగం. క్విజ్‌లు తయారు చేస్తూ ఉండటానికి దయచేసి అప్‌గ్రేడ్ చేయండి.';

  @override
  String get quizLimitTitle => 'మీరు మీ పరిమితిని చేరుకున్నారు';

  @override
  String get quizLimitBody =>
      'ఇప్పటికి మీ క్విజ్‌లను ఉపయోగించారు. దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి లేదా మీ ప్లాన్‌ను అప్‌గ్రేడ్ చేయండి.';

  @override
  String get quizSeePricing => 'ప్లాన్‌లు మరియు ధరలను చూడండి';

  @override
  String get quizRephrase =>
      'దాని నుండి క్విజ్ తయారు చేయలేకపోయాము. దయచేసి అంశాన్ని మళ్లీ రాసి ప్రయత్నించండి.';

  @override
  String get quizBusy =>
      'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి కొద్దిసేపటిలో మళ్లీ ప్రయత్నించండి.';

  @override
  String get quizTimeout =>
      'ఇది ఊహించిన దానికంటే ఎక్కువ సమయం తీసుకుంటోంది. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get quizSignIn =>
      'ఈ సాధనాన్ని ఉపయోగించడానికి దయచేసి మళ్లీ సైన్ ఇన్ చేయండి.';

  @override
  String get instantAnswerTitle => 'తక్షణ సమాధానం';

  @override
  String get instantAnswerSubtitle => 'తరగతి గదిలోని ఏ ప్రశ్నను అయినా అడగండి';

  @override
  String get instantAnswerAction => 'సమాధానం పొందండి';

  @override
  String get instantAnswerEmpty => 'ఒక ప్రశ్న అడిగి సమాధానం పొందండి నొక్కండి.';

  @override
  String get instantAnswerQuestionLabel => 'మీ ప్రశ్న';

  @override
  String get instantAnswerQuestionHint =>
      'ఉదాహరణకు, చంద్రుని ఆకారం ఎందుకు మారుతుంది?';

  @override
  String get instantAnswerQuestionError => 'దయచేసి ఒక ప్రశ్నను నమోదు చేయండి.';

  @override
  String get instantAnswerGradeLabel => 'తరగతి స్థాయి';

  @override
  String get instantAnswerGradeAny => 'ఏ తరగతి అయినా';

  @override
  String get instantAnswerSubjectLabel => 'విషయం';

  @override
  String get instantAnswerSubjectAny => 'ఏ విషయం అయినా';

  @override
  String get instantAnswerOptional => 'ఐచ్ఛికం';

  @override
  String get instantAnswerVideoTitle => 'సంబంధిత వీడియోను చూడండి';

  @override
  String get instantAnswerVideoBody =>
      'యాప్ వెలుపల, మీ బ్రౌజర్‌లో తెరుచుకుంటుంది.';

  @override
  String get instantAnswerNoAnswer =>
      'ఆ ప్రశ్నకు సమాధానం రాలేదు. దయచేసి దాన్ని మళ్లీ రాసి ప్రయత్నించండి.';

  @override
  String get instantAnswerSeePricing => 'ప్లాన్‌లు మరియు ధరలను చూడండి';

  @override
  String get instantAnswerDailyLimitTitle =>
      'ఈరోజుకు మీ ప్రశ్నలన్నీ పూర్తయ్యాయి';

  @override
  String get instantAnswerDailyLimitBody =>
      'మీ ప్లాన్‌లో ప్రతిరోజూ నిర్దిష్ట సంఖ్యలో తక్షణ సమాధానాలు ఉంటాయి. మీ ప్రశ్నలు రేపు మళ్లీ అందుబాటులో ఉంటాయి, లేదా ఉన్నత ప్లాన్‌లో రోజువారీ పరిమితిని పెంచుకోవచ్చు.';

  @override
  String get instantAnswerLimitTitle => 'మీరు మీ పరిమితిని చేరుకున్నారు';

  @override
  String get instantAnswerLimitBody =>
      'ఈ నెలకు మీ తక్షణ సమాధానాలను ఉపయోగించారు. మీ ప్రశ్నలు వచ్చే నెలలో మళ్లీ అందుబాటులో ఉంటాయి, లేదా ఉన్నత ప్లాన్‌లో పరిమితిని పెంచుకోవచ్చు.';

  @override
  String get instantAnswerUpgradeTitle => 'ఉన్నత ప్లాన్ అవసరం';

  @override
  String get instantAnswerUpgradeBody =>
      'తక్షణ సమాధానాలు ఉన్నత ప్లాన్‌లో భాగం. ప్రశ్నలు అడుగుతూ ఉండటానికి దయచేసి అప్‌గ్రేడ్ చేయండి.';

  @override
  String get instantAnswerRephrase =>
      'దానికి సమాధానం ఇవ్వలేకపోయాము. దయచేసి ప్రశ్నను మళ్లీ రాసి ప్రయత్నించండి.';

  @override
  String get instantAnswerBusy =>
      'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి కొద్దిసేపటిలో మళ్లీ ప్రయత్నించండి.';

  @override
  String instantAnswerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి సుమారు $seconds సెకన్లలో మళ్లీ ప్రయత్నించండి.',
      one:
          'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి సుమారు 1 సెకనులో మళ్లీ ప్రయత్నించండి.',
    );
    return '$_temp0';
  }

  @override
  String get instantAnswerTimeout =>
      'ఇది ఊహించిన దానికంటే ఎక్కువ సమయం తీసుకుంటోంది. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get instantAnswerSignIn =>
      'ఈ సాధనాన్ని ఉపయోగించడానికి దయచేసి మళ్లీ సైన్ ఇన్ చేయండి.';

  @override
  String get settingsTitle => 'సెట్టింగ్‌లు';

  @override
  String get settingsAppearanceTitle => 'రూపం';

  @override
  String get settingsThemeSystem => 'నా పరికరం ప్రకారం';

  @override
  String get settingsThemeLight => 'లైట్';

  @override
  String get settingsThemeDark => 'డార్క్';

  @override
  String get settingsLanguageHint =>
      'యాప్ భాషను, మీ బోధన సామగ్రి రాయబడే భాషను ఇది నిర్ణయిస్తుంది.';

  @override
  String get settingsNotificationsTitle => 'నోటిఫికేషన్‌లు';

  @override
  String get settingsNotificationsLabel => 'రిమైండర్‌లు మరియు అప్‌డేట్‌లు';

  @override
  String get settingsNotificationsHint =>
      'కొత్త బోధన సాధనాలు, మీ సేవ్ చేసిన పని గురించి తెలుసుకోండి.';

  @override
  String get settingsVoiceModeTitle => 'వాయిస్ మోడ్';

  @override
  String get settingsVoiceModeLabel => 'లైవ్ వాయిస్ (బీటా)';

  @override
  String get settingsVoiceModeHint =>
      'VIDYA తో నిజ సమయంలో మాట్లాడండి. ఇది ఆఫ్‌లో ఉంటే, VIDYA మీరు చెప్పింది విని, ఒక్కో వంతుకు ఒకసారి బదులిస్తుంది.';

  @override
  String get settingsProfileTitle => 'బోధన ప్రొఫైల్';

  @override
  String get settingsProfileHint =>
      'మీ సామగ్రిని మీ బోర్డు, తరగతి గదికి సరిపోయేలా చేయడానికి ఇది సహాయపడుతుంది.';

  @override
  String get settingsBoardLabel => 'విద్యా బోర్డు';

  @override
  String get settingsBoardNone => 'సెట్ చేయలేదు';

  @override
  String get settingsQualificationsLabel => 'అర్హతలు';

  @override
  String get settingsQualificationsHint => 'మీకు ఉన్న ప్రతి అర్హతను ఎంచుకోండి.';

  @override
  String get settingsAdminRoleLabel => 'పరిపాలనా పాత్ర';

  @override
  String get settingsAdminRoleNone => 'సెట్ చేయలేదు';

  @override
  String get settingsRoleHod => 'విభాగాధిపతి (HoD)';

  @override
  String get settingsRoleCoordinator => 'అకడమిక్ కోఆర్డినేటర్';

  @override
  String get settingsRoleExamController => 'పరీక్షల నియంత్రణాధికారి';

  @override
  String get settingsRoleVicePrincipal => 'వైస్ ప్రిన్సిపాల్';

  @override
  String get settingsRolePrincipal => 'ప్రిన్సిపాల్';

  @override
  String get settingsRoleNone => 'ఉపాధ్యాయుడు, పరిపాలనా పాత్ర లేదు';

  @override
  String get settingsSaveProfile => 'ప్రొఫైల్‌ను సేవ్ చేయండి';

  @override
  String get settingsProfileSaved => 'మీ బోధన ప్రొఫైల్ సేవ్ చేయబడింది.';

  @override
  String get settingsSaveFailed =>
      'మేము మీ ప్రొఫైల్‌ను సేవ్ చేయలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get settingsSignedOutTitle => 'మీరు సైన్ అవుట్ అయ్యారు';

  @override
  String get settingsSignedOutBody =>
      'మీ బోధన ప్రొఫైల్‌ను, మీ ఖాతాను నిర్వహించడానికి సైన్ ఇన్ చేయండి. ఎలాగైనా మీ భాష, రూపం ఎంపికలు ఈ పరికరంలో సేవ్ అవుతాయి.';

  @override
  String get settingsSignIn => 'సైన్ ఇన్ చేయండి';

  @override
  String get settingsDangerTitle => 'ఖాతాను తొలగించండి';

  @override
  String get settingsDangerBody =>
      'ఇది మీ ఖాతాను మూసివేసి, మీ సేవ్ చేసిన పనిని తీసివేస్తుంది. శాశ్వతంగా తొలగించే ముందు అన్నింటినీ ఎగుమతి చేయడానికి మీకు 30 రోజులు ఉంటాయి.';

  @override
  String get settingsDeleteAction => 'ఖాతాను తొలగించండి';

  @override
  String get settingsDeleteDialogTitle => 'మీ ఖాతాను తొలగించాలా?';

  @override
  String get settingsDeleteDialogBody =>
      'మీ పాఠ ప్రణాళికలు, క్విజ్‌లు, ప్రొఫైల్ తొలగింపుకు షెడ్యూల్ చేయబడతాయి. అవి తీసివేయబడే ముందు మీ పనిని ఎగుమతి చేయడానికి మీకు 30 రోజులు ఉంటాయి.';

  @override
  String settingsDeleteConfirmPrompt(String word) {
    return 'నిర్ధారించడానికి కింద $word అని టైప్ చేయండి.';
  }

  @override
  String get settingsDeleteConfirmLabel => 'నిర్ధారణ';

  @override
  String get settingsDeleteCancel => 'నా ఖాతాను ఉంచండి';

  @override
  String get settingsDeleteConfirm => 'ఖాతాను తొలగించండి';

  @override
  String get settingsDeleteScheduled =>
      'మీ ఖాతా తొలగింపుకు షెడ్యూల్ చేయబడింది. మీ పనిని ఎగుమతి చేయడానికి మీకు 30 రోజులు ఉంటాయి.';

  @override
  String get settingsDeleteSuccessTitle => 'ఖాతా తొలగింపుకు షెడ్యూల్ చేయబడింది';

  @override
  String get settingsExportDataAction => 'నా డేటాను ఎగుమతి చేయండి';

  @override
  String get settingsExportQueuedMessage =>
      'మీ ఎగుమతి వెంటనే సిద్ధం చేయడానికి చాలా పెద్దది, కాబట్టి దాన్ని క్యూలో ఉంచాము. దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి, లేదా మీ డేటా కాపీ కోసం సపోర్ట్‌ను సంప్రదించండి.';

  @override
  String get settingsExportFailedMessage =>
      'మీ ఎగుమతిని సిద్ధం చేయలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get settingsDeleteSuccessDone => 'పూర్తయింది';

  @override
  String get settingsDeleteFailed =>
      'మేము మీ ఖాతాను తొలగించలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get settingsReauthTitle => 'దయచేసి మళ్లీ సైన్ ఇన్ చేయండి';

  @override
  String get settingsReauthBody =>
      'మీ భద్రత కోసం, ఖాతాను తొలగించడానికి కొత్తగా సైన్ ఇన్ చేయాల్సి ఉంటుంది. దయచేసి సైన్ అవుట్ చేసి, మళ్లీ సైన్ ఇన్ చేసి, ఐదు నిమిషాల్లో తొలగించండి.';

  @override
  String get profilePlanLabel => 'ప్లాన్';

  @override
  String get profilePlanFree => 'ఉచితం';

  @override
  String get profilePlanPro => 'ప్రో';

  @override
  String get profilePlanGold => 'గోల్డ్';

  @override
  String get profilePlanPremium => 'ప్రీమియం';

  @override
  String get profilePlanUnknown => 'అందుబాటులో లేదు';

  @override
  String get profileNoName => 'మీ ప్రొఫైల్';

  @override
  String get profileSectionAbout => 'మీ గురించి';

  @override
  String get profileSectionTeaching => 'మీరు ఏమి బోధిస్తారు';

  @override
  String get profileSectionLocation => 'మీరు ఎక్కడ బోధిస్తారు';

  @override
  String get profileSectionContact => 'మేము మిమ్మల్ని ఎలా సంప్రదించాలి';

  @override
  String get profileNameLabel => 'మీ పేరు';

  @override
  String get profileNameHint =>
      'మీరు షేర్ చేసే పనిపై ఇతర ఉపాధ్యాయులు చూసే పేరు ఇది.';

  @override
  String get profileNameInvalid => 'దయచేసి చిన్న పేరును ఉపయోగించండి.';

  @override
  String get profileSchoolLabel => 'పాఠశాల పేరు';

  @override
  String get profileBoardCategoryLabel => 'బోర్డు రకం';

  @override
  String get profileBoardCategoryHint =>
      'కింద ఉన్న జాబితాను తగ్గించడానికి బోర్డు రకాన్ని ఎంచుకోండి.';

  @override
  String get profileBoardCategoryState => 'రాష్ట్ర బోర్డు';

  @override
  String get profileStateLabel => 'రాష్ట్రం';

  @override
  String get profileStateNone => 'సెట్ చేయలేదు';

  @override
  String get profileDistrictLabel => 'జిల్లా';

  @override
  String get profileDistrictHint => 'మీ పాఠశాల ఉన్న జిల్లా.';

  @override
  String get profileSubjectsLabel => 'మీరు బోధించే విషయాలు';

  @override
  String get profileSubjectsHint => 'మీకు అవసరమైనన్ని ఎంచుకోండి.';

  @override
  String get profileGradesLabel => 'మీరు బోధించే తరగతులు';

  @override
  String get profileGradesHint => 'మీకు అవసరమైనన్ని ఎంచుకోండి.';

  @override
  String get profileLanguageHint =>
      'ఇది యాప్ మొత్తానికి ఒకటే భాషా ఎంపిక, కాబట్టి ఇక్కడ మార్చితే అంతటా మారుతుంది.';

  @override
  String get profilePhoneLabel => 'మొబైల్ నంబర్';

  @override
  String get profilePhoneHint => 'ఐచ్ఛికం. +91తో లేదా లేకుండా, పది అంకెలు.';

  @override
  String get profilePhoneInvalid =>
      'దయచేసి పది అంకెల భారతీయ మొబైల్ నంబర్‌ను నమోదు చేయండి.';

  @override
  String get profilePincodeLabel => 'పిన్ కోడ్';

  @override
  String get profilePincodeHint => 'ఐచ్ఛికం. ఆరు అంకెలు.';

  @override
  String get profilePincodeInvalid =>
      'దయచేసి ఆరు అంకెల పిన్ కోడ్‌ను నమోదు చేయండి.';

  @override
  String get profileEmptyTitle => 'మీ ప్రొఫైల్ ఖాళీగా ఉంది';

  @override
  String get profileEmptyBody =>
      'మీ పాఠశాల, మీ తరగతులను జోడించండి. అప్పుడు మీరు సృష్టించే ప్రతి పాఠ ప్రణాళిక, క్విజ్ మీ తరగతికి సిద్ధంగా వస్తాయి.';

  @override
  String get profileLoadFailed =>
      'మేము మీ ప్రొఫైల్‌ను తెరవలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get profileSignedOutTitle => 'మీరు సైన్ అవుట్ అయ్యారు';

  @override
  String get profileSignedOutBody =>
      'మీ బోధన ప్రొఫైల్‌ను చూడటానికి, సవరించడానికి సైన్ ఇన్ చేయండి.';

  @override
  String get profileSaveSignIn =>
      'మీ ప్రొఫైల్‌ను సేవ్ చేయడానికి దయచేసి మళ్లీ సైన్ ఇన్ చేయండి.';

  @override
  String get meTitle => 'ప్రొఫైల్';

  @override
  String get mePlanUsageTitle => 'ప్లాన్ & వినియోగం';

  @override
  String get mePlanUsageSubtitle => 'ఈ నెలలో మీరు ఎంత ఉపయోగించారు.';

  @override
  String meUsageValue(int used, int limit) {
    return '$used / $limit';
  }

  @override
  String get meUsageUnlimited => 'అపరిమితం';

  @override
  String get meUsageUnavailable =>
      'మీ వినియోగాన్ని లోడ్ చేయలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get meDefaultsTitle => 'డిఫాల్ట్‌లు';

  @override
  String get mePrivacyTitle => 'గోప్యత & సెట్టింగ్‌లు';

  @override
  String get meRoleTeacher => 'ఉపాధ్యాయుడు';

  @override
  String get usageFeatureAvatar => 'AI అవతారాలు';

  @override
  String get usageFeatureVoiceToText => 'వాయిస్ నుండి టెక్స్ట్';

  @override
  String get usageFeatureAssistant => 'VIDYA సహాయకుడు';

  @override
  String get imageInputHint => 'పాఠ్యపుస్తక పేజీ స్పష్టమైన ఫోటోను జోడించండి.';

  @override
  String get imageInputTakePhoto => 'ఫోటో తీయండి';

  @override
  String get imageInputChooseGallery => 'గ్యాలరీ నుండి ఎంచుకోండి';

  @override
  String get imageInputRetake => 'మళ్లీ ఫోటో తీయండి';

  @override
  String get imageInputChangeGallery => 'వేరొకటి ఎంచుకోండి';

  @override
  String get imageInputRemove => 'ఫోటోను తీసివేయండి';

  @override
  String get imageInputPreviewLabel => 'ఎంచుకున్న చిత్రం ప్రివ్యూ';

  @override
  String imageInputSizeOfMax(String used, String max) {
    return '$maxలో $used';
  }

  @override
  String imageInputTooLarge(String max) {
    return 'ఈ ఫోటో చాలా పెద్దది. దయచేసి $max కంటే తక్కువ ఉన్నదాన్ని ఎంచుకోండి.';
  }

  @override
  String get imageInputPermissionDenied =>
      'మీ కెమెరా లేదా ఫోటోలను ఉపయోగించడానికి SahayakAI కి అనుమతి కావాలి. దయచేసి మీ పరికర సెట్టింగ్‌లలో అనుమతి ఇవ్వండి.';

  @override
  String get imageInputFailed =>
      'ఆ చిత్రాన్ని తెరవలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get worksheetTitle => 'వర్క్‌షీట్';

  @override
  String get worksheetSubtitle =>
      'పాఠ్యపుస్తక ఫోటో నుండి వర్క్‌షీట్ తయారు చేయండి';

  @override
  String get worksheetEmpty =>
      'పాఠ్యపుస్తక ఫోటో, ఒక సూచనను జోడించి సృష్టించండి నొక్కండి.';

  @override
  String get worksheetImageLabel => 'పాఠ్యపుస్తక పేజీ ఫోటో';

  @override
  String get worksheetImageHint => 'ఈ పేజీ నుండి వర్క్‌షీట్ తయారవుతుంది.';

  @override
  String get toolImageOptionalLabel => 'పాఠ్యపుస్తక పేజీ ఫోటో (ఐచ్ఛికం)';

  @override
  String get toolImageOptionalHint =>
      'పేజీ ఫోటోను జోడిస్తే అదే ప్రధాన మూలం అవుతుంది, లేదా ఖాళీగా వదలండి.';

  @override
  String get worksheetImageError => 'దయచేసి పాఠ్యపుస్తక పేజీ ఫోటోను జోడించండి.';

  @override
  String get worksheetPromptLabel => 'మీకు ఎలాంటి వర్క్‌షీట్ కావాలి?';

  @override
  String get worksheetPromptHint =>
      'ఉదాహరణకు, ఈ పేజీ నుండి గుణకార వర్క్‌షీట్ తయారు చేయండి';

  @override
  String get worksheetPromptError =>
      'దయచేసి మీకు కావలసిన వర్క్‌షీట్‌ను వివరించండి.';

  @override
  String get worksheetGradeLabel => 'తరగతి స్థాయి';

  @override
  String get worksheetGradeAny => 'ఏ తరగతి అయినా';

  @override
  String get worksheetSubjectLabel => 'విషయం';

  @override
  String get worksheetSubjectAny => 'ఏ విషయం అయినా';

  @override
  String get worksheetOptional => 'ఐచ్ఛికం';

  @override
  String get worksheetObjectives => 'అభ్యసన లక్ష్యాలు';

  @override
  String get worksheetInstructions => 'విద్యార్థులకు సూచనలు';

  @override
  String get worksheetActivities => 'కార్యకలాపాలు';

  @override
  String get worksheetActivityQuestion => 'ప్రశ్న';

  @override
  String get worksheetActivityPuzzle => 'పజిల్';

  @override
  String get worksheetActivityCreativeTask => 'సృజనాత్మక పని';

  @override
  String get worksheetExplanation => 'ఉపాధ్యాయుల కోసం';

  @override
  String get worksheetChalkboardNote => 'బ్లాక్‌బోర్డుపై';

  @override
  String get worksheetAnswerKey => 'సమాధాన కీ';

  @override
  String get worksheetNoContent =>
      'ఆ పేజీ కోసం వర్క్‌షీట్ రాలేదు. దయచేసి స్పష్టమైన ఫోటో లేదా వేరే సూచనను ప్రయత్నించండి.';

  @override
  String get worksheetSave => 'గ్రంథాలయంలో సేవ్ చేయండి';

  @override
  String get worksheetSaving => 'సేవ్ అవుతోంది';

  @override
  String get worksheetSaved => 'మీ గ్రంథాలయంలో సేవ్ చేయబడింది';

  @override
  String get worksheetSaveFailedTitle => 'సేవ్ చేయలేకపోయాము';

  @override
  String get worksheetSaveFailedBody =>
      'ఈ వర్క్‌షీట్‌ను మీ గ్రంథాలయంలో సేవ్ చేయలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get worksheetSaveRetry => 'మళ్లీ సేవ్ చేయడానికి ప్రయత్నించండి';

  @override
  String get worksheetUpgradeTitle => 'ఉన్నత ప్లాన్ అవసరం';

  @override
  String get worksheetUpgradeBody =>
      'వర్క్‌షీట్ సృష్టి ఉన్నత ప్లాన్‌లో భాగం. వర్క్‌షీట్‌లు తయారు చేస్తూ ఉండటానికి దయచేసి అప్‌గ్రేడ్ చేయండి.';

  @override
  String get worksheetLimitTitle => 'మీరు మీ పరిమితిని చేరుకున్నారు';

  @override
  String get worksheetLimitBody =>
      'ఇప్పటికి మీ వర్క్‌షీట్‌లను ఉపయోగించారు. దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి లేదా మీ ప్లాన్‌ను అప్‌గ్రేడ్ చేయండి.';

  @override
  String get worksheetSeePricing => 'ప్లాన్‌లు మరియు ధరలను చూడండి';

  @override
  String get worksheetRephrase =>
      'దాని నుండి వర్క్‌షీట్ తయారు చేయలేకపోయాము. దయచేసి స్పష్టమైన ఫోటోను ప్రయత్నించండి లేదా మీ సూచనను మళ్లీ రాయండి.';

  @override
  String get worksheetBusy =>
      'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి కొద్దిసేపటిలో మళ్లీ ప్రయత్నించండి.';

  @override
  String get worksheetTimeout =>
      'ఇది ఊహించిన దానికంటే ఎక్కువ సమయం తీసుకుంటోంది. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get worksheetSignIn =>
      'ఈ సాధనాన్ని ఉపయోగించడానికి దయచేసి మళ్లీ సైన్ ఇన్ చేయండి.';

  @override
  String get rubricTitle => 'రూబ్రిక్';

  @override
  String get rubricSubtitle =>
      'అసైన్‌మెంట్ కోసం మూల్యాంకన రూబ్రిక్ తయారు చేయండి';

  @override
  String get rubricEmpty => 'అసైన్‌మెంట్‌ను వివరించి సృష్టించండి నొక్కండి.';

  @override
  String get rubricAssignmentLabel => 'అసైన్‌మెంట్ ఏమిటి?';

  @override
  String get rubricAssignmentHint =>
      'ఈ అసైన్‌మెంట్‌ను రూబ్రిక్ మూల్యాంకనం చేస్తుంది.';

  @override
  String get rubricAssignmentPlaceholder =>
      'ఉదాహరణకు, పునరుత్పాదక ఇంధనంపై 5వ తరగతి ప్రాజెక్ట్';

  @override
  String get rubricAssignmentError => 'దయచేసి అసైన్‌మెంట్‌ను వివరించండి.';

  @override
  String get rubricGradeLabel => 'తరగతి స్థాయి';

  @override
  String get rubricGradeAny => 'ఏ తరగతి అయినా';

  @override
  String get rubricSubjectLabel => 'విషయం';

  @override
  String get rubricSubjectAny => 'ఏ విషయం అయినా';

  @override
  String get rubricOptional => 'ఐచ్ఛికం';

  @override
  String get rubricCriteriaColumn => 'ప్రమాణాలు';

  @override
  String rubricPoints(String points) {
    return '$points పాయింట్లు';
  }

  @override
  String get rubricScrollHint =>
      'అన్ని స్థాయులను చూడటానికి పక్కకు స్వైప్ చేయండి.';

  @override
  String get rubricNoContent =>
      'దాని కోసం రూబ్రిక్ రాలేదు. దయచేసి అసైన్‌మెంట్‌ను మరింత స్పష్టంగా వివరించండి.';

  @override
  String get rubricUpgradeTitle => 'ఉన్నత ప్లాన్ అవసరం';

  @override
  String get rubricUpgradeBody =>
      'రూబ్రిక్ సృష్టి ఉన్నత ప్లాన్‌లో భాగం. రూబ్రిక్‌లు తయారు చేస్తూ ఉండటానికి దయచేసి అప్‌గ్రేడ్ చేయండి.';

  @override
  String get rubricLimitTitle => 'మీరు మీ పరిమితిని చేరుకున్నారు';

  @override
  String get rubricLimitBody =>
      'ఇప్పటికి మీ రూబ్రిక్‌లను ఉపయోగించారు. దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి లేదా మీ ప్లాన్‌ను అప్‌గ్రేడ్ చేయండి.';

  @override
  String get rubricRephrase =>
      'దాని నుండి రూబ్రిక్ తయారు చేయలేకపోయాము. దయచేసి అసైన్‌మెంట్‌ను మళ్లీ రాసి ప్రయత్నించండి.';

  @override
  String get rubricBusy =>
      'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి కొద్దిసేపటిలో మళ్లీ ప్రయత్నించండి.';

  @override
  String get rubricTimeout =>
      'ఇది ఊహించిన దానికంటే ఎక్కువ సమయం తీసుకుంటోంది. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get rubricSignIn =>
      'ఈ సాధనాన్ని ఉపయోగించడానికి దయచేసి మళ్లీ సైన్ ఇన్ చేయండి.';

  @override
  String get examPaperTitle => 'ప్రశ్నపత్రం';

  @override
  String get examPaperSubtitle =>
      'సమాధాన కీతో బోర్డు నమూనా ప్రశ్నపత్రం తయారు చేయండి';

  @override
  String get examPaperEmpty =>
      'బోర్డు, తరగతి, విషయాన్ని ఎంచుకుని సృష్టించండి నొక్కండి.';

  @override
  String get examPaperBoardLabel => 'బోర్డు';

  @override
  String get examPaperBoardHint => 'బోర్డును ఎంచుకోండి';

  @override
  String get examPaperBoardError => 'దయచేసి ఒక బోర్డును ఎంచుకోండి.';

  @override
  String get examPaperGradeLabel => 'తరగతి స్థాయి';

  @override
  String get examPaperGradeHint => 'తరగతిని ఎంచుకోండి';

  @override
  String get examPaperGradeError => 'దయచేసి తరగతి స్థాయిని ఎంచుకోండి.';

  @override
  String get examPaperSubjectLabel => 'విషయం';

  @override
  String get examPaperSubjectHint => 'విషయాన్ని ఎంచుకోండి';

  @override
  String get examPaperSubjectError => 'దయచేసి విషయాన్ని ఎంచుకోండి.';

  @override
  String get examPaperSubjectOther => 'ఇతర విషయం';

  @override
  String get examPaperSubjectOtherLabel => 'విషయం పేరు';

  @override
  String get examPaperSubjectOtherHint => 'ఉదాహరణకు, అర్థశాస్త్రం';

  @override
  String get examPaperSubjectOtherError => 'దయచేసి ఒక విషయాన్ని నమోదు చేయండి.';

  @override
  String get examPaperChaptersLabel => 'అధ్యాయాలు';

  @override
  String get examPaperChaptersHint =>
      'కవర్ చేయవలసిన అధ్యాయాలను జోడించండి. అధికారిక బ్లూప్రింట్ ఉన్నచోట పూర్తి సిలబస్ కోసం ఖాళీగా వదలండి.';

  @override
  String get examPaperChaptersPlaceholder => 'ఉదాహరణకు, వర్గ సమీకరణాలు';

  @override
  String get examPaperChaptersAdd => 'అధ్యాయాన్ని జోడించండి';

  @override
  String get examPaperChaptersError =>
      'ఈ బోర్డు, తరగతి, విషయానికి దయచేసి కనీసం ఒక అధ్యాయాన్ని జోడించండి.';

  @override
  String get examPaperDifficultyLabel => 'కష్టతర స్థాయి';

  @override
  String get examPaperDifficultyEasy => 'సులభం';

  @override
  String get examPaperDifficultyModerate => 'మధ్యస్థం';

  @override
  String get examPaperDifficultyHard => 'కఠినం';

  @override
  String get examPaperDifficultyMixed => 'మిశ్రమం';

  @override
  String get examPaperIncludeAnswerKey => 'సమాధాన కీని చేర్చండి';

  @override
  String get examPaperIncludeMarkingScheme => 'మార్కింగ్ స్కీమ్‌ను చేర్చండి';

  @override
  String get examPaperInProgressTitle => 'మీ ప్రశ్నపత్రం సిద్ధమవుతోంది';

  @override
  String get examPaperInProgressBody =>
      'పూర్తి బోర్డు ప్రశ్నపత్రం తయారు చేయడానికి కొంచెం ఎక్కువ సమయం పడుతుంది. మేము ఇప్పుడు దాన్ని పూర్తి చేస్తున్నాము, అది మీ కోసం సేవ్ అవుతుంది.';

  @override
  String get examPaperInProgressLibraryHint =>
      'పూర్తయిన మీ ప్రశ్నపత్రం కోసం ఒక నిమిషంలో గ్రంథాలయం ట్యాబ్‌ను తెరవండి.';

  @override
  String examPaperMaxMarks(String marks) {
    return 'గరిష్ఠ మార్కులు $marks';
  }

  @override
  String examPaperMarks(String marks) {
    return '$marks మార్కులు';
  }

  @override
  String examPaperSectionMarks(String marks) {
    return '$marks మార్కులు';
  }

  @override
  String examPaperPercent(String value) {
    return '$value శాతం';
  }

  @override
  String get examPaperGeneralInstructions => 'సాధారణ సూచనలు';

  @override
  String get examPaperInternalChoice => 'లేదా ప్రయత్నించండి';

  @override
  String get examPaperAnswerKey => 'సమాధానం';

  @override
  String get examPaperMarkingScheme => 'మార్కింగ్ స్కీమ్';

  @override
  String get examPaperBlueprintTitle => 'బ్లూప్రింట్ సారాంశం';

  @override
  String get examPaperBlueprintChapters => 'అధ్యాయాల వారీగా మార్కులు';

  @override
  String get examPaperBlueprintDifficulty => 'కష్టతర స్థాయి విభజన';

  @override
  String get examPaperPyqTitle => 'గత సంవత్సరాల ప్రశ్నలు';

  @override
  String examPaperPyqChapterYear(String chapter, int year) {
    return '$chapter ($year)';
  }

  @override
  String examPaperPyqYear(int year) {
    return '$year సంవత్సరం';
  }

  @override
  String get examPaperNoContent =>
      'దాని కోసం ప్రశ్నపత్రం రాలేదు. దయచేసి తక్కువ అధ్యాయాలు లేదా వేరే విషయాన్ని ప్రయత్నించండి.';

  @override
  String get examPaperUnstructuredTitle => 'ఆ ప్రశ్నపత్రాన్ని అమర్చలేకపోయాము';

  @override
  String get examPaperUnstructuredBody =>
      'సహాయకం దీన్ని పూర్తి ప్రశ్నపత్రంగా అమర్చలేకపోయింది. దయచేసి కొన్ని అధ్యాయాలను తీసివేసి మళ్లీ సృష్టించండి.';

  @override
  String get examPaperUpgradeTitle => 'ఉన్నత ప్లాన్ అవసరం';

  @override
  String get examPaperUpgradeBody =>
      'ప్రశ్నపత్రం సృష్టి ఉన్నత ప్లాన్‌లో భాగం. ప్రశ్నపత్రాలు తయారు చేస్తూ ఉండటానికి దయచేసి అప్‌గ్రేడ్ చేయండి.';

  @override
  String get examPaperLimitTitle => 'మీరు మీ పరిమితిని చేరుకున్నారు';

  @override
  String get examPaperLimitBody =>
      'ఇప్పటికి మీ ప్రశ్నపత్రాలను ఉపయోగించారు. దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి లేదా మీ ప్లాన్‌ను అప్‌గ్రేడ్ చేయండి.';

  @override
  String get examPaperRephrase =>
      'దాని నుండి ప్రశ్నపత్రం తయారు చేయలేకపోయాము. దయచేసి అధ్యాయాలను సరిచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get examPaperBusy =>
      'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి కొద్దిసేపటిలో మళ్లీ ప్రయత్నించండి.';

  @override
  String get examPaperTimeout =>
      'ఇది ఊహించిన దానికంటే ఎక్కువ సమయం తీసుకుంటోంది. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get examPaperSignIn =>
      'ఈ సాధనాన్ని ఉపయోగించడానికి దయచేసి మళ్లీ సైన్ ఇన్ చేయండి.';

  @override
  String get teacherTrainingTitle => 'బోధన మార్గదర్శి';

  @override
  String get teacherTrainingSubtitle => 'బోధన ప్రశ్నకు సలహా, వ్యూహం';

  @override
  String get teacherTrainingAction => 'సలహా పొందండి';

  @override
  String get teacherTrainingEmpty =>
      'బోధనా శాస్త్రం ఆధారిత వ్యూహాల కోసం ఒక బోధన ప్రశ్నను అడగండి.';

  @override
  String get teacherTrainingQuestionLabel => 'మీ ప్రశ్న';

  @override
  String get teacherTrainingQuestionHint =>
      'పాఠ రూపకల్పన, తరగతి గది ఆచరణ లేదా మూల్యాంకనం గురించి అడగండి.';

  @override
  String get teacherTrainingQuestionPlaceholder =>
      'ఉదాహరణకు, 40 మంది ఉన్న తరగతిని పూర్తి పాఠం అంతా నిమగ్నంగా ఎలా ఉంచగలను?';

  @override
  String get teacherTrainingQuestionError => 'దయచేసి ఒక ప్రశ్నను నమోదు చేయండి.';

  @override
  String get teacherTrainingSubjectLabel => 'విషయం';

  @override
  String get teacherTrainingSubjectAny => 'ఏ విషయం అయినా';

  @override
  String get teacherTrainingOptional => 'ఐచ్ఛికం';

  @override
  String get teacherTrainingStrategiesTitle => 'వ్యూహాలు';

  @override
  String get teacherTrainingSectionQuestion => 'ప్రశ్న';

  @override
  String get teacherTrainingResultTitle => 'మార్గదర్శక గమనికలు';

  @override
  String get teacherTrainingNoContent =>
      'దాని కోసం సలహా రాలేదు. దయచేసి మరింత స్పష్టమైన ప్రశ్నను ప్రయత్నించండి.';

  @override
  String get teacherTrainingUpgradeTitle => 'ఉన్నత ప్లాన్ అవసరం';

  @override
  String get teacherTrainingUpgradeBody =>
      'బోధన మార్గదర్శి ఉన్నత ప్లాన్‌లో భాగం. అడుగుతూ ఉండటానికి దయచేసి అప్‌గ్రేడ్ చేయండి.';

  @override
  String get teacherTrainingLimitTitle => 'మీరు మీ పరిమితిని చేరుకున్నారు';

  @override
  String get teacherTrainingLimitBody =>
      'ఇప్పటికి బోధన మార్గదర్శిని ఉపయోగించారు. దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి లేదా మీ ప్లాన్‌ను అప్‌గ్రేడ్ చేయండి.';

  @override
  String get teacherTrainingSeePricing => 'ప్లాన్‌లు మరియు ధరలను చూడండి';

  @override
  String get teacherTrainingRephrase =>
      'దాని నుండి సలహాను రూపొందించలేకపోయాము. దయచేసి ప్రశ్నను మళ్లీ రాసి ప్రయత్నించండి.';

  @override
  String get teacherTrainingBusy =>
      'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి కొద్దిసేపటిలో మళ్లీ ప్రయత్నించండి.';

  @override
  String teacherTrainingBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి సుమారు $seconds సెకన్లలో మళ్లీ ప్రయత్నించండి.',
      one:
          'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి సుమారు 1 సెకనులో మళ్లీ ప్రయత్నించండి.',
    );
    return '$_temp0';
  }

  @override
  String get teacherTrainingTimeout =>
      'ఇది ఊహించిన దానికంటే ఎక్కువ సమయం తీసుకుంటోంది. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get teacherTrainingSignIn =>
      'ఈ సాధనాన్ని ఉపయోగించడానికి దయచేసి మళ్లీ సైన్ ఇన్ చేయండి.';

  @override
  String get parentMessageTitle => 'తల్లిదండ్రులకు సందేశం';

  @override
  String get parentMessageSubtitle =>
      'తల్లిదండ్రుల భాషలో ఇంటికి సందేశాన్ని రూపొందించండి';

  @override
  String get parentMessageAction => 'సందేశాన్ని రూపొందించండి';

  @override
  String get parentMessageEmpty =>
      'విద్యార్థి, కారణాన్ని తెలియజేయండి. తల్లిదండ్రుల భాషలో ఆదరణతో కూడిన సందేశం ఇంటికి రూపొందించబడుతుంది.';

  @override
  String get parentMessageStudentLabel => 'విద్యార్థి పేరు';

  @override
  String get parentMessageStudentPlaceholder =>
      'సందేశం ఎవరి గురించో ఆ విద్యార్థి';

  @override
  String get parentMessageStudentError =>
      'దయచేసి విద్యార్థి పేరును నమోదు చేయండి.';

  @override
  String get parentMessageClassLabel => 'తరగతి';

  @override
  String get parentMessageClassPlaceholder => 'ఉదాహరణకు, 6A తరగతి';

  @override
  String get parentMessageClassError => 'దయచేసి తరగతిని నమోదు చేయండి.';

  @override
  String get parentMessageSubjectLabel => 'విషయం';

  @override
  String get parentMessageSubjectHint => 'ఒక విషయాన్ని ఎంచుకోండి';

  @override
  String get parentMessageSubjectError => 'దయచేసి విషయాన్ని ఎంచుకోండి.';

  @override
  String get parentMessageReasonLabel => 'సందేశానికి కారణం';

  @override
  String get parentMessageReasonHint => 'ఒక కారణాన్ని ఎంచుకోండి';

  @override
  String get parentMessageReasonError => 'దయచేసి కారణాన్ని ఎంచుకోండి.';

  @override
  String get parentMessageReasonAbsences => 'పదేపదే గైర్హాజరు';

  @override
  String get parentMessageReasonPerformance => 'చదువులో సహాయం';

  @override
  String get parentMessageReasonBehavior => 'తరగతిలో ప్రవర్తన';

  @override
  String get parentMessageReasonPositive => 'పంచుకోవడానికి శుభవార్త';

  @override
  String get parentMessageAbsentDaysLabel => 'గైర్హాజరు రోజులు';

  @override
  String get parentMessageAbsentDaysHint =>
      'విద్యార్థి వరుసగా ఎన్ని రోజులు రాలేదు.';

  @override
  String get parentMessageAbsentDaysPlaceholder => 'ఉదాహరణకు, 3';

  @override
  String get parentMessageParentLanguageLabel => 'తల్లిదండ్రుల భాష';

  @override
  String get parentMessageParentLanguageHint =>
      'సందేశం ఈ భాషలో రాయబడుతుంది; ఇది యాప్ భాషకు భిన్నంగా ఉండవచ్చు.';

  @override
  String get parentMessageParentLanguagePlaceholder =>
      'తల్లిదండ్రుల భాషను ఎంచుకోండి';

  @override
  String get parentMessageParentLanguageError =>
      'దయచేసి తల్లిదండ్రుల భాషను ఎంచుకోండి.';

  @override
  String get parentMessageContextLabel => 'దీనికి కారణమేమిటి?';

  @override
  String get parentMessageContextHint =>
      'పరిస్థితి గురించి ఒక చిన్న గమనిక సందేశాన్ని తీర్చిదిద్దుతుంది.';

  @override
  String get parentMessageContextPlaceholder =>
      'ఉదాహరణకు, భిన్నాల పాఠాల చివరి రెండు వారాలు తప్పిపోయారు';

  @override
  String get parentMessageNoteLabel => 'ప్రత్యేకంగా చెప్పవలసినది ఏదైనా ఉందా?';

  @override
  String get parentMessageNoteHint =>
      'ఇక్కడ ఇచ్చిన వివరం సందేశంలో కలుపబడుతుంది.';

  @override
  String get parentMessageNotePlaceholder =>
      'ఉదాహరణకు, గ్రూప్ పనిలో బాగా చేస్తున్నారు';

  @override
  String get parentMessageTeacherNameLabel => 'మీ పేరు';

  @override
  String get parentMessageTeacherNameHint =>
      'సందేశంపై సంతకంగా ఉంటుంది. ఖాళీగా వదిలితే మీ ప్రొఫైల్ పేరు ఉపయోగించబడుతుంది.';

  @override
  String get parentMessageTeacherNamePlaceholder => 'ఉదాహరణకు, శ్రీమతి రావు';

  @override
  String get parentMessageSchoolNameLabel => 'పాఠశాల పేరు';

  @override
  String get parentMessageSchoolNamePlaceholder => 'మీ పాఠశాల పేరు';

  @override
  String get parentMessageOptional => 'ఐచ్ఛికం';

  @override
  String parentMessageWordCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count పదాలు',
      one: '1 పదం',
    );
    return '$_temp0';
  }

  @override
  String get parentMessageSectionMessage => 'సందేశం';

  @override
  String get parentMessageSectionDetails => 'అదనపు వివరాలు';

  @override
  String get parentMessageResultTitle => 'తల్లిదండ్రులకు సందేశం';

  @override
  String get parentMessageNoContent =>
      'దాని కోసం సందేశం రాలేదు. దయచేసి కొంచెం ఎక్కువ సందర్భాన్ని జోడించి మళ్లీ ప్రయత్నించండి.';

  @override
  String get parentMessageMissingFields =>
      'దయచేసి విద్యార్థి, తరగతి, విషయం, కారణం, తల్లిదండ్రుల భాషను పూరించి మళ్లీ ప్రయత్నించండి.';

  @override
  String get parentMessageUpgradeTitle => 'ఉన్నత ప్లాన్ అవసరం';

  @override
  String get parentMessageUpgradeBody =>
      'తల్లిదండ్రులకు సందేశాలు ఉన్నత ప్లాన్‌లో భాగం. వాటిని రూపొందిస్తూ ఉండటానికి దయచేసి అప్‌గ్రేడ్ చేయండి.';

  @override
  String get parentMessageLimitTitle => 'మీరు మీ పరిమితిని చేరుకున్నారు';

  @override
  String get parentMessageLimitBody =>
      'ఇప్పటికి మీ తల్లిదండ్రుల సందేశాలను రూపొందించారు. దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి లేదా మీ ప్లాన్‌ను అప్‌గ్రేడ్ చేయండి.';

  @override
  String get parentMessageSeePricing => 'ప్లాన్‌లు మరియు ధరలను చూడండి';

  @override
  String get parentMessageBusy =>
      'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి కొద్దిసేపటిలో మళ్లీ ప్రయత్నించండి.';

  @override
  String parentMessageBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి సుమారు $seconds సెకన్లలో మళ్లీ ప్రయత్నించండి.',
      one:
          'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి సుమారు 1 సెకనులో మళ్లీ ప్రయత్నించండి.',
    );
    return '$_temp0';
  }

  @override
  String get parentMessageTimeout =>
      'ఇది ఊహించిన దానికంటే ఎక్కువ సమయం తీసుకుంటోంది. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get parentMessageSignIn =>
      'ఈ సాధనాన్ని ఉపయోగించడానికి దయచేసి మళ్లీ సైన్ ఇన్ చేయండి.';

  @override
  String get assessTitle => 'అసైన్‌మెంట్ మూల్యాంకనం';

  @override
  String get assessSubtitle =>
      'ఫోటో నుండి విద్యార్థి చేతిరాత పనిని మూల్యాంకనం చేయండి';

  @override
  String get assessEmpty =>
      'విద్యార్థి పని ఫోటోను జోడించి, మూల్యాంకనం చేయండి నొక్కండి.';

  @override
  String get assessSubmit => 'మూల్యాంకనం చేయండి';

  @override
  String get assessImageLabel => 'విద్యార్థి పని ఫోటో';

  @override
  String get assessImageHint => 'పేజీ మొత్తానికి స్పష్టమైన ఫోటో తీయండి.';

  @override
  String get assessImageError => 'దయచేసి విద్యార్థి పని ఫోటోను జోడించండి.';

  @override
  String get assessModeLabel => 'మీకు ఏమి కావాలి?';

  @override
  String get assessModeHint =>
      'పూర్తి మూల్యాంకనం పనిని చదివి మార్కులు ఇస్తుంది. చదవడం మాత్రమే అంటే వ్రాతప్రతిని మాత్రమే ఇస్తుంది. వ్రాతప్రతికి మార్కులు అంటే మీరు అతికించిన పాఠ్యానికి మార్కులు ఇస్తుంది.';

  @override
  String get assessModeFull => 'పూర్తి మూల్యాంకనం';

  @override
  String get assessModeTranscribe => 'చదవడం మాత్రమే';

  @override
  String get assessModeScore => 'వ్రాతప్రతికి మార్కులు';

  @override
  String get assessTranscriptLabel => 'సరిదిద్దిన వ్రాతప్రతి';

  @override
  String get assessTranscriptHint =>
      'ఫోటోను మళ్లీ చదవడానికి బదులు, మూల్యాంకనం కోసం సరిదిద్దిన పాఠ్యాన్ని అతికించండి.';

  @override
  String get assessTranscriptPlaceholder =>
      'విద్యార్థి సరిదిద్దిన సమాధానాలను టైప్ చేయండి లేదా అతికించండి';

  @override
  String get assessOptional => 'ఐచ్ఛికం';

  @override
  String get assessRubricNote =>
      'రూబ్రిక్ లేకపోతే, పనిని సాధారణ రూబ్రిక్‌పై మూల్యాంకనం చేస్తాము: అవగాహన, కచ్చితత్వం, ప్రదర్శన, పూర్తి చేయడం.';

  @override
  String get assessPrivacyNote =>
      'మూల్యాంకనం కోసం విద్యార్థి పేరు ఎప్పుడూ పంపబడదు.';

  @override
  String get assessScoreLabel => 'మొత్తం స్కోరు';

  @override
  String get assessScoreOutOf => '100 లో';

  @override
  String assessPoints(String earned, String possible) {
    return '$possible పాయింట్లలో $earned';
  }

  @override
  String assessConfidence(String percent) {
    return 'విశ్వాసం $percent%';
  }

  @override
  String assessRubricUsed(String title) {
    return 'దీని ఆధారంగా మూల్యాంకనం: $title';
  }

  @override
  String get assessLowConfidence => 'తక్కువ విశ్వాసం';

  @override
  String get assessTranscriptSection => 'విద్యార్థి రాసినది';

  @override
  String get assessCriteriaSection => 'ప్రమాణాల వారీగా మార్కులు';

  @override
  String assessCriterionPoints(String points, String max) {
    return '$points / $max';
  }

  @override
  String get assessStrengthsSection => 'బలాలు';

  @override
  String get assessImprovementsSection => 'మెరుగుపరచవలసినవి';

  @override
  String get assessNextStepsSection => 'తదుపరి దశలు';

  @override
  String get assessTeacherNoteSection => 'విద్యార్థి కోసం గమనిక';

  @override
  String get assessWarningsSection => 'దయచేసి తనిఖీ చేయండి';

  @override
  String get assessWarningBlank =>
      'ఈ పేజీ ఖాళీగా కనిపిస్తోంది. దయచేసి ఫోటోను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get assessWarningLowContrast =>
      'ఫోటో మసకగా ఉంది. వెలుతురు ఎక్కువగా ఉన్న ఫోటోతో మూల్యాంకనం మరింత కచ్చితంగా ఉంటుంది.';

  @override
  String get assessWarningPartial => 'పనిలో కొంత భాగం మాత్రమే చదవగలిగాము.';

  @override
  String get assessWarningLanguageMismatch =>
      'ఊహించిన భాషకు భిన్నమైన భాషలో రాసి ఉండవచ్చు.';

  @override
  String get assessNoContent =>
      'మూల్యాంకనం రాలేదు. దయచేసి స్పష్టమైన ఫోటోను ప్రయత్నించండి.';

  @override
  String get assessSignIn =>
      'అసైన్‌మెంట్‌ను మూల్యాంకనం చేయడానికి దయచేసి మళ్లీ సైన్ ఇన్ చేయండి.';

  @override
  String get assessUpgradeTitle => 'ఉన్నత ప్లాన్ అవసరం';

  @override
  String get assessUpgradeBody =>
      'చేతిరాత పనిని మూల్యాంకనం చేయడం ఉన్నత ప్లాన్‌లో భాగం. మూల్యాంకనం కొనసాగించడానికి అప్‌గ్రేడ్ చేయండి.';

  @override
  String get assessDailyLimitTitle => 'ఈరోజుకు మీ మూల్యాంకనాలన్నీ పూర్తయ్యాయి';

  @override
  String get assessDailyLimitBody =>
      'మీ ప్లాన్‌లో ప్రతిరోజూ నిర్దిష్ట సంఖ్యలో మూల్యాంకనాలు ఉంటాయి. అవి రేపు మళ్లీ ప్రారంభమవుతాయి, లేదా ఉన్నత ప్లాన్‌లో పరిమితిని పెంచుకోవచ్చు.';

  @override
  String get assessLimitTitle => 'మీరు మీ మూల్యాంకన పరిమితిని చేరుకున్నారు';

  @override
  String get assessLimitBody =>
      'మీ ప్లాన్‌లోని మూల్యాంకనాలన్నింటినీ ఉపయోగించారు. అవి వచ్చే నెల మళ్లీ ప్రారంభమవుతాయి, లేదా ఉన్నత ప్లాన్‌లో పరిమితిని పెంచుకోవచ్చు.';

  @override
  String get assessSeePricing => 'ప్లాన్‌లను చూడండి';

  @override
  String get assessBusy =>
      'మూల్యాంకన మోడల్ ప్రస్తుతం బిజీగా ఉంది. దయచేసి ఒక నిమిషంలో మళ్లీ ప్రయత్నించండి.';

  @override
  String assessBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'మూల్యాంకన మోడల్ ప్రస్తుతం బిజీగా ఉంది. దయచేసి సుమారు $seconds సెకన్లలో మళ్లీ ప్రయత్నించండి.',
      one:
          'మూల్యాంకన మోడల్ ప్రస్తుతం బిజీగా ఉంది. దయచేసి సుమారు 1 సెకనులో మళ్లీ ప్రయత్నించండి.',
    );
    return '$_temp0';
  }

  @override
  String get assessTimeout =>
      'మూల్యాంకనం సాధారణం కంటే ఎక్కువ సమయం తీసుకుంటోంది. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get assessRephrase =>
      'ఫోటోను మూల్యాంకనం చేయలేకపోయాము. దయచేసి స్పష్టమైన ఫోటోను మళ్లీ అప్‌లోడ్ చేయండి.';

  @override
  String get assessSectionWork => 'విద్యార్థి పని';

  @override
  String get assessResultTitle => 'మూల్యాంకనం';

  @override
  String get worksheetSectionWorksheet => 'వర్క్‌షీట్';

  @override
  String get rubricSectionAssignment => 'అసైన్‌మెంట్';

  @override
  String get examPaperSectionPaper => 'ప్రశ్నపత్రం';

  @override
  String get examPaperSectionFormat => 'ఫార్మాట్';

  @override
  String get vidyaEyebrow => 'మీ సహ ఉపాధ్యాయుడు';

  @override
  String get vidyaDeck => 'మీ భాషలో మాట్లాడండి, నేను పనిని సిద్ధం చేస్తాను.';

  @override
  String get vidyaGreeting =>
      'ఉపాధ్యాయులకు స్వాగతం. మీ భాషలో మాట్లాడండి, నేను మీ పనిని సిద్ధం చేస్తాను.';

  @override
  String get vidyaHeroBadge => 'మీ AI బోధన సహాయకుడు';

  @override
  String get vidyaPromptLesson => 'పాఠ్య ప్రణాళిక చేయమని అడగండి';

  @override
  String get vidyaPromptQuiz => 'క్విజ్ తయారు చేయమని అడగండి';

  @override
  String get vidyaPromptParent => 'తల్లిదండ్రులకు సందేశం పంపమని అడగండి';

  @override
  String get vidyaStateIdle => 'మాట్లాడటానికి నొక్కండి';

  @override
  String get vidyaStateReady => 'సిద్ధమవుతోంది';

  @override
  String get vidyaStateListening => 'నేను వింటున్నాను';

  @override
  String get vidyaStateThinking => 'ఆలోచిస్తున్నాను';

  @override
  String get vidyaStateSpeaking => 'మాట్లాడుతున్నాను';

  @override
  String get vidyaYouSaid => 'మీరు చెప్పింది';

  @override
  String get vidyaSignedOutTitle => 'VIDYA తో మాట్లాడటానికి సైన్ ఇన్ చేయండి';

  @override
  String get vidyaSignedOutBody =>
      'సైన్ ఇన్ చేయండి, VIDYA మీ భాషలో పాఠాలు, క్విజ్‌లు మరియు మరిన్ని సిద్ధం చేస్తుంది.';

  @override
  String get vidyaMicOffTitle => 'మైక్రోఫోన్‌ను ఆన్ చేయండి';

  @override
  String get vidyaMicOffBody =>
      'మిమ్మల్ని వినడానికి VIDYAకి మైక్రోఫోన్ అవసరం. దీన్ని సెట్టింగ్‌లలో ఆన్ చేయండి.';

  @override
  String get vidyaOpenSettings => 'సెట్టింగ్‌లను తెరవండి';

  @override
  String get vidyaSignIn => 'సైన్ ఇన్ చేయండి';

  @override
  String get vidyaLimitTitle => 'మీరు నేటి వాయిస్ పరిమితిని చేరుకున్నారు';

  @override
  String get vidyaLimitBody =>
      'మీ వాయిస్ నిమిషాలు మళ్లీ వస్తాయి. అప్పటివరకు మీరు సాధనాలను ఉపయోగించవచ్చు.';

  @override
  String get vidyaErrorTitle => 'అది పూర్తి కాలేదు';

  @override
  String get vidyaErrorBody =>
      'ఏదో తప్పు జరిగింది. మళ్లీ ప్రయత్నించడానికి సీల్‌ను నొక్కండి.';

  @override
  String get vidyaPrepDesk => 'సన్నాహక డెస్క్';

  @override
  String get vidyaClearConversation => 'సంభాషణను తొలగించు';

  @override
  String get vidyaFlowVisualAid => 'దృశ్య సాధనం';

  @override
  String get vidyaFlowVirtualFieldTrip => 'వర్చువల్ క్షేత్ర పర్యటన';

  @override
  String get vidyaFlowVideoStoryteller => 'వీడియో కథ';

  @override
  String get vidyaFieldMicLabel => 'మాట్లాడి నింపండి';

  @override
  String get vidyaFieldMicFailed =>
      'వినిపించలేదు. మళ్లీ ప్రయత్నించండి లేదా టైప్ చేయండి.';

  @override
  String get vidyaOpen => 'VIDYA ను అడగండి';

  @override
  String get parentHotlineTitle => 'తల్లిదండ్రులకు కాల్';

  @override
  String get parentHotlineSubtitle =>
      'విద్యార్థి తల్లిదండ్రులకు వారి భాషలో కాల్ చేయండి';

  @override
  String get parentHotlineEyebrow => 'తల్లిదండ్రులకు కాల్';

  @override
  String get parentHotlinePickStudentIntro =>
      'ఎవరి తల్లిదండ్రులకు కాల్ చేయాలో ఎంచుకోండి.';

  @override
  String get parentHotlineClassLabel => 'తరగతి';

  @override
  String get parentHotlineNoPhone => 'తల్లిదండ్రుల నంబర్ సేవ్ చేయలేదు';

  @override
  String get parentHotlineSignedOutTitle =>
      'మీ విద్యార్థులను చూడటానికి సైన్ ఇన్ చేయండి';

  @override
  String get parentHotlineSignedOutBody =>
      'మీరు సైన్ ఇన్ చేసిన తర్వాత మీ తరగతి జాబితా లోడ్ అవుతుంది. తల్లిదండ్రులకు కాల్ చేయాలంటే ముందు మీ ఖాతా అవసరం.';

  @override
  String get parentHotlineRosterUnavailableTitle =>
      'మీ తరగతి జాబితా ఇంకా అందుబాటులో లేదు';

  @override
  String get parentHotlineRosterUnavailableBody =>
      'మేము ఇంకా ఇక్కడ మీ విద్యార్థులను లోడ్ చేయలేకపోతున్నాము. ఇది తర్వాతి అప్‌డేట్‌లో వస్తుంది. మీరు ఇప్పటికే సైన్ ఇన్ అయ్యారు, కాబట్టి మీరు ఏమీ సరిచేయాల్సిన అవసరం లేదు.';

  @override
  String get parentHotlineRosterEmptyTitle =>
      'మీ జాబితాలో ఇంకా విద్యార్థులు లేరు';

  @override
  String get parentHotlineRosterEmptyBody =>
      'ఒక తరగతిలో విద్యార్థులను చేర్చండి, వారు ఇక్కడ కనిపిస్తారు, ఇంటికి కాల్ చేయడానికి సిద్ధంగా ఉంటారు.';

  @override
  String get parentHotlineReasonEyebrow => 'మీరు ఎందుకు కాల్ చేస్తున్నారు';

  @override
  String get parentHotlineReasonAbsencesLabel => 'పదేపదే గైర్హాజరు';

  @override
  String get parentHotlineReasonAbsencesDesc =>
      'విద్యార్థి వరుసగా చాలా రోజులు రాలేదు.';

  @override
  String get parentHotlineReasonPerformanceLabel =>
      'సబ్జెక్ట్‌లో వెనుకబడుతున్నారు';

  @override
  String get parentHotlineReasonPerformanceDesc =>
      'ఇటీవలి మార్కులు లేదా తరగతి పనిపై దృష్టి అవసరం.';

  @override
  String get parentHotlineReasonBehaviourLabel => 'తరగతిలో ప్రవర్తన';

  @override
  String get parentHotlineReasonBehaviourDesc =>
      'తల్లిదండ్రులు తెలుసుకోవలసిన విషయం ఏదో జరిగింది.';

  @override
  String get parentHotlineReasonPositiveLabel => 'పంచుకోవడానికి శుభవార్త';

  @override
  String get parentHotlineReasonPositiveDesc =>
      'తల్లిదండ్రులతో కలిసి ఒక విజయాన్ని జరుపుకోండి.';

  @override
  String get parentHotlineComposeEyebrow => 'కాల్‌ను సిద్ధం చేయండి';

  @override
  String get parentHotlineNoteLabel => 'ఒక గమనిక జోడించండి';

  @override
  String get parentHotlineNoteHintAbsences =>
      'రాని రోజుల గురించి తల్లిదండ్రులు తెలుసుకోవలసిందేదైనా ఉందా?';

  @override
  String get parentHotlineNoteHintPerformance =>
      'విద్యార్థి మెరుగుపడటానికి ఏది సహాయపడుతుంది?';

  @override
  String get parentHotlineNoteHintBehaviour =>
      'ఏం జరిగింది, ఇంట్లో ఎలాంటి సహాయం ఉపయోగపడుతుంది?';

  @override
  String get parentHotlineNoteHintPositive => 'పంచుకోవలసిన శుభవార్త ఏమిటి?';

  @override
  String get parentHotlineDraftAction => 'సందేశాన్ని రూపొందించండి';

  @override
  String get parentHotlineErrorTitle => 'ఏదో పొరపాటు జరిగింది';

  @override
  String get parentHotlineGenericError =>
      'అది పూర్తి కాలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get parentHotlineTelephonyUnavailable =>
      'ప్రస్తుతం కాల్ చేయడం అందుబాటులో లేదు. సందేశాన్ని కాపీ చేసి WhatsApp లో పంపవచ్చు.';

  @override
  String get parentHotlineEvidenceAttendanceHeader => 'హాజరు';

  @override
  String get parentHotlineEvidenceMarksHeader => 'ఇటీవలి మార్కులు';

  @override
  String get parentHotlineEvidenceBehaviourHeader => 'ఏం జరిగింది';

  @override
  String get parentHotlineEvidencePositiveHeader => 'శుభవార్త';

  @override
  String parentHotlineEvidenceAbsentDays(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: 'వరుసగా $days రోజులు గైర్హాజరు',
      one: 'వరుసగా 1 రోజు గైర్హాజరు',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineEvidenceAbsencePrompt =>
      'తల్లిదండ్రులు ఖచ్చితమైన వివరాలు వినేలా, రాని రోజులను నిర్ధారించండి.';

  @override
  String get parentHotlineEvidenceMarksPrompt =>
      'కాల్‌లో చెప్పడానికి తాజా మార్కులు సిద్ధంగా ఉన్నాయి.';

  @override
  String get parentHotlineEvidenceMarksEmpty =>
      'ఇంకా ఇటీవలి మార్కులేవీ నమోదు కాలేదు. తల్లిదండ్రులు తెలుసుకోవలసినది కింద జోడించండి.';

  @override
  String get parentHotlineEvidenceBehaviourPrompt =>
      'ఏం జరిగిందో, ఇంట్లో ఉపయోగపడే సహాయం ఏమిటో వివరించండి.';

  @override
  String get parentHotlineEvidencePositivePrompt =>
      'తల్లిదండ్రులు సంతోషించాలని మీరు కోరుకునే విజయాన్ని పంచుకోండి.';

  @override
  String get parentHotlineReviewEyebrow => 'ఇంటికి సందేశం';

  @override
  String get parentHotlineCall => 'తల్లిదండ్రులకు కాల్ చేయండి';

  @override
  String get parentHotlineWhatsApp => 'WhatsApp కోసం కాపీ చేయండి';

  @override
  String parentHotlineCallAgainIn(String time) {
    return '$timeలో మళ్లీ కాల్ చేయండి';
  }

  @override
  String parentHotlineUnsupportedLanguage(String language) {
    return '$language కోసం ఆటో-కాల్ ఇంకా అందుబాటులో లేదు — బదులుగా WhatsApp కోసం కాపీ చేయండి.';
  }

  @override
  String parentHotlinePhoneMask(String last4) {
    return '•••• $last4';
  }

  @override
  String get parentHotlineAiNotice =>
      'కాల్ ఒక ఆటోమేటిక్ AI వాయిస్ ప్రకటనతో ప్రారంభమవుతుంది.';

  @override
  String get parentHotlineCopied =>
      'సందేశం కాపీ చేయబడింది — పంపడానికి WhatsAppలో పేస్ట్ చేయండి.';

  @override
  String get parentHotlinePremiumTitle =>
      'తల్లిదండ్రులకు కాల్ కోసం అధునాతన ప్లాన్ అవసరం';

  @override
  String get parentHotlinePremiumBody =>
      'తల్లిదండ్రులకు AI వాయిస్ కాల్ చేయడం అధునాతన ప్లాన్‌లో భాగం. అయినా, ఉచితంగా WhatsAppలో పంపడానికి మీరు సందేశాన్ని కాపీ చేయవచ్చు.';

  @override
  String get parentHotlineComingSoonTitle => 'కాల్ వీక్షణ త్వరలో వస్తోంది';

  @override
  String get parentHotlineComingSoonBody =>
      'కాల్ చేయడం, దాన్ని అనుసరించడం తదుపరి అప్‌డేట్‌లో వస్తుంది.';

  @override
  String parentHotlineCallingTitle(String name) {
    return '$name తల్లిదండ్రులకు కాల్ చేస్తున్నాం…';
  }

  @override
  String get parentHotlineCallingRinging => 'రింగ్ అవుతోంది…';

  @override
  String get parentHotlineCallingInProgress => 'సంభాషణ జరుగుతోంది';

  @override
  String parentHotlineCallingExchanges(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count సంభాషణలు',
      one: '1 సంభాషణ',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineCallingReassurance =>
      'మీరు ఈ స్క్రీన్‌ను వదిలి వెళ్లవచ్చు — సారాంశం మీ కోసం సిద్ధంగా ఉంటుంది.';

  @override
  String get parentHotlineSummaryDocType => 'తల్లిదండ్రుల కాల్';

  @override
  String get parentHotlineSummaryReasonAbsences => 'గైర్హాజరు';

  @override
  String get parentHotlineSummaryReasonPerformance => 'పనితీరు';

  @override
  String get parentHotlineSummaryReasonBehaviour => 'ప్రవర్తన';

  @override
  String get parentHotlineSummaryReasonPositive => 'శుభవార్త';

  @override
  String parentHotlineSummaryTitle(String name) {
    return '$name తల్లిదండ్రులు';
  }

  @override
  String parentHotlineSummaryDurationMin(int minutes) {
    return '$minutes నిమిషాలు';
  }

  @override
  String get parentHotlineSentimentCooperative => 'సహకారం';

  @override
  String get parentHotlineSentimentConcerned => 'ఆందోళన';

  @override
  String get parentHotlineSentimentGrateful => 'కృతజ్ఞత';

  @override
  String get parentHotlineSentimentUpset => 'అసంతృప్తి';

  @override
  String get parentHotlineSentimentIndifferent => 'తటస్థం';

  @override
  String get parentHotlineSentimentConfused => 'గందరగోళం';

  @override
  String get parentHotlineSummarySaidHeader => 'తల్లిదండ్రులు చెప్పింది';

  @override
  String get parentHotlineSummaryConcernsHeader => 'లేవనెత్తిన ఆందోళనలు';

  @override
  String get parentHotlineSummaryCommitmentsHeader => 'తల్లిదండ్రుల హామీలు';

  @override
  String get parentHotlineSummaryActionsHeader => 'మీ కర్తవ్యాలు';

  @override
  String get parentHotlineSummaryGuidanceHeader => 'పంచుకున్న మార్గదర్శకత్వం';

  @override
  String get parentHotlineSummaryFollowUpHeader => 'తదుపరి చర్య';

  @override
  String parentHotlineSummaryTranscript(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'సంభాషణ చూడండి · $count సందేశాలు',
      one: 'సంభాషణ చూడండి · 1 సందేశం',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineSummaryDone => 'పూర్తయింది';

  @override
  String get parentHotlineSummaryCallAgain => 'తర్వాత మళ్లీ కాల్ చేయండి';

  @override
  String get parentHotlineSummaryManualTitle => 'సందేశం కాపీ అయింది';

  @override
  String get parentHotlineSummaryManualBody =>
      'తల్లిదండ్రులకు పంపడానికి దీన్ని WhatsApp లో పేస్ట్ చేయండి.';

  @override
  String get parentHotlineSummaryBusy => 'లైన్ బిజీగా ఉంది';

  @override
  String get parentHotlineSummaryNoAnswer => 'సమాధానం లేదు';

  @override
  String get parentHotlineSummaryFailed => 'కాల్ కనెక్ట్ కాలేదు';

  @override
  String get parentHotlineSummaryFailedBody =>
      'కాల్ జరగలేదు. మీరు మళ్లీ ప్రయత్నించవచ్చు, లేదా సందేశాన్ని కాపీ చేసి WhatsApp లో పంపవచ్చు.';

  @override
  String get parentHotlineSummaryTryAgain => 'మళ్లీ ప్రయత్నించండి';

  @override
  String get parentHotlineSummaryNoConversationTitle =>
      'కాల్ చాలా త్వరగా ముగిసింది';

  @override
  String get parentHotlineSummaryNoConversationBody =>
      'సంభాషణ మొదలయ్యేలోపే కాల్ ముగిసింది. మీరు మళ్లీ ప్రయత్నించవచ్చు, లేదా సందేశాన్ని WhatsApp లో పంపవచ్చు.';

  @override
  String get parentHotlineSummaryUnavailableTitle => 'సారాంశం అందుబాటులో లేదు';

  @override
  String get parentHotlineSummaryUnavailableBody =>
      'ఈ కాల్‌కు సారాంశాన్ని సిద్ధం చేయలేకపోయాము. సంభాషణ కింద ఉంది.';

  @override
  String get contentCreatorTitle => 'కంటెంట్ సృష్టి స్టూడియో';

  @override
  String get contentCreatorTileSubtitle =>
      'మీ తరగతికి మల్టీమీడియాను రూపొందించండి';

  @override
  String get contentCreatorSubtitle =>
      'మీ తరగతి గదికి ఆకర్షణీయమైన మల్టీమీడియా కంటెంట్‌ను రూపొందించడంలో సహాయపడే సాధనాలు.';

  @override
  String get contentCreatorSectionEyebrow => 'ఒక సాధనాన్ని ఎంచుకోండి';

  @override
  String get contentCreatorVisualAidDesc =>
      'మీ పాఠాల కోసం సరళమైన గీత చిత్రాలు మరియు రేఖాచిత్రాలను గీయండి.';

  @override
  String get contentCreatorFieldTripDesc =>
      'Google Earth ఉపయోగించి ఉత్తేజకరమైన వర్చువల్ యాత్రలను ప్లాన్ చేయండి.';

  @override
  String get contentCreatorVideoDesc =>
      'మీ పాఠాల కోసం ఎంపిక చేసిన విద్యా వీడియోలను కనుగొనండి.';

  @override
  String get visualAidTitle => 'దృశ్య సహాయకం';

  @override
  String get visualAidSubtitle => 'బోధన చిత్రాన్ని గీయండి';

  @override
  String get visualAidEmpty => 'ఒక చిత్రాన్ని వివరించి సృష్టించు నొక్కండి.';

  @override
  String get visualAidPromptLabel => 'చిత్రంలో ఏమి చూపించాలి?';

  @override
  String get visualAidPromptHint => 'ఉదాహరణకు, మొక్క కణంలోని భాగాలు';

  @override
  String get visualAidPromptError => 'మీకు ఎలాంటి చిత్రం కావాలో వివరించండి.';

  @override
  String get visualAidGradeLabel => 'తరగతి స్థాయి';

  @override
  String get visualAidGradeAny => 'ఏ తరగతి అయినా';

  @override
  String get visualAidSubjectLabel => 'విషయం';

  @override
  String get visualAidSubjectAny => 'ఏ విషయం అయినా';

  @override
  String get visualAidOptional => 'ఐచ్ఛికం';

  @override
  String get visualAidAction => 'చిత్రాన్ని సృష్టించు';

  @override
  String get visualAidResultTitle => 'దృశ్య సహాయకం';

  @override
  String get visualAidHowToUse => 'దీన్ని ఎలా ఉపయోగించాలి';

  @override
  String get visualAidDiscussionSpark => 'చర్చా ప్రశ్న';

  @override
  String get visualAidImageLabel => 'సృష్టించిన బోధన చిత్రం';

  @override
  String get visualAidImageError => 'ఈ చిత్రాన్ని చూపించలేకపోయాము.';

  @override
  String get visualAidNoImage =>
      'ఆ వివరణకు ఏ చిత్రం రాలేదు. దయచేసి దాన్ని మళ్లీ రాసి ప్రయత్నించండి.';

  @override
  String get visualAidSignIn =>
      'ఈ సాధనాన్ని ఉపయోగించడానికి దయచేసి మళ్లీ సైన్ ఇన్ చేయండి.';

  @override
  String get visualAidUpgradeTitle => 'ఉన్నత ప్లాన్ అవసరం';

  @override
  String get visualAidUpgradeBody =>
      'దృశ్య సహాయకం ఒక ఉన్నత ప్లాన్‌లో భాగం. చిత్రాలను సృష్టిస్తూ ఉండటానికి దయచేసి అప్‌గ్రేడ్ చేయండి.';

  @override
  String get visualAidSeePricing => 'ప్లాన్‌లు మరియు ధరలను చూడండి';

  @override
  String get visualAidDailyLimitTitle => 'ఈరోజుకు మీ చిత్రాలన్నీ పూర్తయ్యాయి';

  @override
  String get visualAidDailyLimitBody =>
      'మీ ప్లాన్‌లో ప్రతిరోజూ నిర్దిష్ట సంఖ్యలో దృశ్య సహాయకాలు ఉంటాయి. మీ చిత్రాలు రేపు మళ్లీ అందుబాటులో ఉంటాయి, లేదా ఉన్నత ప్లాన్‌లో రోజువారీ పరిమితిని పెంచుకోవచ్చు.';

  @override
  String get visualAidLimitTitle => 'మీరు మీ పరిమితిని చేరుకున్నారు';

  @override
  String get visualAidLimitBody =>
      'ఈ నెలకు మీ దృశ్య సహాయకాలను ఉపయోగించారు. మీ చిత్రాలు వచ్చే నెలలో మళ్లీ అందుబాటులో ఉంటాయి, లేదా ఉన్నత ప్లాన్‌లో పరిమితిని పెంచుకోవచ్చు.';

  @override
  String get visualAidRephrase =>
      'ఆ చిత్రాన్ని మేము సృష్టించలేకపోయాము. దయచేసి దాన్ని మళ్లీ రాసి ప్రయత్నించండి.';

  @override
  String get visualAidEmptyGeneration =>
      'చిత్రం ఖాళీగా వచ్చింది. తక్కువ లేబుల్‌లతో వివరించడానికి ప్రయత్నించండి.';

  @override
  String get visualAidBusy =>
      'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి కొద్దిసేపటిలో మళ్లీ ప్రయత్నించండి.';

  @override
  String visualAidBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి సుమారు $seconds సెకన్లలో మళ్లీ ప్రయత్నించండి.',
      one:
          'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి సుమారు 1 సెకనులో మళ్లీ ప్రయత్నించండి.',
    );
    return '$_temp0';
  }

  @override
  String get visualAidTimeout =>
      'ఇది ఊహించిన దానికంటే ఎక్కువ సమయం తీసుకుంటోంది. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get videoStorytellerTitle => 'వీడియో కథకుడు';

  @override
  String get videoStorytellerSubtitle => 'బోధన వీడియోలను కనుగొనండి';

  @override
  String get videoStorytellerEmpty =>
      'ఒక విషయం లేదా అంశాన్ని ఎంచుకుని వీడియోలను కనుగొను నొక్కండి.';

  @override
  String get videoStorytellerTopicLabel => 'అంశం లేదా అధ్యాయం';

  @override
  String get videoStorytellerTopicHint => 'ఉదాహరణకు, నీటి చక్రం';

  @override
  String get videoStorytellerSubjectLabel => 'విషయం';

  @override
  String get videoStorytellerSubjectAny => 'ఏ విషయం అయినా';

  @override
  String get videoStorytellerGradeLabel => 'తరగతి స్థాయి';

  @override
  String get videoStorytellerGradeAny => 'ఏ తరగతి అయినా';

  @override
  String get videoStorytellerOptional => 'ఐచ్ఛికం';

  @override
  String get videoStorytellerAction => 'వీడియోలను కనుగొను';

  @override
  String get videoStorytellerNoResults =>
      'దాని కోసం ఏ వీడియో రాలేదు. వేరే విషయం లేదా అంశాన్ని ప్రయత్నించండి.';

  @override
  String videoStorytellerViewAll(int count) {
    return 'మొత్తం $count చూడండి';
  }

  @override
  String get videoStorytellerOfficialSource => 'అధికారిక మూలం';

  @override
  String get videoStorytellerOpensExternally =>
      'యూట్యూబ్‌లో, యాప్ వెలుపల తెరుచుకుంటుంది.';

  @override
  String get videoStorytellerCategoryTopRecommended =>
      'మీ కోసం అగ్ర సిఫార్సులు';

  @override
  String get videoStorytellerCategoryStorytelling => 'మీ విషయాల కోసం కథా కథనం';

  @override
  String get videoStorytellerCategoryPedagogy =>
      'బోధనా శాస్త్రం మరియు బోధనా పద్ధతులు';

  @override
  String get videoStorytellerCategoryGovtUpdates => 'ప్రభుత్వ నవీకరణలు';

  @override
  String get videoStorytellerCategoryCourses => 'ఉపాధ్యాయ శిక్షణ కోర్సులు';

  @override
  String get videoStorytellerSignIn =>
      'ఈ సాధనాన్ని ఉపయోగించడానికి దయచేసి మళ్లీ సైన్ ఇన్ చేయండి.';

  @override
  String get videoStorytellerTimeout =>
      'ఇది ఊహించిన దానికంటే ఎక్కువ సమయం తీసుకుంటోంది. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get videoStorytellerBusy =>
      'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి కొద్దిసేపటిలో మళ్లీ ప్రయత్నించండి.';

  @override
  String videoStorytellerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి సుమారు $seconds సెకన్లలో మళ్లీ ప్రయత్నించండి.',
      one:
          'సహాయకం ఇప్పుడు బిజీగా ఉంది. దయచేసి సుమారు 1 సెకనులో మళ్లీ ప్రయత్నించండి.',
    );
    return '$_temp0';
  }

  @override
  String get videoStorytellerRephrase =>
      'దాని కోసం మేము వీడియోలను కనుగొనలేకపోయాము. దయచేసి వేరే అంశాన్ని ప్రయత్నించండి.';

  @override
  String get videoStorytellerLimit =>
      'మీరు ఇటీవల చాలా వెతికారు. దయచేసి కొద్దిసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.';

  @override
  String get actionDone => 'పూర్తయింది';

  @override
  String get virtualFieldTripTitle => 'వర్చువల్ ఫీల్డ్ ట్రిప్';

  @override
  String get virtualFieldTripSubtitle =>
      'Google Earth లో ప్రపంచాన్ని చుట్టి రండి';

  @override
  String get virtualFieldTripEmpty =>
      'ఒక అంశాన్ని నమోదు చేసి \'యాత్రను ప్లాన్ చేయి\' నొక్కండి.';

  @override
  String get virtualFieldTripTopicLabel => 'అంశం లేదా థీమ్';

  @override
  String get virtualFieldTripTopicHint => 'ఉదాహరణకు, గ్రేట్ బ్యారియర్ రీఫ్';

  @override
  String get virtualFieldTripTopicError =>
      'దయచేసి యాత్ర కోసం ఒక అంశాన్ని నమోదు చేయండి.';

  @override
  String get virtualFieldTripGradeLabel => 'తరగతి స్థాయి';

  @override
  String get virtualFieldTripGradeAny => 'ఏదైనా తరగతి';

  @override
  String get virtualFieldTripOptional => 'ఐచ్ఛికం';

  @override
  String get virtualFieldTripAction => 'యాత్రను ప్లాన్ చేయి';

  @override
  String get virtualFieldTripDocType => 'వర్చువల్ ఫీల్డ్ ట్రిప్';

  @override
  String virtualFieldTripStopCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count మజిలీలు',
      one: '1 మజిలీ',
    );
    return '$_temp0';
  }

  @override
  String virtualFieldTripStopSemantics(int number, String name) {
    return 'మజిలీ $number: $name';
  }

  @override
  String get virtualFieldTripFactLabel => 'మీకు తెలుసా?';

  @override
  String get virtualFieldTripReflectionLabel => 'దీని గురించి ఆలోచించండి';

  @override
  String get virtualFieldTripAnalogyLabel => 'మన సందర్భంలో';

  @override
  String get virtualFieldTripExplanationLabel => 'మనం ఎందుకు సందర్శిస్తాము';

  @override
  String get virtualFieldTripOpenEarth => 'Google Earth లో తెరవండి';

  @override
  String get virtualFieldTripOpensExternally =>
      'యాప్‌కు బయట, Google Earth లో తెరుచుకుంటుంది.';

  @override
  String get virtualFieldTripPendingTitle => 'మీ యాత్ర ఇంకా ప్లాన్ అవుతోంది';

  @override
  String get virtualFieldTripPendingBody =>
      'మీ ఫీల్డ్ ట్రిప్ ఇంకా సిద్ధమవుతోంది. ఒక నిమిషంలో \'నా లైబ్రరీ\' చూడండి.';

  @override
  String get virtualFieldTripNoStops =>
      'దాని కోసం మజిలీలు ఏవీ రాలేదు. వేరే అంశాన్ని ప్రయత్నించండి.';

  @override
  String get virtualFieldTripSignIn =>
      'ఈ సాధనాన్ని ఉపయోగించడానికి దయచేసి మళ్లీ సైన్ ఇన్ చేయండి.';

  @override
  String get virtualFieldTripUnavailable =>
      'ఈ సాధనం మీ ప్రస్తుత ప్లాన్‌లో భాగం కాదు.';

  @override
  String get virtualFieldTripTimeout =>
      'దీనికి ఊహించిన దానికంటే ఎక్కువ సమయం పడుతోంది. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get virtualFieldTripBusy =>
      'సహాయకుడు ప్రస్తుతం తీరిక లేకుండా ఉన్నారు. దయచేసి కొద్దిసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.';

  @override
  String virtualFieldTripBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'సహాయకుడు ప్రస్తుతం తీరిక లేకుండా ఉన్నారు. దయచేసి సుమారు $seconds సెకన్ల తర్వాత మళ్లీ ప్రయత్నించండి.',
      one:
          'సహాయకుడు ప్రస్తుతం తీరిక లేకుండా ఉన్నారు. దయచేసి సుమారు 1 సెకను తర్వాత మళ్లీ ప్రయత్నించండి.',
    );
    return '$_temp0';
  }

  @override
  String get virtualFieldTripRephrase =>
      'దాని కోసం మేము యాత్రను ప్లాన్ చేయలేకపోయాము. దయచేసి వేరే అంశాన్ని ప్రయత్నించండి.';

  @override
  String get virtualFieldTripLimit =>
      'మీరు ఇటీవల చాలా యాత్రలను ప్లాన్ చేశారు. దయచేసి కొద్దిసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.';

  @override
  String get assessmentScannerTitle => 'మూల్యాంకన స్కానర్';

  @override
  String get assessmentScannerSubtitle =>
      'విద్యార్థి సమాధాన పత్రాన్ని పేజీ వారీగా మూల్యాంకనం చేయండి';

  @override
  String get assessmentScannerEmpty =>
      'సమాధాన పత్రం 3 వరకు ఫోటోలను జోడించి, తర్వాత మూల్యాంకనం నొక్కండి.';

  @override
  String get assessmentScannerSubmit => 'సమాధాన పత్రాన్ని మూల్యాంకనం చేయండి';

  @override
  String get assessmentScannerResultTitle => 'మూల్యాంకనం';

  @override
  String get assessmentScannerSectionSheet => 'సమాధాన పత్రం';

  @override
  String get assessmentScannerPagesLabel => 'సమాధాన పత్ర పేజీలు';

  @override
  String get assessmentScannerPagesHint =>
      '3 వరకు స్పష్టమైన ఫోటోలను జోడించండి, ప్రతి పేజీకి ఒకటి.';

  @override
  String get assessmentScannerPagesEmpty => 'మొదటి పేజీ ఫోటోను జోడించండి.';

  @override
  String assessmentScannerPageLabel(int number) {
    return 'పేజీ $number';
  }

  @override
  String assessmentScannerRemovePage(int number) {
    return 'పేజీ $number తీసివేయండి';
  }

  @override
  String assessmentScannerPageCounter(int count, int max) {
    return '$max లో $count పేజీలు';
  }

  @override
  String assessmentScannerPagesFull(int max) {
    return 'మీరు $max వరకు పేజీలను జోడించవచ్చు.';
  }

  @override
  String get assessmentScannerTakePhoto => 'ఫోటో తీయండి';

  @override
  String get assessmentScannerChooseGallery => 'గ్యాలరీ నుండి ఎంచుకోండి';

  @override
  String get assessmentScannerSubjectLabel => 'విషయం';

  @override
  String get assessmentScannerSubjectHint =>
      'మూల్యాంకనం విషయానికి అనుగుణంగా ఉంటుంది.';

  @override
  String get assessmentScannerSubjectPlaceholder => 'విషయాన్ని ఎంచుకోండి';

  @override
  String get assessmentScannerSubjectError => 'దయచేసి విషయాన్ని ఎంచుకోండి.';

  @override
  String get assessmentScannerGradeLabel => 'తరగతి స్థాయి';

  @override
  String get assessmentScannerGradePlaceholder => 'తరగతిని ఎంచుకోండి';

  @override
  String get assessmentScannerGradeError => 'దయచేసి తరగతిని ఎంచుకోండి.';

  @override
  String get assessmentScannerOptional => 'ఐచ్ఛికం';

  @override
  String get assessmentScannerAnswerKeyLabel => 'సమాధాన కీ';

  @override
  String get assessmentScannerAnswerKeyHint =>
      'సరైన సమాధానాలను అతికించండి, వాటి ప్రకారం మూల్యాంకనం జరుగుతుంది.';

  @override
  String get assessmentScannerAnswerKeyPlaceholder =>
      'సమాధాన కీని టైప్ చేయండి లేదా అతికించండి';

  @override
  String get assessmentScannerPrivacyNote =>
      'మూల్యాంకనం కోసం విద్యార్థి పేరు ఎప్పుడూ పంపబడదు.';

  @override
  String assessmentScannerScoreCaption(String awarded, String max) {
    return '$max లో $awarded మార్కులు';
  }

  @override
  String get assessmentScannerScoreOutOf => '100 లో';

  @override
  String assessmentScannerMarks(String awarded, String max) {
    return '$awarded/$max';
  }

  @override
  String assessmentScannerPagesMeta(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count పేజీలు',
      one: '1 పేజీ',
    );
    return '$_temp0';
  }

  @override
  String assessmentScannerReviewBadge(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count సమీక్షించండి',
      one: '1 సమీక్షించండి',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerQuestionsSection => 'ప్రశ్నల వారీగా';

  @override
  String get assessmentScannerStudentAnswerLabel => 'విద్యార్థి రాసినది';

  @override
  String get assessmentScannerFeedbackLabel => 'అభిప్రాయం';

  @override
  String get assessmentScannerExpectedLabel => 'ఆశించిన సమాధానం';

  @override
  String get assessmentScannerNextStepsSection => 'సిఫార్సు చేసిన తదుపరి దశలు';

  @override
  String get assessmentScannerStudentSection => 'విద్యార్థి కోసం';

  @override
  String get assessmentScannerQualitySection => 'ఫోటో నాణ్యత';

  @override
  String get assessmentScannerNotScored => 'మార్కులు ఇవ్వలేదు';

  @override
  String get assessmentScannerNoContent =>
      'ఏ మార్కులూ రాలేదు. దయచేసి స్పష్టమైన ఫోటోలను ప్రయత్నించండి.';

  @override
  String get assessmentScannerOutcomeCorrect => 'సరైనది';

  @override
  String get assessmentScannerOutcomePartial => 'పాక్షికంగా సరైనది';

  @override
  String get assessmentScannerOutcomeIncorrect => 'తప్పు';

  @override
  String get assessmentScannerReviewChip => 'దీన్ని తనిఖీ చేయండి';

  @override
  String get assessmentScannerSignIn =>
      'సమాధాన పత్రాన్ని మూల్యాంకనం చేయడానికి దయచేసి మళ్లీ సైన్ ఇన్ చేయండి.';

  @override
  String get assessmentScannerUpgradeTitle => 'ఉన్నత ప్రణాళిక అవసరం';

  @override
  String get assessmentScannerUpgradeBody =>
      'సమాధాన పత్రాల మూల్యాంకనం ఉన్నత ప్రణాళికలో భాగం. మూల్యాంకనం కొనసాగించడానికి అప్‌గ్రేడ్ చేయండి.';

  @override
  String get assessmentScannerSeePricing => 'ప్రణాళికలను చూడండి';

  @override
  String get assessmentScannerDailyLimitTitle =>
      'ఈరోజుకి మీ సమాధాన పత్రాలన్నీ పూర్తయ్యాయి';

  @override
  String get assessmentScannerDailyLimitBody =>
      'మీ ప్రణాళికలో ప్రతి రోజు నిర్ణీత సంఖ్యలో సమాధాన పత్రాలు ఉంటాయి. అవి రేపు మళ్లీ ప్రారంభమవుతాయి, లేదా ఉన్నత ప్రణాళికలో పరిమితిని పెంచుకోవచ్చు.';

  @override
  String get assessmentScannerLimitTitle =>
      'మీరు మీ మూల్యాంకన పరిమితిని చేరుకున్నారు';

  @override
  String get assessmentScannerLimitBody =>
      'మీ ప్రణాళికలోని అన్ని సమాధాన పత్రాలను ఉపయోగించారు. అవి వచ్చే నెల మళ్లీ ప్రారంభమవుతాయి, లేదా ఉన్నత ప్రణాళికలో పరిమితిని పెంచుకోవచ్చు.';

  @override
  String get assessmentScannerBusy =>
      'మూల్యాంకన మోడల్ ప్రస్తుతం బిజీగా ఉంది. దయచేసి ఒక నిమిషంలో మళ్లీ ప్రయత్నించండి.';

  @override
  String assessmentScannerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'మూల్యాంకన మోడల్ ప్రస్తుతం బిజీగా ఉంది. దయచేసి సుమారు $seconds సెకన్లలో మళ్లీ ప్రయత్నించండి.',
      one:
          'మూల్యాంకన మోడల్ ప్రస్తుతం బిజీగా ఉంది. దయచేసి సుమారు 1 సెకనులో మళ్లీ ప్రయత్నించండి.',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerTimeout =>
      'మూల్యాంకనం సాధారణం కంటే ఎక్కువ సమయం తీసుకుంటోంది. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get assessmentScannerRephrase =>
      'ఫోటోలను మూల్యాంకనం చేయలేకపోయాం. దయచేసి స్పష్టమైన పేజీలను మళ్లీ అప్‌లోడ్ చేయండి.';

  @override
  String get inboxTitle => 'సందేశాలు';

  @override
  String get inboxSignInTitle => 'మీ సందేశాలు';

  @override
  String get inboxSignInBody => 'మీ సందేశాలను చూడటానికి సైన్ ఇన్ చేయండి';

  @override
  String get inboxEmptyTitle => 'ఇంకా సంభాషణలు లేవు';

  @override
  String get inboxEmptyBody =>
      'మీరు ఉపాధ్యాయులతో అనుసంధానమైనప్పుడు, మీ సంభాషణలు ఇక్కడ కనిపిస్తాయి.';

  @override
  String get inboxErrorBody =>
      'మీ సందేశాలను లోడ్ చేయలేకపోయాం. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get inboxNoMessagesYet => 'ఇంకా సందేశాలు లేవు';

  @override
  String get inboxThreadFallbackTitle => 'సంభాషణ';

  @override
  String get inboxThreadEmptyTitle => 'ఇంకా సందేశాలు లేవు';

  @override
  String get inboxThreadEmptyBody =>
      'సంభాషణను ప్రారంభించడానికి నమస్కారం చెప్పండి.';

  @override
  String get inboxComposerHint => 'ఒక సందేశాన్ని రాయండి';

  @override
  String get inboxComposerSend => 'పంపు';

  @override
  String get inboxComposerTooLong =>
      'సందేశం చాలా పొడవుగా ఉంది. దయచేసి దాన్ని కుదించండి.';

  @override
  String get inboxLoadOlder => 'పాత సందేశాలను లోడ్ చేయండి';

  @override
  String get inboxSendFailed => 'మీ సందేశాన్ని పంపలేకపోయాం.';

  @override
  String get inboxResourceLabel => 'వనరు';

  @override
  String get inboxVoiceNoteLabel => 'వాయిస్ నోట్';

  @override
  String inboxUnreadLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count చదవనివి',
      one: '1 చదవనిది',
    );
    return '$_temp0';
  }

  @override
  String get inboxTickSending => 'పంపుతోంది';

  @override
  String get inboxTickSent => 'పంపబడింది';

  @override
  String get inboxTickDelivered => 'అందింది';

  @override
  String get inboxTickRead => 'చదివారు';

  @override
  String get inboxTickFailed => 'పంపబడలేదు';

  @override
  String get inboxTimeNow => 'ఇప్పుడు';

  @override
  String inboxTimeMinutes(int count) {
    return '$count ని';
  }

  @override
  String inboxTimeHours(int count) {
    return '$count గం';
  }

  @override
  String inboxTimeDays(int count) {
    return '$count రో';
  }

  @override
  String inboxTimeWeeks(int count) {
    return '$count వా';
  }

  @override
  String get networkTitle => 'నెట్‌వర్క్';

  @override
  String get networkTooltip => 'నెట్‌వర్క్';

  @override
  String get networkTabStaffroom => 'స్టాఫ్‌రూమ్';

  @override
  String get networkTabMessages => 'సందేశాలు';

  @override
  String get networkTabUpdates => 'అప్‌డేట్‌లు';

  @override
  String get notificationsEmptyTitle => 'ఇంకా కొత్తగా ఏమీ లేదు';

  @override
  String get notificationsEmptyBody =>
      'కాల్ ఫలితాలు, హాజరు హెచ్చరికలు, సిద్ధమైన ప్రశ్నపత్రాలు జరిగినప్పుడే ఇక్కడ కనిపిస్తాయి.';

  @override
  String get notificationsLocalNote =>
      'మీరు యాప్ తెరిచినప్పుడు ఇవి కనిపిస్తాయి. SahayakAI ఇంకా ఫోన్ నోటిఫికేషన్‌లను పంపదు.';

  @override
  String get notificationsMarkAllRead => 'అన్నింటినీ చదివినట్లు గుర్తించండి';

  @override
  String notificationCallCompletedTitle(String student) {
    return '$student కోసం తల్లిదండ్రులకు కాల్ ముగిసింది';
  }

  @override
  String get notificationCallCompletedBody =>
      'సంభాషణ సారాంశం తల్లిదండ్రులకు కాల్ విభాగంలో సిద్ధంగా ఉంది.';

  @override
  String notificationCallFailedTitle(String student) {
    return '$student కోసం తల్లిదండ్రులకు కాల్ కలవలేదు';
  }

  @override
  String get notificationCallFailedBody =>
      'మళ్లీ కాల్ చేయండి, లేదా సందేశాన్ని WhatsApp లో పంపండి.';

  @override
  String notificationAbsenceTitle(String student, int count) {
    return '$student వరుసగా $count రోజులు గైర్హాజరు';
  }

  @override
  String notificationAbsenceBody(String className) {
    return 'గైర్హాజరైన రోజులు చూడటానికి $className తెరవండి.';
  }

  @override
  String notificationExamPaperTitle(String subject) {
    return '$subject ప్రశ్నపత్రం సిద్ధమవుతోంది';
  }

  @override
  String get notificationExamPaperBody =>
      'ఇది ఇంకా తయారవుతోంది, దానంతట అదే మీ గ్రంథాలయంలో కనిపిస్తుంది.';

  @override
  String get staffroomTitle => 'స్టాఫ్‌రూమ్';

  @override
  String get staffroomHeroTitle => 'స్టాఫ్‌రూమ్';

  @override
  String get staffroomHeroDeck => 'భారతదేశం అంతటా ఉపాధ్యాయులు, ఒకే గదిలో';

  @override
  String get staffroomSectionGroups => 'మీ గ్రూపులు';

  @override
  String get staffroomSectionFeed => 'మీ గ్రూపుల నుండి';

  @override
  String get staffroomSectionDiscover => 'గ్రూపులను కనుగొనండి';

  @override
  String get staffroomSectionPeople => 'మీకు తెలిసిన వారు';

  @override
  String get staffroomSignInTitle => 'స్టాఫ్‌రూమ్‌లో చేరండి';

  @override
  String get staffroomSignInBody => 'స్టాఫ్‌రూమ్‌లో చేరడానికి సైన్ ఇన్ చేయండి';

  @override
  String get staffroomFeedEmptyTitle => 'మీ ఫీడ్ నిశ్శబ్దంగా ఉంది';

  @override
  String get staffroomFeedEmptyBody =>
      'మీ గ్రూపుల పోస్ట్‌లు ఇక్కడ కనిపిస్తాయి.';

  @override
  String get staffroomErrorBody =>
      'మేము స్టాఫ్‌రూమ్‌ను లోడ్ చేయలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get staffroomGroupsEmptyTitle => 'ఇంకా గ్రూపులు లేవు';

  @override
  String get staffroomGroupsEmptyBody =>
      'పోస్ట్‌లు, చాట్ చూడటానికి ఒక గ్రూపులో చేరండి.';

  @override
  String get staffroomBrowseGroups => 'గ్రూపులను బ్రౌజ్ చేయండి';

  @override
  String staffroomMemberCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count సభ్యులు',
      one: '1 సభ్యుడు',
    );
    return '$_temp0';
  }

  @override
  String get staffroomJoin => 'చేరండి';

  @override
  String get staffroomJoined => 'చేరారు';

  @override
  String get staffroomJoinFailed =>
      'చేరలేకపోయాము. మళ్లీ ప్రయత్నించడానికి ట్యాప్ చేయండి.';

  @override
  String get staffroomGroupLockedTitle => 'సభ్యులకు మాత్రమే';

  @override
  String get staffroomGroupLockedBody => 'ఈ గ్రూపు పోస్ట్‌లు చూడటానికి చేరండి.';

  @override
  String get staffroomGroupPostsEmptyTitle => 'ఇంకా పోస్ట్‌లు లేవు';

  @override
  String get staffroomGroupPostsEmptyBody => 'ఇక్కడ మొదట షేర్ చేయండి.';

  @override
  String get staffroomGroupNotFoundTitle => 'గ్రూపు కనబడలేదు';

  @override
  String get staffroomGroupNotFoundBody => 'ఈ గ్రూపు తీసివేయబడి ఉండవచ్చు.';

  @override
  String get staffroomPostTypeShare => 'షేర్ చేశారు';

  @override
  String get staffroomPostTypeAskHelp => 'సహాయం కావాలి';

  @override
  String get staffroomPostTypeCelebrate => 'వేడుక';

  @override
  String get staffroomPostTypeResource => 'వనరు';

  @override
  String get staffroomLike => 'ఇష్టం';

  @override
  String get staffroomLiked => 'ఇష్టపడ్డారు';

  @override
  String staffroomLikeCountLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ఇష్టాలు',
      one: '1 ఇష్టం',
      zero: 'ఇష్టాలు లేవు',
    );
    return '$_temp0';
  }

  @override
  String get staffroomLikeFailed =>
      'అప్‌డేట్ చేయలేకపోయాము. మళ్లీ ప్రయత్నించడానికి ట్యాప్ చేయండి.';

  @override
  String get staffroomResourceShared => 'ఒక వనరును షేర్ చేశారు';

  @override
  String staffroomChatHighlight(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count కొత్త సందేశాలు',
      one: '1 కొత్త సందేశం',
    );
    return '$_temp0';
  }

  @override
  String get staffroomConnect => 'కనెక్ట్ అవ్వండి';

  @override
  String get staffroomConnectSent => 'అభ్యర్థన పంపబడింది';

  @override
  String get staffroomConnectPending => 'అభ్యర్థన ఇప్పటికే పెండింగ్‌లో ఉంది';

  @override
  String get staffroomConnectConnected => 'ఇప్పటికే కనెక్ట్ అయ్యారు';

  @override
  String get staffroomChatTitle => 'స్టాఫ్‌రూమ్';

  @override
  String get staffroomChatEntryBody =>
      'భారతదేశం అంతటా ఉన్న ఉపాధ్యాయులతో చాట్ చేయండి';

  @override
  String get staffroomChatSignInTitle => 'స్టాఫ్‌రూమ్‌లో చేరండి';

  @override
  String get staffroomChatSignInBody =>
      'స్టాఫ్‌రూమ్‌లో చేరడానికి సైన్ ఇన్ చేయండి';

  @override
  String get staffroomChatEmptyTitle => 'ఇంకా సందేశాలు లేవు';

  @override
  String get staffroomChatEmptyBody => 'ముందుగా నమస్కారం చెప్పండి.';

  @override
  String get staffroomChatAiBadge => 'AI ఉపాధ్యాయుడు';

  @override
  String get staffroomGroupChatEntry => 'గ్రూప్ చాట్';

  @override
  String get staffroomDirectoryTitle => 'ఉపాధ్యాయులను కనుగొనండి';

  @override
  String get staffroomDirectoryEntryBody => 'ఉపాధ్యాయ డైరెక్టరీలో వెతకండి';

  @override
  String get staffroomDirectorySearchHint => 'పేరు లేదా విషయం ద్వారా వెతకండి';

  @override
  String get staffroomDirectoryErrorBody =>
      'డైరెక్టరీని లోడ్ చేయలేకపోయాం. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get staffroomDirectoryEmptyTitle => 'ఉపాధ్యాయులు ఎవరూ దొరకలేదు';

  @override
  String get staffroomDirectoryEmptyBody =>
      'చూపించడానికి ఇంకా ఉపాధ్యాయులు ఎవరూ లేరు.';

  @override
  String get staffroomDirectorySearchEmpty =>
      'మీ శోధనకు ఏ ఉపాధ్యాయులూ సరిపోలలేదు.';

  @override
  String get staffroomProfileTitle => 'ఉపాధ్యాయుడు';

  @override
  String get staffroomProfileErrorBody =>
      'ఈ ప్రొఫైల్‌ను లోడ్ చేయలేకపోయాం. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get staffroomProfileNotFoundTitle => 'ప్రొఫైల్ అందుబాటులో లేదు';

  @override
  String get staffroomProfileNotFoundBody => 'ఈ ప్రొఫైల్ కనుగొనబడలేదు.';

  @override
  String get staffroomProfileAboutLabel => 'పరిచయం';

  @override
  String get staffroomProfileBioEmpty => 'ఇంకా పరిచయం ఏదీ లేదు.';

  @override
  String get staffroomProfileVerified => 'ధృవీకరించబడింది';

  @override
  String staffroomProfileExperience(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count సంవత్సరాల అనుభవం',
      one: '1 సంవత్సర అనుభవం',
    );
    return '$_temp0';
  }

  @override
  String get staffroomProfileSubjectsLabel => 'విషయాలు';

  @override
  String get staffroomProfileClassesLabel => 'తరగతులు';

  @override
  String get staffroomProfileLanguagesLabel => 'భాషలు';

  @override
  String get staffroomRequested => 'అభ్యర్థన పంపబడింది';

  @override
  String get staffroomConnectionAccept => 'అంగీకరించండి';

  @override
  String get staffroomConnectionDecline => 'తిరస్కరించండి';

  @override
  String get staffroomConnected => 'కనెక్ట్ అయ్యారు';

  @override
  String get staffroomConnectionWants => 'కనెక్ట్ కావాలనుకుంటున్నారు';

  @override
  String get staffroomMessage => 'సందేశం పంపండి';

  @override
  String get staffroomConnectToMessage => 'సందేశం పంపడానికి కనెక్ట్ అవ్వండి';

  @override
  String get staffroomConnectionFailed =>
      'అప్‌డేట్ చేయలేకపోయాం. మళ్లీ ప్రయత్నించడానికి ట్యాప్ చేయండి.';

  @override
  String get staffroomDisconnect => 'డిస్‌కనెక్ట్ చేయండి';

  @override
  String get staffroomDisconnectConfirmTitle => 'డిస్‌కనెక్ట్ చేయాలా?';

  @override
  String get staffroomDisconnectConfirmBody =>
      'మీరు ఇక కనెక్ట్‌గా ఉండరు లేదా ఒకరికొకరు సందేశం పంపలేరు.';

  @override
  String get staffroomDisconnectCancel => 'కనెక్ట్‌గా ఉండండి';

  @override
  String get staffroomFollow => 'ఫాలో అవ్వండి';

  @override
  String get staffroomFollowing => 'ఫాలో అవుతున్నారు';

  @override
  String get staffroomFollowFailed =>
      'అప్‌డేట్ చేయలేకపోయాం. మళ్లీ ప్రయత్నించడానికి ట్యాప్ చేయండి.';

  @override
  String get actionShare => 'షేర్ చేయండి';

  @override
  String get resultSaveToLibrary => 'గ్రంథాలయంలో సేవ్ చేయండి';

  @override
  String get resultSaving => 'సేవ్ అవుతోంది';

  @override
  String get resultSaved => 'మీ గ్రంథాలయంలో సేవ్ చేయబడింది';

  @override
  String get resultSaveFailedTitle => 'సేవ్ చేయలేకపోయాము';

  @override
  String get resultSaveFailedBody =>
      'దీన్ని మీ గ్రంథాలయంలో సేవ్ చేయలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get resultSaveRetry => 'మళ్లీ సేవ్ చేయడానికి ప్రయత్నించండి';

  @override
  String get resultShareFailed =>
      'షేర్ చేయలేకపోయాము. బదులుగా వచనం క్లిప్‌బోర్డుకు కాపీ చేయబడింది.';

  @override
  String get actionCancel => 'రద్దు చేయండి';

  @override
  String get attendanceTitle => 'హాజరు';

  @override
  String get attendanceClassesEyebrow => 'మీ తరగతులు';

  @override
  String get attendanceClassesIntro =>
      'హాజరు పట్టీ నింపడానికి ఒక తరగతిని ఎంచుకోండి.';

  @override
  String get attendanceClassesEmptyTitle => 'ఇంకా తరగతులు లేవు';

  @override
  String get attendanceClassesEmptyBody =>
      'ముందుగా మీ తరగతిని సృష్టించి, ఆ తర్వాత అందులో విద్యార్థులను చేర్చండి.';

  @override
  String get attendanceClassesError => 'మీ తరగతులను మేము తీసుకురాలేకపోయాము.';

  @override
  String get attendanceClassFullBadge => 'నిండింది';

  @override
  String get attendanceNewClass => 'కొత్త తరగతి';

  @override
  String get attendanceOpenRegister => 'పట్టీ నింపండి';

  @override
  String get attendanceOpenRoster => 'విద్యార్థులు';

  @override
  String get attendanceOpenMonth => 'ఈ నెల';

  @override
  String get attendanceSignedOutTitle =>
      'మీ తరగతులను చూడటానికి సైన్ ఇన్ చేయండి';

  @override
  String get attendanceSignedOutBody =>
      'మీ తరగతులు, హాజరు పట్టీలు మీ ఖాతాలో భద్రంగా ఉంటాయి. సైన్ ఇన్ చేస్తే అవి ఇక్కడ కనిపిస్తాయి.';

  @override
  String get attendanceClassNameLabel => 'తరగతి పేరు';

  @override
  String get attendanceClassNameHint => 'ఉదాహరణకు, తరగతి 6A';

  @override
  String get attendanceClassNameRequired => 'తరగతి పేరును నమోదు చేయండి.';

  @override
  String get attendanceSubjectLabel => 'సబ్జెక్టు';

  @override
  String get attendanceGradeLabel => 'తరగతి స్థాయి';

  @override
  String get attendanceAcademicYearLabel => 'విద్యా సంవత్సరం';

  @override
  String get attendanceAcademicYearHint => 'ఉదాహరణకు, 2026-27';

  @override
  String get attendanceAcademicYearRequired =>
      'విద్యా సంవత్సరాన్ని నమోదు చేయండి.';

  @override
  String get attendanceSectionLabel => 'సెక్షన్';

  @override
  String get attendanceSectionHint => 'ఉదాహరణకు, A';

  @override
  String get attendanceCreateClassSubmit => 'తరగతిని సృష్టించండి';

  @override
  String get attendanceClassCreated => 'తరగతి సృష్టించబడింది.';

  @override
  String get attendanceCreateClassFailed => 'ఈ తరగతిని మేము సృష్టించలేకపోయాము.';

  @override
  String get attendanceRosterEyebrow => 'తరగతి జాబితా';

  @override
  String get attendanceRosterUnavailableTitle =>
      'జాబితా ఇంకా చూపడానికి సిద్ధంగా లేదు';

  @override
  String get attendanceRosterUnavailableBody =>
      'తల్లిదండ్రుల సంప్రదింపు వివరాలు మా సర్వర్లలో మరుగుపరచిన రూపానికి మారుతున్నాయి; అది అమలులోకి వచ్చే వరకు ఈ యాప్ వాటిని దించుకోదు. మీ తరగతిలో ఏ లోపమూ లేదు, ఏదీ పోలేదు. హాజరు పట్టీ నింపడం, నెలవారీ వివరాలు మామూలుగానే పనిచేస్తాయి.';

  @override
  String get attendanceRosterEmptyTitle => 'ఇంకా విద్యార్థులు లేరు';

  @override
  String get attendanceRosterEmptyBody =>
      'హాజరు పట్టీ నింపడం మొదలుపెట్టడానికి ఈ తరగతి విద్యార్థులను చేర్చండి.';

  @override
  String get attendanceRosterError => 'ఈ జాబితాను మేము తీసుకురాలేకపోయాము.';

  @override
  String attendanceRollLabel(int roll) {
    return 'రోల్ $roll';
  }

  @override
  String get attendanceNoParentPhone => 'తల్లిదండ్రుల నంబరు భద్రపరచలేదు';

  @override
  String attendanceParentPhoneMask(String last4) {
    return '•••• $last4';
  }

  @override
  String get attendanceAddStudent => 'విద్యార్థిని చేర్చండి';

  @override
  String get attendanceStudentNameLabel => 'విద్యార్థి పేరు';

  @override
  String get attendanceStudentNameRequired => 'విద్యార్థి పేరును నమోదు చేయండి.';

  @override
  String get attendanceRollNumberLabel => 'రోల్ నంబరు';

  @override
  String get attendanceRollNumberHint => '1 నుండి 40 వరకు';

  @override
  String get attendanceRollNumberInvalid =>
      'రోల్ నంబరు 1 నుండి 40 మధ్య పూర్ణ సంఖ్య అయి ఉండాలి.';

  @override
  String get attendanceParentPhoneLabel => 'తల్లిదండ్రుల మొబైల్ నంబరు';

  @override
  String get attendanceParentPhoneHint => '10 అంకెల భారతీయ మొబైల్ నంబరు';

  @override
  String get attendanceParentPhoneRequired =>
      'తల్లిదండ్రుల మొబైల్ నంబరును నమోదు చేయండి.';

  @override
  String get attendanceParentPhoneInvalid =>
      '10 అంకెల భారతీయ మొబైల్ నంబరును నమోదు చేయండి.';

  @override
  String get attendanceParentLanguageLabel => 'తల్లిదండ్రుల భాష';

  @override
  String get attendanceParentPhonePrivacy =>
      'మీ తరఫున ఈ తల్లిదండ్రులకు కాల్ చేయడానికి ఈ నంబరు SahayakAI కి పంపబడుతుంది. ఇది ఎప్పుడూ ఈ ఫోనుకు తిరిగి దించుకోబడదు.';

  @override
  String get attendanceStudentAdded => 'విద్యార్థి చేర్చబడ్డారు.';

  @override
  String get attendanceAddStudentFailed =>
      'ఈ విద్యార్థిని మేము చేర్చలేకపోయాము.';

  @override
  String get attendanceClassFullTitle => 'ఈ తరగతి నిండిపోయింది';

  @override
  String attendanceClassFullBody(int max) {
    return 'ఒక తరగతిలో గరిష్ఠంగా $max మంది విద్యార్థులు ఉండవచ్చు, కాబట్టి ఇంకా చేర్చలేరు.';
  }

  @override
  String get attendanceMarkEyebrow => 'రోజువారీ పట్టీ';

  @override
  String get attendanceMarkIntro =>
      'ఈ రోజు, లేదా దానికి ముందటి ఏడు రోజుల్లో ఏదైనా ఒక రోజు నింపండి.';

  @override
  String get attendanceDateToday => 'ఈ రోజు';

  @override
  String get attendanceDateYesterday => 'నిన్న';

  @override
  String get attendanceWindowNote =>
      'పట్టీ ఈ రోజుకు, దానికి ముందటి ఏడు రోజులకు తెరిచి ఉంటుంది. అంతకంటే పాత రోజులు మూసివేయబడతాయి.';

  @override
  String get attendanceStatusPresent => 'హాజరు';

  @override
  String get attendanceStatusAbsent => 'గైర్హాజరు';

  @override
  String get attendanceStatusLate => 'ఆలస్యం';

  @override
  String get attendanceStatusUnmarked => 'నమోదు కాలేదు';

  @override
  String attendanceMarkProgress(int marked, int total) {
    return '$total లో $marked మంది నమోదయ్యారు';
  }

  @override
  String get attendanceMarkAllPresent => 'అందరినీ హాజరుగా గుర్తించండి';

  @override
  String get attendanceSaveRegister => 'పట్టీని భద్రపరచండి';

  @override
  String get attendanceRegisterSaved => 'పట్టీ భద్రపరచబడింది.';

  @override
  String get attendanceSaveRegisterFailed => 'ఈ పట్టీని మేము భద్రపరచలేకపోయాము.';

  @override
  String get attendanceRegisterError => 'ఈ పట్టీని మేము తీసుకురాలేకపోయాము.';

  @override
  String get attendanceNoStudentsTitle => 'ఈ తరగతిలో ఇంకా విద్యార్థులు లేరు';

  @override
  String get attendanceNoStudentsBody =>
      'పట్టీ నింపే ముందు విద్యార్థిని చేర్చండి.';

  @override
  String get attendanceMonthEyebrow => 'నెలవారీ హాజరు';

  @override
  String get attendanceMonthError => 'ఈ నెల వివరాలను మేము తీసుకురాలేకపోయాము.';

  @override
  String get attendanceMonthEmptyTitle => 'ఈ నెలలో ఏదీ నమోదు కాలేదు';

  @override
  String get attendanceMonthEmptyBody =>
      'పట్టీ నింపడం మొదలుపెట్టగానే ప్రతి విద్యార్థి నెల ఇక్కడ కనిపిస్తుంది.';

  @override
  String get attendanceMonthPrevious => 'గత నెల';

  @override
  String get attendanceMonthNext => 'వచ్చే నెల';

  @override
  String get attendanceAbsencesTitle => 'గైర్హాజరు రోజులు';

  @override
  String get attendanceAbsencesEmpty => 'ఈ నెలలో గైర్హాజరు లేదు.';

  @override
  String get attendanceAbsencesError =>
      'గైర్హాజరు రోజులను మేము తీసుకురాలేకపోయాము.';

  @override
  String get attendancePremiumTitle => 'పట్టీ నింపడానికి Pro ప్లాన్ కావాలి';

  @override
  String get attendancePremiumBody =>
      'మీ తరగతులు, పట్టీలు, నెలవారీ వివరాలు చూడటం ఉచితంగానే ఉంటుంది. తరగతిని సృష్టించడం, విద్యార్థిని చేర్చడం, పట్టీని భద్రపరచడం Pro ప్లాన్‌లో భాగం.';

  @override
  String get deliverTrayTitle => 'అందించు';

  @override
  String get deliverPrivacyNote =>
      'మీరు పంపు నొక్కే వరకు ఫోన్ నుండి ఏదీ బయటకు వెళ్లదు.';

  @override
  String get deliverSend => 'పంపండి';

  @override
  String get deliverParentGroup => 'తల్లిదండ్రుల గుంపు';

  @override
  String get deliverParentGroupMeta => 'WhatsAppలో పంచుకోండి';

  @override
  String get deliverPrint => 'ప్రింట్';

  @override
  String get deliverPrintMeta => 'ప్రింటర్‌కు పంపండి';

  @override
  String get deliverSaveToClass => 'తరగతిలో సేవ్ చేయండి';

  @override
  String get deliverSaveToClassMeta => 'మీ లైబ్రరీలో ఉంచండి';

  @override
  String get deliverPostCommunity => 'కమ్యూనిటీలో పోస్ట్ చేయండి';

  @override
  String get deliverPostCommunityMeta => 'వనరుగా పంచుకోండి';

  @override
  String get deliverDownloadPdf => 'PDF డౌన్‌లోడ్ చేయండి';

  @override
  String get deliverDownloadPdfMeta => 'ఆఫ్‌లైన్‌లో పనిచేస్తుంది';

  @override
  String get deliverReadAloud => 'బిగ్గరగా చదవండి';

  @override
  String get deliverReadAloudMeta => 'తరగతికి';

  @override
  String get settingsOrbHandTitle => 'తేలియాడే సహాయకుడు';

  @override
  String get settingsOrbHandLabel => 'ఎడమవైపు';

  @override
  String get settingsOrbHandHint => 'మీ బొటనవేలు అందే చోట VIDYAను ఉంచండి';
}
