import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:isar/isar.dart';

import '../../../core/database/database_service.dart';
import '../../../core/network/api_client.dart';
import '../domain/exam_paper_models.dart';
import 'exam_paper_schema.dart';

final examPaperRepositoryProvider = Provider(
  (ref) => ExamPaperRepository(
    ref.read(apiClientProvider),
    ref.read(databaseServiceProvider),
  ),
);

class ExamPaperRepository {
  final ApiClient _apiClient;
  final DatabaseService _db;

  ExamPaperRepository(this._apiClient, this._db);

  /// Generate an exam paper — online first, offline fallback.
  Future<ExamPaperOutput> generateExamPaper(ExamPaperInput input) async {
    try {
      final response = await _apiClient.client.post(
        '/ai/exam-paper',
        data: input.toJson(),
      );

      if (response.statusCode == 200) {
        final output = ExamPaperOutput.fromJson(
          response.data as Map<String, dynamic>,
        );
        _saveToLocal(output); // fire & forget
        return output;
      }

      // Let plan_gate_handler inspect 403/429.
      throw Exception('Server error: ${response.statusCode}');
    } on Exception catch (e) {
      final errMsg = e.toString();
      // Re-throw plan/limit errors so the UI can handle them.
      if (errMsg.contains('403') || errMsg.contains('429')) rethrow;

      // Network error — fall back to last local paper.
      final local = await _fetchLastLocalPaper();
      if (local != null) return local;
      rethrow;
    }
  }

  /// Save a generated paper to Firestore/Storage via the PUT endpoint.
  Future<String?> saveToLibrary(ExamPaperOutput output) async {
    try {
      final response = await _apiClient.client.put(
        '/ai/exam-paper',
        data: output.toJson(),
      );
      if (response.statusCode == 200) {
        return response.data['contentId']?.toString();
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<void> _saveToLocal(ExamPaperOutput output) async {
    try {
      final isar = await _db.db;
      final entity = ExamPaperEntity()
        ..title = output.title
        ..subject = output.subject
        ..gradeLevel = output.gradeLevel
        ..board = output.board
        ..contentJson = output.toJsonString()
        ..createdAt = DateTime.now()
        ..isSynced = false;

      await isar.writeTxn(() async {
        await isar.examPaperEntitys.put(entity);
      });
    } catch (e) {
      // Non-fatal — offline storage is best-effort.
    }
  }

  Future<ExamPaperOutput?> _fetchLastLocalPaper() async {
    try {
      final isar = await _db.db;
      final entity = await isar.examPaperEntitys
          .where()
          .anyCreatedAt()
          .sortByCreatedAtDesc()
          .findFirst();
      if (entity == null) return null;
      return ExamPaperOutput.fromJsonString(entity.contentJson);
    } catch (_) {
      return null;
    }
  }

  Future<List<ExamPaperOutput>> getAllLocalPapers() async {
    try {
      final isar = await _db.db;
      final entities = await isar.examPaperEntitys
          .where()
          .anyCreatedAt()
          .sortByCreatedAtDesc()
          .findAll();
      return entities
          .map((e) => ExamPaperOutput.fromJsonString(e.contentJson))
          .toList();
    } catch (_) {
      return [];
    }
  }
}
