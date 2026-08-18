// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'image_input.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$imagePickerServiceHash() =>
    r'5487f876456deda5b646cb083dc2b439be30b918';

/// The injectable pick source. Override this provider in tests with a fake so
/// the widget never touches the camera or the file system.
///
/// Copied from [imagePickerService].
@ProviderFor(imagePickerService)
final imagePickerServiceProvider =
    AutoDisposeProvider<ImagePickerService>.internal(
      imagePickerService,
      name: r'imagePickerServiceProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$imagePickerServiceHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef ImagePickerServiceRef = AutoDisposeProviderRef<ImagePickerService>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
