// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'onboarding_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$onboardingSaveControllerHash() =>
    r'baf711d798906c8aca77ed357c36bff9e589a938';

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
///
/// Copied from [OnboardingSaveController].
@ProviderFor(OnboardingSaveController)
final onboardingSaveControllerProvider =
    AutoDisposeAsyncNotifierProvider<OnboardingSaveController, void>.internal(
      OnboardingSaveController.new,
      name: r'onboardingSaveControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$onboardingSaveControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$OnboardingSaveController = AutoDisposeAsyncNotifier<void>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
