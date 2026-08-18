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
  String get splashFailedTitle => 'ആപ്പ് ആരംഭിക്കാൻ ഞങ്ങൾക്കായില്ല';

  @override
  String get splashFailedBody =>
      'ദയവായി നിങ്ങളുടെ കണക്ഷൻ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.';

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
      'മിനിറ്റുകൾക്കുള്ളിൽ പൂർണ്ണമായ പാഠപദ്ധതി തയ്യാറാക്കുക';

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
      'നിങ്ങൾ തിരഞ്ഞെടുക്കുന്ന ഭാഷയിൽ തന്നെ പാഠപദ്ധതികളും ക്വിസുകളും ഉത്തരങ്ങളും ലഭിക്കും. നിങ്ങൾക്ക് ഇത് എപ്പോൾ വേണമെങ്കിലും മാറ്റാം.';

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
      'നിങ്ങളുടെ പാഠപദ്ധതികളും ക്വിസുകളും ഉത്തരങ്ങളും ഇതിന് അനുസൃതമായിരിക്കും. പിന്നീട് എപ്പോൾ വേണമെങ്കിലും നിങ്ങളുടെ പ്രൊഫൈലിൽ നിന്ന് ഇത് മാറ്റാം.';

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
    return 'വീണ്ടും സ്വാഗതം, $name';
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
  String get readAloudListen => 'കേൾക്കുക';

  @override
  String get readAloudStop => 'നിർത്തുക';

  @override
  String get readAloudError =>
      'ഓഡിയോ പ്ലേ ചെയ്യാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String voiceResultReady(String tool) {
    return 'നിങ്ങളുടെ $tool തയ്യാറാണ്.';
  }

  @override
  String voiceResultReadyWithTopic(String tool, String topic) {
    return '$topic എന്ന ടോപ്പിക്കിലുള്ള നിങ്ങളുടെ $tool തയ്യാറാണ്.';
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
  String get dashboardRecentTitle => 'അടുത്തിടെയുള്ള ജോലികൾ';

  @override
  String get dashboardRecentEmpty =>
      'നിങ്ങൾ ഉണ്ടാക്കുന്നതെല്ലാം ഇവിടെ സേവ് ആകും, വീണ്ടും തുറക്കാൻ തയ്യാർ.';

  @override
  String get dashboardRecentFailed =>
      'നിങ്ങളുടെ അടുത്തിടെയുള്ള ജോലികൾ തുറക്കാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get dashboardRecentSignedOut =>
      'അടുത്തിടെയുള്ള ജോലികൾ കാണാൻ സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get dashboardUntitled => 'പേരില്ലാത്തത്';

  @override
  String get dashboardSetupTitle => 'നിങ്ങളുടെ പ്രൊഫൈൽ പൂർത്തിയാക്കൂ';

  @override
  String get dashboardSetupBody =>
      'നിങ്ങളുടെ സ്കൂളും ക്ലാസുകളും ചേർക്കൂ, എല്ലാ പാഠപദ്ധതികളും ക്വിസുകളും നിങ്ങളുടെ ക്ലാസ് മുറിക്ക് അനുയോജ്യമായി ലഭിക്കും.';

  @override
  String get dashboardSetupAction => 'എന്റെ പ്രൊഫൈൽ സജ്ജമാക്കുക';

  @override
  String get dashboardSetupDismiss => 'ഇപ്പോൾ വേണ്ട';

  @override
  String get contentTypeLessonPlan => 'പാഠപദ്ധതി';

  @override
  String get contentTypeQuiz => 'ക്വിസ്';

  @override
  String get contentTypeWorksheet => 'വർക്ക്‌ഷീറ്റ്';

  @override
  String get contentTypeVisualAid => 'ദൃശ്യ സഹായി';

  @override
  String get contentTypeRubric => 'റൂബ്രിക്';

  @override
  String get contentTypeMicroLesson => 'മൈക്രോ പാഠം';

  @override
  String get contentTypeVirtualFieldTrip => 'വെർച്വൽ ഫീൽഡ് ട്രിപ്പ്';

  @override
  String get contentTypeInstantAnswer => 'തൽക്ഷണ ഉത്തരം';

  @override
  String get contentTypeTeacherTraining => 'അധ്യാപക പരിശീലനം';

  @override
  String get contentTypeExamPaper => 'ചോദ്യപേപ്പർ';

  @override
  String get contentTypeAssessment => 'വിലയിരുത്തൽ';

  @override
  String get contentTypeAssessmentSubmission => 'സ്കാൻ ചെയ്ത മൂല്യനിർണ്ണയം';

  @override
  String get contentTypeUnknown => 'സംരക്ഷിച്ചവ';

  @override
  String get libraryTitle => 'എന്റെ ലൈബ്രറി';

  @override
  String get librarySectionSaved => 'സംരക്ഷിച്ചവ';

  @override
  String get libraryEmpty =>
      'നിങ്ങൾ സംരക്ഷിച്ച പാഠപദ്ധതികളും ക്വിസുകളും ഇവിടെ കാണാം.';

  @override
  String get libraryEmptyAction => 'ഒരു പാഠപദ്ധതി ഉണ്ടാക്കുക';

  @override
  String get librarySignedOut => 'സംരക്ഷിച്ച ജോലികൾ കാണാൻ സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get libraryLoadFailed => 'നിങ്ങളുടെ ലൈബ്രറി ലോഡ് ചെയ്യാനായില്ല.';

  @override
  String get libraryNewestOnly => 'ഏറ്റവും പുതിയ 20 ഇനങ്ങൾ കാണിക്കുന്നു.';

  @override
  String get libraryFilterAll => 'എല്ലാം';

  @override
  String get libraryFilterEmpty =>
      'ഈ തരത്തിലുള്ള സംരക്ഷിച്ച ഇനങ്ങൾ ഇതുവരെയില്ല.';

  @override
  String get libraryDetailTitle => 'സംരക്ഷിച്ച ഇനം';

  @override
  String libraryDetailSavedOn(String date) {
    return '$date ന് സംരക്ഷിച്ചു';
  }

  @override
  String get libraryDetailSignedOut =>
      'സംരക്ഷിച്ച ജോലി തുറക്കാൻ സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get libraryDetailNotFound => 'ഈ ഇനം ഇനി നിങ്ങളുടെ ലൈബ്രറിയിലില്ല.';

  @override
  String get libraryDetailLoadFailed =>
      'ഈ സംരക്ഷിച്ച ഇനം തുറക്കാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String libraryDetailReady(String type) {
    return 'നിങ്ങളുടെ സംരക്ഷിച്ച $type കാണുകയാണ്.';
  }

  @override
  String get profileTitle => 'പ്രൊഫൈൽ';

  @override
  String get lessonPlanTitle => 'പാഠപദ്ധതി';

  @override
  String get lessonPlanSubtitle => 'പൂർണ്ണമായ 5E പാഠം ആസൂത്രണം ചെയ്യുക';

  @override
  String get lessonPlanEmpty =>
      'ഒരു ടോപ്പിക് നൽകി 5E പാഠപദ്ധതി ഉണ്ടാക്കാൻ സൃഷ്ടിക്കുക ടാപ്പ് ചെയ്യുക.';

  @override
  String get lessonPlanTopicLabel => 'ടോപ്പിക്';

  @override
  String get lessonPlanTopicHint => 'ഉദാഹരണത്തിന്, പ്രകാശസംശ്ലേഷണം';

  @override
  String get lessonPlanTopicError =>
      'ആസൂത്രണം ചെയ്യാൻ ദയവായി ഒരു ടോപ്പിക് നൽകുക.';

  @override
  String get lessonPlanGradeLabel => 'ക്ലാസ് നിലവാരങ്ങൾ';

  @override
  String get lessonPlanSubjectLabel => 'വിഷയം';

  @override
  String get lessonPlanSubjectAny => 'ഏത് വിഷയവും';

  @override
  String get lessonPlanResourceLabel => 'ക്ലാസ് മുറിയിലെ വിഭവങ്ങൾ';

  @override
  String get lessonPlanResourceLow => 'കുറവ്';

  @override
  String get lessonPlanResourceMedium => 'ഇടത്തരം';

  @override
  String get lessonPlanResourceHigh => 'കൂടുതൽ';

  @override
  String get lessonPlanDifficultyLabel => 'ബുദ്ധിമുട്ട്';

  @override
  String get lessonPlanDifficultyRemedial => 'പരിഹാര പഠനം';

  @override
  String get lessonPlanDifficultyStandard => 'സാധാരണ';

  @override
  String get lessonPlanDifficultyAdvanced => 'ഉയർന്നത്';

  @override
  String get lessonPlanRuralLabel =>
      'പ്രാദേശികവും ദൈനംദിനവുമായ ഉദാഹരണങ്ങൾ ഉപയോഗിക്കുക';

  @override
  String get lessonPlanRuralHint =>
      'പരിചിതമായ ഗ്രാമീണ, സാമൂഹിക സാഹചര്യങ്ങളിൽ പ്രവർത്തനങ്ങൾ അടിസ്ഥാനമാക്കുക.';

  @override
  String get lessonPlanOptional => 'ഐച്ഛികം';

  @override
  String get lessonPlanObjectives => 'പഠന ലക്ഷ്യങ്ങൾ';

  @override
  String get lessonPlanVocabulary => 'പ്രധാന പദാവലി';

  @override
  String get lessonPlanMaterials => 'സാമഗ്രികൾ';

  @override
  String get lessonPlanActivities => '5E പ്രവർത്തനങ്ങൾ';

  @override
  String get lessonPlanAssessment => 'വിലയിരുത്തൽ';

  @override
  String get lessonPlanHomework => 'ഗൃഹപാഠം';

  @override
  String get lessonPlanTeacherTip => 'അധ്യാപകർക്കുള്ള നുറുങ്ങ്';

  @override
  String get lessonPlanUnderstandingCheck => 'മനസ്സിലായോ എന്ന് പരിശോധിക്കുക';

  @override
  String get lessonPlanNoteLabel => 'തുടങ്ങുന്നതിന് മുൻപ് ഒരു കുറിപ്പ്';

  @override
  String get lessonPlanUpgradeTitle => 'ഉയർന്ന പ്ലാൻ ആവശ്യമാണ്';

  @override
  String get lessonPlanUpgradeBody =>
      'പാഠ ആസൂത്രണം ഉയർന്ന പ്ലാനിന്റെ ഭാഗമാണ്. പദ്ധതികൾ ഉണ്ടാക്കുന്നത് തുടരാൻ ദയവായി അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get lessonPlanLimitTitle => 'നിങ്ങൾ നിങ്ങളുടെ പരിധിയിൽ എത്തി';

  @override
  String get lessonPlanLimitBody =>
      'ഇപ്പോഴത്തേക്കുള്ള നിങ്ങളുടെ പാഠപദ്ധതികൾ ഉപയോഗിച്ചു കഴിഞ്ഞു. ദയവായി പിന്നീട് ശ്രമിക്കുക അല്ലെങ്കിൽ പ്ലാൻ അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get lessonPlanSeePricing => 'പ്ലാനുകളും വിലയും കാണുക';

  @override
  String get lessonPlanRephrase =>
      'അതിൽ നിന്ന് ഒരു പദ്ധതി ഉണ്ടാക്കാനായില്ല. ദയവായി ടോപ്പിക് മാറ്റിയെഴുതി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get lessonPlanBusy =>
      'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി അൽപ്പസമയത്തിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get lessonPlanTimeout =>
      'ഇത് പ്രതീക്ഷിച്ചതിലും കൂടുതൽ സമയമെടുക്കുന്നു. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get lessonPlanSignIn =>
      'ഈ ഉപകരണം ഉപയോഗിക്കാൻ ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get quizTitle => 'ക്വിസ്';

  @override
  String get quizSubtitle => 'മൂന്ന് ബുദ്ധിമുട്ട് നിലയിൽ ക്വിസ് ഉണ്ടാക്കുക';

  @override
  String get quizEmpty =>
      'ഒരു ടോപ്പിക് നൽകി ക്വിസ് ഉണ്ടാക്കാൻ സൃഷ്ടിക്കുക ടാപ്പ് ചെയ്യുക.';

  @override
  String get quizTopicLabel => 'ടോപ്പിക്';

  @override
  String get quizTopicHint => 'ഉദാഹരണത്തിന്, ഭിന്നസംഖ്യകൾ';

  @override
  String get quizTopicError => 'ക്വിസിനായി ദയവായി ഒരു ടോപ്പിക് നൽകുക.';

  @override
  String get quizNumQuestionsLabel => 'ചോദ്യങ്ങളുടെ എണ്ണം';

  @override
  String get quizFewerQuestions => 'കുറച്ച് ചോദ്യങ്ങൾ';

  @override
  String get quizMoreQuestions => 'കൂടുതൽ ചോദ്യങ്ങൾ';

  @override
  String get quizTypesLabel => 'ചോദ്യ തരങ്ങൾ';

  @override
  String get quizTypesError => 'ദയവായി ഒരു ചോദ്യ തരമെങ്കിലും തിരഞ്ഞെടുക്കുക.';

  @override
  String get quizTypeMultipleChoice => 'മൾട്ടിപ്പിൾ ചോയ്സ്';

  @override
  String get quizTypeFillInTheBlanks => 'വിട്ടുപോയ ഭാഗം പൂരിപ്പിക്കുക';

  @override
  String get quizTypeShortAnswer => 'ചെറു ഉത്തരം';

  @override
  String get quizTypeTrueFalse => 'ശരിയോ തെറ്റോ';

  @override
  String get quizGradeLabel => 'ക്ലാസ് നിലവാരം';

  @override
  String get quizGradeAny => 'ഏത് ക്ലാസും';

  @override
  String get quizSubjectLabel => 'വിഷയം';

  @override
  String get quizSubjectAny => 'ഏത് വിഷയവും';

  @override
  String get quizDifficultyLabel => 'ബുദ്ധിമുട്ട്';

  @override
  String get quizDifficultyHint =>
      'എളുപ്പം, ഇടത്തരം, കഠിനം എന്നീ മൂന്ന് പതിപ്പുകൾ ലഭിക്കാൻ എല്ലാ നിലകളും തിരഞ്ഞെടുത്തിരിക്കുക.';

  @override
  String get quizDifficultyAll => 'എല്ലാ നിലകളും';

  @override
  String get quizDifficultyEasy => 'എളുപ്പം';

  @override
  String get quizDifficultyMedium => 'ഇടത്തരം';

  @override
  String get quizDifficultyHard => 'കഠിനം';

  @override
  String get quizBloomsLabel => 'ചിന്താ ശേഷികൾ';

  @override
  String get quizBloomsHint =>
      'ചോദ്യങ്ങൾ ആവശ്യപ്പെടേണ്ട ചിന്താ രീതികൾ തിരഞ്ഞെടുക്കുക.';

  @override
  String get quizOptional => 'ഐച്ഛികം';

  @override
  String quizQuestionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ചോദ്യങ്ങൾ',
      one: '1 ചോദ്യം',
    );
    return '$_temp0';
  }

  @override
  String get quizShowAnswer => 'ഉത്തരം കാണിക്കുക';

  @override
  String get quizHideAnswer => 'ഉത്തരം മറയ്ക്കുക';

  @override
  String get quizShowAllAnswers => 'എല്ലാ ഉത്തരങ്ങളും കാണിക്കുക';

  @override
  String get quizHideAllAnswers => 'എല്ലാ ഉത്തരങ്ങളും മറയ്ക്കുക';

  @override
  String get quizCorrectAnswer => 'ശരിയായ ഉത്തരം';

  @override
  String get quizExplanation => 'എന്തുകൊണ്ട്';

  @override
  String get quizTeacherInstructions => 'ക്ലാസിൽ ഇത് എങ്ങനെ നടത്താം';

  @override
  String get quizNoteLabel => 'തുടങ്ങുന്നതിന് മുൻപ് ഒരു കുറിപ്പ്';

  @override
  String get quizNoQuestions =>
      'ആ ടോപ്പിക്കിന് ചോദ്യങ്ങളൊന്നും ലഭിച്ചില്ല. ദയവായി മറ്റൊരു ടോപ്പിക് പരീക്ഷിക്കുക.';

  @override
  String get quizUpgradeTitle => 'ഉയർന്ന പ്ലാൻ ആവശ്യമാണ്';

  @override
  String get quizUpgradeBody =>
      'ക്വിസ് നിർമ്മാണം ഉയർന്ന പ്ലാനിന്റെ ഭാഗമാണ്. ക്വിസുകൾ ഉണ്ടാക്കുന്നത് തുടരാൻ ദയവായി അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get quizLimitTitle => 'നിങ്ങൾ നിങ്ങളുടെ പരിധിയിൽ എത്തി';

  @override
  String get quizLimitBody =>
      'ഇപ്പോഴത്തേക്കുള്ള നിങ്ങളുടെ ക്വിസുകൾ ഉപയോഗിച്ചു കഴിഞ്ഞു. ദയവായി പിന്നീട് ശ്രമിക്കുക അല്ലെങ്കിൽ പ്ലാൻ അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get quizSeePricing => 'പ്ലാനുകളും വിലയും കാണുക';

  @override
  String get quizRephrase =>
      'അതിൽ നിന്ന് ഒരു ക്വിസ് ഉണ്ടാക്കാനായില്ല. ദയവായി ടോപ്പിക് മാറ്റിയെഴുതി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get quizBusy =>
      'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി അൽപ്പസമയത്തിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get quizTimeout =>
      'ഇത് പ്രതീക്ഷിച്ചതിലും കൂടുതൽ സമയമെടുക്കുന്നു. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get quizSignIn =>
      'ഈ ഉപകരണം ഉപയോഗിക്കാൻ ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get instantAnswerTitle => 'തൽക്ഷണ ഉത്തരം';

  @override
  String get instantAnswerSubtitle => 'ക്ലാസ് മുറിയിലെ ഏത് ചോദ്യവും ചോദിക്കൂ';

  @override
  String get instantAnswerAction => 'ഉത്തരം നേടുക';

  @override
  String get instantAnswerEmpty =>
      'ഒരു ചോദ്യം ചോദിച്ച് ഉത്തരം നേടുക ടാപ്പ് ചെയ്യുക.';

  @override
  String get instantAnswerQuestionLabel => 'നിങ്ങളുടെ ചോദ്യം';

  @override
  String get instantAnswerQuestionHint =>
      'ഉദാഹരണത്തിന്, ചന്ദ്രന്റെ ആകൃതി എന്തുകൊണ്ട് മാറുന്നു?';

  @override
  String get instantAnswerQuestionError => 'ദയവായി ഒരു ചോദ്യം നൽകുക.';

  @override
  String get instantAnswerGradeLabel => 'ക്ലാസ് നിലവാരം';

  @override
  String get instantAnswerGradeAny => 'ഏത് ക്ലാസും';

  @override
  String get instantAnswerSubjectLabel => 'വിഷയം';

  @override
  String get instantAnswerSubjectAny => 'ഏത് വിഷയവും';

  @override
  String get instantAnswerOptional => 'ഐച്ഛികം';

  @override
  String get instantAnswerVideoTitle => 'ബന്ധപ്പെട്ട ഒരു വീഡിയോ കാണുക';

  @override
  String get instantAnswerVideoBody =>
      'ആപ്പിന് പുറത്ത്, നിങ്ങളുടെ ബ്രൗസറിൽ തുറക്കുന്നു.';

  @override
  String get instantAnswerNoAnswer =>
      'ആ ചോദ്യത്തിന് ഉത്തരമൊന്നും ലഭിച്ചില്ല. ദയവായി അത് മാറ്റിയെഴുതി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get instantAnswerSeePricing => 'പ്ലാനുകളും വിലയും കാണുക';

  @override
  String get instantAnswerDailyLimitTitle =>
      'ഇന്നത്തേക്കുള്ള നിങ്ങളുടെ എല്ലാ ചോദ്യങ്ങളും തീർന്നു';

  @override
  String get instantAnswerDailyLimitBody =>
      'നിങ്ങളുടെ പ്ലാനിൽ ഓരോ ദിവസവും ഒരു നിശ്ചിത എണ്ണം തൽക്ഷണ ഉത്തരങ്ങൾ ഉൾപ്പെടുന്നു. നിങ്ങളുടെ ചോദ്യങ്ങൾ നാളെ വീണ്ടും ലഭ്യമാകും, അല്ലെങ്കിൽ ഉയർന്ന പ്ലാനിൽ ദൈനംദിന പരിധി ഉയർത്താം.';

  @override
  String get instantAnswerLimitTitle => 'നിങ്ങൾ നിങ്ങളുടെ പരിധിയിൽ എത്തി';

  @override
  String get instantAnswerLimitBody =>
      'ഈ മാസത്തെ നിങ്ങളുടെ തൽക്ഷണ ഉത്തരങ്ങൾ ഉപയോഗിച്ചു കഴിഞ്ഞു. നിങ്ങളുടെ ചോദ്യങ്ങൾ അടുത്ത മാസം വീണ്ടും ലഭ്യമാകും, അല്ലെങ്കിൽ ഉയർന്ന പ്ലാനിൽ പരിധി ഉയർത്താം.';

  @override
  String get instantAnswerUpgradeTitle => 'ഉയർന്ന പ്ലാൻ ആവശ്യമാണ്';

  @override
  String get instantAnswerUpgradeBody =>
      'തൽക്ഷണ ഉത്തരങ്ങൾ ഉയർന്ന പ്ലാനിന്റെ ഭാഗമാണ്. ചോദ്യങ്ങൾ ചോദിക്കുന്നത് തുടരാൻ ദയവായി അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get instantAnswerRephrase =>
      'അതിന് ഉത്തരം നൽകാനായില്ല. ദയവായി ചോദ്യം മാറ്റിയെഴുതി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get instantAnswerBusy =>
      'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി അൽപ്പസമയത്തിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.';

  @override
  String instantAnswerBusyRetryAfter(int seconds) {
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
  String get instantAnswerTimeout =>
      'ഇത് പ്രതീക്ഷിച്ചതിലും കൂടുതൽ സമയമെടുക്കുന്നു. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get instantAnswerSignIn =>
      'ഈ ഉപകരണം ഉപയോഗിക്കാൻ ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get settingsTitle => 'ക്രമീകരണങ്ങൾ';

  @override
  String get settingsAppearanceTitle => 'കാഴ്ച';

  @override
  String get settingsThemeSystem => 'ഉപകരണത്തിന് അനുസരിച്ച്';

  @override
  String get settingsThemeLight => 'ലൈറ്റ്';

  @override
  String get settingsThemeDark => 'ഡാർക്ക്';

  @override
  String get settingsLanguageHint =>
      'ആപ്പിന്റെ ഭാഷയും നിങ്ങളുടെ അധ്യാപന സാമഗ്രികൾ എഴുതുന്ന ഭാഷയും ഇത് നിശ്ചയിക്കുന്നു.';

  @override
  String get settingsNotificationsTitle => 'അറിയിപ്പുകൾ';

  @override
  String get settingsNotificationsLabel =>
      'ഓർമ്മപ്പെടുത്തലുകളും അപ്‌ഡേറ്റുകളും';

  @override
  String get settingsNotificationsHint =>
      'പുതിയ അധ്യാപന ഉപകരണങ്ങളെക്കുറിച്ചും നിങ്ങളുടെ സംരക്ഷിച്ച ജോലികളെക്കുറിച്ചും അറിയുക.';

  @override
  String get settingsVoiceModeTitle => 'ശബ്ദ മോഡ്';

  @override
  String get settingsVoiceModeLabel => 'ലൈവ് ശബ്ദം (ബീറ്റ)';

  @override
  String get settingsVoiceModeHint =>
      'VIDYA-യുമായി തത്സമയം സംസാരിക്കൂ. ഓഫ് ആയിരിക്കുമ്പോൾ, VIDYA കേട്ടശേഷം ഓരോ ഊഴമായി മറുപടി നൽകും.';

  @override
  String get settingsProfileTitle => 'അധ്യാപന പ്രൊഫൈൽ';

  @override
  String get settingsProfileHint =>
      'നിങ്ങളുടെ ബോർഡിനും ക്ലാസ് മുറിക്കും അനുസൃതമായി സാമഗ്രികൾ നൽകാൻ ഇത് സഹായിക്കുന്നു.';

  @override
  String get settingsBoardLabel => 'വിദ്യാഭ്യാസ ബോർഡ്';

  @override
  String get settingsBoardNone => 'സജ്ജമാക്കിയിട്ടില്ല';

  @override
  String get settingsQualificationsLabel => 'യോഗ്യതകൾ';

  @override
  String get settingsQualificationsHint =>
      'നിങ്ങൾക്കുള്ള എല്ലാ യോഗ്യതകളും തിരഞ്ഞെടുക്കുക.';

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
  String get settingsSaveProfile => 'പ്രൊഫൈൽ സേവ് ചെയ്യുക';

  @override
  String get settingsProfileSaved => 'നിങ്ങളുടെ അധ്യാപന പ്രൊഫൈൽ സേവ് ചെയ്തു.';

  @override
  String get settingsSaveFailed =>
      'നിങ്ങളുടെ പ്രൊഫൈൽ സേവ് ചെയ്യാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get settingsSignedOutTitle => 'നിങ്ങൾ സൈൻ ഔട്ട് ചെയ്തിരിക്കുന്നു';

  @override
  String get settingsSignedOutBody =>
      'നിങ്ങളുടെ അധ്യാപന പ്രൊഫൈലും അക്കൗണ്ടും കൈകാര്യം ചെയ്യാൻ സൈൻ ഇൻ ചെയ്യുക. ഭാഷയും കാഴ്ചയും സംബന്ധിച്ച തിരഞ്ഞെടുപ്പുകൾ ഈ ഉപകരണത്തിൽ എന്തായാലും സേവ് ആകും.';

  @override
  String get settingsSignIn => 'സൈൻ ഇൻ ചെയ്യൂ';

  @override
  String get settingsDangerTitle => 'അക്കൗണ്ട് ഇല്ലാതാക്കുക';

  @override
  String get settingsDangerBody =>
      'ഇത് നിങ്ങളുടെ അക്കൗണ്ട് അടയ്ക്കുകയും സംരക്ഷിച്ച ജോലികൾ നീക്കം ചെയ്യുകയും ചെയ്യും. പൂർണ്ണമായി ഇല്ലാതാകുന്നതിന് മുൻപ് എല്ലാം എക്സ്പോർട്ട് ചെയ്യാൻ 30 ദിവസം ലഭിക്കും.';

  @override
  String get settingsDeleteAction => 'അക്കൗണ്ട് ഇല്ലാതാക്കുക';

  @override
  String get settingsDeleteDialogTitle => 'നിങ്ങളുടെ അക്കൗണ്ട് ഇല്ലാതാക്കണോ?';

  @override
  String get settingsDeleteDialogBody =>
      'നിങ്ങളുടെ പാഠപദ്ധതികളും ക്വിസുകളും പ്രൊഫൈലും ഇല്ലാതാക്കാൻ നിശ്ചയിക്കും. നീക്കം ചെയ്യുന്നതിന് മുൻപ് ജോലികൾ എക്സ്പോർട്ട് ചെയ്യാൻ 30 ദിവസമുണ്ട്.';

  @override
  String settingsDeleteConfirmPrompt(String word) {
    return 'സ്ഥിരീകരിക്കാൻ താഴെ $word എന്ന് ടൈപ്പ് ചെയ്യുക.';
  }

  @override
  String get settingsDeleteConfirmLabel => 'സ്ഥിരീകരണം';

  @override
  String get settingsDeleteCancel => 'എന്റെ അക്കൗണ്ട് നിലനിർത്തുക';

  @override
  String get settingsDeleteConfirm => 'അക്കൗണ്ട് ഇല്ലാതാക്കുക';

  @override
  String get settingsDeleteScheduled =>
      'നിങ്ങളുടെ അക്കൗണ്ട് ഇല്ലാതാക്കാൻ നിശ്ചയിച്ചു. ജോലികൾ എക്സ്പോർട്ട് ചെയ്യാൻ 30 ദിവസമുണ്ട്.';

  @override
  String get settingsDeleteSuccessTitle => 'അക്കൗണ്ട് ഇല്ലാതാക്കാൻ നിശ്ചയിച്ചു';

  @override
  String get settingsExportDataAction => 'എന്റെ ഡാറ്റ എക്സ്പോർട്ട് ചെയ്യുക';

  @override
  String get settingsExportQueuedMessage =>
      'നിങ്ങളുടെ എക്സ്പോർട്ട് ഉടനെ തയ്യാറാക്കാൻ കഴിയാത്തത്ര വലുതാണ്, അതിനാൽ ഞങ്ങൾ അത് ക്യൂവിൽ ചേർത്തു. ദയവായി പിന്നീട് വീണ്ടും ശ്രമിക്കുക, അല്ലെങ്കിൽ ഡാറ്റയുടെ പകർപ്പിനായി സപ്പോർട്ടുമായി ബന്ധപ്പെടുക.';

  @override
  String get settingsExportFailedMessage =>
      'നിങ്ങളുടെ എക്സ്പോർട്ട് തയ്യാറാക്കാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get settingsDeleteSuccessDone => 'പൂർത്തിയായി';

  @override
  String get settingsDeleteFailed =>
      'നിങ്ങളുടെ അക്കൗണ്ട് ഇല്ലാതാക്കാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get settingsReauthTitle => 'ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക';

  @override
  String get settingsReauthBody =>
      'നിങ്ങളുടെ സുരക്ഷയ്ക്കായി, അക്കൗണ്ട് ഇല്ലാതാക്കാൻ പുതിയ സൈൻ ഇൻ ആവശ്യമാണ്. ദയവായി സൈൻ ഔട്ട് ചെയ്ത് വീണ്ടും സൈൻ ഇൻ ചെയ്ത്, അഞ്ച് മിനിറ്റിനുള്ളിൽ ഇല്ലാതാക്കുക.';

  @override
  String get profilePlanLabel => 'പ്ലാൻ';

  @override
  String get profilePlanFree => 'സൗജന്യം';

  @override
  String get profilePlanPro => 'പ്രോ';

  @override
  String get profilePlanGold => 'ഗോൾഡ്';

  @override
  String get profilePlanPremium => 'പ്രീമിയം';

  @override
  String get profilePlanUnknown => 'ലഭ്യമല്ല';

  @override
  String get profileNoName => 'നിങ്ങളുടെ പ്രൊഫൈൽ';

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
      'നിങ്ങൾ പങ്കിടുന്ന ജോലികളിൽ മറ്റ് അധ്യാപകർ കാണുന്ന പേരാണിത്.';

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
      'ആപ്പിലെ മറ്റെല്ലായിടത്തുമുള്ള അതേ ഭാഷാ തിരഞ്ഞെടുപ്പാണിത്, അതിനാൽ ഇവിടെ മാറ്റിയാൽ എല്ലായിടത്തും മാറും.';

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
  String get profileEmptyTitle => 'നിങ്ങളുടെ പ്രൊഫൈൽ ശൂന്യമാണ്';

  @override
  String get profileEmptyBody =>
      'നിങ്ങളുടെ സ്കൂളും ക്ലാസുകളും ചേർക്കൂ, നിങ്ങൾ ഉണ്ടാക്കുന്ന എല്ലാ പാഠപദ്ധതികളും ക്വിസുകളും ക്ലാസ് മുറിക്ക് അനുയോജ്യമായി ലഭിക്കും.';

  @override
  String get profileLoadFailed =>
      'നിങ്ങളുടെ പ്രൊഫൈൽ തുറക്കാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get profileSignedOutTitle => 'നിങ്ങൾ സൈൻ ഔട്ട് ചെയ്തിരിക്കുന്നു';

  @override
  String get profileSignedOutBody =>
      'നിങ്ങളുടെ അധ്യാപന പ്രൊഫൈൽ കാണാനും തിരുത്താനും സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get profileSaveSignIn =>
      'പ്രൊഫൈൽ സേവ് ചെയ്യാൻ ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.';

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
  String get imageInputHint => 'പാഠപുസ്തക പേജിന്റെ വ്യക്തമായ ഫോട്ടോ ചേർക്കുക.';

  @override
  String get imageInputTakePhoto => 'ഫോട്ടോ എടുക്കുക';

  @override
  String get imageInputChooseGallery => 'ഗാലറിയിൽ നിന്ന് തിരഞ്ഞെടുക്കുക';

  @override
  String get imageInputRetake => 'ഫോട്ടോ വീണ്ടും എടുക്കുക';

  @override
  String get imageInputChangeGallery => 'മറ്റൊന്ന് തിരഞ്ഞെടുക്കുക';

  @override
  String get imageInputRemove => 'ഫോട്ടോ നീക്കം ചെയ്യുക';

  @override
  String get imageInputPreviewLabel => 'തിരഞ്ഞെടുത്ത ചിത്രത്തിന്റെ പ്രിവ്യൂ';

  @override
  String imageInputSizeOfMax(String used, String max) {
    return '$max-ൽ $used';
  }

  @override
  String imageInputTooLarge(String max) {
    return 'ഈ ഫോട്ടോ വളരെ വലുതാണ്. ദയവായി $max-ൽ താഴെയുള്ള ഒന്ന് തിരഞ്ഞെടുക്കുക.';
  }

  @override
  String get imageInputPermissionDenied =>
      'നിങ്ങളുടെ ക്യാമറയോ ഫോട്ടോകളോ ഉപയോഗിക്കാൻ SahayakAI-ക്ക് അനുമതി വേണം. ദയവായി ഉപകരണ ക്രമീകരണങ്ങളിൽ അനുമതി നൽകുക.';

  @override
  String get imageInputFailed =>
      'ആ ചിത്രം തുറക്കാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get worksheetTitle => 'വർക്ക്‌ഷീറ്റ്';

  @override
  String get worksheetSubtitle =>
      'പാഠപുസ്തക ഫോട്ടോയിൽ നിന്ന് വർക്ക്‌ഷീറ്റ് ഉണ്ടാക്കുക';

  @override
  String get worksheetEmpty =>
      'ഒരു പാഠപുസ്തക ഫോട്ടോയും നിർദേശവും ചേർത്ത് സൃഷ്ടിക്കുക ടാപ്പ് ചെയ്യുക.';

  @override
  String get worksheetImageLabel => 'പാഠപുസ്തക പേജിന്റെ ഫോട്ടോ';

  @override
  String get worksheetImageHint =>
      'ഈ പേജിൽ നിന്നാണ് വർക്ക്‌ഷീറ്റ് ഉണ്ടാക്കുന്നത്.';

  @override
  String get toolImageOptionalLabel => 'പാഠപുസ്തക പേജിന്റെ ഫോട്ടോ (ഐച്ഛികം)';

  @override
  String get toolImageOptionalHint =>
      'ഒരു പേജ് ഫോട്ടോ ചേർത്താൽ അത് പ്രധാന സ്രോതസ്സാകും, അല്ലെങ്കിൽ ഒഴിവാക്കാം.';

  @override
  String get worksheetImageError =>
      'ദയവായി പാഠപുസ്തക പേജിന്റെ ഒരു ഫോട്ടോ ചേർക്കുക.';

  @override
  String get worksheetPromptLabel => 'നിങ്ങൾക്ക് ഏത് വർക്ക്‌ഷീറ്റ് വേണം?';

  @override
  String get worksheetPromptHint =>
      'ഉദാഹരണത്തിന്, ഈ പേജിൽ നിന്ന് ഗുണനത്തിന്റെ വർക്ക്‌ഷീറ്റ് ഉണ്ടാക്കുക';

  @override
  String get worksheetPromptError =>
      'ദയവായി നിങ്ങൾക്ക് വേണ്ട വർക്ക്‌ഷീറ്റ് വിവരിക്കുക.';

  @override
  String get worksheetGradeLabel => 'ക്ലാസ് നിലവാരം';

  @override
  String get worksheetGradeAny => 'ഏത് ക്ലാസും';

  @override
  String get worksheetSubjectLabel => 'വിഷയം';

  @override
  String get worksheetSubjectAny => 'ഏത് വിഷയവും';

  @override
  String get worksheetOptional => 'ഐച്ഛികം';

  @override
  String get worksheetObjectives => 'പഠന ലക്ഷ്യങ്ങൾ';

  @override
  String get worksheetInstructions => 'വിദ്യാർത്ഥികൾക്കുള്ള നിർദേശങ്ങൾ';

  @override
  String get worksheetActivities => 'പ്രവർത്തനങ്ങൾ';

  @override
  String get worksheetActivityQuestion => 'ചോദ്യം';

  @override
  String get worksheetActivityPuzzle => 'പസിൽ';

  @override
  String get worksheetActivityCreativeTask => 'സർഗാത്മക പ്രവർത്തനം';

  @override
  String get worksheetExplanation => 'അധ്യാപകർക്കായി';

  @override
  String get worksheetChalkboardNote => 'ബ്ലാക്ക്ബോർഡിൽ';

  @override
  String get worksheetAnswerKey => 'ഉത്തരസൂചിക';

  @override
  String get worksheetNoContent =>
      'ആ പേജിന് വർക്ക്‌ഷീറ്റൊന്നും ലഭിച്ചില്ല. ദയവായി വ്യക്തമായ ഫോട്ടോ അല്ലെങ്കിൽ മറ്റൊരു നിർദേശം പരീക്ഷിക്കുക.';

  @override
  String get worksheetSave => 'ലൈബ്രറിയിലേക്ക് സേവ് ചെയ്യുക';

  @override
  String get worksheetSaving => 'സേവ് ചെയ്യുന്നു';

  @override
  String get worksheetSaved => 'നിങ്ങളുടെ ലൈബ്രറിയിൽ സേവ് ചെയ്തു';

  @override
  String get worksheetSaveFailedTitle => 'സേവ് ചെയ്യാനായില്ല';

  @override
  String get worksheetSaveFailedBody =>
      'ഈ വർക്ക്‌ഷീറ്റ് നിങ്ങളുടെ ലൈബ്രറിയിൽ സേവ് ചെയ്യാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get worksheetSaveRetry => 'വീണ്ടും സേവ് ചെയ്യാൻ ശ്രമിക്കുക';

  @override
  String get worksheetUpgradeTitle => 'ഉയർന്ന പ്ലാൻ ആവശ്യമാണ്';

  @override
  String get worksheetUpgradeBody =>
      'വർക്ക്‌ഷീറ്റ് നിർമ്മാണം ഉയർന്ന പ്ലാനിന്റെ ഭാഗമാണ്. വർക്ക്‌ഷീറ്റുകൾ ഉണ്ടാക്കുന്നത് തുടരാൻ ദയവായി അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get worksheetLimitTitle => 'നിങ്ങൾ നിങ്ങളുടെ പരിധിയിൽ എത്തി';

  @override
  String get worksheetLimitBody =>
      'ഇപ്പോഴത്തേക്കുള്ള നിങ്ങളുടെ വർക്ക്‌ഷീറ്റുകൾ ഉപയോഗിച്ചു കഴിഞ്ഞു. ദയവായി പിന്നീട് ശ്രമിക്കുക അല്ലെങ്കിൽ പ്ലാൻ അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get worksheetSeePricing => 'പ്ലാനുകളും വിലയും കാണുക';

  @override
  String get worksheetRephrase =>
      'അതിൽ നിന്ന് വർക്ക്‌ഷീറ്റ് ഉണ്ടാക്കാനായില്ല. ദയവായി വ്യക്തമായ ഫോട്ടോ പരീക്ഷിക്കുക അല്ലെങ്കിൽ നിർദേശം മാറ്റിയെഴുതുക.';

  @override
  String get worksheetBusy =>
      'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി അൽപ്പസമയത്തിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get worksheetTimeout =>
      'ഇത് പ്രതീക്ഷിച്ചതിലും കൂടുതൽ സമയമെടുക്കുന്നു. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get worksheetSignIn =>
      'ഈ ഉപകരണം ഉപയോഗിക്കാൻ ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get rubricTitle => 'റൂബ്രിക്';

  @override
  String get rubricSubtitle =>
      'ഒരു അസൈൻമെന്റിന് മൂല്യനിർണ്ണയ റൂബ്രിക് ഉണ്ടാക്കുക';

  @override
  String get rubricEmpty => 'അസൈൻമെന്റ് വിവരിച്ച് സൃഷ്ടിക്കുക ടാപ്പ് ചെയ്യുക.';

  @override
  String get rubricAssignmentLabel => 'അസൈൻമെന്റ് എന്താണ്?';

  @override
  String get rubricAssignmentHint =>
      'ഈ അസൈൻമെന്റാണ് റൂബ്രിക് വിലയിരുത്തുന്നത്.';

  @override
  String get rubricAssignmentPlaceholder =>
      'ഉദാഹരണത്തിന്, പുനരുപയോഗ ഊർജത്തെക്കുറിച്ചുള്ള അഞ്ചാം ക്ലാസ് പ്രോജക്ട്';

  @override
  String get rubricAssignmentError => 'ദയവായി അസൈൻമെന്റ് വിവരിക്കുക.';

  @override
  String get rubricGradeLabel => 'ക്ലാസ് നിലവാരം';

  @override
  String get rubricGradeAny => 'ഏത് ക്ലാസും';

  @override
  String get rubricSubjectLabel => 'വിഷയം';

  @override
  String get rubricSubjectAny => 'ഏത് വിഷയവും';

  @override
  String get rubricOptional => 'ഐച്ഛികം';

  @override
  String get rubricCriteriaColumn => 'മാനദണ്ഡങ്ങൾ';

  @override
  String rubricPoints(String points) {
    return '$points പോയിന്റ്';
  }

  @override
  String get rubricScrollHint =>
      'എല്ലാ നിലകളും കാണാൻ വശത്തേക്ക് സ്വൈപ്പ് ചെയ്യുക.';

  @override
  String get rubricNoContent =>
      'അതിന് റൂബ്രിക്കൊന്നും ലഭിച്ചില്ല. ദയവായി അസൈൻമെന്റ് കൂടുതൽ വ്യക്തമായി വിവരിക്കുക.';

  @override
  String get rubricUpgradeTitle => 'ഉയർന്ന പ്ലാൻ ആവശ്യമാണ്';

  @override
  String get rubricUpgradeBody =>
      'റൂബ്രിക് നിർമ്മാണം ഉയർന്ന പ്ലാനിന്റെ ഭാഗമാണ്. റൂബ്രിക്കുകൾ ഉണ്ടാക്കുന്നത് തുടരാൻ ദയവായി അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get rubricLimitTitle => 'നിങ്ങൾ നിങ്ങളുടെ പരിധിയിൽ എത്തി';

  @override
  String get rubricLimitBody =>
      'ഇപ്പോഴത്തേക്കുള്ള നിങ്ങളുടെ റൂബ്രിക്കുകൾ ഉപയോഗിച്ചു കഴിഞ്ഞു. ദയവായി പിന്നീട് ശ്രമിക്കുക അല്ലെങ്കിൽ പ്ലാൻ അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get rubricRephrase =>
      'അതിൽ നിന്ന് റൂബ്രിക് ഉണ്ടാക്കാനായില്ല. ദയവായി അസൈൻമെന്റ് മാറ്റിയെഴുതി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get rubricBusy =>
      'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി അൽപ്പസമയത്തിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get rubricTimeout =>
      'ഇത് പ്രതീക്ഷിച്ചതിലും കൂടുതൽ സമയമെടുക്കുന്നു. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get rubricSignIn =>
      'ഈ ഉപകരണം ഉപയോഗിക്കാൻ ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get examPaperTitle => 'ചോദ്യപേപ്പർ';

  @override
  String get examPaperSubtitle =>
      'ഉത്തരസൂചികയോടെ ബോർഡ് മാതൃകയിലുള്ള ചോദ്യപേപ്പർ ഉണ്ടാക്കുക';

  @override
  String get examPaperEmpty =>
      'ബോർഡ്, ക്ലാസ്, വിഷയം തിരഞ്ഞെടുത്ത് സൃഷ്ടിക്കുക ടാപ്പ് ചെയ്യുക.';

  @override
  String get examPaperBoardLabel => 'ബോർഡ്';

  @override
  String get examPaperBoardHint => 'ഒരു ബോർഡ് തിരഞ്ഞെടുക്കുക';

  @override
  String get examPaperBoardError => 'ദയവായി ഒരു ബോർഡ് തിരഞ്ഞെടുക്കുക.';

  @override
  String get examPaperGradeLabel => 'ക്ലാസ് നിലവാരം';

  @override
  String get examPaperGradeHint => 'ഒരു ക്ലാസ് തിരഞ്ഞെടുക്കുക';

  @override
  String get examPaperGradeError => 'ദയവായി ഒരു ക്ലാസ് നിലവാരം തിരഞ്ഞെടുക്കുക.';

  @override
  String get examPaperSubjectLabel => 'വിഷയം';

  @override
  String get examPaperSubjectHint => 'ഒരു വിഷയം തിരഞ്ഞെടുക്കുക';

  @override
  String get examPaperSubjectError => 'ദയവായി ഒരു വിഷയം തിരഞ്ഞെടുക്കുക.';

  @override
  String get examPaperSubjectOther => 'മറ്റൊരു വിഷയം';

  @override
  String get examPaperSubjectOtherLabel => 'വിഷയത്തിന്റെ പേര്';

  @override
  String get examPaperSubjectOtherHint => 'ഉദാഹരണത്തിന്, ധനതത്ത്വശാസ്ത്രം';

  @override
  String get examPaperSubjectOtherError => 'ദയവായി ഒരു വിഷയം നൽകുക.';

  @override
  String get examPaperChaptersLabel => 'അധ്യായങ്ങൾ';

  @override
  String get examPaperChaptersHint =>
      'ഉൾപ്പെടുത്തേണ്ട അധ്യായങ്ങൾ ചേർക്കുക. ഔദ്യോഗിക ബ്ലൂപ്രിന്റ് ഉള്ളിടത്ത് മുഴുവൻ സിലബസിനും ഇത് ഒഴിവാക്കാം.';

  @override
  String get examPaperChaptersPlaceholder =>
      'ഉദാഹരണത്തിന്, ദ്വിഘാത സമവാക്യങ്ങൾ';

  @override
  String get examPaperChaptersAdd => 'അധ്യായം ചേർക്കുക';

  @override
  String get examPaperChaptersError =>
      'ഈ ബോർഡ്, ക്ലാസ്, വിഷയം എന്നിവയ്ക്ക് ദയവായി ഒരു അധ്യായമെങ്കിലും ചേർക്കുക.';

  @override
  String get examPaperDifficultyLabel => 'ബുദ്ധിമുട്ട്';

  @override
  String get examPaperDifficultyEasy => 'എളുപ്പം';

  @override
  String get examPaperDifficultyModerate => 'മിതം';

  @override
  String get examPaperDifficultyHard => 'കഠിനം';

  @override
  String get examPaperDifficultyMixed => 'മിശ്രിതം';

  @override
  String get examPaperIncludeAnswerKey => 'ഉത്തരസൂചിക ഉൾപ്പെടുത്തുക';

  @override
  String get examPaperIncludeMarkingScheme => 'മാർക്കിംഗ് സ്കീം ഉൾപ്പെടുത്തുക';

  @override
  String get examPaperInProgressTitle =>
      'നിങ്ങളുടെ ചോദ്യപേപ്പർ തയ്യാറാക്കുന്നു';

  @override
  String get examPaperInProgressBody =>
      'പൂർണ്ണമായ ബോർഡ് പേപ്പർ ഉണ്ടാക്കാൻ അൽപ്പം കൂടുതൽ സമയമെടുക്കും. ഞങ്ങൾ അത് പൂർത്തിയാക്കുകയാണ്, അത് നിങ്ങൾക്കായി സേവ് ചെയ്യും.';

  @override
  String get examPaperInProgressLibraryHint =>
      'പൂർത്തിയായ ചോദ്യപേപ്പർ കാണാൻ ഒരു മിനിറ്റിനുള്ളിൽ ലൈബ്രറി ടാബ് തുറക്കുക.';

  @override
  String examPaperMaxMarks(String marks) {
    return 'പരമാവധി മാർക്ക് $marks';
  }

  @override
  String examPaperMarks(String marks) {
    return '$marks മാർക്ക്';
  }

  @override
  String examPaperSectionMarks(String marks) {
    return '$marks മാർക്ക്';
  }

  @override
  String examPaperPercent(String value) {
    return '$value ശതമാനം';
  }

  @override
  String get examPaperGeneralInstructions => 'പൊതു നിർദേശങ്ങൾ';

  @override
  String get examPaperInternalChoice => 'അല്ലെങ്കിൽ';

  @override
  String get examPaperAnswerKey => 'ഉത്തരം';

  @override
  String get examPaperMarkingScheme => 'മാർക്കിംഗ് സ്കീം';

  @override
  String get examPaperBlueprintTitle => 'ബ്ലൂപ്രിന്റ് സംഗ്രഹം';

  @override
  String get examPaperBlueprintChapters => 'അധ്യായം തിരിച്ചുള്ള മാർക്ക്';

  @override
  String get examPaperBlueprintDifficulty =>
      'ബുദ്ധിമുട്ട് അനുസരിച്ചുള്ള വിഭജനം';

  @override
  String get examPaperPyqTitle => 'മുൻവർഷ ചോദ്യങ്ങൾ';

  @override
  String examPaperPyqChapterYear(String chapter, int year) {
    return '$chapter ($year)';
  }

  @override
  String examPaperPyqYear(int year) {
    return '$year വർഷം';
  }

  @override
  String get examPaperNoContent =>
      'അതിന് ചോദ്യപേപ്പറൊന്നും ലഭിച്ചില്ല. ദയവായി കുറച്ച് അധ്യായങ്ങൾ അല്ലെങ്കിൽ മറ്റൊരു വിഷയം പരീക്ഷിക്കുക.';

  @override
  String get examPaperSave => 'ലൈബ്രറിയിലേക്ക് സേവ് ചെയ്യുക';

  @override
  String get examPaperSaving => 'സേവ് ചെയ്യുന്നു';

  @override
  String get examPaperSaved => 'നിങ്ങളുടെ ലൈബ്രറിയിൽ സേവ് ചെയ്തു';

  @override
  String get examPaperSaveFailedTitle => 'സേവ് ചെയ്യാനായില്ല';

  @override
  String get examPaperSaveFailedBody =>
      'ഈ ചോദ്യപേപ്പർ നിങ്ങളുടെ ലൈബ്രറിയിൽ സേവ് ചെയ്യാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get examPaperSaveRetry => 'വീണ്ടും സേവ് ചെയ്യാൻ ശ്രമിക്കുക';

  @override
  String get examPaperUnstructuredTitle => 'ആ ചോദ്യപേപ്പർ ക്രമീകരിക്കാനായില്ല';

  @override
  String get examPaperUnstructuredBody =>
      'ഇത് പൂർണ്ണമായ ഒരു ചോദ്യപേപ്പറായി ക്രമീകരിക്കാൻ സഹായിക്ക് കഴിഞ്ഞില്ല. ദയവായി കുറച്ച് അധ്യായങ്ങൾ ഒഴിവാക്കി വീണ്ടും സൃഷ്ടിക്കുക.';

  @override
  String get examPaperUpgradeTitle => 'ഉയർന്ന പ്ലാൻ ആവശ്യമാണ്';

  @override
  String get examPaperUpgradeBody =>
      'ചോദ്യപേപ്പർ നിർമ്മാണം ഉയർന്ന പ്ലാനിന്റെ ഭാഗമാണ്. പേപ്പറുകൾ ഉണ്ടാക്കുന്നത് തുടരാൻ ദയവായി അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get examPaperLimitTitle => 'നിങ്ങൾ നിങ്ങളുടെ പരിധിയിൽ എത്തി';

  @override
  String get examPaperLimitBody =>
      'ഇപ്പോഴത്തേക്കുള്ള നിങ്ങളുടെ ചോദ്യപേപ്പറുകൾ ഉപയോഗിച്ചു കഴിഞ്ഞു. ദയവായി പിന്നീട് ശ്രമിക്കുക അല്ലെങ്കിൽ പ്ലാൻ അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get examPaperRephrase =>
      'അതിൽ നിന്ന് ചോദ്യപേപ്പർ ഉണ്ടാക്കാനായില്ല. ദയവായി അധ്യായങ്ങൾ മാറ്റി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get examPaperBusy =>
      'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി അൽപ്പസമയത്തിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get examPaperTimeout =>
      'ഇത് പ്രതീക്ഷിച്ചതിലും കൂടുതൽ സമയമെടുക്കുന്നു. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get examPaperSignIn =>
      'ഈ ഉപകരണം ഉപയോഗിക്കാൻ ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get teacherTrainingTitle => 'അധ്യാപന പരിശീലകൻ';

  @override
  String get teacherTrainingSubtitle =>
      'അധ്യാപന ചോദ്യങ്ങൾക്ക് ഉപദേശവും തന്ത്രവും';

  @override
  String get teacherTrainingAction => 'ഉപദേശം നേടുക';

  @override
  String get teacherTrainingEmpty =>
      'ബോധനശാസ്ത്രത്തിൽ അധിഷ്ഠിതമായ തന്ത്രങ്ങൾക്കായി ഒരു അധ്യാപന ചോദ്യം ചോദിക്കൂ.';

  @override
  String get teacherTrainingQuestionLabel => 'നിങ്ങളുടെ ചോദ്യം';

  @override
  String get teacherTrainingQuestionHint =>
      'പാഠ രൂപകൽപ്പന, ക്ലാസ് മുറി പ്രയോഗം അല്ലെങ്കിൽ മൂല്യനിർണ്ണയം എന്നിവയെക്കുറിച്ച് ചോദിക്കൂ.';

  @override
  String get teacherTrainingQuestionPlaceholder =>
      'ഉദാഹരണത്തിന്, 40 പേരുള്ള ക്ലാസിനെ പാഠം മുഴുവൻ എങ്ങനെ ശ്രദ്ധയോടെ നിർത്താം?';

  @override
  String get teacherTrainingQuestionError => 'ദയവായി ഒരു ചോദ്യം നൽകുക.';

  @override
  String get teacherTrainingSubjectLabel => 'വിഷയം';

  @override
  String get teacherTrainingSubjectAny => 'ഏത് വിഷയവും';

  @override
  String get teacherTrainingOptional => 'ഐച്ഛികം';

  @override
  String get teacherTrainingStrategiesTitle => 'തന്ത്രങ്ങൾ';

  @override
  String get teacherTrainingSectionQuestion => 'ചോദ്യം';

  @override
  String get teacherTrainingResultTitle => 'മാർഗനിർദേശ കുറിപ്പുകൾ';

  @override
  String get teacherTrainingNoContent =>
      'അതിന് ഉപദേശമൊന്നും ലഭിച്ചില്ല. ദയവായി കൂടുതൽ വ്യക്തമായ ചോദ്യം പരീക്ഷിക്കുക.';

  @override
  String get teacherTrainingUpgradeTitle => 'ഉയർന്ന പ്ലാൻ ആവശ്യമാണ്';

  @override
  String get teacherTrainingUpgradeBody =>
      'അധ്യാപന പരിശീലകൻ ഉയർന്ന പ്ലാനിന്റെ ഭാഗമാണ്. ചോദിക്കുന്നത് തുടരാൻ ദയവായി അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get teacherTrainingLimitTitle => 'നിങ്ങൾ നിങ്ങളുടെ പരിധിയിൽ എത്തി';

  @override
  String get teacherTrainingLimitBody =>
      'ഇപ്പോഴത്തേക്ക് നിങ്ങൾ അധ്യാപന പരിശീലകനെ ഉപയോഗിച്ചു കഴിഞ്ഞു. ദയവായി പിന്നീട് ശ്രമിക്കുക അല്ലെങ്കിൽ പ്ലാൻ അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get teacherTrainingSeePricing => 'പ്ലാനുകളും വിലയും കാണുക';

  @override
  String get teacherTrainingRephrase =>
      'അതിൽ നിന്ന് ഉപദേശം ഉണ്ടാക്കാനായില്ല. ദയവായി ചോദ്യം മാറ്റിയെഴുതി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get teacherTrainingBusy =>
      'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി അൽപ്പസമയത്തിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.';

  @override
  String teacherTrainingBusyRetryAfter(int seconds) {
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
  String get teacherTrainingTimeout =>
      'ഇത് പ്രതീക്ഷിച്ചതിലും കൂടുതൽ സമയമെടുക്കുന്നു. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get teacherTrainingSignIn =>
      'ഈ ഉപകരണം ഉപയോഗിക്കാൻ ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get parentMessageTitle => 'രക്ഷിതാവിനുള്ള സന്ദേശം';

  @override
  String get parentMessageSubtitle =>
      'രക്ഷിതാവിന്റെ ഭാഷയിൽ വീട്ടിലേക്ക് ഒരു സന്ദേശം തയ്യാറാക്കുക';

  @override
  String get parentMessageAction => 'സന്ദേശം തയ്യാറാക്കുക';

  @override
  String get parentMessageEmpty =>
      'വിദ്യാർത്ഥിയെയും കാരണവും പങ്കിടൂ, രക്ഷിതാവിന്റെ ഭാഷയിൽ കരുതലുള്ള ഒരു സന്ദേശം തയ്യാറാക്കും.';

  @override
  String get parentMessageStudentLabel => 'വിദ്യാർത്ഥിയുടെ പേര്';

  @override
  String get parentMessageStudentPlaceholder =>
      'സന്ദേശം ആരെക്കുറിച്ചാണോ ആ വിദ്യാർത്ഥി';

  @override
  String get parentMessageStudentError => 'ദയവായി വിദ്യാർത്ഥിയുടെ പേര് നൽകുക.';

  @override
  String get parentMessageClassLabel => 'ക്ലാസ്';

  @override
  String get parentMessageClassPlaceholder => 'ഉദാഹരണത്തിന്, ക്ലാസ് 6A';

  @override
  String get parentMessageClassError => 'ദയവായി ക്ലാസ് നൽകുക.';

  @override
  String get parentMessageSubjectLabel => 'വിഷയം';

  @override
  String get parentMessageSubjectHint => 'വിഷയം തിരഞ്ഞെടുക്കുക';

  @override
  String get parentMessageSubjectError => 'ദയവായി ഒരു വിഷയം തിരഞ്ഞെടുക്കുക.';

  @override
  String get parentMessageReasonLabel => 'സന്ദേശത്തിന്റെ കാരണം';

  @override
  String get parentMessageReasonHint => 'ഒരു കാരണം തിരഞ്ഞെടുക്കുക';

  @override
  String get parentMessageReasonError => 'ദയവായി ഒരു കാരണം തിരഞ്ഞെടുക്കുക.';

  @override
  String get parentMessageReasonAbsences => 'ആവർത്തിച്ചുള്ള അസാന്നിധ്യം';

  @override
  String get parentMessageReasonPerformance => 'പഠനത്തിൽ പിന്തുണ';

  @override
  String get parentMessageReasonBehavior => 'ക്ലാസിലെ പെരുമാറ്റം';

  @override
  String get parentMessageReasonPositive => 'പങ്കിടാൻ സന്തോഷവാർത്ത';

  @override
  String get parentMessageAbsentDaysLabel => 'ഹാജരാകാത്ത ദിവസങ്ങൾ';

  @override
  String get parentMessageAbsentDaysHint =>
      'വിദ്യാർത്ഥി തുടർച്ചയായി എത്ര ദിവസം വന്നിട്ടില്ല.';

  @override
  String get parentMessageAbsentDaysPlaceholder => 'ഉദാഹരണത്തിന്, 3';

  @override
  String get parentMessageParentLanguageLabel => 'രക്ഷിതാവിന്റെ ഭാഷ';

  @override
  String get parentMessageParentLanguageHint =>
      'ഈ ഭാഷയിലാണ് സന്ദേശം എഴുതുന്നത്, അത് ആപ്പിന്റെ ഭാഷയിൽ നിന്ന് വ്യത്യസ്തമാകാം.';

  @override
  String get parentMessageParentLanguagePlaceholder =>
      'രക്ഷിതാവിന്റെ ഭാഷ തിരഞ്ഞെടുക്കുക';

  @override
  String get parentMessageParentLanguageError =>
      'ദയവായി രക്ഷിതാവിന്റെ ഭാഷ തിരഞ്ഞെടുക്കുക.';

  @override
  String get parentMessageContextLabel => 'ഇതിന് കാരണമെന്ത്?';

  @override
  String get parentMessageContextHint =>
      'സാഹചര്യത്തെക്കുറിച്ചുള്ള ഒരു ചെറിയ കുറിപ്പ് സന്ദേശം രൂപപ്പെടുത്താൻ സഹായിക്കും.';

  @override
  String get parentMessageContextPlaceholder =>
      'ഉദാഹരണത്തിന്, ഭിന്നസംഖ്യകളുടെ കഴിഞ്ഞ രണ്ടാഴ്ച നഷ്ടപ്പെട്ടു';

  @override
  String get parentMessageNoteLabel => 'പ്രത്യേകമായി പറയാൻ എന്തെങ്കിലുമുണ്ടോ?';

  @override
  String get parentMessageNoteHint =>
      'ഇവിടെ നൽകുന്ന വിശദാംശം സന്ദേശത്തിൽ ചേർക്കും.';

  @override
  String get parentMessageNotePlaceholder =>
      'ഉദാഹരണത്തിന്, ഗ്രൂപ്പ് പ്രവർത്തനത്തിൽ മികവ് കാണിക്കുന്നു';

  @override
  String get parentMessageTeacherNameLabel => 'നിങ്ങളുടെ പേര്';

  @override
  String get parentMessageTeacherNameHint =>
      'സന്ദേശത്തിൽ ഒപ്പിടാൻ ഉപയോഗിക്കും. ഒഴിവാക്കിയാൽ പ്രൊഫൈലിലെ പേര് എടുക്കും.';

  @override
  String get parentMessageTeacherNamePlaceholder => 'ഉദാഹരണത്തിന്, റാവു ടീച്ചർ';

  @override
  String get parentMessageSchoolNameLabel => 'സ്കൂളിന്റെ പേര്';

  @override
  String get parentMessageSchoolNamePlaceholder => 'നിങ്ങളുടെ സ്കൂളിന്റെ പേര്';

  @override
  String get parentMessageOptional => 'ഐച്ഛികം';

  @override
  String parentMessageWordCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count വാക്കുകൾ',
      one: '1 വാക്ക്',
    );
    return '$_temp0';
  }

  @override
  String get parentMessageCopy => 'പകർത്തുക';

  @override
  String get parentMessageShare => 'പങ്കിടുക';

  @override
  String get parentMessageCopied => 'സന്ദേശം പകർത്തി';

  @override
  String get parentMessageSectionMessage => 'സന്ദേശം';

  @override
  String get parentMessageSectionDetails => 'അധിക വിശദാംശങ്ങൾ';

  @override
  String get parentMessageResultTitle => 'രക്ഷിതാവിനുള്ള സന്ദേശം';

  @override
  String get parentMessageNoContent =>
      'അതിന് സന്ദേശമൊന്നും ലഭിച്ചില്ല. ദയവായി കുറച്ചുകൂടി വിവരം ചേർത്ത് വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get parentMessageMissingFields =>
      'ദയവായി വിദ്യാർത്ഥി, ക്ലാസ്, വിഷയം, കാരണം, രക്ഷിതാവിന്റെ ഭാഷ എന്നിവ പൂരിപ്പിച്ച് വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get parentMessageUpgradeTitle => 'ഉയർന്ന പ്ലാൻ ആവശ്യമാണ്';

  @override
  String get parentMessageUpgradeBody =>
      'രക്ഷിതാവിനുള്ള സന്ദേശങ്ങൾ ഉയർന്ന പ്ലാനിന്റെ ഭാഗമാണ്. അവ തയ്യാറാക്കുന്നത് തുടരാൻ ദയവായി അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get parentMessageLimitTitle => 'നിങ്ങൾ നിങ്ങളുടെ പരിധിയിൽ എത്തി';

  @override
  String get parentMessageLimitBody =>
      'ഇപ്പോഴത്തേക്കുള്ള രക്ഷിതാവിനുള്ള സന്ദേശങ്ങൾ നിങ്ങൾ തയ്യാറാക്കി കഴിഞ്ഞു. ദയവായി പിന്നീട് ശ്രമിക്കുക അല്ലെങ്കിൽ പ്ലാൻ അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get parentMessageSeePricing => 'പ്ലാനുകളും വിലയും കാണുക';

  @override
  String get parentMessageBusy =>
      'സഹായി ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി അൽപ്പസമയത്തിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.';

  @override
  String parentMessageBusyRetryAfter(int seconds) {
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
  String get parentMessageTimeout =>
      'ഇത് പ്രതീക്ഷിച്ചതിലും കൂടുതൽ സമയമെടുക്കുന്നു. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get parentMessageSignIn =>
      'ഈ ഉപകരണം ഉപയോഗിക്കാൻ ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get assessTitle => 'അസൈൻമെന്റ് വിലയിരുത്തുക';

  @override
  String get assessSubtitle =>
      'ഫോട്ടോയിൽ നിന്ന് വിദ്യാർത്ഥിയുടെ കൈയെഴുത്ത് വിലയിരുത്തുക';

  @override
  String get assessEmpty =>
      'വിദ്യാർത്ഥിയുടെ ജോലിയുടെ ഫോട്ടോ ചേർത്ത് വിലയിരുത്തുക ടാപ്പ് ചെയ്യുക.';

  @override
  String get assessSubmit => 'വിലയിരുത്തുക';

  @override
  String get assessImageLabel => 'വിദ്യാർത്ഥിയുടെ ജോലിയുടെ ഫോട്ടോ';

  @override
  String get assessImageHint => 'പേജ് മുഴുവൻ വരുന്ന വ്യക്തമായ ഫോട്ടോ എടുക്കുക.';

  @override
  String get assessImageError =>
      'ദയവായി വിദ്യാർത്ഥിയുടെ ജോലിയുടെ ഫോട്ടോ ചേർക്കുക.';

  @override
  String get assessModeLabel => 'നിങ്ങൾക്ക് എന്താണ് വേണ്ടത്?';

  @override
  String get assessModeHint =>
      'പൂർണ്ണ വിലയിരുത്തൽ ജോലി വായിച്ച് മാർക്ക് നൽകുന്നു. വായന മാത്രം എന്നത് എഴുതിയത് മാത്രം നൽകുന്നു. എഴുതിയത് വിലയിരുത്തുക എന്നത് നിങ്ങൾ ഒട്ടിക്കുന്ന വാചകത്തിന് മാർക്ക് നൽകുന്നു.';

  @override
  String get assessModeFull => 'പൂർണ്ണ വിലയിരുത്തൽ';

  @override
  String get assessModeTranscribe => 'വായന മാത്രം';

  @override
  String get assessModeScore => 'എഴുതിയത് വിലയിരുത്തുക';

  @override
  String get assessTranscriptLabel => 'തിരുത്തിയ വാചകം';

  @override
  String get assessTranscriptHint =>
      'ഫോട്ടോ വീണ്ടും വായിക്കുന്നതിന് പകരം വിലയിരുത്താൻ തിരുത്തിയ വാചകം ഒട്ടിക്കുക.';

  @override
  String get assessTranscriptPlaceholder =>
      'വിദ്യാർത്ഥിയുടെ തിരുത്തിയ ഉത്തരങ്ങൾ ടൈപ്പ് ചെയ്യുക അല്ലെങ്കിൽ ഒട്ടിക്കുക';

  @override
  String get assessOptional => 'ഐച്ഛികം';

  @override
  String get assessRubricNote =>
      'റൂബ്രിക് ഇല്ലെങ്കിൽ, പൊതുവായ ഒരു റൂബ്രിക് അനുസരിച്ചാണ് വിലയിരുത്തൽ: ഗ്രാഹ്യം, കൃത്യത, അവതരണം, പൂർത്തീകരണം.';

  @override
  String get assessPrivacyNote =>
      'വിലയിരുത്തലിനായി വിദ്യാർത്ഥിയുടെ പേര് ഒരിക്കലും അയയ്ക്കില്ല.';

  @override
  String get assessScoreLabel => 'മൊത്തം സ്കോർ';

  @override
  String get assessScoreOutOf => 'പരമാവധി 100';

  @override
  String assessPoints(String earned, String possible) {
    return '$possible-ൽ $earned പോയിന്റ്';
  }

  @override
  String assessConfidence(String percent) {
    return 'ആത്മവിശ്വാസം $percent%';
  }

  @override
  String assessRubricUsed(String title) {
    return 'വിലയിരുത്തിയത്: $title';
  }

  @override
  String get assessLowConfidence => 'കുറഞ്ഞ ആത്മവിശ്വാസം';

  @override
  String get assessTranscriptSection => 'വിദ്യാർത്ഥി എഴുതിയത്';

  @override
  String get assessCriteriaSection => 'മാനദണ്ഡം തിരിച്ചുള്ള സ്കോർ';

  @override
  String assessCriterionPoints(String points, String max) {
    return '$points / $max';
  }

  @override
  String get assessStrengthsSection => 'മികവുകൾ';

  @override
  String get assessImprovementsSection => 'മെച്ചപ്പെടുത്താൻ';

  @override
  String get assessNextStepsSection => 'അടുത്ത ഘട്ടങ്ങൾ';

  @override
  String get assessTeacherNoteSection => 'വിദ്യാർത്ഥിക്കുള്ള കുറിപ്പ്';

  @override
  String get assessWarningsSection => 'ദയവായി പരിശോധിക്കുക';

  @override
  String get assessWarningBlank =>
      'ഈ പേജ് ശൂന്യമായി തോന്നുന്നു. ദയവായി ഫോട്ടോ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get assessWarningLowContrast =>
      'ഫോട്ടോ മങ്ങിയതാണ്. കൂടുതൽ വെളിച്ചമുള്ള ഫോട്ടോ കൂടുതൽ കൃത്യമായി വിലയിരുത്തും.';

  @override
  String get assessWarningPartial =>
      'ജോലിയുടെ ഒരു ഭാഗം മാത്രമേ വായിക്കാൻ കഴിഞ്ഞുള്ളൂ.';

  @override
  String get assessWarningLanguageMismatch =>
      'എഴുത്ത് പ്രതീക്ഷിച്ചതിൽ നിന്ന് വ്യത്യസ്തമായ ഭാഷയിലാകാം.';

  @override
  String get assessNoContent =>
      'വിലയിരുത്തലൊന്നും ലഭിച്ചില്ല. ദയവായി വ്യക്തമായ ഫോട്ടോ പരീക്ഷിക്കുക.';

  @override
  String get assessSignIn =>
      'അസൈൻമെന്റ് വിലയിരുത്താൻ ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get assessUpgradeTitle => 'ഉയർന്ന പ്ലാൻ ആവശ്യമാണ്';

  @override
  String get assessUpgradeBody =>
      'കൈയെഴുത്ത് വിലയിരുത്തുന്നത് ഉയർന്ന പ്ലാനിന്റെ ഭാഗമാണ്. വിലയിരുത്തൽ തുടരാൻ അപ്ഗ്രേഡ് ചെയ്യുക.';

  @override
  String get assessDailyLimitTitle =>
      'ഇന്നത്തേക്കുള്ള നിങ്ങളുടെ എല്ലാ വിലയിരുത്തലുകളും തീർന്നു';

  @override
  String get assessDailyLimitBody =>
      'നിങ്ങളുടെ പ്ലാനിൽ ഓരോ ദിവസവും ഒരു നിശ്ചിത എണ്ണം വിലയിരുത്തലുകൾ ഉൾപ്പെടുന്നു. അവ നാളെ വീണ്ടും ആരംഭിക്കും, അല്ലെങ്കിൽ ഉയർന്ന പ്ലാനിൽ പരിധി ഉയർത്താം.';

  @override
  String get assessLimitTitle => 'നിങ്ങൾ വിലയിരുത്തൽ പരിധിയിൽ എത്തി';

  @override
  String get assessLimitBody =>
      'നിങ്ങളുടെ പ്ലാനിലെ എല്ലാ വിലയിരുത്തലുകളും ഉപയോഗിച്ചു. അവ അടുത്ത മാസം വീണ്ടും ആരംഭിക്കും, അല്ലെങ്കിൽ ഉയർന്ന പ്ലാനിൽ പരിധി ഉയർത്താം.';

  @override
  String get assessSeePricing => 'പ്ലാനുകൾ കാണുക';

  @override
  String get assessBusy =>
      'വിലയിരുത്തൽ മോഡൽ ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി ഒരു മിനിറ്റിനുള്ളിൽ വീണ്ടും ശ്രമിക്കുക.';

  @override
  String assessBusyRetryAfter(int seconds) {
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
  String get assessTimeout =>
      'വിലയിരുത്തലിന് പതിവിലും കൂടുതൽ സമയമെടുക്കുന്നു. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get assessRephrase =>
      'ഫോട്ടോ വിലയിരുത്താൻ കഴിഞ്ഞില്ല. ദയവായി വ്യക്തമായ ഫോട്ടോ വീണ്ടും അപ്‌ലോഡ് ചെയ്യുക.';

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
      'സ്വാഗതം, ടീച്ചർ. നിങ്ങളുടെ ഭാഷയിൽ സംസാരിക്കൂ, ഞാൻ നിങ്ങളുടെ ജോലി തയ്യാറാക്കാം.';

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
    return 'എല്ലാ $count എണ്ണവും കാണുക';
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
  String get inboxComposerTooLong =>
      'സന്ദേശം വളരെ നീളമുള്ളതാണ്. ദയവായി ചുരുക്കുക.';

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

  @override
  String get actionShare => 'പങ്കിടുക';

  @override
  String get resultSaveToLibrary => 'ലൈബ്രറിയിലേക്ക് സേവ് ചെയ്യുക';

  @override
  String get resultSaving => 'സേവ് ചെയ്യുന്നു';

  @override
  String get resultSaved => 'നിങ്ങളുടെ ലൈബ്രറിയിൽ സേവ് ചെയ്തു';

  @override
  String get resultSaveFailedTitle => 'സേവ് ചെയ്യാനായില്ല';

  @override
  String get resultSaveFailedBody =>
      'ഇത് നിങ്ങളുടെ ലൈബ്രറിയിൽ സേവ് ചെയ്യാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get resultSaveRetry => 'വീണ്ടും സേവ് ചെയ്യാൻ ശ്രമിക്കുക';

  @override
  String get resultShareFailed =>
      'പങ്കിടാനായില്ല. പകരം വാചകം ക്ലിപ്പ്ബോർഡിലേക്ക് പകർത്തി.';
}
