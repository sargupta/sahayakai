import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/platform/link_opener.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/virtual_field_trip/data/virtual_field_trip_dtos.dart';
import 'package:sahayakai/features/virtual_field_trip/domain/virtual_field_trip.dart';

/// Shared fixtures for the virtual-field-trip suites. Not a `_test.dart` file, so
/// the runner ignores it.

/// The DESIGN_RUBRIC §11 Indic probe strings (Bengali, Tamil, Malayalam). Every
/// prose slot in the fixtures carries one so a clipped matra or a missing wrap
/// shows up as a real overflow, not a silent regression.
const String kBn = 'শিক্ষকদের জন্য কৃত্রিম বুদ্ধিমত্তা সহায়ক ক্ষেত্র ভ্রমণ';
const String kTa = 'ஆசிரியர்களுக்கான செயற்கை நுண்ணறிவு உதவி கள சுற்றுலா';
const String kMl = 'അധ്യാപകർക്കുള്ള നിർമ്മിത ബുദ്ധി സഹായി';

/// A deliberately unbreakable compound word: DESIGN_RUBRIC §8 says long words
/// must wrap, never scroll the body sideways.
const String kLongWord = 'Supercalifragilisticexpialidociousphotosynthesisword';

/// The 360dp phone gate from DESIGN_RUBRIC §12.9.
const Size kNarrowPhone = Size(360, 900);

/// Records what the app tried to open instead of hitting a platform channel, so
/// the stop card's "Open in Google Earth" tap can be asserted without a real
/// launcher / a real URL.
class FakeLinkOpener implements LinkOpener {
  final List<Uri> opened = <Uri>[];

  @override
  Future<bool> open(Uri url) async {
    opened.add(url);
    return true;
  }
}

/// One `stops[]` wire object as it appears in the 200 payload. [googleEarthUrl]
/// null models the server omitting it (the DTO's launch action then hides); pass
/// an unsafe string (e.g. `javascript:...`) to exercise the URL-safety guard.
Map<String, dynamic> stopJson(
  String name, {
  String description = 'A vivid, age-appropriate description of the place.',
  String educationalFact = 'A surprising, high-value fact about this location.',
  String reflectionPrompt = 'What do you notice, and why might it be so?',
  String? googleEarthUrl,
  String culturalAnalogy = 'Like a landscape students in India already know.',
  String explanation = 'Why this stop belongs in the curriculum.',
}) {
  return <String, dynamic>{
    'name': name,
    'description': description,
    'educationalFact': educationalFact,
    'reflectionPrompt': reflectionPrompt,
    'googleEarthUrl': ?googleEarthUrl,
    'culturalAnalogy': culturalAnalogy,
    'explanation': explanation,
  };
}

/// The exact valid Google Earth URL the first stop carries — the one the tap test
/// asserts is opened through the faked launcher.
const String kAmazonEarthUrl =
    'https://earth.google.com/web/search/Amazon+River+Basin';
const String kSaharaEarthUrl =
    'https://earth.google.com/web/search/Sahara+Desert';

/// The `POST /api/ai/virtual-field-trip` 200 body, matching the route's exact
/// shape: `title`, `stops` (each with all seven fields), `gradeLevel`, `subject`.
/// Three renderable stops plus one junk entry the decode must drop; the second
/// stop carries an UNSAFE url (dropped to null, so its launch action hides) and
/// the first + third carry valid Google Earth URLs. Indic probes ride the title
/// and the first stop's prose.
Map<String, dynamic> virtualFieldTripJson() {
  return <String, dynamic>{
    'title': 'A Journey Down the World’s Great Rivers. $kBn',
    'gradeLevel': 'Class 7',
    'subject': 'Geography',
    'stops': <Map<String, dynamic>>[
      stopJson(
        'The Amazon River Basin. $kTa',
        description:
            'The largest rainforest on Earth stretches to the horizon.',
        educationalFact:
            'The Amazon releases one-fifth of the world’s '
            'river water into the ocean. $kBn',
        reflectionPrompt: 'How is this river’s scale like the Ganga? $kMl',
        culturalAnalogy: 'Like the Ganga basin, but many times larger. $kMl',
        explanation: 'It anchors the unit on river systems and biodiversity.',
        googleEarthUrl: kAmazonEarthUrl,
      ),
      // An UNSAFE url (javascript: scheme) — the DTO must drop it to null, so
      // this stop renders WITHOUT a launch action rather than passing junk to
      // the launcher.
      stopJson('The Andes Mountains', googleEarthUrl: 'javascript:alert(1)'),
      stopJson('The Sahara Desert', googleEarthUrl: kSaharaEarthUrl),
      // A stop that arrived with no name — it cannot title a numbered card, so
      // the DTO must drop it rather than render a headless block.
      stopJson('', description: 'Junk with no name'),
    ],
  };
}

/// The 202 `still_generating` body the dispatcher returns when its 45s budget
/// elapses. A SUCCESS-path shape (status < 400): the client does not throw, so
/// the repository decodes it to the distinct [FieldTripStillGenerating] outcome.
Map<String, dynamic> stillGeneratingJson() {
  return <String, dynamic>{
    'error': 'still_generating',
    'message':
        'Your field trip is still generating. Check My Library in a minute.',
    'budgetMs': 45000,
    'elapsedMs': 45231,
  };
}

/// A fully-decoded field trip, built through the real DTO so the fixture and the
/// production decode path can never drift.
FieldTrip buildFieldTrip() =>
    VirtualFieldTripResponseDto.fromJson(virtualFieldTripJson()).toDomain();

/// Hosts a result-layer widget in the same shell the real screen uses: a
/// scrolling, page-padded body, so height and wrapping behave as in production.
/// Wrapped in a ProviderScope because the result view reads `linkOpenerProvider`.
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
