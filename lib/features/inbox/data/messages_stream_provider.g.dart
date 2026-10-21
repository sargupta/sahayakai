// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'messages_stream_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$inboxListHash() => r'c874fbcdeae93a12af519b3b1da1933bf287c097';

/// # Pro Inbox realtime providers (U-SI1)
///
/// Thin Riverpod wrappers over the [InboxTransport] live-read streams (SPEC §0 /
/// §B / §C). Each is a `StreamProvider<TransportSnapshot<...>>`, so the UI reads
/// **both** the payload and the listener lifecycle off one value and maps it:
///
///   - `awaitingFirebase` / `signedOut` → the sign-in `EmptyView` (DM gate);
///   - `loading`                        → an `AppSkeleton`;
///   - `ready` (possibly empty)         → the list / the empty-list `EmptyView`;
///   - `error` (missing index / denied) → an `ErrorView` + retry — never a hang.
///
/// While Firebase is gated the bound transport is [DeferredInboxTransport], so
/// every stream emits a single `awaitingFirebase` snapshot and the screens
/// render their signed-out/awaiting surface on-device (verified by code + test,
/// not live). At the handoff `inboxTransportProvider` swaps to the Firestore
/// impl and these providers stream live `onSnapshot` data with **no UI change**.
/// **LIVE.** The inbox list — a `StreamProvider` over
/// [InboxTransport.watchInbox]. The rows are ordered `lastMessageAt desc` by the
/// transport; the UI keeps that order.
///
/// Copied from [inboxList].
@ProviderFor(inboxList)
final inboxListProvider =
    AutoDisposeStreamProvider<TransportSnapshot<List<Conversation>>>.internal(
      inboxList,
      name: r'inboxListProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$inboxListHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef InboxListRef =
    AutoDisposeStreamProviderRef<TransportSnapshot<List<Conversation>>>;
String _$conversationThreadHash() =>
    r'c2b0019bb6c6bbc38cc4b57c3fe8f6093a2beee0';

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

/// **LIVE.** The tail of one thread — a `StreamProvider.family` keyed by
/// [ConversationId] over [InboxTransport.watchThread]. Referentially stable
/// (the transport dedups by [Message.id]) so the reversed list does not thrash.
///
/// Copied from [conversationThread].
@ProviderFor(conversationThread)
const conversationThreadProvider = ConversationThreadFamily();

/// **LIVE.** The tail of one thread — a `StreamProvider.family` keyed by
/// [ConversationId] over [InboxTransport.watchThread]. Referentially stable
/// (the transport dedups by [Message.id]) so the reversed list does not thrash.
///
/// Copied from [conversationThread].
class ConversationThreadFamily
    extends Family<AsyncValue<TransportSnapshot<List<Message>>>> {
  /// **LIVE.** The tail of one thread — a `StreamProvider.family` keyed by
  /// [ConversationId] over [InboxTransport.watchThread]. Referentially stable
  /// (the transport dedups by [Message.id]) so the reversed list does not thrash.
  ///
  /// Copied from [conversationThread].
  const ConversationThreadFamily();

  /// **LIVE.** The tail of one thread — a `StreamProvider.family` keyed by
  /// [ConversationId] over [InboxTransport.watchThread]. Referentially stable
  /// (the transport dedups by [Message.id]) so the reversed list does not thrash.
  ///
  /// Copied from [conversationThread].
  ConversationThreadProvider call(ConversationId conversationId) {
    return ConversationThreadProvider(conversationId);
  }

  @override
  ConversationThreadProvider getProviderOverride(
    covariant ConversationThreadProvider provider,
  ) {
    return call(provider.conversationId);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'conversationThreadProvider';
}

/// **LIVE.** The tail of one thread — a `StreamProvider.family` keyed by
/// [ConversationId] over [InboxTransport.watchThread]. Referentially stable
/// (the transport dedups by [Message.id]) so the reversed list does not thrash.
///
/// Copied from [conversationThread].
class ConversationThreadProvider
    extends AutoDisposeStreamProvider<TransportSnapshot<List<Message>>> {
  /// **LIVE.** The tail of one thread — a `StreamProvider.family` keyed by
  /// [ConversationId] over [InboxTransport.watchThread]. Referentially stable
  /// (the transport dedups by [Message.id]) so the reversed list does not thrash.
  ///
  /// Copied from [conversationThread].
  ConversationThreadProvider(ConversationId conversationId)
    : this._internal(
        (ref) =>
            conversationThread(ref as ConversationThreadRef, conversationId),
        from: conversationThreadProvider,
        name: r'conversationThreadProvider',
        debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
            ? null
            : _$conversationThreadHash,
        dependencies: ConversationThreadFamily._dependencies,
        allTransitiveDependencies:
            ConversationThreadFamily._allTransitiveDependencies,
        conversationId: conversationId,
      );

  ConversationThreadProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.conversationId,
  }) : super.internal();

  final ConversationId conversationId;

  @override
  Override overrideWith(
    Stream<TransportSnapshot<List<Message>>> Function(
      ConversationThreadRef provider,
    )
    create,
  ) {
    return ProviderOverride(
      origin: this,
      override: ConversationThreadProvider._internal(
        (ref) => create(ref as ConversationThreadRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        conversationId: conversationId,
      ),
    );
  }

  @override
  AutoDisposeStreamProviderElement<TransportSnapshot<List<Message>>>
  createElement() {
    return _ConversationThreadProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is ConversationThreadProvider &&
        other.conversationId == conversationId;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, conversationId.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin ConversationThreadRef
    on AutoDisposeStreamProviderRef<TransportSnapshot<List<Message>>> {
  /// The parameter `conversationId` of this provider.
  ConversationId get conversationId;
}

class _ConversationThreadProviderElement
    extends AutoDisposeStreamProviderElement<TransportSnapshot<List<Message>>>
    with ConversationThreadRef {
  _ConversationThreadProviderElement(super.provider);

  @override
  ConversationId get conversationId =>
      (origin as ConversationThreadProvider).conversationId;
}

String _$unreadConversationsHash() =>
    r'c408da9f44a79e31ff0abc6b7f933148692b397c';

/// **LIVE.** The app-shell / entry-point unread badge — a `StreamProvider` over
/// [InboxTransport.watchUnreadConversations] (`sum(unreadCount[me])`).
///
/// Copied from [unreadConversations].
@ProviderFor(unreadConversations)
final unreadConversationsProvider =
    AutoDisposeStreamProvider<TransportSnapshot<int>>.internal(
      unreadConversations,
      name: r'unreadConversationsProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$unreadConversationsHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef UnreadConversationsRef =
    AutoDisposeStreamProviderRef<TransportSnapshot<int>>;
String _$currentInboxUserIdHash() =>
    r'fdc7d14846bd531748ef4919b5549620351cebd3';

/// The current user's uid, used to interpret a [Conversation] (which participant
/// is "the other", `unreadCount[me]`) and a [Message] (mine vs theirs).
///
/// **LIVE (T1-U4).** Watches [authControllerProvider] — the same source of
/// truth the router and [inboxTransportProvider] already agree on — and
/// resolves to `FirebaseAuth.instance.currentUser?.uid` for a real signed-in
/// teacher, `null` otherwise. A `null` uid is itself treated as "signed out"
/// by the screens (defensive — a `ready` snapshot can never be interpreted
/// without an identity), which also covers the on-device deferred case: while
/// Firebase isn't wired the transport only ever emits `awaitingFirebase`, so
/// this uid is irrelevant to what renders either way.
///
/// It is a deliberately thin, overridable seam — widget tests override it
/// with a fixed uid to exercise the rows, the other-participant label, the
/// unread badge and mine-vs-theirs bubbles without touching real auth.
///
/// Copied from [currentInboxUserId].
@ProviderFor(currentInboxUserId)
final currentInboxUserIdProvider = AutoDisposeProvider<String?>.internal(
  currentInboxUserId,
  name: r'currentInboxUserIdProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$currentInboxUserIdHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef CurrentInboxUserIdRef = AutoDisposeProviderRef<String?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
