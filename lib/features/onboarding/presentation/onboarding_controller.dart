import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../profile/data/profile_repository.dart';
import '../../profile/domain/teacher_profile.dart';
import '../../profile/presentation/profile_controller.dart';

part 'onboarding_controller.g.dart';

/// Drives onboarding's "Save and continue" through `AsyncValue<void>`:
///   - `AsyncData(null)` -> idle (initial, and after a successful save),
///   - `AsyncLoading`    -> the button shows a spinner and is not re-tappable,
///   - `AsyncError`      -> the typed `ApiException` the view maps to copy.
///
/// The write goes through `ProfileRepository` — onboarding collects the same
/// `users/<uid>` document the Profile screen (P0.8) owns, so it borrows that
/// feature's gateway and its two verified write lanes (the document merge, and
/// the `preferredBoard` PATCH) rather than keeping a parallel one that could
/// drift from them.
///
/// It is a SEPARATE controller from `ProfileFormSaveController` for the reason
/// Settings' own save controller is separate: in-flight state belongs to a
/// button, not to a document. A save here must not spin the Profile screen's
/// button.
///
/// BUILT-PENDING-FIREBASE: `tokenProvider` is the stub, so this 401s at runtime
/// today. Onboarding treats that as a non-event — see `OnboardingScreen`, where
/// a failed save never blocks the teacher from continuing.
@riverpod
class OnboardingSaveController extends _$OnboardingSaveController {
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
      // The document changed, so whatever reads it next (the dashboard's
      // greeting and its setup nudge, the Profile tab) must not serve a cached
      // pre-onboarding copy.
      //
      // `invalidate`, not `applySaved`: this controller has no reason to force
      // a read of a provider nobody is watching yet. Invalidating an
      // uninitialized provider is a no-op, and invalidating a watched one
      // refetches for its listeners.
      ref.invalidate(profileControllerProvider);
    }
    return !next.hasError;
  }
}
