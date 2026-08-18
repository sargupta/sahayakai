// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'audio_recorder_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$audioRecorderServiceHash() =>
    r'151916662e76175f0651b99b9544b5c584891c38';

/// The injectable recorder. Override this provider in tests with a fake so the
/// controller under test never touches the microphone. Kept alive so the single
/// recorder follows VIDYA across navigation.
///
/// Copied from [audioRecorderService].
@ProviderFor(audioRecorderService)
final audioRecorderServiceProvider = Provider<AudioRecorderService>.internal(
  audioRecorderService,
  name: r'audioRecorderServiceProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$audioRecorderServiceHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef AudioRecorderServiceRef = ProviderRef<AudioRecorderService>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
