import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/exam_paper/data/exam_paper_schema.dart';
import '../../features/lesson_plan/data/lesson_plan_schema.dart';

final databaseServiceProvider = Provider((ref) => DatabaseService());

class DatabaseService {
  late Future<Isar> db;

  DatabaseService() {
    db = _initDb();
  }

  Future<Isar> _initDb() async {
    if (Isar.instanceNames.isEmpty) {
      final dir = await getApplicationDocumentsDirectory();
      return await Isar.open(
        [LessonPlanEntitySchema, ExamPaperEntitySchema],
        directory: dir.path,
        inspector: true,
      );
    }
    return Future.value(Isar.getInstance());
  }

  /// Clears all locally cached data (used on logout / account deletion).
  Future<void> clearLocalData() async {
    final isar = await db;
    await isar.writeTxn(() => isar.clear());
  }
}
