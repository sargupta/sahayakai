// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'quiz_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$QuizRequestDtoToJson(
  QuizRequestDto instance,
) => <String, dynamic>{
  'topic': instance.topic,
  'questionTypes': instance.questionTypes,
  'numQuestions': instance.numQuestions,
  if (instance.gradeLevel case final value?) 'gradeLevel': value,
  if (instance.subject case final value?) 'subject': value,
  if (instance.language case final value?) 'language': value,
  if (instance.targetDifficulty case final value?) 'targetDifficulty': value,
  if (instance.bloomsTaxonomyLevels case final value?)
    'bloomsTaxonomyLevels': value,
};

QuizResponseDto _$QuizResponseDtoFromJson(Map<String, dynamic> json) =>
    QuizResponseDto(
      easy: json['easy'] == null
          ? null
          : QuizVariantDto.fromJson(json['easy'] as Map<String, dynamic>),
      medium: json['medium'] == null
          ? null
          : QuizVariantDto.fromJson(json['medium'] as Map<String, dynamic>),
      hard: json['hard'] == null
          ? null
          : QuizVariantDto.fromJson(json['hard'] as Map<String, dynamic>),
      id: json['id'] as String?,
      gradeLevel: json['gradeLevel'] as String?,
      subject: json['subject'] as String?,
      topic: json['topic'] as String?,
      isSaved: json['isSaved'] as bool?,
      validationWarning: json['validationWarning'] == null
          ? null
          : QuizValidationWarningDto.fromJson(
              json['validationWarning'] as Map<String, dynamic>,
            ),
    );

QuizVariantDto _$QuizVariantDtoFromJson(Map<String, dynamic> json) =>
    QuizVariantDto(
      title: json['title'] as String?,
      questions: (json['questions'] as List<dynamic>?)
          ?.map((e) => QuestionDto.fromJson(e as Map<String, dynamic>))
          .toList(),
      teacherInstructions: json['teacherInstructions'] as String?,
      gradeLevel: json['gradeLevel'] as String?,
      subject: json['subject'] as String?,
    );

QuestionDto _$QuestionDtoFromJson(Map<String, dynamic> json) => QuestionDto(
  questionText: json['questionText'] as String?,
  questionType: json['questionType'] as String?,
  options: (json['options'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  correctAnswer: json['correctAnswer'] as String?,
  explanation: json['explanation'] as String?,
  difficultyLevel: json['difficultyLevel'] as String?,
);

QuizValidationWarningDto _$QuizValidationWarningDtoFromJson(
  Map<String, dynamic> json,
) => QuizValidationWarningDto(
  invalid: json['invalid'] as bool?,
  lenient: json['lenient'] as bool?,
  message: json['message'] as String?,
);
