import 'package:isar/isar.dart';

/// Stub implementation for Web platform (Isar doesn't support Web properly)
class DatabaseService {
  Future<Isar> get db => throw UnimplementedError(
      'Isar Database is not supported on Web. Offline features are disabled.');
}
