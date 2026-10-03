import 'package:flutter/foundation.dart';

/// One thing VIDYA has produced and is holding, ready to hand off — a lesson, a
/// quiz, a rubric (v3 screen 07 "orb turns green when ready" → screen 08 the one
/// deliver tray). Registered while a result is on screen and cleared once it is
/// delivered or dismissed.
///
/// It is payload + seams, never a widget: the text to share / read / copy, the
/// optional save-to-library seam its result view already owns, and the labels
/// the tray shows. Equality is by [id] so the same on-screen result registers
/// exactly once and list operations stay stable across rebuilds.
@immutable
class Deliverable {
  const Deliverable({
    required this.id,
    required this.title,
    required this.text,
    this.subtitle,
    this.shareSubject,
    this.language,
    this.onSave,
  });

  /// Stable per produced-result instance (its result view mints one).
  final String id;

  /// What was made, for the tray header (e.g. the lesson/quiz title).
  final String title;

  /// The plain-text payload shared, copied or read aloud.
  final String text;

  /// A second line under the title, when the result view has one.
  final String? subtitle;

  /// Subject line for the OS share sheet, when the result view sets one.
  final String? shareSubject;

  /// The result's language (ISO-2 / region tag) for the read-aloud voice; the
  /// tray falls back to the UI locale when null.
  final String? language;

  /// The save-to-library seam the result view already owns; null when the
  /// result cannot be saved (the tray then disables "Save to class").
  final Future<String> Function()? onSave;

  @override
  bool operator ==(Object other) => other is Deliverable && other.id == id;

  @override
  int get hashCode => id.hashCode;
}
