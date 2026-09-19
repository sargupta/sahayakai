// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Hindi (`hi`).
class AppLocalizationsHi extends AppLocalizations {
  AppLocalizationsHi([String locale = 'hi']) : super(locale);

  @override
  String get appTitle => 'SahayakAI';

  @override
  String get navHome => 'होम';

  @override
  String get navCreate => 'बनाएँ';

  @override
  String get navLibrary => 'लाइब्रेरी';

  @override
  String get navProfile => 'प्रोफ़ाइल';

  @override
  String get actionRetry => 'फिर से कोशिश करें';

  @override
  String get actionSignIn => 'साइन इन करें';

  @override
  String get actionSignOut => 'साइन आउट';

  @override
  String get actionGenerate => 'तैयार करें';

  @override
  String get stateOfflineTitle => 'आप ऑफ़लाइन हैं';

  @override
  String get stateOfflineBody => 'अपना कनेक्शन जाँचें और फिर से कोशिश करें।';

  @override
  String get errorGeneric => 'कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।';

  @override
  String get emptyDefault => 'फ़ॉर्म भरें और तैयार करें पर टैप करें।';

  @override
  String get languageLabel => 'भाषा';

  @override
  String get splashTagline => 'हर कक्षा के लिए शिक्षण सहायक';

  @override
  String get splashFailedTitle => 'हम ऐप शुरू नहीं कर सके';

  @override
  String get splashFailedBody => 'कृपया अपना कनेक्शन जाँचें और फिर कोशिश करें।';

  @override
  String get loginTitle => 'SahayakAI में आपका स्वागत है';

  @override
  String get loginSubtitle =>
      'पाठ योजना, क्विज़ और बहुत कुछ के लिए साइन इन करें।';

  @override
  String get loginGoogle => 'Google से जारी रखें';

  @override
  String get loginPrivacyNote =>
      'हम आपके Google खाते का उपयोग केवल साइन इन करने के लिए करते हैं। आपका काम आपका ही रहता है।';

  @override
  String get loginLanguagePrompt => 'अपनी भाषा चुनें';

  @override
  String get loginLanguageHint =>
      'SahayakAI आपकी भाषा में काम करता है, और आपकी शिक्षण सामग्री भी उसी भाषा में लिखता है।';

  @override
  String get loginValueLessons => 'मिनटों में पूरी पाठ योजना बनाएं';

  @override
  String get loginValueQuizzes => 'तीन कठिनाई स्तरों पर क्विज़ बनाएं';

  @override
  String get loginValueAnswers =>
      'अपनी भाषा में कक्षा के किसी भी प्रश्न का उत्तर दें';

  @override
  String get onboardingTitle => 'SahayakAI सेट अप करें';

  @override
  String get onboardingSkip => 'अभी के लिए छोड़ें';

  @override
  String onboardingStepLabel(int current, int total) {
    return '$total में से चरण $current';
  }

  @override
  String get onboardingBack => 'वापस';

  @override
  String get onboardingNext => 'अगला';

  @override
  String get onboardingSaveAndContinue => 'सहेजें और जारी रखें';

  @override
  String get onboardingFinish => 'अपने डैशबोर्ड पर जाएं';

  @override
  String get onboardingLanguageTitle => 'आप किस भाषा में पढ़ाते हैं?';

  @override
  String get onboardingLanguageBody =>
      'आपकी चुनी हुई भाषा में ही पाठ योजनाएं, क्विज़ और उत्तर मिलेंगे। आप इसे कभी भी बदल सकते हैं।';

  @override
  String get onboardingProfileTitle => 'अपनी कक्षा के बारे में बताएं';

  @override
  String get onboardingProfileBody =>
      'हर फ़ील्ड वैकल्पिक है। आप जो साझा करते हैं, उसका उपयोग आपकी सामग्री को आपके बोर्ड, आपकी कक्षाओं और आपके राज्य के अनुसार तैयार करने के लिए किया जाता है।';

  @override
  String get onboardingReadyTitle => 'आप शुरू करने के लिए तैयार हैं';

  @override
  String get onboardingReadyBody =>
      'आपकी पाठ योजनाएं, क्विज़ और उत्तर इसी के अनुसार होंगे। आप इसे बाद में अपनी प्रोफ़ाइल से कभी भी बदल सकते हैं।';

  @override
  String get onboardingSaveFailed =>
      'हम आपकी प्रोफ़ाइल सहेज नहीं सके। आप अभी जारी रख सकते हैं और इसे बाद में अपनी प्रोफ़ाइल से जोड़ सकते हैं।';

  @override
  String get onboardingSaveSignIn =>
      'अपनी प्रोफ़ाइल सहेजने के लिए कृपया फिर से साइन इन करें। आप अभी जारी रख सकते हैं और इसे बाद में जोड़ सकते हैं।';

  @override
  String get dashboardGreeting => 'वापसी पर स्वागत है';

  @override
  String dashboardGreetingNamed(String name) {
    return 'वापसी पर स्वागत है, $name';
  }

  @override
  String get dashboardGreetingMorning => 'सुप्रभात';

  @override
  String get dashboardGreetingAfternoon => 'शुभ दोपहर';

  @override
  String get dashboardGreetingEvening => 'शुभ संध्या';

  @override
  String get actionOpen => 'खोलें';

  @override
  String get actionRegenerate => 'फिर से बनाएँ';

  @override
  String get actionCopy => 'कॉपी करें';

  @override
  String get copyConfirmation => 'क्लिपबोर्ड पर कॉपी किया गया';

  @override
  String get readAloudListen => 'सुनें';

  @override
  String get readAloudStop => 'रोकें';

  @override
  String get readAloudError => 'ऑडियो नहीं चल सका। कृपया फिर कोशिश करें।';

  @override
  String voiceResultReady(String tool) {
    return 'आपका $tool तैयार है।';
  }

  @override
  String voiceResultReadyWithTopic(String tool, String topic) {
    return '$topic पर आपका $tool तैयार है।';
  }

  @override
  String get lessonPlanSectionLesson => 'पाठ';

  @override
  String get lessonPlanSectionApproach => 'शिक्षण दृष्टिकोण';

  @override
  String get quizSectionQuiz => 'क्विज़';

  @override
  String get sectionForYourClass => 'आपकी कक्षा के लिए';

  @override
  String get instantAnswerResultTitle => 'उत्तर';

  @override
  String get dashboardToolsTitle => 'आपके शिक्षण उपकरण';

  @override
  String get createPaletteSearchHint => 'उपकरण खोजें';

  @override
  String get createPaletteEmpty => 'आपकी खोज से मेल खाता कोई उपकरण नहीं';

  @override
  String get dashboardRecentTitle => 'हाल का काम';

  @override
  String get dashboardRecentEmpty =>
      'आप जो भी बनाएँगे वह यहाँ सहेजा जाएगा, फिर से खोलने के लिए तैयार।';

  @override
  String get dashboardRecentFailed =>
      'हम आपका हाल का काम नहीं खोल सके। कृपया फिर कोशिश करें।';

  @override
  String get dashboardRecentSignedOut =>
      'अपना हाल का काम देखने के लिए साइन इन करें।';

  @override
  String get dashboardUntitled => 'बिना शीर्षक';

  @override
  String get dashboardSetupTitle => 'अपनी प्रोफ़ाइल पूरी करें';

  @override
  String get dashboardSetupBody =>
      'अपना स्कूल और अपनी कक्षाएँ जोड़ें, फिर हर पाठ योजना और क्विज़ आपकी कक्षा के अनुरूप मिलेगी।';

  @override
  String get dashboardSetupAction => 'मेरी प्रोफ़ाइल सेट करें';

  @override
  String get dashboardSetupDismiss => 'अभी नहीं';

  @override
  String get contentTypeLessonPlan => 'पाठ योजना';

  @override
  String get contentTypeQuiz => 'क्विज़';

  @override
  String get contentTypeWorksheet => 'वर्कशीट';

  @override
  String get contentTypeVisualAid => 'दृश्य सामग्री';

  @override
  String get contentTypeRubric => 'रूब्रिक';

  @override
  String get contentTypeMicroLesson => 'सूक्ष्म पाठ';

  @override
  String get contentTypeVirtualFieldTrip => 'वर्चुअल फ़ील्ड ट्रिप';

  @override
  String get contentTypeInstantAnswer => 'तुरंत उत्तर';

  @override
  String get contentTypeTeacherTraining => 'शिक्षक प्रशिक्षण';

  @override
  String get contentTypeExamPaper => 'प्रश्नपत्र';

  @override
  String get contentTypeAssessment => 'मूल्यांकन';

  @override
  String get contentTypeAssessmentSubmission => 'स्कैन किया गया मूल्यांकन';

  @override
  String get contentTypeUnknown => 'सहेजा गया काम';

  @override
  String get libraryTitle => 'मेरी लाइब्रेरी';

  @override
  String get librarySectionSaved => 'सहेजा गया काम';

  @override
  String get libraryEmpty =>
      'आपकी सहेजी गई पाठ योजनाएँ और क्विज़ यहाँ दिखेंगी।';

  @override
  String get libraryEmptyAction => 'पाठ योजना बनाएँ';

  @override
  String get librarySignedOut =>
      'अपना सहेजा गया काम देखने के लिए साइन इन करें।';

  @override
  String get libraryLoadFailed => 'आपकी लाइब्रेरी लोड नहीं हो सकी।';

  @override
  String get libraryNewestOnly => 'आपकी 20 सबसे हाल की चीज़ें दिख रही हैं।';

  @override
  String get libraryFilterAll => 'सभी';

  @override
  String get libraryFilterEmpty =>
      'इस प्रकार का कोई सहेजा गया काम अभी नहीं है।';

  @override
  String get libraryDetailTitle => 'सहेजी गई सामग्री';

  @override
  String libraryDetailSavedOn(String date) {
    return '$date को सहेजा गया';
  }

  @override
  String get libraryDetailSignedOut =>
      'अपना सहेजा गया काम खोलने के लिए साइन इन करें।';

  @override
  String get libraryDetailNotFound => 'यह अब आपकी लाइब्रेरी में नहीं है।';

  @override
  String get libraryDetailLoadFailed =>
      'हम इसे नहीं खोल सके। कृपया फिर कोशिश करें।';

  @override
  String libraryDetailReady(String type) {
    return 'आप अपना सहेजा गया $type देख रहे हैं।';
  }

  @override
  String get profileTitle => 'प्रोफ़ाइल';

  @override
  String get lessonPlanTitle => 'पाठ योजना';

  @override
  String get lessonPlanIncludeLabel => 'शामिल करें';

  @override
  String get lessonPlanIncludeActivity => 'गतिविधि';

  @override
  String get lessonPlanIncludeBoardWork => 'बोर्ड कार्य';

  @override
  String get lessonPlanIncludeHomework => 'गृहकार्य';

  @override
  String get lessonPlanIncludeStoryHook => 'कहानी की शुरुआत';

  @override
  String get lessonPlanNcertTitle => 'NCERT-अनुरूप';

  @override
  String lessonPlanNcertBody(String grade) {
    return 'आपकी योजना $grade के NCERT पाठ्यक्रम के अनुसार जाँची जाती है।';
  }

  @override
  String get lessonPlanSubtitle => 'पूरा 5E पाठ तैयार करें';

  @override
  String get lessonPlanEmpty =>
      'टॉपिक जोड़ें और 5E पाठ योजना बनाने के लिए तैयार करें पर टैप करें।';

  @override
  String get lessonPlanTopicLabel => 'टॉपिक';

  @override
  String get lessonPlanTopicHint => 'उदाहरण के लिए, प्रकाश संश्लेषण';

  @override
  String get lessonPlanTopicError => 'कृपया योजना के लिए एक टॉपिक दर्ज करें।';

  @override
  String get lessonPlanGradeLabel => 'कक्षा स्तर';

  @override
  String get lessonPlanSubjectLabel => 'विषय';

  @override
  String get lessonPlanSubjectAny => 'कोई भी विषय';

  @override
  String get lessonPlanResourceLabel => 'कक्षा के संसाधन';

  @override
  String get lessonPlanResourceLow => 'कम';

  @override
  String get lessonPlanResourceMedium => 'मध्यम';

  @override
  String get lessonPlanResourceHigh => 'अधिक';

  @override
  String get lessonPlanDifficultyLabel => 'कठिनाई';

  @override
  String get lessonPlanDifficultyRemedial => 'उपचारात्मक';

  @override
  String get lessonPlanDifficultyStandard => 'मानक';

  @override
  String get lessonPlanDifficultyAdvanced => 'उन्नत';

  @override
  String get lessonPlanRuralLabel => 'स्थानीय, रोज़मर्रा के उदाहरण लें';

  @override
  String get lessonPlanRuralHint =>
      'गतिविधियाँ परिचित ग्रामीण और सामुदायिक परिवेश पर आधारित करें।';

  @override
  String get lessonPlanOptional => 'वैकल्पिक';

  @override
  String get lessonPlanObjectives => 'अधिगम उद्देश्य';

  @override
  String get lessonPlanVocabulary => 'मुख्य शब्दावली';

  @override
  String get lessonPlanMaterials => 'सामग्री';

  @override
  String get lessonPlanActivities => '5E गतिविधियाँ';

  @override
  String get lessonPlanAssessment => 'मूल्यांकन';

  @override
  String get lessonPlanHomework => 'गृहकार्य';

  @override
  String get lessonPlanTeacherTip => 'शिक्षक के लिए सुझाव';

  @override
  String get lessonPlanUnderstandingCheck => 'समझ की जाँच';

  @override
  String get lessonPlanNoteLabel => 'शुरू करने से पहले एक बात';

  @override
  String get lessonPlanUpgradeTitle => 'उच्च योजना आवश्यक है';

  @override
  String get lessonPlanUpgradeBody =>
      'पाठ योजना बनाना उच्च योजना का हिस्सा है। योजनाएँ बनाते रहने के लिए कृपया अपग्रेड करें।';

  @override
  String get lessonPlanLimitTitle => 'आप अपनी सीमा तक पहुँच गए हैं';

  @override
  String get lessonPlanLimitBody =>
      'आपने फ़िलहाल अपनी पाठ योजनाएँ उपयोग कर ली हैं। कृपया बाद में फिर कोशिश करें या अपनी योजना अपग्रेड करें।';

  @override
  String get lessonPlanSeePricing => 'योजनाएँ और मूल्य देखें';

  @override
  String get lessonPlanRephrase =>
      'हम उससे योजना नहीं बना सके। कृपया टॉपिक दोबारा लिखें और फिर कोशिश करें।';

  @override
  String get lessonPlanBusy =>
      'सहायक अभी व्यस्त है। कृपया थोड़ी देर में फिर कोशिश करें।';

  @override
  String get lessonPlanTimeout =>
      'इसमें अपेक्षा से अधिक समय लग रहा है। कृपया फिर कोशिश करें।';

  @override
  String get lessonPlanSignIn =>
      'इस उपकरण का उपयोग करने के लिए कृपया फिर से साइन इन करें।';

  @override
  String get quizTitle => 'क्विज़';

  @override
  String get quizSubtitle => 'तीन कठिनाई स्तरों पर क्विज़ बनाएँ';

  @override
  String get quizEmpty =>
      'टॉपिक जोड़ें और क्विज़ बनाने के लिए तैयार करें पर टैप करें।';

  @override
  String get quizTopicLabel => 'टॉपिक';

  @override
  String get quizTopicHint => 'उदाहरण के लिए, भिन्न';

  @override
  String get quizTopicError => 'कृपया क्विज़ के लिए एक टॉपिक दर्ज करें।';

  @override
  String get quizNumQuestionsLabel => 'प्रश्नों की संख्या';

  @override
  String get quizFewerQuestions => 'कम प्रश्न';

  @override
  String get quizMoreQuestions => 'अधिक प्रश्न';

  @override
  String get quizTypesLabel => 'प्रश्नों के प्रकार';

  @override
  String get quizTypesError => 'कृपया कम से कम एक प्रश्न प्रकार चुनें।';

  @override
  String get quizTypeMultipleChoice => 'बहुविकल्पीय';

  @override
  String get quizTypeFillInTheBlanks => 'रिक्त स्थान भरें';

  @override
  String get quizTypeShortAnswer => 'लघु उत्तर';

  @override
  String get quizTypeTrueFalse => 'सही या ग़लत';

  @override
  String get quizGradeLabel => 'कक्षा स्तर';

  @override
  String get quizGradeAny => 'कोई भी कक्षा';

  @override
  String get quizSubjectLabel => 'विषय';

  @override
  String get quizSubjectAny => 'कोई भी विषय';

  @override
  String get quizDifficultyLabel => 'कठिनाई';

  @override
  String get quizDifficultyHint =>
      'सभी स्तर पर छोड़ें तो सरल, मध्यम और कठिन तीनों संस्करण मिलेंगे।';

  @override
  String get quizDifficultyAll => 'सभी स्तर';

  @override
  String get quizDifficultyEasy => 'सरल';

  @override
  String get quizDifficultyMedium => 'मध्यम';

  @override
  String get quizDifficultyHard => 'कठिन';

  @override
  String get quizBloomsLabel => 'चिंतन कौशल';

  @override
  String get quizBloomsHint => 'चुनें कि प्रश्न किस तरह की सोच माँगें।';

  @override
  String get quizOptional => 'वैकल्पिक';

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
  String get quizShowAnswer => 'उत्तर दिखाएँ';

  @override
  String get quizHideAnswer => 'उत्तर छिपाएँ';

  @override
  String get quizShowAllAnswers => 'सभी उत्तर दिखाएँ';

  @override
  String get quizHideAllAnswers => 'सभी उत्तर छिपाएँ';

  @override
  String get quizCorrectAnswer => 'सही उत्तर';

  @override
  String get quizExplanation => 'क्यों';

  @override
  String get quizTeacherInstructions => 'कक्षा में इसे कैसे कराएँ';

  @override
  String get quizNoteLabel => 'शुरू करने से पहले एक बात';

  @override
  String get quizNoQuestions =>
      'उस टॉपिक के लिए कोई प्रश्न नहीं मिले। कृपया कोई दूसरा टॉपिक आज़माएँ।';

  @override
  String get quizUpgradeTitle => 'उच्च योजना आवश्यक है';

  @override
  String get quizUpgradeBody =>
      'क्विज़ बनाना उच्च योजना का हिस्सा है। क्विज़ बनाते रहने के लिए कृपया अपग्रेड करें।';

  @override
  String get quizLimitTitle => 'आप अपनी सीमा तक पहुँच गए हैं';

  @override
  String get quizLimitBody =>
      'आपने फ़िलहाल अपनी क्विज़ उपयोग कर ली हैं। कृपया बाद में फिर कोशिश करें या अपनी योजना अपग्रेड करें।';

  @override
  String get quizSeePricing => 'योजनाएँ और मूल्य देखें';

  @override
  String get quizRephrase =>
      'हम उससे क्विज़ नहीं बना सके। कृपया टॉपिक दोबारा लिखें और फिर कोशिश करें।';

  @override
  String get quizBusy =>
      'सहायक अभी व्यस्त है। कृपया थोड़ी देर में फिर कोशिश करें।';

  @override
  String get quizTimeout =>
      'इसमें अपेक्षा से अधिक समय लग रहा है। कृपया फिर कोशिश करें।';

  @override
  String get quizSignIn =>
      'इस उपकरण का उपयोग करने के लिए कृपया फिर से साइन इन करें।';

  @override
  String get instantAnswerTitle => 'तुरंत उत्तर';

  @override
  String get instantAnswerSubtitle => 'कक्षा का कोई भी प्रश्न पूछें';

  @override
  String get instantAnswerAction => 'उत्तर पाएँ';

  @override
  String get instantAnswerEmpty => 'प्रश्न पूछें और उत्तर पाएँ पर टैप करें।';

  @override
  String get instantAnswerQuestionLabel => 'आपका प्रश्न';

  @override
  String get instantAnswerQuestionHint =>
      'उदाहरण के लिए, चंद्रमा का आकार क्यों बदलता है?';

  @override
  String get instantAnswerQuestionError => 'कृपया एक प्रश्न दर्ज करें।';

  @override
  String get instantAnswerGradeLabel => 'कक्षा स्तर';

  @override
  String get instantAnswerGradeAny => 'कोई भी कक्षा';

  @override
  String get instantAnswerSubjectLabel => 'विषय';

  @override
  String get instantAnswerSubjectAny => 'कोई भी विषय';

  @override
  String get instantAnswerOptional => 'वैकल्पिक';

  @override
  String get instantAnswerVideoTitle => 'संबंधित वीडियो देखें';

  @override
  String get instantAnswerVideoBody =>
      'ऐप के बाहर, आपके ब्राउज़र में खुलता है।';

  @override
  String get instantAnswerNoAnswer =>
      'उस प्रश्न का कोई उत्तर नहीं मिला। कृपया इसे दोबारा लिखें और फिर कोशिश करें।';

  @override
  String get instantAnswerSeePricing => 'योजनाएँ और मूल्य देखें';

  @override
  String get instantAnswerDailyLimitTitle =>
      'आज के लिए आपके सभी प्रश्न पूरे हो गए';

  @override
  String get instantAnswerDailyLimitBody =>
      'आपकी योजना में हर दिन तय संख्या में तुरंत उत्तर शामिल हैं। आपके प्रश्न कल फिर शुरू होंगे, या आप उच्च योजना पर दैनिक सीमा बढ़ा सकते हैं।';

  @override
  String get instantAnswerLimitTitle => 'आप अपनी सीमा तक पहुँच गए हैं';

  @override
  String get instantAnswerLimitBody =>
      'आपने इस महीने के अपने तुरंत उत्तर उपयोग कर लिए हैं। आपके प्रश्न अगले महीने फिर शुरू होंगे, या आप उच्च योजना पर सीमा बढ़ा सकते हैं।';

  @override
  String get instantAnswerUpgradeTitle => 'उच्च योजना आवश्यक है';

  @override
  String get instantAnswerUpgradeBody =>
      'तुरंत उत्तर उच्च योजना का हिस्सा हैं। प्रश्न पूछते रहने के लिए कृपया अपग्रेड करें।';

  @override
  String get instantAnswerRephrase =>
      'हम उसका उत्तर नहीं दे सके। कृपया प्रश्न दोबारा लिखें और फिर कोशिश करें।';

  @override
  String get instantAnswerBusy =>
      'सहायक अभी व्यस्त है। कृपया थोड़ी देर में फिर कोशिश करें।';

  @override
  String instantAnswerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'सहायक अभी व्यस्त है। कृपया लगभग $seconds सेकंड में फिर कोशिश करें।',
      one: 'सहायक अभी व्यस्त है। कृपया लगभग 1 सेकंड में फिर कोशिश करें।',
    );
    return '$_temp0';
  }

  @override
  String get instantAnswerTimeout =>
      'इसमें अपेक्षा से अधिक समय लग रहा है। कृपया फिर कोशिश करें।';

  @override
  String get instantAnswerSignIn =>
      'इस उपकरण का उपयोग करने के लिए कृपया फिर से साइन इन करें।';

  @override
  String get settingsTitle => 'सेटिंग्स';

  @override
  String get settingsAppearanceTitle => 'दिखावट';

  @override
  String get settingsThemeSystem => 'मेरे डिवाइस के अनुसार';

  @override
  String get settingsThemeLight => 'लाइट';

  @override
  String get settingsThemeDark => 'डार्क';

  @override
  String get settingsLanguageHint =>
      'यह ऐप की भाषा और आपकी शिक्षण सामग्री की भाषा तय करता है।';

  @override
  String get settingsNotificationsTitle => 'सूचनाएँ';

  @override
  String get settingsNotificationsLabel => 'अनुस्मारक और अपडेट';

  @override
  String get settingsNotificationsHint =>
      'नए शिक्षण उपकरणों और अपने सहेजे काम की जानकारी पाएँ।';

  @override
  String get settingsVoiceModeTitle => 'वॉइस मोड';

  @override
  String get settingsVoiceModeLabel => 'लाइव वॉइस (बीटा)';

  @override
  String get settingsVoiceModeHint =>
      'VIDYA से वास्तविक समय में बात करें। बंद होने पर VIDYA सुनती है, फिर एक-एक बारी में उत्तर देती है।';

  @override
  String get settingsProfileTitle => 'शिक्षण प्रोफ़ाइल';

  @override
  String get settingsProfileHint =>
      'इससे हम आपकी सामग्री को आपके बोर्ड और कक्षा के अनुरूप बनाते हैं।';

  @override
  String get settingsBoardLabel => 'शिक्षा बोर्ड';

  @override
  String get settingsBoardNone => 'सेट नहीं है';

  @override
  String get settingsQualificationsLabel => 'योग्यताएँ';

  @override
  String get settingsQualificationsHint => 'अपनी सभी योग्यताएँ चुनें।';

  @override
  String get settingsAdminRoleLabel => 'प्रशासनिक भूमिका';

  @override
  String get settingsAdminRoleNone => 'सेट नहीं है';

  @override
  String get settingsRoleHod => 'विभागाध्यक्ष (HoD)';

  @override
  String get settingsRoleCoordinator => 'शैक्षणिक समन्वयक';

  @override
  String get settingsRoleExamController => 'परीक्षा नियंत्रक';

  @override
  String get settingsRoleVicePrincipal => 'उप-प्रधानाचार्य';

  @override
  String get settingsRolePrincipal => 'प्रधानाचार्य';

  @override
  String get settingsRoleNone => 'शिक्षक, कोई प्रशासनिक भूमिका नहीं';

  @override
  String get settingsSaveProfile => 'प्रोफ़ाइल सहेजें';

  @override
  String get settingsProfileSaved => 'आपकी शिक्षण प्रोफ़ाइल सहेज ली गई है।';

  @override
  String get settingsSaveFailed =>
      'हम आपकी प्रोफ़ाइल सहेज नहीं सके। कृपया फिर कोशिश करें।';

  @override
  String get settingsSignedOutTitle => 'आप साइन आउट हैं';

  @override
  String get settingsSignedOutBody =>
      'अपनी शिक्षण प्रोफ़ाइल और खाता प्रबंधित करने के लिए साइन इन करें। आपकी भाषा और दिखावट की पसंद इस डिवाइस पर वैसे भी सहेजी रहती है।';

  @override
  String get settingsSignIn => 'साइन इन करें';

  @override
  String get settingsDangerTitle => 'खाता हटाएँ';

  @override
  String get settingsDangerBody =>
      'इससे आपका खाता बंद हो जाएगा और सहेजा गया काम हट जाएगा। स्थायी रूप से मिटने से पहले सब कुछ निर्यात करने के लिए आपके पास 30 दिन होंगे।';

  @override
  String get settingsDeleteAction => 'खाता हटाएँ';

  @override
  String get settingsDeleteDialogTitle => 'अपना खाता हटाएँ?';

  @override
  String get settingsDeleteDialogBody =>
      'आपकी पाठ योजनाएँ, क्विज़ और प्रोफ़ाइल हटाने के लिए निर्धारित हो जाएँगी। हटने से पहले अपना काम निर्यात करने के लिए आपके पास 30 दिन हैं।';

  @override
  String settingsDeleteConfirmPrompt(String word) {
    return 'पुष्टि के लिए नीचे $word लिखें।';
  }

  @override
  String get settingsDeleteConfirmLabel => 'पुष्टि';

  @override
  String get settingsDeleteCancel => 'मेरा खाता रहने दें';

  @override
  String get settingsDeleteConfirm => 'खाता हटाएँ';

  @override
  String get settingsDeleteScheduled =>
      'आपका खाता हटाने के लिए निर्धारित है। अपना काम निर्यात करने के लिए आपके पास 30 दिन हैं।';

  @override
  String get settingsDeleteSuccessTitle => 'खाता हटाने के लिए निर्धारित';

  @override
  String get settingsExportDataAction => 'मेरा डेटा निर्यात करें';

  @override
  String get settingsExportQueuedMessage =>
      'आपका निर्यात अभी तुरंत तैयार करने के लिए बहुत बड़ा है, इसलिए हमने इसे कतार में रखा है। कृपया बाद में फिर कोशिश करें, या अपने डेटा की प्रति के लिए सहायता से संपर्क करें।';

  @override
  String get settingsExportFailedMessage =>
      'आपका निर्यात तैयार नहीं हो सका। कृपया फिर कोशिश करें।';

  @override
  String get settingsDeleteSuccessDone => 'हो गया';

  @override
  String get settingsDeleteFailed =>
      'हम आपका खाता नहीं हटा सके। कृपया फिर कोशिश करें।';

  @override
  String get settingsReauthTitle => 'कृपया फिर से साइन इन करें';

  @override
  String get settingsReauthBody =>
      'आपकी सुरक्षा के लिए, खाता हटाने हेतु नए सिरे से साइन इन करना ज़रूरी है। कृपया साइन आउट करें, फिर साइन इन करें और पाँच मिनट के भीतर हटाएँ।';

  @override
  String get profilePlanLabel => 'प्लान';

  @override
  String get profilePlanFree => 'मुफ़्त';

  @override
  String get profilePlanPro => 'प्रो';

  @override
  String get profilePlanGold => 'गोल्ड';

  @override
  String get profilePlanPremium => 'प्रीमियम';

  @override
  String get profilePlanUnknown => 'उपलब्ध नहीं';

  @override
  String get profileNoName => 'आपकी प्रोफ़ाइल';

  @override
  String get profileSectionAbout => 'आपके बारे में';

  @override
  String get profileSectionTeaching => 'आप क्या पढ़ाते हैं';

  @override
  String get profileSectionLocation => 'आप कहां पढ़ाते हैं';

  @override
  String get profileSectionContact => 'हम आपसे कैसे संपर्क करें';

  @override
  String get profileNameLabel => 'आपका नाम';

  @override
  String get profileNameHint =>
      'यह वही नाम है जो आपके साझा किए काम पर दूसरे शिक्षक देखते हैं।';

  @override
  String get profileNameInvalid => 'कृपया छोटा नाम दर्ज करें।';

  @override
  String get profileSchoolLabel => 'स्कूल का नाम';

  @override
  String get profileBoardCategoryLabel => 'बोर्ड का प्रकार';

  @override
  String get profileBoardCategoryHint =>
      'नीचे दी गई सूची को छोटा करने के लिए बोर्ड का प्रकार चुनें।';

  @override
  String get profileBoardCategoryState => 'राज्य बोर्ड';

  @override
  String get profileStateLabel => 'राज्य';

  @override
  String get profileStateNone => 'सेट नहीं है';

  @override
  String get profileDistrictLabel => 'ज़िला';

  @override
  String get profileDistrictHint => 'वह ज़िला जिसमें आपका स्कूल है।';

  @override
  String get profileSubjectsLabel => 'आप जो विषय पढ़ाते हैं';

  @override
  String get profileSubjectsHint => 'आपको जितनी ज़रूरत हो, उतनी चुनें।';

  @override
  String get profileGradesLabel => 'आप जो कक्षाएं पढ़ाते हैं';

  @override
  String get profileGradesHint => 'आपको जितनी ज़रूरत हो, उतनी चुनें।';

  @override
  String get profileLanguageHint =>
      'यह ऐप की भाषा वाली ही पसंद है, इसलिए इसे यहाँ बदलने पर हर जगह बदल जाएगी।';

  @override
  String get profilePhoneLabel => 'मोबाइल नंबर';

  @override
  String get profilePhoneHint => 'वैकल्पिक। +91 के साथ या उसके बिना, दस अंक।';

  @override
  String get profilePhoneInvalid =>
      'कृपया दस अंकों का भारतीय मोबाइल नंबर दर्ज करें।';

  @override
  String get profilePincodeLabel => 'पिन कोड';

  @override
  String get profilePincodeHint => 'वैकल्पिक। छह अंक।';

  @override
  String get profilePincodeInvalid => 'कृपया छह अंकों का पिन कोड दर्ज करें।';

  @override
  String get profileEmptyTitle => 'आपकी प्रोफ़ाइल खाली है';

  @override
  String get profileEmptyBody =>
      'अपना स्कूल और अपनी कक्षाएँ जोड़ें, फिर आपकी हर पाठ योजना और क्विज़ आपकी कक्षा के अनुरूप मिलेगी।';

  @override
  String get profileLoadFailed =>
      'हम आपकी प्रोफ़ाइल नहीं खोल सके। कृपया फिर कोशिश करें।';

  @override
  String get profileSignedOutTitle => 'आप साइन आउट हैं';

  @override
  String get profileSignedOutBody =>
      'अपनी शिक्षण प्रोफ़ाइल देखने और बदलने के लिए साइन इन करें।';

  @override
  String get profileSaveSignIn =>
      'अपनी प्रोफ़ाइल सहेजने के लिए कृपया फिर से साइन इन करें।';

  @override
  String get meTitle => 'प्रोफ़ाइल';

  @override
  String get mePlanUsageTitle => 'प्लान और उपयोग';

  @override
  String get mePlanUsageSubtitle => 'इस महीने आपने कितना उपयोग किया है।';

  @override
  String meUsageValue(int used, int limit) {
    return '$used / $limit';
  }

  @override
  String get meUsageUnlimited => 'असीमित';

  @override
  String get meUsageUnavailable =>
      'हम आपका उपयोग लोड नहीं कर सके। कृपया फिर से कोशिश करें।';

  @override
  String get meDefaultsTitle => 'डिफ़ॉल्ट';

  @override
  String get mePrivacyTitle => 'गोपनीयता और सेटिंग्स';

  @override
  String get meRoleTeacher => 'शिक्षक';

  @override
  String get usageFeatureAvatar => 'एआई अवतार';

  @override
  String get usageFeatureVoiceToText => 'वॉइस से टेक्स्ट';

  @override
  String get usageFeatureAssistant => 'VIDYA सहायक';

  @override
  String get imageInputHint => 'पाठ्यपुस्तक के पन्ने की साफ़ फ़ोटो जोड़ें।';

  @override
  String get imageInputTakePhoto => 'फ़ोटो लें';

  @override
  String get imageInputChooseGallery => 'गैलरी से चुनें';

  @override
  String get imageInputRetake => 'फिर से फ़ोटो लें';

  @override
  String get imageInputChangeGallery => 'दूसरी चुनें';

  @override
  String get imageInputRemove => 'फ़ोटो हटाएँ';

  @override
  String get imageInputPreviewLabel => 'चुनी गई फ़ोटो का पूर्वावलोकन';

  @override
  String imageInputSizeOfMax(String used, String max) {
    return '$max में से $used';
  }

  @override
  String imageInputTooLarge(String max) {
    return 'यह फ़ोटो बहुत बड़ी है। कृपया $max से छोटी चुनें।';
  }

  @override
  String get imageInputPermissionDenied =>
      'SahayakAI को आपका कैमरा या फ़ोटो उपयोग करने की अनुमति चाहिए। कृपया डिवाइस सेटिंग्स में अनुमति दें।';

  @override
  String get imageInputFailed =>
      'हम वह फ़ोटो नहीं खोल सके। कृपया फिर कोशिश करें।';

  @override
  String get worksheetTitle => 'वर्कशीट';

  @override
  String get worksheetSubtitle => 'पाठ्यपुस्तक की फ़ोटो से वर्कशीट बनाएँ';

  @override
  String get worksheetEmpty =>
      'पाठ्यपुस्तक की फ़ोटो और निर्देश जोड़ें, फिर तैयार करें पर टैप करें।';

  @override
  String get worksheetImageLabel => 'पाठ्यपुस्तक के पन्ने की फ़ोटो';

  @override
  String get worksheetImageHint => 'वर्कशीट इसी पन्ने से बनती है।';

  @override
  String get toolImageOptionalLabel =>
      'पाठ्यपुस्तक के पन्ने की फ़ोटो (वैकल्पिक)';

  @override
  String get toolImageOptionalHint =>
      'पन्ने की फ़ोटो जोड़ें तो वही मुख्य स्रोत बनेगी, या खाली छोड़ दें।';

  @override
  String get worksheetImageError =>
      'कृपया पाठ्यपुस्तक के पन्ने की फ़ोटो जोड़ें।';

  @override
  String get worksheetPromptLabel => 'आपको कैसी वर्कशीट चाहिए?';

  @override
  String get worksheetPromptHint =>
      'उदाहरण के लिए, इस पन्ने से गुणा की वर्कशीट बनाएँ';

  @override
  String get worksheetPromptError => 'कृपया बताएँ कि आपको कैसी वर्कशीट चाहिए।';

  @override
  String get worksheetGradeLabel => 'कक्षा स्तर';

  @override
  String get worksheetGradeAny => 'कोई भी कक्षा';

  @override
  String get worksheetSubjectLabel => 'विषय';

  @override
  String get worksheetSubjectAny => 'कोई भी विषय';

  @override
  String get worksheetOptional => 'वैकल्पिक';

  @override
  String get worksheetObjectives => 'अधिगम उद्देश्य';

  @override
  String get worksheetInstructions => 'छात्रों के लिए निर्देश';

  @override
  String get worksheetActivities => 'गतिविधियाँ';

  @override
  String get worksheetActivityQuestion => 'प्रश्न';

  @override
  String get worksheetActivityPuzzle => 'पहेली';

  @override
  String get worksheetActivityCreativeTask => 'रचनात्मक कार्य';

  @override
  String get worksheetExplanation => 'शिक्षक के लिए';

  @override
  String get worksheetChalkboardNote => 'ब्लैकबोर्ड पर';

  @override
  String get worksheetAnswerKey => 'उत्तर कुंजी';

  @override
  String get worksheetNoContent =>
      'उस पन्ने के लिए कोई वर्कशीट नहीं मिली। कृपया साफ़ फ़ोटो या दूसरा निर्देश आज़माएँ।';

  @override
  String get worksheetSave => 'लाइब्रेरी में सहेजें';

  @override
  String get worksheetSaving => 'सहेजा जा रहा है';

  @override
  String get worksheetSaved => 'आपकी लाइब्रेरी में सहेजा गया';

  @override
  String get worksheetSaveFailedTitle => 'सहेजा नहीं जा सका';

  @override
  String get worksheetSaveFailedBody =>
      'हम इस वर्कशीट को आपकी लाइब्रेरी में सहेज नहीं सके। कृपया फिर कोशिश करें।';

  @override
  String get worksheetSaveRetry => 'फिर से सहेजने की कोशिश करें';

  @override
  String get worksheetUpgradeTitle => 'उच्च योजना आवश्यक है';

  @override
  String get worksheetUpgradeBody =>
      'वर्कशीट बनाना उच्च योजना का हिस्सा है। वर्कशीट बनाते रहने के लिए कृपया अपग्रेड करें।';

  @override
  String get worksheetLimitTitle => 'आप अपनी सीमा तक पहुँच गए हैं';

  @override
  String get worksheetLimitBody =>
      'आपने फ़िलहाल अपनी वर्कशीट उपयोग कर ली हैं। कृपया बाद में फिर कोशिश करें या अपनी योजना अपग्रेड करें।';

  @override
  String get worksheetSeePricing => 'योजनाएँ और मूल्य देखें';

  @override
  String get worksheetRephrase =>
      'हम उससे वर्कशीट नहीं बना सके। कृपया साफ़ फ़ोटो लें या अपना निर्देश दोबारा लिखें।';

  @override
  String get worksheetBusy =>
      'सहायक अभी व्यस्त है। कृपया थोड़ी देर में फिर कोशिश करें।';

  @override
  String get worksheetTimeout =>
      'इसमें अपेक्षा से अधिक समय लग रहा है। कृपया फिर कोशिश करें।';

  @override
  String get worksheetSignIn =>
      'इस उपकरण का उपयोग करने के लिए कृपया फिर से साइन इन करें।';

  @override
  String get rubricTitle => 'रूब्रिक';

  @override
  String get rubricSubtitle => 'असाइनमेंट के लिए अंकन रूब्रिक बनाएँ';

  @override
  String get rubricEmpty =>
      'असाइनमेंट का विवरण दें, फिर तैयार करें पर टैप करें।';

  @override
  String get rubricAssignmentLabel => 'असाइनमेंट क्या है?';

  @override
  String get rubricAssignmentHint =>
      'रूब्रिक इसी असाइनमेंट का मूल्यांकन करती है।';

  @override
  String get rubricAssignmentPlaceholder =>
      'उदाहरण के लिए, कक्षा 5 का नवीकरणीय ऊर्जा पर प्रोजेक्ट';

  @override
  String get rubricAssignmentError => 'कृपया असाइनमेंट का विवरण दें।';

  @override
  String get rubricGradeLabel => 'कक्षा स्तर';

  @override
  String get rubricGradeAny => 'कोई भी कक्षा';

  @override
  String get rubricSubjectLabel => 'विषय';

  @override
  String get rubricSubjectAny => 'कोई भी विषय';

  @override
  String get rubricOptional => 'वैकल्पिक';

  @override
  String get rubricCriteriaColumn => 'मानदंड';

  @override
  String rubricPoints(String points) {
    return '$points अंक';
  }

  @override
  String get rubricScrollHint => 'सभी स्तर देखने के लिए बग़ल में स्वाइप करें।';

  @override
  String get rubricNoContent =>
      'उसके लिए कोई रूब्रिक नहीं मिली। कृपया असाइनमेंट का विवरण साफ़ शब्दों में लिखें।';

  @override
  String get rubricUpgradeTitle => 'उच्च योजना आवश्यक है';

  @override
  String get rubricUpgradeBody =>
      'रूब्रिक बनाना उच्च योजना का हिस्सा है। रूब्रिक बनाते रहने के लिए कृपया अपग्रेड करें।';

  @override
  String get rubricLimitTitle => 'आप अपनी सीमा तक पहुँच गए हैं';

  @override
  String get rubricLimitBody =>
      'आपने फ़िलहाल अपनी रूब्रिक उपयोग कर ली हैं। कृपया बाद में फिर कोशिश करें या अपनी योजना अपग्रेड करें।';

  @override
  String get rubricRephrase =>
      'हम उससे रूब्रिक नहीं बना सके। कृपया असाइनमेंट दोबारा लिखें और फिर कोशिश करें।';

  @override
  String get rubricBusy =>
      'सहायक अभी व्यस्त है। कृपया थोड़ी देर में फिर कोशिश करें।';

  @override
  String get rubricTimeout =>
      'इसमें अपेक्षा से अधिक समय लग रहा है। कृपया फिर कोशिश करें।';

  @override
  String get rubricSignIn =>
      'इस उपकरण का उपयोग करने के लिए कृपया फिर से साइन इन करें।';

  @override
  String get examPaperTitle => 'प्रश्नपत्र';

  @override
  String get examPaperSubtitle =>
      'उत्तर कुंजी के साथ बोर्ड पैटर्न का प्रश्नपत्र बनाएँ';

  @override
  String get examPaperEmpty =>
      'बोर्ड, कक्षा और विषय चुनें, फिर तैयार करें पर टैप करें।';

  @override
  String get examPaperBoardLabel => 'बोर्ड';

  @override
  String get examPaperBoardHint => 'बोर्ड चुनें';

  @override
  String get examPaperBoardError => 'कृपया बोर्ड चुनें।';

  @override
  String get examPaperGradeLabel => 'कक्षा स्तर';

  @override
  String get examPaperGradeHint => 'कक्षा चुनें';

  @override
  String get examPaperGradeError => 'कृपया कक्षा स्तर चुनें।';

  @override
  String get examPaperSubjectLabel => 'विषय';

  @override
  String get examPaperSubjectHint => 'विषय चुनें';

  @override
  String get examPaperSubjectError => 'कृपया विषय चुनें।';

  @override
  String get examPaperSubjectOther => 'अन्य विषय';

  @override
  String get examPaperSubjectOtherLabel => 'विषय का नाम';

  @override
  String get examPaperSubjectOtherHint => 'उदाहरण के लिए, अर्थशास्त्र';

  @override
  String get examPaperSubjectOtherError => 'कृपया विषय दर्ज करें।';

  @override
  String get examPaperChaptersLabel => 'अध्याय';

  @override
  String get examPaperChaptersHint =>
      'जिन अध्यायों को शामिल करना है वे जोड़ें। आधिकारिक ब्लूप्रिंट होने पर पूरे पाठ्यक्रम के लिए खाली छोड़ें।';

  @override
  String get examPaperChaptersPlaceholder => 'उदाहरण के लिए, द्विघात समीकरण';

  @override
  String get examPaperChaptersAdd => 'अध्याय जोड़ें';

  @override
  String get examPaperChaptersError =>
      'कृपया इस बोर्ड, कक्षा और विषय के लिए कम से कम एक अध्याय जोड़ें।';

  @override
  String get examPaperDifficultyLabel => 'कठिनाई';

  @override
  String get examPaperDifficultyEasy => 'सरल';

  @override
  String get examPaperDifficultyModerate => 'मध्यम';

  @override
  String get examPaperDifficultyHard => 'कठिन';

  @override
  String get examPaperDifficultyMixed => 'मिश्रित';

  @override
  String get examPaperIncludeAnswerKey => 'उत्तर कुंजी शामिल करें';

  @override
  String get examPaperIncludeMarkingScheme => 'अंकन योजना शामिल करें';

  @override
  String get examPaperInProgressTitle => 'आपका प्रश्नपत्र तैयार हो रहा है';

  @override
  String get examPaperInProgressBody =>
      'पूरा बोर्ड प्रश्नपत्र बनने में थोड़ा समय लगता है। हम इसे अभी पूरा कर रहे हैं और यह आपके लिए सहेज दिया जाएगा।';

  @override
  String get examPaperInProgressLibraryHint =>
      'एक मिनट में लाइब्रेरी टैब खोलकर अपना तैयार प्रश्नपत्र देखें।';

  @override
  String examPaperMaxMarks(String marks) {
    return 'अधिकतम अंक $marks';
  }

  @override
  String examPaperMarks(String marks) {
    return '$marks अंक';
  }

  @override
  String examPaperSectionMarks(String marks) {
    return '$marks अंक';
  }

  @override
  String examPaperPercent(String value) {
    return '$value प्रतिशत';
  }

  @override
  String get examPaperGeneralInstructions => 'सामान्य निर्देश';

  @override
  String get examPaperInternalChoice => 'अथवा हल करें';

  @override
  String get examPaperAnswerKey => 'उत्तर';

  @override
  String get examPaperMarkingScheme => 'अंकन योजना';

  @override
  String get examPaperBlueprintTitle => 'ब्लूप्रिंट सारांश';

  @override
  String get examPaperBlueprintChapters => 'अध्यायवार अंक';

  @override
  String get examPaperBlueprintDifficulty => 'कठिनाई विभाजन';

  @override
  String get examPaperPyqTitle => 'पिछले वर्षों के प्रश्न';

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
      'उसके लिए कोई प्रश्नपत्र नहीं मिला। कृपया कम अध्याय या दूसरा विषय आज़माएँ।';

  @override
  String get examPaperUnstructuredTitle =>
      'हम उस प्रश्नपत्र को व्यवस्थित नहीं कर सके';

  @override
  String get examPaperUnstructuredBody =>
      'सहायक इसे पूरे प्रश्नपत्र के रूप में नहीं सजा सका। कृपया कुछ अध्याय हटाकर फिर तैयार करें।';

  @override
  String get examPaperUpgradeTitle => 'उच्च योजना आवश्यक है';

  @override
  String get examPaperUpgradeBody =>
      'प्रश्नपत्र बनाना उच्च योजना का हिस्सा है। प्रश्नपत्र बनाते रहने के लिए कृपया अपग्रेड करें।';

  @override
  String get examPaperLimitTitle => 'आप अपनी सीमा तक पहुँच गए हैं';

  @override
  String get examPaperLimitBody =>
      'आपने फ़िलहाल अपने प्रश्नपत्र उपयोग कर लिए हैं। कृपया बाद में फिर कोशिश करें या अपनी योजना अपग्रेड करें।';

  @override
  String get examPaperRephrase =>
      'हम उससे प्रश्नपत्र नहीं बना सके। कृपया अध्याय बदलकर फिर कोशिश करें।';

  @override
  String get examPaperBusy =>
      'सहायक अभी व्यस्त है। कृपया थोड़ी देर में फिर कोशिश करें।';

  @override
  String get examPaperTimeout =>
      'इसमें अपेक्षा से अधिक समय लग रहा है। कृपया फिर कोशिश करें।';

  @override
  String get examPaperSignIn =>
      'इस उपकरण का उपयोग करने के लिए कृपया फिर से साइन इन करें।';

  @override
  String get teacherTrainingTitle => 'शिक्षण कोच';

  @override
  String get teacherTrainingSubtitle => 'किसी शिक्षण प्रश्न पर सलाह और रणनीति';

  @override
  String get teacherTrainingAction => 'सलाह पाएँ';

  @override
  String get teacherTrainingEmpty =>
      'कोई शिक्षण प्रश्न पूछें और शिक्षाशास्त्र पर आधारित रणनीतियाँ पाएँ।';

  @override
  String get teacherTrainingQuestionLabel => 'आपका प्रश्न';

  @override
  String get teacherTrainingQuestionHint =>
      'पाठ की रचना, कक्षा-व्यवहार या मूल्यांकन के बारे में पूछें।';

  @override
  String get teacherTrainingQuestionPlaceholder =>
      'उदाहरण के लिए, 40 बच्चों की कक्षा को पूरे पाठ में कैसे जोड़े रखूँ?';

  @override
  String get teacherTrainingQuestionError => 'कृपया एक प्रश्न दर्ज करें।';

  @override
  String get teacherTrainingSubjectLabel => 'विषय';

  @override
  String get teacherTrainingSubjectAny => 'कोई भी विषय';

  @override
  String get teacherTrainingOptional => 'वैकल्पिक';

  @override
  String get teacherTrainingStrategiesTitle => 'रणनीतियाँ';

  @override
  String get teacherTrainingSectionQuestion => 'प्रश्न';

  @override
  String get teacherTrainingResultTitle => 'मार्गदर्शन नोट्स';

  @override
  String get teacherTrainingNoContent =>
      'उसके लिए कोई सलाह नहीं मिली। कृपया प्रश्न साफ़ शब्दों में पूछें।';

  @override
  String get teacherTrainingUpgradeTitle => 'उच्च योजना आवश्यक है';

  @override
  String get teacherTrainingUpgradeBody =>
      'शिक्षण कोच उच्च योजना का हिस्सा है। पूछते रहने के लिए कृपया अपग्रेड करें।';

  @override
  String get teacherTrainingLimitTitle => 'आप अपनी सीमा तक पहुँच गए हैं';

  @override
  String get teacherTrainingLimitBody =>
      'आपने फ़िलहाल शिक्षण कोच का उपयोग कर लिया है। कृपया बाद में फिर कोशिश करें या अपनी योजना अपग्रेड करें।';

  @override
  String get teacherTrainingSeePricing => 'योजनाएँ और मूल्य देखें';

  @override
  String get teacherTrainingRephrase =>
      'हम उससे सलाह नहीं बना सके। कृपया प्रश्न दोबारा लिखें और फिर कोशिश करें।';

  @override
  String get teacherTrainingBusy =>
      'सहायक अभी व्यस्त है। कृपया थोड़ी देर में फिर कोशिश करें।';

  @override
  String teacherTrainingBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'सहायक अभी व्यस्त है। कृपया लगभग $seconds सेकंड में फिर कोशिश करें।',
      one: 'सहायक अभी व्यस्त है। कृपया लगभग 1 सेकंड में फिर कोशिश करें।',
    );
    return '$_temp0';
  }

  @override
  String get teacherTrainingTimeout =>
      'इसमें अपेक्षा से अधिक समय लग रहा है। कृपया फिर कोशिश करें।';

  @override
  String get teacherTrainingSignIn =>
      'इस उपकरण का उपयोग करने के लिए कृपया फिर से साइन इन करें।';

  @override
  String get parentMessageTitle => 'अभिभावक संदेश';

  @override
  String get parentMessageSubtitle =>
      'अभिभावक की भाषा में घर के लिए संदेश तैयार करें';

  @override
  String get parentMessageAction => 'संदेश तैयार करें';

  @override
  String get parentMessageEmpty =>
      'विद्यार्थी और कारण बताएँ, और अभिभावक की भाषा में एक सहृदय संदेश तैयार हो जाएगा।';

  @override
  String get parentMessageStudentLabel => 'विद्यार्थी का नाम';

  @override
  String get parentMessageStudentPlaceholder =>
      'संदेश जिस विद्यार्थी के बारे में है';

  @override
  String get parentMessageStudentError => 'कृपया विद्यार्थी का नाम दर्ज करें।';

  @override
  String get parentMessageClassLabel => 'कक्षा';

  @override
  String get parentMessageClassPlaceholder => 'उदाहरण के लिए, कक्षा 6A';

  @override
  String get parentMessageClassError => 'कृपया कक्षा दर्ज करें।';

  @override
  String get parentMessageSubjectLabel => 'विषय';

  @override
  String get parentMessageSubjectHint => 'विषय चुनें';

  @override
  String get parentMessageSubjectError => 'कृपया विषय चुनें।';

  @override
  String get parentMessageReasonLabel => 'संदेश का कारण';

  @override
  String get parentMessageReasonHint => 'कारण चुनें';

  @override
  String get parentMessageReasonError => 'कृपया कारण चुनें।';

  @override
  String get parentMessageReasonAbsences => 'बार-बार अनुपस्थिति';

  @override
  String get parentMessageReasonPerformance => 'पढ़ाई में सहयोग';

  @override
  String get parentMessageReasonBehavior => 'कक्षा में व्यवहार';

  @override
  String get parentMessageReasonPositive => 'साझा करने के लिए अच्छी खबर';

  @override
  String get parentMessageAbsentDaysLabel => 'अनुपस्थित दिन';

  @override
  String get parentMessageAbsentDaysHint =>
      'विद्यार्थी लगातार कितने दिन अनुपस्थित रहा है।';

  @override
  String get parentMessageAbsentDaysPlaceholder => 'उदाहरण के लिए, 3';

  @override
  String get parentMessageParentLanguageLabel => 'अभिभावक की भाषा';

  @override
  String get parentMessageParentLanguageHint =>
      'संदेश इसी भाषा में लिखा जाता है, जो ऐप की भाषा से अलग हो सकती है।';

  @override
  String get parentMessageParentLanguagePlaceholder => 'अभिभावक की भाषा चुनें';

  @override
  String get parentMessageParentLanguageError => 'कृपया अभिभावक की भाषा चुनें।';

  @override
  String get parentMessageContextLabel => 'इसका कारण क्या है?';

  @override
  String get parentMessageContextHint =>
      'स्थिति पर एक छोटी टिप्पणी संदेश को आकार देती है।';

  @override
  String get parentMessageContextPlaceholder =>
      'उदाहरण के लिए, भिन्न के पिछले दो सप्ताह छूट गए';

  @override
  String get parentMessageNoteLabel => 'कुछ ख़ास बताना है?';

  @override
  String get parentMessageNoteHint =>
      'यहाँ दिया गया ब्यौरा संदेश में शामिल हो जाता है।';

  @override
  String get parentMessageNotePlaceholder =>
      'उदाहरण के लिए, समूह कार्य में अच्छा कर रहे हैं';

  @override
  String get parentMessageTeacherNameLabel => 'आपका नाम';

  @override
  String get parentMessageTeacherNameHint =>
      'संदेश पर आपका नाम आएगा। खाली छोड़ने पर प्रोफ़ाइल का नाम लिया जाएगा।';

  @override
  String get parentMessageTeacherNamePlaceholder =>
      'उदाहरण के लिए, श्रीमती राव';

  @override
  String get parentMessageSchoolNameLabel => 'स्कूल का नाम';

  @override
  String get parentMessageSchoolNamePlaceholder => 'आपके स्कूल का नाम';

  @override
  String get parentMessageOptional => 'वैकल्पिक';

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
  String get parentMessageSectionMessage => 'संदेश';

  @override
  String get parentMessageSectionDetails => 'अतिरिक्त विवरण';

  @override
  String get parentMessageResultTitle => 'अभिभावक के लिए संदेश';

  @override
  String get parentMessageNoContent =>
      'उसके लिए कोई संदेश नहीं मिला। कृपया थोड़ा और ब्यौरा जोड़कर फिर कोशिश करें।';

  @override
  String get parentMessageMissingFields =>
      'कृपया विद्यार्थी, कक्षा, विषय, कारण और अभिभावक की भाषा भरें, फिर कोशिश करें।';

  @override
  String get parentMessageUpgradeTitle => 'उच्च योजना आवश्यक है';

  @override
  String get parentMessageUpgradeBody =>
      'अभिभावक संदेश उच्च योजना का हिस्सा हैं। इन्हें तैयार करते रहने के लिए कृपया अपग्रेड करें।';

  @override
  String get parentMessageLimitTitle => 'आप अपनी सीमा तक पहुँच गए हैं';

  @override
  String get parentMessageLimitBody =>
      'आपने फ़िलहाल अपने अभिभावक संदेश तैयार कर लिए हैं। कृपया बाद में फिर कोशिश करें या अपनी योजना अपग्रेड करें।';

  @override
  String get parentMessageSeePricing => 'योजनाएँ और मूल्य देखें';

  @override
  String get parentMessageBusy =>
      'सहायक अभी व्यस्त है। कृपया थोड़ी देर में फिर कोशिश करें।';

  @override
  String parentMessageBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'सहायक अभी व्यस्त है। कृपया लगभग $seconds सेकंड में फिर कोशिश करें।',
      one: 'सहायक अभी व्यस्त है। कृपया लगभग 1 सेकंड में फिर कोशिश करें।',
    );
    return '$_temp0';
  }

  @override
  String get parentMessageTimeout =>
      'इसमें अपेक्षा से अधिक समय लग रहा है। कृपया फिर कोशिश करें।';

  @override
  String get parentMessageSignIn =>
      'इस उपकरण का उपयोग करने के लिए कृपया फिर से साइन इन करें।';

  @override
  String get assessTitle => 'असाइनमेंट जाँचें';

  @override
  String get assessSubtitle => 'फ़ोटो से विद्यार्थी का हस्तलिखित काम जाँचें';

  @override
  String get assessEmpty =>
      'विद्यार्थी के काम की फ़ोटो जोड़ें, फिर जाँचें पर टैप करें।';

  @override
  String get assessSubmit => 'जाँचें';

  @override
  String get assessImageLabel => 'विद्यार्थी के काम की फ़ोटो';

  @override
  String get assessImageHint => 'पूरे पन्ने की साफ़ फ़ोटो लें।';

  @override
  String get assessImageError => 'कृपया विद्यार्थी के काम की फ़ोटो जोड़ें।';

  @override
  String get assessModeLabel => 'आपको क्या चाहिए?';

  @override
  String get assessModeHint =>
      'पूरी जाँच: काम पढ़कर अंक देती है। केवल पढ़ें: केवल लिखा हुआ पाठ लौटाता है। पाठ पर अंक दें: आपके चिपकाए पाठ की जाँच करता है।';

  @override
  String get assessModeFull => 'पूरी जाँच';

  @override
  String get assessModeTranscribe => 'केवल पढ़ें';

  @override
  String get assessModeScore => 'पाठ पर अंक दें';

  @override
  String get assessTranscriptLabel => 'सुधारा हुआ पाठ';

  @override
  String get assessTranscriptHint =>
      'फ़ोटो दोबारा पढ़ने के बजाय जाँचने के लिए सुधारा हुआ पाठ चिपकाएँ।';

  @override
  String get assessTranscriptPlaceholder =>
      'विद्यार्थी के सुधारे हुए उत्तर लिखें या चिपकाएँ';

  @override
  String get assessOptional => 'वैकल्पिक';

  @override
  String get assessRubricNote =>
      'रूब्रिक न होने पर काम की जाँच सामान्य रूब्रिक से होती है: समझ, शुद्धता, प्रस्तुति और पूर्णता।';

  @override
  String get assessPrivacyNote =>
      'जाँच के लिए विद्यार्थी का नाम कभी नहीं भेजा जाता।';

  @override
  String get assessScoreLabel => 'कुल अंक';

  @override
  String get assessScoreOutOf => '100 में से';

  @override
  String assessPoints(String earned, String possible) {
    return '$possible में से $earned अंक';
  }

  @override
  String assessConfidence(String percent) {
    return 'विश्वास $percent%';
  }

  @override
  String assessRubricUsed(String title) {
    return 'जाँच का आधार: $title';
  }

  @override
  String get assessLowConfidence => 'कम विश्वास';

  @override
  String get assessTranscriptSection => 'विद्यार्थी ने क्या लिखा';

  @override
  String get assessCriteriaSection => 'मानदंडवार अंक';

  @override
  String assessCriterionPoints(String points, String max) {
    return '$points / $max';
  }

  @override
  String get assessStrengthsSection => 'मज़बूत पक्ष';

  @override
  String get assessImprovementsSection => 'सुधार के क्षेत्र';

  @override
  String get assessNextStepsSection => 'अगले कदम';

  @override
  String get assessTeacherNoteSection => 'विद्यार्थी के लिए टिप्पणी';

  @override
  String get assessWarningsSection => 'कृपया जाँचें';

  @override
  String get assessWarningBlank =>
      'यह पन्ना खाली लगता है। कृपया फ़ोटो जाँचें और फिर कोशिश करें।';

  @override
  String get assessWarningLowContrast =>
      'फ़ोटो धुँधली है। साफ़ फ़ोटो से जाँच अधिक सही होगी।';

  @override
  String get assessWarningPartial => 'काम का केवल कुछ हिस्सा ही पढ़ा जा सका।';

  @override
  String get assessWarningLanguageMismatch =>
      'लिखावट अपेक्षित भाषा से अलग भाषा में हो सकती है।';

  @override
  String get assessNoContent =>
      'कोई मूल्यांकन नहीं मिला। कृपया साफ़ फ़ोटो आज़माएँ।';

  @override
  String get assessSignIn =>
      'असाइनमेंट जाँचने के लिए कृपया फिर से साइन इन करें।';

  @override
  String get assessUpgradeTitle => 'उच्च योजना आवश्यक है';

  @override
  String get assessUpgradeBody =>
      'हस्तलिखित काम की जाँच उच्च योजना का हिस्सा है। जाँचते रहने के लिए अपग्रेड करें।';

  @override
  String get assessDailyLimitTitle => 'आज के लिए आपके सभी मूल्यांकन पूरे हो गए';

  @override
  String get assessDailyLimitBody =>
      'आपकी योजना में हर दिन तय संख्या में मूल्यांकन शामिल हैं। ये कल फिर शुरू होंगे, या आप उच्च योजना पर सीमा बढ़ा सकते हैं।';

  @override
  String get assessLimitTitle => 'आप अपनी मूल्यांकन सीमा तक पहुँच गए हैं';

  @override
  String get assessLimitBody =>
      'आपने अपनी योजना के सभी मूल्यांकन उपयोग कर लिए हैं। ये अगले महीने फिर शुरू होंगे, या आप उच्च योजना पर सीमा बढ़ा सकते हैं।';

  @override
  String get assessSeePricing => 'योजनाएँ देखें';

  @override
  String get assessBusy =>
      'जाँच मॉडल अभी व्यस्त है। कृपया एक मिनट में फिर से प्रयास करें।';

  @override
  String assessBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'जाँच मॉडल अभी व्यस्त है। कृपया लगभग $seconds सेकंड में फिर से प्रयास करें।',
      one:
          'जाँच मॉडल अभी व्यस्त है। कृपया लगभग 1 सेकंड में फिर से प्रयास करें।',
    );
    return '$_temp0';
  }

  @override
  String get assessTimeout =>
      'जाँच में सामान्य से अधिक समय लग रहा है। कृपया फिर से प्रयास करें।';

  @override
  String get assessRephrase =>
      'फ़ोटो जाँची नहीं जा सकी। कृपया साफ़ फ़ोटो फिर से अपलोड करें।';

  @override
  String get assessSectionWork => 'छात्र का काम';

  @override
  String get assessResultTitle => 'मूल्यांकन';

  @override
  String get worksheetSectionWorksheet => 'वर्कशीट';

  @override
  String get rubricSectionAssignment => 'असाइनमेंट';

  @override
  String get examPaperSectionPaper => 'प्रश्नपत्र';

  @override
  String get examPaperSectionFormat => 'प्रारूप';

  @override
  String get vidyaEyebrow => 'आपके सह-शिक्षक';

  @override
  String get vidyaDeck => 'अपनी भाषा में बोलिए, और मैं काम तैयार कर दूँगी।';

  @override
  String get vidyaGreeting =>
      'स्वागत है, शिक्षक जी। अपनी भाषा में बोलिए, और मैं आपका काम तैयार कर दूँगी।';

  @override
  String get vidyaHeroBadge => 'आपका एआई शिक्षण सहायक';

  @override
  String get vidyaPromptLesson => 'मुझसे पाठ योजना बनाने को कहिए';

  @override
  String get vidyaPromptQuiz => 'मुझसे प्रश्नोत्तरी बनाने को कहिए';

  @override
  String get vidyaPromptParent => 'मुझसे अभिभावक को संदेश भेजने को कहिए';

  @override
  String get vidyaStateIdle => 'बोलने के लिए टैप करें';

  @override
  String get vidyaStateReady => 'तैयार हो रहा है';

  @override
  String get vidyaWorkingTitle => 'इस पर काम कर रही हूँ';

  @override
  String get vidyaWorkingBody => 'ऐप चलाते रहिए। मैं पीछे से पूरा कर दूँगी।';

  @override
  String get vidyaWorkingMinimise => 'VIDYA में समेटें';

  @override
  String get vidyaWorkingStop => 'रोकें';

  @override
  String get vidyaStateListening => 'मैं सुन रही हूँ';

  @override
  String get vidyaStateThinking => 'सोच रही हूँ';

  @override
  String get vidyaStateSpeaking => 'बोल रही हूँ';

  @override
  String get vidyaYouSaid => 'आपने कहा';

  @override
  String get vidyaSignedOutTitle => 'VIDYA से बात करने के लिए साइन इन करें';

  @override
  String get vidyaSignedOutBody =>
      'साइन इन करें और VIDYA आपकी भाषा में पाठ, प्रश्नोत्तरी और बहुत कुछ तैयार करेगी।';

  @override
  String get vidyaMicOffTitle => 'माइक्रोफ़ोन चालू करें';

  @override
  String get vidyaMicOffBody =>
      'आपको सुनने के लिए VIDYA को माइक्रोफ़ोन चाहिए। इसे सेटिंग में चालू करें।';

  @override
  String get vidyaOpenSettings => 'सेटिंग खोलें';

  @override
  String get vidyaSignIn => 'साइन इन करें';

  @override
  String get vidyaLimitTitle => 'आप आज की वॉइस सीमा तक पहुँच गए हैं';

  @override
  String get vidyaLimitBody =>
      'आपके वॉइस मिनट फिर से मिलेंगे। तब तक आप टूल इस्तेमाल कर सकते हैं।';

  @override
  String get vidyaErrorTitle => 'यह पूरा नहीं हो सका';

  @override
  String get vidyaErrorBody =>
      'कुछ गड़बड़ हो गई। फिर से कोशिश करने के लिए सील पर टैप करें।';

  @override
  String get vidyaPrepDesk => 'तैयारी डेस्क';

  @override
  String get vidyaClearConversation => 'बातचीत साफ़ करें';

  @override
  String get vidyaFlowVisualAid => 'दृश्य सामग्री';

  @override
  String get vidyaFlowVirtualFieldTrip => 'आभासी भ्रमण';

  @override
  String get vidyaFlowVideoStoryteller => 'वीडियो कहानी';

  @override
  String get vidyaFieldMicLabel => 'बोलकर भरें';

  @override
  String get vidyaFieldMicFailed =>
      'सुन नहीं पाए। फिर से कोशिश करें या टाइप करें।';

  @override
  String get vidyaOpen => 'VIDYA से पूछें';

  @override
  String get parentHotlineTitle => 'अभिभावक कॉल लाइन';

  @override
  String get parentHotlineSubtitle =>
      'विद्यार्थी के अभिभावक को उनकी भाषा में कॉल करें';

  @override
  String get parentHotlineEyebrow => 'अभिभावक कॉल लाइन';

  @override
  String get parentHotlinePickStudentIntro =>
      'चुनें किसके अभिभावक को कॉल करना है।';

  @override
  String get parentHotlineClassLabel => 'कक्षा';

  @override
  String get parentHotlineNoPhone => 'अभिभावक का नंबर सहेजा नहीं गया';

  @override
  String get parentHotlineSignedOutTitle =>
      'अपने विद्यार्थी देखने के लिए साइन इन करें';

  @override
  String get parentHotlineSignedOutBody =>
      'साइन इन करते ही आपकी कक्षा की सूची लोड हो जाएगी। कॉल करने से पहले अभिभावक कॉल लाइन को आपके खाते की ज़रूरत होती है।';

  @override
  String get parentHotlineRosterUnavailableTitle =>
      'आपकी कक्षा की सूची अभी उपलब्ध नहीं है';

  @override
  String get parentHotlineRosterUnavailableBody =>
      'हम अभी यहाँ आपके विद्यार्थियों को लोड नहीं कर पा रहे। यह किसी आगामी अपडेट में आएगा। आप पहले से साइन इन हैं, इसलिए आपको कुछ ठीक करने की ज़रूरत नहीं है।';

  @override
  String get parentHotlineRosterEmptyTitle =>
      'आपकी सूची में अभी कोई विद्यार्थी नहीं है';

  @override
  String get parentHotlineRosterEmptyBody =>
      'किसी कक्षा में विद्यार्थी जोड़ें, वे यहाँ दिखेंगे और घर कॉल करने के लिए तैयार होंगे।';

  @override
  String get parentHotlineReasonEyebrow => 'आप कॉल क्यों कर रहे हैं';

  @override
  String get parentHotlineReasonAbsencesLabel => 'बार-बार अनुपस्थिति';

  @override
  String get parentHotlineReasonAbsencesDesc =>
      'विद्यार्थी लगातार कई दिन अनुपस्थित रहा है।';

  @override
  String get parentHotlineReasonPerformanceLabel => 'किसी विषय में पिछड़ना';

  @override
  String get parentHotlineReasonPerformanceDesc =>
      'हाल के अंक या कक्षा-कार्य पर ध्यान देना ज़रूरी है।';

  @override
  String get parentHotlineReasonBehaviourLabel => 'कक्षा में व्यवहार';

  @override
  String get parentHotlineReasonBehaviourDesc =>
      'कुछ ऐसा हुआ जो अभिभावक को जानना चाहिए।';

  @override
  String get parentHotlineReasonPositiveLabel => 'साझा करने के लिए अच्छी खबर';

  @override
  String get parentHotlineReasonPositiveDesc =>
      'अभिभावक के साथ एक उपलब्धि का जश्न मनाएँ।';

  @override
  String get parentHotlineComposeEyebrow => 'कॉल तैयार करें';

  @override
  String get parentHotlineNoteLabel => 'एक टिप्पणी जोड़ें';

  @override
  String get parentHotlineNoteHintAbsences =>
      'छूटे हुए दिनों के बारे में अभिभावक को कुछ बताना है?';

  @override
  String get parentHotlineNoteHintPerformance =>
      'विद्यार्थी को सुधरने में क्या मदद करेगा?';

  @override
  String get parentHotlineNoteHintBehaviour =>
      'क्या हुआ, और घर पर किस सहयोग से मदद मिलेगी?';

  @override
  String get parentHotlineNoteHintPositive =>
      'साझा करने के लिए अच्छी खबर क्या है?';

  @override
  String get parentHotlineDraftAction => 'संदेश तैयार करें';

  @override
  String get parentHotlineErrorTitle => 'कुछ गड़बड़ हो गई';

  @override
  String get parentHotlineGenericError =>
      'यह पूरा नहीं हो सका। कृपया फिर से कोशिश करें।';

  @override
  String get parentHotlineTelephonyUnavailable =>
      'कॉल करना अभी उपलब्ध नहीं है। आप संदेश कॉपी करके WhatsApp पर भेज सकते हैं।';

  @override
  String get parentHotlineEvidenceAttendanceHeader => 'उपस्थिति';

  @override
  String get parentHotlineEvidenceMarksHeader => 'हाल के अंक';

  @override
  String get parentHotlineEvidenceBehaviourHeader => 'क्या हुआ';

  @override
  String get parentHotlineEvidencePositiveHeader => 'अच्छी खबर';

  @override
  String parentHotlineEvidenceAbsentDays(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: 'लगातार $days दिन अनुपस्थित',
      one: 'लगातार 1 दिन अनुपस्थित',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineEvidenceAbsencePrompt =>
      'छूटे हुए दिनों की पुष्टि करें ताकि अभिभावक को सही ब्यौरा सुनने को मिले।';

  @override
  String get parentHotlineEvidenceMarksPrompt =>
      'नवीनतम अंक कॉल में बताने के लिए तैयार हैं।';

  @override
  String get parentHotlineEvidenceMarksEmpty =>
      'अभी कोई हाल के अंक दर्ज नहीं हैं। अभिभावक को जो बताना है वह नीचे जोड़ें।';

  @override
  String get parentHotlineEvidenceBehaviourPrompt =>
      'बताएँ कि क्या हुआ और घर पर किस सहयोग से मदद मिलेगी।';

  @override
  String get parentHotlineEvidencePositivePrompt =>
      'वह उपलब्धि साझा करें जिसे अभिभावक के साथ मनाना चाहते हैं।';

  @override
  String get parentHotlineReviewEyebrow => 'घर के लिए संदेश';

  @override
  String get parentHotlineCall => 'अभिभावक को कॉल करें';

  @override
  String get parentHotlineWhatsApp => 'WhatsApp के लिए कॉपी करें';

  @override
  String parentHotlineCallAgainIn(String time) {
    return '$time में फिर कॉल करें';
  }

  @override
  String parentHotlineUnsupportedLanguage(String language) {
    return '$language के लिए ऑटो-कॉल अभी उपलब्ध नहीं है — इसके बजाय WhatsApp के लिए कॉपी करें।';
  }

  @override
  String parentHotlinePhoneMask(String last4) {
    return '•••• $last4';
  }

  @override
  String get parentHotlineAiNotice =>
      'कॉल की शुरुआत में एक स्वचालित AI आवाज़ की सूचना दी जाती है।';

  @override
  String get parentHotlineCopied =>
      'संदेश कॉपी हो गया — भेजने के लिए इसे WhatsApp में पेस्ट करें।';

  @override
  String get parentHotlinePremiumTitle =>
      'अभिभावक कॉल लाइन के लिए उन्नत प्लान चाहिए';

  @override
  String get parentHotlinePremiumBody =>
      'अभिभावक को AI आवाज़ कॉल करना उन्नत प्लान का हिस्सा है। आप अब भी मुफ़्त में WhatsApp पर भेजने के लिए संदेश कॉपी कर सकते हैं।';

  @override
  String get parentHotlineComingSoonTitle => 'कॉल स्क्रीन जल्द आ रही है';

  @override
  String get parentHotlineComingSoonBody =>
      'कॉल करना और उस पर नज़र रखना अगले अपडेट में आएगा।';

  @override
  String parentHotlineCallingTitle(String name) {
    return '$name के अभिभावक को कॉल किया जा रहा है…';
  }

  @override
  String get parentHotlineCallingRinging => 'घंटी बज रही है…';

  @override
  String get parentHotlineCallingInProgress => 'बातचीत चल रही है';

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
      'आप यह स्क्रीन छोड़ सकते हैं — सारांश आपके लिए तैयार रहेगा।';

  @override
  String get parentHotlineSummaryDocType => 'अभिभावक कॉल';

  @override
  String get parentHotlineSummaryReasonAbsences => 'अनुपस्थिति';

  @override
  String get parentHotlineSummaryReasonPerformance => 'प्रदर्शन';

  @override
  String get parentHotlineSummaryReasonBehaviour => 'व्यवहार';

  @override
  String get parentHotlineSummaryReasonPositive => 'अच्छी खबर';

  @override
  String parentHotlineSummaryTitle(String name) {
    return '$name के अभिभावक';
  }

  @override
  String parentHotlineSummaryDurationMin(int minutes) {
    return '$minutes मिनट';
  }

  @override
  String get parentHotlineSentimentCooperative => 'सहयोगी';

  @override
  String get parentHotlineSentimentConcerned => 'चिंतित';

  @override
  String get parentHotlineSentimentGrateful => 'आभारी';

  @override
  String get parentHotlineSentimentUpset => 'नाराज़';

  @override
  String get parentHotlineSentimentIndifferent => 'संयमित';

  @override
  String get parentHotlineSentimentConfused => 'असमंजस में';

  @override
  String get parentHotlineSummarySaidHeader => 'अभिभावक ने क्या कहा';

  @override
  String get parentHotlineSummaryConcernsHeader => 'उठाई गई चिंताएँ';

  @override
  String get parentHotlineSummaryCommitmentsHeader => 'अभिभावक के वादे';

  @override
  String get parentHotlineSummaryActionsHeader => 'आपके कार्य बिंदु';

  @override
  String get parentHotlineSummaryGuidanceHeader => 'साझा किया गया मार्गदर्शन';

  @override
  String get parentHotlineSummaryFollowUpHeader => 'अगला कदम';

  @override
  String parentHotlineSummaryTranscript(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'बातचीत देखें · $count संदेश',
      one: 'बातचीत देखें · 1 संदेश',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineSummaryDone => 'हो गया';

  @override
  String get parentHotlineSummaryCallAgain => 'बाद में फिर कॉल करें';

  @override
  String get parentHotlineSummaryManualTitle => 'संदेश कॉपी हो गया';

  @override
  String get parentHotlineSummaryManualBody =>
      'अभिभावक को भेजने के लिए इसे WhatsApp में पेस्ट करें।';

  @override
  String get parentHotlineSummaryBusy => 'लाइन व्यस्त थी';

  @override
  String get parentHotlineSummaryNoAnswer => 'कोई उत्तर नहीं';

  @override
  String get parentHotlineSummaryFailed => 'कॉल नहीं लग सकी';

  @override
  String get parentHotlineSummaryFailedBody =>
      'कॉल नहीं हो पाई। आप फिर से कोशिश कर सकते हैं, या संदेश कॉपी करके WhatsApp पर भेज सकते हैं।';

  @override
  String get parentHotlineSummaryTryAgain => 'फिर कोशिश करें';

  @override
  String get parentHotlineSummaryNoConversationTitle =>
      'कॉल बहुत जल्दी समाप्त हो गई';

  @override
  String get parentHotlineSummaryNoConversationBody =>
      'बातचीत शुरू होने से पहले ही कॉल समाप्त हो गई। आप फिर से कोशिश कर सकते हैं, या संदेश WhatsApp पर भेज सकते हैं।';

  @override
  String get parentHotlineSummaryUnavailableTitle => 'सारांश उपलब्ध नहीं है';

  @override
  String get parentHotlineSummaryUnavailableBody =>
      'इस कॉल का सारांश तैयार नहीं हो सका। बातचीत नीचे दी गई है।';

  @override
  String get contentCreatorTitle => 'सामग्री निर्माण स्टूडियो';

  @override
  String get contentCreatorTileSubtitle =>
      'अपनी कक्षा के लिए मल्टीमीडिया बनाएँ';

  @override
  String get contentCreatorSubtitle =>
      'आपकी कक्षा के लिए आकर्षक मल्टीमीडिया सामग्री बनाने में मदद करने वाले उपकरण।';

  @override
  String get contentCreatorSectionEyebrow => 'एक उपकरण चुनें';

  @override
  String get contentCreatorVisualAidDesc =>
      'अपने पाठों के लिए सरल रेखाचित्र और आरेख बनाएँ।';

  @override
  String get contentCreatorFieldTripDesc =>
      'Google Earth का उपयोग करके रोमांचक वर्चुअल सैर की योजना बनाएँ।';

  @override
  String get contentCreatorVideoDesc =>
      'अपने पाठों के लिए चयनित शैक्षिक वीडियो खोजें।';

  @override
  String get visualAidTitle => 'दृश्य सहायक';

  @override
  String get visualAidSubtitle => 'शिक्षण चित्र बनाएँ';

  @override
  String get visualAidEmpty => 'एक चित्र का विवरण दें और बनाएँ दबाएँ।';

  @override
  String get visualAidPromptLabel => 'चित्र में क्या दिखना चाहिए?';

  @override
  String get visualAidPromptHint => 'उदाहरण के लिए, पादप कोशिका के भाग';

  @override
  String get visualAidPromptError => 'कृपया बताएँ कि आपको कैसा चित्र चाहिए।';

  @override
  String get visualAidGradeLabel => 'कक्षा स्तर';

  @override
  String get visualAidGradeAny => 'कोई भी कक्षा';

  @override
  String get visualAidSubjectLabel => 'विषय';

  @override
  String get visualAidSubjectAny => 'कोई भी विषय';

  @override
  String get visualAidOptional => 'वैकल्पिक';

  @override
  String get visualAidAction => 'चित्र बनाएँ';

  @override
  String get visualAidResultTitle => 'दृश्य सहायक';

  @override
  String get visualAidHowToUse => 'इसका उपयोग कैसे करें';

  @override
  String get visualAidDiscussionSpark => 'चर्चा का प्रश्न';

  @override
  String get visualAidImageLabel => 'तैयार किया गया शिक्षण चित्र';

  @override
  String get visualAidImageError => 'यह चित्र नहीं दिखाया जा सका।';

  @override
  String get visualAidNoImage =>
      'उस विवरण के लिए कोई चित्र नहीं मिला। कृपया इसे दोबारा लिखें और फिर कोशिश करें।';

  @override
  String get visualAidSignIn =>
      'इस उपकरण का उपयोग करने के लिए कृपया फिर से साइन इन करें।';

  @override
  String get visualAidUpgradeTitle => 'एक उच्च योजना आवश्यक है';

  @override
  String get visualAidUpgradeBody =>
      'दृश्य सहायक एक उच्च योजना का हिस्सा है। चित्र बनाते रहने के लिए कृपया अपनी योजना अपग्रेड करें।';

  @override
  String get visualAidSeePricing => 'योजनाएँ और मूल्य देखें';

  @override
  String get visualAidDailyLimitTitle => 'आज के लिए आपके सभी चित्र बन गए हैं';

  @override
  String get visualAidDailyLimitBody =>
      'आपकी योजना में हर दिन एक निश्चित संख्या में दृश्य सहायक शामिल हैं। आपके चित्र कल फिर से उपलब्ध होंगे, या आप किसी उच्च योजना पर दैनिक सीमा बढ़ा सकते हैं।';

  @override
  String get visualAidLimitTitle => 'आप अपनी सीमा तक पहुँच गए हैं';

  @override
  String get visualAidLimitBody =>
      'आपने इस महीने के अपने दृश्य सहायक उपयोग कर लिए हैं। आपके चित्र अगले महीने फिर से उपलब्ध होंगे, या आप किसी उच्च योजना पर सीमा बढ़ा सकते हैं।';

  @override
  String get visualAidRephrase =>
      'हम वह चित्र नहीं बना सके। कृपया इसे दोबारा लिखें और फिर कोशिश करें।';

  @override
  String get visualAidEmptyGeneration =>
      'चित्र खाली आया। इसे कम लेबल के साथ बताने का प्रयास करें।';

  @override
  String get visualAidBusy =>
      'सहायक अभी व्यस्त है। कृपया थोड़ी देर में फिर कोशिश करें।';

  @override
  String visualAidBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'सहायक अभी व्यस्त है। कृपया लगभग $seconds सेकंड में फिर कोशिश करें।',
      one: 'सहायक अभी व्यस्त है। कृपया लगभग 1 सेकंड में फिर कोशिश करें।',
    );
    return '$_temp0';
  }

  @override
  String get visualAidTimeout =>
      'इसमें अपेक्षा से अधिक समय लग रहा है। कृपया फिर कोशिश करें।';

  @override
  String get videoStorytellerTitle => 'वीडियो कहानीकार';

  @override
  String get videoStorytellerSubtitle => 'शिक्षण वीडियो खोजें';

  @override
  String get videoStorytellerEmpty =>
      'कोई विषय या टॉपिक चुनें और वीडियो खोजें पर टैप करें।';

  @override
  String get videoStorytellerTopicLabel => 'टॉपिक या अध्याय';

  @override
  String get videoStorytellerTopicHint => 'उदाहरण के लिए, जल चक्र';

  @override
  String get videoStorytellerSubjectLabel => 'विषय';

  @override
  String get videoStorytellerSubjectAny => 'कोई भी विषय';

  @override
  String get videoStorytellerGradeLabel => 'कक्षा स्तर';

  @override
  String get videoStorytellerGradeAny => 'कोई भी कक्षा';

  @override
  String get videoStorytellerOptional => 'वैकल्पिक';

  @override
  String get videoStorytellerAction => 'वीडियो खोजें';

  @override
  String get videoStorytellerNoResults =>
      'उसके लिए कोई वीडियो नहीं मिला। कोई अलग विषय या टॉपिक आज़माएँ।';

  @override
  String videoStorytellerViewAll(int count) {
    return 'सभी $count देखें';
  }

  @override
  String get videoStorytellerOfficialSource => 'आधिकारिक स्रोत';

  @override
  String get videoStorytellerOpensExternally =>
      'यूट्यूब में, ऐप के बाहर खुलता है।';

  @override
  String get videoStorytellerCategoryTopRecommended =>
      'आपके लिए शीर्ष अनुशंसित';

  @override
  String get videoStorytellerCategoryStorytelling =>
      'आपके विषयों के लिए कहानी-कथन';

  @override
  String get videoStorytellerCategoryPedagogy =>
      'शिक्षण-शास्त्र और शिक्षण विधियाँ';

  @override
  String get videoStorytellerCategoryGovtUpdates => 'सरकारी अपडेट';

  @override
  String get videoStorytellerCategoryCourses => 'शिक्षक प्रशिक्षण पाठ्यक्रम';

  @override
  String get videoStorytellerSignIn =>
      'इस उपकरण का उपयोग करने के लिए कृपया फिर से साइन इन करें।';

  @override
  String get videoStorytellerTimeout =>
      'इसमें अपेक्षा से अधिक समय लग रहा है। कृपया फिर कोशिश करें।';

  @override
  String get videoStorytellerBusy =>
      'सहायक अभी व्यस्त है। कृपया थोड़ी देर में फिर कोशिश करें।';

  @override
  String videoStorytellerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'सहायक अभी व्यस्त है। कृपया लगभग $seconds सेकंड में फिर कोशिश करें।',
      one: 'सहायक अभी व्यस्त है। कृपया लगभग 1 सेकंड में फिर कोशिश करें।',
    );
    return '$_temp0';
  }

  @override
  String get videoStorytellerRephrase =>
      'हम उसके लिए वीडियो नहीं ढूँढ़ सके। कृपया कोई अलग टॉपिक आज़माएँ।';

  @override
  String get videoStorytellerLimit =>
      'आपने हाल ही में बहुत खोज की है। कृपया थोड़ी देर बाद फिर कोशिश करें।';

  @override
  String get actionDone => 'हो गया';

  @override
  String get virtualFieldTripTitle => 'वर्चुअल फ़ील्ड ट्रिप';

  @override
  String get virtualFieldTripSubtitle => 'Google Earth पर दुनिया की सैर करें';

  @override
  String get virtualFieldTripEmpty =>
      'एक विषय दर्ज करें और \'यात्रा की योजना बनाएँ\' पर टैप करें।';

  @override
  String get virtualFieldTripTopicLabel => 'विषय या थीम';

  @override
  String get virtualFieldTripTopicHint => 'उदाहरण के लिए, ग्रेट बैरियर रीफ़';

  @override
  String get virtualFieldTripTopicError =>
      'कृपया यात्रा के लिए एक विषय दर्ज करें।';

  @override
  String get virtualFieldTripGradeLabel => 'कक्षा स्तर';

  @override
  String get virtualFieldTripGradeAny => 'कोई भी कक्षा';

  @override
  String get virtualFieldTripOptional => 'वैकल्पिक';

  @override
  String get virtualFieldTripAction => 'यात्रा की योजना बनाएँ';

  @override
  String get virtualFieldTripDocType => 'वर्चुअल फ़ील्ड ट्रिप';

  @override
  String virtualFieldTripStopCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count पड़ाव',
      one: '1 पड़ाव',
    );
    return '$_temp0';
  }

  @override
  String virtualFieldTripStopSemantics(int number, String name) {
    return 'पड़ाव $number: $name';
  }

  @override
  String get virtualFieldTripFactLabel => 'क्या आप जानते हैं?';

  @override
  String get virtualFieldTripReflectionLabel => 'इस पर सोचें';

  @override
  String get virtualFieldTripAnalogyLabel => 'हमारे संदर्भ में';

  @override
  String get virtualFieldTripExplanationLabel => 'हम यहाँ क्यों जाते हैं';

  @override
  String get virtualFieldTripOpenEarth => 'Google Earth में खोलें';

  @override
  String get virtualFieldTripOpensExternally =>
      'ऐप के बाहर, Google Earth में खुलता है।';

  @override
  String get virtualFieldTripPendingTitle =>
      'आपकी यात्रा अभी भी तैयार हो रही है';

  @override
  String get virtualFieldTripPendingBody =>
      'आपकी फ़ील्ड ट्रिप अभी भी बनाई जा रही है। एक मिनट में \'मेरी लाइब्रेरी\' देखें।';

  @override
  String get virtualFieldTripNoStops =>
      'इसके लिए कोई पड़ाव नहीं मिला। कोई दूसरा विषय आज़माएँ।';

  @override
  String get virtualFieldTripSignIn =>
      'इस टूल का उपयोग करने के लिए कृपया फिर से साइन इन करें।';

  @override
  String get virtualFieldTripUnavailable =>
      'यह टूल आपके मौजूदा प्लान का हिस्सा नहीं है।';

  @override
  String get virtualFieldTripTimeout =>
      'इसमें अपेक्षा से अधिक समय लग रहा है। कृपया फिर से प्रयास करें।';

  @override
  String get virtualFieldTripBusy =>
      'सहायक अभी व्यस्त है। कृपया थोड़ी देर बाद फिर प्रयास करें।';

  @override
  String virtualFieldTripBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'सहायक अभी व्यस्त है। कृपया लगभग $seconds सेकंड बाद फिर प्रयास करें।',
      one: 'सहायक अभी व्यस्त है। कृपया लगभग 1 सेकंड बाद फिर प्रयास करें।',
    );
    return '$_temp0';
  }

  @override
  String get virtualFieldTripRephrase =>
      'हम इसके लिए यात्रा की योजना नहीं बना सके। कृपया कोई दूसरा विषय आज़माएँ।';

  @override
  String get virtualFieldTripLimit =>
      'आपने हाल ही में बहुत सी यात्राओं की योजना बनाई है। कृपया थोड़ी देर बाद फिर प्रयास करें।';

  @override
  String get assessmentScannerTitle => 'मूल्यांकन स्कैनर';

  @override
  String get assessmentScannerSubtitle =>
      'छात्र की उत्तर पुस्तिका को पृष्ठ दर पृष्ठ जाँचें';

  @override
  String get assessmentScannerEmpty =>
      'उत्तर पुस्तिका की 3 तक फ़ोटो जोड़ें, फिर जाँचें दबाएँ।';

  @override
  String get assessmentScannerSubmit => 'उत्तर पुस्तिका जाँचें';

  @override
  String get assessmentScannerResultTitle => 'मूल्यांकन';

  @override
  String get assessmentScannerSectionSheet => 'उत्तर पुस्तिका';

  @override
  String get assessmentScannerPagesLabel => 'उत्तर पुस्तिका के पृष्ठ';

  @override
  String get assessmentScannerPagesHint =>
      '3 तक साफ़ फ़ोटो जोड़ें, हर पृष्ठ की एक।';

  @override
  String get assessmentScannerPagesEmpty => 'पहले पृष्ठ की एक फ़ोटो जोड़ें।';

  @override
  String assessmentScannerPageLabel(int number) {
    return 'पृष्ठ $number';
  }

  @override
  String assessmentScannerRemovePage(int number) {
    return 'पृष्ठ $number हटाएँ';
  }

  @override
  String assessmentScannerPageCounter(int count, int max) {
    return '$max में से $count पृष्ठ';
  }

  @override
  String assessmentScannerPagesFull(int max) {
    return 'आप $max तक पृष्ठ जोड़ सकते हैं।';
  }

  @override
  String get assessmentScannerTakePhoto => 'फ़ोटो लें';

  @override
  String get assessmentScannerChooseGallery => 'गैलरी से चुनें';

  @override
  String get assessmentScannerSubjectLabel => 'विषय';

  @override
  String get assessmentScannerSubjectHint => 'जाँच विषय के अनुसार होती है।';

  @override
  String get assessmentScannerSubjectPlaceholder => 'विषय चुनें';

  @override
  String get assessmentScannerSubjectError => 'कृपया विषय चुनें।';

  @override
  String get assessmentScannerGradeLabel => 'कक्षा स्तर';

  @override
  String get assessmentScannerGradePlaceholder => 'कक्षा चुनें';

  @override
  String get assessmentScannerGradeError => 'कृपया कक्षा चुनें।';

  @override
  String get assessmentScannerOptional => 'वैकल्पिक';

  @override
  String get assessmentScannerAnswerKeyLabel => 'उत्तर कुंजी';

  @override
  String get assessmentScannerAnswerKeyHint =>
      'सही उत्तर चिपकाएँ ताकि उनके अनुसार जाँच हो।';

  @override
  String get assessmentScannerAnswerKeyPlaceholder =>
      'उत्तर कुंजी लिखें या चिपकाएँ';

  @override
  String get assessmentScannerPrivacyNote =>
      'जाँच के लिए छात्र का नाम कभी नहीं भेजा जाता।';

  @override
  String assessmentScannerScoreCaption(String awarded, String max) {
    return '$max में से $awarded अंक';
  }

  @override
  String get assessmentScannerScoreOutOf => '100 में से';

  @override
  String assessmentScannerMarks(String awarded, String max) {
    return '$awarded/$max';
  }

  @override
  String assessmentScannerPagesMeta(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count पृष्ठ',
      one: '1 पृष्ठ',
    );
    return '$_temp0';
  }

  @override
  String assessmentScannerReviewBadge(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count की समीक्षा करें',
      one: '1 की समीक्षा करें',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerQuestionsSection => 'प्रश्न दर प्रश्न';

  @override
  String get assessmentScannerStudentAnswerLabel => 'छात्र ने लिखा';

  @override
  String get assessmentScannerFeedbackLabel => 'प्रतिक्रिया';

  @override
  String get assessmentScannerExpectedLabel => 'अपेक्षित उत्तर';

  @override
  String get assessmentScannerNextStepsSection => 'अनुशंसित अगले कदम';

  @override
  String get assessmentScannerStudentSection => 'छात्र के लिए';

  @override
  String get assessmentScannerQualitySection => 'फ़ोटो गुणवत्ता';

  @override
  String get assessmentScannerNotScored => 'अंक नहीं दिए गए';

  @override
  String get assessmentScannerNoContent =>
      'कोई अंक नहीं मिले। कृपया साफ़ फ़ोटो आज़माएँ।';

  @override
  String get assessmentScannerOutcomeCorrect => 'सही';

  @override
  String get assessmentScannerOutcomePartial => 'आंशिक रूप से सही';

  @override
  String get assessmentScannerOutcomeIncorrect => 'ग़लत';

  @override
  String get assessmentScannerReviewChip => 'इसे जाँचें';

  @override
  String get assessmentScannerSignIn =>
      'उत्तर पुस्तिका जाँचने के लिए कृपया फिर से साइन इन करें।';

  @override
  String get assessmentScannerUpgradeTitle => 'उच्च योजना आवश्यक है';

  @override
  String get assessmentScannerUpgradeBody =>
      'उत्तर पुस्तिका जाँचना उच्च योजना का हिस्सा है। जाँचते रहने के लिए अपग्रेड करें।';

  @override
  String get assessmentScannerSeePricing => 'योजनाएँ देखें';

  @override
  String get assessmentScannerDailyLimitTitle =>
      'आज के लिए आपकी सभी उत्तर पुस्तिकाएँ पूरी हो गईं';

  @override
  String get assessmentScannerDailyLimitBody =>
      'आपकी योजना में हर दिन तय संख्या में उत्तर पुस्तिकाएँ शामिल हैं। ये कल फिर शुरू होंगी, या आप उच्च योजना पर सीमा बढ़ा सकते हैं।';

  @override
  String get assessmentScannerLimitTitle => 'आप अपनी जाँच सीमा तक पहुँच गए हैं';

  @override
  String get assessmentScannerLimitBody =>
      'आपने अपनी योजना की सभी उत्तर पुस्तिकाएँ उपयोग कर ली हैं। ये अगले महीने फिर शुरू होंगी, या आप उच्च योजना पर सीमा बढ़ा सकते हैं।';

  @override
  String get assessmentScannerBusy =>
      'जाँच मॉडल अभी व्यस्त है। कृपया एक मिनट में फिर से प्रयास करें।';

  @override
  String assessmentScannerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'जाँच मॉडल अभी व्यस्त है। कृपया लगभग $seconds सेकंड में फिर से प्रयास करें।',
      one:
          'जाँच मॉडल अभी व्यस्त है। कृपया लगभग 1 सेकंड में फिर से प्रयास करें।',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerTimeout =>
      'जाँच में सामान्य से अधिक समय लग रहा है। कृपया फिर से प्रयास करें।';

  @override
  String get assessmentScannerRephrase =>
      'फ़ोटो जाँची नहीं जा सकीं। कृपया साफ़ पृष्ठ फिर से अपलोड करें।';

  @override
  String get inboxTitle => 'संदेश';

  @override
  String get inboxSignInTitle => 'आपके संदेश';

  @override
  String get inboxSignInBody => 'अपने संदेश देखने के लिए साइन इन करें';

  @override
  String get inboxEmptyTitle => 'अभी कोई बातचीत नहीं';

  @override
  String get inboxEmptyBody =>
      'जब आप शिक्षकों से जुड़ेंगे, तो आपकी बातचीत यहाँ दिखेगी।';

  @override
  String get inboxErrorBody =>
      'हम आपके संदेश लोड नहीं कर सके। कृपया फिर से प्रयास करें।';

  @override
  String get inboxNoMessagesYet => 'अभी कोई संदेश नहीं';

  @override
  String get inboxThreadFallbackTitle => 'बातचीत';

  @override
  String get inboxThreadEmptyTitle => 'अभी कोई संदेश नहीं';

  @override
  String get inboxThreadEmptyBody => 'बातचीत शुरू करने के लिए नमस्ते कहें।';

  @override
  String get inboxComposerHint => 'संदेश लिखें';

  @override
  String get inboxComposerSend => 'भेजें';

  @override
  String get inboxComposerTooLong => 'संदेश बहुत लंबा है। कृपया इसे छोटा करें।';

  @override
  String get inboxLoadOlder => 'पुराने संदेश लोड करें';

  @override
  String get inboxSendFailed => 'आपका संदेश नहीं भेजा जा सका।';

  @override
  String get inboxResourceLabel => 'संसाधन';

  @override
  String get inboxVoiceNoteLabel => 'वॉइस नोट';

  @override
  String inboxUnreadLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count अपठित',
      one: '1 अपठित',
    );
    return '$_temp0';
  }

  @override
  String get inboxTickSending => 'भेजा जा रहा है';

  @override
  String get inboxTickSent => 'भेजा गया';

  @override
  String get inboxTickDelivered => 'पहुँचा';

  @override
  String get inboxTickRead => 'पढ़ा गया';

  @override
  String get inboxTickFailed => 'नहीं भेजा गया';

  @override
  String get inboxTimeNow => 'अभी';

  @override
  String inboxTimeMinutes(int count) {
    return '$count मि';
  }

  @override
  String inboxTimeHours(int count) {
    return '$count घं';
  }

  @override
  String inboxTimeDays(int count) {
    return '$count दि';
  }

  @override
  String inboxTimeWeeks(int count) {
    return '$count सप्त';
  }

  @override
  String get networkTitle => 'नेटवर्क';

  @override
  String get networkTooltip => 'नेटवर्क';

  @override
  String get networkTabStaffroom => 'स्टाफ़रूम';

  @override
  String get networkTabMessages => 'संदेश';

  @override
  String get networkTabUpdates => 'अपडेट';

  @override
  String get notificationsEmptyTitle => 'अभी कुछ नया नहीं';

  @override
  String get notificationsEmptyBody =>
      'कॉल के नतीजे, उपस्थिति की चेतावनियाँ और तैयार हो चुके प्रश्नपत्र यहाँ आते रहेंगे।';

  @override
  String get notificationsLocalNote =>
      'ये तब दिखते हैं जब आप ऐप खोलते हैं। SahayakAI अभी फ़ोन पर सूचनाएँ नहीं भेज सकता।';

  @override
  String get notificationsMarkAllRead => 'सभी को पढ़ा हुआ चिह्नित करें';

  @override
  String notificationCallCompletedTitle(String student) {
    return '$student के लिए अभिभावक कॉल पूरी हुई';
  }

  @override
  String get notificationCallCompletedBody =>
      'बातचीत का सारांश अभिभावक कॉल लाइन में तैयार है।';

  @override
  String notificationCallFailedTitle(String student) {
    return '$student के लिए अभिभावक कॉल नहीं जुड़ पाई';
  }

  @override
  String get notificationCallFailedBody =>
      'कॉल दोबारा करें, या संदेश WhatsApp पर भेज दें।';

  @override
  String notificationAbsenceTitle(String student, int count) {
    return '$student लगातार $count दिन अनुपस्थित रहे';
  }

  @override
  String notificationAbsenceBody(String className) {
    return 'छूटे हुए दिन देखने के लिए $className खोलें।';
  }

  @override
  String notificationExamPaperTitle(String subject) {
    return '$subject का प्रश्नपत्र बन रहा है';
  }

  @override
  String get notificationExamPaperBody =>
      'यह अभी तैयार हो रहा है और अपने आप आपकी लाइब्रेरी में आ जाएगा।';

  @override
  String get staffroomTitle => 'स्टाफ़रूम';

  @override
  String get staffroomHeroTitle => 'स्टाफ़रूम';

  @override
  String get staffroomHeroDeck => 'पूरे भारत के शिक्षक, एक ही कमरे में';

  @override
  String get staffroomSectionGroups => 'आपके समूह';

  @override
  String get staffroomSectionFeed => 'आपके समूहों से';

  @override
  String get staffroomSectionDiscover => 'समूह खोजें';

  @override
  String get staffroomSectionPeople => 'जिन्हें आप जानते होंगे';

  @override
  String get staffroomSignInTitle => 'स्टाफ़रूम से जुड़ें';

  @override
  String get staffroomSignInBody => 'स्टाफ़रूम से जुड़ने के लिए साइन इन करें';

  @override
  String get staffroomFeedEmptyTitle => 'आपकी फ़ीड शांत है';

  @override
  String get staffroomFeedEmptyBody => 'आपके समूहों की पोस्ट यहाँ दिखेंगी।';

  @override
  String get staffroomErrorBody =>
      'हम स्टाफ़रूम लोड नहीं कर सके। कृपया फिर से प्रयास करें।';

  @override
  String get staffroomGroupsEmptyTitle => 'अभी कोई समूह नहीं';

  @override
  String get staffroomGroupsEmptyBody =>
      'पोस्ट और चैट देखने के लिए किसी समूह से जुड़ें।';

  @override
  String get staffroomBrowseGroups => 'समूह ब्राउज़ करें';

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
  String get staffroomJoin => 'जुड़ें';

  @override
  String get staffroomJoined => 'जुड़ गए';

  @override
  String get staffroomJoinFailed =>
      'जुड़ नहीं सके। पुनः प्रयास के लिए टैप करें।';

  @override
  String get staffroomGroupLockedTitle => 'केवल सदस्यों के लिए';

  @override
  String get staffroomGroupLockedBody =>
      'इस समूह की पोस्ट देखने के लिए जुड़ें।';

  @override
  String get staffroomGroupPostsEmptyTitle => 'अभी कोई पोस्ट नहीं';

  @override
  String get staffroomGroupPostsEmptyBody => 'यहाँ सबसे पहले साझा करें।';

  @override
  String get staffroomGroupNotFoundTitle => 'समूह नहीं मिला';

  @override
  String get staffroomGroupNotFoundBody => 'यह समूह हटाया जा चुका हो सकता है।';

  @override
  String get staffroomPostTypeShare => 'साझा किया';

  @override
  String get staffroomPostTypeAskHelp => 'मदद चाहिए';

  @override
  String get staffroomPostTypeCelebrate => 'जश्न';

  @override
  String get staffroomPostTypeResource => 'संसाधन';

  @override
  String get staffroomLike => 'पसंद';

  @override
  String get staffroomLiked => 'पसंद किया';

  @override
  String staffroomLikeCountLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count पसंद',
      one: '1 पसंद',
      zero: 'कोई पसंद नहीं',
    );
    return '$_temp0';
  }

  @override
  String get staffroomLikeFailed =>
      'अपडेट नहीं हो सका। पुनः प्रयास के लिए टैप करें।';

  @override
  String get staffroomResourceShared => 'एक संसाधन साझा किया';

  @override
  String staffroomChatHighlight(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count नए संदेश',
      one: '1 नया संदेश',
    );
    return '$_temp0';
  }

  @override
  String get staffroomConnect => 'कनेक्ट करें';

  @override
  String get staffroomConnectSent => 'अनुरोध भेजा गया';

  @override
  String get staffroomConnectPending => 'अनुरोध पहले से लंबित है';

  @override
  String get staffroomConnectConnected => 'पहले से कनेक्टेड';

  @override
  String get staffroomChatTitle => 'स्टाफ़रूम';

  @override
  String get staffroomChatEntryBody => 'पूरे भारत के शिक्षकों से बातचीत करें';

  @override
  String get staffroomChatSignInTitle => 'स्टाफ़रूम से जुड़ें';

  @override
  String get staffroomChatSignInBody =>
      'स्टाफ़रूम से जुड़ने के लिए साइन इन करें';

  @override
  String get staffroomChatEmptyTitle => 'अभी तक कोई संदेश नहीं';

  @override
  String get staffroomChatEmptyBody => 'सबसे पहले नमस्ते कहें।';

  @override
  String get staffroomChatAiBadge => 'AI शिक्षक';

  @override
  String get staffroomGroupChatEntry => 'समूह चैट';

  @override
  String get staffroomDirectoryTitle => 'शिक्षक खोजें';

  @override
  String get staffroomDirectoryEntryBody => 'शिक्षक निर्देशिका में खोजें';

  @override
  String get staffroomDirectorySearchHint => 'नाम या विषय से खोजें';

  @override
  String get staffroomDirectoryErrorBody =>
      'निर्देशिका लोड नहीं हो सकी। कृपया पुनः प्रयास करें।';

  @override
  String get staffroomDirectoryEmptyTitle => 'कोई शिक्षक नहीं मिला';

  @override
  String get staffroomDirectoryEmptyBody =>
      'अभी दिखाने के लिए कोई शिक्षक नहीं है।';

  @override
  String get staffroomDirectorySearchEmpty =>
      'आपकी खोज से कोई शिक्षक मेल नहीं खाता।';

  @override
  String get staffroomProfileTitle => 'शिक्षक';

  @override
  String get staffroomProfileErrorBody =>
      'यह प्रोफ़ाइल लोड नहीं हो सकी। कृपया पुनः प्रयास करें।';

  @override
  String get staffroomProfileNotFoundTitle => 'प्रोफ़ाइल उपलब्ध नहीं';

  @override
  String get staffroomProfileNotFoundBody => 'यह प्रोफ़ाइल नहीं मिल सकी।';

  @override
  String get staffroomProfileAboutLabel => 'परिचय';

  @override
  String get staffroomProfileBioEmpty => 'अभी कोई परिचय नहीं है।';

  @override
  String get staffroomProfileVerified => 'सत्यापित';

  @override
  String staffroomProfileExperience(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count वर्ष का अनुभव',
      one: '1 वर्ष का अनुभव',
    );
    return '$_temp0';
  }

  @override
  String get staffroomProfileSubjectsLabel => 'विषय';

  @override
  String get staffroomProfileClassesLabel => 'कक्षाएँ';

  @override
  String get staffroomProfileLanguagesLabel => 'भाषाएँ';

  @override
  String get staffroomRequested => 'अनुरोध भेजा गया';

  @override
  String get staffroomConnectionAccept => 'स्वीकारें';

  @override
  String get staffroomConnectionDecline => 'अस्वीकारें';

  @override
  String get staffroomConnected => 'कनेक्टेड';

  @override
  String get staffroomConnectionWants => 'कनेक्ट करना चाहते हैं';

  @override
  String get staffroomMessage => 'संदेश भेजें';

  @override
  String get staffroomConnectToMessage => 'संदेश के लिए कनेक्ट करें';

  @override
  String get staffroomConnectionFailed =>
      'अपडेट नहीं हो सका। पुनः प्रयास के लिए टैप करें।';

  @override
  String get staffroomDisconnect => 'डिसकनेक्ट करें';

  @override
  String get staffroomDisconnectConfirmTitle => 'डिसकनेक्ट करें?';

  @override
  String get staffroomDisconnectConfirmBody =>
      'आप अब कनेक्टेड नहीं रहेंगे और एक-दूसरे को संदेश नहीं भेज पाएंगे।';

  @override
  String get staffroomDisconnectCancel => 'कनेक्टेड रहें';

  @override
  String get staffroomFollow => 'फ़ॉलो करें';

  @override
  String get staffroomFollowing => 'फ़ॉलो कर रहे हैं';

  @override
  String get staffroomFollowFailed =>
      'अपडेट नहीं हो सका। पुनः प्रयास के लिए टैप करें।';

  @override
  String get actionShare => 'साझा करें';

  @override
  String get resultSaveToLibrary => 'लाइब्रेरी में सहेजें';

  @override
  String get resultSaving => 'सहेजा जा रहा है';

  @override
  String get resultSaved => 'आपकी लाइब्रेरी में सहेजा गया';

  @override
  String get resultSaveFailedTitle => 'सहेजा नहीं जा सका';

  @override
  String get resultSaveFailedBody =>
      'हम इसे आपकी लाइब्रेरी में सहेज नहीं सके। कृपया फिर कोशिश करें।';

  @override
  String get resultSaveRetry => 'फिर से सहेजने की कोशिश करें';

  @override
  String get resultShareFailed =>
      'साझा नहीं किया जा सका। पाठ इसके बजाय क्लिपबोर्ड पर कॉपी कर दिया गया है।';

  @override
  String get actionCancel => 'रद्द करें';

  @override
  String get attendanceTitle => 'उपस्थिति';

  @override
  String get attendanceClassesEyebrow => 'आपकी कक्षाएँ';

  @override
  String get attendanceClassesIntro => 'रजिस्टर भरने के लिए कक्षा चुनें।';

  @override
  String get attendanceClassesEmptyTitle => 'अभी कोई कक्षा नहीं';

  @override
  String get attendanceClassesEmptyBody =>
      'पहले अपनी कक्षा बनाएँ, फिर उसमें विद्यार्थी जोड़ें।';

  @override
  String get attendanceClassesError => 'हम आपकी कक्षाएँ नहीं ला सके।';

  @override
  String get attendanceClassFullBadge => 'भरी हुई';

  @override
  String get attendanceNewClass => 'नई कक्षा';

  @override
  String get attendanceOpenRegister => 'रजिस्टर भरें';

  @override
  String get attendanceOpenRoster => 'विद्यार्थी';

  @override
  String get attendanceOpenMonth => 'इस महीने';

  @override
  String get attendanceSignedOutTitle => 'कक्षाएँ देखने के लिए साइन इन करें';

  @override
  String get attendanceSignedOutBody =>
      'आपकी कक्षाएँ और रजिस्टर आपके खाते में सहेजे जाते हैं। साइन इन करते ही वे यहाँ दिखेंगे।';

  @override
  String get attendanceClassNameLabel => 'कक्षा का नाम';

  @override
  String get attendanceClassNameHint => 'जैसे, कक्षा 6A';

  @override
  String get attendanceClassNameRequired => 'कक्षा का नाम लिखें।';

  @override
  String get attendanceSubjectLabel => 'विषय';

  @override
  String get attendanceGradeLabel => 'कक्षा स्तर';

  @override
  String get attendanceAcademicYearLabel => 'शैक्षणिक वर्ष';

  @override
  String get attendanceAcademicYearHint => 'जैसे, 2026-27';

  @override
  String get attendanceAcademicYearRequired => 'शैक्षणिक वर्ष लिखें।';

  @override
  String get attendanceSectionLabel => 'सेक्शन';

  @override
  String get attendanceSectionHint => 'जैसे, A';

  @override
  String get attendanceCreateClassSubmit => 'कक्षा बनाएँ';

  @override
  String get attendanceClassCreated => 'कक्षा बन गई।';

  @override
  String get attendanceCreateClassFailed => 'हम यह कक्षा नहीं बना सके।';

  @override
  String get attendanceRosterEyebrow => 'कक्षा की सूची';

  @override
  String get attendanceRosterUnavailableTitle =>
      'सूची अभी दिखाने के लिए तैयार नहीं है';

  @override
  String get attendanceRosterUnavailableBody =>
      'अभिभावकों के संपर्क विवरण हमारे सर्वर पर छिपे हुए रूप में लाए जा रहे हैं, और जब तक यह पूरा नहीं होता यह ऐप उन्हें डाउनलोड नहीं करेगा। आपकी कक्षा में कोई गड़बड़ी नहीं है और कुछ भी खोया नहीं है। रजिस्टर भरना और महीने का विवरण पहले की तरह काम करते हैं।';

  @override
  String get attendanceRosterEmptyTitle => 'अभी कोई विद्यार्थी नहीं';

  @override
  String get attendanceRosterEmptyBody =>
      'रजिस्टर भरना शुरू करने के लिए इस कक्षा के विद्यार्थी जोड़ें।';

  @override
  String get attendanceRosterError => 'हम यह सूची नहीं ला सके।';

  @override
  String attendanceRollLabel(int roll) {
    return 'रोल $roll';
  }

  @override
  String get attendanceNoParentPhone => 'अभिभावक का नंबर सहेजा नहीं गया';

  @override
  String attendanceParentPhoneMask(String last4) {
    return '•••• $last4';
  }

  @override
  String get attendanceAddStudent => 'विद्यार्थी जोड़ें';

  @override
  String get attendanceStudentNameLabel => 'विद्यार्थी का नाम';

  @override
  String get attendanceStudentNameRequired => 'विद्यार्थी का नाम लिखें।';

  @override
  String get attendanceRollNumberLabel => 'रोल नंबर';

  @override
  String get attendanceRollNumberHint => '1 से 40';

  @override
  String get attendanceRollNumberInvalid =>
      'रोल नंबर 1 से 40 के बीच पूर्ण संख्या होनी चाहिए।';

  @override
  String get attendanceParentPhoneLabel => 'अभिभावक का मोबाइल नंबर';

  @override
  String get attendanceParentPhoneHint => '10 अंकों का भारतीय मोबाइल नंबर';

  @override
  String get attendanceParentPhoneRequired => 'अभिभावक का मोबाइल नंबर लिखें।';

  @override
  String get attendanceParentPhoneInvalid =>
      '10 अंकों का भारतीय मोबाइल नंबर लिखें।';

  @override
  String get attendanceParentLanguageLabel => 'अभिभावक की भाषा';

  @override
  String get attendanceParentPhonePrivacy =>
      'यह नंबर SahayakAI को भेजा जाता है ताकि आपके लिए इस अभिभावक को कॉल की जा सके। इसे कभी इस फ़ोन पर वापस डाउनलोड नहीं किया जाता।';

  @override
  String get attendanceStudentAdded => 'विद्यार्थी जुड़ गया।';

  @override
  String get attendanceAddStudentFailed => 'हम इस विद्यार्थी को नहीं जोड़ सके।';

  @override
  String get attendanceClassFullTitle => 'यह कक्षा भर चुकी है';

  @override
  String attendanceClassFullBody(int max) {
    return 'एक कक्षा में अधिकतम $max विद्यार्थी हो सकते हैं, इसलिए और नहीं जोड़े जा सकते।';
  }

  @override
  String get attendanceMarkEyebrow => 'दैनिक रजिस्टर';

  @override
  String get attendanceMarkIntro =>
      'आज, या उससे पहले के सात दिनों में से कोई भी दिन भरें।';

  @override
  String get attendanceDateToday => 'आज';

  @override
  String get attendanceDateYesterday => 'कल';

  @override
  String get attendanceWindowNote =>
      'रजिस्टर आज और उससे पहले के सात दिनों के लिए खुला रहता है। उससे पुराने दिन बंद हो जाते हैं।';

  @override
  String get attendanceStatusPresent => 'उपस्थित';

  @override
  String get attendanceStatusAbsent => 'अनुपस्थित';

  @override
  String get attendanceStatusLate => 'देर से';

  @override
  String get attendanceStatusUnmarked => 'दर्ज नहीं';

  @override
  String attendanceMarkProgress(int marked, int total) {
    return '$total में से $marked दर्ज';
  }

  @override
  String get attendanceMarkAllPresent => 'सभी को उपस्थित करें';

  @override
  String get attendanceSaveRegister => 'रजिस्टर सहेजें';

  @override
  String get attendanceRegisterSaved => 'रजिस्टर सहेजा गया।';

  @override
  String get attendanceSaveRegisterFailed => 'हम यह रजिस्टर सहेज नहीं सके।';

  @override
  String get attendanceRegisterError => 'हम यह रजिस्टर नहीं ला सके।';

  @override
  String get attendanceNoStudentsTitle =>
      'इस कक्षा में अभी कोई विद्यार्थी नहीं';

  @override
  String get attendanceNoStudentsBody =>
      'रजिस्टर भरने से पहले विद्यार्थी जोड़ें।';

  @override
  String get attendanceMonthEyebrow => 'महीने की उपस्थिति';

  @override
  String get attendanceMonthError => 'हम इस महीने का विवरण नहीं ला सके।';

  @override
  String get attendanceMonthEmptyTitle => 'इस महीने कुछ दर्ज नहीं हुआ';

  @override
  String get attendanceMonthEmptyBody =>
      'रजिस्टर भरना शुरू करते ही हर विद्यार्थी का महीना यहाँ दिखेगा।';

  @override
  String get attendanceMonthPrevious => 'पिछला महीना';

  @override
  String get attendanceMonthNext => 'अगला महीना';

  @override
  String get attendanceAbsencesTitle => 'अनुपस्थित दिन';

  @override
  String get attendanceAbsencesEmpty => 'इस महीने कोई अनुपस्थिति नहीं।';

  @override
  String get attendanceAbsencesError => 'हम अनुपस्थित दिन नहीं ला सके।';

  @override
  String get attendancePremiumTitle => 'रजिस्टर भरने के लिए Pro प्लान चाहिए';

  @override
  String get attendancePremiumBody =>
      'अपनी कक्षाएँ, रजिस्टर और महीने का विवरण देखना मुफ़्त रहता है। कक्षा बनाना, विद्यार्थी जोड़ना और रजिस्टर सहेजना Pro प्लान का हिस्सा है।';

  @override
  String get deliverTrayTitle => 'पहुँचाएँ';

  @override
  String get deliverPrivacyNote =>
      'जब तक आप भेजें न दबाएँ, कुछ भी फ़ोन से बाहर नहीं जाता।';

  @override
  String get deliverSend => 'भेजें';

  @override
  String get deliverParentGroup => 'अभिभावक समूह';

  @override
  String get deliverParentGroupMeta => 'WhatsApp पर साझा करें';

  @override
  String get deliverPrint => 'प्रिंट करें';

  @override
  String get deliverPrintMeta => 'प्रिंटर पर भेजें';

  @override
  String get deliverSaveToClass => 'कक्षा में सहेजें';

  @override
  String get deliverSaveToClassMeta => 'अपनी लाइब्रेरी में रखें';

  @override
  String get deliverPostCommunity => 'समुदाय में पोस्ट करें';

  @override
  String get deliverPostCommunityMeta => 'संसाधन के रूप में साझा करें';

  @override
  String get deliverDownloadPdf => 'PDF डाउनलोड करें';

  @override
  String get deliverDownloadPdfMeta => 'ऑफ़लाइन काम करता है';

  @override
  String get deliverReadAloud => 'ज़ोर से पढ़ें';

  @override
  String get deliverReadAloudMeta => 'कक्षा के लिए';

  @override
  String get settingsOrbHandTitle => 'तैरता सहायक';

  @override
  String get settingsOrbHandLabel => 'बाएँ हाथ की ओर';

  @override
  String get settingsOrbHandHint => 'जहाँ आपका अंगूठा पहुँचे वहाँ VIDYA रखें';

  @override
  String get scanRemedialBody =>
      'जिन अवधारणाओं में कठिनाई हुई, उनके लिए मैं एक अभ्यास पत्रक बना सकती हूँ।';

  @override
  String get scanRemedialBuild => 'अभ्यास पत्रक बनाएँ';

  @override
  String get scanRemedialMessageParents => 'अभिभावकों को संदेश भेजें';

  @override
  String get communityFilterAll => 'सभी';

  @override
  String get communityFilterPosts => 'पोस्ट';

  @override
  String get communityFilterResources => 'संसाधन';

  @override
  String get communityFilterHighlights => 'मुख्य अंश';

  @override
  String get attendanceVoiceRollCall => 'नाम ज़ोर से पढ़ें';

  @override
  String get attendanceVoiceListeningTitle => 'सुन रही हूँ…';

  @override
  String get attendanceVoiceListeningBody =>
      'अपनी कक्षा की हाज़िरी ज़ोर से पढ़ें। मैं हर नाम को उपस्थित लगाऊँगी; किसी को बदलने के लिए \'अनुपस्थित\' या \'देर\' कहें।';

  @override
  String get attendanceVoiceWorking => 'एक पल…';

  @override
  String get attendanceVoiceWorkingBody =>
      'आपने जो कहा उससे हाज़िरी लगा रही हूँ।';

  @override
  String get attendanceVoiceMicOffTitle => 'माइक्रोफ़ोन चाहिए';

  @override
  String get attendanceVoiceMicOffBody =>
      'आवाज़ से हाज़िरी लेने के लिए माइक्रोफ़ोन की अनुमति दें।';

  @override
  String get attendanceVoiceFailedTitle => 'समझ नहीं पाई';

  @override
  String get attendanceVoiceFailedBody =>
      'कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।';

  @override
  String get attendanceVoiceNone =>
      'मुझे कोई नाम समझ नहीं आया। फिर से कोशिश करें।';

  @override
  String attendanceVoiceMarked(int count) {
    return '$count नाम लगाए गए।';
  }
}
