import 'package:json_annotation/json_annotation.dart';

import '../../domain/persona_pulse.dart';
import 'dto_helpers.dart';

part 'persona_pulse_dto.g.dart';

/// Serialises the `POST /api/community/persona-pulse` body
/// (`{ recentMessages?, personaId?, mode? }`). This is the **only real,
/// already-deployed** Block-C REST route — reachable via the existing Dio
/// `ApiClient` today.
@JsonSerializable(includeIfNull: false, createFactory: false)
class PersonaPulseRequestDto {
  const PersonaPulseRequestDto({
    this.recentMessages,
    this.personaId,
    this.mode,
  });

  factory PersonaPulseRequestDto.fromDomain(PersonaPulseRequest req) {
    return PersonaPulseRequestDto(
      recentMessages: req.recentMessages.isEmpty
          ? null
          : req.recentMessages
              .map((c) => <String, dynamic>{
                    'authorName': c.authorName,
                    'text': c.text,
                  })
              .toList(growable: false),
      personaId: cleanString(req.personaId),
      mode: cleanString(req.mode),
    );
  }

  final List<Map<String, dynamic>>? recentMessages;
  final String? personaId;
  final String? mode;

  Map<String, dynamic> toJson() => _$PersonaPulseRequestDtoToJson(this);
}

/// Decodes the persona-pulse 200 reply
/// (`{ message, personaName, personaState, personaSubject }`). A **503**
/// (flag off) is handled by the transport as a stop signal (null), NOT decoded
/// here.
@JsonSerializable(createToJson: false)
class PersonaPulseResponseDto {
  const PersonaPulseResponseDto({
    this.message,
    this.personaName,
    this.personaState,
    this.personaSubject,
  });

  factory PersonaPulseResponseDto.fromJson(Map<String, dynamic> json) =>
      _$PersonaPulseResponseDtoFromJson(json);

  final String? message;
  final String? personaName;
  final String? personaState;
  final String? personaSubject;

  PersonaPulse toDomain() => PersonaPulse(
        message: message?.trim() ?? '',
        personaName: cleanString(personaName),
        personaState: cleanString(personaState),
        personaSubject: cleanString(personaSubject),
      );
}
