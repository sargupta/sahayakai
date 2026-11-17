import 'map_icon_tile.dart';

/// A tool's tint, by its registry id: the same families My work uses for
/// saved content (lessons and answers saffron; worksheets, visuals and trips
/// leaf; quizzes, papers and training indigo; rubrics and grading amber), so a
/// tool and what it makes share a colour everywhere.
MapTint toolTint(String toolId) => switch (toolId) {
  'worksheet' ||
  'visual-aid' ||
  'virtual-field-trip' ||
  'video-storyteller' ||
  'attendance' => MapTint.leaf,
  'quiz' || 'exam-paper' || 'teacher-training' => MapTint.indigo,
  'rubric' || 'assessment-scanner' || 'assess-assignment' => MapTint.amber,
  _ => MapTint.saffron,
};
