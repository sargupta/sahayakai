// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'persona_pulse_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$PersonaPulseRequestDtoToJson(
  PersonaPulseRequestDto instance,
) => <String, dynamic>{
  if (instance.recentMessages case final value?) 'recentMessages': value,
  if (instance.personaId case final value?) 'personaId': value,
  if (instance.mode case final value?) 'mode': value,
};

PersonaPulseResponseDto _$PersonaPulseResponseDtoFromJson(
  Map<String, dynamic> json,
) => PersonaPulseResponseDto(
  message: json['message'] as String?,
  personaName: json['personaName'] as String?,
  personaState: json['personaState'] as String?,
  personaSubject: json['personaSubject'] as String?,
);
