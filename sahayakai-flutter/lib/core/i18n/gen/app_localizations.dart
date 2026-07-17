import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_bn.dart';
import 'app_localizations_en.dart';
import 'app_localizations_gu.dart';
import 'app_localizations_hi.dart';
import 'app_localizations_kn.dart';
import 'app_localizations_ml.dart';
import 'app_localizations_mr.dart';
import 'app_localizations_or.dart';
import 'app_localizations_pa.dart';
import 'app_localizations_ta.dart';
import 'app_localizations_te.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'gen/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('bn'),
    Locale('en'),
    Locale('gu'),
    Locale('hi'),
    Locale('kn'),
    Locale('ml'),
    Locale('mr'),
    Locale('or'),
    Locale('pa'),
    Locale('ta'),
    Locale('te'),
  ];

  /// Application name (brand).
  ///
  /// In en, this message translates to:
  /// **'SahayakAI'**
  String get appTitle;

  /// Bottom-nav label: dashboard home tab.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// Bottom-nav label: opens the create/command palette.
  ///
  /// In en, this message translates to:
  /// **'Create'**
  String get navCreate;

  /// Bottom-nav label: saved generations.
  ///
  /// In en, this message translates to:
  /// **'Library'**
  String get navLibrary;

  /// Bottom-nav label: profile / account tab.
  ///
  /// In en, this message translates to:
  /// **'Me'**
  String get navProfile;

  /// Retry a failed action.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get actionRetry;

  /// Sign out of the account.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get actionSignOut;

  /// Submit an AI tool form.
  ///
  /// In en, this message translates to:
  /// **'Generate'**
  String get actionGenerate;

  /// Shown when the device has no network.
  ///
  /// In en, this message translates to:
  /// **'You are offline'**
  String get stateOfflineTitle;

  /// Offline state helper text.
  ///
  /// In en, this message translates to:
  /// **'Check your connection and try again.'**
  String get stateOfflineBody;

  /// Generic error message.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get errorGeneric;

  /// Default empty/idle state for a tool.
  ///
  /// In en, this message translates to:
  /// **'Fill in the form and tap Generate.'**
  String get emptyDefault;

  /// Label for the language switcher.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get languageLabel;

  /// Splash-screen tagline under the brand mark.
  ///
  /// In en, this message translates to:
  /// **'Teaching assistant for every classroom'**
  String get splashTagline;

  /// Splash: heading when the first-run bootstrap (Firebase init / App Check / first auth snapshot) fails.
  ///
  /// In en, this message translates to:
  /// **'We could not start the app'**
  String get splashFailedTitle;

  /// Splash: body when the bootstrap fails. The retry re-runs it.
  ///
  /// In en, this message translates to:
  /// **'Please check your connection and try again.'**
  String get splashFailedBody;

  /// Login screen heading.
  ///
  /// In en, this message translates to:
  /// **'Welcome to SahayakAI'**
  String get loginTitle;

  /// Login screen subheading.
  ///
  /// In en, this message translates to:
  /// **'Sign in to plan lessons, quizzes and more.'**
  String get loginSubtitle;

  /// Login: the Google sign-in button label.
  ///
  /// In en, this message translates to:
  /// **'Continue with Google'**
  String get loginGoogle;

  /// Login: reassurance under the sign-in button.
  ///
  /// In en, this message translates to:
  /// **'We use your Google account only to sign you in. Your work stays yours.'**
  String get loginPrivacyNote;

  /// Login: label above the language picker, which is step 0 of setup.
  ///
  /// In en, this message translates to:
  /// **'Choose your language'**
  String get loginLanguagePrompt;

  /// Login: helper text under the language picker.
  ///
  /// In en, this message translates to:
  /// **'SahayakAI works in your language, and writes your teaching material in it too.'**
  String get loginLanguageHint;

  /// Login: one of three capability lines shown before sign-in.
  ///
  /// In en, this message translates to:
  /// **'Plan a full lesson in minutes'**
  String get loginValueLessons;

  /// Login: one of three capability lines shown before sign-in.
  ///
  /// In en, this message translates to:
  /// **'Build a quiz at three difficulty levels'**
  String get loginValueQuizzes;

  /// Login: one of three capability lines shown before sign-in.
  ///
  /// In en, this message translates to:
  /// **'Answer any classroom question, in your language'**
  String get loginValueAnswers;

  /// Onboarding: app bar title.
  ///
  /// In en, this message translates to:
  /// **'Set up SahayakAI'**
  String get onboardingTitle;

  /// Onboarding: skip action, present on every step. Onboarding is never a gate.
  ///
  /// In en, this message translates to:
  /// **'Skip for now'**
  String get onboardingSkip;

  /// Onboarding: step progress label.
  ///
  /// In en, this message translates to:
  /// **'Step {current} of {total}'**
  String onboardingStepLabel(int current, int total);

  /// Onboarding: previous-step action.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get onboardingBack;

  /// Onboarding: next-step action.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get onboardingNext;

  /// Onboarding: saves the profile then moves to the last step.
  ///
  /// In en, this message translates to:
  /// **'Save and continue'**
  String get onboardingSaveAndContinue;

  /// Onboarding: final action on the last step.
  ///
  /// In en, this message translates to:
  /// **'Go to my dashboard'**
  String get onboardingFinish;

  /// Onboarding step 0: language picker heading.
  ///
  /// In en, this message translates to:
  /// **'Which language do you teach in?'**
  String get onboardingLanguageTitle;

  /// Onboarding step 0: language picker body.
  ///
  /// In en, this message translates to:
  /// **'Your lesson plans, quizzes and answers arrive in the language you choose. You can change it at any time.'**
  String get onboardingLanguageBody;

  /// Onboarding step 1: profile form heading.
  ///
  /// In en, this message translates to:
  /// **'Tell us about your classroom'**
  String get onboardingProfileTitle;

  /// Onboarding step 1: profile form body.
  ///
  /// In en, this message translates to:
  /// **'Every field is optional. What you share is used to match your material to your board, your classes and your state.'**
  String get onboardingProfileBody;

  /// Onboarding step 2: closing heading.
  ///
  /// In en, this message translates to:
  /// **'You are ready to begin'**
  String get onboardingReadyTitle;

  /// Onboarding step 2: body above the summary of what the teacher just set up.
  ///
  /// In en, this message translates to:
  /// **'Your lesson plans, quizzes and answers will match this. You can change any of it later from your profile.'**
  String get onboardingReadyBody;

  /// Onboarding: save failure. It never blocks the teacher from continuing.
  ///
  /// In en, this message translates to:
  /// **'We could not save your profile. You can continue now and add it later from your profile.'**
  String get onboardingSaveFailed;

  /// Onboarding: save failed with a 401.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again to save your profile. You can continue now and add it later.'**
  String get onboardingSaveSignIn;

  /// Dashboard greeting.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get dashboardGreeting;

  /// Dashboard: greeting once the teacher name is known.
  ///
  /// In en, this message translates to:
  /// **'Welcome back, {name}'**
  String dashboardGreetingNamed(String name);

  /// Dashboard tools section header.
  ///
  /// In en, this message translates to:
  /// **'Your teaching tools'**
  String get dashboardToolsTitle;

  /// Dashboard: recent saved items section header.
  ///
  /// In en, this message translates to:
  /// **'Recent work'**
  String get dashboardRecentTitle;

  /// Dashboard: recent list empty state.
  ///
  /// In en, this message translates to:
  /// **'Anything you make is saved here, ready to open again.'**
  String get dashboardRecentEmpty;

  /// Dashboard: recent list error state.
  ///
  /// In en, this message translates to:
  /// **'We could not open your recent work. Please try again.'**
  String get dashboardRecentFailed;

  /// Dashboard: recent list 401 state.
  ///
  /// In en, this message translates to:
  /// **'Sign in to see your recent work.'**
  String get dashboardRecentSignedOut;

  /// Dashboard: fallback for a saved item with no title.
  ///
  /// In en, this message translates to:
  /// **'Untitled'**
  String get dashboardUntitled;

  /// Dashboard: profile nudge heading. A nudge, never a gate.
  ///
  /// In en, this message translates to:
  /// **'Finish setting up your profile'**
  String get dashboardSetupTitle;

  /// Dashboard: profile nudge body.
  ///
  /// In en, this message translates to:
  /// **'Add your school and your classes, and every lesson plan and quiz will arrive ready for your classroom.'**
  String get dashboardSetupBody;

  /// Dashboard: profile nudge action, opens onboarding.
  ///
  /// In en, this message translates to:
  /// **'Set up my profile'**
  String get dashboardSetupAction;

  /// Dashboard: dismisses the profile nudge.
  ///
  /// In en, this message translates to:
  /// **'Not now'**
  String get dashboardSetupDismiss;

  /// Saved content type label: lesson-plan.
  ///
  /// In en, this message translates to:
  /// **'Lesson plan'**
  String get contentTypeLessonPlan;

  /// Saved content type label: quiz.
  ///
  /// In en, this message translates to:
  /// **'Quiz'**
  String get contentTypeQuiz;

  /// Saved content type label: worksheet.
  ///
  /// In en, this message translates to:
  /// **'Worksheet'**
  String get contentTypeWorksheet;

  /// Saved content type label: visual-aid.
  ///
  /// In en, this message translates to:
  /// **'Visual aid'**
  String get contentTypeVisualAid;

  /// Saved content type label: rubric.
  ///
  /// In en, this message translates to:
  /// **'Rubric'**
  String get contentTypeRubric;

  /// Saved content type label: micro-lesson.
  ///
  /// In en, this message translates to:
  /// **'Micro lesson'**
  String get contentTypeMicroLesson;

  /// Saved content type label: virtual-field-trip.
  ///
  /// In en, this message translates to:
  /// **'Virtual field trip'**
  String get contentTypeVirtualFieldTrip;

  /// Saved content type label: instant-answer.
  ///
  /// In en, this message translates to:
  /// **'Instant answer'**
  String get contentTypeInstantAnswer;

  /// Saved content type label: teacher-training.
  ///
  /// In en, this message translates to:
  /// **'Teacher training'**
  String get contentTypeTeacherTraining;

  /// Saved content type label: exam-paper.
  ///
  /// In en, this message translates to:
  /// **'Exam paper'**
  String get contentTypeExamPaper;

  /// Saved content type label: assessment.
  ///
  /// In en, this message translates to:
  /// **'Assessment'**
  String get contentTypeAssessment;

  /// Saved content type label for a type this build does not know. The row still renders: it is the teacher own work.
  ///
  /// In en, this message translates to:
  /// **'Saved work'**
  String get contentTypeUnknown;

  /// Library screen title.
  ///
  /// In en, this message translates to:
  /// **'My Library'**
  String get libraryTitle;

  /// Library empty state.
  ///
  /// In en, this message translates to:
  /// **'Your saved lesson plans and quizzes will appear here.'**
  String get libraryEmpty;

  /// Action on the Library empty state; opens the lesson planner.
  ///
  /// In en, this message translates to:
  /// **'Create a lesson plan'**
  String get libraryEmptyAction;

  /// Library state when the saved-work read has no identity (401).
  ///
  /// In en, this message translates to:
  /// **'Sign in to see your saved work.'**
  String get librarySignedOut;

  /// Library state when the saved-work read fails.
  ///
  /// In en, this message translates to:
  /// **'Your library could not be loaded.'**
  String get libraryLoadFailed;

  /// Library footer note. The list route takes a limit and no cursor, so there is no next page to offer.
  ///
  /// In en, this message translates to:
  /// **'Showing your 20 most recent items.'**
  String get libraryNewestOnly;

  /// Profile screen title.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profileTitle;

  /// Lesson Plan tool title (app bar and dashboard tile).
  ///
  /// In en, this message translates to:
  /// **'Lesson Plan'**
  String get lessonPlanTitle;

  /// Lesson Plan dashboard tile subtitle.
  ///
  /// In en, this message translates to:
  /// **'Plan a full 5E lesson'**
  String get lessonPlanSubtitle;

  /// Lesson Plan idle/empty state before generating.
  ///
  /// In en, this message translates to:
  /// **'Add a topic and tap Generate to build a 5E lesson plan.'**
  String get lessonPlanEmpty;

  /// Label for the required lesson topic field.
  ///
  /// In en, this message translates to:
  /// **'Topic'**
  String get lessonPlanTopicLabel;

  /// Placeholder for the lesson topic field.
  ///
  /// In en, this message translates to:
  /// **'For example, Photosynthesis'**
  String get lessonPlanTopicHint;

  /// Validation shown when the topic field is empty.
  ///
  /// In en, this message translates to:
  /// **'Please enter a topic to plan.'**
  String get lessonPlanTopicError;

  /// Label for the multi-select grade levels chips.
  ///
  /// In en, this message translates to:
  /// **'Grade levels'**
  String get lessonPlanGradeLabel;

  /// Label for the subject selector.
  ///
  /// In en, this message translates to:
  /// **'Subject'**
  String get lessonPlanSubjectLabel;

  /// Default option meaning no specific subject was chosen.
  ///
  /// In en, this message translates to:
  /// **'Any subject'**
  String get lessonPlanSubjectAny;

  /// Label for the resource-level segmented control.
  ///
  /// In en, this message translates to:
  /// **'Classroom resources'**
  String get lessonPlanResourceLabel;

  /// Resource level: few materials available.
  ///
  /// In en, this message translates to:
  /// **'Low'**
  String get lessonPlanResourceLow;

  /// Resource level: some materials available.
  ///
  /// In en, this message translates to:
  /// **'Medium'**
  String get lessonPlanResourceMedium;

  /// Resource level: well-equipped classroom.
  ///
  /// In en, this message translates to:
  /// **'High'**
  String get lessonPlanResourceHigh;

  /// Label for the difficulty segmented control.
  ///
  /// In en, this message translates to:
  /// **'Difficulty'**
  String get lessonPlanDifficultyLabel;

  /// Difficulty: for students who need extra support.
  ///
  /// In en, this message translates to:
  /// **'Remedial'**
  String get lessonPlanDifficultyRemedial;

  /// Difficulty: grade-appropriate level.
  ///
  /// In en, this message translates to:
  /// **'Standard'**
  String get lessonPlanDifficultyStandard;

  /// Difficulty: for students ready to be stretched.
  ///
  /// In en, this message translates to:
  /// **'Advanced'**
  String get lessonPlanDifficultyAdvanced;

  /// Toggle label for grounding the plan in rural context.
  ///
  /// In en, this message translates to:
  /// **'Use local, everyday examples'**
  String get lessonPlanRuralLabel;

  /// Helper text for the rural-context toggle.
  ///
  /// In en, this message translates to:
  /// **'Root activities in familiar rural and community settings.'**
  String get lessonPlanRuralHint;

  /// Marker on non-required form fields.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get lessonPlanOptional;

  /// Result section heading for objectives.
  ///
  /// In en, this message translates to:
  /// **'Learning objectives'**
  String get lessonPlanObjectives;

  /// Result section heading for vocabulary.
  ///
  /// In en, this message translates to:
  /// **'Key vocabulary'**
  String get lessonPlanVocabulary;

  /// Result section heading for materials.
  ///
  /// In en, this message translates to:
  /// **'Materials'**
  String get lessonPlanMaterials;

  /// Result section heading for the 5E activities.
  ///
  /// In en, this message translates to:
  /// **'5E activities'**
  String get lessonPlanActivities;

  /// Result section heading for assessment.
  ///
  /// In en, this message translates to:
  /// **'Assessment'**
  String get lessonPlanAssessment;

  /// Result section heading for homework.
  ///
  /// In en, this message translates to:
  /// **'Homework'**
  String get lessonPlanHomework;

  /// Label above an activity's teacher tip.
  ///
  /// In en, this message translates to:
  /// **'Teacher tip'**
  String get lessonPlanTeacherTip;

  /// Label above an activity's understanding check.
  ///
  /// In en, this message translates to:
  /// **'Check for understanding'**
  String get lessonPlanUnderstandingCheck;

  /// Heading of the lenient validation-warning banner.
  ///
  /// In en, this message translates to:
  /// **'A note before you begin'**
  String get lessonPlanNoteLabel;

  /// Title shown when the API returns 403 PLAN_UPGRADE_REQUIRED.
  ///
  /// In en, this message translates to:
  /// **'A higher plan is needed'**
  String get lessonPlanUpgradeTitle;

  /// Body for the upgrade-required state.
  ///
  /// In en, this message translates to:
  /// **'Lesson planning is part of a higher plan. Please upgrade to keep generating plans.'**
  String get lessonPlanUpgradeBody;

  /// Title shown when the API returns 429 usage/daily limit.
  ///
  /// In en, this message translates to:
  /// **'You have reached your limit'**
  String get lessonPlanLimitTitle;

  /// Body for the limit-reached state.
  ///
  /// In en, this message translates to:
  /// **'You have used your lesson plans for now. Please try again later or upgrade your plan.'**
  String get lessonPlanLimitBody;

  /// Shown on a 400 invalid-input response.
  ///
  /// In en, this message translates to:
  /// **'We could not build a plan from that. Please rephrase the topic and try again.'**
  String get lessonPlanRephrase;

  /// Shown on a 503 busy/quota response.
  ///
  /// In en, this message translates to:
  /// **'The assistant is busy right now. Please try again in a moment.'**
  String get lessonPlanBusy;

  /// Shown when the request times out.
  ///
  /// In en, this message translates to:
  /// **'This is taking longer than expected. Please try again.'**
  String get lessonPlanTimeout;

  /// Shown on a 401 unauthorized response.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again to use this tool.'**
  String get lessonPlanSignIn;

  /// Quiz Generator screen title and tool-tile title.
  ///
  /// In en, this message translates to:
  /// **'Quiz'**
  String get quizTitle;

  /// Quiz tool-tile subtitle on the dashboard and create palette.
  ///
  /// In en, this message translates to:
  /// **'Build a quiz in three difficulty levels'**
  String get quizSubtitle;

  /// Quiz idle/empty state before generating.
  ///
  /// In en, this message translates to:
  /// **'Add a topic and tap Generate to build a quiz.'**
  String get quizEmpty;

  /// Label for the quiz topic field.
  ///
  /// In en, this message translates to:
  /// **'Topic'**
  String get quizTopicLabel;

  /// Placeholder for the quiz topic field.
  ///
  /// In en, this message translates to:
  /// **'For example, Fractions'**
  String get quizTopicHint;

  /// Validation shown when the topic field is empty.
  ///
  /// In en, this message translates to:
  /// **'Please enter a topic for the quiz.'**
  String get quizTopicError;

  /// Label for the question-count stepper.
  ///
  /// In en, this message translates to:
  /// **'Number of questions'**
  String get quizNumQuestionsLabel;

  /// Tooltip on the stepper decrement button.
  ///
  /// In en, this message translates to:
  /// **'Fewer questions'**
  String get quizFewerQuestions;

  /// Tooltip on the stepper increment button.
  ///
  /// In en, this message translates to:
  /// **'More questions'**
  String get quizMoreQuestions;

  /// Label for the question-type chips.
  ///
  /// In en, this message translates to:
  /// **'Question types'**
  String get quizTypesLabel;

  /// Validation shown when no question type is selected.
  ///
  /// In en, this message translates to:
  /// **'Please choose at least one question type.'**
  String get quizTypesError;

  /// Question type: multiple_choice.
  ///
  /// In en, this message translates to:
  /// **'Multiple choice'**
  String get quizTypeMultipleChoice;

  /// Question type: fill_in_the_blanks.
  ///
  /// In en, this message translates to:
  /// **'Fill in the blanks'**
  String get quizTypeFillInTheBlanks;

  /// Question type: short_answer.
  ///
  /// In en, this message translates to:
  /// **'Short answer'**
  String get quizTypeShortAnswer;

  /// Question type: true_false.
  ///
  /// In en, this message translates to:
  /// **'True or false'**
  String get quizTypeTrueFalse;

  /// Label for the quiz grade dropdown.
  ///
  /// In en, this message translates to:
  /// **'Grade level'**
  String get quizGradeLabel;

  /// Dropdown entry that leaves the grade unset.
  ///
  /// In en, this message translates to:
  /// **'Any grade'**
  String get quizGradeAny;

  /// Label for the quiz subject dropdown.
  ///
  /// In en, this message translates to:
  /// **'Subject'**
  String get quizSubjectLabel;

  /// Dropdown entry that leaves the subject unset.
  ///
  /// In en, this message translates to:
  /// **'Any subject'**
  String get quizSubjectAny;

  /// Label for the target-difficulty chips.
  ///
  /// In en, this message translates to:
  /// **'Difficulty'**
  String get quizDifficultyLabel;

  /// Explains what the difficulty selector does.
  ///
  /// In en, this message translates to:
  /// **'Leave this on all levels to get an easy, a medium and a hard version.'**
  String get quizDifficultyHint;

  /// Difficulty chip that sends no targetDifficulty, returning all three variants.
  ///
  /// In en, this message translates to:
  /// **'All levels'**
  String get quizDifficultyAll;

  /// Difficulty: easy.
  ///
  /// In en, this message translates to:
  /// **'Easy'**
  String get quizDifficultyEasy;

  /// Difficulty: medium.
  ///
  /// In en, this message translates to:
  /// **'Medium'**
  String get quizDifficultyMedium;

  /// Difficulty: hard.
  ///
  /// In en, this message translates to:
  /// **'Hard'**
  String get quizDifficultyHard;

  /// Label for the Bloom's taxonomy chips.
  ///
  /// In en, this message translates to:
  /// **'Thinking skills'**
  String get quizBloomsLabel;

  /// Explains the Bloom's taxonomy selector in plain language.
  ///
  /// In en, this message translates to:
  /// **'Choose the kinds of thinking the questions should ask for.'**
  String get quizBloomsHint;

  /// Marks a quiz form field as optional.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get quizOptional;

  /// Question count shown in the result header meta row.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 question} other{{count} questions}}'**
  String quizQuestionCount(int count);

  /// Reveals one question’s correct answer.
  ///
  /// In en, this message translates to:
  /// **'Show answer'**
  String get quizShowAnswer;

  /// Hides one question’s correct answer again.
  ///
  /// In en, this message translates to:
  /// **'Hide answer'**
  String get quizHideAnswer;

  /// Reveals every answer in the selected difficulty.
  ///
  /// In en, this message translates to:
  /// **'Show all answers'**
  String get quizShowAllAnswers;

  /// Hides every answer in the selected difficulty.
  ///
  /// In en, this message translates to:
  /// **'Hide all answers'**
  String get quizHideAllAnswers;

  /// Label above a revealed correct answer.
  ///
  /// In en, this message translates to:
  /// **'Correct answer'**
  String get quizCorrectAnswer;

  /// Label above a revealed answer explanation.
  ///
  /// In en, this message translates to:
  /// **'Why'**
  String get quizExplanation;

  /// Heading of the model's teacher instructions block.
  ///
  /// In en, this message translates to:
  /// **'How to run this in class'**
  String get quizTeacherInstructions;

  /// Heading of the lenient validation-warning banner.
  ///
  /// In en, this message translates to:
  /// **'A note before you begin'**
  String get quizNoteLabel;

  /// Shown when the response carried no usable variants.
  ///
  /// In en, this message translates to:
  /// **'No questions came back for that topic. Please try a different topic.'**
  String get quizNoQuestions;

  /// Title shown when the API returns 403 PLAN_UPGRADE_REQUIRED.
  ///
  /// In en, this message translates to:
  /// **'A higher plan is needed'**
  String get quizUpgradeTitle;

  /// Body for the upgrade-required state.
  ///
  /// In en, this message translates to:
  /// **'Quiz generation is part of a higher plan. Please upgrade to keep building quizzes.'**
  String get quizUpgradeBody;

  /// Title shown when the API returns 429 usage/daily limit.
  ///
  /// In en, this message translates to:
  /// **'You have reached your limit'**
  String get quizLimitTitle;

  /// Body for the limit-reached state.
  ///
  /// In en, this message translates to:
  /// **'You have used your quizzes for now. Please try again later or upgrade your plan.'**
  String get quizLimitBody;

  /// Shown on a 400 invalid-input response.
  ///
  /// In en, this message translates to:
  /// **'We could not build a quiz from that. Please rephrase the topic and try again.'**
  String get quizRephrase;

  /// Shown on a 503 busy/quota response.
  ///
  /// In en, this message translates to:
  /// **'The assistant is busy right now. Please try again in a moment.'**
  String get quizBusy;

  /// Shown when the request times out.
  ///
  /// In en, this message translates to:
  /// **'This is taking longer than expected. Please try again.'**
  String get quizTimeout;

  /// Shown on a 401 unauthorized response.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again to use this tool.'**
  String get quizSignIn;

  /// Instant Answer screen title and tool-tile title.
  ///
  /// In en, this message translates to:
  /// **'Instant Answer'**
  String get instantAnswerTitle;

  /// Instant Answer tool-tile subtitle on the dashboard and create palette.
  ///
  /// In en, this message translates to:
  /// **'Ask any classroom question'**
  String get instantAnswerSubtitle;

  /// Submit button on the Instant Answer form.
  ///
  /// In en, this message translates to:
  /// **'Get answer'**
  String get instantAnswerAction;

  /// Instant Answer idle/empty state before asking.
  ///
  /// In en, this message translates to:
  /// **'Ask a question and tap Get answer.'**
  String get instantAnswerEmpty;

  /// Label for the required question field.
  ///
  /// In en, this message translates to:
  /// **'Your question'**
  String get instantAnswerQuestionLabel;

  /// Placeholder for the question field.
  ///
  /// In en, this message translates to:
  /// **'For example, Why does the moon change shape?'**
  String get instantAnswerQuestionHint;

  /// Validation shown when the question field is empty.
  ///
  /// In en, this message translates to:
  /// **'Please enter a question.'**
  String get instantAnswerQuestionError;

  /// Label for the Instant Answer grade dropdown.
  ///
  /// In en, this message translates to:
  /// **'Grade level'**
  String get instantAnswerGradeLabel;

  /// Dropdown entry that leaves the grade unset.
  ///
  /// In en, this message translates to:
  /// **'Any grade'**
  String get instantAnswerGradeAny;

  /// Label for the Instant Answer subject dropdown.
  ///
  /// In en, this message translates to:
  /// **'Subject'**
  String get instantAnswerSubjectLabel;

  /// Dropdown entry that leaves the subject unset.
  ///
  /// In en, this message translates to:
  /// **'Any subject'**
  String get instantAnswerSubjectAny;

  /// Marks an Instant Answer form field as optional.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get instantAnswerOptional;

  /// Title of the card that opens the model's videoSuggestionUrl.
  ///
  /// In en, this message translates to:
  /// **'Watch a related video'**
  String get instantAnswerVideoTitle;

  /// Tells the teacher where the video card leads before they leave the app.
  ///
  /// In en, this message translates to:
  /// **'Opens in your browser, outside the app.'**
  String get instantAnswerVideoBody;

  /// Shown when the response carried no usable answer text.
  ///
  /// In en, this message translates to:
  /// **'No answer came back for that question. Please rephrase it and try again.'**
  String get instantAnswerNoAnswer;

  /// Action on the limit and upgrade prompts; opens the pricing page.
  ///
  /// In en, this message translates to:
  /// **'See plans and pricing'**
  String get instantAnswerSeePricing;

  /// Title shown when the API returns 429 DAILY_LIMIT_REACHED.
  ///
  /// In en, this message translates to:
  /// **'That is all your questions for today'**
  String get instantAnswerDailyLimitTitle;

  /// Body for the daily-limit state. Retrying cannot help, so no retry is offered.
  ///
  /// In en, this message translates to:
  /// **'Your plan includes a set number of instant answers each day. Your questions reset tomorrow, or you can raise the daily limit on a higher plan.'**
  String get instantAnswerDailyLimitBody;

  /// Title shown when the API returns 429 USAGE_LIMIT_REACHED.
  ///
  /// In en, this message translates to:
  /// **'You have reached your limit'**
  String get instantAnswerLimitTitle;

  /// Body for the monthly usage-limit state.
  ///
  /// In en, this message translates to:
  /// **'You have used your instant answers for this month. Your questions reset next month, or you can raise the limit on a higher plan.'**
  String get instantAnswerLimitBody;

  /// Title shown when the API returns 403 PLAN_UPGRADE_REQUIRED.
  ///
  /// In en, this message translates to:
  /// **'A higher plan is needed'**
  String get instantAnswerUpgradeTitle;

  /// Body for the upgrade-required state.
  ///
  /// In en, this message translates to:
  /// **'Instant answers are part of a higher plan. Please upgrade to keep asking questions.'**
  String get instantAnswerUpgradeBody;

  /// Shown on a 400 invalid-input response.
  ///
  /// In en, this message translates to:
  /// **'We could not answer that. Please rephrase the question and try again.'**
  String get instantAnswerRephrase;

  /// Shown on a 503 busy response with no Retry-After.
  ///
  /// In en, this message translates to:
  /// **'The assistant is busy right now. Please try again in a moment.'**
  String get instantAnswerBusy;

  /// Shown on a 503 busy response that carried Retry-After.
  ///
  /// In en, this message translates to:
  /// **'{seconds, plural, =1{The assistant is busy right now. Please try again in about 1 second.} other{The assistant is busy right now. Please try again in about {seconds} seconds.}}'**
  String instantAnswerBusyRetryAfter(int seconds);

  /// Shown when the request times out.
  ///
  /// In en, this message translates to:
  /// **'This is taking longer than expected. Please try again.'**
  String get instantAnswerTimeout;

  /// Shown on a 401 unauthorized response.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again to use this tool.'**
  String get instantAnswerSignIn;

  /// Settings screen title and the tooltip on the gear action.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsTitle;

  /// Section header for the theme selector.
  ///
  /// In en, this message translates to:
  /// **'Appearance'**
  String get settingsAppearanceTitle;

  /// Theme option: follow the device light/dark setting.
  ///
  /// In en, this message translates to:
  /// **'Match my device'**
  String get settingsThemeSystem;

  /// Theme option: always light.
  ///
  /// In en, this message translates to:
  /// **'Light'**
  String get settingsThemeLight;

  /// Theme option: always dark.
  ///
  /// In en, this message translates to:
  /// **'Dark'**
  String get settingsThemeDark;

  /// Explains that the language choice drives both the UI and the AI output language.
  ///
  /// In en, this message translates to:
  /// **'Sets the app language and the language your teaching material is written in.'**
  String get settingsLanguageHint;

  /// Section header for the notifications switch.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get settingsNotificationsTitle;

  /// Label on the notifications switch.
  ///
  /// In en, this message translates to:
  /// **'Reminders and updates'**
  String get settingsNotificationsLabel;

  /// Helper text under the notifications switch.
  ///
  /// In en, this message translates to:
  /// **'Hear about new teaching tools and your saved work.'**
  String get settingsNotificationsHint;

  /// Section header for the board, qualifications and role fields.
  ///
  /// In en, this message translates to:
  /// **'Teaching profile'**
  String get settingsProfileTitle;

  /// Explains why the teaching profile fields are asked for.
  ///
  /// In en, this message translates to:
  /// **'This helps us match your material to your board and classroom.'**
  String get settingsProfileHint;

  /// Label for the education board dropdown.
  ///
  /// In en, this message translates to:
  /// **'Education board'**
  String get settingsBoardLabel;

  /// Dropdown entry that leaves the education board unset.
  ///
  /// In en, this message translates to:
  /// **'Not set'**
  String get settingsBoardNone;

  /// Label for the multi-select qualification chips.
  ///
  /// In en, this message translates to:
  /// **'Qualifications'**
  String get settingsQualificationsLabel;

  /// Helper text explaining the qualification chips are multi-select.
  ///
  /// In en, this message translates to:
  /// **'Choose every qualification you hold.'**
  String get settingsQualificationsHint;

  /// Label for the administrative role dropdown.
  ///
  /// In en, this message translates to:
  /// **'Administrative role'**
  String get settingsAdminRoleLabel;

  /// Dropdown entry that leaves the administrative role unset.
  ///
  /// In en, this message translates to:
  /// **'Not set'**
  String get settingsAdminRoleNone;

  /// Administrative role: hod.
  ///
  /// In en, this message translates to:
  /// **'Head of Department (HoD)'**
  String get settingsRoleHod;

  /// Administrative role: coordinator.
  ///
  /// In en, this message translates to:
  /// **'Academic Coordinator'**
  String get settingsRoleCoordinator;

  /// Administrative role: exam_controller.
  ///
  /// In en, this message translates to:
  /// **'Exam Controller'**
  String get settingsRoleExamController;

  /// Administrative role: vice_principal.
  ///
  /// In en, this message translates to:
  /// **'Vice Principal'**
  String get settingsRoleVicePrincipal;

  /// Administrative role: principal.
  ///
  /// In en, this message translates to:
  /// **'Principal'**
  String get settingsRolePrincipal;

  /// Administrative role: none. A deliberate answer, unlike 'Not set'.
  ///
  /// In en, this message translates to:
  /// **'Teacher, no administrative role'**
  String get settingsRoleNone;

  /// Submits the teaching profile fields.
  ///
  /// In en, this message translates to:
  /// **'Save profile'**
  String get settingsSaveProfile;

  /// Confirmation after a successful profile save.
  ///
  /// In en, this message translates to:
  /// **'Your teaching profile has been saved.'**
  String get settingsProfileSaved;

  /// Shown when the profile save request fails.
  ///
  /// In en, this message translates to:
  /// **'We could not save your profile. Please try again.'**
  String get settingsSaveFailed;

  /// Title of the card shown in place of the account sections when signed out.
  ///
  /// In en, this message translates to:
  /// **'You are signed out'**
  String get settingsSignedOutTitle;

  /// Body of the signed-out prompt card.
  ///
  /// In en, this message translates to:
  /// **'Sign in to manage your teaching profile and your account. Your language and appearance choices are saved on this device either way.'**
  String get settingsSignedOutBody;

  /// Action on the signed-out prompt card.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get settingsSignIn;

  /// Section header for the destructive account-deletion block.
  ///
  /// In en, this message translates to:
  /// **'Delete account'**
  String get settingsDangerTitle;

  /// Explains the consequences of account deletion before the teacher opens the dialog.
  ///
  /// In en, this message translates to:
  /// **'This closes your account and removes your saved work. You will have 30 days to export everything before it is deleted for good.'**
  String get settingsDangerBody;

  /// The destructive button that opens the typed-confirmation dialog.
  ///
  /// In en, this message translates to:
  /// **'Delete account'**
  String get settingsDeleteAction;

  /// Title of the typed-confirmation dialog.
  ///
  /// In en, this message translates to:
  /// **'Delete your account?'**
  String get settingsDeleteDialogTitle;

  /// Body of the typed-confirmation dialog.
  ///
  /// In en, this message translates to:
  /// **'Your lesson plans, quizzes and profile will be scheduled for deletion. You have 30 days to export your work before it is removed.'**
  String get settingsDeleteDialogBody;

  /// Tells the teacher which word unlocks the confirm button. The word itself is a safety token and stays in English.
  ///
  /// In en, this message translates to:
  /// **'Type {word} below to confirm.'**
  String settingsDeleteConfirmPrompt(String word);

  /// Accessible label for the typed-confirmation text field.
  ///
  /// In en, this message translates to:
  /// **'Confirmation'**
  String get settingsDeleteConfirmLabel;

  /// Dismisses the delete dialog without deleting.
  ///
  /// In en, this message translates to:
  /// **'Keep my account'**
  String get settingsDeleteCancel;

  /// The destructive confirm button, enabled only once the word is typed.
  ///
  /// In en, this message translates to:
  /// **'Delete account'**
  String get settingsDeleteConfirm;

  /// Confirmation after the deletion request succeeds.
  ///
  /// In en, this message translates to:
  /// **'Your account is scheduled for deletion. You have 30 days to export your work.'**
  String get settingsDeleteScheduled;

  /// Shown when the deletion request fails for a non-auth reason.
  ///
  /// In en, this message translates to:
  /// **'We could not delete your account. Please try again.'**
  String get settingsDeleteFailed;

  /// Title shown when delete-account returns 401 reauth_required.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again'**
  String get settingsReauthTitle;

  /// Body for the re-auth-required state on account deletion.
  ///
  /// In en, this message translates to:
  /// **'For your security, deleting an account needs a fresh sign-in. Please sign out, sign in again, and delete within five minutes.'**
  String get settingsReauthBody;

  /// Label for the plan badge on the Profile identity card.
  ///
  /// In en, this message translates to:
  /// **'Plan'**
  String get profilePlanLabel;

  /// Plan badge for the free tier.
  ///
  /// In en, this message translates to:
  /// **'Free'**
  String get profilePlanFree;

  /// Plan badge for the pro tier.
  ///
  /// In en, this message translates to:
  /// **'Pro'**
  String get profilePlanPro;

  /// Plan badge for the gold tier.
  ///
  /// In en, this message translates to:
  /// **'Gold'**
  String get profilePlanGold;

  /// Plan badge for the premium tier.
  ///
  /// In en, this message translates to:
  /// **'Premium'**
  String get profilePlanPremium;

  /// Plan badge when there is no signed-in token to read the plan claim from. Deliberately not 'Free': an unknown plan must not be stated as a fact.
  ///
  /// In en, this message translates to:
  /// **'Not available'**
  String get profilePlanUnknown;

  /// Identity card heading when the teacher has not set a display name yet.
  ///
  /// In en, this message translates to:
  /// **'Your profile'**
  String get profileNoName;

  /// Section header for name and school fields.
  ///
  /// In en, this message translates to:
  /// **'About you'**
  String get profileSectionAbout;

  /// Section header for board, subjects and classes.
  ///
  /// In en, this message translates to:
  /// **'What you teach'**
  String get profileSectionTeaching;

  /// Section header for state, district and PIN code.
  ///
  /// In en, this message translates to:
  /// **'Where you teach'**
  String get profileSectionLocation;

  /// Section header for the phone number field.
  ///
  /// In en, this message translates to:
  /// **'How we reach you'**
  String get profileSectionContact;

  /// Label for the display name field.
  ///
  /// In en, this message translates to:
  /// **'Your name'**
  String get profileNameLabel;

  /// Helper text for the display name field.
  ///
  /// In en, this message translates to:
  /// **'This is the name other teachers see on work you share.'**
  String get profileNameHint;

  /// Validation error when the display name exceeds the length limit.
  ///
  /// In en, this message translates to:
  /// **'Please use a shorter name.'**
  String get profileNameInvalid;

  /// Label for the school name field.
  ///
  /// In en, this message translates to:
  /// **'School name'**
  String get profileSchoolLabel;

  /// Label for the coarse board-family picker that narrows the board list.
  ///
  /// In en, this message translates to:
  /// **'Board type'**
  String get profileBoardCategoryLabel;

  /// Helper text for the board category chips.
  ///
  /// In en, this message translates to:
  /// **'Choose a board type to shorten the list below.'**
  String get profileBoardCategoryHint;

  /// The state-board option in the board type picker. CBSE and ICSE / ISC are proper nouns and are not translated.
  ///
  /// In en, this message translates to:
  /// **'State board'**
  String get profileBoardCategoryState;

  /// Label for the state picker.
  ///
  /// In en, this message translates to:
  /// **'State'**
  String get profileStateLabel;

  /// The unset option in the state picker.
  ///
  /// In en, this message translates to:
  /// **'Not set'**
  String get profileStateNone;

  /// Label for the district field.
  ///
  /// In en, this message translates to:
  /// **'District'**
  String get profileDistrictLabel;

  /// Helper text for the district field.
  ///
  /// In en, this message translates to:
  /// **'The district your school is in.'**
  String get profileDistrictHint;

  /// Label for the multi-select subject chips.
  ///
  /// In en, this message translates to:
  /// **'Subjects you teach'**
  String get profileSubjectsLabel;

  /// Helper text for the subject chips.
  ///
  /// In en, this message translates to:
  /// **'Choose as many as you need.'**
  String get profileSubjectsHint;

  /// Label for the multi-select grade-level chips.
  ///
  /// In en, this message translates to:
  /// **'Classes you teach'**
  String get profileGradesLabel;

  /// Helper text for the grade-level chips.
  ///
  /// In en, this message translates to:
  /// **'Choose as many as you need.'**
  String get profileGradesHint;

  /// Explains that the profile language field is the app's single language source of truth, not a second setting.
  ///
  /// In en, this message translates to:
  /// **'This is the same language choice as the rest of the app, so changing it here changes it everywhere.'**
  String get profileLanguageHint;

  /// Label for the phone number field.
  ///
  /// In en, this message translates to:
  /// **'Mobile number'**
  String get profilePhoneLabel;

  /// Helper text for the phone number field.
  ///
  /// In en, this message translates to:
  /// **'Optional. Ten digits, with or without +91.'**
  String get profilePhoneHint;

  /// Validation error for a phone number that is not a valid Indian mobile number.
  ///
  /// In en, this message translates to:
  /// **'Please enter a ten digit Indian mobile number.'**
  String get profilePhoneInvalid;

  /// Label for the PIN code field.
  ///
  /// In en, this message translates to:
  /// **'PIN code'**
  String get profilePincodeLabel;

  /// Helper text for the PIN code field.
  ///
  /// In en, this message translates to:
  /// **'Optional. Six digits.'**
  String get profilePincodeHint;

  /// Validation error for a PIN code that is not six digits.
  ///
  /// In en, this message translates to:
  /// **'Please enter a six digit PIN code.'**
  String get profilePincodeInvalid;

  /// Title of the empty state, shown when the teacher has no saved profile yet.
  ///
  /// In en, this message translates to:
  /// **'Your profile is empty'**
  String get profileEmptyTitle;

  /// Body of the empty state, explaining what filling in the profile is worth.
  ///
  /// In en, this message translates to:
  /// **'Add your school and your classes, and every lesson plan and quiz you make will arrive ready for your classroom.'**
  String get profileEmptyBody;

  /// Error state when the profile read fails for a non-auth, non-network reason.
  ///
  /// In en, this message translates to:
  /// **'We could not open your profile. Please try again.'**
  String get profileLoadFailed;

  /// Title of the signed-out state on the Profile screen.
  ///
  /// In en, this message translates to:
  /// **'You are signed out'**
  String get profileSignedOutTitle;

  /// Body of the signed-out state on the Profile screen.
  ///
  /// In en, this message translates to:
  /// **'Sign in to see and edit your teaching profile.'**
  String get profileSignedOutBody;

  /// Shown when a save is rejected because the session has expired.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again to save your profile.'**
  String get profileSaveSignIn;

  /// Empty-state prompt inside the image picker well.
  ///
  /// In en, this message translates to:
  /// **'Add a clear photo of the textbook page.'**
  String get imageInputHint;

  /// Button that opens the camera to capture an image.
  ///
  /// In en, this message translates to:
  /// **'Take photo'**
  String get imageInputTakePhoto;

  /// Button that opens the photo gallery to choose an image.
  ///
  /// In en, this message translates to:
  /// **'Choose from gallery'**
  String get imageInputChooseGallery;

  /// Camera button label once an image is already chosen; replaces it.
  ///
  /// In en, this message translates to:
  /// **'Retake photo'**
  String get imageInputRetake;

  /// Gallery button label once an image is already chosen; replaces it.
  ///
  /// In en, this message translates to:
  /// **'Choose another'**
  String get imageInputChangeGallery;

  /// Clears the currently chosen image.
  ///
  /// In en, this message translates to:
  /// **'Remove photo'**
  String get imageInputRemove;

  /// Accessibility label for the thumbnail of the chosen image.
  ///
  /// In en, this message translates to:
  /// **'Chosen image preview'**
  String get imageInputPreviewLabel;

  /// Size counter under the image preview, e.g. '2.4 MB of 14 MB'.
  ///
  /// In en, this message translates to:
  /// **'{used} of {max}'**
  String imageInputSizeOfMax(String used, String max);

  /// Shown when the chosen image is over the backend size cap.
  ///
  /// In en, this message translates to:
  /// **'This photo is too large. Please choose one under {max}.'**
  String imageInputTooLarge(String max);

  /// Shown when the camera or photo-library permission is denied.
  ///
  /// In en, this message translates to:
  /// **'SahayakAI needs permission to use your camera or photos. Please allow access in your device settings.'**
  String get imageInputPermissionDenied;

  /// Shown when picking or reading the image fails.
  ///
  /// In en, this message translates to:
  /// **'We could not open that image. Please try again.'**
  String get imageInputFailed;

  /// Worksheet Wizard screen title and tool-tile title.
  ///
  /// In en, this message translates to:
  /// **'Worksheet'**
  String get worksheetTitle;

  /// Worksheet tool-tile subtitle on the dashboard and create palette.
  ///
  /// In en, this message translates to:
  /// **'Build a worksheet from a textbook photo'**
  String get worksheetSubtitle;

  /// Worksheet idle/empty state before generating.
  ///
  /// In en, this message translates to:
  /// **'Add a textbook photo and a prompt, then tap Generate.'**
  String get worksheetEmpty;

  /// Label for the required image input.
  ///
  /// In en, this message translates to:
  /// **'Textbook page photo'**
  String get worksheetImageLabel;

  /// Helper text under the image input label.
  ///
  /// In en, this message translates to:
  /// **'The worksheet is built from this page.'**
  String get worksheetImageHint;

  /// Validation shown when no image has been chosen.
  ///
  /// In en, this message translates to:
  /// **'Please add a photo of the textbook page.'**
  String get worksheetImageError;

  /// Label for the required prompt field.
  ///
  /// In en, this message translates to:
  /// **'What worksheet do you need?'**
  String get worksheetPromptLabel;

  /// Placeholder for the worksheet prompt field.
  ///
  /// In en, this message translates to:
  /// **'For example, Make a multiplication worksheet from this page'**
  String get worksheetPromptHint;

  /// Validation shown when the prompt field is empty.
  ///
  /// In en, this message translates to:
  /// **'Please describe the worksheet you need.'**
  String get worksheetPromptError;

  /// Label for the worksheet grade dropdown.
  ///
  /// In en, this message translates to:
  /// **'Grade level'**
  String get worksheetGradeLabel;

  /// Dropdown entry that leaves the grade unset.
  ///
  /// In en, this message translates to:
  /// **'Any grade'**
  String get worksheetGradeAny;

  /// Label for the worksheet subject dropdown.
  ///
  /// In en, this message translates to:
  /// **'Subject'**
  String get worksheetSubjectLabel;

  /// Dropdown entry that leaves the subject unset.
  ///
  /// In en, this message translates to:
  /// **'Any subject'**
  String get worksheetSubjectAny;

  /// Marks a worksheet form field as optional.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get worksheetOptional;

  /// Result section heading for the worksheet's learning objectives.
  ///
  /// In en, this message translates to:
  /// **'Learning objectives'**
  String get worksheetObjectives;

  /// Result section heading for the student instructions.
  ///
  /// In en, this message translates to:
  /// **'Instructions for students'**
  String get worksheetInstructions;

  /// Result section heading for the worksheet activities.
  ///
  /// In en, this message translates to:
  /// **'Activities'**
  String get worksheetActivities;

  /// Activity type badge: question.
  ///
  /// In en, this message translates to:
  /// **'Question'**
  String get worksheetActivityQuestion;

  /// Activity type badge: puzzle.
  ///
  /// In en, this message translates to:
  /// **'Puzzle'**
  String get worksheetActivityPuzzle;

  /// Activity type badge: creative_task.
  ///
  /// In en, this message translates to:
  /// **'Creative task'**
  String get worksheetActivityCreativeTask;

  /// Label above an activity's pedagogical explanation.
  ///
  /// In en, this message translates to:
  /// **'For the teacher'**
  String get worksheetExplanation;

  /// Label above an activity's blackboard note.
  ///
  /// In en, this message translates to:
  /// **'On the blackboard'**
  String get worksheetChalkboardNote;

  /// Result section heading for the answer key.
  ///
  /// In en, this message translates to:
  /// **'Answer key'**
  String get worksheetAnswerKey;

  /// Shown when the response carried no usable worksheet.
  ///
  /// In en, this message translates to:
  /// **'No worksheet came back for that page. Please try a clearer photo or a different prompt.'**
  String get worksheetNoContent;

  /// Title shown when the API returns 403 PLAN_UPGRADE_REQUIRED.
  ///
  /// In en, this message translates to:
  /// **'A higher plan is needed'**
  String get worksheetUpgradeTitle;

  /// Body for the upgrade-required state.
  ///
  /// In en, this message translates to:
  /// **'Worksheet generation is part of a higher plan. Please upgrade to keep building worksheets.'**
  String get worksheetUpgradeBody;

  /// Title shown when the API returns 429 usage/daily limit.
  ///
  /// In en, this message translates to:
  /// **'You have reached your limit'**
  String get worksheetLimitTitle;

  /// Body for the limit-reached state.
  ///
  /// In en, this message translates to:
  /// **'You have used your worksheets for now. Please try again later or upgrade your plan.'**
  String get worksheetLimitBody;

  /// Shown on a 400 invalid-input response.
  ///
  /// In en, this message translates to:
  /// **'We could not build a worksheet from that. Please try a clearer photo or rephrase your prompt.'**
  String get worksheetRephrase;

  /// Shown on a 503 busy/quota response.
  ///
  /// In en, this message translates to:
  /// **'The assistant is busy right now. Please try again in a moment.'**
  String get worksheetBusy;

  /// Shown when the request times out.
  ///
  /// In en, this message translates to:
  /// **'This is taking longer than expected. Please try again.'**
  String get worksheetTimeout;

  /// Shown on a 401 unauthorized response.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again to use this tool.'**
  String get worksheetSignIn;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>[
    'bn',
    'en',
    'gu',
    'hi',
    'kn',
    'ml',
    'mr',
    'or',
    'pa',
    'ta',
    'te',
  ].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'bn':
      return AppLocalizationsBn();
    case 'en':
      return AppLocalizationsEn();
    case 'gu':
      return AppLocalizationsGu();
    case 'hi':
      return AppLocalizationsHi();
    case 'kn':
      return AppLocalizationsKn();
    case 'ml':
      return AppLocalizationsMl();
    case 'mr':
      return AppLocalizationsMr();
    case 'or':
      return AppLocalizationsOr();
    case 'pa':
      return AppLocalizationsPa();
    case 'ta':
      return AppLocalizationsTa();
    case 'te':
      return AppLocalizationsTe();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
