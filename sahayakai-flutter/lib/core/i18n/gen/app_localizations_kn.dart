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
  String get splashFailedTitle => 'We could not start the app';

  @override
  String get splashFailedBody => 'Please check your connection and try again.';

  @override
  String get loginTitle => 'SahayakAI ಗೆ ಸ್ವಾಗತ';

  @override
  String get loginSubtitle =>
      'ಪಾಠ ಯೋಜನೆ, ಕ್ವಿಜ್ ಮತ್ತು ಇನ್ನಷ್ಟುಗಳಿಗಾಗಿ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

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
  String get dashboardGreeting => 'ಮತ್ತೆ ಸ್ವಾಗತ';

  @override
  String dashboardGreetingNamed(String name) {
    return 'Welcome back, $name';
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
  String get lessonPlanSectionLesson => 'ಪಾಠ';

  @override
  String get lessonPlanSectionApproach => 'ಬೋಧನಾ ವಿಧಾನ';

  @override
  String get quizSectionQuiz => 'ರಸಪ್ರಶ್ನೆ';

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
  String get libraryTitle => 'ನನ್ನ ಗ್ರಂಥಾಲಯ';

  @override
  String get librarySectionSaved => 'ಉಳಿಸಿದವು';

  @override
  String get libraryEmpty =>
      'ನೀವು ಉಳಿಸಿದ ಪಾಠ ಯೋಜನೆಗಳು ಮತ್ತು ಕ್ವಿಜ್‌ಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.';

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
  String get profileTitle => 'ಪ್ರೊಫೈಲ್';

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
  String get teacherTrainingSectionQuestion => 'ಪ್ರಶ್ನೆ';

  @override
  String get teacherTrainingResultTitle => 'ಮಾರ್ಗದರ್ಶನ ಟಿಪ್ಪಣಿಗಳು';

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
  String get parentMessageSectionMessage => 'ಸಂದೇಶ';

  @override
  String get parentMessageSectionDetails => 'ಹೆಚ್ಚುವರಿ ವಿವರಗಳು';

  @override
  String get parentMessageResultTitle => 'ಪೋಷಕರಿಗೆ ಸಂದೇಶ';

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
  String get vidyaLimitTitle => 'ನೀವು ಇಂದಿನ ಧ್ವನಿ ಮಿತಿಯನ್ನು ತಲುಪಿದ್ದೀರಿ';

  @override
  String get vidyaLimitBody =>
      'ನಿಮ್ಮ ಧ್ವನಿ ನಿಮಿಷಗಳು ಮತ್ತೆ ಸಿಗುತ್ತವೆ. ಅಲ್ಲಿಯವರೆಗೆ ನೀವು ಟೂಲ್‌ಗಳನ್ನು ಬಳಸಬಹುದು.';

  @override
  String get vidyaErrorTitle => 'ಅದು ಪೂರ್ಣಗೊಳ್ಳಲಿಲ್ಲ';

  @override
  String get vidyaErrorBody =>
      'ನಿಮ್ಮ ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ, ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ಸೀಲ್ ಮೇಲೆ ಟ್ಯಾಪ್ ಮಾಡಿ.';

  @override
  String get vidyaPrepDesk => 'ಸಿದ್ಧತಾ ಡೆಸ್ಕ್';

  @override
  String get vidyaFlowVisualAid => 'ದೃಶ್ಯ ಸಾಧನ';

  @override
  String get vidyaFlowVirtualFieldTrip => 'ವರ್ಚುವಲ್ ಕ್ಷೇತ್ರ ಪ್ರವಾಸ';

  @override
  String get vidyaFlowVideoStoryteller => 'ವೀಡಿಯೊ ಕಥೆ';

  @override
  String get vidyaFieldMicLabel => 'ಮಾತನಾಡಿ ಭರ್ತಿ ಮಾಡಿ';

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
}
