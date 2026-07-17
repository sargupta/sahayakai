import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/teacher_advice.dart';
import 'teacher_training_dtos.dart';

part 'teacher_training_repository.g.dart';

/// Data-layer gateway for the Teaching Coach tool. Presentation talks to the
/// controller, the controller to this repository, and only this repository
/// touches [ApiClient]. Errors surface as the typed `ApiException` the client
/// already maps from Dio.
class TeacherTrainingRepository {
  const TeacherTrainingRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/teacher-training';

  Future<TeacherAdvice> advise(TeacherTrainingRequest request) {
    return _client.post<TeacherAdvice>(
      _path,
      data: TeacherTrainingRequestDto.fromDomain(request).toJson(),
      decode: (json) => TeacherTrainingResponseDto.fromJson(json).toDomain(),
    );
  }
}

@riverpod
TeacherTrainingRepository teacherTrainingRepository(Ref ref) {
  return TeacherTrainingRepository(ref.watch(apiClientProvider));
}
