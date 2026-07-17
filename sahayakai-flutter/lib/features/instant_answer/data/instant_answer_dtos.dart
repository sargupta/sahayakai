import 'package:json_annotation/json_annotation.dart';

import '../domain/instant_answer.dart';

part 'instant_answer_dtos.g.dart';

/// Serializes an [InstantAnswerRequest] into the exact
/// `POST /api/ai/instant-answer` body. `includeIfNull: false` drops the
/// optional fields the teacher left blank so the server applies its own
/// defaults (the flow back-fills language/grade from the profile).
///
/// `userId` is injected server-side from the verified token and is never sent
/// from the client.
@JsonSerializable(includeIfNull: false, createFactory: false)
class InstantAnswerRequestDto {
  const InstantAnswerRequestDto({
    required this.question,
    this.gradeLevel,
    this.subject,
    this.language,
  });

  factory InstantAnswerRequestDto.fromDomain(InstantAnswerRequest request) {
    return InstantAnswerRequestDto(
      question: request.question.trim(),
      gradeLevel: _clean(request.gradeLevel),
      subject: _clean(request.subject),
      language: _clean(request.language),
    );
  }

  final String question;
  final String? gradeLevel;
  final String? subject;
  final String? language;

  Map<String, dynamic> toJson() => _$InstantAnswerRequestDtoToJson(this);
}

/// The `/api/ai/instant-answer` 200 payload. The route strips its dispatcher
/// metadata and responds with exactly these four keys; every one is nullable
/// because the answer is model-generated, so [toDomain] normalizes.
@JsonSerializable(createToJson: false)
class InstantAnswerResponseDto {
  const InstantAnswerResponseDto({
    this.answer,
    this.videoSuggestionUrl,
    this.gradeLevel,
    this.subject,
  });

  factory InstantAnswerResponseDto.fromJson(Map<String, dynamic> json) =>
      _$InstantAnswerResponseDtoFromJson(json);

  final String? answer;
  final String? videoSuggestionUrl;
  final String? gradeLevel;
  final String? subject;

  InstantAnswer toDomain() => InstantAnswer(
        answer: _clean(answer) ?? '',
        videoSuggestionUrl: _safeExternalUri(videoSuggestionUrl),
        gradeLevel: _clean(gradeLevel),
        subject: _clean(subject),
      );
}

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

/// Validates a model-authored URL before it can ever reach an external
/// launcher. The suggestion comes out of an LLM, so it is untrusted input on a
/// path that hands a URL to the OS: anything that is not an absolute http(s)
/// URL with a host (`javascript:`, `file:`, `intent:`, a bare fragment, junk)
/// is dropped, and the card simply does not render. Null in, null out.
Uri? _safeExternalUri(String? value) {
  final raw = _clean(value);
  if (raw == null) return null;
  final uri = Uri.tryParse(raw);
  if (uri == null || !uri.isAbsolute || uri.host.isEmpty) return null;
  if (uri.scheme != 'http' && uri.scheme != 'https') return null;
  return uri;
}
