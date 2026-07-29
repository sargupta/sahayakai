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

  /// Shared sign-in CTA for dead-end empty states (inbox / staffroom / network hub) that route to /login.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get actionSignIn;

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

  /// Result action bar: read the generated document aloud through TTS.
  ///
  /// In en, this message translates to:
  /// **'Listen'**
  String get readAloudListen;

  /// Result action bar: stop the read-aloud playback that is in progress.
  ///
  /// In en, this message translates to:
  /// **'Stop'**
  String get readAloudStop;

  /// Snackbar shown when read-aloud text-to-speech fails.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t play the audio. Please try again.'**
  String get readAloudError;

  /// Short spoken summary auto-played after a voice-originated generation lands, when no topic is known.
  ///
  /// In en, this message translates to:
  /// **'Your {tool} is ready.'**
  String voiceResultReady(String tool);

  /// Short spoken summary auto-played after a voice-originated generation lands, naming the tool and topic.
  ///
  /// In en, this message translates to:
  /// **'Your {tool} on {topic} is ready.'**
  String voiceResultReadyWithTopic(String tool, String topic);

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

  /// Saved content type label: assessment-submission (Assessment Scanner's saved grade — distinct from contentTypeAssessment, which is Assess Assignment). English-only in every locale for now, joining the same pre-existing, tracked Library-labels translation backlog as the other 11 contentType* keys (see T2-U8/check_i18n_gate.sh scope notes) — not a new regression.
  ///
  /// In en, this message translates to:
  /// **'Scanned assessment'**
  String get contentTypeAssessmentSubmission;

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

  /// Title of the one-time confirmation dialog shown right after a successful delete-account call, before the teacher is signed out.
  ///
  /// In en, this message translates to:
  /// **'Account scheduled for deletion'**
  String get settingsDeleteSuccessTitle;

  /// Button on the delete-success dialog that requests the real data export through the authenticated API client, when the delete-account response carried an export path. Shows a spinner while the request is in flight, then hands the returned archive to the OS share sheet.
  ///
  /// In en, this message translates to:
  /// **'Export my data'**
  String get settingsExportDataAction;

  /// Shown when POST /api/export returns a background job instead of the archive itself (only reachable for a very large individual export). Deliberately does not promise an email or an automatic download, because nothing in the backend currently completes that job.
  ///
  /// In en, this message translates to:
  /// **'Your export is too large to prepare right away, so we\'ve queued it instead. Please try again later, or contact support for a copy of your data.'**
  String get settingsExportQueuedMessage;

  /// Shown when the export request fails for a reason other than reauth (network error, server error, unexpected response shape).
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t prepare your export. Please try again.'**
  String get settingsExportFailedMessage;

  /// Dismisses the delete-success dialog; the teacher is signed out and navigated away immediately after.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get settingsDeleteSuccessDone;

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

  /// App bar title of the Me tab: the operating-system hub (profile summary, plan and usage, defaults, settings).
  ///
  /// In en, this message translates to:
  /// **'Me'**
  String get meTitle;

  /// Section header over the plan tier and per-feature monthly usage on the Me hub.
  ///
  /// In en, this message translates to:
  /// **'Plan & usage'**
  String get mePlanUsageTitle;

  /// One-line explanation above the usage rows: the counts are for the current calendar month.
  ///
  /// In en, this message translates to:
  /// **'How much you have used this month.'**
  String get mePlanUsageSubtitle;

  /// A metered feature's usage, e.g. '3 / 10' meaning 3 of 10 used this month. Keep the numbers and the slash; the server supplies the values.
  ///
  /// In en, this message translates to:
  /// **'{used} / {limit}'**
  String meUsageValue(int used, int limit);

  /// Shown in place of a count/bar for a feature with no monthly cap on the current plan.
  ///
  /// In en, this message translates to:
  /// **'Unlimited'**
  String get meUsageUnlimited;

  /// Shown inside the Plan & usage card when the usage read fails while the rest of the hub is signed in.
  ///
  /// In en, this message translates to:
  /// **'We could not load your usage. Please try again.'**
  String get meUsageUnavailable;

  /// Section header over the education board and app language, which shape the material SahayakAI generates.
  ///
  /// In en, this message translates to:
  /// **'Defaults'**
  String get meDefaultsTitle;

  /// Section header over the rows that link to Settings and to signing out.
  ///
  /// In en, this message translates to:
  /// **'Privacy & settings'**
  String get mePrivacyTitle;

  /// Default role shown under the teacher's name on the Me hub when they hold no administrative role.
  ///
  /// In en, this message translates to:
  /// **'Teacher'**
  String get meRoleTeacher;

  /// Usage-row name for the AI teaching-avatar feature (a gated feature that is not one of the tool screens).
  ///
  /// In en, this message translates to:
  /// **'AI avatars'**
  String get usageFeatureAvatar;

  /// Usage-row name for the cloud voice-to-text (speech recognition) feature.
  ///
  /// In en, this message translates to:
  /// **'Voice to text'**
  String get usageFeatureVoiceToText;

  /// Usage-row name for the VIDYA chat assistant. 'VIDYA' is a product name; keep it as-is.
  ///
  /// In en, this message translates to:
  /// **'VIDYA assistant'**
  String get usageFeatureAssistant;

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

  /// Label for the optional textbook-page image input shared by Lesson Plan and Quiz.
  ///
  /// In en, this message translates to:
  /// **'Textbook page photo (optional)'**
  String get toolImageOptionalLabel;

  /// Helper text under the optional image input label.
  ///
  /// In en, this message translates to:
  /// **'Add a page photo and it becomes the main source, or leave blank.'**
  String get toolImageOptionalHint;

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

  /// Label for the button that saves the worksheet to the library.
  ///
  /// In en, this message translates to:
  /// **'Save to Library'**
  String get worksheetSave;

  /// Label while the save request is in flight.
  ///
  /// In en, this message translates to:
  /// **'Saving'**
  String get worksheetSaving;

  /// Confirmation shown once the worksheet is saved.
  ///
  /// In en, this message translates to:
  /// **'Saved to your Library'**
  String get worksheetSaved;

  /// Title of the inline error shown when a save fails.
  ///
  /// In en, this message translates to:
  /// **'Could not save'**
  String get worksheetSaveFailedTitle;

  /// Body of the inline error shown when a save fails.
  ///
  /// In en, this message translates to:
  /// **'We could not save this worksheet to your library. Please try again.'**
  String get worksheetSaveFailedBody;

  /// Label for the retry button after a failed save.
  ///
  /// In en, this message translates to:
  /// **'Try saving again'**
  String get worksheetSaveRetry;

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

  /// Action on the upgrade / limit prompts, opening the pricing page.
  ///
  /// In en, this message translates to:
  /// **'See plans and pricing'**
  String get worksheetSeePricing;

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

  /// Dropdown option that reveals a free-text subject field, for subjects not in the list (e.g. Economics, Business Studies, Political Science).
  ///
  /// In en, this message translates to:
  /// **'Other subject'**
  String get examPaperSubjectOther;

  /// Label for the free-text field shown when 'Other subject' is chosen.
  ///
  /// In en, this message translates to:
  /// **'Subject name'**
  String get examPaperSubjectOtherLabel;

  /// Placeholder in the free-text subject field.
  ///
  /// In en, this message translates to:
  /// **'For example, Economics'**
  String get examPaperSubjectOtherHint;

  /// Validation error when 'Other subject' is chosen but no subject is typed.
  ///
  /// In en, this message translates to:
  /// **'Please enter a subject.'**
  String get examPaperSubjectOtherError;

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

  /// Spoken mother-tongue welcome, auto-played once per session on the VIDYA voice home (skipped under reduce-motion). Non-English locales fall back to English until the translation backlog (P5) lands.
  ///
  /// In en, this message translates to:
  /// **'Welcome, teacher. Speak in your language, and I will prepare your work.'**
  String get vidyaGreeting;

  /// Accent pill above the VIDYA home eyebrow, echoing the PWA hero's AI badge.
  ///
  /// In en, this message translates to:
  /// **'Your AI co-teaching assistant'**
  String get vidyaHeroBadge;

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

  /// VIDYA signed-out terminal panel action button, routes to the login screen.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get vidyaSignIn;

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

  /// VIDYA failure state title — shared by network/timeout failures and unexpected mic/recorder plugin failures (T1-U6), so it must stay cause-agnostic.
  ///
  /// In en, this message translates to:
  /// **'That did not go through'**
  String get vidyaErrorTitle;

  /// VIDYA failure state body — shared by network/timeout failures and unexpected mic/recorder plugin failures (T1-U6). Was network-specific ("Check your connection..."), which read as wrong guidance for a mic/recorder failure; kept cause-agnostic instead, matching errorGeneric's phrasing.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Tap the seal to try again.'**
  String get vidyaErrorBody;

  /// App-bar action opening the Prep desk (teaching tools grid).
  ///
  /// In en, this message translates to:
  /// **'Prep desk'**
  String get vidyaPrepDesk;

  /// App-bar action (shown only while a conversation is active) that clears VIDYA's transcript — the manual analogue of the web's Trash2 'Clear Context' button.
  ///
  /// In en, this message translates to:
  /// **'Clear conversation'**
  String get vidyaClearConversation;

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

  /// Brief snackbar shown when the inline field mic's speech-to-text fails unexpectedly (network, 401, 413…).
  ///
  /// In en, this message translates to:
  /// **'Didn\'t catch that. Try again or type it in.'**
  String get vidyaFieldMicFailed;

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

  /// EmptyView title on the pick-student stage when the teacher IS signed in but the student-roster API isn't on the app yet (distinct from the signed-out case).
  ///
  /// In en, this message translates to:
  /// **'Your class list isn\'t available yet'**
  String get parentHotlineRosterUnavailableTitle;

  /// EmptyView body on the pick-student stage when the teacher is signed in but the roster can't be fetched on the app yet.
  ///
  /// In en, this message translates to:
  /// **'We can\'t load your students here just yet. This is coming in a later update. You\'re already signed in, so there\'s nothing you need to fix.'**
  String get parentHotlineRosterUnavailableBody;

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

  /// Summary masthead eyebrow doc-type (U-PH5); the reason word is appended after a middot, e.g. 'PARENT CALL · ABSENCES'.
  ///
  /// In en, this message translates to:
  /// **'Parent call'**
  String get parentHotlineSummaryDocType;

  /// Short reason word in the summary eyebrow for the consecutive-absences reason.
  ///
  /// In en, this message translates to:
  /// **'Absences'**
  String get parentHotlineSummaryReasonAbsences;

  /// Short reason word in the summary eyebrow for the poor-performance reason.
  ///
  /// In en, this message translates to:
  /// **'Performance'**
  String get parentHotlineSummaryReasonPerformance;

  /// Short reason word in the summary eyebrow for the behavioural-concern reason.
  ///
  /// In en, this message translates to:
  /// **'Behaviour'**
  String get parentHotlineSummaryReasonBehaviour;

  /// Short reason word in the summary eyebrow for the positive-feedback reason.
  ///
  /// In en, this message translates to:
  /// **'Good news'**
  String get parentHotlineSummaryReasonPositive;

  /// Summary masthead title (U-PH5), the student whose parent was called.
  ///
  /// In en, this message translates to:
  /// **'{name}\'s parent'**
  String parentHotlineSummaryTitle(String name);

  /// Call-duration meta badge on the summary masthead, in whole minutes.
  ///
  /// In en, this message translates to:
  /// **'{minutes} min'**
  String parentHotlineSummaryDurationMin(int minutes);

  /// Sentiment badge label: the parent was cooperative on the call.
  ///
  /// In en, this message translates to:
  /// **'Cooperative'**
  String get parentHotlineSentimentCooperative;

  /// Sentiment badge label: the parent sounded concerned.
  ///
  /// In en, this message translates to:
  /// **'Concerned'**
  String get parentHotlineSentimentConcerned;

  /// Sentiment badge label: the parent was grateful.
  ///
  /// In en, this message translates to:
  /// **'Grateful'**
  String get parentHotlineSentimentGrateful;

  /// Sentiment badge label: the parent was upset.
  ///
  /// In en, this message translates to:
  /// **'Upset'**
  String get parentHotlineSentimentUpset;

  /// Sentiment badge label for an indifferent/neutral parent. Use a dignified word (not 'indifferent') that reads as reserved/neutral.
  ///
  /// In en, this message translates to:
  /// **'Reserved'**
  String get parentHotlineSentimentIndifferent;

  /// Sentiment badge label: the parent seemed confused.
  ///
  /// In en, this message translates to:
  /// **'Confused'**
  String get parentHotlineSentimentConfused;

  /// Summary section header over the AI recap of the parent's response.
  ///
  /// In en, this message translates to:
  /// **'What the parent said'**
  String get parentHotlineSummarySaidHeader;

  /// Summary section header over the concerns the parent raised (hidden when none).
  ///
  /// In en, this message translates to:
  /// **'Concerns raised'**
  String get parentHotlineSummaryConcernsHeader;

  /// Summary section header over what the parent committed to (hidden when none).
  ///
  /// In en, this message translates to:
  /// **'Parent commitments'**
  String get parentHotlineSummaryCommitmentsHeader;

  /// Summary section header over the teacher's follow-up to-dos (the saffron block).
  ///
  /// In en, this message translates to:
  /// **'Your action items'**
  String get parentHotlineSummaryActionsHeader;

  /// Summary section header over the home-learning guidance the agent shared (hidden when none).
  ///
  /// In en, this message translates to:
  /// **'Guidance shared'**
  String get parentHotlineSummaryGuidanceHeader;

  /// Summary section header over the suggested follow-up (shown only when follow-up is needed).
  ///
  /// In en, this message translates to:
  /// **'Follow-up'**
  String get parentHotlineSummaryFollowUpHeader;

  /// Collapsed transcript disclosure title on the summary; {count} is the number of turns.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{View conversation · 1 message} other{View conversation · {count} messages}}'**
  String parentHotlineSummaryTranscript(int count);

  /// Summary footer primary action — closes the summary and returns.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get parentHotlineSummaryDone;

  /// Summary footer ghost action — starts a fresh call (subject to the 5-minute dedup cool-down).
  ///
  /// In en, this message translates to:
  /// **'Call again later'**
  String get parentHotlineSummaryCallAgain;

  /// Terminal panel title when the outreach was the WhatsApp-copy path (no call placed).
  ///
  /// In en, this message translates to:
  /// **'Message copied'**
  String get parentHotlineSummaryManualTitle;

  /// Terminal panel body for the WhatsApp-copy path.
  ///
  /// In en, this message translates to:
  /// **'Paste it in WhatsApp to send it to the parent.'**
  String get parentHotlineSummaryManualBody;

  /// Terminal panel title when the call ended busy.
  ///
  /// In en, this message translates to:
  /// **'The line was busy'**
  String get parentHotlineSummaryBusy;

  /// Terminal panel title when the parent did not answer.
  ///
  /// In en, this message translates to:
  /// **'No answer'**
  String get parentHotlineSummaryNoAnswer;

  /// Terminal panel title when the call failed to connect.
  ///
  /// In en, this message translates to:
  /// **'The call couldn\'t connect'**
  String get parentHotlineSummaryFailed;

  /// Terminal panel body for a failed / no-answer / busy call.
  ///
  /// In en, this message translates to:
  /// **'The call didn\'t go through. You can try again, or copy the message to send on WhatsApp.'**
  String get parentHotlineSummaryFailedBody;

  /// Terminal panel action that re-dials the same outreach.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get parentHotlineSummaryTryAgain;

  /// Terminal panel title when the call ended before a real conversation happened.
  ///
  /// In en, this message translates to:
  /// **'The call ended too soon'**
  String get parentHotlineSummaryNoConversationTitle;

  /// Terminal panel body when the call ended before a conversation could happen.
  ///
  /// In en, this message translates to:
  /// **'The call ended before a conversation could happen. You can try again, or send the message on WhatsApp.'**
  String get parentHotlineSummaryNoConversationBody;

  /// Terminal panel title when the call finished but no AI summary was produced; the transcript is shown below.
  ///
  /// In en, this message translates to:
  /// **'Summary isn\'t available'**
  String get parentHotlineSummaryUnavailableTitle;

  /// Terminal panel body when the summary is unavailable but a transcript exists.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t prepare a summary for this call. The conversation is below.'**
  String get parentHotlineSummaryUnavailableBody;

  /// Content Creator Studio hub — the page/app-bar title and the dashboard tool-tile name for the multimedia hub that groups Visual Aid, Virtual Field Trip and Video Storyteller.
  ///
  /// In en, this message translates to:
  /// **'Content Creator Studio'**
  String get contentCreatorTitle;

  /// One-line description under the Content Creator tool name on the dashboard tile and the Create palette.
  ///
  /// In en, this message translates to:
  /// **'Create multimedia for your class'**
  String get contentCreatorTileSubtitle;

  /// Intro line under the Content Creator Studio title, describing the hub.
  ///
  /// In en, this message translates to:
  /// **'Tools to help you create engaging multimedia content for your classroom.'**
  String get contentCreatorSubtitle;

  /// Saffron section eyebrow above the three tool cards on the Content Creator Studio hub.
  ///
  /// In en, this message translates to:
  /// **'Choose a tool'**
  String get contentCreatorSectionEyebrow;

  /// Content Creator hub card description for the Visual Aid Designer tool.
  ///
  /// In en, this message translates to:
  /// **'Create simple line drawings and diagrams for your lessons.'**
  String get contentCreatorVisualAidDesc;

  /// Content Creator hub card description for the Virtual Field Trip tool.
  ///
  /// In en, this message translates to:
  /// **'Plan exciting virtual tours using Google Earth.'**
  String get contentCreatorFieldTripDesc;

  /// Content Creator hub card description for the Video Storyteller tool.
  ///
  /// In en, this message translates to:
  /// **'Discover curated educational videos for your lessons.'**
  String get contentCreatorVideoDesc;

  /// Visual Aid Designer tool name (dashboard tile, palette, screen app bar).
  ///
  /// In en, this message translates to:
  /// **'Visual Aid'**
  String get visualAidTitle;

  /// One-line description under the Visual Aid tool name.
  ///
  /// In en, this message translates to:
  /// **'Draw a teaching illustration'**
  String get visualAidSubtitle;

  /// Idle/empty message before any drawing is generated.
  ///
  /// In en, this message translates to:
  /// **'Describe a drawing and tap Create.'**
  String get visualAidEmpty;

  /// Label for the required prompt field.
  ///
  /// In en, this message translates to:
  /// **'What should the drawing show?'**
  String get visualAidPromptLabel;

  /// Hint/example text in the prompt field.
  ///
  /// In en, this message translates to:
  /// **'For example, The parts of a plant cell'**
  String get visualAidPromptHint;

  /// Validation error when the prompt is empty.
  ///
  /// In en, this message translates to:
  /// **'Please describe the drawing you need.'**
  String get visualAidPromptError;

  /// Label for the optional grade-level picker.
  ///
  /// In en, this message translates to:
  /// **'Grade level'**
  String get visualAidGradeLabel;

  /// The 'no grade chosen' option in the grade picker.
  ///
  /// In en, this message translates to:
  /// **'Any grade'**
  String get visualAidGradeAny;

  /// Label for the optional subject picker.
  ///
  /// In en, this message translates to:
  /// **'Subject'**
  String get visualAidSubjectLabel;

  /// The 'no subject chosen' option in the subject picker.
  ///
  /// In en, this message translates to:
  /// **'Any subject'**
  String get visualAidSubjectAny;

  /// Inline 'optional' marker on optional fields.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get visualAidOptional;

  /// The primary submit button that generates the drawing.
  ///
  /// In en, this message translates to:
  /// **'Create visual aid'**
  String get visualAidAction;

  /// Fallback masthead title when the prompt is unknown.
  ///
  /// In en, this message translates to:
  /// **'Visual aid'**
  String get visualAidResultTitle;

  /// Section heading over the model's pedagogical guidance.
  ///
  /// In en, this message translates to:
  /// **'How to use this'**
  String get visualAidHowToUse;

  /// Callout label over the model's discussion question.
  ///
  /// In en, this message translates to:
  /// **'Discussion spark'**
  String get visualAidDiscussionSpark;

  /// Accessibility label for the generated image when no prompt is known.
  ///
  /// In en, this message translates to:
  /// **'Generated teaching illustration'**
  String get visualAidImageLabel;

  /// Shown when decoded bytes are not a renderable image.
  ///
  /// In en, this message translates to:
  /// **'This drawing could not be displayed.'**
  String get visualAidImageError;

  /// Empty-result copy when the server returned no usable image.
  ///
  /// In en, this message translates to:
  /// **'No drawing came back for that prompt. Please rephrase it and try again.'**
  String get visualAidNoImage;

  /// 401 prompt: the token is stale, sign in again.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again to use this tool.'**
  String get visualAidSignIn;

  /// 403 upgrade prompt title.
  ///
  /// In en, this message translates to:
  /// **'A higher plan is needed'**
  String get visualAidUpgradeTitle;

  /// 403 upgrade prompt body.
  ///
  /// In en, this message translates to:
  /// **'Visual aids are part of a higher plan. Please upgrade to keep creating drawings.'**
  String get visualAidUpgradeBody;

  /// Action that opens the pricing page from a limit/upgrade prompt.
  ///
  /// In en, this message translates to:
  /// **'See plans and pricing'**
  String get visualAidSeePricing;

  /// 429 daily image-budget title (resets tomorrow).
  ///
  /// In en, this message translates to:
  /// **'That is all your drawings for today'**
  String get visualAidDailyLimitTitle;

  /// 429 daily image-budget body.
  ///
  /// In en, this message translates to:
  /// **'Your plan includes a set number of visual aids each day. Your drawings reset tomorrow, or you can raise the daily limit on a higher plan.'**
  String get visualAidDailyLimitBody;

  /// 429 monthly usage-limit title.
  ///
  /// In en, this message translates to:
  /// **'You have reached your limit'**
  String get visualAidLimitTitle;

  /// 429 monthly usage-limit body.
  ///
  /// In en, this message translates to:
  /// **'You have used your visual aids for this month. Your drawings reset next month, or you can raise the limit on a higher plan.'**
  String get visualAidLimitBody;

  /// 400 safety/rephrase hint.
  ///
  /// In en, this message translates to:
  /// **'We could not create that drawing. Please rephrase it and try again.'**
  String get visualAidRephrase;

  /// 422 IMAGE_GENERATION_EMPTY: the model produced no image; use fewer labels.
  ///
  /// In en, this message translates to:
  /// **'The drawing came back empty. Try describing it with fewer labels.'**
  String get visualAidEmptyGeneration;

  /// 503/5xx busy message without a Retry-After hint.
  ///
  /// In en, this message translates to:
  /// **'The assistant is busy right now. Please try again in a moment.'**
  String get visualAidBusy;

  /// Shown on a 503 busy response that carried Retry-After.
  ///
  /// In en, this message translates to:
  /// **'{seconds, plural, =1{The assistant is busy right now. Please try again in about 1 second.} other{The assistant is busy right now. Please try again in about {seconds} seconds.}}'**
  String visualAidBusyRetryAfter(int seconds);

  /// Client-side timeout message.
  ///
  /// In en, this message translates to:
  /// **'This is taking longer than expected. Please try again.'**
  String get visualAidTimeout;

  /// Video Storyteller tool name (dashboard tile, palette, screen app bar).
  ///
  /// In en, this message translates to:
  /// **'Video Storyteller'**
  String get videoStorytellerTitle;

  /// One-line description under the Video Storyteller tool name.
  ///
  /// In en, this message translates to:
  /// **'Find teaching videos'**
  String get videoStorytellerSubtitle;

  /// Idle/empty message before any search is run.
  ///
  /// In en, this message translates to:
  /// **'Pick a subject or topic and tap Find videos.'**
  String get videoStorytellerEmpty;

  /// Label for the optional topic/chapter search field.
  ///
  /// In en, this message translates to:
  /// **'Topic or chapter'**
  String get videoStorytellerTopicLabel;

  /// Hint/example text in the topic field.
  ///
  /// In en, this message translates to:
  /// **'For example, The water cycle'**
  String get videoStorytellerTopicHint;

  /// Label for the optional subject picker.
  ///
  /// In en, this message translates to:
  /// **'Subject'**
  String get videoStorytellerSubjectLabel;

  /// The 'no subject chosen' option in the subject picker.
  ///
  /// In en, this message translates to:
  /// **'Any subject'**
  String get videoStorytellerSubjectAny;

  /// Label for the optional grade-level picker.
  ///
  /// In en, this message translates to:
  /// **'Grade level'**
  String get videoStorytellerGradeLabel;

  /// The 'no grade chosen' option in the grade picker.
  ///
  /// In en, this message translates to:
  /// **'Any grade'**
  String get videoStorytellerGradeAny;

  /// Inline 'optional' marker on optional fields.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get videoStorytellerOptional;

  /// The primary submit button that searches for videos.
  ///
  /// In en, this message translates to:
  /// **'Find videos'**
  String get videoStorytellerAction;

  /// Empty-result copy when no videos were found.
  ///
  /// In en, this message translates to:
  /// **'No videos came back for that. Try a different subject or topic.'**
  String get videoStorytellerNoResults;

  /// Button that expands a video category beyond its first six cards to show the full ranked list. {count} is the total number of videos in that category.
  ///
  /// In en, this message translates to:
  /// **'View all {count}'**
  String videoStorytellerViewAll(int count);

  /// Badge on videos from official Indian education channels (NCERT, Ministry of Education, IGNOU, UGC).
  ///
  /// In en, this message translates to:
  /// **'Official source'**
  String get videoStorytellerOfficialSource;

  /// Accessibility hint on a video card: tapping opens YouTube outside the app.
  ///
  /// In en, this message translates to:
  /// **'Opens in YouTube, outside the app.'**
  String get videoStorytellerOpensExternally;

  /// Section heading for the top-recommended videos bucket.
  ///
  /// In en, this message translates to:
  /// **'Top recommended for you'**
  String get videoStorytellerCategoryTopRecommended;

  /// Section heading for the storytelling videos bucket.
  ///
  /// In en, this message translates to:
  /// **'Storytelling for your subjects'**
  String get videoStorytellerCategoryStorytelling;

  /// Section heading for the pedagogy and teaching-methods videos bucket.
  ///
  /// In en, this message translates to:
  /// **'Pedagogy and teaching methods'**
  String get videoStorytellerCategoryPedagogy;

  /// Section heading for the government-updates videos bucket.
  ///
  /// In en, this message translates to:
  /// **'Government updates'**
  String get videoStorytellerCategoryGovtUpdates;

  /// Section heading for the teacher-training-courses videos bucket.
  ///
  /// In en, this message translates to:
  /// **'Teacher training courses'**
  String get videoStorytellerCategoryCourses;

  /// 401 prompt: the token is stale, sign in again.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again to use this tool.'**
  String get videoStorytellerSignIn;

  /// Client-side timeout message.
  ///
  /// In en, this message translates to:
  /// **'This is taking longer than expected. Please try again.'**
  String get videoStorytellerTimeout;

  /// 503/5xx busy message without a Retry-After hint.
  ///
  /// In en, this message translates to:
  /// **'The assistant is busy right now. Please try again in a moment.'**
  String get videoStorytellerBusy;

  /// Shown on a 503 busy response that carried Retry-After.
  ///
  /// In en, this message translates to:
  /// **'{seconds, plural, =1{The assistant is busy right now. Please try again in about 1 second.} other{The assistant is busy right now. Please try again in about {seconds} seconds.}}'**
  String videoStorytellerBusyRetryAfter(int seconds);

  /// 400/422 hint: rephrase or try a different topic.
  ///
  /// In en, this message translates to:
  /// **'We could not find videos for that. Please try a different topic.'**
  String get videoStorytellerRephrase;

  /// 429 rate-limit message for repeated searches.
  ///
  /// In en, this message translates to:
  /// **'You have searched a lot recently. Please try again in a little while.'**
  String get videoStorytellerLimit;

  /// Generic done/dismiss action; closes a result back to the form.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get actionDone;

  /// Virtual Field Trip tool name (dashboard tile, palette, screen app bar).
  ///
  /// In en, this message translates to:
  /// **'Virtual Field Trip'**
  String get virtualFieldTripTitle;

  /// One-line description under the Virtual Field Trip tool name.
  ///
  /// In en, this message translates to:
  /// **'Tour the world on Google Earth'**
  String get virtualFieldTripSubtitle;

  /// Idle/empty message before any trip is planned.
  ///
  /// In en, this message translates to:
  /// **'Enter a topic and tap Plan the trip.'**
  String get virtualFieldTripEmpty;

  /// Label for the required topic/theme field.
  ///
  /// In en, this message translates to:
  /// **'Topic or theme'**
  String get virtualFieldTripTopicLabel;

  /// Hint/example text in the topic field.
  ///
  /// In en, this message translates to:
  /// **'For example, The Great Barrier Reef'**
  String get virtualFieldTripTopicHint;

  /// Validation error when the required topic field is empty.
  ///
  /// In en, this message translates to:
  /// **'Please enter a topic for the trip.'**
  String get virtualFieldTripTopicError;

  /// Label for the optional grade-level picker.
  ///
  /// In en, this message translates to:
  /// **'Grade level'**
  String get virtualFieldTripGradeLabel;

  /// The 'no grade chosen' option in the grade picker.
  ///
  /// In en, this message translates to:
  /// **'Any grade'**
  String get virtualFieldTripGradeAny;

  /// Inline 'optional' marker on optional fields.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get virtualFieldTripOptional;

  /// The primary submit button that plans the field trip.
  ///
  /// In en, this message translates to:
  /// **'Plan the trip'**
  String get virtualFieldTripAction;

  /// The document-type eyebrow on the itinerary result masthead.
  ///
  /// In en, this message translates to:
  /// **'Virtual Field Trip'**
  String get virtualFieldTripDocType;

  /// Masthead badge showing how many stops the itinerary has.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 stop} other{{count} stops}}'**
  String virtualFieldTripStopCount(int count);

  /// Accessibility label for one numbered stop card.
  ///
  /// In en, this message translates to:
  /// **'Stop {number}: {name}'**
  String virtualFieldTripStopSemantics(int number, String name);

  /// Heading on the educational-fact highlight in a stop card.
  ///
  /// In en, this message translates to:
  /// **'Did you know?'**
  String get virtualFieldTripFactLabel;

  /// Heading on the reflection-prompt inset in a stop card.
  ///
  /// In en, this message translates to:
  /// **'Think about this'**
  String get virtualFieldTripReflectionLabel;

  /// Heading on the Bharat-First cultural-analogy section in a stop card.
  ///
  /// In en, this message translates to:
  /// **'In our context'**
  String get virtualFieldTripAnalogyLabel;

  /// Heading on the pedagogical-explanation section in a stop card.
  ///
  /// In en, this message translates to:
  /// **'Why we visit'**
  String get virtualFieldTripExplanationLabel;

  /// Button that opens a stop's location in Google Earth, outside the app.
  ///
  /// In en, this message translates to:
  /// **'Open in Google Earth'**
  String get virtualFieldTripOpenEarth;

  /// Accessibility hint on the Open in Google Earth action.
  ///
  /// In en, this message translates to:
  /// **'Opens Google Earth, outside the app.'**
  String get virtualFieldTripOpensExternally;

  /// Title of the calm panel shown for the benign 202 still-generating outcome.
  ///
  /// In en, this message translates to:
  /// **'Still planning your trip'**
  String get virtualFieldTripPendingTitle;

  /// Body of the calm still-generating panel: the trip keeps saving server-side.
  ///
  /// In en, this message translates to:
  /// **'Your field trip is still being planned. Check My Library in a minute.'**
  String get virtualFieldTripPendingBody;

  /// Empty-result copy when a planned trip had no usable stops.
  ///
  /// In en, this message translates to:
  /// **'No stops came back for that. Try a different topic.'**
  String get virtualFieldTripNoStops;

  /// 401 prompt: the token is stale, sign in again.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again to use this tool.'**
  String get virtualFieldTripSignIn;

  /// 403 plan-gate message: the tool is not on the teacher's plan.
  ///
  /// In en, this message translates to:
  /// **'This tool is not part of your current plan.'**
  String get virtualFieldTripUnavailable;

  /// Client-side timeout message.
  ///
  /// In en, this message translates to:
  /// **'This is taking longer than expected. Please try again.'**
  String get virtualFieldTripTimeout;

  /// 503/5xx busy message without a Retry-After hint.
  ///
  /// In en, this message translates to:
  /// **'The assistant is busy right now. Please try again in a moment.'**
  String get virtualFieldTripBusy;

  /// Shown on a 503 busy response that carried Retry-After.
  ///
  /// In en, this message translates to:
  /// **'{seconds, plural, =1{The assistant is busy right now. Please try again in about 1 second.} other{The assistant is busy right now. Please try again in about {seconds} seconds.}}'**
  String virtualFieldTripBusyRetryAfter(int seconds);

  /// 400/422 hint: rephrase or try a different topic.
  ///
  /// In en, this message translates to:
  /// **'We could not plan a trip for that. Please try a different topic.'**
  String get virtualFieldTripRephrase;

  /// 429 rate-limit message for repeated trips.
  ///
  /// In en, this message translates to:
  /// **'You have planned a lot of trips recently. Please try again in a little while.'**
  String get virtualFieldTripLimit;

  /// Assessment Scanner tool name (U-PD5).
  ///
  /// In en, this message translates to:
  /// **'Assessment Scanner'**
  String get assessmentScannerTitle;

  /// Assessment Scanner one-line description.
  ///
  /// In en, this message translates to:
  /// **'Grade a student\'s answer sheet page by page'**
  String get assessmentScannerSubtitle;

  /// Idle/empty prompt on the Assessment Scanner.
  ///
  /// In en, this message translates to:
  /// **'Add up to 3 photos of the answer sheet, then tap Grade.'**
  String get assessmentScannerEmpty;

  /// Primary action button on the Assessment Scanner.
  ///
  /// In en, this message translates to:
  /// **'Grade the answer sheet'**
  String get assessmentScannerSubmit;

  /// Result document title on the Assessment Scanner scorecard.
  ///
  /// In en, this message translates to:
  /// **'Assessment'**
  String get assessmentScannerResultTitle;

  /// Section header for the page-capture group.
  ///
  /// In en, this message translates to:
  /// **'The answer sheet'**
  String get assessmentScannerSectionSheet;

  /// Label for the multi-page capture field.
  ///
  /// In en, this message translates to:
  /// **'Answer sheet pages'**
  String get assessmentScannerPagesLabel;

  /// Hint under the pages field.
  ///
  /// In en, this message translates to:
  /// **'Add up to 3 clear photos, one per page.'**
  String get assessmentScannerPagesHint;

  /// Prompt inside the empty page-capture well.
  ///
  /// In en, this message translates to:
  /// **'Add a photo of the first page.'**
  String get assessmentScannerPagesEmpty;

  /// Label for one captured page.
  ///
  /// In en, this message translates to:
  /// **'Page {number}'**
  String assessmentScannerPageLabel(int number);

  /// Accessibility label for the per-page remove button.
  ///
  /// In en, this message translates to:
  /// **'Remove page {number}'**
  String assessmentScannerRemovePage(int number);

  /// Counter showing captured pages out of the cap.
  ///
  /// In en, this message translates to:
  /// **'{count} of {max} pages'**
  String assessmentScannerPageCounter(int count, int max);

  /// Note shown when the page cap is reached.
  ///
  /// In en, this message translates to:
  /// **'You can add up to {max} pages.'**
  String assessmentScannerPagesFull(int max);

  /// Camera button to add a page.
  ///
  /// In en, this message translates to:
  /// **'Take photo'**
  String get assessmentScannerTakePhoto;

  /// Gallery button to add a page.
  ///
  /// In en, this message translates to:
  /// **'Choose from gallery'**
  String get assessmentScannerChooseGallery;

  /// Subject picker label.
  ///
  /// In en, this message translates to:
  /// **'Subject'**
  String get assessmentScannerSubjectLabel;

  /// Hint under the subject picker.
  ///
  /// In en, this message translates to:
  /// **'Grading is tuned to the subject.'**
  String get assessmentScannerSubjectHint;

  /// Placeholder in the subject dropdown.
  ///
  /// In en, this message translates to:
  /// **'Choose a subject'**
  String get assessmentScannerSubjectPlaceholder;

  /// Validation error when no subject is selected.
  ///
  /// In en, this message translates to:
  /// **'Please choose the subject.'**
  String get assessmentScannerSubjectError;

  /// Grade picker label.
  ///
  /// In en, this message translates to:
  /// **'Grade level'**
  String get assessmentScannerGradeLabel;

  /// Placeholder in the grade dropdown.
  ///
  /// In en, this message translates to:
  /// **'Choose a grade'**
  String get assessmentScannerGradePlaceholder;

  /// Validation error when no grade is selected.
  ///
  /// In en, this message translates to:
  /// **'Please choose the grade.'**
  String get assessmentScannerGradeError;

  /// Inline 'optional' tag on the answer-key field.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get assessmentScannerOptional;

  /// Optional answer-key field label.
  ///
  /// In en, this message translates to:
  /// **'Answer key'**
  String get assessmentScannerAnswerKeyLabel;

  /// Hint under the answer-key field.
  ///
  /// In en, this message translates to:
  /// **'Paste the correct answers to grade against them.'**
  String get assessmentScannerAnswerKeyHint;

  /// Placeholder in the answer-key text field.
  ///
  /// In en, this message translates to:
  /// **'Type or paste the answer key'**
  String get assessmentScannerAnswerKeyPlaceholder;

  /// Privacy note under the form.
  ///
  /// In en, this message translates to:
  /// **'The student\'s name is never sent for grading.'**
  String get assessmentScannerPrivacyNote;

  /// Raw-marks caption under the score ring.
  ///
  /// In en, this message translates to:
  /// **'{awarded} of {max} marks'**
  String assessmentScannerScoreCaption(String awarded, String max);

  /// Suffix for the copied score line.
  ///
  /// In en, this message translates to:
  /// **'out of 100'**
  String get assessmentScannerScoreOutOf;

  /// Per-question marks badge, awarded over max.
  ///
  /// In en, this message translates to:
  /// **'{awarded}/{max}'**
  String assessmentScannerMarks(String awarded, String max);

  /// Masthead badge counting graded pages.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 page} other{{count} pages}}'**
  String assessmentScannerPagesMeta(int count);

  /// Masthead badge counting questions needing a teacher's review.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 to review} other{{count} to review}}'**
  String assessmentScannerReviewBadge(int count);

  /// Section header for the per-question list.
  ///
  /// In en, this message translates to:
  /// **'Question by question'**
  String get assessmentScannerQuestionsSection;

  /// Sub-label before the student's answer.
  ///
  /// In en, this message translates to:
  /// **'Student wrote'**
  String get assessmentScannerStudentAnswerLabel;

  /// Sub-label before the per-question feedback.
  ///
  /// In en, this message translates to:
  /// **'Feedback'**
  String get assessmentScannerFeedbackLabel;

  /// Sub-label before the reference answer.
  ///
  /// In en, this message translates to:
  /// **'Expected answer'**
  String get assessmentScannerExpectedLabel;

  /// Section header for teacher-facing next steps.
  ///
  /// In en, this message translates to:
  /// **'Recommended next steps'**
  String get assessmentScannerNextStepsSection;

  /// Section header for student-facing recommendations.
  ///
  /// In en, this message translates to:
  /// **'For the student'**
  String get assessmentScannerStudentSection;

  /// Section header for photo-quality advisories.
  ///
  /// In en, this message translates to:
  /// **'Photo quality'**
  String get assessmentScannerQualitySection;

  /// Shown on a question that carries no marks scale.
  ///
  /// In en, this message translates to:
  /// **'Not scored'**
  String get assessmentScannerNotScored;

  /// Empty-result message.
  ///
  /// In en, this message translates to:
  /// **'No grades came back. Please try clearer photos.'**
  String get assessmentScannerNoContent;

  /// Outcome chip: full marks.
  ///
  /// In en, this message translates to:
  /// **'Correct'**
  String get assessmentScannerOutcomeCorrect;

  /// Outcome chip: partial marks.
  ///
  /// In en, this message translates to:
  /// **'Partly correct'**
  String get assessmentScannerOutcomePartial;

  /// Outcome chip: no marks.
  ///
  /// In en, this message translates to:
  /// **'Incorrect'**
  String get assessmentScannerOutcomeIncorrect;

  /// Chip flagging a question that needs a teacher's review.
  ///
  /// In en, this message translates to:
  /// **'Check this'**
  String get assessmentScannerReviewChip;

  /// 401 sign-in prompt.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again to grade an answer sheet.'**
  String get assessmentScannerSignIn;

  /// 403 upgrade title.
  ///
  /// In en, this message translates to:
  /// **'A higher plan is needed'**
  String get assessmentScannerUpgradeTitle;

  /// 403 upgrade body.
  ///
  /// In en, this message translates to:
  /// **'Grading answer sheets is part of a higher plan. Upgrade to keep grading.'**
  String get assessmentScannerUpgradeBody;

  /// Pricing action label.
  ///
  /// In en, this message translates to:
  /// **'See plans'**
  String get assessmentScannerSeePricing;

  /// 429 daily-limit title.
  ///
  /// In en, this message translates to:
  /// **'That is all your answer sheets for today'**
  String get assessmentScannerDailyLimitTitle;

  /// 429 daily-limit body.
  ///
  /// In en, this message translates to:
  /// **'Your plan includes a set number of answer sheets each day. They reset tomorrow, or you can raise the limit on a higher plan.'**
  String get assessmentScannerDailyLimitBody;

  /// 429 monthly-limit title.
  ///
  /// In en, this message translates to:
  /// **'You have reached your grading limit'**
  String get assessmentScannerLimitTitle;

  /// 429 monthly-limit body.
  ///
  /// In en, this message translates to:
  /// **'You have used all the answer sheets in your plan. They reset next month, or you can raise the limit on a higher plan.'**
  String get assessmentScannerLimitBody;

  /// 503 busy message.
  ///
  /// In en, this message translates to:
  /// **'The grading model is busy right now. Please try again in a minute.'**
  String get assessmentScannerBusy;

  /// 503 busy message with a retry countdown.
  ///
  /// In en, this message translates to:
  /// **'{seconds, plural, =1{The grading model is busy right now. Please try again in about 1 second.} other{The grading model is busy right now. Please try again in about {seconds} seconds.}}'**
  String assessmentScannerBusyRetryAfter(int seconds);

  /// Timeout message.
  ///
  /// In en, this message translates to:
  /// **'Grading is taking longer than usual. Please try again.'**
  String get assessmentScannerTimeout;

  /// 400/422 re-upload message.
  ///
  /// In en, this message translates to:
  /// **'The photos could not be graded. Please re-upload clearer pages.'**
  String get assessmentScannerRephrase;

  /// Pro Inbox title + messages-entry tooltip.
  ///
  /// In en, this message translates to:
  /// **'Messages'**
  String get inboxTitle;

  /// Inbox signed-out / awaiting-Firebase EmptyView title.
  ///
  /// In en, this message translates to:
  /// **'Your messages'**
  String get inboxSignInTitle;

  /// Inbox signed-out / awaiting-Firebase EmptyView body (DM gate).
  ///
  /// In en, this message translates to:
  /// **'Sign in to see your messages'**
  String get inboxSignInBody;

  /// Inbox EmptyView title when there are no conversations.
  ///
  /// In en, this message translates to:
  /// **'No conversations yet'**
  String get inboxEmptyTitle;

  /// Inbox EmptyView body when there are no conversations.
  ///
  /// In en, this message translates to:
  /// **'When you connect with teachers, your conversations will appear here.'**
  String get inboxEmptyBody;

  /// Inbox/thread ErrorView body (missing index / load failure).
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t load your messages. Please try again.'**
  String get inboxErrorBody;

  /// Row preview placeholder for a conversation with no message yet.
  ///
  /// In en, this message translates to:
  /// **'No messages yet'**
  String get inboxNoMessagesYet;

  /// Thread app-bar fallback title (deep link / missing participant).
  ///
  /// In en, this message translates to:
  /// **'Conversation'**
  String get inboxThreadFallbackTitle;

  /// Thread EmptyView title when the conversation has no messages.
  ///
  /// In en, this message translates to:
  /// **'No messages yet'**
  String get inboxThreadEmptyTitle;

  /// Thread EmptyView body when the conversation has no messages.
  ///
  /// In en, this message translates to:
  /// **'Say hello to start the conversation.'**
  String get inboxThreadEmptyBody;

  /// Thread composer text-field hint.
  ///
  /// In en, this message translates to:
  /// **'Write a message'**
  String get inboxComposerHint;

  /// Thread composer send-button tooltip / accessibility label.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get inboxComposerSend;

  /// Inline composer hint shown when the message exceeds the 1000-byte server cap; send is blocked until it is shortened.
  ///
  /// In en, this message translates to:
  /// **'Message too long. Please shorten it.'**
  String get inboxComposerTooLong;

  /// Button to page in older messages above the live tail.
  ///
  /// In en, this message translates to:
  /// **'Load older messages'**
  String get inboxLoadOlder;

  /// Inline notice when an optimistic send rolled back.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t send your message.'**
  String get inboxSendFailed;

  /// Badge label for a shared-resource message.
  ///
  /// In en, this message translates to:
  /// **'Resource'**
  String get inboxResourceLabel;

  /// Badge label for a voice-note (audio) message.
  ///
  /// In en, this message translates to:
  /// **'Voice note'**
  String get inboxVoiceNoteLabel;

  /// Accessibility label for the unread-count badge.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 unread} other{{count} unread}}'**
  String inboxUnreadLabel(int count);

  /// Delivery tick accessibility label: send in flight.
  ///
  /// In en, this message translates to:
  /// **'Sending'**
  String get inboxTickSending;

  /// Delivery tick accessibility label: sent.
  ///
  /// In en, this message translates to:
  /// **'Sent'**
  String get inboxTickSent;

  /// Delivery tick accessibility label: delivered.
  ///
  /// In en, this message translates to:
  /// **'Delivered'**
  String get inboxTickDelivered;

  /// Delivery tick accessibility label: read.
  ///
  /// In en, this message translates to:
  /// **'Read'**
  String get inboxTickRead;

  /// Delivery tick accessibility label: not sent.
  ///
  /// In en, this message translates to:
  /// **'Not sent'**
  String get inboxTickFailed;

  /// Relative time: under a minute ago.
  ///
  /// In en, this message translates to:
  /// **'now'**
  String get inboxTimeNow;

  /// Compact relative time, minutes.
  ///
  /// In en, this message translates to:
  /// **'{count}m'**
  String inboxTimeMinutes(int count);

  /// Compact relative time, hours.
  ///
  /// In en, this message translates to:
  /// **'{count}h'**
  String inboxTimeHours(int count);

  /// Compact relative time, days.
  ///
  /// In en, this message translates to:
  /// **'{count}d'**
  String inboxTimeDays(int count);

  /// Compact relative time, weeks.
  ///
  /// In en, this message translates to:
  /// **'{count}w'**
  String inboxTimeWeeks(int count);

  /// Network hub screen title (hosts the staffroom feed + Pro Inbox).
  ///
  /// In en, this message translates to:
  /// **'Network'**
  String get networkTitle;

  /// Voice-home app-bar Network entry tooltip / accessibility label.
  ///
  /// In en, this message translates to:
  /// **'Network'**
  String get networkTooltip;

  /// Network hub segmented tab: the staffroom feed.
  ///
  /// In en, this message translates to:
  /// **'Staffroom'**
  String get networkTabStaffroom;

  /// Network hub segmented tab: the Pro Inbox conversation list.
  ///
  /// In en, this message translates to:
  /// **'Messages'**
  String get networkTabMessages;

  /// Staffroom screen title + hero eyebrow.
  ///
  /// In en, this message translates to:
  /// **'Staffroom'**
  String get staffroomTitle;

  /// Staffroom hero greeting (serif display).
  ///
  /// In en, this message translates to:
  /// **'The Staffroom'**
  String get staffroomHeroTitle;

  /// Staffroom hero deck line under the greeting.
  ///
  /// In en, this message translates to:
  /// **'Teachers across Bharat, in one room'**
  String get staffroomHeroDeck;

  /// Staffroom section header: the teacher's groups strip.
  ///
  /// In en, this message translates to:
  /// **'Your groups'**
  String get staffroomSectionGroups;

  /// Staffroom section header: the unified feed.
  ///
  /// In en, this message translates to:
  /// **'From your groups'**
  String get staffroomSectionFeed;

  /// Staffroom section header: suggested groups to join.
  ///
  /// In en, this message translates to:
  /// **'Discover groups'**
  String get staffroomSectionDiscover;

  /// Staffroom section header: recommended teachers.
  ///
  /// In en, this message translates to:
  /// **'People you may know'**
  String get staffroomSectionPeople;

  /// Staffroom signed-out / awaiting-Firebase EmptyView title.
  ///
  /// In en, this message translates to:
  /// **'Join the staffroom'**
  String get staffroomSignInTitle;

  /// Staffroom signed-out / awaiting-Firebase EmptyView body.
  ///
  /// In en, this message translates to:
  /// **'Sign in to join the staffroom'**
  String get staffroomSignInBody;

  /// Staffroom feed empty (ready, no items) EmptyView title.
  ///
  /// In en, this message translates to:
  /// **'Your feed is quiet'**
  String get staffroomFeedEmptyTitle;

  /// Staffroom feed empty EmptyView body.
  ///
  /// In en, this message translates to:
  /// **'Posts from your groups will appear here.'**
  String get staffroomFeedEmptyBody;

  /// Staffroom / group-detail ErrorView body.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t load the staffroom. Please try again.'**
  String get staffroomErrorBody;

  /// Staffroom 'Your groups' empty prompt title.
  ///
  /// In en, this message translates to:
  /// **'No groups yet'**
  String get staffroomGroupsEmptyTitle;

  /// Staffroom 'Your groups' empty prompt body.
  ///
  /// In en, this message translates to:
  /// **'Join a group to see its posts and chat.'**
  String get staffroomGroupsEmptyBody;

  /// Button to browse / discover groups to join.
  ///
  /// In en, this message translates to:
  /// **'Browse groups'**
  String get staffroomBrowseGroups;

  /// Group member count (plural).
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 member} other{{count} members}}'**
  String staffroomMemberCount(int count);

  /// Join-group button label.
  ///
  /// In en, this message translates to:
  /// **'Join'**
  String get staffroomJoin;

  /// Joined-group settled state label.
  ///
  /// In en, this message translates to:
  /// **'Joined'**
  String get staffroomJoined;

  /// Inline hint when an optimistic join rolled back.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t join. Tap to retry.'**
  String get staffroomJoinFailed;

  /// Group detail locked (non-member, Forbidden posts) EmptyView title.
  ///
  /// In en, this message translates to:
  /// **'Members only'**
  String get staffroomGroupLockedTitle;

  /// Group detail locked EmptyView body.
  ///
  /// In en, this message translates to:
  /// **'Join this group to see its posts.'**
  String get staffroomGroupLockedBody;

  /// Group detail posts empty title.
  ///
  /// In en, this message translates to:
  /// **'No posts yet'**
  String get staffroomGroupPostsEmptyTitle;

  /// Group detail posts empty body.
  ///
  /// In en, this message translates to:
  /// **'Be the first to share here.'**
  String get staffroomGroupPostsEmptyBody;

  /// Group detail not-found (null group) title.
  ///
  /// In en, this message translates to:
  /// **'Group not found'**
  String get staffroomGroupNotFoundTitle;

  /// Group detail not-found body.
  ///
  /// In en, this message translates to:
  /// **'This group may have been removed.'**
  String get staffroomGroupNotFoundBody;

  /// Post-type overline label: a share post.
  ///
  /// In en, this message translates to:
  /// **'Shared'**
  String get staffroomPostTypeShare;

  /// Post-type overline label: an ask-for-help post.
  ///
  /// In en, this message translates to:
  /// **'Needs help'**
  String get staffroomPostTypeAskHelp;

  /// Post-type overline label: a celebrate post.
  ///
  /// In en, this message translates to:
  /// **'Celebrating'**
  String get staffroomPostTypeCelebrate;

  /// Post-type overline label: a resource post.
  ///
  /// In en, this message translates to:
  /// **'Resource'**
  String get staffroomPostTypeResource;

  /// Like button label / accessibility label when not yet liked.
  ///
  /// In en, this message translates to:
  /// **'Like'**
  String get staffroomLike;

  /// Like button label / accessibility label when liked.
  ///
  /// In en, this message translates to:
  /// **'Liked'**
  String get staffroomLiked;

  /// Accessibility label for a post's like count (plural).
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{No likes} =1{1 like} other{{count} likes}}'**
  String staffroomLikeCountLabel(int count);

  /// Inline hint when an optimistic like rolled back.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t update. Tap to retry.'**
  String get staffroomLikeFailed;

  /// Feed resource_share overline label.
  ///
  /// In en, this message translates to:
  /// **'Shared a resource'**
  String get staffroomResourceShared;

  /// Feed chat_highlight new-message count (plural).
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 new message} other{{count} new messages}}'**
  String staffroomChatHighlight(int count);

  /// Connect-with-a-teacher button label (sends a connection request).
  ///
  /// In en, this message translates to:
  /// **'Connect'**
  String get staffroomConnect;

  /// Toast after a connection request is sent.
  ///
  /// In en, this message translates to:
  /// **'Request sent'**
  String get staffroomConnectSent;

  /// Toast when a connection request is already pending.
  ///
  /// In en, this message translates to:
  /// **'Request already pending'**
  String get staffroomConnectPending;

  /// Toast when already mutually connected.
  ///
  /// In en, this message translates to:
  /// **'Already connected'**
  String get staffroomConnectConnected;

  /// Staff Room chat screen app-bar title and the home entry-tile title (the live community chat room).
  ///
  /// In en, this message translates to:
  /// **'Staff room'**
  String get staffroomChatTitle;

  /// Subtitle on the Staff Room entry tile in the staffroom home / Network hub.
  ///
  /// In en, this message translates to:
  /// **'Chat with teachers across Bharat'**
  String get staffroomChatEntryBody;

  /// Staff Room chat signed-out / awaiting-Firebase EmptyView title.
  ///
  /// In en, this message translates to:
  /// **'Join the staff room'**
  String get staffroomChatSignInTitle;

  /// Staff Room chat signed-out / awaiting-Firebase EmptyView body (Firebase-gated on-device).
  ///
  /// In en, this message translates to:
  /// **'Sign in to join the staff room'**
  String get staffroomChatSignInBody;

  /// Staff Room chat ready-but-empty EmptyView title.
  ///
  /// In en, this message translates to:
  /// **'No messages yet'**
  String get staffroomChatEmptyTitle;

  /// Staff Room chat ready-but-empty EmptyView body.
  ///
  /// In en, this message translates to:
  /// **'Be the first to say hello.'**
  String get staffroomChatEmptyBody;

  /// Honest badge on an AI persona (persona-pulse) chat message — labels it AI, never posing as a real teacher.
  ///
  /// In en, this message translates to:
  /// **'AI teacher'**
  String get staffroomChatAiBadge;

  /// Group-detail entry that opens the group's live chat.
  ///
  /// In en, this message translates to:
  /// **'Group chat'**
  String get staffroomGroupChatEntry;

  /// Teacher Directory (U-SI4) screen title + the Staffroom-home 'Find teachers' entry-tile title.
  ///
  /// In en, this message translates to:
  /// **'Find teachers'**
  String get staffroomDirectoryTitle;

  /// Subtitle on the 'Find teachers' entry tile in the Staffroom home.
  ///
  /// In en, this message translates to:
  /// **'Search the teacher directory'**
  String get staffroomDirectoryEntryBody;

  /// Placeholder in the Teacher Directory search field (client-side name/subject filter).
  ///
  /// In en, this message translates to:
  /// **'Search by name or subject'**
  String get staffroomDirectorySearchHint;

  /// Teacher Directory load-error ErrorView body (with retry).
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t load the directory. Please try again.'**
  String get staffroomDirectoryErrorBody;

  /// Teacher Directory empty-state title (no teachers, or no search matches).
  ///
  /// In en, this message translates to:
  /// **'No teachers found'**
  String get staffroomDirectoryEmptyTitle;

  /// Teacher Directory ready-but-empty EmptyView body.
  ///
  /// In en, this message translates to:
  /// **'No teachers to show yet.'**
  String get staffroomDirectoryEmptyBody;

  /// Teacher Directory body shown when a search query matches no teachers.
  ///
  /// In en, this message translates to:
  /// **'No teachers match your search.'**
  String get staffroomDirectorySearchEmpty;

  /// Public profile app-bar fallback title before the name resolves.
  ///
  /// In en, this message translates to:
  /// **'Teacher'**
  String get staffroomProfileTitle;

  /// Public profile load-error ErrorView body (with retry).
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t load this profile. Please try again.'**
  String get staffroomProfileErrorBody;

  /// Public profile not-found EmptyView title (removed / not found).
  ///
  /// In en, this message translates to:
  /// **'Profile unavailable'**
  String get staffroomProfileNotFoundTitle;

  /// Public profile not-found EmptyView body.
  ///
  /// In en, this message translates to:
  /// **'This teacher\'s profile could not be found.'**
  String get staffroomProfileNotFoundBody;

  /// Public profile section header above the teacher's bio.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get staffroomProfileAboutLabel;

  /// Public profile shown when the teacher has written no bio.
  ///
  /// In en, this message translates to:
  /// **'No bio yet.'**
  String get staffroomProfileBioEmpty;

  /// Badge on a verified teacher's profile masthead.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get staffroomProfileVerified;

  /// Public profile years-of-experience stat.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 yr experience} other{{count} yrs experience}}'**
  String staffroomProfileExperience(int count);

  /// Public profile label above the subjects chips.
  ///
  /// In en, this message translates to:
  /// **'Subjects'**
  String get staffroomProfileSubjectsLabel;

  /// Public profile label above the grade-levels (classes) chips.
  ///
  /// In en, this message translates to:
  /// **'Classes'**
  String get staffroomProfileClassesLabel;

  /// Public profile label above the languages chips.
  ///
  /// In en, this message translates to:
  /// **'Languages'**
  String get staffroomProfileLanguagesLabel;

  /// Connection state: an outgoing request is pending (disabled 'Requested' marker).
  ///
  /// In en, this message translates to:
  /// **'Requested'**
  String get staffroomRequested;

  /// Accept an incoming connection request.
  ///
  /// In en, this message translates to:
  /// **'Accept'**
  String get staffroomConnectionAccept;

  /// Decline an incoming connection request.
  ///
  /// In en, this message translates to:
  /// **'Decline'**
  String get staffroomConnectionDecline;

  /// Connection state: mutually connected (marker label).
  ///
  /// In en, this message translates to:
  /// **'Connected'**
  String get staffroomConnected;

  /// Compact directory-row badge: this teacher sent the current user a connection request.
  ///
  /// In en, this message translates to:
  /// **'Wants to connect'**
  String get staffroomConnectionWants;

  /// Open the direct-message thread — enabled ONLY for a mutual connection (the DM gate).
  ///
  /// In en, this message translates to:
  /// **'Message'**
  String get staffroomMessage;

  /// Hint shown wherever the Message action is gated: a mutual connection is required to DM.
  ///
  /// In en, this message translates to:
  /// **'Connect to message'**
  String get staffroomConnectToMessage;

  /// Quiet inline hint after an optimistic connection action rolled back.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t update. Tap to retry.'**
  String get staffroomConnectionFailed;

  /// Remove a mutual connection (also the confirm-dialog confirm label).
  ///
  /// In en, this message translates to:
  /// **'Disconnect'**
  String get staffroomDisconnect;

  /// Disconnect confirmation dialog title.
  ///
  /// In en, this message translates to:
  /// **'Disconnect?'**
  String get staffroomDisconnectConfirmTitle;

  /// Disconnect confirmation dialog body (explains the DM gate closes).
  ///
  /// In en, this message translates to:
  /// **'You\'ll no longer be connected or able to message each other.'**
  String get staffroomDisconnectConfirmBody;

  /// Disconnect confirmation dialog cancel label.
  ///
  /// In en, this message translates to:
  /// **'Stay connected'**
  String get staffroomDisconnectCancel;

  /// Follow a teacher (directed follow graph — INDEPENDENT of the connection/DM gate).
  ///
  /// In en, this message translates to:
  /// **'Follow'**
  String get staffroomFollow;

  /// Following state (tap to unfollow); independent of the connection/DM gate.
  ///
  /// In en, this message translates to:
  /// **'Following'**
  String get staffroomFollowing;

  /// Quiet inline hint after an optimistic follow toggle rolled back.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t update. Tap to retry.'**
  String get staffroomFollowFailed;
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
