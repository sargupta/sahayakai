// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Panjabi Punjabi (`pa`).
class AppLocalizationsPa extends AppLocalizations {
  AppLocalizationsPa([String locale = 'pa']) : super(locale);

  @override
  String get appTitle => 'SahayakAI';

  @override
  String get navHome => 'ਹੋਮ';

  @override
  String get navCreate => 'ਬਣਾਓ';

  @override
  String get navLibrary => 'ਲਾਇਬ੍ਰੇਰੀ';

  @override
  String get navProfile => 'ਪ੍ਰੋਫਾਈਲ';

  @override
  String get actionRetry => 'ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ';

  @override
  String get actionSignIn => 'ਸਾਈਨ ਇਨ ਕਰੋ';

  @override
  String get actionSignOut => 'ਸਾਈਨ ਆਊਟ';

  @override
  String get actionGenerate => 'ਬਣਾਓ';

  @override
  String get stateOfflineTitle => 'ਤੁਸੀਂ ਆਫਲਾਈਨ ਹੋ';

  @override
  String get stateOfflineBody => 'ਆਪਣਾ ਕਨੈਕਸ਼ਨ ਜਾਂਚੋ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get errorGeneric => 'ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get emptyDefault => 'ਫਾਰਮ ਭਰੋ ਅਤੇ ਬਣਾਓ \'ਤੇ ਟੈਪ ਕਰੋ।';

  @override
  String get languageLabel => 'ਭਾਸ਼ਾ';

  @override
  String get splashTagline => 'ਹਰ ਜਮਾਤ ਲਈ ਅਧਿਆਪਨ ਸਹਾਇਕ';

  @override
  String get splashFailedTitle => 'We could not start the app';

  @override
  String get splashFailedBody => 'Please check your connection and try again.';

  @override
  String get loginTitle => 'SahayakAI ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ';

  @override
  String get loginSubtitle =>
      'ਪਾਠ ਯੋਜਨਾਵਾਂ, ਕੁਇਜ਼ ਅਤੇ ਹੋਰ ਬਹੁਤ ਕੁਝ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ।';

  @override
  String get loginGoogle => 'Google ਨਾਲ ਜਾਰੀ ਰੱਖੋ';

  @override
  String get loginPrivacyNote =>
      'ਅਸੀਂ ਤੁਹਾਡੇ Google ਖਾਤੇ ਦੀ ਵਰਤੋਂ ਸਿਰਫ਼ ਸਾਈਨ ਇਨ ਕਰਨ ਲਈ ਕਰਦੇ ਹਾਂ। ਤੁਹਾਡਾ ਕੰਮ ਤੁਹਾਡਾ ਹੀ ਰਹਿੰਦਾ ਹੈ।';

  @override
  String get loginLanguagePrompt => 'ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ';

  @override
  String get loginLanguageHint =>
      'SahayakAI ਤੁਹਾਡੀ ਭਾਸ਼ਾ ਵਿੱਚ ਕੰਮ ਕਰਦਾ ਹੈ, ਅਤੇ ਤੁਹਾਡੀ ਅਧਿਆਪਨ ਸਮੱਗਰੀ ਵੀ ਉਸੇ ਭਾਸ਼ਾ ਵਿੱਚ ਲਿਖਦਾ ਹੈ।';

  @override
  String get loginValueLessons => 'ਮਿੰਟਾਂ ਵਿੱਚ ਪੂਰੀ ਪਾਠ ਯੋਜਨਾ ਬਣਾਓ';

  @override
  String get loginValueQuizzes => 'ਤਿੰਨ ਮੁਸ਼ਕਲ ਪੱਧਰਾਂ \'ਤੇ ਕਵਿਜ਼ ਬਣਾਓ';

  @override
  String get loginValueAnswers =>
      'ਆਪਣੀ ਭਾਸ਼ਾ ਵਿੱਚ, ਜਮਾਤ ਦੇ ਕਿਸੇ ਵੀ ਸਵਾਲ ਦਾ ਜਵਾਬ ਦਿਓ';

  @override
  String get onboardingTitle => 'SahayakAI ਸੈੱਟ ਅੱਪ ਕਰੋ';

  @override
  String get onboardingSkip => 'ਹੁਣ ਲਈ ਛੱਡੋ';

  @override
  String onboardingStepLabel(int current, int total) {
    return '$total ਵਿੱਚੋਂ ਪੜਾਅ $current';
  }

  @override
  String get onboardingBack => 'ਪਿੱਛੇ';

  @override
  String get onboardingNext => 'ਅਗਲਾ';

  @override
  String get onboardingSaveAndContinue => 'ਸੰਭਾਲੋ ਅਤੇ ਜਾਰੀ ਰੱਖੋ';

  @override
  String get onboardingFinish => 'ਮੇਰੇ ਡੈਸ਼ਬੋਰਡ \'ਤੇ ਜਾਓ';

  @override
  String get onboardingLanguageTitle => 'ਤੁਸੀਂ ਕਿਸ ਭਾਸ਼ਾ ਵਿੱਚ ਪੜ੍ਹਾਉਂਦੇ ਹੋ?';

  @override
  String get onboardingLanguageBody =>
      'ਤੁਹਾਡੀ ਚੁਣੀ ਭਾਸ਼ਾ ਵਿੱਚ ਹੀ ਪਾਠ ਯੋਜਨਾਵਾਂ, ਕਵਿਜ਼ ਅਤੇ ਜਵਾਬ ਮਿਲਣਗੇ। ਤੁਸੀਂ ਇਸਨੂੰ ਕਿਸੇ ਵੀ ਸਮੇਂ ਬਦਲ ਸਕਦੇ ਹੋ।';

  @override
  String get onboardingProfileTitle => 'ਸਾਨੂੰ ਆਪਣੀ ਜਮਾਤ ਬਾਰੇ ਦੱਸੋ';

  @override
  String get onboardingProfileBody =>
      'ਹਰ ਖੇਤਰ ਵਿਕਲਪਿਕ ਹੈ। ਤੁਸੀਂ ਜੋ ਸਾਂਝਾ ਕਰਦੇ ਹੋ, ਉਸਦੀ ਵਰਤੋਂ ਤੁਹਾਡੀ ਸਮੱਗਰੀ ਨੂੰ ਤੁਹਾਡੇ ਬੋਰਡ, ਜਮਾਤਾਂ ਅਤੇ ਰਾਜ ਨਾਲ ਮੇਲ ਖਾਣ ਲਈ ਕੀਤੀ ਜਾਂਦੀ ਹੈ।';

  @override
  String get onboardingReadyTitle => 'ਤੁਸੀਂ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਤਿਆਰ ਹੋ';

  @override
  String get onboardingReadyBody =>
      'ਤੁਹਾਡੀਆਂ ਪਾਠ ਯੋਜਨਾਵਾਂ, ਕਵਿਜ਼ ਅਤੇ ਜਵਾਬ ਇਸ ਨਾਲ ਮੇਲ ਖਾਣਗੇ। ਤੁਸੀਂ ਬਾਅਦ ਵਿੱਚ ਕਿਸੇ ਵੀ ਸਮੇਂ ਆਪਣੀ ਪ੍ਰੋਫਾਈਲ ਤੋਂ ਇਸਨੂੰ ਬਦਲ ਸਕਦੇ ਹੋ।';

  @override
  String get onboardingSaveFailed =>
      'ਅਸੀਂ ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ ਸੰਭਾਲ ਨਹੀਂ ਸਕੇ। ਤੁਸੀਂ ਹੁਣੇ ਜਾਰੀ ਰੱਖ ਸਕਦੇ ਹੋ ਅਤੇ ਬਾਅਦ ਵਿੱਚ ਇਸਨੂੰ ਆਪਣੀ ਪ੍ਰੋਫਾਈਲ ਤੋਂ ਜੋੜ ਸਕਦੇ ਹੋ।';

  @override
  String get onboardingSaveSignIn =>
      'ਆਪਣੀ ਪ੍ਰੋਫਾਈਲ ਸੰਭਾਲਣ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਸਾਈਨ ਇਨ ਕਰੋ। ਤੁਸੀਂ ਹੁਣੇ ਜਾਰੀ ਰੱਖ ਸਕਦੇ ਹੋ ਅਤੇ ਬਾਅਦ ਵਿੱਚ ਇਸਨੂੰ ਜੋੜ ਸਕਦੇ ਹੋ।';

  @override
  String get dashboardGreeting => 'ਮੁੜ ਸੁਆਗਤ ਹੈ';

  @override
  String dashboardGreetingNamed(String name) {
    return 'Welcome back, $name';
  }

  @override
  String get dashboardGreetingMorning => 'ਸ਼ੁਭ ਸਵੇਰ';

  @override
  String get dashboardGreetingAfternoon => 'ਸ਼ੁਭ ਦੁਪਹਿਰ';

  @override
  String get dashboardGreetingEvening => 'ਸ਼ੁਭ ਸ਼ਾਮ';

  @override
  String get actionOpen => 'ਖੋਲ੍ਹੋ';

  @override
  String get actionRegenerate => 'ਮੁੜ ਬਣਾਓ';

  @override
  String get actionCopy => 'ਕਾਪੀ ਕਰੋ';

  @override
  String get copyConfirmation => 'ਕਲਿੱਪਬੋਰਡ \'ਤੇ ਕਾਪੀ ਕੀਤਾ';

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
  String get lessonPlanSectionLesson => 'ਪਾਠ';

  @override
  String get lessonPlanSectionApproach => 'ਸਿਖਾਉਣ ਦਾ ਢੰਗ';

  @override
  String get quizSectionQuiz => 'ਕਵਿਜ਼';

  @override
  String get sectionForYourClass => 'ਤੁਹਾਡੀ ਜਮਾਤ ਲਈ';

  @override
  String get instantAnswerResultTitle => 'ਜਵਾਬ';

  @override
  String get dashboardToolsTitle => 'ਤੁਹਾਡੇ ਅਧਿਆਪਨ ਸਾਧਨ';

  @override
  String get createPaletteSearchHint => 'ਸਾਧਨ ਖੋਜੋ';

  @override
  String get createPaletteEmpty => 'ਤੁਹਾਡੀ ਖੋਜ ਨਾਲ ਕੋਈ ਸਾਧਨ ਮੇਲ ਨਹੀਂ ਖਾਂਦਾ';

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
  String get libraryTitle => 'ਮੇਰੀ ਲਾਇਬ੍ਰੇਰੀ';

  @override
  String get librarySectionSaved => 'ਸੰਭਾਲਿਆ ਕੰਮ';

  @override
  String get libraryEmpty =>
      'ਤੁਹਾਡੀਆਂ ਸੰਭਾਲੀਆਂ ਪਾਠ ਯੋਜਨਾਵਾਂ ਅਤੇ ਕੁਇਜ਼ ਇੱਥੇ ਦਿਖਣਗੀਆਂ।';

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
  String get profileTitle => 'ਪ੍ਰੋਫਾਈਲ';

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
  String get settingsVoiceModeTitle => 'Voice mode';

  @override
  String get settingsVoiceModeLabel => 'Live voice (beta)';

  @override
  String get settingsVoiceModeHint =>
      'Speak with VIDYA in real time. When off, VIDYA listens, then replies one turn at a time.';

  @override
  String get settingsProfileTitle => 'Teaching profile';

  @override
  String get settingsProfileHint =>
      'This helps us match your material to your board and classroom.';

  @override
  String get settingsBoardLabel => 'ਸਿੱਖਿਆ ਬੋਰਡ';

  @override
  String get settingsBoardNone => 'ਸੈੱਟ ਨਹੀਂ ਹੈ';

  @override
  String get settingsQualificationsLabel => 'Qualifications';

  @override
  String get settingsQualificationsHint =>
      'Choose every qualification you hold.';

  @override
  String get settingsAdminRoleLabel => 'ਪ੍ਰਸ਼ਾਸਕੀ ਭੂਮਿਕਾ';

  @override
  String get settingsAdminRoleNone => 'ਸੈੱਟ ਨਹੀਂ ਹੈ';

  @override
  String get settingsRoleHod => 'ਵਿਭਾਗ ਮੁਖੀ (HoD)';

  @override
  String get settingsRoleCoordinator => 'ਅਕਾਦਮਿਕ ਕੋਆਰਡੀਨੇਟਰ';

  @override
  String get settingsRoleExamController => 'ਪ੍ਰੀਖਿਆ ਨਿਯੰਤਰਕ';

  @override
  String get settingsRoleVicePrincipal => 'ਵਾਈਸ ਪ੍ਰਿੰਸੀਪਲ';

  @override
  String get settingsRolePrincipal => 'ਪ੍ਰਿੰਸੀਪਲ';

  @override
  String get settingsRoleNone => 'ਅਧਿਆਪਕ, ਕੋਈ ਪ੍ਰਸ਼ਾਸਕੀ ਭੂਮਿਕਾ ਨਹੀਂ';

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
  String get profileSectionAbout => 'ਤੁਹਾਡੇ ਬਾਰੇ';

  @override
  String get profileSectionTeaching => 'ਤੁਸੀਂ ਕੀ ਪੜ੍ਹਾਉਂਦੇ ਹੋ';

  @override
  String get profileSectionLocation => 'ਤੁਸੀਂ ਕਿੱਥੇ ਪੜ੍ਹਾਉਂਦੇ ਹੋ';

  @override
  String get profileSectionContact => 'ਅਸੀਂ ਤੁਹਾਡੇ ਨਾਲ ਕਿਵੇਂ ਸੰਪਰਕ ਕਰੀਏ';

  @override
  String get profileNameLabel => 'ਤੁਹਾਡਾ ਨਾਮ';

  @override
  String get profileNameHint =>
      'This is the name other teachers see on work you share.';

  @override
  String get profileNameInvalid => 'ਕਿਰਪਾ ਕਰਕੇ ਛੋਟਾ ਨਾਮ ਵਰਤੋ।';

  @override
  String get profileSchoolLabel => 'ਸਕੂਲ ਦਾ ਨਾਮ';

  @override
  String get profileBoardCategoryLabel => 'ਬੋਰਡ ਦੀ ਕਿਸਮ';

  @override
  String get profileBoardCategoryHint =>
      'ਹੇਠਾਂ ਦਿੱਤੀ ਸੂਚੀ ਨੂੰ ਛੋਟਾ ਕਰਨ ਲਈ ਬੋਰਡ ਦੀ ਕਿਸਮ ਚੁਣੋ।';

  @override
  String get profileBoardCategoryState => 'ਰਾਜ ਬੋਰਡ';

  @override
  String get profileStateLabel => 'ਰਾਜ';

  @override
  String get profileStateNone => 'ਸੈੱਟ ਨਹੀਂ ਹੈ';

  @override
  String get profileDistrictLabel => 'ਜ਼ਿਲ੍ਹਾ';

  @override
  String get profileDistrictHint => 'ਉਹ ਜ਼ਿਲ੍ਹਾ ਜਿੱਥੇ ਤੁਹਾਡਾ ਸਕੂਲ ਸਥਿਤ ਹੈ।';

  @override
  String get profileSubjectsLabel => 'ਤੁਹਾਡੇ ਵੱਲੋਂ ਪੜ੍ਹਾਏ ਜਾਂਦੇ ਵਿਸ਼ੇ';

  @override
  String get profileSubjectsHint => 'ਤੁਹਾਨੂੰ ਲੋੜ ਅਨੁਸਾਰ ਓਨੇ ਚੁਣੋ।';

  @override
  String get profileGradesLabel => 'ਤੁਹਾਡੇ ਵੱਲੋਂ ਪੜ੍ਹਾਈਆਂ ਜਾਂਦੀਆਂ ਜਮਾਤਾਂ';

  @override
  String get profileGradesHint => 'ਤੁਹਾਨੂੰ ਲੋੜ ਅਨੁਸਾਰ ਓਨੇ ਚੁਣੋ।';

  @override
  String get profileLanguageHint =>
      'This is the same language choice as the rest of the app, so changing it here changes it everywhere.';

  @override
  String get profilePhoneLabel => 'ਮੋਬਾਈਲ ਨੰਬਰ';

  @override
  String get profilePhoneHint => 'ਵਿਕਲਪਿਕ। +91 ਸਮੇਤ ਜਾਂ ਬਿਨਾਂ, ਦਸ ਅੰਕ।';

  @override
  String get profilePhoneInvalid =>
      'ਕਿਰਪਾ ਕਰਕੇ ਦਸ ਅੰਕਾਂ ਦਾ ਭਾਰਤੀ ਮੋਬਾਈਲ ਨੰਬਰ ਦਰਜ ਕਰੋ।';

  @override
  String get profilePincodeLabel => 'ਪਿੰਨ ਕੋਡ';

  @override
  String get profilePincodeHint => 'ਵਿਕਲਪਿਕ। ਛੇ ਅੰਕ।';

  @override
  String get profilePincodeInvalid =>
      'ਕਿਰਪਾ ਕਰਕੇ ਛੇ ਅੰਕਾਂ ਦਾ ਪਿੰਨ ਕੋਡ ਦਰਜ ਕਰੋ।';

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
  String get meTitle => 'ਪ੍ਰੋਫਾਈਲ';

  @override
  String get mePlanUsageTitle => 'ਪਲਾਨ ਅਤੇ ਵਰਤੋਂ';

  @override
  String get mePlanUsageSubtitle => 'ਇਸ ਮਹੀਨੇ ਤੁਸੀਂ ਕਿੰਨਾ ਵਰਤਿਆ ਹੈ।';

  @override
  String meUsageValue(int used, int limit) {
    return '$used / $limit';
  }

  @override
  String get meUsageUnlimited => 'ਅਸੀਮਤ';

  @override
  String get meUsageUnavailable =>
      'ਅਸੀਂ ਤੁਹਾਡੀ ਵਰਤੋਂ ਲੋਡ ਨਹੀਂ ਕਰ ਸਕੇ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get meDefaultsTitle => 'ਡਿਫੌਲਟ';

  @override
  String get mePrivacyTitle => 'ਪਰਦੇਦਾਰੀ ਅਤੇ ਸੈਟਿੰਗਾਂ';

  @override
  String get meRoleTeacher => 'ਅਧਿਆਪਕ';

  @override
  String get usageFeatureAvatar => 'AI ਅਵਤਾਰ';

  @override
  String get usageFeatureVoiceToText => 'ਵੌਇਸ ਤੋਂ ਟੈਕਸਟ';

  @override
  String get usageFeatureAssistant => 'VIDYA ਸਹਾਇਕ';

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
  String get teacherTrainingSectionQuestion => 'ਸਵਾਲ';

  @override
  String get teacherTrainingResultTitle => 'ਮਾਰਗਦਰਸ਼ਨ ਨੋਟਸ';

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
  String get parentMessageSectionMessage => 'ਸੁਨੇਹਾ';

  @override
  String get parentMessageSectionDetails => 'ਵਾਧੂ ਵੇਰਵੇ';

  @override
  String get parentMessageResultTitle => 'ਮਾਪੇ ਲਈ ਸੁਨੇਹਾ';

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
  String get assessSectionWork => 'ਵਿਦਿਆਰਥੀ ਦਾ ਕੰਮ';

  @override
  String get assessResultTitle => 'ਮੁਲਾਂਕਣ';

  @override
  String get worksheetSectionWorksheet => 'ਵਰਕਸ਼ੀਟ';

  @override
  String get rubricSectionAssignment => 'ਅਸਾਈਨਮੈਂਟ';

  @override
  String get examPaperSectionPaper => 'ਪ੍ਰਸ਼ਨ ਪੱਤਰ';

  @override
  String get examPaperSectionFormat => 'ਫਾਰਮੈਟ';

  @override
  String get vidyaEyebrow => 'ਤੁਹਾਡਾ ਸਹਿ-ਅਧਿਆਪਕ';

  @override
  String get vidyaDeck => 'ਆਪਣੀ ਭਾਸ਼ਾ ਵਿੱਚ ਬੋਲੋ, ਅਤੇ ਮੈਂ ਕੰਮ ਤਿਆਰ ਕਰ ਦੇਵਾਂਗੀ।';

  @override
  String get vidyaGreeting =>
      'Welcome, teacher. Speak in your language, and I will prepare your work.';

  @override
  String get vidyaHeroBadge => 'ਤੁਹਾਡਾ AI ਅਧਿਆਪਨ ਸਹਾਇਕ';

  @override
  String get vidyaPromptLesson => 'ਪਾਠ ਯੋਜਨਾ ਬਣਾਉਣ ਲਈ ਕਹੋ';

  @override
  String get vidyaPromptQuiz => 'ਇੱਕ ਕਵਿਜ਼ ਬਣਾਉਣ ਲਈ ਕਹੋ';

  @override
  String get vidyaPromptParent => 'ਮਾਪੇ ਨੂੰ ਸੁਨੇਹਾ ਭੇਜਣ ਲਈ ਕਹੋ';

  @override
  String get vidyaStateIdle => 'ਬੋਲਣ ਲਈ ਟੈਪ ਕਰੋ';

  @override
  String get vidyaStateReady => 'ਤਿਆਰ ਹੋ ਰਿਹਾ ਹੈ';

  @override
  String get vidyaStateListening => 'ਮੈਂ ਸੁਣ ਰਹੀ ਹਾਂ';

  @override
  String get vidyaStateThinking => 'ਸੋਚ ਰਹੀ ਹਾਂ';

  @override
  String get vidyaStateSpeaking => 'ਬੋਲ ਰਹੀ ਹਾਂ';

  @override
  String get vidyaYouSaid => 'ਤੁਸੀਂ ਕਿਹਾ';

  @override
  String get vidyaSignedOutTitle => 'VIDYA ਨਾਲ ਗੱਲ ਕਰਨ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ';

  @override
  String get vidyaSignedOutBody =>
      'ਸਾਈਨ ਇਨ ਕਰੋ ਅਤੇ VIDYA ਤੁਹਾਡੀ ਭਾਸ਼ਾ ਵਿੱਚ ਪਾਠ, ਕਵਿਜ਼ ਅਤੇ ਹੋਰ ਬਹੁਤ ਕੁਝ ਤਿਆਰ ਕਰੇਗੀ।';

  @override
  String get vidyaMicOffTitle => 'ਮਾਈਕ੍ਰੋਫੋਨ ਚਾਲੂ ਕਰੋ';

  @override
  String get vidyaMicOffBody =>
      'ਤੁਹਾਨੂੰ ਸੁਣਨ ਲਈ VIDYA ਨੂੰ ਮਾਈਕ੍ਰੋਫੋਨ ਚਾਹੀਦਾ ਹੈ। ਇਸਨੂੰ ਸੈਟਿੰਗਾਂ ਵਿੱਚ ਚਾਲੂ ਕਰੋ।';

  @override
  String get vidyaOpenSettings => 'ਸੈਟਿੰਗਾਂ ਖੋਲ੍ਹੋ';

  @override
  String get vidyaSignIn => 'ਸਾਈਨ ਇਨ ਕਰੋ';

  @override
  String get vidyaLimitTitle => 'ਤੁਸੀਂ ਅੱਜ ਦੀ ਵੌਇਸ ਸੀਮਾ ਤੱਕ ਪਹੁੰਚ ਗਏ ਹੋ';

  @override
  String get vidyaLimitBody =>
      'ਤੁਹਾਡੇ ਵੌਇਸ ਮਿੰਟ ਦੁਬਾਰਾ ਮਿਲਣਗੇ। ਉਦੋਂ ਤੱਕ ਤੁਸੀਂ ਟੂਲ ਵਰਤ ਸਕਦੇ ਹੋ।';

  @override
  String get vidyaErrorTitle => 'ਇਹ ਪੂਰਾ ਨਹੀਂ ਹੋ ਸਕਿਆ';

  @override
  String get vidyaErrorBody =>
      'ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰਨ ਲਈ ਸੀਲ \'ਤੇ ਟੈਪ ਕਰੋ।';

  @override
  String get vidyaPrepDesk => 'ਤਿਆਰੀ ਡੈਸਕ';

  @override
  String get vidyaClearConversation => 'ਗੱਲਬਾਤ ਸਾਫ਼ ਕਰੋ';

  @override
  String get vidyaFlowVisualAid => 'ਦ੍ਰਿਸ਼ ਸਮੱਗਰੀ';

  @override
  String get vidyaFlowVirtualFieldTrip => 'ਵਰਚੁਅਲ ਫੀਲਡ ਟ੍ਰਿਪ';

  @override
  String get vidyaFlowVideoStoryteller => 'ਵੀਡੀਓ ਕਹਾਣੀ';

  @override
  String get vidyaFieldMicLabel => 'ਬੋਲ ਕੇ ਭਰੋ';

  @override
  String get vidyaFieldMicFailed =>
      'ਸੁਣ ਨਹੀਂ ਸਕੇ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ ਜਾਂ ਟਾਈਪ ਕਰੋ।';

  @override
  String get vidyaOpen => 'VIDYA ਨੂੰ ਪੁੱਛੋ';

  @override
  String get parentHotlineTitle => 'ਮਾਪਿਆਂ ਨੂੰ ਕਾਲ';

  @override
  String get parentHotlineSubtitle =>
      'ਵਿਦਿਆਰਥੀ ਦੇ ਮਾਪਿਆਂ ਨੂੰ ਉਨ੍ਹਾਂ ਦੀ ਭਾਸ਼ਾ ਵਿੱਚ ਕਾਲ ਕਰੋ';

  @override
  String get parentHotlineEyebrow => 'ਮਾਪਿਆਂ ਨੂੰ ਕਾਲ';

  @override
  String get parentHotlinePickStudentIntro =>
      'ਚੁਣੋ ਕਿ ਕਿਸ ਦੇ ਮਾਪਿਆਂ ਨੂੰ ਕਾਲ ਕਰਨੀ ਹੈ।';

  @override
  String get parentHotlineClassLabel => 'ਜਮਾਤ';

  @override
  String get parentHotlineNoPhone => 'ਮਾਪਿਆਂ ਦਾ ਕੋਈ ਨੰਬਰ ਸੇਵ ਨਹੀਂ ਹੈ';

  @override
  String get parentHotlineSignedOutTitle => 'ਆਪਣੇ ਵਿਦਿਆਰਥੀ ਦੇਖਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ';

  @override
  String get parentHotlineSignedOutBody =>
      'ਸਾਈਨ ਇਨ ਕਰਦੇ ਹੀ ਤੁਹਾਡੀ ਜਮਾਤ ਦੀ ਸੂਚੀ ਲੋਡ ਹੋ ਜਾਂਦੀ ਹੈ। ਮਾਪਿਆਂ ਨੂੰ ਕਾਲ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਇਸ ਸੇਵਾ ਨੂੰ ਤੁਹਾਡੇ ਖਾਤੇ ਦੀ ਲੋੜ ਹੁੰਦੀ ਹੈ।';

  @override
  String get parentHotlineRosterUnavailableTitle =>
      'ਤੁਹਾਡੀ ਜਮਾਤ ਦੀ ਸੂਚੀ ਹਾਲੇ ਉਪਲਬਧ ਨਹੀਂ ਹੈ';

  @override
  String get parentHotlineRosterUnavailableBody =>
      'ਅਸੀਂ ਹਾਲੇ ਇੱਥੇ ਤੁਹਾਡੇ ਵਿਦਿਆਰਥੀ ਲੋਡ ਨਹੀਂ ਕਰ ਸਕਦੇ। ਇਹ ਕਿਸੇ ਆਉਣ ਵਾਲੇ ਅੱਪਡੇਟ ਵਿੱਚ ਆਵੇਗਾ। ਤੁਸੀਂ ਪਹਿਲਾਂ ਹੀ ਸਾਈਨ ਇਨ ਹੋ, ਇਸ ਲਈ ਤੁਹਾਨੂੰ ਕੁਝ ਠੀਕ ਕਰਨ ਦੀ ਲੋੜ ਨਹੀਂ ਹੈ।';

  @override
  String get parentHotlineReasonEyebrow => 'ਤੁਸੀਂ ਕਿਉਂ ਕਾਲ ਕਰ ਰਹੇ ਹੋ';

  @override
  String get parentHotlineReasonAbsencesLabel => 'ਵਾਰ-ਵਾਰ ਗ਼ੈਰਹਾਜ਼ਰੀ';

  @override
  String get parentHotlineReasonAbsencesDesc =>
      'ਵਿਦਿਆਰਥੀ ਕਈ ਦਿਨਾਂ ਤੋਂ ਲਗਾਤਾਰ ਗ਼ੈਰਹਾਜ਼ਰ ਹੈ।';

  @override
  String get parentHotlineReasonPerformanceLabel => 'ਕਿਸੇ ਵਿਸ਼ੇ ਵਿੱਚ ਪਛੜਨਾ';

  @override
  String get parentHotlineReasonPerformanceDesc =>
      'ਹਾਲੀਆ ਅੰਕ ਜਾਂ ਜਮਾਤ ਦੇ ਕੰਮ ਵੱਲ ਧਿਆਨ ਦੇਣ ਦੀ ਲੋੜ ਹੈ।';

  @override
  String get parentHotlineReasonBehaviourLabel => 'ਜਮਾਤ ਵਿੱਚ ਵਰਤਾਓ';

  @override
  String get parentHotlineReasonBehaviourDesc =>
      'ਕੁਝ ਅਜਿਹਾ ਹੋਇਆ ਹੈ ਜਿਸ ਬਾਰੇ ਮਾਪਿਆਂ ਨੂੰ ਪਤਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ।';

  @override
  String get parentHotlineReasonPositiveLabel => 'ਸਾਂਝੀ ਕਰਨ ਲਈ ਚੰਗੀ ਖ਼ਬਰ';

  @override
  String get parentHotlineReasonPositiveDesc =>
      'ਮਾਪਿਆਂ ਨਾਲ ਕਿਸੇ ਪ੍ਰਾਪਤੀ ਦੀ ਖ਼ੁਸ਼ੀ ਸਾਂਝੀ ਕਰੋ।';

  @override
  String get parentHotlineComposeEyebrow => 'ਕਾਲ ਦੀ ਤਿਆਰੀ ਕਰੋ';

  @override
  String get parentHotlineNoteLabel => 'ਇੱਕ ਨੋਟ ਜੋੜੋ';

  @override
  String get parentHotlineNoteHintAbsences =>
      'ਗ਼ੈਰਹਾਜ਼ਰੀ ਦੇ ਦਿਨਾਂ ਬਾਰੇ ਮਾਪਿਆਂ ਨੂੰ ਕੁਝ ਦੱਸਣਾ ਚਾਹੁੰਦੇ ਹੋ?';

  @override
  String get parentHotlineNoteHintPerformance =>
      'ਵਿਦਿਆਰਥੀ ਨੂੰ ਅੱਗੇ ਵਧਣ ਵਿੱਚ ਕੀ ਮਦਦ ਕਰੇਗਾ?';

  @override
  String get parentHotlineNoteHintBehaviour =>
      'ਕੀ ਹੋਇਆ, ਅਤੇ ਘਰ ਵਿੱਚ ਕਿਹੜੀ ਮਦਦ ਲਾਭਦਾਇਕ ਹੋਵੇਗੀ?';

  @override
  String get parentHotlineNoteHintPositive => 'ਸਾਂਝੀ ਕਰਨ ਵਾਲੀ ਚੰਗੀ ਖ਼ਬਰ ਕੀ ਹੈ?';

  @override
  String get parentHotlineDraftAction => 'ਸੁਨੇਹਾ ਤਿਆਰ ਕਰੋ';

  @override
  String get parentHotlineErrorTitle => 'ਕੁਝ ਗ਼ਲਤ ਹੋ ਗਿਆ';

  @override
  String get parentHotlineGenericError =>
      'ਇਹ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get parentHotlineEvidenceAttendanceHeader => 'ਹਾਜ਼ਰੀ';

  @override
  String get parentHotlineEvidenceMarksHeader => 'ਹਾਲੀਆ ਅੰਕ';

  @override
  String get parentHotlineEvidenceBehaviourHeader => 'ਕੀ ਹੋਇਆ';

  @override
  String get parentHotlineEvidencePositiveHeader => 'ਚੰਗੀ ਖ਼ਬਰ';

  @override
  String parentHotlineEvidenceAbsentDays(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: 'ਲਗਾਤਾਰ $days ਦਿਨ ਗ਼ੈਰਹਾਜ਼ਰ',
      one: 'ਲਗਾਤਾਰ 1 ਦਿਨ ਗ਼ੈਰਹਾਜ਼ਰ',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineEvidenceAbsencePrompt =>
      'ਗ਼ੈਰਹਾਜ਼ਰੀ ਦੇ ਦਿਨਾਂ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ ਤਾਂ ਜੋ ਮਾਪਿਆਂ ਨੂੰ ਸਹੀ ਵੇਰਵਾ ਸੁਣਨ ਨੂੰ ਮਿਲੇ।';

  @override
  String get parentHotlineEvidenceMarksPrompt =>
      'ਤਾਜ਼ਾ ਅੰਕ ਕਾਲ ਵਿੱਚ ਦੱਸਣ ਲਈ ਤਿਆਰ ਹਨ।';

  @override
  String get parentHotlineEvidenceMarksEmpty =>
      'ਹਾਲੇ ਕੋਈ ਹਾਲੀਆ ਅੰਕ ਦਰਜ ਨਹੀਂ ਹਨ। ਹੇਠਾਂ ਉਹ ਲਿਖੋ ਜੋ ਮਾਪਿਆਂ ਨੂੰ ਪਤਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ।';

  @override
  String get parentHotlineEvidenceBehaviourPrompt =>
      'ਦੱਸੋ ਕਿ ਕੀ ਹੋਇਆ ਅਤੇ ਘਰ ਵਿੱਚ ਕਿਹੜੀ ਮਦਦ ਲਾਭਦਾਇਕ ਹੋਵੇਗੀ।';

  @override
  String get parentHotlineEvidencePositivePrompt =>
      'ਉਹ ਪ੍ਰਾਪਤੀ ਸਾਂਝੀ ਕਰੋ ਜਿਸ ਦੀ ਖ਼ੁਸ਼ੀ ਤੁਸੀਂ ਮਾਪਿਆਂ ਨਾਲ ਮਨਾਉਣੀ ਚਾਹੁੰਦੇ ਹੋ।';

  @override
  String get parentHotlineReviewEyebrow => 'ਘਰ ਲਈ ਸੁਨੇਹਾ';

  @override
  String get parentHotlineCall => 'ਮਾਪਿਆਂ ਨੂੰ ਕਾਲ ਕਰੋ';

  @override
  String get parentHotlineWhatsApp => 'WhatsApp ਲਈ ਕਾਪੀ ਕਰੋ';

  @override
  String parentHotlineCallAgainIn(String time) {
    return '$time ਵਿੱਚ ਦੁਬਾਰਾ ਕਾਲ ਕਰੋ';
  }

  @override
  String parentHotlineUnsupportedLanguage(String language) {
    return '$language ਲਈ ਆਟੋ-ਕਾਲ ਹਾਲੇ ਉਪਲਬਧ ਨਹੀਂ ਹੈ। ਇਸ ਦੀ ਥਾਂ WhatsApp ਲਈ ਕਾਪੀ ਕਰੋ।';
  }

  @override
  String parentHotlinePhoneMask(String last4) {
    return '•••• $last4';
  }

  @override
  String get parentHotlineAiNotice =>
      'ਕਾਲ ਦੀ ਸ਼ੁਰੂਆਤ ਇੱਕ ਆਟੋਮੈਟਿਕ AI ਆਵਾਜ਼ ਸੂਚਨਾ ਨਾਲ ਹੁੰਦੀ ਹੈ।';

  @override
  String get parentHotlineCopied =>
      'ਸੁਨੇਹਾ ਕਾਪੀ ਹੋ ਗਿਆ। ਭੇਜਣ ਲਈ ਇਸ ਨੂੰ WhatsApp ਵਿੱਚ ਪੇਸਟ ਕਰੋ।';

  @override
  String get parentHotlinePremiumTitle =>
      'ਮਾਪਿਆਂ ਨੂੰ ਕਾਲ ਲਈ ਉੱਨਤ ਪਲਾਨ ਦੀ ਲੋੜ ਹੈ';

  @override
  String get parentHotlinePremiumBody =>
      'ਮਾਪਿਆਂ ਨੂੰ AI ਆਵਾਜ਼ ਕਾਲ ਕਰਨਾ ਉੱਨਤ ਪਲਾਨ ਦਾ ਹਿੱਸਾ ਹੈ। ਤੁਸੀਂ ਫਿਰ ਵੀ ਮੁਫ਼ਤ ਵਿੱਚ ਇੱਕ ਸੁਨੇਹਾ ਕਾਪੀ ਕਰਕੇ WhatsApp ਉੱਤੇ ਭੇਜ ਸਕਦੇ ਹੋ।';

  @override
  String get parentHotlineComingSoonTitle => 'ਕਾਲ ਸਕ੍ਰੀਨ ਜਲਦੀ ਆ ਰਹੀ ਹੈ';

  @override
  String get parentHotlineComingSoonBody =>
      'ਕਾਲ ਕਰਨ ਅਤੇ ਉਸ ਉੱਤੇ ਨਜ਼ਰ ਰੱਖਣ ਦੀ ਸਹੂਲਤ ਅਗਲੇ ਅੱਪਡੇਟ ਵਿੱਚ ਆਵੇਗੀ।';

  @override
  String parentHotlineCallingTitle(String name) {
    return '$name ਦੇ ਮਾਪਿਆਂ ਨੂੰ ਕਾਲ ਕੀਤੀ ਜਾ ਰਹੀ ਹੈ…';
  }

  @override
  String get parentHotlineCallingRinging => 'ਘੰਟੀ ਵੱਜ ਰਹੀ ਹੈ…';

  @override
  String get parentHotlineCallingInProgress => 'ਗੱਲਬਾਤ ਚੱਲ ਰਹੀ ਹੈ';

  @override
  String parentHotlineCallingExchanges(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ਸੰਵਾਦ',
      one: '1 ਸੰਵਾਦ',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineCallingReassurance =>
      'ਤੁਸੀਂ ਇਹ ਸਕ੍ਰੀਨ ਛੱਡ ਸਕਦੇ ਹੋ — ਸਾਰ ਤੁਹਾਡੇ ਲਈ ਤਿਆਰ ਰਹੇਗਾ।';

  @override
  String get parentHotlineSummaryDocType => 'ਮਾਪੇ ਕਾਲ';

  @override
  String get parentHotlineSummaryReasonAbsences => 'ਗ਼ੈਰਹਾਜ਼ਰੀ';

  @override
  String get parentHotlineSummaryReasonPerformance => 'ਕਾਰਗੁਜ਼ਾਰੀ';

  @override
  String get parentHotlineSummaryReasonBehaviour => 'ਵਿਹਾਰ';

  @override
  String get parentHotlineSummaryReasonPositive => 'ਖੁਸ਼ਖ਼ਬਰੀ';

  @override
  String parentHotlineSummaryTitle(String name) {
    return '$name ਦੇ ਮਾਪੇ';
  }

  @override
  String parentHotlineSummaryDurationMin(int minutes) {
    return '$minutes ਮਿੰਟ';
  }

  @override
  String get parentHotlineSentimentCooperative => 'ਸਹਿਯੋਗੀ';

  @override
  String get parentHotlineSentimentConcerned => 'ਚਿੰਤਤ';

  @override
  String get parentHotlineSentimentGrateful => 'ਸ਼ੁਕਰਗੁਜ਼ਾਰ';

  @override
  String get parentHotlineSentimentUpset => 'ਨਾਰਾਜ਼';

  @override
  String get parentHotlineSentimentIndifferent => 'ਨਿਰਪੱਖ';

  @override
  String get parentHotlineSentimentConfused => 'ਉਲਝਣ ਵਿੱਚ';

  @override
  String get parentHotlineSummarySaidHeader => 'ਮਾਪਿਆਂ ਨੇ ਕੀ ਕਿਹਾ';

  @override
  String get parentHotlineSummaryConcernsHeader => 'ਉਠਾਈਆਂ ਚਿੰਤਾਵਾਂ';

  @override
  String get parentHotlineSummaryCommitmentsHeader => 'ਮਾਪਿਆਂ ਦੇ ਵਾਅਦੇ';

  @override
  String get parentHotlineSummaryActionsHeader => 'ਤੁਹਾਡੇ ਕੰਮ';

  @override
  String get parentHotlineSummaryGuidanceHeader => 'ਸਾਂਝਾ ਕੀਤਾ ਮਾਰਗਦਰਸ਼ਨ';

  @override
  String get parentHotlineSummaryFollowUpHeader => 'ਅਗਲਾ ਕਦਮ';

  @override
  String parentHotlineSummaryTranscript(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'ਗੱਲਬਾਤ ਵੇਖੋ · $count ਸੁਨੇਹੇ',
      one: 'ਗੱਲਬਾਤ ਵੇਖੋ · 1 ਸੁਨੇਹਾ',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineSummaryDone => 'ਹੋ ਗਿਆ';

  @override
  String get parentHotlineSummaryCallAgain => 'ਬਾਅਦ ਵਿੱਚ ਫਿਰ ਕਾਲ ਕਰੋ';

  @override
  String get parentHotlineSummaryManualTitle => 'ਸੁਨੇਹਾ ਕਾਪੀ ਹੋ ਗਿਆ';

  @override
  String get parentHotlineSummaryManualBody =>
      'ਮਾਪਿਆਂ ਨੂੰ ਭੇਜਣ ਲਈ ਇਸਨੂੰ WhatsApp ਵਿੱਚ ਪੇਸਟ ਕਰੋ।';

  @override
  String get parentHotlineSummaryBusy => 'ਲਾਈਨ ਵਿਅਸਤ ਸੀ';

  @override
  String get parentHotlineSummaryNoAnswer => 'ਕੋਈ ਜਵਾਬ ਨਹੀਂ';

  @override
  String get parentHotlineSummaryFailed => 'ਕਾਲ ਕਨੈਕਟ ਨਹੀਂ ਹੋ ਸਕੀ';

  @override
  String get parentHotlineSummaryFailedBody =>
      'ਕਾਲ ਨਹੀਂ ਹੋ ਸਕੀ। ਤੁਸੀਂ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰ ਸਕਦੇ ਹੋ, ਜਾਂ ਸੁਨੇਹਾ ਕਾਪੀ ਕਰਕੇ WhatsApp \'ਤੇ ਭੇਜ ਸਕਦੇ ਹੋ।';

  @override
  String get parentHotlineSummaryTryAgain => 'ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ';

  @override
  String get parentHotlineSummaryNoConversationTitle =>
      'ਕਾਲ ਬਹੁਤ ਜਲਦੀ ਖ਼ਤਮ ਹੋ ਗਈ';

  @override
  String get parentHotlineSummaryNoConversationBody =>
      'ਗੱਲਬਾਤ ਸ਼ੁਰੂ ਹੋਣ ਤੋਂ ਪਹਿਲਾਂ ਹੀ ਕਾਲ ਖ਼ਤਮ ਹੋ ਗਈ। ਤੁਸੀਂ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰ ਸਕਦੇ ਹੋ, ਜਾਂ ਸੁਨੇਹਾ WhatsApp \'ਤੇ ਭੇਜ ਸਕਦੇ ਹੋ।';

  @override
  String get parentHotlineSummaryUnavailableTitle => 'ਸਾਰ ਉਪਲਬਧ ਨਹੀਂ ਹੈ';

  @override
  String get parentHotlineSummaryUnavailableBody =>
      'ਇਸ ਕਾਲ ਦਾ ਸਾਰ ਤਿਆਰ ਨਹੀਂ ਕੀਤਾ ਜਾ ਸਕਿਆ। ਗੱਲਬਾਤ ਹੇਠਾਂ ਦਿੱਤੀ ਗਈ ਹੈ।';

  @override
  String get contentCreatorTitle => 'ਸਮੱਗਰੀ ਰਚਨਾ ਸਟੂਡੀਓ';

  @override
  String get contentCreatorTileSubtitle => 'ਆਪਣੀ ਜਮਾਤ ਲਈ ਮਲਟੀਮੀਡੀਆ ਬਣਾਓ';

  @override
  String get contentCreatorSubtitle =>
      'ਤੁਹਾਡੀ ਜਮਾਤ ਲਈ ਦਿਲਚਸਪ ਮਲਟੀਮੀਡੀਆ ਸਮੱਗਰੀ ਬਣਾਉਣ ਵਿੱਚ ਮਦਦ ਕਰਨ ਵਾਲੇ ਸਾਧਨ।';

  @override
  String get contentCreatorSectionEyebrow => 'ਇੱਕ ਸਾਧਨ ਚੁਣੋ';

  @override
  String get contentCreatorVisualAidDesc =>
      'ਆਪਣੇ ਪਾਠਾਂ ਲਈ ਸਧਾਰਨ ਰੇਖਾ-ਚਿੱਤਰ ਅਤੇ ਡਾਇਗ੍ਰਾਮ ਬਣਾਓ।';

  @override
  String get contentCreatorFieldTripDesc =>
      'Google Earth ਦੀ ਵਰਤੋਂ ਕਰਕੇ ਦਿਲਚਸਪ ਵਰਚੁਅਲ ਸੈਰਾਂ ਦੀ ਯੋਜਨਾ ਬਣਾਓ।';

  @override
  String get contentCreatorVideoDesc =>
      'ਆਪਣੇ ਪਾਠਾਂ ਲਈ ਚੁਣੇ ਹੋਏ ਵਿਦਿਅਕ ਵੀਡੀਓ ਲੱਭੋ।';

  @override
  String get visualAidTitle => 'ਦ੍ਰਿਸ਼ ਸਹਾਇਕ';

  @override
  String get visualAidSubtitle => 'ਸਿੱਖਿਆ ਚਿੱਤਰ ਬਣਾਓ';

  @override
  String get visualAidEmpty => 'ਇੱਕ ਚਿੱਤਰ ਦਾ ਵੇਰਵਾ ਦਿਓ ਅਤੇ ਬਣਾਓ ਦਬਾਓ।';

  @override
  String get visualAidPromptLabel => 'ਚਿੱਤਰ ਵਿੱਚ ਕੀ ਦਿਖਾਉਣਾ ਚਾਹੀਦਾ ਹੈ?';

  @override
  String get visualAidPromptHint => 'ਉਦਾਹਰਨ ਲਈ, ਪੌਦੇ ਦੇ ਸੈੱਲ ਦੇ ਹਿੱਸੇ';

  @override
  String get visualAidPromptError =>
      'ਦੱਸੋ ਕਿ ਤੁਹਾਨੂੰ ਕਿਹੋ ਜਿਹਾ ਚਿੱਤਰ ਚਾਹੀਦਾ ਹੈ।';

  @override
  String get visualAidGradeLabel => 'ਜਮਾਤ ਪੱਧਰ';

  @override
  String get visualAidGradeAny => 'ਕੋਈ ਵੀ ਜਮਾਤ';

  @override
  String get visualAidSubjectLabel => 'ਵਿਸ਼ਾ';

  @override
  String get visualAidSubjectAny => 'ਕੋਈ ਵੀ ਵਿਸ਼ਾ';

  @override
  String get visualAidOptional => 'ਵਿਕਲਪਿਕ';

  @override
  String get visualAidAction => 'ਚਿੱਤਰ ਬਣਾਓ';

  @override
  String get visualAidResultTitle => 'ਦ੍ਰਿਸ਼ ਸਹਾਇਕ';

  @override
  String get visualAidHowToUse => 'ਇਸ ਦੀ ਵਰਤੋਂ ਕਿਵੇਂ ਕਰੀਏ';

  @override
  String get visualAidDiscussionSpark => 'ਚਰਚਾ ਦਾ ਸਵਾਲ';

  @override
  String get visualAidImageLabel => 'ਬਣਾਇਆ ਗਿਆ ਸਿੱਖਿਆ ਚਿੱਤਰ';

  @override
  String get visualAidImageError => 'ਇਹ ਚਿੱਤਰ ਦਿਖਾਇਆ ਨਹੀਂ ਜਾ ਸਕਿਆ।';

  @override
  String get visualAidNoImage =>
      'ਉਸ ਵੇਰਵੇ ਲਈ ਕੋਈ ਚਿੱਤਰ ਨਹੀਂ ਮਿਲਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਇਸ ਨੂੰ ਦੁਬਾਰਾ ਲਿਖੋ ਅਤੇ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get visualAidSignIn =>
      'ਇਸ ਸੰਦ ਦੀ ਵਰਤੋਂ ਕਰਨ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਸਾਈਨ ਇਨ ਕਰੋ।';

  @override
  String get visualAidUpgradeTitle => 'ਇੱਕ ਉੱਚ ਯੋਜਨਾ ਦੀ ਲੋੜ ਹੈ';

  @override
  String get visualAidUpgradeBody =>
      'ਦ੍ਰਿਸ਼ ਸਹਾਇਕ ਇੱਕ ਉੱਚ ਯੋਜਨਾ ਦਾ ਹਿੱਸਾ ਹੈ। ਚਿੱਤਰ ਬਣਾਉਂਦੇ ਰਹਿਣ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਅੱਪਗ੍ਰੇਡ ਕਰੋ।';

  @override
  String get visualAidSeePricing => 'ਯੋਜਨਾਵਾਂ ਅਤੇ ਕੀਮਤਾਂ ਵੇਖੋ';

  @override
  String get visualAidDailyLimitTitle => 'ਅੱਜ ਲਈ ਤੁਹਾਡੇ ਸਾਰੇ ਚਿੱਤਰ ਬਣ ਗਏ ਹਨ';

  @override
  String get visualAidDailyLimitBody =>
      'ਤੁਹਾਡੀ ਯੋਜਨਾ ਵਿੱਚ ਹਰ ਦਿਨ ਇੱਕ ਨਿਸ਼ਚਿਤ ਗਿਣਤੀ ਵਿੱਚ ਦ੍ਰਿਸ਼ ਸਹਾਇਕ ਸ਼ਾਮਲ ਹਨ। ਤੁਹਾਡੇ ਚਿੱਤਰ ਕੱਲ੍ਹ ਦੁਬਾਰਾ ਉਪਲਬਧ ਹੋਣਗੇ, ਜਾਂ ਤੁਸੀਂ ਉੱਚ ਯੋਜਨਾ \'ਤੇ ਰੋਜ਼ਾਨਾ ਸੀਮਾ ਵਧਾ ਸਕਦੇ ਹੋ।';

  @override
  String get visualAidLimitTitle => 'ਤੁਸੀਂ ਆਪਣੀ ਸੀਮਾ \'ਤੇ ਪਹੁੰਚ ਗਏ ਹੋ';

  @override
  String get visualAidLimitBody =>
      'ਤੁਸੀਂ ਇਸ ਮਹੀਨੇ ਦੇ ਆਪਣੇ ਦ੍ਰਿਸ਼ ਸਹਾਇਕ ਵਰਤ ਲਏ ਹਨ। ਤੁਹਾਡੇ ਚਿੱਤਰ ਅਗਲੇ ਮਹੀਨੇ ਦੁਬਾਰਾ ਉਪਲਬਧ ਹੋਣਗੇ, ਜਾਂ ਤੁਸੀਂ ਉੱਚ ਯੋਜਨਾ \'ਤੇ ਸੀਮਾ ਵਧਾ ਸਕਦੇ ਹੋ।';

  @override
  String get visualAidRephrase =>
      'ਅਸੀਂ ਉਹ ਚਿੱਤਰ ਨਹੀਂ ਬਣਾ ਸਕੇ। ਕਿਰਪਾ ਕਰਕੇ ਇਸ ਨੂੰ ਦੁਬਾਰਾ ਲਿਖੋ ਅਤੇ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get visualAidEmptyGeneration =>
      'ਚਿੱਤਰ ਖਾਲੀ ਆਇਆ। ਘੱਟ ਲੇਬਲਾਂ ਨਾਲ ਵਰਣਨ ਕਰਨ ਦੀ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get visualAidBusy =>
      'ਸਹਾਇਕ ਇਸ ਵੇਲੇ ਵਿਅਸਤ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String visualAidBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'ਸਹਾਇਕ ਇਸ ਵੇਲੇ ਵਿਅਸਤ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਲਗਭਗ $seconds ਸਕਿੰਟਾਂ ਵਿੱਚ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
      one:
          'ਸਹਾਇਕ ਇਸ ਵੇਲੇ ਵਿਅਸਤ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਲਗਭਗ 1 ਸਕਿੰਟ ਵਿੱਚ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    );
    return '$_temp0';
  }

  @override
  String get visualAidTimeout =>
      'ਇਸ ਵਿੱਚ ਉਮੀਦ ਤੋਂ ਵੱਧ ਸਮਾਂ ਲੱਗ ਰਿਹਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get videoStorytellerTitle => 'ਵੀਡੀਓ ਕਹਾਣੀਕਾਰ';

  @override
  String get videoStorytellerSubtitle => 'ਸਿੱਖਿਆ ਵੀਡੀਓ ਲੱਭੋ';

  @override
  String get videoStorytellerEmpty =>
      'ਕੋਈ ਵਿਸ਼ਾ ਜਾਂ ਟੌਪਿਕ ਚੁਣੋ ਅਤੇ ਵੀਡੀਓ ਲੱਭੋ \'ਤੇ ਟੈਪ ਕਰੋ।';

  @override
  String get videoStorytellerTopicLabel => 'ਟੌਪਿਕ ਜਾਂ ਅਧਿਆਇ';

  @override
  String get videoStorytellerTopicHint => 'ਉਦਾਹਰਨ ਲਈ, ਜਲ ਚੱਕਰ';

  @override
  String get videoStorytellerSubjectLabel => 'ਵਿਸ਼ਾ';

  @override
  String get videoStorytellerSubjectAny => 'ਕੋਈ ਵੀ ਵਿਸ਼ਾ';

  @override
  String get videoStorytellerGradeLabel => 'ਜਮਾਤ ਪੱਧਰ';

  @override
  String get videoStorytellerGradeAny => 'ਕੋਈ ਵੀ ਜਮਾਤ';

  @override
  String get videoStorytellerOptional => 'ਵਿਕਲਪਿਕ';

  @override
  String get videoStorytellerAction => 'ਵੀਡੀਓ ਲੱਭੋ';

  @override
  String get videoStorytellerNoResults =>
      'ਉਸ ਲਈ ਕੋਈ ਵੀਡੀਓ ਨਹੀਂ ਮਿਲਿਆ। ਕੋਈ ਵੱਖਰਾ ਵਿਸ਼ਾ ਜਾਂ ਟੌਪਿਕ ਅਜ਼ਮਾਓ।';

  @override
  String videoStorytellerViewAll(int count) {
    return 'View all $count';
  }

  @override
  String get videoStorytellerOfficialSource => 'ਅਧਿਕਾਰਤ ਸਰੋਤ';

  @override
  String get videoStorytellerOpensExternally =>
      'ਯੂਟਿਊਬ ਵਿੱਚ, ਐਪ ਤੋਂ ਬਾਹਰ ਖੁੱਲ੍ਹਦਾ ਹੈ।';

  @override
  String get videoStorytellerCategoryTopRecommended =>
      'ਤੁਹਾਡੇ ਲਈ ਚੋਟੀ ਦੀਆਂ ਸਿਫ਼ਾਰਸ਼ਾਂ';

  @override
  String get videoStorytellerCategoryStorytelling =>
      'ਤੁਹਾਡੇ ਵਿਸ਼ਿਆਂ ਲਈ ਕਹਾਣੀ-ਕਥਨ';

  @override
  String get videoStorytellerCategoryPedagogy =>
      'ਸਿੱਖਿਆ-ਸ਼ਾਸਤਰ ਅਤੇ ਸਿਖਾਉਣ ਦੇ ਢੰਗ';

  @override
  String get videoStorytellerCategoryGovtUpdates => 'ਸਰਕਾਰੀ ਅੱਪਡੇਟ';

  @override
  String get videoStorytellerCategoryCourses => 'ਅਧਿਆਪਕ ਸਿਖਲਾਈ ਕੋਰਸ';

  @override
  String get videoStorytellerSignIn =>
      'ਇਸ ਸੰਦ ਦੀ ਵਰਤੋਂ ਕਰਨ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਸਾਈਨ ਇਨ ਕਰੋ।';

  @override
  String get videoStorytellerTimeout =>
      'ਇਸ ਵਿੱਚ ਉਮੀਦ ਤੋਂ ਵੱਧ ਸਮਾਂ ਲੱਗ ਰਿਹਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get videoStorytellerBusy =>
      'ਸਹਾਇਕ ਇਸ ਵੇਲੇ ਵਿਅਸਤ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String videoStorytellerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'ਸਹਾਇਕ ਇਸ ਵੇਲੇ ਵਿਅਸਤ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਲਗਭਗ $seconds ਸਕਿੰਟਾਂ ਵਿੱਚ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
      one:
          'ਸਹਾਇਕ ਇਸ ਵੇਲੇ ਵਿਅਸਤ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਲਗਭਗ 1 ਸਕਿੰਟ ਵਿੱਚ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    );
    return '$_temp0';
  }

  @override
  String get videoStorytellerRephrase =>
      'ਅਸੀਂ ਉਸ ਲਈ ਵੀਡੀਓ ਨਹੀਂ ਲੱਭ ਸਕੇ। ਕਿਰਪਾ ਕਰਕੇ ਕੋਈ ਵੱਖਰਾ ਟੌਪਿਕ ਅਜ਼ਮਾਓ।';

  @override
  String get videoStorytellerLimit =>
      'ਤੁਸੀਂ ਹਾਲ ਹੀ ਵਿੱਚ ਬਹੁਤ ਖੋਜ ਕੀਤੀ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get actionDone => 'ਹੋ ਗਿਆ';

  @override
  String get virtualFieldTripTitle => 'ਵਰਚੁਅਲ ਫੀਲਡ ਟ੍ਰਿਪ';

  @override
  String get virtualFieldTripSubtitle => 'Google Earth \'ਤੇ ਦੁਨੀਆ ਦੀ ਸੈਰ ਕਰੋ';

  @override
  String get virtualFieldTripEmpty =>
      'ਇੱਕ ਵਿਸ਼ਾ ਦਾਖਲ ਕਰੋ ਅਤੇ \'ਯਾਤਰਾ ਦੀ ਯੋਜਨਾ ਬਣਾਓ\' \'ਤੇ ਟੈਪ ਕਰੋ।';

  @override
  String get virtualFieldTripTopicLabel => 'ਵਿਸ਼ਾ ਜਾਂ ਥੀਮ';

  @override
  String get virtualFieldTripTopicHint => 'ਉਦਾਹਰਨ ਲਈ, ਗ੍ਰੇਟ ਬੈਰੀਅਰ ਰੀਫ';

  @override
  String get virtualFieldTripTopicError =>
      'ਕਿਰਪਾ ਕਰਕੇ ਯਾਤਰਾ ਲਈ ਇੱਕ ਵਿਸ਼ਾ ਦਾਖਲ ਕਰੋ।';

  @override
  String get virtualFieldTripGradeLabel => 'ਜਮਾਤ ਪੱਧਰ';

  @override
  String get virtualFieldTripGradeAny => 'ਕੋਈ ਵੀ ਜਮਾਤ';

  @override
  String get virtualFieldTripOptional => 'ਵਿਕਲਪਿਕ';

  @override
  String get virtualFieldTripAction => 'ਯਾਤਰਾ ਦੀ ਯੋਜਨਾ ਬਣਾਓ';

  @override
  String get virtualFieldTripDocType => 'ਵਰਚੁਅਲ ਫੀਲਡ ਟ੍ਰਿਪ';

  @override
  String virtualFieldTripStopCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ਪੜਾਅ',
      one: '1 ਪੜਾਅ',
    );
    return '$_temp0';
  }

  @override
  String virtualFieldTripStopSemantics(int number, String name) {
    return 'ਪੜਾਅ $number: $name';
  }

  @override
  String get virtualFieldTripFactLabel => 'ਕੀ ਤੁਹਾਨੂੰ ਪਤਾ ਹੈ?';

  @override
  String get virtualFieldTripReflectionLabel => 'ਇਸ ਬਾਰੇ ਸੋਚੋ';

  @override
  String get virtualFieldTripAnalogyLabel => 'ਸਾਡੇ ਸੰਦਰਭ ਵਿੱਚ';

  @override
  String get virtualFieldTripExplanationLabel => 'ਅਸੀਂ ਇੱਥੇ ਕਿਉਂ ਜਾਂਦੇ ਹਾਂ';

  @override
  String get virtualFieldTripOpenEarth => 'Google Earth ਵਿੱਚ ਖੋਲ੍ਹੋ';

  @override
  String get virtualFieldTripOpensExternally =>
      'ਐਪ ਤੋਂ ਬਾਹਰ, Google Earth ਵਿੱਚ ਖੁੱਲ੍ਹਦਾ ਹੈ।';

  @override
  String get virtualFieldTripPendingTitle =>
      'ਤੁਹਾਡੀ ਯਾਤਰਾ ਦੀ ਯੋਜਨਾ ਅਜੇ ਵੀ ਬਣ ਰਹੀ ਹੈ';

  @override
  String get virtualFieldTripPendingBody =>
      'ਤੁਹਾਡੀ ਫੀਲਡ ਟ੍ਰਿਪ ਅਜੇ ਵੀ ਤਿਆਰ ਹੋ ਰਹੀ ਹੈ। ਇੱਕ ਮਿੰਟ ਵਿੱਚ \'ਮੇਰੀ ਲਾਇਬ੍ਰੇਰੀ\' ਵੇਖੋ।';

  @override
  String get virtualFieldTripNoStops =>
      'ਇਸ ਲਈ ਕੋਈ ਪੜਾਅ ਨਹੀਂ ਮਿਲੇ। ਕੋਈ ਹੋਰ ਵਿਸ਼ਾ ਅਜ਼ਮਾਓ।';

  @override
  String get virtualFieldTripSignIn =>
      'ਇਸ ਟੂਲ ਦੀ ਵਰਤੋਂ ਕਰਨ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਸਾਈਨ ਇਨ ਕਰੋ।';

  @override
  String get virtualFieldTripUnavailable =>
      'ਇਹ ਟੂਲ ਤੁਹਾਡੇ ਮੌਜੂਦਾ ਪਲਾਨ ਦਾ ਹਿੱਸਾ ਨਹੀਂ ਹੈ।';

  @override
  String get virtualFieldTripTimeout =>
      'ਇਸ ਵਿੱਚ ਉਮੀਦ ਤੋਂ ਵੱਧ ਸਮਾਂ ਲੱਗ ਰਿਹਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get virtualFieldTripBusy =>
      'ਸਹਾਇਕ ਇਸ ਵੇਲੇ ਰੁੱਝਿਆ ਹੋਇਆ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String virtualFieldTripBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'ਸਹਾਇਕ ਇਸ ਵੇਲੇ ਰੁੱਝਿਆ ਹੋਇਆ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਲਗਭਗ $seconds ਸਕਿੰਟ ਬਾਅਦ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
      one:
          'ਸਹਾਇਕ ਇਸ ਵੇਲੇ ਰੁੱਝਿਆ ਹੋਇਆ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਲਗਭਗ 1 ਸਕਿੰਟ ਬਾਅਦ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    );
    return '$_temp0';
  }

  @override
  String get virtualFieldTripRephrase =>
      'ਅਸੀਂ ਇਸ ਲਈ ਯਾਤਰਾ ਦੀ ਯੋਜਨਾ ਨਹੀਂ ਬਣਾ ਸਕੇ। ਕਿਰਪਾ ਕਰਕੇ ਕੋਈ ਹੋਰ ਵਿਸ਼ਾ ਅਜ਼ਮਾਓ।';

  @override
  String get virtualFieldTripLimit =>
      'ਤੁਸੀਂ ਹਾਲ ਹੀ ਵਿੱਚ ਬਹੁਤ ਸਾਰੀਆਂ ਯਾਤਰਾਵਾਂ ਦੀ ਯੋਜਨਾ ਬਣਾਈ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get assessmentScannerTitle => 'ਮੁਲਾਂਕਣ ਸਕੈਨਰ';

  @override
  String get assessmentScannerSubtitle =>
      'ਵਿਦਿਆਰਥੀ ਦੀ ਉੱਤਰ-ਕਾਪੀ ਸਫ਼ਾ-ਦਰ-ਸਫ਼ਾ ਜਾਂਚੋ';

  @override
  String get assessmentScannerEmpty =>
      'ਉੱਤਰ-ਕਾਪੀ ਦੀਆਂ 3 ਤੱਕ ਫੋਟੋਆਂ ਸ਼ਾਮਲ ਕਰੋ, ਫਿਰ ਜਾਂਚੋ ਦਬਾਓ।';

  @override
  String get assessmentScannerSubmit => 'ਉੱਤਰ-ਕਾਪੀ ਜਾਂਚੋ';

  @override
  String get assessmentScannerResultTitle => 'ਮੁਲਾਂਕਣ';

  @override
  String get assessmentScannerSectionSheet => 'ਉੱਤਰ-ਕਾਪੀ';

  @override
  String get assessmentScannerPagesLabel => 'ਉੱਤਰ-ਕਾਪੀ ਦੇ ਸਫ਼ੇ';

  @override
  String get assessmentScannerPagesHint =>
      '3 ਤੱਕ ਸਾਫ਼ ਫੋਟੋਆਂ ਸ਼ਾਮਲ ਕਰੋ, ਹਰ ਸਫ਼ੇ ਦੀ ਇੱਕ।';

  @override
  String get assessmentScannerPagesEmpty => 'ਪਹਿਲੇ ਸਫ਼ੇ ਦੀ ਇੱਕ ਫੋਟੋ ਸ਼ਾਮਲ ਕਰੋ।';

  @override
  String assessmentScannerPageLabel(int number) {
    return 'ਸਫ਼ਾ $number';
  }

  @override
  String assessmentScannerRemovePage(int number) {
    return 'ਸਫ਼ਾ $number ਹਟਾਓ';
  }

  @override
  String assessmentScannerPageCounter(int count, int max) {
    return '$max ਵਿੱਚੋਂ $count ਸਫ਼ੇ';
  }

  @override
  String assessmentScannerPagesFull(int max) {
    return 'ਤੁਸੀਂ $max ਤੱਕ ਸਫ਼ੇ ਸ਼ਾਮਲ ਕਰ ਸਕਦੇ ਹੋ।';
  }

  @override
  String get assessmentScannerTakePhoto => 'ਫੋਟੋ ਖਿੱਚੋ';

  @override
  String get assessmentScannerChooseGallery => 'ਗੈਲਰੀ ਵਿੱਚੋਂ ਚੁਣੋ';

  @override
  String get assessmentScannerSubjectLabel => 'ਵਿਸ਼ਾ';

  @override
  String get assessmentScannerSubjectHint => 'ਮੁਲਾਂਕਣ ਵਿਸ਼ੇ ਅਨੁਸਾਰ ਹੁੰਦਾ ਹੈ।';

  @override
  String get assessmentScannerSubjectPlaceholder => 'ਵਿਸ਼ਾ ਚੁਣੋ';

  @override
  String get assessmentScannerSubjectError => 'ਕਿਰਪਾ ਕਰਕੇ ਵਿਸ਼ਾ ਚੁਣੋ।';

  @override
  String get assessmentScannerGradeLabel => 'ਜਮਾਤ ਪੱਧਰ';

  @override
  String get assessmentScannerGradePlaceholder => 'ਜਮਾਤ ਚੁਣੋ';

  @override
  String get assessmentScannerGradeError => 'ਕਿਰਪਾ ਕਰਕੇ ਜਮਾਤ ਚੁਣੋ।';

  @override
  String get assessmentScannerOptional => 'ਵਿਕਲਪਿਕ';

  @override
  String get assessmentScannerAnswerKeyLabel => 'ਉੱਤਰ-ਕੁੰਜੀ';

  @override
  String get assessmentScannerAnswerKeyHint =>
      'ਸਹੀ ਉੱਤਰ ਪੇਸਟ ਕਰੋ, ਉਹਨਾਂ ਅਨੁਸਾਰ ਜਾਂਚ ਹੋਵੇਗੀ।';

  @override
  String get assessmentScannerAnswerKeyPlaceholder =>
      'ਉੱਤਰ-ਕੁੰਜੀ ਟਾਈਪ ਜਾਂ ਪੇਸਟ ਕਰੋ';

  @override
  String get assessmentScannerPrivacyNote =>
      'ਜਾਂਚ ਲਈ ਵਿਦਿਆਰਥੀ ਦਾ ਨਾਂ ਕਦੇ ਨਹੀਂ ਭੇਜਿਆ ਜਾਂਦਾ।';

  @override
  String assessmentScannerScoreCaption(String awarded, String max) {
    return '$max ਵਿੱਚੋਂ $awarded ਅੰਕ';
  }

  @override
  String get assessmentScannerScoreOutOf => '100 ਵਿੱਚੋਂ';

  @override
  String assessmentScannerMarks(String awarded, String max) {
    return '$awarded/$max';
  }

  @override
  String assessmentScannerPagesMeta(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ਸਫ਼ੇ',
      one: '1 ਸਫ਼ਾ',
    );
    return '$_temp0';
  }

  @override
  String assessmentScannerReviewBadge(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ਜਾਂਚੋ',
      one: '1 ਜਾਂਚੋ',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerQuestionsSection => 'ਸਵਾਲ-ਦਰ-ਸਵਾਲ';

  @override
  String get assessmentScannerStudentAnswerLabel => 'ਵਿਦਿਆਰਥੀ ਨੇ ਲਿਖਿਆ';

  @override
  String get assessmentScannerFeedbackLabel => 'ਫੀਡਬੈਕ';

  @override
  String get assessmentScannerExpectedLabel => 'ਸੰਭਾਵਿਤ ਉੱਤਰ';

  @override
  String get assessmentScannerNextStepsSection => 'ਸਿਫ਼ਾਰਸ਼ ਕੀਤੇ ਅਗਲੇ ਕਦਮ';

  @override
  String get assessmentScannerStudentSection => 'ਵਿਦਿਆਰਥੀ ਲਈ';

  @override
  String get assessmentScannerQualitySection => 'ਫੋਟੋ ਗੁਣਵੱਤਾ';

  @override
  String get assessmentScannerNotScored => 'ਅੰਕ ਨਹੀਂ ਦਿੱਤੇ';

  @override
  String get assessmentScannerNoContent =>
      'ਕੋਈ ਅੰਕ ਨਹੀਂ ਆਏ। ਕਿਰਪਾ ਕਰਕੇ ਸਾਫ਼ ਫੋਟੋਆਂ ਅਜ਼ਮਾਓ।';

  @override
  String get assessmentScannerOutcomeCorrect => 'ਸਹੀ';

  @override
  String get assessmentScannerOutcomePartial => 'ਅੰਸ਼ਕ ਸਹੀ';

  @override
  String get assessmentScannerOutcomeIncorrect => 'ਗਲਤ';

  @override
  String get assessmentScannerReviewChip => 'ਇਸ ਨੂੰ ਜਾਂਚੋ';

  @override
  String get assessmentScannerSignIn =>
      'ਉੱਤਰ-ਕਾਪੀ ਜਾਂਚਣ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਸਾਈਨ ਇਨ ਕਰੋ।';

  @override
  String get assessmentScannerUpgradeTitle => 'ਉੱਚੀ ਯੋਜਨਾ ਲੋੜੀਂਦੀ ਹੈ';

  @override
  String get assessmentScannerUpgradeBody =>
      'ਉੱਤਰ-ਕਾਪੀਆਂ ਜਾਂਚਣੀਆਂ ਉੱਚੀ ਯੋਜਨਾ ਦਾ ਹਿੱਸਾ ਹਨ। ਜਾਂਚ ਜਾਰੀ ਰੱਖਣ ਲਈ ਅੱਪਗ੍ਰੇਡ ਕਰੋ।';

  @override
  String get assessmentScannerSeePricing => 'ਯੋਜਨਾਵਾਂ ਵੇਖੋ';

  @override
  String get assessmentScannerDailyLimitTitle =>
      'ਅੱਜ ਲਈ ਤੁਹਾਡੀਆਂ ਸਾਰੀਆਂ ਉੱਤਰ-ਕਾਪੀਆਂ ਪੂਰੀਆਂ ਹੋ ਗਈਆਂ';

  @override
  String get assessmentScannerDailyLimitBody =>
      'ਤੁਹਾਡੀ ਯੋਜਨਾ ਵਿੱਚ ਹਰ ਦਿਨ ਨਿਸ਼ਚਿਤ ਗਿਣਤੀ ਵਿੱਚ ਉੱਤਰ-ਕਾਪੀਆਂ ਹਨ। ਇਹ ਕੱਲ੍ਹ ਦੁਬਾਰਾ ਸ਼ੁਰੂ ਹੋਣਗੀਆਂ, ਜਾਂ ਉੱਚੀ ਯੋਜਨਾ ਵਿੱਚ ਹੱਦ ਵਧਾ ਸਕਦੇ ਹੋ।';

  @override
  String get assessmentScannerLimitTitle =>
      'ਤੁਸੀਂ ਆਪਣੀ ਜਾਂਚ ਹੱਦ ਤੱਕ ਪਹੁੰਚ ਗਏ ਹੋ';

  @override
  String get assessmentScannerLimitBody =>
      'ਤੁਸੀਂ ਆਪਣੀ ਯੋਜਨਾ ਦੀਆਂ ਸਾਰੀਆਂ ਉੱਤਰ-ਕਾਪੀਆਂ ਵਰਤ ਲਈਆਂ ਹਨ। ਇਹ ਅਗਲੇ ਮਹੀਨੇ ਦੁਬਾਰਾ ਸ਼ੁਰੂ ਹੋਣਗੀਆਂ, ਜਾਂ ਉੱਚੀ ਯੋਜਨਾ ਵਿੱਚ ਹੱਦ ਵਧਾ ਸਕਦੇ ਹੋ।';

  @override
  String get assessmentScannerBusy =>
      'ਜਾਂਚ ਮਾਡਲ ਇਸ ਵੇਲੇ ਰੁੱਝਿਆ ਹੋਇਆ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਮਿੰਟ ਵਿੱਚ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String assessmentScannerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'ਜਾਂਚ ਮਾਡਲ ਇਸ ਵੇਲੇ ਰੁੱਝਿਆ ਹੋਇਆ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਲਗਭਗ $seconds ਸਕਿੰਟਾਂ ਵਿੱਚ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
      one:
          'ਜਾਂਚ ਮਾਡਲ ਇਸ ਵੇਲੇ ਰੁੱਝਿਆ ਹੋਇਆ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਲਗਭਗ 1 ਸਕਿੰਟ ਵਿੱਚ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerTimeout =>
      'ਜਾਂਚ ਵਿੱਚ ਆਮ ਨਾਲੋਂ ਵੱਧ ਸਮਾਂ ਲੱਗ ਰਿਹਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get assessmentScannerRephrase =>
      'ਫੋਟੋਆਂ ਜਾਂਚੀਆਂ ਨਹੀਂ ਜਾ ਸਕੀਆਂ। ਕਿਰਪਾ ਕਰਕੇ ਸਾਫ਼ ਸਫ਼ੇ ਦੁਬਾਰਾ ਅੱਪਲੋਡ ਕਰੋ।';

  @override
  String get inboxTitle => 'ਸੁਨੇਹੇ';

  @override
  String get inboxSignInTitle => 'ਤੁਹਾਡੇ ਸੁਨੇਹੇ';

  @override
  String get inboxSignInBody => 'ਆਪਣੇ ਸੁਨੇਹੇ ਵੇਖਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ';

  @override
  String get inboxEmptyTitle => 'ਹਾਲੇ ਕੋਈ ਗੱਲਬਾਤ ਨਹੀਂ';

  @override
  String get inboxEmptyBody =>
      'ਜਦੋਂ ਤੁਸੀਂ ਅਧਿਆਪਕਾਂ ਨਾਲ ਜੁੜੋਗੇ, ਤਾਂ ਤੁਹਾਡੀਆਂ ਗੱਲਬਾਤਾਂ ਇੱਥੇ ਦਿਖਣਗੀਆਂ।';

  @override
  String get inboxErrorBody =>
      'ਅਸੀਂ ਤੁਹਾਡੇ ਸੁਨੇਹੇ ਲੋਡ ਨਹੀਂ ਕਰ ਸਕੇ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get inboxNoMessagesYet => 'ਹਾਲੇ ਕੋਈ ਸੁਨੇਹਾ ਨਹੀਂ';

  @override
  String get inboxThreadFallbackTitle => 'ਗੱਲਬਾਤ';

  @override
  String get inboxThreadEmptyTitle => 'ਹਾਲੇ ਕੋਈ ਸੁਨੇਹਾ ਨਹੀਂ';

  @override
  String get inboxThreadEmptyBody => 'ਗੱਲਬਾਤ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਕਹੋ।';

  @override
  String get inboxComposerHint => 'ਇੱਕ ਸੁਨੇਹਾ ਲਿਖੋ';

  @override
  String get inboxComposerSend => 'ਭੇਜੋ';

  @override
  String get inboxComposerTooLong => 'Message too long. Please shorten it.';

  @override
  String get inboxLoadOlder => 'ਪੁਰਾਣੇ ਸੁਨੇਹੇ ਲੋਡ ਕਰੋ';

  @override
  String get inboxSendFailed => 'ਤੁਹਾਡਾ ਸੁਨੇਹਾ ਭੇਜਿਆ ਨਹੀਂ ਜਾ ਸਕਿਆ।';

  @override
  String get inboxResourceLabel => 'ਸਰੋਤ';

  @override
  String get inboxVoiceNoteLabel => 'ਵੌਇਸ ਨੋਟ';

  @override
  String inboxUnreadLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ਅਣਪੜ੍ਹੇ',
      one: '1 ਅਣਪੜ੍ਹਿਆ',
    );
    return '$_temp0';
  }

  @override
  String get inboxTickSending => 'ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ';

  @override
  String get inboxTickSent => 'ਭੇਜਿਆ ਗਿਆ';

  @override
  String get inboxTickDelivered => 'ਪਹੁੰਚ ਗਿਆ';

  @override
  String get inboxTickRead => 'ਪੜ੍ਹਿਆ ਗਿਆ';

  @override
  String get inboxTickFailed => 'ਭੇਜਿਆ ਨਹੀਂ ਗਿਆ';

  @override
  String get inboxTimeNow => 'ਹੁਣੇ';

  @override
  String inboxTimeMinutes(int count) {
    return '$count ਮਿ';
  }

  @override
  String inboxTimeHours(int count) {
    return '$count ਘੰ';
  }

  @override
  String inboxTimeDays(int count) {
    return '$count ਦਿ';
  }

  @override
  String inboxTimeWeeks(int count) {
    return '$count ਹਫ਼';
  }

  @override
  String get networkTitle => 'ਨੈੱਟਵਰਕ';

  @override
  String get networkTooltip => 'ਨੈੱਟਵਰਕ';

  @override
  String get networkTabStaffroom => 'ਸਟਾਫ਼ਰੂਮ';

  @override
  String get networkTabMessages => 'ਸੁਨੇਹੇ';

  @override
  String get staffroomTitle => 'ਸਟਾਫ਼ਰੂਮ';

  @override
  String get staffroomHeroTitle => 'ਸਟਾਫ਼ਰੂਮ';

  @override
  String get staffroomHeroDeck => 'ਪੂਰੇ ਭਾਰਤ ਦੇ ਅਧਿਆਪਕ, ਇੱਕੋ ਕਮਰੇ ਵਿੱਚ';

  @override
  String get staffroomSectionGroups => 'ਤੁਹਾਡੇ ਗਰੁੱਪ';

  @override
  String get staffroomSectionFeed => 'ਤੁਹਾਡੇ ਗਰੁੱਪਾਂ ਤੋਂ';

  @override
  String get staffroomSectionDiscover => 'ਗਰੁੱਪ ਲੱਭੋ';

  @override
  String get staffroomSectionPeople => 'ਜਿਨ੍ਹਾਂ ਨੂੰ ਤੁਸੀਂ ਜਾਣਦੇ ਹੋ ਸਕਦੇ ਹੋ';

  @override
  String get staffroomSignInTitle => 'ਸਟਾਫ਼ਰੂਮ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ';

  @override
  String get staffroomSignInBody => 'ਸਟਾਫ਼ਰੂਮ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ';

  @override
  String get staffroomFeedEmptyTitle => 'ਤੁਹਾਡੀ ਫੀਡ ਸ਼ਾਂਤ ਹੈ';

  @override
  String get staffroomFeedEmptyBody =>
      'ਤੁਹਾਡੇ ਗਰੁੱਪਾਂ ਦੀਆਂ ਪੋਸਟਾਂ ਇੱਥੇ ਦਿਖਾਈ ਦੇਣਗੀਆਂ।';

  @override
  String get staffroomErrorBody =>
      'ਅਸੀਂ ਸਟਾਫ਼ਰੂਮ ਲੋਡ ਨਹੀਂ ਕਰ ਸਕੇ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get staffroomGroupsEmptyTitle => 'ਹਾਲੇ ਕੋਈ ਗਰੁੱਪ ਨਹੀਂ';

  @override
  String get staffroomGroupsEmptyBody =>
      'ਪੋਸਟਾਂ ਅਤੇ ਚੈਟ ਵੇਖਣ ਲਈ ਕਿਸੇ ਗਰੁੱਪ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ।';

  @override
  String get staffroomBrowseGroups => 'ਗਰੁੱਪ ਬ੍ਰਾਊਜ਼ ਕਰੋ';

  @override
  String staffroomMemberCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ਮੈਂਬਰ',
      one: '1 ਮੈਂਬਰ',
    );
    return '$_temp0';
  }

  @override
  String get staffroomJoin => 'ਸ਼ਾਮਲ ਹੋਵੋ';

  @override
  String get staffroomJoined => 'ਸ਼ਾਮਲ ਹੋ ਗਏ';

  @override
  String get staffroomJoinFailed =>
      'ਸ਼ਾਮਲ ਨਹੀਂ ਹੋ ਸਕੇ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਲਈ ਟੈਪ ਕਰੋ।';

  @override
  String get staffroomGroupLockedTitle => 'ਸਿਰਫ਼ ਮੈਂਬਰਾਂ ਲਈ';

  @override
  String get staffroomGroupLockedBody =>
      'ਇਸ ਗਰੁੱਪ ਦੀਆਂ ਪੋਸਟਾਂ ਵੇਖਣ ਲਈ ਸ਼ਾਮਲ ਹੋਵੋ।';

  @override
  String get staffroomGroupPostsEmptyTitle => 'ਹਾਲੇ ਕੋਈ ਪੋਸਟ ਨਹੀਂ';

  @override
  String get staffroomGroupPostsEmptyBody => 'ਇੱਥੇ ਸਭ ਤੋਂ ਪਹਿਲਾਂ ਸਾਂਝਾ ਕਰੋ।';

  @override
  String get staffroomGroupNotFoundTitle => 'ਗਰੁੱਪ ਨਹੀਂ ਮਿਲਿਆ';

  @override
  String get staffroomGroupNotFoundBody => 'ਇਹ ਗਰੁੱਪ ਹਟਾ ਦਿੱਤਾ ਗਿਆ ਹੋ ਸਕਦਾ ਹੈ।';

  @override
  String get staffroomPostTypeShare => 'ਸਾਂਝਾ ਕੀਤਾ';

  @override
  String get staffroomPostTypeAskHelp => 'ਮਦਦ ਚਾਹੀਦੀ ਹੈ';

  @override
  String get staffroomPostTypeCelebrate => 'ਜਸ਼ਨ';

  @override
  String get staffroomPostTypeResource => 'ਸਰੋਤ';

  @override
  String get staffroomLike => 'ਪਸੰਦ';

  @override
  String get staffroomLiked => 'ਪਸੰਦ ਕੀਤਾ';

  @override
  String staffroomLikeCountLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ਪਸੰਦ',
      one: '1 ਪਸੰਦ',
      zero: 'ਕੋਈ ਪਸੰਦ ਨਹੀਂ',
    );
    return '$_temp0';
  }

  @override
  String get staffroomLikeFailed =>
      'ਅੱਪਡੇਟ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਲਈ ਟੈਪ ਕਰੋ।';

  @override
  String get staffroomResourceShared => 'ਇੱਕ ਸਰੋਤ ਸਾਂਝਾ ਕੀਤਾ';

  @override
  String staffroomChatHighlight(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ਨਵੇਂ ਸੁਨੇਹੇ',
      one: '1 ਨਵਾਂ ਸੁਨੇਹਾ',
    );
    return '$_temp0';
  }

  @override
  String get staffroomConnect => 'ਕਨੈਕਟ ਕਰੋ';

  @override
  String get staffroomConnectSent => 'ਬੇਨਤੀ ਭੇਜੀ ਗਈ';

  @override
  String get staffroomConnectPending => 'ਬੇਨਤੀ ਪਹਿਲਾਂ ਹੀ ਬਕਾਇਆ ਹੈ';

  @override
  String get staffroomConnectConnected => 'ਪਹਿਲਾਂ ਹੀ ਕਨੈਕਟਡ';

  @override
  String get staffroomChatTitle => 'ਸਟਾਫ਼ਰੂਮ';

  @override
  String get staffroomChatEntryBody => 'ਪੂਰੇ ਭਾਰਤ ਦੇ ਅਧਿਆਪਕਾਂ ਨਾਲ ਗੱਲਬਾਤ ਕਰੋ';

  @override
  String get staffroomChatSignInTitle => 'ਸਟਾਫ਼ਰੂਮ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ';

  @override
  String get staffroomChatSignInBody =>
      'ਸਟਾਫ਼ਰੂਮ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ';

  @override
  String get staffroomChatEmptyTitle => 'ਹਾਲੇ ਤੱਕ ਕੋਈ ਸੁਨੇਹਾ ਨਹੀਂ';

  @override
  String get staffroomChatEmptyBody => 'ਸਭ ਤੋਂ ਪਹਿਲਾਂ ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਕਹੋ।';

  @override
  String get staffroomChatAiBadge => 'AI ਅਧਿਆਪਕ';

  @override
  String get staffroomGroupChatEntry => 'ਗਰੁੱਪ ਚੈਟ';

  @override
  String get staffroomDirectoryTitle => 'ਅਧਿਆਪਕ ਲੱਭੋ';

  @override
  String get staffroomDirectoryEntryBody => 'ਅਧਿਆਪਕ ਡਾਇਰੈਕਟਰੀ ਵਿੱਚ ਖੋਜੋ';

  @override
  String get staffroomDirectorySearchHint => 'ਨਾਮ ਜਾਂ ਵਿਸ਼ੇ ਦੁਆਰਾ ਖੋਜੋ';

  @override
  String get staffroomDirectoryErrorBody =>
      'ਡਾਇਰੈਕਟਰੀ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get staffroomDirectoryEmptyTitle => 'ਕੋਈ ਅਧਿਆਪਕ ਨਹੀਂ ਮਿਲਿਆ';

  @override
  String get staffroomDirectoryEmptyBody =>
      'ਦਿਖਾਉਣ ਲਈ ਹਾਲੇ ਕੋਈ ਅਧਿਆਪਕ ਨਹੀਂ ਹੈ।';

  @override
  String get staffroomDirectorySearchEmpty =>
      'ਤੁਹਾਡੀ ਖੋਜ ਨਾਲ ਕੋਈ ਅਧਿਆਪਕ ਮੇਲ ਨਹੀਂ ਖਾਂਦਾ।';

  @override
  String get staffroomProfileTitle => 'ਅਧਿਆਪਕ';

  @override
  String get staffroomProfileErrorBody =>
      'ਇਹ ਪ੍ਰੋਫਾਈਲ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।';

  @override
  String get staffroomProfileNotFoundTitle => 'ਪ੍ਰੋਫਾਈਲ ਉਪਲਬਧ ਨਹੀਂ';

  @override
  String get staffroomProfileNotFoundBody => 'ਇਹ ਪ੍ਰੋਫਾਈਲ ਨਹੀਂ ਮਿਲੀ।';

  @override
  String get staffroomProfileAboutLabel => 'ਜਾਣ-ਪਛਾਣ';

  @override
  String get staffroomProfileBioEmpty => 'ਹਾਲੇ ਕੋਈ ਜਾਣ-ਪਛਾਣ ਨਹੀਂ ਹੈ।';

  @override
  String get staffroomProfileVerified => 'ਪੁਸ਼ਟੀ ਕੀਤੀ';

  @override
  String staffroomProfileExperience(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ਸਾਲ ਦਾ ਤਜਰਬਾ',
      one: '1 ਸਾਲ ਦਾ ਤਜਰਬਾ',
    );
    return '$_temp0';
  }

  @override
  String get staffroomProfileSubjectsLabel => 'ਵਿਸ਼ੇ';

  @override
  String get staffroomProfileClassesLabel => 'ਜਮਾਤਾਂ';

  @override
  String get staffroomProfileLanguagesLabel => 'ਭਾਸ਼ਾਵਾਂ';

  @override
  String get staffroomRequested => 'ਬੇਨਤੀ ਭੇਜੀ';

  @override
  String get staffroomConnectionAccept => 'ਸਵੀਕਾਰ ਕਰੋ';

  @override
  String get staffroomConnectionDecline => 'ਰੱਦ ਕਰੋ';

  @override
  String get staffroomConnected => 'ਕਨੈਕਟ ਹੋ ਗਏ';

  @override
  String get staffroomConnectionWants => 'ਕਨੈਕਟ ਹੋਣਾ ਚਾਹੁੰਦੇ ਹਨ';

  @override
  String get staffroomMessage => 'ਸੁਨੇਹਾ ਭੇਜੋ';

  @override
  String get staffroomConnectToMessage => 'ਸੁਨੇਹਾ ਭੇਜਣ ਲਈ ਕਨੈਕਟ ਕਰੋ';

  @override
  String get staffroomConnectionFailed =>
      'ਅੱਪਡੇਟ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਲਈ ਟੈਪ ਕਰੋ।';

  @override
  String get staffroomDisconnect => 'ਡਿਸਕਨੈਕਟ ਕਰੋ';

  @override
  String get staffroomDisconnectConfirmTitle => 'ਡਿਸਕਨੈਕਟ ਕਰਨਾ ਹੈ?';

  @override
  String get staffroomDisconnectConfirmBody =>
      'ਤੁਸੀਂ ਹੁਣ ਕਨੈਕਟ ਨਹੀਂ ਰਹੋਗੇ ਜਾਂ ਇੱਕ-ਦੂਜੇ ਨੂੰ ਸੁਨੇਹਾ ਨਹੀਂ ਭੇਜ ਸਕੋਗੇ।';

  @override
  String get staffroomDisconnectCancel => 'ਕਨੈਕਟ ਰਹੋ';

  @override
  String get staffroomFollow => 'ਫਾਲੋ ਕਰੋ';

  @override
  String get staffroomFollowing => 'ਫਾਲੋ ਕਰ ਰਹੇ ਹੋ';

  @override
  String get staffroomFollowFailed =>
      'ਅੱਪਡੇਟ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਲਈ ਟੈਪ ਕਰੋ।';
}
