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
  String get splashFailedTitle => 'We could not start the app';

  @override
  String get splashFailedBody => 'Please check your connection and try again.';

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
    return 'Welcome back, $name';
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
  String get libraryTitle => 'எனது நூலகம்';

  @override
  String get librarySectionSaved => 'சேமித்தவை';

  @override
  String get libraryEmpty =>
      'நீங்கள் சேமித்த பாடத் திட்டங்கள் மற்றும் வினாடி வினாக்கள் இங்கே தோன்றும்.';

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
  String get profileTitle => 'சுயவிவரம்';

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
  String get settingsBoardLabel => 'கல்வி வாரியம்';

  @override
  String get settingsBoardNone => 'அமைக்கப்படவில்லை';

  @override
  String get settingsQualificationsLabel => 'Qualifications';

  @override
  String get settingsQualificationsHint =>
      'Choose every qualification you hold.';

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
      'This is the name other teachers see on work you share.';

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
      'This is the same language choice as the rest of the app, so changing it here changes it everywhere.';

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
  String get teacherTrainingSectionQuestion => 'கேள்வி';

  @override
  String get teacherTrainingResultTitle => 'வழிகாட்டல் குறிப்புகள்';

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
  String get parentMessageSectionMessage => 'செய்தி';

  @override
  String get parentMessageSectionDetails => 'கூடுதல் விவரங்கள்';

  @override
  String get parentMessageResultTitle => 'பெற்றோருக்கான செய்தி';

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
      'Welcome, teacher. Speak in your language, and I will prepare your work.';

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
    return 'View all $count';
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
  String get inboxComposerTooLong => 'Message too long. Please shorten it.';

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
}
