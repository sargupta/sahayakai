import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/profile_repository.dart';
import '../domain/teacher_profile.dart';

part 'profile_controller.g.dart';

/// Reads the teacher's profile. `AsyncValue` gives the screen its four states
/// for free:
///   - `AsyncLoading` -> the skeleton,
///   - `AsyncError`   -> offline / sign-in / retry, branched on the typed
///                       `ApiException` kind,
///   - `AsyncData` with `profile.isEmpty` -> the "nothing saved yet" state,
///   - `AsyncData`    -> the form.
@riverpod
class ProfileController extends _$ProfileController {
  @override
  Future<TeacherProfile> build() {
    return ref.watch(profileRepositoryProvider).fetchProfile();
  }

  /// Re-runs the fetch behind the error state's retry.
  Future<void> refresh() async {
    state = const AsyncValue<TeacherProfile>.loading();
    state = await AsyncValue.guard(
      () => ref.read(profileRepositoryProvider).fetchProfile(),
    );
  }

  /// Adopts a profile that has just been written, so the read state matches the
  /// document without a round trip. Only [ProfileFormSaveController] calls this,
  /// and only after a save it saw succeed.
  void applySaved(TeacherProfile profile) {
    state = AsyncValue<TeacherProfile>.data(profile);
  }
}

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
@riverpod
class ProfileFormSaveController extends _$ProfileFormSaveController {
  @override
  FutureOr<void> build() {}

  /// Returns true when the save succeeded, so the view can show its
  /// confirmation without duplicating the state check.
  Future<bool> save(TeacherProfile profile) async {
    state = const AsyncValue<void>.loading();
    final next = await AsyncValue.guard<void>(
      () => ref.read(profileRepositoryProvider).saveProfile(profile),
    );
    state = next;
    if (!next.hasError) {
      // The document now matches what was sent, so the read state adopts it
      // rather than being left showing the pre-save values.
      ref.read(profileControllerProvider.notifier).applySaved(profile);
    }
    return !next.hasError;
  }
}
