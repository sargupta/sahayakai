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
  String get actionSignIn => 'সাইন ইন করুন';

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
  String get splashFailedTitle => 'অ্যাপটি চালু করা যায়নি';

  @override
  String get splashFailedBody =>
      'অনুগ্রহ করে আপনার সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';

  @override
  String get loginTitle => 'SahayakAI-তে স্বাগতম';

  @override
  String get loginSubtitle =>
      'পাঠ পরিকল্পনা, কুইজ ও আরও অনেক কিছুর জন্য সাইন ইন করুন।';

  @override
  String get loginGoogle => 'Google দিয়ে চালিয়ে যান';

  @override
  String get loginPrivacyNote =>
      'আমরা আপনার Google অ্যাকাউন্ট শুধু সাইন ইন করার জন্য ব্যবহার করি। আপনার কাজ আপনারই থাকে।';

  @override
  String get loginLanguagePrompt => 'আপনার ভাষা বেছে নিন';

  @override
  String get loginLanguageHint =>
      'SahayakAI আপনার ভাষায় কাজ করে, এবং আপনার শিক্ষণ উপকরণও সেই ভাষাতেই লেখে।';

  @override
  String get loginValueLessons => 'মিনিটেই সম্পূর্ণ পাঠ পরিকল্পনা তৈরি করুন';

  @override
  String get loginValueQuizzes => 'তিনটি কঠিনতা স্তরে কুইজ তৈরি করুন';

  @override
  String get loginValueAnswers =>
      'আপনার ভাষায়, শ্রেণিকক্ষের যেকোনো প্রশ্নের উত্তর দিন';

  @override
  String get onboardingTitle => 'SahayakAI সেট আপ করুন';

  @override
  String get onboardingSkip => 'আপাতত এড়িয়ে যান';

  @override
  String onboardingStepLabel(int current, int total) {
    return '$totalটির মধ্যে ধাপ $current';
  }

  @override
  String get onboardingBack => 'পেছনে';

  @override
  String get onboardingNext => 'পরবর্তী';

  @override
  String get onboardingSaveAndContinue => 'সংরক্ষণ করে এগিয়ে যান';

  @override
  String get onboardingFinish => 'আমার ড্যাশবোর্ডে যান';

  @override
  String get onboardingLanguageTitle => 'আপনি কোন ভাষায় পড়ান?';

  @override
  String get onboardingLanguageBody =>
      'আপনার বেছে নেওয়া ভাষাতেই পাঠ পরিকল্পনা, কুইজ ও উত্তর তৈরি হবে। আপনি যেকোনো সময় এটি বদলাতে পারেন।';

  @override
  String get onboardingProfileTitle => 'আপনার শ্রেণিকক্ষ সম্পর্কে আমাদের বলুন';

  @override
  String get onboardingProfileBody =>
      'প্রতিটি ঘর ঐচ্ছিক। আপনি যা জানান, তা দিয়ে আপনার উপকরণ আপনার বোর্ড, শ্রেণি ও রাজ্যের সঙ্গে মিলিয়ে তৈরি করা হয়।';

  @override
  String get onboardingReadyTitle => 'আপনি শুরু করার জন্য প্রস্তুত';

  @override
  String get onboardingReadyBody =>
      'আপনার পাঠ পরিকল্পনা, কুইজ ও উত্তর এর সঙ্গে মিলিয়ে তৈরি হবে। পরে যেকোনো সময় আপনি প্রোফাইল থেকে এটি বদলাতে পারেন।';

  @override
  String get onboardingSaveFailed =>
      'আমরা আপনার প্রোফাইল সংরক্ষণ করতে পারিনি। আপনি এখন এগিয়ে যেতে পারেন এবং পরে প্রোফাইল থেকে এটি যোগ করতে পারেন।';

  @override
  String get onboardingSaveSignIn =>
      'প্রোফাইল সংরক্ষণ করতে অনুগ্রহ করে আবার সাইন ইন করুন। আপনি এখন এগিয়ে যেতে পারেন এবং পরে এটি যোগ করতে পারেন।';

  @override
  String get dashboardGreeting => 'আবার স্বাগতম';

  @override
  String dashboardGreetingNamed(String name) {
    return 'আবার স্বাগতম, $name';
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
  String get readAloudListen => 'শুনুন';

  @override
  String get readAloudStop => 'থামান';

  @override
  String get readAloudError =>
      'অডিওটি চালানো যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String voiceResultReady(String tool) {
    return 'আপনার $tool প্রস্তুত।';
  }

  @override
  String voiceResultReadyWithTopic(String tool, String topic) {
    return '$topic নিয়ে আপনার $tool প্রস্তুত।';
  }

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
  String get dashboardRecentTitle => 'সাম্প্রতিক কাজ';

  @override
  String get dashboardRecentEmpty =>
      'আপনি যা তৈরি করবেন তা এখানে সংরক্ষিত থাকবে, আবার খোলার জন্য প্রস্তুত।';

  @override
  String get dashboardRecentFailed =>
      'আমরা আপনার সাম্প্রতিক কাজ খুলতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get dashboardRecentSignedOut =>
      'আপনার সাম্প্রতিক কাজ দেখতে সাইন ইন করুন।';

  @override
  String get dashboardUntitled => 'শিরোনামহীন';

  @override
  String get dashboardSetupTitle => 'আপনার প্রোফাইল সম্পূর্ণ করুন';

  @override
  String get dashboardSetupBody =>
      'আপনার স্কুল ও শ্রেণিগুলি যোগ করুন, তাহলে প্রতিটি পাঠ পরিকল্পনা ও কুইজ আপনার শ্রেণিকক্ষের উপযোগী হয়ে আসবে।';

  @override
  String get dashboardSetupAction => 'আমার প্রোফাইল সেট আপ করুন';

  @override
  String get dashboardSetupDismiss => 'এখন নয়';

  @override
  String get contentTypeLessonPlan => 'পাঠ পরিকল্পনা';

  @override
  String get contentTypeQuiz => 'কুইজ';

  @override
  String get contentTypeWorksheet => 'ওয়ার্কশিট';

  @override
  String get contentTypeVisualAid => 'চিত্র সহায়ক';

  @override
  String get contentTypeRubric => 'রুব্রিক';

  @override
  String get contentTypeMicroLesson => 'মাইক্রো পাঠ';

  @override
  String get contentTypeVirtualFieldTrip => 'ভার্চুয়াল ফিল্ড ট্রিপ';

  @override
  String get contentTypeInstantAnswer => 'তাৎক্ষণিক উত্তর';

  @override
  String get contentTypeTeacherTraining => 'শিক্ষক প্রশিক্ষণ';

  @override
  String get contentTypeExamPaper => 'প্রশ্নপত্র';

  @override
  String get contentTypeAssessment => 'মূল্যায়ন';

  @override
  String get contentTypeAssessmentSubmission => 'স্ক্যান করা মূল্যায়ন';

  @override
  String get contentTypeUnknown => 'সংরক্ষিত কাজ';

  @override
  String get libraryTitle => 'আমার লাইব্রেরি';

  @override
  String get librarySectionSaved => 'সংরক্ষিত কাজ';

  @override
  String get libraryEmpty =>
      'আপনার সংরক্ষিত পাঠ পরিকল্পনা ও কুইজ এখানে দেখা যাবে।';

  @override
  String get libraryEmptyAction => 'একটি পাঠ পরিকল্পনা তৈরি করুন';

  @override
  String get librarySignedOut => 'আপনার সংরক্ষিত কাজ দেখতে সাইন ইন করুন।';

  @override
  String get libraryLoadFailed => 'আপনার লাইব্রেরি লোড করা যায়নি।';

  @override
  String get libraryNewestOnly => 'আপনার সাম্প্রতিকতম 20টি আইটেম দেখানো হচ্ছে।';

  @override
  String get libraryFilterAll => 'সব';

  @override
  String get libraryFilterEmpty => 'এই ধরনের কোনো সংরক্ষিত আইটেম এখনও নেই।';

  @override
  String get libraryDetailTitle => 'সংরক্ষিত আইটেম';

  @override
  String libraryDetailSavedOn(String date) {
    return '$date-এ সংরক্ষিত';
  }

  @override
  String get libraryDetailSignedOut => 'আপনার সংরক্ষিত কাজ খুলতে সাইন ইন করুন।';

  @override
  String get libraryDetailNotFound => 'এই আইটেমটি আর আপনার লাইব্রেরিতে নেই।';

  @override
  String get libraryDetailLoadFailed =>
      'আমরা এই সংরক্ষিত আইটেমটি খুলতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String libraryDetailReady(String type) {
    return 'আপনি আপনার সংরক্ষিত $type দেখছেন।';
  }

  @override
  String get profileTitle => 'প্রোফাইল';

  @override
  String get lessonPlanTitle => 'পাঠ পরিকল্পনা';

  @override
  String get lessonPlanIncludeLabel => 'অন্তর্ভুক্ত করুন';

  @override
  String get lessonPlanIncludeActivity => 'কার্যকলাপ';

  @override
  String get lessonPlanIncludeBoardWork => 'বোর্ডের কাজ';

  @override
  String get lessonPlanIncludeHomework => 'বাড়ির কাজ';

  @override
  String get lessonPlanIncludeStoryHook => 'গল্পের সূচনা';

  @override
  String get lessonPlanNcertTitle => 'NCERT-সঙ্গতিপূর্ণ';

  @override
  String lessonPlanNcertBody(String grade) {
    return 'আপনার পরিকল্পনা $grade-এর NCERT পাঠ্যক্রমের সাথে যাচাই করা হয়।';
  }

  @override
  String get lessonPlanSubtitle => 'সম্পূর্ণ 5E পাঠ পরিকল্পনা করুন';

  @override
  String get lessonPlanEmpty =>
      'একটি টপিক লিখে তৈরি করুন-এ ট্যাপ করলে 5E পাঠ পরিকল্পনা তৈরি হবে।';

  @override
  String get lessonPlanTopicLabel => 'টপিক';

  @override
  String get lessonPlanTopicHint => 'উদাহরণস্বরূপ, সালোকসংশ্লেষণ';

  @override
  String get lessonPlanTopicError =>
      'অনুগ্রহ করে পরিকল্পনার জন্য একটি টপিক লিখুন।';

  @override
  String get lessonPlanGradeLabel => 'শ্রেণি স্তর';

  @override
  String get lessonPlanSubjectLabel => 'বিষয়';

  @override
  String get lessonPlanSubjectAny => 'যেকোনো বিষয়';

  @override
  String get lessonPlanResourceLabel => 'শ্রেণিকক্ষের উপকরণ';

  @override
  String get lessonPlanResourceLow => 'কম';

  @override
  String get lessonPlanResourceMedium => 'মাঝারি';

  @override
  String get lessonPlanResourceHigh => 'বেশি';

  @override
  String get lessonPlanDifficultyLabel => 'কঠিনতা';

  @override
  String get lessonPlanDifficultyRemedial => 'বাড়তি সহায়তা';

  @override
  String get lessonPlanDifficultyStandard => 'সাধারণ';

  @override
  String get lessonPlanDifficultyAdvanced => 'উন্নত';

  @override
  String get lessonPlanRuralLabel => 'স্থানীয়, দৈনন্দিন উদাহরণ ব্যবহার করুন';

  @override
  String get lessonPlanRuralHint =>
      'গ্রামীণ ও পরিচিত স্থানীয় পরিবেশে কার্যকলাপগুলি সাজান।';

  @override
  String get lessonPlanOptional => 'ঐচ্ছিক';

  @override
  String get lessonPlanObjectives => 'শিখন উদ্দেশ্য';

  @override
  String get lessonPlanVocabulary => 'মূল শব্দভাণ্ডার';

  @override
  String get lessonPlanMaterials => 'উপকরণ';

  @override
  String get lessonPlanActivities => '5E কার্যকলাপ';

  @override
  String get lessonPlanAssessment => 'মূল্যায়ন';

  @override
  String get lessonPlanHomework => 'বাড়ির কাজ';

  @override
  String get lessonPlanTeacherTip => 'শিক্ষকের জন্য পরামর্শ';

  @override
  String get lessonPlanUnderstandingCheck => 'বোঝা যাচাই করুন';

  @override
  String get lessonPlanNoteLabel => 'শুরু করার আগে একটি কথা';

  @override
  String get lessonPlanUpgradeTitle => 'একটি উচ্চতর প্ল্যান প্রয়োজন';

  @override
  String get lessonPlanUpgradeBody =>
      'পাঠ পরিকল্পনা একটি উচ্চতর প্ল্যানের অংশ। পরিকল্পনা তৈরি চালিয়ে যেতে অনুগ্রহ করে আপগ্রেড করুন।';

  @override
  String get lessonPlanLimitTitle => 'আপনি আপনার সীমায় পৌঁছেছেন';

  @override
  String get lessonPlanLimitBody =>
      'আপনি আপাতত আপনার পাঠ পরিকল্পনা ব্যবহার করে ফেলেছেন। অনুগ্রহ করে পরে আবার চেষ্টা করুন বা আপনার প্ল্যান আপগ্রেড করুন।';

  @override
  String get lessonPlanSeePricing => 'প্ল্যান ও মূল্য দেখুন';

  @override
  String get lessonPlanRephrase =>
      'আমরা তা থেকে পরিকল্পনা তৈরি করতে পারিনি। অনুগ্রহ করে টপিকটি আবার লিখে চেষ্টা করুন।';

  @override
  String get lessonPlanBusy =>
      'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।';

  @override
  String get lessonPlanTimeout =>
      'এতে প্রত্যাশার চেয়ে বেশি সময় লাগছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get lessonPlanSignIn =>
      'এই সরঞ্জামটি ব্যবহার করতে অনুগ্রহ করে আবার সাইন ইন করুন।';

  @override
  String get quizTitle => 'কুইজ';

  @override
  String get quizSubtitle => 'তিনটি কঠিনতা স্তরে কুইজ তৈরি করুন';

  @override
  String get quizEmpty =>
      'একটি টপিক লিখে তৈরি করুন-এ ট্যাপ করলে কুইজ তৈরি হবে।';

  @override
  String get quizTopicLabel => 'টপিক';

  @override
  String get quizTopicHint => 'উদাহরণস্বরূপ, ভগ্নাংশ';

  @override
  String get quizTopicError => 'অনুগ্রহ করে কুইজের জন্য একটি টপিক লিখুন।';

  @override
  String get quizNumQuestionsLabel => 'প্রশ্নের সংখ্যা';

  @override
  String get quizFewerQuestions => 'কম প্রশ্ন';

  @override
  String get quizMoreQuestions => 'বেশি প্রশ্ন';

  @override
  String get quizTypesLabel => 'প্রশ্নের ধরন';

  @override
  String get quizTypesError => 'অনুগ্রহ করে অন্তত একটি প্রশ্নের ধরন বেছে নিন।';

  @override
  String get quizTypeMultipleChoice => 'বহুনির্বাচনি';

  @override
  String get quizTypeFillInTheBlanks => 'শূন্যস্থান পূরণ';

  @override
  String get quizTypeShortAnswer => 'সংক্ষিপ্ত উত্তর';

  @override
  String get quizTypeTrueFalse => 'সত্য না মিথ্যা';

  @override
  String get quizGradeLabel => 'শ্রেণি স্তর';

  @override
  String get quizGradeAny => 'যেকোনো শ্রেণি';

  @override
  String get quizSubjectLabel => 'বিষয়';

  @override
  String get quizSubjectAny => 'যেকোনো বিষয়';

  @override
  String get quizDifficultyLabel => 'কঠিনতা';

  @override
  String get quizDifficultyHint =>
      'সব স্তরে রাখলে সহজ, মাঝারি ও কঠিন: তিনটি সংস্করণই পাবেন।';

  @override
  String get quizDifficultyAll => 'সব স্তর';

  @override
  String get quizDifficultyEasy => 'সহজ';

  @override
  String get quizDifficultyMedium => 'মাঝারি';

  @override
  String get quizDifficultyHard => 'কঠিন';

  @override
  String get quizBloomsLabel => 'চিন্তন দক্ষতা';

  @override
  String get quizBloomsHint =>
      'প্রশ্নগুলিতে কোন ধরনের চিন্তা চাওয়া হবে তা বেছে নিন।';

  @override
  String get quizOptional => 'ঐচ্ছিক';

  @override
  String quizQuestionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি প্রশ্ন',
      one: '1টি প্রশ্ন',
    );
    return '$_temp0';
  }

  @override
  String get quizShowAnswer => 'উত্তর দেখান';

  @override
  String get quizHideAnswer => 'উত্তর লুকান';

  @override
  String get quizShowAllAnswers => 'সব উত্তর দেখান';

  @override
  String get quizHideAllAnswers => 'সব উত্তর লুকান';

  @override
  String get quizCorrectAnswer => 'সঠিক উত্তর';

  @override
  String get quizExplanation => 'কেন';

  @override
  String get quizTeacherInstructions => 'ক্লাসে কীভাবে চালাবেন';

  @override
  String get quizNoteLabel => 'শুরু করার আগে একটি কথা';

  @override
  String get quizNoQuestions =>
      'সেই টপিকের জন্য কোনো প্রশ্ন আসেনি। অনুগ্রহ করে অন্য কোনো টপিক চেষ্টা করুন।';

  @override
  String get quizUpgradeTitle => 'একটি উচ্চতর প্ল্যান প্রয়োজন';

  @override
  String get quizUpgradeBody =>
      'কুইজ তৈরি একটি উচ্চতর প্ল্যানের অংশ। কুইজ তৈরি চালিয়ে যেতে অনুগ্রহ করে আপগ্রেড করুন।';

  @override
  String get quizLimitTitle => 'আপনি আপনার সীমায় পৌঁছেছেন';

  @override
  String get quizLimitBody =>
      'আপনি আপাতত আপনার কুইজ ব্যবহার করে ফেলেছেন। অনুগ্রহ করে পরে আবার চেষ্টা করুন বা আপনার প্ল্যান আপগ্রেড করুন।';

  @override
  String get quizSeePricing => 'প্ল্যান ও মূল্য দেখুন';

  @override
  String get quizRephrase =>
      'আমরা তা থেকে কুইজ তৈরি করতে পারিনি। অনুগ্রহ করে টপিকটি আবার লিখে চেষ্টা করুন।';

  @override
  String get quizBusy =>
      'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।';

  @override
  String get quizTimeout =>
      'এতে প্রত্যাশার চেয়ে বেশি সময় লাগছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get quizSignIn =>
      'এই সরঞ্জামটি ব্যবহার করতে অনুগ্রহ করে আবার সাইন ইন করুন।';

  @override
  String get instantAnswerTitle => 'তাৎক্ষণিক উত্তর';

  @override
  String get instantAnswerSubtitle => 'শ্রেণিকক্ষের যেকোনো প্রশ্ন করুন';

  @override
  String get instantAnswerAction => 'উত্তর নিন';

  @override
  String get instantAnswerEmpty => 'একটি প্রশ্ন করে উত্তর নিন-এ ট্যাপ করুন।';

  @override
  String get instantAnswerQuestionLabel => 'আপনার প্রশ্ন';

  @override
  String get instantAnswerQuestionHint =>
      'উদাহরণস্বরূপ, চাঁদের আকার বদলায় কেন?';

  @override
  String get instantAnswerQuestionError => 'অনুগ্রহ করে একটি প্রশ্ন লিখুন।';

  @override
  String get instantAnswerGradeLabel => 'শ্রেণি স্তর';

  @override
  String get instantAnswerGradeAny => 'যেকোনো শ্রেণি';

  @override
  String get instantAnswerSubjectLabel => 'বিষয়';

  @override
  String get instantAnswerSubjectAny => 'যেকোনো বিষয়';

  @override
  String get instantAnswerOptional => 'ঐচ্ছিক';

  @override
  String get instantAnswerVideoTitle => 'সম্পর্কিত একটি ভিডিও দেখুন';

  @override
  String get instantAnswerVideoBody => 'অ্যাপের বাইরে, আপনার ব্রাউজারে খোলে।';

  @override
  String get instantAnswerNoAnswer =>
      'সেই প্রশ্নের কোনো উত্তর আসেনি। অনুগ্রহ করে এটি আবার লিখে চেষ্টা করুন।';

  @override
  String get instantAnswerSeePricing => 'প্ল্যান ও মূল্য দেখুন';

  @override
  String get instantAnswerDailyLimitTitle => 'আজকের জন্য আপনার সব প্রশ্ন শেষ';

  @override
  String get instantAnswerDailyLimitBody =>
      'আপনার প্ল্যানে প্রতিদিন একটি নির্দিষ্ট সংখ্যক তাৎক্ষণিক উত্তর অন্তর্ভুক্ত। আপনার প্রশ্ন আগামীকাল আবার শুরু হবে, অথবা আপনি উচ্চতর প্ল্যানে দৈনিক সীমা বাড়াতে পারেন।';

  @override
  String get instantAnswerLimitTitle => 'আপনি আপনার সীমায় পৌঁছেছেন';

  @override
  String get instantAnswerLimitBody =>
      'আপনি এই মাসের তাৎক্ষণিক উত্তর ব্যবহার করে ফেলেছেন। আপনার প্রশ্ন পরের মাসে আবার শুরু হবে, অথবা আপনি উচ্চতর প্ল্যানে সীমা বাড়াতে পারেন।';

  @override
  String get instantAnswerUpgradeTitle => 'একটি উচ্চতর প্ল্যান প্রয়োজন';

  @override
  String get instantAnswerUpgradeBody =>
      'তাৎক্ষণিক উত্তর একটি উচ্চতর প্ল্যানের অংশ। প্রশ্ন করা চালিয়ে যেতে অনুগ্রহ করে আপগ্রেড করুন।';

  @override
  String get instantAnswerRephrase =>
      'আমরা এর উত্তর দিতে পারিনি। অনুগ্রহ করে প্রশ্নটি আবার লিখে চেষ্টা করুন।';

  @override
  String get instantAnswerBusy =>
      'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।';

  @override
  String instantAnswerBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে প্রায় $seconds সেকেন্ড পরে আবার চেষ্টা করুন।',
      one:
          'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে প্রায় 1 সেকেন্ড পরে আবার চেষ্টা করুন।',
    );
    return '$_temp0';
  }

  @override
  String get instantAnswerTimeout =>
      'এতে প্রত্যাশার চেয়ে বেশি সময় লাগছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get instantAnswerSignIn =>
      'এই সরঞ্জামটি ব্যবহার করতে অনুগ্রহ করে আবার সাইন ইন করুন।';

  @override
  String get settingsTitle => 'সেটিংস';

  @override
  String get settingsAppearanceTitle => 'চেহারা';

  @override
  String get settingsThemeSystem => 'আমার ডিভাইস অনুযায়ী';

  @override
  String get settingsThemeLight => 'উজ্জ্বল';

  @override
  String get settingsThemeDark => 'গাঢ়';

  @override
  String get settingsLanguageHint =>
      'অ্যাপের ভাষা এবং আপনার শিক্ষণ উপকরণ যে ভাষায় লেখা হবে, দুটিই এটি ঠিক করে।';

  @override
  String get settingsNotificationsTitle => 'বিজ্ঞপ্তি';

  @override
  String get settingsNotificationsLabel => 'মনে করানো ও আপডেট';

  @override
  String get settingsNotificationsHint =>
      'নতুন শিক্ষণ সরঞ্জাম ও আপনার সংরক্ষিত কাজের খবর পান।';

  @override
  String get settingsVoiceModeTitle => 'ভয়েস মোড';

  @override
  String get settingsVoiceModeLabel => 'লাইভ ভয়েস (বিটা)';

  @override
  String get settingsVoiceModeHint =>
      'VIDYA-র সঙ্গে সরাসরি কথা বলুন। বন্ধ থাকলে VIDYA আগে শোনে, তারপর এক এক করে উত্তর দেয়।';

  @override
  String get settingsProfileTitle => 'শিক্ষণ প্রোফাইল';

  @override
  String get settingsProfileHint =>
      'এটি আপনার উপকরণ আপনার বোর্ড ও শ্রেণিকক্ষের সঙ্গে মেলাতে সাহায্য করে।';

  @override
  String get settingsBoardLabel => 'শিক্ষা বোর্ড';

  @override
  String get settingsBoardNone => 'সেট করা নেই';

  @override
  String get settingsQualificationsLabel => 'যোগ্যতা';

  @override
  String get settingsQualificationsHint =>
      'আপনার যে যে যোগ্যতা আছে, সবগুলি বেছে নিন।';

  @override
  String get settingsAdminRoleLabel => 'প্রশাসনিক ভূমিকা';

  @override
  String get settingsAdminRoleNone => 'সেট করা নেই';

  @override
  String get settingsRoleHod => 'বিভাগীয় প্রধান (HoD)';

  @override
  String get settingsRoleCoordinator => 'একাডেমিক সমন্বয়ক';

  @override
  String get settingsRoleExamController => 'পরীক্ষা নিয়ন্ত্রক';

  @override
  String get settingsRoleVicePrincipal => 'উপাধ্যক্ষ';

  @override
  String get settingsRolePrincipal => 'অধ্যক্ষ';

  @override
  String get settingsRoleNone => 'শিক্ষক, কোনো প্রশাসনিক ভূমিকা নেই';

  @override
  String get settingsSaveProfile => 'প্রোফাইল সংরক্ষণ করুন';

  @override
  String get settingsProfileSaved => 'আপনার শিক্ষণ প্রোফাইল সংরক্ষিত হয়েছে।';

  @override
  String get settingsSaveFailed =>
      'আমরা আপনার প্রোফাইল সংরক্ষণ করতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get settingsSignedOutTitle => 'আপনি সাইন আউট অবস্থায় আছেন';

  @override
  String get settingsSignedOutBody =>
      'আপনার শিক্ষণ প্রোফাইল ও অ্যাকাউন্ট পরিচালনা করতে সাইন ইন করুন। যাই হোক, আপনার ভাষা ও চেহারার পছন্দ এই ডিভাইসেই সংরক্ষিত থাকে।';

  @override
  String get settingsSignIn => 'সাইন ইন করুন';

  @override
  String get settingsDangerTitle => 'অ্যাকাউন্ট মুছুন';

  @override
  String get settingsDangerBody =>
      'এতে আপনার অ্যাকাউন্ট বন্ধ হবে এবং সংরক্ষিত কাজ সরে যাবে। চূড়ান্তভাবে মুছে ফেলার আগে সবকিছু রপ্তানি করতে আপনি 30 দিন সময় পাবেন।';

  @override
  String get settingsDeleteAction => 'অ্যাকাউন্ট মুছুন';

  @override
  String get settingsDeleteDialogTitle => 'আপনার অ্যাকাউন্ট মুছবেন?';

  @override
  String get settingsDeleteDialogBody =>
      'আপনার পাঠ পরিকল্পনা, কুইজ ও প্রোফাইল মুছে ফেলার জন্য নির্ধারিত হবে। কাজ রপ্তানি করতে আপনি 30 দিন সময় পাবেন।';

  @override
  String settingsDeleteConfirmPrompt(String word) {
    return 'নিশ্চিত করতে নিচে $word টাইপ করুন।';
  }

  @override
  String get settingsDeleteConfirmLabel => 'নিশ্চিতকরণ';

  @override
  String get settingsDeleteCancel => 'আমার অ্যাকাউন্ট রাখুন';

  @override
  String get settingsDeleteConfirm => 'অ্যাকাউন্ট মুছুন';

  @override
  String get settingsDeleteScheduled =>
      'আপনার অ্যাকাউন্ট মুছে ফেলার জন্য নির্ধারিত হয়েছে। কাজ রপ্তানি করতে আপনি 30 দিন সময় পাবেন।';

  @override
  String get settingsDeleteSuccessTitle =>
      'অ্যাকাউন্ট মুছে ফেলার জন্য নির্ধারিত';

  @override
  String get settingsExportDataAction => 'আমার তথ্য রপ্তানি করুন';

  @override
  String get settingsExportQueuedMessage =>
      'আপনার রপ্তানি এখনই প্রস্তুত করার পক্ষে অনেক বড়, তাই আমরা এটি সারিতে রেখেছি। অনুগ্রহ করে পরে আবার চেষ্টা করুন, বা আপনার তথ্যের একটি কপির জন্য সহায়তায় যোগাযোগ করুন।';

  @override
  String get settingsExportFailedMessage =>
      'আপনার রপ্তানি প্রস্তুত করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get settingsDeleteSuccessDone => 'সম্পন্ন';

  @override
  String get settingsDeleteFailed =>
      'আমরা আপনার অ্যাকাউন্ট মুছতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get settingsReauthTitle => 'অনুগ্রহ করে আবার সাইন ইন করুন';

  @override
  String get settingsReauthBody =>
      'আপনার নিরাপত্তার জন্য অ্যাকাউন্ট মোছার আগে নতুন করে সাইন ইন করা দরকার। অনুগ্রহ করে সাইন আউট করে আবার সাইন ইন করুন, এবং পাঁচ মিনিটের মধ্যে মুছে ফেলুন।';

  @override
  String get profilePlanLabel => 'প্ল্যান';

  @override
  String get profilePlanFree => 'ফ্রি';

  @override
  String get profilePlanPro => 'প্রো';

  @override
  String get profilePlanGold => 'গোল্ড';

  @override
  String get profilePlanPremium => 'প্রিমিয়াম';

  @override
  String get profilePlanUnknown => 'উপলব্ধ নেই';

  @override
  String get profileNoName => 'আপনার প্রোফাইল';

  @override
  String get profileSectionAbout => 'আপনার সম্পর্কে';

  @override
  String get profileSectionTeaching => 'আপনি কী পড়ান';

  @override
  String get profileSectionLocation => 'আপনি কোথায় পড়ান';

  @override
  String get profileSectionContact => 'আমরা কীভাবে যোগাযোগ করব';

  @override
  String get profileNameLabel => 'আপনার নাম';

  @override
  String get profileNameHint =>
      'আপনি যে কাজ শেয়ার করেন, তাতে অন্য শিক্ষকেরা এই নামটিই দেখেন।';

  @override
  String get profileNameInvalid => 'অনুগ্রহ করে একটি ছোট নাম ব্যবহার করুন।';

  @override
  String get profileSchoolLabel => 'স্কুলের নাম';

  @override
  String get profileBoardCategoryLabel => 'বোর্ডের ধরন';

  @override
  String get profileBoardCategoryHint =>
      'নিচের তালিকা ছোট করতে একটি বোর্ডের ধরন বেছে নিন।';

  @override
  String get profileBoardCategoryState => 'রাজ্য বোর্ড';

  @override
  String get profileStateLabel => 'রাজ্য';

  @override
  String get profileStateNone => 'সেট করা নেই';

  @override
  String get profileDistrictLabel => 'জেলা';

  @override
  String get profileDistrictHint => 'আপনার স্কুল যে জেলায় অবস্থিত।';

  @override
  String get profileSubjectsLabel => 'আপনি যে বিষয় পড়ান';

  @override
  String get profileSubjectsHint => 'আপনার যতগুলি প্রয়োজন, ততগুলি বেছে নিন।';

  @override
  String get profileGradesLabel => 'আপনি যে শ্রেণি পড়ান';

  @override
  String get profileGradesHint => 'আপনার যতগুলি প্রয়োজন, ততগুলি বেছে নিন।';

  @override
  String get profileLanguageHint =>
      'এটি অ্যাপের বাকি অংশের মতোই একই ভাষা পছন্দ, তাই এখানে বদলালে সব জায়গায় বদলে যায়।';

  @override
  String get profilePhoneLabel => 'মোবাইল নম্বর';

  @override
  String get profilePhoneHint => 'ঐচ্ছিক। +91 সহ বা ছাড়া, দশ অঙ্ক।';

  @override
  String get profilePhoneInvalid =>
      'অনুগ্রহ করে দশ অঙ্কের একটি ভারতীয় মোবাইল নম্বর দিন।';

  @override
  String get profilePincodeLabel => 'পিন কোড';

  @override
  String get profilePincodeHint => 'ঐচ্ছিক। ছয় অঙ্ক।';

  @override
  String get profilePincodeInvalid => 'অনুগ্রহ করে ছয় অঙ্কের পিন কোড দিন।';

  @override
  String get profileEmptyTitle => 'আপনার প্রোফাইল খালি';

  @override
  String get profileEmptyBody =>
      'আপনার স্কুল ও শ্রেণিগুলি যোগ করুন, তাহলে আপনার তৈরি প্রতিটি পাঠ পরিকল্পনা ও কুইজ আপনার শ্রেণিকক্ষের উপযোগী হয়ে আসবে।';

  @override
  String get profileLoadFailed =>
      'আমরা আপনার প্রোফাইল খুলতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get profileSignedOutTitle => 'আপনি সাইন আউট অবস্থায় আছেন';

  @override
  String get profileSignedOutBody =>
      'আপনার শিক্ষণ প্রোফাইল দেখতে ও সম্পাদনা করতে সাইন ইন করুন।';

  @override
  String get profileSaveSignIn =>
      'প্রোফাইল সংরক্ষণ করতে অনুগ্রহ করে আবার সাইন ইন করুন।';

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
  String get imageInputHint =>
      'পাঠ্যবইয়ের পৃষ্ঠার একটি পরিষ্কার ছবি যোগ করুন।';

  @override
  String get imageInputTakePhoto => 'ছবি তুলুন';

  @override
  String get imageInputChooseGallery => 'গ্যালারি থেকে বেছে নিন';

  @override
  String get imageInputRetake => 'আবার ছবি তুলুন';

  @override
  String get imageInputChangeGallery => 'অন্য একটি বেছে নিন';

  @override
  String get imageInputRemove => 'ছবি সরান';

  @override
  String get imageInputPreviewLabel => 'বেছে নেওয়া ছবির প্রিভিউ';

  @override
  String imageInputSizeOfMax(String used, String max) {
    return '$max-এর মধ্যে $used';
  }

  @override
  String imageInputTooLarge(String max) {
    return 'এই ছবিটি খুব বড়। অনুগ্রহ করে $max-এর কম আকারের একটি বেছে নিন।';
  }

  @override
  String get imageInputPermissionDenied =>
      'আপনার ক্যামেরা বা ছবি ব্যবহারের জন্য SahayakAI-এর অনুমতি দরকার। অনুগ্রহ করে ডিভাইসের সেটিংসে অনুমতি দিন।';

  @override
  String get imageInputFailed =>
      'আমরা সেই ছবিটি খুলতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get worksheetTitle => 'ওয়ার্কশিট';

  @override
  String get worksheetSubtitle => 'পাঠ্যবইয়ের ছবি থেকে ওয়ার্কশিট তৈরি করুন';

  @override
  String get worksheetEmpty =>
      'পাঠ্যবইয়ের একটি ছবি ও নির্দেশ যোগ করে তৈরি করুন-এ ট্যাপ করুন।';

  @override
  String get worksheetImageLabel => 'পাঠ্যবইয়ের পৃষ্ঠার ছবি';

  @override
  String get worksheetImageHint => 'এই পৃষ্ঠা থেকেই ওয়ার্কশিট তৈরি হয়।';

  @override
  String get toolImageOptionalLabel => 'পাঠ্যবইয়ের পৃষ্ঠার ছবি (ঐচ্ছিক)';

  @override
  String get toolImageOptionalHint =>
      'পৃষ্ঠার ছবি দিলে সেটিই মূল উৎস হবে, নয়তো খালি রাখুন।';

  @override
  String get worksheetImageError =>
      'অনুগ্রহ করে পাঠ্যবইয়ের পৃষ্ঠার একটি ছবি যোগ করুন।';

  @override
  String get worksheetPromptLabel => 'আপনার কেমন ওয়ার্কশিট দরকার?';

  @override
  String get worksheetPromptHint =>
      'উদাহরণস্বরূপ, এই পৃষ্ঠা থেকে গুণের একটি ওয়ার্কশিট তৈরি করুন';

  @override
  String get worksheetPromptError => 'আপনার কেমন ওয়ার্কশিট দরকার তা লিখুন।';

  @override
  String get worksheetGradeLabel => 'শ্রেণি স্তর';

  @override
  String get worksheetGradeAny => 'যেকোনো শ্রেণি';

  @override
  String get worksheetSubjectLabel => 'বিষয়';

  @override
  String get worksheetSubjectAny => 'যেকোনো বিষয়';

  @override
  String get worksheetOptional => 'ঐচ্ছিক';

  @override
  String get worksheetObjectives => 'শিখন উদ্দেশ্য';

  @override
  String get worksheetInstructions => 'শিক্ষার্থীদের জন্য নির্দেশ';

  @override
  String get worksheetActivities => 'কার্যকলাপ';

  @override
  String get worksheetActivityQuestion => 'প্রশ্ন';

  @override
  String get worksheetActivityPuzzle => 'ধাঁধা';

  @override
  String get worksheetActivityCreativeTask => 'সৃজনশীল কাজ';

  @override
  String get worksheetExplanation => 'শিক্ষকের জন্য';

  @override
  String get worksheetChalkboardNote => 'ব্ল্যাকবোর্ডে';

  @override
  String get worksheetAnswerKey => 'উত্তরসূচি';

  @override
  String get worksheetNoContent =>
      'সেই পৃষ্ঠার জন্য কোনো ওয়ার্কশিট আসেনি। অনুগ্রহ করে আরও পরিষ্কার ছবি বা অন্য নির্দেশ চেষ্টা করুন।';

  @override
  String get worksheetSave => 'লাইব্রেরিতে সংরক্ষণ করুন';

  @override
  String get worksheetSaving => 'সংরক্ষণ হচ্ছে';

  @override
  String get worksheetSaved => 'আপনার লাইব্রেরিতে সংরক্ষিত হয়েছে';

  @override
  String get worksheetSaveFailedTitle => 'সংরক্ষণ করা যায়নি';

  @override
  String get worksheetSaveFailedBody =>
      'আমরা এই ওয়ার্কশিটটি আপনার লাইব্রেরিতে সংরক্ষণ করতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get worksheetSaveRetry => 'আবার সংরক্ষণের চেষ্টা করুন';

  @override
  String get worksheetUpgradeTitle => 'একটি উচ্চতর প্ল্যান প্রয়োজন';

  @override
  String get worksheetUpgradeBody =>
      'ওয়ার্কশিট তৈরি একটি উচ্চতর প্ল্যানের অংশ। ওয়ার্কশিট তৈরি চালিয়ে যেতে অনুগ্রহ করে আপগ্রেড করুন।';

  @override
  String get worksheetLimitTitle => 'আপনি আপনার সীমায় পৌঁছেছেন';

  @override
  String get worksheetLimitBody =>
      'আপনি আপাতত আপনার ওয়ার্কশিট ব্যবহার করে ফেলেছেন। অনুগ্রহ করে পরে আবার চেষ্টা করুন বা আপনার প্ল্যান আপগ্রেড করুন।';

  @override
  String get worksheetSeePricing => 'প্ল্যান ও মূল্য দেখুন';

  @override
  String get worksheetRephrase =>
      'আমরা তা থেকে ওয়ার্কশিট তৈরি করতে পারিনি। অনুগ্রহ করে আরও পরিষ্কার ছবি দিন বা নির্দেশটি আবার লিখুন।';

  @override
  String get worksheetBusy =>
      'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।';

  @override
  String get worksheetTimeout =>
      'এতে প্রত্যাশার চেয়ে বেশি সময় লাগছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get worksheetSignIn =>
      'এই সরঞ্জামটি ব্যবহার করতে অনুগ্রহ করে আবার সাইন ইন করুন।';

  @override
  String get rubricTitle => 'রুব্রিক';

  @override
  String get rubricSubtitle =>
      'একটি অ্যাসাইনমেন্টের জন্য মূল্যায়ন রুব্রিক তৈরি করুন';

  @override
  String get rubricEmpty =>
      'অ্যাসাইনমেন্টটির বর্ণনা দিয়ে তৈরি করুন-এ ট্যাপ করুন।';

  @override
  String get rubricAssignmentLabel => 'অ্যাসাইনমেন্টটি কী?';

  @override
  String get rubricAssignmentHint =>
      'রুব্রিকটি এই অ্যাসাইনমেন্টের মূল্যায়ন করে।';

  @override
  String get rubricAssignmentPlaceholder =>
      'উদাহরণস্বরূপ, নবীকরণযোগ্য শক্তি নিয়ে পঞ্চম শ্রেণির একটি প্রকল্প';

  @override
  String get rubricAssignmentError =>
      'অনুগ্রহ করে অ্যাসাইনমেন্টটির বর্ণনা দিন।';

  @override
  String get rubricGradeLabel => 'শ্রেণি স্তর';

  @override
  String get rubricGradeAny => 'যেকোনো শ্রেণি';

  @override
  String get rubricSubjectLabel => 'বিষয়';

  @override
  String get rubricSubjectAny => 'যেকোনো বিষয়';

  @override
  String get rubricOptional => 'ঐচ্ছিক';

  @override
  String get rubricCriteriaColumn => 'মানদণ্ড';

  @override
  String rubricPoints(String points) {
    return '$points পয়েন্ট';
  }

  @override
  String get rubricScrollHint => 'সব স্তর দেখতে পাশে সোয়াইপ করুন।';

  @override
  String get rubricNoContent =>
      'এর জন্য কোনো রুব্রিক আসেনি। অনুগ্রহ করে অ্যাসাইনমেন্টের আরও পরিষ্কার বর্ণনা দিন।';

  @override
  String get rubricUpgradeTitle => 'একটি উচ্চতর প্ল্যান প্রয়োজন';

  @override
  String get rubricUpgradeBody =>
      'রুব্রিক তৈরি একটি উচ্চতর প্ল্যানের অংশ। রুব্রিক তৈরি চালিয়ে যেতে অনুগ্রহ করে আপগ্রেড করুন।';

  @override
  String get rubricLimitTitle => 'আপনি আপনার সীমায় পৌঁছেছেন';

  @override
  String get rubricLimitBody =>
      'আপনি আপাতত আপনার রুব্রিক ব্যবহার করে ফেলেছেন। অনুগ্রহ করে পরে আবার চেষ্টা করুন বা আপনার প্ল্যান আপগ্রেড করুন।';

  @override
  String get rubricRephrase =>
      'আমরা তা থেকে রুব্রিক তৈরি করতে পারিনি। অনুগ্রহ করে অ্যাসাইনমেন্টটি আবার লিখে চেষ্টা করুন।';

  @override
  String get rubricBusy =>
      'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।';

  @override
  String get rubricTimeout =>
      'এতে প্রত্যাশার চেয়ে বেশি সময় লাগছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get rubricSignIn =>
      'এই সরঞ্জামটি ব্যবহার করতে অনুগ্রহ করে আবার সাইন ইন করুন।';

  @override
  String get examPaperTitle => 'প্রশ্নপত্র';

  @override
  String get examPaperSubtitle =>
      'উত্তরসূচি সহ বোর্ড-প্যাটার্নের প্রশ্নপত্র তৈরি করুন';

  @override
  String get examPaperEmpty =>
      'একটি বোর্ড, শ্রেণি ও বিষয় বেছে নিয়ে তৈরি করুন-এ ট্যাপ করুন।';

  @override
  String get examPaperBoardLabel => 'বোর্ড';

  @override
  String get examPaperBoardHint => 'একটি বোর্ড বেছে নিন';

  @override
  String get examPaperBoardError => 'অনুগ্রহ করে একটি বোর্ড বেছে নিন।';

  @override
  String get examPaperGradeLabel => 'শ্রেণি স্তর';

  @override
  String get examPaperGradeHint => 'একটি শ্রেণি বেছে নিন';

  @override
  String get examPaperGradeError => 'অনুগ্রহ করে একটি শ্রেণি স্তর বেছে নিন।';

  @override
  String get examPaperSubjectLabel => 'বিষয়';

  @override
  String get examPaperSubjectHint => 'একটি বিষয় বেছে নিন';

  @override
  String get examPaperSubjectError => 'অনুগ্রহ করে একটি বিষয় বেছে নিন।';

  @override
  String get examPaperSubjectOther => 'অন্য বিষয়';

  @override
  String get examPaperSubjectOtherLabel => 'বিষয়ের নাম';

  @override
  String get examPaperSubjectOtherHint => 'উদাহরণস্বরূপ, অর্থনীতি';

  @override
  String get examPaperSubjectOtherError => 'অনুগ্রহ করে একটি বিষয় লিখুন।';

  @override
  String get examPaperChaptersLabel => 'অধ্যায়';

  @override
  String get examPaperChaptersHint =>
      'যে অধ্যায়গুলি রাখতে চান সেগুলি যোগ করুন। সরকারি ব্লুপ্রিন্ট থাকলে পুরো পাঠ্যক্রমের জন্য খালি রাখুন।';

  @override
  String get examPaperChaptersPlaceholder => 'উদাহরণস্বরূপ, দ্বিঘাত সমীকরণ';

  @override
  String get examPaperChaptersAdd => 'অধ্যায় যোগ করুন';

  @override
  String get examPaperChaptersError =>
      'এই বোর্ড, শ্রেণি ও বিষয়ের জন্য অনুগ্রহ করে অন্তত একটি অধ্যায় যোগ করুন।';

  @override
  String get examPaperDifficultyLabel => 'কঠিনতা';

  @override
  String get examPaperDifficultyEasy => 'সহজ';

  @override
  String get examPaperDifficultyModerate => 'মাঝারি';

  @override
  String get examPaperDifficultyHard => 'কঠিন';

  @override
  String get examPaperDifficultyMixed => 'মিশ্র';

  @override
  String get examPaperIncludeAnswerKey => 'উত্তরসূচি যোগ করুন';

  @override
  String get examPaperIncludeMarkingScheme => 'নম্বর বিভাজন যোগ করুন';

  @override
  String get examPaperInProgressTitle => 'আপনার প্রশ্নপত্র তৈরি হচ্ছে';

  @override
  String get examPaperInProgressBody =>
      'সম্পূর্ণ বোর্ড প্রশ্নপত্র তৈরিতে একটু বেশি সময় লাগে। আমরা এখন এটি শেষ করছি, এবং এটি আপনার জন্য সংরক্ষিত হবে।';

  @override
  String get examPaperInProgressLibraryHint =>
      'এক মিনিট পরে লাইব্রেরি ট্যাব খুলে তৈরি প্রশ্নপত্রটি দেখুন।';

  @override
  String examPaperMaxMarks(String marks) {
    return 'পূর্ণমান $marks';
  }

  @override
  String examPaperMarks(String marks) {
    return '$marks নম্বর';
  }

  @override
  String examPaperSectionMarks(String marks) {
    return '$marks নম্বর';
  }

  @override
  String examPaperPercent(String value) {
    return '$value শতাংশ';
  }

  @override
  String get examPaperGeneralInstructions => 'সাধারণ নির্দেশাবলি';

  @override
  String get examPaperInternalChoice => 'অথবা';

  @override
  String get examPaperAnswerKey => 'উত্তর';

  @override
  String get examPaperMarkingScheme => 'নম্বর বিভাজন';

  @override
  String get examPaperBlueprintTitle => 'ব্লুপ্রিন্ট সারসংক্ষেপ';

  @override
  String get examPaperBlueprintChapters => 'অধ্যায় অনুযায়ী নম্বর';

  @override
  String get examPaperBlueprintDifficulty => 'কঠিনতা অনুযায়ী ভাগ';

  @override
  String get examPaperPyqTitle => 'আগের বছরের প্রশ্ন';

  @override
  String examPaperPyqChapterYear(String chapter, int year) {
    return '$chapter ($year)';
  }

  @override
  String examPaperPyqYear(int year) {
    return '$year সাল';
  }

  @override
  String get examPaperNoContent =>
      'এর জন্য কোনো প্রশ্নপত্র আসেনি। অনুগ্রহ করে কম অধ্যায় বা অন্য বিষয় চেষ্টা করুন।';

  @override
  String get examPaperUnstructuredTitle => 'আমরা প্রশ্নপত্রটি সাজাতে পারিনি';

  @override
  String get examPaperUnstructuredBody =>
      'সহায়ক এটিকে একটি সম্পূর্ণ প্রশ্নপত্র হিসেবে সাজাতে পারেনি। অনুগ্রহ করে কয়েকটি অধ্যায় বাদ দিয়ে আবার তৈরি করুন।';

  @override
  String get examPaperUpgradeTitle => 'একটি উচ্চতর প্ল্যান প্রয়োজন';

  @override
  String get examPaperUpgradeBody =>
      'প্রশ্নপত্র তৈরি একটি উচ্চতর প্ল্যানের অংশ। প্রশ্নপত্র তৈরি চালিয়ে যেতে অনুগ্রহ করে আপগ্রেড করুন।';

  @override
  String get examPaperLimitTitle => 'আপনি আপনার সীমায় পৌঁছেছেন';

  @override
  String get examPaperLimitBody =>
      'আপনি আপাতত আপনার প্রশ্নপত্র ব্যবহার করে ফেলেছেন। অনুগ্রহ করে পরে আবার চেষ্টা করুন বা আপনার প্ল্যান আপগ্রেড করুন।';

  @override
  String get examPaperRephrase =>
      'আমরা তা থেকে প্রশ্নপত্র তৈরি করতে পারিনি। অনুগ্রহ করে অধ্যায়গুলি বদলে আবার চেষ্টা করুন।';

  @override
  String get examPaperBusy =>
      'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।';

  @override
  String get examPaperTimeout =>
      'এতে প্রত্যাশার চেয়ে বেশি সময় লাগছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get examPaperSignIn =>
      'এই সরঞ্জামটি ব্যবহার করতে অনুগ্রহ করে আবার সাইন ইন করুন।';

  @override
  String get teacherTrainingTitle => 'শিক্ষণ পরামর্শদাতা';

  @override
  String get teacherTrainingSubtitle =>
      'শিক্ষণ সংক্রান্ত প্রশ্নে পরামর্শ ও কৌশল';

  @override
  String get teacherTrainingAction => 'পরামর্শ নিন';

  @override
  String get teacherTrainingEmpty =>
      'শিক্ষণ সংক্রান্ত একটি প্রশ্ন করুন, শিক্ষণবিদ্যার ভিত্তিতে কৌশল পাবেন।';

  @override
  String get teacherTrainingQuestionLabel => 'আপনার প্রশ্ন';

  @override
  String get teacherTrainingQuestionHint =>
      'পাঠের পরিকল্পনা, শ্রেণিকক্ষের অনুশীলন বা মূল্যায়ন নিয়ে জিজ্ঞাসা করুন।';

  @override
  String get teacherTrainingQuestionPlaceholder =>
      'উদাহরণস্বরূপ, 40 জনের একটি ক্লাসকে পুরো পাঠ জুড়ে কীভাবে যুক্ত রাখব?';

  @override
  String get teacherTrainingQuestionError => 'অনুগ্রহ করে একটি প্রশ্ন লিখুন।';

  @override
  String get teacherTrainingSubjectLabel => 'বিষয়';

  @override
  String get teacherTrainingSubjectAny => 'যেকোনো বিষয়';

  @override
  String get teacherTrainingOptional => 'ঐচ্ছিক';

  @override
  String get teacherTrainingStrategiesTitle => 'কৌশল';

  @override
  String get teacherTrainingSectionQuestion => 'প্রশ্ন';

  @override
  String get teacherTrainingResultTitle => 'পরামর্শ নোট';

  @override
  String get teacherTrainingNoContent =>
      'এর জন্য কোনো পরামর্শ আসেনি। অনুগ্রহ করে আরও পরিষ্কার একটি প্রশ্ন চেষ্টা করুন।';

  @override
  String get teacherTrainingUpgradeTitle => 'একটি উচ্চতর প্ল্যান প্রয়োজন';

  @override
  String get teacherTrainingUpgradeBody =>
      'শিক্ষণ পরামর্শদাতা একটি উচ্চতর প্ল্যানের অংশ। জিজ্ঞাসা চালিয়ে যেতে অনুগ্রহ করে আপগ্রেড করুন।';

  @override
  String get teacherTrainingLimitTitle => 'আপনি আপনার সীমায় পৌঁছেছেন';

  @override
  String get teacherTrainingLimitBody =>
      'আপনি আপাতত শিক্ষণ পরামর্শদাতা ব্যবহার করে ফেলেছেন। অনুগ্রহ করে পরে আবার চেষ্টা করুন বা আপনার প্ল্যান আপগ্রেড করুন।';

  @override
  String get teacherTrainingSeePricing => 'প্ল্যান ও মূল্য দেখুন';

  @override
  String get teacherTrainingRephrase =>
      'আমরা তা থেকে পরামর্শ তৈরি করতে পারিনি। অনুগ্রহ করে প্রশ্নটি আবার লিখে চেষ্টা করুন।';

  @override
  String get teacherTrainingBusy =>
      'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।';

  @override
  String teacherTrainingBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে প্রায় $seconds সেকেন্ড পরে আবার চেষ্টা করুন।',
      one:
          'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে প্রায় 1 সেকেন্ড পরে আবার চেষ্টা করুন।',
    );
    return '$_temp0';
  }

  @override
  String get teacherTrainingTimeout =>
      'এতে প্রত্যাশার চেয়ে বেশি সময় লাগছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get teacherTrainingSignIn =>
      'এই সরঞ্জামটি ব্যবহার করতে অনুগ্রহ করে আবার সাইন ইন করুন।';

  @override
  String get parentMessageTitle => 'অভিভাবকের জন্য বার্তা';

  @override
  String get parentMessageSubtitle =>
      'অভিভাবকের ভাষায় বাড়িতে পাঠানোর বার্তা লিখুন';

  @override
  String get parentMessageAction => 'বার্তার খসড়া তৈরি করুন';

  @override
  String get parentMessageEmpty =>
      'শিক্ষার্থী ও কারণ জানান, অভিভাবকের ভাষায় একটি যত্নশীল বার্তার খসড়া তৈরি হবে।';

  @override
  String get parentMessageStudentLabel => 'শিক্ষার্থীর নাম';

  @override
  String get parentMessageStudentPlaceholder =>
      'বার্তাটি যে শিক্ষার্থীকে নিয়ে';

  @override
  String get parentMessageStudentError => 'অনুগ্রহ করে শিক্ষার্থীর নাম লিখুন।';

  @override
  String get parentMessageClassLabel => 'শ্রেণি';

  @override
  String get parentMessageClassPlaceholder => 'উদাহরণস্বরূপ, শ্রেণি 6A';

  @override
  String get parentMessageClassError => 'অনুগ্রহ করে শ্রেণিটি লিখুন।';

  @override
  String get parentMessageSubjectLabel => 'বিষয়';

  @override
  String get parentMessageSubjectHint => 'একটি বিষয় বেছে নিন';

  @override
  String get parentMessageSubjectError => 'অনুগ্রহ করে একটি বিষয় বেছে নিন।';

  @override
  String get parentMessageReasonLabel => 'বার্তার কারণ';

  @override
  String get parentMessageReasonHint => 'একটি কারণ বেছে নিন';

  @override
  String get parentMessageReasonError => 'অনুগ্রহ করে একটি কারণ বেছে নিন।';

  @override
  String get parentMessageReasonAbsences => 'বারবার অনুপস্থিতি';

  @override
  String get parentMessageReasonPerformance => 'পড়াশোনায় সহায়তা';

  @override
  String get parentMessageReasonBehavior => 'ক্লাসে আচরণ';

  @override
  String get parentMessageReasonPositive => 'জানানোর মতো ভালো খবর';

  @override
  String get parentMessageAbsentDaysLabel => 'অনুপস্থিত দিন';

  @override
  String get parentMessageAbsentDaysHint =>
      'শিক্ষার্থী পরপর কত দিন অনুপস্থিত ছিল।';

  @override
  String get parentMessageAbsentDaysPlaceholder => 'উদাহরণস্বরূপ, 3';

  @override
  String get parentMessageParentLanguageLabel => 'অভিভাবকের ভাষা';

  @override
  String get parentMessageParentLanguageHint =>
      'বার্তাটি এই ভাষাতেই লেখা হয়, যা অ্যাপের ভাষার চেয়ে আলাদা হতে পারে।';

  @override
  String get parentMessageParentLanguagePlaceholder =>
      'অভিভাবকের ভাষা বেছে নিন';

  @override
  String get parentMessageParentLanguageError =>
      'অনুগ্রহ করে অভিভাবকের ভাষা বেছে নিন।';

  @override
  String get parentMessageContextLabel => 'এর কারণ কী?';

  @override
  String get parentMessageContextHint =>
      'পরিস্থিতি নিয়ে একটি ছোট নোট বার্তাটি গড়তে সাহায্য করে।';

  @override
  String get parentMessageContextPlaceholder =>
      'উদাহরণস্বরূপ, ভগ্নাংশের শেষ দুই সপ্তাহ বাদ পড়েছে';

  @override
  String get parentMessageNoteLabel => 'বিশেষ কিছু উল্লেখ করতে চান?';

  @override
  String get parentMessageNoteHint =>
      'এখানে দেওয়া বিবরণ বার্তার মধ্যে যুক্ত হয়।';

  @override
  String get parentMessageNotePlaceholder =>
      'উদাহরণস্বরূপ, দলগত কাজে ভালো করছে';

  @override
  String get parentMessageTeacherNameLabel => 'আপনার নাম';

  @override
  String get parentMessageTeacherNameHint =>
      'বার্তার শেষে এই নাম থাকে। খালি রাখলে আপনার প্রোফাইলের নাম ব্যবহার হয়।';

  @override
  String get parentMessageTeacherNamePlaceholder => 'উদাহরণস্বরূপ, শ্রীমতী রাও';

  @override
  String get parentMessageSchoolNameLabel => 'স্কুলের নাম';

  @override
  String get parentMessageSchoolNamePlaceholder => 'আপনার স্কুলের নাম';

  @override
  String get parentMessageOptional => 'ঐচ্ছিক';

  @override
  String parentMessageWordCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি শব্দ',
      one: '1টি শব্দ',
    );
    return '$_temp0';
  }

  @override
  String get parentMessageSectionMessage => 'বার্তা';

  @override
  String get parentMessageSectionDetails => 'অতিরিক্ত বিবরণ';

  @override
  String get parentMessageResultTitle => 'অভিভাবকের জন্য বার্তা';

  @override
  String get parentMessageNoContent =>
      'এর জন্য কোনো বার্তা আসেনি। অনুগ্রহ করে আরও কিছু প্রেক্ষাপট যোগ করে আবার চেষ্টা করুন।';

  @override
  String get parentMessageMissingFields =>
      'অনুগ্রহ করে শিক্ষার্থী, শ্রেণি, বিষয়, কারণ ও অভিভাবকের ভাষা পূরণ করে আবার চেষ্টা করুন।';

  @override
  String get parentMessageUpgradeTitle => 'একটি উচ্চতর প্ল্যান প্রয়োজন';

  @override
  String get parentMessageUpgradeBody =>
      'অভিভাবকের জন্য বার্তা একটি উচ্চতর প্ল্যানের অংশ। খসড়া তৈরি চালিয়ে যেতে অনুগ্রহ করে আপগ্রেড করুন।';

  @override
  String get parentMessageLimitTitle => 'আপনি আপনার সীমায় পৌঁছেছেন';

  @override
  String get parentMessageLimitBody =>
      'আপনি আপাতত আপনার অভিভাবক বার্তা ব্যবহার করে ফেলেছেন। অনুগ্রহ করে পরে আবার চেষ্টা করুন বা আপনার প্ল্যান আপগ্রেড করুন।';

  @override
  String get parentMessageSeePricing => 'প্ল্যান ও মূল্য দেখুন';

  @override
  String get parentMessageBusy =>
      'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।';

  @override
  String parentMessageBusyRetryAfter(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other:
          'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে প্রায় $seconds সেকেন্ড পরে আবার চেষ্টা করুন।',
      one:
          'সহায়ক এখন ব্যস্ত। অনুগ্রহ করে প্রায় 1 সেকেন্ড পরে আবার চেষ্টা করুন।',
    );
    return '$_temp0';
  }

  @override
  String get parentMessageTimeout =>
      'এতে প্রত্যাশার চেয়ে বেশি সময় লাগছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get parentMessageSignIn =>
      'এই সরঞ্জামটি ব্যবহার করতে অনুগ্রহ করে আবার সাইন ইন করুন।';

  @override
  String get assessTitle => 'অ্যাসাইনমেন্ট মূল্যায়ন';

  @override
  String get assessSubtitle =>
      'ছবি থেকে শিক্ষার্থীর হাতে লেখা কাজ মূল্যায়ন করুন';

  @override
  String get assessEmpty =>
      'শিক্ষার্থীর কাজের একটি ছবি যোগ করে মূল্যায়ন করুন-এ ট্যাপ করুন।';

  @override
  String get assessSubmit => 'মূল্যায়ন করুন';

  @override
  String get assessImageLabel => 'শিক্ষার্থীর কাজের ছবি';

  @override
  String get assessImageHint => 'পুরো পৃষ্ঠার একটি পরিষ্কার ছবি তুলুন।';

  @override
  String get assessImageError =>
      'অনুগ্রহ করে শিক্ষার্থীর কাজের একটি ছবি যোগ করুন।';

  @override
  String get assessModeLabel => 'আপনার কী দরকার?';

  @override
  String get assessModeHint =>
      'পুরো মূল্যায়ন কাজটি পড়ে নম্বর দেয়। শুধু পড়া কেবল লেখাটি ফিরিয়ে দেয়। লেখা মূল্যায়ন আপনার পেস্ট করা লেখায় নম্বর দেয়।';

  @override
  String get assessModeFull => 'পুরো মূল্যায়ন';

  @override
  String get assessModeTranscribe => 'শুধু পড়া';

  @override
  String get assessModeScore => 'লেখা মূল্যায়ন';

  @override
  String get assessTranscriptLabel => 'সংশোধিত লেখা';

  @override
  String get assessTranscriptHint =>
      'ছবি আবার না পড়ে মূল্যায়নের জন্য সংশোধিত লেখাটি পেস্ট করুন।';

  @override
  String get assessTranscriptPlaceholder =>
      'শিক্ষার্থীর সংশোধিত উত্তর টাইপ করুন বা পেস্ট করুন';

  @override
  String get assessOptional => 'ঐচ্ছিক';

  @override
  String get assessRubricNote =>
      'রুব্রিক না থাকলে কাজটি একটি সাধারণ রুব্রিকে মূল্যায়ন হয়: বোঝাপড়া, নির্ভুলতা, উপস্থাপনা ও সম্পূর্ণতা।';

  @override
  String get assessPrivacyNote =>
      'মূল্যায়নের জন্য শিক্ষার্থীর নাম কখনও পাঠানো হয় না।';

  @override
  String get assessScoreLabel => 'সামগ্রিক নম্বর';

  @override
  String get assessScoreOutOf => '100-এর মধ্যে';

  @override
  String assessPoints(String earned, String possible) {
    return '$possible-এর মধ্যে $earned পয়েন্ট';
  }

  @override
  String assessConfidence(String percent) {
    return 'নিশ্চয়তা $percent%';
  }

  @override
  String assessRubricUsed(String title) {
    return 'যার ভিত্তিতে মূল্যায়ন: $title';
  }

  @override
  String get assessLowConfidence => 'কম নিশ্চয়তা';

  @override
  String get assessTranscriptSection => 'শিক্ষার্থী যা লিখেছে';

  @override
  String get assessCriteriaSection => 'মানদণ্ড অনুযায়ী নম্বর';

  @override
  String assessCriterionPoints(String points, String max) {
    return '$points / $max';
  }

  @override
  String get assessStrengthsSection => 'শক্তির দিক';

  @override
  String get assessImprovementsSection => 'যা নিয়ে কাজ করতে হবে';

  @override
  String get assessNextStepsSection => 'পরবর্তী পদক্ষেপ';

  @override
  String get assessTeacherNoteSection => 'শিক্ষার্থীর জন্য নোট';

  @override
  String get assessWarningsSection => 'একটু দেখে নিন';

  @override
  String get assessWarningBlank =>
      'এই পৃষ্ঠাটি খালি মনে হচ্ছে। অনুগ্রহ করে ছবিটি দেখে আবার চেষ্টা করুন।';

  @override
  String get assessWarningLowContrast =>
      'ছবিটি ঝাপসা। উজ্জ্বল ছবি হলে মূল্যায়ন আরও নির্ভুল হবে।';

  @override
  String get assessWarningPartial => 'কাজের কেবল কিছু অংশ পড়া গেছে।';

  @override
  String get assessWarningLanguageMismatch =>
      'লেখাটি প্রত্যাশিত ভাষার চেয়ে অন্য ভাষায় হতে পারে।';

  @override
  String get assessNoContent =>
      'কোনো মূল্যায়ন আসেনি। অনুগ্রহ করে আরও পরিষ্কার ছবি চেষ্টা করুন।';

  @override
  String get assessSignIn =>
      'একটি অ্যাসাইনমেন্ট মূল্যায়ন করতে অনুগ্রহ করে আবার সাইন ইন করুন।';

  @override
  String get assessUpgradeTitle => 'একটি উচ্চতর প্ল্যান প্রয়োজন';

  @override
  String get assessUpgradeBody =>
      'হাতে লেখা কাজ মূল্যায়ন একটি উচ্চতর প্ল্যানের অংশ। মূল্যায়ন চালিয়ে যেতে আপগ্রেড করুন।';

  @override
  String get assessDailyLimitTitle => 'আজকের জন্য আপনার সব মূল্যায়ন শেষ';

  @override
  String get assessDailyLimitBody =>
      'আপনার প্ল্যানে প্রতিদিন একটি নির্দিষ্ট সংখ্যক মূল্যায়ন অন্তর্ভুক্ত। সেগুলি আগামীকাল আবার শুরু হবে, অথবা আপনি উচ্চতর প্ল্যানে সীমা বাড়াতে পারেন।';

  @override
  String get assessLimitTitle => 'আপনি আপনার মূল্যায়ন সীমায় পৌঁছেছেন';

  @override
  String get assessLimitBody =>
      'আপনি আপনার প্ল্যানের সব মূল্যায়ন ব্যবহার করেছেন। সেগুলি পরের মাসে আবার শুরু হবে, অথবা আপনি উচ্চতর প্ল্যানে সীমা বাড়াতে পারেন।';

  @override
  String get assessSeePricing => 'প্ল্যান দেখুন';

  @override
  String get assessBusy =>
      'মূল্যায়ন মডেল এখন ব্যস্ত। অনুগ্রহ করে এক মিনিট পরে আবার চেষ্টা করুন।';

  @override
  String assessBusyRetryAfter(int seconds) {
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
  String get assessTimeout =>
      'মূল্যায়নে স্বাভাবিকের চেয়ে বেশি সময় লাগছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get assessRephrase =>
      'ছবিটি মূল্যায়ন করা যায়নি। অনুগ্রহ করে আরও পরিষ্কার একটি ছবি আবার আপলোড করুন।';

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
  String get vidyaGreeting =>
      'স্বাগতম, শিক্ষক। আপনার ভাষায় বলুন, আমি আপনার কাজ প্রস্তুত করে দেব।';

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
  String get vidyaWorkingTitle => 'এটি নিয়ে কাজ করছি';

  @override
  String get vidyaWorkingBody =>
      'অ্যাপ ব্যবহার করতে থাকুন। আমি নেপথ্যে শেষ করে দেব।';

  @override
  String get vidyaWorkingMinimise => 'VIDYA-তে ছোট করুন';

  @override
  String get vidyaWorkingStop => 'থামান';

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
      'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করতে সিলে ট্যাপ করুন।';

  @override
  String get vidyaPrepDesk => 'প্রস্তুতি ডেস্ক';

  @override
  String get vidyaClearConversation => 'কথোপকথন মুছুন';

  @override
  String get vidyaFlowVisualAid => 'ভিজ্যুয়াল সহায়ক';

  @override
  String get vidyaFlowVirtualFieldTrip => 'ভার্চুয়াল ফিল্ড ট্রিপ';

  @override
  String get vidyaFlowVideoStoryteller => 'ভিডিও গল্প';

  @override
  String get vidyaFieldMicLabel => 'বলে পূরণ করুন';

  @override
  String get vidyaFieldMicFailed =>
      'শুনতে পাইনি। আবার চেষ্টা করুন বা টাইপ করুন।';

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
  String get parentHotlineRosterUnavailableTitle =>
      'আপনার শ্রেণির তালিকা এখনও পাওয়া যাচ্ছে না';

  @override
  String get parentHotlineRosterUnavailableBody =>
      'আমরা এখনও এখানে আপনার শিক্ষার্থীদের লোড করতে পারছি না। এটি পরবর্তী কোনো আপডেটে আসবে। আপনি ইতিমধ্যে সাইন ইন করা আছেন, তাই আপনাকে কিছু ঠিক করতে হবে না।';

  @override
  String get parentHotlineRosterEmptyTitle =>
      'আপনার তালিকায় এখনও কোনও শিক্ষার্থী নেই';

  @override
  String get parentHotlineRosterEmptyBody =>
      'কোনও শ্রেণিতে শিক্ষার্থী যোগ করুন, তারা এখানে দেখা যাবে এবং বাড়িতে কল করার জন্য প্রস্তুত থাকবে।';

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
  String get parentHotlineTelephonyUnavailable =>
      'এখন কল করা যাচ্ছে না। আপনি বার্তাটি কপি করে WhatsApp এ পাঠাতে পারেন।';

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
  String videoStorytellerViewAll(int count) {
    return 'সব $countটি দেখুন';
  }

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
  String get inboxComposerTooLong =>
      'বার্তাটি খুব দীর্ঘ। অনুগ্রহ করে ছোট করুন।';

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
  String get networkTabUpdates => 'আপডেট';

  @override
  String get notificationsEmptyTitle => 'এখনও নতুন কিছু নেই';

  @override
  String get notificationsEmptyBody =>
      'কলের ফলাফল, উপস্থিতির সতর্কতা এবং তৈরি হয়ে যাওয়া প্রশ্নপত্র এখানে আসতে থাকবে।';

  @override
  String get notificationsLocalNote =>
      'অ্যাপ খুললে এগুলি দেখা যায়। SahayakAI এখনও ফোনে বিজ্ঞপ্তি পাঠাতে পারে না।';

  @override
  String get notificationsMarkAllRead => 'সবগুলিকে পড়া হিসেবে চিহ্নিত করুন';

  @override
  String notificationCallCompletedTitle(String student) {
    return '$student এর জন্য অভিভাবককে কল শেষ হয়েছে';
  }

  @override
  String get notificationCallCompletedBody =>
      'কথোপকথনের সারসংক্ষেপ অভিভাবককে কল অংশে তৈরি আছে।';

  @override
  String notificationCallFailedTitle(String student) {
    return '$student এর জন্য অভিভাবককে কল যুক্ত হয়নি';
  }

  @override
  String get notificationCallFailedBody =>
      'আবার কল করুন, অথবা বার্তাটি WhatsApp এ পাঠান।';

  @override
  String notificationAbsenceTitle(String student, int count) {
    return '$student টানা $count দিন অনুপস্থিত';
  }

  @override
  String notificationAbsenceBody(String className) {
    return 'বাদ পড়া দিনগুলি দেখতে $className খুলুন।';
  }

  @override
  String notificationExamPaperTitle(String subject) {
    return '$subject বিষয়ের প্রশ্নপত্র তৈরি হচ্ছে';
  }

  @override
  String get notificationExamPaperBody =>
      'এটি এখনও তৈরি হচ্ছে এবং নিজে থেকেই আপনার লাইব্রেরিতে চলে আসবে।';

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

  @override
  String get actionShare => 'শেয়ার করুন';

  @override
  String get resultSaveToLibrary => 'লাইব্রেরিতে সংরক্ষণ করুন';

  @override
  String get resultSaving => 'সংরক্ষণ হচ্ছে';

  @override
  String get resultSaved => 'আপনার লাইব্রেরিতে সংরক্ষিত হয়েছে';

  @override
  String get resultSaveFailedTitle => 'সংরক্ষণ করা যায়নি';

  @override
  String get resultSaveFailedBody =>
      'আমরা এটি আপনার লাইব্রেরিতে সংরক্ষণ করতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get resultSaveRetry => 'আবার সংরক্ষণের চেষ্টা করুন';

  @override
  String get resultShareFailed =>
      'শেয়ার করা যায়নি। তার বদলে লেখাটি ক্লিপবোর্ডে কপি করা হয়েছে।';

  @override
  String get actionCancel => 'বাতিল করুন';

  @override
  String get attendanceTitle => 'উপস্থিতি';

  @override
  String get attendanceClassesEyebrow => 'আপনার ক্লাসগুলি';

  @override
  String get attendanceClassesIntro => 'রেজিস্টার লিখতে একটি ক্লাস বেছে নিন।';

  @override
  String get attendanceClassesEmptyTitle => 'এখনও কোনও ক্লাস নেই';

  @override
  String get attendanceClassesEmptyBody =>
      'প্রথমে আপনার ক্লাস তৈরি করুন, তারপর তাতে শিক্ষার্থী যোগ করুন।';

  @override
  String get attendanceClassesError => 'আমরা আপনার ক্লাসগুলি আনতে পারিনি।';

  @override
  String get attendanceClassFullBadge => 'পূর্ণ';

  @override
  String get attendanceNewClass => 'নতুন ক্লাস';

  @override
  String get attendanceOpenRegister => 'রেজিস্টার লিখুন';

  @override
  String get attendanceOpenRoster => 'শিক্ষার্থীরা';

  @override
  String get attendanceOpenMonth => 'এই মাস';

  @override
  String get attendanceSignedOutTitle => 'আপনার ক্লাস দেখতে সাইন ইন করুন';

  @override
  String get attendanceSignedOutBody =>
      'আপনার ক্লাস ও রেজিস্টার আপনার অ্যাকাউন্টে সংরক্ষিত থাকে। সাইন ইন করলেই সেগুলি এখানে দেখা যাবে।';

  @override
  String get attendanceClassNameLabel => 'ক্লাসের নাম';

  @override
  String get attendanceClassNameHint => 'যেমন, ক্লাস 6A';

  @override
  String get attendanceClassNameRequired => 'ক্লাসের নাম লিখুন।';

  @override
  String get attendanceSubjectLabel => 'বিষয়';

  @override
  String get attendanceGradeLabel => 'শ্রেণি স্তর';

  @override
  String get attendanceAcademicYearLabel => 'শিক্ষাবর্ষ';

  @override
  String get attendanceAcademicYearHint => 'যেমন, 2026-27';

  @override
  String get attendanceAcademicYearRequired => 'শিক্ষাবর্ষ লিখুন।';

  @override
  String get attendanceSectionLabel => 'শাখা';

  @override
  String get attendanceSectionHint => 'যেমন, A';

  @override
  String get attendanceCreateClassSubmit => 'ক্লাস তৈরি করুন';

  @override
  String get attendanceClassCreated => 'ক্লাস তৈরি হয়েছে।';

  @override
  String get attendanceCreateClassFailed => 'আমরা এই ক্লাসটি তৈরি করতে পারিনি।';

  @override
  String get attendanceRosterEyebrow => 'ক্লাসের তালিকা';

  @override
  String get attendanceRosterUnavailableTitle =>
      'তালিকাটি এখনও দেখানোর জন্য প্রস্তুত নয়';

  @override
  String get attendanceRosterUnavailableBody =>
      'অভিভাবকদের যোগাযোগের তথ্য আমাদের সার্ভারে ঢাকা রূপে সরানো হচ্ছে, এবং সেটি চালু না হওয়া পর্যন্ত এই অ্যাপ সেগুলি নামাবে না। আপনার ক্লাসে কোনও গোলমাল নেই এবং কিছুই হারায়নি। রেজিস্টার লেখা ও মাসিক হিসাব আগের মতোই চলে।';

  @override
  String get attendanceRosterEmptyTitle => 'এখনও কোনও শিক্ষার্থী নেই';

  @override
  String get attendanceRosterEmptyBody =>
      'রেজিস্টার লেখা শুরু করতে এই ক্লাসের শিক্ষার্থীদের যোগ করুন।';

  @override
  String get attendanceRosterError => 'আমরা এই তালিকাটি আনতে পারিনি।';

  @override
  String attendanceRollLabel(int roll) {
    return 'রোল $roll';
  }

  @override
  String get attendanceNoParentPhone => 'অভিভাবকের নম্বর সংরক্ষিত নেই';

  @override
  String attendanceParentPhoneMask(String last4) {
    return '•••• $last4';
  }

  @override
  String get attendanceAddStudent => 'শিক্ষার্থী যোগ করুন';

  @override
  String get attendanceStudentNameLabel => 'শিক্ষার্থীর নাম';

  @override
  String get attendanceStudentNameRequired => 'শিক্ষার্থীর নাম লিখুন।';

  @override
  String get attendanceRollNumberLabel => 'রোল নম্বর';

  @override
  String get attendanceRollNumberHint => '1 থেকে 40';

  @override
  String get attendanceRollNumberInvalid =>
      'রোল নম্বর 1 থেকে 40 এর মধ্যে পূর্ণ সংখ্যা হতে হবে।';

  @override
  String get attendanceParentPhoneLabel => 'অভিভাবকের মোবাইল নম্বর';

  @override
  String get attendanceParentPhoneHint => '10 অঙ্কের ভারতীয় মোবাইল নম্বর';

  @override
  String get attendanceParentPhoneRequired => 'অভিভাবকের মোবাইল নম্বর লিখুন।';

  @override
  String get attendanceParentPhoneInvalid =>
      '10 অঙ্কের ভারতীয় মোবাইল নম্বর লিখুন।';

  @override
  String get attendanceParentLanguageLabel => 'অভিভাবকের ভাষা';

  @override
  String get attendanceParentPhonePrivacy =>
      'এই নম্বরটি SahayakAI-এ পাঠানো হয় যাতে আপনার হয়ে এই অভিভাবককে কল করা যায়। এটি কখনও এই ফোনে ফিরিয়ে নামানো হয় না।';

  @override
  String get attendanceStudentAdded => 'শিক্ষার্থী যোগ হয়েছে।';

  @override
  String get attendanceAddStudentFailed =>
      'আমরা এই শিক্ষার্থীকে যোগ করতে পারিনি।';

  @override
  String get attendanceClassFullTitle => 'এই ক্লাসটি পূর্ণ';

  @override
  String attendanceClassFullBody(int max) {
    return 'একটি ক্লাসে সর্বোচ্চ $max জন শিক্ষার্থী থাকতে পারে, তাই আর যোগ করা যাবে না।';
  }

  @override
  String get attendanceMarkEyebrow => 'দৈনিক রেজিস্টার';

  @override
  String get attendanceMarkIntro =>
      'আজ, বা তার আগের সাত দিনের যেকোনও দিন লিখুন।';

  @override
  String get attendanceDateToday => 'আজ';

  @override
  String get attendanceDateYesterday => 'গতকাল';

  @override
  String get attendanceWindowNote =>
      'রেজিস্টার আজ এবং তার আগের সাত দিনের জন্য খোলা থাকে। তার চেয়ে পুরনো দিন বন্ধ হয়ে যায়।';

  @override
  String get attendanceStatusPresent => 'উপস্থিত';

  @override
  String get attendanceStatusAbsent => 'অনুপস্থিত';

  @override
  String get attendanceStatusLate => 'দেরিতে';

  @override
  String get attendanceStatusUnmarked => 'লেখা হয়নি';

  @override
  String attendanceMarkProgress(int marked, int total) {
    return '$total জনের মধ্যে $marked জন লেখা হয়েছে';
  }

  @override
  String get attendanceMarkAllPresent => 'সবাইকে উপস্থিত করুন';

  @override
  String get attendanceSaveRegister => 'রেজিস্টার সংরক্ষণ করুন';

  @override
  String get attendanceRegisterSaved => 'রেজিস্টার সংরক্ষিত হয়েছে।';

  @override
  String get attendanceSaveRegisterFailed =>
      'আমরা এই রেজিস্টারটি সংরক্ষণ করতে পারিনি।';

  @override
  String get attendanceRegisterError => 'আমরা এই রেজিস্টারটি আনতে পারিনি।';

  @override
  String get attendanceNoStudentsTitle => 'এই ক্লাসে এখনও কোনও শিক্ষার্থী নেই';

  @override
  String get attendanceNoStudentsBody =>
      'রেজিস্টার লেখার আগে শিক্ষার্থী যোগ করুন।';

  @override
  String get attendanceMonthEyebrow => 'মাসিক উপস্থিতি';

  @override
  String get attendanceMonthError => 'আমরা এই মাসের হিসাব আনতে পারিনি।';

  @override
  String get attendanceMonthEmptyTitle => 'এই মাসে কিছু লেখা হয়নি';

  @override
  String get attendanceMonthEmptyBody =>
      'রেজিস্টার লেখা শুরু করলেই প্রতিটি শিক্ষার্থীর মাস এখানে দেখা যাবে।';

  @override
  String get attendanceMonthPrevious => 'আগের মাস';

  @override
  String get attendanceMonthNext => 'পরের মাস';

  @override
  String get attendanceAbsencesTitle => 'অনুপস্থিত দিনগুলি';

  @override
  String get attendanceAbsencesEmpty => 'এই মাসে কোনও অনুপস্থিতি নেই।';

  @override
  String get attendanceAbsencesError => 'আমরা অনুপস্থিত দিনগুলি আনতে পারিনি।';

  @override
  String get attendancePremiumTitle => 'রেজিস্টার লেখার জন্য Pro প্ল্যান দরকার';

  @override
  String get attendancePremiumBody =>
      'আপনার ক্লাস, রেজিস্টার ও মাসিক হিসাব দেখা বিনামূল্যেই থাকে। ক্লাস তৈরি করা, শিক্ষার্থী যোগ করা ও রেজিস্টার সংরক্ষণ করা Pro প্ল্যানের অংশ।';

  @override
  String get deliverTrayTitle => 'পৌঁছে দিন';

  @override
  String get deliverPrivacyNote =>
      'আপনি পাঠান-এ চাপ না দেওয়া পর্যন্ত ফোন থেকে কিছুই বের হয় না।';

  @override
  String get deliverSend => 'পাঠান';

  @override
  String get deliverParentGroup => 'অভিভাবক গোষ্ঠী';

  @override
  String get deliverParentGroupMeta => 'WhatsApp-এ শেয়ার করুন';

  @override
  String get deliverPrint => 'প্রিন্ট করুন';

  @override
  String get deliverPrintMeta => 'প্রিন্টারে পাঠান';

  @override
  String get deliverSaveToClass => 'ক্লাসে সংরক্ষণ করুন';

  @override
  String get deliverSaveToClassMeta => 'আপনার লাইব্রেরিতে রাখুন';

  @override
  String get deliverPostCommunity => 'কমিউনিটিতে পোস্ট করুন';

  @override
  String get deliverPostCommunityMeta => 'রিসোর্স হিসেবে শেয়ার করুন';

  @override
  String get deliverDownloadPdf => 'PDF ডাউনলোড করুন';

  @override
  String get deliverDownloadPdfMeta => 'অফলাইনে কাজ করে';

  @override
  String get deliverReadAloud => 'সরবে পড়ুন';

  @override
  String get deliverReadAloudMeta => 'ক্লাসের জন্য';

  @override
  String get settingsOrbHandTitle => 'ভাসমান সহায়ক';

  @override
  String get settingsOrbHandLabel => 'বাঁ দিকে';

  @override
  String get settingsOrbHandHint =>
      'আপনার বুড়ো আঙুল যেখানে পৌঁছায় সেখানে VIDYA রাখুন';

  @override
  String get scanRemedialBody =>
      'যেসব ধারণায় সমস্যা হয়েছে, সেগুলোর জন্য আমি একটি অনুশীলন পত্র তৈরি করতে পারি।';

  @override
  String get scanRemedialBuild => 'অনুশীলন পত্র তৈরি করুন';

  @override
  String get scanRemedialMessageParents => 'অভিভাবকদের বার্তা পাঠান';

  @override
  String get communityFilterAll => 'সব';

  @override
  String get communityFilterPosts => 'পোস্ট';

  @override
  String get communityFilterResources => 'রিসোর্স';

  @override
  String get communityFilterHighlights => 'হাইলাইট';

  @override
  String get attendanceVoiceRollCall => 'নামগুলো সরবে পড়ুন';

  @override
  String get attendanceVoiceListeningTitle => 'শুনছি…';

  @override
  String get attendanceVoiceListeningBody =>
      'আপনার ক্লাসের হাজিরা সরবে পড়ুন। আমি প্রতিটি নাম উপস্থিত হিসেবে চিহ্নিত করব; কোনোটি বদলাতে \'অনুপস্থিত\' বা \'দেরি\' বলুন।';

  @override
  String get attendanceVoiceWorking => 'এক মুহূর্ত…';

  @override
  String get attendanceVoiceWorkingBody =>
      'আপনি যা বলেছেন তা থেকে হাজিরা চিহ্নিত করছি।';

  @override
  String get attendanceVoiceMicOffTitle => 'মাইক্রোফোন দরকার';

  @override
  String get attendanceVoiceMicOffBody =>
      'কণ্ঠে হাজিরা নিতে মাইক্রোফোনের অনুমতি দিন।';

  @override
  String get attendanceVoiceFailedTitle => 'বুঝতে পারিনি';

  @override
  String get attendanceVoiceFailedBody =>
      'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।';

  @override
  String get attendanceVoiceNone =>
      'আমি কোনো নাম বুঝতে পারিনি। আবার চেষ্টা করুন।';

  @override
  String attendanceVoiceMarked(int count) {
    return '$countটি নাম চিহ্নিত করা হয়েছে।';
  }
}
