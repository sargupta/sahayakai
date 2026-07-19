import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/video_storyteller.dart';
import 'video_storyteller_dtos.dart';

part 'video_storyteller_repository.g.dart';

/// Data-layer gateway for the Video Storyteller tool. Presentation talks to the
/// controller, the controller to this repository, and only this repository
/// touches [ApiClient]. Errors surface as the typed `ApiException` the client
/// maps from Dio — 401 (signed out), 429 (search rate limit), 400/422
/// (unusable request), 504 (timeout) and 5xx all arrive typed, and the error
/// view maps each to the right recovery UI.
class VideoStorytellerRepository {
  const VideoStorytellerRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/video-storyteller';

  Future<VideoRecommendations> recommend(VideoStorytellerRequest request) {
    return _client.post<VideoRecommendations>(
      _path,
      data: VideoStorytellerRequestDto.fromDomain(request).toJson(),
      decode: (json) => VideoStorytellerResponseDto.fromJson(json).toDomain(),
    );
  }
}

@riverpod
VideoStorytellerRepository videoStorytellerRepository(Ref ref) {
  return VideoStorytellerRepository(ref.watch(apiClientProvider));
}
