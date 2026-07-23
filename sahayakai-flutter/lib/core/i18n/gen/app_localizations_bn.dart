// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Bengali Bangla (`bn`).
class AppLocalizationsBn extends AppLocalizations {
  AppLocalizationsBn([String locale = 'bn']) : super(locale);

  @override
  String get appTitle => 'SahayakAI';

  @override
  String get navHome => 'হোম';

  @override
  String get navCreate => 'তৈরি করুন';

  @override
  String get navLibrary => 'লাইব্রেরি';

  @override
  String get navProfile => 'প্রোফাইল';

  @override
  String get actionRetry => 'আবার চেষ্টা করুন';

  @override
  String get actionSignOut => 'সাইন আউট';

  @override
  String get actionGenerate => 'তৈরি করুন';

  @override
  String get stateOfflineTitle => 'আপনি অফলাইনে আছেন';

  @override
  String get stateOfflineBody => 'আপনার সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';

  @override
  String get errorGeneric =>
      'কিছু একটা সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get emptyDefault => 'ফর্মটি পূরণ করে তৈরি করুন-এ ট্যাপ করুন।';

  @override
  String get languageLabel => 'ভাষা';

  @override
  String get splashTagline => 'প্রতিটি শ্রেণিকক্ষের জন্য শিক্ষণ সহায়ক';

  @override
  String get splashFailedTitle => 'We could not start the app';

  @override
  String get splashFailedBody => 'Please check your connection and try again.';

  @override
  String get loginTitle => 'SahayakAI-তে স্বাগতম';

  @override
  String get loginSubtitle =>
      'পাঠ পরিকল্পনা, কুইজ ও আরও অনেক কিছুর জন্য সাইন ইন করুন।';

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
  String get dashboardGreeting => 'আবার স্বাগতম';

  @override
  String dashboardGreetingNamed(String name) {
    return 'Welcome back, $name';
  }

  @override
  String get dashboardGreetingMorning => 'সুপ্রভাত';

  @override
  String get dashboardGreetingAfternoon => 'শুভ অপরাহ্ন';

  @override
  String get dashboardGreetingEvening => 'শুভ সন্ধ্যা';

  @override
  String get actionOpen => 'খুলুন';

  @override
  String get actionRegenerate => 'আবার তৈরি করুন';

  @override
  String get actionCopy => 'কপি করুন';

  @override
  String get copyConfirmation => 'ক্লিপবোর্ডে কপি করা হয়েছে';

  @override
  String get lessonPlanSectionLesson => 'পাঠ';

  @override
  String get lessonPlanSectionApproach => 'শিক্ষণ পদ্ধতি';

  @override
  String get quizSectionQuiz => 'কুইজ';

  @override
  String get sectionForYourClass => 'আপনার শ্রেণির জন্য';

  @override
  String get instantAnswerResultTitle => 'উত্তর';

  @override
  String get dashboardToolsTitle => 'আপনার শিক্ষণ সরঞ্জাম';

  @override
  String get createPaletteSearchHint => 'সরঞ্জাম খুঁজুন';

  @override
  String get createPaletteEmpty => 'আপনার খোঁজের সাথে কোনো সরঞ্জাম মেলেনি';

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
  String get libraryTitle => 'আমার লাইব্রেরি';

  @override
  String get librarySectionSaved => 'সংরক্ষিত কাজ';

  @override
  String get libraryEmpty =>
      'আপনার সংরক্ষিত পাঠ পরিকল্পনা ও কুইজ এখানে দেখা যাবে।';

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
  String get profileTitle => 'প্রোফাইল';

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
  String get meTitle => 'প্রোফাইল';

  @override
  String get mePlanUsageTitle => 'প্ল্যান ও ব্যবহার';

  @override
  String get mePlanUsageSubtitle => 'এই মাসে আপনি কতটা ব্যবহার করেছেন।';

  @override
  String meUsageValue(int used, int limit) {
    return '$used / $limit';
  }

  @override
  String get meUsageUnlimited => 'সীমাহীন';

  @override
  String get meUsageUnavailable =>
      'আমরা আপনার ব্যবহারের তথ্য লোড করতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get meDefaultsTitle => 'ডিফল্ট';

  @override
  String get mePrivacyTitle => 'গোপনীয়তা ও সেটিংস';

  @override
  String get meRoleTeacher => 'শিক্ষক';

  @override
  String get usageFeatureAvatar => 'এআই অবতার';

  @override
  String get usageFeatureVoiceToText => 'ভয়েস থেকে টেক্সট';

  @override
  String get usageFeatureAssistant => 'VIDYA সহকারী';

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
  String get teacherTrainingSectionQuestion => 'প্রশ্ন';

  @override
  String get teacherTrainingResultTitle => 'পরামর্শ নোট';

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
  String get parentMessageSectionMessage => 'বার্তা';

  @override
  String get parentMessageSectionDetails => 'অতিরিক্ত বিবরণ';

  @override
  String get parentMessageResultTitle => 'অভিভাবকের জন্য বার্তা';

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
  String get assessSectionWork => 'শিক্ষার্থীর কাজ';

  @override
  String get assessResultTitle => 'মূল্যায়ন';

  @override
  String get worksheetSectionWorksheet => 'ওয়ার্কশিট';

  @override
  String get rubricSectionAssignment => 'অ্যাসাইনমেন্ট';

  @override
  String get examPaperSectionPaper => 'প্রশ্নপত্র';

  @override
  String get examPaperSectionFormat => 'বিন্যাস';

  @override
  String get vidyaEyebrow => 'আপনার সহ-শিক্ষক';

  @override
  String get vidyaDeck => 'আপনার ভাষায় বলুন, আমি কাজটি প্রস্তুত করে দেব।';

  @override
  String get vidyaHeroBadge => 'আপনার এআই শিক্ষণ সহায়ক';

  @override
  String get vidyaPromptLesson => 'একটি পাঠ পরিকল্পনা করতে বলুন';

  @override
  String get vidyaPromptQuiz => 'একটি কুইজ তৈরি করতে বলুন';

  @override
  String get vidyaPromptParent => 'একজন অভিভাবককে বার্তা পাঠাতে বলুন';

  @override
  String get vidyaStateIdle => 'কথা বলতে ট্যাপ করুন';

  @override
  String get vidyaStateReady => 'প্রস্তুত হচ্ছে';

  @override
  String get vidyaStateListening => 'আমি শুনছি';

  @override
  String get vidyaStateThinking => 'ভাবছি';

  @override
  String get vidyaStateSpeaking => 'বলছি';

  @override
  String get vidyaYouSaid => 'আপনি বললেন';

  @override
  String get vidyaSignedOutTitle => 'VIDYA-র সাথে কথা বলতে সাইন ইন করুন';

  @override
  String get vidyaSignedOutBody =>
      'সাইন ইন করুন, VIDYA আপনার ভাষায় পাঠ, কুইজ এবং আরও অনেক কিছু তৈরি করবে।';

  @override
  String get vidyaMicOffTitle => 'মাইক্রোফোন চালু করুন';

  @override
  String get vidyaMicOffBody =>
      'আপনার কথা শুনতে VIDYA-র মাইক্রোফোন দরকার। সেটিংসে এটি চালু করুন।';

  @override
  String get vidyaOpenSettings => 'সেটিংস খুলুন';

  @override
  String get vidyaSignIn => 'সাইন ইন করুন';

  @override
  String get vidyaLimitTitle => 'আপনি আজকের ভয়েস সীমায় পৌঁছেছেন';

  @override
  String get vidyaLimitBody =>
      'আপনার ভয়েস মিনিট আবার পাওয়া যাবে। ততক্ষণ আপনি টুলগুলি ব্যবহার করতে পারেন।';

  @override
  String get vidyaErrorTitle => 'এটি সম্পন্ন হয়নি';

  @override
  String get vidyaErrorBody =>
      'আপনার সংযোগ পরীক্ষা করুন এবং আবার চেষ্টা করতে সিলে ট্যাপ করুন।';

  @override
  String get vidyaPrepDesk => 'প্রস্তুতি ডেস্ক';

  @override
  String get vidyaFlowVisualAid => 'ভিজ্যুয়াল সহায়ক';

  @override
  String get vidyaFlowVirtualFieldTrip => 'ভার্চুয়াল ফিল্ড ট্রিপ';

  @override
  String get vidyaFlowVideoStoryteller => 'ভিডিও গল্প';

  @override
  String get vidyaFieldMicLabel => 'বলে পূরণ করুন';

  @override
  String get vidyaOpen => 'VIDYA কে জিজ্ঞাসা করুন';

  @override
  String get parentHotlineTitle => 'অভিভাবককে কল';

  @override
  String get parentHotlineSubtitle =>
      'শিক্ষার্থীর অভিভাবককে তাঁদের নিজের ভাষায় কল করুন';

  @override
  String get parentHotlineEyebrow => 'অভিভাবক কল';

  @override
  String get parentHotlinePickStudentIntro =>
      'কার অভিভাবককে কল করবেন, বেছে নিন।';

  @override
  String get parentHotlineClassLabel => 'শ্রেণি';

  @override
  String get parentHotlineNoPhone => 'অভিভাবকের নম্বর সংরক্ষিত নেই';

  @override
  String get parentHotlineSignedOutTitle =>
      'আপনার শিক্ষার্থীদের দেখতে সাইন ইন করুন';

  @override
  String get parentHotlineSignedOutBody =>
      'সাইন ইন করলেই আপনার শ্রেণির তালিকা আসবে। অভিভাবককে কল করার জন্য প্রথমে আপনার অ্যাকাউন্টে প্রবেশ করা প্রয়োজন।';

  @override
  String get parentHotlineReasonEyebrow => 'কেন কল করছেন';

  @override
  String get parentHotlineReasonAbsencesLabel => 'বারবার অনুপস্থিতি';

  @override
  String get parentHotlineReasonAbsencesDesc =>
      'শিক্ষার্থী পরপর কয়েক দিন অনুপস্থিত ছিল।';

  @override
  String get parentHotlineReasonPerformanceLabel => 'কোনো বিষয়ে পিছিয়ে পড়া';

  @override
  String get parentHotlineReasonPerformanceDesc =>
      'সাম্প্রতিক নম্বর বা ক্লাসের কাজে নজর দেওয়া দরকার।';

  @override
  String get parentHotlineReasonBehaviourLabel => 'ক্লাসে আচরণ';

  @override
  String get parentHotlineReasonBehaviourDesc =>
      'এমন কিছু ঘটেছে যা অভিভাবকের জানা উচিত।';

  @override
  String get parentHotlineReasonPositiveLabel => 'জানানোর মতো ভালো খবর';

  @override
  String get parentHotlineReasonPositiveDesc =>
      'অভিভাবকের সঙ্গে একটি সাফল্য উদযাপন করুন।';

  @override
  String get parentHotlineComposeEyebrow => 'কলের প্রস্তুতি';

  @override
  String get parentHotlineNoteLabel => 'একটি নোট যোগ করুন';

  @override
  String get parentHotlineNoteHintAbsences =>
      'অনুপস্থিত দিনগুলি সম্পর্কে অভিভাবকের কি কিছু জানা দরকার?';

  @override
  String get parentHotlineNoteHintPerformance =>
      'শিক্ষার্থীর উন্নতিতে কী সাহায্য করবে?';

  @override
  String get parentHotlineNoteHintBehaviour =>
      'কী ঘটেছে, এবং বাড়িতে কী সহায়তা কাজে লাগবে?';

  @override
  String get parentHotlineNoteHintPositive => 'জানানোর মতো ভালো খবরটি কী?';

  @override
  String get parentHotlineDraftAction => 'বার্তার খসড়া তৈরি করুন';

  @override
  String get parentHotlineErrorTitle => 'কিছু একটা সমস্যা হয়েছে';

  @override
  String get parentHotlineGenericError =>
      'এটি সম্পন্ন হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get parentHotlineEvidenceAttendanceHeader => 'উপস্থিতি';

  @override
  String get parentHotlineEvidenceMarksHeader => 'সাম্প্রতিক নম্বর';

  @override
  String get parentHotlineEvidenceBehaviourHeader => 'কী ঘটেছে';

  @override
  String get parentHotlineEvidencePositiveHeader => 'ভালো খবর';

  @override
  String parentHotlineEvidenceAbsentDays(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: 'পরপর $days দিন অনুপস্থিত',
      one: 'পরপর ১ দিন অনুপস্থিত',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineEvidenceAbsencePrompt =>
      'অনুপস্থিত দিনগুলি নিশ্চিত করুন, যাতে অভিভাবক সঠিক তথ্যটি শুনতে পান।';

  @override
  String get parentHotlineEvidenceMarksPrompt =>
      'সর্বশেষ নম্বরগুলি কলে উল্লেখ করার জন্য প্রস্তুত।';

  @override
  String get parentHotlineEvidenceMarksEmpty =>
      'এখনও কোনো সাম্প্রতিক নম্বর নথিভুক্ত নেই। অভিভাবকের যা জানা দরকার তা নিচে যোগ করুন।';

  @override
  String get parentHotlineEvidenceBehaviourPrompt =>
      'কী ঘটেছে এবং বাড়িতে কী সহায়তা কাজে লাগবে তা বর্ণনা করুন।';

  @override
  String get parentHotlineEvidencePositivePrompt =>
      'অভিভাবক যে সাফল্যটি উদযাপন করবেন, তা জানান।';

  @override
  String get parentHotlineReviewEyebrow => 'বাড়িতে বার্তা';

  @override
  String get parentHotlineCall => 'অভিভাবককে কল করুন';

  @override
  String get parentHotlineWhatsApp => 'WhatsApp-এর জন্য কপি করুন';

  @override
  String parentHotlineCallAgainIn(String time) {
    return '$time পরে আবার কল করুন';
  }

  @override
  String parentHotlineUnsupportedLanguage(String language) {
    return '$language ভাষায় এখনও স্বয়ংক্রিয় কল করা যায় না। বদলে WhatsApp-এর জন্য কপি করুন।';
  }

  @override
  String parentHotlinePhoneMask(String last4) {
    return '•••• $last4';
  }

  @override
  String get parentHotlineAiNotice =>
      'কলটি একটি স্বয়ংক্রিয় AI ভয়েস ঘোষণা দিয়ে শুরু হয়।';

  @override
  String get parentHotlineCopied =>
      'বার্তা কপি হয়েছে। পাঠাতে WhatsApp-এ পেস্ট করুন।';

  @override
  String get parentHotlinePremiumTitle =>
      'অভিভাবককে কল করার জন্য একটি উন্নত প্ল্যান প্রয়োজন';

  @override
  String get parentHotlinePremiumBody =>
      'অভিভাবককে AI ভয়েস কল করা উন্নত প্ল্যানের অংশ। তবে আপনি এখনও বিনামূল্যে WhatsApp-এ পাঠানোর জন্য একটি বার্তা কপি করতে পারেন।';

  @override
  String get parentHotlineComingSoonTitle => 'কলের স্ক্রিন শীঘ্রই আসছে';

  @override
  String get parentHotlineComingSoonBody =>
      'কল করা ও তার অগ্রগতি দেখার সুবিধা পরবর্তী আপডেটে আসবে।';

  @override
  String parentHotlineCallingTitle(String name) {
    return '$name-এর অভিভাবককে কল করা হচ্ছে…';
  }

  @override
  String get parentHotlineCallingRinging => 'রিং হচ্ছে…';

  @override
  String get parentHotlineCallingInProgress => 'কথোপকথন চলছে';

  @override
  String parentHotlineCallingExchanges(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি বিনিময়',
      one: '১টি বিনিময়',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineCallingReassurance =>
      'আপনি এই স্ক্রিন থেকে চলে যেতে পারেন — সারসংক্ষেপ আপনার জন্য অপেক্ষা করবে।';

  @override
  String get parentHotlineSummaryDocType => 'অভিভাবক কল';

  @override
  String get parentHotlineSummaryReasonAbsences => 'অনুপস্থিতি';

  @override
  String get parentHotlineSummaryReasonPerformance => 'ফলাফল';

  @override
  String get parentHotlineSummaryReasonBehaviour => 'আচরণ';

  @override
  String get parentHotlineSummaryReasonPositive => 'সুসংবাদ';

  @override
  String parentHotlineSummaryTitle(String name) {
    return '$name-এর অভিভাবক';
  }

  @override
  String parentHotlineSummaryDurationMin(int minutes) {
    return '$minutes মিনিট';
  }

  @override
  String get parentHotlineSentimentCooperative => 'সহযোগিতাপূর্ণ';

  @override
  String get parentHotlineSentimentConcerned => 'উদ্বিগ্ন';

  @override
  String get parentHotlineSentimentGrateful => 'কৃতজ্ঞ';

  @override
  String get parentHotlineSentimentUpset => 'ক্ষুব্ধ';

  @override
  String get parentHotlineSentimentIndifferent => 'সংযত';

  @override
  String get parentHotlineSentimentConfused => 'বিভ্রান্ত';

  @override
  String get parentHotlineSummarySaidHeader => 'অভিভাবক যা বলেছেন';

  @override
  String get parentHotlineSummaryConcernsHeader => 'উত্থাপিত উদ্বেগ';

  @override
  String get parentHotlineSummaryCommitmentsHeader => 'অভিভাবকের প্রতিশ্রুতি';

  @override
  String get parentHotlineSummaryActionsHeader => 'আপনার করণীয়';

  @override
  String get parentHotlineSummaryGuidanceHeader => 'যে পরামর্শ দেওয়া হয়েছে';

  @override
  String get parentHotlineSummaryFollowUpHeader => 'পরবর্তী পদক্ষেপ';

  @override
  String parentHotlineSummaryTranscript(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'কথোপকথন দেখুন · $countটি বার্তা',
      one: 'কথোপকথন দেখুন · 1টি বার্তা',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineSummaryDone => 'সম্পন্ন';

  @override
  String get parentHotlineSummaryCallAgain => 'পরে আবার কল করুন';

  @override
  String get parentHotlineSummaryManualTitle => 'বার্তা কপি হয়েছে';

  @override
  String get parentHotlineSummaryManualBody =>
      'অভিভাবককে পাঠাতে এটি WhatsApp-এ পেস্ট করুন।';

  @override
  String get parentHotlineSummaryBusy => 'লাইন ব্যস্ত ছিল';

  @override
  String get parentHotlineSummaryNoAnswer => 'কোনো উত্তর নেই';

  @override
  String get parentHotlineSummaryFailed => 'কল সংযোগ করা গেল না';

  @override
  String get parentHotlineSummaryFailedBody =>
      'কলটি সম্পূর্ণ হয়নি। আপনি আবার চেষ্টা করতে পারেন, বা বার্তাটি কপি করে WhatsApp-এ পাঠাতে পারেন।';

  @override
  String get parentHotlineSummaryTryAgain => 'আবার চেষ্টা করুন';

  @override
  String get parentHotlineSummaryNoConversationTitle =>
      'কল খুব তাড়াতাড়ি শেষ হয়ে গেছে';

  @override
  String get parentHotlineSummaryNoConversationBody =>
      'কথোপকথন শুরু হওয়ার আগেই কল শেষ হয়ে গেছে। আপনি আবার চেষ্টা করতে পারেন, বা বার্তাটি WhatsApp-এ পাঠাতে পারেন।';

  @override
  String get parentHotlineSummaryUnavailableTitle => 'সারসংক্ষেপ উপলব্ধ নেই';

  @override
  String get parentHotlineSummaryUnavailableBody =>
      'এই কলের সারসংক্ষেপ তৈরি করা যায়নি। কথোপকথনটি নিচে দেওয়া হলো।';

  @override
  String get contentCreatorTitle => 'কনটেন্ট তৈরির স্টুডিও';

  @override
  String get contentCreatorTileSubtitle =>
      'আপনার ক্লাসের জন্য মাল্টিমিডিয়া তৈরি করুন';

  @override
  String get contentCreatorSubtitle =>
      'আপনার শ্রেণিকক্ষের জন্য আকর্ষণীয় মাল্টিমিডিয়া কনটেন্ট তৈরিতে সাহায্য করার সরঞ্জাম।';

  @override
  String get contentCreatorSectionEyebrow => 'একটি সরঞ্জাম বেছে নিন';

  @override
  String get contentCreatorVisualAidDesc =>
      'আপনার পাঠের জন্য সরল রেখাচিত্র ও ডায়াগ্রাম তৈরি করুন।';

  @override
  String get contentCreatorFieldTripDesc =>
      'Google Earth ব্যবহার করে আকর্ষণীয় ভার্চুয়াল ভ্রমণের পরিকল্পনা করুন।';

  @override
  String get contentCreatorVideoDesc =>
      'আপনার পাঠের জন্য বাছাই করা শিক্ষামূলক ভিডিও খুঁজে নিন।';

  @override
  String get visualAidTitle => 'চিত্র সহায়ক';

  @override
  String get visualAidSubtitle => 'শিক্ষণ চিত্র আঁকুন';

  @override
  String get visualAidEmpty => 'একটি ছবির বর্ণনা দিন এবং তৈরি করুন চাপুন।';

  @override
  String get visualAidPromptLabel => 'ছবিতে কী দেখাতে হবে?';

  @override
  String get visualAidPromptHint => 'উদাহরণস্বরূপ, উদ্ভিদ কোষের অংশগুলি';

  @override
  String get visualAidPromptError => 'আপনার কেমন ছবি দরকার তা লিখুন।';

  @override
  String get visualAidGradeLabel => 'শ্রেণি স্তর';

  @override
  String get visualAidGradeAny => 'যেকোনো শ্রেণি';

  @override
  String get visualAidSubjectLabel => 'বিষয়';

  @override
  String get visualAidSubjectAny => 'যেকোনো বিষয়';

  @override
  String get visualAidOptional => 'ঐচ্ছিক';

  @override
  String get visualAidAction => 'চিত্র তৈরি করুন';

  @override
  String get visualAidResultTitle => 'চিত্র সহায়ক';

  @override
  String get visualAidHowToUse => 'কীভাবে ব্যবহার করবেন';

  @override
  String get visualAidDiscussionSpark => 'আলোচনার প্রশ্ন';

  @override
  String get visualAidImageLabel => 'তৈরি করা শিক্ষণ চিত্র';

  @override
  String get visualAidImageError => 'এই ছবিটি দেখানো যায়নি।';

  @override
  String get visualAidNoImage =>
      'সেই বর্ণনার জন্য কোনো ছবি পাওয়া যায়নি। অনুগ্রহ করে এটি আবার লিখে চেষ্টা করুন।';

  @override
  String get visualAidSignIn =>
      'এই সরঞ্জামটি ব্যবহার করতে অনুগ্রহ করে আবার সাইন ইন করুন।';

  @override
  String get visualAidUpgradeTitle => 'একটি উচ্চতর প্ল্যান প্রয়োজন';

  @override
  String get visualAidUpgradeBody =>
      'চিত্র সহায়ক একটি উচ্চতর প্ল্যানের অংশ। ছবি তৈরি চালিয়ে যেতে অনুগ্রহ করে আপগ্রেড করুন।';

  @override
  String get visualAidSeePricing => 'প্ল্যান ও মূল্য দেখুন';

  @override
  String get visualAidDailyLimitTitle =>
      'আজকের জন্য আপনার সব ছবি তৈরি হয়ে গেছে';

  @override
  String get visualAidDailyLimitBody =>
      'আপনার প্ল্যানে প্রতিদিন একটি নির্দিষ্ট সংখ্যক চিত্র সহায়ক অন্তর্ভুক্ত। আপনার ছবি আগামীকাল আবার পাওয়া যাবে, অথবা আপনি উচ্চতর প্ল্যানে দৈনিক সীমা বাড়াতে পারেন।';

  @override
  String get visualAidLimitTitle => 'আপনি আপনার সীমায় পৌঁছেছেন';

  @override
  String get visualAidLimitBody =>
      'আপনি এই মাসের চিত্র সহায়ক ব্যবহার করে ফেলেছেন। আপনার ছবি পরের মাসে আবার পাওয়া যাবে, অথবা আপনি উচ্চতর প্ল্যানে সীমা বাড়াতে পারেন।';

  @override
  String get visualAidRephrase =>
      'আমরা সেই ছবিটি তৈরি করতে পারিনি। অনুগ্রহ করে এটি আবার লিখে চেষ্টা করুন।';

  @override
  String get visualAidEmptyGeneration =>
      'ছবিটি খালি এসেছে। কম লেবেল দিয়ে বর্ণনা করার চেষ্টা করুন।';

  @override
  String get visualAidBusy =>
      'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।';

  @override
  String visualAidBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে প্রায় $seconds সেকেন্ড পরে আবার চেষ্টা করুন।',
      one:
          'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে প্রায় ১ সেকেন্ড পরে আবার চেষ্টা করুন।',
    );
    return '$_temp0';
  }

  @override
  String get visualAidTimeout =>
      'এতে প্রত্যাশার চেয়ে বেশি সময় লাগছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get videoStorytellerTitle => 'ভিডিও কাহিনিকার';

  @override
  String get videoStorytellerSubtitle => 'শিক্ষণ ভিডিও খুঁজুন';

  @override
  String get videoStorytellerEmpty =>
      'একটি বিষয় বা টপিক বেছে নিন এবং ভিডিও খুঁজুন-এ ট্যাপ করুন।';

  @override
  String get videoStorytellerTopicLabel => 'টপিক বা অধ্যায়';

  @override
  String get videoStorytellerTopicHint => 'উদাহরণস্বরূপ, জলচক্র';

  @override
  String get videoStorytellerSubjectLabel => 'বিষয়';

  @override
  String get videoStorytellerSubjectAny => 'যেকোনো বিষয়';

  @override
  String get videoStorytellerGradeLabel => 'শ্রেণি স্তর';

  @override
  String get videoStorytellerGradeAny => 'যেকোনো শ্রেণি';

  @override
  String get videoStorytellerOptional => 'ঐচ্ছিক';

  @override
  String get videoStorytellerAction => 'ভিডিও খুঁজুন';

  @override
  String get videoStorytellerNoResults =>
      'তার জন্য কোনো ভিডিও পাওয়া যায়নি। অন্য কোনো বিষয় বা টপিক চেষ্টা করুন।';

  @override
  String get videoStorytellerOfficialSource => 'আধিকারিক উৎস';

  @override
  String get videoStorytellerOpensExternally => 'ইউটিউবে, অ্যাপের বাইরে খোলে।';

  @override
  String get videoStorytellerCategoryTopRecommended =>
      'আপনার জন্য শীর্ষ প্রস্তাবিত';

  @override
  String get videoStorytellerCategoryStorytelling =>
      'আপনার বিষয়ের জন্য গল্পকথন';

  @override
  String get videoStorytellerCategoryPedagogy => 'শিক্ষণবিদ্যা ও শিক্ষণ পদ্ধতি';

  @override
  String get videoStorytellerCategoryGovtUpdates => 'সরকারি আপডেট';

  @override
  String get videoStorytellerCategoryCourses => 'শিক্ষক প্রশিক্ষণ কোর্স';

  @override
  String get videoStorytellerSignIn =>
      'এই সরঞ্জামটি ব্যবহার করতে অনুগ্রহ করে আবার সাইন ইন করুন।';

  @override
  String get videoStorytellerTimeout =>
      'এতে প্রত্যাশার চেয়ে বেশি সময় লাগছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get videoStorytellerBusy =>
      'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।';

  @override
  String videoStorytellerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে প্রায় $seconds সেকেন্ড পরে আবার চেষ্টা করুন।',
      one:
          'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে প্রায় ১ সেকেন্ড পরে আবার চেষ্টা করুন।',
    );
    return '$_temp0';
  }

  @override
  String get videoStorytellerRephrase =>
      'আমরা তার জন্য ভিডিও খুঁজে পাইনি। অনুগ্রহ করে অন্য কোনো টপিক চেষ্টা করুন।';

  @override
  String get videoStorytellerLimit =>
      'আপনি সম্প্রতি অনেক খুঁজেছেন। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।';

  @override
  String get actionDone => 'সম্পন্ন';

  @override
  String get virtualFieldTripTitle => 'ভার্চুয়াল ফিল্ড ট্রিপ';

  @override
  String get virtualFieldTripSubtitle => 'Google Earth-এ বিশ্ব ঘুরে দেখুন';

  @override
  String get virtualFieldTripEmpty =>
      'একটি বিষয় লিখুন এবং \'ভ্রমণ পরিকল্পনা করুন\'-এ ট্যাপ করুন।';

  @override
  String get virtualFieldTripTopicLabel => 'বিষয় বা থিম';

  @override
  String get virtualFieldTripTopicHint => 'উদাহরণস্বরূপ, গ্রেট ব্যারিয়ার রিফ';

  @override
  String get virtualFieldTripTopicError =>
      'অনুগ্রহ করে ভ্রমণের জন্য একটি বিষয় লিখুন।';

  @override
  String get virtualFieldTripGradeLabel => 'শ্রেণি স্তর';

  @override
  String get virtualFieldTripGradeAny => 'যেকোনো শ্রেণি';

  @override
  String get virtualFieldTripOptional => 'ঐচ্ছিক';

  @override
  String get virtualFieldTripAction => 'ভ্রমণ পরিকল্পনা করুন';

  @override
  String get virtualFieldTripDocType => 'ভার্চুয়াল ফিল্ড ট্রিপ';

  @override
  String virtualFieldTripStopCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি স্টপ',
      one: '১টি স্টপ',
    );
    return '$_temp0';
  }

  @override
  String virtualFieldTripStopSemantics(int number, String name) {
    return 'স্টপ $number: $name';
  }

  @override
  String get virtualFieldTripFactLabel => 'আপনি কি জানেন?';

  @override
  String get virtualFieldTripReflectionLabel => 'এটি নিয়ে ভাবুন';

  @override
  String get virtualFieldTripAnalogyLabel => 'আমাদের প্রেক্ষাপটে';

  @override
  String get virtualFieldTripExplanationLabel => 'আমরা কেন যাই';

  @override
  String get virtualFieldTripOpenEarth => 'Google Earth-এ খুলুন';

  @override
  String get virtualFieldTripOpensExternally =>
      'অ্যাপের বাইরে, Google Earth-এ খোলে।';

  @override
  String get virtualFieldTripPendingTitle =>
      'আপনার ভ্রমণ এখনও পরিকল্পনা করা হচ্ছে';

  @override
  String get virtualFieldTripPendingBody =>
      'আপনার ফিল্ড ট্রিপ এখনও তৈরি হচ্ছে। এক মিনিটের মধ্যে \'আমার লাইব্রেরি\' দেখুন।';

  @override
  String get virtualFieldTripNoStops =>
      'এর জন্য কোনো স্টপ পাওয়া যায়নি। অন্য একটি বিষয় চেষ্টা করুন।';

  @override
  String get virtualFieldTripSignIn =>
      'এই টুলটি ব্যবহার করতে অনুগ্রহ করে আবার সাইন ইন করুন।';

  @override
  String get virtualFieldTripUnavailable =>
      'এই টুলটি আপনার বর্তমান প্ল্যানের অন্তর্ভুক্ত নয়।';

  @override
  String get virtualFieldTripTimeout =>
      'এতে প্রত্যাশার চেয়ে বেশি সময় লাগছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get virtualFieldTripBusy =>
      'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।';

  @override
  String virtualFieldTripBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে প্রায় $seconds সেকেন্ড পরে আবার চেষ্টা করুন।',
      one:
          'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে প্রায় ১ সেকেন্ড পরে আবার চেষ্টা করুন।',
    );
    return '$_temp0';
  }

  @override
  String get virtualFieldTripRephrase =>
      'আমরা এর জন্য কোনো ভ্রমণ পরিকল্পনা করতে পারিনি। অনুগ্রহ করে অন্য একটি বিষয় চেষ্টা করুন।';

  @override
  String get virtualFieldTripLimit =>
      'আপনি সম্প্রতি অনেক ভ্রমণ পরিকল্পনা করেছেন। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।';

  @override
  String get assessmentScannerTitle => 'মূল্যায়ন স্ক্যানার';

  @override
  String get assessmentScannerSubtitle =>
      'শিক্ষার্থীর উত্তরপত্র পৃষ্ঠা ধরে ধরে মূল্যায়ন করুন';

  @override
  String get assessmentScannerEmpty =>
      'উত্তরপত্রের 3টি পর্যন্ত ছবি যোগ করুন, তারপর মূল্যায়ন চাপুন।';

  @override
  String get assessmentScannerSubmit => 'উত্তরপত্র মূল্যায়ন করুন';

  @override
  String get assessmentScannerResultTitle => 'মূল্যায়ন';

  @override
  String get assessmentScannerSectionSheet => 'উত্তরপত্র';

  @override
  String get assessmentScannerPagesLabel => 'উত্তরপত্রের পৃষ্ঠা';

  @override
  String get assessmentScannerPagesHint =>
      '3টি পর্যন্ত পরিষ্কার ছবি যোগ করুন, প্রতিটি পৃষ্ঠার একটি।';

  @override
  String get assessmentScannerPagesEmpty => 'প্রথম পৃষ্ঠার একটি ছবি যোগ করুন।';

  @override
  String assessmentScannerPageLabel(int number) {
    return 'পৃষ্ঠা $number';
  }

  @override
  String assessmentScannerRemovePage(int number) {
    return 'পৃষ্ঠা $number সরান';
  }

  @override
  String assessmentScannerPageCounter(int count, int max) {
    return '$maxটির মধ্যে $countটি পৃষ্ঠা';
  }

  @override
  String assessmentScannerPagesFull(int max) {
    return 'আপনি $maxটি পর্যন্ত পৃষ্ঠা যোগ করতে পারেন।';
  }

  @override
  String get assessmentScannerTakePhoto => 'ছবি তুলুন';

  @override
  String get assessmentScannerChooseGallery => 'গ্যালারি থেকে বেছে নিন';

  @override
  String get assessmentScannerSubjectLabel => 'বিষয়';

  @override
  String get assessmentScannerSubjectHint => 'মূল্যায়ন বিষয় অনুযায়ী হয়।';

  @override
  String get assessmentScannerSubjectPlaceholder => 'বিষয় বেছে নিন';

  @override
  String get assessmentScannerSubjectError => 'অনুগ্রহ করে বিষয় বেছে নিন।';

  @override
  String get assessmentScannerGradeLabel => 'শ্রেণি স্তর';

  @override
  String get assessmentScannerGradePlaceholder => 'শ্রেণি বেছে নিন';

  @override
  String get assessmentScannerGradeError => 'অনুগ্রহ করে শ্রেণি বেছে নিন।';

  @override
  String get assessmentScannerOptional => 'ঐচ্ছিক';

  @override
  String get assessmentScannerAnswerKeyLabel => 'উত্তরসূচি';

  @override
  String get assessmentScannerAnswerKeyHint =>
      'সঠিক উত্তরগুলি পেস্ট করুন, সেগুলির অনুযায়ী মূল্যায়ন হবে।';

  @override
  String get assessmentScannerAnswerKeyPlaceholder =>
      'উত্তরসূচি টাইপ করুন বা পেস্ট করুন';

  @override
  String get assessmentScannerPrivacyNote =>
      'মূল্যায়নের জন্য শিক্ষার্থীর নাম কখনও পাঠানো হয় না।';

  @override
  String assessmentScannerScoreCaption(String awarded, String max) {
    return '$max-এর মধ্যে $awarded নম্বর';
  }

  @override
  String get assessmentScannerScoreOutOf => '100-এর মধ্যে';

  @override
  String assessmentScannerMarks(String awarded, String max) {
    return '$awarded/$max';
  }

  @override
  String assessmentScannerPagesMeta(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি পৃষ্ঠা',
      one: '1টি পৃষ্ঠা',
    );
    return '$_temp0';
  }

  @override
  String assessmentScannerReviewBadge(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি যাচাই করুন',
      one: '1টি যাচাই করুন',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerQuestionsSection => 'প্রশ্ন ধরে ধরে';

  @override
  String get assessmentScannerStudentAnswerLabel => 'শিক্ষার্থী লিখেছে';

  @override
  String get assessmentScannerFeedbackLabel => 'মতামত';

  @override
  String get assessmentScannerExpectedLabel => 'প্রত্যাশিত উত্তর';

  @override
  String get assessmentScannerNextStepsSection => 'সুপারিশকৃত পরবর্তী পদক্ষেপ';

  @override
  String get assessmentScannerStudentSection => 'শিক্ষার্থীর জন্য';

  @override
  String get assessmentScannerQualitySection => 'ছবির মান';

  @override
  String get assessmentScannerNotScored => 'নম্বর দেওয়া হয়নি';

  @override
  String get assessmentScannerNoContent =>
      'কোনও নম্বর আসেনি। অনুগ্রহ করে পরিষ্কার ছবি চেষ্টা করুন।';

  @override
  String get assessmentScannerOutcomeCorrect => 'সঠিক';

  @override
  String get assessmentScannerOutcomePartial => 'আংশিক সঠিক';

  @override
  String get assessmentScannerOutcomeIncorrect => 'ভুল';

  @override
  String get assessmentScannerReviewChip => 'এটি যাচাই করুন';

  @override
  String get assessmentScannerSignIn =>
      'উত্তরপত্র মূল্যায়ন করতে অনুগ্রহ করে আবার সাইন ইন করুন।';

  @override
  String get assessmentScannerUpgradeTitle => 'উচ্চতর পরিকল্পনা প্রয়োজন';

  @override
  String get assessmentScannerUpgradeBody =>
      'উত্তরপত্র মূল্যায়ন উচ্চতর পরিকল্পনার অংশ। মূল্যায়ন চালিয়ে যেতে আপগ্রেড করুন।';

  @override
  String get assessmentScannerSeePricing => 'পরিকল্পনা দেখুন';

  @override
  String get assessmentScannerDailyLimitTitle =>
      'আজকের জন্য আপনার সব উত্তরপত্র শেষ';

  @override
  String get assessmentScannerDailyLimitBody =>
      'আপনার পরিকল্পনায় প্রতিদিন নির্দিষ্ট সংখ্যক উত্তরপত্র থাকে। সেগুলি আগামীকাল আবার শুরু হবে, বা উচ্চতর পরিকল্পনায় সীমা বাড়াতে পারেন।';

  @override
  String get assessmentScannerLimitTitle =>
      'আপনি আপনার মূল্যায়ন সীমায় পৌঁছেছেন';

  @override
  String get assessmentScannerLimitBody =>
      'আপনি আপনার পরিকল্পনার সব উত্তরপত্র ব্যবহার করেছেন। সেগুলি আগামী মাসে আবার শুরু হবে, বা উচ্চতর পরিকল্পনায় সীমা বাড়াতে পারেন।';

  @override
  String get assessmentScannerBusy =>
      'মূল্যায়ন মডেল এখন ব্যস্ত। অনুগ্রহ করে এক মিনিট পরে আবার চেষ্টা করুন।';

  @override
  String assessmentScannerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'মূল্যায়ন মডেল এখন ব্যস্ত। অনুগ্রহ করে প্রায় $seconds সেকেন্ড পরে আবার চেষ্টা করুন।',
      one:
          'মূল্যায়ন মডেল এখন ব্যস্ত। অনুগ্রহ করে প্রায় 1 সেকেন্ড পরে আবার চেষ্টা করুন।',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerTimeout =>
      'মূল্যায়নে স্বাভাবিকের চেয়ে বেশি সময় লাগছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get assessmentScannerRephrase =>
      'ছবিগুলি মূল্যায়ন করা যায়নি। অনুগ্রহ করে পরিষ্কার পৃষ্ঠা আবার আপলোড করুন।';

  @override
  String get inboxTitle => 'বার্তা';

  @override
  String get inboxSignInTitle => 'আপনার বার্তা';

  @override
  String get inboxSignInBody => 'আপনার বার্তা দেখতে সাইন ইন করুন';

  @override
  String get inboxEmptyTitle => 'এখনও কোনো কথোপকথন নেই';

  @override
  String get inboxEmptyBody =>
      'আপনি শিক্ষকদের সাথে যুক্ত হলে, আপনার কথোপকথন এখানে দেখা যাবে।';

  @override
  String get inboxErrorBody =>
      'আমরা আপনার বার্তা লোড করতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get inboxNoMessagesYet => 'এখনও কোনো বার্তা নেই';

  @override
  String get inboxThreadFallbackTitle => 'কথোপকথন';

  @override
  String get inboxThreadEmptyTitle => 'এখনও কোনো বার্তা নেই';

  @override
  String get inboxThreadEmptyBody => 'কথোপকথন শুরু করতে শুভেচ্ছা জানান।';

  @override
  String get inboxComposerHint => 'একটি বার্তা লিখুন';

  @override
  String get inboxComposerSend => 'পাঠান';

  @override
  String get inboxLoadOlder => 'পুরনো বার্তা লোড করুন';

  @override
  String get inboxSendFailed => 'আপনার বার্তা পাঠানো যায়নি।';

  @override
  String get inboxResourceLabel => 'রিসোর্স';

  @override
  String get inboxVoiceNoteLabel => 'ভয়েস নোট';

  @override
  String inboxUnreadLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি অপঠিত',
      one: '1টি অপঠিত',
    );
    return '$_temp0';
  }

  @override
  String get inboxTickSending => 'পাঠানো হচ্ছে';

  @override
  String get inboxTickSent => 'পাঠানো হয়েছে';

  @override
  String get inboxTickDelivered => 'পৌঁছেছে';

  @override
  String get inboxTickRead => 'পঠিত';

  @override
  String get inboxTickFailed => 'পাঠানো যায়নি';

  @override
  String get inboxTimeNow => 'এখন';

  @override
  String inboxTimeMinutes(int count) {
    return '$count মি';
  }

  @override
  String inboxTimeHours(int count) {
    return '$count ঘ';
  }

  @override
  String inboxTimeDays(int count) {
    return '$count দি';
  }

  @override
  String inboxTimeWeeks(int count) {
    return '$count সপ্তা';
  }

  @override
  String get networkTitle => 'নেটওয়ার্ক';

  @override
  String get networkTooltip => 'নেটওয়ার্ক';

  @override
  String get networkTabStaffroom => 'স্টাফরুম';

  @override
  String get networkTabMessages => 'বার্তা';

  @override
  String get staffroomTitle => 'স্টাফরুম';

  @override
  String get staffroomHeroTitle => 'স্টাফরুম';

  @override
  String get staffroomHeroDeck => 'সারা ভারতের শিক্ষক, এক ঘরে';

  @override
  String get staffroomSectionGroups => 'আপনার গ্রুপ';

  @override
  String get staffroomSectionFeed => 'আপনার গ্রুপ থেকে';

  @override
  String get staffroomSectionDiscover => 'গ্রুপ খুঁজুন';

  @override
  String get staffroomSectionPeople => 'যাঁদের আপনি চিনতে পারেন';

  @override
  String get staffroomSignInTitle => 'স্টাফরুমে যোগ দিন';

  @override
  String get staffroomSignInBody => 'স্টাফরুমে যোগ দিতে সাইন ইন করুন';

  @override
  String get staffroomFeedEmptyTitle => 'আপনার ফিড শান্ত';

  @override
  String get staffroomFeedEmptyBody => 'আপনার গ্রুপের পোস্ট এখানে দেখা যাবে।';

  @override
  String get staffroomErrorBody =>
      'আমরা স্টাফরুম লোড করতে পারিনি। আবার চেষ্টা করুন।';

  @override
  String get staffroomGroupsEmptyTitle => 'এখনও কোনো গ্রুপ নেই';

  @override
  String get staffroomGroupsEmptyBody =>
      'পোস্ট ও চ্যাট দেখতে একটি গ্রুপে যোগ দিন।';

  @override
  String get staffroomBrowseGroups => 'গ্রুপ ব্রাউজ করুন';

  @override
  String staffroomMemberCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count জন সদস্য',
      one: '1 জন সদস্য',
    );
    return '$_temp0';
  }

  @override
  String get staffroomJoin => 'যোগ দিন';

  @override
  String get staffroomJoined => 'যোগ দিয়েছেন';

  @override
  String get staffroomJoinFailed =>
      'যোগ দেওয়া যায়নি। আবার চেষ্টা করতে ট্যাপ করুন।';

  @override
  String get staffroomGroupLockedTitle => 'শুধু সদস্যদের জন্য';

  @override
  String get staffroomGroupLockedBody => 'এই গ্রুপের পোস্ট দেখতে যোগ দিন।';

  @override
  String get staffroomGroupPostsEmptyTitle => 'এখনও কোনো পোস্ট নেই';

  @override
  String get staffroomGroupPostsEmptyBody => 'এখানে প্রথম শেয়ার করুন।';

  @override
  String get staffroomGroupNotFoundTitle => 'গ্রুপ পাওয়া যায়নি';

  @override
  String get staffroomGroupNotFoundBody =>
      'এই গ্রুপটি সরিয়ে ফেলা হয়ে থাকতে পারে।';

  @override
  String get staffroomPostTypeShare => 'শেয়ার করেছেন';

  @override
  String get staffroomPostTypeAskHelp => 'সাহায্য দরকার';

  @override
  String get staffroomPostTypeCelebrate => 'উদযাপন';

  @override
  String get staffroomPostTypeResource => 'সম্পদ';

  @override
  String get staffroomLike => 'লাইক';

  @override
  String get staffroomLiked => 'লাইক করা হয়েছে';

  @override
  String staffroomLikeCountLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি লাইক',
      one: '1টি লাইক',
      zero: 'কোনো লাইক নেই',
    );
    return '$_temp0';
  }

  @override
  String get staffroomLikeFailed =>
      'আপডেট করা যায়নি। আবার চেষ্টা করতে ট্যাপ করুন।';

  @override
  String get staffroomResourceShared => 'একটি সম্পদ শেয়ার করেছেন';

  @override
  String staffroomChatHighlight(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি নতুন বার্তা',
      one: '1টি নতুন বার্তা',
    );
    return '$_temp0';
  }

  @override
  String get staffroomConnect => 'কানেক্ট করুন';

  @override
  String get staffroomConnectSent => 'অনুরোধ পাঠানো হয়েছে';

  @override
  String get staffroomConnectPending => 'অনুরোধ আগে থেকেই অপেক্ষমাণ';

  @override
  String get staffroomConnectConnected => 'ইতিমধ্যে কানেক্টেড';

  @override
  String get staffroomChatTitle => 'স্টাফরুম';

  @override
  String get staffroomChatEntryBody => 'সারা ভারতের শিক্ষকদের সঙ্গে আড্ডা দিন';

  @override
  String get staffroomChatSignInTitle => 'স্টাফরুমে যোগ দিন';

  @override
  String get staffroomChatSignInBody => 'স্টাফরুমে যোগ দিতে সাইন ইন করুন';

  @override
  String get staffroomChatEmptyTitle => 'এখনও কোনো বার্তা নেই';

  @override
  String get staffroomChatEmptyBody => 'প্রথম হয়ে সবাইকে শুভেচ্ছা জানান।';

  @override
  String get staffroomChatAiBadge => 'AI শিক্ষক';

  @override
  String get staffroomGroupChatEntry => 'গ্রুপ চ্যাট';

  @override
  String get staffroomDirectoryTitle => 'শিক্ষক খুঁজুন';

  @override
  String get staffroomDirectoryEntryBody => 'শিক্ষক ডিরেক্টরিতে খুঁজুন';

  @override
  String get staffroomDirectorySearchHint => 'নাম বা বিষয় দিয়ে খুঁজুন';

  @override
  String get staffroomDirectoryErrorBody =>
      'ডিরেক্টরি লোড করা যায়নি। আবার চেষ্টা করুন।';

  @override
  String get staffroomDirectoryEmptyTitle => 'কোনো শিক্ষক পাওয়া যায়নি';

  @override
  String get staffroomDirectoryEmptyBody => 'এখনও দেখানোর মতো কোনো শিক্ষক নেই।';

  @override
  String get staffroomDirectorySearchEmpty =>
      'আপনার খোঁজের সাথে কোনো শিক্ষক মেলেনি।';

  @override
  String get staffroomProfileTitle => 'শিক্ষক';

  @override
  String get staffroomProfileErrorBody =>
      'এই প্রোফাইলটি লোড করা যায়নি। আবার চেষ্টা করুন।';

  @override
  String get staffroomProfileNotFoundTitle => 'প্রোফাইল উপলব্ধ নেই';

  @override
  String get staffroomProfileNotFoundBody =>
      'এই প্রোফাইলটি খুঁজে পাওয়া যায়নি।';

  @override
  String get staffroomProfileAboutLabel => 'পরিচিতি';

  @override
  String get staffroomProfileBioEmpty => 'এখনও কোনো পরিচিতি নেই।';

  @override
  String get staffroomProfileVerified => 'যাচাইকৃত';

  @override
  String staffroomProfileExperience(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count বছরের অভিজ্ঞতা',
      one: '1 বছরের অভিজ্ঞতা',
    );
    return '$_temp0';
  }

  @override
  String get staffroomProfileSubjectsLabel => 'বিষয়';

  @override
  String get staffroomProfileClassesLabel => 'শ্রেণি';

  @override
  String get staffroomProfileLanguagesLabel => 'ভাষা';

  @override
  String get staffroomRequested => 'অনুরোধকৃত';

  @override
  String get staffroomConnectionAccept => 'গ্রহণ করুন';

  @override
  String get staffroomConnectionDecline => 'প্রত্যাখ্যান করুন';

  @override
  String get staffroomConnected => 'কানেক্টেড';

  @override
  String get staffroomConnectionWants => 'কানেক্ট করতে চায়';

  @override
  String get staffroomMessage => 'বার্তা পাঠান';

  @override
  String get staffroomConnectToMessage => 'বার্তা পাঠাতে কানেক্ট করুন';

  @override
  String get staffroomConnectionFailed =>
      'আপডেট করা যায়নি। আবার চেষ্টা করতে ট্যাপ করুন।';

  @override
  String get staffroomDisconnect => 'ডিসকানেক্ট করুন';

  @override
  String get staffroomDisconnectConfirmTitle => 'ডিসকানেক্ট করবেন?';

  @override
  String get staffroomDisconnectConfirmBody =>
      'আপনারা আর কানেক্টেড থাকবেন না বা একে অপরকে বার্তা পাঠাতে পারবেন না।';

  @override
  String get staffroomDisconnectCancel => 'কানেক্টেড থাকুন';

  @override
  String get staffroomFollow => 'ফলো করুন';

  @override
  String get staffroomFollowing => 'ফলো করছেন';

  @override
  String get staffroomFollowFailed =>
      'আপডেট করা যায়নি। আবার চেষ্টা করতে ট্যাপ করুন।';
}
