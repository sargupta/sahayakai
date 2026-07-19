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
  String get loginGoogle => 'Continue with Google';

  @override
  String get loginPrivacyNote =>
      'We use your Google account only to sign you in. Your work stays yours.';

  @override
  String get loginLanguagePrompt => 'Choose your language';

  @override
  String get loginLanguageHint =>
      'SahayakAI works in your language, and writes your teaching material in it too.';

  @override
  String get loginValueLessons => 'Plan a full lesson in minutes';

  @override
  String get loginValueQuizzes => 'Build a quiz at three difficulty levels';

  @override
  String get loginValueAnswers =>
      'Answer any classroom question, in your language';

  @override
  String get onboardingTitle => 'Set up SahayakAI';

  @override
  String get onboardingSkip => 'Skip for now';

  @override
  String onboardingStepLabel(int current, int total) {
    return 'Step $current of $total';
  }

  @override
  String get onboardingBack => 'Back';

  @override
  String get onboardingNext => 'Next';

  @override
  String get onboardingSaveAndContinue => 'Save and continue';

  @override
  String get onboardingFinish => 'Go to my dashboard';

  @override
  String get onboardingLanguageTitle => 'Which language do you teach in?';

  @override
  String get onboardingLanguageBody =>
      'Your lesson plans, quizzes and answers arrive in the language you choose. You can change it at any time.';

  @override
  String get onboardingProfileTitle => 'Tell us about your classroom';

  @override
  String get onboardingProfileBody =>
      'Every field is optional. What you share is used to match your material to your board, your classes and your state.';

  @override
  String get onboardingReadyTitle => 'You are ready to begin';

  @override
  String get onboardingReadyBody =>
      'Your lesson plans, quizzes and answers will match this. You can change any of it later from your profile.';

  @override
  String get onboardingSaveFailed =>
      'We could not save your profile. You can continue now and add it later from your profile.';

  @override
  String get onboardingSaveSignIn =>
      'Please sign in again to save your profile. You can continue now and add it later.';

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
  String get settingsProfileTitle => 'Teaching profile';

  @override
  String get settingsProfileHint =>
      'This helps us match your material to your board and classroom.';

  @override
  String get settingsBoardLabel => 'Education board';

  @override
  String get settingsBoardNone => 'Not set';

  @override
  String get settingsQualificationsLabel => 'Qualifications';

  @override
  String get settingsQualificationsHint =>
      'Choose every qualification you hold.';

  @override
  String get settingsAdminRoleLabel => 'Administrative role';

  @override
  String get settingsAdminRoleNone => 'Not set';

  @override
  String get settingsRoleHod => 'Head of Department (HoD)';

  @override
  String get settingsRoleCoordinator => 'Academic Coordinator';

  @override
  String get settingsRoleExamController => 'Exam Controller';

  @override
  String get settingsRoleVicePrincipal => 'Vice Principal';

  @override
  String get settingsRolePrincipal => 'Principal';

  @override
  String get settingsRoleNone => 'Teacher, no administrative role';

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
  String get profileSectionAbout => 'About you';

  @override
  String get profileSectionTeaching => 'What you teach';

  @override
  String get profileSectionLocation => 'Where you teach';

  @override
  String get profileSectionContact => 'How we reach you';

  @override
  String get profileNameLabel => 'Your name';

  @override
  String get profileNameHint =>
      'This is the name other teachers see on work you share.';

  @override
  String get profileNameInvalid => 'Please use a shorter name.';

  @override
  String get profileSchoolLabel => 'School name';

  @override
  String get profileBoardCategoryLabel => 'Board type';

  @override
  String get profileBoardCategoryHint =>
      'Choose a board type to shorten the list below.';

  @override
  String get profileBoardCategoryState => 'State board';

  @override
  String get profileStateLabel => 'State';

  @override
  String get profileStateNone => 'Not set';

  @override
  String get profileDistrictLabel => 'District';

  @override
  String get profileDistrictHint => 'The district your school is in.';

  @override
  String get profileSubjectsLabel => 'Subjects you teach';

  @override
  String get profileSubjectsHint => 'Choose as many as you need.';

  @override
  String get profileGradesLabel => 'Classes you teach';

  @override
  String get profileGradesHint => 'Choose as many as you need.';

  @override
  String get profileLanguageHint =>
      'This is the same language choice as the rest of the app, so changing it here changes it everywhere.';

  @override
  String get profilePhoneLabel => 'Mobile number';

  @override
  String get profilePhoneHint => 'Optional. Ten digits, with or without +91.';

  @override
  String get profilePhoneInvalid =>
      'Please enter a ten digit Indian mobile number.';

  @override
  String get profilePincodeLabel => 'PIN code';

  @override
  String get profilePincodeHint => 'Optional. Six digits.';

  @override
  String get profilePincodeInvalid => 'Please enter a six digit PIN code.';

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
  String get vidyaLimitTitle => 'ਤੁਸੀਂ ਅੱਜ ਦੀ ਵੌਇਸ ਸੀਮਾ ਤੱਕ ਪਹੁੰਚ ਗਏ ਹੋ';

  @override
  String get vidyaLimitBody =>
      'ਤੁਹਾਡੇ ਵੌਇਸ ਮਿੰਟ ਦੁਬਾਰਾ ਮਿਲਣਗੇ। ਉਦੋਂ ਤੱਕ ਤੁਸੀਂ ਟੂਲ ਵਰਤ ਸਕਦੇ ਹੋ।';

  @override
  String get vidyaErrorTitle => 'ਇਹ ਪੂਰਾ ਨਹੀਂ ਹੋ ਸਕਿਆ';

  @override
  String get vidyaErrorBody =>
      'ਆਪਣਾ ਕਨੈਕਸ਼ਨ ਜਾਂਚੋ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰਨ ਲਈ ਸੀਲ \'ਤੇ ਟੈਪ ਕਰੋ।';

  @override
  String get vidyaPrepDesk => 'ਤਿਆਰੀ ਡੈਸਕ';

  @override
  String get vidyaFlowVisualAid => 'ਦ੍ਰਿਸ਼ ਸਮੱਗਰੀ';

  @override
  String get vidyaFlowVirtualFieldTrip => 'ਵਰਚੁਅਲ ਫੀਲਡ ਟ੍ਰਿਪ';

  @override
  String get vidyaFlowVideoStoryteller => 'ਵੀਡੀਓ ਕਹਾਣੀ';

  @override
  String get vidyaFieldMicLabel => 'ਬੋਲ ਕੇ ਭਰੋ';

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
}
