import 'dart:convert';
import 'dart:typed_data';

import 'package:json_annotation/json_annotation.dart';

import '../domain/visual_aid.dart';

part 'visual_aid_dtos.g.dart';

/// Serializes a [VisualAidRequest] into the exact `POST /api/ai/visual-aid`
/// body. `includeIfNull: false` drops the optional fields the teacher left
/// blank so the server applies its own defaults (the flow back-fills
/// language/grade from the profile).
///
/// `userId` is injected server-side from the verified token and is never sent
/// from the client.
@JsonSerializable(includeIfNull: false, createFactory: false)
class VisualAidRequestDto {
  const VisualAidRequestDto({
    required this.prompt,
    this.gradeLevel,
    this.subject,
    this.language,
  });

  factory VisualAidRequestDto.fromDomain(VisualAidRequest request) {
    return VisualAidRequestDto(
      prompt: request.prompt.trim(),
      gradeLevel: _clean(request.gradeLevel),
      subject: _clean(request.subject),
      language: _clean(request.language),
    );
  }

  final String prompt;
  final String? gradeLevel;
  final String? subject;
  final String? language;

  Map<String, dynamic> toJson() => _$VisualAidRequestDtoToJson(this);
}

/// The `/api/ai/visual-aid` 200 payload. The route responds with exactly these
/// four keys (`imageDataUri`, `pedagogicalContext`, `discussionSpark`,
/// `subject`); every one is nullable on decode because the drawing and its
/// captions are model-generated, so [toDomain] normalizes.
@JsonSerializable(createToJson: false)
class VisualAidResponseDto {
  const VisualAidResponseDto({
    this.imageDataUri,
    this.pedagogicalContext,
    this.discussionSpark,
    this.subject,
  });

  factory VisualAidResponseDto.fromJson(Map<String, dynamic> json) =>
      _$VisualAidResponseDtoFromJson(json);

  /// The generated drawing as a `data:image/...;base64,...` URI (the Gemini
  /// image model's output). Decoded to bytes in [toDomain].
  final String? imageDataUri;
  final String? pedagogicalContext;
  final String? discussionSpark;
  final String? subject;

  VisualAid toDomain() => VisualAid(
        imageBytes: _decodeImageDataUri(imageDataUri),
        pedagogicalContext: _clean(pedagogicalContext) ?? '',
        discussionSpark: _clean(discussionSpark) ?? '',
        subject: _clean(subject),
      );
}

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

/// Decodes the endpoint's `imageDataUri` into raw image bytes.
///
/// The field is `z.string()` on the flow's output schema and comes back as a
/// `data:image/<png|jpeg>;base64,<data>` URI from the image model. This tolerates
/// the `data:` prefix and embedded whitespace and normalizes base64 padding, so
/// a slightly-off reply still renders. Returns **empty** bytes for empty, null,
/// or un-decodable input rather than throwing — a malformed drawing degrades to
/// the "rephrase" empty state, never a crash. Mirrors `decodeBase64Mp3`.
Uint8List _decodeImageDataUri(String? dataUri) {
  var data = dataUri?.trim() ?? '';
  if (data.isEmpty) return Uint8List(0);
  final comma = data.indexOf(',');
  if (data.startsWith('data:') && comma != -1) {
    data = data.substring(comma + 1);
  }
  data = data.replaceAll(RegExp(r'\s'), '');
  if (data.isEmpty) return Uint8List(0);
  try {
    return base64Decode(base64.normalize(data));
  } catch (_) {
    return Uint8List(0);
  }
}
