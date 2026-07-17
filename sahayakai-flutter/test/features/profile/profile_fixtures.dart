import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sahayakai/core/auth/auth_providers.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_client.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/profile/data/profile_doc_source.dart';

/// Shared fixtures for the profile suites. Not a `_test.dart` file, so the
/// runner ignores it.

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
/// Profile is a long lazy `ListView`: on a real 900dp phone the contact and
/// sign-out rows sit past the viewport + cacheExtent, so their widgets are
/// never mounted and finders cannot see them. Behaviour tests care about
/// wiring, not layout, so they mount the whole screen at once. Layout IS
/// asserted, at [kNarrowPhone], by the overflow gates.
const Size kTallSurface = Size(360, 4000);

/// A realistic `users/<uid>` document, in the shape the Firestore read returns.
/// Deliberately includes the fields this app must tolerate but does not edit
/// (`qualifications`) and the server-owned ones it must never write back
/// (`planType`, `impactScore`).
Map<String, dynamic> teacherDoc({
  Map<String, dynamic> overrides = const <String, dynamic>{},
}) {
  return <String, dynamic>{
    'displayName': 'Lakshmi Iyer',
    'schoolName': 'Government Higher Primary School',
    'state': 'Karnataka',
    'district': 'Mysuru',
    'subjects': <String>['Mathematics', 'Science'],
    'gradeLevels': <String>['Class 6', 'Class 7'],
    'preferredLanguage': 'Kannada',
    'phoneNumber': '9845012345',
    'pincode': '570001',
    'preferredBoard': 'Karnataka State Board (KSEEB)',
    'educationBoard': 'Karnataka State Board (KSEEB)',
    'qualifications': <String>['B.Ed'],
    'administrativeRole': 'hod',
    // Server-owned; present on every real document, never written by this app.
    'planType': 'pro',
    'impactScore': 42,
    ...overrides,
  };
}

/// A [ProfileDocSource] test double: records what was written, replays what was
/// configured. The real one needs Firebase; this one needs nothing.
class FakeProfileDocSource implements ProfileDocSource {
  FakeProfileDocSource({
    this.doc,
    this.readError,
    this.writeError,
    this.readDelay,
  });

  /// null models a teacher with no `users/<uid>` document yet.
  Map<String, dynamic>? doc;
  Object? readError;
  Object? writeError;

  /// Holds the read open, so the loading state can be observed. Without it the
  /// future completes on the first microtask and the skeleton never renders —
  /// which says nothing about a real Firestore read over a rural connection.
  final Duration? readDelay;

  /// Every merge this source received, in order.
  final List<Map<String, dynamic>> merges = <Map<String, dynamic>>[];

  @override
  Future<Map<String, dynamic>?> read() async {
    if (readDelay != null) await Future<void>.delayed(readDelay!);
    if (readError != null) throw readError!;
    return doc;
  }

  @override
  Future<void> merge(Map<String, dynamic> patch) async {
    merges.add(patch);
    if (writeError != null) throw writeError!;
  }
}

/// An [ApiClient] test double for the PATCH lane.
///
/// This exists because the real client really does open a socket: without it,
/// any test that exercises a save fires a live PATCH at
/// `https://sahayakai.com/api/user/profile`. That makes the suite depend on
/// production and on the machine being online, and it points writes at real
/// infrastructure from a unit test. The base constructor builds a Dio it never
/// uses, so nothing here touches the network.
class FakeApiClient extends ApiClient {
  FakeApiClient({this.error});

  /// Thrown instead of returning, to model a 401 / 400 / offline.
  final Object? error;

  /// Every PATCH this client received, in order.
  final List<({String path, Object? data})> patches = <({String path, Object? data})>[];

  @override
  Future<T> patch<T>(
    String path, {
    Object? data,
    required T Function(Map<String, dynamic> json) decode,
  }) async {
    patches.add((path: path, data: data));
    if (error != null) throw error!;
    // The route replies `{ success: true }`; the repository decodes nothing.
    return decode(const <String, dynamic>{});
  }
}

/// Binds a fake document source in place of the signed-out stub.
Override docSourceOverride(ProfileDocSource source) =>
    profileDocSourceProvider.overrideWithValue(source);

/// Binds a fake API client, so no test ever opens a socket.
Override apiClientOverride(ApiClient client) =>
    apiClientProvider.overrideWithValue(client);

/// Binds a token so the plan badge can decode a claim. Pass null to model the
/// current signed-out stub.
Override tokenOverride(String? token) =>
    tokenProviderProvider.overrideWithValue(({bool forceRefresh = false}) async => token);

/// Signs the stub auth controller in.
Override signedInOverride() =>
    authControllerProvider.overrideWith(_SignedInAuth.new);

class _SignedInAuth extends AuthController {
  @override
  AuthStatus build() => AuthStatus.signedIn;
}

/// The 401 the signed-out document source and the API client both raise.
const ApiException kUnauthorized = ApiException(
  ApiErrorKind.unauthorized,
  'Please sign in again.',
  statusCode: 401,
);

/// Builds an unsigned JWT carrying [claims]. Real Firebase tokens are signed,
/// but nothing in this app verifies the signature (the server does), so an
/// unsigned token exercises exactly the same decode path.
String fakeJwt(Map<String, dynamic> claims) {
  String seg(Map<String, dynamic> m) {
    // Firebase strips base64 padding; the decoder must cope, so the fixture
    // strips it too rather than testing a shape the wire never produces.
    return base64Url.encode(utf8.encode(jsonEncode(m))).replaceAll('=', '');
  }

  return '${seg({'alg': 'none'})}.${seg(claims)}.signature';
}

/// Builds a JWT whose payload segment is [rawPayload] verbatim (base64url
/// encoded), so the decoder can be probed with payloads that are valid base64
/// but not a JSON object.
String fakeJwtRaw(String rawPayload) {
  String seg(String s) => base64Url.encode(utf8.encode(s)).replaceAll('=', '');
  return '${seg('{"alg":"none"}')}.${seg(rawPayload)}.signature';
}

/// Hosts [child] in the same shell the real screen runs in: themed, localized,
/// at a fixed textScale.
///
/// [locale] exists so the overflow gates can render the screen in Bengali /
/// Tamil / Malayalam — the point of the §11 probe is the *real* localized
/// screen at a real Indic locale, not an English screen with an Indic string
/// pasted in.
Widget hostProfile(
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
