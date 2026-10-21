import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Runs once before every test file in this package.
///
/// WHY THIS EXISTS
/// `flutter_test` ships a single font — Ahem, which draws every glyph as a
/// filled box — and registers nothing from `pubspec.yaml`. Without the loader
/// below, a golden baseline captures rectangles instead of text, and then
/// defends those rectangles forever. A test suite that certifies boxes as the
/// correct rendering is worse than no golden suite at all, and it is exactly
/// the failure this project already had in documentation form: four state
/// documents cited a golden gate as universal acceptance while zero golden
/// tests existed.
///
/// This is also why unit U0.5 (bundling the fonts) had to land before the
/// golden units. `flutter test` has no network, so while the app fetched its
/// faces from Google at runtime there was nothing on disk to register here.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  TestWidgetsFlutterBinding.ensureInitialized();
  await _loadBundledFonts();
  await _loadPackageAndToolchainFonts();
  return testMain();
}

/// Registers every TTF under assets/fonts/ with the family name the app uses.
///
/// The family name must match `pubspec.yaml`'s `flutter.fonts` exactly —
/// 'Noto Sans Devanagari', not 'NotoSansDevanagari' — because that is the
/// string `kIndicSansFallback` puts in `fontFamilyFallback`. A mismatch here
/// does not error; it silently falls through to the default font, and the
/// Indic goldens would then be baselined against the wrong face.
Future<void> _loadBundledFonts() async {
  final dir = Directory('assets/fonts');
  if (!dir.existsSync()) {
    throw StateError(
      'assets/fonts is missing. Goldens cannot be deterministic without the '
      'bundled faces — see unit U0.5.',
    );
  }

  for (final file in dir.listSync().whereType<File>()) {
    if (!file.path.endsWith('.ttf')) continue;
    final family = _familyFor(file.uri.pathSegments.last);
    if (family == null) continue;
    final loader = FontLoader(family)
      ..addFont(
        file.readAsBytes().then(
          (b) => ByteData.view(Uint8List.fromList(b).buffer),
        ),
      );
    await loader.load();
  }
}

/// Registers the two families that do NOT live under assets/fonts: Lucide
/// (shipped inside its package) and MaterialIcons (shipped inside the Flutter
/// SDK's toolchain artifacts). Without them every nav / app-bar icon renders
/// as an empty box in a golden — the same tofu failure this config exists to
/// prevent, one font class over.
Future<void> _loadPackageAndToolchainFonts() async {
  // Lucide: resolve the package root through the package config so a patched
  // / path dependency registers the same as a hosted one.
  final pkgConfig = File('.dart_tool/package_config.json');
  if (pkgConfig.existsSync()) {
    final decoded =
        jsonDecode(pkgConfig.readAsStringSync()) as Map<String, dynamic>;
    final packages =
        (decoded['packages'] as List).cast<Map<String, dynamic>>();
    for (final pkg in packages) {
      if (pkg['name'] != 'lucide_icons') continue;
      final root = pkgConfig.uri.resolve(pkg['rootUri'] as String).toFilePath();
      final ttf = File(
        '$root${Platform.pathSeparator}assets${Platform.pathSeparator}lucide.ttf',
      );
      if (!ttf.existsSync()) {
        throw StateError(
          'lucide_icons resolved to $root but assets/lucide.ttf is missing.',
        );
      }
      // Icon passes `package:` through to TextStyle, which resolves the key
      // as 'packages/<pkg>/<family>' — register under that exact name.
      final lucideLoader = FontLoader('packages/lucide_icons/Lucide')
        ..addFont(_byteDataOf(ttf));
      await lucideLoader.load();
    }
  }

  // MaterialIcons: flutter_tester runs from
  // <sdk>/bin/cache/artifacts/engine/<platform>/, so the SDK's material_fonts
  // artifact is two parents above the engine directory.
  final engineDir = File(Platform.resolvedExecutable).parent;
  final icons = File(
    '${engineDir.parent.parent.path}${Platform.pathSeparator}'
    'material_fonts${Platform.pathSeparator}MaterialIcons-Regular.otf',
  );
  if (!icons.existsSync()) {
    throw StateError('MaterialIcons-Regular.otf not found at ${icons.path}.');
  }
  final materialLoader = FontLoader('MaterialIcons')
    ..addFont(_byteDataOf(icons));
  await materialLoader.load();
}

Future<ByteData> _byteDataOf(File file) async =>
    ByteData.view(Uint8List.fromList(await file.readAsBytes()).buffer);

/// Maps a bundled filename to the family name declared in pubspec.yaml.
///
/// Deliberately explicit rather than derived from the filename: the two differ
/// (NotoSansDevanagari-Variable.ttf -> 'Noto Sans Devanagari'), and a clever
/// regex that got a space wrong would produce a silently-unused registration.
String? _familyFor(String filename) {
  const map = <String, String>{
    'BricolageGrotesque-Variable.ttf': 'Bricolage Grotesque',
    'InstrumentSans-Variable.ttf': 'Instrument Sans',
    'Outfit-Variable.ttf': 'Outfit',
    'Inter-Variable.ttf': 'Inter',
    'NotoSansDevanagari-Variable.ttf': 'Noto Sans Devanagari',
    'NotoSansBengali-Variable.ttf': 'Noto Sans Bengali',
    'NotoSansTamil-Variable.ttf': 'Noto Sans Tamil',
    'NotoSansTelugu-Variable.ttf': 'Noto Sans Telugu',
    'NotoSansKannada-Variable.ttf': 'Noto Sans Kannada',
    'NotoSansMalayalam-Variable.ttf': 'Noto Sans Malayalam',
    'NotoSansGujarati-Variable.ttf': 'Noto Sans Gujarati',
    'NotoSansGurmukhi-Variable.ttf': 'Noto Sans Gurmukhi',
    'NotoSansOriya-Variable.ttf': 'Noto Sans Oriya',
  };
  return map[filename];
}
