import 'package:flutter/foundation.dart';

import 'chat_message.dart';

/// The staff room at a glance: who has written in it today and the newest
/// message, from the messages the live stream already holds.
@immutable
class StaffRoomGlance {
  const StaffRoomGlance({required this.talkersToday, required this.latest});

  /// One message per distinct teacher who wrote today (local day), newest
  /// first, so a card can show their names and avatars. AI teachers are not
  /// counted.
  final List<ChatMessage> talkersToday;

  /// The newest message with text or a voice note, or null when the room is
  /// empty.
  final ChatMessage? latest;

  static const empty = StaffRoomGlance(talkersToday: [], latest: null);
}

/// Builds the glance from [messages] (any order) as of [now].
///
/// A message without a readable timestamp (an optimistic send) counts as now.
StaffRoomGlance glanceAtStaffRoom(List<ChatMessage> messages, DateTime now) {
  if (messages.isEmpty) return StaffRoomGlance.empty;
  DateTime at(ChatMessage m) =>
      DateTime.tryParse(m.createdAt ?? '')?.toLocal() ?? now;
  final sorted = [...messages]..sort((a, b) => at(b).compareTo(at(a)));
  final today = DateTime(now.year, now.month, now.day);
  final seen = <String>{};
  final talkers = <ChatMessage>[];
  ChatMessage? latest;
  for (final m in sorted) {
    if (m.text.trim().isEmpty && !m.hasAudio) continue;
    latest ??= m;
    // "Talking today" counts teachers: an AI teacher's message can be the
    // newest one shown (it is marked), but it is never counted as a person.
    if (m.isDemoPersona) continue;
    final when = at(m);
    if (DateTime(when.year, when.month, when.day) != today) continue;
    final who = m.authorId.isNotEmpty ? m.authorId : m.authorName.trim();
    if (who.isEmpty || !seen.add(who)) continue;
    talkers.add(m);
  }
  return StaffRoomGlance(talkersToday: talkers, latest: latest);
}
