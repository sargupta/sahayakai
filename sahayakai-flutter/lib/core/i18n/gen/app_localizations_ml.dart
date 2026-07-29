// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Malayalam (`ml`).
class AppLocalizationsMl extends AppLocalizations {
  AppLocalizationsMl([String locale = 'ml']) : super(locale);

  @override
  String get appTitle => 'SahayakAI';

  @override
  String get navHome => 'ഹോം';

  @override
  String get navCreate => 'സൃഷ്ടിക്കുക';

  @override
  String get navLibrary => 'ലൈബ്രറി';

  @override
  String get navProfile => 'പ്രൊഫൈൽ';

  @override
  String get actionRetry => 'വീണ്ടും ശ്രമിക്കുക';

  @override
  String get actionSignIn => 'സൈൻ ഇൻ ചെയ്യൂ';

  @override
  String get actionSignOut => 'സൈൻ ഔട്ട്';

  @override
  String get actionGenerate => 'സൃഷ്ടിക്കുക';

  @override
  String get stateOfflineTitle => 'നിങ്ങൾ ഓഫ്‌ലൈനാണ്';

  @override
  String get stateOfflineBody =>
      'നിങ്ങളുടെ കണക്ഷൻ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get errorGeneric =>
      'എന്തോ കുഴപ്പം സംഭവിച്ചു. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get emptyDefault =>
      'ഫോം പൂരിപ്പിച്ച് സൃഷ്ടിക്കുക എന്നതിൽ ടാപ്പ് ചെയ്യുക.';

  @override
  String get languageLabel => 'ഭാഷ';

  @override
  String get splashTagline => 'ഓരോ ക്ലാസ്‌മുറിക്കും അധ്യാപന സഹായി';

  @override
  String get splashFailedTitle => 'We could not start the app';

  @override
  String get splashFailedBody => 'Please check your connection and try again.';

  @override
  String get loginTitle => 'SahayakAI ലേക്ക് സ്വാഗതം';

  @override
  String get loginSubtitle =>
      'പാഠപദ്ധതികൾ, ക്വിസുകൾ എന്നിവയ്ക്കും മറ്റും സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get loginGoogle => 'Google ഉപയോഗിച്ച് തുടരുക';

  @override
  String get loginPrivacyNote =>
      'നിങ്ങളെ സൈൻ ഇൻ ചെയ്യിക്കാൻ മാത്രമാണ് ഞങ്ങൾ നിങ്ങളുടെ Google അക്കൗണ്ട് ഉപയോഗിക്കുന്നത്. നിങ്ങളുടെ ജോലി നിങ്ങളുടേതായി തന്നെ തുടരും.';

  @override
  String get loginLanguagePrompt => 'നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക';

  @override
  String get loginLanguageHint =>
      'SahayakAI നിങ്ങളുടെ ഭാഷയിൽ പ്രവർത്തിക്കുന്നു, നിങ്ങളുടെ അധ്യാപന സാമഗ്രികളും അതേ ഭാഷയിൽ എഴുതുന്നു.';

  @override
  String get loginValueLessons =>
      'മിനിറ്റുകൾക്കുള്ളിൽ പൂർണ്ണമായ പാഠ പദ്ധതി തയ്യാറാക്കുക';

  @override
  String get loginValueQuizzes =>
      'മൂന്ന് ബുദ്ധിമുട്ട് നിലയിൽ ക്വിസ് ഉണ്ടാക്കുക';

  @override
  String get loginValueAnswers =>
      'നിങ്ങളുടെ ഭാഷയിൽ, ക്ലാസ് മുറിയിലെ ഏത് ചോദ്യത്തിനും ഉത്തരം നൽകുക';

  @override
  String get onboardingTitle => 'SahayakAI സജ്ജമാക്കുക';

  @override
  String get onboardingSkip => 'ഇപ്പോൾ വേണ്ട';

  @override
  String onboardingStepLabel(int current, int total) {
    return '$total ൽ ഘട്ടം $current';
  }

  @override
  String get onboardingBack => 'പിന്നോട്ട്';

  @override
  String get onboardingNext => 'അടുത്തത്';

  @override
  String get onboardingSaveAndContinue => 'സേവ് ചെയ്ത് തുടരുക';

  @override
  String get onboardingFinish => 'എന്റെ ഡാഷ്ബോർഡിലേക്ക് പോകുക';

  @override
  String get onboardingLanguageTitle =>
      'നിങ്ങൾ ഏത് ഭാഷയിലാണ് പഠിപ്പിക്കുന്നത്?';

  @override
  String get onboardingLanguageBody =>
      'നിങ്ങൾ തിരഞ്ഞെടുക്കുന്ന ഭാഷയിൽ തന്നെ പാഠ പദ്ധതികളും ക്വിസുകളും ഉത്തരങ്ങളും ലഭിക്കും. നിങ്ങൾക്ക് ഇത് എപ്പോൾ വേണമെങ്കിലും മാറ്റാം.';

  @override
  String get onboardingProfileTitle =>
      'നിങ്ങളുടെ ക്ലാസ് മുറിയെക്കുറിച്ച് ഞങ്ങളോട് പറയൂ';

  @override
  String get onboardingProfileBody =>
      'എല്ലാ ഫീൽഡും ഐച്ഛികമാണ്. നിങ്ങൾ പങ്കിടുന്നത് നിങ്ങളുടെ ബോർഡ്, ക്ലാസുകൾ, സംസ്ഥാനം എന്നിവയ്ക്ക് അനുസൃതമായി നിങ്ങളുടെ സാമഗ്രികൾ ക്രമീകരിക്കാൻ ഉപയോഗിക്കുന്നു.';

  @override
  String get onboardingReadyTitle => 'നിങ്ങൾ തുടങ്ങാൻ തയ്യാറാണ്';

  @override
  String get onboardingReadyBody =>
      'നിങ്ങളുടെ പാഠ പദ്ധതികളും ക്വിസുകളും ഉത്തരങ്ങളും ഇതിന് അനുസൃതമായിരിക്കും. പിന്നീട് എപ്പോൾ വേണമെങ്കിലും നിങ്ങളുടെ പ്രൊഫൈലിൽ നിന്ന് ഇത് മാറ്റാം.';

  @override
  String get onboardingSaveFailed =>
      'നിങ്ങളുടെ പ്രൊഫൈൽ സേവ് ചെയ്യാൻ ഞങ്ങൾക്കായില്ല. നിങ്ങൾക്ക് ഇപ്പോൾ തുടരാം, പിന്നീട് പ്രൊഫൈലിൽ നിന്ന് ഇത് ചേർക്കാം.';

  @override
  String get onboardingSaveSignIn =>
      'പ്രൊഫൈൽ സേവ് ചെയ്യാൻ ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക. നിങ്ങൾക്ക് ഇപ്പോൾ തുടരാം, പിന്നീട് ഇത് ചേർക്കാം.';

  @override
  String get dashboardGreeting => 'വീണ്ടും സ്വാഗതം';

  @override
  String dashboardGreetingNamed(String name) {
    return 'Welcome back, $name';
  }

  @override
  String get dashboardGreetingMorning => 'സുപ്രഭാതം';

  @override
  String get dashboardGreetingAfternoon => 'ശുഭ മധ്യാഹ്നം';

  @override
  String get dashboardGreetingEvening => 'ശുഭ സായാഹ്നം';

  @override
  String get actionOpen => 'തുറക്കുക';

  @override
  String get actionRegenerate => 'വീണ്ടും സൃഷ്ടിക്കുക';

  @override
  String get actionCopy => 'പകർത്തുക';

  @override
  String get copyConfirmation => 'ക്ലിപ്പ്ബോർഡിലേക്ക് പകർത്തി';

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
  String get lessonPlanSectionLesson => 'പാഠം';

  @override
  String get lessonPlanSectionApproach => 'അധ്യാപന സമീപനം';

  @override
  String get quizSectionQuiz => 'ക്വിസ്';

  @override
  String get sectionForYourClass => 'നിങ്ങളുടെ ക്ലാസിനായി';

  @override
  String get instantAnswerResultTitle => 'ഉത്തരം';

  @override
  String get dashboardToolsTitle => 'നിങ്ങളുടെ അധ്യാപന ഉപകരണങ്ങൾ';

  @override
  String get createPaletteSearchHint => 'ഉപകരണങ്ങൾ തിരയുക';

  @override
  String get createPaletteEmpty =>
      'നിങ്ങളുടെ തിരയലുമായി പൊരുത്തപ്പെടുന്ന ഉപകരണങ്ങളൊന്നുമില്ല';

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
  String get libraryTitle => 'എന്റെ ലൈബ്രറി';

  @override
  String get librarySectionSaved => 'സംരക്ഷിച്ചവ';

  @override
  String get libraryEmpty =>
      'നിങ്ങൾ സംരക്ഷിച്ച പാഠപദ്ധതികളും ക്വിസുകളും ഇവിടെ കാണാം.';

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
  String get profileTitle => 'പ്രൊഫൈൽ';

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
  String get settingsBoardLabel => 'വിദ്യാഭ്യാസ ബോർഡ്';

  @override
  String get settingsBoardNone => 'സജ്ജമാക്കിയിട്ടില്ല';

  @override
  String get settingsQualificationsLabel => 'Qualifications';

  @override
  String get settingsQualificationsHint =>
      'Choose every qualification you hold.';

  @override
  String get settingsAdminRoleLabel => 'ഭരണപരമായ പങ്ക്';

  @override
  String get settingsAdminRoleNone => 'സജ്ജമാക്കിയിട്ടില്ല';

  @override
  String get settingsRoleHod => 'വകുപ്പ് മേധാവി (HoD)';

  @override
  String get settingsRoleCoordinator => 'അക്കാദമിക് കോർഡിനേറ്റർ';

  @override
  String get settingsRoleExamController => 'പരീക്ഷാ നിയന്ത്രകൻ';

  @override
  String get settingsRoleVicePrincipal => 'വൈസ് പ്രിൻസിപ്പൽ';

  @override
  String get settingsRolePrincipal => 'പ്രിൻസിപ്പൽ';

  @override
  String get settingsRoleNone => 'അധ്യാപകൻ, ഭരണപരമായ പങ്ക് ഇല്ല';

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
  String get profileSectionAbout => 'നിങ്ങളെക്കുറിച്ച്';

  @override
  String get profileSectionTeaching => 'നിങ്ങൾ എന്ത് പഠിപ്പിക്കുന്നു';

  @override
  String get profileSectionLocation => 'നിങ്ങൾ എവിടെ പഠിപ്പിക്കുന്നു';

  @override
  String get profileSectionContact => 'ഞങ്ങൾ നിങ്ങളെ എങ്ങനെ ബന്ധപ്പെടണം';

  @override
  String get profileNameLabel => 'നിങ്ങളുടെ പേര്';

  @override
  String get profileNameHint =>
      'This is the name other teachers see on work you share.';

  @override
  String get profileNameInvalid => 'ദയവായി ഒരു ചെറിയ പേര് ഉപയോഗിക്കുക.';

  @override
  String get profileSchoolLabel => 'സ്കൂളിന്റെ പേര്';

  @override
  String get profileBoardCategoryLabel => 'ബോർഡ് തരം';

  @override
  String get profileBoardCategoryHint =>
      'താഴെയുള്ള ലിസ്റ്റ് ചെറുതാക്കാൻ ഒരു ബോർഡ് തരം തിരഞ്ഞെടുക്കുക.';

  @override
  String get profileBoardCategoryState => 'സംസ്ഥാന ബോർഡ്';

  @override
  String get profileStateLabel => 'സംസ്ഥാനം';

  @override
  String get profileStateNone => 'സജ്ജമാക്കിയിട്ടില്ല';

  @override
  String get profileDistrictLabel => 'ജില്ല';

  @override
  String get profileDistrictHint => 'നിങ്ങളുടെ സ്കൂൾ സ്ഥിതിചെയ്യുന്ന ജില്ല.';

  @override
  String get profileSubjectsLabel => 'നിങ്ങൾ പഠിപ്പിക്കുന്ന വിഷയങ്ങൾ';

  @override
  String get profileSubjectsHint => 'നിങ്ങൾക്ക് ആവശ്യമുള്ളത്ര തിരഞ്ഞെടുക്കുക.';

  @override
  String get profileGradesLabel => 'നിങ്ങൾ പഠിപ്പിക്കുന്ന ക്ലാസുകൾ';

  @override
  String get profileGradesHint => 'നിങ്ങൾക്ക് ആവശ്യമുള്ളത്ര തിരഞ്ഞെടുക്കുക.';

  @override
  String get profileLanguageHint =>
      'This is the same language choice as the rest of the app, so changing it here changes it everywhere.';

  @override
  String get profilePhoneLabel => 'മൊബൈൽ നമ്പർ';

  @override
  String get profilePhoneHint =>
      'ഐച്ഛികം. +91 സഹിതം അല്ലെങ്കിൽ അല്ലാതെ, പത്ത് അക്കങ്ങൾ.';

  @override
  String get profilePhoneInvalid =>
      'ദയവായി പത്ത് അക്കമുള്ള ഒരു ഇന്ത്യൻ മൊബൈൽ നമ്പർ നൽകുക.';

  @override
  String get profilePincodeLabel => 'പിൻ കോഡ്';

  @override
  String get profilePincodeHint => 'ഐച്ഛികം. ആറ് അക്കങ്ങൾ.';

  @override
  String get profilePincodeInvalid => 'ദയവായി ആറ് അക്കമുള്ള പിൻ കോഡ് നൽകുക.';

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
  String get meTitle => 'പ്രൊഫൈൽ';

  @override
  String get mePlanUsageTitle => 'പ്ലാനും ഉപയോഗവും';

  @override
  String get mePlanUsageSubtitle => 'ഈ മാസം നിങ്ങൾ എത്രത്തോളം ഉപയോഗിച്ചു.';

  @override
  String meUsageValue(int used, int limit) {
    return '$used / $limit';
  }

  @override
  String get meUsageUnlimited => 'പരിധിയില്ലാത്തത്';

  @override
  String get meUsageUnavailable =>
      'നിങ്ങളുടെ ഉപയോഗം ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get meDefaultsTitle => 'ഡിഫോൾട്ടുകൾ';

  @override
  String get mePrivacyTitle => 'സ്വകാര്യതയും ക്രമീകരണങ്ങളും';

  @override
  String get meRoleTeacher => 'അധ്യാപകൻ';

  @override
  String get usageFeatureAvatar => 'AI അവതാരങ്ങൾ';

  @override
  String get usageFeatureVoiceToText => 'ശബ്ദത്തിൽ നിന്ന് വാചകം';

  @override
  String get usageFeatureAssistant => 'VIDYA സഹായി';

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
  String get teacherTrainingSectionQuestion => 'ചോദ്യം';

  @override
  String get teacherTrainingResultTitle => 'മാർഗനിർദേശ കുറിപ്പുകൾ';

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
  String get parentMessageSectionMessage => 'സന്ദേശം';

  @override
  String get parentMessageSectionDetails => 'അധിക വിശദാംശങ്ങൾ';

  @override
  String get parentMessageResultTitle => 'രക്ഷിതാവിനുള്ള സന്ദേശം';

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
  String get assessSectionWork => 'വിദ്യാർത്ഥിയുടെ ജോലി';

  @override
  String get assessResultTitle => 'വിലയിരുത്തൽ';

  @override
  String get worksheetSectionWorksheet => 'വർക്ക്‌ഷീറ്റ്';

  @override
  String get rubricSectionAssignment => 'അസൈൻമെന്റ്';

  @override
  String get examPaperSectionPaper => 'ചോദ്യപേപ്പർ';

  @override
  String get examPaperSectionFormat => 'ഫോർമാറ്റ്';

  @override
  String get vidyaEyebrow => 'നിങ്ങളുടെ സഹ അധ്യാപകൻ';

  @override
  String get vidyaDeck => 'നിങ്ങളുടെ ഭാഷയിൽ സംസാരിക്കൂ, ഞാൻ ജോലി തയ്യാറാക്കാം.';

  @override
  String get vidyaGreeting =>
      'Welcome, teacher. Speak in your language, and I will prepare your work.';

  @override
  String get vidyaHeroBadge => 'നിങ്ങളുടെ AI അധ്യാപന സഹായി';

  @override
  String get vidyaPromptLesson => 'ഒരു പാഠം ആസൂത്രണം ചെയ്യാൻ പറയൂ';

  @override
  String get vidyaPromptQuiz => 'ഒരു ക്വിസ് ഉണ്ടാക്കാൻ പറയൂ';

  @override
  String get vidyaPromptParent => 'ഒരു രക്ഷിതാവിന് സന്ദേശം അയയ്ക്കാൻ പറയൂ';

  @override
  String get vidyaStateIdle => 'സംസാരിക്കാൻ ടാപ്പ് ചെയ്യൂ';

  @override
  String get vidyaStateReady => 'തയ്യാറാകുന്നു';

  @override
  String get vidyaStateListening => 'ഞാൻ കേൾക്കുന്നു';

  @override
  String get vidyaStateThinking => 'ചിന്തിക്കുന്നു';

  @override
  String get vidyaStateSpeaking => 'സംസാരിക്കുന്നു';

  @override
  String get vidyaYouSaid => 'നിങ്ങൾ പറഞ്ഞു';

  @override
  String get vidyaSignedOutTitle => 'VIDYA-യുമായി സംസാരിക്കാൻ സൈൻ ഇൻ ചെയ്യൂ';

  @override
  String get vidyaSignedOutBody =>
      'സൈൻ ഇൻ ചെയ്യൂ, VIDYA നിങ്ങളുടെ ഭാഷയിൽ പാഠങ്ങൾ, ക്വിസുകൾ എന്നിവയും അതിലധികവും തയ്യാറാക്കും.';

  @override
  String get vidyaMicOffTitle => 'മൈക്രോഫോൺ ഓണാക്കൂ';

  @override
  String get vidyaMicOffBody =>
      'നിങ്ങളെ കേൾക്കാൻ VIDYA-ക്ക് മൈക്രോഫോൺ വേണം. ക്രമീകരണങ്ങളിൽ അത് ഓണാക്കൂ.';

  @override
  String get vidyaOpenSettings => 'ക്രമീകരണങ്ങൾ തുറക്കൂ';

  @override
  String get vidyaSignIn => 'സൈൻ ഇൻ ചെയ്യൂ';

  @override
  String get vidyaLimitTitle => 'നിങ്ങൾ ഇന്നത്തെ ശബ്ദ പരിധിയിൽ എത്തി';

  @override
  String get vidyaLimitBody =>
      'നിങ്ങളുടെ ശബ്ദ മിനിറ്റുകൾ വീണ്ടും ലഭിക്കും. അതുവരെ നിങ്ങൾക്ക് ടൂളുകൾ ഉപയോഗിക്കാം.';

  @override
  String get vidyaErrorTitle => 'അത് പൂർത്തിയായില്ല';

  @override
  String get vidyaErrorBody =>
      'എന്തോ കുഴപ്പം സംഭവിച്ചു. വീണ്ടും ശ്രമിക്കാൻ മുദ്രയിൽ ടാപ്പ് ചെയ്യൂ.';

  @override
  String get vidyaPrepDesk => 'ഒരുക്ക ഡെസ്ക്';

  @override
  String get vidyaClearConversation => 'സംഭാഷണം മായ്ക്കുക';

  @override
  String get vidyaFlowVisualAid => 'ദൃശ്യ സഹായി';

  @override
  String get vidyaFlowVirtualFieldTrip => 'വെർച്വൽ ഫീൽഡ് ട്രിപ്പ്';

  @override
  String get vidyaFlowVideoStoryteller => 'വീഡിയോ കഥ';

  @override
  String get vidyaFieldMicLabel => 'സംസാരിച്ച് പൂരിപ്പിക്കുക';

  @override
  String get vidyaFieldMicFailed =>
      'കേൾക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക അല്ലെങ്കിൽ ടൈപ്പ് ചെയ്യുക.';

  @override
  String get vidyaOpen => 'VIDYA യോട് ചോദിക്കൂ';

  @override
  String get parentHotlineTitle => 'രക്ഷിതാവിനെ വിളിക്കൽ';

  @override
  String get parentHotlineSubtitle =>
      'വിദ്യാർത്ഥിയുടെ രക്ഷിതാവിനെ അവരുടെ ഭാഷയിൽ വിളിക്കൂ';

  @override
  String get parentHotlineEyebrow => 'രക്ഷിതാവിനെ വിളിക്കൽ';

  @override
  String get parentHotlinePickStudentIntro =>
      'ആരുടെ രക്ഷിതാവിനെ വിളിക്കണമെന്ന് തിരഞ്ഞെടുക്കൂ.';

  @override
  String get parentHotlineClassLabel => 'ക്ലാസ്';

  @override
  String get parentHotlineNoPhone => 'രക്ഷിതാവിന്റെ നമ്പർ സേവ് ചെയ്തിട്ടില്ല';

  @override
  String get parentHotlineSignedOutTitle =>
      'നിങ്ങളുടെ വിദ്യാർത്ഥികളെ കാണാൻ സൈൻ ഇൻ ചെയ്യൂ';

  @override
  String get parentHotlineSignedOutBody =>
      'സൈൻ ഇൻ ചെയ്താൽ നിങ്ങളുടെ ക്ലാസ് പട്ടിക ലോഡ് ആകും. രക്ഷിതാവിനെ വിളിക്കുന്നതിന് മുൻപ് ഈ സൗകര്യത്തിന് നിങ്ങളുടെ അക്കൗണ്ട് ആവശ്യമാണ്.';

  @override
  String get parentHotlineRosterUnavailableTitle =>
      'നിങ്ങളുടെ ക്ലാസ് പട്ടിക ഇനിയും ലഭ്യമല്ല';

  @override
  String get parentHotlineRosterUnavailableBody =>
      'നിങ്ങളുടെ വിദ്യാർത്ഥികളെ ഇവിടെ ഇനിയും ലോഡ് ചെയ്യാൻ കഴിയുന്നില്ല. ഇത് വരാനിരിക്കുന്ന ഒരു അപ്ഡേറ്റിൽ വരും. നിങ്ങൾ ഇതിനകം സൈൻ ഇൻ ചെയ്തിട്ടുണ്ട്, അതിനാൽ നിങ്ങൾ ഒന്നും ശരിയാക്കേണ്ടതില്ല.';

  @override
  String get parentHotlineReasonEyebrow => 'എന്തിനാണ് വിളിക്കുന്നത്';

  @override
  String get parentHotlineReasonAbsencesLabel => 'ആവർത്തിച്ചുള്ള അസാന്നിധ്യം';

  @override
  String get parentHotlineReasonAbsencesDesc =>
      'വിദ്യാർത്ഥി തുടർച്ചയായി പല ദിവസം ഹാജരായിട്ടില്ല.';

  @override
  String get parentHotlineReasonPerformanceLabel => 'ഒരു വിഷയത്തിൽ പിന്നോട്ട്';

  @override
  String get parentHotlineReasonPerformanceDesc =>
      'അടുത്തിടെയുള്ള മാർക്കുകളോ ക്ലാസ് വർക്കോ ശ്രദ്ധിക്കേണ്ടതുണ്ട്.';

  @override
  String get parentHotlineReasonBehaviourLabel => 'ക്ലാസിലെ പെരുമാറ്റം';

  @override
  String get parentHotlineReasonBehaviourDesc =>
      'രക്ഷിതാവ് അറിഞ്ഞിരിക്കേണ്ട ഒരു കാര്യം സംഭവിച്ചു.';

  @override
  String get parentHotlineReasonPositiveLabel => 'പങ്കിടാൻ സന്തോഷവാർത്ത';

  @override
  String get parentHotlineReasonPositiveDesc =>
      'രക്ഷിതാവിനൊപ്പം ഒരു നേട്ടം ആഘോഷിക്കൂ.';

  @override
  String get parentHotlineComposeEyebrow => 'വിളിക്ക് തയ്യാറെടുക്കൂ';

  @override
  String get parentHotlineNoteLabel => 'ഒരു കുറിപ്പ് ചേർക്കൂ';

  @override
  String get parentHotlineNoteHintAbsences =>
      'ഹാജരാകാത്ത ദിവസങ്ങളെക്കുറിച്ച് രക്ഷിതാവ് അറിയേണ്ട എന്തെങ്കിലും ഉണ്ടോ?';

  @override
  String get parentHotlineNoteHintPerformance =>
      'വിദ്യാർത്ഥിക്ക് മെച്ചപ്പെടാൻ എന്ത് സഹായിക്കും?';

  @override
  String get parentHotlineNoteHintBehaviour =>
      'എന്താണ് സംഭവിച്ചത്, വീട്ടിൽ എന്ത് പിന്തുണ സഹായകമാകും?';

  @override
  String get parentHotlineNoteHintPositive =>
      'പങ്കിടാനുള്ള സന്തോഷവാർത്ത എന്താണ്?';

  @override
  String get parentHotlineDraftAction => 'സന്ദേശം തയ്യാറാക്കൂ';

  @override
  String get parentHotlineErrorTitle => 'എന്തോ കുഴപ്പം സംഭവിച്ചു';

  @override
  String get parentHotlineGenericError =>
      'അത് നടന്നില്ല. ദയവായി വീണ്ടും ശ്രമിക്കൂ.';

  @override
  String get parentHotlineEvidenceAttendanceHeader => 'ഹാജർ';

  @override
  String get parentHotlineEvidenceMarksHeader => 'അടുത്തിടെയുള്ള മാർക്ക്';

  @override
  String get parentHotlineEvidenceBehaviourHeader => 'എന്ത് സംഭവിച്ചു';

  @override
  String get parentHotlineEvidencePositiveHeader => 'സന്തോഷവാർത്ത';

  @override
  String parentHotlineEvidenceAbsentDays(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: 'തുടർച്ചയായി $days ദിവസം ഹാജരില്ല',
      one: 'തുടർച്ചയായി 1 ദിവസം ഹാജരില്ല',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineEvidenceAbsencePrompt =>
      'രക്ഷിതാവ് കൃത്യമായ വിവരം കേൾക്കാൻ ഹാജരാകാത്ത ദിവസങ്ങൾ ഉറപ്പാക്കൂ.';

  @override
  String get parentHotlineEvidenceMarksPrompt =>
      'ഏറ്റവും പുതിയ മാർക്ക് വിളിയിൽ പറയാൻ തയ്യാറാണ്.';

  @override
  String get parentHotlineEvidenceMarksEmpty =>
      'ഇതുവരെ അടുത്തിടെയുള്ള മാർക്ക് രേഖയിലില്ല. രക്ഷിതാവ് അറിയേണ്ടത് താഴെ ചേർക്കൂ.';

  @override
  String get parentHotlineEvidenceBehaviourPrompt =>
      'എന്ത് സംഭവിച്ചുവെന്നും വീട്ടിൽ സഹായകമാകുന്ന പിന്തുണയും വിവരിക്കൂ.';

  @override
  String get parentHotlineEvidencePositivePrompt =>
      'രക്ഷിതാവ് ആഘോഷിക്കണമെന്ന് നിങ്ങൾ ആഗ്രഹിക്കുന്ന നേട്ടം പങ്കിടൂ.';

  @override
  String get parentHotlineReviewEyebrow => 'വീട്ടിലേക്കുള്ള സന്ദേശം';

  @override
  String get parentHotlineCall => 'രക്ഷിതാവിനെ വിളിക്കൂ';

  @override
  String get parentHotlineWhatsApp => 'WhatsApp-നായി പകർത്തൂ';

  @override
  String parentHotlineCallAgainIn(String time) {
    return '$time കഴിഞ്ഞ് വീണ്ടും വിളിക്കൂ';
  }

  @override
  String parentHotlineUnsupportedLanguage(String language) {
    return '$language ഭാഷയ്ക്ക് ഓട്ടോ-കോൾ ഇതുവരെ ലഭ്യമല്ല — പകരം WhatsApp-നായി പകർത്തൂ.';
  }

  @override
  String parentHotlinePhoneMask(String last4) {
    return '•••• $last4';
  }

  @override
  String get parentHotlineAiNotice =>
      'ഒരു ഓട്ടോമേറ്റഡ് AI ശബ്ദ അറിയിപ്പോടെയാണ് ഈ വിളി ആരംഭിക്കുന്നത്.';

  @override
  String get parentHotlineCopied =>
      'സന്ദേശം പകർത്തി — അയയ്ക്കാൻ WhatsApp-ൽ ഒട്ടിക്കൂ.';

  @override
  String get parentHotlinePremiumTitle =>
      'രക്ഷിതാവിനെ വിളിക്കൽ സൗകര്യത്തിന് വിപുലമായ പ്ലാൻ ആവശ്യമാണ്';

  @override
  String get parentHotlinePremiumBody =>
      'രക്ഷിതാവിന് ഒരു AI ശബ്ദ വിളി നടത്തുന്നത് വിപുലമായ പ്ലാനിന്റെ ഭാഗമാണ്. എന്നിരുന്നാലും, WhatsApp-ൽ അയയ്ക്കാൻ നിങ്ങൾക്ക് സൗജന്യമായി ഒരു സന്ദേശം പകർത്താം.';

  @override
  String get parentHotlineComingSoonTitle => 'വിളിയുടെ കാഴ്ച ഉടൻ എത്തും';

  @override
  String get parentHotlineComingSoonBody =>
      'വിളി നടത്തുന്നതും അത് പിന്തുടരുന്നതും അടുത്ത അപ്ഡേറ്റിൽ വരും.';

  @override
  String parentHotlineCallingTitle(String name) {
    return '$name ന്റെ രക്ഷിതാവിനെ വിളിക്കുന്നു…';
  }

  @override
  String get parentHotlineCallingRinging => 'റിംഗ് ചെയ്യുന്നു…';

  @override
  String get parentHotlineCallingInProgress => 'സംഭാഷണം നടക്കുന്നു';

  @override
  String parentHotlineCallingExchanges(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count വിനിമയങ്ങൾ',
      one: '1 വിനിമയം',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineCallingReassurance =>
      'നിങ്ങൾക്ക് ഈ സ്ക്രീൻ വിട്ടുപോകാം — സംഗ്രഹം നിങ്ങൾക്കായി തയ്യാറായിരിക്കും.';

  @override
  String get parentHotlineSummaryDocType => 'രക്ഷിതാവിന്റെ കോൾ';

  @override
  String get parentHotlineSummaryReasonAbsences => 'ഹാജരില്ലായ്മ';

  @override
  String get parentHotlineSummaryReasonPerformance => 'പ്രകടനം';

  @override
  String get parentHotlineSummaryReasonBehaviour => 'പെരുമാറ്റം';

  @override
  String get parentHotlineSummaryReasonPositive => 'സന്തോഷവാർത്ത';

  @override
  String parentHotlineSummaryTitle(String name) {
    return '$name ന്റെ രക്ഷിതാവ്';
  }

  @override
  String parentHotlineSummaryDurationMin(int minutes) {
    return '$minutes മിനിറ്റ്';
  }

  @override
  String get parentHotlineSentimentCooperative => 'സഹകരണം';

  @override
  String get parentHotlineSentimentConcerned => 'ആശങ്ക';

  @override
  String get parentHotlineSentimentGrateful => 'നന്ദിയുള്ള';

  @override
  String get parentHotlineSentimentUpset => 'അസ്വസ്ഥത';

  @override
  String get parentHotlineSentimentIndifferent => 'സംയമനം';

  @override
  String get parentHotlineSentimentConfused => 'ആശയക്കുഴപ്പം';

  @override
  String get parentHotlineSummarySaidHeader => 'രക്ഷിതാവ് പറഞ്ഞത്';

  @override
  String get parentHotlineSummaryConcernsHeader => 'ഉന്നയിച്ച ആശങ്കകൾ';

  @override
  String get parentHotlineSummaryCommitmentsHeader =>
      'രക്ഷിതാവിന്റെ വാഗ്ദാനങ്ങൾ';

  @override
  String get parentHotlineSummaryActionsHeader => 'നിങ്ങളുടെ കർമപദ്ധതികൾ';

  @override
  String get parentHotlineSummaryGuidanceHeader => 'പങ്കുവെച്ച മാർഗനിർദേശം';

  @override
  String get parentHotlineSummaryFollowUpHeader => 'തുടർനടപടി';

  @override
  String parentHotlineSummaryTranscript(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'സംഭാഷണം കാണുക · $count സന്ദേശങ്ങൾ',
      one: 'സംഭാഷണം കാണുക · 1 സന്ദേശം',
    );
    return '$_temp0';
  }

  @override
  String get parentHotlineSummaryDone => 'പൂർത്തിയായി';

  @override
  String get parentHotlineSummaryCallAgain => 'പിന്നീട് വീണ്ടും വിളിക്കുക';

  @override
  String get parentHotlineSummaryManualTitle => 'സന്ദേശം പകർത്തി';

  @override
  String get parentHotlineSummaryManualBody =>
      'രക്ഷിതാവിന് അയയ്ക്കാൻ ഇത് WhatsApp ൽ പേസ്റ്റ് ചെയ്യുക.';

  @override
  String get parentHotlineSummaryBusy => 'ലൈൻ തിരക്കിലായിരുന്നു';

  @override
  String get parentHotlineSummaryNoAnswer => 'മറുപടിയില്ല';

  @override
  String get parentHotlineSummaryFailed => 'കോൾ കണക്റ്റ് ചെയ്യാനായില്ല';

  @override
  String get parentHotlineSummaryFailedBody =>
      'കോൾ നടന്നില്ല. നിങ്ങൾക്ക് വീണ്ടും ശ്രമിക്കാം, അല്ലെങ്കിൽ സന്ദേശം പകർത്തി WhatsApp ൽ അയയ്ക്കാം.';

  @override
  String get parentHotlineSummaryTryAgain => 'വീണ്ടും ശ്രമിക്കുക';

  @override
  String get parentHotlineSummaryNoConversationTitle =>
      'കോൾ വളരെ വേഗം അവസാനിച്ചു';

  @override
  String get parentHotlineSummaryNoConversationBody =>
      'സംഭാഷണം തുടങ്ങുന്നതിന് മുമ്പ് കോൾ അവസാനിച്ചു. നിങ്ങൾക്ക് വീണ്ടും ശ്രമിക്കാം, അല്ലെങ്കിൽ സന്ദേശം WhatsApp ൽ അയയ്ക്കാം.';

  @override
  String get parentHotlineSummaryUnavailableTitle => 'സംഗ്രഹം ലഭ്യമല്ല';

  @override
  String get parentHotlineSummaryUnavailableBody =>
      'ഈ കോളിന്റെ സംഗ്രഹം തയ്യാറാക്കാനായില്ല. സംഭാഷണം താഴെ നൽകിയിരിക്കുന്നു.';

  @override
  String get contentCreatorTitle => 'ഉള്ളടക്ക നിർമ്മാണ സ്റ്റുഡിയോ';

  @override
  String get contentCreatorTileSubtitle =>
      'നിങ്ങളുടെ ക്ലാസിനായി മൾട്ടിമീഡിയ സൃഷ്ടിക്കുക';

  @override
  String get contentCreatorSubtitle =>
      'നിങ്ങളുടെ ക്ലാസ് മുറിക്കായി ആകർഷകമായ മൾട്ടിമീഡിയ ഉള്ളടക്കം സൃഷ്ടിക്കാൻ സഹായിക്കുന്ന ഉപകരണങ്ങൾ.';

  @override
  String get contentCreatorSectionEyebrow => 'ഒരു ഉപകരണം തിരഞ്ഞെടുക്കുക';

  @override
  String get contentCreatorVisualAidDesc =>
      'നിങ്ങളുടെ പാഠങ്ങൾക്കായി ലളിതമായ വരച്ചിത്രങ്ങളും ഡയഗ്രമുകളും സൃഷ്ടിക്കുക.';

  @override
  String get contentCreatorFieldTripDesc =>
      'Google Earth ഉപയോഗിച്ച് ആവേശകരമായ വെർച്വൽ പര്യടനങ്ങൾ ആസൂത്രണം ചെയ്യുക.';

  @override
  String get contentCreatorVideoDesc =>
      'നിങ്ങളുടെ പാഠങ്ങൾക്കായി തിരഞ്ഞെടുത്ത വിദ്യാഭ്യാസ വീഡിയോകൾ കണ്ടെത്തുക.';

  @override
  String get visualAidTitle => 'ദൃശ്യ സഹായി';

  @override
  String get visualAidSubtitle => 'അധ്യാപന ചിത്രം വരയ്ക്കുക';

  @override
  String get visualAidEmpty => 'ഒരു ചിത്രം വിവരിച്ച് സൃഷ്ടിക്കുക അമർത്തുക.';

  @override
  String get visualAidPromptLabel => 'ചിത്രത്തിൽ എന്ത് കാണിക്കണം?';

  @override
  String get visualAidPromptHint => 'ഉദാഹരണത്തിന്, സസ്യകോശത്തിന്റെ ഭാഗങ്ങൾ';

  @override
  String get visualAidPromptError =>
      'നിങ്ങൾക്ക് ഏത് തരം ചിത്രമാണ് വേണ്ടതെന്ന് വിവരിക്കുക.';

  @override
  String get visualAidGradeLabel => 'ക്ലാസ് നിലവാരം';

  @override
  String get visualAidGradeAny => 'ഏത് ക്ലാസും';

  @override
  String get visualAidSubjectLabel => 'വിഷയം';

  @override
  String get visualAidSubjectAny => 'ഏത് വിഷയവും';

  @override
  String get visualAidOptional => 'ഐച്ഛികം';

  @override
  String get visualAidAction => 'ചിത്രം സൃഷ്ടിക്കുക';

  @override
  String get visualAidResultTitle => 'ദൃശ്യ സഹായി';

  @override
  String get visualAidHowToUse => 'ഇത് എങ്ങനെ ഉപയോഗിക്കാം';

  @override
  String get visualAidDiscussionSpark => 'ചർച്ചാ ചോദ്യം';

  @override
  String get visualAidImageLabel => 'സൃഷ്ടിച്ച അധ്യാപന ചിത്രം';

  @override
  String get visualAidImageError => 'ഈ ചിത്രം കാണിക്കാൻ കഴിഞ്ഞില്ല.';

  @override
  String get visualAidNoImage =>
      'ആ വിവരണത്തിന് ഒരു ചിത്രവും ലഭിച്ചില്ല. ദയവായി അത് വീണ്ടും എഴുതി ശ്രമിക്കുക.';

  @override
  String get visualAidSignIn =>
      'ഈ ഉപകരണം ഉപയോഗിക്കാൻ ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get visualAidUpgradeTitle => 'ഉയർന്ന പ്ലാൻ ആവശ്യമാണ്';

  @override
  String get visualAidUpgradeBody =>
      'ദൃശ്യ സഹായി ഒരു ഉയർന്ന പ്ലാനിന്റെ ഭാഗമാണ്. ചിത്രങ്ങൾ സൃഷ്ടിക്കുന്നത് തുടരാൻ ദയവായി അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get visualAidSeePricing => 'പ്ലാനുകളും വിലയും കാണുക';

  @override
  String get visualAidDailyLimitTitle =>
      'ഇന്നത്തേക്കുള്ള നിങ്ങളുടെ എല്ലാ ചിത്രങ്ങളും തീർന്നു';

  @override
  String get visualAidDailyLimitBody =>
      'നിങ്ങളുടെ പ്ലാനിൽ ഓരോ ദിവസവും ഒരു നിശ്ചിത എണ്ണം ദൃശ്യ സഹായികൾ ഉൾപ്പെടുന്നു. നിങ്ങളുടെ ചിത്രങ്ങൾ നാളെ വീണ്ടും ലഭ്യമാകും, അല്ലെങ്കിൽ നിങ്ങൾക്ക് ഉയർന്ന പ്ലാനിൽ ദൈനംദിന പരിധി ഉയർത്താം.';

  @override
  String get visualAidLimitTitle => 'നിങ്ങൾ നിങ്ങളുടെ പരിധിയിൽ എത്തി';

  @override
  String get visualAidLimitBody =>
      'ഈ മാസത്തെ നിങ്ങളുടെ ദൃശ്യ സഹായികൾ നിങ്ങൾ ഉപയോഗിച്ചു. നിങ്ങളുടെ ചിത്രങ്ങൾ അടുത്ത മാസം വീണ്ടും ലഭ്യമാകും, അല്ലെങ്കിൽ നിങ്ങൾക്ക് ഉയർന്ന പ്ലാനിൽ പരിധി ഉയർത്താം.';

  @override
  String get visualAidRephrase =>
      'ആ ചിത്രം ഞങ്ങൾക്ക് സൃഷ്ടിക്കാൻ കഴിഞ്ഞില്ല. ദയവായി അത് വീണ്ടും എഴുതി ശ്രമിക്കുക.';

  @override
  String get visualAidEmptyGeneration =>
      'ചിത്രം ശൂന്യമായി വന്നു. കുറച്ച് ലേബലുകൾ ഉപയോഗിച്ച് വിവരിക്കാൻ ശ്രമിക്കുക.';

  @override
  String get visualAidBusy =>
      'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി അൽപ്പസമയത്തിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.';

  @override
  String visualAidBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി ഏകദേശം $seconds സെക്കൻഡിനുള്ളിൽ വീണ്ടും ശ്രമിക്കുക.',
      one:
          'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി ഏകദേശം 1 സെക്കൻഡിനുള്ളിൽ വീണ്ടും ശ്രമിക്കുക.',
    );
    return '$_temp0';
  }

  @override
  String get visualAidTimeout =>
      'ഇത് പ്രതീക്ഷിച്ചതിലും കൂടുതൽ സമയമെടുക്കുന്നു. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get videoStorytellerTitle => 'വീഡിയോ കഥാകാരൻ';

  @override
  String get videoStorytellerSubtitle => 'അധ്യാപന വീഡിയോകൾ കണ്ടെത്തുക';

  @override
  String get videoStorytellerEmpty =>
      'ഒരു വിഷയമോ ടോപ്പിക്കോ തിരഞ്ഞെടുത്ത് വീഡിയോകൾ കണ്ടെത്തുക ടാപ്പ് ചെയ്യുക.';

  @override
  String get videoStorytellerTopicLabel => 'ടോപ്പിക് അല്ലെങ്കിൽ അധ്യായം';

  @override
  String get videoStorytellerTopicHint => 'ഉദാഹരണത്തിന്, ജലചക്രം';

  @override
  String get videoStorytellerSubjectLabel => 'വിഷയം';

  @override
  String get videoStorytellerSubjectAny => 'ഏത് വിഷയവും';

  @override
  String get videoStorytellerGradeLabel => 'ക്ലാസ് നിലവാരം';

  @override
  String get videoStorytellerGradeAny => 'ഏത് ക്ലാസും';

  @override
  String get videoStorytellerOptional => 'ഐച്ഛികം';

  @override
  String get videoStorytellerAction => 'വീഡിയോകൾ കണ്ടെത്തുക';

  @override
  String get videoStorytellerNoResults =>
      'അതിനായി വീഡിയോകളൊന്നും ലഭിച്ചില്ല. മറ്റൊരു വിഷയമോ ടോപ്പിക്കോ പരീക്ഷിക്കുക.';

  @override
  String videoStorytellerViewAll(int count) {
    return 'View all $count';
  }

  @override
  String get videoStorytellerOfficialSource => 'ഔദ്യോഗിക ഉറവിടം';

  @override
  String get videoStorytellerOpensExternally =>
      'യൂട്യൂബിൽ, ആപ്പിന് പുറത്ത് തുറക്കുന്നു.';

  @override
  String get videoStorytellerCategoryTopRecommended =>
      'നിങ്ങൾക്കായി മികച്ച ശുപാർശകൾ';

  @override
  String get videoStorytellerCategoryStorytelling =>
      'നിങ്ങളുടെ വിഷയങ്ങൾക്കായുള്ള കഥപറച്ചിൽ';

  @override
  String get videoStorytellerCategoryPedagogy =>
      'ബോധനശാസ്ത്രവും അധ്യാപന രീതികളും';

  @override
  String get videoStorytellerCategoryGovtUpdates => 'സർക്കാർ അപ്‌ഡേറ്റുകൾ';

  @override
  String get videoStorytellerCategoryCourses => 'അധ്യാപക പരിശീലന കോഴ്‌സുകൾ';

  @override
  String get videoStorytellerSignIn =>
      'ഈ ഉപകരണം ഉപയോഗിക്കാൻ ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get videoStorytellerTimeout =>
      'ഇത് പ്രതീക്ഷിച്ചതിലും കൂടുതൽ സമയമെടുക്കുന്നു. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get videoStorytellerBusy =>
      'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി അൽപ്പസമയത്തിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.';

  @override
  String videoStorytellerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി ഏകദേശം $seconds സെക്കൻഡിനുള്ളിൽ വീണ്ടും ശ്രമിക്കുക.',
      one:
          'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി ഏകദേശം 1 സെക്കൻഡിനുള്ളിൽ വീണ്ടും ശ്രമിക്കുക.',
    );
    return '$_temp0';
  }

  @override
  String get videoStorytellerRephrase =>
      'അതിനായി വീഡിയോകൾ കണ്ടെത്താൻ ഞങ്ങൾക്കായില്ല. ദയവായി മറ്റൊരു ടോപ്പിക് പരീക്ഷിക്കുക.';

  @override
  String get videoStorytellerLimit =>
      'നിങ്ങൾ അടുത്തിടെ ധാരാളം തിരഞ്ഞു. ദയവായി അൽപ്പസമയത്തിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get actionDone => 'പൂർത്തിയായി';

  @override
  String get virtualFieldTripTitle => 'വെർച്വൽ ഫീൽഡ് ട്രിപ്പ്';

  @override
  String get virtualFieldTripSubtitle => 'Google Earth-ൽ ലോകം ചുറ്റിക്കാണുക';

  @override
  String get virtualFieldTripEmpty =>
      'ഒരു വിഷയം നൽകി \'യാത്ര ആസൂത്രണം ചെയ്യുക\' ടാപ്പ് ചെയ്യുക.';

  @override
  String get virtualFieldTripTopicLabel => 'വിഷയം അല്ലെങ്കിൽ പ്രമേയം';

  @override
  String get virtualFieldTripTopicHint => 'ഉദാഹരണത്തിന്, ഗ്രേറ്റ് ബാരിയർ റീഫ്';

  @override
  String get virtualFieldTripTopicError =>
      'ദയവായി യാത്രയ്ക്ക് ഒരു വിഷയം നൽകുക.';

  @override
  String get virtualFieldTripGradeLabel => 'ക്ലാസ് നിലവാരം';

  @override
  String get virtualFieldTripGradeAny => 'ഏതെങ്കിലും ക്ലാസ്';

  @override
  String get virtualFieldTripOptional => 'ഐച്ഛികം';

  @override
  String get virtualFieldTripAction => 'യാത്ര ആസൂത്രണം ചെയ്യുക';

  @override
  String get virtualFieldTripDocType => 'വെർച്വൽ ഫീൽഡ് ട്രിപ്പ്';

  @override
  String virtualFieldTripStopCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count സ്റ്റോപ്പുകൾ',
      one: '1 സ്റ്റോപ്പ്',
    );
    return '$_temp0';
  }

  @override
  String virtualFieldTripStopSemantics(int number, String name) {
    return 'സ്റ്റോപ്പ് $number: $name';
  }

  @override
  String get virtualFieldTripFactLabel => 'നിങ്ങൾക്ക് അറിയാമോ?';

  @override
  String get virtualFieldTripReflectionLabel => 'ഇതിനെക്കുറിച്ച് ചിന്തിക്കുക';

  @override
  String get virtualFieldTripAnalogyLabel => 'നമ്മുടെ സാഹചര്യത്തിൽ';

  @override
  String get virtualFieldTripExplanationLabel => 'നാം എന്തിന് സന്ദർശിക്കുന്നു';

  @override
  String get virtualFieldTripOpenEarth => 'Google Earth-ൽ തുറക്കുക';

  @override
  String get virtualFieldTripOpensExternally =>
      'ആപ്പിന് പുറത്ത്, Google Earth-ൽ തുറക്കുന്നു.';

  @override
  String get virtualFieldTripPendingTitle =>
      'നിങ്ങളുടെ യാത്ര ഇപ്പോഴും ആസൂത്രണം ചെയ്യുന്നു';

  @override
  String get virtualFieldTripPendingBody =>
      'നിങ്ങളുടെ ഫീൽഡ് ട്രിപ്പ് ഇപ്പോഴും തയ്യാറാകുന്നു. ഒരു മിനിറ്റിനുള്ളിൽ \'എന്റെ ലൈബ്രറി\' നോക്കുക.';

  @override
  String get virtualFieldTripNoStops =>
      'അതിന് സ്റ്റോപ്പുകളൊന്നും ലഭിച്ചില്ല. മറ്റൊരു വിഷയം പരീക്ഷിക്കുക.';

  @override
  String get virtualFieldTripSignIn =>
      'ഈ ടൂൾ ഉപയോഗിക്കാൻ ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get virtualFieldTripUnavailable =>
      'ഈ ടൂൾ നിങ്ങളുടെ നിലവിലെ പ്ലാനിന്റെ ഭാഗമല്ല.';

  @override
  String get virtualFieldTripTimeout =>
      'ഇതിന് പ്രതീക്ഷിച്ചതിലും കൂടുതൽ സമയമെടുക്കുന്നു. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get virtualFieldTripBusy =>
      'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി അൽപ്പസമയത്തിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.';

  @override
  String virtualFieldTripBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി ഏകദേശം $seconds സെക്കൻഡിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.',
      one:
          'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി ഏകദേശം 1 സെക്കൻഡിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.',
    );
    return '$_temp0';
  }

  @override
  String get virtualFieldTripRephrase =>
      'അതിന് ഞങ്ങൾക്ക് ഒരു യാത്ര ആസൂത്രണം ചെയ്യാൻ കഴിഞ്ഞില്ല. ദയവായി മറ്റൊരു വിഷയം പരീക്ഷിക്കുക.';

  @override
  String get virtualFieldTripLimit =>
      'നിങ്ങൾ അടുത്തിടെ ധാരാളം യാത്രകൾ ആസൂത്രണം ചെയ്തു. ദയവായി അൽപ്പസമയത്തിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get assessmentScannerTitle => 'മൂല്യനിർണ്ണയ സ്കാനർ';

  @override
  String get assessmentScannerSubtitle =>
      'വിദ്യാർത്ഥിയുടെ ഉത്തരക്കടലാസ് പേജ് തിരിച്ച് വിലയിരുത്തുക';

  @override
  String get assessmentScannerEmpty =>
      'ഉത്തരക്കടലാസിന്റെ 3 വരെ ഫോട്ടോകൾ ചേർക്കുക, തുടർന്ന് വിലയിരുത്തുക അമർത്തുക.';

  @override
  String get assessmentScannerSubmit => 'ഉത്തരക്കടലാസ് വിലയിരുത്തുക';

  @override
  String get assessmentScannerResultTitle => 'മൂല്യനിർണ്ണയം';

  @override
  String get assessmentScannerSectionSheet => 'ഉത്തരക്കടലാസ്';

  @override
  String get assessmentScannerPagesLabel => 'ഉത്തരക്കടലാസ് പേജുകൾ';

  @override
  String get assessmentScannerPagesHint =>
      '3 വരെ വ്യക്തമായ ഫോട്ടോകൾ ചേർക്കുക, ഓരോ പേജിനും ഒന്ന്.';

  @override
  String get assessmentScannerPagesEmpty =>
      'ആദ്യ പേജിന്റെ ഒരു ഫോട്ടോ ചേർക്കുക.';

  @override
  String assessmentScannerPageLabel(int number) {
    return 'പേജ് $number';
  }

  @override
  String assessmentScannerRemovePage(int number) {
    return 'പേജ് $number നീക്കം ചെയ്യുക';
  }

  @override
  String assessmentScannerPageCounter(int count, int max) {
    return '$max-ൽ $count പേജുകൾ';
  }

  @override
  String assessmentScannerPagesFull(int max) {
    return 'നിങ്ങൾക്ക് $max വരെ പേജുകൾ ചേർക്കാം.';
  }

  @override
  String get assessmentScannerTakePhoto => 'ഫോട്ടോ എടുക്കുക';

  @override
  String get assessmentScannerChooseGallery => 'ഗാലറിയിൽ നിന്ന് തിരഞ്ഞെടുക്കുക';

  @override
  String get assessmentScannerSubjectLabel => 'വിഷയം';

  @override
  String get assessmentScannerSubjectHint =>
      'മൂല്യനിർണ്ണയം വിഷയത്തിന് അനുസൃതമാണ്.';

  @override
  String get assessmentScannerSubjectPlaceholder => 'വിഷയം തിരഞ്ഞെടുക്കുക';

  @override
  String get assessmentScannerSubjectError => 'ദയവായി വിഷയം തിരഞ്ഞെടുക്കുക.';

  @override
  String get assessmentScannerGradeLabel => 'ക്ലാസ് നില';

  @override
  String get assessmentScannerGradePlaceholder => 'ക്ലാസ് തിരഞ്ഞെടുക്കുക';

  @override
  String get assessmentScannerGradeError => 'ദയവായി ക്ലാസ് തിരഞ്ഞെടുക്കുക.';

  @override
  String get assessmentScannerOptional => 'ഐച്ഛികം';

  @override
  String get assessmentScannerAnswerKeyLabel => 'ഉത്തരസൂചിക';

  @override
  String get assessmentScannerAnswerKeyHint =>
      'ശരിയായ ഉത്തരങ്ങൾ ഒട്ടിക്കുക, അവയ്ക്കനുസരിച്ച് വിലയിരുത്തും.';

  @override
  String get assessmentScannerAnswerKeyPlaceholder =>
      'ഉത്തരസൂചിക ടൈപ്പ് ചെയ്യുക അല്ലെങ്കിൽ ഒട്ടിക്കുക';

  @override
  String get assessmentScannerPrivacyNote =>
      'വിലയിരുത്തലിനായി വിദ്യാർത്ഥിയുടെ പേര് ഒരിക്കലും അയയ്ക്കില്ല.';

  @override
  String assessmentScannerScoreCaption(String awarded, String max) {
    return '$max-ൽ $awarded മാർക്ക്';
  }

  @override
  String get assessmentScannerScoreOutOf => '100-ൽ';

  @override
  String assessmentScannerMarks(String awarded, String max) {
    return '$awarded/$max';
  }

  @override
  String assessmentScannerPagesMeta(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count പേജുകൾ',
      one: '1 പേജ്',
    );
    return '$_temp0';
  }

  @override
  String assessmentScannerReviewBadge(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count പരിശോധിക്കുക',
      one: '1 പരിശോധിക്കുക',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerQuestionsSection => 'ചോദ്യം തിരിച്ച്';

  @override
  String get assessmentScannerStudentAnswerLabel => 'വിദ്യാർത്ഥി എഴുതിയത്';

  @override
  String get assessmentScannerFeedbackLabel => 'പ്രതികരണം';

  @override
  String get assessmentScannerExpectedLabel => 'പ്രതീക്ഷിത ഉത്തരം';

  @override
  String get assessmentScannerNextStepsSection =>
      'ശുപാർശ ചെയ്ത അടുത്ത ഘട്ടങ്ങൾ';

  @override
  String get assessmentScannerStudentSection => 'വിദ്യാർത്ഥിക്കായി';

  @override
  String get assessmentScannerQualitySection => 'ഫോട്ടോ ഗുണനിലവാരം';

  @override
  String get assessmentScannerNotScored => 'മാർക്ക് നൽകിയിട്ടില്ല';

  @override
  String get assessmentScannerNoContent =>
      'മാർക്കുകളൊന്നും ലഭിച്ചില്ല. ദയവായി വ്യക്തമായ ഫോട്ടോകൾ പരീക്ഷിക്കുക.';

  @override
  String get assessmentScannerOutcomeCorrect => 'ശരി';

  @override
  String get assessmentScannerOutcomePartial => 'ഭാഗികമായി ശരി';

  @override
  String get assessmentScannerOutcomeIncorrect => 'തെറ്റ്';

  @override
  String get assessmentScannerReviewChip => 'ഇത് പരിശോധിക്കുക';

  @override
  String get assessmentScannerSignIn =>
      'ഉത്തരക്കടലാസ് വിലയിരുത്താൻ ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get assessmentScannerUpgradeTitle => 'ഉയർന്ന പ്ലാൻ ആവശ്യമാണ്';

  @override
  String get assessmentScannerUpgradeBody =>
      'ഉത്തരക്കടലാസുകൾ വിലയിരുത്തുന്നത് ഉയർന്ന പ്ലാനിന്റെ ഭാഗമാണ്. വിലയിരുത്തൽ തുടരാൻ അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get assessmentScannerSeePricing => 'പ്ലാനുകൾ കാണുക';

  @override
  String get assessmentScannerDailyLimitTitle =>
      'ഇന്നത്തേക്കുള്ള നിങ്ങളുടെ എല്ലാ ഉത്തരക്കടലാസുകളും തീർന്നു';

  @override
  String get assessmentScannerDailyLimitBody =>
      'നിങ്ങളുടെ പ്ലാനിൽ ഓരോ ദിവസവും നിശ്ചിത എണ്ണം ഉത്തരക്കടലാസുകൾ ഉണ്ട്. അവ നാളെ വീണ്ടും ആരംഭിക്കും, അല്ലെങ്കിൽ ഉയർന്ന പ്ലാനിൽ പരിധി വർദ്ധിപ്പിക്കാം.';

  @override
  String get assessmentScannerLimitTitle =>
      'നിങ്ങൾ നിങ്ങളുടെ വിലയിരുത്തൽ പരിധിയിൽ എത്തി';

  @override
  String get assessmentScannerLimitBody =>
      'നിങ്ങളുടെ പ്ലാനിലെ എല്ലാ ഉത്തരക്കടലാസുകളും ഉപയോഗിച്ചു. അവ അടുത്ത മാസം വീണ്ടും ആരംഭിക്കും, അല്ലെങ്കിൽ ഉയർന്ന പ്ലാനിൽ പരിധി വർദ്ധിപ്പിക്കാം.';

  @override
  String get assessmentScannerBusy =>
      'വിലയിരുത്തൽ മോഡൽ ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി ഒരു മിനിറ്റിനുള്ളിൽ വീണ്ടും ശ്രമിക്കുക.';

  @override
  String assessmentScannerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'വിലയിരുത്തൽ മോഡൽ ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി ഏകദേശം $seconds സെക്കൻഡിനുള്ളിൽ വീണ്ടും ശ്രമിക്കുക.',
      one:
          'വിലയിരുത്തൽ മോഡൽ ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി ഏകദേശം 1 സെക്കൻഡിനുള്ളിൽ വീണ്ടും ശ്രമിക്കുക.',
    );
    return '$_temp0';
  }

  @override
  String get assessmentScannerTimeout =>
      'വിലയിരുത്തലിന് പതിവിലും കൂടുതൽ സമയമെടുക്കുന്നു. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get assessmentScannerRephrase =>
      'ഫോട്ടോകൾ വിലയിരുത്താൻ കഴിഞ്ഞില്ല. ദയവായി വ്യക്തമായ പേജുകൾ വീണ്ടും അപ്‌ലോഡ് ചെയ്യുക.';

  @override
  String get inboxTitle => 'സന്ദേശങ്ങൾ';

  @override
  String get inboxSignInTitle => 'നിങ്ങളുടെ സന്ദേശങ്ങൾ';

  @override
  String get inboxSignInBody => 'നിങ്ങളുടെ സന്ദേശങ്ങൾ കാണാൻ സൈൻ ഇൻ ചെയ്യുക';

  @override
  String get inboxEmptyTitle => 'ഇതുവരെ സംഭാഷണങ്ങളൊന്നുമില്ല';

  @override
  String get inboxEmptyBody =>
      'നിങ്ങൾ അധ്യാപകരുമായി ബന്ധപ്പെടുമ്പോൾ, നിങ്ങളുടെ സംഭാഷണങ്ങൾ ഇവിടെ കാണാം.';

  @override
  String get inboxErrorBody =>
      'നിങ്ങളുടെ സന്ദേശങ്ങൾ ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get inboxNoMessagesYet => 'ഇതുവരെ സന്ദേശങ്ങളൊന്നുമില്ല';

  @override
  String get inboxThreadFallbackTitle => 'സംഭാഷണം';

  @override
  String get inboxThreadEmptyTitle => 'ഇതുവരെ സന്ദേശങ്ങളൊന്നുമില്ല';

  @override
  String get inboxThreadEmptyBody => 'സംഭാഷണം തുടങ്ങാൻ ഒരു അഭിവാദ്യം പറയൂ.';

  @override
  String get inboxComposerHint => 'ഒരു സന്ദേശം എഴുതുക';

  @override
  String get inboxComposerSend => 'അയയ്ക്കുക';

  @override
  String get inboxComposerTooLong => 'Message too long. Please shorten it.';

  @override
  String get inboxLoadOlder => 'പഴയ സന്ദേശങ്ങൾ ലോഡ് ചെയ്യുക';

  @override
  String get inboxSendFailed => 'നിങ്ങളുടെ സന്ദേശം അയയ്ക്കാൻ കഴിഞ്ഞില്ല.';

  @override
  String get inboxResourceLabel => 'വിഭവം';

  @override
  String get inboxVoiceNoteLabel => 'വോയ്‌സ് നോട്ട്';

  @override
  String inboxUnreadLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count വായിക്കാത്തവ',
      one: '1 വായിക്കാത്തത്',
    );
    return '$_temp0';
  }

  @override
  String get inboxTickSending => 'അയയ്ക്കുന്നു';

  @override
  String get inboxTickSent => 'അയച്ചു';

  @override
  String get inboxTickDelivered => 'എത്തി';

  @override
  String get inboxTickRead => 'വായിച്ചു';

  @override
  String get inboxTickFailed => 'അയച്ചില്ല';

  @override
  String get inboxTimeNow => 'ഇപ്പോൾ';

  @override
  String inboxTimeMinutes(int count) {
    return '$count മി';
  }

  @override
  String inboxTimeHours(int count) {
    return '$count മണി';
  }

  @override
  String inboxTimeDays(int count) {
    return '$count ദി';
  }

  @override
  String inboxTimeWeeks(int count) {
    return '$count ആ';
  }

  @override
  String get networkTitle => 'നെറ്റ്‌വർക്ക്';

  @override
  String get networkTooltip => 'നെറ്റ്‌വർക്ക്';

  @override
  String get networkTabStaffroom => 'സ്റ്റാഫ്‌റൂം';

  @override
  String get networkTabMessages => 'സന്ദേശങ്ങൾ';

  @override
  String get staffroomTitle => 'സ്റ്റാഫ്‌റൂം';

  @override
  String get staffroomHeroTitle => 'സ്റ്റാഫ്‌റൂം';

  @override
  String get staffroomHeroDeck => 'ഭാരതമെമ്പാടുമുള്ള അധ്യാപകർ, ഒരേ മുറിയിൽ';

  @override
  String get staffroomSectionGroups => 'നിങ്ങളുടെ ഗ്രൂപ്പുകൾ';

  @override
  String get staffroomSectionFeed => 'നിങ്ങളുടെ ഗ്രൂപ്പുകളിൽ നിന്ന്';

  @override
  String get staffroomSectionDiscover => 'ഗ്രൂപ്പുകൾ കണ്ടെത്തുക';

  @override
  String get staffroomSectionPeople => 'നിങ്ങൾക്ക് അറിയാവുന്നവർ';

  @override
  String get staffroomSignInTitle => 'സ്റ്റാഫ്‌റൂമിൽ ചേരുക';

  @override
  String get staffroomSignInBody => 'സ്റ്റാഫ്‌റൂമിൽ ചേരാൻ സൈൻ ഇൻ ചെയ്യുക';

  @override
  String get staffroomFeedEmptyTitle => 'നിങ്ങളുടെ ഫീഡ് ശാന്തമാണ്';

  @override
  String get staffroomFeedEmptyBody =>
      'നിങ്ങളുടെ ഗ്രൂപ്പുകളിലെ പോസ്റ്റുകൾ ഇവിടെ കാണാം.';

  @override
  String get staffroomErrorBody =>
      'സ്റ്റാഫ്‌റൂം ലോഡ് ചെയ്യാനായില്ല. വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get staffroomGroupsEmptyTitle => 'ഇതുവരെ ഗ്രൂപ്പുകളൊന്നുമില്ല';

  @override
  String get staffroomGroupsEmptyBody =>
      'പോസ്റ്റുകളും ചാറ്റും കാണാൻ ഒരു ഗ്രൂപ്പിൽ ചേരുക.';

  @override
  String get staffroomBrowseGroups => 'ഗ്രൂപ്പുകൾ ബ്രൗസ് ചെയ്യുക';

  @override
  String staffroomMemberCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count അംഗങ്ങൾ',
      one: '1 അംഗം',
    );
    return '$_temp0';
  }

  @override
  String get staffroomJoin => 'ചേരുക';

  @override
  String get staffroomJoined => 'ചേർന്നു';

  @override
  String get staffroomJoinFailed =>
      'ചേരാനായില്ല. വീണ്ടും ശ്രമിക്കാൻ ടാപ്പ് ചെയ്യുക.';

  @override
  String get staffroomGroupLockedTitle => 'അംഗങ്ങൾക്ക് മാത്രം';

  @override
  String get staffroomGroupLockedBody => 'ഈ ഗ്രൂപ്പിലെ പോസ്റ്റുകൾ കാണാൻ ചേരുക.';

  @override
  String get staffroomGroupPostsEmptyTitle => 'ഇതുവരെ പോസ്റ്റുകളൊന്നുമില്ല';

  @override
  String get staffroomGroupPostsEmptyBody => 'ഇവിടെ ആദ്യം പങ്കിടുക.';

  @override
  String get staffroomGroupNotFoundTitle => 'ഗ്രൂപ്പ് കണ്ടെത്തിയില്ല';

  @override
  String get staffroomGroupNotFoundBody => 'ഈ ഗ്രൂപ്പ് നീക്കം ചെയ്തിരിക്കാം.';

  @override
  String get staffroomPostTypeShare => 'പങ്കിട്ടു';

  @override
  String get staffroomPostTypeAskHelp => 'സഹായം വേണം';

  @override
  String get staffroomPostTypeCelebrate => 'ആഘോഷം';

  @override
  String get staffroomPostTypeResource => 'വിഭവം';

  @override
  String get staffroomLike => 'ഇഷ്ടം';

  @override
  String get staffroomLiked => 'ഇഷ്ടപ്പെട്ടു';

  @override
  String staffroomLikeCountLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ഇഷ്ടങ്ങൾ',
      one: '1 ഇഷ്ടം',
      zero: 'ഇഷ്ടങ്ങളില്ല',
    );
    return '$_temp0';
  }

  @override
  String get staffroomLikeFailed =>
      'അപ്‌ഡേറ്റ് ചെയ്യാനായില്ല. വീണ്ടും ശ്രമിക്കാൻ ടാപ്പ് ചെയ്യുക.';

  @override
  String get staffroomResourceShared => 'ഒരു വിഭവം പങ്കിട്ടു';

  @override
  String staffroomChatHighlight(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count പുതിയ സന്ദേശങ്ങൾ',
      one: '1 പുതിയ സന്ദേശം',
    );
    return '$_temp0';
  }

  @override
  String get staffroomConnect => 'കണക്റ്റ് ചെയ്യുക';

  @override
  String get staffroomConnectSent => 'അഭ്യർത്ഥന അയച്ചു';

  @override
  String get staffroomConnectPending => 'അഭ്യർത്ഥന ഇതിനകം തീർപ്പാക്കാതെയുണ്ട്';

  @override
  String get staffroomConnectConnected => 'ഇതിനകം കണക്റ്റ് ചെയ്തിരിക്കുന്നു';

  @override
  String get staffroomChatTitle => 'സ്റ്റാഫ്‌റൂം';

  @override
  String get staffroomChatEntryBody =>
      'ഭാരതത്തിലുടനീളമുള്ള അധ്യാപകരുമായി ചാറ്റ് ചെയ്യുക';

  @override
  String get staffroomChatSignInTitle => 'സ്റ്റാഫ്‌റൂമിൽ ചേരുക';

  @override
  String get staffroomChatSignInBody => 'സ്റ്റാഫ്‌റൂമിൽ ചേരാൻ സൈൻ ഇൻ ചെയ്യുക';

  @override
  String get staffroomChatEmptyTitle => 'ഇതുവരെ സന്ദേശങ്ങളൊന്നുമില്ല';

  @override
  String get staffroomChatEmptyBody => 'ആദ്യമായി ഒരു അഭിവാദ്യം പറയൂ.';

  @override
  String get staffroomChatAiBadge => 'AI അധ്യാപകൻ';

  @override
  String get staffroomGroupChatEntry => 'ഗ്രൂപ്പ് ചാറ്റ്';

  @override
  String get staffroomDirectoryTitle => 'അധ്യാപകരെ കണ്ടെത്തുക';

  @override
  String get staffroomDirectoryEntryBody => 'അധ്യാപക ഡയറക്ടറിയിൽ തിരയുക';

  @override
  String get staffroomDirectorySearchHint =>
      'പേര് അല്ലെങ്കിൽ വിഷയം ഉപയോഗിച്ച് തിരയുക';

  @override
  String get staffroomDirectoryErrorBody =>
      'ഡയറക്ടറി ലോഡ് ചെയ്യാനായില്ല. വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get staffroomDirectoryEmptyTitle => 'അധ്യാപകരെ കണ്ടെത്തിയില്ല';

  @override
  String get staffroomDirectoryEmptyBody => 'കാണിക്കാൻ ഇതുവരെ അധ്യാപകരില്ല.';

  @override
  String get staffroomDirectorySearchEmpty =>
      'നിങ്ങളുടെ തിരയലുമായി അധ്യാപകരാരും പൊരുത്തപ്പെടുന്നില്ല.';

  @override
  String get staffroomProfileTitle => 'അധ്യാപകൻ';

  @override
  String get staffroomProfileErrorBody =>
      'ഈ പ്രൊഫൈൽ ലോഡ് ചെയ്യാനായില്ല. വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get staffroomProfileNotFoundTitle => 'പ്രൊഫൈൽ ലഭ്യമല്ല';

  @override
  String get staffroomProfileNotFoundBody => 'ഈ പ്രൊഫൈൽ കണ്ടെത്താനായില്ല.';

  @override
  String get staffroomProfileAboutLabel => 'വിവരണം';

  @override
  String get staffroomProfileBioEmpty => 'ഇതുവരെ വിവരണമൊന്നുമില്ല.';

  @override
  String get staffroomProfileVerified => 'പരിശോധിച്ചു';

  @override
  String staffroomProfileExperience(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count വർഷത്തെ പരിചയം',
      one: '1 വർഷത്തെ പരിചയം',
    );
    return '$_temp0';
  }

  @override
  String get staffroomProfileSubjectsLabel => 'വിഷയങ്ങൾ';

  @override
  String get staffroomProfileClassesLabel => 'ക്ലാസുകൾ';

  @override
  String get staffroomProfileLanguagesLabel => 'ഭാഷകൾ';

  @override
  String get staffroomRequested => 'അഭ്യർത്ഥന അയച്ചു';

  @override
  String get staffroomConnectionAccept => 'സ്വീകരിക്കുക';

  @override
  String get staffroomConnectionDecline => 'നിരസിക്കുക';

  @override
  String get staffroomConnected => 'കണക്റ്റ് ചെയ്തു';

  @override
  String get staffroomConnectionWants => 'കണക്റ്റ് ചെയ്യാൻ ആഗ്രഹിക്കുന്നു';

  @override
  String get staffroomMessage => 'സന്ദേശം അയയ്ക്കുക';

  @override
  String get staffroomConnectToMessage => 'സന്ദേശം അയയ്ക്കാൻ കണക്റ്റ് ചെയ്യുക';

  @override
  String get staffroomConnectionFailed =>
      'അപ്ഡേറ്റ് ചെയ്യാനായില്ല. വീണ്ടും ശ്രമിക്കാൻ ടാപ്പ് ചെയ്യുക.';

  @override
  String get staffroomDisconnect => 'ഡിസ്കണക്റ്റ് ചെയ്യുക';

  @override
  String get staffroomDisconnectConfirmTitle => 'ഡിസ്കണക്റ്റ് ചെയ്യണോ?';

  @override
  String get staffroomDisconnectConfirmBody =>
      'നിങ്ങൾ ഇനി കണക്റ്റ് ചെയ്യപ്പെടില്ല അല്ലെങ്കിൽ പരസ്പരം സന്ദേശം അയയ്ക്കാൻ കഴിയില്ല.';

  @override
  String get staffroomDisconnectCancel => 'കണക്റ്റ് ചെയ്തിരിക്കുക';

  @override
  String get staffroomFollow => 'ഫോളോ ചെയ്യുക';

  @override
  String get staffroomFollowing => 'ഫോളോ ചെയ്യുന്നു';

  @override
  String get staffroomFollowFailed =>
      'അപ്ഡേറ്റ് ചെയ്യാനായില്ല. വീണ്ടും ശ്രമിക്കാൻ ടാപ്പ് ചെയ്യുക.';
}
