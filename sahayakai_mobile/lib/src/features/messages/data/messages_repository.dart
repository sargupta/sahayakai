import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/message_models.dart';

/// Provides a singleton [MessagesRepository] via Riverpod.
final messagesRepositoryProvider = Provider((ref) {
  return MessagesRepository(ref.read(apiClientProvider));
});

/// Data-layer gateway for the Direct Messaging feature.
///
/// All methods throw on non-2xx responses; the [ApiClient] interceptor chain
/// maps network / auth errors into typed `AppException`s automatically.
class MessagesRepository {
  final ApiClient _apiClient;

  MessagesRepository(this._apiClient);

  // -------------------------------------------------------------------------
  // Conversations
  // -------------------------------------------------------------------------

  /// GET /messages/conversations
  ///
  /// Returns all conversations the current user participates in, ordered by
  /// most-recent activity.
  Future<List<Conversation>> getConversations() async {
    final response = await _apiClient.client.get(
      '/messages/conversations',
    );
    final data = response.data as List<dynamic>;
    return data
        .map((e) => Conversation.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// POST /messages/conversations
  ///
  /// Creates a new conversation with the given [participantIds].
  /// Returns the newly created (or existing) [Conversation].
  Future<Conversation> createConversation(List<String> participantIds) async {
    final response = await _apiClient.client.post(
      '/messages/conversations',
      data: {'participantIds': participantIds},
    );
    return Conversation.fromJson(response.data as Map<String, dynamic>);
  }

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  /// GET /messages/conversations/{conversationId}/messages
  ///
  /// Fetches the most recent [limit] messages for the given conversation.
  Future<List<DirectMessage>> getMessages(
    String conversationId, {
    int limit = 50,
  }) async {
    final response = await _apiClient.client.get(
      '/messages/conversations/$conversationId/messages',
      queryParameters: {'limit': limit},
    );
    final data = response.data as List<dynamic>;
    return data
        .map((e) => DirectMessage.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// POST /messages/conversations/{conversationId}/messages
  ///
  /// Sends a new message in the given conversation. Returns the persisted
  /// [DirectMessage] with server-assigned `id` and `createdAt`.
  Future<DirectMessage> sendMessage(
    String conversationId,
    String text, {
    MessageType type = MessageType.text,
    SharedResource? resource,
  }) async {
    final body = <String, dynamic>{
      'text': text,
      'type': type.name,
      if (resource != null) 'resource': resource.toJson(),
    };

    final response = await _apiClient.client.post(
      '/messages/conversations/$conversationId/messages',
      data: body,
    );
    return DirectMessage.fromJson(response.data as Map<String, dynamic>);
  }

  // -------------------------------------------------------------------------
  // Read receipts & badges
  // -------------------------------------------------------------------------

  /// POST /messages/conversations/{conversationId}/read
  ///
  /// Marks all messages in the conversation as read for the current user.
  Future<void> markAsRead(String conversationId) async {
    await _apiClient.client.post(
      '/messages/conversations/$conversationId/read',
    );
  }

  /// GET /messages/unread-count
  ///
  /// Returns the total number of unread messages across all conversations.
  Future<int> getUnreadCount() async {
    final response = await _apiClient.client.get(
      '/messages/unread-count',
    );
    return (response.data as Map<String, dynamic>)['count'] as int;
  }
}
