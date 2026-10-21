// Quiz-only picker lists. Grade/subject live in `shared/domain/picker_options.dart`
// because every tool form offers them; these are quiz-specific, so they stay in
// the feature until a second tool needs them.

/// Bloom's taxonomy levels, verbatim from the web form
/// (`src/app/quiz-generator/page.tsx`). These are prompt-facing API values, so
/// they stay in English and are NOT localized; only the field label is.
const List<String> kBloomsTaxonomyLevels = <String>[
  'Remember',
  'Understand',
  'Apply',
  'Analyze',
  'Evaluate',
  'Create',
];

/// The web form's defaults, mirrored so a teacher moving between the web app
/// and the phone gets the same starting quiz.
const List<String> kDefaultBloomsTaxonomyLevels = <String>[
  'Remember',
  'Understand',
];

/// `numQuestions` bounds, matching the web form's zod schema (min 1, max 20).
const int kMinQuestions = 1;
const int kMaxQuestions = 20;
const int kDefaultQuestions = 5;
