import 'package:flutter/foundation.dart';

/// The STT result from `POST /api/ai/voice-to-text`: the recognised [text] and
/// the [language] (a **normalised 2-letter** code — the route canonicalises
/// e.g. Sarvam's `od` → `or` at the output boundary). [language] is a
/// best-guess and can be wrong for Indic scripts; the controller (U-V3) lets
/// the explicit UI language win when calling VIDYA.
@immutable
class Transcript {
  const Transcript({required this.text, required this.language});

  final String text;
  final String language;

  /// The web's silence / mis-tap guard: a transcript under 2 characters is not
  /// worth a VIDYA round-trip.
  bool get isUsable => text.trim().length >= 2;

  static Transcript fromJson(Map<String, dynamic> json) => Transcript(
        text: (json['text'] as String?)?.trim() ?? '',
        language: (json['language'] as String?)?.trim() ?? '',
      );

  @override
  bool operator ==(Object other) =>
      other is Transcript && other.text == text && other.language == language;

  @override
  int get hashCode => Object.hash(text, language);
}
