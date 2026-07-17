import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sahayakai/core/auth/auth_providers.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/core/theme/theme_mode_provider.dart';
import 'package:sahayakai/features/profile/data/profile_doc_source.dart';

import '../profile/profile_fixtures.dart';

/// Shared fixtures for the settings suites. Not a `_test.dart` file, so the
/// runner ignores it.
export '../profile/profile_fixtures.dart' show FakeProfileDocSource, teacherDoc;

/// Binds a readable `users/<uid>` document.
///
/// Settings' teaching-profile form hydrates from the SAME read Profile uses
/// (`profileControllerProvider`), so without this the read 401s through the
/// default [SignedOutProfileDocSource] and the section correctly shows its
/// sign-in state instead of a form. `doc: {}` is a signed-in teacher who has
/// simply saved nothing yet — a readable, empty profile.
Override profileDocOverride({Map<String, dynamic>? doc}) =>
    profileDocSourceProvider.overrideWithValue(FakeProfileDocSource(doc: doc));

/// The DESIGN_RUBRIC §11 Indic probe strings (Bengali, Tamil, Malayalam).
const String kBn = 'শিক্ষকদের জন্য কৃত্রিম বুদ্ধিমত্তা সহায়ক প্রশ্ন';
const String kTa = 'ஆசிரியர்களுக்கான செயற்கை நுண்ணறிவு உதவியாளர்';
const String kMl = 'അധ്യാപകർക്കുള്ള നിർമ്മിത ബുദ്ധി സഹായി';

/// A deliberately unbreakable compound word: DESIGN_RUBRIC §8 says long words
/// must wrap, never scroll the body sideways.
const String kLongWord = 'Supercalifragilisticexpialidociousqualificationboard';

/// The 360dp phone gate from DESIGN_RUBRIC §12.9.
const Size kNarrowPhone = Size(360, 900);

/// A tall surface for FUNCTIONAL tests only.
///
/// Settings is a long lazy `ListView`: on a real 900dp phone the account
/// sections sit past the viewport + cacheExtent, so their widgets are never
/// mounted and finders cannot see them. Behaviour tests care about wiring, not
/// layout, so they mount the whole screen at once instead of scrolling to every
/// assertion. Layout IS asserted, at [kNarrowPhone], by the overflow gates.
const Size kTallSurface = Size(360, 2400);

/// Hosts [child] in the same shell the real screen runs in: themed, localized,
/// at a fixed textScale.
///
/// [locale] exists so the overflow gates can render the screen in Bengali /
/// Tamil / Malayalam — the point of the §11 probe is the *real* localized
/// screen at a real Indic locale, not an English screen with an Indic string
/// pasted in.
Widget hostSettings(
  Widget child, {
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  Locale locale = const Locale('en'),
  List<Override> overrides = const [],
}) {
  final base = brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light();
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      // Indic locales raise line-heights, which is exactly the axis that
      // overflows — so the host must apply it the way `SahayakApp` does.
      theme: locale.languageCode == 'en' ? base : AppTheme.withIndic(base),
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: child,
    ),
  );
}

/// A ProviderScope override pinning the theme mode, for suites that assert on
/// the live re-theme without racing the shared_preferences hydration.
Override themeModeOverride(ThemeMode mode) =>
    themeModeControllerProvider.overrideWith(() => _FixedThemeMode(mode));

class _FixedThemeMode extends ThemeModeController {
  _FixedThemeMode(this._initial);

  final ThemeMode _initial;

  @override
  ThemeMode build() => _initial;
}

/// Signs the stub auth controller in, so the account sections render.
/// `isSignedInProvider` derives from this, so overriding it covers both.
Override signedInOverride() =>
    authControllerProvider.overrideWith(_SignedInAuth.new);

class _SignedInAuth extends AuthController {
  @override
  AuthStatus build() => AuthStatus.signedIn;
}
