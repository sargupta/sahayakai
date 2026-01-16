import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart';
import '../../features/lesson_plan/data/lesson_plan_schema_io.dart';

/// Mobile/Desktop implementation with full Isar support
class DatabaseService {
  late Future<Isar> db;

  DatabaseService() {
    db = _initDb();
  }

  Future<Isar> _initDb() async {
    if (Isar.instanceNames.isEmpty) {
      final dir = await getApplicationDocumentsDirectory();
      return await Isar.open(
        [LessonPlanRecordSchema],
        directory: dir.path,
        inspector: true,
      );
    }
    return Future.value(Isar.getInstance());
  }
}
