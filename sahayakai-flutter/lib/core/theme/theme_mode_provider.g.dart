// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'theme_mode_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$themeModeControllerHash() =>
    r'377523b3f149526c80a6d9b14b7f54f0406fd563';

/// The active [ThemeMode], persisted across launches with shared_preferences
/// and read by `SahayakApp` (MaterialApp.router `themeMode`), so flipping it
/// re-themes the whole app live.
///
/// Deliberately mirrors [LocaleController] in `core/i18n/locale_provider.dart`:
/// same keepAlive notifier shape, same "start at the default, hydrate the
/// persisted choice asynchronously" contract. One pattern, two prefs.
///
/// [ThemeMode.system] is kept as a first-class option (and the default) rather
/// than a bare light/dark switch: it is what the app shipped with, and it is
/// what the web app's `next-themes` does.
///
/// Copied from [ThemeModeController].
@ProviderFor(ThemeModeController)
final themeModeControllerProvider =
    NotifierProvider<ThemeModeController, ThemeMode>.internal(
      ThemeModeController.new,
      name: r'themeModeControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$themeModeControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$ThemeModeController = Notifier<ThemeMode>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
