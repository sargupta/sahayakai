import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/platform/link_opener.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/visual_aid/data/visual_aid_dtos.dart';
import 'package:sahayakai/features/visual_aid/domain/visual_aid.dart';

/// Shared fixtures for the visual-aid suites. Not a `_test.dart` file, so the
/// runner ignores it.

/// The DESIGN_RUBRIC §11 Indic probe strings (Bengali, Tamil, Malayalam).
/// Every prose slot in the fixtures carries one so a clipped matra or a missing
/// wrap shows up as a real overflow, not a silent regression.
const String kBn = 'শিক্ষকদের জন্য কৃত্রিম বুদ্ধিমত্তা সহায়ক চিত্র';
const String kTa = 'ஆசிரியர்களுக்கான செயற்கை நுண்ணறிவு உதவி படம்';
const String kMl = 'അധ്യാപകർക്കുള്ള നിർമ്മിത ബുദ്ധി സഹായി';

/// A deliberately unbreakable compound word: DESIGN_RUBRIC §8 says long words
/// must wrap, never scroll the body sideways.
const String kLongWord = 'Supercalifragilisticexpialidociousphotosynthesisword';

/// The 360dp phone gate from DESIGN_RUBRIC §12.9.
const Size kNarrowPhone = Size(360, 900);

/// A valid 1x1 red PNG, base64-encoded. Small enough to inline, real enough that
/// `Image.memory` and `base64Decode` both accept it — so a widget test can prove
/// the drawing actually decodes and paints, not just that a byte list was held.
const String k1x1PngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

/// The image as the endpoint returns it — a `data:image/...;base64,...` URI.
const String kVisualAidDataUri = 'data:image/png;base64,$k1x1PngBase64';

/// The `POST /api/ai/visual-aid` 200 body. [withImage] false models the empty
/// generation (a decoded-to-nothing image); [empty] returns a fully-empty
/// payload.
Map<String, dynamic> visualAidJson({
  bool withImage = true,
  String? subject = 'Science',
}) {
  return <String, dynamic>{
    'imageDataUri': withImage ? kVisualAidDataUri : '',
    'pedagogicalContext':
        'Draw this on the blackboard and label each part as you explain it. $kBn',
    'discussionSpark': 'Ask pupils which part makes the food. $kTa',
    'subject': subject,
  };
}

/// A fully-decoded visual aid, built through the real DTO so the fixture and the
/// production decode path can never drift.
VisualAid buildVisualAid({bool withImage = true, String? subject = 'Science'}) {
  return VisualAidResponseDto.fromJson(
    visualAidJson(withImage: withImage, subject: subject),
  ).toDomain();
}

/// Records what the app tried to open instead of hitting a platform channel, so
/// the error view's pricing pointer can be asserted without a real launcher.
class FakeLinkOpener implements LinkOpener {
  final List<Uri> opened = <Uri>[];

  @override
  Future<bool> open(Uri url) async {
    opened.add(url);
    return true;
  }
}

/// Hosts a result-layer widget in the same shell the real screen uses: a
/// scrolling, page-padded body, so height and wrapping behave as in production.
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
