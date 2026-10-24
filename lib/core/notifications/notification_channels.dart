/// Notification channel definitions for SahayakAI.
/// Channels are created by the OS when FCM messages arrive.
/// Channel IDs must match what the backend sends in the FCM data payload.
class NotificationChannels {
  NotificationChannels._();

  static const String classReminders = 'class_reminders';
  static const String taskResults = 'task_results';
  static const String messagesUpdates = 'messages_updates';
  static const String accountSystem = 'account_system';

  static const List<String> all = [
    classReminders,
    taskResults,
    messagesUpdates,
    accountSystem,
  ];
}