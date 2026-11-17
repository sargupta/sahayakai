import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/shared/data/recent_tools_provider.dart';
import 'package:sahayakai/shared/domain/library_dedupe.dart';
import 'package:sahayakai/shared/domain/library_item.dart';
import 'package:shared_preferences/shared_preferences.dart';

LibraryItem _item(
  String id, {
  String title = 'The water cycle',
  ContentType type = ContentType.lessonPlan,
  String? grade = 'Class 7',
  DateTime? at,
}) => LibraryItem(
  id: id,
  type: type,
  title: title,
  gradeLevel: grade,
  createdAt: at,
);

void main() {
  group('withoutSavedTwice', () {
    final t = DateTime.utc(2026, 11, 17, 10);

    test('the second save of the same plan minutes apart is hidden', () {
      final kept = withoutSavedTwice([
        _item('a', at: t),
        _item('b', at: t.subtract(const Duration(minutes: 2))),
      ]);
      expect(kept.map((i) => i.id), ['a']);
    });

    test('the same title on another day, class or type stays', () {
      final kept = withoutSavedTwice([
        _item('a', at: t),
        _item('b', at: t.subtract(const Duration(days: 1))),
        _item('c', at: t, grade: 'Class 8'),
        _item('d', at: t, type: ContentType.quiz),
      ]);
      expect(kept.map((i) => i.id), ['a', 'b', 'c', 'd']);
    });

    test('items without a date are never merged', () {
      final kept = withoutSavedTwice([_item('a'), _item('b')]);
      expect(kept.map((i) => i.id), ['a', 'b']);
    });
  });

  group('RecentTools', () {
    setUp(() => SharedPreferences.setMockInitialValues({}));

    test('keeps the last three, newest first, without repeats', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final recent = container.read(recentToolsProvider.notifier);

      await recent.record('quiz');
      await recent.record('lesson-plan');
      await recent.record('quiz');
      await recent.record('worksheet');
      await recent.record('rubric');

      expect(container.read(recentToolsProvider), [
        'rubric',
        'worksheet',
        'quiz',
      ]);
    });

    test('survives a relaunch through shared_preferences', () async {
      SharedPreferences.setMockInitialValues({
        'recent_tool_ids': ['attendance', 'quiz'],
      });
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(recentToolsProvider);
      await Future<void>.delayed(Duration.zero);

      expect(container.read(recentToolsProvider), ['attendance', 'quiz']);
    });
  });
}
