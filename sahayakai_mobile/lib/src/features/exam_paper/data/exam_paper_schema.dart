import 'package:isar/isar.dart';

part 'exam_paper_schema.g.dart';

@collection
class ExamPaperEntity {
  Id id = Isar.autoIncrement;

  @Index(type: IndexType.value)
  late String title;

  late String subject;
  late String gradeLevel;
  late String board;

  /// Full ExamPaperOutput serialized as JSON string.
  late String contentJson;

  @Index()
  late DateTime createdAt;

  late bool isSynced;
}
