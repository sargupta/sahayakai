import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/video_storyteller_repository.dart';
import '../domain/video_storyteller.dart';

part 'video_storyteller_controller.g.dart';

/// Drives the Video Storyteller screen through
/// `AsyncValue<VideoRecommendations?>`:
///   - `AsyncData(null)`   -> empty / idle (initial),
///   - `AsyncLoading`      -> video-card-shaped skeleton,
///   - `AsyncError`        -> typed `ApiException` the view maps to the right
///                            UI (401 signed-out, 429 rate limit, 504/5xx busy),
///   - `AsyncData(recs)`   -> the curated video sections.
@riverpod
class VideoStorytellerController extends _$VideoStorytellerController {
  @override
  FutureOr<VideoRecommendations?> build() => null;

  Future<void> find(VideoStorytellerRequest request) async {
    state = const AsyncValue<VideoRecommendations?>.loading();
    state = await AsyncValue.guard<VideoRecommendations?>(
      () => ref.read(videoStorytellerRepositoryProvider).recommend(request),
    );
  }

  /// Return to the empty/idle state.
  void clear() =>
      state = const AsyncValue<VideoRecommendations?>.data(null);
}
