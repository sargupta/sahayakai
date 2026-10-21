import 'package:flutter/foundation.dart';
import 'package:json_annotation/json_annotation.dart';

import 'vidya_action.dart';

part 'assistant_response.g.dart';

/// The domain result of one VIDYA turn: what she [response]-speaks back, plus
/// the guarded [directives] (unknown flows already dropped). The controller
/// (U-V3) decides the 0/1/2-3 behaviour from [directives]:
///   • empty     → conversational, just speak the reply
///   • single    → auto-navigate + prefill the tool
///   • 2 or 3    → render confirm chips, teacher taps each.
@immutable
class VidyaTurn {
  const VidyaTurn({required this.response, required this.directives});

  final String response;
  final List<VidyaDirective> directives;

  bool get isConversational => directives.isEmpty;
  bool get isSingleAction => directives.length == 1;
  bool get isCompound => directives.length > 1;

  @override
  bool operator ==(Object other) =>
      other is VidyaTurn &&
      other.response == response &&
      listEquals(other.directives, directives);

  @override
  int get hashCode => Object.hash(response, Object.hashAll(directives));
}

/// Decodes the `POST /api/assistant` 200 body
/// `{ response, action, plannedActions[] }`.
@JsonSerializable(createToJson: false)
class AssistantResponseDto {
  const AssistantResponseDto({this.response, this.action, this.plannedActions});

  factory AssistantResponseDto.fromJson(Map<String, dynamic> json) =>
      _$AssistantResponseDtoFromJson(json);

  final String? response;

  /// Singular, v0.3-compat action (`plannedActions[0]`). Only used when
  /// [plannedActions] is absent/empty.
  final VidyaActionDto? action;

  /// The real 0-3 action queue.
  final List<VidyaActionDto>? plannedActions;

  VidyaTurn toDomain() {
    final directives = <VidyaDirective>[];
    final planned = plannedActions;
    if (planned != null && planned.isNotEmpty) {
      // Prefer the plural queue; guard each (drop unknown flows).
      for (final a in planned) {
        final d = a.toDirective();
        if (d != null) directives.add(d);
      }
    } else {
      // Fall back to the singular action, guarded the same way.
      final d = action?.toDirective();
      if (d != null) directives.add(d);
    }
    return VidyaTurn(
      response: response?.trim() ?? '',
      // Cap at 3 to match the sidecar wire schema / supervisor bound.
      directives: directives.take(3).toList(growable: false),
    );
  }
}
