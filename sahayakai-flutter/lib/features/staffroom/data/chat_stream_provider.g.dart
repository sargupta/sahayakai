// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'chat_stream_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$staffRoomChatHash() => r'74b5ab7ae59a131fbdeebe87df54476df2ad6c20';

/// **LIVE.** The global Staff Room chat — a `StreamProvider` over
/// [StaffroomTransport.watchStaffRoomChat] (`community_chat`,
/// `onSnapshot(orderBy createdAt asc, limitToLast(100))`). Messages arrive
/// oldest→newest.
///
/// Copied from [staffRoomChat].
@ProviderFor(staffRoomChat)
final staffRoomChatProvider =
    AutoDisposeStreamProvider<TransportSnapshot<List<ChatMessage>>>.internal(
      staffRoomChat,
      name: r'staffRoomChatProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$staffRoomChatHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef StaffRoomChatRef =
    AutoDisposeStreamProviderRef<TransportSnapshot<List<ChatMessage>>>;
String _$groupChatHash() => r'0aaa46ceb2ec93532d5eab5e420f8bbd4bd40c19';

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

/// **LIVE.family.** One group's chat — a `StreamProvider.family` keyed by
/// groupId over [StaffroomTransport.watchGroupChat] (`groups/{id}/chat`, member-
/// gated by `firestore.rules`). Same doc shape as the Staff Room.
///
/// Copied from [groupChat].
@ProviderFor(groupChat)
const groupChatProvider = GroupChatFamily();

/// **LIVE.family.** One group's chat — a `StreamProvider.family` keyed by
/// groupId over [StaffroomTransport.watchGroupChat] (`groups/{id}/chat`, member-
/// gated by `firestore.rules`). Same doc shape as the Staff Room.
///
/// Copied from [groupChat].
class GroupChatFamily
    extends Family<AsyncValue<TransportSnapshot<List<ChatMessage>>>> {
  /// **LIVE.family.** One group's chat — a `StreamProvider.family` keyed by
  /// groupId over [StaffroomTransport.watchGroupChat] (`groups/{id}/chat`, member-
  /// gated by `firestore.rules`). Same doc shape as the Staff Room.
  ///
  /// Copied from [groupChat].
  const GroupChatFamily();

  /// **LIVE.family.** One group's chat — a `StreamProvider.family` keyed by
  /// groupId over [StaffroomTransport.watchGroupChat] (`groups/{id}/chat`, member-
  /// gated by `firestore.rules`). Same doc shape as the Staff Room.
  ///
  /// Copied from [groupChat].
  GroupChatProvider call(String groupId) {
    return GroupChatProvider(groupId);
  }

  @override
  GroupChatProvider getProviderOverride(covariant GroupChatProvider provider) {
    return call(provider.groupId);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'groupChatProvider';
}

/// **LIVE.family.** One group's chat — a `StreamProvider.family` keyed by
/// groupId over [StaffroomTransport.watchGroupChat] (`groups/{id}/chat`, member-
/// gated by `firestore.rules`). Same doc shape as the Staff Room.
///
/// Copied from [groupChat].
class GroupChatProvider
    extends AutoDisposeStreamProvider<TransportSnapshot<List<ChatMessage>>> {
  /// **LIVE.family.** One group's chat — a `StreamProvider.family` keyed by
  /// groupId over [StaffroomTransport.watchGroupChat] (`groups/{id}/chat`, member-
  /// gated by `firestore.rules`). Same doc shape as the Staff Room.
  ///
  /// Copied from [groupChat].
  GroupChatProvider(String groupId)
    : this._internal(
        (ref) => groupChat(ref as GroupChatRef, groupId),
        from: groupChatProvider,
        name: r'groupChatProvider',
        debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
            ? null
            : _$groupChatHash,
        dependencies: GroupChatFamily._dependencies,
        allTransitiveDependencies: GroupChatFamily._allTransitiveDependencies,
        groupId: groupId,
      );

  GroupChatProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.groupId,
  }) : super.internal();

  final String groupId;

  @override
  Override overrideWith(
    Stream<TransportSnapshot<List<ChatMessage>>> Function(GroupChatRef provider)
    create,
  ) {
    return ProviderOverride(
      origin: this,
      override: GroupChatProvider._internal(
        (ref) => create(ref as GroupChatRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        groupId: groupId,
      ),
    );
  }

  @override
  AutoDisposeStreamProviderElement<TransportSnapshot<List<ChatMessage>>>
  createElement() {
    return _GroupChatProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is GroupChatProvider && other.groupId == groupId;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, groupId.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin GroupChatRef
    on AutoDisposeStreamProviderRef<TransportSnapshot<List<ChatMessage>>> {
  /// The parameter `groupId` of this provider.
  String get groupId;
}

class _GroupChatProviderElement
    extends
        AutoDisposeStreamProviderElement<TransportSnapshot<List<ChatMessage>>>
    with GroupChatRef {
  _GroupChatProviderElement(super.provider);

  @override
  String get groupId => (origin as GroupChatProvider).groupId;
}

String _$chatSendControllerHash() =>
    r'8dd2ead9adfb0ffbf349705f1c0d54bef428b4bf';

abstract class _$ChatSendController
    extends BuildlessAutoDisposeNotifier<ChatSendState> {
  late final ChatRoom room;

  ChatSendState build(ChatRoom room);
}

/// The optimistic chat-send controller (SPEC §A3.2), one per [ChatRoom].
///
/// [send] appends a pending bubble and fires the REST-wrapper write
/// (`sendCommunityChatMessage` / `sendGroupChatMessage`) with a client-generated
/// [PendingChatSend.clientMessageId]; on success the bubble is marked `sent` and
/// the live stream reconciles it via [mergeChatForDisplay] (community_chat does
/// not echo a client id, so the reconcile matches on author + text + novelty). On
/// a typed [TransportUnavailable] / any error the bubble **rolls back** and the
/// screen shows a dignified inline retry; [retry] re-sends with the SAME
/// clientMessageId so it stays a single logical message (no double pending).
///
/// autoDispose per room: the pending list lives only while the chat screen is
/// open, matching the U-SI1 composer's widget-scoped optimistic state.
///
/// Copied from [ChatSendController].
@ProviderFor(ChatSendController)
const chatSendControllerProvider = ChatSendControllerFamily();

/// The optimistic chat-send controller (SPEC §A3.2), one per [ChatRoom].
///
/// [send] appends a pending bubble and fires the REST-wrapper write
/// (`sendCommunityChatMessage` / `sendGroupChatMessage`) with a client-generated
/// [PendingChatSend.clientMessageId]; on success the bubble is marked `sent` and
/// the live stream reconciles it via [mergeChatForDisplay] (community_chat does
/// not echo a client id, so the reconcile matches on author + text + novelty). On
/// a typed [TransportUnavailable] / any error the bubble **rolls back** and the
/// screen shows a dignified inline retry; [retry] re-sends with the SAME
/// clientMessageId so it stays a single logical message (no double pending).
///
/// autoDispose per room: the pending list lives only while the chat screen is
/// open, matching the U-SI1 composer's widget-scoped optimistic state.
///
/// Copied from [ChatSendController].
class ChatSendControllerFamily extends Family<ChatSendState> {
  /// The optimistic chat-send controller (SPEC §A3.2), one per [ChatRoom].
  ///
  /// [send] appends a pending bubble and fires the REST-wrapper write
  /// (`sendCommunityChatMessage` / `sendGroupChatMessage`) with a client-generated
  /// [PendingChatSend.clientMessageId]; on success the bubble is marked `sent` and
  /// the live stream reconciles it via [mergeChatForDisplay] (community_chat does
  /// not echo a client id, so the reconcile matches on author + text + novelty). On
  /// a typed [TransportUnavailable] / any error the bubble **rolls back** and the
  /// screen shows a dignified inline retry; [retry] re-sends with the SAME
  /// clientMessageId so it stays a single logical message (no double pending).
  ///
  /// autoDispose per room: the pending list lives only while the chat screen is
  /// open, matching the U-SI1 composer's widget-scoped optimistic state.
  ///
  /// Copied from [ChatSendController].
  const ChatSendControllerFamily();

  /// The optimistic chat-send controller (SPEC §A3.2), one per [ChatRoom].
  ///
  /// [send] appends a pending bubble and fires the REST-wrapper write
  /// (`sendCommunityChatMessage` / `sendGroupChatMessage`) with a client-generated
  /// [PendingChatSend.clientMessageId]; on success the bubble is marked `sent` and
  /// the live stream reconciles it via [mergeChatForDisplay] (community_chat does
  /// not echo a client id, so the reconcile matches on author + text + novelty). On
  /// a typed [TransportUnavailable] / any error the bubble **rolls back** and the
  /// screen shows a dignified inline retry; [retry] re-sends with the SAME
  /// clientMessageId so it stays a single logical message (no double pending).
  ///
  /// autoDispose per room: the pending list lives only while the chat screen is
  /// open, matching the U-SI1 composer's widget-scoped optimistic state.
  ///
  /// Copied from [ChatSendController].
  ChatSendControllerProvider call(ChatRoom room) {
    return ChatSendControllerProvider(room);
  }

  @override
  ChatSendControllerProvider getProviderOverride(
    covariant ChatSendControllerProvider provider,
  ) {
    return call(provider.room);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'chatSendControllerProvider';
}

/// The optimistic chat-send controller (SPEC §A3.2), one per [ChatRoom].
///
/// [send] appends a pending bubble and fires the REST-wrapper write
/// (`sendCommunityChatMessage` / `sendGroupChatMessage`) with a client-generated
/// [PendingChatSend.clientMessageId]; on success the bubble is marked `sent` and
/// the live stream reconciles it via [mergeChatForDisplay] (community_chat does
/// not echo a client id, so the reconcile matches on author + text + novelty). On
/// a typed [TransportUnavailable] / any error the bubble **rolls back** and the
/// screen shows a dignified inline retry; [retry] re-sends with the SAME
/// clientMessageId so it stays a single logical message (no double pending).
///
/// autoDispose per room: the pending list lives only while the chat screen is
/// open, matching the U-SI1 composer's widget-scoped optimistic state.
///
/// Copied from [ChatSendController].
class ChatSendControllerProvider
    extends AutoDisposeNotifierProviderImpl<ChatSendController, ChatSendState> {
  /// The optimistic chat-send controller (SPEC §A3.2), one per [ChatRoom].
  ///
  /// [send] appends a pending bubble and fires the REST-wrapper write
  /// (`sendCommunityChatMessage` / `sendGroupChatMessage`) with a client-generated
  /// [PendingChatSend.clientMessageId]; on success the bubble is marked `sent` and
  /// the live stream reconciles it via [mergeChatForDisplay] (community_chat does
  /// not echo a client id, so the reconcile matches on author + text + novelty). On
  /// a typed [TransportUnavailable] / any error the bubble **rolls back** and the
  /// screen shows a dignified inline retry; [retry] re-sends with the SAME
  /// clientMessageId so it stays a single logical message (no double pending).
  ///
  /// autoDispose per room: the pending list lives only while the chat screen is
  /// open, matching the U-SI1 composer's widget-scoped optimistic state.
  ///
  /// Copied from [ChatSendController].
  ChatSendControllerProvider(ChatRoom room)
    : this._internal(
        () => ChatSendController()..room = room,
        from: chatSendControllerProvider,
        name: r'chatSendControllerProvider',
        debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
            ? null
            : _$chatSendControllerHash,
        dependencies: ChatSendControllerFamily._dependencies,
        allTransitiveDependencies:
            ChatSendControllerFamily._allTransitiveDependencies,
        room: room,
      );

  ChatSendControllerProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.room,
  }) : super.internal();

  final ChatRoom room;

  @override
  ChatSendState runNotifierBuild(covariant ChatSendController notifier) {
    return notifier.build(room);
  }

  @override
  Override overrideWith(ChatSendController Function() create) {
    return ProviderOverride(
      origin: this,
      override: ChatSendControllerProvider._internal(
        () => create()..room = room,
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        room: room,
      ),
    );
  }

  @override
  AutoDisposeNotifierProviderElement<ChatSendController, ChatSendState>
  createElement() {
    return _ChatSendControllerProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is ChatSendControllerProvider && other.room == room;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, room.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin ChatSendControllerRef on AutoDisposeNotifierProviderRef<ChatSendState> {
  /// The parameter `room` of this provider.
  ChatRoom get room;
}

class _ChatSendControllerProviderElement
    extends
        AutoDisposeNotifierProviderElement<ChatSendController, ChatSendState>
    with ChatSendControllerRef {
  _ChatSendControllerProviderElement(super.provider);

  @override
  ChatRoom get room => (origin as ChatSendControllerProvider).room;
}

String _$personaPulseControllerHash() =>
    r'f4fa250a78ed82f42d8b2184a405bc21688f1950';

abstract class _$PersonaPulseController
    extends BuildlessAutoDisposeNotifier<PersonaPulseStatus> {
  late final ChatRoom room;

  PersonaPulseStatus build(ChatRoom room);
}

/// The persona-pulse keep-warm controller (SPEC §A1.4 / §A3.2 · pillar 04).
///
/// While the Staff Room chat is open it POSTs `/api/community/persona-pulse` on a
/// polite [kPersonaPulseInterval] timer so an AI teacher persona keeps the room
/// feeling alive. HONEST + POLITE + LEAK-FREE — modelled on the parent-hotline
/// poll discipline:
///   • it arms **only** for the community Staff Room (the persona-pulse route
///     writes `community_chat`); a group chat never arms it;
///   • the timer is a self-rescheduling [Timer] (not `Timer.periodic`) guarded by
///     a generation counter [_gen] + a [_disposed] flag, so no fire survives a
///     dispose or a stop;
///   • `ref.onDispose` cancels the timer — leaving the screen (this autoDispose
///     provider is no longer watched) stops the pulses, no leak;
///   • a **null** result (a 503 — the `communityPersonas` flag is off) or ANY
///     thrown error (the deferred transport, a 401 on the stub) **permanently
///     disarms** the timer for the session — it never loops on a dead endpoint;
///   • a 200 reschedules exactly one next pulse.
///
/// The AI message it triggers is written to `community_chat` and rendered in the
/// chat with an explicit "AI teacher" badge — the persona is always labelled AI,
/// never posing as a real teacher.
///
/// Copied from [PersonaPulseController].
@ProviderFor(PersonaPulseController)
const personaPulseControllerProvider = PersonaPulseControllerFamily();

/// The persona-pulse keep-warm controller (SPEC §A1.4 / §A3.2 · pillar 04).
///
/// While the Staff Room chat is open it POSTs `/api/community/persona-pulse` on a
/// polite [kPersonaPulseInterval] timer so an AI teacher persona keeps the room
/// feeling alive. HONEST + POLITE + LEAK-FREE — modelled on the parent-hotline
/// poll discipline:
///   • it arms **only** for the community Staff Room (the persona-pulse route
///     writes `community_chat`); a group chat never arms it;
///   • the timer is a self-rescheduling [Timer] (not `Timer.periodic`) guarded by
///     a generation counter [_gen] + a [_disposed] flag, so no fire survives a
///     dispose or a stop;
///   • `ref.onDispose` cancels the timer — leaving the screen (this autoDispose
///     provider is no longer watched) stops the pulses, no leak;
///   • a **null** result (a 503 — the `communityPersonas` flag is off) or ANY
///     thrown error (the deferred transport, a 401 on the stub) **permanently
///     disarms** the timer for the session — it never loops on a dead endpoint;
///   • a 200 reschedules exactly one next pulse.
///
/// The AI message it triggers is written to `community_chat` and rendered in the
/// chat with an explicit "AI teacher" badge — the persona is always labelled AI,
/// never posing as a real teacher.
///
/// Copied from [PersonaPulseController].
class PersonaPulseControllerFamily extends Family<PersonaPulseStatus> {
  /// The persona-pulse keep-warm controller (SPEC §A1.4 / §A3.2 · pillar 04).
  ///
  /// While the Staff Room chat is open it POSTs `/api/community/persona-pulse` on a
  /// polite [kPersonaPulseInterval] timer so an AI teacher persona keeps the room
  /// feeling alive. HONEST + POLITE + LEAK-FREE — modelled on the parent-hotline
  /// poll discipline:
  ///   • it arms **only** for the community Staff Room (the persona-pulse route
  ///     writes `community_chat`); a group chat never arms it;
  ///   • the timer is a self-rescheduling [Timer] (not `Timer.periodic`) guarded by
  ///     a generation counter [_gen] + a [_disposed] flag, so no fire survives a
  ///     dispose or a stop;
  ///   • `ref.onDispose` cancels the timer — leaving the screen (this autoDispose
  ///     provider is no longer watched) stops the pulses, no leak;
  ///   • a **null** result (a 503 — the `communityPersonas` flag is off) or ANY
  ///     thrown error (the deferred transport, a 401 on the stub) **permanently
  ///     disarms** the timer for the session — it never loops on a dead endpoint;
  ///   • a 200 reschedules exactly one next pulse.
  ///
  /// The AI message it triggers is written to `community_chat` and rendered in the
  /// chat with an explicit "AI teacher" badge — the persona is always labelled AI,
  /// never posing as a real teacher.
  ///
  /// Copied from [PersonaPulseController].
  const PersonaPulseControllerFamily();

  /// The persona-pulse keep-warm controller (SPEC §A1.4 / §A3.2 · pillar 04).
  ///
  /// While the Staff Room chat is open it POSTs `/api/community/persona-pulse` on a
  /// polite [kPersonaPulseInterval] timer so an AI teacher persona keeps the room
  /// feeling alive. HONEST + POLITE + LEAK-FREE — modelled on the parent-hotline
  /// poll discipline:
  ///   • it arms **only** for the community Staff Room (the persona-pulse route
  ///     writes `community_chat`); a group chat never arms it;
  ///   • the timer is a self-rescheduling [Timer] (not `Timer.periodic`) guarded by
  ///     a generation counter [_gen] + a [_disposed] flag, so no fire survives a
  ///     dispose or a stop;
  ///   • `ref.onDispose` cancels the timer — leaving the screen (this autoDispose
  ///     provider is no longer watched) stops the pulses, no leak;
  ///   • a **null** result (a 503 — the `communityPersonas` flag is off) or ANY
  ///     thrown error (the deferred transport, a 401 on the stub) **permanently
  ///     disarms** the timer for the session — it never loops on a dead endpoint;
  ///   • a 200 reschedules exactly one next pulse.
  ///
  /// The AI message it triggers is written to `community_chat` and rendered in the
  /// chat with an explicit "AI teacher" badge — the persona is always labelled AI,
  /// never posing as a real teacher.
  ///
  /// Copied from [PersonaPulseController].
  PersonaPulseControllerProvider call(ChatRoom room) {
    return PersonaPulseControllerProvider(room);
  }

  @override
  PersonaPulseControllerProvider getProviderOverride(
    covariant PersonaPulseControllerProvider provider,
  ) {
    return call(provider.room);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'personaPulseControllerProvider';
}

/// The persona-pulse keep-warm controller (SPEC §A1.4 / §A3.2 · pillar 04).
///
/// While the Staff Room chat is open it POSTs `/api/community/persona-pulse` on a
/// polite [kPersonaPulseInterval] timer so an AI teacher persona keeps the room
/// feeling alive. HONEST + POLITE + LEAK-FREE — modelled on the parent-hotline
/// poll discipline:
///   • it arms **only** for the community Staff Room (the persona-pulse route
///     writes `community_chat`); a group chat never arms it;
///   • the timer is a self-rescheduling [Timer] (not `Timer.periodic`) guarded by
///     a generation counter [_gen] + a [_disposed] flag, so no fire survives a
///     dispose or a stop;
///   • `ref.onDispose` cancels the timer — leaving the screen (this autoDispose
///     provider is no longer watched) stops the pulses, no leak;
///   • a **null** result (a 503 — the `communityPersonas` flag is off) or ANY
///     thrown error (the deferred transport, a 401 on the stub) **permanently
///     disarms** the timer for the session — it never loops on a dead endpoint;
///   • a 200 reschedules exactly one next pulse.
///
/// The AI message it triggers is written to `community_chat` and rendered in the
/// chat with an explicit "AI teacher" badge — the persona is always labelled AI,
/// never posing as a real teacher.
///
/// Copied from [PersonaPulseController].
class PersonaPulseControllerProvider
    extends
        AutoDisposeNotifierProviderImpl<
          PersonaPulseController,
          PersonaPulseStatus
        > {
  /// The persona-pulse keep-warm controller (SPEC §A1.4 / §A3.2 · pillar 04).
  ///
  /// While the Staff Room chat is open it POSTs `/api/community/persona-pulse` on a
  /// polite [kPersonaPulseInterval] timer so an AI teacher persona keeps the room
  /// feeling alive. HONEST + POLITE + LEAK-FREE — modelled on the parent-hotline
  /// poll discipline:
  ///   • it arms **only** for the community Staff Room (the persona-pulse route
  ///     writes `community_chat`); a group chat never arms it;
  ///   • the timer is a self-rescheduling [Timer] (not `Timer.periodic`) guarded by
  ///     a generation counter [_gen] + a [_disposed] flag, so no fire survives a
  ///     dispose or a stop;
  ///   • `ref.onDispose` cancels the timer — leaving the screen (this autoDispose
  ///     provider is no longer watched) stops the pulses, no leak;
  ///   • a **null** result (a 503 — the `communityPersonas` flag is off) or ANY
  ///     thrown error (the deferred transport, a 401 on the stub) **permanently
  ///     disarms** the timer for the session — it never loops on a dead endpoint;
  ///   • a 200 reschedules exactly one next pulse.
  ///
  /// The AI message it triggers is written to `community_chat` and rendered in the
  /// chat with an explicit "AI teacher" badge — the persona is always labelled AI,
  /// never posing as a real teacher.
  ///
  /// Copied from [PersonaPulseController].
  PersonaPulseControllerProvider(ChatRoom room)
    : this._internal(
        () => PersonaPulseController()..room = room,
        from: personaPulseControllerProvider,
        name: r'personaPulseControllerProvider',
        debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
            ? null
            : _$personaPulseControllerHash,
        dependencies: PersonaPulseControllerFamily._dependencies,
        allTransitiveDependencies:
            PersonaPulseControllerFamily._allTransitiveDependencies,
        room: room,
      );

  PersonaPulseControllerProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.room,
  }) : super.internal();

  final ChatRoom room;

  @override
  PersonaPulseStatus runNotifierBuild(
    covariant PersonaPulseController notifier,
  ) {
    return notifier.build(room);
  }

  @override
  Override overrideWith(PersonaPulseController Function() create) {
    return ProviderOverride(
      origin: this,
      override: PersonaPulseControllerProvider._internal(
        () => create()..room = room,
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        room: room,
      ),
    );
  }

  @override
  AutoDisposeNotifierProviderElement<PersonaPulseController, PersonaPulseStatus>
  createElement() {
    return _PersonaPulseControllerProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is PersonaPulseControllerProvider && other.room == room;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, room.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin PersonaPulseControllerRef
    on AutoDisposeNotifierProviderRef<PersonaPulseStatus> {
  /// The parameter `room` of this provider.
  ChatRoom get room;
}

class _PersonaPulseControllerProviderElement
    extends
        AutoDisposeNotifierProviderElement<
          PersonaPulseController,
          PersonaPulseStatus
        >
    with PersonaPulseControllerRef {
  _PersonaPulseControllerProviderElement(super.provider);

  @override
  ChatRoom get room => (origin as PersonaPulseControllerProvider).room;
}

// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
