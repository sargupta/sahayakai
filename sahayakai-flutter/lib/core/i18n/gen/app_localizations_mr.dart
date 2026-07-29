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
  String get splashFailedTitle => 'We could not start the app';

  @override
  String get splashFailedBody => 'Please check your connection and try again.';

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
    return 'Welcome back, $name';
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
  String get readAloudListen => 'Listen';

  @override
  String get readAloudStop => 'Stop';

  @override
  String get readAloudError => 'Couldn\'t play the audio. Please try again.';

  @override
  String voiceResultReady(String tool) {
    return 'Your $tool is ready.';
  }

  @override
  String voiceResultReadyWithTopic(String tool, String topic) {
    return 'Your $tool on $topic is ready.';
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
  String get dashboardRecentTitle => 'Recent work';

  @override
  String get dashboardRecentEmpty =>
      'Anything you make is saved here, ready to open again.';

  @override
  String get dashboardRecentFailed =>
      'We could not open your recent work. Please try again.';

  @override
  String get dashboardRecentSignedOut => 'Sign in to see your recent work.';

  @override
  String get dashboardUntitled => 'Untitled';

  @override
  String get dashboardSetupTitle => 'Finish setting up your profile';

  @override
  String get dashboardSetupBody =>
      'Add your school and your classes, and every lesson plan and quiz will arrive ready for your classroom.';

  @override
  String get dashboardSetupAction => 'Set up my profile';

  @override
  String get dashboardSetupDismiss => 'Not now';

  @override
  String get contentTypeLessonPlan => 'Lesson plan';

  @override
  String get contentTypeQuiz => 'Quiz';

  @override
  String get contentTypeWorksheet => 'Worksheet';

  @override
  String get contentTypeVisualAid => 'Visual aid';

  @override
  String get contentTypeRubric => 'Rubric';

  @override
  String get contentTypeMicroLesson => 'Micro lesson';

  @override
  String get contentTypeVirtualFieldTrip => 'Virtual field trip';

  @override
  String get contentTypeInstantAnswer => 'Instant answer';

  @override
  String get contentTypeTeacherTraining => 'Teacher training';

  @override
  String get contentTypeExamPaper => 'Exam paper';

  @override
  String get contentTypeAssessment => 'Assessment';

  @override
  String get contentTypeAssessmentSubmission => 'Scanned assessment';

  @override
  String get contentTypeUnknown => 'Saved work';

  @override
  String get libraryTitle => 'माझे ग्रंथालय';

  @override
  String get librarySectionSaved => 'जतन केलेले काम';

  @override
  String get libraryEmpty =>
      'तुमच्या जतन केलेल्या पाठ योजना आणि प्रश्नमंजुषा येथे दिसतील.';

  @override
  String get libraryEmptyAction => 'Create a lesson plan';

  @override
  String get librarySignedOut => 'Sign in to see your saved work.';

  @override
  String get libraryLoadFailed => 'Your library could not be loaded.';

  @override
  String get libraryNewestOnly => 'Showing your 20 most recent items.';

  @override
  String get libraryFilterAll => 'All';

  @override
  String get libraryFilterEmpty => 'You have no saved items of this type yet.';

  @override
  String get libraryDetailTitle => 'Saved item';

  @override
  String libraryDetailSavedOn(String date) {
    return 'Saved $date';
  }

  @override
  String get libraryDetailSignedOut => 'Sign in to open your saved work.';

  @override
  String get libraryDetailNotFound => 'This item is no longer in your library.';

  @override
  String get libraryDetailLoadFailed =>
      'We could not open this saved item. Please try again.';

  @override
  String libraryDetailReady(String type) {
    return 'You are viewing your saved $type.';
  }

  @override
  String get profileTitle => 'प्रोफाइल';

  @override
  String get lessonPlanTitle => 'Lesson Plan';

  @override
  String get lessonPlanSubtitle => 'Plan a full 5E lesson';

  @override
  String get lessonPlanEmpty =>
      'Add a topic and tap Generate to build a 5E lesson plan.';

  @override
  String get lessonPlanTopicLabel => 'Topic';

  @override
  String get lessonPlanTopicHint => 'For example, Photosynthesis';

  @override
  String get lessonPlanTopicError => 'Please enter a topic to plan.';

  @override
  String get lessonPlanGradeLabel => 'Grade levels';

  @override
  String get lessonPlanSubjectLabel => 'Subject';

  @override
  String get lessonPlanSubjectAny => 'Any subject';

  @override
  String get lessonPlanResourceLabel => 'Classroom resources';

  @override
  String get lessonPlanResourceLow => 'Low';

  @override
  String get lessonPlanResourceMedium => 'Medium';

  @override
  String get lessonPlanResourceHigh => 'High';

  @override
  String get lessonPlanDifficultyLabel => 'Difficulty';

  @override
  String get lessonPlanDifficultyRemedial => 'Remedial';

  @override
  String get lessonPlanDifficultyStandard => 'Standard';

  @override
  String get lessonPlanDifficultyAdvanced => 'Advanced';

  @override
  String get lessonPlanRuralLabel => 'Use local, everyday examples';

  @override
  String get lessonPlanRuralHint =>
      'Root activities in familiar rural and community settings.';

  @override
  String get lessonPlanOptional => 'Optional';

  @override
  String get lessonPlanObjectives => 'Learning objectives';

  @override
  String get lessonPlanVocabulary => 'Key vocabulary';

  @override
  String get lessonPlanMaterials => 'Materials';

  @override
  String get lessonPlanActivities => '5E activities';

  @override
  String get lessonPlanAssessment => 'Assessment';

  @override
  String get lessonPlanHomework => 'Homework';

  @override
  String get lessonPlanTeacherTip => 'Teacher tip';

  @override
  String get lessonPlanUnderstandingCheck => 'Check for understanding';

  @override
  String get lessonPlanNoteLabel => 'A note before you begin';

  @override
  String get lessonPlanUpgradeTitle => 'A higher plan is needed';

  @override
  String get lessonPlanUpgradeBody =>
      'Lesson planning is part of a higher plan. Please upgrade to keep generating plans.';

  @override
  String get lessonPlanLimitTitle => 'You have reached your limit';

  @override
  String get lessonPlanLimitBody =>
      'You have used your lesson plans for now. Please try again later or upgrade your plan.';

  @override
  String get lessonPlanSeePricing => 'See plans and pricing';

  @override
  String get lessonPlanRephrase =>
      'We could not build a plan from that. Please rephrase the topic and try again.';

  @override
  String get lessonPlanBusy =>
      'The assistant is busy right now. Please try again in a moment.';

  @override
  String get lessonPlanTimeout =>
      'This is taking longer than expected. Please try again.';

  @override
  String get lessonPlanSignIn => 'Please sign in again to use this tool.';

  @override
  String get quizTitle => 'Quiz';

  @override
  String get quizSubtitle => 'Build a quiz in three difficulty levels';

  @override
  String get quizEmpty => 'Add a topic and tap Generate to build a quiz.';

  @override
  String get quizTopicLabel => 'Topic';

  @override
  String get quizTopicHint => 'For example, Fractions';

  @override
  String get quizTopicError => 'Please enter a topic for the quiz.';

  @override
  String get quizNumQuestionsLabel => 'Number of questions';

  @override
  String get quizFewerQuestions => 'Fewer questions';

  @override
  String get quizMoreQuestions => 'More questions';

  @override
  String get quizTypesLabel => 'Question types';

  @override
  String get quizTypesError => 'Please choose at least one question type.';

  @override
  String get quizTypeMultipleChoice => 'Multiple choice';

  @override
  String get quizTypeFillInTheBlanks => 'Fill in the blanks';

  @override
  String get quizTypeShortAnswer => 'Short answer';

  @override
  String get quizTypeTrueFalse => 'True or false';

  @override
  String get quizGradeLabel => 'Grade level';

  @override
  String get quizGradeAny => 'Any grade';

  @override
  String get quizSubjectLabel => 'Subject';

  @override
  String get quizSubjectAny => 'Any subject';

  @override
  String get quizDifficultyLabel => 'Difficulty';

  @override
  String get quizDifficultyHint =>
      'Leave this on all levels to get an easy, a medium and a hard version.';

  @override
  String get quizDifficultyAll => 'All levels';

  @override
  String get quizDifficultyEasy => 'Easy';

  @override
  String get quizDifficultyMedium => 'Medium';

  @override
  String get quizDifficultyHard => 'Hard';

  @override
  String get quizBloomsLabel => 'Thinking skills';

  @override
  String get quizBloomsHint =>
      'Choose the kinds of thinking the questions should ask for.';

  @override
  String get quizOptional => 'Optional';

  @override
  String quizQuestionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count questions',
      one: '1 question',
    );
    return '$_temp0';
  }

  @override
  String get quizShowAnswer => 'Show answer';

  @override
  String get quizHideAnswer => 'Hide answer';

  @override
  String get quizShowAllAnswers => 'Show all answers';

  @override
  String get quizHideAllAnswers => 'Hide all answers';

  @override
  String get quizCorrectAnswer => 'Correct answer';

  @override
  String get quizExplanation => 'Why';

  @override
  String get quizTeacherInstructions => 'How to run this in class';

  @override
  String get quizNoteLabel => 'A note before you begin';

  @override
  String get quizNoQuestions =>
      'No questions came back for that topic. Please try a different topic.';

  @override
  String get quizUpgradeTitle => 'A higher plan is needed';

  @override
  String get quizUpgradeBody =>
      'Quiz generation is part of a higher plan. Please upgrade to keep building quizzes.';

  @override
  String get quizLimitTitle => 'You have reached your limit';

  @override
  String get quizLimitBody =>
      'You have used your quizzes for now. Please try again later or upgrade your plan.';

  @override
  String get quizSeePricing => 'See plans and pricing';

  @override
  String get quizRephrase =>
      'We could not build a quiz from that. Please rephrase the topic and try again.';

  @override
  String get quizBusy =>
      'The assistant is busy right now. Please try again in a moment.';

  @override
  String get quizTimeout =>
      'This is taking longer than expected. Please try again.';

  @override
  String get quizSignIn => 'Please sign in again to use this tool.';

  @override
  String get instantAnswerTitle => 'Instant Answer';

  @override
  String get instantAnswerSubtitle => 'Ask any classroom question';

  @override
  String get instantAnswerAction => 'Get answer';

  @override
  String get instantAnswerEmpty => 'Ask a question and tap Get answer.';

  @override
  String get instantAnswerQuestionLabel => 'Your question';

  @override
  String get instantAnswerQuestionHint =>
      'For example, Why does the moon change shape?';

  @override
  String get instantAnswerQuestionError => 'Please enter a question.';

  @override
  String get instantAnswerGradeLabel => 'Grade level';

  @override
  String get instantAnswerGradeAny => 'Any grade';

  @override
  String get instantAnswerSubjectLabel => 'Subject';

  @override
  String get instantAnswerSubjectAny => 'Any subject';

  @override
  String get instantAnswerOptional => 'Optional';

  @override
  String get instantAnswerVideoTitle => 'Watch a related video';

  @override
  String get instantAnswerVideoBody =>
      'Opens in your browser, outside the app.';

  @override
  String get instantAnswerNoAnswer =>
      'No answer came back for that question. Please rephrase it and try again.';

  @override
  String get instantAnswerSeePricing => 'See plans and pricing';

  @override
  String get instantAnswerDailyLimitTitle =>
      'That is all your questions for today';

  @override
  String get instantAnswerDailyLimitBody =>
      'Your plan includes a set number of instant answers each day. Your questions reset tomorrow, or you can raise the daily limit on a higher plan.';

  @override
  String get instantAnswerLimitTitle => 'You have reached your limit';

  @override
  String get instantAnswerLimitBody =>
      'You have used your instant answers for this month. Your questions reset next month, or you can raise the limit on a higher plan.';

  @override
  String get instantAnswerUpgradeTitle => 'A higher plan is needed';

  @override
  String get instantAnswerUpgradeBody =>
      'Instant answers are part of a higher plan. Please upgrade to keep asking questions.';

  @override
  String get instantAnswerRephrase =>
      'We could not answer that. Please rephrase the question and try again.';

  @override
  String get instantAnswerBusy =>
      'The assistant is busy right now. Please try again in a moment.';

  @override
  String instantAnswerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'The assistant is busy right now. Please try again in about $seconds seconds.',
      one:
          'The assistant is busy right now. Please try again in about 1 second.',
    );
    return '$_temp0';
  }

  @override
  String get instantAnswerTimeout =>
      'This is taking longer than expected. Please try again.';

  @override
  String get instantAnswerSignIn => 'Please sign in again to use this tool.';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get settingsAppearanceTitle => 'Appearance';

  @override
  String get settingsThemeSystem => 'Match my device';

  @override
  String get settingsThemeLight => 'Light';

  @override
  String get settingsThemeDark => 'Dark';

  @override
  String get settingsLanguageHint =>
      'Sets the app language and the language your teaching material is written in.';

  @override
  String get settingsNotificationsTitle => 'Notifications';

  @override
  String get settingsNotificationsLabel => 'Reminders and updates';

  @override
  String get settingsNotificationsHint =>
      'Hear about new teaching tools and your saved work.';

  @override
  String get settingsProfileTitle => 'Teaching profile';

  @override
  String get settingsProfileHint =>
      'This helps us match your material to your board and classroom.';

  @override
  String get settingsBoardLabel => 'शिक्षण मंडळ';

  @override
  String get settingsBoardNone => 'सेट केलेले नाही';

  @override
  String get settingsQualificationsLabel => 'Qualifications';

  @override
  String get settingsQualificationsHint =>
      'Choose every qualification you hold.';

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
  String get settingsSaveProfile => 'Save profile';

  @override
  String get settingsProfileSaved => 'Your teaching profile has been saved.';

  @override
  String get settingsSaveFailed =>
      'We could not save your profile. Please try again.';

  @override
  String get settingsSignedOutTitle => 'You are signed out';

  @override
  String get settingsSignedOutBody =>
      'Sign in to manage your teaching profile and your account. Your language and appearance choices are saved on this device either way.';

  @override
  String get settingsSignIn => 'Sign in';

  @override
  String get settingsDangerTitle => 'Delete account';

  @override
  String get settingsDangerBody =>
      'This closes your account and removes your saved work. You will have 30 days to export everything before it is deleted for good.';

  @override
  String get settingsDeleteAction => 'Delete account';

  @override
  String get settingsDeleteDialogTitle => 'Delete your account?';

  @override
  String get settingsDeleteDialogBody =>
      'Your lesson plans, quizzes and profile will be scheduled for deletion. You have 30 days to export your work before it is removed.';

  @override
  String settingsDeleteConfirmPrompt(String word) {
    return 'Type $word below to confirm.';
  }

  @override
  String get settingsDeleteConfirmLabel => 'Confirmation';

  @override
  String get settingsDeleteCancel => 'Keep my account';

  @override
  String get settingsDeleteConfirm => 'Delete account';

  @override
  String get settingsDeleteScheduled =>
      'Your account is scheduled for deletion. You have 30 days to export your work.';

  @override
  String get settingsDeleteSuccessTitle => 'Account scheduled for deletion';

  @override
  String get settingsExportDataAction => 'Export my data';

  @override
  String get settingsExportQueuedMessage =>
      'Your export is too large to prepare right away, so we\'ve queued it instead. Please try again later, or contact support for a copy of your data.';

  @override
  String get settingsExportFailedMessage =>
      'Couldn\'t prepare your export. Please try again.';

  @override
  String get settingsDeleteSuccessDone => 'Done';

  @override
  String get settingsDeleteFailed =>
      'We could not delete your account. Please try again.';

  @override
  String get settingsReauthTitle => 'Please sign in again';

  @override
  String get settingsReauthBody =>
      'For your security, deleting an account needs a fresh sign-in. Please sign out, sign in again, and delete within five minutes.';

  @override
  String get profilePlanLabel => 'Plan';

  @override
  String get profilePlanFree => 'Free';

  @override
  String get profilePlanPro => 'Pro';

  @override
  String get profilePlanGold => 'Gold';

  @override
  String get profilePlanPremium => 'Premium';

  @override
  String get profilePlanUnknown => 'Not available';

  @override
  String get profileNoName => 'Your profile';

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
      'This is the name other teachers see on work you share.';

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
      'This is the same language choice as the rest of the app, so changing it here changes it everywhere.';

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
  String get profileEmptyTitle => 'Your profile is empty';

  @override
  String get profileEmptyBody =>
      'Add your school and your classes, and every lesson plan and quiz you make will arrive ready for your classroom.';

  @override
  String get profileLoadFailed =>
      'We could not open your profile. Please try again.';

  @override
  String get profileSignedOutTitle => 'You are signed out';

  @override
  String get profileSignedOutBody =>
      'Sign in to see and edit your teaching profile.';

  @override
  String get profileSaveSignIn => 'Please sign in again to save your profile.';

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
  String get imageInputHint => 'Add a clear photo of the textbook page.';

  @override
  String get imageInputTakePhoto => 'Take photo';

  @override
  String get imageInputChooseGallery => 'Choose from gallery';

  @override
  String get imageInputRetake => 'Retake photo';

  @override
  String get imageInputChangeGallery => 'Choose another';

  @override
  String get imageInputRemove => 'Remove photo';

  @override
  String get imageInputPreviewLabel => 'Chosen image preview';

  @override
  String imageInputSizeOfMax(String used, String max) {
    return '$used of $max';
  }

  @override
  String imageInputTooLarge(String max) {
    return 'This photo is too large. Please choose one under $max.';
  }

  @override
  String get imageInputPermissionDenied =>
      'SahayakAI needs permission to use your camera or photos. Please allow access in your device settings.';

  @override
  String get imageInputFailed =>
      'We could not open that image. Please try again.';

  @override
  String get worksheetTitle => 'Worksheet';

  @override
  String get worksheetSubtitle => 'Build a worksheet from a textbook photo';

  @override
  String get worksheetEmpty =>
      'Add a textbook photo and a prompt, then tap Generate.';

  @override
  String get worksheetImageLabel => 'Textbook page photo';

  @override
  String get worksheetImageHint => 'The worksheet is built from this page.';

  @override
  String get toolImageOptionalLabel => 'Textbook page photo (optional)';

  @override
  String get toolImageOptionalHint =>
      'Add a page photo and it becomes the main source, or leave blank.';

  @override
  String get worksheetImageError => 'Please add a photo of the textbook page.';

  @override
  String get worksheetPromptLabel => 'What worksheet do you need?';

  @override
  String get worksheetPromptHint =>
      'For example, Make a multiplication worksheet from this page';

  @override
  String get worksheetPromptError => 'Please describe the worksheet you need.';

  @override
  String get worksheetGradeLabel => 'Grade level';

  @override
  String get worksheetGradeAny => 'Any grade';

  @override
  String get worksheetSubjectLabel => 'Subject';

  @override
  String get worksheetSubjectAny => 'Any subject';

  @override
  String get worksheetOptional => 'Optional';

  @override
  String get worksheetObjectives => 'Learning objectives';

  @override
  String get worksheetInstructions => 'Instructions for students';

  @override
  String get worksheetActivities => 'Activities';

  @override
  String get worksheetActivityQuestion => 'Question';

  @override
  String get worksheetActivityPuzzle => 'Puzzle';

  @override
  String get worksheetActivityCreativeTask => 'Creative task';

  @override
  String get worksheetExplanation => 'For the teacher';

  @override
  String get worksheetChalkboardNote => 'On the blackboard';

  @override
  String get worksheetAnswerKey => 'Answer key';

  @override
  String get worksheetNoContent =>
      'No worksheet came back for that page. Please try a clearer photo or a different prompt.';

  @override
  String get worksheetSave => 'Save to Library';

  @override
  String get worksheetSaving => 'Saving';

  @override
  String get worksheetSaved => 'Saved to your Library';

  @override
  String get worksheetSaveFailedTitle => 'Could not save';

  @override
  String get worksheetSaveFailedBody =>
      'We could not save this worksheet to your library. Please try again.';

  @override
  String get worksheetSaveRetry => 'Try saving again';

  @override
  String get worksheetUpgradeTitle => 'A higher plan is needed';

  @override
  String get worksheetUpgradeBody =>
      'Worksheet generation is part of a higher plan. Please upgrade to keep building worksheets.';

  @override
  String get worksheetLimitTitle => 'You have reached your limit';

  @override
  String get worksheetLimitBody =>
      'You have used your worksheets for now. Please try again later or upgrade your plan.';

  @override
  String get worksheetSeePricing => 'See plans and pricing';

  @override
  String get worksheetRephrase =>
      'We could not build a worksheet from that. Please try a clearer photo or rephrase your prompt.';

  @override
  String get worksheetBusy =>
      'The assistant is busy right now. Please try again in a moment.';

  @override
  String get worksheetTimeout =>
      'This is taking longer than expected. Please try again.';

  @override
  String get worksheetSignIn => 'Please sign in again to use this tool.';

  @override
  String get rubricTitle => 'Rubric';

  @override
  String get rubricSubtitle => 'Build a grading rubric for an assignment';

  @override
  String get rubricEmpty => 'Describe the assignment, then tap Generate.';

  @override
  String get rubricAssignmentLabel => 'What is the assignment?';

  @override
  String get rubricAssignmentHint => 'The rubric grades this assignment.';

  @override
  String get rubricAssignmentPlaceholder =>
      'For example, A Class 5 project on renewable energy';

  @override
  String get rubricAssignmentError => 'Please describe the assignment.';

  @override
  String get rubricGradeLabel => 'Grade level';

  @override
  String get rubricGradeAny => 'Any grade';

  @override
  String get rubricSubjectLabel => 'Subject';

  @override
  String get rubricSubjectAny => 'Any subject';

  @override
  String get rubricOptional => 'Optional';

  @override
  String get rubricCriteriaColumn => 'Criteria';

  @override
  String rubricPoints(String points) {
    return '$points pts';
  }

  @override
  String get rubricScrollHint => 'Swipe across to see all levels.';

  @override
  String get rubricNoContent =>
      'No rubric came back for that. Please try a clearer assignment description.';

  @override
  String get rubricUpgradeTitle => 'A higher plan is needed';

  @override
  String get rubricUpgradeBody =>
      'Rubric generation is part of a higher plan. Please upgrade to keep building rubrics.';

  @override
  String get rubricLimitTitle => 'You have reached your limit';

  @override
  String get rubricLimitBody =>
      'You have used your rubrics for now. Please try again later or upgrade your plan.';

  @override
  String get rubricRephrase =>
      'We could not build a rubric from that. Please rephrase the assignment and try again.';

  @override
  String get rubricBusy =>
      'The assistant is busy right now. Please try again in a moment.';

  @override
  String get rubricTimeout =>
      'This is taking longer than expected. Please try again.';

  @override
  String get rubricSignIn => 'Please sign in again to use this tool.';

  @override
  String get examPaperTitle => 'Exam Paper';

  @override
  String get examPaperSubtitle =>
      'Build a board-pattern exam paper with answer key';

  @override
  String get examPaperEmpty =>
      'Choose a board, grade and subject, then tap Generate.';

  @override
  String get examPaperBoardLabel => 'Board';

  @override
  String get examPaperBoardHint => 'Select a board';

  @override
  String get examPaperBoardError => 'Please choose a board.';

  @override
  String get examPaperGradeLabel => 'Grade level';

  @override
  String get examPaperGradeHint => 'Select a grade';

  @override
  String get examPaperGradeError => 'Please choose a grade level.';

  @override
  String get examPaperSubjectLabel => 'Subject';

  @override
  String get examPaperSubjectHint => 'Select a subject';

  @override
  String get examPaperSubjectError => 'Please choose a subject.';

  @override
  String get examPaperSubjectOther => 'Other subject';

  @override
  String get examPaperSubjectOtherLabel => 'Subject name';

  @override
  String get examPaperSubjectOtherHint => 'For example, Economics';

  @override
  String get examPaperSubjectOtherError => 'Please enter a subject.';

  @override
  String get examPaperChaptersLabel => 'Chapters';

  @override
  String get examPaperChaptersHint =>
      'Add the chapters to cover. Leave empty for the full syllabus where an official blueprint exists.';

  @override
  String get examPaperChaptersPlaceholder => 'For example, Quadratic Equations';

  @override
  String get examPaperChaptersAdd => 'Add chapter';

  @override
  String get examPaperChaptersError =>
      'Please add at least one chapter for this board, grade and subject.';

  @override
  String get examPaperDifficultyLabel => 'Difficulty';

  @override
  String get examPaperDifficultyEasy => 'Easy';

  @override
  String get examPaperDifficultyModerate => 'Moderate';

  @override
  String get examPaperDifficultyHard => 'Hard';

  @override
  String get examPaperDifficultyMixed => 'Mixed';

  @override
  String get examPaperIncludeAnswerKey => 'Include answer key';

  @override
  String get examPaperIncludeMarkingScheme => 'Include marking scheme';

  @override
  String get examPaperInProgressTitle => 'Your paper is being prepared';

  @override
  String get examPaperInProgressBody =>
      'A full board paper takes a little longer to build. We are finishing it now and it will be saved for you.';

  @override
  String get examPaperInProgressLibraryHint =>
      'Open the Library tab in a minute to find your finished paper.';

  @override
  String examPaperMaxMarks(String marks) {
    return 'Max marks $marks';
  }

  @override
  String examPaperMarks(String marks) {
    return '$marks marks';
  }

  @override
  String examPaperSectionMarks(String marks) {
    return '$marks marks';
  }

  @override
  String examPaperPercent(String value) {
    return '$value percent';
  }

  @override
  String get examPaperGeneralInstructions => 'General instructions';

  @override
  String get examPaperInternalChoice => 'Or attempt';

  @override
  String get examPaperAnswerKey => 'Answer';

  @override
  String get examPaperMarkingScheme => 'Marking scheme';

  @override
  String get examPaperBlueprintTitle => 'Blueprint summary';

  @override
  String get examPaperBlueprintChapters => 'Marks by chapter';

  @override
  String get examPaperBlueprintDifficulty => 'Difficulty split';

  @override
  String get examPaperPyqTitle => 'Previous-year questions';

  @override
  String examPaperPyqChapterYear(String chapter, int year) {
    return '$chapter ($year)';
  }

  @override
  String examPaperPyqYear(int year) {
    return 'Year $year';
  }

  @override
  String get examPaperNoContent =>
      'No exam paper came back for that. Please try fewer chapters or a different subject.';

  @override
  String get examPaperSave => 'Save to Library';

  @override
  String get examPaperSaving => 'Saving';

  @override
  String get examPaperSaved => 'Saved to your Library';

  @override
  String get examPaperSaveFailedTitle => 'Could not save';

  @override
  String get examPaperSaveFailedBody =>
      'We could not save this paper to your library. Please try again.';

  @override
  String get examPaperSaveRetry => 'Try saving again';

  @override
  String get examPaperUnstructuredTitle => 'We could not structure that paper';

  @override
  String get examPaperUnstructuredBody =>
      'The assistant could not lay this out as a full paper. Please remove a few chapters and generate again.';

  @override
  String get examPaperUpgradeTitle => 'A higher plan is needed';

  @override
  String get examPaperUpgradeBody =>
      'Exam paper generation is part of a higher plan. Please upgrade to keep building papers.';

  @override
  String get examPaperLimitTitle => 'You have reached your limit';

  @override
  String get examPaperLimitBody =>
      'You have used your exam papers for now. Please try again later or upgrade your plan.';

  @override
  String get examPaperRephrase =>
      'We could not build a paper from that. Please adjust the chapters and try again.';

  @override
  String get examPaperBusy =>
      'The assistant is busy right now. Please try again in a moment.';

  @override
  String get examPaperTimeout =>
      'This is taking longer than expected. Please try again.';

  @override
  String get examPaperSignIn => 'Please sign in again to use this tool.';

  @override
  String get teacherTrainingTitle => 'Teaching Coach';

  @override
  String get teacherTrainingSubtitle =>
      'Advice and strategy for a teaching question';

  @override
  String get teacherTrainingAction => 'Get advice';

  @override
  String get teacherTrainingEmpty =>
      'Ask a teaching question to get strategies grounded in pedagogy.';

  @override
  String get teacherTrainingQuestionLabel => 'Your question';

  @override
  String get teacherTrainingQuestionHint =>
      'Ask about lesson design, classroom practice or assessment.';

  @override
  String get teacherTrainingQuestionPlaceholder =>
      'For example, How can I keep a class of 40 engaged through a full lesson?';

  @override
  String get teacherTrainingQuestionError => 'Please enter a question.';

  @override
  String get teacherTrainingSubjectLabel => 'Subject';

  @override
  String get teacherTrainingSubjectAny => 'Any subject';

  @override
  String get teacherTrainingOptional => 'Optional';

  @override
  String get teacherTrainingStrategiesTitle => 'Strategies';

  @override
  String get teacherTrainingSectionQuestion => 'प्रश्न';

  @override
  String get teacherTrainingResultTitle => 'मार्गदर्शन टिपा';

  @override
  String get teacherTrainingNoContent =>
      'No advice came back for that. Please try a clearer question.';

  @override
  String get teacherTrainingUpgradeTitle => 'A higher plan is needed';

  @override
  String get teacherTrainingUpgradeBody =>
      'The Teaching Coach is part of a higher plan. Please upgrade to keep asking.';

  @override
  String get teacherTrainingLimitTitle => 'You have reached your limit';

  @override
  String get teacherTrainingLimitBody =>
      'You have used the Teaching Coach for now. Please try again later or upgrade your plan.';

  @override
  String get teacherTrainingSeePricing => 'See plans and pricing';

  @override
  String get teacherTrainingRephrase =>
      'We could not build advice from that. Please rephrase the question and try again.';

  @override
  String get teacherTrainingBusy =>
      'The assistant is busy right now. Please try again in a moment.';

  @override
  String teacherTrainingBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'The assistant is busy right now. Please try again in about $seconds seconds.',
      one:
          'The assistant is busy right now. Please try again in about 1 second.',
    );
    return '$_temp0';
  }

  @override
  String get teacherTrainingTimeout =>
      'This is taking longer than expected. Please try again.';

  @override
  String get teacherTrainingSignIn => 'Please sign in again to use this tool.';

  @override
  String get parentMessageTitle => 'Parent Message';

  @override
  String get parentMessageSubtitle =>
      'Draft a message home in the parent\'s language';

  @override
  String get parentMessageAction => 'Draft message';

  @override
  String get parentMessageEmpty =>
      'Share the student and reason, and a caring message home will be drafted in the parent\'s language.';

  @override
  String get parentMessageStudentLabel => 'Student name';

  @override
  String get parentMessageStudentPlaceholder =>
      'The student the message is about';

  @override
  String get parentMessageStudentError => 'Please enter the student\'s name.';

  @override
  String get parentMessageClassLabel => 'Class';

  @override
  String get parentMessageClassPlaceholder => 'For example, Class 6A';

  @override
  String get parentMessageClassError => 'Please enter the class.';

  @override
  String get parentMessageSubjectLabel => 'Subject';

  @override
  String get parentMessageSubjectHint => 'Choose a subject';

  @override
  String get parentMessageSubjectError => 'Please choose a subject.';

  @override
  String get parentMessageReasonLabel => 'Reason for the message';

  @override
  String get parentMessageReasonHint => 'Choose a reason';

  @override
  String get parentMessageReasonError => 'Please choose a reason.';

  @override
  String get parentMessageReasonAbsences => 'Repeated absences';

  @override
  String get parentMessageReasonPerformance => 'Academic support';

  @override
  String get parentMessageReasonBehavior => 'Behaviour in class';

  @override
  String get parentMessageReasonPositive => 'Good news to share';

  @override
  String get parentMessageAbsentDaysLabel => 'Days absent';

  @override
  String get parentMessageAbsentDaysHint =>
      'How many days in a row the student has been away.';

  @override
  String get parentMessageAbsentDaysPlaceholder => 'For example, 3';

  @override
  String get parentMessageParentLanguageLabel => 'Parent\'s language';

  @override
  String get parentMessageParentLanguageHint =>
      'The message is written in this language, which can differ from the app\'s.';

  @override
  String get parentMessageParentLanguagePlaceholder =>
      'Choose the parent\'s language';

  @override
  String get parentMessageParentLanguageError =>
      'Please choose the parent\'s language.';

  @override
  String get parentMessageContextLabel => 'What is prompting this?';

  @override
  String get parentMessageContextHint =>
      'A short note on the situation helps shape the message.';

  @override
  String get parentMessageContextPlaceholder =>
      'For example, missed the last two weeks of fractions';

  @override
  String get parentMessageNoteLabel => 'Anything specific to mention?';

  @override
  String get parentMessageNoteHint =>
      'A detail here is woven into the message.';

  @override
  String get parentMessageNotePlaceholder =>
      'For example, doing well in group work';

  @override
  String get parentMessageTeacherNameLabel => 'Your name';

  @override
  String get parentMessageTeacherNameHint =>
      'Signs off the message. Left blank, your profile name is used.';

  @override
  String get parentMessageTeacherNamePlaceholder => 'For example, Mrs. Rao';

  @override
  String get parentMessageSchoolNameLabel => 'School name';

  @override
  String get parentMessageSchoolNamePlaceholder => 'Your school\'s name';

  @override
  String get parentMessageOptional => 'Optional';

  @override
  String parentMessageWordCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count words',
      one: '1 word',
    );
    return '$_temp0';
  }

  @override
  String get parentMessageCopy => 'Copy';

  @override
  String get parentMessageShare => 'Share';

  @override
  String get parentMessageCopied => 'Message copied';

  @override
  String get parentMessageSectionMessage => 'संदेश';

  @override
  String get parentMessageSectionDetails => 'अतिरिक्त तपशील';

  @override
  String get parentMessageResultTitle => 'पालकांसाठी संदेश';

  @override
  String get parentMessageNoContent =>
      'No message came back for that. Please add a little more context and try again.';

  @override
  String get parentMessageMissingFields =>
      'Please fill in the student, class, subject, reason and parent\'s language, then try again.';

  @override
  String get parentMessageUpgradeTitle => 'A higher plan is needed';

  @override
  String get parentMessageUpgradeBody =>
      'Parent messages are part of a higher plan. Please upgrade to keep drafting them.';

  @override
  String get parentMessageLimitTitle => 'You have reached your limit';

  @override
  String get parentMessageLimitBody =>
      'You have drafted your parent messages for now. Please try again later or upgrade your plan.';

  @override
  String get parentMessageSeePricing => 'See plans and pricing';

  @override
  String get parentMessageBusy =>
      'The assistant is busy right now. Please try again in a moment.';

  @override
  String parentMessageBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'The assistant is busy right now. Please try again in about $seconds seconds.',
      one:
          'The assistant is busy right now. Please try again in about 1 second.',
    );
    return '$_temp0';
  }

  @override
  String get parentMessageTimeout =>
      'This is taking longer than expected. Please try again.';

  @override
  String get parentMessageSignIn => 'Please sign in again to use this tool.';

  @override
  String get assessTitle => 'Assess Assignment';

  @override
  String get assessSubtitle =>
      'Grade a student\'s handwritten work from a photo';

  @override
  String get assessEmpty =>
      'Add a photo of the student\'s work, then tap Assess.';

  @override
  String get assessSubmit => 'Assess';

  @override
  String get assessImageLabel => 'Student work photo';

  @override
  String get assessImageHint => 'Take a clear photo of the whole page.';

  @override
  String get assessImageError => 'Please add a photo of the student\'s work.';

  @override
  String get assessModeLabel => 'What do you need?';

  @override
  String get assessModeHint =>
      'Grade reads and scores the work. Read only returns the transcript. Score a transcript grades text you paste in.';

  @override
  String get assessModeFull => 'Grade';

  @override
  String get assessModeTranscribe => 'Read only';

  @override
  String get assessModeScore => 'Score a transcript';

  @override
  String get assessTranscriptLabel => 'Corrected transcript';

  @override
  String get assessTranscriptHint =>
      'Paste the corrected text to grade instead of re-reading the photo.';

  @override
  String get assessTranscriptPlaceholder =>
      'Type or paste the student\'s corrected answers';

  @override
  String get assessOptional => 'Optional';

  @override
  String get assessRubricNote =>
      'Without a rubric, the work is graded on a general rubric: understanding, accuracy, presentation and completion.';

  @override
  String get assessPrivacyNote =>
      'The student\'s name is never sent for grading.';

  @override
  String get assessScoreLabel => 'Overall score';

  @override
  String get assessScoreOutOf => 'out of 100';

  @override
  String assessPoints(String earned, String possible) {
    return '$earned of $possible points';
  }

  @override
  String assessConfidence(String percent) {
    return 'Confidence $percent%';
  }

  @override
  String assessRubricUsed(String title) {
    return 'Graded against: $title';
  }

  @override
  String get assessLowConfidence => 'Low confidence';

  @override
  String get assessTranscriptSection => 'What the student wrote';

  @override
  String get assessCriteriaSection => 'Scores by criterion';

  @override
  String assessCriterionPoints(String points, String max) {
    return '$points / $max';
  }

  @override
  String get assessStrengthsSection => 'Strengths';

  @override
  String get assessImprovementsSection => 'To work on';

  @override
  String get assessNextStepsSection => 'Next steps';

  @override
  String get assessTeacherNoteSection => 'Note for the student';

  @override
  String get assessWarningsSection => 'Please check';

  @override
  String get assessWarningBlank =>
      'This page looks blank. Please check the photo and try again.';

  @override
  String get assessWarningLowContrast =>
      'The photo is faint. A brighter photo will grade more accurately.';

  @override
  String get assessWarningPartial => 'Only part of the work could be read.';

  @override
  String get assessWarningLanguageMismatch =>
      'The writing may be in a different language than expected.';

  @override
  String get assessNoContent =>
      'No assessment came back. Please try a clearer photo.';

  @override
  String get assessSignIn => 'Please sign in again to grade an assignment.';

  @override
  String get assessUpgradeTitle => 'A higher plan is needed';

  @override
  String get assessUpgradeBody =>
      'Grading handwritten work is part of a higher plan. Upgrade to keep assessing.';

  @override
  String get assessDailyLimitTitle => 'That is all your assessments for today';

  @override
  String get assessDailyLimitBody =>
      'Your plan includes a set number of assessments each day. They reset tomorrow, or you can raise the limit on a higher plan.';

  @override
  String get assessLimitTitle => 'You have reached your assessment limit';

  @override
  String get assessLimitBody =>
      'You have used all the assessments in your plan. They reset next month, or you can raise the limit on a higher plan.';

  @override
  String get assessSeePricing => 'See plans';

  @override
  String get assessBusy =>
      'The grading model is busy right now. Please try again in a minute.';

  @override
  String assessBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'The grading model is busy right now. Please try again in about $seconds seconds.',
      one:
          'The grading model is busy right now. Please try again in about 1 second.',
    );
    return '$_temp0';
  }

  @override
  String get assessTimeout =>
      'Grading is taking longer than usual. Please try again.';

  @override
  String get assessRephrase =>
      'The photo could not be graded. Please re-upload a clearer photo.';

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
      'Welcome, teacher. Speak in your language, and I will prepare your work.';

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
    return 'View all $count';
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
  String get inboxComposerTooLong => 'Message too long. Please shorten it.';

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
