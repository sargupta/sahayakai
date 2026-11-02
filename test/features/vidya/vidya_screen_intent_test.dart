import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/features/vidya/domain/vidya_screen_intent.dart';

void main() {
  AppLocalizations l10n(String code) => lookupAppLocalizations(Locale(code));
  final vocab = [l10n('en'), l10n('hi')];

  VidyaScreen? match(String s, [List<AppLocalizations>? v]) =>
      matchVidyaScreen(s, v ?? vocab);

  group('opens the screen the teacher names', () {
    test('English requests', () {
      expect(match('take me to my profile'), VidyaScreen.profile);
      expect(match('Take me to my profile.'), VidyaScreen.profile);
      expect(match('open my library'), VidyaScreen.library);
      expect(match('go to settings'), VidyaScreen.settings);
      expect(match('show me attendance'), VidyaScreen.attendance);
      expect(match("let's go home"), VidyaScreen.home);
      expect(match('open messages'), VidyaScreen.messages);
      expect(match('open the community'), VidyaScreen.community);
    });

    test('a bare screen name is enough', () {
      expect(match('profile'), VidyaScreen.profile);
      expect(match('my library'), VidyaScreen.library);
      expect(match('roll call'), VidyaScreen.attendance);
    });

    test('Hindi and Hinglish, with or without the nukta', () {
      expect(match('प्रोफ़ाइल खोलो'), VidyaScreen.profile);
      expect(match('प्रोफाइल पर ले चलो'), VidyaScreen.profile);
      expect(match('मेरी लाइब्रेरी दिखाओ'), VidyaScreen.library);
      expect(match('profile kholo'), VidyaScreen.profile);
    });

    test('another UI language counts by its own labels', () {
      final ta = l10n('ta');
      expect(match(ta.navProfile, [ta, l10n('en')]), VidyaScreen.profile);
    });
  });

  group('leaves everything else to the classifier', () {
    test('tool requests and questions', () {
      expect(match('make a lesson plan on the water cycle'), isNull);
      expect(match('ten question quiz on fractions'), isNull);
      expect(match('what is photosynthesis'), isNull);
      expect(match(''), isNull);
    });

    test('a long sentence that mentions a screen is a task', () {
      expect(
        match('open my library and make a quiz from the last lesson plan'),
        isNull,
      );
      expect(match('make a quiz from my library'), isNull);
    });

    test('a word that only contains a screen name', () {
      expect(match('homework'), isNull);
    });

    test('two different screens is ambiguous', () {
      expect(match('open profile settings'), isNull);
    });
  });

  test('tabs carry an index, every other screen a route', () {
    for (final screen in VidyaScreen.values) {
      expect(
        (screen.tab == null) != (screen.route == null),
        isTrue,
        reason: '$screen needs exactly one of tab or route',
      );
    }
    expect(VidyaScreen.profile.tab, 3);
    expect(VidyaScreen.attendance.route, Routes.attendance);
  });
}
