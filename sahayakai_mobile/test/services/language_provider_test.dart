import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/providers/language_provider.dart';

void main() {
  group('LanguageConfig', () {
    test('supportedLanguages has 11 entries', () {
      expect(supportedLanguages.length, 11);
    });

    test('languageDisplayNames is cached list', () {
      final a = languageDisplayNames;
      final b = languageDisplayNames;
      expect(identical(a, b), true); // Same object — no re-allocation
    });

    test('all display names are unique', () {
      final names = languageDisplayNames;
      expect(names.toSet().length, names.length);
    });

    test('all BCP-47 codes are unique', () {
      final codes = supportedLanguages.map((l) => l.bcp47Code).toSet();
      expect(codes.length, supportedLanguages.length);
    });

    test('all short codes are unique', () {
      final codes = supportedLanguages.map((l) => l.shortCode).toSet();
      expect(codes.length, supportedLanguages.length);
    });
  });

  group('getBcp47Code', () {
    test('returns correct code for Hindi', () {
      expect(getBcp47Code('Hindi'), 'hi-IN');
    });

    test('returns correct code for Odia', () {
      expect(getBcp47Code('Odia'), 'or-IN');
    });

    test('returns null for unknown language', () {
      expect(getBcp47Code('Klingon'), isNull);
    });

    test('returns null for empty string', () {
      expect(getBcp47Code(''), isNull);
    });

    test('is case-sensitive', () {
      expect(getBcp47Code('hindi'), isNull); // Must be 'Hindi'
    });
  });

  group('getDisplayName', () {
    test('returns Hindi for hi', () {
      expect(getDisplayName('hi'), 'Hindi');
    });

    test('returns Odia for or', () {
      expect(getDisplayName('or'), 'Odia');
    });

    test('returns null for unknown code', () {
      expect(getDisplayName('xx'), isNull);
    });
  });

  group('LanguageNotifier', () {
    test('defaults to English', () {
      final notifier = LanguageNotifier();
      expect(notifier.state, 'English');
    });

    test('setLanguage updates state', () {
      final notifier = LanguageNotifier();
      notifier.setLanguage('Hindi');
      expect(notifier.state, 'Hindi');
    });
  });
}
