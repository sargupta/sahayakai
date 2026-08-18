// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'gemini_live_client.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$geminiLiveClientHash() => r'71fd22ce292084f3810a21b6e9a869d2e57c1cfa';

/// The injectable Live client. Kept alive so the single socket-owning instance
/// follows VIDYA across the session (the keepAlive `VidyaController` reads it),
/// and overridable in tests with a fake so nothing opens a real socket.
///
/// Copied from [geminiLiveClient].
@ProviderFor(geminiLiveClient)
final geminiLiveClientProvider = Provider<GeminiLiveClient>.internal(
  geminiLiveClient,
  name: r'geminiLiveClientProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$geminiLiveClientHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef GeminiLiveClientRef = ProviderRef<GeminiLiveClient>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
