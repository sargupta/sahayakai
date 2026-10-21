import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/platform/link_opener.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/instant_answer/domain/instant_answer.dart';

/// Shared fixtures for the instant-answer suites. Not a `_test.dart` file, so
/// the runner ignores it.

/// The DESIGN_RUBRIC §11 Indic probe strings (Bengali, Tamil, Malayalam).
/// Every prose slot in the fixtures carries one so a clipped matra or a
/// missing wrap shows up as a real overflow, not a silent regression.
const String kBn = 'শিক্ষকদের জন্য কৃত্রিম বুদ্ধিমত্তা সহায়ক প্রশ্ন';
const String kTa = 'ஆசிரியர்களுக்கான செயற்கை நுண்ணறிவு உதவியாளர்';
const String kMl = 'അധ്യാപകർക്കുള്ള നിർമ്മിത ബുദ്ധി സഹായി';

/// A deliberately unbreakable compound word: DESIGN_RUBRIC §8 says long words
/// must wrap, never scroll the body sideways.
const String kLongWord = 'Supercalifragilisticexpialidociousphotosynthesisword';

/// The 360dp phone gate from DESIGN_RUBRIC §12.9.
const Size kNarrowPhone = Size(360, 900);

/// Records what the app tried to open instead of hitting a platform channel.
/// Every external navigation funnels through `LinkOpener`, so overriding this
/// one provider covers both the video card and the pricing pointer.
class FakeLinkOpener implements LinkOpener {
  final List<Uri> opened = <Uri>[];

  @override
  Future<bool> open(Uri url) async {
    opened.add(url);
    return true;
  }
}

/// Hosts a result-layer widget in the same shell the real screen uses: a
/// scrolling, page-padded body, so height and wrapping behave as in
/// production. Wrapped in a ProviderScope because the result and error views
/// read `linkOpenerProvider`.
Widget hostResult(
  Widget child, {
  Brightness brightness = Brightness.light,
  LinkOpener? linkOpener,
  bool reduceMotion = false,
}) {
  return ProviderScope(
    overrides: [
      if (linkOpener != null) linkOpenerProvider.overrideWithValue(linkOpener),
    ],
    child: MaterialApp(
      theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: SingleChildScrollView(
          padding: AppSpacing.pagePadding,
          child: reduceMotion
              ? Builder(
                  builder: (context) => MediaQuery(
                    data: MediaQuery.of(
                      context,
                    ).copyWith(disableAnimations: true),
                    child: child,
                  ),
                )
              : child,
        ),
      ),
    ),
  );
}

/// A markdown answer exercising every block the renderer supports, with Indic
/// prose and an unbreakable compound word in the wrapping slots.
const String kRichAnswerMarkdown =
    '''
# Photosynthesis

Plants make their own food using **sunlight**, water and air. $kBn

## How it works

1. Roots draw up water. $kTa
2. Leaves take in carbon dioxide.
3. Sunlight powers the reaction.

- Chlorophyll makes leaves green
- $kLongWord
- Oxygen is released. $kMl

Use the `chloroplast` as the key word.

---

Ask pupils to point at a leaf outside.
''';

/// A fully-populated answer.
///
/// [withVideo] attaches the model's optional YouTube suggestion; [empty]
/// returns the answer the model gave nothing usable for.
InstantAnswer buildAnswer({bool withVideo = true, bool empty = false}) {
  if (empty) return const InstantAnswer(answer: '');
  return InstantAnswer(
    answer: kRichAnswerMarkdown,
    videoSuggestionUrl: withVideo
        ? Uri.parse('https://www.youtube.com/watch?v=abc123')
        : null,
    gradeLevel: 'Class 5',
    subject: 'Science',
  );
}
