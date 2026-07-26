// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profile_doc_source.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$profileDocSourceHash() => r'ac2377596b8dc86253f95b79262a0169e07fc579';

/// [FirestoreProfileDocSource] once a real teacher is signed in,
/// [SignedOutProfileDocSource] otherwise. Reactive on [authControllerProvider]
/// (`core/auth/auth_providers.dart`) — the single source of truth the router
/// and the token exchange already agree on — rather than reading
/// `FirebaseAuth.instance.currentUser` once at build time, so a real
/// sign-in/sign-out flips this binding the same beat the rest of the app
/// reacts to it.
///
/// Nothing below this line changes when this binding flips: the DTOs, the
/// repository, the controller and the screen all already speak
/// [ProfileDocSource].
///
/// Copied from [profileDocSource].
@ProviderFor(profileDocSource)
final profileDocSourceProvider = AutoDisposeProvider<ProfileDocSource>.internal(
  profileDocSource,
  name: r'profileDocSourceProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$profileDocSourceHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef ProfileDocSourceRef = AutoDisposeProviderRef<ProfileDocSource>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
