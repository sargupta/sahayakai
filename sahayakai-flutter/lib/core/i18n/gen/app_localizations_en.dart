// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'SahayakAI';

  @override
  String get navHome => 'Home';

  @override
  String get navCreate => 'Create';

  @override
  String get navLibrary => 'Library';

  @override
  String get navProfile => 'Me';

  @override
  String get actionRetry => 'Try again';

  @override
  String get actionSignIn => 'Sign in';

  @override
  String get actionSignOut => 'Sign out';

  @override
  String get actionGenerate => 'Generate';

  @override
  String get stateOfflineTitle => 'You are offline';

  @override
  String get stateOfflineBody => 'Check your connection and try again.';

  @override
  String get errorGeneric => 'Something went wrong. Please try again.';

  @override
  String get emptyDefault => 'Fill in the form and tap Generate.';

  @override
  String get languageLabel => 'Language';

  @override
  String get splashTagline => 'Teaching assistant for every classroom';

  @override
  String get splashFailedTitle => 'We could not start the app';

  @override
  String get splashFailedBody => 'Please check your connection and try again.';

  @override
  String get loginTitle => 'Welcome to SahayakAI';

  @override
  String get loginSubtitle => 'Sign in to plan lessons, quizzes and more.';

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
  String get dashboardGreeting => 'Welcome back';

  @override
  String dashboardGreetingNamed(String name) {
    return 'Welcome back, $name';
  }

  @override
  String get dashboardGreetingMorning => 'Good morning';

  @override
  String get dashboardGreetingAfternoon => 'Good afternoon';

  @override
  String get dashboardGreetingEvening => 'Good evening';

  @override
  String get actionOpen => 'Open';

  @override
  String get actionRegenerate => 'Regenerate';

  @override
  String get actionCopy => 'Copy';

  @override
  String get copyConfirmation => 'Copied to clipboard';

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
  String get lessonPlanSectionLesson => 'The lesson';

  @override
  String get lessonPlanSectionApproach => 'Teaching approach';

  @override
  String get quizSectionQuiz => 'The quiz';

  @override
  String get sectionForYourClass => 'For your class';

  @override
  String get instantAnswerResultTitle => 'Answer';

  @override
  String get dashboardToolsTitle => 'Your teaching tools';

  @override
  String get createPaletteSearchHint => 'Search tools';

  @override
  String get createPaletteEmpty => 'No tools match your search';

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
  String get libraryTitle => 'My Library';

  @override
  String get librarySectionSaved => 'Saved work';

  @override
  String get libraryEmpty =>
      'Your saved lesson plans and quizzes will appear here.';

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
  String get profileTitle => 'Profile';

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
  String get meTitle => 'Me';

  @override
  String get mePlanUsageTitle => 'Plan & usage';

  @override
  String get mePlanUsageSubtitle => 'How much you have used this month.';

  @override
  String meUsageValue(int used, int limit) {
    return '$used / $limit';
  }

  @override
  String get meUsageUnlimited => 'Unlimited';

  @override
  String get meUsageUnavailable =>
      'We could not load your usage. Please try again.';

  @override
  String get meDefaultsTitle => 'Defaults';

  @override
  String get mePrivacyTitle => 'Privacy & settings';

  @override
  String get meRoleTeacher => 'Teacher';

  @override
  String get usageFeatureAvatar => 'AI avatars';

  @override
  String get usageFeatureVoiceToText => 'Voice to text';

  @override
  String get usageFeatureAssistant => 'VIDYA assistant';

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
  String get teacherTrainingSectionQuestion => 'The question';

  @override
  String get teacherTrainingResultTitle => 'Coaching notes';

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
  String get parentMessageSectionMessage => 'The message';

  @override
  String get parentMessageSectionDetails => 'Extra details';

  @override
  String get parentMessageResultTitle => 'Message home';

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
  String get assessSectionWork => 'The student\'s work';

  @override
  String get assessResultTitle => 'Assessment';

  @override
  String get worksheetSectionWorksheet => 'The worksheet';

  @override
  String get rubricSectionAssignment => 'The assignment';

  @override
  String get examPaperSectionPaper => 'The paper';

  @override
  String get examPaperSectionFormat => 'Format';

  @override
  String get vidyaEyebrow => 'Your co-teacher';

  @override
  String get vidyaDeck =>
      'Speak in your language, and I will prepare the work.';

  @override
  String get vidyaGreeting =>
      'Welcome, teacher. Speak in your language, and I will prepare your work.';

  @override
  String get vidyaHeroBadge => 'Your AI co-teaching assistant';

  @override
  String get vidyaPromptLesson => 'Ask me to plan a lesson';

  @override
  String get vidyaPromptQuiz => 'Ask me to make a quiz';

  @override
  String get vidyaPromptParent => 'Ask me to message a parent';

  @override
  String get vidyaStateIdle => 'Tap to speak';

  @override
  String get vidyaStateReady => 'Getting ready';

  @override
  String get vidyaStateListening => 'I am listening';

  @override
  String get vidyaStateThinking => 'Thinking';

  @override
  String get vidyaStateSpeaking => 'Speaking';

  @override
  String get vidyaYouSaid => 'You said';

  @override
  String get vidyaSignedOutTitle => 'Sign in to talk to VIDYA';

  @override
  String get vidyaSignedOutBody =>
      'Sign in and VIDYA will plan lessons, quizzes and more in your language.';

  @override
  String get vidyaMicOffTitle => 'Turn on the microphone';

  @override
  String get vidyaMicOffBody =>
      'VIDYA needs the microphone to hear you. Enable it in Settings.';

  @override
  String get vidyaOpenSettings => 'Open settings';

  @override
  String get vidyaSignIn => 'Sign in';

  @override
  String get vidyaLimitTitle => 'You have reached today\'s voice limit';

  @override
  String get vidyaLimitBody =>
      'Your voice minutes will refresh. You can keep using the tools in the meantime.';

  @override
  String get vidyaErrorTitle => 'That did not go through';

  @override
  String get vidyaErrorBody =>
      'Something went wrong. Tap the seal to try again.';

  @override
  String get vidyaPrepDesk => 'Prep desk';

  @override
  String get vidyaClearConversation => 'Clear conversation';

  @override
  String get vidyaFlowVisualAid => 'Visual aid';

  @override
  String get vidyaFlowVirtualFieldTrip => 'Virtual field trip';

  @override
  String get vidyaFlowVideoStoryteller => 'Video story';

  @override
  String get vidyaFieldMicLabel => 'Dictate';

  @override
  String get vidyaFieldMicFailed =>
      'Didn\'t catch that. Try again or type it in.';

  @override
  String get vidyaOpen => 'Ask VIDYA';

  @override
  String get parentHotlineTitle => 'Parent Hotline';

  @override
  String get parentHotlineSubtitle =>
      'Call a student\'s parent in their language';

  @override
  String get parentHotlineEyebrow => 'Parent hotline';

  @override
  String get parentHotlinePickStudentIntro => 'Choose whose parent to call.';

  @override
  String get parentHotlineClassLabel => 'Class';

  @override
  String get parentHotlineNoPhone => 'No parent number saved';

  @override
  String get parentHotlineSignedOutTitle => 'Sign in to see your students';

  @override
  String get parentHotlineSignedOutBody =>
      'Your class roster loads once you\'re signed in. The parent hotline needs your account before it can place a call.';

  @override
  String get parentHotlineRosterUnavailableTitle =>
      'Your class list isn\'t available yet';

  @override
  String get parentHotlineRosterUnavailableBody =>
      'We can\'t load your students here just yet. This is coming in a later update. You\'re already signed in, so there\'s nothing you need to fix.';

  @override
  String get parentHotlineRosterEmptyTitle => 'No students on your roster yet';

  @override
  String get parentHotlineRosterEmptyBody =>
      'Add students to a class and they will show up here, ready to call home.';

  @override
  String get parentHotlineReasonEyebrow => 'Why are you calling';

  @override
  String get parentHotlineReasonAbsencesLabel => 'Repeated absences';

  @override
  String get parentHotlineReasonAbsencesDesc =>
      'The student has missed several days in a row.';

  @override
  String get parentHotlineReasonPerformanceLabel => 'Slipping in a subject';

  @override
  String get parentHotlineReasonPerformanceDesc =>
      'Recent marks or classwork need attention.';

  @override
  String get parentHotlineReasonBehaviourLabel => 'Behaviour in class';

  @override
  String get parentHotlineReasonBehaviourDesc =>
      'Something happened the parent should know about.';

  @override
  String get parentHotlineReasonPositiveLabel => 'Good news to share';

  @override
  String get parentHotlineReasonPositiveDesc =>
      'Celebrate a win with the parent.';

  @override
  String get parentHotlineComposeEyebrow => 'Prepare the call';

  @override
  String get parentHotlineNoteLabel => 'Add a note';

  @override
  String get parentHotlineNoteHintAbsences =>
      'Anything the parent should know about the days missed?';

  @override
  String get parentHotlineNoteHintPerformance =>
      'What would help the student improve?';

  @override
  String get parentHotlineNoteHintBehaviour =>
      'What happened, and what support would help at home?';

  @override
  String get parentHotlineNoteHintPositive => 'What is the good news to share?';

  @override
  String get parentHotlineDraftAction => 'Draft the message';

  @override
  String get parentHotlineErrorTitle => 'Something went wrong';

  @override
  String get parentHotlineGenericError =>
      'That didn\'t go through. Please try again.';

  @override
  String get parentHotlineTelephonyUnavailable =>
      'Calling isn\'t available right now. You can still copy the message to send on WhatsApp.';

  @override
  String get parentHotlineEvidenceAttendanceHeader => 'Attendance';

  @override
  String get parentHotlineEvidenceMarksHeader => 'Recent marks';

  @override
  String get parentHotlineEvidenceBehaviourHeader => 'What happened';

  @override
  String get parentHotlineEvidencePositiveHeader => 'The good news';

  @override
  String parentHotlineEvidenceAbsentDays(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days days absent in a row',
      one: '1 day absent in a row',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineEvidenceAbsencePrompt =>
      'Confirm the days missed so the parent hears the exact record.';

  @override
  String get parentHotlineEvidenceMarksPrompt =>
      'The latest marks are ready to mention on the call.';

  @override
  String get parentHotlineEvidenceMarksEmpty =>
      'No recent marks on record yet. Add what the parent should know below.';

  @override
  String get parentHotlineEvidenceBehaviourPrompt =>
      'Describe what happened and the support that would help at home.';

  @override
  String get parentHotlineEvidencePositivePrompt =>
      'Share the win you\'d like the parent to celebrate.';

  @override
  String get parentHotlineReviewEyebrow => 'Message home';

  @override
  String get parentHotlineCall => 'Call parent';

  @override
  String get parentHotlineWhatsApp => 'Copy for WhatsApp';

  @override
  String parentHotlineCallAgainIn(String time) {
    return 'Call again in $time';
  }

  @override
  String parentHotlineUnsupportedLanguage(String language) {
    return 'Auto-call isn\'t available for $language yet — copy for WhatsApp instead.';
  }

  @override
  String parentHotlinePhoneMask(String last4) {
    return '•••• $last4';
  }

  @override
  String get parentHotlineAiNotice =>
      'The call opens with an automated AI voice notice.';

  @override
  String get parentHotlineCopied =>
      'Message copied — paste it in WhatsApp to send.';

  @override
  String get parentHotlinePremiumTitle =>
      'Parent Hotline needs an advanced plan';

  @override
  String get parentHotlinePremiumBody =>
      'Placing an AI voice call to a parent is part of the advanced plan. You can still copy a message to send on WhatsApp for free.';

  @override
  String get parentHotlineComingSoonTitle => 'The call view is on its way';

  @override
  String get parentHotlineComingSoonBody =>
      'Placing and following the call arrives in the next update.';

  @override
  String parentHotlineCallingTitle(String name) {
    return 'Calling $name\'s parent…';
  }

  @override
  String get parentHotlineCallingRinging => 'Ringing…';

  @override
  String get parentHotlineCallingInProgress => 'Conversation in progress';

  @override
  String parentHotlineCallingExchanges(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count exchanges',
      one: '1 exchange',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineCallingReassurance =>
      'You can leave this screen — the summary will be waiting for you.';

  @override
  String get parentHotlineSummaryDocType => 'Parent call';

  @override
  String get parentHotlineSummaryReasonAbsences => 'Absences';

  @override
  String get parentHotlineSummaryReasonPerformance => 'Performance';

  @override
  String get parentHotlineSummaryReasonBehaviour => 'Behaviour';

  @override
  String get parentHotlineSummaryReasonPositive => 'Good news';

  @override
  String parentHotlineSummaryTitle(String name) {
    return '$name\'s parent';
  }

  @override
  String parentHotlineSummaryDurationMin(int minutes) {
    return '$minutes min';
  }

  @override
  String get parentHotlineSentimentCooperative => 'Cooperative';

  @override
  String get parentHotlineSentimentConcerned => 'Concerned';

  @override
  String get parentHotlineSentimentGrateful => 'Grateful';

  @override
  String get parentHotlineSentimentUpset => 'Upset';

  @override
  String get parentHotlineSentimentIndifferent => 'Reserved';

  @override
  String get parentHotlineSentimentConfused => 'Confused';

  @override
  String get parentHotlineSummarySaidHeader => 'What the parent said';

  @override
  String get parentHotlineSummaryConcernsHeader => 'Concerns raised';

  @override
  String get parentHotlineSummaryCommitmentsHeader => 'Parent commitments';

  @override
  String get parentHotlineSummaryActionsHeader => 'Your action items';

  @override
  String get parentHotlineSummaryGuidanceHeader => 'Guidance shared';

  @override
  String get parentHotlineSummaryFollowUpHeader => 'Follow-up';

  @override
  String parentHotlineSummaryTranscript(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'View conversation · $count messages',
      one: 'View conversation · 1 message',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineSummaryDone => 'Done';

  @override
  String get parentHotlineSummaryCallAgain => 'Call again later';

  @override
  String get parentHotlineSummaryManualTitle => 'Message copied';

  @override
  String get parentHotlineSummaryManualBody =>
      'Paste it in WhatsApp to send it to the parent.';

  @override
  String get parentHotlineSummaryBusy => 'The line was busy';

  @override
  String get parentHotlineSummaryNoAnswer => 'No answer';

  @override
  String get parentHotlineSummaryFailed => 'The call couldn\'t connect';

  @override
  String get parentHotlineSummaryFailedBody =>
      'The call didn\'t go through. You can try again, or copy the message to send on WhatsApp.';

  @override
  String get parentHotlineSummaryTryAgain => 'Try again';

  @override
  String get parentHotlineSummaryNoConversationTitle =>
      'The call ended too soon';

  @override
  String get parentHotlineSummaryNoConversationBody =>
      'The call ended before a conversation could happen. You can try again, or send the message on WhatsApp.';

  @override
  String get parentHotlineSummaryUnavailableTitle => 'Summary isn\'t available';

  @override
  String get parentHotlineSummaryUnavailableBody =>
      'We couldn\'t prepare a summary for this call. The conversation is below.';

  @override
  String get contentCreatorTitle => 'Content Creator Studio';

  @override
  String get contentCreatorTileSubtitle => 'Create multimedia for your class';

  @override
  String get contentCreatorSubtitle =>
      'Tools to help you create engaging multimedia content for your classroom.';

  @override
  String get contentCreatorSectionEyebrow => 'Choose a tool';

  @override
  String get contentCreatorVisualAidDesc =>
      'Create simple line drawings and diagrams for your lessons.';

  @override
  String get contentCreatorFieldTripDesc =>
      'Plan exciting virtual tours using Google Earth.';

  @override
  String get contentCreatorVideoDesc =>
      'Discover curated educational videos for your lessons.';

  @override
  String get visualAidTitle => 'Visual Aid';

  @override
  String get visualAidSubtitle => 'Draw a teaching illustration';

  @override
  String get visualAidEmpty => 'Describe a drawing and tap Create.';

  @override
  String get visualAidPromptLabel => 'What should the drawing show?';

  @override
  String get visualAidPromptHint => 'For example, The parts of a plant cell';

  @override
  String get visualAidPromptError => 'Please describe the drawing you need.';

  @override
  String get visualAidGradeLabel => 'Grade level';

  @override
  String get visualAidGradeAny => 'Any grade';

  @override
  String get visualAidSubjectLabel => 'Subject';

  @override
  String get visualAidSubjectAny => 'Any subject';

  @override
  String get visualAidOptional => 'Optional';

  @override
  String get visualAidAction => 'Create visual aid';

  @override
  String get visualAidResultTitle => 'Visual aid';

  @override
  String get visualAidHowToUse => 'How to use this';

  @override
  String get visualAidDiscussionSpark => 'Discussion spark';

  @override
  String get visualAidImageLabel => 'Generated teaching illustration';

  @override
  String get visualAidImageError => 'This drawing could not be displayed.';

  @override
  String get visualAidNoImage =>
      'No drawing came back for that prompt. Please rephrase it and try again.';

  @override
  String get visualAidSignIn => 'Please sign in again to use this tool.';

  @override
  String get visualAidUpgradeTitle => 'A higher plan is needed';

  @override
  String get visualAidUpgradeBody =>
      'Visual aids are part of a higher plan. Please upgrade to keep creating drawings.';

  @override
  String get visualAidSeePricing => 'See plans and pricing';

  @override
  String get visualAidDailyLimitTitle => 'That is all your drawings for today';

  @override
  String get visualAidDailyLimitBody =>
      'Your plan includes a set number of visual aids each day. Your drawings reset tomorrow, or you can raise the daily limit on a higher plan.';

  @override
  String get visualAidLimitTitle => 'You have reached your limit';

  @override
  String get visualAidLimitBody =>
      'You have used your visual aids for this month. Your drawings reset next month, or you can raise the limit on a higher plan.';

  @override
  String get visualAidRephrase =>
      'We could not create that drawing. Please rephrase it and try again.';

  @override
  String get visualAidEmptyGeneration =>
      'The drawing came back empty. Try describing it with fewer labels.';

  @override
  String get visualAidBusy =>
      'The assistant is busy right now. Please try again in a moment.';

  @override
  String visualAidBusyRetryAfter(int seconds) {
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
  String get visualAidTimeout =>
      'This is taking longer than expected. Please try again.';

  @override
  String get videoStorytellerTitle => 'Video Storyteller';

  @override
  String get videoStorytellerSubtitle => 'Find teaching videos';

  @override
  String get videoStorytellerEmpty =>
      'Pick a subject or topic and tap Find videos.';

  @override
  String get videoStorytellerTopicLabel => 'Topic or chapter';

  @override
  String get videoStorytellerTopicHint => 'For example, The water cycle';

  @override
  String get videoStorytellerSubjectLabel => 'Subject';

  @override
  String get videoStorytellerSubjectAny => 'Any subject';

  @override
  String get videoStorytellerGradeLabel => 'Grade level';

  @override
  String get videoStorytellerGradeAny => 'Any grade';

  @override
  String get videoStorytellerOptional => 'Optional';

  @override
  String get videoStorytellerAction => 'Find videos';

  @override
  String get videoStorytellerNoResults =>
      'No videos came back for that. Try a different subject or topic.';

  @override
  String videoStorytellerViewAll(int count) {
    return 'View all $count';
  }

  @override
  String get videoStorytellerOfficialSource => 'Official source';

  @override
  String get videoStorytellerOpensExternally =>
      'Opens in YouTube, outside the app.';

  @override
  String get videoStorytellerCategoryTopRecommended =>
      'Top recommended for you';

  @override
  String get videoStorytellerCategoryStorytelling =>
      'Storytelling for your subjects';

  @override
  String get videoStorytellerCategoryPedagogy =>
      'Pedagogy and teaching methods';

  @override
  String get videoStorytellerCategoryGovtUpdates => 'Government updates';

  @override
  String get videoStorytellerCategoryCourses => 'Teacher training courses';

  @override
  String get videoStorytellerSignIn => 'Please sign in again to use this tool.';

  @override
  String get videoStorytellerTimeout =>
      'This is taking longer than expected. Please try again.';

  @override
  String get videoStorytellerBusy =>
      'The assistant is busy right now. Please try again in a moment.';

  @override
  String videoStorytellerBusyRetryAfter(int seconds) {
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
  String get videoStorytellerRephrase =>
      'We could not find videos for that. Please try a different topic.';

  @override
  String get videoStorytellerLimit =>
      'You have searched a lot recently. Please try again in a little while.';

  @override
  String get actionDone => 'Done';

  @override
  String get virtualFieldTripTitle => 'Virtual Field Trip';

  @override
  String get virtualFieldTripSubtitle => 'Tour the world on Google Earth';

  @override
  String get virtualFieldTripEmpty => 'Enter a topic and tap Plan the trip.';

  @override
  String get virtualFieldTripTopicLabel => 'Topic or theme';

  @override
  String get virtualFieldTripTopicHint => 'For example, The Great Barrier Reef';

  @override
  String get virtualFieldTripTopicError => 'Please enter a topic for the trip.';

  @override
  String get virtualFieldTripGradeLabel => 'Grade level';

  @override
  String get virtualFieldTripGradeAny => 'Any grade';

  @override
  String get virtualFieldTripOptional => 'Optional';

  @override
  String get virtualFieldTripAction => 'Plan the trip';

  @override
  String get virtualFieldTripDocType => 'Virtual Field Trip';

  @override
  String virtualFieldTripStopCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count stops',
      one: '1 stop',
    );
    return '$_temp0';
  }

  @override
  String virtualFieldTripStopSemantics(int number, String name) {
    return 'Stop $number: $name';
  }

  @override
  String get virtualFieldTripFactLabel => 'Did you know?';

  @override
  String get virtualFieldTripReflectionLabel => 'Think about this';

  @override
  String get virtualFieldTripAnalogyLabel => 'In our context';

  @override
  String get virtualFieldTripExplanationLabel => 'Why we visit';

  @override
  String get virtualFieldTripOpenEarth => 'Open in Google Earth';

  @override
  String get virtualFieldTripOpensExternally =>
      'Opens Google Earth, outside the app.';

  @override
  String get virtualFieldTripPendingTitle => 'Still planning your trip';

  @override
  String get virtualFieldTripPendingBody =>
      'Your field trip is still being planned. Check My Library in a minute.';

  @override
  String get virtualFieldTripNoStops =>
      'No stops came back for that. Try a different topic.';

  @override
  String get virtualFieldTripSignIn => 'Please sign in again to use this tool.';

  @override
  String get virtualFieldTripUnavailable =>
      'This tool is not part of your current plan.';

  @override
  String get virtualFieldTripTimeout =>
      'This is taking longer than expected. Please try again.';

  @override
  String get virtualFieldTripBusy =>
      'The assistant is busy right now. Please try again in a moment.';

  @override
  String virtualFieldTripBusyRetryAfter(int seconds) {
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
  String get virtualFieldTripRephrase =>
      'We could not plan a trip for that. Please try a different topic.';

  @override
  String get virtualFieldTripLimit =>
      'You have planned a lot of trips recently. Please try again in a little while.';

  @override
  String get assessmentScannerTitle => 'Assessment Scanner';

  @override
  String get assessmentScannerSubtitle =>
      'Grade a student\'s answer sheet page by page';

  @override
  String get assessmentScannerEmpty =>
      'Add up to 3 photos of the answer sheet, then tap Grade.';

  @override
  String get assessmentScannerSubmit => 'Grade the answer sheet';

  @override
  String get assessmentScannerResultTitle => 'Assessment';

  @override
  String get assessmentScannerSectionSheet => 'The answer sheet';

  @override
  String get assessmentScannerPagesLabel => 'Answer sheet pages';

  @override
  String get assessmentScannerPagesHint =>
      'Add up to 3 clear photos, one per page.';

  @override
  String get assessmentScannerPagesEmpty => 'Add a photo of the first page.';

  @override
  String assessmentScannerPageLabel(int number) {
    return 'Page $number';
  }

  @override
  String assessmentScannerRemovePage(int number) {
    return 'Remove page $number';
  }

  @override
  String assessmentScannerPageCounter(int count, int max) {
    return '$count of $max pages';
  }

  @override
  String assessmentScannerPagesFull(int max) {
    return 'You can add up to $max pages.';
  }

  @override
  String get assessmentScannerTakePhoto => 'Take photo';

  @override
  String get assessmentScannerChooseGallery => 'Choose from gallery';

  @override
  String get assessmentScannerSubjectLabel => 'Subject';

  @override
  String get assessmentScannerSubjectHint => 'Grading is tuned to the subject.';

  @override
  String get assessmentScannerSubjectPlaceholder => 'Choose a subject';

  @override
  String get assessmentScannerSubjectError => 'Please choose the subject.';

  @override
  String get assessmentScannerGradeLabel => 'Grade level';

  @override
  String get assessmentScannerGradePlaceholder => 'Choose a grade';

  @override
  String get assessmentScannerGradeError => 'Please choose the grade.';

  @override
  String get assessmentScannerOptional => 'Optional';

  @override
  String get assessmentScannerAnswerKeyLabel => 'Answer key';

  @override
  String get assessmentScannerAnswerKeyHint =>
      'Paste the correct answers to grade against them.';

  @override
  String get assessmentScannerAnswerKeyPlaceholder =>
      'Type or paste the answer key';

  @override
  String get assessmentScannerPrivacyNote =>
      'The student\'s name is never sent for grading.';

  @override
  String assessmentScannerScoreCaption(String awarded, String max) {
    return '$awarded of $max marks';
  }

  @override
  String get assessmentScannerScoreOutOf => 'out of 100';

  @override
  String assessmentScannerMarks(String awarded, String max) {
    return '$awarded/$max';
  }

  @override
  String assessmentScannerPagesMeta(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count pages',
      one: '1 page',
    );
    return '$_temp0';
  }

  @override
  String assessmentScannerReviewBadge(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count to review',
      one: '1 to review',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerQuestionsSection => 'Question by question';

  @override
  String get assessmentScannerStudentAnswerLabel => 'Student wrote';

  @override
  String get assessmentScannerFeedbackLabel => 'Feedback';

  @override
  String get assessmentScannerExpectedLabel => 'Expected answer';

  @override
  String get assessmentScannerNextStepsSection => 'Recommended next steps';

  @override
  String get assessmentScannerStudentSection => 'For the student';

  @override
  String get assessmentScannerQualitySection => 'Photo quality';

  @override
  String get assessmentScannerNotScored => 'Not scored';

  @override
  String get assessmentScannerNoContent =>
      'No grades came back. Please try clearer photos.';

  @override
  String get assessmentScannerOutcomeCorrect => 'Correct';

  @override
  String get assessmentScannerOutcomePartial => 'Partly correct';

  @override
  String get assessmentScannerOutcomeIncorrect => 'Incorrect';

  @override
  String get assessmentScannerReviewChip => 'Check this';

  @override
  String get assessmentScannerSignIn =>
      'Please sign in again to grade an answer sheet.';

  @override
  String get assessmentScannerUpgradeTitle => 'A higher plan is needed';

  @override
  String get assessmentScannerUpgradeBody =>
      'Grading answer sheets is part of a higher plan. Upgrade to keep grading.';

  @override
  String get assessmentScannerSeePricing => 'See plans';

  @override
  String get assessmentScannerDailyLimitTitle =>
      'That is all your answer sheets for today';

  @override
  String get assessmentScannerDailyLimitBody =>
      'Your plan includes a set number of answer sheets each day. They reset tomorrow, or you can raise the limit on a higher plan.';

  @override
  String get assessmentScannerLimitTitle =>
      'You have reached your grading limit';

  @override
  String get assessmentScannerLimitBody =>
      'You have used all the answer sheets in your plan. They reset next month, or you can raise the limit on a higher plan.';

  @override
  String get assessmentScannerBusy =>
      'The grading model is busy right now. Please try again in a minute.';

  @override
  String assessmentScannerBusyRetryAfter(int seconds) {
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
  String get assessmentScannerTimeout =>
      'Grading is taking longer than usual. Please try again.';

  @override
  String get assessmentScannerRephrase =>
      'The photos could not be graded. Please re-upload clearer pages.';

  @override
  String get inboxTitle => 'Messages';

  @override
  String get inboxSignInTitle => 'Your messages';

  @override
  String get inboxSignInBody => 'Sign in to see your messages';

  @override
  String get inboxEmptyTitle => 'No conversations yet';

  @override
  String get inboxEmptyBody =>
      'When you connect with teachers, your conversations will appear here.';

  @override
  String get inboxErrorBody =>
      'We couldn\'t load your messages. Please try again.';

  @override
  String get inboxNoMessagesYet => 'No messages yet';

  @override
  String get inboxThreadFallbackTitle => 'Conversation';

  @override
  String get inboxThreadEmptyTitle => 'No messages yet';

  @override
  String get inboxThreadEmptyBody => 'Say hello to start the conversation.';

  @override
  String get inboxComposerHint => 'Write a message';

  @override
  String get inboxComposerSend => 'Send';

  @override
  String get inboxComposerTooLong => 'Message too long. Please shorten it.';

  @override
  String get inboxLoadOlder => 'Load older messages';

  @override
  String get inboxSendFailed => 'Couldn\'t send your message.';

  @override
  String get inboxResourceLabel => 'Resource';

  @override
  String get inboxVoiceNoteLabel => 'Voice note';

  @override
  String inboxUnreadLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count unread',
      one: '1 unread',
    );
    return '$_temp0';
  }

  @override
  String get inboxTickSending => 'Sending';

  @override
  String get inboxTickSent => 'Sent';

  @override
  String get inboxTickDelivered => 'Delivered';

  @override
  String get inboxTickRead => 'Read';

  @override
  String get inboxTickFailed => 'Not sent';

  @override
  String get inboxTimeNow => 'now';

  @override
  String inboxTimeMinutes(int count) {
    return '${count}m';
  }

  @override
  String inboxTimeHours(int count) {
    return '${count}h';
  }

  @override
  String inboxTimeDays(int count) {
    return '${count}d';
  }

  @override
  String inboxTimeWeeks(int count) {
    return '${count}w';
  }

  @override
  String get networkTitle => 'Network';

  @override
  String get networkTooltip => 'Network';

  @override
  String get networkTabStaffroom => 'Staffroom';

  @override
  String get networkTabMessages => 'Messages';

  @override
  String get networkTabUpdates => 'Updates';

  @override
  String get notificationsEmptyTitle => 'Nothing new yet';

  @override
  String get notificationsEmptyBody =>
      'Call outcomes, attendance alerts and finished papers appear here as they happen.';

  @override
  String get notificationsLocalNote =>
      'These appear when you open the app. SahayakAI cannot send phone notifications yet.';

  @override
  String get notificationsMarkAllRead => 'Mark all as read';

  @override
  String notificationCallCompletedTitle(String student) {
    return 'Parent call finished for $student';
  }

  @override
  String get notificationCallCompletedBody =>
      'The conversation summary is ready in the Parent Hotline.';

  @override
  String notificationCallFailedTitle(String student) {
    return 'Parent call did not connect for $student';
  }

  @override
  String get notificationCallFailedBody =>
      'Try the call again, or send the message on WhatsApp instead.';

  @override
  String notificationAbsenceTitle(String student, int count) {
    return '$student has missed $count days in a row';
  }

  @override
  String notificationAbsenceBody(String className) {
    return 'Open $className to see the days that were missed.';
  }

  @override
  String notificationExamPaperTitle(String subject) {
    return '$subject exam paper is on its way';
  }

  @override
  String get notificationExamPaperBody =>
      'It is still being written and will appear in your Library on its own.';

  @override
  String get staffroomTitle => 'Staffroom';

  @override
  String get staffroomHeroTitle => 'The Staffroom';

  @override
  String get staffroomHeroDeck => 'Teachers across Bharat, in one room';

  @override
  String get staffroomSectionGroups => 'Your groups';

  @override
  String get staffroomSectionFeed => 'From your groups';

  @override
  String get staffroomSectionDiscover => 'Discover groups';

  @override
  String get staffroomSectionPeople => 'People you may know';

  @override
  String get staffroomSignInTitle => 'Join the staffroom';

  @override
  String get staffroomSignInBody => 'Sign in to join the staffroom';

  @override
  String get staffroomFeedEmptyTitle => 'Your feed is quiet';

  @override
  String get staffroomFeedEmptyBody =>
      'Posts from your groups will appear here.';

  @override
  String get staffroomErrorBody =>
      'We couldn\'t load the staffroom. Please try again.';

  @override
  String get staffroomGroupsEmptyTitle => 'No groups yet';

  @override
  String get staffroomGroupsEmptyBody =>
      'Join a group to see its posts and chat.';

  @override
  String get staffroomBrowseGroups => 'Browse groups';

  @override
  String staffroomMemberCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count members',
      one: '1 member',
    );
    return '$_temp0';
  }

  @override
  String get staffroomJoin => 'Join';

  @override
  String get staffroomJoined => 'Joined';

  @override
  String get staffroomJoinFailed => 'Couldn\'t join. Tap to retry.';

  @override
  String get staffroomGroupLockedTitle => 'Members only';

  @override
  String get staffroomGroupLockedBody => 'Join this group to see its posts.';

  @override
  String get staffroomGroupPostsEmptyTitle => 'No posts yet';

  @override
  String get staffroomGroupPostsEmptyBody => 'Be the first to share here.';

  @override
  String get staffroomGroupNotFoundTitle => 'Group not found';

  @override
  String get staffroomGroupNotFoundBody => 'This group may have been removed.';

  @override
  String get staffroomPostTypeShare => 'Shared';

  @override
  String get staffroomPostTypeAskHelp => 'Needs help';

  @override
  String get staffroomPostTypeCelebrate => 'Celebrating';

  @override
  String get staffroomPostTypeResource => 'Resource';

  @override
  String get staffroomLike => 'Like';

  @override
  String get staffroomLiked => 'Liked';

  @override
  String staffroomLikeCountLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count likes',
      one: '1 like',
      zero: 'No likes',
    );
    return '$_temp0';
  }

  @override
  String get staffroomLikeFailed => 'Couldn\'t update. Tap to retry.';

  @override
  String get staffroomResourceShared => 'Shared a resource';

  @override
  String staffroomChatHighlight(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count new messages',
      one: '1 new message',
    );
    return '$_temp0';
  }

  @override
  String get staffroomConnect => 'Connect';

  @override
  String get staffroomConnectSent => 'Request sent';

  @override
  String get staffroomConnectPending => 'Request already pending';

  @override
  String get staffroomConnectConnected => 'Already connected';

  @override
  String get staffroomChatTitle => 'Staff room';

  @override
  String get staffroomChatEntryBody => 'Chat with teachers across Bharat';

  @override
  String get staffroomChatSignInTitle => 'Join the staff room';

  @override
  String get staffroomChatSignInBody => 'Sign in to join the staff room';

  @override
  String get staffroomChatEmptyTitle => 'No messages yet';

  @override
  String get staffroomChatEmptyBody => 'Be the first to say hello.';

  @override
  String get staffroomChatAiBadge => 'AI teacher';

  @override
  String get staffroomGroupChatEntry => 'Group chat';

  @override
  String get staffroomDirectoryTitle => 'Find teachers';

  @override
  String get staffroomDirectoryEntryBody => 'Search the teacher directory';

  @override
  String get staffroomDirectorySearchHint => 'Search by name or subject';

  @override
  String get staffroomDirectoryErrorBody =>
      'We couldn\'t load the directory. Please try again.';

  @override
  String get staffroomDirectoryEmptyTitle => 'No teachers found';

  @override
  String get staffroomDirectoryEmptyBody => 'No teachers to show yet.';

  @override
  String get staffroomDirectorySearchEmpty => 'No teachers match your search.';

  @override
  String get staffroomProfileTitle => 'Teacher';

  @override
  String get staffroomProfileErrorBody =>
      'We couldn\'t load this profile. Please try again.';

  @override
  String get staffroomProfileNotFoundTitle => 'Profile unavailable';

  @override
  String get staffroomProfileNotFoundBody =>
      'This teacher\'s profile could not be found.';

  @override
  String get staffroomProfileAboutLabel => 'About';

  @override
  String get staffroomProfileBioEmpty => 'No bio yet.';

  @override
  String get staffroomProfileVerified => 'Verified';

  @override
  String staffroomProfileExperience(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count yrs experience',
      one: '1 yr experience',
    );
    return '$_temp0';
  }

  @override
  String get staffroomProfileSubjectsLabel => 'Subjects';

  @override
  String get staffroomProfileClassesLabel => 'Classes';

  @override
  String get staffroomProfileLanguagesLabel => 'Languages';

  @override
  String get staffroomRequested => 'Requested';

  @override
  String get staffroomConnectionAccept => 'Accept';

  @override
  String get staffroomConnectionDecline => 'Decline';

  @override
  String get staffroomConnected => 'Connected';

  @override
  String get staffroomConnectionWants => 'Wants to connect';

  @override
  String get staffroomMessage => 'Message';

  @override
  String get staffroomConnectToMessage => 'Connect to message';

  @override
  String get staffroomConnectionFailed => 'Couldn\'t update. Tap to retry.';

  @override
  String get staffroomDisconnect => 'Disconnect';

  @override
  String get staffroomDisconnectConfirmTitle => 'Disconnect?';

  @override
  String get staffroomDisconnectConfirmBody =>
      'You\'ll no longer be connected or able to message each other.';

  @override
  String get staffroomDisconnectCancel => 'Stay connected';

  @override
  String get staffroomFollow => 'Follow';

  @override
  String get staffroomFollowing => 'Following';

  @override
  String get staffroomFollowFailed => 'Couldn\'t update. Tap to retry.';

  @override
  String get actionShare => 'Share';

  @override
  String get resultSaveToLibrary => 'Save to Library';

  @override
  String get resultSaving => 'Saving';

  @override
  String get resultSaved => 'Saved to your Library';

  @override
  String get resultSaveFailedTitle => 'Could not save';

  @override
  String get resultSaveFailedBody =>
      'We could not save this to your library. Please try again.';

  @override
  String get resultSaveRetry => 'Try saving again';

  @override
  String get resultShareFailed =>
      'Could not share. The text has been copied to your clipboard instead.';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get attendanceTitle => 'Attendance';

  @override
  String get attendanceClassesEyebrow => 'Your classes';

  @override
  String get attendanceClassesIntro => 'Pick a class to mark its register.';

  @override
  String get attendanceClassesEmptyTitle => 'No classes yet';

  @override
  String get attendanceClassesEmptyBody =>
      'Create your first class, then add the students in it.';

  @override
  String get attendanceClassesError => 'We could not load your classes.';

  @override
  String get attendanceClassFullBadge => 'Full';

  @override
  String get attendanceNewClass => 'New class';

  @override
  String get attendanceOpenRegister => 'Mark register';

  @override
  String get attendanceOpenRoster => 'Students';

  @override
  String get attendanceOpenMonth => 'This month';

  @override
  String get attendanceSignedOutTitle => 'Sign in to see your classes';

  @override
  String get attendanceSignedOutBody =>
      'Your classes and registers are saved to your account. Sign in and they will be here.';

  @override
  String get attendanceClassNameLabel => 'Class name';

  @override
  String get attendanceClassNameHint => 'For example, Class 6A';

  @override
  String get attendanceClassNameRequired => 'Enter a class name.';

  @override
  String get attendanceSubjectLabel => 'Subject';

  @override
  String get attendanceGradeLabel => 'Grade';

  @override
  String get attendanceAcademicYearLabel => 'Academic year';

  @override
  String get attendanceAcademicYearHint => 'For example, 2026-27';

  @override
  String get attendanceAcademicYearRequired => 'Enter an academic year.';

  @override
  String get attendanceSectionLabel => 'Section';

  @override
  String get attendanceSectionHint => 'For example, A';

  @override
  String get attendanceCreateClassSubmit => 'Create class';

  @override
  String get attendanceClassCreated => 'Class created.';

  @override
  String get attendanceCreateClassFailed => 'We could not create this class.';

  @override
  String get attendanceRosterEyebrow => 'Class roster';

  @override
  String get attendanceRosterUnavailableTitle =>
      'The roster is not ready to show yet';

  @override
  String get attendanceRosterUnavailableBody =>
      'Parent contact details are moving to a masked form on our servers, and until that is live this app will not download them. Nothing is wrong with your class and nothing has been lost. Marking the register and the monthly view work as usual.';

  @override
  String get attendanceRosterEmptyTitle => 'No students yet';

  @override
  String get attendanceRosterEmptyBody =>
      'Add the students in this class to start marking the register.';

  @override
  String get attendanceRosterError => 'We could not load this roster.';

  @override
  String attendanceRollLabel(int roll) {
    return 'Roll $roll';
  }

  @override
  String get attendanceNoParentPhone => 'No parent number saved';

  @override
  String attendanceParentPhoneMask(String last4) {
    return '•••• $last4';
  }

  @override
  String get attendanceAddStudent => 'Add student';

  @override
  String get attendanceStudentNameLabel => 'Student name';

  @override
  String get attendanceStudentNameRequired => 'Enter the student\'s name.';

  @override
  String get attendanceRollNumberLabel => 'Roll number';

  @override
  String get attendanceRollNumberHint => '1 to 40';

  @override
  String get attendanceRollNumberInvalid =>
      'Roll number must be a whole number from 1 to 40.';

  @override
  String get attendanceParentPhoneLabel => 'Parent\'s mobile number';

  @override
  String get attendanceParentPhoneHint => '10-digit Indian mobile number';

  @override
  String get attendanceParentPhoneRequired =>
      'Enter the parent\'s mobile number.';

  @override
  String get attendanceParentPhoneInvalid =>
      'Enter a 10-digit Indian mobile number.';

  @override
  String get attendanceParentLanguageLabel => 'Parent\'s language';

  @override
  String get attendanceParentPhonePrivacy =>
      'This number is sent to SahayakAI so a call to this parent can be placed for you. It is never downloaded back onto this phone.';

  @override
  String get attendanceStudentAdded => 'Student added.';

  @override
  String get attendanceAddStudentFailed => 'We could not add this student.';

  @override
  String get attendanceClassFullTitle => 'This class is full';

  @override
  String attendanceClassFullBody(int max) {
    return 'A class can hold up to $max students, so no more can be added.';
  }

  @override
  String get attendanceMarkEyebrow => 'Daily register';

  @override
  String get attendanceMarkIntro =>
      'Mark today, or any of the seven days before it.';

  @override
  String get attendanceDateToday => 'Today';

  @override
  String get attendanceDateYesterday => 'Yesterday';

  @override
  String get attendanceWindowNote =>
      'The register stays open for today and the seven days before it. Older days are closed.';

  @override
  String get attendanceStatusPresent => 'Present';

  @override
  String get attendanceStatusAbsent => 'Absent';

  @override
  String get attendanceStatusLate => 'Late';

  @override
  String get attendanceStatusUnmarked => 'Not marked';

  @override
  String attendanceMarkProgress(int marked, int total) {
    return '$marked of $total marked';
  }

  @override
  String get attendanceMarkAllPresent => 'Mark everyone present';

  @override
  String get attendanceSaveRegister => 'Save register';

  @override
  String get attendanceRegisterSaved => 'Register saved.';

  @override
  String get attendanceSaveRegisterFailed => 'We could not save this register.';

  @override
  String get attendanceRegisterError => 'We could not load this register.';

  @override
  String get attendanceNoStudentsTitle => 'No students in this class yet';

  @override
  String get attendanceNoStudentsBody =>
      'Add a student before marking the register.';

  @override
  String get attendanceMonthEyebrow => 'Monthly attendance';

  @override
  String get attendanceMonthError => 'We could not load this month.';

  @override
  String get attendanceMonthEmptyTitle => 'Nothing marked this month';

  @override
  String get attendanceMonthEmptyBody =>
      'Each student\'s month appears here once you start marking the register.';

  @override
  String get attendanceMonthPrevious => 'Previous month';

  @override
  String get attendanceMonthNext => 'Next month';

  @override
  String get attendanceAbsencesTitle => 'Days absent';

  @override
  String get attendanceAbsencesEmpty => 'No absences this month.';

  @override
  String get attendanceAbsencesError => 'We could not load the absent days.';

  @override
  String get attendancePremiumTitle => 'Marking needs a Pro plan';

  @override
  String get attendancePremiumBody =>
      'Reading your classes, registers and monthly summaries stays free. Creating a class, adding a student and saving a register are part of the Pro plan.';
}
