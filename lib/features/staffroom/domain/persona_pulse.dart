import 'package:flutter/foundation.dart';

/// The AI-teacher message returned by `POST /api/community/persona-pulse` — the
/// demo-only heartbeat that keeps the Staff Room feeling alive (SPEC §A1.4,
/// §A3.2). This is the **one real, already-deployed REST route** among the Block-C
/// surfaces (the others need REST wrappers written).
///
/// Response shape: `{ message, personaName, personaState, personaSubject }`.
/// A **503** means the `communityPersonas` flag is off → **permanently disarm**
/// the polling timer for the session (web parity); the transport models that as
/// a `null` return (see `StaffroomTransport.triggerPersonaPulse`), NOT an error.
///
/// Firebase-gated in effect: the pulse *writes* an AI message into
/// `community_chat`, which is only *visible* via the Firestore chat stream — so
/// it is useless until the chat stream is live, and is deferred with the rest.
@immutable
class PersonaPulse {
  const PersonaPulse({
    required this.message,
    this.personaName,
    this.personaState,
    this.personaSubject,
  });

  /// The AI teacher's message text (server caps at 200 chars).
  final String message;
  final String? personaName;
  final String? personaState;
  final String? personaSubject;

  @override
  bool operator ==(Object other) =>
      other is PersonaPulse &&
      other.message == message &&
      other.personaName == personaName &&
      other.personaState == personaState &&
      other.personaSubject == personaSubject;

  @override
  int get hashCode =>
      Object.hash(message, personaName, personaState, personaSubject);
}

/// One prior message the persona is given as context
/// (`{ authorName, text }`) — the client trusts it only enough to prompt with.
@immutable
class PersonaPulseContext {
  const PersonaPulseContext({required this.authorName, required this.text});

  final String authorName;
  final String text;

  @override
  bool operator ==(Object other) =>
      other is PersonaPulseContext &&
      other.authorName == authorName &&
      other.text == text;

  @override
  int get hashCode => Object.hash(authorName, text);
}

/// The persona-pulse request options (`{ recentMessages?, personaId?, mode? }`),
/// all optional.
@immutable
class PersonaPulseRequest {
  const PersonaPulseRequest({
    this.recentMessages = const <PersonaPulseContext>[],
    this.personaId,
    this.mode,
  });

  final List<PersonaPulseContext> recentMessages;
  final String? personaId;

  /// `'reply' | 'fresh' | 'auto'` — server defaults to `auto`.
  final String? mode;

  @override
  bool operator ==(Object other) =>
      other is PersonaPulseRequest &&
      listEquals(other.recentMessages, recentMessages) &&
      other.personaId == personaId &&
      other.mode == mode;

  @override
  int get hashCode =>
      Object.hash(Object.hashAll(recentMessages), personaId, mode);
}
