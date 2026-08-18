import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

part 'notification_prefs_provider.g.dart';

const String _kNotificationsKey = 'notifications_enabled';

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
@Riverpod(keepAlive: true)
class NotificationPrefsController extends _$NotificationPrefsController {
  @override
  bool build() {
    _hydrate();
    return false;
  }

  Future<void> _hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getBool(_kNotificationsKey);
    if (stored != null) state = stored;
  }

  /// Set and persist the notification preference.
  Future<void> set({required bool enabled}) async {
    state = enabled;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kNotificationsKey, enabled);
  }
}
