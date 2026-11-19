import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/staffroom/domain/daily_briefing.dart';

void main() {
  group('parseDailyBriefing', () {
    test('reads the server shape into its headlines, emoji stripped', () {
      final b = parseDailyBriefing(
        '🗓 Daily Briefing — Thu, 19 Nov\n\n'
        '🤖 Teachers should shape AI policy\n   Summary.\n   ↪ Rediff\n\n'
        '📚 New Class 9 text\n   Summary.\n   ↪ NCERT',
      );
      expect(b, isNotNull);
      expect(b!.opener, '🗓 Daily Briefing — Thu, 19 Nov');
      expect(b.headlines, [
        'Teachers should shape AI policy',
        'New Class 9 text',
      ]);
    });

    test('older briefings opening with 🗞 still read', () {
      final b = parseDailyBriefing(
        '🗞️ Daily Briefing — Sat, 3 Oct\n\n🤖 Cambridge report\n   x',
      );
      expect(b?.headlines, ['Cambridge report']);
    });

    test('a headline in another script keeps every letter', () {
      final b = parseDailyBriefing(
        '🗓 दैनिक ब्रीफ़िंग\n\n📚 नई कक्षा 9 की किताब\n   सार',
      );
      expect(b?.headlines, ['नई कक्षा 9 की किताब']);
    });

    test('an ordinary post is not a briefing', () {
      expect(
        parseDailyBriefing('Taught fractions by cutting chapatis.'),
        isNull,
      );
      expect(parseDailyBriefing('🗓 Only an opener, no stories'), isNull);
      expect(parseDailyBriefing(''), isNull);
    });
  });
}
