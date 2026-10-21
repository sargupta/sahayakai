import 'package:flutter/foundation.dart';

/// Immutable input the teacher assembles on the form. `userId` is injected by
/// the server from the verified Firebase token (see the endpoint's
/// `VisualAidInputSchema`, which parses `{...json, userId}`) and is deliberately
/// NOT modelled here — a client that sent its own would be both wrong and a
/// trust-boundary hole.
@immutable
class VisualAidRequest {
  const VisualAidRequest({
    required this.prompt,
    this.gradeLevel,
    this.subject,
    this.language,
  });

  /// What the drawing should show. Required by the endpoint; the flow's
  /// `VisualAidInputSchema` rejects anything over [kMaxVisualAidPromptLength]
  /// characters, so the form caps it first.
  final String prompt;

  final String? gradeLevel;
  final String? subject;

  /// Full English language name the endpoint expects (e.g. `Kannada`) for any
  /// text baked into the drawing, sourced from [AppLocale.aiName].
  final String? language;
}

/// The flow's own input cap (`VisualAidInputSchema`: `prompt` is
/// `z.string().max(1000)`). Enforced client-side so the teacher sees a counter
/// instead of a 400.
const int kMaxVisualAidPromptLength = 1000;

/// The fully-decoded `/api/ai/visual-aid` result.
///
/// The endpoint returns the drawing as an `imageDataUri` (a
/// `data:image/...;base64,...` string from the Gemini image model); the DTO
/// layer decodes it to [imageBytes] once, so the view renders through
/// `Image.memory` and never re-decodes on rebuild. [pedagogicalContext] and
/// [discussionSpark] are model prose; [subject] is the academic subject the
/// flow classified the drawing under (nullable on the wire).
@immutable
class VisualAid {
  const VisualAid({
    required this.imageBytes,
    required this.pedagogicalContext,
    required this.discussionSpark,
    this.subject,
  });

  /// The decoded PNG/JPEG bytes of the generated drawing. Empty when the server
  /// returned nothing usable (or an un-decodable payload), which the view reads
  /// as the "rephrase" empty state rather than a blank or crashing card.
  final Uint8List imageBytes;

  /// How a teacher should use this specific drawing to explain the topic.
  final String pedagogicalContext;

  /// A focus question to ask students while showing the visual aid.
  final String discussionSpark;

  final String? subject;

  /// False when the server returned no usable image, so the view shows the
  /// "rephrase" empty state rather than a broken image.
  bool get hasImage => imageBytes.isNotEmpty;
}
