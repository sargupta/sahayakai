// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'parent_message_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$parentMessageControllerHash() =>
    r'8974154e77b2e85f6713b82855fe62338d59d801';

/// Drives the Parent Message screen through `AsyncValue<ParentMessage?>`:
///   - `AsyncData(null)`      -> empty / idle (initial),
///   - `AsyncLoading`         -> generation skeleton,
///   - `AsyncError`           -> typed `ApiException` the view maps to the right
///                               UI (401 sign-in, 403 upgrade, 429 limit, 503
///                               busy, 400 missing-required...),
///   - `AsyncData(message)`   -> the drafted parent message.
///
/// Copied from [ParentMessageController].
@ProviderFor(ParentMessageController)
final parentMessageControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      ParentMessageController,
      ParentMessage?
    >.internal(
      ParentMessageController.new,
      name: r'parentMessageControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$parentMessageControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$ParentMessageController = AutoDisposeAsyncNotifier<ParentMessage?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
