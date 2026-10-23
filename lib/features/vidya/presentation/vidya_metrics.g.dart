// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'vidya_metrics.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$vidyaMetricsHash() => r'f04944bc3a3862b7d92509192d606341d8d9edc2';

/// Provider that computes metrics from the real usage summary.
/// Degrades gracefully to [VidyaMetrics.demo] when the fetch fails
/// (401 on stub token, network error, etc.) so the home screen never
/// shows an empty/error state for the metrics row.
///
/// Copied from [vidyaMetrics].
@ProviderFor(vidyaMetrics)
final vidyaMetricsProvider = AutoDisposeFutureProvider<VidyaMetrics>.internal(
  vidyaMetrics,
  name: r'vidyaMetricsProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$vidyaMetricsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef VidyaMetricsRef = AutoDisposeFutureProviderRef<VidyaMetrics>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
