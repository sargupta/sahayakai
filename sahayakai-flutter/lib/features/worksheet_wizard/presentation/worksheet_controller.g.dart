// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'worksheet_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$worksheetControllerHash() =>
    r'ed4d6b85c2bb9feb0bd900adbbf5bebd901b7701';

/// Drives the worksheet screen through `AsyncValue<Worksheet?>`:
///   - `AsyncData(null)`       -> empty / idle (initial),
///   - `AsyncLoading`          -> long-running skeleton (server maxDuration 120 s),
///   - `AsyncError`            -> typed `ApiException` the view maps to the right UI,
///   - `AsyncData(worksheet)`  -> the rendered worksheet.
///
/// Copied from [WorksheetController].
@ProviderFor(WorksheetController)
final worksheetControllerProvider =
    AutoDisposeAsyncNotifierProvider<WorksheetController, Worksheet?>.internal(
      WorksheetController.new,
      name: r'worksheetControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$worksheetControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$WorksheetController = AutoDisposeAsyncNotifier<Worksheet?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
