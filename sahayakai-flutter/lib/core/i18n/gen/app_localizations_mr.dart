// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Marathi (`mr`).
class AppLocalizationsMr extends AppLocalizations {
  AppLocalizationsMr([String locale = 'mr']) : super(locale);

  @override
  String get appTitle => 'SahayakAI';

  @override
  String get navHome => 'मुख्यपृष्ठ';

  @override
  String get navCreate => 'तयार करा';

  @override
  String get navLibrary => 'ग्रंथालय';

  @override
  String get navProfile => 'प्रोफाइल';

  @override
  String get actionRetry => 'पुन्हा प्रयत्न करा';

  @override
  String get actionSignIn => 'साइन इन करा';

  @override
  String get actionSignOut => 'साइन आउट';

  @override
  String get actionGenerate => 'तयार करा';

  @override
  String get stateOfflineTitle => 'तुम्ही ऑफलाइन आहात';

  @override
  String get stateOfflineBody => 'तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.';

  @override
  String get errorGeneric => 'काहीतरी चूक झाली. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get emptyDefault => 'फॉर्म भरा आणि तयार करा वर टॅप करा.';

  @override
  String get languageLabel => 'भाषा';

  @override
  String get splashTagline => 'प्रत्येक वर्गासाठी शिक्षण सहाय्यक';

  @override
  String get splashFailedTitle => 'आम्ही ॲप सुरू करू शकलो नाही';

  @override
  String get splashFailedBody =>
      'कृपया तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.';

  @override
  String get loginTitle => 'SahayakAI मध्ये आपले स्वागत आहे';

  @override
  String get loginSubtitle =>
      'पाठ योजना, प्रश्नमंजुषा आणि बरेच काही यासाठी साइन इन करा.';

  @override
  String get loginGoogle => 'Google सह सुरू ठेवा';

  @override
  String get loginPrivacyNote =>
      'आम्ही तुमचे Google खाते फक्त साइन इन करण्यासाठी वापरतो. तुमचे काम तुमचेच राहते.';

  @override
  String get loginLanguagePrompt => 'तुमची भाषा निवडा';

  @override
  String get loginLanguageHint =>
      'SahayakAI तुमच्या भाषेत काम करते, आणि तुमचे शिक्षण साहित्यही त्याच भाषेत लिहिते.';

  @override
  String get loginValueLessons => 'मिनिटांत संपूर्ण धडा योजना तयार करा';

  @override
  String get loginValueQuizzes => 'तीन अवघडपणाच्या स्तरांवर क्विझ तयार करा';

  @override
  String get loginValueAnswers =>
      'तुमच्या भाषेत, वर्गातील कोणत्याही प्रश्नाचे उत्तर द्या';

  @override
  String get onboardingTitle => 'SahayakAI सेट करा';

  @override
  String get onboardingSkip => 'आत्ता वगळा';

  @override
  String onboardingStepLabel(int current, int total) {
    return '$total पैकी टप्पा $current';
  }

  @override
  String get onboardingBack => 'मागे';

  @override
  String get onboardingNext => 'पुढे';

  @override
  String get onboardingSaveAndContinue => 'जतन करा आणि पुढे सुरू ठेवा';

  @override
  String get onboardingFinish => 'माझ्या डॅशबोर्डवर जा';

  @override
  String get onboardingLanguageTitle => 'तुम्ही कोणत्या भाषेत शिकवता?';

  @override
  String get onboardingLanguageBody =>
      'तुम्ही निवडलेल्या भाषेतच धडा योजना, क्विझ आणि उत्तरे मिळतील. तुम्ही ते केव्हाही बदलू शकता.';

  @override
  String get onboardingProfileTitle => 'तुमच्या वर्गाबद्दल आम्हाला सांगा';

  @override
  String get onboardingProfileBody =>
      'प्रत्येक फील्ड पर्यायी आहे. तुम्ही जे शेअर कराल त्याचा वापर तुमचे साहित्य तुमच्या बोर्ड, वर्ग आणि राज्याशी जुळवण्यासाठी केला जातो.';

  @override
  String get onboardingReadyTitle => 'तुम्ही सुरुवात करण्यासाठी तयार आहात';

  @override
  String get onboardingReadyBody =>
      'तुमच्या धडा योजना, क्विझ आणि उत्तरे यानुसार असतील. तुम्ही नंतर केव्हाही तुमच्या प्रोफाइलमधून हे बदलू शकता.';

  @override
  String get onboardingSaveFailed =>
      'आम्ही तुमची प्रोफाइल जतन करू शकलो नाही. तुम्ही आत्ता पुढे सुरू ठेवू शकता आणि नंतर ते तुमच्या प्रोफाइलमधून जोडू शकता.';

  @override
  String get onboardingSaveSignIn =>
      'तुमची प्रोफाइल जतन करण्यासाठी कृपया पुन्हा साइन इन करा. तुम्ही आत्ता पुढे सुरू ठेवू शकता आणि नंतर ते जोडू शकता.';

  @override
  String get dashboardGreeting => 'पुन्हा स्वागत आहे';

  @override
  String dashboardGreetingNamed(String name) {
    return 'पुन्हा स्वागत आहे, $name';
  }

  @override
  String get dashboardGreetingMorning => 'सुप्रभात';

  @override
  String get dashboardGreetingAfternoon => 'शुभ दुपार';

  @override
  String get dashboardGreetingEvening => 'शुभ संध्याकाळ';

  @override
  String get actionOpen => 'उघडा';

  @override
  String get actionRegenerate => 'पुन्हा तयार करा';

  @override
  String get actionCopy => 'कॉपी करा';

  @override
  String get copyConfirmation => 'क्लिपबोर्डवर कॉपी केले';

  @override
  String get readAloudListen => 'ऐका';

  @override
  String get readAloudStop => 'थांबवा';

  @override
  String get readAloudError =>
      'ऑडिओ वाजवता आला नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String voiceResultReady(String tool) {
    return 'तुमचे $tool तयार आहे.';
  }

  @override
  String voiceResultReadyWithTopic(String tool, String topic) {
    return '$topic वरील तुमचे $tool तयार आहे.';
  }

  @override
  String get lessonPlanSectionLesson => 'धडा';

  @override
  String get lessonPlanSectionApproach => 'अध्यापन दृष्टिकोन';

  @override
  String get quizSectionQuiz => 'क्विझ';

  @override
  String get sectionForYourClass => 'तुमच्या वर्गासाठी';

  @override
  String get instantAnswerResultTitle => 'उत्तर';

  @override
  String get dashboardToolsTitle => 'तुमची शिक्षण साधने';

  @override
  String get createPaletteSearchHint => 'साधने शोधा';

  @override
  String get createPaletteEmpty => 'तुमच्या शोधाशी जुळणारे कोणतेही साधन नाही';

  @override
  String get dashboardRecentTitle => 'अलीकडील काम';

  @override
  String get dashboardRecentEmpty =>
      'तुम्ही तयार केलेले सर्व येथे जतन होते, पुन्हा उघडण्यासाठी तयार.';

  @override
  String get dashboardRecentFailed =>
      'आम्ही तुमचे अलीकडील काम उघडू शकलो नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get dashboardRecentSignedOut =>
      'तुमचे अलीकडील काम पाहण्यासाठी साइन इन करा.';

  @override
  String get dashboardUntitled => 'शीर्षक नाही';

  @override
  String get dashboardSetupTitle => 'तुमची प्रोफाइल पूर्ण करा';

  @override
  String get dashboardSetupBody =>
      'तुमची शाळा आणि तुमचे वर्ग जोडा, म्हणजे प्रत्येक पाठ योजना आणि क्विझ तुमच्या वर्गासाठी तयार मिळेल.';

  @override
  String get dashboardSetupAction => 'माझी प्रोफाइल सेट करा';

  @override
  String get dashboardSetupDismiss => 'आत्ता नको';

  @override
  String get contentTypeLessonPlan => 'पाठ योजना';

  @override
  String get contentTypeQuiz => 'क्विझ';

  @override
  String get contentTypeWorksheet => 'कार्यपत्रिका';

  @override
  String get contentTypeVisualAid => 'दृश्य साधन';

  @override
  String get contentTypeRubric => 'रूब्रिक';

  @override
  String get contentTypeMicroLesson => 'सूक्ष्म धडा';

  @override
  String get contentTypeVirtualFieldTrip => 'व्हर्च्युअल फील्ड ट्रिप';

  @override
  String get contentTypeInstantAnswer => 'झटपट उत्तर';

  @override
  String get contentTypeTeacherTraining => 'शिक्षक प्रशिक्षण';

  @override
  String get contentTypeExamPaper => 'प्रश्नपत्रिका';

  @override
  String get contentTypeAssessment => 'मूल्यांकन';

  @override
  String get contentTypeAssessmentSubmission => 'स्कॅन केलेले मूल्यमापन';

  @override
  String get contentTypeUnknown => 'जतन केलेले काम';

  @override
  String get libraryTitle => 'माझे ग्रंथालय';

  @override
  String get librarySectionSaved => 'जतन केलेले काम';

  @override
  String get libraryEmpty =>
      'तुमच्या जतन केलेल्या पाठ योजना आणि प्रश्नमंजुषा येथे दिसतील.';

  @override
  String get libraryEmptyAction => 'पाठ योजना तयार करा';

  @override
  String get librarySignedOut =>
      'तुमचे जतन केलेले काम पाहण्यासाठी साइन इन करा.';

  @override
  String get libraryLoadFailed => 'तुमचे ग्रंथालय लोड होऊ शकले नाही.';

  @override
  String get libraryNewestOnly => 'तुमच्या अलीकडील 20 नोंदी दाखवत आहोत.';

  @override
  String get libraryFilterAll => 'सर्व';

  @override
  String get libraryFilterEmpty =>
      'या प्रकारचे कोणतेही जतन केलेले काम अजून नाही.';

  @override
  String get libraryDetailTitle => 'जतन केलेली नोंद';

  @override
  String libraryDetailSavedOn(String date) {
    return '$date रोजी जतन केले';
  }

  @override
  String get libraryDetailSignedOut =>
      'तुमचे जतन केलेले काम उघडण्यासाठी साइन इन करा.';

  @override
  String get libraryDetailNotFound => 'ही नोंद आता तुमच्या ग्रंथालयात नाही.';

  @override
  String get libraryDetailLoadFailed =>
      'आम्ही ही जतन केलेली नोंद उघडू शकलो नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String libraryDetailReady(String type) {
    return 'तुम्ही तुमचे जतन केलेले $type पाहत आहात.';
  }

  @override
  String get profileTitle => 'प्रोफाइल';

  @override
  String get lessonPlanTitle => 'पाठ योजना';

  @override
  String get lessonPlanSubtitle => 'संपूर्ण 5E धड्याची योजना करा';

  @override
  String get lessonPlanEmpty =>
      'टॉपिक लिहा आणि 5E पाठ योजना तयार करण्यासाठी तयार करा दाबा.';

  @override
  String get lessonPlanTopicLabel => 'टॉपिक';

  @override
  String get lessonPlanTopicHint => 'उदाहरणार्थ, प्रकाशसंश्लेषण';

  @override
  String get lessonPlanTopicError => 'कृपया नियोजनासाठी टॉपिक लिहा.';

  @override
  String get lessonPlanGradeLabel => 'इयत्ता स्तर';

  @override
  String get lessonPlanSubjectLabel => 'विषय';

  @override
  String get lessonPlanSubjectAny => 'कोणताही विषय';

  @override
  String get lessonPlanResourceLabel => 'वर्गातील साधनसामग्री';

  @override
  String get lessonPlanResourceLow => 'कमी';

  @override
  String get lessonPlanResourceMedium => 'मध्यम';

  @override
  String get lessonPlanResourceHigh => 'भरपूर';

  @override
  String get lessonPlanDifficultyLabel => 'अवघडपणा';

  @override
  String get lessonPlanDifficultyRemedial => 'उपचारात्मक';

  @override
  String get lessonPlanDifficultyStandard => 'सर्वसाधारण';

  @override
  String get lessonPlanDifficultyAdvanced => 'प्रगत';

  @override
  String get lessonPlanRuralLabel => 'स्थानिक, रोजची उदाहरणे वापरा';

  @override
  String get lessonPlanRuralHint =>
      'कृती ओळखीच्या ग्रामीण आणि सामाजिक संदर्भात ठेवा.';

  @override
  String get lessonPlanOptional => 'पर्यायी';

  @override
  String get lessonPlanObjectives => 'अध्ययन उद्दिष्टे';

  @override
  String get lessonPlanVocabulary => 'महत्त्वाचे शब्द';

  @override
  String get lessonPlanMaterials => 'साहित्य';

  @override
  String get lessonPlanActivities => '5E कृती';

  @override
  String get lessonPlanAssessment => 'मूल्यांकन';

  @override
  String get lessonPlanHomework => 'गृहपाठ';

  @override
  String get lessonPlanTeacherTip => 'शिक्षकांसाठी टीप';

  @override
  String get lessonPlanUnderstandingCheck => 'आकलन तपासा';

  @override
  String get lessonPlanNoteLabel => 'सुरू करण्यापूर्वी एक सूचना';

  @override
  String get lessonPlanUpgradeTitle => 'उच्च योजना आवश्यक आहे';

  @override
  String get lessonPlanUpgradeBody =>
      'पाठ योजना तयार करणे उच्च योजनेचा भाग आहे. योजना तयार करत राहण्यासाठी कृपया अपग्रेड करा.';

  @override
  String get lessonPlanLimitTitle =>
      'तुम्ही तुमच्या मर्यादेपर्यंत पोहोचला आहात';

  @override
  String get lessonPlanLimitBody =>
      'तुम्ही सध्याच्या पाठ योजना वापरल्या आहेत. कृपया नंतर पुन्हा प्रयत्न करा किंवा योजना अपग्रेड करा.';

  @override
  String get lessonPlanSeePricing => 'योजना आणि किंमती पहा';

  @override
  String get lessonPlanRephrase =>
      'त्यावरून आम्ही योजना तयार करू शकलो नाही. कृपया टॉपिक पुन्हा लिहा आणि प्रयत्न करा.';

  @override
  String get lessonPlanBusy =>
      'सहायक आत्ता व्यस्त आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.';

  @override
  String get lessonPlanTimeout =>
      'यास अपेक्षेपेक्षा जास्त वेळ लागत आहे. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get lessonPlanSignIn =>
      'हे साधन वापरण्यासाठी कृपया पुन्हा साइन इन करा.';

  @override
  String get quizTitle => 'क्विझ';

  @override
  String get quizSubtitle => 'तीन अवघडपणाच्या स्तरांवर क्विझ तयार करा';

  @override
  String get quizEmpty => 'टॉपिक लिहा आणि क्विझ तयार करण्यासाठी तयार करा दाबा.';

  @override
  String get quizTopicLabel => 'टॉपिक';

  @override
  String get quizTopicHint => 'उदाहरणार्थ, अपूर्णांक';

  @override
  String get quizTopicError => 'कृपया क्विझसाठी टॉपिक लिहा.';

  @override
  String get quizNumQuestionsLabel => 'प्रश्नांची संख्या';

  @override
  String get quizFewerQuestions => 'कमी प्रश्न';

  @override
  String get quizMoreQuestions => 'अधिक प्रश्न';

  @override
  String get quizTypesLabel => 'प्रश्नांचे प्रकार';

  @override
  String get quizTypesError => 'कृपया किमान एक प्रश्नप्रकार निवडा.';

  @override
  String get quizTypeMultipleChoice => 'बहुपर्यायी';

  @override
  String get quizTypeFillInTheBlanks => 'रिकाम्या जागा भरा';

  @override
  String get quizTypeShortAnswer => 'थोडक्यात उत्तर';

  @override
  String get quizTypeTrueFalse => 'खरे की खोटे';

  @override
  String get quizGradeLabel => 'इयत्ता स्तर';

  @override
  String get quizGradeAny => 'कोणतीही इयत्ता';

  @override
  String get quizSubjectLabel => 'विषय';

  @override
  String get quizSubjectAny => 'कोणताही विषय';

  @override
  String get quizDifficultyLabel => 'अवघडपणा';

  @override
  String get quizDifficultyHint =>
      'सोपी, मध्यम आणि कठीण अशा तिन्ही आवृत्त्या हव्या असल्यास हे सर्व स्तरांवर ठेवा.';

  @override
  String get quizDifficultyAll => 'सर्व स्तर';

  @override
  String get quizDifficultyEasy => 'सोपे';

  @override
  String get quizDifficultyMedium => 'मध्यम';

  @override
  String get quizDifficultyHard => 'कठीण';

  @override
  String get quizBloomsLabel => 'विचार कौशल्ये';

  @override
  String get quizBloomsHint =>
      'प्रश्नांनी कोणत्या प्रकारचा विचार मागावा ते निवडा.';

  @override
  String get quizOptional => 'पर्यायी';

  @override
  String quizQuestionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count प्रश्न',
      one: '1 प्रश्न',
    );
    return '$_temp0';
  }

  @override
  String get quizShowAnswer => 'उत्तर दाखवा';

  @override
  String get quizHideAnswer => 'उत्तर लपवा';

  @override
  String get quizShowAllAnswers => 'सर्व उत्तरे दाखवा';

  @override
  String get quizHideAllAnswers => 'सर्व उत्तरे लपवा';

  @override
  String get quizCorrectAnswer => 'बरोबर उत्तर';

  @override
  String get quizExplanation => 'कारण';

  @override
  String get quizTeacherInstructions => 'वर्गात हे कसे घ्यावे';

  @override
  String get quizNoteLabel => 'सुरू करण्यापूर्वी एक सूचना';

  @override
  String get quizNoQuestions =>
      'त्या टॉपिकसाठी कोणतेही प्रश्न मिळाले नाहीत. कृपया वेगळा टॉपिक वापरून पहा.';

  @override
  String get quizUpgradeTitle => 'उच्च योजना आवश्यक आहे';

  @override
  String get quizUpgradeBody =>
      'क्विझ तयार करणे उच्च योजनेचा भाग आहे. क्विझ तयार करत राहण्यासाठी कृपया अपग्रेड करा.';

  @override
  String get quizLimitTitle => 'तुम्ही तुमच्या मर्यादेपर्यंत पोहोचला आहात';

  @override
  String get quizLimitBody =>
      'तुम्ही सध्याच्या क्विझ वापरल्या आहेत. कृपया नंतर पुन्हा प्रयत्न करा किंवा योजना अपग्रेड करा.';

  @override
  String get quizSeePricing => 'योजना आणि किंमती पहा';

  @override
  String get quizRephrase =>
      'त्यावरून आम्ही क्विझ तयार करू शकलो नाही. कृपया टॉपिक पुन्हा लिहा आणि प्रयत्न करा.';

  @override
  String get quizBusy =>
      'सहायक आत्ता व्यस्त आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.';

  @override
  String get quizTimeout =>
      'यास अपेक्षेपेक्षा जास्त वेळ लागत आहे. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get quizSignIn => 'हे साधन वापरण्यासाठी कृपया पुन्हा साइन इन करा.';

  @override
  String get instantAnswerTitle => 'झटपट उत्तर';

  @override
  String get instantAnswerSubtitle => 'वर्गातील कोणताही प्रश्न विचारा';

  @override
  String get instantAnswerAction => 'उत्तर मिळवा';

  @override
  String get instantAnswerEmpty => 'प्रश्न विचारा आणि उत्तर मिळवा दाबा.';

  @override
  String get instantAnswerQuestionLabel => 'तुमचा प्रश्न';

  @override
  String get instantAnswerQuestionHint => 'उदाहरणार्थ, चंद्राचा आकार का बदलतो?';

  @override
  String get instantAnswerQuestionError => 'कृपया प्रश्न लिहा.';

  @override
  String get instantAnswerGradeLabel => 'इयत्ता स्तर';

  @override
  String get instantAnswerGradeAny => 'कोणतीही इयत्ता';

  @override
  String get instantAnswerSubjectLabel => 'विषय';

  @override
  String get instantAnswerSubjectAny => 'कोणताही विषय';

  @override
  String get instantAnswerOptional => 'पर्यायी';

  @override
  String get instantAnswerVideoTitle => 'संबंधित व्हिडिओ पहा';

  @override
  String get instantAnswerVideoBody =>
      'ॲपच्या बाहेर, तुमच्या ब्राउझरमध्ये उघडते.';

  @override
  String get instantAnswerNoAnswer =>
      'त्या प्रश्नासाठी उत्तर मिळाले नाही. कृपया तो पुन्हा लिहा आणि प्रयत्न करा.';

  @override
  String get instantAnswerSeePricing => 'योजना आणि किंमती पहा';

  @override
  String get instantAnswerDailyLimitTitle =>
      'आजचे तुमचे सर्व प्रश्न पूर्ण झाले';

  @override
  String get instantAnswerDailyLimitBody =>
      'तुमच्या योजनेत दररोज ठराविक संख्येने झटपट उत्तरे आहेत. तुमचे प्रश्न उद्या पुन्हा सुरू होतील, किंवा उच्च योजनेत दैनिक मर्यादा वाढवू शकता.';

  @override
  String get instantAnswerLimitTitle =>
      'तुम्ही तुमच्या मर्यादेपर्यंत पोहोचला आहात';

  @override
  String get instantAnswerLimitBody =>
      'तुम्ही या महिन्याची झटपट उत्तरे वापरली आहेत. तुमचे प्रश्न पुढील महिन्यात पुन्हा सुरू होतील, किंवा उच्च योजनेत मर्यादा वाढवू शकता.';

  @override
  String get instantAnswerUpgradeTitle => 'उच्च योजना आवश्यक आहे';

  @override
  String get instantAnswerUpgradeBody =>
      'झटपट उत्तरे उच्च योजनेचा भाग आहेत. प्रश्न विचारत राहण्यासाठी कृपया अपग्रेड करा.';

  @override
  String get instantAnswerRephrase =>
      'आम्ही त्याचे उत्तर देऊ शकलो नाही. कृपया प्रश्न पुन्हा लिहा आणि प्रयत्न करा.';

  @override
  String get instantAnswerBusy =>
      'सहायक आत्ता व्यस्त आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.';

  @override
  String instantAnswerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'सहायक आत्ता व्यस्त आहे. कृपया सुमारे $seconds सेकंदांत पुन्हा प्रयत्न करा.',
      one: 'सहायक आत्ता व्यस्त आहे. कृपया सुमारे 1 सेकंदात पुन्हा प्रयत्न करा.',
    );
    return '$_temp0';
  }

  @override
  String get instantAnswerTimeout =>
      'यास अपेक्षेपेक्षा जास्त वेळ लागत आहे. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get instantAnswerSignIn =>
      'हे साधन वापरण्यासाठी कृपया पुन्हा साइन इन करा.';

  @override
  String get settingsTitle => 'सेटिंग्ज';

  @override
  String get settingsAppearanceTitle => 'स्वरूप';

  @override
  String get settingsThemeSystem => 'माझ्या डिव्हाइसनुसार';

  @override
  String get settingsThemeLight => 'उजळ';

  @override
  String get settingsThemeDark => 'गडद';

  @override
  String get settingsLanguageHint =>
      'ॲपची भाषा आणि तुमचे शिक्षण साहित्य ज्या भाषेत लिहिले जाते ती भाषा ठरवते.';

  @override
  String get settingsNotificationsTitle => 'सूचना';

  @override
  String get settingsNotificationsLabel => 'स्मरणपत्रे आणि अद्यतने';

  @override
  String get settingsNotificationsHint =>
      'नवीन शिक्षण साधने आणि तुमच्या जतन केलेल्या कामाबद्दल कळवले जाईल.';

  @override
  String get settingsVoiceModeTitle => 'व्हॉइस मोड';

  @override
  String get settingsVoiceModeLabel => 'लाइव्ह व्हॉइस (बीटा)';

  @override
  String get settingsVoiceModeHint =>
      'VIDYA शी थेट संवाद साधा. बंद असल्यास VIDYA ऐकते आणि नंतर एका वेळी एक उत्तर देते.';

  @override
  String get settingsProfileTitle => 'अध्यापन प्रोफाइल';

  @override
  String get settingsProfileHint =>
      'यामुळे तुमचे साहित्य तुमच्या बोर्ड आणि वर्गाशी जुळवता येते.';

  @override
  String get settingsBoardLabel => 'शिक्षण मंडळ';

  @override
  String get settingsBoardNone => 'सेट केलेले नाही';

  @override
  String get settingsQualificationsLabel => 'पात्रता';

  @override
  String get settingsQualificationsHint =>
      'तुमच्याकडे असलेली प्रत्येक पात्रता निवडा.';

  @override
  String get settingsAdminRoleLabel => 'प्रशासकीय भूमिका';

  @override
  String get settingsAdminRoleNone => 'सेट केलेले नाही';

  @override
  String get settingsRoleHod => 'विभागप्रमुख (HoD)';

  @override
  String get settingsRoleCoordinator => 'शैक्षणिक समन्वयक';

  @override
  String get settingsRoleExamController => 'परीक्षा नियंत्रक';

  @override
  String get settingsRoleVicePrincipal => 'उपमुख्याध्यापक';

  @override
  String get settingsRolePrincipal => 'मुख्याध्यापक';

  @override
  String get settingsRoleNone => 'शिक्षक, कोणतीही प्रशासकीय भूमिका नाही';

  @override
  String get settingsSaveProfile => 'प्रोफाइल जतन करा';

  @override
  String get settingsProfileSaved => 'तुमची अध्यापन प्रोफाइल जतन झाली आहे.';

  @override
  String get settingsSaveFailed =>
      'आम्ही तुमची प्रोफाइल जतन करू शकलो नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get settingsSignedOutTitle => 'तुम्ही साइन आउट आहात';

  @override
  String get settingsSignedOutBody =>
      'तुमची अध्यापन प्रोफाइल आणि खाते सांभाळण्यासाठी साइन इन करा. तुमची भाषा आणि स्वरूपाची निवड या डिव्हाइसवर तशीही जतन राहते.';

  @override
  String get settingsSignIn => 'साइन इन करा';

  @override
  String get settingsDangerTitle => 'खाते हटवा';

  @override
  String get settingsDangerBody =>
      'यामुळे तुमचे खाते बंद होते आणि जतन केलेले काम काढून टाकले जाते. कायमचे हटवण्यापूर्वी सर्व निर्यात करण्यासाठी तुम्हाला 30 दिवस मिळतील.';

  @override
  String get settingsDeleteAction => 'खाते हटवा';

  @override
  String get settingsDeleteDialogTitle => 'तुमचे खाते हटवायचे?';

  @override
  String get settingsDeleteDialogBody =>
      'तुमच्या पाठ योजना, क्विझ आणि प्रोफाइल हटवण्यासाठी नियोजित होतील. त्या काढून टाकण्यापूर्वी तुमचे काम निर्यात करण्यासाठी तुम्हाला 30 दिवस आहेत.';

  @override
  String settingsDeleteConfirmPrompt(String word) {
    return 'पुष्टीसाठी खाली $word टाइप करा.';
  }

  @override
  String get settingsDeleteConfirmLabel => 'पुष्टी';

  @override
  String get settingsDeleteCancel => 'माझे खाते ठेवा';

  @override
  String get settingsDeleteConfirm => 'खाते हटवा';

  @override
  String get settingsDeleteScheduled =>
      'तुमचे खाते हटवण्यासाठी नियोजित आहे. तुमचे काम निर्यात करण्यासाठी तुम्हाला 30 दिवस आहेत.';

  @override
  String get settingsDeleteSuccessTitle => 'खाते हटवण्यासाठी नियोजित';

  @override
  String get settingsExportDataAction => 'माझा डेटा निर्यात करा';

  @override
  String get settingsExportQueuedMessage =>
      'तुमची निर्यात इतकी मोठी आहे की ती लगेच तयार करता येत नाही, म्हणून आम्ही ती रांगेत ठेवली आहे. कृपया नंतर पुन्हा प्रयत्न करा, किंवा तुमच्या डेटाच्या प्रतीसाठी सपोर्टशी संपर्क साधा.';

  @override
  String get settingsExportFailedMessage =>
      'तुमची निर्यात तयार करता आली नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get settingsDeleteSuccessDone => 'झाले';

  @override
  String get settingsDeleteFailed =>
      'आम्ही तुमचे खाते हटवू शकलो नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get settingsReauthTitle => 'कृपया पुन्हा साइन इन करा';

  @override
  String get settingsReauthBody =>
      'तुमच्या सुरक्षिततेसाठी, खाते हटवण्यास नव्याने साइन इन करणे आवश्यक आहे. कृपया साइन आउट करा, पुन्हा साइन इन करा आणि पाच मिनिटांत हटवा.';

  @override
  String get profilePlanLabel => 'योजना';

  @override
  String get profilePlanFree => 'मोफत';

  @override
  String get profilePlanPro => 'प्रो';

  @override
  String get profilePlanGold => 'गोल्ड';

  @override
  String get profilePlanPremium => 'प्रीमियम';

  @override
  String get profilePlanUnknown => 'उपलब्ध नाही';

  @override
  String get profileNoName => 'तुमची प्रोफाइल';

  @override
  String get profileSectionAbout => 'तुमच्याबद्दल';

  @override
  String get profileSectionTeaching => 'तुम्ही काय शिकवता';

  @override
  String get profileSectionLocation => 'तुम्ही कुठे शिकवता';

  @override
  String get profileSectionContact => 'आम्ही तुमच्याशी कसा संपर्क साधावा';

  @override
  String get profileNameLabel => 'तुमचे नाव';

  @override
  String get profileNameHint =>
      'तुम्ही शेअर केलेल्या कामावर इतर शिक्षकांना हेच नाव दिसते.';

  @override
  String get profileNameInvalid => 'कृपया लहान नाव वापरा.';

  @override
  String get profileSchoolLabel => 'शाळेचे नाव';

  @override
  String get profileBoardCategoryLabel => 'बोर्डाचा प्रकार';

  @override
  String get profileBoardCategoryHint =>
      'खालील यादी लहान करण्यासाठी बोर्डाचा प्रकार निवडा.';

  @override
  String get profileBoardCategoryState => 'राज्य बोर्ड';

  @override
  String get profileStateLabel => 'राज्य';

  @override
  String get profileStateNone => 'सेट केलेले नाही';

  @override
  String get profileDistrictLabel => 'जिल्हा';

  @override
  String get profileDistrictHint => 'तुमची शाळा ज्या जिल्ह्यात आहे.';

  @override
  String get profileSubjectsLabel => 'तुम्ही शिकवत असलेले विषय';

  @override
  String get profileSubjectsHint => 'तुम्हाला आवश्यक तितके निवडा.';

  @override
  String get profileGradesLabel => 'तुम्ही शिकवत असलेले वर्ग';

  @override
  String get profileGradesHint => 'तुम्हाला आवश्यक तितके निवडा.';

  @override
  String get profileLanguageHint =>
      'ही ॲपच्या इतर भागांप्रमाणेच भाषेची निवड आहे, त्यामुळे इथे बदलल्यास ती सर्वत्र बदलते.';

  @override
  String get profilePhoneLabel => 'मोबाइल नंबर';

  @override
  String get profilePhoneHint => 'पर्यायी. +91 सह किंवा त्याशिवाय, दहा अंक.';

  @override
  String get profilePhoneInvalid => 'कृपया दहा अंकी भारतीय मोबाइल नंबर टाका.';

  @override
  String get profilePincodeLabel => 'पिन कोड';

  @override
  String get profilePincodeHint => 'पर्यायी. सहा अंक.';

  @override
  String get profilePincodeInvalid => 'कृपया सहा अंकी पिन कोड टाका.';

  @override
  String get profileEmptyTitle => 'तुमची प्रोफाइल रिकामी आहे';

  @override
  String get profileEmptyBody =>
      'तुमची शाळा आणि तुमचे वर्ग जोडा, म्हणजे तुम्ही तयार केलेली प्रत्येक पाठ योजना आणि क्विझ तुमच्या वर्गासाठी तयार मिळेल.';

  @override
  String get profileLoadFailed =>
      'आम्ही तुमची प्रोफाइल उघडू शकलो नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get profileSignedOutTitle => 'तुम्ही साइन आउट आहात';

  @override
  String get profileSignedOutBody =>
      'तुमची अध्यापन प्रोफाइल पाहण्यासाठी आणि बदलण्यासाठी साइन इन करा.';

  @override
  String get profileSaveSignIn =>
      'तुमची प्रोफाइल जतन करण्यासाठी कृपया पुन्हा साइन इन करा.';

  @override
  String get meTitle => 'प्रोफाइल';

  @override
  String get mePlanUsageTitle => 'प्लॅन आणि वापर';

  @override
  String get mePlanUsageSubtitle => 'या महिन्यात तुम्ही किती वापरले आहे.';

  @override
  String meUsageValue(int used, int limit) {
    return '$used / $limit';
  }

  @override
  String get meUsageUnlimited => 'अमर्यादित';

  @override
  String get meUsageUnavailable =>
      'आम्ही तुमचा वापर लोड करू शकलो नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get meDefaultsTitle => 'डीफॉल्ट';

  @override
  String get mePrivacyTitle => 'गोपनीयता आणि सेटिंग्ज';

  @override
  String get meRoleTeacher => 'शिक्षक';

  @override
  String get usageFeatureAvatar => 'एआय अवतार';

  @override
  String get usageFeatureVoiceToText => 'व्हॉइस ते टेक्स्ट';

  @override
  String get usageFeatureAssistant => 'VIDYA सहाय्यक';

  @override
  String get imageInputHint => 'पाठ्यपुस्तकाच्या पानाचा स्पष्ट फोटो जोडा.';

  @override
  String get imageInputTakePhoto => 'फोटो काढा';

  @override
  String get imageInputChooseGallery => 'गॅलरीतून निवडा';

  @override
  String get imageInputRetake => 'पुन्हा फोटो काढा';

  @override
  String get imageInputChangeGallery => 'दुसरा निवडा';

  @override
  String get imageInputRemove => 'फोटो काढून टाका';

  @override
  String get imageInputPreviewLabel => 'निवडलेल्या चित्राचे पूर्वावलोकन';

  @override
  String imageInputSizeOfMax(String used, String max) {
    return '$max पैकी $used';
  }

  @override
  String imageInputTooLarge(String max) {
    return 'हा फोटो खूप मोठा आहे. कृपया $max पेक्षा लहान फोटो निवडा.';
  }

  @override
  String get imageInputPermissionDenied =>
      'SahayakAI ला तुमचा कॅमेरा किंवा फोटो वापरण्याची परवानगी हवी आहे. कृपया डिव्हाइस सेटिंग्जमध्ये परवानगी द्या.';

  @override
  String get imageInputFailed =>
      'आम्ही तो फोटो उघडू शकलो नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get worksheetTitle => 'कार्यपत्रिका';

  @override
  String get worksheetSubtitle =>
      'पाठ्यपुस्तकाच्या फोटोवरून कार्यपत्रिका तयार करा';

  @override
  String get worksheetEmpty =>
      'पाठ्यपुस्तकाचा फोटो आणि सूचना जोडा, नंतर तयार करा दाबा.';

  @override
  String get worksheetImageLabel => 'पाठ्यपुस्तकाच्या पानाचा फोटो';

  @override
  String get worksheetImageHint => 'कार्यपत्रिका याच पानावरून तयार होते.';

  @override
  String get toolImageOptionalLabel => 'पाठ्यपुस्तकाच्या पानाचा फोटो (पर्यायी)';

  @override
  String get toolImageOptionalHint =>
      'पानाचा फोटो जोडल्यास तोच मुख्य आधार होतो, किंवा रिकामे ठेवा.';

  @override
  String get worksheetImageError => 'कृपया पाठ्यपुस्तकाच्या पानाचा फोटो जोडा.';

  @override
  String get worksheetPromptLabel => 'तुम्हाला कोणती कार्यपत्रिका हवी आहे?';

  @override
  String get worksheetPromptHint =>
      'उदाहरणार्थ, या पानावरून गुणाकाराची कार्यपत्रिका तयार करा';

  @override
  String get worksheetPromptError => 'तुम्हाला हवी असलेली कार्यपत्रिका सांगा.';

  @override
  String get worksheetGradeLabel => 'इयत्ता स्तर';

  @override
  String get worksheetGradeAny => 'कोणतीही इयत्ता';

  @override
  String get worksheetSubjectLabel => 'विषय';

  @override
  String get worksheetSubjectAny => 'कोणताही विषय';

  @override
  String get worksheetOptional => 'पर्यायी';

  @override
  String get worksheetObjectives => 'अध्ययन उद्दिष्टे';

  @override
  String get worksheetInstructions => 'विद्यार्थ्यांसाठी सूचना';

  @override
  String get worksheetActivities => 'कृती';

  @override
  String get worksheetActivityQuestion => 'प्रश्न';

  @override
  String get worksheetActivityPuzzle => 'कोडे';

  @override
  String get worksheetActivityCreativeTask => 'सर्जनशील कृती';

  @override
  String get worksheetExplanation => 'शिक्षकांसाठी';

  @override
  String get worksheetChalkboardNote => 'फळ्यावर';

  @override
  String get worksheetAnswerKey => 'उत्तरसूची';

  @override
  String get worksheetNoContent =>
      'त्या पानासाठी कार्यपत्रिका मिळाली नाही. कृपया अधिक स्पष्ट फोटो किंवा वेगळी सूचना वापरून पहा.';

  @override
  String get worksheetSave => 'ग्रंथालयात जतन करा';

  @override
  String get worksheetSaving => 'जतन करत आहे';

  @override
  String get worksheetSaved => 'तुमच्या ग्रंथालयात जतन केले';

  @override
  String get worksheetSaveFailedTitle => 'जतन करता आले नाही';

  @override
  String get worksheetSaveFailedBody =>
      'आम्ही ही कार्यपत्रिका तुमच्या ग्रंथालयात जतन करू शकलो नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get worksheetSaveRetry => 'पुन्हा जतन करून पहा';

  @override
  String get worksheetUpgradeTitle => 'उच्च योजना आवश्यक आहे';

  @override
  String get worksheetUpgradeBody =>
      'कार्यपत्रिका तयार करणे उच्च योजनेचा भाग आहे. कार्यपत्रिका तयार करत राहण्यासाठी कृपया अपग्रेड करा.';

  @override
  String get worksheetLimitTitle => 'तुम्ही तुमच्या मर्यादेपर्यंत पोहोचला आहात';

  @override
  String get worksheetLimitBody =>
      'तुम्ही सध्याच्या कार्यपत्रिका वापरल्या आहेत. कृपया नंतर पुन्हा प्रयत्न करा किंवा योजना अपग्रेड करा.';

  @override
  String get worksheetSeePricing => 'योजना आणि किंमती पहा';

  @override
  String get worksheetRephrase =>
      'त्यावरून आम्ही कार्यपत्रिका तयार करू शकलो नाही. कृपया अधिक स्पष्ट फोटो वापरा किंवा सूचना पुन्हा लिहा.';

  @override
  String get worksheetBusy =>
      'सहायक आत्ता व्यस्त आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.';

  @override
  String get worksheetTimeout =>
      'यास अपेक्षेपेक्षा जास्त वेळ लागत आहे. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get worksheetSignIn =>
      'हे साधन वापरण्यासाठी कृपया पुन्हा साइन इन करा.';

  @override
  String get rubricTitle => 'रूब्रिक';

  @override
  String get rubricSubtitle => 'असाइनमेंटसाठी तपासणीचे रूब्रिक तयार करा';

  @override
  String get rubricEmpty => 'असाइनमेंटचे वर्णन करा, नंतर तयार करा दाबा.';

  @override
  String get rubricAssignmentLabel => 'असाइनमेंट काय आहे?';

  @override
  String get rubricAssignmentHint => 'रूब्रिक याच असाइनमेंटची तपासणी करते.';

  @override
  String get rubricAssignmentPlaceholder =>
      'उदाहरणार्थ, अक्षय ऊर्जेवरील इयत्ता 5 चा प्रकल्प';

  @override
  String get rubricAssignmentError => 'कृपया असाइनमेंटचे वर्णन करा.';

  @override
  String get rubricGradeLabel => 'इयत्ता स्तर';

  @override
  String get rubricGradeAny => 'कोणतीही इयत्ता';

  @override
  String get rubricSubjectLabel => 'विषय';

  @override
  String get rubricSubjectAny => 'कोणताही विषय';

  @override
  String get rubricOptional => 'पर्यायी';

  @override
  String get rubricCriteriaColumn => 'निकष';

  @override
  String rubricPoints(String points) {
    return '$points गुण';
  }

  @override
  String get rubricScrollHint => 'सर्व स्तर पाहण्यासाठी बाजूला सरकवा.';

  @override
  String get rubricNoContent =>
      'त्यासाठी रूब्रिक मिळाले नाही. कृपया असाइनमेंटचे अधिक स्पष्ट वर्णन करून पहा.';

  @override
  String get rubricUpgradeTitle => 'उच्च योजना आवश्यक आहे';

  @override
  String get rubricUpgradeBody =>
      'रूब्रिक तयार करणे उच्च योजनेचा भाग आहे. रूब्रिक तयार करत राहण्यासाठी कृपया अपग्रेड करा.';

  @override
  String get rubricLimitTitle => 'तुम्ही तुमच्या मर्यादेपर्यंत पोहोचला आहात';

  @override
  String get rubricLimitBody =>
      'तुम्ही सध्याची रूब्रिक वापरली आहेत. कृपया नंतर पुन्हा प्रयत्न करा किंवा योजना अपग्रेड करा.';

  @override
  String get rubricRephrase =>
      'त्यावरून आम्ही रूब्रिक तयार करू शकलो नाही. कृपया असाइनमेंट पुन्हा लिहा आणि प्रयत्न करा.';

  @override
  String get rubricBusy =>
      'सहायक आत्ता व्यस्त आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.';

  @override
  String get rubricTimeout =>
      'यास अपेक्षेपेक्षा जास्त वेळ लागत आहे. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get rubricSignIn => 'हे साधन वापरण्यासाठी कृपया पुन्हा साइन इन करा.';

  @override
  String get examPaperTitle => 'प्रश्नपत्रिका';

  @override
  String get examPaperSubtitle =>
      'उत्तरसूचीसह बोर्ड पद्धतीची प्रश्नपत्रिका तयार करा';

  @override
  String get examPaperEmpty =>
      'बोर्ड, इयत्ता आणि विषय निवडा, नंतर तयार करा दाबा.';

  @override
  String get examPaperBoardLabel => 'बोर्ड';

  @override
  String get examPaperBoardHint => 'बोर्ड निवडा';

  @override
  String get examPaperBoardError => 'कृपया बोर्ड निवडा.';

  @override
  String get examPaperGradeLabel => 'इयत्ता स्तर';

  @override
  String get examPaperGradeHint => 'इयत्ता निवडा';

  @override
  String get examPaperGradeError => 'कृपया इयत्ता निवडा.';

  @override
  String get examPaperSubjectLabel => 'विषय';

  @override
  String get examPaperSubjectHint => 'विषय निवडा';

  @override
  String get examPaperSubjectError => 'कृपया विषय निवडा.';

  @override
  String get examPaperSubjectOther => 'इतर विषय';

  @override
  String get examPaperSubjectOtherLabel => 'विषयाचे नाव';

  @override
  String get examPaperSubjectOtherHint => 'उदाहरणार्थ, अर्थशास्त्र';

  @override
  String get examPaperSubjectOtherError => 'कृपया विषय लिहा.';

  @override
  String get examPaperChaptersLabel => 'धडे';

  @override
  String get examPaperChaptersHint =>
      'समाविष्ट करायचे धडे जोडा. अधिकृत आराखडा उपलब्ध असल्यास संपूर्ण अभ्यासक्रमासाठी हे रिकामे ठेवा.';

  @override
  String get examPaperChaptersPlaceholder => 'उदाहरणार्थ, वर्गसमीकरणे';

  @override
  String get examPaperChaptersAdd => 'धडा जोडा';

  @override
  String get examPaperChaptersError =>
      'कृपया या बोर्ड, इयत्ता आणि विषयासाठी किमान एक धडा जोडा.';

  @override
  String get examPaperDifficultyLabel => 'अवघडपणा';

  @override
  String get examPaperDifficultyEasy => 'सोपे';

  @override
  String get examPaperDifficultyModerate => 'मध्यम';

  @override
  String get examPaperDifficultyHard => 'कठीण';

  @override
  String get examPaperDifficultyMixed => 'मिश्र';

  @override
  String get examPaperIncludeAnswerKey => 'उत्तरसूची समाविष्ट करा';

  @override
  String get examPaperIncludeMarkingScheme => 'गुणदान योजना समाविष्ट करा';

  @override
  String get examPaperInProgressTitle => 'तुमची प्रश्नपत्रिका तयार होत आहे';

  @override
  String get examPaperInProgressBody =>
      'संपूर्ण बोर्ड प्रश्नपत्रिका तयार होण्यास थोडा जास्त वेळ लागतो. आम्ही ती आत्ता पूर्ण करत आहोत आणि ती तुमच्यासाठी जतन होईल.';

  @override
  String get examPaperInProgressLibraryHint =>
      'तुमची पूर्ण झालेली प्रश्नपत्रिका पाहण्यासाठी एका मिनिटात ग्रंथालय टॅब उघडा.';

  @override
  String examPaperMaxMarks(String marks) {
    return 'एकूण गुण $marks';
  }

  @override
  String examPaperMarks(String marks) {
    return '$marks गुण';
  }

  @override
  String examPaperSectionMarks(String marks) {
    return '$marks गुण';
  }

  @override
  String examPaperPercent(String value) {
    return '$value टक्के';
  }

  @override
  String get examPaperGeneralInstructions => 'सर्वसाधारण सूचना';

  @override
  String get examPaperInternalChoice => 'किंवा सोडवा';

  @override
  String get examPaperAnswerKey => 'उत्तर';

  @override
  String get examPaperMarkingScheme => 'गुणदान योजना';

  @override
  String get examPaperBlueprintTitle => 'आराखड्याचा सारांश';

  @override
  String get examPaperBlueprintChapters => 'धड्यानुसार गुण';

  @override
  String get examPaperBlueprintDifficulty => 'अवघडपणानुसार विभागणी';

  @override
  String get examPaperPyqTitle => 'मागील वर्षांचे प्रश्न';

  @override
  String examPaperPyqChapterYear(String chapter, int year) {
    return '$chapter ($year)';
  }

  @override
  String examPaperPyqYear(int year) {
    return 'वर्ष $year';
  }

  @override
  String get examPaperNoContent =>
      'त्यासाठी प्रश्नपत्रिका मिळाली नाही. कृपया कमी धडे किंवा वेगळा विषय वापरून पहा.';

  @override
  String get examPaperSave => 'ग्रंथालयात जतन करा';

  @override
  String get examPaperSaving => 'जतन करत आहे';

  @override
  String get examPaperSaved => 'तुमच्या ग्रंथालयात जतन केले';

  @override
  String get examPaperSaveFailedTitle => 'जतन करता आले नाही';

  @override
  String get examPaperSaveFailedBody =>
      'आम्ही ही प्रश्नपत्रिका तुमच्या ग्रंथालयात जतन करू शकलो नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get examPaperSaveRetry => 'पुन्हा जतन करून पहा';

  @override
  String get examPaperUnstructuredTitle =>
      'आम्ही ती प्रश्नपत्रिका रचू शकलो नाही';

  @override
  String get examPaperUnstructuredBody =>
      'सहायकाला हे संपूर्ण प्रश्नपत्रिकेच्या स्वरूपात मांडता आले नाही. कृपया काही धडे कमी करा आणि पुन्हा तयार करा.';

  @override
  String get examPaperUpgradeTitle => 'उच्च योजना आवश्यक आहे';

  @override
  String get examPaperUpgradeBody =>
      'प्रश्नपत्रिका तयार करणे उच्च योजनेचा भाग आहे. प्रश्नपत्रिका तयार करत राहण्यासाठी कृपया अपग्रेड करा.';

  @override
  String get examPaperLimitTitle => 'तुम्ही तुमच्या मर्यादेपर्यंत पोहोचला आहात';

  @override
  String get examPaperLimitBody =>
      'तुम्ही सध्याच्या प्रश्नपत्रिका वापरल्या आहेत. कृपया नंतर पुन्हा प्रयत्न करा किंवा योजना अपग्रेड करा.';

  @override
  String get examPaperRephrase =>
      'त्यावरून आम्ही प्रश्नपत्रिका तयार करू शकलो नाही. कृपया धडे बदला आणि पुन्हा प्रयत्न करा.';

  @override
  String get examPaperBusy =>
      'सहायक आत्ता व्यस्त आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.';

  @override
  String get examPaperTimeout =>
      'यास अपेक्षेपेक्षा जास्त वेळ लागत आहे. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get examPaperSignIn =>
      'हे साधन वापरण्यासाठी कृपया पुन्हा साइन इन करा.';

  @override
  String get teacherTrainingTitle => 'अध्यापन मार्गदर्शक';

  @override
  String get teacherTrainingSubtitle =>
      'अध्यापनाच्या प्रश्नावर सल्ला आणि रणनीती';

  @override
  String get teacherTrainingAction => 'सल्ला मिळवा';

  @override
  String get teacherTrainingEmpty =>
      'अध्यापनशास्त्रावर आधारित उपाय मिळवण्यासाठी अध्यापनाचा प्रश्न विचारा.';

  @override
  String get teacherTrainingQuestionLabel => 'तुमचा प्रश्न';

  @override
  String get teacherTrainingQuestionHint =>
      'धड्याची रचना, वर्गातील सराव किंवा मूल्यांकनाबद्दल विचारा.';

  @override
  String get teacherTrainingQuestionPlaceholder =>
      'उदाहरणार्थ, 40 विद्यार्थ्यांचा वर्ग संपूर्ण धड्यात कसा गुंतवून ठेवू?';

  @override
  String get teacherTrainingQuestionError => 'कृपया प्रश्न लिहा.';

  @override
  String get teacherTrainingSubjectLabel => 'विषय';

  @override
  String get teacherTrainingSubjectAny => 'कोणताही विषय';

  @override
  String get teacherTrainingOptional => 'पर्यायी';

  @override
  String get teacherTrainingStrategiesTitle => 'रणनीती';

  @override
  String get teacherTrainingSectionQuestion => 'प्रश्न';

  @override
  String get teacherTrainingResultTitle => 'मार्गदर्शन टिपा';

  @override
  String get teacherTrainingNoContent =>
      'त्यासाठी सल्ला मिळाला नाही. कृपया अधिक स्पष्ट प्रश्न विचारा.';

  @override
  String get teacherTrainingUpgradeTitle => 'उच्च योजना आवश्यक आहे';

  @override
  String get teacherTrainingUpgradeBody =>
      'अध्यापन मार्गदर्शक उच्च योजनेचा भाग आहे. विचारत राहण्यासाठी कृपया अपग्रेड करा.';

  @override
  String get teacherTrainingLimitTitle =>
      'तुम्ही तुमच्या मर्यादेपर्यंत पोहोचला आहात';

  @override
  String get teacherTrainingLimitBody =>
      'तुम्ही सध्यासाठी अध्यापन मार्गदर्शक वापरला आहे. कृपया नंतर पुन्हा प्रयत्न करा किंवा योजना अपग्रेड करा.';

  @override
  String get teacherTrainingSeePricing => 'योजना आणि किंमती पहा';

  @override
  String get teacherTrainingRephrase =>
      'त्यावरून आम्ही सल्ला तयार करू शकलो नाही. कृपया प्रश्न पुन्हा लिहा आणि प्रयत्न करा.';

  @override
  String get teacherTrainingBusy =>
      'सहायक आत्ता व्यस्त आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.';

  @override
  String teacherTrainingBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'सहायक आत्ता व्यस्त आहे. कृपया सुमारे $seconds सेकंदांत पुन्हा प्रयत्न करा.',
      one: 'सहायक आत्ता व्यस्त आहे. कृपया सुमारे 1 सेकंदात पुन्हा प्रयत्न करा.',
    );
    return '$_temp0';
  }

  @override
  String get teacherTrainingTimeout =>
      'यास अपेक्षेपेक्षा जास्त वेळ लागत आहे. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get teacherTrainingSignIn =>
      'हे साधन वापरण्यासाठी कृपया पुन्हा साइन इन करा.';

  @override
  String get parentMessageTitle => 'पालक संदेश';

  @override
  String get parentMessageSubtitle =>
      'पालकांच्या भाषेत घरी पाठवायचा संदेश तयार करा';

  @override
  String get parentMessageAction => 'संदेश तयार करा';

  @override
  String get parentMessageEmpty =>
      'विद्यार्थी आणि कारण सांगा, म्हणजे पालकांच्या भाषेत आपुलकीचा संदेश तयार होईल.';

  @override
  String get parentMessageStudentLabel => 'विद्यार्थ्याचे नाव';

  @override
  String get parentMessageStudentPlaceholder =>
      'संदेश ज्या विद्यार्थ्याबद्दल आहे तो';

  @override
  String get parentMessageStudentError => 'कृपया विद्यार्थ्याचे नाव लिहा.';

  @override
  String get parentMessageClassLabel => 'इयत्ता';

  @override
  String get parentMessageClassPlaceholder => 'उदाहरणार्थ, इयत्ता 6अ';

  @override
  String get parentMessageClassError => 'कृपया इयत्ता लिहा.';

  @override
  String get parentMessageSubjectLabel => 'विषय';

  @override
  String get parentMessageSubjectHint => 'विषय निवडा';

  @override
  String get parentMessageSubjectError => 'कृपया विषय निवडा.';

  @override
  String get parentMessageReasonLabel => 'संदेशाचे कारण';

  @override
  String get parentMessageReasonHint => 'कारण निवडा';

  @override
  String get parentMessageReasonError => 'कृपया कारण निवडा.';

  @override
  String get parentMessageReasonAbsences => 'वारंवार गैरहजेरी';

  @override
  String get parentMessageReasonPerformance => 'शैक्षणिक मदत';

  @override
  String get parentMessageReasonBehavior => 'वर्गातील वर्तन';

  @override
  String get parentMessageReasonPositive => 'सांगण्यासारखी आनंदाची बातमी';

  @override
  String get parentMessageAbsentDaysLabel => 'गैरहजर दिवस';

  @override
  String get parentMessageAbsentDaysHint =>
      'विद्यार्थी सलग किती दिवस गैरहजर आहे.';

  @override
  String get parentMessageAbsentDaysPlaceholder => 'उदाहरणार्थ, 3';

  @override
  String get parentMessageParentLanguageLabel => 'पालकांची भाषा';

  @override
  String get parentMessageParentLanguageHint =>
      'संदेश याच भाषेत लिहिला जातो, जी ॲपच्या भाषेपेक्षा वेगळी असू शकते.';

  @override
  String get parentMessageParentLanguagePlaceholder => 'पालकांची भाषा निवडा';

  @override
  String get parentMessageParentLanguageError => 'कृपया पालकांची भाषा निवडा.';

  @override
  String get parentMessageContextLabel => 'याचे कारण काय आहे?';

  @override
  String get parentMessageContextHint =>
      'परिस्थितीबद्दल थोडक्यात लिहिल्यास संदेश अधिक नेमका होतो.';

  @override
  String get parentMessageContextPlaceholder =>
      'उदाहरणार्थ, अपूर्णांकांचे मागील दोन आठवडे बुडाले';

  @override
  String get parentMessageNoteLabel => 'काही विशेष सांगायचे आहे का?';

  @override
  String get parentMessageNoteHint => 'इथला तपशील संदेशात गुंफला जातो.';

  @override
  String get parentMessageNotePlaceholder =>
      'उदाहरणार्थ, गटकार्यात चांगली कामगिरी';

  @override
  String get parentMessageTeacherNameLabel => 'तुमचे नाव';

  @override
  String get parentMessageTeacherNameHint =>
      'संदेशाच्या शेवटी हे नाव येते. रिकामे ठेवल्यास प्रोफाइलमधील नाव वापरले जाते.';

  @override
  String get parentMessageTeacherNamePlaceholder => 'उदाहरणार्थ, श्रीमती राव';

  @override
  String get parentMessageSchoolNameLabel => 'शाळेचे नाव';

  @override
  String get parentMessageSchoolNamePlaceholder => 'तुमच्या शाळेचे नाव';

  @override
  String get parentMessageOptional => 'पर्यायी';

  @override
  String parentMessageWordCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count शब्द',
      one: '1 शब्द',
    );
    return '$_temp0';
  }

  @override
  String get parentMessageCopy => 'कॉपी करा';

  @override
  String get parentMessageShare => 'शेअर करा';

  @override
  String get parentMessageCopied => 'संदेश कॉपी झाला';

  @override
  String get parentMessageSectionMessage => 'संदेश';

  @override
  String get parentMessageSectionDetails => 'अतिरिक्त तपशील';

  @override
  String get parentMessageResultTitle => 'पालकांसाठी संदेश';

  @override
  String get parentMessageNoContent =>
      'त्यासाठी संदेश मिळाला नाही. कृपया थोडा अधिक तपशील जोडा आणि पुन्हा प्रयत्न करा.';

  @override
  String get parentMessageMissingFields =>
      'कृपया विद्यार्थी, इयत्ता, विषय, कारण आणि पालकांची भाषा भरा, नंतर पुन्हा प्रयत्न करा.';

  @override
  String get parentMessageUpgradeTitle => 'उच्च योजना आवश्यक आहे';

  @override
  String get parentMessageUpgradeBody =>
      'पालक संदेश उच्च योजनेचा भाग आहेत. ते तयार करत राहण्यासाठी कृपया अपग्रेड करा.';

  @override
  String get parentMessageLimitTitle =>
      'तुम्ही तुमच्या मर्यादेपर्यंत पोहोचला आहात';

  @override
  String get parentMessageLimitBody =>
      'तुम्ही सध्याचे पालक संदेश तयार केले आहेत. कृपया नंतर पुन्हा प्रयत्न करा किंवा योजना अपग्रेड करा.';

  @override
  String get parentMessageSeePricing => 'योजना आणि किंमती पहा';

  @override
  String get parentMessageBusy =>
      'सहायक आत्ता व्यस्त आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.';

  @override
  String parentMessageBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'सहायक आत्ता व्यस्त आहे. कृपया सुमारे $seconds सेकंदांत पुन्हा प्रयत्न करा.',
      one: 'सहायक आत्ता व्यस्त आहे. कृपया सुमारे 1 सेकंदात पुन्हा प्रयत्न करा.',
    );
    return '$_temp0';
  }

  @override
  String get parentMessageTimeout =>
      'यास अपेक्षेपेक्षा जास्त वेळ लागत आहे. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get parentMessageSignIn =>
      'हे साधन वापरण्यासाठी कृपया पुन्हा साइन इन करा.';

  @override
  String get assessTitle => 'असाइनमेंट तपासा';

  @override
  String get assessSubtitle => 'फोटोवरून विद्यार्थ्याचे हस्तलिखित काम तपासा';

  @override
  String get assessEmpty =>
      'विद्यार्थ्याच्या कामाचा फोटो जोडा, नंतर तपासा दाबा.';

  @override
  String get assessSubmit => 'तपासा';

  @override
  String get assessImageLabel => 'विद्यार्थ्याच्या कामाचा फोटो';

  @override
  String get assessImageHint => 'संपूर्ण पानाचा स्पष्ट फोटो काढा.';

  @override
  String get assessImageError => 'कृपया विद्यार्थ्याच्या कामाचा फोटो जोडा.';

  @override
  String get assessModeLabel => 'तुम्हाला काय हवे आहे?';

  @override
  String get assessModeHint =>
      'पूर्ण तपासणी काम वाचते आणि गुण देते. फक्त वाचा फक्त उतारा देते. उतारा तपासा तुम्ही चिकटवलेला मजकूर तपासते.';

  @override
  String get assessModeFull => 'पूर्ण तपासणी';

  @override
  String get assessModeTranscribe => 'फक्त वाचा';

  @override
  String get assessModeScore => 'उतारा तपासा';

  @override
  String get assessTranscriptLabel => 'दुरुस्त केलेला उतारा';

  @override
  String get assessTranscriptHint =>
      'फोटो पुन्हा वाचण्याऐवजी तपासण्यासाठी दुरुस्त केलेला मजकूर चिकटवा.';

  @override
  String get assessTranscriptPlaceholder =>
      'विद्यार्थ्याची दुरुस्त केलेली उत्तरे लिहा किंवा चिकटवा';

  @override
  String get assessOptional => 'पर्यायी';

  @override
  String get assessRubricNote =>
      'रूब्रिक नसल्यास, काम सर्वसाधारण रूब्रिकवर तपासले जाते: आकलन, अचूकता, मांडणी आणि पूर्णता.';

  @override
  String get assessPrivacyNote =>
      'तपासणीसाठी विद्यार्थ्याचे नाव कधीही पाठवले जात नाही.';

  @override
  String get assessScoreLabel => 'एकूण गुण';

  @override
  String get assessScoreOutOf => '100 पैकी';

  @override
  String assessPoints(String earned, String possible) {
    return '$possible पैकी $earned गुण';
  }

  @override
  String assessConfidence(String percent) {
    return 'विश्वास $percent%';
  }

  @override
  String assessRubricUsed(String title) {
    return 'यानुसार तपासले: $title';
  }

  @override
  String get assessLowConfidence => 'कमी विश्वास';

  @override
  String get assessTranscriptSection => 'विद्यार्थ्याने लिहिले';

  @override
  String get assessCriteriaSection => 'निकषानुसार गुण';

  @override
  String assessCriterionPoints(String points, String max) {
    return '$points / $max';
  }

  @override
  String get assessStrengthsSection => 'जमेच्या बाजू';

  @override
  String get assessImprovementsSection => 'यावर काम करायचे';

  @override
  String get assessNextStepsSection => 'पुढील पावले';

  @override
  String get assessTeacherNoteSection => 'विद्यार्थ्यासाठी टीप';

  @override
  String get assessWarningsSection => 'कृपया तपासा';

  @override
  String get assessWarningBlank =>
      'हे पान कोरे दिसते. कृपया फोटो तपासा आणि पुन्हा प्रयत्न करा.';

  @override
  String get assessWarningLowContrast =>
      'फोटो अस्पष्ट आहे. अधिक उजळ फोटोमुळे तपासणी अधिक अचूक होईल.';

  @override
  String get assessWarningPartial => 'कामाचा फक्त काही भाग वाचता आला.';

  @override
  String get assessWarningLanguageMismatch =>
      'लेखन अपेक्षेपेक्षा वेगळ्या भाषेत असू शकते.';

  @override
  String get assessNoContent =>
      'कोणतेही मूल्यांकन मिळाले नाही. कृपया अधिक स्पष्ट फोटो वापरून पहा.';

  @override
  String get assessSignIn => 'असाइनमेंट तपासण्यासाठी कृपया पुन्हा साइन इन करा.';

  @override
  String get assessUpgradeTitle => 'उच्च योजना आवश्यक आहे';

  @override
  String get assessUpgradeBody =>
      'हस्तलिखित काम तपासणे उच्च योजनेचा भाग आहे. तपासणी सुरू ठेवण्यासाठी अपग्रेड करा.';

  @override
  String get assessDailyLimitTitle => 'आजची तुमची सर्व मूल्यांकने पूर्ण झाली';

  @override
  String get assessDailyLimitBody =>
      'तुमच्या योजनेत दररोज ठराविक संख्येने मूल्यांकने आहेत. ती उद्या पुन्हा सुरू होतील, किंवा उच्च योजनेत मर्यादा वाढवू शकता.';

  @override
  String get assessLimitTitle => 'तुम्ही तुमची मूल्यांकन मर्यादा गाठली आहे';

  @override
  String get assessLimitBody =>
      'तुम्ही तुमच्या योजनेतील सर्व मूल्यांकने वापरली आहेत. ती पुढील महिन्यात पुन्हा सुरू होतील, किंवा उच्च योजनेत मर्यादा वाढवू शकता.';

  @override
  String get assessSeePricing => 'योजना पहा';

  @override
  String get assessBusy =>
      'तपासणी मॉडेल सध्या व्यस्त आहे. कृपया एका मिनिटात पुन्हा प्रयत्न करा.';

  @override
  String assessBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'तपासणी मॉडेल सध्या व्यस्त आहे. कृपया सुमारे $seconds सेकंदात पुन्हा प्रयत्न करा.',
      one:
          'तपासणी मॉडेल सध्या व्यस्त आहे. कृपया सुमारे 1 सेकंदात पुन्हा प्रयत्न करा.',
    );
    return '$_temp0';
  }

  @override
  String get assessTimeout =>
      'तपासणीला नेहमीपेक्षा जास्त वेळ लागत आहे. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get assessRephrase =>
      'फोटो तपासता आला नाही. कृपया अधिक स्पष्ट फोटो पुन्हा अपलोड करा.';

  @override
  String get assessSectionWork => 'विद्यार्थ्याचे काम';

  @override
  String get assessResultTitle => 'मूल्यांकन';

  @override
  String get worksheetSectionWorksheet => 'कार्यपत्रिका';

  @override
  String get rubricSectionAssignment => 'असाइनमेंट';

  @override
  String get examPaperSectionPaper => 'प्रश्नपत्रिका';

  @override
  String get examPaperSectionFormat => 'स्वरूप';

  @override
  String get vidyaEyebrow => 'तुमचे सह-शिक्षक';

  @override
  String get vidyaDeck => 'तुमच्या भाषेत बोला, आणि मी काम तयार करते.';

  @override
  String get vidyaGreeting =>
      'नमस्कार शिक्षक. तुमच्या भाषेत बोला, आणि मी तुमचे काम तयार करते.';

  @override
  String get vidyaHeroBadge => 'तुमचा एआय शिक्षण सहाय्यक';

  @override
  String get vidyaPromptLesson => 'धडा योजना करण्यास मला सांगा';

  @override
  String get vidyaPromptQuiz => 'प्रश्नमंजुषा तयार करण्यास सांगा';

  @override
  String get vidyaPromptParent => 'पालकांना संदेश पाठवण्यास सांगा';

  @override
  String get vidyaStateIdle => 'बोलण्यासाठी टॅप करा';

  @override
  String get vidyaStateReady => 'तयार होत आहे';

  @override
  String get vidyaStateListening => 'मी ऐकत आहे';

  @override
  String get vidyaStateThinking => 'विचार करत आहे';

  @override
  String get vidyaStateSpeaking => 'बोलत आहे';

  @override
  String get vidyaYouSaid => 'तुम्ही म्हणालात';

  @override
  String get vidyaSignedOutTitle => 'VIDYA शी बोलण्यासाठी साइन इन करा';

  @override
  String get vidyaSignedOutBody =>
      'साइन इन करा आणि VIDYA तुमच्या भाषेत धडे, प्रश्नमंजुषा आणि बरेच काही तयार करेल.';

  @override
  String get vidyaMicOffTitle => 'मायक्रोफोन चालू करा';

  @override
  String get vidyaMicOffBody =>
      'तुमचे ऐकण्यासाठी VIDYA ला मायक्रोफोन हवा आहे. तो सेटिंग्जमध्ये चालू करा.';

  @override
  String get vidyaOpenSettings => 'सेटिंग्ज उघडा';

  @override
  String get vidyaSignIn => 'साइन इन करा';

  @override
  String get vidyaLimitTitle => 'तुम्ही आजची व्हॉइस मर्यादा गाठली आहे';

  @override
  String get vidyaLimitBody =>
      'तुमचे व्हॉइस मिनिटे पुन्हा मिळतील. तोपर्यंत तुम्ही साधने वापरू शकता.';

  @override
  String get vidyaErrorTitle => 'ते पूर्ण होऊ शकले नाही';

  @override
  String get vidyaErrorBody =>
      'काहीतरी चूक झाली. पुन्हा प्रयत्न करण्यासाठी सीलवर टॅप करा.';

  @override
  String get vidyaPrepDesk => 'तयारी डेस्क';

  @override
  String get vidyaClearConversation => 'संभाषण साफ करा';

  @override
  String get vidyaFlowVisualAid => 'दृश्य साधन';

  @override
  String get vidyaFlowVirtualFieldTrip => 'आभासी क्षेत्र सहल';

  @override
  String get vidyaFlowVideoStoryteller => 'व्हिडिओ कथा';

  @override
  String get vidyaFieldMicLabel => 'बोलून भरा';

  @override
  String get vidyaFieldMicFailed =>
      'ऐकू आले नाही. पुन्हा प्रयत्न करा किंवा टाइप करा.';

  @override
  String get vidyaOpen => 'VIDYA ला विचारा';

  @override
  String get parentHotlineTitle => 'पालकांना कॉल';

  @override
  String get parentHotlineSubtitle =>
      'विद्यार्थ्याच्या पालकांना त्यांच्या भाषेत कॉल करा';

  @override
  String get parentHotlineEyebrow => 'पालकांना कॉल';

  @override
  String get parentHotlinePickStudentIntro =>
      'कोणाच्या पालकांना कॉल करायचा ते निवडा.';

  @override
  String get parentHotlineClassLabel => 'इयत्ता';

  @override
  String get parentHotlineNoPhone => 'पालकांचा नंबर जतन केलेला नाही';

  @override
  String get parentHotlineSignedOutTitle =>
      'तुमचे विद्यार्थी पाहण्यासाठी साइन इन करा';

  @override
  String get parentHotlineSignedOutBody =>
      'तुम्ही साइन इन केल्यावर तुमच्या वर्गातील विद्यार्थ्यांची यादी दिसेल. पालकांना कॉल करण्यासाठी आधी तुमचे खाते आवश्यक आहे.';

  @override
  String get parentHotlineRosterUnavailableTitle =>
      'तुमची वर्गयादी अजून उपलब्ध नाही';

  @override
  String get parentHotlineRosterUnavailableBody =>
      'आम्ही अजून येथे तुमच्या विद्यार्थ्यांची यादी लोड करू शकत नाही. ती पुढील एखाद्या अपडेटमध्ये येईल. तुम्ही आधीच साइन इन आहात, त्यामुळे तुम्हाला काहीही दुरुस्त करण्याची गरज नाही.';

  @override
  String get parentHotlineReasonEyebrow => 'तुम्ही का कॉल करत आहात';

  @override
  String get parentHotlineReasonAbsencesLabel => 'वारंवार गैरहजेरी';

  @override
  String get parentHotlineReasonAbsencesDesc =>
      'विद्यार्थी सलग अनेक दिवस गैरहजर आहे.';

  @override
  String get parentHotlineReasonPerformanceLabel => 'विषयात मागे पडत आहे';

  @override
  String get parentHotlineReasonPerformanceDesc =>
      'अलीकडील गुण किंवा वर्गकार्याकडे लक्ष देणे आवश्यक आहे.';

  @override
  String get parentHotlineReasonBehaviourLabel => 'वर्गातील वर्तन';

  @override
  String get parentHotlineReasonBehaviourDesc =>
      'पालकांना माहिती असावी असे काहीतरी घडले आहे.';

  @override
  String get parentHotlineReasonPositiveLabel => 'आनंदाची बातमी';

  @override
  String get parentHotlineReasonPositiveDesc => 'पालकांसोबत यश साजरे करा.';

  @override
  String get parentHotlineComposeEyebrow => 'कॉलची तयारी करा';

  @override
  String get parentHotlineNoteLabel => 'टीप जोडा';

  @override
  String get parentHotlineNoteHintAbsences =>
      'गैरहजेरीच्या दिवसांबद्दल पालकांना काही कळवायचे आहे का?';

  @override
  String get parentHotlineNoteHintPerformance =>
      'विद्यार्थ्याला सुधारण्यासाठी काय मदत करेल?';

  @override
  String get parentHotlineNoteHintBehaviour =>
      'काय घडले, आणि घरी कोणती मदत उपयोगी ठरेल?';

  @override
  String get parentHotlineNoteHintPositive => 'सांगायची आनंदाची बातमी काय आहे?';

  @override
  String get parentHotlineDraftAction => 'संदेश तयार करा';

  @override
  String get parentHotlineErrorTitle => 'काहीतरी चूक झाली';

  @override
  String get parentHotlineGenericError =>
      'ते पूर्ण झाले नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get parentHotlineEvidenceAttendanceHeader => 'उपस्थिती';

  @override
  String get parentHotlineEvidenceMarksHeader => 'अलीकडील गुण';

  @override
  String get parentHotlineEvidenceBehaviourHeader => 'काय घडले';

  @override
  String get parentHotlineEvidencePositiveHeader => 'आनंदाची बातमी';

  @override
  String parentHotlineEvidenceAbsentDays(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: 'सलग $days दिवस गैरहजर',
      one: 'सलग 1 दिवस गैरहजर',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineEvidenceAbsencePrompt =>
      'पालकांना अचूक नोंद कळावी यासाठी गैरहजेरीचे दिवस निश्चित करा.';

  @override
  String get parentHotlineEvidenceMarksPrompt =>
      'कॉलमध्ये सांगण्यासाठी अलीकडील गुण तयार आहेत.';

  @override
  String get parentHotlineEvidenceMarksEmpty =>
      'अद्याप अलीकडील गुणांची नोंद नाही. पालकांना काय कळवायचे ते खाली जोडा.';

  @override
  String get parentHotlineEvidenceBehaviourPrompt =>
      'काय घडले आणि घरी कोणती मदत उपयोगी ठरेल ते सांगा.';

  @override
  String get parentHotlineEvidencePositivePrompt =>
      'पालकांनी साजरे करावे असे यश सांगा.';

  @override
  String get parentHotlineReviewEyebrow => 'पालकांना संदेश';

  @override
  String get parentHotlineCall => 'पालकांना कॉल करा';

  @override
  String get parentHotlineWhatsApp => 'WhatsApp साठी कॉपी करा';

  @override
  String parentHotlineCallAgainIn(String time) {
    return '$time नंतर पुन्हा कॉल करा';
  }

  @override
  String parentHotlineUnsupportedLanguage(String language) {
    return '$language साठी स्वयंचलित कॉल अद्याप उपलब्ध नाही. त्याऐवजी WhatsApp साठी कॉपी करा.';
  }

  @override
  String parentHotlinePhoneMask(String last4) {
    return '•••• $last4';
  }

  @override
  String get parentHotlineAiNotice =>
      'कॉलच्या सुरुवातीला स्वयंचलित AI आवाजातील सूचना दिली जाते.';

  @override
  String get parentHotlineCopied =>
      'संदेश कॉपी झाला. पाठवण्यासाठी WhatsApp मध्ये पेस्ट करा.';

  @override
  String get parentHotlinePremiumTitle =>
      'पालकांना कॉलसाठी प्रगत योजना आवश्यक आहे';

  @override
  String get parentHotlinePremiumBody =>
      'पालकांना AI आवाज कॉल करणे प्रगत योजनेचा भाग आहे. तरीही तुम्ही WhatsApp वर पाठवण्यासाठी संदेश मोफत कॉपी करू शकता.';

  @override
  String get parentHotlineComingSoonTitle => 'कॉल स्क्रीन लवकरच येत आहे';

  @override
  String get parentHotlineComingSoonBody =>
      'कॉल करणे आणि त्याचा मागोवा घेणे पुढील अपडेटमध्ये येईल.';

  @override
  String parentHotlineCallingTitle(String name) {
    return '$name यांच्या पालकांना कॉल करत आहोत…';
  }

  @override
  String get parentHotlineCallingRinging => 'घंटी वाजत आहे…';

  @override
  String get parentHotlineCallingInProgress => 'संवाद सुरू आहे';

  @override
  String parentHotlineCallingExchanges(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count संवाद',
      one: '1 संवाद',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineCallingReassurance =>
      'तुम्ही ही स्क्रीन सोडू शकता — सारांश तुमच्यासाठी तयार राहील.';

  @override
  String get parentHotlineSummaryDocType => 'पालक कॉल';

  @override
  String get parentHotlineSummaryReasonAbsences => 'गैरहजेरी';

  @override
  String get parentHotlineSummaryReasonPerformance => 'कामगिरी';

  @override
  String get parentHotlineSummaryReasonBehaviour => 'वर्तन';

  @override
  String get parentHotlineSummaryReasonPositive => 'आनंदाची बातमी';

  @override
  String parentHotlineSummaryTitle(String name) {
    return '$name चे पालक';
  }

  @override
  String parentHotlineSummaryDurationMin(int minutes) {
    return '$minutes मिनिटे';
  }

  @override
  String get parentHotlineSentimentCooperative => 'सहकार्यशील';

  @override
  String get parentHotlineSentimentConcerned => 'चिंतित';

  @override
  String get parentHotlineSentimentGrateful => 'कृतज्ञ';

  @override
  String get parentHotlineSentimentUpset => 'नाराज';

  @override
  String get parentHotlineSentimentIndifferent => 'तटस्थ';

  @override
  String get parentHotlineSentimentConfused => 'गोंधळलेले';

  @override
  String get parentHotlineSummarySaidHeader => 'पालक काय म्हणाले';

  @override
  String get parentHotlineSummaryConcernsHeader => 'मांडलेल्या चिंता';

  @override
  String get parentHotlineSummaryCommitmentsHeader => 'पालकांची वचने';

  @override
  String get parentHotlineSummaryActionsHeader => 'तुमची कार्ये';

  @override
  String get parentHotlineSummaryGuidanceHeader => 'दिलेले मार्गदर्शन';

  @override
  String get parentHotlineSummaryFollowUpHeader => 'पुढील पाऊल';

  @override
  String parentHotlineSummaryTranscript(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'संभाषण पहा · $count संदेश',
      one: 'संभाषण पहा · 1 संदेश',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineSummaryDone => 'पूर्ण झाले';

  @override
  String get parentHotlineSummaryCallAgain => 'नंतर पुन्हा कॉल करा';

  @override
  String get parentHotlineSummaryManualTitle => 'संदेश कॉपी झाला';

  @override
  String get parentHotlineSummaryManualBody =>
      'पालकांना पाठवण्यासाठी तो WhatsApp मध्ये पेस्ट करा.';

  @override
  String get parentHotlineSummaryBusy => 'लाइन व्यस्त होती';

  @override
  String get parentHotlineSummaryNoAnswer => 'उत्तर नाही';

  @override
  String get parentHotlineSummaryFailed => 'कॉल जोडता आला नाही';

  @override
  String get parentHotlineSummaryFailedBody =>
      'कॉल झाला नाही. तुम्ही पुन्हा प्रयत्न करू शकता, किंवा संदेश कॉपी करून WhatsApp वर पाठवू शकता.';

  @override
  String get parentHotlineSummaryTryAgain => 'पुन्हा प्रयत्न करा';

  @override
  String get parentHotlineSummaryNoConversationTitle => 'कॉल खूप लवकर संपला';

  @override
  String get parentHotlineSummaryNoConversationBody =>
      'संभाषण सुरू होण्यापूर्वीच कॉल संपला. तुम्ही पुन्हा प्रयत्न करू शकता, किंवा संदेश WhatsApp वर पाठवू शकता.';

  @override
  String get parentHotlineSummaryUnavailableTitle => 'सारांश उपलब्ध नाही';

  @override
  String get parentHotlineSummaryUnavailableBody =>
      'या कॉलचा सारांश तयार करता आला नाही. संभाषण खाली दिले आहे.';

  @override
  String get contentCreatorTitle => 'सामग्री निर्मिती स्टुडिओ';

  @override
  String get contentCreatorTileSubtitle =>
      'तुमच्या वर्गासाठी मल्टीमिडिया तयार करा';

  @override
  String get contentCreatorSubtitle =>
      'तुमच्या वर्गासाठी आकर्षक मल्टीमिडिया सामग्री तयार करण्यात मदत करणारी साधने.';

  @override
  String get contentCreatorSectionEyebrow => 'एक साधन निवडा';

  @override
  String get contentCreatorVisualAidDesc =>
      'तुमच्या धड्यांसाठी सोपी रेखाचित्रे आणि आकृत्या तयार करा.';

  @override
  String get contentCreatorFieldTripDesc =>
      'Google Earth वापरून रोमांचक व्हर्च्युअल सफरींची योजना करा.';

  @override
  String get contentCreatorVideoDesc =>
      'तुमच्या धड्यांसाठी निवडक शैक्षणिक व्हिडिओ शोधा.';

  @override
  String get visualAidTitle => 'दृश्य साधन';

  @override
  String get visualAidSubtitle => 'शिकवण्याचे चित्र काढा';

  @override
  String get visualAidEmpty => 'एका चित्राचे वर्णन करा आणि तयार करा दाबा.';

  @override
  String get visualAidPromptLabel => 'चित्रात काय दाखवायचे आहे?';

  @override
  String get visualAidPromptHint => 'उदाहरणार्थ, वनस्पती पेशीचे भाग';

  @override
  String get visualAidPromptError => 'तुम्हाला कसे चित्र हवे आहे ते सांगा.';

  @override
  String get visualAidGradeLabel => 'इयत्ता स्तर';

  @override
  String get visualAidGradeAny => 'कोणतीही इयत्ता';

  @override
  String get visualAidSubjectLabel => 'विषय';

  @override
  String get visualAidSubjectAny => 'कोणताही विषय';

  @override
  String get visualAidOptional => 'पर्यायी';

  @override
  String get visualAidAction => 'चित्र तयार करा';

  @override
  String get visualAidResultTitle => 'दृश्य साधन';

  @override
  String get visualAidHowToUse => 'याचा वापर कसा करावा';

  @override
  String get visualAidDiscussionSpark => 'चर्चेचा प्रश्न';

  @override
  String get visualAidImageLabel => 'तयार केलेले शिकवण्याचे चित्र';

  @override
  String get visualAidImageError => 'हे चित्र दाखवता आले नाही.';

  @override
  String get visualAidNoImage =>
      'त्या वर्णनासाठी कोणतेही चित्र मिळाले नाही. कृपया ते पुन्हा लिहा आणि पुन्हा प्रयत्न करा.';

  @override
  String get visualAidSignIn =>
      'हे साधन वापरण्यासाठी कृपया पुन्हा साइन इन करा.';

  @override
  String get visualAidUpgradeTitle => 'उच्च योजना आवश्यक आहे';

  @override
  String get visualAidUpgradeBody =>
      'दृश्य साधन ही उच्च योजनेचा भाग आहे. चित्रे तयार करत राहण्यासाठी कृपया अपग्रेड करा.';

  @override
  String get visualAidSeePricing => 'योजना आणि किंमती पहा';

  @override
  String get visualAidDailyLimitTitle =>
      'आजसाठी तुमची सर्व चित्रे तयार झाली आहेत';

  @override
  String get visualAidDailyLimitBody =>
      'तुमच्या योजनेत दररोज ठराविक संख्येने दृश्य साधने समाविष्ट आहेत. तुमची चित्रे उद्या पुन्हा उपलब्ध होतील, किंवा तुम्ही उच्च योजनेवर दैनिक मर्यादा वाढवू शकता.';

  @override
  String get visualAidLimitTitle => 'तुम्ही तुमच्या मर्यादेपर्यंत पोहोचला आहात';

  @override
  String get visualAidLimitBody =>
      'तुम्ही या महिन्याची दृश्य साधने वापरली आहेत. तुमची चित्रे पुढील महिन्यात पुन्हा उपलब्ध होतील, किंवा तुम्ही उच्च योजनेवर मर्यादा वाढवू शकता.';

  @override
  String get visualAidRephrase =>
      'आम्ही ते चित्र तयार करू शकलो नाही. कृपया ते पुन्हा लिहा आणि पुन्हा प्रयत्न करा.';

  @override
  String get visualAidEmptyGeneration =>
      'चित्र रिकामे आले. कमी लेबलांसह वर्णन करण्याचा प्रयत्न करा.';

  @override
  String get visualAidBusy =>
      'सहायक आत्ता व्यस्त आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.';

  @override
  String visualAidBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'सहायक आत्ता व्यस्त आहे. कृपया सुमारे $seconds सेकंदांत पुन्हा प्रयत्न करा.',
      one: 'सहायक आत्ता व्यस्त आहे. कृपया सुमारे 1 सेकंदात पुन्हा प्रयत्न करा.',
    );
    return '$_temp0';
  }

  @override
  String get visualAidTimeout =>
      'यास अपेक्षेपेक्षा जास्त वेळ लागत आहे. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get videoStorytellerTitle => 'व्हिडिओ कथाकार';

  @override
  String get videoStorytellerSubtitle => 'शिकवण्याचे व्हिडिओ शोधा';

  @override
  String get videoStorytellerEmpty =>
      'एक विषय किंवा टॉपिक निवडा आणि व्हिडिओ शोधा वर टॅप करा.';

  @override
  String get videoStorytellerTopicLabel => 'टॉपिक किंवा धडा';

  @override
  String get videoStorytellerTopicHint => 'उदाहरणार्थ, जलचक्र';

  @override
  String get videoStorytellerSubjectLabel => 'विषय';

  @override
  String get videoStorytellerSubjectAny => 'कोणताही विषय';

  @override
  String get videoStorytellerGradeLabel => 'इयत्ता स्तर';

  @override
  String get videoStorytellerGradeAny => 'कोणतीही इयत्ता';

  @override
  String get videoStorytellerOptional => 'पर्यायी';

  @override
  String get videoStorytellerAction => 'व्हिडिओ शोधा';

  @override
  String get videoStorytellerNoResults =>
      'त्यासाठी कोणतेही व्हिडिओ मिळाले नाहीत. वेगळा विषय किंवा टॉपिक वापरून पहा.';

  @override
  String videoStorytellerViewAll(int count) {
    return 'सर्व $count पहा';
  }

  @override
  String get videoStorytellerOfficialSource => 'अधिकृत स्रोत';

  @override
  String get videoStorytellerOpensExternally =>
      'यूट्यूबमध्ये, ॲपच्या बाहेर उघडते.';

  @override
  String get videoStorytellerCategoryTopRecommended =>
      'तुमच्यासाठी सर्वोत्तम शिफारसी';

  @override
  String get videoStorytellerCategoryStorytelling =>
      'तुमच्या विषयांसाठी कथाकथन';

  @override
  String get videoStorytellerCategoryPedagogy =>
      'अध्यापनशास्त्र आणि शिकवण्याच्या पद्धती';

  @override
  String get videoStorytellerCategoryGovtUpdates => 'सरकारी अद्यतने';

  @override
  String get videoStorytellerCategoryCourses => 'शिक्षक प्रशिक्षण अभ्यासक्रम';

  @override
  String get videoStorytellerSignIn =>
      'हे साधन वापरण्यासाठी कृपया पुन्हा साइन इन करा.';

  @override
  String get videoStorytellerTimeout =>
      'यास अपेक्षेपेक्षा जास्त वेळ लागत आहे. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get videoStorytellerBusy =>
      'सहायक आत्ता व्यस्त आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.';

  @override
  String videoStorytellerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'सहायक आत्ता व्यस्त आहे. कृपया सुमारे $seconds सेकंदांत पुन्हा प्रयत्न करा.',
      one: 'सहायक आत्ता व्यस्त आहे. कृपया सुमारे 1 सेकंदात पुन्हा प्रयत्न करा.',
    );
    return '$_temp0';
  }

  @override
  String get videoStorytellerRephrase =>
      'आम्हाला त्यासाठी व्हिडिओ सापडले नाहीत. कृपया वेगळा टॉपिक वापरून पहा.';

  @override
  String get videoStorytellerLimit =>
      'तुम्ही अलीकडे खूप शोध घेतला आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.';

  @override
  String get actionDone => 'झाले';

  @override
  String get virtualFieldTripTitle => 'व्हर्च्युअल फील्ड ट्रिप';

  @override
  String get virtualFieldTripSubtitle => 'Google Earth वर जगाची सफर करा';

  @override
  String get virtualFieldTripEmpty =>
      'एक विषय प्रविष्ट करा आणि \'सहलीचे नियोजन करा\' वर टॅप करा.';

  @override
  String get virtualFieldTripTopicLabel => 'विषय किंवा संकल्पना';

  @override
  String get virtualFieldTripTopicHint => 'उदाहरणार्थ, ग्रेट बॅरियर रीफ';

  @override
  String get virtualFieldTripTopicError =>
      'कृपया सहलीसाठी एक विषय प्रविष्ट करा.';

  @override
  String get virtualFieldTripGradeLabel => 'इयत्ता स्तर';

  @override
  String get virtualFieldTripGradeAny => 'कोणतीही इयत्ता';

  @override
  String get virtualFieldTripOptional => 'ऐच्छिक';

  @override
  String get virtualFieldTripAction => 'सहलीचे नियोजन करा';

  @override
  String get virtualFieldTripDocType => 'व्हर्च्युअल फील्ड ट्रिप';

  @override
  String virtualFieldTripStopCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count थांबे',
      one: '1 थांबा',
    );
    return '$_temp0';
  }

  @override
  String virtualFieldTripStopSemantics(int number, String name) {
    return 'थांबा $number: $name';
  }

  @override
  String get virtualFieldTripFactLabel => 'तुम्हाला माहीत आहे का?';

  @override
  String get virtualFieldTripReflectionLabel => 'यावर विचार करा';

  @override
  String get virtualFieldTripAnalogyLabel => 'आपल्या संदर्भात';

  @override
  String get virtualFieldTripExplanationLabel => 'आपण येथे का जातो';

  @override
  String get virtualFieldTripOpenEarth => 'Google Earth मध्ये उघडा';

  @override
  String get virtualFieldTripOpensExternally =>
      'अ‍ॅपच्या बाहेर, Google Earth मध्ये उघडते.';

  @override
  String get virtualFieldTripPendingTitle =>
      'तुमच्या सहलीचे नियोजन अजून सुरू आहे';

  @override
  String get virtualFieldTripPendingBody =>
      'तुमची फील्ड ट्रिप अजून तयार होत आहे. एका मिनिटात \'माझी लायब्ररी\' पाहा.';

  @override
  String get virtualFieldTripNoStops =>
      'त्यासाठी कोणतेही थांबे मिळाले नाहीत. दुसरा विषय वापरून पाहा.';

  @override
  String get virtualFieldTripSignIn =>
      'हे साधन वापरण्यासाठी कृपया पुन्हा साइन इन करा.';

  @override
  String get virtualFieldTripUnavailable =>
      'हे साधन तुमच्या सध्याच्या योजनेचा भाग नाही.';

  @override
  String get virtualFieldTripTimeout =>
      'यास अपेक्षेपेक्षा जास्त वेळ लागत आहे. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get virtualFieldTripBusy =>
      'सहाय्यक सध्या व्यस्त आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.';

  @override
  String virtualFieldTripBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'सहाय्यक सध्या व्यस्त आहे. कृपया सुमारे $seconds सेकंदांनी पुन्हा प्रयत्न करा.',
      one:
          'सहाय्यक सध्या व्यस्त आहे. कृपया सुमारे 1 सेकंदाने पुन्हा प्रयत्न करा.',
    );
    return '$_temp0';
  }

  @override
  String get virtualFieldTripRephrase =>
      'त्यासाठी आम्ही सहलीचे नियोजन करू शकलो नाही. कृपया दुसरा विषय वापरून पाहा.';

  @override
  String get virtualFieldTripLimit =>
      'तुम्ही अलीकडे बऱ्याच सहलींचे नियोजन केले आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.';

  @override
  String get assessmentScannerTitle => 'मूल्यमापन स्कॅनर';

  @override
  String get assessmentScannerSubtitle =>
      'विद्यार्थ्याची उत्तरपत्रिका पानोपानी तपासा';

  @override
  String get assessmentScannerEmpty =>
      'उत्तरपत्रिकेचे 3 पर्यंत फोटो जोडा, नंतर तपासा दाबा.';

  @override
  String get assessmentScannerSubmit => 'उत्तरपत्रिका तपासा';

  @override
  String get assessmentScannerResultTitle => 'मूल्यमापन';

  @override
  String get assessmentScannerSectionSheet => 'उत्तरपत्रिका';

  @override
  String get assessmentScannerPagesLabel => 'उत्तरपत्रिकेची पाने';

  @override
  String get assessmentScannerPagesHint =>
      '3 पर्यंत स्पष्ट फोटो जोडा, प्रत्येक पानाचा एक.';

  @override
  String get assessmentScannerPagesEmpty => 'पहिल्या पानाचा एक फोटो जोडा.';

  @override
  String assessmentScannerPageLabel(int number) {
    return 'पान $number';
  }

  @override
  String assessmentScannerRemovePage(int number) {
    return 'पान $number काढा';
  }

  @override
  String assessmentScannerPageCounter(int count, int max) {
    return '$max पैकी $count पाने';
  }

  @override
  String assessmentScannerPagesFull(int max) {
    return 'तुम्ही $max पर्यंत पाने जोडू शकता.';
  }

  @override
  String get assessmentScannerTakePhoto => 'फोटो काढा';

  @override
  String get assessmentScannerChooseGallery => 'गॅलरीतून निवडा';

  @override
  String get assessmentScannerSubjectLabel => 'विषय';

  @override
  String get assessmentScannerSubjectHint => 'मूल्यमापन विषयानुसार होते.';

  @override
  String get assessmentScannerSubjectPlaceholder => 'विषय निवडा';

  @override
  String get assessmentScannerSubjectError => 'कृपया विषय निवडा.';

  @override
  String get assessmentScannerGradeLabel => 'इयत्ता स्तर';

  @override
  String get assessmentScannerGradePlaceholder => 'इयत्ता निवडा';

  @override
  String get assessmentScannerGradeError => 'कृपया इयत्ता निवडा.';

  @override
  String get assessmentScannerOptional => 'ऐच्छिक';

  @override
  String get assessmentScannerAnswerKeyLabel => 'उत्तरसूची';

  @override
  String get assessmentScannerAnswerKeyHint =>
      'योग्य उत्तरे चिकटवा, त्यांच्यानुसार तपासणी होईल.';

  @override
  String get assessmentScannerAnswerKeyPlaceholder =>
      'उत्तरसूची लिहा किंवा चिकटवा';

  @override
  String get assessmentScannerPrivacyNote =>
      'तपासणीसाठी विद्यार्थ्याचे नाव कधीही पाठवले जात नाही.';

  @override
  String assessmentScannerScoreCaption(String awarded, String max) {
    return '$max पैकी $awarded गुण';
  }

  @override
  String get assessmentScannerScoreOutOf => '100 पैकी';

  @override
  String assessmentScannerMarks(String awarded, String max) {
    return '$awarded/$max';
  }

  @override
  String assessmentScannerPagesMeta(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count पाने',
      one: '1 पान',
    );
    return '$_temp0';
  }

  @override
  String assessmentScannerReviewBadge(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count तपासा',
      one: '1 तपासा',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerQuestionsSection => 'प्रश्ननिहाय';

  @override
  String get assessmentScannerStudentAnswerLabel => 'विद्यार्थ्याने लिहिले';

  @override
  String get assessmentScannerFeedbackLabel => 'अभिप्राय';

  @override
  String get assessmentScannerExpectedLabel => 'अपेक्षित उत्तर';

  @override
  String get assessmentScannerNextStepsSection => 'शिफारस केलेली पुढील पावले';

  @override
  String get assessmentScannerStudentSection => 'विद्यार्थ्यासाठी';

  @override
  String get assessmentScannerQualitySection => 'फोटो गुणवत्ता';

  @override
  String get assessmentScannerNotScored => 'गुण दिले नाहीत';

  @override
  String get assessmentScannerNoContent =>
      'कोणतेही गुण मिळाले नाहीत. कृपया स्पष्ट फोटो वापरून पहा.';

  @override
  String get assessmentScannerOutcomeCorrect => 'बरोबर';

  @override
  String get assessmentScannerOutcomePartial => 'अंशतः बरोबर';

  @override
  String get assessmentScannerOutcomeIncorrect => 'चूक';

  @override
  String get assessmentScannerReviewChip => 'हे तपासा';

  @override
  String get assessmentScannerSignIn =>
      'उत्तरपत्रिका तपासण्यासाठी कृपया पुन्हा साइन इन करा.';

  @override
  String get assessmentScannerUpgradeTitle => 'उच्च योजना आवश्यक आहे';

  @override
  String get assessmentScannerUpgradeBody =>
      'उत्तरपत्रिका तपासणे ही उच्च योजनेचा भाग आहे. तपासणी सुरू ठेवण्यासाठी अपग्रेड करा.';

  @override
  String get assessmentScannerSeePricing => 'योजना पहा';

  @override
  String get assessmentScannerDailyLimitTitle =>
      'आजच्या तुमच्या सर्व उत्तरपत्रिका पूर्ण झाल्या';

  @override
  String get assessmentScannerDailyLimitBody =>
      'तुमच्या योजनेत दररोज ठराविक संख्येने उत्तरपत्रिका आहेत. त्या उद्या पुन्हा सुरू होतील, किंवा उच्च योजनेत मर्यादा वाढवू शकता.';

  @override
  String get assessmentScannerLimitTitle =>
      'तुम्ही तुमची तपासणी मर्यादा गाठली आहे';

  @override
  String get assessmentScannerLimitBody =>
      'तुम्ही तुमच्या योजनेतील सर्व उत्तरपत्रिका वापरल्या आहेत. त्या पुढील महिन्यात पुन्हा सुरू होतील, किंवा उच्च योजनेत मर्यादा वाढवू शकता.';

  @override
  String get assessmentScannerBusy =>
      'तपासणी मॉडेल सध्या व्यस्त आहे. कृपया एका मिनिटात पुन्हा प्रयत्न करा.';

  @override
  String assessmentScannerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'तपासणी मॉडेल सध्या व्यस्त आहे. कृपया सुमारे $seconds सेकंदात पुन्हा प्रयत्न करा.',
      one:
          'तपासणी मॉडेल सध्या व्यस्त आहे. कृपया सुमारे 1 सेकंदात पुन्हा प्रयत्न करा.',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerTimeout =>
      'तपासणीला नेहमीपेक्षा जास्त वेळ लागत आहे. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get assessmentScannerRephrase =>
      'फोटो तपासता आले नाहीत. कृपया स्पष्ट पाने पुन्हा अपलोड करा.';

  @override
  String get inboxTitle => 'संदेश';

  @override
  String get inboxSignInTitle => 'तुमचे संदेश';

  @override
  String get inboxSignInBody => 'तुमचे संदेश पाहण्यासाठी साइन इन करा';

  @override
  String get inboxEmptyTitle => 'अजून कोणतेही संभाषण नाही';

  @override
  String get inboxEmptyBody =>
      'तुम्ही शिक्षकांशी जोडले जाल तेव्हा, तुमची संभाषणे इथे दिसतील.';

  @override
  String get inboxErrorBody =>
      'आम्ही तुमचे संदेश लोड करू शकलो नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get inboxNoMessagesYet => 'अजून कोणतेही संदेश नाहीत';

  @override
  String get inboxThreadFallbackTitle => 'संभाषण';

  @override
  String get inboxThreadEmptyTitle => 'अजून कोणतेही संदेश नाहीत';

  @override
  String get inboxThreadEmptyBody => 'संभाषण सुरू करण्यासाठी नमस्कार म्हणा.';

  @override
  String get inboxComposerHint => 'एक संदेश लिहा';

  @override
  String get inboxComposerSend => 'पाठवा';

  @override
  String get inboxComposerTooLong => 'संदेश खूप लांब आहे. कृपया तो लहान करा.';

  @override
  String get inboxLoadOlder => 'जुने संदेश लोड करा';

  @override
  String get inboxSendFailed => 'तुमचा संदेश पाठवता आला नाही.';

  @override
  String get inboxResourceLabel => 'संसाधन';

  @override
  String get inboxVoiceNoteLabel => 'व्हॉइस नोट';

  @override
  String inboxUnreadLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count न वाचलेले',
      one: '1 न वाचलेला',
    );
    return '$_temp0';
  }

  @override
  String get inboxTickSending => 'पाठवत आहे';

  @override
  String get inboxTickSent => 'पाठवले';

  @override
  String get inboxTickDelivered => 'पोहोचले';

  @override
  String get inboxTickRead => 'वाचले';

  @override
  String get inboxTickFailed => 'पाठवले नाही';

  @override
  String get inboxTimeNow => 'आता';

  @override
  String inboxTimeMinutes(int count) {
    return '$count मि';
  }

  @override
  String inboxTimeHours(int count) {
    return '$count ता';
  }

  @override
  String inboxTimeDays(int count) {
    return '$count दि';
  }

  @override
  String inboxTimeWeeks(int count) {
    return '$count आ';
  }

  @override
  String get networkTitle => 'नेटवर्क';

  @override
  String get networkTooltip => 'नेटवर्क';

  @override
  String get networkTabStaffroom => 'स्टाफरूम';

  @override
  String get networkTabMessages => 'संदेश';

  @override
  String get staffroomTitle => 'स्टाफरूम';

  @override
  String get staffroomHeroTitle => 'स्टाफरूम';

  @override
  String get staffroomHeroDeck => 'संपूर्ण भारतातील शिक्षक, एका खोलीत';

  @override
  String get staffroomSectionGroups => 'तुमचे गट';

  @override
  String get staffroomSectionFeed => 'तुमच्या गटांकडून';

  @override
  String get staffroomSectionDiscover => 'गट शोधा';

  @override
  String get staffroomSectionPeople => 'तुम्ही ओळखत असाल असे लोक';

  @override
  String get staffroomSignInTitle => 'स्टाफरूममध्ये सामील व्हा';

  @override
  String get staffroomSignInBody =>
      'स्टाफरूममध्ये सामील होण्यासाठी साइन इन करा';

  @override
  String get staffroomFeedEmptyTitle => 'तुमचे फीड शांत आहे';

  @override
  String get staffroomFeedEmptyBody => 'तुमच्या गटांतील पोस्ट येथे दिसतील.';

  @override
  String get staffroomErrorBody =>
      'आम्ही स्टाफरूम लोड करू शकलो नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get staffroomGroupsEmptyTitle => 'अजून कोणतेही गट नाहीत';

  @override
  String get staffroomGroupsEmptyBody =>
      'पोस्ट आणि चॅट पाहण्यासाठी एखाद्या गटात सामील व्हा.';

  @override
  String get staffroomBrowseGroups => 'गट ब्राउझ करा';

  @override
  String staffroomMemberCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count सदस्य',
      one: '1 सदस्य',
    );
    return '$_temp0';
  }

  @override
  String get staffroomJoin => 'सामील व्हा';

  @override
  String get staffroomJoined => 'सामील झालात';

  @override
  String get staffroomJoinFailed =>
      'सामील होता आले नाही. पुन्हा प्रयत्नासाठी टॅप करा.';

  @override
  String get staffroomGroupLockedTitle => 'फक्त सदस्यांसाठी';

  @override
  String get staffroomGroupLockedBody =>
      'या गटातील पोस्ट पाहण्यासाठी सामील व्हा.';

  @override
  String get staffroomGroupPostsEmptyTitle => 'अजून कोणतीही पोस्ट नाही';

  @override
  String get staffroomGroupPostsEmptyBody => 'येथे प्रथम शेअर करा.';

  @override
  String get staffroomGroupNotFoundTitle => 'गट सापडला नाही';

  @override
  String get staffroomGroupNotFoundBody => 'हा गट काढून टाकला गेला असावा.';

  @override
  String get staffroomPostTypeShare => 'शेअर केले';

  @override
  String get staffroomPostTypeAskHelp => 'मदत हवी';

  @override
  String get staffroomPostTypeCelebrate => 'उत्सव';

  @override
  String get staffroomPostTypeResource => 'संसाधन';

  @override
  String get staffroomLike => 'लाईक';

  @override
  String get staffroomLiked => 'लाईक केले';

  @override
  String staffroomLikeCountLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count लाईक',
      one: '1 लाईक',
      zero: 'कोणतेही लाईक नाहीत',
    );
    return '$_temp0';
  }

  @override
  String get staffroomLikeFailed =>
      'अपडेट करता आले नाही. पुन्हा प्रयत्नासाठी टॅप करा.';

  @override
  String get staffroomResourceShared => 'एक संसाधन शेअर केले';

  @override
  String staffroomChatHighlight(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count नवीन संदेश',
      one: '1 नवीन संदेश',
    );
    return '$_temp0';
  }

  @override
  String get staffroomConnect => 'कनेक्ट करा';

  @override
  String get staffroomConnectSent => 'विनंती पाठवली';

  @override
  String get staffroomConnectPending => 'विनंती आधीच प्रलंबित आहे';

  @override
  String get staffroomConnectConnected => 'आधीच कनेक्टेड';

  @override
  String get staffroomChatTitle => 'स्टाफरूम';

  @override
  String get staffroomChatEntryBody => 'संपूर्ण भारतातील शिक्षकांशी गप्पा मारा';

  @override
  String get staffroomChatSignInTitle => 'स्टाफरूममध्ये सामील व्हा';

  @override
  String get staffroomChatSignInBody =>
      'स्टाफरूममध्ये सामील होण्यासाठी साइन इन करा';

  @override
  String get staffroomChatEmptyTitle => 'अद्याप कोणतेही संदेश नाहीत';

  @override
  String get staffroomChatEmptyBody => 'सर्वात आधी नमस्कार म्हणा.';

  @override
  String get staffroomChatAiBadge => 'AI शिक्षक';

  @override
  String get staffroomGroupChatEntry => 'ग्रुप चॅट';

  @override
  String get staffroomDirectoryTitle => 'शिक्षक शोधा';

  @override
  String get staffroomDirectoryEntryBody => 'शिक्षक निर्देशिकेत शोधा';

  @override
  String get staffroomDirectorySearchHint => 'नाव किंवा विषयानुसार शोधा';

  @override
  String get staffroomDirectoryErrorBody =>
      'निर्देशिका लोड होऊ शकली नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get staffroomDirectoryEmptyTitle => 'कोणतेही शिक्षक सापडले नाहीत';

  @override
  String get staffroomDirectoryEmptyBody =>
      'अद्याप दाखवण्यासाठी कोणतेही शिक्षक नाहीत.';

  @override
  String get staffroomDirectorySearchEmpty =>
      'तुमच्या शोधाशी कोणतेही शिक्षक जुळत नाहीत.';

  @override
  String get staffroomProfileTitle => 'शिक्षक';

  @override
  String get staffroomProfileErrorBody =>
      'हे प्रोफाइल लोड होऊ शकले नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get staffroomProfileNotFoundTitle => 'प्रोफाइल उपलब्ध नाही';

  @override
  String get staffroomProfileNotFoundBody => 'हे प्रोफाइल सापडले नाही.';

  @override
  String get staffroomProfileAboutLabel => 'परिचय';

  @override
  String get staffroomProfileBioEmpty => 'अद्याप कोणताही परिचय नाही.';

  @override
  String get staffroomProfileVerified => 'सत्यापित';

  @override
  String staffroomProfileExperience(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count वर्षांचा अनुभव',
      one: '1 वर्षाचा अनुभव',
    );
    return '$_temp0';
  }

  @override
  String get staffroomProfileSubjectsLabel => 'विषय';

  @override
  String get staffroomProfileClassesLabel => 'वर्ग';

  @override
  String get staffroomProfileLanguagesLabel => 'भाषा';

  @override
  String get staffroomRequested => 'विनंती पाठवली';

  @override
  String get staffroomConnectionAccept => 'स्वीकारा';

  @override
  String get staffroomConnectionDecline => 'नाकारा';

  @override
  String get staffroomConnected => 'कनेक्ट झाले';

  @override
  String get staffroomConnectionWants => 'कनेक्ट होऊ इच्छितात';

  @override
  String get staffroomMessage => 'संदेश पाठवा';

  @override
  String get staffroomConnectToMessage => 'संदेशासाठी कनेक्ट करा';

  @override
  String get staffroomConnectionFailed =>
      'अपडेट होऊ शकले नाही. पुन्हा प्रयत्न करण्यासाठी टॅप करा.';

  @override
  String get staffroomDisconnect => 'डिस्कनेक्ट करा';

  @override
  String get staffroomDisconnectConfirmTitle => 'डिस्कनेक्ट करायचे?';

  @override
  String get staffroomDisconnectConfirmBody =>
      'तुम्ही यापुढे कनेक्ट राहणार नाही किंवा एकमेकांना संदेश पाठवू शकणार नाही.';

  @override
  String get staffroomDisconnectCancel => 'कनेक्ट रहा';

  @override
  String get staffroomFollow => 'फॉलो करा';

  @override
  String get staffroomFollowing => 'फॉलो करत आहात';

  @override
  String get staffroomFollowFailed =>
      'अपडेट होऊ शकले नाही. पुन्हा प्रयत्न करण्यासाठी टॅप करा.';
}
