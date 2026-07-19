// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'usage_repository.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$usageRepositoryHash() => r'0a5a953c739861fbb37132ef53d2b12b5f4b19a8';

/// See also [usageRepository].
@ProviderFor(usageRepository)
final usageRepositoryProvider = AutoDisposeProvider<UsageRepository>.internal(
  usageRepository,
  name: r'usageRepositoryProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$usageRepositoryHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef UsageRepositoryRef = AutoDisposeProviderRef<UsageRepository>;
String _$usageSummaryHash() => r'9dc9f13ecf91ce599fd7b10927e2143fad009937';

/// The current month's usage, for the Plan & usage section. A `FutureProvider`
/// so the hub gets loading / error / data for free; `ref.invalidate` behind the
/// section's retry re-runs the fetch.
///
/// Copied from [usageSummary].
@ProviderFor(usageSummary)
final usageSummaryProvider = AutoDisposeFutureProvider<UsageSummary>.internal(
  usageSummary,
  name: r'usageSummaryProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$usageSummaryHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef UsageSummaryRef = AutoDisposeFutureProviderRef<UsageSummary>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
