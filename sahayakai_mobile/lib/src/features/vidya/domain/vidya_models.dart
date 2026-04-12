/// VIDYA assistant response from POST /assistant.
class VidyaResponse {
  final String response;
  final VidyaAction? action;

  const VidyaResponse({required this.response, this.action});

  factory VidyaResponse.fromJson(Map<String, dynamic> json) {
    final actionRaw = json['action'] as Map<String, dynamic>?;
    return VidyaResponse(
      response: json['response'] as String? ?? '',
      action: actionRaw != null ? VidyaAction.fromJson(actionRaw) : null,
    );
  }
}

/// Agentic action — VIDYA can navigate to a flow and pre-fill form fields.
class VidyaAction {
  final String type; // 'NAVIGATE_AND_FILL'
  final String flow; // e.g. 'lesson-plan', 'quiz-generator'
  final String label; // Human-readable label
  final Map<String, dynamic> params; // Pre-fill params

  const VidyaAction({
    required this.type,
    required this.flow,
    required this.label,
    this.params = const {},
  });

  factory VidyaAction.fromJson(Map<String, dynamic> json) => VidyaAction(
        type: json['type'] as String? ?? '',
        flow: json['flow'] as String? ?? '',
        label: json['label'] as String? ?? '',
        params: json['params'] as Map<String, dynamic>? ?? {},
      );

  /// Map flow key to GoRouter path.
  String get routePath {
    switch (flow) {
      case 'lesson-plan':
        return '/create-lesson';
      case 'quiz-generator':
        return '/quiz-config';
      case 'worksheet-wizard':
        return '/worksheet-wizard';
      case 'visual-aid-designer':
        return '/visual-aid-creator';
      case 'video-storyteller':
        return '/video-storyteller';
      case 'teacher-training':
        return '/teacher-training';
      case 'virtual-field-trip':
        return '/virtual-field-trip';
      case 'rubric-generator':
        return '/rubric-generator';
      case 'instant-answer':
        return '/instant-answer';
      case 'exam-paper':
        return '/exam-paper';
      default:
        return '/';
    }
  }
}

/// A single turn in a VIDYA conversation.
class VidyaTurn {
  final String user;
  final String ai;
  final VidyaAction? action;
  final DateTime timestamp;

  const VidyaTurn({
    required this.user,
    required this.ai,
    this.action,
    required this.timestamp,
  });

  Map<String, dynamic> toJson() => {
        'user': user,
        'ai': ai,
        if (action != null)
          'action': {
            'type': action!.type,
            'flow': action!.flow,
            'label': action!.label,
            'params': action!.params,
          },
        'timestamp': timestamp.toIso8601String(),
      };

  factory VidyaTurn.fromJson(Map<String, dynamic> json) => VidyaTurn(
        user: json['user'] as String? ?? '',
        ai: json['ai'] as String? ?? '',
        action: json['action'] != null
            ? VidyaAction.fromJson(json['action'] as Map<String, dynamic>)
            : null,
        timestamp: DateTime.tryParse(json['timestamp'] as String? ?? '') ??
            DateTime.now(),
      );
}

/// A VIDYA conversation session.
class VidyaSession {
  final String? id;
  final List<VidyaTurn> turns;
  final DateTime createdAt;
  final DateTime updatedAt;

  const VidyaSession({
    this.id,
    required this.turns,
    required this.createdAt,
    required this.updatedAt,
  });

  factory VidyaSession.fromJson(Map<String, dynamic> json) => VidyaSession(
        id: json['id'] as String?,
        turns: (json['turns'] as List<dynamic>?)
                ?.map((t) => VidyaTurn.fromJson(t as Map<String, dynamic>))
                .toList() ??
            [],
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
            DateTime.now(),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
            DateTime.now(),
      );

  Map<String, dynamic> toJson() => {
        if (id != null) 'id': id,
        'turns': turns.map((t) => t.toJson()).toList(),
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
      };
}

/// VIDYA's persistent memory about a teacher.
class VidyaProfile {
  final String? preferredGrade;
  final String? preferredSubject;
  final String? schoolContext;
  final String? notes;

  const VidyaProfile({
    this.preferredGrade,
    this.preferredSubject,
    this.schoolContext,
    this.notes,
  });

  factory VidyaProfile.fromJson(Map<String, dynamic> json) => VidyaProfile(
        preferredGrade: json['preferredGrade'] as String?,
        preferredSubject: json['preferredSubject'] as String?,
        schoolContext: json['schoolContext'] as String?,
        notes: json['notes'] as String?,
      );

  Map<String, dynamic> toJson() => {
        if (preferredGrade != null) 'preferredGrade': preferredGrade,
        if (preferredSubject != null) 'preferredSubject': preferredSubject,
        if (schoolContext != null) 'schoolContext': schoolContext,
        if (notes != null) 'notes': notes,
      };
}
