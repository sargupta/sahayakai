// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'outreach_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$CreateOutreachRequestDtoToJson(
  CreateOutreachRequestDto instance,
) => <String, dynamic>{
  'classId': instance.classId,
  'className': instance.className,
  'studentId': instance.studentId,
  'studentName': instance.studentName,
  'parentLanguage': instance.parentLanguage,
  'reason': instance.reason,
  'generatedMessage': instance.generatedMessage,
  'deliveryMethod': instance.deliveryMethod,
  if (instance.teacherNote case final value?) 'teacherNote': value,
  if (instance.subject case final value?) 'subject': value,
  if (instance.performanceContext case final value?)
    'performanceContext': value,
};

CreateOutreachResponseDto _$CreateOutreachResponseDtoFromJson(
  Map<String, dynamic> json,
) => CreateOutreachResponseDto(outreachId: json['outreachId'] as String?);

Map<String, dynamic> _$PlaceCallRequestDtoToJson(
  PlaceCallRequestDto instance,
) => <String, dynamic>{
  'outreachId': instance.outreachId,
  'parentLanguage': instance.parentLanguage,
};

PlaceCallResponseDto _$PlaceCallResponseDtoFromJson(
  Map<String, dynamic> json,
) => PlaceCallResponseDto(callSid: json['callSid'] as String?);

TranscriptTurnDto _$TranscriptTurnDtoFromJson(Map<String, dynamic> json) =>
    TranscriptTurnDto(
      role: json['role'] as String?,
      text: json['text'] as String?,
      timestamp: json['timestamp'] as String?,
    );

CallSummaryDto _$CallSummaryDtoFromJson(Map<String, dynamic> json) =>
    CallSummaryDto(
      parentResponse: json['parentResponse'] as String?,
      parentConcerns: json['parentConcerns'] as List<dynamic>?,
      parentCommitments: json['parentCommitments'] as List<dynamic>?,
      actionItemsForTeacher: json['actionItemsForTeacher'] as List<dynamic>?,
      guidanceGiven: json['guidanceGiven'] as List<dynamic>?,
      parentSentiment: json['parentSentiment'] as String?,
      callQuality: json['callQuality'] as String?,
      followUpNeeded: json['followUpNeeded'] as bool?,
      followUpSuggestion: json['followUpSuggestion'] as String?,
      generatedAt: json['generatedAt'] as String?,
    );

CallResultDto _$CallResultDtoFromJson(Map<String, dynamic> json) =>
    CallResultDto(
      callStatus: json['callStatus'] as String?,
      callDurationSeconds: json['callDurationSeconds'] as num?,
      answeredBy: json['answeredBy'] as String?,
      turnCount: json['turnCount'] as num?,
      transcript: (json['transcript'] as List<dynamic>?)
          ?.map((e) => TranscriptTurnDto.fromJson(e as Map<String, dynamic>))
          .toList(),
      callSummary: json['callSummary'] == null
          ? null
          : CallSummaryDto.fromJson(
              json['callSummary'] as Map<String, dynamic>,
            ),
    );

LatestOutreachDto _$LatestOutreachDtoFromJson(Map<String, dynamic> json) =>
    LatestOutreachDto(
      outreachId: json['outreachId'] as String?,
      callStatus: json['callStatus'] as String?,
      callDurationSeconds: json['callDurationSeconds'] as num?,
      answeredBy: json['answeredBy'] as String?,
      turnCount: json['turnCount'] as num?,
      transcript: (json['transcript'] as List<dynamic>?)
          ?.map((e) => TranscriptTurnDto.fromJson(e as Map<String, dynamic>))
          .toList(),
      callSummary: json['callSummary'] == null
          ? null
          : CallSummaryDto.fromJson(
              json['callSummary'] as Map<String, dynamic>,
            ),
    );
