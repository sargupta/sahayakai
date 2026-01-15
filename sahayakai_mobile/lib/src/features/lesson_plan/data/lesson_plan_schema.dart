import 'package:isar/isar.dart';

part 'lesson_plan_schema.g.dart';

@collection
class LessonPlanEntity {
  Id id = Isar.autoIncrement;

  @Index(type: IndexType.value)
  late String title;

  late String subject;
  late String gradeLevel;
  late String contentJson; // Store the full output as JSON string
  
  @Index()
  late DateTime createdAt;

  late bool isSynced;
}
