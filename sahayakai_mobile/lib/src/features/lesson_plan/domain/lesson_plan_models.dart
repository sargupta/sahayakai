class LessonPlanInput {
  final String topic;
  final String language;
  final List<String> gradeLevels;
  final String resourceLevel; // 'low', 'medium', 'high'
  final bool useRuralContext;

  LessonPlanInput({
    required this.topic,
    this.language = 'English',
    this.gradeLevels = const ['Grade 1'],
    this.resourceLevel = 'low',
    this.useRuralContext = true,
  });

  Map<String, dynamic> toJson() {
    return {
      'topic': topic,
      'language': language,
      'gradeLevels': gradeLevels,
      'useRuralContext': useRuralContext,
      // Default hardcoded for MVP
      'resourceLevel': 'low',
      'difficultyLevel': 'standard',
    };
  }
}

class LessonPlanOutput {
  final String title;
  final String gradeLevel;
  final String duration;
  final String subject;
  final List<String> objectives;
  final List<String> materials;
  final List<Activity> activities;
  final String assessment;

  LessonPlanOutput({
    required this.title,
    required this.gradeLevel,
    required this.duration,
    required this.subject,
    required this.objectives,
    required this.materials,
    required this.activities,
    required this.assessment,
  });

  factory LessonPlanOutput.fromJson(Map<String, dynamic> json) {
    return LessonPlanOutput(
      title: json['title'] ?? '',
      gradeLevel: json['gradeLevel'] ?? '',
      duration: json['duration'] ?? '',
      subject: json['subject'] ?? '',
      objectives: List<String>.from(json['objectives'] ?? []),
      materials: List<String>.from(json['materials'] ?? []),
      activities: (json['activities'] as List<dynamic>?)
              ?.map((e) => Activity.fromJson(e))
              .toList() ??
          [],
      assessment: json['assessment'] ?? '',
    );
  }
}

class Activity {
  final String name;
  final String description;
  final String duration;

  Activity({
    required this.name,
    required this.description,
    required this.duration,
  });

  factory Activity.fromJson(Map<String, dynamic> json) {
    return Activity(
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      duration: json['duration'] ?? '',
    );
  }
}
