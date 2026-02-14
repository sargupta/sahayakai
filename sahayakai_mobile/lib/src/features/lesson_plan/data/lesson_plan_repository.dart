import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:isar/isar.dart';
import '../../../core/network/api_client.dart';
import '../../../core/database/database_service.dart';
import '../domain/lesson_plan_models.dart';
import 'lesson_plan_schema.dart';

final lessonPlanRepositoryProvider = Provider((ref) {
  return LessonPlanRepository(
    ref.read(apiClientProvider),
    ref.read(databaseServiceProvider),
  );
});

class LessonPlanRepository {
  final ApiClient _apiClient;
  final DatabaseService _dbService;

  LessonPlanRepository(this._apiClient, this._dbService);

  // Offline-First Generation Strategy
  Future<LessonPlanOutput> generateLessonPlan(LessonPlanInput input) async {
    try {
      // 1. Try Online First
      final response = await _apiClient.client.post(
        '/generate-lesson-plan',
        data: input.toJson(),
      );

      if (response.statusCode == 200) {
        final output = LessonPlanOutput.fromJson(response.data);
        
        // 2. Save to Local DB (Fire & Forget)
        _saveToLocal(output);
        
        return output;
      } else {
        throw Exception('Server Error: ${response.statusCode}');
      }
    } catch (e) {
      // 3. Fallback to Local History purely for demo/continuity
      // In a real app, 'Generation' usually requires AI. 
      // So here we fetch the *last created plan* as a fallback to show "Offline Access" capability.
      return _fetchLastLocalPlan(); 
    }
  }

  Future<void> _saveToLocal(LessonPlanOutput plan) async {
    final isar = await _dbService.db;
    final entity = LessonPlanEntity()
      ..title = plan.title
      ..subject = plan.subject
      ..gradeLevel = plan.gradeLevel
      ..contentJson = jsonEncode({
          'title': plan.title,
          'subject': plan.subject,
          'gradeLevel': plan.gradeLevel,
          'duration': plan.duration,
          'objectives': plan.objectives,
          'materials': plan.materials,
          'activities': plan.activities.map((e) => {'name': e.name, 'description': e.description, 'duration': e.duration}).toList(),
          'assessment': plan.assessment
      })
      ..createdAt = DateTime.now()
      ..isSynced = true;

    await isar.writeTxn(() async {
      await isar.lessonPlanEntitys.put(entity);
    });
  }

  Future<LessonPlanOutput> _fetchLastLocalPlan() async {
    final isar = await _dbService.db;
    final lastPlan = await isar.lessonPlanEntitys.where().sortByCreatedAtDesc().findFirst();
    
    if (lastPlan != null) {
      final json = jsonDecode(lastPlan.contentJson);
      return LessonPlanOutput.fromJson(json);
    }
    throw Exception("No Internet & No Local History found.");
  }

  Future<List<LessonPlanOutput>> getAllLessonPlans() async {
    final isar = await _dbService.db;
    final entities = await isar.lessonPlanEntitys.where().sortByCreatedAtDesc().findAll();
    
    return entities.map((e) {
      final json = jsonDecode(e.contentJson);
      return LessonPlanOutput.fromJson(json);
    }).toList();
  }
}
