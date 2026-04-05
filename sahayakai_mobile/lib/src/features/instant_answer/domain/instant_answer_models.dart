class InstantAnswerInput {
  final String question;
  final String? language;
  final String? gradeLevel;

  const InstantAnswerInput({
    required this.question,
    this.language,
    this.gradeLevel,
  });

  Map<String, dynamic> toJson() => {
        'question': question,
        if (language != null) 'language': language,
        if (gradeLevel != null) 'gradeLevel': gradeLevel,
      };
}

class InstantAnswerOutput {
  final String answer;
  final String? videoSuggestionUrl;

  const InstantAnswerOutput({
    required this.answer,
    this.videoSuggestionUrl,
  });

  factory InstantAnswerOutput.fromJson(Map<String, dynamic> json) {
    return InstantAnswerOutput(
      answer: json['answer'] as String? ?? '',
      videoSuggestionUrl: json['videoSuggestionUrl'] as String?,
    );
  }
}

class InstantAnswerException implements Exception {
  final String message;
  final bool isPlanLimit;

  const InstantAnswerException(this.message, {this.isPlanLimit = false});

  @override
  String toString() => message;
}
