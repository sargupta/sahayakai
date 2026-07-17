import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/platform/share_service.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/parent_message/domain/parent_message.dart';

/// Shared fixtures for the Parent Message suites. Not a `_test.dart` file, so
/// the runner ignores it.

/// The DESIGN_RUBRIC §11 Indic probe strings (Bengali, Tamil, Malayalam).
/// The drafted message renders in the PARENT'S language, whose script differs
/// from the English UI these tests run in, so every message fixture carries one
/// and a clipped matra shows up as a real overflow, not a silent regression.
const String kBn = 'শিক্ষকদের জন্য কৃত্রিম বুদ্ধিমত্তা সহায়ক প্রশ্ন';
const String kTa = 'ஆசிரியர்களுக்கான செயற்கை நுண்ணறிவு உதவியாளர்';
const String kMl = 'അധ്യാപകർക്കുള്ള നിർമ്മിത ബുദ്ധി സഹായി';

/// A deliberately unbreakable compound word: DESIGN_RUBRIC §8 says long words
/// must wrap, never scroll the body sideways.
const String kLongWord =
    'A supercalifragilisticexpialidociouspedagogicalstrategyword?';

/// The 360dp phone gate from DESIGN_RUBRIC §12.9.
const Size kNarrowPhone = Size(360, 900);

/// A fully-populated Tamil parent message carrying the Indic probes and an
/// unbreakable compound word, so the Indic-safe render + wrapping are proven.
/// [empty] returns a blank completion (the empty-state path).
ParentMessage buildMessage({bool empty = false}) {
  if (empty) return const ParentMessage(message: '   ');
  return ParentMessage(
    message: 'மதிப்பிற்குரிய பெற்றோருக்கு வணக்கம். $kTa $kBn $kMl $kLongWord '
        'உங்கள் மகனின் வருகை குறித்து பேச விரும்புகிறேன்.',
    languageCode: 'ta-IN',
    wordCount: 42,
  );
}

/// A [ShareService] that records what it was asked to share instead of popping
/// the real OS share sheet. THIS IS NOT CEREMONY: the real service really does
/// summon the platform sheet (a native channel call), which a widget test can
/// neither drive nor dismiss. Overriding [shareServiceProvider] with this keeps
/// the suite hermetic and lets it assert the exact text a "share to WhatsApp"
/// tap would have handed the sheet.
class FakeShareService extends ShareService {
  const FakeShareService(this.calls);

  /// Every `(text, subject)` this service was asked to share, in order.
  final List<({String text, String? subject})> calls;

  @override
  Future<void> shareText(String text, {String? subject}) async {
    calls.add((text: text, subject: subject));
  }
}

/// Hosts a result-layer widget in the same shell the real screen uses: a
/// scrolling, page-padded body inside a [Scaffold] (so the copy snackbar has a
/// [ScaffoldMessenger]) and a [ProviderScope] (so the share button can read a
/// faked [shareServiceProvider]). The page scroll is VERTICAL only.
Widget hostResult(
  Widget child, {
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: Scaffold(
        body: SingleChildScrollView(
          padding: AppSpacing.pagePadding,
          child: child,
        ),
      ),
    ),
  );
}
