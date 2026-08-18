// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_prefs_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$notificationPrefsControllerHash() =>
    r'2065cc7b59c206816cd68f2f4b02c74705b31caa';

/// Whether the teacher wants reminders and updates. Persisted locally, same
/// shape as `LocaleController` / `ThemeModeController`.
///
/// LOCAL ONLY — this flag currently controls nothing but itself.
///
/// TODO(P2, handoff-gated): wire to FCM once Firebase lands. Flipping this on
/// must then request the OS notification permission (Android 13+
/// POST_NOTIFICATIONS) and `FirebaseMessaging.instance.subscribeToTopic(...)`;
/// flipping it off must unsubscribe and `deleteToken()`. Until then the switch
/// only records intent, so it defaults to OFF: promising a teacher
/// notifications we cannot send would be a lie, and defaulting a
/// permission-bearing toggle ON is a dark pattern.
///
/// Copied from [NotificationPrefsController].
@ProviderFor(NotificationPrefsController)
final notificationPrefsControllerProvider =
    NotifierProvider<NotificationPrefsController, bool>.internal(
      NotificationPrefsController.new,
      name: r'notificationPrefsControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$notificationPrefsControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$NotificationPrefsController = Notifier<bool>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
