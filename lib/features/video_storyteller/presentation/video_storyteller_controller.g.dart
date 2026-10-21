// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'video_storyteller_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$videoStorytellerControllerHash() =>
    r'240a6d988c8cdffd85acd6f3e76b40dc71fc3d3c';

/// Drives the Video Storyteller screen through
/// `AsyncValue<VideoRecommendations?>`:
///   - `AsyncData(null)`   -> empty / idle (initial),
///   - `AsyncLoading`      -> video-card-shaped skeleton,
///   - `AsyncError`        -> typed `ApiException` the view maps to the right
///                            UI (401 signed-out, 429 rate limit, 504/5xx busy),
///   - `AsyncData(recs)`   -> the curated video sections.
///
/// Copied from [VideoStorytellerController].
@ProviderFor(VideoStorytellerController)
final videoStorytellerControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      VideoStorytellerController,
      VideoRecommendations?
    >.internal(
      VideoStorytellerController.new,
      name: r'videoStorytellerControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$videoStorytellerControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$VideoStorytellerController =
    AutoDisposeAsyncNotifier<VideoRecommendations?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
