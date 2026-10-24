// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'openrouter_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$openRouterClientHash() => r'4b787deb58473d14765dc2e98df3300e720c58cb';

/// OpenRouter client provider.
///
/// Returns null if no API key is configured (allows graceful degradation).
///
/// Copied from [openRouterClient].
@ProviderFor(openRouterClient)
final openRouterClientProvider = Provider<OpenRouterClient?>.internal(
  openRouterClient,
  name: r'openRouterClientProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$openRouterClientHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef OpenRouterClientRef = ProviderRef<OpenRouterClient?>;
String _$openRouterDefaultModelHash() =>
    r'8b35182952a7129a01dff6b4407e46bd9524a176';

/// See also [openRouterDefaultModel].
@ProviderFor(openRouterDefaultModel)
final openRouterDefaultModelProvider = AutoDisposeProvider<String>.internal(
  openRouterDefaultModel,
  name: r'openRouterDefaultModelProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$openRouterDefaultModelHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef OpenRouterDefaultModelRef = AutoDisposeProviderRef<String>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
