// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profile_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$profileControllerHash() => r'c53210d5719da0221a493f32d9804a0f10748bd4';

/// Reads the teacher's profile. `AsyncValue` gives the screen its four states
/// for free:
///   - `AsyncLoading` -> the skeleton,
///   - `AsyncError`   -> offline / sign-in / retry, branched on the typed
///                       `ApiException` kind,
///   - `AsyncData` with `profile.isEmpty` -> the "nothing saved yet" state,
///   - `AsyncData`    -> the form.
///
/// Copied from [ProfileController].
@ProviderFor(ProfileController)
final profileControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      ProfileController,
      TeacherProfile
    >.internal(
      ProfileController.new,
      name: r'profileControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$profileControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$ProfileController = AutoDisposeAsyncNotifier<TeacherProfile>;
String _$profileFormSaveControllerHash() =>
    r'31e42b13c5ce78260904f18cae44b55665ae1f0a';

/// Drives the "Save" action through `AsyncValue<void>`:
///   - `AsyncData(null)` -> idle (initial, and after a successful save),
///   - `AsyncLoading`    -> the button shows a spinner and is not re-tappable,
///   - `AsyncError`      -> the typed `ApiException` the view maps to copy.
///
/// Separate from [ProfileController] on purpose: a failed save must not blow
/// away the profile the teacher is looking at (and still editing). The read
/// state and the write state are different questions.
///
/// Distinct from Settings' own `ProfileSaveController`, which drives a
/// different button on a different screen over the slice-only lane. They share
/// the repository, not their in-flight state: a save on one screen must not
/// spin the other screen's button.
///
/// Copied from [ProfileFormSaveController].
@ProviderFor(ProfileFormSaveController)
final profileFormSaveControllerProvider =
    AutoDisposeAsyncNotifierProvider<ProfileFormSaveController, void>.internal(
      ProfileFormSaveController.new,
      name: r'profileFormSaveControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$profileFormSaveControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$ProfileFormSaveController = AutoDisposeAsyncNotifier<void>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
