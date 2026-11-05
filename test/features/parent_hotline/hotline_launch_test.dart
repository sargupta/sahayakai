import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/parent_hotline/domain/hotline_launch.dart';
import 'package:sahayakai/features/parent_hotline/domain/parent_outreach.dart';

/// How the `/parent-hotline` route reads its `extra`.
void main() {
  test('a HotlineLaunch passes through untouched', () {
    const launch = HotlineLaunch(
      classId: 'c1',
      className: 'Class 6A',
      absentStudentIds: {'s1', 's3'},
    );
    expect(identical(HotlineLaunch.fromExtra(launch), launch), isTrue);
  });

  test('a map with the same keys is read field for field', () {
    final launch = HotlineLaunch.fromExtra(<String, Object?>{
      'studentId': 's1',
      'studentName': 'Asha Rao',
      'classId': 'c1',
      'className': 'Class 6A',
      'parentLanguage': 'Kannada',
      'subject': 'Science',
      'suggestedReason': 'poor_performance',
      'taskId': 't9',
      'absentStudentIds': ['s1', 's2', 7],
      'outreachId': 'o-42',
    });
    expect(launch.studentId, 's1');
    expect(launch.studentName, 'Asha Rao');
    expect(launch.classId, 'c1');
    expect(launch.className, 'Class 6A');
    expect(launch.parentLanguage, 'Kannada');
    expect(launch.subject, 'Science');
    expect(launch.suggestedReason, OutreachReason.poorPerformance);
    expect(launch.taskId, 't9');
    // A non-string id is dropped, not stringified.
    expect(launch.absentStudentIds, {'s1', 's2'});
    expect(launch.outreachId, 'o-42');
  });

  test('an unknown reason token is NO suggestion, never "absences"', () {
    final launch = HotlineLaunch.fromExtra(<String, Object?>{
      'suggestedReason': 'made_up',
    });
    expect(launch.suggestedReason, isNull);
  });

  test('blank strings read as absent', () {
    final launch = HotlineLaunch.fromExtra(<String, Object?>{
      'classId': '  ',
      'studentName': '',
    });
    expect(launch.classId, isNull);
    expect(launch.studentName, isNull);
  });

  test('nothing, or anything else, is a plain open of the picker', () {
    for (final extra in <Object?>[null, 'c1', 42]) {
      final launch = HotlineLaunch.fromExtra(extra);
      expect(launch.classId, isNull);
      expect(launch.studentId, isNull);
      expect(launch.absentStudentIds, isEmpty);
    }
  });
}
