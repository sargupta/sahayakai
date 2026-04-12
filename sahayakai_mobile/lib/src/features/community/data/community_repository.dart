import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/community_models.dart';

/// Provides a singleton [CommunityRepository] via Riverpod.
final communityRepositoryProvider = Provider((ref) {
  return CommunityRepository(ref.read(apiClientProvider));
});

/// Provider that fetches feed posts as an async value.
final feedPostsProvider = FutureProvider.autoDispose<List<CommunityPost>>((ref) {
  return ref.watch(communityRepositoryProvider).getFeedPosts();
});

/// Provider that fetches community groups as an async value.
final groupsProvider = FutureProvider.autoDispose<List<CommunityGroup>>((ref) {
  return ref.watch(communityRepositoryProvider).getGroups();
});

/// Repository for all community-related API calls: feed, groups, chat,
/// library resources, and teacher connections.
class CommunityRepository {
  final ApiClient _apiClient;

  CommunityRepository(this._apiClient);

  // ---------------------------------------------------------------------------
  // Feed
  // ---------------------------------------------------------------------------

  /// GET /community/posts -- fetch community feed posts with optional filters.
  Future<List<CommunityPost>> getFeedPosts({
    String? language,
    int limit = 20,
    List<String>? gradeLevels,
  }) async {
    final response = await _apiClient.client.get(
      '/community/posts',
      queryParameters: {
        'limit': limit,
        if (language != null) 'language': language,
        if (gradeLevels != null && gradeLevels.isNotEmpty)
          'gradeLevels': gradeLevels.join(','),
      },
    );

    final list = response.data['posts'] as List<dynamic>? ?? [];
    return list
        .map((e) => CommunityPost.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// POST /community/posts -- create a new community post. Returns the post ID.
  Future<String> createPost({
    required String content,
    required String postType,
    String? groupId,
    List<String>? attachments,
  }) async {
    final response = await _apiClient.client.post(
      '/community/posts',
      data: {
        'content': content,
        'postType': postType,
        if (groupId != null) 'groupId': groupId,
        if (attachments != null && attachments.isNotEmpty)
          'attachments': attachments,
      },
    );

    return response.data['id'] as String? ?? '';
  }

  /// POST /community/posts/{id}/like -- toggle the like state on a post.
  Future<({bool isLiked, int newCount})> toggleLikePost(String postId) async {
    final response = await _apiClient.client.post(
      '/community/posts/$postId/like',
    );

    return (
      isLiked: response.data['isLiked'] as bool? ?? false,
      newCount: response.data['newCount'] as int? ?? 0,
    );
  }

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  /// GET /community/posts/{id}/comments -- fetch comments for a post.
  Future<List<CommunityComment>> getPostComments(String postId) async {
    final response = await _apiClient.client.get(
      '/community/posts/$postId/comments',
    );

    final list = response.data['comments'] as List<dynamic>? ?? [];
    return list
        .map((e) => CommunityComment.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// POST /community/posts/{id}/comments -- add a comment to a post.
  Future<CommunityComment> addComment(String postId, String content) async {
    final response = await _apiClient.client.post(
      '/community/posts/$postId/comments',
      data: {'content': content},
    );

    return CommunityComment.fromJson(
        response.data as Map<String, dynamic>);
  }

  // ---------------------------------------------------------------------------
  // Groups
  // ---------------------------------------------------------------------------

  /// GET /community/groups -- fetch all community groups.
  Future<List<CommunityGroup>> getGroups() async {
    final response = await _apiClient.client.get('/community/groups');

    final list = response.data['groups'] as List<dynamic>? ?? [];
    return list
        .map((e) => CommunityGroup.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// GET /community/groups/{id}/posts -- fetch posts within a group.
  Future<List<CommunityPost>> getGroupPosts(String groupId) async {
    final response = await _apiClient.client.get(
      '/community/groups/$groupId/posts',
    );

    final list = response.data['posts'] as List<dynamic>? ?? [];
    return list
        .map((e) => CommunityPost.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// GET /community/groups/{id}/chat -- fetch chat messages for a group.
  Future<List<ChatMessage>> getGroupChat(String groupId, {String? before}) async {
    final response = await _apiClient.client.get(
      '/community/groups/$groupId/chat',
      queryParameters: {
        if (before != null) 'before': before,
      },
    );

    final list = response.data['messages'] as List<dynamic>? ?? [];
    return list
        .map((e) => ChatMessage.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// POST /community/groups/{id}/chat -- send a chat message to a group.
  Future<ChatMessage> sendGroupChat(
    String groupId,
    String text, {
    String? audioUrl,
  }) async {
    final response = await _apiClient.client.post(
      '/community/groups/$groupId/chat',
      data: {
        'text': text,
        if (audioUrl != null) 'audioUrl': audioUrl,
      },
    );

    return ChatMessage.fromJson(response.data as Map<String, dynamic>);
  }

  // ---------------------------------------------------------------------------
  // Library / Resources
  // ---------------------------------------------------------------------------

  /// GET /community/library -- fetch shared community resources.
  Future<List<CommunityResource>> getLibraryResources({
    String? type,
    String? language,
    String? query,
  }) async {
    final response = await _apiClient.client.get(
      '/community/library',
      queryParameters: {
        if (type != null) 'type': type,
        if (language != null) 'language': language,
        if (query != null && query.isNotEmpty) 'query': query,
      },
    );

    final list = response.data['resources'] as List<dynamic>? ?? [];
    return list
        .map((e) => CommunityResource.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// POST /community/library/{id}/like -- toggle the like state on a resource.
  Future<({bool isLiked, int newCount})> toggleLikeResource(
    String resourceId,
  ) async {
    final response = await _apiClient.client.post(
      '/community/library/$resourceId/like',
    );

    return (
      isLiked: response.data['isLiked'] as bool? ?? false,
      newCount: response.data['newCount'] as int? ?? 0,
    );
  }

  /// POST /community/library/{id}/save -- save a resource to personal collection.
  Future<void> saveResource(String resourceId) async {
    await _apiClient.client.post(
      '/community/library/$resourceId/save',
    );
  }

  // ---------------------------------------------------------------------------
  // Teacher Connections
  // ---------------------------------------------------------------------------

  /// GET /community/teachers/recommended -- fetch recommended teachers.
  Future<List<Map<String, dynamic>>> getRecommendedTeachers() async {
    final response = await _apiClient.client.get(
      '/community/teachers/recommended',
    );

    final list = response.data['teachers'] as List<dynamic>? ?? [];
    return list.map((e) => e as Map<String, dynamic>).toList();
  }

  /// POST /connections/request -- send a connection request.
  Future<void> sendConnectionRequest(String toUid) async {
    await _apiClient.client.post(
      '/connections/request',
      data: {'toUid': toUid},
    );
  }

  /// POST /connections/accept -- accept a pending connection request.
  Future<void> acceptConnection(String requestId) async {
    await _apiClient.client.post(
      '/connections/accept',
      data: {'requestId': requestId},
    );
  }

  /// POST /connections/decline -- decline a pending connection request.
  Future<void> declineConnection(String requestId) async {
    await _apiClient.client.post(
      '/connections/decline',
      data: {'requestId': requestId},
    );
  }

  /// GET /connections -- fetch established connections.
  Future<List<TeacherConnection>> getConnections() async {
    final response = await _apiClient.client.get('/connections');

    final list = response.data['connections'] as List<dynamic>? ?? [];
    return list
        .map((e) => TeacherConnection.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// GET /connections/requests -- fetch pending connection requests.
  Future<List<ConnectionRequest>> getPendingRequests() async {
    final response = await _apiClient.client.get('/connections/requests');

    final list = response.data['requests'] as List<dynamic>? ?? [];
    return list
        .map((e) => ConnectionRequest.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Alias for [getPendingRequests] — used by connections screen.
  Future<List<ConnectionRequest>> getConnectionRequests() => getPendingRequests();

  /// GET /community/teachers/discover -- fetch teachers to discover / connect with.
  Future<List<TeacherConnection>> getDiscoverTeachers() async {
    final response = await _apiClient.client.get(
      '/community/teachers/recommended',
    );

    final list = response.data['teachers'] as List<dynamic>? ?? [];
    return list
        .map((e) => TeacherConnection.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// GET /community/library -- search library resources with additional filters.
  Future<List<CommunityResource>> searchLibrary({
    String? query,
    String? contentType,
    String? tab,
  }) async {
    final response = await _apiClient.client.get(
      '/community/library',
      queryParameters: {
        if (query != null && query.isNotEmpty) 'query': query,
        if (contentType != null) 'type': contentType,
        if (tab != null) 'tab': tab,
      },
    );

    final list = response.data['resources'] as List<dynamic>? ?? [];
    return list
        .map((e) => CommunityResource.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
