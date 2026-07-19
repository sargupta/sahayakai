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

  /// Dashboard hero eyebrow: time-aware salutation shown before noon.
  ///
  /// In en, this message translates to:
  /// **'Good morning'**
  String get dashboardGreetingMorning;

  /// Dashboard hero eyebrow: time-aware salutation shown from noon to evening.
  ///
  /// In en, this message translates to:
  /// **'Good afternoon'**
  String get dashboardGreetingAfternoon;

  /// Dashboard hero eyebrow: time-aware salutation shown in the evening.
  ///
  /// In en, this message translates to:
  /// **'Good evening'**
  String get dashboardGreetingEvening;

  /// Action label on the dashboard feature tile, opens the tool.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get actionOpen;

  /// Result action bar: generate a fresh version from the same form.
  ///
  /// In en, this message translates to:
  /// **'Regenerate'**
  String get actionRegenerate;

  /// Result action bar: copy the generated document to the clipboard.
  ///
  /// In en, this message translates to:
  /// **'Copy'**
  String get actionCopy;

  /// Snackbar shown after a generated document is copied.
  ///
  /// In en, this message translates to:
  /// **'Copied to clipboard'**
  String get copyConfirmation;

  /// Lesson plan form section header: what to teach (topic, grades, subject).
  ///
  /// In en, this message translates to:
  /// **'The lesson'**
  String get lessonPlanSectionLesson;

  /// Lesson plan form section header: how to teach it (language, level, difficulty).
  ///
  /// In en, this message translates to:
  /// **'Teaching approach'**
  String get lessonPlanSectionApproach;

  /// Quiz form section header: what the quiz is about (topic, number of questions, question types).
  ///
  /// In en, this message translates to:
  /// **'The quiz'**
  String get quizSectionQuiz;

  /// Form section header grouping the optional grade, subject and language a tool tailors its output to.
  ///
  /// In en, this message translates to:
  /// **'For your class'**
  String get sectionForYourClass;

  /// Instant Answer result: the answer section heading, and the masthead title fallback when the asked question is unavailable.
  ///
  /// In en, this message translates to:
  /// **'Answer'**
  String get instantAnswerResultTitle;

  /// Dashboard tools section header.
  ///
  /// In en, this message translates to:
  /// **'Your teaching tools'**
  String get dashboardToolsTitle;

  /// Create palette: hint text in the tool search field.
  ///
  /// In en, this message translates to:
  /// **'Search tools'**
  String get createPaletteSearchHint;

  /// Create palette: shown when the search matches no tools.
  ///
  /// In en, this message translates to:
  /// **'No tools match your search'**
  String get createPaletteEmpty;

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

  /// Editorial section eyebrow over the teacher's saved-work list on the Library screen.
  ///
  /// In en, this message translates to:
  /// **'Saved work'**
  String get librarySectionSaved;

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

  /// Library type-filter chip that clears the filter and shows every saved type.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get libraryFilterAll;

  /// Shown if the selected type filter matches nothing in the loaded list.
  ///
  /// In en, this message translates to:
  /// **'You have no saved items of this type yet.'**
  String get libraryFilterEmpty;

  /// App-bar title for a saved item that has no title of its own.
  ///
  /// In en, this message translates to:
  /// **'Saved item'**
  String get libraryDetailTitle;

  /// The date a saved item was created, on its detail screen.
  ///
  /// In en, this message translates to:
  /// **'Saved {date}'**
  String libraryDetailSavedOn(String date);

  /// Detail state when the per-item read has no identity (401); the read is built-pending-firebase.
  ///
  /// In en, this message translates to:
  /// **'Sign in to open your saved work.'**
  String get libraryDetailSignedOut;

  /// Detail state when the per-item read returns 404 (deleted or expired).
  ///
  /// In en, this message translates to:
  /// **'This item is no longer in your library.'**
  String get libraryDetailNotFound;

  /// Detail state when the per-item read fails for a non-network reason.
  ///
  /// In en, this message translates to:
  /// **'We could not open this saved item. Please try again.'**
  String get libraryDetailLoadFailed;

  /// Detail confirmation once the saved item has loaded.
  ///
  /// In en, this message translates to:
  /// **'You are viewing your saved {type}.'**
  String libraryDetailReady(String type);

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

  /// Action on the upgrade / limit prompts, opening the pricing page.
  ///
  /// In en, this message translates to:
  /// **'See plans and pricing'**
  String get lessonPlanSeePricing;

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

  /// Action on the upgrade / limit prompts, opening the pricing page.
  ///
  /// In en, this message translates to:
  /// **'See plans and pricing'**
  String get quizSeePricing;

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

  /// Title of the Rubric Generator tool.
  ///
  /// In en, this message translates to:
  /// **'Rubric'**
  String get rubricTitle;

  /// One-line description of the Rubric Generator tool.
  ///
  /// In en, this message translates to:
  /// **'Build a grading rubric for an assignment'**
  String get rubricSubtitle;

  /// Idle/empty state before a rubric is generated.
  ///
  /// In en, this message translates to:
  /// **'Describe the assignment, then tap Generate.'**
  String get rubricEmpty;

  /// Label for the assignment description field.
  ///
  /// In en, this message translates to:
  /// **'What is the assignment?'**
  String get rubricAssignmentLabel;

  /// Helper line under the assignment field label.
  ///
  /// In en, this message translates to:
  /// **'The rubric grades this assignment.'**
  String get rubricAssignmentHint;

  /// Placeholder for the assignment description field.
  ///
  /// In en, this message translates to:
  /// **'For example, A Class 5 project on renewable energy'**
  String get rubricAssignmentPlaceholder;

  /// Validation error when the assignment description is empty.
  ///
  /// In en, this message translates to:
  /// **'Please describe the assignment.'**
  String get rubricAssignmentError;

  /// Label for the rubric grade dropdown.
  ///
  /// In en, this message translates to:
  /// **'Grade level'**
  String get rubricGradeLabel;

  /// The no-grade-selected option in the rubric grade dropdown.
  ///
  /// In en, this message translates to:
  /// **'Any grade'**
  String get rubricGradeAny;

  /// Label for the rubric subject dropdown.
  ///
  /// In en, this message translates to:
  /// **'Subject'**
  String get rubricSubjectLabel;

  /// The no-subject-selected option in the rubric subject dropdown.
  ///
  /// In en, this message translates to:
  /// **'Any subject'**
  String get rubricSubjectAny;

  /// Marks a rubric form field as optional.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get rubricOptional;

  /// Header of the first grid column, listing the criteria.
  ///
  /// In en, this message translates to:
  /// **'Criteria'**
  String get rubricCriteriaColumn;

  /// Points badge on a performance level header (e.g. 4 pts).
  ///
  /// In en, this message translates to:
  /// **'{points} pts'**
  String rubricPoints(String points);

  /// Affordance telling the teacher the grid scrolls sideways.
  ///
  /// In en, this message translates to:
  /// **'Swipe across to see all levels.'**
  String get rubricScrollHint;

  /// Shown when the response carried no usable rubric.
  ///
  /// In en, this message translates to:
  /// **'No rubric came back for that. Please try a clearer assignment description.'**
  String get rubricNoContent;

  /// Title of the 403 upgrade prompt.
  ///
  /// In en, this message translates to:
  /// **'A higher plan is needed'**
  String get rubricUpgradeTitle;

  /// Body of the 403 upgrade prompt.
  ///
  /// In en, this message translates to:
  /// **'Rubric generation is part of a higher plan. Please upgrade to keep building rubrics.'**
  String get rubricUpgradeBody;

  /// Title of the 429 limit-reached prompt.
  ///
  /// In en, this message translates to:
  /// **'You have reached your limit'**
  String get rubricLimitTitle;

  /// Body of the 429 limit-reached prompt.
  ///
  /// In en, this message translates to:
  /// **'You have used your rubrics for now. Please try again later or upgrade your plan.'**
  String get rubricLimitBody;

  /// Shown on a 400 invalid-input response.
  ///
  /// In en, this message translates to:
  /// **'We could not build a rubric from that. Please rephrase the assignment and try again.'**
  String get rubricRephrase;

  /// Shown on a 503 / server-busy response.
  ///
  /// In en, this message translates to:
  /// **'The assistant is busy right now. Please try again in a moment.'**
  String get rubricBusy;

  /// Shown when the request times out.
  ///
  /// In en, this message translates to:
  /// **'This is taking longer than expected. Please try again.'**
  String get rubricTimeout;

  /// Shown on a 401 unauthorized response.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again to use this tool.'**
  String get rubricSignIn;

  /// Title of the Exam Paper Generator tool.
  ///
  /// In en, this message translates to:
  /// **'Exam Paper'**
  String get examPaperTitle;

  /// One-line description of the Exam Paper Generator tool.
  ///
  /// In en, this message translates to:
  /// **'Build a board-pattern exam paper with answer key'**
  String get examPaperSubtitle;

  /// Idle/empty state before an exam paper is generated.
  ///
  /// In en, this message translates to:
  /// **'Choose a board, grade and subject, then tap Generate.'**
  String get examPaperEmpty;

  /// Label for the required education-board dropdown.
  ///
  /// In en, this message translates to:
  /// **'Board'**
  String get examPaperBoardLabel;

  /// Placeholder shown before a board is chosen.
  ///
  /// In en, this message translates to:
  /// **'Select a board'**
  String get examPaperBoardHint;

  /// Validation error when no board is selected.
  ///
  /// In en, this message translates to:
  /// **'Please choose a board.'**
  String get examPaperBoardError;

  /// Label for the required grade-level dropdown.
  ///
  /// In en, this message translates to:
  /// **'Grade level'**
  String get examPaperGradeLabel;

  /// Placeholder shown before a grade is chosen.
  ///
  /// In en, this message translates to:
  /// **'Select a grade'**
  String get examPaperGradeHint;

  /// Validation error when no grade is selected.
  ///
  /// In en, this message translates to:
  /// **'Please choose a grade level.'**
  String get examPaperGradeError;

  /// Label for the required subject dropdown.
  ///
  /// In en, this message translates to:
  /// **'Subject'**
  String get examPaperSubjectLabel;

  /// Placeholder shown before a subject is chosen.
  ///
  /// In en, this message translates to:
  /// **'Select a subject'**
  String get examPaperSubjectHint;

  /// Validation error when no subject is selected.
  ///
  /// In en, this message translates to:
  /// **'Please choose a subject.'**
  String get examPaperSubjectError;

  /// Label for the chapters add-chip list.
  ///
  /// In en, this message translates to:
  /// **'Chapters'**
  String get examPaperChaptersLabel;

  /// Helper line under the chapters field label.
  ///
  /// In en, this message translates to:
  /// **'Add the chapters to cover. Leave empty for the full syllabus where an official blueprint exists.'**
  String get examPaperChaptersHint;

  /// Placeholder in the chapter text field.
  ///
  /// In en, this message translates to:
  /// **'For example, Quadratic Equations'**
  String get examPaperChaptersPlaceholder;

  /// Tooltip on the add-chapter button.
  ///
  /// In en, this message translates to:
  /// **'Add chapter'**
  String get examPaperChaptersAdd;

  /// Validation error shown when a non-blueprinted combination has no chapters.
  ///
  /// In en, this message translates to:
  /// **'Please add at least one chapter for this board, grade and subject.'**
  String get examPaperChaptersError;

  /// Label for the difficulty segmented control.
  ///
  /// In en, this message translates to:
  /// **'Difficulty'**
  String get examPaperDifficultyLabel;

  /// Easy difficulty option.
  ///
  /// In en, this message translates to:
  /// **'Easy'**
  String get examPaperDifficultyEasy;

  /// Moderate difficulty option.
  ///
  /// In en, this message translates to:
  /// **'Moderate'**
  String get examPaperDifficultyModerate;

  /// Hard difficulty option.
  ///
  /// In en, this message translates to:
  /// **'Hard'**
  String get examPaperDifficultyHard;

  /// Mixed difficulty option (the default).
  ///
  /// In en, this message translates to:
  /// **'Mixed'**
  String get examPaperDifficultyMixed;

  /// Toggle to include an answer key in the paper.
  ///
  /// In en, this message translates to:
  /// **'Include answer key'**
  String get examPaperIncludeAnswerKey;

  /// Toggle to include a marking scheme in the paper.
  ///
  /// In en, this message translates to:
  /// **'Include marking scheme'**
  String get examPaperIncludeMarkingScheme;

  /// Title of the 202 generation-in-progress state.
  ///
  /// In en, this message translates to:
  /// **'Your paper is being prepared'**
  String get examPaperInProgressTitle;

  /// Body of the 202 generation-in-progress state.
  ///
  /// In en, this message translates to:
  /// **'A full board paper takes a little longer to build. We are finishing it now and it will be saved for you.'**
  String get examPaperInProgressBody;

  /// Points the teacher to the Library tab for the finished paper.
  ///
  /// In en, this message translates to:
  /// **'Open the Library tab in a minute to find your finished paper.'**
  String get examPaperInProgressLibraryHint;

  /// Badge showing the paper's maximum marks.
  ///
  /// In en, this message translates to:
  /// **'Max marks {marks}'**
  String examPaperMaxMarks(String marks);

  /// Badge showing a question's or chapter's marks.
  ///
  /// In en, this message translates to:
  /// **'{marks} marks'**
  String examPaperMarks(String marks);

  /// Badge showing a section's total marks.
  ///
  /// In en, this message translates to:
  /// **'{marks} marks'**
  String examPaperSectionMarks(String marks);

  /// Badge showing a difficulty band's percentage of the paper.
  ///
  /// In en, this message translates to:
  /// **'{value} percent'**
  String examPaperPercent(String value);

  /// Header for the paper's general instructions list.
  ///
  /// In en, this message translates to:
  /// **'General instructions'**
  String get examPaperGeneralInstructions;

  /// Label above an internal-choice (OR) alternative question.
  ///
  /// In en, this message translates to:
  /// **'Or attempt'**
  String get examPaperInternalChoice;

  /// Label of the per-question answer block.
  ///
  /// In en, this message translates to:
  /// **'Answer'**
  String get examPaperAnswerKey;

  /// Label of the per-question marking-scheme block.
  ///
  /// In en, this message translates to:
  /// **'Marking scheme'**
  String get examPaperMarkingScheme;

  /// Header for the blueprint summary card.
  ///
  /// In en, this message translates to:
  /// **'Blueprint summary'**
  String get examPaperBlueprintTitle;

  /// Sub-header for the chapter-wise mark split.
  ///
  /// In en, this message translates to:
  /// **'Marks by chapter'**
  String get examPaperBlueprintChapters;

  /// Sub-header for the difficulty-wise split.
  ///
  /// In en, this message translates to:
  /// **'Difficulty split'**
  String get examPaperBlueprintDifficulty;

  /// Header for the prior-year-question sources card.
  ///
  /// In en, this message translates to:
  /// **'Previous-year questions'**
  String get examPaperPyqTitle;

  /// A PYQ source row with both a chapter and a year.
  ///
  /// In en, this message translates to:
  /// **'{chapter} ({year})'**
  String examPaperPyqChapterYear(String chapter, int year);

  /// A PYQ source row with only a year.
  ///
  /// In en, this message translates to:
  /// **'Year {year}'**
  String examPaperPyqYear(int year);

  /// Shown when the response carried no usable paper.
  ///
  /// In en, this message translates to:
  /// **'No exam paper came back for that. Please try fewer chapters or a different subject.'**
  String get examPaperNoContent;

  /// Button that saves the generated paper to the teacher's library.
  ///
  /// In en, this message translates to:
  /// **'Save to Library'**
  String get examPaperSave;

  /// Shown on the save button while the save is in flight.
  ///
  /// In en, this message translates to:
  /// **'Saving'**
  String get examPaperSaving;

  /// Confirmation shown after the paper is saved.
  ///
  /// In en, this message translates to:
  /// **'Saved to your Library'**
  String get examPaperSaved;

  /// Title of the failed-save inline error.
  ///
  /// In en, this message translates to:
  /// **'Could not save'**
  String get examPaperSaveFailedTitle;

  /// Body of the failed-save inline error.
  ///
  /// In en, this message translates to:
  /// **'We could not save this paper to your library. Please try again.'**
  String get examPaperSaveFailedBody;

  /// Retry button on a failed save.
  ///
  /// In en, this message translates to:
  /// **'Try saving again'**
  String get examPaperSaveRetry;

  /// Title of the 422 exam_paper_unstructured guidance state.
  ///
  /// In en, this message translates to:
  /// **'We could not structure that paper'**
  String get examPaperUnstructuredTitle;

  /// Body of the 422 exam_paper_unstructured guidance state.
  ///
  /// In en, this message translates to:
  /// **'The assistant could not lay this out as a full paper. Please remove a few chapters and generate again.'**
  String get examPaperUnstructuredBody;

  /// Title of the 403 upgrade prompt.
  ///
  /// In en, this message translates to:
  /// **'A higher plan is needed'**
  String get examPaperUpgradeTitle;

  /// Body of the 403 upgrade prompt.
  ///
  /// In en, this message translates to:
  /// **'Exam paper generation is part of a higher plan. Please upgrade to keep building papers.'**
  String get examPaperUpgradeBody;

  /// Title of the 429 limit-reached prompt.
  ///
  /// In en, this message translates to:
  /// **'You have reached your limit'**
  String get examPaperLimitTitle;

  /// Body of the 429 limit-reached prompt.
  ///
  /// In en, this message translates to:
  /// **'You have used your exam papers for now. Please try again later or upgrade your plan.'**
  String get examPaperLimitBody;

  /// Shown on a 400 invalid-input response.
  ///
  /// In en, this message translates to:
  /// **'We could not build a paper from that. Please adjust the chapters and try again.'**
  String get examPaperRephrase;

  /// Shown on a 503 / server-busy response.
  ///
  /// In en, this message translates to:
  /// **'The assistant is busy right now. Please try again in a moment.'**
  String get examPaperBusy;

  /// Shown when the request times out.
  ///
  /// In en, this message translates to:
  /// **'This is taking longer than expected. Please try again.'**
  String get examPaperTimeout;

  /// Shown on a 401 unauthorized response.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again to use this tool.'**
  String get examPaperSignIn;

  /// Title of the Teaching Coach (teacher-training) tool.
  ///
  /// In en, this message translates to:
  /// **'Teaching Coach'**
  String get teacherTrainingTitle;

  /// Dashboard/Create subtitle for the Teaching Coach tool.
  ///
  /// In en, this message translates to:
  /// **'Advice and strategy for a teaching question'**
  String get teacherTrainingSubtitle;

  /// Submit button label on the Teaching Coach form.
  ///
  /// In en, this message translates to:
  /// **'Get advice'**
  String get teacherTrainingAction;

  /// Idle/empty state before any advice is generated. An invitation, not a pitch.
  ///
  /// In en, this message translates to:
  /// **'Ask a teaching question to get strategies grounded in pedagogy.'**
  String get teacherTrainingEmpty;

  /// Label for the Teaching Coach question field.
  ///
  /// In en, this message translates to:
  /// **'Your question'**
  String get teacherTrainingQuestionLabel;

  /// Helper line under the question field label.
  ///
  /// In en, this message translates to:
  /// **'Ask about lesson design, classroom practice or assessment.'**
  String get teacherTrainingQuestionHint;

  /// Placeholder inside the question input.
  ///
  /// In en, this message translates to:
  /// **'For example, How can I keep a class of 40 engaged through a full lesson?'**
  String get teacherTrainingQuestionPlaceholder;

  /// Validation error when the question field is empty.
  ///
  /// In en, this message translates to:
  /// **'Please enter a question.'**
  String get teacherTrainingQuestionError;

  /// Label for the Teaching Coach subject dropdown.
  ///
  /// In en, this message translates to:
  /// **'Subject'**
  String get teacherTrainingSubjectLabel;

  /// The no-subject-selected option in the subject dropdown.
  ///
  /// In en, this message translates to:
  /// **'Any subject'**
  String get teacherTrainingSubjectAny;

  /// Marks a Teaching Coach form field as optional.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get teacherTrainingOptional;

  /// Section label above the list of advice cards.
  ///
  /// In en, this message translates to:
  /// **'Strategies'**
  String get teacherTrainingStrategiesTitle;

  /// Editorial section header over the question field on the Teaching Coach form.
  ///
  /// In en, this message translates to:
  /// **'The question'**
  String get teacherTrainingSectionQuestion;

  /// Masthead document title on the Teaching Coach result DocumentSheet.
  ///
  /// In en, this message translates to:
  /// **'Coaching notes'**
  String get teacherTrainingResultTitle;

  /// Shown when the response carried no usable advice.
  ///
  /// In en, this message translates to:
  /// **'No advice came back for that. Please try a clearer question.'**
  String get teacherTrainingNoContent;

  /// Title of the 403 upgrade prompt.
  ///
  /// In en, this message translates to:
  /// **'A higher plan is needed'**
  String get teacherTrainingUpgradeTitle;

  /// Body of the 403 upgrade prompt.
  ///
  /// In en, this message translates to:
  /// **'The Teaching Coach is part of a higher plan. Please upgrade to keep asking.'**
  String get teacherTrainingUpgradeBody;

  /// Title of the 429 limit-reached prompt.
  ///
  /// In en, this message translates to:
  /// **'You have reached your limit'**
  String get teacherTrainingLimitTitle;

  /// Body of the 429 limit-reached prompt.
  ///
  /// In en, this message translates to:
  /// **'You have used the Teaching Coach for now. Please try again later or upgrade your plan.'**
  String get teacherTrainingLimitBody;

  /// Action on the upgrade / limit prompts, opening the pricing page.
  ///
  /// In en, this message translates to:
  /// **'See plans and pricing'**
  String get teacherTrainingSeePricing;

  /// Shown on a 400 invalid-input response.
  ///
  /// In en, this message translates to:
  /// **'We could not build advice from that. Please rephrase the question and try again.'**
  String get teacherTrainingRephrase;

  /// Shown on a 503 / server-busy response with no Retry-After.
  ///
  /// In en, this message translates to:
  /// **'The assistant is busy right now. Please try again in a moment.'**
  String get teacherTrainingBusy;

  /// Shown on a 503 that carries a Retry-After hint.
  ///
  /// In en, this message translates to:
  /// **'{seconds, plural, =1{The assistant is busy right now. Please try again in about 1 second.} other{The assistant is busy right now. Please try again in about {seconds} seconds.}}'**
  String teacherTrainingBusyRetryAfter(int seconds);

  /// Shown when the request times out.
  ///
  /// In en, this message translates to:
  /// **'This is taking longer than expected. Please try again.'**
  String get teacherTrainingTimeout;

  /// Shown on a 401 unauthorized response.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again to use this tool.'**
  String get teacherTrainingSignIn;

  /// Title of the Parent Message tool.
  ///
  /// In en, this message translates to:
  /// **'Parent Message'**
  String get parentMessageTitle;

  /// Dashboard/Create subtitle for the Parent Message tool.
  ///
  /// In en, this message translates to:
  /// **'Draft a message home in the parent\'s language'**
  String get parentMessageSubtitle;

  /// Submit button label on the Parent Message form.
  ///
  /// In en, this message translates to:
  /// **'Draft message'**
  String get parentMessageAction;

  /// Idle/empty state before any message is generated. An invitation to the teacher, not a pitch.
  ///
  /// In en, this message translates to:
  /// **'Share the student and reason, and a caring message home will be drafted in the parent\'s language.'**
  String get parentMessageEmpty;

  /// Label for the student-name field.
  ///
  /// In en, this message translates to:
  /// **'Student name'**
  String get parentMessageStudentLabel;

  /// Placeholder inside the student-name field.
  ///
  /// In en, this message translates to:
  /// **'The student the message is about'**
  String get parentMessageStudentPlaceholder;

  /// Validation error when the student-name field is empty.
  ///
  /// In en, this message translates to:
  /// **'Please enter the student\'s name.'**
  String get parentMessageStudentError;

  /// Label for the class field.
  ///
  /// In en, this message translates to:
  /// **'Class'**
  String get parentMessageClassLabel;

  /// Placeholder inside the class field.
  ///
  /// In en, this message translates to:
  /// **'For example, Class 6A'**
  String get parentMessageClassPlaceholder;

  /// Validation error when the class field is empty.
  ///
  /// In en, this message translates to:
  /// **'Please enter the class.'**
  String get parentMessageClassError;

  /// Label for the subject dropdown.
  ///
  /// In en, this message translates to:
  /// **'Subject'**
  String get parentMessageSubjectLabel;

  /// Placeholder shown in the subject dropdown before a choice is made.
  ///
  /// In en, this message translates to:
  /// **'Choose a subject'**
  String get parentMessageSubjectHint;

  /// Validation error when no subject is chosen.
  ///
  /// In en, this message translates to:
  /// **'Please choose a subject.'**
  String get parentMessageSubjectError;

  /// Label for the reason dropdown.
  ///
  /// In en, this message translates to:
  /// **'Reason for the message'**
  String get parentMessageReasonLabel;

  /// Placeholder shown in the reason dropdown before a choice is made.
  ///
  /// In en, this message translates to:
  /// **'Choose a reason'**
  String get parentMessageReasonHint;

  /// Validation error when no reason is chosen.
  ///
  /// In en, this message translates to:
  /// **'Please choose a reason.'**
  String get parentMessageReasonError;

  /// Reason option: the student has missed several school days.
  ///
  /// In en, this message translates to:
  /// **'Repeated absences'**
  String get parentMessageReasonAbsences;

  /// Reason option: the student's performance has dipped and needs support.
  ///
  /// In en, this message translates to:
  /// **'Academic support'**
  String get parentMessageReasonPerformance;

  /// Reason option: a classroom behaviour to raise gently with the parent.
  ///
  /// In en, this message translates to:
  /// **'Behaviour in class'**
  String get parentMessageReasonBehavior;

  /// Reason option: a positive achievement to celebrate with the parent.
  ///
  /// In en, this message translates to:
  /// **'Good news to share'**
  String get parentMessageReasonPositive;

  /// Label for the consecutive-absent-days field (shown only for the absence reason).
  ///
  /// In en, this message translates to:
  /// **'Days absent'**
  String get parentMessageAbsentDaysLabel;

  /// Helper line under the days-absent label.
  ///
  /// In en, this message translates to:
  /// **'How many days in a row the student has been away.'**
  String get parentMessageAbsentDaysHint;

  /// Placeholder inside the days-absent field.
  ///
  /// In en, this message translates to:
  /// **'For example, 3'**
  String get parentMessageAbsentDaysPlaceholder;

  /// Label for the required parent-language dropdown.
  ///
  /// In en, this message translates to:
  /// **'Parent\'s language'**
  String get parentMessageParentLanguageLabel;

  /// Helper line explaining that the parent language drives the output language.
  ///
  /// In en, this message translates to:
  /// **'The message is written in this language, which can differ from the app\'s.'**
  String get parentMessageParentLanguageHint;

  /// Placeholder shown in the parent-language dropdown before a choice is made.
  ///
  /// In en, this message translates to:
  /// **'Choose the parent\'s language'**
  String get parentMessageParentLanguagePlaceholder;

  /// Validation error when no parent language is chosen (the field is required).
  ///
  /// In en, this message translates to:
  /// **'Please choose the parent\'s language.'**
  String get parentMessageParentLanguageError;

  /// Label for the optional reason-context field.
  ///
  /// In en, this message translates to:
  /// **'What is prompting this?'**
  String get parentMessageContextLabel;

  /// Helper line under the reason-context label.
  ///
  /// In en, this message translates to:
  /// **'A short note on the situation helps shape the message.'**
  String get parentMessageContextHint;

  /// Placeholder inside the reason-context field.
  ///
  /// In en, this message translates to:
  /// **'For example, missed the last two weeks of fractions'**
  String get parentMessageContextPlaceholder;

  /// Label for the optional teacher-note field.
  ///
  /// In en, this message translates to:
  /// **'Anything specific to mention?'**
  String get parentMessageNoteLabel;

  /// Helper line under the teacher-note label.
  ///
  /// In en, this message translates to:
  /// **'A detail here is woven into the message.'**
  String get parentMessageNoteHint;

  /// Placeholder inside the teacher-note field.
  ///
  /// In en, this message translates to:
  /// **'For example, doing well in group work'**
  String get parentMessageNotePlaceholder;

  /// Label for the optional teacher-name (sign-off) field.
  ///
  /// In en, this message translates to:
  /// **'Your name'**
  String get parentMessageTeacherNameLabel;

  /// Helper line under the teacher-name label.
  ///
  /// In en, this message translates to:
  /// **'Signs off the message. Left blank, your profile name is used.'**
  String get parentMessageTeacherNameHint;

  /// Placeholder inside the teacher-name field.
  ///
  /// In en, this message translates to:
  /// **'For example, Mrs. Rao'**
  String get parentMessageTeacherNamePlaceholder;

  /// Label for the optional school-name field.
  ///
  /// In en, this message translates to:
  /// **'School name'**
  String get parentMessageSchoolNameLabel;

  /// Placeholder inside the school-name field.
  ///
  /// In en, this message translates to:
  /// **'Your school\'s name'**
  String get parentMessageSchoolNamePlaceholder;

  /// Marks a Parent Message form field as optional.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get parentMessageOptional;

  /// Approximate length of the drafted message, shown as a meta badge.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 word} other{{count} words}}'**
  String parentMessageWordCount(int count);

  /// Result action that copies the drafted message to the clipboard.
  ///
  /// In en, this message translates to:
  /// **'Copy'**
  String get parentMessageCopy;

  /// Result action that opens the share sheet to send the message on (e.g. WhatsApp).
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get parentMessageShare;

  /// Snackbar confirmation shown after the message is copied.
  ///
  /// In en, this message translates to:
  /// **'Message copied'**
  String get parentMessageCopied;

  /// Editorial section header over the core parent-message fields.
  ///
  /// In en, this message translates to:
  /// **'The message'**
  String get parentMessageSectionMessage;

  /// Editorial section header over the optional parent-message fields.
  ///
  /// In en, this message translates to:
  /// **'Extra details'**
  String get parentMessageSectionDetails;

  /// Masthead document title on the Parent Message result DocumentSheet.
  ///
  /// In en, this message translates to:
  /// **'Message home'**
  String get parentMessageResultTitle;

  /// Shown when the response carried no usable message.
  ///
  /// In en, this message translates to:
  /// **'No message came back for that. Please add a little more context and try again.'**
  String get parentMessageNoContent;

  /// Shown on the 400 Missing required fields response. Specific, not generic.
  ///
  /// In en, this message translates to:
  /// **'Please fill in the student, class, subject, reason and parent\'s language, then try again.'**
  String get parentMessageMissingFields;

  /// Title of the 403 upgrade prompt.
  ///
  /// In en, this message translates to:
  /// **'A higher plan is needed'**
  String get parentMessageUpgradeTitle;

  /// Body of the 403 upgrade prompt.
  ///
  /// In en, this message translates to:
  /// **'Parent messages are part of a higher plan. Please upgrade to keep drafting them.'**
  String get parentMessageUpgradeBody;

  /// Title of the 429 limit-reached prompt.
  ///
  /// In en, this message translates to:
  /// **'You have reached your limit'**
  String get parentMessageLimitTitle;

  /// Body of the 429 limit-reached prompt.
  ///
  /// In en, this message translates to:
  /// **'You have drafted your parent messages for now. Please try again later or upgrade your plan.'**
  String get parentMessageLimitBody;

  /// Action on the upgrade / limit prompts, opening the pricing page.
  ///
  /// In en, this message translates to:
  /// **'See plans and pricing'**
  String get parentMessageSeePricing;

  /// Shown on a 503 / server-busy response with no Retry-After.
  ///
  /// In en, this message translates to:
  /// **'The assistant is busy right now. Please try again in a moment.'**
  String get parentMessageBusy;

  /// Shown on a 503 that carries a Retry-After hint.
  ///
  /// In en, this message translates to:
  /// **'{seconds, plural, =1{The assistant is busy right now. Please try again in about 1 second.} other{The assistant is busy right now. Please try again in about {seconds} seconds.}}'**
  String parentMessageBusyRetryAfter(int seconds);

  /// Shown when the request times out.
  ///
  /// In en, this message translates to:
  /// **'This is taking longer than expected. Please try again.'**
  String get parentMessageTimeout;

  /// Shown on a 401 unauthorized response.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again to use this tool.'**
  String get parentMessageSignIn;

  /// Assess Assignment tool title (app bar + dashboard tile).
  ///
  /// In en, this message translates to:
  /// **'Assess Assignment'**
  String get assessTitle;

  /// Assess Assignment dashboard tile subtitle.
  ///
  /// In en, this message translates to:
  /// **'Grade a student\'s handwritten work from a photo'**
  String get assessSubtitle;

  /// Idle/empty state before the teacher submits.
  ///
  /// In en, this message translates to:
  /// **'Add a photo of the student\'s work, then tap Assess.'**
  String get assessEmpty;

  /// The primary submit button label on the Assess Assignment form.
  ///
  /// In en, this message translates to:
  /// **'Assess'**
  String get assessSubmit;

  /// Label for the required student-work photo field.
  ///
  /// In en, this message translates to:
  /// **'Student work photo'**
  String get assessImageLabel;

  /// Hint under the student-work photo field.
  ///
  /// In en, this message translates to:
  /// **'Take a clear photo of the whole page.'**
  String get assessImageHint;

  /// Validation error when no photo is chosen.
  ///
  /// In en, this message translates to:
  /// **'Please add a photo of the student\'s work.'**
  String get assessImageError;

  /// Label for the mode selector (grade / read only / score a transcript).
  ///
  /// In en, this message translates to:
  /// **'What do you need?'**
  String get assessModeLabel;

  /// Explains the three assessment modes.
  ///
  /// In en, this message translates to:
  /// **'Grade reads and scores the work. Read only returns the transcript. Score a transcript grades text you paste in.'**
  String get assessModeHint;

  /// Mode option: transcribe and score the work (backend 'full').
  ///
  /// In en, this message translates to:
  /// **'Grade'**
  String get assessModeFull;

  /// Mode option: return only the transcript (backend 'transcribe').
  ///
  /// In en, this message translates to:
  /// **'Read only'**
  String get assessModeTranscribe;

  /// Mode option: grade a corrected transcript (backend 'score').
  ///
  /// In en, this message translates to:
  /// **'Score a transcript'**
  String get assessModeScore;

  /// Label for the edited-transcript field, shown only in score mode.
  ///
  /// In en, this message translates to:
  /// **'Corrected transcript'**
  String get assessTranscriptLabel;

  /// Hint under the corrected-transcript field.
  ///
  /// In en, this message translates to:
  /// **'Paste the corrected text to grade instead of re-reading the photo.'**
  String get assessTranscriptHint;

  /// Placeholder inside the corrected-transcript field.
  ///
  /// In en, this message translates to:
  /// **'Type or paste the student\'s corrected answers'**
  String get assessTranscriptPlaceholder;

  /// Marks the corrected-transcript field as optional.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get assessOptional;

  /// Explains the default rubric used when none is attached.
  ///
  /// In en, this message translates to:
  /// **'Without a rubric, the work is graded on a general rubric: understanding, accuracy, presentation and completion.'**
  String get assessRubricNote;

  /// Reassures the teacher that student-name PII is not transmitted.
  ///
  /// In en, this message translates to:
  /// **'The student\'s name is never sent for grading.'**
  String get assessPrivacyNote;

  /// Header above the overall score.
  ///
  /// In en, this message translates to:
  /// **'Overall score'**
  String get assessScoreLabel;

  /// Caption beside the big score number.
  ///
  /// In en, this message translates to:
  /// **'out of 100'**
  String get assessScoreOutOf;

  /// Points earned out of points possible.
  ///
  /// In en, this message translates to:
  /// **'{earned} of {possible} points'**
  String assessPoints(String earned, String possible);

  /// The model's overall self-rated confidence as a percentage.
  ///
  /// In en, this message translates to:
  /// **'Confidence {percent}%'**
  String assessConfidence(String percent);

  /// Names the rubric the grade was measured against.
  ///
  /// In en, this message translates to:
  /// **'Graded against: {title}'**
  String assessRubricUsed(String title);

  /// Tag on a criterion the model was unsure about (confidence below 0.5).
  ///
  /// In en, this message translates to:
  /// **'Low confidence'**
  String get assessLowConfidence;

  /// Section heading for the transcript.
  ///
  /// In en, this message translates to:
  /// **'What the student wrote'**
  String get assessTranscriptSection;

  /// Section heading for the per-criterion scores.
  ///
  /// In en, this message translates to:
  /// **'Scores by criterion'**
  String get assessCriteriaSection;

  /// A criterion's points out of its maximum.
  ///
  /// In en, this message translates to:
  /// **'{points} / {max}'**
  String assessCriterionPoints(String points, String max);

  /// Section heading for what the student did well.
  ///
  /// In en, this message translates to:
  /// **'Strengths'**
  String get assessStrengthsSection;

  /// Section heading for what the student should improve.
  ///
  /// In en, this message translates to:
  /// **'To work on'**
  String get assessImprovementsSection;

  /// Section heading for concrete next-step practice tasks.
  ///
  /// In en, this message translates to:
  /// **'Next steps'**
  String get assessNextStepsSection;

  /// Section heading for the paragraph the teacher can read aloud.
  ///
  /// In en, this message translates to:
  /// **'Note for the student'**
  String get assessTeacherNoteSection;

  /// Heading for the grader's advisories (blank page, faint photo, etc.).
  ///
  /// In en, this message translates to:
  /// **'Please check'**
  String get assessWarningsSection;

  /// Advisory for the page_appears_blank warning code.
  ///
  /// In en, this message translates to:
  /// **'This page looks blank. Please check the photo and try again.'**
  String get assessWarningBlank;

  /// Advisory for the low_contrast warning code.
  ///
  /// In en, this message translates to:
  /// **'The photo is faint. A brighter photo will grade more accurately.'**
  String get assessWarningLowContrast;

  /// Advisory for the partial_writing warning code.
  ///
  /// In en, this message translates to:
  /// **'Only part of the work could be read.'**
  String get assessWarningPartial;

  /// Advisory for the language_mismatch warning code.
  ///
  /// In en, this message translates to:
  /// **'The writing may be in a different language than expected.'**
  String get assessWarningLanguageMismatch;

  /// Empty-result state when the model returned nothing usable.
  ///
  /// In en, this message translates to:
  /// **'No assessment came back. Please try a clearer photo.'**
  String get assessNoContent;

  /// Shown on a 401 unauthorized response.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again to grade an assignment.'**
  String get assessSignIn;

  /// Title of the 403 upgrade prompt.
  ///
  /// In en, this message translates to:
  /// **'A higher plan is needed'**
  String get assessUpgradeTitle;

  /// Body of the 403 upgrade prompt.
  ///
  /// In en, this message translates to:
  /// **'Grading handwritten work is part of a higher plan. Upgrade to keep assessing.'**
  String get assessUpgradeBody;

  /// Title of the daily-limit prompt (429 DAILY_LIMIT_REACHED).
  ///
  /// In en, this message translates to:
  /// **'That is all your assessments for today'**
  String get assessDailyLimitTitle;

  /// Body of the daily-limit prompt.
  ///
  /// In en, this message translates to:
  /// **'Your plan includes a set number of assessments each day. They reset tomorrow, or you can raise the limit on a higher plan.'**
  String get assessDailyLimitBody;

  /// Title of the monthly-limit prompt (429 USAGE_LIMIT_REACHED).
  ///
  /// In en, this message translates to:
  /// **'You have reached your assessment limit'**
  String get assessLimitTitle;

  /// Body of the monthly-limit prompt.
  ///
  /// In en, this message translates to:
  /// **'You have used all the assessments in your plan. They reset next month, or you can raise the limit on a higher plan.'**
  String get assessLimitBody;

  /// Action that opens the pricing page from a limit or upgrade prompt.
  ///
  /// In en, this message translates to:
  /// **'See plans'**
  String get assessSeePricing;

  /// Shown on a 503 busy response with no Retry-After.
  ///
  /// In en, this message translates to:
  /// **'The grading model is busy right now. Please try again in a minute.'**
  String get assessBusy;

  /// Shown on a 503 busy response that carried Retry-After.
  ///
  /// In en, this message translates to:
  /// **'{seconds, plural, =1{The grading model is busy right now. Please try again in about 1 second.} other{The grading model is busy right now. Please try again in about {seconds} seconds.}}'**
  String assessBusyRetryAfter(int seconds);

  /// Shown when the request times out.
  ///
  /// In en, this message translates to:
  /// **'Grading is taking longer than usual. Please try again.'**
  String get assessTimeout;

  /// Shown on a 400 bad-input response.
  ///
  /// In en, this message translates to:
  /// **'The photo could not be graded. Please re-upload a clearer photo.'**
  String get assessRephrase;

  /// Editorial section header over the student-work fields on the Assess form.
  ///
  /// In en, this message translates to:
  /// **'The student\'s work'**
  String get assessSectionWork;

  /// Masthead document title on the Assess Assignment result DocumentSheet.
  ///
  /// In en, this message translates to:
  /// **'Assessment'**
  String get assessResultTitle;

  /// Worksheet form section header: the textbook photo and prompt the worksheet is built from.
  ///
  /// In en, this message translates to:
  /// **'The worksheet'**
  String get worksheetSectionWorksheet;

  /// Rubric form section header: the assignment the rubric grades.
  ///
  /// In en, this message translates to:
  /// **'The assignment'**
  String get rubricSectionAssignment;

  /// Exam paper form section header: the board, grade, subject and chapters the paper covers.
  ///
  /// In en, this message translates to:
  /// **'The paper'**
  String get examPaperSectionPaper;

  /// Exam paper form section header: difficulty, language and what to include (answer key, marking scheme).
  ///
  /// In en, this message translates to:
  /// **'Format'**
  String get examPaperSectionFormat;

  /// VIDYA home eyebrow above the greeting (co-teacher framing).
  ///
  /// In en, this message translates to:
  /// **'Your co-teacher'**
  String get vidyaEyebrow;

  /// VIDYA home deck/standfirst inviting the teacher to speak.
  ///
  /// In en, this message translates to:
  /// **'Speak in your language, and I will prepare the work.'**
  String get vidyaDeck;

  /// Rotating VIDYA prompt example: plan a lesson.
  ///
  /// In en, this message translates to:
  /// **'Ask me to plan a lesson'**
  String get vidyaPromptLesson;

  /// Rotating VIDYA prompt example: make a quiz.
  ///
  /// In en, this message translates to:
  /// **'Ask me to make a quiz'**
  String get vidyaPromptQuiz;

  /// Rotating VIDYA prompt example: message a parent.
  ///
  /// In en, this message translates to:
  /// **'Ask me to message a parent'**
  String get vidyaPromptParent;

  /// Seal-mic caption when idle.
  ///
  /// In en, this message translates to:
  /// **'Tap to speak'**
  String get vidyaStateIdle;

  /// Seal-mic caption while requesting the microphone.
  ///
  /// In en, this message translates to:
  /// **'Getting ready'**
  String get vidyaStateReady;

  /// Seal-mic caption while recording.
  ///
  /// In en, this message translates to:
  /// **'I am listening'**
  String get vidyaStateListening;

  /// Seal-mic caption while transcribing / thinking.
  ///
  /// In en, this message translates to:
  /// **'Thinking'**
  String get vidyaStateThinking;

  /// Seal-mic caption while VIDYA speaks the reply.
  ///
  /// In en, this message translates to:
  /// **'Speaking'**
  String get vidyaStateSpeaking;

  /// Overline above the teacher's transcript block.
  ///
  /// In en, this message translates to:
  /// **'You said'**
  String get vidyaYouSaid;

  /// VIDYA signed-out state title (401 on the stub token).
  ///
  /// In en, this message translates to:
  /// **'Sign in to talk to VIDYA'**
  String get vidyaSignedOutTitle;

  /// VIDYA signed-out state body.
  ///
  /// In en, this message translates to:
  /// **'Sign in and VIDYA will plan lessons, quizzes and more in your language.'**
  String get vidyaSignedOutBody;

  /// VIDYA permanent mic-denial state title.
  ///
  /// In en, this message translates to:
  /// **'Turn on the microphone'**
  String get vidyaMicOffTitle;

  /// VIDYA permanent mic-denial state body.
  ///
  /// In en, this message translates to:
  /// **'VIDYA needs the microphone to hear you. Enable it in Settings.'**
  String get vidyaMicOffBody;

  /// Button that deep-links to OS settings to enable the mic.
  ///
  /// In en, this message translates to:
  /// **'Open settings'**
  String get vidyaOpenSettings;

  /// VIDYA voice-quota (429) calm limit state title.
  ///
  /// In en, this message translates to:
  /// **'You have reached today\'s voice limit'**
  String get vidyaLimitTitle;

  /// VIDYA voice-quota (429) calm limit state body.
  ///
  /// In en, this message translates to:
  /// **'Your voice minutes will refresh. You can keep using the tools in the meantime.'**
  String get vidyaLimitBody;

  /// VIDYA network/timeout failure state title.
  ///
  /// In en, this message translates to:
  /// **'That did not go through'**
  String get vidyaErrorTitle;

  /// VIDYA network/timeout failure state body.
  ///
  /// In en, this message translates to:
  /// **'Check your connection and tap the seal to try again.'**
  String get vidyaErrorBody;

  /// App-bar action opening the Prep desk (teaching tools grid).
  ///
  /// In en, this message translates to:
  /// **'Prep desk'**
  String get vidyaPrepDesk;

  /// Confirm-chip label for the Visual Aid flow.
  ///
  /// In en, this message translates to:
  /// **'Visual aid'**
  String get vidyaFlowVisualAid;

  /// Confirm-chip label for the Virtual Field Trip flow.
  ///
  /// In en, this message translates to:
  /// **'Virtual field trip'**
  String get vidyaFlowVirtualFieldTrip;

  /// Confirm-chip label for the Video Storyteller flow.
  ///
  /// In en, this message translates to:
  /// **'Video story'**
  String get vidyaFlowVideoStoryteller;

  /// Label/tooltip for the inline field mic that dictates one form field (topic/question) by voice.
  ///
  /// In en, this message translates to:
  /// **'Dictate'**
  String get vidyaFieldMicLabel;

  /// App-bar action + sheet title that opens VIDYA (the co-teacher) from any tool screen.
  ///
  /// In en, this message translates to:
  /// **'Ask VIDYA'**
  String get vidyaOpen;

  /// Title of the Parent Hotline tool (U-PH3): an AI voice call to a student's parent.
  ///
  /// In en, this message translates to:
  /// **'Parent Hotline'**
  String get parentHotlineTitle;

  /// Dashboard/Create subtitle for the Parent Hotline tool.
  ///
  /// In en, this message translates to:
  /// **'Call a student\'s parent in their language'**
  String get parentHotlineSubtitle;

  /// Saffron section eyebrow above the student picker on the Parent Hotline screen.
  ///
  /// In en, this message translates to:
  /// **'Parent hotline'**
  String get parentHotlineEyebrow;

  /// One-line intro under the eyebrow on the pick-student stage.
  ///
  /// In en, this message translates to:
  /// **'Choose whose parent to call.'**
  String get parentHotlinePickStudentIntro;

  /// Label for the class filter above the student list.
  ///
  /// In en, this message translates to:
  /// **'Class'**
  String get parentHotlineClassLabel;

  /// Inline hint on a student row that has no parent phone on record (mirrors the server 422); the row is disabled.
  ///
  /// In en, this message translates to:
  /// **'No parent number saved'**
  String get parentHotlineNoPhone;

  /// Signed-out EmptyView title on the Parent Hotline (no roster without an identity).
  ///
  /// In en, this message translates to:
  /// **'Sign in to see your students'**
  String get parentHotlineSignedOutTitle;

  /// Signed-out EmptyView body on the Parent Hotline.
  ///
  /// In en, this message translates to:
  /// **'Your class roster loads once you\'re signed in. The parent hotline needs your account before it can place a call.'**
  String get parentHotlineSignedOutBody;

  /// Saffron eyebrow on the reason stage.
  ///
  /// In en, this message translates to:
  /// **'Why are you calling'**
  String get parentHotlineReasonEyebrow;

  /// Reason card label — consecutive absences.
  ///
  /// In en, this message translates to:
  /// **'Repeated absences'**
  String get parentHotlineReasonAbsencesLabel;

  /// Reason card description — consecutive absences.
  ///
  /// In en, this message translates to:
  /// **'The student has missed several days in a row.'**
  String get parentHotlineReasonAbsencesDesc;

  /// Reason card label — poor performance.
  ///
  /// In en, this message translates to:
  /// **'Slipping in a subject'**
  String get parentHotlineReasonPerformanceLabel;

  /// Reason card description — poor performance.
  ///
  /// In en, this message translates to:
  /// **'Recent marks or classwork need attention.'**
  String get parentHotlineReasonPerformanceDesc;

  /// Reason card label — behavioural concern.
  ///
  /// In en, this message translates to:
  /// **'Behaviour in class'**
  String get parentHotlineReasonBehaviourLabel;

  /// Reason card description — behavioural concern.
  ///
  /// In en, this message translates to:
  /// **'Something happened the parent should know about.'**
  String get parentHotlineReasonBehaviourDesc;

  /// Reason card label — positive feedback.
  ///
  /// In en, this message translates to:
  /// **'Good news to share'**
  String get parentHotlineReasonPositiveLabel;

  /// Reason card description — positive feedback.
  ///
  /// In en, this message translates to:
  /// **'Celebrate a win with the parent.'**
  String get parentHotlineReasonPositiveDesc;

  /// Saffron eyebrow on the compose stage.
  ///
  /// In en, this message translates to:
  /// **'Prepare the call'**
  String get parentHotlineComposeEyebrow;

  /// Label for the multiline teacher-note field on the compose stage.
  ///
  /// In en, this message translates to:
  /// **'Add a note'**
  String get parentHotlineNoteLabel;

  /// Reason-specific placeholder for the teacher note — absences.
  ///
  /// In en, this message translates to:
  /// **'Anything the parent should know about the days missed?'**
  String get parentHotlineNoteHintAbsences;

  /// Reason-specific placeholder for the teacher note — poor performance.
  ///
  /// In en, this message translates to:
  /// **'What would help the student improve?'**
  String get parentHotlineNoteHintPerformance;

  /// Reason-specific placeholder for the teacher note — behaviour.
  ///
  /// In en, this message translates to:
  /// **'What happened, and what support would help at home?'**
  String get parentHotlineNoteHintBehaviour;

  /// Reason-specific placeholder for the teacher note — positive feedback.
  ///
  /// In en, this message translates to:
  /// **'What is the good news to share?'**
  String get parentHotlineNoteHintPositive;

  /// Primary CTA on the compose stage that drafts the opening message.
  ///
  /// In en, this message translates to:
  /// **'Draft the message'**
  String get parentHotlineDraftAction;

  /// Title of the inline error banner on the Parent Hotline.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong'**
  String get parentHotlineErrorTitle;

  /// Fallback message when the server gave no user-safe error text.
  ///
  /// In en, this message translates to:
  /// **'That didn\'t go through. Please try again.'**
  String get parentHotlineGenericError;

  /// Evidence panel header — absences reason.
  ///
  /// In en, this message translates to:
  /// **'Attendance'**
  String get parentHotlineEvidenceAttendanceHeader;

  /// Evidence panel header — poor-performance reason.
  ///
  /// In en, this message translates to:
  /// **'Recent marks'**
  String get parentHotlineEvidenceMarksHeader;

  /// Evidence panel header — behavioural reason.
  ///
  /// In en, this message translates to:
  /// **'What happened'**
  String get parentHotlineEvidenceBehaviourHeader;

  /// Evidence panel header — positive-feedback reason.
  ///
  /// In en, this message translates to:
  /// **'The good news'**
  String get parentHotlineEvidencePositiveHeader;

  /// Absent-days badge in the evidence panel.
  ///
  /// In en, this message translates to:
  /// **'{days, plural, =1{1 day absent in a row} other{{days} days absent in a row}}'**
  String parentHotlineEvidenceAbsentDays(int days);

  /// Evidence panel prompt — absences.
  ///
  /// In en, this message translates to:
  /// **'Confirm the days missed so the parent hears the exact record.'**
  String get parentHotlineEvidenceAbsencePrompt;

  /// Evidence panel prompt — poor performance when marks are on record.
  ///
  /// In en, this message translates to:
  /// **'The latest marks are ready to mention on the call.'**
  String get parentHotlineEvidenceMarksPrompt;

  /// Evidence panel prompt — poor performance when no marks are available (the performance read 401s in foundation-v1).
  ///
  /// In en, this message translates to:
  /// **'No recent marks on record yet. Add what the parent should know below.'**
  String get parentHotlineEvidenceMarksEmpty;

  /// Evidence panel prompt — behavioural concern.
  ///
  /// In en, this message translates to:
  /// **'Describe what happened and the support that would help at home.'**
  String get parentHotlineEvidenceBehaviourPrompt;

  /// Evidence panel prompt — positive feedback.
  ///
  /// In en, this message translates to:
  /// **'Share the win you\'d like the parent to celebrate.'**
  String get parentHotlineEvidencePositivePrompt;

  /// Saffron eyebrow over the drafted message on the review stage.
  ///
  /// In en, this message translates to:
  /// **'Message home'**
  String get parentHotlineReviewEyebrow;

  /// Primary decision-bar action that places the AI voice call.
  ///
  /// In en, this message translates to:
  /// **'Call parent'**
  String get parentHotlineCall;

  /// Decision-bar action that copies the message to paste in WhatsApp (the universal fallback).
  ///
  /// In en, this message translates to:
  /// **'Copy for WhatsApp'**
  String get parentHotlineWhatsApp;

  /// Disabled Call label during the 5-minute dedup cool-down, showing the mm:ss countdown.
  ///
  /// In en, this message translates to:
  /// **'Call again in {time}'**
  String parentHotlineCallAgainIn(String time);

  /// NoteBanner shown when the parent's language has no auto-call voice (mirrors the server 422).
  ///
  /// In en, this message translates to:
  /// **'Auto-call isn\'t available for {language} yet — copy for WhatsApp instead.'**
  String parentHotlineUnsupportedLanguage(String language);

  /// Masked parent phone in the review meta line — last 4 digits only (F9-001, never the full number).
  ///
  /// In en, this message translates to:
  /// **'•••• {last4}'**
  String parentHotlinePhoneMask(String last4);

  /// Honesty line in the review meta: the parent hears an automated AI notice (dignity + transparency).
  ///
  /// In en, this message translates to:
  /// **'The call opens with an automated AI voice notice.'**
  String get parentHotlineAiNotice;

  /// Snackbar confirming the message was copied to the clipboard for WhatsApp.
  ///
  /// In en, this message translates to:
  /// **'Message copied — paste it in WhatsApp to send.'**
  String get parentHotlineCopied;

  /// Premium-gate panel title (the outreach route returns 403 PREMIUM_REQUIRED).
  ///
  /// In en, this message translates to:
  /// **'Parent Hotline needs an advanced plan'**
  String get parentHotlinePremiumTitle;

  /// Premium-gate panel body.
  ///
  /// In en, this message translates to:
  /// **'Placing an AI voice call to a parent is part of the advanced plan. You can still copy a message to send on WhatsApp for free.'**
  String get parentHotlinePremiumBody;

  /// Placeholder title for the calling/summary stages (U-PH4/U-PH5), not built in this unit.
  ///
  /// In en, this message translates to:
  /// **'The call view is on its way'**
  String get parentHotlineComingSoonTitle;

  /// Placeholder body for the calling/summary stages.
  ///
  /// In en, this message translates to:
  /// **'Placing and following the call arrives in the next update.'**
  String get parentHotlineComingSoonBody;

  /// Display headline on the calling (waiting) stage while the AI voice call runs. {name} is the student whose parent is being called.
  ///
  /// In en, this message translates to:
  /// **'Calling {name}\'s parent…'**
  String parentHotlineCallingTitle(String name);

  /// Calling-stage status line while the call is placed but the parent has not started talking yet (callStatus initiated, no turns).
  ///
  /// In en, this message translates to:
  /// **'Ringing…'**
  String get parentHotlineCallingRinging;

  /// Calling-stage status line once the parent and the AI agent have started exchanging turns.
  ///
  /// In en, this message translates to:
  /// **'Conversation in progress'**
  String get parentHotlineCallingInProgress;

  /// Live tabular pill on the calling stage counting the back-and-forth turns so far. Shown only once more than one exchange has happened.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 exchange} other{{count} exchanges}}'**
  String parentHotlineCallingExchanges(int count);

  /// Quiet reassurance on the calling stage: leaving does not cancel the call; the summary is ready on return (backs the resume path).
  ///
  /// In en, this message translates to:
  /// **'You can leave this screen — the summary will be waiting for you.'**
  String get parentHotlineCallingReassurance;
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
