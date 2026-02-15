class QuizConfig {
  final String topic;
  final int numQuestions;
  final String gradeLevel;
  final String language;
  final List<String> questionTypes;
  final List<String> bloomsLevels;

  QuizConfig({
    required this.topic,
    this.numQuestions = 5,
    this.gradeLevel = '5th Grade',
    this.language = 'English',
    this.questionTypes = const ['multiple_choice'],
    this.bloomsLevels = const ['Remember'],
  });

  Map<String, dynamic> toJson() {
    return {
      'topic': topic,
      'numQuestions': numQuestions,
      'gradeLevel': gradeLevel,
      'language': language,
      'questionTypes': questionTypes,
      'bloomsTaxonomyLevels': bloomsLevels,
    };
  }
}

class Quiz {
  final String title;
  final List<Question> questions;

  Quiz({required this.title, required this.questions});

  factory Quiz.fromJson(Map<String, dynamic> json) {
    return Quiz(
      title: json['title'] ?? 'Generated Quiz',
      questions: (json['questions'] as List<dynamic>?)
              ?.map((e) => Question.fromJson(e))
              .toList() ??
          [],
    );
  }
}

class Question {
  final String text;
  final String type;
  final List<String> options;
  final String correctAnswer;
  final String explanation;

  Question({
    required this.text,
    required this.type,
    required this.options,
    required this.correctAnswer,
    required this.explanation,
  });

  factory Question.fromJson(Map<String, dynamic> json) {
    return Question(
      text: json['question'] ?? '',
      type: json['type'] ?? 'multiple_choice',
      options: List<String>.from(json['options'] ?? []),
      correctAnswer: json['answer'] ?? '',
      explanation: json['explanation'] ?? '',
    );
  }
}
