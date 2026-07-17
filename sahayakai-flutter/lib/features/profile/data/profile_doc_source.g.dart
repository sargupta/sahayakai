// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profile_doc_source.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$profileDocSourceHash() => r'9e09778115b3cdb04d57191758d6c64e9a303a67';

/// TODO(P0.2): once `firebase_auth` + `cloud_firestore` are added, replace the
/// binding below with:
///
/// ```dart
/// final uid = ref.watch(firebaseAuthProvider).currentUser?.uid;
/// if (uid == null) return const SignedOutProfileDocSource();
/// return FirestoreProfileDocSource(FirebaseFirestore.instance, uid);
/// ```
///
/// Nothing above this line changes: the DTOs, the repository, the controller
/// and the screen all already speak [ProfileDocSource].
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
