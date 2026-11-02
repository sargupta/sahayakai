import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/router/routes.dart';

/// A place in the app VIDYA can take the teacher to by name ("take me to my
/// profile", "प्रोफ़ाइल खोलो"). The four shell tabs carry their [tab] index;
/// every other screen is a pushed [route].
///
/// The AI tools are NOT here: a tool request ("make a quiz on fractions") goes
/// to the server classifier, which also extracts its topic and grade.
enum VidyaScreen {
  home(tab: 0),
  library(tab: 1),
  community(tab: 2),
  profile(tab: 3),
  attendance(route: Routes.attendance),
  messages(route: Routes.inbox),
  staffroom(route: Routes.staffroom),
  settings(route: Routes.settings);

  const VidyaScreen({this.tab, this.route});

  /// The shell tab index, for the four tabs.
  final int? tab;

  /// The route to push, for every screen that is not a tab.
  final String? route;

  /// The screen's name as the app shows it, for "Opening …".
  String label(AppLocalizations l10n) => switch (this) {
    VidyaScreen.home => l10n.navHome,
    VidyaScreen.library => l10n.navLibrary,
    VidyaScreen.community => l10n.communityTitle,
    VidyaScreen.profile => l10n.navProfile,
    VidyaScreen.attendance => l10n.attendanceTitle,
    VidyaScreen.messages => l10n.inboxTitle,
    VidyaScreen.staffroom => l10n.staffroomTitle,
    VidyaScreen.settings => l10n.settingsTitle,
  };

  /// Every name the teacher may use for the screen in one language: the app's
  /// own labels, so each of the 11 languages is covered by its ARB.
  List<String> _names(AppLocalizations l10n) => switch (this) {
    VidyaScreen.home => [l10n.navHome],
    VidyaScreen.library => [l10n.navLibrary, l10n.libraryTitle],
    VidyaScreen.community => [l10n.communityTitle, l10n.networkTitle],
    VidyaScreen.profile => [l10n.navProfile],
    VidyaScreen.attendance => [l10n.attendanceTitle, l10n.homeTileRollCall],
    VidyaScreen.messages => [l10n.inboxTitle],
    VidyaScreen.staffroom => [l10n.staffroomTitle],
    VidyaScreen.settings => [l10n.settingsTitle],
  };
}

/// English names the labels do not cover (teachers code-mix English screen
/// names into every language).
const Map<VidyaScreen, List<String>> _englishExtras = {
  VidyaScreen.home: ['home screen', 'main screen'],
  VidyaScreen.library: ['my work', 'saved work', 'my files'],
  VidyaScreen.community: ['community'],
  VidyaScreen.profile: ['my profile', 'my account', 'account'],
  VidyaScreen.attendance: ['roll call', 'register'],
  VidyaScreen.messages: ['inbox', 'my messages'],
  VidyaScreen.staffroom: ['staff room'],
  VidyaScreen.settings: ['setting'],
};

/// Phrases that make an utterance a request to move ("take me to", "खोलो").
/// English and Hindi/Hinglish, the two the classifier sees most; any other
/// language still navigates when the utterance is just the screen's name.
const List<String> _navCues = [
  'open',
  'go to',
  'go back to',
  'goto',
  'take me',
  'show me',
  'show my',
  'navigate',
  'switch to',
  'bring up',
  'jump to',
  "let's go",
  'let us go',
  'खोलो',
  'खोलिए',
  'खोलें',
  'खोल दो',
  'ले चलो',
  'ले चलिए',
  'ले जाओ',
  'दिखाओ',
  'दिखाइए',
  'दिखा दो',
  'पर जाओ',
  'में जाओ',
  'चलो',
  'kholo',
  'khol do',
  'le chalo',
  'le jao',
  'dikhao',
  'dikha do',
  'jao',
];

/// An utterance this short that names a screen is a request to go there even
/// without a cue ("my profile", "प्रोफ़ाइल").
const int _bareNameMaxWords = 3;

/// A longer utterance is a task, not a move ("open my library and make a quiz
/// from the last lesson" is for the classifier).
const int _cuedMaxWords = 8;

/// The screen [utterance] asks to open, or null when it is not a navigation
/// request (or names more than one screen). [vocabularies] are the languages
/// whose screen names count; pass the UI language plus English and Hindi.
VidyaScreen? matchVidyaScreen(
  String utterance,
  Iterable<AppLocalizations> vocabularies,
) {
  final text = _normalise(utterance);
  if (text.trim().isEmpty) return null;
  final words = text.trim().split(' ').length;

  // _normalise pads with spaces, so a cue matches whole words only.
  final hasCue = _navCues.any((cue) => text.contains(_normalise(cue)));
  if (hasCue ? words > _cuedMaxWords : words > _bareNameMaxWords) return null;

  final found = <VidyaScreen>{};
  for (final screen in VidyaScreen.values) {
    final names = [
      for (final l10n in vocabularies) ...screen._names(l10n),
      ...?_englishExtras[screen],
    ];
    if (names.any((n) {
      final name = _normalise(n).trim();
      return name.isNotEmpty && text.contains(' $name ');
    })) {
      found.add(screen);
    }
  }
  // "My Library" also contains "Library"; that is still one screen. Two
  // different screens is ambiguous, so the classifier decides.
  return found.length == 1 ? found.single : null;
}

/// The Devanagari nukta (U+093C).
final String _nukta = String.fromCharCode(0x093C);

/// Lower-cased, punctuation-free, single-spaced and space-padded, with the
/// Devanagari nukta dropped (speech-to-text writes प्रोफाइल and प्रोफ़ाइल alike).
String _normalise(String s) {
  final cleaned = s
      .toLowerCase()
      .replaceAll(_nukta, '')
      .replaceAll(RegExp(r'[^\p{L}\p{M}\p{N}\s]', unicode: true), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
  return ' $cleaned ';
}
