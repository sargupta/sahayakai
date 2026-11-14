import '../domain/inbox_models.dart';

/// Drops one-to-one conversations with a teacher the user blocked, so the
/// thread leaves the inbox at once (the server stops delivering messages
/// either way). Group conversations stay.
List<Conversation> withoutBlockedConversations(
  List<Conversation> conversations,
  String myUid,
  Set<String> blockedUids,
) {
  if (blockedUids.isEmpty) return conversations;
  return [
    for (final c in conversations)
      if (c.isGroup || !blockedUids.contains(c.otherParticipantId(myUid))) c,
  ];
}
