import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// P0.6 regression: the app must never call a model provider directly.
///
/// A provider key passed as a `--dart-define` is compiled into every AAB and
/// can be read back out of it, so model calls go through the backend, which
/// holds the key. This scans `lib/` for the two shapes the old OpenRouter path
/// took: a key read from the environment and a provider host.
void main() {
  test('lib/ reads no model API key and calls no model provider directly', () {
    final forbidden = <RegExp>[
      RegExp(
        r"fromEnvironment\(\s*'(OPENROUTER|OPENAI|ANTHROPIC|GEMINI)_API_KEY",
      ),
      RegExp(r'openrouter\.ai|api\.openai\.com|api\.anthropic\.com'),
    ];
    final hits = <String>[];
    final files = Directory('lib')
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'));
    for (final file in files) {
      final lines = file.readAsLinesSync();
      for (var i = 0; i < lines.length; i++) {
        if (forbidden.any((p) => p.hasMatch(lines[i]))) {
          hits.add('${file.path}:${i + 1}: ${lines[i].trim()}');
        }
      }
    }
    expect(hits, isEmpty, reason: 'Route model calls through the backend.');
  });
}
