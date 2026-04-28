// ============================================================================
// FEATURE CONTRACT (per Quality DNA rule 2: contract before code)
// ----------------------------------------------------------------------------
// What: Single wrapper around the Firebase AI Logic Dart SDK. Owns the
//       GenerativeModel handles for the three Phase T agents (instant-answer,
//       VIDYA classifier, voice-to-text).
// Why:  When the SDK ships `useHybridInference: true`, Gemini Nano can answer
//       on-device while offline and the cloud answers when online. Centralising
//       the toggle here means screens never accidentally pin to cloud-only.
// Inputs:  caller-provided prompt string and optional audio bytes.
// Outputs: model-generated text. Errors bubble up; callers display them.
// Failure: if the hybrid path errors (e.g. Nano weights missing) the SDK
//          itself falls back to cloud — we do NOT swallow exceptions
//          because parity tests in Phase T.2 must see real failures.
// Cost:    on-device inference is free; cloud calls are billed via the
//          usual GenerativeModel quota. NO Google Search grounding.
//
// SDK STATUS (2026-04, Phase T.1):
//   firebase_ai 2.3.0 does NOT yet expose `useHybridInference` on
//   `FirebaseAI.googleAI().generativeModel(...)`. Issue tracker:
//   https://github.com/firebase/flutterfire — feature is pending.
//   When it ships, set `_hybridInferenceAvailable = true` and uncomment
//   the named arg in `_buildModel`. Until then we instantiate cloud-only;
//   Phase T.2 parity tests will sanity-check the wiring once available.
// ============================================================================

import 'dart:typed_data';

import 'package:firebase_ai/firebase_ai.dart';

/// Lightweight singleton-style accessor for the three Phase T models.
///
/// Each agent gets its own `GenerativeModel` so we can tune temperature
/// and system instructions per task without cross-contamination.
class SahayakAI {
  SahayakAI._();
  static final SahayakAI instance = SahayakAI._();

  /// Flip to true once `firebase_ai` ships hybrid inference. See file header.
  static const bool _hybridInferenceAvailable = false;

  GenerativeModel _buildModel({
    required String modelId,
    required GenerationConfig config,
    required Content systemInstruction,
  }) {
    // ignore: dead_code
    if (_hybridInferenceAvailable) {
      // Once the SDK exposes the flag, swap to:
      //   return FirebaseAI.googleAI().generativeModel(
      //     model: modelId,
      //     useHybridInference: true,
      //     generationConfig: config,
      //     systemInstruction: systemInstruction,
      //   );
    }
    return FirebaseAI.googleAI().generativeModel(
      model: modelId,
      generationConfig: config,
      systemInstruction: systemInstruction,
    );
  }

  /// Instant-answer model.
  ///
  /// Hybrid: cached fact lookups stay on-device; anything that requires
  /// fresh facts will route to cloud once connectivity is detected.
  late final GenerativeModel instantAnswer = _buildModel(
    modelId: 'gemini-2.5-flash',
    config: GenerationConfig(
      temperature: 0.2,
      maxOutputTokens: 512,
    ),
    systemInstruction: Content.system(
      'You are an instant-answer agent for Indian K-12 teachers. '
      'Reply in two sentences max, in the language of the question. '
      'Never invent statistics — say "I am not sure" instead.',
    ),
  );

  /// VIDYA 11-way intent classifier.
  ///
  /// Hybrid: Nano handles the classifier comfortably, so most calls will
  /// stay on-device once the SDK exposes the toggle.
  late final GenerativeModel vidyaClassifier = _buildModel(
    modelId: 'gemini-2.5-flash',
    config: GenerationConfig(
      temperature: 0.0,
      responseMimeType: 'application/json',
      maxOutputTokens: 64,
    ),
    systemInstruction: Content.system(
      'Classify the teacher utterance into exactly one of these intents and '
      'return JSON {"intent":"<value>"}: '
      'lesson_plan, quiz, worksheet, instant_answer, visual_aid, avatar, '
      'voice_message, exam_paper, teacher_training, classroom_assistant, '
      'small_talk.',
    ),
  );

  /// Voice-to-text model.
  ///
  /// Hybrid: short utterances (< 10 s) will run on-device once the SDK
  /// flag lands. Longer audio always routes to cloud.
  late final GenerativeModel voiceToText = _buildModel(
    modelId: 'gemini-2.5-flash',
    config: GenerationConfig(
      temperature: 0.0,
      maxOutputTokens: 256,
    ),
    systemInstruction: Content.system(
      'Transcribe the audio verbatim. Preserve the original language. '
      'Do not translate, summarise, or add punctuation that is not spoken.',
    ),
  );

  /// Convenience helper: send a plain text prompt.
  Future<String> ask(GenerativeModel model, String prompt) async {
    final response = await model.generateContent([Content.text(prompt)]);
    return response.text ?? '';
  }

  /// Convenience helper: send audio bytes for transcription.
  Future<String> transcribe(
    List<int> audioBytes, {
    String mimeType = 'audio/mp4',
  }) async {
    final response = await voiceToText.generateContent([
      Content.multi([
        TextPart('Transcribe this audio.'),
        InlineDataPart(mimeType, Uint8List.fromList(audioBytes)),
      ]),
    ]);
    return response.text ?? '';
  }
}
