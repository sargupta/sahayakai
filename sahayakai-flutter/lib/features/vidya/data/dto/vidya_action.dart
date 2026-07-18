import 'package:flutter/foundation.dart';
import 'package:json_annotation/json_annotation.dart';

part 'vidya_action.g.dart';

/// The closed set of tools VIDYA can navigate to (SPEC §A.3). The model
/// authors a `flow` string; a **hallucinated** value would route to a 404, so
/// [fromWire] returns null for anything outside this set and the caller drops
/// the directive — the exact `KNOWN_FLOWS` guard the web applies.
///
/// The [wire] id equals the web flow id; U-V6 maps each to a `Routes` const.
enum VidyaFlow {
  lessonPlan('lesson-plan'),
  quizGenerator('quiz-generator'),
  visualAidDesigner('visual-aid-designer'),
  worksheetWizard('worksheet-wizard'),
  virtualFieldTrip('virtual-field-trip'),
  teacherTraining('teacher-training'),
  rubricGenerator('rubric-generator'),
  examPaper('exam-paper'),
  videoStoryteller('video-storyteller'),
  instantAnswer('instant-answer');

  const VidyaFlow(this.wire);

  final String wire;

  static VidyaFlow? fromWire(String? wire) {
    if (wire == null) return null;
    for (final f in VidyaFlow.values) {
      if (f.wire == wire) return f;
    }
    return null;
  }
}

/// The NCERT chapter a directive is anchored to, when the classifier resolved
/// one. Feeds the destination tool's chapter picker.
@immutable
class NcertChapter {
  const NcertChapter({
    required this.number,
    required this.title,
    this.learningOutcomes = const [],
  });

  final int number;
  final String title;
  final List<String> learningOutcomes;

  @override
  bool operator ==(Object other) =>
      other is NcertChapter &&
      other.number == number &&
      other.title == title &&
      listEquals(other.learningOutcomes, learningOutcomes);

  @override
  int get hashCode => Object.hash(number, title, Object.hashAll(learningOutcomes));
}

/// The prefill payload a [VidyaDirective] carries into a tool form. Every field
/// is optional — the classifier fills what the teacher's sentence implied.
@immutable
class VidyaDirectiveParams {
  const VidyaDirectiveParams({
    this.topic,
    this.gradeLevel,
    this.subject,
    this.language,
    this.ncertChapter,
    this.dependsOn = const [],
    this.clarifyingPrompt,
    this.validationWarning,
  });

  final String? topic;
  final String? gradeLevel;
  final String? subject;

  /// The prefill language as it came from the classifier. U-V6 normalises this
  /// to an ISO-2 code before it hits the tool's language picker.
  final String? language;
  final NcertChapter? ncertChapter;

  /// Index pointers into earlier directives in a compound plan (max 2).
  final List<int> dependsOn;

  /// A single follow-up VIDYA speaks back when the utterance was too sparse to
  /// fully populate the action, instead of silently inheriting a prior turn.
  final String? clarifyingPrompt;

  /// A soft warning (e.g. grade/chapter mismatch) surfaced on the confirm chip;
  /// never blocks navigation.
  final String? validationWarning;

  @override
  bool operator ==(Object other) =>
      other is VidyaDirectiveParams &&
      other.topic == topic &&
      other.gradeLevel == gradeLevel &&
      other.subject == subject &&
      other.language == language &&
      other.ncertChapter == ncertChapter &&
      listEquals(other.dependsOn, dependsOn) &&
      other.clarifyingPrompt == clarifyingPrompt &&
      other.validationWarning == validationWarning;

  @override
  int get hashCode => Object.hash(topic, gradeLevel, subject, language,
      ncertChapter, Object.hashAll(dependsOn), clarifyingPrompt, validationWarning);
}

/// A guarded navigate-and-prefill instruction: open [flow]'s tool with [params]
/// pre-filled. THIS is the typed domain object U-V6 threads voice into tools
/// with — a `VidyaTurn` only ever exposes directives whose flow survived the
/// [VidyaFlow] guard.
@immutable
class VidyaDirective {
  const VidyaDirective({required this.flow, required this.params});

  final VidyaFlow flow;
  final VidyaDirectiveParams params;

  @override
  bool operator ==(Object other) =>
      other is VidyaDirective && other.flow == flow && other.params == params;

  @override
  int get hashCode => Object.hash(flow, params);
}

// ─── Wire DTOs ───────────────────────────────────────────────────────────────

@JsonSerializable(createToJson: false)
class NcertChapterDto {
  const NcertChapterDto({this.number, this.title, this.learningOutcomes});

  factory NcertChapterDto.fromJson(Map<String, dynamic> json) =>
      _$NcertChapterDtoFromJson(json);

  final int? number;
  final String? title;
  final List<String>? learningOutcomes;

  NcertChapter? toDomain() {
    final t = title?.trim();
    if (number == null || t == null || t.isEmpty) return null;
    return NcertChapter(
      number: number!,
      title: t,
      learningOutcomes: (learningOutcomes ?? const <String>[])
          .map((e) => e.trim())
          .where((e) => e.isNotEmpty)
          .toList(growable: false),
    );
  }
}

@JsonSerializable(createToJson: false)
class VidyaActionParamsDto {
  const VidyaActionParamsDto({
    this.topic,
    this.gradeLevel,
    this.subject,
    this.language,
    this.ncertChapter,
    this.dependsOn,
    this.clarifyingPrompt,
    this.validationWarning,
  });

  factory VidyaActionParamsDto.fromJson(Map<String, dynamic> json) =>
      _$VidyaActionParamsDtoFromJson(json);

  final String? topic;
  final String? gradeLevel;
  final String? subject;
  final String? language;
  final NcertChapterDto? ncertChapter;
  final List<int>? dependsOn;
  final String? clarifyingPrompt;
  final String? validationWarning;

  VidyaDirectiveParams toDomain() => VidyaDirectiveParams(
        topic: _clean(topic),
        gradeLevel: _clean(gradeLevel),
        subject: _clean(subject),
        language: _clean(language),
        ncertChapter: ncertChapter?.toDomain(),
        dependsOn: (dependsOn ?? const <int>[])
            .where((i) => i >= 0)
            .take(2)
            .toList(growable: false),
        clarifyingPrompt: _clean(clarifyingPrompt),
        validationWarning: _clean(validationWarning),
      );
}

/// One action from the response. The same shape backs both the singular
/// `action` (v0.3 compat) and each entry of `plannedActions` (the real queue),
/// so a single DTO decodes both fields.
@JsonSerializable(createToJson: false)
class VidyaActionDto {
  const VidyaActionDto({this.type, this.flow, this.params});

  factory VidyaActionDto.fromJson(Map<String, dynamic> json) =>
      _$VidyaActionDtoFromJson(json);

  final String? type;
  final String? flow;
  final VidyaActionParamsDto? params;

  /// A guarded directive, or null when this is not a NAVIGATE_AND_FILL or the
  /// flow is unknown (dropped — the closed-enum guard). `type == null` is
  /// treated as a navigate, since every `plannedActions` entry is one.
  VidyaDirective? toDirective() {
    if (type != null && type != 'NAVIGATE_AND_FILL') return null;
    final f = VidyaFlow.fromWire(flow);
    if (f == null) return null;
    return VidyaDirective(
      flow: f,
      params: (params ?? const VidyaActionParamsDto()).toDomain(),
    );
  }
}

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}
