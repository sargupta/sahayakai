import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/dio_config.dart';

/// The base URL is overridable at build/run time with
/// `--dart-define=API_BASE_URL=…` so a build can point at UAT (or a local
/// server) without a code edit. These pin the normalisation that keeps a joined
/// request path from doubling its slashes, and the production fallback that
/// keeps every existing build and test unchanged.
void main() {
  group('normalizeApiBaseUrl', () {
    test('a blank or whitespace value falls back to production', () {
      expect(normalizeApiBaseUrl(''), kDefaultApiBaseUrl);
      expect(normalizeApiBaseUrl('   '), kDefaultApiBaseUrl);
    });

    test('a single trailing slash is trimmed (no doubled path slash)', () {
      expect(
        normalizeApiBaseUrl('https://uat.example.run.app/'),
        'https://uat.example.run.app',
      );
    });

    test('surrounding whitespace is trimmed', () {
      expect(
        normalizeApiBaseUrl('  https://uat.example.run.app  '),
        'https://uat.example.run.app',
      );
    });

    test('a clean URL is passed through unchanged', () {
      expect(
        normalizeApiBaseUrl('https://uat.example.run.app'),
        'https://uat.example.run.app',
      );
    });
  });

  test('with no define, kApiBaseUrl is the production default', () {
    // The test runner supplies no --dart-define, so the compile-time default
    // wins — proving existing builds and tests are unaffected.
    expect(kApiBaseUrl, kDefaultApiBaseUrl);
  });
}
