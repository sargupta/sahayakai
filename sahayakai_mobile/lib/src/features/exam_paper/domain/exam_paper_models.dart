import 'dart:convert';

// ─────────────────── Input ───────────────────

class ExamPaperInput {
  final String board;
  final String gradeLevel;
  final String subject;
  final List<String> chapters;
  final String difficulty;
  final String language;
  final bool includeAnswerKey;
  final bool includeMarkingScheme;

  const ExamPaperInput({
    required this.board,
    required this.gradeLevel,
    required this.subject,
    this.chapters = const [],
    this.difficulty = 'mixed',
    this.language = 'English',
    this.includeAnswerKey = true,
    this.includeMarkingScheme = true,
  });

  Map<String, dynamic> toJson() => {
        'board': board,
        'gradeLevel': gradeLevel,
        'subject': subject,
        'chapters': chapters,
        'difficulty': difficulty,
        'language': language,
        'includeAnswerKey': includeAnswerKey,
        'includeMarkingScheme': includeMarkingScheme,
      };
}

// ─────────────────── Output ───────────────────

class ExamPaperOutput {
  final String title;
  final String board;
  final String subject;
  final String gradeLevel;
  final String duration;
  final String maxMarks;
  final List<String> generalInstructions;
  final List<ExamSection> sections;
  final BlueprintSummary? blueprintSummary;
  final List<PYQSource>? pyqSources;

  const ExamPaperOutput({
    required this.title,
    required this.board,
    required this.subject,
    required this.gradeLevel,
    required this.duration,
    required this.maxMarks,
    required this.generalInstructions,
    required this.sections,
    this.blueprintSummary,
    this.pyqSources,
  });

  factory ExamPaperOutput.fromJson(Map<String, dynamic> json) {
    return ExamPaperOutput(
      title: json['title'] ?? '',
      board: json['board'] ?? '',
      subject: json['subject'] ?? '',
      gradeLevel: json['gradeLevel'] ?? '',
      duration: json['duration']?.toString() ?? '',
      maxMarks: json['maxMarks']?.toString() ?? '',
      generalInstructions:
          List<String>.from(json['generalInstructions'] ?? []),
      sections: (json['sections'] as List<dynamic>?)
              ?.map((e) => ExamSection.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      blueprintSummary: json['blueprintSummary'] != null
          ? BlueprintSummary.fromJson(
              json['blueprintSummary'] as Map<String, dynamic>)
          : null,
      pyqSources: (json['pyqSources'] as List<dynamic>?)
          ?.map((e) => PYQSource.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'title': title,
        'board': board,
        'subject': subject,
        'gradeLevel': gradeLevel,
        'duration': duration,
        'maxMarks': maxMarks,
        'generalInstructions': generalInstructions,
        'sections': sections.map((s) => s.toJson()).toList(),
        'blueprintSummary': blueprintSummary?.toJson(),
        'pyqSources': pyqSources?.map((p) => p.toJson()).toList(),
      };

  String toJsonString() => jsonEncode(toJson());

  static ExamPaperOutput fromJsonString(String s) =>
      ExamPaperOutput.fromJson(jsonDecode(s) as Map<String, dynamic>);
}

// ─────────────────── Section ───────────────────

class ExamSection {
  final String name;
  final String label;
  final int totalMarks;
  final List<ExamQuestion> questions;

  const ExamSection({
    required this.name,
    required this.label,
    required this.totalMarks,
    required this.questions,
  });

  factory ExamSection.fromJson(Map<String, dynamic> json) => ExamSection(
        name: json['name'] ?? '',
        label: json['label'] ?? '',
        totalMarks: (json['totalMarks'] as num?)?.toInt() ?? 0,
        questions: (json['questions'] as List<dynamic>?)
                ?.map((e) =>
                    ExamQuestion.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'label': label,
        'totalMarks': totalMarks,
        'questions': questions.map((q) => q.toJson()).toList(),
      };
}

// ─────────────────── Question ───────────────────

class ExamQuestion {
  final String text;
  final String type;
  final String marks;
  final List<String>? options;
  final String? answer;
  final String? solution;

  const ExamQuestion({
    required this.text,
    required this.type,
    required this.marks,
    this.options,
    this.answer,
    this.solution,
  });

  factory ExamQuestion.fromJson(Map<String, dynamic> json) => ExamQuestion(
        text: json['text'] ?? json['question'] ?? '',
        type: json['type'] ?? 'short_answer',
        marks: json['marks']?.toString() ?? '1',
        options: (json['options'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList(),
        answer: json['answer']?.toString(),
        solution: json['solution']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        'text': text,
        'type': type,
        'marks': marks,
        if (options != null) 'options': options,
        if (answer != null) 'answer': answer,
        if (solution != null) 'solution': solution,
      };
}

// ─────────────────── Blueprint Summary ───────────────────

class BlueprintSummary {
  final Map<String, int> chapterWise;
  final Map<String, int> difficultyWise;

  const BlueprintSummary({
    required this.chapterWise,
    required this.difficultyWise,
  });

  factory BlueprintSummary.fromJson(Map<String, dynamic> json) =>
      BlueprintSummary(
        chapterWise: Map<String, int>.from(
          (json['chapterWise'] as Map<String, dynamic>?)?.map(
                (k, v) => MapEntry(k, (v as num).toInt()),
              ) ??
              {},
        ),
        difficultyWise: Map<String, int>.from(
          (json['difficultyWise'] as Map<String, dynamic>?)?.map(
                (k, v) => MapEntry(k, (v as num).toInt()),
              ) ??
              {},
        ),
      );

  Map<String, dynamic> toJson() => {
        'chapterWise': chapterWise,
        'difficultyWise': difficultyWise,
      };
}

// ─────────────────── PYQ Source ───────────────────

class PYQSource {
  final String id;
  final String year;
  final String chapter;

  const PYQSource({
    required this.id,
    required this.year,
    required this.chapter,
  });

  factory PYQSource.fromJson(Map<String, dynamic> json) => PYQSource(
        id: json['id']?.toString() ?? '',
        year: json['year']?.toString() ?? '',
        chapter: json['chapter']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {'id': id, 'year': year, 'chapter': chapter};
}
