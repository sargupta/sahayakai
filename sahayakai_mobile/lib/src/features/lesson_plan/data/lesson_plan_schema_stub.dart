// Stub schema for web - no actual types needed since database is disabled
class LessonPlanRecord {
  int id = 0;
  String title = '';
  String subject = '';
  String gradeLevel = '';
  String contentJson = '';
  DateTime createdAt = DateTime.now();
  bool isSynced = false;
}
