import 'package:json_annotation/json_annotation.dart';

import '../../../inbox/data/dto/wire_time.dart';
import '../../domain/chat_message.dart';
import 'dto_helpers.dart';

part 'chat_message_dto.g.dart';

/// Decodes a `community_chat/{id}` OR `groups/{groupId}/chat/{id}` document —
/// both share the shape `{ text, authorId, authorName, authorPhotoURL, audioUrl?,
/// createdAt, isDemoPersona? }` (SPEC §A2, `src/types/community.ts::GroupChatMessage`).
///
/// **Real cloud_firestore impl contract:** for the live room
/// `onSnapshot(orderBy createdAt asc, limitToLast(100))`, build the decode input
/// as `{ 'id': doc.id, ...doc.data() }`. For a group room pass [groupId] so the
/// domain message carries its owning group.
@JsonSerializable(createToJson: false)
class ChatMessageDto {
  const ChatMessageDto({
    this.id,
    this.text,
    this.authorId,
    this.authorName,
    this.authorPhotoURL,
    this.audioUrl,
    this.isDemoPersona,
    this.createdAt,
  });

  factory ChatMessageDto.fromJson(Map<String, dynamic> json) =>
      _$ChatMessageDtoFromJson(json);

  final String? id;
  final String? text;
  final String? authorId;
  final String? authorName;
  final String? authorPhotoURL;
  final String? audioUrl;
  final dynamic isDemoPersona;
  final dynamic createdAt;

  ChatMessage toDomain({String? groupId}) => ChatMessage(
        id: id?.trim() ?? '',
        text: text?.trim() ?? '',
        authorId: authorId?.trim() ?? '',
        authorName: authorName?.trim() ?? '',
        authorPhotoURL: cleanString(authorPhotoURL),
        audioUrl: cleanString(audioUrl),
        isDemoPersona: _asBool(isDemoPersona),
        createdAt: wireTimeToIso(createdAt),
        groupId: cleanString(groupId),
      );

  static bool _asBool(dynamic v) => switch (v) {
        final bool b => b,
        final num n => n != 0,
        'true' => true,
        _ => false,
      };
}

/// Serialises the community/group chat send wrapper body.
///
/// - Global Staff Room (`sendChatMessageAction`): send `{ text, audioUrl? }`.
/// - Group chat (`sendGroupChatMessageAction`): send `{ groupId, text, audioUrl? }`.
///
/// Author is server-derived (rules enforce `authorId == auth.uid`). `text` is
/// capped at 500 chars client-side (mirrored server-side); an empty text is only
/// valid alongside an [audioUrl].
@JsonSerializable(includeIfNull: false, createFactory: false)
class SendChatMessageRequestDto {
  const SendChatMessageRequestDto({
    required this.text,
    this.groupId,
    this.audioUrl,
  });

  factory SendChatMessageRequestDto.build({
    required String text,
    String? groupId,
    String? audioUrl,
  }) {
    return SendChatMessageRequestDto(
      text: text.trim(),
      groupId: cleanString(groupId),
      audioUrl: cleanString(audioUrl),
    );
  }

  final String text;

  /// Present only for a group-chat send.
  final String? groupId;
  final String? audioUrl;

  Map<String, dynamic> toJson() => _$SendChatMessageRequestDtoToJson(this);
}

/// Decodes the group-chat send reply `{ messageId }` (the global-room send
/// returns void). Tolerates an absent id (the void case).
@JsonSerializable(createToJson: false)
class SendChatMessageResponseDto {
  const SendChatMessageResponseDto({this.messageId});

  factory SendChatMessageResponseDto.fromJson(Map<String, dynamic> json) =>
      _$SendChatMessageResponseDtoFromJson(json);

  final String? messageId;

  String get id => messageId?.trim() ?? '';
}
