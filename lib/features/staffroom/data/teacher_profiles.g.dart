// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'teacher_profiles.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$teacherProfileSourceHash() =>
    r'861d56fc5379acf2306ec189d719967dbeb1cb3d';

/// The bound profile source — live only for a real signed-in teacher, the same
/// gate `staffroomTransportProvider` uses. Widget tests override it.
///
/// Copied from [teacherProfileSource].
@ProviderFor(teacherProfileSource)
final teacherProfileSourceProvider = Provider<TeacherProfileSource>.internal(
  teacherProfileSource,
  name: r'teacherProfileSourceProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$teacherProfileSourceHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef TeacherProfileSourceRef = ProviderRef<TeacherProfileSource>;
String _$teacherProfilesHash() => r'816b159be102f399a61440157b0d0d119f505727';

/// Copied from Dart SDK
class _SystemHash {
  _SystemHash._();

  static int combine(int hash, int value) {
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + value);
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + ((0x0007ffff & hash) << 10));
    return hash ^ (hash >> 6);
  }

  static int finish(int hash) {
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + ((0x03ffffff & hash) << 3));
    // ignore: parameter_assignments
    hash = hash ^ (hash >> 11);
    return 0x1fffffff & (hash + ((0x00003fff & hash) << 15));
  }
}

/// **ONE-SHOT.family.** Profiles for the uids in [uidsKey] (see
/// [teacherProfilesKey]).
///
/// Copied from [teacherProfiles].
@ProviderFor(teacherProfiles)
const teacherProfilesProvider = TeacherProfilesFamily();

/// **ONE-SHOT.family.** Profiles for the uids in [uidsKey] (see
/// [teacherProfilesKey]).
///
/// Copied from [teacherProfiles].
class TeacherProfilesFamily
    extends Family<AsyncValue<Map<String, TeacherSuggestion>>> {
  /// **ONE-SHOT.family.** Profiles for the uids in [uidsKey] (see
  /// [teacherProfilesKey]).
  ///
  /// Copied from [teacherProfiles].
  const TeacherProfilesFamily();

  /// **ONE-SHOT.family.** Profiles for the uids in [uidsKey] (see
  /// [teacherProfilesKey]).
  ///
  /// Copied from [teacherProfiles].
  TeacherProfilesProvider call(String uidsKey) {
    return TeacherProfilesProvider(uidsKey);
  }

  @override
  TeacherProfilesProvider getProviderOverride(
    covariant TeacherProfilesProvider provider,
  ) {
    return call(provider.uidsKey);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'teacherProfilesProvider';
}

/// **ONE-SHOT.family.** Profiles for the uids in [uidsKey] (see
/// [teacherProfilesKey]).
///
/// Copied from [teacherProfiles].
class TeacherProfilesProvider
    extends AutoDisposeFutureProvider<Map<String, TeacherSuggestion>> {
  /// **ONE-SHOT.family.** Profiles for the uids in [uidsKey] (see
  /// [teacherProfilesKey]).
  ///
  /// Copied from [teacherProfiles].
  TeacherProfilesProvider(String uidsKey)
    : this._internal(
        (ref) => teacherProfiles(ref as TeacherProfilesRef, uidsKey),
        from: teacherProfilesProvider,
        name: r'teacherProfilesProvider',
        debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
            ? null
            : _$teacherProfilesHash,
        dependencies: TeacherProfilesFamily._dependencies,
        allTransitiveDependencies:
            TeacherProfilesFamily._allTransitiveDependencies,
        uidsKey: uidsKey,
      );

  TeacherProfilesProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.uidsKey,
  }) : super.internal();

  final String uidsKey;

  @override
  Override overrideWith(
    FutureOr<Map<String, TeacherSuggestion>> Function(
      TeacherProfilesRef provider,
    )
    create,
  ) {
    return ProviderOverride(
      origin: this,
      override: TeacherProfilesProvider._internal(
        (ref) => create(ref as TeacherProfilesRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        uidsKey: uidsKey,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<Map<String, TeacherSuggestion>>
  createElement() {
    return _TeacherProfilesProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is TeacherProfilesProvider && other.uidsKey == uidsKey;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, uidsKey.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin TeacherProfilesRef
    on AutoDisposeFutureProviderRef<Map<String, TeacherSuggestion>> {
  /// The parameter `uidsKey` of this provider.
  String get uidsKey;
}

class _TeacherProfilesProviderElement
    extends AutoDisposeFutureProviderElement<Map<String, TeacherSuggestion>>
    with TeacherProfilesRef {
  _TeacherProfilesProviderElement(super.provider);

  @override
  String get uidsKey => (origin as TeacherProfilesProvider).uidsKey;
}

// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
