// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'audio_player_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$audioPlayerServiceHash() =>
    r'c46be5c617c8f634b21e054d07379ea575960bde';

/// The injectable player. Override this provider in tests with a fake so the
/// controller under test never touches the speaker. Kept alive so one reusable
/// player serves every VIDYA turn.
///
/// Copied from [audioPlayerService].
@ProviderFor(audioPlayerService)
final audioPlayerServiceProvider = Provider<AudioPlayerService>.internal(
  audioPlayerService,
  name: r'audioPlayerServiceProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$audioPlayerServiceHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef AudioPlayerServiceRef = ProviderRef<AudioPlayerService>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
